import { Alert, Linking } from "react-native";
import { OfficeHoursRecord } from "./types";

export const buildPhoneUrl = (phone?: string | null): string | null => {
  if (!phone || typeof phone !== "string") return null;
  const cleaned = phone.replace(/[^0-9+]/g, "");
  if (!cleaned || cleaned.length < 5) return null;
  return `tel:${cleaned}`;
};

export const buildEmailUrl = (email?: string | null): string | null => {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return `mailto:${encodeURIComponent(trimmed)}`;
};

/**
 * Validates that latitude and longitude are valid finite numbers within geographical bounds.
 */
export const isValidCoordinate = (
  lat?: number | null,
  lng?: number | null
): boolean => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false;
  }
  if (typeof lat !== "number" || typeof lng !== "number") {
    return false;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export const buildMapUrl = (params: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  name?: string | null;
}): string | null => {
  const { latitude, longitude, address, name } = params;

  if (isValidCoordinate(latitude, longitude)) {
    const lat = latitude as number;
    const lng = longitude as number;
    const label = encodeURIComponent(name || address || "Parish");
    // Standard universal Google Maps URL - opens in Maps app or browser
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${label}`;
  }

  if (address && typeof address === "string" && address.trim().length > 0) {
    const query = encodeURIComponent(address.trim());
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  return null;
};

export const openExternalUrl = async (url: string | null): Promise<boolean> => {
  if (!url) return false;
  try {
    // Attempt opening directly: avoids Android 11+ canOpenURL package-visibility false negatives
    await Linking.openURL(url);
    return true;
  } catch {
    // If a custom protocol (e.g., geo:) fails, fallback to universal web URL
    if (url.startsWith("geo:")) {
      let webUrl: string;
      if (url.startsWith("geo:0,0?q=")) {
        const query = url.replace("geo:0,0?q=", "");
        webUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      } else {
        const coordMatch = url.match(/^geo:([-\d.]+),([-\d.]+)/);
        if (coordMatch) {
          webUrl = `https://www.google.com/maps/search/?api=1&query=${coordMatch[1]},${coordMatch[2]}`;
        } else {
          webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(url)}`;
        }
      }
      try {
        await Linking.openURL(webUrl);
        return true;
      } catch {
        // Fall through to alert
      }
    }
    Alert.alert(
      "Unable to Open Action",
      "No compatible application (e.g., Phone, Email, or Maps) was found on this device to handle this action."
    );
    return false;
  }
};

export interface OfficeStatusResult {
  isOpen: boolean;
  isUnavailable: boolean;
  status: "OPEN" | "CLOSED" | "UNAVAILABLE";
  label: "Open Now" | "Closed" | "Hours Unavailable";
}

export const parseOfficeTimeString = (
  timeStr?: string | null
): { hour: number; minute: number } | null => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3]?.toUpperCase();

  if (minute < 0 || minute > 59) return null;

  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
  } else {
    if (hour < 0 || hour > 23) return null;
  }

  return { hour, minute };
};

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export const getOfficeOpenStatus = (
  officeHours?: OfficeHoursRecord | string | null,
  now: Date = new Date()
): OfficeStatusResult => {
  let hoursObj: any = officeHours;
  if (typeof officeHours === "string") {
    try {
      hoursObj = JSON.parse(officeHours);
    } catch {
      hoursObj = null;
    }
  }

  if (!hoursObj || typeof hoursObj !== "object" || Array.isArray(hoursObj)) {
    return {
      isOpen: false,
      isUnavailable: true,
      status: "UNAVAILABLE",
      label: "Hours Unavailable",
    };
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const hasConfiguredDays = allDays.some((d) => {
    const val = hoursObj[d] ?? hoursObj[capitalize(d)] ?? hoursObj[d.toUpperCase()];
    return val !== undefined && val !== null;
  });

  if (!hasConfiguredDays) {
    return {
      isOpen: false,
      isUnavailable: true,
      status: "UNAVAILABLE",
      label: "Hours Unavailable",
    };
  }

  const currentDayIndex = now.getDay();
  const currentDayName = DAY_NAMES[currentDayIndex];
  const todayVal =
    hoursObj[currentDayName] ??
    hoursObj[capitalize(currentDayName)] ??
    hoursObj[currentDayName.toUpperCase()];

  if (!todayVal) {
    return {
      isOpen: false,
      isUnavailable: false,
      status: "CLOSED",
      label: "Closed",
    };
  }

  if (typeof todayVal === "object" && todayVal !== null) {
    const isClosed = todayVal.isClosed ?? todayVal.closed;
    if (isClosed === true) {
      return {
        isOpen: false,
        isUnavailable: false,
        status: "CLOSED",
        label: "Closed",
      };
    }

    const openTime = parseOfficeTimeString(todayVal.openTime ?? todayVal.open);
    const closeTime = parseOfficeTimeString(todayVal.closeTime ?? todayVal.close);

    if (!openTime || !closeTime) {
      return {
        isOpen: false,
        isUnavailable: true,
        status: "UNAVAILABLE",
        label: "Hours Unavailable",
      };
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openTime.hour * 60 + openTime.minute;
    const closeMinutes = closeTime.hour * 60 + closeTime.minute;

    if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
      return {
        isOpen: true,
        isUnavailable: false,
        status: "OPEN",
        label: "Open Now",
      };
    }

    return {
      isOpen: false,
      isUnavailable: false,
      status: "CLOSED",
      label: "Closed",
    };
  }

  if (typeof todayVal === "string") {
    const trimmed = todayVal.trim();
    if (trimmed.toLowerCase() === "closed") {
      return {
        isOpen: false,
        isUnavailable: false,
        status: "CLOSED",
        label: "Closed",
      };
    }

    const rangeMatch = trimmed.match(/(.+?)\s*[-–—]\s*(.+)/);
    if (rangeMatch) {
      const openTime = parseOfficeTimeString(rangeMatch[1]);
      const closeTime = parseOfficeTimeString(rangeMatch[2]);
      if (openTime && closeTime) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = openTime.hour * 60 + openTime.minute;
        const closeMinutes = closeTime.hour * 60 + closeTime.minute;

        if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
          return {
            isOpen: true,
            isUnavailable: false,
            status: "OPEN",
            label: "Open Now",
          };
        }

        return {
          isOpen: false,
          isUnavailable: false,
          status: "CLOSED",
          label: "Closed",
        };
      }
    }

    return {
      isOpen: false,
      isUnavailable: true,
      status: "UNAVAILABLE",
      label: "Hours Unavailable",
    };
  }

  return {
    isOpen: false,
    isUnavailable: true,
    status: "UNAVAILABLE",
    label: "Hours Unavailable",
  };
};

export const formatOfficeHours = (
  officeHours?: OfficeHoursRecord | string | null
): { day: string; hours: string }[] => {
  let resolvedHours: any = officeHours;
  if (typeof officeHours === "string") {
    try {
      resolvedHours = JSON.parse(officeHours);
    } catch {
      return [];
    }
  }

  if (!resolvedHours || typeof resolvedHours !== "object" || Array.isArray(resolvedHours)) {
    return [];
  }

  const dayOrder = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const formatted: { day: string; hours: string }[] = [];

  for (const day of dayOrder) {
    const val =
      resolvedHours[day] ??
      resolvedHours[capitalize(day)] ??
      resolvedHours[day.toUpperCase()];

    if (!val) continue;

    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed) {
        formatted.push({ day: capitalize(day), hours: trimmed });
      }
    } else if (typeof val === "object" && val !== null) {
      // Backend schema uses isClosed; legacy schema uses closed
      const isClosed = val.isClosed ?? val.closed;
      if (isClosed === true) {
        formatted.push({ day: capitalize(day), hours: "Closed" });
      } else {
        // Backend schema uses openTime & closeTime; legacy uses open & close
        const openTime = val.openTime ?? val.open;
        const closeTime = val.closeTime ?? val.close;

        if (openTime && closeTime) {
          formatted.push({
            day: capitalize(day),
            hours: `${openTime} - ${closeTime}`,
          });
        } else if (openTime) {
          formatted.push({
            day: capitalize(day),
            hours: `From ${openTime}`,
          });
        } else if (closeTime) {
          formatted.push({
            day: capitalize(day),
            hours: `Until ${closeTime}`,
          });
        }
      }
    }
  }

  return formatted;
};
