export const colors = {
  primary: "#7B1C2A",
  primaryPressed: "#5C1520",
  primaryDark: "#5C1520",
  primarySoft: "#F9EAEC",
  background: "#F8F7F6",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  surfaceMuted: "#F4F2EE",
  surfaceVariant: "#ECE8E1",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F0EFEB",
  borderFocus: "#7B1C2A",
  cardBorder: "#EAE6DF",
  placeholderBg: "#E8E4DD",
  tagBg: "#F9EAEC",
  tagText: "#7B1C2A",
  success: "#15803D",
  successSoft: "#EAF5ED",
  warning: "#B45309",
  warningSoft: "#FEF3C7",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  info: "#1D4ED8",
  infoSoft: "#EFF6FF",
  disabled: "#9CA3AF",
  overlay: "rgba(0, 0, 0, 0.4)",
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
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  title: 28,
  heading: 20,
  subheading: 18,
  body: 15,
  caption: 13,
  captionSmall: 11,
} as const;

export const fontStyles = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700" as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const },
  titleMedium: { fontSize: 20, lineHeight: 26, fontWeight: "600" as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontWeight: "500" as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  captionMedium: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  button: { fontSize: 15, lineHeight: 20, fontWeight: "600" as const },
} as const;


export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;