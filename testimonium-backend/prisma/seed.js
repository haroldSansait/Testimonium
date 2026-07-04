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
