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
    isAssistant = false,
    termsAcceptedAt = null,
    privacyAcceptedAt = null,
    termsVersion = null,
    privacyVersion = null,
    emailNotificationsEnabled = true,
  }) {
    return prisma.user.create({
      data: {
        firebaseUid,
        email,
        fullName,
        isVerified,
        roleId,
        parishId,
        isAssistant,
        termsAcceptedAt,
        privacyAcceptedAt,
        termsVersion,
        privacyVersion,
        emailNotificationsEnabled,
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
    termsAcceptedAt = null,
    privacyAcceptedAt = null,
    termsVersion = null,
    privacyVersion = null,
  }) {
    return this.create({
      firebaseUid,
      email,
      fullName,
      isVerified,
      roleId,
      parishId: null,
      termsAcceptedAt,
      privacyAcceptedAt,
      termsVersion,
      privacyVersion,
    });
  }

  /**
   * Retrieves staff users based on optional search, role, and status filters.
   * Restricts results to DIOCESE_COORDINATOR, PRIEST, and SECRETARY roles.
   * @param {object} filters
   * @returns {Promise<Array>}
   */
  async findMany({ search, role, status, page, limit, assignableForParishId, parishId } = {}) {
    const andConditions = [
      {
        role: {
          roleName: {
            in: ["DIOCESE_COORDINATOR", "PRIEST", "SECRETARY", "PARISHIONER"],
          },
        },
      },
    ];

    if (role && role !== "all") {
      if (role === "PARISHIONER") {
        andConditions.push({ role: { roleName: "PARISHIONER" } });
      } else if (role === "staff") {
        andConditions.push({
          role: {
            roleName: {
              in: ["DIOCESE_COORDINATOR", "PRIEST", "SECRETARY"],
            },
          },
        });
      } else if (role === "ASSISTANT_PRIEST") {
        andConditions.push({ role: { roleName: "PRIEST" }, isAssistant: true });
      } else if (role === "PRIEST") {
        andConditions.push({ role: { roleName: "PRIEST" } });
        if (assignableForParishId !== undefined) {
          andConditions.push({ isAssistant: false });
        }
      } else {
        andConditions.push({ role: { roleName: role } });
      }
    }

    if (parishId) {
      andConditions.push({ parishId: parseInt(parishId, 10) });
    }

    if (assignableForParishId !== undefined) {
      const parishIdVal = assignableForParishId ? parseInt(assignableForParishId, 10) : null;
      andConditions.push({
        OR: [
          {
            status: "ACTIVE",
            parishId: null,
          },
          {
            parishId: parishIdVal,
          },
        ],
      });
    } else {
      if (status && status !== "all") {
        andConditions.push({ status: status === "Active" ? "ACTIVE" : "INACTIVE" });
      }
    }

    if (search) {
      const searchPattern = { contains: search, mode: "insensitive" };
      andConditions.push({
        OR: [
          { fullName: searchPattern },
          { email: searchPattern },
          {
            parish: {
              parishName: searchPattern,
            },
          },
        ],
      });
    }

    const where = { AND: andConditions };

    const queryOpts = {
      where,
      include: {
        role: true,
        parish: true,
      },
      orderBy: {
        fullName: "asc",
      },
    };

    if (page !== undefined && limit !== undefined) {
      const parsedPage = Math.max(1, parseInt(page, 10) || 1);
      const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
      queryOpts.skip = (parsedPage - 1) * parsedLimit;
      queryOpts.take = parsedLimit;
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany(queryOpts),
      prisma.user.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Finds a user by their numeric database ID.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        parish: true,
      },
    });
  }

  /**
   * Updates user profile fields in the database.
   * @param {number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const updateData = {};
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.roleId !== undefined) updateData.roleId = data.roleId;
    if (data.parishId !== undefined) updateData.parishId = data.parishId;
    if (data.contactNumber !== undefined) updateData.contactNumber = data.contactNumber;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.isAssistant !== undefined) updateData.isAssistant = data.isAssistant;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.isVerified !== undefined) updateData.isVerified = data.isVerified;
    if (data.termsAcceptedAt !== undefined) updateData.termsAcceptedAt = data.termsAcceptedAt;
    if (data.privacyAcceptedAt !== undefined) updateData.privacyAcceptedAt = data.privacyAcceptedAt;
    if (data.termsVersion !== undefined) updateData.termsVersion = data.termsVersion;
    if (data.privacyVersion !== undefined) updateData.privacyVersion = data.privacyVersion;
    if (data.lastVerificationResentAt !== undefined) updateData.lastVerificationResentAt = data.lastVerificationResentAt;
    if (data.verificationResentCount !== undefined) updateData.verificationResentCount = data.verificationResentCount;
    if (data.emailNotificationsEnabled !== undefined) updateData.emailNotificationsEnabled = data.emailNotificationsEnabled;

    return prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: true,
        parish: true,
      },
    });
  }

  /**
   * Updates user active status in the database.
   * @param {number} id
   * @param {string} status - ACTIVE or INACTIVE
   * @returns {Promise<object>}
   */
  async updateStatus(id, status) {
    return prisma.user.update({
      where: { id },
      data: { status },
      include: {
        role: true,
        parish: true,
      },
    });
  }
}
