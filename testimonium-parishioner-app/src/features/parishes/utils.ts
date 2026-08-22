import { Alert, Linking, Platform } from "react-native";
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
    if (Platform.OS === "android") {
      const label = encodeURIComponent(name || address || "Parish");
      return `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    }
    return `https://maps.google.com/?q=${lat},${lng}`;
  }

  if (address && typeof address === "string" && address.trim().length > 0) {
    const query = encodeURIComponent(address.trim());
    if (Platform.OS === "android") {
      return `geo:0,0?q=${query}`;
    }
    return `https://maps.google.com/?q=${query}`;
  }

  return null;
};

export const openExternalUrl = async (url: string | null): Promise<boolean> => {
  if (!url) return false;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
    // If Android geo: protocol fails, fallback to web Google Maps URL
    if (url.startsWith("geo:")) {
      let webUrl: string;
      if (url.startsWith("geo:0,0?q=")) {
        const query = url.replace("geo:0,0?q=", "");
        webUrl = `https://maps.google.com/?q=${query}`;
      } else {
        const coordMatch = url.match(/^geo:([-\d.]+),([-\d.]+)/);
        if (coordMatch) {
          webUrl = `https://maps.google.com/?q=${coordMatch[1]},${coordMatch[2]}`;
        } else {
          webUrl = `https://maps.google.com/?q=${encodeURIComponent(url)}`;
        }
      }
      const webSupported = await Linking.canOpenURL(webUrl);
      if (webSupported) {
        await Linking.openURL(webUrl);
        return true;
      }
    }
    Alert.alert("Unable to Open Link", "No compatible application was found to handle this action.");
    return false;
  } catch {
    Alert.alert("Error", "Could not open the requested destination.");
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
