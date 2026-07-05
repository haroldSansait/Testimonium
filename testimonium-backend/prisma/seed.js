import { prisma } from "../config/db.js";

const roles = [
  {
    roleName: "PARISHIONER",
    description:
      "Parishioner account for requesting sacramental documents and schedules.",
  },
  {
    roleName: "SECRETARY",
    description: "Parish secretary account for processing parish-level requests.",
  },
  {
    roleName: "PRIEST",
    description: "Priest account for parish oversight and request review.",
  },
  {
    roleName: "DIOCESE_COORDINATOR",
    description:
      "Diocese coordinator account for TESTIMONIUM system administration.",
  },
];

const parishes = [
  {
    parishName: "Our Lady of the Mountains Quasi-Parish",
    type: "QUASI_PARISH",
    address:
      "Sitio Cabagtasan, Barangay Codcod, San Carlos City, Negros Occidental, 6127",
    municipalityCity: "San Carlos City",
    province: "Negros Occidental",
    isActive: true,
  },
  {
    parishName: "St. Joseph Parish",
    type: "PARISH",
    address:
      "La Castellana - Canlaon Road, City Proper, Canlaon City, Negros Oriental, 6223",
    municipalityCity: "Canlaon City",
    province: "Negros Oriental",
    isActive: true,
  },
  {
    parishName: "Our Lady of the Miraculous Medal Parish",
    type: "PARISH",
    address:
      "National Highway, Poblacion, Don Salvador Benedicto, Negros Occidental, 6133",
    municipalityCity: "Don Salvador Benedicto",
    province: "Negros Occidental",
    isActive: true,
  },
  {
    parishName: "Nuestra Señora De Las Flores Mission Station",
    type: "MISSION_STATION",
    address: "Barangay Masulog, Canlaon City, Negros Oriental, 6223",
    municipalityCity: "Canlaon City",
    province: "Negros Oriental",
    isActive: true,
  },
  {
    parishName: "Our Lady of Peace and Good Voyage Quasi-Parish",
    type: "QUASI_PARISH",
    address: "Barangay Prosperidad, San Carlos City, Negros Occidental, 6127",
    municipalityCity: "San Carlos City",
    province: "Negros Occidental",
    isActive: true,
  },
  {
    parishName: "Holy Child Parish",
    type: "PARISH",
    address: "Barangay Quezon, San Carlos City, Negros Occidental, 6127",
    municipalityCity: "San Carlos City",
    province: "Negros Occidental",
    isActive: true,
  },
  {
    parishName: "Our Lady of Guadalupe Parish",
    type: "PARISH",
    address: "Barangay Tagbino, Vallehermoso, Negros Oriental, 6224",
    municipalityCity: "Vallehermoso",
    province: "Negros Oriental",
    isActive: true,
  },
];

const seed = async () => {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { roleName: role.roleName },
      update: { description: role.description },
      create: role,
    });
  }

  for (const parish of parishes) {
    await prisma.parish.upsert({
      where: { parishName: parish.parishName },
      update: parish,
      create: parish,
    });
  }

  const staffUsers = [
    {
      email: "coordinator@testimonium.org",
      fullName: "Diocese Coordinator",
      roleName: "DIOCESE_COORDINATOR",
      parishName: null,
      status: "ACTIVE",
    },
    {
      email: "secretary.stjoseph@testimonium.org",
      fullName: "St. Joseph Parish Secretary",
      roleName: "SECRETARY",
      parishName: "St. Joseph Parish",
      status: "ACTIVE",
    },
    {
      email: "priest.stjoseph@testimonium.org",
      fullName: "St. Joseph Parish Priest",
      roleName: "PRIEST",
      parishName: "St. Joseph Parish",
      status: "ACTIVE",
    },
  ];

  for (const staff of staffUsers) {
    const role = await prisma.role.findUnique({
      where: { roleName: staff.roleName },
    });
    if (!role) {
      throw new Error(`Role ${staff.roleName} not found when seeding staff.`);
    }

    let parishId = null;
    if (staff.parishName) {
      const parish = await prisma.parish.findUnique({
        where: { parishName: staff.parishName },
      });
      if (!parish) {
        throw new Error(`Parish ${staff.parishName} not found when seeding staff.`);
      }
      parishId = parish.id;
    }

    await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        fullName: staff.fullName,
        roleId: role.id,
        parishId: parishId,
        status: staff.status,
      },
      create: {
        email: staff.email,
        fullName: staff.fullName,
        roleId: role.id,
        parishId: parishId,
        status: staff.status,
        firebaseUid: null,
      },
    });
  }
};

seed()
  .then(async () => {
    console.log("[TESTIMONIUM] Database seed completed.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[TESTIMONIUM] Database seed failed:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  });
