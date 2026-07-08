import { prisma } from "../config/db.js";
import { getFirebaseApp, getFirebaseAuth } from "../config/firebase.js";

async function sync() {
  console.log("======================================================================");
  console.log("[TESTIMONIUM] Starting User Authentication Synchronization...");
  console.log("======================================================================");

  // Ensure Firebase is initialized
  getFirebaseApp();

  // 1. Fetch all Firebase users
  const firebaseUsersMap = new Map(); // email -> uid
  let nextPageToken;
  let firebaseCount = 0;

  try {
    do {
      const result = await getFirebaseAuth().listUsers(1000, nextPageToken);
      for (const fbUser of result.users) {
        if (fbUser.email) {
          firebaseUsersMap.set(fbUser.email.toLowerCase(), fbUser.uid);
          firebaseCount++;
        }
      }
      nextPageToken = result.pageToken;
    } while (nextPageToken);
  } catch (fbErr) {
    console.error("[TESTIMONIUM] Failed to fetch users from Firebase Auth:", fbErr.message);
    throw fbErr;
  }

  console.log(`[TESTIMONIUM] Loaded ${firebaseCount} accounts from Firebase Authentication.`);

  // 2. Fetch all PostgreSQL users
  const pgUsers = await prisma.user.findMany({
    include: {
      role: true,
    },
  });

  const linked = [];
  let skippedAlreadyLinked = 0;
  let skippedMismatched = 0;
  const remainingNoFirebase = [];
  const processedEmails = new Set();

  // 3. Process PostgreSQL users
  for (const pgUser of pgUsers) {
    const emailKey = pgUser.email.toLowerCase();
    processedEmails.add(emailKey);

    const fbUid = firebaseUsersMap.get(emailKey);

    if (pgUser.firebaseUid) {
      if (fbUid) {
        if (pgUser.firebaseUid === fbUid) {
          skippedAlreadyLinked++;
        } else {
          console.warn(
            `[TESTIMONIUM] Warning: User ${pgUser.email} has mismatched UID (DB: ${pgUser.firebaseUid}, Firebase: ${fbUid}). Skipping.`,
          );
          skippedMismatched++;
        }
      } else {
        // UID in DB but not in Firebase (e.g. deleted Firebase user)
        skippedMismatched++;
      }
    } else {
      // Missing firebaseUid in DB
      if (fbUid) {
        // Match found! Sync it.
        await prisma.user.update({
          where: { id: pgUser.id },
          data: { firebaseUid: fbUid },
        });
        linked.push({
          email: pgUser.email,
          fullName: pgUser.fullName,
          role: pgUser.role.roleName,
          uid: fbUid,
        });
      } else {
        // No match in Firebase
        remainingNoFirebase.push({
          email: pgUser.email,
          fullName: pgUser.fullName,
          role: pgUser.role.roleName,
        });
      }
    }
  }

  // 4. Calculate Firebase users not present in PostgreSQL
  let skippedNoMatchingPostgres = 0;
  for (const [fbEmail] of firebaseUsersMap) {
    if (!processedEmails.has(fbEmail)) {
      skippedNoMatchingPostgres++;
    }
  }

  // 5. Print Summary
  console.log("\n======================================================================");
  console.log("                      SYNCHRONIZATION SUMMARY");
  console.log("======================================================================");
  
  console.log(`\nLink Status:`);
  console.log(` - Successfully Linked (Newly Synced): ${linked.length}`);
  if (linked.length > 0) {
    linked.forEach((u) => {
      console.log(`     * ${u.fullName} (${u.email}) -> Role: ${u.role}, UID: ${u.uid}`);
    });
  }

  console.log(`\nSkipped Users:`);
  console.log(` - Already Linked (Idempotent Skip):   ${skippedAlreadyLinked}`);
  console.log(` - Mismatched or DB-Only UIDs:         ${skippedMismatched}`);
  console.log(` - Firebase-Only Users:                ${skippedNoMatchingPostgres}`);

  console.log(`\nRemaining PostgreSQL Users Without Firebase Account:`);
  console.log(` - Total:                              ${remainingNoFirebase.length}`);
  if (remainingNoFirebase.length > 0) {
    remainingNoFirebase.forEach((u) => {
      console.log(`     * ${u.fullName} (${u.email}) [Role: ${u.role}]`);
    });
  }
  console.log("======================================================================");
}

sync()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[TESTIMONIUM] Sync failed:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  });
