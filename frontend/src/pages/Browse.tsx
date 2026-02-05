import React from "react";
import { Box } from "@mui/material";
import { AnimatePresence } from "framer-motion";
import BrowseRecommendations from "./browse/BrowseRecommendations";
import BrowseLibrary from "./browse/BrowseLibrary";
import { useBrowsePageOptions } from "../states/BrowsePageOptions";

function Library() {
  const { page } = useBrowsePageOptions();

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
        <AnimatePresence mode="wait">
          {page === "recommendations" && <BrowseRecommendations />}
          {page === "browse" && <BrowseLibrary />}
        </AnimatePresence>
      </Box>
    </Box>
  );
}

export default Library;
