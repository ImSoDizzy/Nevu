import {
  Typography,
  Box,
  Divider,
  CircularProgress,
  Checkbox,
  Stack,
} from "@mui/material";
import React, { useEffect } from "react";
import { DragIndicatorRounded } from "@mui/icons-material";
import { getAllLibraries } from "../../plex";
import CheckBoxOption from "../../components/settings/CheckBoxOption";
import { useUserSettings } from "../../states/UserSettingsState";
import {
  LIBRARY_ORDER_SETTING_KEY,
  sortLibrariesBySettingsOrder,
} from "../../common/LibrarySettings";

function SettingsLibraries() {
  const [libraries, setLibraries] = React.useState<Plex.LibarySection[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [draggingLibraryUuid, setDraggingLibraryUuid] = React.useState<string | null>(null);
  const [dragOverLibraryUuid, setDragOverLibraryUuid] = React.useState<string | null>(null);
  const { settings, setSetting } = useUserSettings();
  const initialLibraryOrder = React.useRef(settings[LIBRARY_ORDER_SETTING_KEY]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const librariesData = await getAllLibraries();

        const filteredLibraries = librariesData.filter((lib) =>
          ["movie", "show"].includes(lib.type)
        );

        setLibraries(
          sortLibrariesBySettingsOrder(
            filteredLibraries,
            initialLibraryOrder.current
          )
        );
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const reorderLibrary = (targetUuid: string, draggedUuid: string) => {
    if (targetUuid === draggedUuid) return;

    setLibraries((currentLibraries) => {
      const draggedIndex = currentLibraries.findIndex(
        (library) => library.uuid === draggedUuid
      );
      const targetIndex = currentLibraries.findIndex(
        (library) => library.uuid === targetUuid
      );

      if (draggedIndex < 0 || targetIndex < 0) return currentLibraries;

      const nextLibraries = [...currentLibraries];
      const [draggedLibrary] = nextLibraries.splice(draggedIndex, 1);
      nextLibraries.splice(targetIndex, 0, draggedLibrary);

      void setSetting(
        LIBRARY_ORDER_SETTING_KEY,
        JSON.stringify(nextLibraries.map((library) => library.uuid))
      );

      return nextLibraries;
    });
  };

  return (
    <>
      <Typography variant="h4">Experience - Libraries</Typography>

      <Box
        sx={{
          mt: 2,
          width: "100%",
          height: "40px",
          backgroundColor: "var(--app-surface-3)",
          borderRadius: "14px",
          border: "1px solid var(--app-border)",
          display: "flex",
          alignItems: "center",
          px: 2,
        }}
      >
        <Typography
          sx={{
            color: "var(--app-ink-muted)",
            fontSize: "0.9rem",
            userSelect: "none",
          }}
        >
          Drag and drop libraries to choose their order.
        </Typography>
      </Box>

      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
        <CheckBoxOption
          title="Disable Home Libraries Section"
          subtitle="Disables the section on the home screen where the libraries are displayed."
          checked={settings.DISABLE_HOME_SCREEN_LIBRARIES === "true"}
          onChange={() => {
            setSetting(
              "DISABLE_HOME_SCREEN_LIBRARIES",
              settings["DISABLE_HOME_SCREEN_LIBRARIES"] === "true"
                ? "false"
                : "true"
            );
          }}
        />

        <Divider sx={{ my: 2 }} />

        {loading && (
          <CircularProgress
            sx={{ alignSelf: "center", mt: 2 }}
            size={24}
          />
        )}

        {libraries.map((library) => {
          const key = `LIBRARY_${library.uuid}`;
          const rawValue = settings[key];

          const checked = rawValue === undefined ? true : rawValue === "true";

          return (
            <Box
              key={library.key}
              onDragOver={(event) => {
                event.preventDefault();
                if (dragOverLibraryUuid !== library.uuid) {
                  setDragOverLibraryUuid(library.uuid);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();

                const draggedUuid =
                  draggingLibraryUuid || event.dataTransfer.getData("text/plain");
                if (draggedUuid) {
                  reorderLibrary(library.uuid, draggedUuid);
                }

                setDragOverLibraryUuid(null);
                setDraggingLibraryUuid(null);
              }}
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: "12px",
                px: 1,
                py: 0.5,
                border:
                  dragOverLibraryUuid === library.uuid
                    ? "1px dashed var(--app-ink-muted)"
                    : "1px solid transparent",
                backgroundColor:
                  draggingLibraryUuid === library.uuid
                    ? "rgba(255, 255, 255, 0.04)"
                    : "transparent",
                transition: "all 0.2s ease",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  draggable
                  onDragStart={(event) => {
                    setDraggingLibraryUuid(library.uuid);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", library.uuid);
                  }}
                  onDragEnd={() => {
                    setDraggingLibraryUuid(null);
                    setDragOverLibraryUuid(null);
                  }}
                  sx={{
                    color: "var(--app-ink-muted)",
                    cursor: "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0.5,
                    borderRadius: "6px",
                    "&:active": {
                      cursor: "grabbing",
                    },
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                    },
                  }}
                >
                  <DragIndicatorRounded fontSize="small" />
                </Box>

                <Checkbox
                  checked={checked}
                  onChange={() => {
                    void setSetting(key, checked ? "false" : "true");
                  }}
                />

                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography>{library.title}</Typography>
                  <Typography
                    sx={{
                      color: "var(--app-ink-muted)",
                      fontSize: "0.9rem",
                      userSelect: "none",
                    }}
                  >
                    Type: {library.type.toUpperCase()}
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
export default SettingsLibraries;
