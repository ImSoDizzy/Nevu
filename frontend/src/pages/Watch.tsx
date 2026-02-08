import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getLibraryDir,
  getLibraryMeta,
  getPlayQueue,
  getServerPreferences,
  getStreamProps,
  getTimelineUpdate,
  getTranscodeImageURL,
  getUniversalDecision,
  putAudioStream,
  putSubtitleStream,
  sendUniversalPing,
} from "../plex";
import CenteredSpinner from "../components/CenteredSpinner";
import {
  alpha,
  Backdrop,
  Box,
  Button,
  Fade,
  IconButton,
  Paper,
  Popover,
  Popper,
  Slider,
  Theme,
  Typography,
  useTheme,
} from "@mui/material";
import ReactPlayer from "react-player";
import {
  getIncludeProps,
  getXPlexProps,
  queryBuilder,
  uuidv4,
} from "../plex/QuickFunctions";
import {
  ArrowBackIosNewRounded,
  ArrowBackIosRounded,
  CheckRounded,
  FullscreenRounded,
  PauseRounded,
  PeopleRounded,
  PlayArrowRounded,
  SkipNext,
  SkipNextRounded,
  TuneRounded,
  VolumeUpRounded,
} from "@mui/icons-material";
import { VideoSeekSlider } from "react-video-seek-slider";
import "react-video-seek-slider/styles.css";
import { useSessionStore } from "../states/SessionState";
import { durationToText } from "../components/MovieItemSlider";
import { useSyncSessionState } from "../states/SyncSessionState";
import { useSyncInterfaceState } from "../components/PerPlexedSync";
import { absoluteDifference } from "../common/NumberExtra";
import WatchShowChildView from "../components/WatchShowChildView";
import { useUserSettings } from "../states/UserSettingsState";
import PlaybackNextEPButton from "../components/PlaybackNextEPButton";
import { getBackendURL } from "../backendURL";
import { platformCache } from "../common/DesktopApp";

let SessionID = "";
export { SessionID };

const getUrl = (
  data: Plex.Metadata,
  quality: { bitrate?: number; auto?: boolean }
) => {
  console.log("Metadata:", data);
  const bitrate = quality
    ? quality.bitrate
    : parseInt(localStorage.getItem("quality") ?? "10000");
  if (bitrate === -1)
    return `${getBackendURL()}/dynproxy${
      data?.Media?.[0].Part[0].key
    }?${queryBuilder({
      ...getXPlexProps(),
    })}`;

  return `${getBackendURL()}/dynproxy/video/:/transcode/universal/start.${
    platformCache.isDesktop ? "m3u8" : "mpd"
  }?${queryBuilder({
    ...getStreamProps(data.ratingKey as string, {
      ...(quality.bitrate && {
        maxVideoBitrate: bitrate,
      }),
    }),
  })}`;
};

function Watch() {
  const { itemID } = useParams<{ itemID: string }>();
  const [params] = useSearchParams();
  const theme = useTheme();
  const navigate = useNavigate();

  const { sessionID, generateSessionID } = useSessionStore();
  const { settings } = useUserSettings();

  const [metadata, setMetadata] = useState<Plex.Metadata | null>(null);
  const [showmetadata, setShowMetadata] = useState<Plex.Metadata | null>(null);
  const [playQueue, setPlayQueue] = useState<Plex.Metadata[] | null>(null); // [current, ...next]
  const player = useRef<ReactPlayer | null>(null);
  const [quality, setQuality] = useState<{
    bitrate?: number;
    auto?: boolean;
  }>({
    ...(localStorage.getItem("quality") && {
      bitrate: parseInt(localStorage.getItem("quality") ?? "10000"),
    }),
  });

  const [volume, setVolume] = useState<number>(
    parseInt(localStorage.getItem("volume") ?? "100")
  );

  const lastAppliedTime = useRef<number>(0);

  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  const [ready, setReady] = useState(false);
  const seekToAfterLoad = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const lastProgressValueRef = useRef(0);
  const recoveryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryWindowStartedAtRef = useRef(0);
  const recoveryAttemptCountRef = useRef(0);
  const recoveryInFlightRef = useRef(false);
  const lastHandledPlaybackVersionRef = useRef("");
  const lastAnnouncedPlaybackRef = useRef("");
  const metadataLoadVersionRef = useRef(0);
  const currentItemIDRef = useRef(itemID);

  const [volumePopoverAnchor, setVolumePopoverAnchor] =
    useState<HTMLButtonElement | null>(null);
  const volumePopoverOpen = Boolean(volumePopoverAnchor);

  const [showTune, setShowTune] = useState(false);
  const [tunePage, setTunePage] = useState<number>(0); // 0: menu, 1: video, 2: audio, 3: subtitles
  const tuneButtonRef = useRef<HTMLButtonElement | null>(null);

  const playbackBarRef = useRef<HTMLDivElement | null>(null);

  const [buffering, setBuffering] = useState(false);
  const [showError, setShowError] = useState<string | false>(false);
  const [playerInstanceKey, setPlayerInstanceKey] = useState(0);

  const {
    room,
    isHost,
    playback: watchTogetherPlayback,
    playbackSeq,
    requestState: requestWatchTogetherState,
    sendControl: sendWatchTogetherControl,
    disconnect: disconnectWatchTogether,
  } = useSyncSessionState();
  const { setOpen: setSyncInterfaceOpen } = useSyncInterfaceState();

  const [controlElementsVisible, setControlElementsVisible] = useState(false);

  useEffect(() => {
    currentItemIDRef.current = itemID;
  }, [itemID]);

  useEffect(() => {
    setControlElementsVisible(volumePopoverOpen || showTune);
  }, [volumePopoverOpen, showTune]);

  const resetPlexPlaybackSession = () => {
    generateSessionID();
    sessionStorage.setItem("sessionID", uuidv4());
  };

  const reportStoppedTimeline = () => {
    if (!itemID || !player.current) return;

    const durationMs = Math.floor((player.current.getDuration() ?? 0) * 1000);
    const timeMs = Math.floor((player.current.getCurrentTime() ?? 0) * 1000);
    if (Number.isNaN(durationMs) || Number.isNaN(timeMs)) return;

    void getTimelineUpdate(parseInt(itemID, 10), durationMs, "stopped", timeMs).catch(
      (err) => {
        console.warn("Failed to report stopped timeline before restart", err);
      }
    );
  };

  const isPausedTooLongPlexError = (
    terminationCode?: number | string | null,
    rawMessage?: string | null
  ) => {
    const message = rawMessage ?? "";
    const hasCode2008 =
      Number(terminationCode) === 2008 || /\b2008\b/.test(message);
    const hasPausedTooLongText = /paused for too long/i.test(message);
    return hasCode2008 || hasPausedTooLongText;
  };

  const sendWatchTogetherPlaybackControl = (
    actionType: PerPlexed.WatchTogether.ControlActionType,
    options?: {
      mediaKey?: string;
      positionSeconds?: number;
      state?: PerPlexed.WatchTogether.PlaybackMode;
    }
  ) => {
    if (!room) return false;

    const mediaKey = options?.mediaKey ?? itemID ?? undefined;
    const positionMs =
      typeof options?.positionSeconds === "number"
        ? Math.max(0, Math.floor(options.positionSeconds * 1000))
        : undefined;

    return sendWatchTogetherControl({
      actionType,
      mediaKey,
      positionMs,
      state: options?.state,
    });
  };

  const queueAutomaticRecovery = (
    source: "timeline" | "player",
    terminationCode?: number | string | null,
    rawMessage?: string | null
  ) => {
    if (!room) return false;

    const now = Date.now();
    if (
      recoveryWindowStartedAtRef.current === 0 ||
      now - recoveryWindowStartedAtRef.current > 60000
    ) {
      recoveryWindowStartedAtRef.current = now;
      recoveryAttemptCountRef.current = 0;
    }

    if (recoveryAttemptCountRef.current >= 3) {
      console.warn(
        `Watch Together recovery exhausted after ${recoveryAttemptCountRef.current} attempts`
      );

      if (isHost) {
        sendWatchTogetherPlaybackControl("end");
      }

      navigate("/sync/waitingroom");
      return true;
    }

    if (recoveryInFlightRef.current) {
      console.warn(`Recovery already in progress for ${source}`);
      return true;
    }

    recoveryAttemptCountRef.current += 1;
    recoveryInFlightRef.current = true;

    const isPausedTooLong = isPausedTooLongPlexError(
      terminationCode,
      rawMessage
    );
    if (isPausedTooLong) {
      console.warn(`Paused-too-long error detected from ${source}; auto-recovering`);
    }

    const delayMs = Math.min(
      4000,
      1000 * Math.pow(2, recoveryAttemptCountRef.current - 1)
    );

    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => {
      const resumeTime =
        player.current?.getCurrentTime() ?? lastProgressValueRef.current;

      console.warn(
        `Attempting Watch Together recovery from ${source} (attempt ${recoveryAttemptCountRef.current})`
      );
      restartPlayback(resumeTime > 0 ? resumeTime : undefined);
      recoveryInFlightRef.current = false;
    }, delayMs);

    return true;
  };

  const restartPlayback = (resumeTimeSeconds?: number) => {
    if (!metadata) return;

    const resumeTime = resumeTimeSeconds ?? player.current?.getCurrentTime() ?? 0;
    if (resumeTime > 0) {
      seekToAfterLoad.current = resumeTime;
      lastAppliedTime.current = Math.floor(resumeTime * 1000);
    }

    reportStoppedTimeline();
    resetPlexPlaybackSession();

    setReady(false);
    setBuffering(true);
    setPlaying(true);
    setShowError(false);
    setURL(getUrl(metadata, quality));
    setPlayerInstanceKey((prev) => prev + 1);
    lastProgressValueRef.current = resumeTime;

    if (room && itemID && isHost) {
      sendWatchTogetherPlaybackControl("setMedia", {
        mediaKey: itemID,
        positionSeconds: resumeTime,
        state: "playing",
      });
    }
  };

  const syncPlay = (positionSeconds?: number) => {
    sendWatchTogetherPlaybackControl("play", {
      positionSeconds:
        positionSeconds ?? player.current?.getCurrentTime() ?? undefined,
    });
  };

  const syncPause = (positionSeconds?: number) => {
    sendWatchTogetherPlaybackControl("pause", {
      positionSeconds:
        positionSeconds ?? player.current?.getCurrentTime() ?? undefined,
    });
  };

  const syncSeek = (positionSeconds: number) => {
    sendWatchTogetherPlaybackControl("seek", {
      positionSeconds,
    });
  };

  const syncEndPlayback = () => {
    sendWatchTogetherPlaybackControl("end");
  };

  const syncSetMedia = (
    mediaKey: string,
    options?: {
      positionSeconds?: number;
      state?: PerPlexed.WatchTogether.PlaybackMode;
    }
  ) => {
    const positionSeconds = options?.positionSeconds ?? 0;
    const state =
      options?.state ??
      watchTogetherPlayback?.state ??
      (playing ? "playing" : "paused");

    if (room) {
      const sent = sendWatchTogetherPlaybackControl("setMedia", {
        mediaKey,
        positionSeconds,
        state,
      });

      if (!sent) requestWatchTogetherState();
      return sent;
    }

    navigate(
      `/watch/${mediaKey}?tms=${Math.max(0, Math.floor(positionSeconds * 1000))}`
    );
    return true;
  };

  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  const loadMetadata = async (
    targetItemID: string,
    isStale: () => boolean = () => currentItemIDRef.current !== targetItemID
  ) => {
    try {
      await getUniversalDecision(targetItemID, {
        maxVideoBitrate: quality.bitrate,
        autoAdjustQuality: quality.auto,
      });
      if (isStale()) return null;

      const mediaContainer = await getLibraryDir(`/library/metadata/${targetItemID}`, {
        ...getIncludeProps(),
      });
      if (isStale()) return null;

      const metadata = mediaContainer.Metadata?.[0] ?? null;
      if (!metadata) return null;

      if (["movie", "episode"].includes(metadata.type as string)) {
        setMetadata(metadata);
        if (metadata.type === "episode") {
          const show = await getLibraryMeta(metadata.grandparentRatingKey as string);
          if (isStale()) return metadata;
          setShowMetadata(show);
        } else {
          setShowMetadata(null);
        }
      } else {
        console.error("Invalid metadata type");
        return null;
      }

      if (isStale()) return metadata;
      const serverPreferences = await getServerPreferences();
      if (isStale()) return metadata;

      const queue = await getPlayQueue(
        `server://${
          serverPreferences.machineIdentifier
        }/com.plexapp.plugins.library/library/metadata/${
          metadata.ratingKey
        }`
      );
      if (isStale()) return metadata;

      setPlayQueue(queue);
      return metadata;
    } catch (error) {
      if (!isStale()) {
        console.error("Failed to load metadata", error);
      }
      return null;
    }
  };

  const [url, setURL] = useState<string>("");

  const [showControls, setShowControls] = useState(true);
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let whenMouseMoves = () => {
      clearTimeout(timeout);
      setShowControls(true);
      timeout = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    };

    document.addEventListener("mousemove", whenMouseMoves);
    return () => {
      document.removeEventListener("mousemove", whenMouseMoves);
      clearTimeout(timeout);
    };
  }, [playing]);

  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => {
    let showInfoTimer: ReturnType<typeof setTimeout> | null = null;
    playingRef.current = playing;

    if (!playingRef.current) {
      showInfoTimer = setTimeout(() => {
        if (!playingRef.current) setShowInfo(true);
      }, 5000);
    } else {
      setShowInfo(false);
    }

    return () => {
      if (showInfoTimer) clearTimeout(showInfoTimer);
    };
  }, [playing]);

  useEffect(() => {
    if (!playing) return;

    if (showControls) document.body.style.cursor = "default";
    else document.body.style.cursor = "none";

    return () => {
      document.body.style.cursor = "default";
    };
  }, [playing, showControls]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!itemID) return;
      await sendUniversalPing();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [itemID]);

  useEffect(() => {
    if (!room) {
      lastHandledPlaybackVersionRef.current = "";
      lastAnnouncedPlaybackRef.current = "";
      return;
    }

    requestWatchTogetherState();
    const interval = setInterval(() => {
      requestWatchTogetherState();
    }, 5000);

    const onVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        requestWatchTogetherState();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityRefresh);
    window.addEventListener("focus", onVisibilityRefresh);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityRefresh);
      window.removeEventListener("focus", onVisibilityRefresh);
    };
  }, [requestWatchTogetherState, room, itemID]);

  useEffect(() => {
    if (!room || !itemID || !ready || !isHost) return;

    const playbackIdentity = `${itemID}:${playerInstanceKey}`;
    if (lastAnnouncedPlaybackRef.current === playbackIdentity) return;
    lastAnnouncedPlaybackRef.current = playbackIdentity;

    sendWatchTogetherPlaybackControl("setMedia", {
      mediaKey: itemID,
      positionSeconds: player.current?.getCurrentTime() ?? 0,
      state: playing ? "playing" : "paused",
    });
  }, [isHost, itemID, playerInstanceKey, playing, ready, room]);

  useEffect(() => {
    if (!room || !watchTogetherPlayback) return;
    const playbackVersion = `${room}:${playbackSeq}:${watchTogetherPlayback.updatedAtMs}:${watchTogetherPlayback.key ?? "none"}:${watchTogetherPlayback.state}`;
    if (playbackVersion === lastHandledPlaybackVersionRef.current) return;

    lastHandledPlaybackVersionRef.current = playbackVersion;

    if (!watchTogetherPlayback.key) {
      if (!isHost) navigate("/sync/waitingroom");
      return;
    }

    if (watchTogetherPlayback.key !== itemID) {
      navigate(
        `/watch/${watchTogetherPlayback.key}?tms=${Math.floor(
          watchTogetherPlayback.positionMs
        )}`,
        { replace: true }
      );
      return;
    }

    const targetSecondsRaw = watchTogetherPlayback.positionMs / 1000;
    const durationSeconds = player.current?.getDuration() ?? 0;
    const targetSeconds =
      durationSeconds > 0
        ? Math.min(targetSecondsRaw, Math.max(0, durationSeconds - 0.25))
        : targetSecondsRaw;
    const currentSeconds = player.current?.getCurrentTime() ?? 0;
    const drift = absoluteDifference(currentSeconds, targetSeconds);
    const maxDriftSeconds =
      watchTogetherPlayback.state === "paused" ? 0.35 : 1.5;
    if (drift > maxDriftSeconds) {
      player.current?.seekTo(targetSeconds, "seconds");
    }

    setPlaying(watchTogetherPlayback.state === "playing");
  }, [
    itemID,
    navigate,
    playbackSeq,
    room,
    watchTogetherPlayback,
    isHost,
  ]);

  useEffect(() => {
    if (!itemID) return;

    const updateTimeline = async () => {
      if (!player.current) return;
      const timelineState =
        room && watchTogetherPlayback?.state
          ? watchTogetherPlayback.state
          : playing
            ? "playing"
            : "paused";
      const timelineUpdateData = await getTimelineUpdate(
        parseInt(itemID),
        Math.floor(player.current.getDuration()) * 1000,
        timelineState,
        Math.floor(player.current.getCurrentTime()) * 1000
      );

      if (!timelineUpdateData) return;

      const { terminationCode, terminationText } =
        timelineUpdateData.MediaContainer;
      if (terminationCode) {
        if (queueAutomaticRecovery("timeline", terminationCode, terminationText))
          return;
        if (showError) return;

        setShowError(`${terminationCode} - ${terminationText}`);
        setPlaying(false);
      }
    };

    const updateInterval = setInterval(updateTimeline, 5000);

    return () => clearInterval(updateInterval);
  }, [itemID, playing, room, showError, watchTogetherPlayback?.state]);

  useEffect(() => {
    // set css style for .ui-video-seek-slider .track .main .connect
    const style = document.createElement("style");
    style.innerHTML = `
      .ui-video-seek-slider .track .main .connect {
        background-color: ${theme.palette.primary.main};
      }
      .ui-video-seek-slider .thumb .handler {
        background-color: ${theme.palette.primary.main};
      }
    `;
    document.head.appendChild(style);
    metadataLoadVersionRef.current += 1;
    const loadVersion = metadataLoadVersionRef.current;
    const isStaleLoad = () => loadVersion !== metadataLoadVersionRef.current;

    (async () => {
      try {
        setReady(false);

        if (!itemID) return;
        resetPlexPlaybackSession();

        const metadata = await getLibraryMeta(itemID);
        if (isStaleLoad()) return;

        const autoMatchTracks =
          useUserSettings.getState().settings["AUTO_MATCH_TRACKS"] === "true";

        const audioTrackPref =
          useUserSettings.getState().settings[
            `MEDIA_PREF_AUDIO-${metadata.grandparentRatingKey}`
          ];
        const subtitleTrackPref =
          useUserSettings.getState().settings[
            `MEDIA_PREF_SUBTITLE-${metadata.grandparentRatingKey}`
          ];

        // Match audio track and subtitle track with the preferences
        if (audioTrackPref && autoMatchTracks) {
          const audioTrackPrefParsed: {
            index: number;
            title: string;
          } = JSON.parse(audioTrackPref);

          console.log(
            `Preferred Audio Track - Index: ${audioTrackPrefParsed.index}, Title: ${audioTrackPrefParsed.title}`
          );

          const audioTrackCandidates =
            metadata.Media?.[0].Part[0].Stream.sort((a, b) => {
              return (
                Math.abs(a.index - audioTrackPrefParsed.index) -
                Math.abs(b.index - audioTrackPrefParsed.index)
              );
            }) ?? [];
          const resolvedAudioTrack = audioTrackCandidates.find((stream) => {
            return (
              stream.streamType === 2 &&
              stream.extendedDisplayTitle === audioTrackPrefParsed.title
            );
          });

          if (resolvedAudioTrack) {
            console.log(
              `Selected Audio Track - Index: ${resolvedAudioTrack.index}, Title: ${resolvedAudioTrack.extendedDisplayTitle}`
            );
            await putAudioStream(
              metadata.Media?.[0].Part[0].id ?? 0,
              resolvedAudioTrack.id
            );
            if (isStaleLoad()) return;
          }
        }

        if (subtitleTrackPref && autoMatchTracks) {
          const subtitleTrackPrefParsed: {
            index: number;
            title: string;
          } = JSON.parse(subtitleTrackPref);

          console.log(
            `Preferred Subtitle Track - Index: ${subtitleTrackPrefParsed.index}, Title: ${subtitleTrackPrefParsed.title}`
          );

          if (subtitleTrackPrefParsed.index === -1) {
            await putSubtitleStream(metadata.Media?.[0].Part[0].id ?? 0, 0);
            if (isStaleLoad()) return;
          } else {
            const subtitleTrack = metadata.Media?.[0].Part[0].Stream.sort(
              (a, b) => {
                return (
                  Math.abs(a.index - subtitleTrackPrefParsed.index) -
                  Math.abs(b.index - subtitleTrackPrefParsed.index)
                );
              }
            ).find((stream) => {
              return (
                stream.streamType === 3 &&
                stream.extendedDisplayTitle === subtitleTrackPrefParsed.title
              );
            });

            if (subtitleTrack) {
              console.log(
                `Selected Subtitle Track - Index: ${subtitleTrack.index}, Title: ${subtitleTrack.extendedDisplayTitle}`
              );
              await putSubtitleStream(
                metadata.Media?.[0].Part[0].id ?? 0,
                subtitleTrack.id
              );
              if (isStaleLoad()) return;
            }
          }
        }

        console.log(`Setting URL: ${getUrl(metadata, quality)}`);

        await loadMetadata(itemID, isStaleLoad);
        if (isStaleLoad()) return;
        setURL(getUrl(metadata, quality));
        setShowError(false);
      } catch (error) {
        if (isStaleLoad()) return;
        console.error("Failed to initialize watch playback", error);
        setShowError("Failed to load media");
        setPlaying(false);
      }
    })();
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
      if (metadataLoadVersionRef.current === loadVersion) {
        metadataLoadVersionRef.current += 1;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemID, theme.palette.primary.main]);

  useEffect(() => {
    SessionID = sessionID;
  }, [sessionID]);

  useEffect(() => {
    if (!player.current) return;

    if (ready && !playing) setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // playback controll buttons
  // SPACE: play/pause
  // LEFT: seek back 10 seconds
  // RIGHT: seek forward 10 seconds
  // UP: increase volume
  // DOWN: decrease volume
  // , (comma): Back 1 frame
  // . (period): Forward 1 frame
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const actions: { [key: string]: () => void } = {
        " ": () =>
          setPlaying((state) => {
            const currentTime = player.current?.getCurrentTime() ?? 0;
            if (state) syncPause(currentTime);
            else syncPlay(currentTime);
            return !state;
          }),
        k: () =>
          setPlaying((state) => {
            const currentTime = player.current?.getCurrentTime() ?? 0;
            if (state) syncPause(currentTime);
            else syncPlay(currentTime);
            return !state;
          }),
        j: () => {
          const l = player.current?.getCurrentTime() ?? 0;
          player.current?.seekTo(l - 10);
          syncSeek(l - 10);
        },
        l: () => {
          const l = player.current?.getCurrentTime() ?? 0;
          player.current?.seekTo(l + 10);
          syncSeek(l + 10);
        },
        s: () => {
          if (!metadata || !player.current) return;
          // if there is a marker like credits skip it
          const time = player.current.getCurrentTime();
          for (const marker of metadata.Marker ?? []) {
            if (
              !(
                marker.startTimeOffset / 1000 <= time &&
                marker.endTimeOffset / 1000 >= time
              )
            )
              continue;

            switch (marker.type) {
              case "credits":
                {
                  if (!marker.final) {
                    const target = marker.endTimeOffset / 1000 + 1;
                    player.current.seekTo(target);
                    syncSeek(target);
                    return;
                  }

                  if (metadata.type === "movie") {
                    if (room) {
                      syncEndPlayback();
                      return;
                    }

                    return navigate(
                      `/browse/${metadata.librarySectionID}?${queryBuilder({
                        mid: metadata.ratingKey,
                      })}`
                    );
                  }

                  if (!playQueue) return;
                  const next = playQueue[1];
                  if (!next) {
                    if (room) {
                      syncEndPlayback();
                      return;
                    }

                    return navigate(
                      `/browse/${metadata.librarySectionID}?${queryBuilder({
                        mid: metadata.grandparentRatingKey,
                        pid: metadata.parentRatingKey,
                        iid: metadata.ratingKey,
                      })}`
                    );
                  }

                  syncSetMedia(next.ratingKey, {
                    positionSeconds: 0,
                    state: "playing",
                  });
                }
                break;
              case "intro":
                {
                  const target = marker.endTimeOffset / 1000 + 1;
                  player.current.seekTo(target);
                  syncSeek(target);
                }
                break;
            }
          }
        },
        f: () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
          } else document.exitFullscreen();
        },
        ArrowLeft: () => {
          const l = player.current?.getCurrentTime() ?? 0;
          player.current?.seekTo(l - 10);
          syncSeek(l - 10);
        },
        ArrowRight: () => {
          const l = player.current?.getCurrentTime() ?? 0;
          player.current?.seekTo(l + 10);
          syncSeek(l + 10);
        },
        ArrowUp: () => setVolume((state) => Math.min(state + 5, 100)),
        ArrowDown: () => setVolume((state) => Math.max(state - 5, 0)),
        ",": () => {
          const l = player.current?.getCurrentTime() ?? 0;
          player.current?.seekTo(l - 0.04);
          syncSeek(l - 0.04);
        },
        ".": () => {
          const l = player.current?.getCurrentTime() ?? 0;
          player.current?.seekTo(l + 0.04);
          syncSeek(l + 0.04);
        },
      };

      if (actions[e.key]) actions[e.key]();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [metadata, navigate, playQueue, room]);

  return (
    <>
      <Backdrop
        open={showError !== false}
        sx={{
          zIndex: 10000,
          backdropFilter: "blur(8px)",
        }}
      >
        <Paper
          elevation={10}
          sx={{
            p: 4,
            background: "var(--app-surface)",
            color: theme.palette.text.primary,
            borderRadius: 2,
            maxWidth: "500px",
            width: "90%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ mb: 3, textAlign: "center" }}>
            {showError}
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              gap: 2,
              width: "100%",
              justifyContent: "center",
            }}
          >
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => {
                setShowError(false);
                if (!metadata) return navigate("/");

                if (metadata.type === "movie")
                  navigate(
                    `/browse/${metadata.librarySectionID}?${queryBuilder({
                      mid: metadata.ratingKey,
                    })}`
                  );

                if (metadata.type === "episode")
                  navigate(
                    `/browse/${metadata.librarySectionID}?${queryBuilder({
                      mid: metadata.grandparentRatingKey,
                    })}`
                  );
              }}
            >
              Home
            </Button>
            <Button
              variant="text"
              onClick={() => {
                setShowError(false);
              }}
            >
              Ignore
            </Button>
          </Box>
        </Paper>
      </Backdrop>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          width: "100%",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: buffering ? "flex" : "none",
            zIndex: 2,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <CenteredSpinner />
        </Box>
        <Box
          sx={{
            width: "100vw",
            height: "100vh",
            position: "absolute",
            padding: "10px",
            left: "0",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            px: "8vw",
            gap: "4vw",
            opacity: showInfo ? 1 : 0,
            transition: "all 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
            zIndex: 1000,
            pointerEvents: "none",
            ...(metadata &&
              metadata?.type === "movie" && {
                justifyContent: "center",
                padding: "0",
              }),
          }}
        >
          <img
            src={`${getTranscodeImageURL(
              metadata?.thumb as string,
              1500,
              1500
            )}`}
            alt=""
            style={{
              height: "25vw",
              width: "auto",
              objectFit: "cover",
              borderRadius: "1rem",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              transform: `translateX(${
                showInfo ? 0 : -40
              }vw) perspective(1000px) rotateY(${showInfo ? 0 : -30}deg)`,
              transition: "transform 0.7s cubic-bezier(0.23, 1, 0.32, 1)",
              transitionDelay: "0.2s",
              border: "2px solid rgba(255,255,255,0.1)",
            }}
          />
          <Box
            sx={{
              width: "45vw",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              textAlign: "left",
              transform: `translateX(${showInfo ? 0 : -80}vw)`,
              transition: "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
              transitionDelay: "0.1s",
            }}
          >
            {metadata && metadata?.type === "episode" && (
              <>
                <Typography
                  sx={{
                    fontSize: "0.9vw",
                    color: theme.palette.primary.main,
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    mb: 0.5,
                  }}
                >
                  {showmetadata?.childCount &&
                    showmetadata?.childCount > 1 &&
                    `Season ${metadata.parentIndex}`}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "2.5vw",
                    fontWeight: 700,
                    color: "var(--app-ink)",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.1,
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  {metadata?.grandparentTitle}
                </Typography>

                <Typography
                  sx={{
                    fontSize: "1.2vw",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    mt: 2,
                    mb: 0.5,
                  }}
                >
                  {metadata?.title}{" "}
                  <span style={{ opacity: 0.6 }}>· EP.{metadata?.index}</span>
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    justifyContent: "flex-start",
                    mt: 0,
                    mb: 1,
                    gap: 2,
                  }}
                >
                  {metadata.year && (
                    <Typography
                      sx={{
                        fontSize: "0.8vw",
                        fontWeight: 400,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {metadata.year}
                    </Typography>
                  )}
                  {metadata.rating && (
                    <Typography
                      sx={{
                        fontSize: "0.8vw",
                        fontWeight: 400,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {metadata.rating}
                    </Typography>
                  )}
                  {metadata.contentRating && (
                    <Typography
                      sx={{
                        fontSize: "0.7vw",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.9)",
                        border: `1px solid rgba(255,255,255,0.3)`,
                        borderRadius: "4px",
                        px: 1,
                        py: 0.3,
                      }}
                    >
                      {metadata.contentRating}
                    </Typography>
                  )}
                  {metadata.duration &&
                    ["episode", "movie"].includes(metadata.type) && (
                      <Typography
                        sx={{
                          fontSize: "0.9vw",
                          fontWeight: 400,
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {durationToText(metadata.duration)}
                      </Typography>
                    )}
                </Box>

                <Typography
                  sx={{
                    fontSize: "1vw",
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.6,
                    maxWidth: "90%",
                    position: "relative",
                    "&:before": {
                      content: '""',
                      position: "absolute",
                      left: "-20px",
                      top: "8px",
                      bottom: "8px",
                      width: "3px",
                      background: theme.palette.primary.main,
                      borderRadius: "4px",
                      opacity: 0.8,
                    },
                  }}
                >
                  {metadata?.summary}
                </Typography>
              </>
            )}
            {metadata && metadata?.type === "movie" && (
              <>
                <Typography
                  sx={{
                    fontSize: "3.5vw",
                    fontWeight: 700,
                    color: "var(--app-ink)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.1,
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                >
                  {metadata?.title}
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    flexWrap: "wrap",
                    justifyContent: "flex-start",
                    mt: 2,
                    mb: 3,
                    gap: 2,
                  }}
                >
                  {metadata.year && (
                    <Typography
                      sx={{
                        fontSize: "0.8vw",
                        fontWeight: 400,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {metadata.year}
                    </Typography>
                  )}
                  {metadata.rating && (
                    <Typography
                      sx={{
                        fontSize: "0.8vw",
                        fontWeight: 400,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {metadata.rating}
                    </Typography>
                  )}
                  {metadata.contentRating && (
                    <Typography
                      sx={{
                        fontSize: "0.7vw",
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.9)",
                        border: `1px solid rgba(255,255,255,0.3)`,
                        borderRadius: "4px",
                        px: 1,
                        py: 0.3,
                      }}
                    >
                      {metadata.contentRating}
                    </Typography>
                  )}
                  {metadata.duration &&
                    ["episode", "movie"].includes(metadata.type) && (
                      <Typography
                        sx={{
                          fontSize: "0.8vw",
                          fontWeight: 400,
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {durationToText(metadata.duration)}
                      </Typography>
                    )}
                </Box>

                {metadata?.tagline && (
                  <Typography
                    sx={{
                      fontSize: "1vw",
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      mt: 1,
                      mb: 2,
                      fontStyle: "italic",
                    }}
                  >
                    {metadata?.tagline}
                  </Typography>
                )}
                <Typography
                  sx={{
                    fontSize: "1vw",
                    color: "rgba(255,255,255,0.8)",
                    lineHeight: 1.6,
                    maxWidth: "90%",
                    position: "relative",
                    "&:before": {
                      content: '""',
                      position: "absolute",
                      left: "-20px",
                      top: "8px",
                      bottom: "8px",
                      width: "3px",
                      background: theme.palette.primary.main,
                      borderRadius: "4px",
                      opacity: 0.8,
                    },
                  }}
                >
                  {metadata?.summary}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        <Popover
          open={showTune}
          anchorEl={tuneButtonRef.current}
          onClose={() => {
            setShowTune(false);
            setTunePage(0);
          }}
          anchorOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          sx={{
            "& .MuiPaper-root": {
              overflow: "hidden",
              borderRadius: 1,
              background: "transparent",
            },
          }}
        >
          <Paper
            sx={{
              width: 350,
              height: "auto",
              overflow: "hidden",
              userSelect: "none",
              backdropFilter: "blur(20px)",
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            {tunePage === 0 && (
              <>
                {TuneSettingTab(theme, setTunePage, {
                  pageNum: 1,
                  text: "Video",
                })}
                {TuneSettingTab(theme, setTunePage, {
                  pageNum: 2,
                  text: "Audio",
                })}
                {TuneSettingTab(theme, setTunePage, {
                  pageNum: 3,
                  text: "Subtitles",
                })}
              </>
            )}

            {tunePage === 1 && metadata?.Media && (
              <>
                {TuneSettingTab(theme, setTunePage, {
                  pageNum: 0,
                  text: "Back",
                })}

                {getCurrentVideoLevels(
                  metadata.Media[0].videoResolution,
                  `${Math.floor(metadata.Media[0].bitrate / 1000)}Mbps`
                ).map((qualityOption) => (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      width: "100%",
                      height: 50,
                      px: 2,
                      userSelect: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease-in-out",
                      backgroundColor: "var(--app-overlay)",
                      "&:hover": {
                        transition: "all 0s ease-in-out",
                        backgroundColor: "var(--app-overlay-strong)",
                      },
                    }}
                    onClick={async () => {
                      if (!metadata.Media || !itemID) return;
                      setTunePage(0);
                      await loadMetadata(itemID);
                      await getUniversalDecision(itemID, {
                        maxVideoBitrate: qualityOption.bitrate,
                        autoAdjustQuality: quality.auto,
                      });
                      setQuality({
                        bitrate: qualityOption.original
                          ? undefined
                          : qualityOption.bitrate,
                        auto: undefined,
                      });

                      if (qualityOption.original)
                        localStorage.removeItem("quality");
                      else if (qualityOption.bitrate)
                        localStorage.setItem(
                          "quality",
                          qualityOption.bitrate.toString()
                        );

                      const progress = player.current?.getCurrentTime() ?? 0;

                      if (!seekToAfterLoad.current)
                        seekToAfterLoad.current = progress;
                      setURL("");
                      setTimeout(() => {
                        setURL(getUrl(metadata, quality));
                      }, 100);
                    }}
                  >
                    {qualityOption.bitrate === quality.bitrate && (
                      <CheckRounded
                        sx={{
                          mr: "auto",
                          color: "primary.main",
                        }}
                        fontSize="small"
                      />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          opacity: 0.6,
                          mr: 0.5,
                        }}
                      >
                        {qualityOption.extra}
                      </Box>
                      {qualityOption.title}
                    </Typography>
                  </Box>
                ))}
              </>
            )}

            {tunePage === 2 && metadata?.Media && (
              <>
                {TuneSettingTab(theme, setTunePage, {
                  pageNum: 0,
                  text: "Back",
                })}

                {metadata?.Media[0].Part[0].Stream.filter(
                  (stream) => stream.streamType === 2 // Audio
                ).map((stream) => (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      width: "100%",
                      height: 50,
                      px: 2,
                      userSelect: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease-in-out",
                      backgroundColor: "var(--app-overlay)",
                      "&:hover": {
                        transition: "all 0s ease-in-out",
                        backgroundColor: "var(--app-overlay-strong)",
                      },
                    }}
                    onClick={async () => {
                      if (!metadata.Media || !itemID) return;
                      setTunePage(0);
                      await putAudioStream(
                        metadata.Media?.[0].Part[0].id ?? 0,
                        stream.id
                      );

                      await loadMetadata(itemID);
                      await getUniversalDecision(itemID, {
                        maxVideoBitrate: quality.bitrate,
                        autoAdjustQuality: quality.auto,
                      });

                      useUserSettings.getState().setSetting(
                        `MEDIA_PREF_AUDIO-${metadata.grandparentRatingKey}`,
                        JSON.stringify({
                          index: stream.index,
                          title: stream.extendedDisplayTitle,
                        })
                      );

                      const progress = player.current?.getCurrentTime() ?? 0;

                      if (!seekToAfterLoad.current)
                        seekToAfterLoad.current = progress;
                      setURL("");
                      setTimeout(() => {
                        setURL(getUrl(metadata, quality));
                      }, 100);
                    }}
                  >
                    <CheckRounded
                      sx={{
                        mr: "auto",
                        opacity: stream.selected ? 1 : 0,
                        color: "primary.main",
                      }}
                      fontSize="small"
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        maxWidth: "calc(100% - 40px)",
                      }}
                    >
                      {stream.extendedDisplayTitle}
                    </Typography>
                  </Box>
                ))}
              </>
            )}

            {tunePage === 3 && metadata?.Media && (
              <>
                {TuneSettingTab(theme, setTunePage, {
                  pageNum: 0,
                  text: "Back",
                })}

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    width: "100%",
                    height: 50,
                    px: 2,
                    userSelect: "none",
                    cursor: "pointer",
                    transition: "all 0.3s ease-in-out",
                    backgroundColor: "var(--app-overlay)",
                    "&:hover": {
                      transition: "all 0s ease-in-out",
                      backgroundColor: "var(--app-overlay-strong)",
                    },
                  }}
                  onClick={async () => {
                    if (!metadata.Media || !itemID) return;
                    setTunePage(0);
                    await putSubtitleStream(
                      metadata.Media?.[0].Part[0].id ?? 0,
                      0
                    );
                    await loadMetadata(itemID);
                    await getUniversalDecision(itemID, {
                      maxVideoBitrate: quality.bitrate,
                      autoAdjustQuality: quality.auto,
                    });

                    useUserSettings.getState().setSetting(
                      `MEDIA_PREF_SUBTITLE-${metadata.grandparentRatingKey}`,
                      JSON.stringify({
                        index: -1,
                        title: "None",
                      })
                    );

                    const progress = player.current?.getCurrentTime() ?? 0;

                    if (!seekToAfterLoad.current)
                      seekToAfterLoad.current = progress;
                    setURL("");
                    setTimeout(() => {
                      setURL(getUrl(metadata, quality));
                    }, 100);
                  }}
                >
                  {metadata?.Media[0].Part[0].Stream.filter(
                    (stream) => stream.selected && stream.streamType === 3 // Subtitle
                  ).length === 0 && (
                    <CheckRounded
                      sx={{
                        mr: "auto",
                        color: "primary.main",
                      }}
                      fontSize="small"
                    />
                  )}
                  <Typography variant="body2">None</Typography>
                </Box>

                {metadata?.Media[0].Part[0].Stream.filter(
                  (stream) => stream.streamType === 3
                ).map((stream) => (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      height: 50,
                      px: 2,
                      userSelect: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease-in-out",
                      backgroundColor: "var(--app-overlay)",
                      "&:hover": {
                        transition: "all 0s ease-in-out",
                        backgroundColor: "var(--app-overlay-strong)",
                      },
                    }}
                    onClick={async () => {
                      if (!metadata.Media || !itemID) return;
                      setTunePage(0);
                      await putSubtitleStream(
                        metadata.Media?.[0].Part[0].id ?? 0,
                        stream.id
                      );

                      await loadMetadata(itemID);
                      await getUniversalDecision(itemID, {
                        maxVideoBitrate: quality.bitrate,
                        autoAdjustQuality: quality.auto,
                      });

                      useUserSettings.getState().setSetting(
                        `MEDIA_PREF_SUBTITLE-${metadata.grandparentRatingKey}`,
                        JSON.stringify({
                          index: stream.index,
                          title: stream.extendedDisplayTitle,
                        })
                      );

                      const progress = player.current?.getCurrentTime() ?? 0;

                      if (!seekToAfterLoad.current)
                        seekToAfterLoad.current = progress;
                      setURL("");
                      setTimeout(() => {
                        setURL(getUrl(metadata, quality));
                      }, 100);
                    }}
                  >
                    <CheckRounded
                      sx={{
                        opacity: stream.selected ? 1 : 0,
                        color: "primary.main",
                      }}
                      fontSize="small"
                    />

                    <Typography
                      variant="body2"
                      sx={{
                        ml: 1,
                        flex: 1,
                        textAlign: "right",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {stream.extendedDisplayTitle}
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </Paper>
        </Popover>
        {(() => {
          if (!metadata) return <CenteredSpinner />;

          return (
            <>
              <Fade
                mountOnEnter
                unmountOnExit
                in={
                  metadata.Marker &&
                  metadata.Marker.filter(
                    (marker) =>
                      marker.startTimeOffset / 1000 <= progress &&
                      marker.endTimeOffset / 1000 >= progress &&
                      marker.type === "intro"
                  ).length > 0
                }
              >
                <Box
                  sx={{
                    position: "absolute",
                    bottom: `${
                      (playbackBarRef.current?.clientHeight ?? 0) + 40
                    }px`,
                    right: "40px",
                    zIndex: 2,
                  }}
                >
                  <Button
                    sx={{
                      px: 3,
                      py: 1.5,
                      backgroundColor: "var(--app-overlay)",
                      backdropFilter: "blur(20px)",
                      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                      color: "var(--app-ink)",
                      "&:hover": {
                        backgroundColor: "var(--app-overlay-strong)",
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        border: `1px solid ${alpha(
                          theme.palette.primary.main,
                          0.5
                        )}`,
                      },
                    }}
                    variant="contained"
                    onClick={() => {
                      if (!player.current || !metadata?.Marker) return;
                      const time =
                        metadata.Marker?.filter(
                          (marker) =>
                            marker.startTimeOffset / 1000 <= progress &&
                            marker.endTimeOffset / 1000 >= progress &&
                            marker.type === "intro"
                        )[0].endTimeOffset / 1000;
                      player.current.seekTo(time + 1);
                      syncSeek(time + 1);
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.5,
                      }}
                    >
                      <SkipNext sx={{ fontSize: 18 }} />
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          letterSpacing: "0.025em",
                        }}
                      >
                        Skip Intro
                      </Typography>
                    </Box>
                  </Button>
                </Box>
              </Fade>

              <Fade
                mountOnEnter
                unmountOnExit
                in={
                  metadata.Marker &&
                  metadata.Marker.filter(
                    (marker) =>
                      marker.startTimeOffset / 1000 <= progress &&
                      marker.endTimeOffset / 1000 >= progress &&
                      marker.type === "credits" &&
                      !marker.final
                  ).length > 0
                }
              >
                <Box
                  sx={{
                    position: "absolute",
                    bottom: `${
                      (playbackBarRef.current?.clientHeight ?? 0) + 40
                    }px`,
                    right: "40px",
                    zIndex: 2,
                  }}
                >
                  <Button
                    sx={{
                      px: 3,
                      py: 1.5,
                      backgroundColor: "var(--app-overlay)",
                      backdropFilter: "blur(20px)",
                      border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                      color: "var(--app-ink)",
                      "&:hover": {
                        backgroundColor: "var(--app-overlay-strong)",
                        transform: "translateY(-2px)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        border: `1px solid ${alpha(
                          theme.palette.primary.main,
                          0.5
                        )}`,
                      },
                    }}
                    variant="contained"
                    onClick={() => {
                      if (!player.current || !metadata?.Marker) return;
                      const time =
                        metadata.Marker?.filter(
                          (marker) =>
                            marker.startTimeOffset / 1000 <= progress &&
                            marker.endTimeOffset / 1000 >= progress &&
                            marker.type === "credits" &&
                            !marker.final
                        )[0].endTimeOffset / 1000;
                      player.current.seekTo(time + 1);
                      syncSeek(time + 1);
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.5,
                      }}
                    >
                      <SkipNext sx={{ fontSize: 18 }} />
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          letterSpacing: "0.025em",
                        }}
                      >
                        Skip Credits
                      </Typography>
                    </Box>
                  </Button>
                </Box>
              </Fade>

              <Fade
                mountOnEnter
                unmountOnExit
                in={
                  metadata.Marker &&
                  metadata.Marker.filter(
                    (marker) =>
                      marker.startTimeOffset / 1000 <= progress &&
                      marker.endTimeOffset / 1000 >= progress &&
                      marker.type === "credits" &&
                      marker.final
                  ).length > 0
                }
              >
                <Box
                  sx={{
                    position: "absolute",
                    bottom: `${
                      (playbackBarRef.current?.clientHeight ?? 0) + 40
                    }px`,
                    right: "40px",
                    zIndex: 2,
                  }}
                >
                  <PlaybackNextEPButton
                    player={player}
                    metadata={metadata}
                    playQueue={playQueue}
                    navigate={navigate}
                    playing={playing}
                    onNextEpisode={(ratingKey) =>
                      syncSetMedia(ratingKey, {
                        positionSeconds: 0,
                        state: "playing",
                      })
                    }
                    onEndPlayback={
                      room
                        ? () => {
                            syncEndPlayback();
                          }
                        : undefined
                    }
                  />
                </Box>
              </Fade>

              <Fade
                in={showControls || !playing || controlElementsVisible}
                style={{
                  transitionDuration: "1s",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 1,
                    width: "100vw",
                    height: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    background:
                      settings["DISABLE_WATCHSCREEN_DARKENING"] === "true"
                        ? "transparent"
                        : "linear-gradient(180deg, rgba(20,10,6,0.5) 0%, rgba(20,10,6,0.3) 40%, rgba(20,10,6,0.3) 60%, rgba(20,10,6,0.85) 100%)",
                    pointerEvents: "none",
                  }}
                >
                  <Box
                    sx={{
                      mt: 3,
                      mx: 3,
                      display: "flex",
                      flexDirection: "row",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      pointerEvents: "all",
                    }}
                  >
                    <IconButton
                      onClick={() => {
                        if (room && !isHost) disconnectWatchTogether();
                        if (room && isHost) syncEndPlayback();

                        if (itemID && player.current)
                          getTimelineUpdate(
                            parseInt(itemID),
                            Math.floor(player.current?.getDuration() * 1000),
                            "stopped",
                            Math.floor(player.current?.getCurrentTime() * 1000)
                          );
                        if (metadata.type === "movie")
                          navigate(
                            `/browse/${
                              metadata.librarySectionID
                            }?${queryBuilder({
                              mid: metadata.ratingKey,
                            })}`
                          );

                        if (metadata.type === "episode")
                          navigate(
                            `/browse/${
                              metadata.librarySectionID
                            }?${queryBuilder({
                              mid: metadata.grandparentRatingKey,
                            })}`
                          );
                      }}
                      sx={{
                        width: 48,
                        height: 48,
                        backgroundColor: "rgba(16, 17, 28, 0.6)",
                        backdropFilter: "blur(20px)",
                        border: `1px solid ${alpha(
                          theme.palette.divider,
                          0.2
                        )}`,
                        "&:hover": {
                          backgroundColor: "var(--app-overlay)",
                          transform: "scale(1.05)",
                        },
                      }}
                    >
                      <ArrowBackIosNewRounded fontSize="medium" />
                    </IconButton>
                  </Box>

                  <Box
                    ref={playbackBarRef}
                    sx={{
                      mt: "auto",
                      mb: 0,
                      mx: 0,
                      background:
                        "linear-gradient(180deg, transparent 0%, rgba(20,10,6,0.95) 100%)",
                      backdropFilter: "blur(20px)",
                      borderTop: `1px solid ${alpha(
                        theme.palette.divider,
                        0.1
                      )}`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: "center",
                      pointerEvents: "all",
                      px: 4,
                      py: 2,

                      transform:
                        showControls || !playing
                          ? "translateY(0)"
                          : "translateY(100%)",
                      transition: "transform 0.5s ease",
                    }}
                  >
                    {/* Progress Bar Section */}
                    <Box
                      sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,
                        mb: 2,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          minWidth: "45px",
                          textAlign: "center",
                          fontSize: "0.75rem",
                          color: "rgba(255,255,255,0.8)",
                          fontWeight: 500,
                        }}
                      >
                        {getFormatedTime(progress)}
                      </Typography>

                      <Box
                        sx={{
                          flex: 1,
                          height: "18px",
                          position: "relative",
                        }}
                      >
                        <VideoSeekSlider
                          max={(player.current?.getDuration() ?? 0) * 1000}
                          currentTime={progress * 1000}
                          bufferTime={buffered * 1000}
                          onChange={(value) => {
                            player.current?.seekTo(value / 1000);
                            syncSeek(value / 1000);
                          }}
                          getPreviewScreenUrl={(value) => {
                            if (
                              !metadata.Media ||
                              !metadata.Media[0].Part[0].indexes
                            )
                              return "";
                            return getTranscodeImageURL(
                              `/library/parts/${metadata.Media[0].Part[0].id}/indexes/sd/${value}`,
                              240,
                              135
                            );
                          }}
                        />
                      </Box>

                      <Typography
                        variant="caption"
                        sx={{
                          minWidth: "45px",
                          textAlign: "center",
                          fontSize: "0.75rem",
                          color: "rgba(255,255,255,0.8)",
                          fontWeight: 500,
                        }}
                      >
                        {getFormatedTime(
                          (player.current?.getDuration() ?? 0) - progress
                        )}
                      </Typography>
                    </Box>

                    {/* Controls Section */}
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      {/* Left Controls */}
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <IconButton
                          onClick={() => {
                            setPlaying(!playing);
                            const currentTime = player.current?.getCurrentTime() ?? 0;
                            if (playing) syncPause(currentTime);
                            else syncPlay(currentTime);
                          }}
                          onKeyDown={(e) => {
                            e.preventDefault();
                          }}
                          sx={{
                            width: 48,
                            height: 48,
                            backgroundColor: "rgba(255,255,255,0.1)",
                            "&:hover": {
                              backgroundColor: "rgba(255,255,255,0.2)",
                              transform: "scale(1.05)",
                            },
                          }}
                        >
                          {playing ? (
                            <PauseRounded fontSize="medium" />
                          ) : (
                            <PlayArrowRounded fontSize="medium" />
                          )}
                        </IconButton>

                        {playQueue && (
                          <NextEPButton
                            queue={playQueue}
                            onNextEpisode={(ratingKey) =>
                              syncSetMedia(ratingKey, {
                                positionSeconds: 0,
                                state: "playing",
                              })
                            }
                          />
                        )}
                      </Box>

                      {/* Center Title */}
                      <Box
                        sx={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          mx: 4,
                        }}
                      >
                        {metadata.type === "movie" && (
                          <Typography
                            variant="h6"
                            sx={{
                              fontSize: "1rem",
                              fontWeight: 600,
                              color: "var(--app-ink)",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                            }}
                          >
                            {metadata.title}
                          </Typography>
                        )}

                        {metadata.type === "episode" && (
                          <>
                            <Typography
                              variant="body2"
                              sx={{
                                fontSize: "0.75rem",
                                color: "rgba(255,255,255,0.7)",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                maxWidth: "100%",
                              }}
                            >
                              {metadata.grandparentTitle}
                            </Typography>
                            <Typography
                              variant="h6"
                              sx={{
                                fontSize: "0.9rem",
                                fontWeight: 600,
                                color: "var(--app-ink)",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                maxWidth: "100%",
                                mt: 0.5,
                              }}
                            >
                              S{metadata.parentIndex}E{metadata.index} •{" "}
                              {metadata.title}
                            </Typography>
                          </>
                        )}
                      </Box>

                      {/* Right Controls */}
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <IconButton
                          onKeyDown={(e) => {
                            e.preventDefault();
                          }}
                          onClick={(event) => {
                            setVolumePopoverAnchor(event.currentTarget);
                          }}
                          sx={{
                            width: 40,
                            height: 40,
                          }}
                        >
                          <VolumeUpRounded fontSize="small" />
                        </IconButton>

                        {metadata.type === "episode" && (
                          <WatchShowChildView
                            item={metadata}
                            controlElementsVisibleState={[
                              controlElementsVisible,
                              setControlElementsVisible,
                            ]}
                            onSelectEpisode={(ratingKey) =>
                              syncSetMedia(ratingKey, {
                                positionSeconds: 0,
                                state: "playing",
                              })
                            }
                          />
                        )}

                        <IconButton
                          onKeyDown={(e) => {
                            e.preventDefault();
                          }}
                          onClick={(event) => {
                            setShowTune(!showTune);
                            setTunePage(0);
                            tuneButtonRef.current = event.currentTarget;
                          }}
                        >
                          <TuneRounded fontSize="small" />
                        </IconButton>

                        {room && (
                          <IconButton
                            onKeyDown={(e) => {
                              e.preventDefault();
                            }}
                            onClick={() => {
                              setSyncInterfaceOpen(true);
                            }}
                          >
                            <PeopleRounded fontSize="small" />
                          </IconButton>
                        )}

                        <IconButton
                          onKeyDown={(e) => {
                            e.preventDefault();
                          }}
                          onClick={() => {
                            if (!document.fullscreenElement)
                              document.documentElement.requestFullscreen();
                            else document.exitFullscreen();
                          }}
                        >
                          <FullscreenRounded fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Volume Popover */}
                    <Popover
                      open={volumePopoverOpen}
                      anchorEl={volumePopoverAnchor}
                      onClose={() => {
                        setVolumePopoverAnchor(null);
                      }}
                      anchorOrigin={{
                        vertical: "top",
                        horizontal: "center",
                      }}
                      transformOrigin={{
                        vertical: "bottom",
                        horizontal: "center",
                      }}
                      elevation={0}
                      sx={{
                        userSelect: "none",
                        "& .MuiPaper-root": {
                          overflow: "hidden",
                          borderRadius: 1,
                          background: "transparent",
                        },
                      }}
                    >
                      <Paper
                        sx={{
                          height: "auto",
                          userSelect: "none",
                          backgroundColor: "var(--app-overlay)",
                          backdropFilter: "blur(20px)",
                          border: `1px solid ${alpha(
                            theme.palette.divider,
                            0.1
                          )}`,
                          py: 3,
                          px: 2,
                        }}
                      >
                        <Slider
                          sx={{
                            height: "100px",
                            "& .MuiSlider-thumb": {
                              width: 16,
                              height: 16,
                              backgroundColor: theme.palette.primary.main,
                              border: "2px solid rgba(255,255,255,0.3)",
                            },
                            "& .MuiSlider-track": {
                              backgroundColor: theme.palette.primary.main,
                              border: "none",
                              width: 4,
                            },
                            "& .MuiSlider-rail": {
                              backgroundColor: "rgba(255,255,255,0.2)",
                              width: 4,
                            },
                          }}
                          value={volume}
                          onChange={(event, value) => {
                            setVolume(value as number);
                            localStorage.setItem("volume", value.toString());
                          }}
                          aria-labelledby="continuous-slider"
                          min={0}
                          max={100}
                          step={1}
                          orientation="vertical"
                        />
                      </Paper>
                    </Popover>
                  </Box>
                </Box>
              </Fade>

              <ReactPlayer
                key={`${itemID ?? "watch"}-${playerInstanceKey}`}
                ref={player}
                playing={playing}
                volume={volume / 100}
                progressInterval={500}
                onClick={(e: MouseEvent) => {
                  e.preventDefault();

                  switch (e.detail) {
                    case 1:
                      setPlaying((state) => {
                        const currentTime = player.current?.getCurrentTime() ?? 0;
                        if (state) syncPause(currentTime);
                        else syncPlay(currentTime);
                        return !state;
                      });
                      break;
                    case 2:
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen();
                        setPlaying(true);
                        syncPlay(player.current?.getCurrentTime() ?? 0);
                      } else document.exitFullscreen();
                      break;
                    default:
                      break;
                  }
                }}
                onReady={() => {
                  if (!player.current) return;
                  setReady(true);

                  if (seekToAfterLoad.current !== null) {
                    const seekTo = seekToAfterLoad.current;
                    player.current.seekTo(seekTo);
                    lastAppliedTime.current = Math.floor(seekTo * 1000);
                    seekToAfterLoad.current = null;
                    return;
                  }

                  const seekToMsFromQuery = params.has("tms")
                    ? parseInt(params.get("tms") as string, 10)
                    : null;
                  const seekToLegacy = params.has("t")
                    ? parseInt(params.get("t") as string, 10)
                    : null;

                  const seekMs =
                    (typeof seekToMsFromQuery === "number" &&
                    !Number.isNaN(seekToMsFromQuery)
                      ? seekToMsFromQuery
                      : typeof seekToLegacy === "number" &&
                          !Number.isNaN(seekToLegacy)
                        ? seekToLegacy < 10000
                          ? seekToLegacy * 1000
                          : seekToLegacy
                        : metadata?.viewOffset && metadata?.viewOffset > 5
                          ? metadata.viewOffset
                          : null) ?? null;

                  if (!seekMs || Number.isNaN(seekMs)) return;

                  const durationMs = Math.floor(
                    (player.current?.getDuration() ?? 0) * 1000
                  );
                  const boundedSeekMs =
                    durationMs > 0
                      ? Math.min(seekMs, Math.max(0, durationMs - 250))
                      : seekMs;

                  if (lastAppliedTime.current === boundedSeekMs) return;
                  player.current.seekTo(boundedSeekMs / 1000);
                  lastAppliedTime.current = boundedSeekMs;
                }}
                onProgress={(progress) => {
                  setProgress(progress.playedSeconds);
                  setBuffered(progress.loadedSeconds);

                  if (progress.playedSeconds > lastProgressValueRef.current + 0.25) {
                    lastProgressValueRef.current = progress.playedSeconds;
                    recoveryWindowStartedAtRef.current = 0;
                    recoveryAttemptCountRef.current = 0;
                  }
                }}
                onPause={() => {
                  if (room) {
                    requestWatchTogetherState();
                    return;
                  }
                  setPlaying(false);
                }}
                onPlay={() => {
                  if (room) {
                    setBuffering(false);
                    requestWatchTogetherState();
                    return;
                  }

                  setPlaying(true);
                  setBuffering(false);
                }}
                onBuffer={() => {
                  setBuffering(true);
                }}
                onBufferEnd={() => {
                  setBuffering(false);
                }}
                onError={(err) => {
                  console.log("Player error:");
                  console.error(err);
                  // window.location.reload();

                  const rawMessage =
                    err?.error?.message ??
                    err?.message ??
                    err?.error?.toString?.() ??
                    "";

                  if (showError) return;

                  if (queueAutomaticRecovery("player", undefined, rawMessage))
                    return;

                  setPlaying(false);

                  // filter out links from the error messages
                  if (!rawMessage) return;
                  const message = rawMessage.replace(
                    /https?:\/\/[^\s]+/g,
                    "Media"
                  );

                  setShowError(message);
                }}
                config={{
                  file: {
                    hlsVersion: "1.6.7",
                    dashVersion: "4.7.4",
                    attributes: {
                      controlsList: "nodownload",
                      disablePictureInPicture: true,
                      disableRemotePlayback: true,
                      autoplay: true,
                    },
                  },
                }}
                onEnded={() => {
                  if (!playQueue) return console.log("No play queue");

                  if (metadata.type !== "episode") {
                    if (room) {
                      syncEndPlayback();
                      return;
                    }
                    return navigate(
                      `/browse/${metadata.librarySectionID}?${queryBuilder({
                        mid: metadata.ratingKey,
                      })}`
                    );
                  }

                  const next = playQueue[1];
                  if (!next) {
                    if (room) {
                      syncEndPlayback();
                      return;
                    }
                    return navigate(
                      `/browse/${metadata.librarySectionID}?${queryBuilder({
                        mid: metadata.grandparentRatingKey,
                        pid: metadata.parentRatingKey,
                        iid: metadata.ratingKey,
                      })}`
                    );
                  }

                  syncSetMedia(next.ratingKey, {
                    positionSeconds: 0,
                    state: "playing",
                  });
                }}
                url={url}
                width="100%"
                height="100%"
              />
            </>
          );
        })()}
      </Box>
    </>
  );
}

export default Watch;

function NextEPButton({
  queue,
  onNextEpisode,
}: {
  queue?: Plex.Metadata[];
  onNextEpisode?: (ratingKey: string) => void;
}) {
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (!queue || !queue[1]) return <></>;

  return (
    <>
      <Popper
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        placement="top-start"
        transition
        sx={{
          zIndex: 10000,
          "& .MuiPaper-root": {
            overflow: "hidden",
            borderRadius: 1,
            background: "transparent",
          },
        }}
        modifiers={[
          {
            name: "offset",
            options: {
              offset: [0, 10],
            },
          },
        ]}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={350}>
            <Paper
              sx={{
                width: "35vw",
                height: "auto",
                aspectRatio: "32/8",
                overflow: "hidden",

                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "flex-start",
              }}
            >
              <img
                src={`${getTranscodeImageURL(queue[1].thumb, 500, 500)}`}
                alt=""
                style={{
                  height: "100%",
                  aspectRatio: "16/9",
                  width: "auto",
                }}
              />

              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  justifyContent: "flex-start",
                  p: 2,

                  backgroundColor: "var(--app-overlay)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.7vw",
                    fontWeight: "700",
                    letterSpacing: "0.15em",
                    color: (theme) => theme.palette.primary.main,
                    textTransform: "uppercase",
                  }}
                >
                  {queue[1].type}{" "}
                  {queue[1].type === "episode" && queue[1].index}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8vw",
                    fontWeight: "bold",
                    color: "var(--app-ink)",
                  }}
                >
                  {queue[1].title}
                </Typography>

                <Typography
                  sx={{
                    mt: "2px",
                    fontSize: "0.6vw",
                    color: "var(--app-ink)",

                    // max 5 lines
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {queue[1].summary}
                </Typography>
              </Box>
            </Paper>
          </Fade>
        )}
      </Popper>
      <IconButton
        onClick={() => {
          if (onNextEpisode) {
            onNextEpisode(queue[1].ratingKey);
            return;
          }

          navigate(`/watch/${queue[1].ratingKey}`);
        }}
        onKeyDown={(e) => {
          e.preventDefault();
        }}
        onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
        onMouseLeave={() => setAnchorEl(null)}
      >
        <SkipNextRounded fontSize="small" />
      </IconButton>
    </>
  );
}

function TuneSettingTab(
  theme: Theme,
  setTunePage: React.Dispatch<React.SetStateAction<number>>,
  props: {
    pageNum: number;
    text: string;
  }
) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: 50,
        px: 2,
        py: 1.5,
        userSelect: "none",
        cursor: "pointer",
        transition: "all 0.3s ease-in-out",
        backgroundColor: "var(--app-overlay)",
        "&:hover": {
          transition: "all 0s ease-in-out",
          backgroundColor: "var(--app-overlay-strong)",
        },
      }}
      onClick={() => {
        setTunePage(props.pageNum);
      }}
    >
      <ArrowBackIosRounded
        sx={{
          fontSize: 18,
          color: "text.secondary",
        }}
      />
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: "medium",
          flex: 1,
          textAlign: "right",
          color: "text.primary",
        }}
      >
        {props.text}
      </Typography>
    </Box>
  );
}

export function getFormatedTime(time: number) {
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);

  // only show hours if there are any
  if (hours > 0)
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function getCurrentVideoLevels(
  resolution: string,
  extraForOriginal = "Auto"
) {
  const levels: {
    title: string;
    bitrate?: number;
    extra: string;
    original?: boolean;
  }[] = [];

  // if (platformCache.isDesktop)
  //   levels.push({
  //     title: "Direct Play (Original)",
  //     bitrate: -1,
  //     extra: extraForOriginal,
  //   });

  switch (resolution) {
    case "720":
      levels.push(
        ...[
          {
            title: "Convert to 720p",
            bitrate: 4000,
            extra: "(High) 4Mbps",
          },
          {
            title: "Convert to 720p",
            bitrate: 3000,
            extra: "(Medium) 3Mbps",
          },
          { title: "Convert to 720p", bitrate: 2000, extra: "2Mbps" },
          { title: "Convert to 480p", bitrate: 1500, extra: "1.5Mbps" },
          { title: "Convert to 360p", bitrate: 750, extra: "0.7Mbps" },
          { title: "Convert to 240p", bitrate: 300, extra: "0.3Mbps" },
        ]
      );
      break;
    case "4k":
      levels.push(
        ...[
          {
            title: "Convert to 4K",
            bitrate: 60000,
            extra: "(High) 60Mbps",
          },
          {
            title: "Convert to 4K",
            bitrate: 40000,
            extra: "(Medium) 40Mbps",
          },
          {
            title: "Convert to 4K",
            bitrate: 30000,
            extra: "30Mbps",
          },
          {
            title: "Convert to 1080p",
            bitrate: 20000,
            extra: "(High) 20Mbps",
          },
          {
            title: "Convert to 1080p",
            bitrate: 12000,
            extra: "(Medium) 12Mbps",
          },
          {
            title: "Convert to 1080p",
            bitrate: 8000,
            extra: "8Mbps",
          },
          {
            title: "Convert to 720p",
            bitrate: 4000,
            extra: "(High) 4Mbps",
          },
          {
            title: "Convert to 720p",
            bitrate: 3000,
            extra: "(Medium) 3Mbps",
          },
          { title: "Convert to 720p", bitrate: 2000, extra: "2Mbps" },
          { title: "Convert to 480p", bitrate: 1500, extra: "1.5Mbps" },
          { title: "Convert to 360p", bitrate: 750, extra: "0.7Mbps" },
          { title: "Convert to 240p", bitrate: 300, extra: "0.3Mbps" },
        ]
      );
      break;

    case "1080":
    default:
      levels.push(
        ...[
          {
            title: "Convert to 1080p",
            bitrate: 20000,
            extra: "(High) 20Mbps",
          },
          {
            title: "Convert to 1080p",
            bitrate: 12000,
            extra: "(Medium) 12Mbps",
          },
          {
            title: "Convert to 1080p",
            bitrate: 8000,
            extra: "8Mbps",
          },
          {
            title: "Convert to 720p",
            bitrate: 4000,
            extra: "(High) 4Mbps",
          },
          {
            title: "Convert to 720p",
            bitrate: 3000,
            extra: "(Medium) 3Mbps",
          },
          { title: "Convert to 720p", bitrate: 2000, extra: "2Mbps" },
          { title: "Convert to 480p", bitrate: 1500, extra: "1.5Mbps" },
          { title: "Convert to 360p", bitrate: 750, extra: "0.7Mbps" },
          { title: "Convert to 240p", bitrate: 300, extra: "0.3Mbps" },
        ]
      );
      break;
  }

  return levels;
}
