import { Stack, Checkbox, Typography, Box } from "@mui/material";
import React from "react";
import SettingHelpIcon from "./SettingHelpIcon";

function CheckBoxOption({
  title,
  subtitle,
  helpText,
  checked,
  onChange,
}: {
  title: string;
  subtitle?: string;
  helpText?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const explanation = helpText || subtitle;

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Checkbox
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <Typography>{title}</Typography>
        {explanation && (
          <SettingHelpIcon
            text={explanation}
            ariaLabel={`${title} explanation`}
          />
        )}
      </Stack>
      {subtitle && (
        <Typography sx={{
            color: "var(--app-ink-muted)",
            fontSize: "0.9rem",
            userSelect: "none",
            ml: "10px",
        }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default CheckBoxOption;
