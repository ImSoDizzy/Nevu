export const LIBRARY_ORDER_SETTING_KEY = "LIBRARY_ORDER";

export function parseLibraryOrderValue(rawValue?: string): string[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function sortLibrariesBySettingsOrder(
  libraries: Plex.LibarySection[],
  rawOrderValue?: string
): Plex.LibarySection[] {
  const parsedOrder = parseLibraryOrderValue(rawOrderValue);
  if (parsedOrder.length === 0) return [...libraries];

  const orderMap = new Map(parsedOrder.map((uuid, index) => [uuid, index]));

  return [...libraries].sort((left, right) => {
    const leftIndex = orderMap.get(left.uuid);
    const rightIndex = orderMap.get(right.uuid);

    if (leftIndex === undefined && rightIndex === undefined) return 0;
    if (leftIndex === undefined) return 1;
    if (rightIndex === undefined) return -1;

    return leftIndex - rightIndex;
  });
}
