export interface ParishPage<T> {
  items: T[];
  page: number;
  totalPages: number;
}

type RawParish = {
  id?: string | number;
  isActive?: boolean;
  status?: string;
};

function isActiveParish(parish: RawParish): boolean {
  if (parish.isActive === false) return false;
  if (typeof parish.status === 'string' && parish.status.toLowerCase() !== 'active') return false;
  return true;
}

export async function collectAllActiveParishes<T extends RawParish>(
  fetchPage: (page: number, limit: number) => Promise<ParishPage<T> | T[]>,
  pageSize = 100,
): Promise<T[]> {
  const byId = new Map<string, T>();

  for (let page = 1; page <= 1000; page += 1) {
    const response = await fetchPage(page, pageSize);
    const items = Array.isArray(response) ? response : response.items;

    for (const parish of items) {
      if (parish.id === undefined || parish.id === null || !isActiveParish(parish)) continue;
      byId.set(String(parish.id), parish);
    }

    if (Array.isArray(response) || items.length === 0 || page >= Math.max(1, Number(response.totalPages) || 1)) {
      return [...byId.values()];
    }
  }

  throw new Error('Parish pagination exceeded the safe page limit');
}
