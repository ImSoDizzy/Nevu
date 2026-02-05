import { Typography, Box } from "@mui/material";
import React from "react";

function SettingsRecommendations() {
  return (
    <>
      <Typography variant="h4">Experience - Recommendations</Typography>

      <Box
        sx={{
          mt: 2,
          width: "100%",
          height: "40px",
          backgroundColor: "var(--app-surface-3)",
          borderRadius: "14px",
          border: "1px solid var(--app-border)",
        }}
      />

      <Box sx={{ mt: 2, display: "flex", gap: 2, width: "50%" }}>
        WIP 
      </Box>
    </>
  );
}
export default SettingsRecommendations;
