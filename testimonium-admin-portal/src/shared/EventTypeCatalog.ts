export interface EventMetadata {
  enum: string;
  title: string;
  badgeColor: string;
  icon: string;
  category: string;
  aliases: string[];
}

export const EventTypeCatalog: EventMetadata[] = [
  {
    enum: "BAPTISM",
    title: "Baptism Interview",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-100",
    icon: "Baby",
    category: "Sacrament",
    aliases: ["baptism", "baptism interview", "christening", "baptismal"]
  },
  {
    enum: "CONFIRMATION",
    title: "Confirmation Seminar",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-100",
    icon: "Church",
    category: "Sacrament",
    aliases: ["confirmation", "confirmation seminar", "confirmation canonical interview"]
  },
  {
    enum: "WEDDING",
    title: "Marriage Canonical Interview",
    badgeColor: "bg-pink-50 text-pink-700 border-pink-100",
    icon: "Heart",
    category: "Sacrament",
    aliases: [
      "wedding",
      "marriage",
      "marriage canonical interview",
      "marriage pre-cana seminar",
      "pre-cana",
      "canonical interview"
    ]
  },
  {
    enum: "PRIVATE_MASS",
    title: "Private Mass Scheduling",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-100",
    icon: "Home",
    category: "Mass",
    aliases: ["private mass", "private mass scheduling", "house blessing", "house blessing request", "blessing"]
  },
  {
    enum: "MASS_INTENTION",
    title: "Mass Intention",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-100",
    icon: "Church",
    category: "Mass",
    aliases: ["mass intention", "funeral mass", "funeral mass scheduling", "general intention"]
  }
];

export function resolveEventType(title: string | null | undefined): string | null {
  if (!title) return null;

  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const uppercaseEnum = normalized.toUpperCase().replace(/\s/g, "_");
  const directMatch = EventTypeCatalog.find(e => e.enum === uppercaseEnum);
  if (directMatch) return directMatch.enum;

  for (const event of EventTypeCatalog) {
    if (event.aliases.some(alias => normalized.includes(alias))) {
      return event.enum;
    }
  }

  return null;
}

export function resolveEventMetadata(enumValue: string | null | undefined): EventMetadata | null {
  if (!enumValue) return null;
  return EventTypeCatalog.find(e => e.enum === enumValue) || null;
}

export function resolveDisplayTitle(enumValue: string | null | undefined, customTitle: string | null | undefined): string {
  if (customTitle && customTitle.trim().length > 0) {
    return customTitle.trim();
  }
  const meta = resolveEventMetadata(enumValue);
  return meta ? meta.title : (enumValue || "");
}
