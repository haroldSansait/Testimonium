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
    title: "Confirmation",
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
    aliases: ["wedding", "marriage", "marriage canonical interview", "marriage pre-cana seminar", "pre-cana", "canonical interview"]
  },
  {
    enum: "MARRIAGE_SPECIAL",
    title: "Marriage Special",
    badgeColor: "bg-pink-100 text-pink-800 border-pink-200",
    icon: "Heart",
    category: "Sacrament",
    aliases: ["marriage special", "special marriage", "special wedding"]
  },
  {
    enum: "WAKE_MASS",
    title: "Wake Mass",
    badgeColor: "bg-gray-100 text-gray-800 border-gray-200",
    icon: "Calendar",
    category: "Mass",
    aliases: ["wake mass", "wake"]
  },
  {
    enum: "FUNERAL",
    title: "Funeral",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-200",
    icon: "Calendar",
    category: "Mass",
    aliases: ["funeral", "funeral mass", "burial"]
  },
  {
    enum: "PRIVATE_MASS",
    title: "Mass",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-100",
    icon: "Home",
    category: "Mass",
    aliases: ["private mass", "private mass scheduling", "mass"]
  },
  {
    enum: "MASS_INTENTION",
    title: "Mass Intention",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-100",
    icon: "Church",
    category: "Mass",
    aliases: ["mass intention", "general intention"]
  },
  {
    enum: "ANOINTING_OF_THE_SICK",
    title: "Anointing of the Sick",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: "ShieldAlert",
    category: "Sacrament",
    aliases: ["anointing", "anointing of the sick", "last rites", "sick call"]
  },
  {
    enum: "FIESTA",
    title: "Fiesta",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-100",
    icon: "Sparkles",
    category: "Other",
    aliases: ["fiesta", "parish fiesta", "festival"]
  },
  {
    enum: "BLESSING",
    title: "Blessing",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-100",
    icon: "Activity",
    category: "Other",
    aliases: ["blessing", "house blessing", "car blessing", "office blessing"]
  },
  {
    enum: "DELIVERANCE",
    title: "Deliverance",
    badgeColor: "bg-red-50 text-red-700 border-red-100",
    icon: "Shield",
    category: "Other",
    aliases: ["deliverance", "exorcism", "cleansing"]
  },
  {
    enum: "THANKSGIVING",
    title: "Thanksgiving",
    badgeColor: "bg-yellow-50 text-yellow-700 border-yellow-100",
    icon: "Sun",
    category: "Other",
    aliases: ["thanksgiving", "thanksgiving mass"]
  },
  {
    enum: "FIRST_COMMUNION",
    title: "First Communion",
    badgeColor: "bg-sky-50 text-sky-700 border-sky-100",
    icon: "Smile",
    category: "Sacrament",
    aliases: ["first communion", "communion"]
  },
  {
    enum: "MASS_OF_HOLY_SPIRIT",
    title: "Mass of the Holy Spirit",
    badgeColor: "bg-violet-50 text-violet-700 border-violet-100",
    icon: "Wind",
    category: "Mass",
    aliases: ["mass of the holy spirit", "holy spirit mass", "red mass"]
  },
  {
    enum: "CONFESSION",
    title: "Confession",
    badgeColor: "bg-stone-100 text-stone-700 border-stone-200",
    icon: "Lock",
    category: "Sacrament",
    aliases: ["confession", "reconciliation", "penance"]
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
