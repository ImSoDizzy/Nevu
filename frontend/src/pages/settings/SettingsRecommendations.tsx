import {
  Typography,
  Box,
  CircularProgress,
  Checkbox,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import React, { useEffect } from "react";
import { DragIndicatorRounded } from "@mui/icons-material";
import CheckBoxOption from "../../components/settings/CheckBoxOption";
import { getAllLibraries, getLibrarySecondary } from "../../plex";
import { useUserSettings } from "../../states/UserSettingsState";
import {
  RECOMMENDATION_CATEGORY_ORDER_SETTING_KEY,
  RECOMMENDATION_MAX_CATEGORIES_SETTING_KEY,
  RECOMMENDATION_SHOWN_BY_DEFAULT_SETTING_KEY,
  RECOMMENDATION_SHOWN_MODE_SETTING_KEY,
  RECOMMENDATION_SORT_MODE_SETTING_KEY,
  RecommendationShownMode,
  RecommendationSortMode,
  buildRecommendationGenreCategoryId,
  getRecommendationCategoryEnabledSettingKey,
  getRecommendationMaxCategories,
  getRecommendationShownByDefault,
  getRecommendationShownMode,
  getRecommendationSortMode,
  isRecommendationCategoryEnabled,
  sortRecommendationCategoriesAlphabetically,
  sortRecommendationCategoriesByManualOrder,
} from "../../common/RecommendationSettings";
import {
  LIBRARY_ORDER_SETTING_KEY,
  sortLibrariesBySettingsOrder,
} from "../../common/LibrarySettings";

interface RecommendationCategory {
  id: string;
  title: string;
  subtitle: string;
}

function SettingsRecommendations() {
  const [categories, setCategories] = React.useState<RecommendationCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draggingCategoryId, setDraggingCategoryId] = React.useState<string | null>(
    null
  );
  const [dragOverCategoryId, setDragOverCategoryId] = React.useState<string | null>(
    null
  );
  const { settings, setSetting } = useUserSettings();

  const shownByDefault = getRecommendationShownByDefault(settings);
  const shownMode = getRecommendationShownMode(settings);
  const sortMode = getRecommendationSortMode(settings);
  const maxCategoriesPerLibrary = getRecommendationMaxCategories(settings);
  const canReorder = sortMode === "manual";
  const [maxCategoriesInput, setMaxCategoriesInput] = React.useState(
    maxCategoriesPerLibrary.toString()
  );

  useEffect(() => {
    async function fetchCategories() {
      setLoading(true);
      try {
        const librariesData = await getAllLibraries();
        const contentLibraries = librariesData.filter((library) =>
          ["movie", "show"].includes(library.type)
        );
        const orderedLibraries = sortLibrariesBySettingsOrder(
          contentLibraries,
          settings[LIBRARY_ORDER_SETTING_KEY]
        );

        const categoriesPerLibrary = await Promise.all(
          orderedLibraries.map(async (library) => {
            const genres = await getLibrarySecondary(library.key, "genre").catch(
              () => []
            );
            if (!genres || !Array.isArray(genres)) return [];

            return genres.map((genre) => ({
              id: buildRecommendationGenreCategoryId(library.uuid, genre.key),
              title: `${library.title} - ${genre.title}`,
              subtitle: `Library: ${library.title}`,
            }));
          })
        );

        const flattenedCategories = categoriesPerLibrary.reduce<
          RecommendationCategory[]
        >((allCategories, libraryCategories) => {
          allCategories.push(...libraryCategories);
          return allCategories;
        }, []);

        setCategories(flattenedCategories);
      } catch (error) {
        console.error("Error fetching recommendation categories", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, [settings[LIBRARY_ORDER_SETTING_KEY]]);

  useEffect(() => {
    setMaxCategoriesInput(maxCategoriesPerLibrary.toString());
  }, [maxCategoriesPerLibrary]);

  const sortedCategories = React.useMemo(() => {
    if (sortMode === "alphabetical") {
      return sortRecommendationCategoriesAlphabetically(categories);
    }

    return sortRecommendationCategoriesByManualOrder(
      categories,
      settings[RECOMMENDATION_CATEGORY_ORDER_SETTING_KEY]
    );
  }, [
    categories,
    sortMode,
    settings[RECOMMENDATION_CATEGORY_ORDER_SETTING_KEY],
  ]);

  const reorderCategory = (targetCategoryId: string, draggedCategoryId: string) => {
    if (!canReorder || targetCategoryId === draggedCategoryId) return;

    const draggedIndex = sortedCategories.findIndex(
      (category) => category.id === draggedCategoryId
    );
    const targetIndex = sortedCategories.findIndex(
      (category) => category.id === targetCategoryId
    );

    if (draggedIndex < 0 || targetIndex < 0) return;

    const nextCategories = [...sortedCategories];
    const [draggedCategory] = nextCategories.splice(draggedIndex, 1);
    nextCategories.splice(targetIndex, 0, draggedCategory);

    void setSetting(
      RECOMMENDATION_CATEGORY_ORDER_SETTING_KEY,
      JSON.stringify(nextCategories.map((category) => category.id))
    );
  };

  const enabledCategoryCount = sortedCategories.filter((category) =>
    isRecommendationCategoryEnabled(settings, category.id)
  ).length;
  const allCategoriesChecked =
    sortedCategories.length > 0 &&
    enabledCategoryCount === sortedCategories.length;
  const someCategoriesChecked =
    enabledCategoryCount > 0 && enabledCategoryCount < sortedCategories.length;

  const commitMaxCategories = () => {
    const parsed = Number.parseInt(maxCategoriesInput, 10);
    const normalized = Number.isNaN(parsed) ? -1 : Math.max(-1, parsed);
    setMaxCategoriesInput(normalized.toString());
    void setSetting(
      RECOMMENDATION_MAX_CATEGORIES_SETTING_KEY,
      normalized.toString()
    );
  };

  return (
    <>
      <Typography variant="h4">Experience - Recommendations</Typography>

      <Box
        sx={{
          mt: 2,
          width: "100%",
          minHeight: "40px",
          backgroundColor: "var(--app-surface-3)",
          borderRadius: "14px",
          border: "1px solid var(--app-border)",
          display: "flex",
          alignItems: "center",
          px: 2,
          py: 1,
        }}
      >
        <Typography
          sx={{
            color: "var(--app-ink-muted)",
            fontSize: "0.9rem",
            userSelect: "none",
          }}
        >
          Choose which recommendation categories are shown and how they are
          ordered.
        </Typography>
      </Box>

      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
        <CheckBoxOption
          title="Shown By Default: Enabled"
          subtitle="New categories are enabled by default in Manual shown-categories mode."
          checked={shownByDefault}
          onChange={(checked) => {
            void setSetting(
              RECOMMENDATION_SHOWN_BY_DEFAULT_SETTING_KEY,
              checked ? "true" : "false"
            );
          }}
        />

        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "stretch", md: "center" },
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              width: { xs: "100%", md: "280px" },
            }}
          >
            <Typography sx={{ color: "var(--app-ink-muted)", fontSize: "0.85rem" }}>
              Shown Categories
            </Typography>
            <Select
              size="small"
              value={shownMode}
              onChange={(event) => {
                void setSetting(
                  RECOMMENDATION_SHOWN_MODE_SETTING_KEY,
                  event.target.value as RecommendationShownMode
                );
              }}
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="random">Random</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              width: { xs: "100%", md: "280px" },
            }}
          >
            <Typography sx={{ color: "var(--app-ink-muted)", fontSize: "0.85rem" }}>
              Sort Mode
            </Typography>
            <Select
              size="small"
              value={sortMode}
              onChange={(event) => {
                void setSetting(
                  RECOMMENDATION_SORT_MODE_SETTING_KEY,
                  event.target.value as RecommendationSortMode
                );
              }}
            >
              <MenuItem value="alphabetical">Alphabetical</MenuItem>
              <MenuItem value="random">Random</MenuItem>
              <MenuItem value="manual">Manual</MenuItem>
            </Select>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.75,
              width: { xs: "100%", md: "220px" },
            }}
          >
            <Typography sx={{ color: "var(--app-ink-muted)", fontSize: "0.85rem" }}>
              Max Categories Per Library
            </Typography>
            <TextField
              size="small"
              type="number"
              value={maxCategoriesInput}
              onChange={(event) => setMaxCategoriesInput(event.target.value)}
              onBlur={commitMaxCategories}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  (event.currentTarget as HTMLInputElement).blur();
                }
              }}
              slotProps={{
                htmlInput: {
                  min: -1,
                  step: 1,
                },
              }}
              helperText="-1 means unlimited per library"
            />
          </Box>
        </Box>

        <Typography
          sx={{
            color: "var(--app-ink-muted)",
            fontSize: "0.85rem",
            userSelect: "none",
          }}
        >
          {canReorder
            ? "Drag and drop categories to set manual order."
            : "Drag-and-drop is available only when Sort Mode is set to Manual."}
        </Typography>

        <Divider sx={{ my: 1 }} />

        {!loading && sortedCategories.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Checkbox
              checked={allCategoriesChecked}
              indeterminate={someCategoriesChecked}
              onChange={(event) => {
                const checked = event.target.checked;
                void Promise.all(
                  sortedCategories.map((category) =>
                    setSetting(
                      getRecommendationCategoryEnabledSettingKey(category.id),
                      checked ? "true" : "false"
                    )
                  )
                );
              }}
            />
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography>
                {allCategoriesChecked ? "Deselect All Categories" : "Select All Categories"}
              </Typography>
              <Typography
                sx={{
                  color: "var(--app-ink-muted)",
                  fontSize: "0.9rem",
                  userSelect: "none",
                }}
              >
                Toggle all listed categories at once.
              </Typography>
            </Box>
          </Stack>
        )}

        {loading && <CircularProgress sx={{ alignSelf: "center", mt: 2 }} size={24} />}

        {!loading && sortedCategories.length === 0 && (
          <Typography
            sx={{ color: "var(--app-ink-muted)", fontSize: "0.95rem", mt: 1 }}
          >
            No categories were found from Plex.
          </Typography>
        )}

        {sortedCategories.map((category) => {
          const checked = isRecommendationCategoryEnabled(settings, category.id);

          return (
            <Box
              key={category.id}
              onDragOver={(event) => {
                if (!canReorder) return;

                event.preventDefault();
                if (dragOverCategoryId !== category.id) {
                  setDragOverCategoryId(category.id);
                }
              }}
              onDrop={(event) => {
                if (!canReorder) return;
                event.preventDefault();

                const draggedCategoryId =
                  draggingCategoryId || event.dataTransfer.getData("text/plain");
                if (draggedCategoryId) {
                  reorderCategory(category.id, draggedCategoryId);
                }

                setDragOverCategoryId(null);
                setDraggingCategoryId(null);
              }}
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: "12px",
                px: 1,
                py: 0.5,
                border:
                  canReorder && dragOverCategoryId === category.id
                    ? "1px dashed var(--app-ink-muted)"
                    : "1px solid transparent",
                backgroundColor:
                  draggingCategoryId === category.id
                    ? "rgba(255, 255, 255, 0.04)"
                    : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  draggable={canReorder}
                  onDragStart={(event) => {
                    if (!canReorder) return;

                    setDraggingCategoryId(category.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", category.id);
                  }}
                  onDragEnd={() => {
                    setDraggingCategoryId(null);
                    setDragOverCategoryId(null);
                  }}
                  sx={{
                    color: "var(--app-ink-muted)",
                    cursor: canReorder ? "grab" : "not-allowed",
                    opacity: canReorder ? 1 : 0.45,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0.5,
                    borderRadius: "6px",
                    "&:active": {
                      cursor: canReorder ? "grabbing" : "not-allowed",
                    },
                    "&:hover": {
                      backgroundColor: canReorder
                        ? "rgba(255, 255, 255, 0.08)"
                        : "transparent",
                    },
                  }}
                >
                  <DragIndicatorRounded fontSize="small" />
                </Box>

                <Checkbox
                  checked={checked}
                  onChange={() => {
                    void setSetting(
                      getRecommendationCategoryEnabledSettingKey(category.id),
                      checked ? "false" : "true"
                    );
                  }}
                />

                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography>{category.title}</Typography>
                  <Typography
                    sx={{
                      color: "var(--app-ink-muted)",
                      fontSize: "0.9rem",
                      userSelect: "none",
                    }}
                  >
                    {category.subtitle}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </>
  );
}

export default SettingsRecommendations;
