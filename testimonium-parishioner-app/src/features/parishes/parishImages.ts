import type { ImageSourcePropType } from "react-native";

export const BUNDLED_PARISH_IMAGES: Record<string, ImageSourcePropType> = {
  cabagtasan: require("../../../assets/images/parishes/cabagtasan.webp"),
  canlaon: require("../../../assets/images/parishes/canlaon.webp"),
  dsb: require("../../../assets/images/parishes/dsb.webp"),
  masulog: require("../../../assets/images/parishes/masulog.webp"),
  prosperidad: require("../../../assets/images/parishes/prosperidad.webp"),
  quezon: require("../../../assets/images/parishes/quezon.webp"),
  tagbino: require("../../../assets/images/parishes/tagbino.webp"),
};

export interface ParishImageLookup {
  id?: number | string | null;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  coverImage?: string | null;
}

/**
 * Resolves the bundled parish photograph based on parish ID, name, address, or city,
 * matching the established parish-image mapping from the web portal.
 */
export function getBundledParishImage(
  parish: ParishImageLookup | string | number | null | undefined
): ImageSourcePropType | null {
  if (parish === null || parish === undefined) {
    return null;
  }

  let id = "";
  let name = "";
  let address = "";
  let city = "";

  if (typeof parish === "number") {
    id = String(parish);
  } else if (typeof parish === "string") {
    if (/^\d+$/.test(parish.trim())) {
      id = parish.trim();
    }
    name = parish;
    address = parish;
    city = parish;
  } else {
    id = parish.id != null ? String(parish.id) : "";
    name = parish.name || "";
    address = parish.address || "";
    city = parish.city || "";
  }

  const searchStr = `${id} ${name} ${address} ${city}`.toLowerCase();

  // 1. Mountains / Cabagtasan (Parish ID 1)
  if (
    id === "1" ||
    searchStr.includes("cabagtasan") ||
    searchStr.includes("mountain")
  ) {
    return BUNDLED_PARISH_IMAGES.cabagtasan;
  }

  // 2. Don Salvador Benedicto / DSB / Miraculous Medal (Parish ID 3)
  if (
    id === "3" ||
    searchStr.includes("don salvador") ||
    searchStr.includes("benedicto") ||
    searchStr.includes("dsb") ||
    searchStr.includes("miraculous")
  ) {
    return BUNDLED_PARISH_IMAGES.dsb;
  }

  // 3. Masulog / Mount Carmel / Las Flores (Parish ID 4)
  // Evaluated before Canlaon because Masulog is located in Canlaon City.
  if (
    id === "4" ||
    searchStr.includes("masulog") ||
    searchStr.includes("carmel") ||
    searchStr.includes("flores") ||
    searchStr.includes("p3")
  ) {
    return BUNDLED_PARISH_IMAGES.masulog;
  }

  // 4. Canlaon City Proper / St. Joseph / San Isidro (Parish ID 2)
  if (
    id === "2" ||
    searchStr.includes("canlaon") ||
    searchStr.includes("isidro") ||
    searchStr.includes("labrador") ||
    searchStr.includes("joseph") ||
    searchStr.includes("p1") ||
    searchStr.includes("p2")
  ) {
    return BUNDLED_PARISH_IMAGES.canlaon;
  }

  // 5. Prosperidad / Peace and Good Voyage (Parish ID 5)
  if (
    id === "5" ||
    searchStr.includes("prosperidad") ||
    searchStr.includes("peace and good voyage") ||
    searchStr.includes("voyage")
  ) {
    return BUNDLED_PARISH_IMAGES.prosperidad;
  }

  // 6. Quezon / Holy Child (Parish ID 6)
  if (
    id === "6" ||
    searchStr.includes("quezon") ||
    searchStr.includes("holy child") ||
    searchStr.includes("child") ||
    searchStr.includes("niño") ||
    searchStr.includes("nino")
  ) {
    return BUNDLED_PARISH_IMAGES.quezon;
  }

  // 7. Tagbino / Guadalupe / Vallehermoso (Parish ID 7)
  if (
    id === "7" ||
    searchStr.includes("tagbino") ||
    searchStr.includes("guadalupe") ||
    searchStr.includes("vallehermoso") ||
    searchStr.includes("p4")
  ) {
    return BUNDLED_PARISH_IMAGES.tagbino;
  }

  return null;
}

/**
 * Resolves a parish image source.
 * Prefers an existing valid remote coverImage URL (http/https);
 * otherwise falls back to the bundled church photograph.
 */
export function resolveParishImageSource(
  parish: ParishImageLookup | string | number | null | undefined
): ImageSourcePropType | null {
  if (!parish) return null;

  if (typeof parish === "object" && parish.coverImage) {
    const trimmed = parish.coverImage.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return { uri: trimmed };
    }
  }

  return getBundledParishImage(parish);
}
