import { Box, CircularProgress, Typography } from "@mui/material";
import React from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import SettingsInfo from "./settings/SettingsInfo";
import SettingsPlayback from "./settings/SettingsPlayback";
import { useUserSettings } from "../states/UserSettingsState";
import SettingsRecommendations from "./settings/SettingsRecommendations";
import SettingsLibraries from "./settings/SettingsLibraries";

function Settings() {
  const { loaded } = useUserSettings();

  if (!loaded)
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          width: "100vw",
        }}
      >
        <CircularProgress />
      </Box>
    );

  return (
    <Box
      className="app-page"
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        minHeight: "100vh",
        overflow: "auto",
        gap: 3,
      }}
    >
      <Box
        sx={{
          width: "280px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--app-surface)",
          padding: "14px",
          borderRadius: "18px",
          border: "1px solid var(--app-border)",
          boxShadow: "0 18px 35px rgba(8, 4, 2, 0.35)",
        }}
      >
        <SettingsDivider title="General" />
        <SettingsItem title="About" link="/settings/info" />
        <SettingsDivider title="Experience" />
        <SettingsItem title="Playback" link="/settings/experience-playback" />
        <SettingsItem title="Recommendations" link="/settings/experience-recommendations" />
        <SettingsItem title="Libraries" link="/settings/experience-libraries" />
      </Box>

      <Box
        sx={{
          width: "min(720px, 100%)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          backgroundColor: "var(--app-surface-2)",
          padding: "24px",
          borderRadius: "18px",
          border: "1px solid var(--app-border)",
          boxShadow: "0 18px 35px rgba(8, 4, 2, 0.35)",
          ml: "auto",
          mr: "auto",
        }}
      >
        <Routes>
          <Route path="/info" element={<SettingsInfo />} />

          <Route path="/experience-playback" element={<SettingsPlayback />} />
          <Route path="/experience-recommendations" element={<SettingsRecommendations />} />
          <Route path="/experience-libraries" element={<SettingsLibraries />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default Settings;

function SettingsDivider({ title }: { title: string }) {
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        padding: "5px",
        borderRadius: "10px",
      }}
    >
      <Typography
        sx={{
          color: "var(--app-ink-muted)",
          fontSize: "0.95rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          userSelect: "none",
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}

function SettingsItem({ title, link }: { title: string; link: string }) {
  const { pathname } = useLocation();

  return (
    <Link to={link}>
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          padding: "5px",
          borderRadius: "10px",
          pl: "18px",

          transition: "all 0.3s ease",

          "&:hover": {
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          },
        }}
      >
        <Typography
          sx={{
            color: theme => pathname === link ? theme.palette.primary.main : theme.palette.text.primary,
            fontSize: "1rem",
            userSelect: "none",
          }}
        >
          {title}
        </Typography>
      </Box>
    </Link>
  );
}
