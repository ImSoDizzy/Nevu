import {
  PlayArrowRounded,
  InfoOutlined,
  VolumeOffRounded,
  VolumeUpRounded,
  PauseRounded,
} from "@mui/icons-material";
import { Box, Typography, Button, IconButton } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePreviewPlayer } from "../states/PreviewPlayerState";
import ReactPlayer from "react-player";
import { useBigReader } from "./BigReader";
import { WatchListButton } from "./MovieItem";
import { getBackendURL } from "../backendURL";
import { queryBuilder } from "../plex/QuickFunctions";

function HeroDisplay({ item }: { item: Plex.Metadata }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { MetaScreenPlayerMuted, setMetaScreenPlayerMuted } =
    usePreviewPlayer();

  const previewVidURL = item?.Extras?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key
    ? `${getBackendURL()}/dynproxy${item?.Extras?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key.split("?")[0]}?${
        queryBuilder({
          "X-Plex-Token": localStorage.getItem("accessToken"),
          ...Object.fromEntries(new URL("http://localhost:3000" + item?.Extras?.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key).searchParams.entries()),
        })
      }`
    : null;

  const [previewVidPlaying, setPreviewVidPlaying] = useState<boolean>(false);

  useEffect(() => {
    setPreviewVidPlaying(false);

    if (!previewVidURL) return;

    const timeout = setTimeout(() => {
      if (window.scrollY > 100) return;
      if (searchParams.has("mid")) return;
      if (document.location.href.includes("mid=")) return;
      setPreviewVidPlaying(true);
    }, 3000);

    const onScroll = () => {
      if (window.scrollY > 100) setPreviewVidPlaying(false);
      else setPreviewVidPlaying(true);
    };

    window.addEventListener("scroll", onScroll);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <Box
      sx={{
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        pt: { xs: 1, md: 2 },
        px: "2.5vw",
      }}
    >
      <Box
        sx={{
          width: "100%",
          minHeight: { xs: "56vh", md: "66vh" },
          height: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          backgroundColor: "var(--app-surface)",
          zIndex: 0,
          position: "relative",
          margin: "0 auto",
          borderRadius: "var(--app-radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--app-border)",
          boxShadow: "var(--app-shadow)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            right: { xs: 12, md: 24 },
            bottom: { xs: 16, md: 24 },
            opacity: previewVidURL ? 1 : 0,
            transition: "all 1s ease",
            zIndex: 3,
            cursor: "pointer",
            pointerEvents: "all",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <IconButton
            sx={{
              backgroundColor: "var(--app-overlay)",
              border: "1px solid var(--app-border)",
            }}
            onClick={() => {
              setPreviewVidPlaying(!previewVidPlaying);
            }}
          >
            {previewVidPlaying ? <PauseRounded /> : <PlayArrowRounded />}
          </IconButton>

          <IconButton
            sx={{
              backgroundColor: "var(--app-overlay)",
              border: "1px solid var(--app-border)",
            }}
            onClick={() => {
              setMetaScreenPlayerMuted(!MetaScreenPlayerMuted);
            }}
          >
            {MetaScreenPlayerMuted ? <VolumeOffRounded /> : <VolumeUpRounded />}
          </IconButton>
        </Box>

        <Box
          sx={{
            position: "absolute",
            // make it take up the full width of the parent
            width: "100%",
            height: "100%",
            left: 0,
            top: 0,
            filter: "brightness(0.7) saturate(1.05)",
            opacity: previewVidPlaying ? 1 : 0,
            transition: "all 2s ease",
            backgroundColor: previewVidPlaying ? "rgba(0, 0, 0, 0.6)" : "transparent",
            pointerEvents: "none",

            overflow: "hidden",
            zIndex: 0,
          }}
        >
          <ReactPlayer
            url={previewVidURL ?? undefined}
            controls={false}
            width="100%"
            height="100%"
            playing={previewVidPlaying}
            volume={MetaScreenPlayerMuted ? 0 : 0.5}
            muted={MetaScreenPlayerMuted}
            onEnded={() => {
              setPreviewVidPlaying(false);
            }}
            pip={false}
            config={{
              file: {
                attributes: {
                  controlsList: "nodownload",
                  disablePictureInPicture: true,
                  disableRemotePlayback: true,
                  style: {
                    objectFit: "cover",
                    width: "100%",
                    height: "100%",
                    zIndex: -1,
                  }
                },
              },
            }}
          />
        </Box>
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: { xs: "48%", md: "52%" },
            backgroundImage:
              "linear-gradient(180deg, rgba(16, 17, 28, 0) 0%, rgba(16, 17, 28, 0.55) 45%, rgba(16, 17, 28, 0.95) 100%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <Box
          sx={{
            px: { xs: 3, md: 6 },
            pb: { xs: 5, md: 7 },
            pt: { xs: 6, md: 10 },
            zIndex: 1,
            maxWidth: { xs: "100%", md: "55%" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              mb: 0,
            }}
          >
            {/* <img
              src="/plexIcon.png"
              alt=""
              height="35"
              style={{
                aspectRatio: 1,
                borderRadius: 8,
              }}
            /> */}
            <Typography
              sx={{
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.38em",
                color: "var(--app-ink-muted)",
                textTransform: "uppercase",
              }}
            >
              {item.type}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: { xs: "2.2rem", md: "3.5rem" },
              fontWeight: 700,
              lineHeight: 1.05,
              textShadow: "0 12px 30px rgba(5, 2, 1, 0.6)",
            }}
          >
            {item.title}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "0.95rem", md: "1.05rem" },
              fontWeight: 400,
              color: "var(--app-ink-muted)",
              maxWidth: { xs: "100%", md: "32vw" },

              // make the text max 4 lines long and add ellipsis
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",

              userSelect: "none",
              cursor: "zoom-in",
            }}
            onClick={() => {
              useBigReader.getState().setBigReader(item.summary);
            }}
          >
            {item.summary}
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-start",
              mt: { xs: 3, md: 4 },
              gap: 1.5,
              ml: 0,
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="contained"
              sx={{
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "none",
                gap: 1,
                px: 3,
              }}
              onClick={() => {
                if (!item) return;
                navigate(`/watch/${item.ratingKey}`);
              }}
            >
              <PlayArrowRounded fontSize="medium" /> Play
            </Button>

            <Button
              variant="outlined"
              sx={{
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "none",
                borderColor: "rgba(255, 255, 255, 0.2)",
                color: "var(--app-ink)",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                  borderColor: "rgba(255, 255, 255, 0.35)",
                  "& > *:nth-child(2)": {
                    width: "91px",
                    ml: "10px",
                  },
                },
                transition: "all 0.2s ease-in-out",
              }}
              onClick={() => {
                if (!item) return;
                setPreviewVidPlaying(false);
                setSearchParams({
                  ...searchParams,
                  mid: item.ratingKey.toString(),
                });
              }}
            >
              <InfoOutlined fontSize="medium" />{" "}
                <Typography
                  sx={{
                    width: "0px",
                    userSelect: "none",
                    display: "inline",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    transition: "all 0.2s ease-in-out",

                    fontSize: "0.9rem",
                    lineHeight: "1.75",
                    color: "var(--app-ink)",
                  }}
                >
                More Info
              </Typography>
            </Button>

            <WatchListButton item={item} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default HeroDisplay;
