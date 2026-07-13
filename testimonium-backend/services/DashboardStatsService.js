import { DocumentRequestRepository } from "../repositories/DocumentRequestRepository.js";
import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { DioceseRepository } from "../repositories/DioceseRepository.js";

export class DashboardStatsService {
  constructor(
    documentRequestRepository = new DocumentRequestRepository(),
    scheduleRepository = new ScheduleRepository(),
    dioceseRepository = new DioceseRepository()
  ) {
    this.documentRequestRepository = documentRequestRepository;
    this.scheduleRepository = scheduleRepository;
    this.dioceseRepository = dioceseRepository;
  }

  /**
   * Returns stats for a parish-level dashboard.
   * @param {number|undefined} parishId
   */
  async getParishStats(parishId) {
    const [docStats, pendingSchedules] = await Promise.all([
      this.documentRequestRepository.countStats(parishId),
      this.scheduleRepository.countPending(parishId),
    ]);

    return {
      pendingDocumentRequests: docStats.pending,
      pendingScheduleRequests: pendingSchedules,
      needingCorrection: 0, // No correction status in schema
      readyForPickup: docStats.readyForPickup,
    };
  }

  /**
   * Returns stats for the diocese-wide coordinator dashboard.
   */
  async getDioceseStats() {
    const [
      parishesCount,
      quasiParishesCount,
      missionStationsCount,
      secretariesCount,
      priestsCount,
      parishionersCount,
      pendingDocsCount,
      pendingSchedulesCount,
    ] = await Promise.all([
      this.dioceseRepository.countParishesByType("PARISH"),
      this.dioceseRepository.countParishesByType("QUASI_PARISH"),
      this.dioceseRepository.countParishesByType("MISSION_STATION"),
      this.dioceseRepository.countUsersByRole("SECRETARY"),
      this.dioceseRepository.countUsersByRole("PRIEST"),
      this.dioceseRepository.countUsersByRole("PARISHIONER"),
      this.dioceseRepository.countPendingDocumentRequests(),
      this.dioceseRepository.countPendingScheduleRequests(),
    ]);

    return [
      {
        id: "total-parishes",
        label: "Total Parishes",
        value: parishesCount,
        icon: "Church",
        iconColor: "text-crimson-700",
        bgColor: "bg-red-50",
      },
      {
        id: "total-quasi-parishes",
        label: "Quasi-Parishes",
        value: quasiParishesCount,
        icon: "MapPin",
        iconColor: "text-purple-600",
        bgColor: "bg-purple-50",
      },
      {
        id: "total-mission-stations",
        label: "Mission Stations",
        value: missionStationsCount,
        icon: "Compass",
        iconColor: "text-orange-600",
        bgColor: "bg-orange-50",
      },
      {
        id: "total-secretaries",
        label: "Total Secretaries",
        value: secretariesCount,
        icon: "User",
        iconColor: "text-blue-600",
        bgColor: "bg-blue-50",
      },
      {
        id: "total-priests",
        label: "Total Priests",
        value: priestsCount,
        icon: "Users",
        iconColor: "text-teal-600",
        bgColor: "bg-teal-50",
      },
      {
        id: "total-parishioners",
        label: "Total Parishioners",
        value: parishionersCount,
        icon: "PersonStanding",
        iconColor: "text-indigo-600",
        bgColor: "bg-indigo-50",
      },
      {
        id: "pending-doc-requests",
        label: "Pending Documents",
        value: pendingDocsCount,
        icon: "FileText",
        iconColor: "text-amber-600",
        bgColor: "bg-amber-50",
      },
      {
        id: "pending-sched-requests",
        label: "Pending Schedules",
        value: pendingSchedulesCount,
        icon: "CalendarDays",
        iconColor: "text-green-600",
        bgColor: "bg-green-50",
      },
    ];
  }
}
