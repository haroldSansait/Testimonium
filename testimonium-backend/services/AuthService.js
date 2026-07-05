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
        const error = new Error("This email is already linked to another authentication account.");
        error.statusCode = 409;
        throw error;
      }

      // Link the Firebase UID to the existing pre-provisioned staff record
      const linkedUser = await this.userRepository.updateFirebaseUid(
        existingUserByEmail.id,
        firebaseUid,
      );
      return this.toApplicationProfile(linkedUser);
    }

    // 3. Email does not exist: create a new PARISHIONER
    const parishionerRole = await this.roleRepository.findByName("PARISHIONER");

    if (!parishionerRole) {
      const error = new Error("Default PARISHIONER role is not configured.");
      error.statusCode = 500;
      throw error;
    }

    const createdUser = await this.userRepository.create({
      firebaseUid,
      email,
      fullName: this.resolveFullName(decodedToken),
      isVerified: Boolean(decodedToken.email_verified),
      roleId: parishionerRole.id,
      parishId: null,
    });

    return this.toApplicationProfile(createdUser);
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
