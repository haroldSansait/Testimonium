import { prisma } from "../config/db.js";

const profileInclude = {
  role: true,
  parish: true,
};

export class UserRepository {
  async findByFirebaseUid(firebaseUid) {
    return prisma.user.findUnique({
      where: { firebaseUid },
      include: profileInclude,
    });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email },
      include: profileInclude,
    });
  }

  async updateFirebaseUid(userId, firebaseUid) {
    return prisma.user.update({
      where: { id: userId },
      data: { firebaseUid },
      include: profileInclude,
    });
  }

  async create({
    firebaseUid,
    email,
    fullName,
    isVerified,
    roleId,
    parishId = null,
  }) {
    return prisma.user.create({
      data: {
        firebaseUid,
        email,
        fullName,
        isVerified,
        roleId,
        parishId,
      },
      include: profileInclude,
    });
  }

  async createFromFirebaseProfile({
    firebaseUid,
    email,
    fullName,
    isVerified,
    roleId,
  }) {
    return this.create({
      firebaseUid,
      email,
      fullName,
      isVerified,
      roleId,
      parishId: null,
    });
  }
}
