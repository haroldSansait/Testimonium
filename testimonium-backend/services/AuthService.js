import { RoleRepository } from "../repositories/RoleRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";

export class AuthService {
  constructor(
    userRepository = new UserRepository(),
    roleRepository = new RoleRepository(),
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
  }

  async getOrCreateApplicationUser(decodedToken) {
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!firebaseUid || !email) {
      const error = new Error("Firebase token is missing required profile claims.");
      error.statusCode = 401;
      throw error;
    }

    // 1. Lookup by firebase_uid
    const existingUser =
      await this.userRepository.findByFirebaseUid(firebaseUid);

    if (existingUser) {
      return this.toApplicationProfile(existingUser);
    }

    // 2. Lookup by email (for pre-provisioned accounts linking)
    const existingUserByEmail = await this.userRepository.findByEmail(email);

    if (existingUserByEmail) {
      // Reject if firebaseUid is already set (non-null) and belongs to a different Firebase account
      if (existingUserByEmail.firebaseUid) {
        if (existingUserByEmail.firebaseUid === firebaseUid) {
          return this.toApplicationProfile(existingUserByEmail);
        }
        const error = new Error("This email is already linked to another authentication account.");
        error.statusCode = 409;
        throw error;
      }

      // Link the Firebase UID to the existing pre-provisioned staff record
      try {
        const linkedUser = await this.userRepository.updateFirebaseUid(
          existingUserByEmail.id,
          firebaseUid,
        );
        return this.toApplicationProfile(linkedUser);
      } catch (error) {
        // Handle concurrent linking race condition (P2002 unique constraint failure)
        if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
          console.log(`[AuthService] JIT email-linking race condition detected for ${firebaseUid}. Retrying lookup...`);
          const user = (await this.userRepository.findByFirebaseUid(firebaseUid)) || 
                       (await this.userRepository.findByEmail(email));
          if (user) {
            return this.toApplicationProfile(user);
          }
        }
        throw error;
      }
    }

    // 3. Email does not exist: create a new PARISHIONER
    const parishionerRole = await this.roleRepository.findByName("PARISHIONER");

    if (!parishionerRole) {
      const error = new Error("Default PARISHIONER role is not configured.");
      error.statusCode = 500;
      throw error;
    }

    try {
      const createdUser = await this.userRepository.create({
        firebaseUid,
        email,
        fullName: this.resolveFullName(decodedToken),
        isVerified: Boolean(decodedToken.email_verified),
        roleId: parishionerRole.id,
        parishId: null,
      });

      return this.toApplicationProfile(createdUser);
    } catch (error) {
      // Handle concurrent user JIT creation race condition (P2002 unique constraint failure)
      if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
        console.log(`[AuthService] JIT creation race condition detected for ${firebaseUid}. Retrying lookup...`);
        const user = (await this.userRepository.findByFirebaseUid(firebaseUid)) || 
                     (await this.userRepository.findByEmail(email));
        if (user) {
          return this.toApplicationProfile(user);
        }
      }
      throw error;
    }
  }

  resolveFullName(decodedToken) {
    if (decodedToken.name) {
      return decodedToken.name;
    }

    return decodedToken.email.split("@")[0];
  }

  toApplicationProfile(user) {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      fullName: user.fullName,
      contactNumber: user.contactNumber,
      isVerified: user.isVerified,
      status: user.status,
      role: user.role.roleName,
      parish: user.parish
        ? {
            id: user.parish.id,
            parishName: user.parish.parishName,
            type: user.parish.type,
          }
        : null,
    };
  }
}
