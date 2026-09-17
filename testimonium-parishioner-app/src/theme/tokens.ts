export const brandColors = {
  800: "#5C1520", // Pressed primary, deep overlay, high-emphasis
  700: "#7B1C2A", // Primary brand, primary actions, active navigation
  600: "#9B2535", // Secondary brand accent
  50: "#FBF4F5",  // Rare selected-row or notice wash
} as const;

export const neutralColors = {
  950: "#181719", // Titles and high-contrast primary text
  800: "#343136", // Body text
  650: "#5F5B60", // Secondary text (meets WCAG AA contrast on white)
  500: "#7A757A", // Disabled or nonessential text
  300: "#D7D2D4", // Input and control borders
  200: "#E7E4E5", // Dividers
  50: "#F8F8F7",  // Skeletons, neutral row highlight, clean empty region
} as const;

export const semanticColors = {
  success: "#276749",
  warning: "#8A5A00",
  danger: "#B42318",
  information: "#4F5965",
  overlay: "rgba(17, 12, 14, 0.44)",
} as const;

export const colors = {
  // Brand
  brand: brandColors,
  neutral: neutralColors,

  // Canonical Primary Tokens
  primary: brandColors[700],
  primaryPressed: brandColors[800],
  primaryDark: brandColors[800],
  primaryLight: brandColors[600],
  primarySoft: brandColors[50],
  primarySubtle: brandColors[50],

  // Canvas & Surfaces (Predominantly White Canvas)
  canvas: "#FFFFFF",
  background: "#FFFFFF", // Phase A redesign: background is purely white
  appBase: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: neutralColors[50],
  surfaceVariant: neutralColors[50],

  // Typography
  textPrimary: neutralColors[950],
  textSecondary: neutralColors[650],
  textMuted: neutralColors[500],
  textInverse: "#FFFFFF",

  // Borders & Dividers (Neutral 200/300)
  border: neutralColors[200],
  borderLight: neutralColors[200],
  borderStrong: neutralColors[300],
  borderFocus: brandColors[700],
  divider: neutralColors[200],
  cardBorder: neutralColors[200],
  controlBorder: neutralColors[300],
  placeholderBg: neutralColors[50],

  // Badges & Tags (Subtle, non-pill)
  tagBg: brandColors[50],
  tagText: brandColors[700],

  // Semantic Statuses (WCAG compliant)
  success: semanticColors.success,
  successSoft: "#F0FDF4",
  successBorder: "#BBF7D0",
  warning: semanticColors.warning,
  warningSoft: "#FFFBEB",
  warningBorder: "#FDE68A",
  danger: semanticColors.danger,
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  info: semanticColors.information,
  infoSoft: "#F8FAFC",
  infoBorder: "#E2E8F0",
  information: semanticColors.information,
  pending: "#D97706",
  pendingSoft: "#FEF3C7",
  underReview: "#2563EB",
  underReviewSoft: "#DBEAFE",
  ready: semanticColors.success,
  readySoft: "#F0FDF4",
  rejected: semanticColors.danger,
  rejectedSoft: "#FEF2F2",
  correction: semanticColors.warning,
  correctionSoft: "#FFFBEB",
  correctionBorder: "#FDE68A",

  // Interactive
  disabled: neutralColors[500],
  disabledBg: neutralColors[50],
  overlay: semanticColors.overlay,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  xs: 4,
  control: 8,
  button: 10,
  image: 12,
  elevated: 16,
  sheet: 20,
  full: 999,

  // Compatibility aliases
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  display: 30,
  title: 24,
  heading: 20,
  subheading: 16,
  body: 15,
  caption: 13,
  captionSmall: 12,
} as const;

// Android native serif for restrained editorial headings.
export const serifFamily = "serif";

export const fontStyles = {
  displaySerif: {
    fontFamily: serifFamily,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  titleSerif: {
    fontFamily: serifFamily,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  titleMedium: { fontSize: 19, lineHeight: 25, fontWeight: "600" as const },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: "600" as const },
  subheading: { fontSize: 15, lineHeight: 21, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: "500" as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  captionMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const },
  button: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
} as const;

export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sheet: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
