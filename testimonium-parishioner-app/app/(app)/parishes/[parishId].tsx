import { useLocalSearchParams } from "expo-router";
import { ParishDetailScreen } from "@/features/parishes/ParishDetailScreen";

export const normalizeParishId = (
  param: string | string[] | undefined
): string | null => {
  if (!param) return null;
  const raw = Array.isArray(param) ? param[0] : param;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  return trimmed;
};

export default function ParishDetailRoute() {
  const { parishId } = useLocalSearchParams<{ parishId?: string | string[] }>();
  const normalizedId = normalizeParishId(parishId);

  return <ParishDetailScreen parishId={normalizedId} />;
}
