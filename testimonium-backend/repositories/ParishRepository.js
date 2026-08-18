import { prisma } from "../config/db.js";

const parishInclude = {
  users: {
    where: {
      status: "ACTIVE",
    },
    include: {
      role: true,
    },
  },
};

export class ParishRepository {
  /**
   * Retrieves a list of parishes with optional search, type, and status filtering.
   * @param {object} filters
   * @param {string} [filters.search]
   * @param {string} [filters.type]
   * @param {string} [filters.status]
   * @returns {Promise<Array>}
   */
  async findMany({ search, type, status, page = 1, limit = 25 } = {}) {
    const where = {};

    if (type && type !== "all") {
      where.type = this.mapTypeToEnum(type);
    }

    if (status && status !== "all") {
      where.isActive = status === "Active";
    } else if (!status) {
      where.isActive = true; // respect soft-delete by default
    }

    if (search) {
      const searchPattern = { contains: search, mode: "insensitive" };
      where.OR = [
        { parishName: searchPattern },
        { patronSaint: searchPattern },
        {
          users: {
            some: {
              fullName: searchPattern,
              role: {
                roleName: { in: ["PRIEST", "SECRETARY"] },
              },
            },
          },
        },
      ];
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

    const queryOpts = {
      where,
      include: parishInclude,
      orderBy: { parishName: "asc" },
      skip: (parsedPage - 1) * parsedLimit,
      take: parsedLimit,
    };

    const [data, total] = await Promise.all([
      prisma.parish.findMany(queryOpts),
      prisma.parish.count({ where }),
    ]);

    return {
      items: data,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    };
  }

  /**
   * Retrieves a single parish by its ID.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  async findById(id) {
    return prisma.parish.findUnique({
      where: { id },
      include: parishInclude,
    });
  }

  /**
   * Retrieves a single parish by its slug.
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  async findBySlug(slug) {
    return prisma.parish.findUnique({
      where: { slug },
      include: parishInclude,
    });
  }

  /**
   * Inserts a new parish record.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async create(data) {
    return prisma.parish.create({
      data: {
        parishName: data.name,
        type: this.mapTypeToEnum(data.type),
        patronSaint: data.patronSaint || null,
        address: data.address || null,
        municipalityCity: data.municipalityCity || "Unknown",
        province: data.province || "Negros Oriental",
        contactNumber: data.contactNumber || null,
        email: data.email || null,
        venueCapacity: data.venueCapacity ? parseInt(data.venueCapacity, 10) : null,
        isActive: true,
      },
      include: parishInclude,
    });
  }

  /**
   * Updates an existing parish record.
   * @param {number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  async update(id, data) {
    const updateData = {};

    if (data.name) updateData.parishName = data.name;
    if (data.type) updateData.type = this.mapTypeToEnum(data.type);
    if (data.patronSaint !== undefined) updateData.patronSaint = data.patronSaint;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.municipalityCity !== undefined) updateData.municipalityCity = data.municipalityCity;
    if (data.province !== undefined) updateData.province = data.province;
    if (data.contactNumber !== undefined) updateData.contactNumber = data.contactNumber;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.venueCapacity !== undefined) {
      updateData.venueCapacity = data.venueCapacity ? parseInt(data.venueCapacity, 10) : null;
    }
    if (data.status !== undefined) {
      updateData.isActive = data.status === "Active";
    }

    return prisma.parish.update({
      where: { id },
      data: updateData,
      include: parishInclude,
    });
  }

  /**
   * Archives a parish by setting isActive = false.
   * @param {number} id
   * @returns {Promise<object>}
   */
  async archive(id) {
    return prisma.parish.update({
      where: { id },
      data: { isActive: false },
      include: parishInclude,
    });
  }

  /**
   * Restores an archived parish by setting isActive = true.
   * @param {number} id
   * @returns {Promise<object>}
   */
  async restore(id) {
    return prisma.parish.update({
      where: { id },
      data: { isActive: true },
      include: parishInclude,
    });
  }

  /**
   * Utility to map frontend ParishType string to database Enum.
   * @param {string} type
   * @returns {string}
   */
  mapTypeToEnum(type) {
    switch (type) {
      case "Parish":
        return "PARISH";
      case "Quasi-Parish":
        return "QUASI_PARISH";
      case "Mission Station":
        return "MISSION_STATION";
      default:
        return type;
    }
  }
}
