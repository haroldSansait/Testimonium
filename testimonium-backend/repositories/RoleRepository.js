import { prisma } from "../config/db.js";

export class RoleRepository {
  async findByName(roleName) {
    return prisma.role.findUnique({
      where: { roleName },
    });
  }
}
