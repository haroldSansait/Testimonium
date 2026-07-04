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

    const existingUser =
      await this.userRepository.findByFirebaseUid(firebaseUid);

    if (existingUser) {
      return this.toApplicationProfile(existingUser);
    }

    const parishionerRole = await this.roleRepository.findByName("PARISHIONER");

    if (!parishionerRole) {
      const error = new Error("Default PARISHIONER role is not configured.");
      error.statusCode = 500;
      throw error;
    }

    const createdUser = await this.userRepository.createFromFirebaseProfile({
      firebaseUid,
      email,
      fullName: this.resolveFullName(decodedToken),
      isVerified: Boolean(decodedToken.email_verified),
      roleId: parishionerRole.id,
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
