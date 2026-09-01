import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { PriestAssignmentHandler } from "./PriestAssignmentHandler.js";

export class MassScheduleService {
  /**
   * Retrieves active Mass schedule templates for a parish.
   */
  async getTemplates(parishId) {
    const parsedId = parseInt(parishId, 10);
    
    // Auto-seed if templates are completely empty
    const count = await prisma.massScheduleTemplate.count({
      where: { parishId: parsedId, isActive: true }
    });
    
    if (count === 0) {
      await this.seedDefaults(parsedId);
    }

    return prisma.massScheduleTemplate.findMany({
      where: { parishId: parsedId, isActive: true },
      include: {
        assignedPriest: { select: { id: true, fullName: true, isAssistant: true } }
      },
      orderBy: [
        { dayType: "asc" },
        { timeSlot: "asc" }
      ]
    });
  }

  /**
   * Creates or updates a Mass schedule template.
   */
  async upsertTemplate(parishId, { id, dayType, timeSlot, label, assignedPriestId, actorId }) {
    const parsedParishId = parseInt(parishId, 10);
    const parsedPriestId = assignedPriestId ? parseInt(assignedPriestId, 10) : null;
    let template;
    let priestChanged = false;

    if (id) {
      const parsedId = parseInt(id, 10);
      const original = await prisma.massScheduleTemplate.findUnique({
        where: { id: parsedId }
      });
      priestChanged = original.assignedPriestId !== parsedPriestId;
      const data = { dayType, timeSlot, label, assignedPriestId: parsedPriestId };
      if (priestChanged) {
        data.priestResponseStatus = parsedPriestId ? "PENDING" : null;
        data.priestResponseReason = null;
      }

      template = await prisma.massScheduleTemplate.update({
        where: { id: parsedId },
        data,
        include: {
          assignedPriest: { select: { id: true, fullName: true, isAssistant: true } }
        }
      });

      await AuditLogService.log(actorId, "Mass Schedule Template Updated", null, false, {
        affectedTable: "mass_schedule_templates",
        affectedRecordId: parsedId,
        parishId: parsedParishId,
        previousValues: {
          dayType: original.dayType,
          timeSlot: original.timeSlot,
          label: original.label,
          assignedPriestId: original.assignedPriestId,
        },
        newValues: {
          dayType,
          timeSlot,
          label,
          assignedPriestId: parsedPriestId,
        },
      });
    } else {
      template = await prisma.massScheduleTemplate.create({
        data: {
          parishId: parsedParishId,
          dayType,
          timeSlot,
          label,
          assignedPriestId: parsedPriestId,
          priestResponseStatus: parsedPriestId ? "PENDING" : null,
          isActive: true
        },
        include: {
          assignedPriest: { select: { id: true, fullName: true, isAssistant: true } }
        }
      });

      await AuditLogService.log(actorId, "Mass Schedule Template Created", null, false, {
        affectedTable: "mass_schedule_templates",
        affectedRecordId: template.id,
        parishId: parsedParishId,
        newValues: {
          dayType,
          timeSlot,
          label,
          assignedPriestId: parsedPriestId,
        },
      });
    }

    const newlyAssigned = id ? (priestChanged && parsedPriestId) : parsedPriestId;
    if (newlyAssigned) {
      const priest = await prisma.user.findUnique({
        where: { id: parsedPriestId },
        select: { fullName: true }
      });
      await NotificationDispatcher.notifyPriestAssigned({
        parishionerId: null,
        parishId: parsedParishId,
        scheduleId: template.id + 200000,
        displayTitle: `${label || "Holy Mass"} (${dayType} at ${timeSlot})`,
        priestId: parsedPriestId,
        priestName: priest?.fullName || "Priest",
      });
    }

    return template;
  }

  /**
   * Soft deletes a template.
   */
  async deleteTemplate(id, actorId) {
    const parsedId = parseInt(id, 10);
    const template = await prisma.massScheduleTemplate.findUnique({
      where: { id: parsedId }
    });

    if (!template) {
      const err = new Error("Template not found.");
      err.statusCode = 404;
      throw err;
    }

    await prisma.massScheduleTemplate.update({
      where: { id: parsedId },
      data: { isActive: false }
    });

    await AuditLogService.log(actorId, "Mass Schedule Template Deleted", null, false, {
      affectedTable: "mass_schedule_templates",
      affectedRecordId: parsedId,
      parishId: template.parishId,
      previousValues: { isActive: true },
      newValues: { isActive: false },
    });
  }

  /**
   * Resets default Mass templates.
   */
  async resetDefaults(parishId, actorId) {
    const parsedId = parseInt(parishId, 10);
    
    await prisma.massScheduleTemplate.updateMany({
      where: { parishId: parsedId, isActive: true },
      data: { isActive: false }
    });

    await this.seedDefaults(parsedId);

    await AuditLogService.log(actorId, "Mass Schedule Defaults Restored", null, false, {
      affectedTable: "mass_schedule_templates",
      parishId: parsedId,
    });
  }

  /**
   * Seeds default Mass slots for a parish.
   */
  async seedDefaults(parishId) {
    const parsedId = parseInt(parishId, 10);
    const defaults = [
      // Weekdays (Wednesday and Friday)
      { dayType: "WEDNESDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
      { dayType: "WEDNESDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
      { dayType: "FRIDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
      { dayType: "FRIDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
      // Sundays
      { dayType: "SUNDAY", timeSlot: "05:00 AM", label: "Sunday Early Mass" },
      { dayType: "SUNDAY", timeSlot: "07:00 AM", label: "Sunday Morning Mass" },
      { dayType: "SUNDAY", timeSlot: "09:00 AM", label: "Sunday High Mass" },
      { dayType: "SUNDAY", timeSlot: "04:00 PM", label: "Sunday Afternoon Mass" },
      { dayType: "SUNDAY", timeSlot: "06:00 PM", label: "Sunday Evening Mass" },
    ];

    await prisma.$transaction(
      defaults.map((d) =>
        prisma.massScheduleTemplate.create({
          data: {
            parishId: parsedId,
            dayType: d.dayType,
            timeSlot: d.timeSlot,
            label: d.label,
            isActive: true,
          },
        })
      )
    );
  }

  async respondPriestAssignment(id, priestId, status, reason) {
    return PriestAssignmentHandler.handleResponse(id, priestId, status, reason, "MASS");
  }
}
