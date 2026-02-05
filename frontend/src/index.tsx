import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@emotion/react";
import { CssBaseline } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import { makeid, uuidv4 } from "./plex/QuickFunctions";
import { getDeviceName, getPlatform, platformCache } from "./common/DesktopApp";

import "@fontsource-variable/rubik";
import "@fontsource/ibm-plex-sans";
import theme from "./theme";

if (!localStorage.getItem("clientID"))
  localStorage.setItem("clientID", makeid(24));

sessionStorage.setItem("sessionID", uuidv4());

let config: PerPlexed.ConfigOptions = {
  DISABLE_PROXY: false, // DEPRECATED
  DISABLE_NEVU_SYNC: false,
};

(() => {
  if (!localStorage.getItem("config")) return;
  config = JSON.parse(
    localStorage.getItem("config") as string
  ) as PerPlexed.ConfigOptions;
})();

if (!localStorage.getItem("quality")) localStorage.setItem("quality", "12000");

export { config };

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

getPlatform().then(async (platformData) => {
  if (!platformData) return;

  // make platformData.platform lowercase but capitalize the first letter
  platformData.platform =
    platformData.platform.charAt(0).toUpperCase() +
    platformData.platform.slice(1).toLowerCase();

  switch (platformData.platform) {
    case "Win32":
      platformData.platform = "Windows";
      break;
  }

  platformCache.platform = platformData;

  const deviceName = await getDeviceName();
  platformCache.deviceName = deviceName;

  if (platformCache.platform) {
    console.log("Platform detected:", platformCache.platform);
    platformCache.isDesktop = true;
  } else console.warn("Platform detection failed.");
});

root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>
);
