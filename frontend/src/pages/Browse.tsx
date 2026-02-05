import React from "react";
import { Box, Button, ButtonGroup } from "@mui/material";
import { create } from "zustand";
import { AnimatePresence } from "framer-motion";
import BrowseRecommendations from "./browse/BrowseRecommendations";
import BrowseLibrary from "./browse/BrowseLibrary";

type BrowsePages = "recommendations" | "browse";

interface BrowsePageOptionsState {
  page: BrowsePages;
  setPage: (page: BrowsePages) => void;
}

const useBrowsePageOptions = create<BrowsePageOptionsState>((set) => ({
  page:
    (localStorage.getItem("browsePage") as BrowsePages) || "recommendations",
  setPage: (page: BrowsePages) => {
    localStorage.setItem("browsePage", page);
    set({ page });
  },
}));

function Library() {
  const { page, setPage } = useBrowsePageOptions();

  return (
    <Box
      className="app-page"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        width: "100%",
        position: "relative",
        gap: { xs: 6, md: 8 },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background:
            "radial-gradient(circle at 18% 0%, rgba(80, 70, 225, 0.18), transparent 45%), radial-gradient(circle at 82% 8%, rgba(122, 112, 255, 0.14), transparent 45%)",
        }}
      />
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: { xs: 6, md: 8 },
        }}
      >
        <ButtonGroup
          variant="outlined"
          sx={{
            zIndex: 5,
            mb: 2,
            right: { xs: 0, md: 0 },
            top: { xs: 16, md: 16 },
            position: "absolute",
            opacity: 0.9,
            filter: "brightness(0.9)",

            "&:hover": {
              opacity: 1,
              filter: "brightness(1)",
              transition: "all 0.4s ease",
            },
            transition: "all 1s ease",
          }}
        >
          <Button
            variant={page === "recommendations" ? "contained" : "outlined"}
            sx={{
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "none",
              gap: "8px",
              px: 2.5,
              transition: "all 0.2s ease-in-out",
            }}
            onClick={() => setPage("recommendations")}
          >
            Recommendations
          </Button>
          <Button
            variant={page === "browse" ? "contained" : "outlined"}
            sx={{
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "none",
              gap: "8px",
              px: 2.5,
              transition: "all 0.2s ease-in-out",
            }}
            onClick={() => setPage("browse")}
          >
            Browse
          </Button>
        </ButtonGroup>

        <AnimatePresence mode="wait">
          {page === "recommendations" && <BrowseRecommendations />}
          {page === "browse" && <BrowseLibrary />}
        </AnimatePresence>
      </Box>
    </Box>
  );
}

export default Library;
