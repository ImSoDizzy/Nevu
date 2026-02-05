import { shuffleArray } from "./ArrayExtra";

export type RecommendationShownMode = "random" | "manual" | "none";
export type RecommendationSortMode = "alphabetical" | "random" | "manual";

export interface RecommendationCategoryBase {
  id: string;
  title: string;
  groupKey?: string;
}

export const RECOMMENDATION_SHOWN_BY_DEFAULT_SETTING_KEY =
  "RECOMMENDATION_SHOWN_BY_DEFAULT";
export const RECOMMENDATION_SHOWN_MODE_SETTING_KEY =
  "RECOMMENDATION_SHOWN_MODE";
export const RECOMMENDATION_SORT_MODE_SETTING_KEY = "RECOMMENDATION_SORT_MODE";
export const RECOMMENDATION_MAX_CATEGORIES_SETTING_KEY =
  "RECOMMENDATION_MAX_CATEGORIES";
export const RECOMMENDATION_CATEGORY_ORDER_SETTING_KEY =
  "RECOMMENDATION_CATEGORY_ORDER";
export const RECOMMENDATION_CATEGORY_ENABLED_SETTING_PREFIX =
  "RECOMMENDATION_CATEGORY_ENABLED_";

const DEFAULT_RECOMMENDATION_SHOWN_BY_DEFAULT = true;
const DEFAULT_RECOMMENDATION_SHOWN_MODE: RecommendationShownMode = "random";
const DEFAULT_RECOMMENDATION_SORT_MODE: RecommendationSortMode = "random";
const DEFAULT_RECOMMENDATION_MAX_CATEGORIES = -1;

export function buildRecommendationGenreCategoryId(
  libraryUuid: string,
  genreKey: string
) {
  return `genre:${libraryUuid}:${genreKey}`;
}

export function getRecommendationCategoryEnabledSettingKey(categoryId: string) {
  return `${RECOMMENDATION_CATEGORY_ENABLED_SETTING_PREFIX}${encodeURIComponent(
    categoryId
  )}`;
}

export function getRecommendationShownByDefault(
  settings: Record<string, string>
) {
  const rawValue = settings[RECOMMENDATION_SHOWN_BY_DEFAULT_SETTING_KEY];
  if (rawValue === undefined) return DEFAULT_RECOMMENDATION_SHOWN_BY_DEFAULT;
  return rawValue === "true";
}

export function getRecommendationShownMode(settings: Record<string, string>) {
  const rawValue = settings[RECOMMENDATION_SHOWN_MODE_SETTING_KEY];
  if (rawValue === "manual" || rawValue === "random" || rawValue === "none") {
    return rawValue;
  }
  return DEFAULT_RECOMMENDATION_SHOWN_MODE;
}

export function getRecommendationSortMode(settings: Record<string, string>) {
  const rawValue = settings[RECOMMENDATION_SORT_MODE_SETTING_KEY];
  if (
    rawValue === "manual" ||
    rawValue === "random" ||
    rawValue === "alphabetical"
  ) {
    return rawValue;
  }
  return DEFAULT_RECOMMENDATION_SORT_MODE;
}

export function getRecommendationMaxCategories(settings: Record<string, string>) {
  const rawValue = settings[RECOMMENDATION_MAX_CATEGORIES_SETTING_KEY];
  if (rawValue === undefined) {
    return DEFAULT_RECOMMENDATION_MAX_CATEGORIES;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_RECOMMENDATION_MAX_CATEGORIES;
  }

  if (parsed < -1) {
    return -1;
  }

  return parsed;
}

export function parseRecommendationCategoryOrder(rawValue?: string): string[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function sortRecommendationCategoriesAlphabetically<
  T extends RecommendationCategoryBase
>(categories: T[]) {
  return [...categories].sort((left, right) => left.title.localeCompare(right.title));
}

export function sortRecommendationCategoriesByManualOrder<
  T extends RecommendationCategoryBase
>(categories: T[], rawOrderValue?: string) {
  const manualOrder = parseRecommendationCategoryOrder(rawOrderValue);
  if (manualOrder.length === 0) {
    return sortRecommendationCategoriesAlphabetically(categories);
  }

  const manualOrderMap = new Map(manualOrder.map((id, index) => [id, index]));

  return [...categories].sort((left, right) => {
    const leftIndex = manualOrderMap.get(left.id);
    const rightIndex = manualOrderMap.get(right.id);

    if (leftIndex === undefined && rightIndex === undefined) {
      return left.title.localeCompare(right.title);
    }
    if (leftIndex === undefined) return 1;
    if (rightIndex === undefined) return -1;
    return leftIndex - rightIndex;
  });
}

export function sortRecommendationCategoriesByMode<
  T extends RecommendationCategoryBase
>(categories: T[], sortMode: RecommendationSortMode, rawOrderValue?: string) {
  switch (sortMode) {
    case "alphabetical":
      return sortRecommendationCategoriesAlphabetically(categories);
    case "manual":
      return sortRecommendationCategoriesByManualOrder(categories, rawOrderValue);
    case "random":
      return sortRecommendationCategoriesRandomByGroup(categories);
    default:
      return categories;
  }
}

function getRecommendationCategoryGroupKey(category: RecommendationCategoryBase) {
  if (category.groupKey) return category.groupKey;

  const split = category.id.split(":");
  if (split.length >= 3 && split[0] === "genre") {
    return split[1];
  }

  return "__all__";
}

function sortRecommendationCategoriesRandomByGroup<
  T extends RecommendationCategoryBase
>(categories: T[]) {
  const groupedCategories = new Map<string, T[]>();
  const groupOrder: string[] = [];

  for (const category of categories) {
    const groupKey = getRecommendationCategoryGroupKey(category);
    if (!groupedCategories.has(groupKey)) {
      groupedCategories.set(groupKey, []);
      groupOrder.push(groupKey);
    }

    groupedCategories.get(groupKey)?.push(category);
  }

  const sortedCategories: T[] = [];

  for (const groupKey of groupOrder) {
    const group = groupedCategories.get(groupKey) || [];
    sortedCategories.push(...(shuffleArray([...group]) as T[]));
  }

  return sortedCategories;
}

export function isRecommendationCategoryEnabled(
  settings: Record<string, string>,
  categoryId: string
) {
  const rawValue =
    settings[getRecommendationCategoryEnabledSettingKey(categoryId)];
  if (rawValue !== undefined) {
    return rawValue === "true";
  }

  const shownMode = getRecommendationShownMode(settings);
  if (shownMode === "random") {
    // In random mode, unknown categories are enabled unless explicitly disabled.
    return true;
  }

  return getRecommendationShownByDefault(settings);
}

export function applyRecommendationCategorySettings<
  T extends RecommendationCategoryBase
>(categories: T[], settings: Record<string, string>) {
  const shownMode = getRecommendationShownMode(settings);
  const sortMode = getRecommendationSortMode(settings);
  const maxCategoriesPerLibrary = getRecommendationMaxCategories(settings);
  const manualOrderRaw = settings[RECOMMENDATION_CATEGORY_ORDER_SETTING_KEY];

  if (shownMode === "none") {
    return [];
  }

  const enabledCategories = categories.filter((category) =>
    isRecommendationCategoryEnabled(settings, category.id)
  );

  const selectedCategories =
    shownMode === "random" && maxCategoriesPerLibrary >= 0
      ? selectRandomSubsetPerGroupPreservingOrder(
          enabledCategories,
          maxCategoriesPerLibrary
        )
      : enabledCategories;

  const sortedCategories = sortRecommendationCategoriesByMode(
    selectedCategories,
    sortMode,
    manualOrderRaw
  );

  if (maxCategoriesPerLibrary < 0) {
    return sortedCategories;
  }

  return limitCategoriesPerGroup(sortedCategories, maxCategoriesPerLibrary);
}

function selectRandomSubsetPerGroupPreservingOrder<
  T extends RecommendationCategoryBase
>(categories: T[], maxCountPerGroup: number) {
  const limitedCountPerGroup = Math.max(maxCountPerGroup, 0);

  const groupedCategoryIds = new Map<string, string[]>();
  for (const category of categories) {
    const groupKey = getRecommendationCategoryGroupKey(category);
    if (!groupedCategoryIds.has(groupKey)) {
      groupedCategoryIds.set(groupKey, []);
    }
    groupedCategoryIds.get(groupKey)?.push(category.id);
  }

  const selectedIds = new Set<string>();
  groupedCategoryIds.forEach((groupCategoryIds) => {
    const shuffledIds = shuffleArray([...groupCategoryIds]) as string[];
    shuffledIds
      .slice(0, Math.min(limitedCountPerGroup, groupCategoryIds.length))
      .forEach((id) => selectedIds.add(id));
  });

  return categories.filter((category) => selectedIds.has(category.id));
}

function limitCategoriesPerGroup<
  T extends RecommendationCategoryBase
>(categories: T[], maxCountPerGroup: number) {
  const limitedCountPerGroup = Math.max(maxCountPerGroup, 0);
  const groupCounts = new Map<string, number>();

  return categories.filter((category) => {
    const groupKey = getRecommendationCategoryGroupKey(category);
    const currentCount = groupCounts.get(groupKey) || 0;
    if (currentCount >= limitedCountPerGroup) {
      return false;
    }

    groupCounts.set(groupKey, currentCount + 1);
    return true;
  });
}
