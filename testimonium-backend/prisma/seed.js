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
    contactNumber: "09171234567",
    patronSaint: "Our Lady of the Mountains",
    email: "mountains.qp@diocese.org",
    isActive: true,
  },
  {
    parishName: "St. Joseph Parish",
    type: "PARISH",
    address:
      "La Castellana - Canlaon Road, City Proper, Canlaon City, Negros Oriental, 6223",
    municipalityCity: "Canlaon City",
    province: "Negros Oriental",
    contactNumber: "09281234567",
    patronSaint: "St. Joseph",
    email: "stjoseph.canlaon@diocese.org",
    isActive: true,
  },
  {
    parishName: "Our Lady of the Miraculous Medal Parish",
    type: "PARISH",
    address:
      "National Highway, Poblacion, Don Salvador Benedicto, Negros Occidental, 6133",
    municipalityCity: "Don Salvador Benedicto",
    province: "Negros Occidental",
    contactNumber: "09391234567",
    patronSaint: "Our Lady of the Miraculous Medal",
    email: "miraculousmedal@diocese.org",
    isActive: true,
  },
  {
    parishName: "Nuestra Señora De Las Flores Mission Station",
    type: "MISSION_STATION",
    address: "Barangay Masulog, Canlaon City, Negros Oriental, 6223",
    municipalityCity: "Canlaon City",
    province: "Negros Oriental",
    contactNumber: "09451234567",
    patronSaint: "Nuestra Señora De Las Flores",
    email: "lasflores.ms@diocese.org",
    isActive: true,
  },
  {
    parishName: "Our Lady of Peace and Good Voyage Quasi-Parish",
    type: "QUASI_PARISH",
    address: "Barangay Prosperidad, San Carlos City, Negros Occidental, 6127",
    municipalityCity: "San Carlos City",
    province: "Negros Occidental",
    contactNumber: "09561234567",
    patronSaint: "Our Lady of Peace and Good Voyage",
    email: "peacevoyage.qp@diocese.org",
    isActive: true,
  },
  {
    parishName: "Holy Child Parish",
    type: "PARISH",
    address: "Barangay Quezon, San Carlos City, Negros Occidental, 6127",
    municipalityCity: "San Carlos City",
    province: "Negros Occidental",
    contactNumber: "09671234567",
    patronSaint: "Santo Niño (Holy Child)",
    email: "holychild@diocese.org",
    isActive: true,
  },
  {
    parishName: "Our Lady of Guadalupe Parish",
    type: "PARISH",
    address: "Barangay Tagbino, Vallehermoso, Negros Oriental, 6224",
    municipalityCity: "Vallehermoso",
    province: "Negros Oriental",
    contactNumber: "09781234567",
    patronSaint: "Our Lady of Guadalupe",
    email: "guadalupe@diocese.org",
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
    // Our Lady of the Mountains Quasi-Parish
    {
      email: "priest.mountains@testimonium.org",
      fullName: "Rev. Fr. Angelo Sarita",
      roleName: "PRIEST",
      parishName: "Our Lady of the Mountains Quasi-Parish",
      status: "ACTIVE",
    },
    {
      email: "secretary.mountains@testimonium.org",
      fullName: "Maria Santos",
      roleName: "SECRETARY",
      parishName: "Our Lady of the Mountains Quasi-Parish",
      status: "ACTIVE",
    },
    // St. Joseph Parish
    {
      email: "priest.stjoseph@testimonium.org",
      fullName: "Rev. Fr. Julius L. Montaño",
      roleName: "PRIEST",
      parishName: "St. Joseph Parish",
      status: "ACTIVE",
    },
    {
      email: "secretary.stjoseph@testimonium.org",
      fullName: "Elena Cruz",
      roleName: "SECRETARY",
      parishName: "St. Joseph Parish",
      status: "ACTIVE",
    },
    // Our Lady of the Miraculous Medal Parish
    {
      email: "priest.miraculousmedal@testimonium.org",
      fullName: "Rev. Fr. Stephen P. Bendanillo",
      roleName: "PRIEST",
      parishName: "Our Lady of the Miraculous Medal Parish",
      status: "ACTIVE",
    },
    {
      email: "secretary.miraculousmedal@testimonium.org",
      fullName: "Ana Reyes",
      roleName: "SECRETARY",
      parishName: "Our Lady of the Miraculous Medal Parish",
      status: "ACTIVE",
    },
    // Nuestra Señora De Las Flores Mission Station
    {
      email: "priest.lasflores@testimonium.org",
      fullName: "Rev. Fr. Jose Enrique D. Gayor",
      roleName: "PRIEST",
      parishName: "Nuestra Señora De Las Flores Mission Station",
      status: "ACTIVE",
    },
    {
      email: "secretary.lasflores@testimonium.org",
      fullName: "Rosa Mendoza",
      roleName: "SECRETARY",
      parishName: "Nuestra Señora De Las Flores Mission Station",
      status: "ACTIVE",
    },
    // Our Lady of Peace and Good Voyage Quasi-Parish
    {
      email: "priest.peacevoyage@testimonium.org",
      fullName: "Rev. Fr. Alwen I. Jimenez",
      roleName: "PRIEST",
      parishName: "Our Lady of Peace and Good Voyage Quasi-Parish",
      status: "ACTIVE",
    },
    {
      email: "secretary.peacevoyage@testimonium.org",
      fullName: "Clara Tan",
      roleName: "SECRETARY",
      parishName: "Our Lady of Peace and Good Voyage Quasi-Parish",
      status: "ACTIVE",
    },
    // Holy Child Parish
    {
      email: "priest.holychild@testimonium.org",
      fullName: "Rev. Fr. Antonio D. Canumay",
      roleName: "PRIEST",
      parishName: "Holy Child Parish",
      status: "ACTIVE",
    },
    {
      email: "secretary.holychild@testimonium.org",
      fullName: "Nora Diaz",
      roleName: "SECRETARY",
      parishName: "Holy Child Parish",
      status: "ACTIVE",
    },
    // Our Lady of Guadalupe Parish
    {
      email: "priest.guadalupe@testimonium.org",
      fullName: "Rev. Fr. Faustino G. Cedeño Jr.",
      roleName: "PRIEST",
      parishName: "Our Lady of Guadalupe Parish",
      status: "ACTIVE",
    },
    {
      email: "secretary.guadalupe@testimonium.org",
      fullName: "Pia Gomez",
      roleName: "SECRETARY",
      parishName: "Our Lady of Guadalupe Parish",
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
