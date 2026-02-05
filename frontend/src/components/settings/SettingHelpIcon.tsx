import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import { IconButton, Tooltip } from "@mui/material";
import React from "react";

function SettingHelpIcon({
  text,
  ariaLabel,
}: {
  text: string;
  ariaLabel?: string;
}) {
  return (
    <Tooltip title={text} arrow placement="top">
      <IconButton
        aria-label={ariaLabel || "Setting explanation"}
        size="small"
        disableRipple
        disableTouchRipple
        sx={{
          color: "var(--app-ink-muted)",
          width: "auto",
          height: "auto",
          p: 0,
          ml: 0.25,
          border: "none",
          borderRadius: "999px",
          backgroundColor: "transparent",
          transition: "color 0.2s ease",
          "&:hover": {
            backgroundColor: "transparent",
            transform: "none",
          },
          "&:active": {
            transform: "none",
          },
          "&:focus-visible": {
            backgroundColor: "transparent",
          },
        }}
      >
        <HelpOutlineRounded sx={{ fontSize: "0.95rem" }} />
      </IconButton>
    </Tooltip>
  );
}

export default SettingHelpIcon;
