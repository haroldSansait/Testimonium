import { WEEKDAYS, addCalendarDays } from "./CaloyCalendar.js";

export const LOCAL_WEEKDAYS = {
  FILIPINO: ["Linggo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"],
  HILIGAYNON: ["Domingo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"],
  CEBUANO: ["Domingo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"],
};
const weekdayNames = [...WEEKDAYS, ...Object.values(LOCAL_WEEKDAYS).flat(), "Miyerkoles"];
const weekdayNumber = name => {
  const lower = name.toLowerCase();
  if (lower === "miyerkoles") return 3;
  for (const names of [WEEKDAYS, ...Object.values(LOCAL_WEEKDAYS)]) {
    const index = names.findIndex(value => value.toLowerCase() === lower);
    if (index >= 0) return index;
  }
  return -1;
};
const weekdays = text => [...text.matchAll(new RegExp(`\\b(${[...new Set(weekdayNames)].join("|")})\\b`, "gi"))]
  .filter(match => !/\b(?:not|never|isn't|hindi|indi|dili)(?:\s+(?:pa|a|on|sa|ngayon|subong|karon|today))*\s+$/i.test(text.slice(0, match.index)))
  .map(match => weekdayNumber(match[1]));
const months = [
  ["january", "jan", "enero"], ["february", "feb", "pebrero"], ["march", "mar", "marso"],
  ["april", "apr", "abril"], ["may", "mayo"], ["june", "jun", "hunyo"],
  ["july", "jul", "hulyo"], ["august", "aug", "agosto"], ["september", "sept", "sep", "setyembre", "septiyembre"],
  ["october", "oct", "oktubre"], ["november", "nov", "nobyembre", "nobiyembre"], ["december", "dec", "disyembre"],
];

function datesMentioned(text, referenceDate) {
  const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  const monthPattern = months.flat().join("|");
  const patterns = [
    new RegExp(`\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi"),
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+|ng\\s+|sang\\s+|sa\\s+)?(${monthPattern})\\.?(?:,?\\s+(\\d{4}))?\\b`, "gi"),
  ];
  patterns.forEach((pattern, index) => {
    for (const match of text.matchAll(pattern)) {
      const month = months.findIndex(names => names.includes(match[index ? 2 : 1].toLowerCase())) + 1;
      const day = match[index ? 1 : 2];
      dates.push(`${match[3] || referenceDate.slice(0, 4)}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`);
    }
  });
  return dates;
}

function timeMinutes(text) {
  const values = [];
  for (const match of text.matchAll(/\b(\d{1,2})(?::([0-5]\d)\s*(am|pm)?|\s*(am|pm))\b/gi)) {
    let hour = Number(match[1]);
    const period = match[3] || match[4];
    if (period) hour = hour % 12 + (period.toLowerCase() === "pm" ? 12 : 0);
    values.push(hour * 60 + Number(match[2] || 0));
  }
  return values;
}

const withoutNegatedAcceptance = text => text.replace(/\b(?:not|never|isn't|hasn't|wasn't|hindi|indi|dili|wala)(?:\s+(?:yet|pa|officially|a))*\s+(?:confirmed|accepted|kumpirmado|tinanggap|ginbaton|gidawat)\b/gi, "");
const assignmentTerms = {
  PENDING: /\b(?:pending|awaiting|waiting|naghihintay|nagaulat|nagahulat|naghulat)\b/i,
  ACCEPTED: /\b(?:accepted|confirmed|kumpirmado|tinanggap|ginbaton|gidawat|nadawat)\b/i,
  REJECTED: /\b(?:rejected|declined|tinanggihan|ginsikway|gibalibaran)\b/i,
  WITHDRAWN: /\b(?:withdrawn|binawi|ginbawi|gibawi)\b/i,
  UNASSIGNED: /\b(?:unassigned|no\s+priest|walang\s+(?:nakatalagang\s+)?pari|wala\s+sang\s+pari|walay\s+pari)\b/i,
  LAY_MINISTER: /\b(?:lay_minister|lay\s+minister)\b/i,
  UNKNOWN: /\b(?:unknown|not\s+(?:known|recorded)|hindi\s+(?:pa\s+)?matiyak|indi\s+(?:pa\s+)?mapat-od|dili\s+(?:pa\s+)?matino)\b/i,
};

function dateMatches(text, date, clock, required = true) {
  const dates = datesMentioned(text, date);
  const days = weekdays(text);
  const index = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (dates.some(value => value !== date) || days.some(value => value !== index)) return false;
  const relative = /\b(?:tomorrow|bukas|buwas|bwas|ugma)\b/i.test(text) && !/\bbukas\s+(?:ang|sa|mula)\b/i.test(text) ? 1
    : /\b(?:today|ngayon|subong|karon)\b/i.test(text) ? 0 : null;
  if (relative !== null && clock && addCalendarDays(clock.date, relative) !== date) return false;
  return !required || dates.includes(date) || days.includes(index) || (relative !== null && Boolean(clock));
}

// These checks compare the meaning of calendar facts while keeping identities,
// occurrence boundaries and response statuses authoritative.
export function validateCalendarFacts(facts, answer, userMessage = "") {
  if (!facts.currentClock && !Array.isArray(facts.massSchedules) && !Array.isArray(facts.officeDays)) return true;
  const clock = facts.currentClock;
  const isClockQuestion = clock && !facts.officeDays && !Array.isArray(facts.massSchedules);
  const approvedDates = [facts.date, facts.startDate, facts.endDate, ...(facts.massSchedules || []).map(row => row.date), ...(facts.officeDays || []).map(row => row.date)].filter(Boolean);
  if (isClockQuestion) approvedDates.push(clock.date);
  if (approvedDates.length && datesMentioned(answer, approvedDates[0]).some(date => !approvedDates.includes(date))) return false;

  if (isClockQuestion) {
    if (!dateMatches(answer, clock.date, clock, false)) return false;
    const times = timeMinutes(answer);
    if (times.some(time => time !== timeMinutes(clock.time)[0])) return false;
    if (!weekdays(answer).length && !datesMentioned(answer, clock.date).length && !times.length) return false;
    const askedDay = weekdays(userMessage)[0];
    if (askedDay !== undefined && /\b(?:today|ngayon|subong|karon)\b/i.test(userMessage)) {
      const agrees = askedDay === weekdayNumber(clock.weekday);
      if ((!agrees && /^(?:yes|oo|huo)\b/i.test(answer)) || (agrees && /^(?:no|hindi|indi|dili)\b/i.test(answer))) return false;
    }
  }

  const masses = facts.massSchedules;
  if (Array.isArray(masses)) {
    const approvedTimes = masses.flatMap(mass => timeMinutes(mass.timeSlot));
    if (facts.requestedTimeSlot) approvedTimes.push(...timeMinutes(facts.requestedTimeSlot));
    if (timeMinutes(answer).some(time => !approvedTimes.includes(time))) return false;
    const rows = answer.split(/\n+/);
    for (const mass of masses) {
      const row = rows.find(text => {
        const times = timeMinutes(text);
        return times.includes(timeMinutes(mass.timeSlot)[0])
          && times.every(time => time === timeMinutes(mass.timeSlot)[0])
          && (!mass.date || dateMatches(text, mass.date, clock, masses.length > 1))
          && (!mass.priestName || text.includes(mass.priestName));
      });
      if (!row) return false;
      const assertions = withoutNegatedAcceptance(row);
      if (mass.assignmentStatus && !assignmentTerms[mass.assignmentStatus]?.test(assertions)) return false;
      if (mass.priestName && assignmentTerms.UNASSIGNED.test(assertions)) return false;
      if (mass.assignmentStatus !== "LAY_MINISTER" && assignmentTerms.LAY_MINISTER.test(assertions)) return false;
      for (const status of ["ACCEPTED", "PENDING", "REJECTED", "WITHDRAWN"]) {
        if (mass.assignmentStatus !== status && assignmentTerms[status].test(assertions)) return false;
      }
      if (!mass.priestName && /\b(?:Father|Fr\.)\s+\p{L}/iu.test(row)) return false;
    }
    if (!masses.length && ["NO_TIME_MATCH", "NO_PRIEST_ASSIGNMENT"].includes(facts.resultCode)
      && /\b(?:no\s+(?:public\s+)?mass\s+schedules?|walang\s+(?:mga\s+)?misa|wala\s+sang\s+misa|walay\s+misa)\b/i.test(answer)) return false;
    if (!masses.length && facts.resultCode) {
      const negative = /\b(?:no|none|not|cannot|couldn't|walang|wala|walay|hindi|indi|dili)\b/i;
      if (!negative.test(answer)) return false;
      for (const clause of answer.split(/[;\n]|[.!?]\s+/)) {
        if (/\b(?:assigned|naka-assign|nakatalaga)\b/i.test(clause) && !negative.test(clause)) return false;
        if (assignmentTerms.ACCEPTED.test(withoutNegatedAcceptance(clause)) || assignmentTerms.PENDING.test(clause)) return false;
      }
    }
  }

  if (Array.isArray(facts.officeDays)) {
    for (const day of facts.officeDays) {
      const row = facts.officeDays.length === 1 ? answer : answer.split(/\n+/).find(text => dateMatches(text, day.date, clock));
      if (!row || !dateMatches(row, day.date, clock, false)) return false;
      const assertions = row.replace(/\b(?:not|hindi|indi|dili)(?:\s+pa)?\s+(?:open|abri|abli|bukas)\b/gi, "closed")
        .replace(/\bnot\s+closed\b/gi, "open");
      const open = /\b(?:open|abri|abli|bukas)\b/i.test(assertions);
      const closed = /\b(?:closed|sarado|sirado|sira)\b/i.test(assertions);
      const officeAssertions = assertions.split(/[.!?;]/).filter(clause => !/\b(?:holiday|date-specific)\s+exceptions?\b/i.test(clause)).join(".");
      const unknown = assignmentTerms.UNKNOWN.test(officeAssertions);
      const status = ["OPEN", "CLOSED"].includes(day.currentStatus) ? day.currentStatus : day.status;
      if (status === "UNKNOWN" ? !unknown || open || closed : unknown || (status === "OPEN" ? !open || closed : !closed)) return false;
      if (status === "CLOSED" && open && (day.status !== "OPEN" || !timeMinutes(row).length || /\b(?:open|abri|abli|bukas)\s+(?:now|subong|ngayon|karon)\b/i.test(row))) return false;
      const approvedTimes = [day.opensAt, day.closesAt].filter(Boolean).flatMap(timeMinutes);
      if (day.date === clock?.date) approvedTimes.push(...timeMinutes(clock.time));
      if (timeMinutes(row).some(time => !approvedTimes.includes(time))) return false;
    }
  }
  return true;
}
