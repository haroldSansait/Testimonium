/**
 * Conservative language-alignment guard.
 *
 * Prompt policy remains the primary language mechanism. Local checks reject
 * clear English/Philippine-language mismatches in both directions. Ambiguous
 * and mixed messages remain eligible for intentional code-switching.
 */

const ENGLISH_SIGNAL = /\b(the|is|are|can|could|would|should|what|who|whose|why|how|where|when|do|does|did|not|need|prepare|file|receive|requesting|someone|about|from|with|for|my|mine|your|hers|own|adult|sister|parent|child|documents?|upload)\b/gi;
const PHILIPPINE_SIGNAL = /\b(ang|mga|kailangan|kinahanglan|kinahanglanon|mangyaring|maaari|hindi|indi|dili|inyong|imong|ninyo|nimo|iyong|para\s+sa|ano|unsa|tagpila|pila|sang|gid|bala|ukon|kag|nga|ug|po|opo)\b/gi;

function countDistinctMatches(text, pattern) {
  const matches = String(text || "").toLowerCase().match(pattern) || [];
  return new Set(matches.map((value) => value.trim())).size;
}

export function isClearlyEnglishCurrentMessage(text) {
  const englishSignals = countDistinctMatches(text, ENGLISH_SIGNAL);
  const philippineSignals = countDistinctMatches(text, PHILIPPINE_SIGNAL);
  return englishSignals >= 3 && philippineSignals === 0;
}

export function isClearlyPhilippineLanguageText(text) {
  return countDistinctMatches(text, PHILIPPINE_SIGNAL) >= 3;
}

export function isCurrentMessageLanguageConsistent(currentMessage, responseText) {
  if (!currentMessage || !responseText) return true;
  if (isClearlyEnglishCurrentMessage(currentMessage)) return !isClearlyPhilippineLanguageText(responseText);
  const clearlyLocalCurrent = countDistinctMatches(currentMessage, PHILIPPINE_SIGNAL) >= 2 && countDistinctMatches(currentMessage, ENGLISH_SIGNAL) <= 1;
  if (clearlyLocalCurrent && !isClearlyPhilippineLanguageText(responseText)) {
    return !isClearlyEnglishCurrentMessage(responseText);
  }
  return true;
}

// Short names, dates and yes/no replies do not establish a new language.
export function detectLanguageStyle(text) {
  if (/\b(gid|bala|ukon|sang|buwas|subong|luyag)\b/i.test(text)) return "HILIGAYNON";
  if (/\b(unsa|nimo|imong|dili|ugma|karon|buntag|daghang)\b/i.test(text)) return "CEBUANO";
  if (/\b(ano|anong|sino|saan|kailan|paano|magkano|kailangan|ngayon|bukas|salamat|kumusta|magandang|maari|maaari)\b/i.test(text)) return "FILIPINO";
  if (isClearlyEnglishCurrentMessage(text) || /^(hi|hello|hey|thanks|thank you|good morning|goodbye)[!?.\s]*$/i.test(text)) return "ENGLISH";
  return null;
}

export function localizedFallback(kind, message = "", previousStyle = null) {
  const style = detectLanguageStyle(message) || previousStyle || "ENGLISH";
  const messages = {
    ENGLISH: {
      PARISH: "Which parish are you referring to?", DOCUMENT_TYPE: "Which document are you referring to?",
      SCHEDULE_EVENT: "Which event or service would you like to check?", DATE: "Which date would you like to check?", TIME: "What time would you like to check?", PRIEST: "Which priest do you mean?",
      UNAVAILABLE: "I couldn't retrieve that information right now. Please try again.", EVIDENCE: "I don't have enough verified TESTIMONIUM information to confirm that. Please contact your parish office for assistance.",
      GREETING: "Hello! How can I help?", THANKS: "You're welcome!", GOODBYE: "Take care!", DECLINE_OR_CLOSE: "All right. I'm here if you need help.", CASUAL: "I'm here to help with TESTIMONIUM and parish questions.",
      WHO_ARE_YOU: "I'm Caloy, your TESTIMONIUM virtual parish assistant.", HOW_ARE_YOU: "I'm ready to help. How are you?", CAPABILITIES: "I can explain parish procedures and check authorized parish, request, payment and appointment information.", OUT_OF_SCOPE_CASUAL: "I can help with TESTIMONIUM and parish questions.",
    },
    FILIPINO: {
      PARISH: "Aling parokya ang tinutukoy mo?", DOCUMENT_TYPE: "Aling dokumento ang tinutukoy mo?", SCHEDULE_EVENT: "Anong serbisyo ang gusto mong tingnan?", DATE: "Anong petsa ang gusto mong tingnan?", TIME: "Anong oras ang gusto mong tingnan?", PRIEST: "Sinong pari ang tinutukoy mo?",
      UNAVAILABLE: "Hindi ko makuha ang impormasyong iyon ngayon. Pakisubukan ulit.", EVIDENCE: "Wala akong sapat na beripikadong impormasyon sa TESTIMONIUM para matiyak iyon. Maaari kang magtanong sa opisina ng parokya.",
      GREETING: "Kumusta! Paano ako makakatulong?", THANKS: "Walang anuman!", GOODBYE: "Ingat!", DECLINE_OR_CLOSE: "Sige. Nandito ako kung kailangan mo ng tulong.", CASUAL: "Nandito ako para tumulong sa mga tanong tungkol sa TESTIMONIUM at parokya.",
      WHO_ARE_YOU: "Ako si Caloy, ang virtual na katulong ng TESTIMONIUM para sa mga tanong tungkol sa parokya.", HOW_ARE_YOU: "Handa akong tumulong. Kumusta ka?", CAPABILITIES: "Maaari akong magpaliwanag ng mga proseso at tumingin ng awtorisadong impormasyon tungkol sa parokya, dokumento, bayad at iskedyul.", OUT_OF_SCOPE_CASUAL: "Maaari akong tumulong sa mga tanong tungkol sa TESTIMONIUM at parokya.",
    },
    CEBUANO: {
      PARISH: "Unsang parokya ang imong gipasabot?", DOCUMENT_TYPE: "Unsang dokumento ang imong gipasabot?", SCHEDULE_EVENT: "Unsang serbisyo ang imong gustong susihon?", DATE: "Unsang petsa ang imong gustong susihon?", TIME: "Unsang orasa ang imong gustong susihon?", PRIEST: "Kinsang pari ang imong gipasabot?",
      UNAVAILABLE: "Dili nako makuha kana nga impormasyon karon. Palihog sulayi pag-usab.", EVIDENCE: "Wala koy igong napamatud-ang impormasyon sa TESTIMONIUM aron makumpirma kana. Palihog pangutana sa opisina sa parokya.",
      GREETING: "Maayong adlaw! Unsaon nako pagtabang?", THANKS: "Walay sapayan!", GOODBYE: "Pag-amping!", DECLINE_OR_CLOSE: "Sige. Ania ra ko kon kinahanglan nimo og tabang.", CASUAL: "Ania ko aron motabang sa mga pangutana bahin sa TESTIMONIUM ug sa parokya.",
      WHO_ARE_YOU: "Ako si Caloy, ang virtual nga katabang sa TESTIMONIUM alang sa mga pangutana bahin sa parokya.", HOW_ARE_YOU: "Andam ko motabang. Kumusta ka?", CAPABILITIES: "Makatabang ko sa mga proseso ug sa awtorisadong impormasyon bahin sa parokya, dokumento, bayad ug iskedyul.", OUT_OF_SCOPE_CASUAL: "Makatabang ko sa mga pangutana bahin sa TESTIMONIUM ug sa parokya.",
    },
    HILIGAYNON: {
      PARISH: "Diin nga parokya ang imo ginatumod?", DOCUMENT_TYPE: "Ano nga dokumento ang imo ginatumod?", SCHEDULE_EVENT: "Ano nga serbisyo ang gusto mo tan-awon?", DATE: "Ano nga petsa ang gusto mo tan-awon?", TIME: "Ano nga oras ang gusto mo tan-awon?", PRIEST: "Sin-o nga pari ang imo ginatumod?",
      UNAVAILABLE: "Indi ko makuha ang amo nga impormasyon subong. Palihog tilawi liwat.", EVIDENCE: "Wala ako sang bastante nga napamatud-an nga impormasyon sa TESTIMONIUM para makumpirma ina. Palihog magpamangkot sa opisina sang parokya.",
      GREETING: "Maayong adlaw! Paano ako makabulig?", THANKS: "Wala sang anuman!", GOODBYE: "Halong!", DECLINE_OR_CLOSE: "Sige. Ari lang ako kon kinahanglan mo sang bulig.", CASUAL: "Ari ako para magbulig sa mga pamangkot parte sa TESTIMONIUM kag parokya.",
      WHO_ARE_YOU: "Ako si Caloy, ang virtual nga manugbulig sang TESTIMONIUM para sa mga pamangkot parte sa parokya.", HOW_ARE_YOU: "Handa ako magbulig. Kamusta ka?", CAPABILITIES: "Makabulig ako sa mga proseso kag sa awtorisado nga impormasyon parte sa parokya, dokumento, bayad kag iskedyul.", OUT_OF_SCOPE_CASUAL: "Makabulig ako sa mga pamangkot parte sa TESTIMONIUM kag parokya.",
    },
  };
  return messages[style]?.[kind] || messages.ENGLISH[kind] || messages.ENGLISH.UNAVAILABLE;
}

// A provider failure must still present approved canonical values in the user's
// language. Only explicitly public fields are eligible; never serialize a whole
// result object or a client-supplied context as fallback prose.
export function localizedFactFallback(facts, fallback, message, previousStyle = null) {
  const style = detectLanguageStyle(message) || previousStyle || "ENGLISH";
  if (style === "ENGLISH" || !facts) return fallback;
  const words = {
    FILIPINO: { intro: "Ito ang nakatalang impormasyon", unknown: "Hindi pa matiyak", day: "Araw", now: "Ngayon", hours: "Oras ng opisina", pending: "Naghihintay pa ng pagtanggap; hindi pa kumpirmado", none: "Walang nakatalagang pari", empty: "Walang katugmang tala", parish: "Parokya", priest: "Pari", fee: "Bayad", status: "Katayuan" },
    CEBUANO: { intro: "Mao kini ang natala nga impormasyon", unknown: "Dili pa matino", day: "Adlaw", now: "Karon", hours: "Oras sa opisina", pending: "Naghulat pa sa pagdawat; dili pa kumpirmado", none: "Walay pari nga gi-assign", empty: "Walay katugbang nga tala", parish: "Parokya", priest: "Pari", fee: "Bayad", status: "Kahimtang" },
    HILIGAYNON: { intro: "Amo ini ang nakarekord nga impormasyon", unknown: "Indi pa mapat-od", day: "Adlaw", now: "Subong", hours: "Oras sang opisina", pending: "Nagaulat pa sang pagbaton; indi pa kumpirmado", none: "Wala sang pari nga naka-assign", empty: "Wala sang nagakaigo nga rekord", parish: "Parokya", priest: "Pari", fee: "Bayad", status: "Kahimtangan" },
  }[style];
  if (!words) return fallback;
  const lines = [];
  if (facts.parishName) lines.push(`**${facts.parishName}**`);
  if (Array.isArray(facts.officeDays)) {
    for (const day of facts.officeDays) lines.push(`- **${day.date}**: ${words.day}: **${day.status}**; ${day.opensAt ? `${words.hours}: ${day.opensAt} - ${day.closesAt}` : words.unknown}${day.currentStatus !== "NOT_APPLICABLE" ? `; ${words.now}: ${day.currentStatus}` : ""}.`);
  } else if (Array.isArray(facts.massSchedules)) {
    for (const mass of facts.massSchedules) lines.push(`- **${mass.date || facts.date} ${mass.timeSlot}**: ${mass.label}; ${mass.priestName || (mass.layMinisterAssigned ? "Lay Minister" : words.none)}; **${mass.assignmentStatus}**${mass.assignmentStatus === "PENDING" ? ` (${words.pending})` : ""}.`);
    if (!facts.massSchedules.length) lines.push(words.empty);
  } else if (facts.currentClock) {
    lines.push(`${facts.currentClock.date} (${facts.currentClock.weekday}), ${facts.currentClock.time} Asia/Manila`);
  } else {
    for (const key of ["documentTitle", "priestName", "date", "timeSlot", "trackingNumber", "safeStatus"]) {
      if (typeof facts[key] === "string") lines.push(`- ${facts[key]}`);
    }
    if (facts.fee) lines.push(`${words.fee}: **${facts.fee}**`);
    if (facts.hasFeeConfigured === false) lines.push(`${words.fee}: ${words.unknown}`);
    for (const key of ["availableSlots", "availableDates", "priests", "availablePriests", "requests", "schedules", "schedulableEvents", "documents", "requirements", "parishes", "events"]) {
      if (!Array.isArray(facts[key])) continue;
      if (!facts[key].length) lines.push(words.empty);
      for (const item of facts[key]) {
        const values = typeof item === "string" ? [item] : [item?.name, item?.parishName, item?.label, item?.title, item?.priestName, item?.date, item?.timeSlot, item?.documentTitle, item?.trackingNumber, item?.safeStatus].filter(value => typeof value === "string");
        if (values.length) lines.push(`- ${values.join(" | ")}`);
      }
    }
  }
  return lines.length ? `${words.intro}:\n\n${lines.join("\n")}` : localizedFallback("UNAVAILABLE", message, style);
}
