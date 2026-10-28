import type { Parish } from '@/types';

const MAP_FIELDS = ['latitude', 'longitude', 'mapZoom', 'pinColor', 'showLabel'] as const;
const DIRECTORY_FIELDS = ['directoryDescription', 'contactNumber', 'email'] as const;
type Drafts = Record<string, Partial<Parish>>;
type MapUpdate = Pick<Parish, 'id' | 'locationUpdatedAt' | typeof MAP_FIELDS[number]> & {
  latitude: number;
  longitude: number;
};
interface SaveApi {
  batchUpdateMap(updates: MapUpdate[]): Promise<Parish[]>;
  updateDirectorySettings(id: string, data: Pick<Partial<Parish>, typeof DIRECTORY_FIELDS[number]>): Promise<Parish>;
}
export interface MapSaveFailure {
  scope: 'map' | 'directory';
  id?: string;
  error: unknown;
}

const pick = <K extends keyof Parish>(parish: Partial<Parish>, fields: readonly K[]) =>
  Object.fromEntries(fields.filter((field) => parish[field] !== undefined).map((field) => [field, parish[field]])) as Pick<Partial<Parish>, K>;

/** Save a captured draft. Each response owns only its endpoint's fields. */
export async function saveMapConfiguration(
  parishes: Parish[], drafts: Drafts, api: SaveApi, fallbackCenter: readonly [number, number],
) {
  const savedChanges: Drafts = {};
  const failures: MapSaveFailure[] = [];
  const mapUpdates = Object.entries(drafts)
    .filter(([, draft]) => MAP_FIELDS.some((field) => draft[field] !== undefined))
    .map(([id, draft]) => {
      const original = parishes.find((parish) => parish.id === id)!;
      return {
        id,
        latitude: draft.latitude ?? original.latitude ?? fallbackCenter[0],
        longitude: draft.longitude ?? original.longitude ?? fallbackCenter[1],
        mapZoom: draft.mapZoom !== undefined ? draft.mapZoom : original.mapZoom,
        pinColor: draft.pinColor !== undefined ? draft.pinColor : original.pinColor,
        showLabel: draft.showLabel !== undefined ? draft.showLabel : original.showLabel,
        locationUpdatedAt: original.locationUpdatedAt,
      };
    });

  if (mapUpdates.length) {
    try {
      const results = await api.batchUpdateMap(mapUpdates);
      for (const parish of results) {
        savedChanges[parish.id] = {
          ...pick(parish, MAP_FIELDS),
          locationUpdatedAt: parish.locationUpdatedAt,
          locationUpdatedBy: parish.locationUpdatedBy,
        };
      }
    } catch (error) {
      failures.push({ scope: 'map', error });
    }
  }

  // Start directory requests only after the map batch settles. Settle every
  // request so one rejection cannot hide another parish's successful write.
  const directoryUpdates = Object.entries(drafts)
    .filter(([, draft]) => DIRECTORY_FIELDS.some((field) => draft[field] !== undefined));
  const directoryResults = await Promise.allSettled(directoryUpdates.map(([id, draft]) =>
    api.updateDirectorySettings(id, pick(draft, DIRECTORY_FIELDS))));
  directoryResults.forEach((result, index) => {
    const [id] = directoryUpdates[index];
    if (result.status === 'fulfilled') {
      savedChanges[id] = { ...savedChanges[id], ...pick(result.value, DIRECTORY_FIELDS) };
    } else {
      failures.push({ scope: 'directory', id, error: result.reason });
    }
  });

  const savedIds = Object.entries(drafts)
    .filter(([id, draft]) => Object.keys(draft).every((field) => Object.hasOwn(savedChanges[id] ?? {}, field)))
    .map(([id]) => id);
  return { savedChanges, savedIds, failures };
}

/** Clear only acknowledged fields; preserve failures and edits made during save. */
export function reconcileMapDrafts(current: Drafts, submitted: Drafts, baseline: Parish[], saved: Drafts): Drafts {
  const next = { ...current };
  for (const [id, snapshot] of Object.entries(submitted)) {
    const draft = { ...current[id] };
    const original = baseline.find((parish) => parish.id === id)!;
    for (const field of Object.keys(snapshot) as (keyof Parish)[]) {
      if (!Object.hasOwn(saved[id] ?? {}, field)) continue;
      if (JSON.stringify(draft[field]) === JSON.stringify(snapshot[field])) {
        delete draft[field];
      } else if (!Object.hasOwn(draft, field) && JSON.stringify(original[field]) !== JSON.stringify(saved[id][field])) {
        // A field removed while saving means the user reverted to the old
        // baseline. That value is now a pending edit against the saved value.
        Object.assign(draft, { [field]: original[field] });
      }
    }
    if (Object.keys(draft).length) next[id] = draft;
    else delete next[id];
  }
  return next;
}
