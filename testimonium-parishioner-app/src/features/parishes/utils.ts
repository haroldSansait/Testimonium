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

export const formatOfficeHours = (
  officeHours?: OfficeHoursRecord | null
): { day: string; hours: string }[] => {
  if (!officeHours || typeof officeHours !== "object" || Array.isArray(officeHours)) {
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
      officeHours[day] ??
      officeHours[capitalize(day)] ??
      officeHours[day.toUpperCase()];

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
