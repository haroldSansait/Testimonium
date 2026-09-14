import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(__dirname, "presentation_seed_manifest.json");

// Excluded table counters for non-invasive dynamic verification
async function getExcludedCounts() {
  const [
    chatbotLogs,
    aiUsageEvents,
    caloyRuntimeConfig,
    systemLeases,
    knowledgeSources,
    knowledgeChunks,
    activityLogs,
    massScheduleTemplates,
  ] = await Promise.all([
    prisma.chatbotLog.count(),
    prisma.aiUsageEvent.count(),
    prisma.caloyRuntimeConfig.count(),
    prisma.systemLease.count(),
    prisma.knowledgeSource.count(),
    prisma.knowledgeChunk.count(),
    prisma.activityLog.count(),
    prisma.massScheduleTemplate.count(),
  ]);

  return {
    chatbotLogs,
    aiUsageEvents,
    caloyRuntimeConfig,
    systemLeases,
    knowledgeSources,
    knowledgeChunks,
    activityLogs,
    massScheduleTemplates,
  };
}

function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
      return {
        manifestVersion: data.manifestVersion || "1.0.0",
        generatedAt: data.generatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parishionerUserIds: Array.isArray(data.parishionerUserIds) ? data.parishionerUserIds : [],
        documentRequestIds: Array.isArray(data.documentRequestIds) ? data.documentRequestIds : [],
        paymentTransactionIds: Array.isArray(data.paymentTransactionIds) ? data.paymentTransactionIds : [],
        scheduleIds: Array.isArray(data.scheduleIds) ? data.scheduleIds : [],
        parishEventIds: Array.isArray(data.parishEventIds) ? data.parishEventIds : [],
        dailyReportIds: Array.isArray(data.dailyReportIds) ? data.dailyReportIds : [],
      };
    } catch {
      // ignore
    }
  }

  return {
    manifestVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parishionerUserIds: [],
    documentRequestIds: [],
    paymentTransactionIds: [],
    scheduleIds: [],
    parishEventIds: [],
    dailyReportIds: [],
  };
}

function resetManifest() {
  const cleanManifest = {
    manifestVersion: "1.0.0",
    cleanedAt: new Date().toISOString(),
    parishionerUserIds: [],
    documentRequestIds: [],
    paymentTransactionIds: [],
    scheduleIds: [],
    parishEventIds: [],
    dailyReportIds: [],
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(cleanManifest, null, 2), "utf8");

  const rootScriptsPath = path.resolve(__dirname, "../../scripts/presentation_seed_manifest.json");
  try {
    const rootDir = path.dirname(rootScriptsPath);
    if (fs.existsSync(rootDir)) {
      fs.writeFileSync(rootScriptsPath, JSON.stringify(cleanManifest, null, 2), "utf8");
    }
  } catch {
    // optional sync
  }
}

// Fallback deterministic identifiers used ONLY if manifest is missing or incomplete
const FALLBACK_EXACT_EMAILS = [
  "presentation.user01@testimonium.local",
  "presentation.user02@testimonium.local",
  "presentation.user03@testimonium.local",
  "presentation.user04@testimonium.local",
  "presentation.user05@testimonium.local",
  "presentation.user06@testimonium.local",
  "presentation.user07@testimonium.local",
  "presentation.user08@testimonium.local",
  "presentation.user09@testimonium.local",
  "presentation.user10@testimonium.local",
  "presentation.user11@testimonium.local",
  "presentation.user12@testimonium.local",
];

const FALLBACK_EXACT_DOC_TRACKING = Array.from({ length: 24 }, (_, i) => `PRES-DOC-${String(i + 1).padStart(3, "0")}`);
const FALLBACK_EXACT_PAY_REFS = Array.from({ length: 11 }, (_, i) => `PRES-PAY-${String(i + 1).padStart(3, "0")}`);

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isExecute = args.includes("--execute");

  if ((!isDryRun && !isExecute) || (isDryRun && isExecute)) {
    console.error("ERROR: You must specify exactly one mode:");
    console.error("  node scripts/cleanup_presentation_data.js --dry-run");
    console.error("  node scripts/cleanup_presentation_data.js --execute");
    process.exit(1);
  }

  console.log("==================================================");
  console.log(`TESTIMONIUM — PRESENTATION DATA CLEANUP [${isDryRun ? "DRY RUN" : "EXECUTE"}]`);
  console.log("==================================================");

  const manifest = loadManifest();

  // 1. Resolve Presentation Users to remove
  let usersToRemove = [];
  if (manifest.parishionerUserIds.length > 0) {
    usersToRemove = await prisma.user.findMany({
      where: { id: { in: manifest.parishionerUserIds } },
      select: { id: true, email: true, role: { select: { roleName: true } } },
    });
  } else {
    // Fallback: exact email list
    usersToRemove = await prisma.user.findMany({
      where: { email: { in: FALLBACK_EXACT_EMAILS } },
      select: { id: true, email: true, role: { select: { roleName: true } } },
    });
  }

  // Safety invariant: Ensure NO non-parishioners are targeted
  for (const u of usersToRemove) {
    if (u.role?.roleName !== "PARISHIONER") {
      throw new Error(`CRITICAL ABORT: User ID ${u.id} (${u.email}) is a ${u.role?.roleName}. Staff users must NEVER be targeted.`);
    }
  }
  const userIds = usersToRemove.map((u) => u.id);

  // 2. Resolve Document Requests to remove
  let docsToRemove = [];
  if (manifest.documentRequestIds.length > 0) {
    docsToRemove = await prisma.documentRequest.findMany({
      where: { id: { in: manifest.documentRequestIds } },
      select: { id: true, trackingNumber: true },
    });
  } else {
    docsToRemove = await prisma.documentRequest.findMany({
      where: { trackingNumber: { in: FALLBACK_EXACT_DOC_TRACKING } },
      select: { id: true, trackingNumber: true },
    });
  }
  const docIds = docsToRemove.map((d) => d.id);

  // 3. Resolve Payment Transactions to remove
  let paymentsToRemove = [];
  if (manifest.paymentTransactionIds.length > 0) {
    paymentsToRemove = await prisma.paymentTransaction.findMany({
      where: { id: { in: manifest.paymentTransactionIds } },
      select: { id: true, referenceNumber: true },
    });
  } else {
    paymentsToRemove = await prisma.paymentTransaction.findMany({
      where: { referenceNumber: { in: FALLBACK_EXACT_PAY_REFS } },
      select: { id: true, referenceNumber: true },
    });
  }
  const paymentIds = paymentsToRemove.map((p) => p.id);

  // 4. Resolve Schedules to remove
  let schedulesToRemove = [];
  if (manifest.scheduleIds.length > 0) {
    schedulesToRemove = await prisma.schedule.findMany({
      where: { id: { in: manifest.scheduleIds } },
      select: { id: true, displayTitle: true },
    });
  } else if (userIds.length > 0) {
    // Fallback: only schedules belonging to our exact presentation users
    schedulesToRemove = await prisma.schedule.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, displayTitle: true },
    });
  }
  const scheduleIds = schedulesToRemove.map((s) => s.id);

  // 5. Resolve Parish Events to remove
  let eventsToRemove = [];
  if (manifest.parishEventIds.length > 0) {
    eventsToRemove = await prisma.parishEvent.findMany({
      where: { id: { in: manifest.parishEventIds } },
      select: { id: true, title: true },
    });
  }
  const eventIds = eventsToRemove.map((e) => e.id);

  // 6. Resolve Daily Reports to remove
  let reportsToRemove = [];
  if (manifest.dailyReportIds.length > 0) {
    reportsToRemove = await prisma.dailyReport.findMany({
      where: { id: { in: manifest.dailyReportIds } },
      select: { id: true, title: true },
    });
  }
  const reportIds = reportsToRemove.map((r) => r.id);

  console.log("Cleanup Target Summary:");
  console.log(`- Presentation Users to remove:       ${usersToRemove.length}`);
  console.log(`- Document Requests to remove:        ${docsToRemove.length}`);
  console.log(`- Payment Transactions to remove:     ${paymentsToRemove.length}`);
  console.log(`- Schedules to remove:                ${schedulesToRemove.length}`);
  console.log(`- Parish Events to remove:            ${eventsToRemove.length}`);
  console.log(`- Daily Reports to remove:            ${reportsToRemove.length}`);

  if (isDryRun) {
    console.log("\n==================================================");
    console.log("DRY RUN COMPLETE: ZERO WRITES PERFORMED.");
    console.log("==================================================");
    return;
  }

  // EXECUTE MODE
  console.log("\nBeginning dependency-safe deletion...");
  const excludedBefore = await getExcludedCounts();

  // Step 1: Delete Payment Transactions
  if (paymentIds.length > 0) {
    const res = await prisma.paymentTransaction.deleteMany({
      where: { id: { in: paymentIds } },
    });
    console.log(`✔ Deleted ${res.count} Payment Transactions`);
  }

  // Step 2: Delete Document Requests
  if (docIds.length > 0) {
    const res = await prisma.documentRequest.deleteMany({
      where: { id: { in: docIds } },
    });
    console.log(`✔ Deleted ${res.count} Document Requests`);
  }

  // Step 3: Delete Schedules
  if (scheduleIds.length > 0) {
    const res = await prisma.schedule.deleteMany({
      where: { id: { in: scheduleIds } },
    });
    console.log(`✔ Deleted ${res.count} Schedules`);
  }

  // Step 4: Delete Parish Events
  if (eventIds.length > 0) {
    const res = await prisma.parishEvent.deleteMany({
      where: { id: { in: eventIds } },
    });
    console.log(`✔ Deleted ${res.count} Parish Events`);
  }

  // Step 5: Delete Daily Reports
  if (reportIds.length > 0) {
    const res = await prisma.dailyReport.deleteMany({
      where: { id: { in: reportIds } },
    });
    console.log(`✔ Deleted ${res.count} Daily Reports`);
  }

  // Step 6: Delete Presentation Parishioner Users
  if (userIds.length > 0) {
    const res = await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    console.log(`✔ Deleted ${res.count} Presentation Parishioner Users`);
  }

  resetManifest();
  console.log(`✔ Manifest reset at ${MANIFEST_PATH}`);

  // Verification of excluded tables
  const excludedAfter = await getExcludedCounts();
  console.log("\nExcluded Tables Post-Cleanup Verification:");
  let excludedChanged = false;
  for (const [table, cnt] of Object.entries(excludedAfter)) {
    const prev = excludedBefore[table];
    const diff = cnt - prev;
    if (diff !== 0) {
      excludedChanged = true;
      console.warn(`! Excluded table "${table}" changed count: was ${prev}, now ${cnt} (diff: ${diff > 0 ? "+" : ""}${diff})`);
    } else {
      console.log(`✔ ${table}: ${cnt} (UNCHANGED)`);
    }
  }

  if (excludedChanged) {
    console.warn("\nNOTICE: Concurrent external activity occurred on excluded tables during cleanup.");
  } else {
    console.log("\n✔ ALL EXCLUDED TABLES REMAIN STRICTLY UNCHANGED.");
  }

  console.log("\nCleanup execution completed successfully.");
}

main()
  .catch((err) => {
    console.error("FATAL: Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
