export const colors = {
  // Brand
  primary: "#7B1C2A",
  primaryPressed: "#5C1520",
  primaryDark: "#5C1520",
  primaryLight: "#9B2535",
  primarySoft: "#F9EAEC",
  primarySubtle: "#FDF2F4",

  // Canvas & Surfaces
  background: "#F5F0EE",
  appBase: "#FCFBFA",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F8F6F4",
  surfaceVariant: "#EFEAE3",

  // Typography
  textPrimary: "#1A1A1A",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textInverse: "#FFFFFF",

  // Borders & Dividers
  border: "#E5E7EB",
  borderLight: "#F0EFEB",
  borderStrong: "#D1D5DB",
  borderFocus: "#7B1C2A",
  cardBorder: "#EAE6DF",
  placeholderBg: "#E8E4DD",

  // Badges & Tags
  tagBg: "#F9EAEC",
  tagText: "#7B1C2A",

  // Semantic Statuses (matching Parishioner Web)
  success: "#15803D",
  successSoft: "#DCFCE7",
  successBorder: "#86EFAC",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  warningBorder: "#FDE68A",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  dangerBorder: "#FCA5A5",
  info: "#1D4ED8",
  infoSoft: "#EFF6FF",
  infoBorder: "#BFDBFE",
  pending: "#D97706",
  pendingSoft: "#FEF3C7",
  underReview: "#2563EB",
  underReviewSoft: "#DBEAFE",
  ready: "#16A34A",
  readySoft: "#DCFCE7",
  rejected: "#DC2626",
  rejectedSoft: "#FEE2E2",
  correction: "#D97706",
  correctionSoft: "#FFFBEB",
  correctionBorder: "#FDE68A",

  // Interactive
  disabled: "#9CA3AF",
  disabledBg: "#F3F4F6",
  overlay: "rgba(0, 0, 0, 0.45)",
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
  captionSmall: 11,
} as const;

export const fontStyles = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
  titleMedium: { fontSize: 19, lineHeight: 25, fontWeight: "600" as const },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: "600" as const },
  subheading: { fontSize: 15, lineHeight: 21, fontWeight: "600" as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: "500" as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  captionMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const },
  button: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
  meta: { fontSize: 11, lineHeight: 15, fontWeight: "500" as const },
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
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
} as const;