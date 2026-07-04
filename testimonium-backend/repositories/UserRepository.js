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

  async createFromFirebaseProfile({
    firebaseUid,
    email,
    fullName,
    isVerified,
    roleId,
  }) {
    return prisma.user.create({
      data: {
        firebaseUid,
        email,
        fullName,
        isVerified,
        roleId,
      },
      include: profileInclude,
    });
  }
}
