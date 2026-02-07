import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { getBackendURL, isDev } from "../backendURL";
import { NavigateFunction } from "react-router-dom";
import { useToast } from "../components/ToastManager";
import { uuidv4 } from "../plex/QuickFunctions";

export interface SyncSessionState {
  socket: Socket | null;
  status: "disconnected" | "connecting" | "connected";
  isHost: boolean;
  room: string | null;
  members: Record<string, PerPlexed.WatchTogether.Member>;
  playback: PerPlexed.WatchTogether.PlaybackState | null;
  playbackSeq: number;
  lastError: PerPlexed.WatchTogether.SocketError | null;

  connect: (
    room?: string,
    navigate?: NavigateFunction
  ) => Promise<true | PerPlexed.WatchTogether.SocketError>;
  disconnect: () => void;
  requestState: () => void;
  sendControl: (
    control: Omit<PerPlexed.WatchTogether.ControlAction, "actionId" | "actorClientTs"> & {
      actionId?: string;
    }
  ) => boolean;
}

let lastPlaybackToastKey = "";
let lastPlaybackToastAt = 0;

function shouldThrottlePlaybackToast(key: string, windowMs = 2000) {
  const now = Date.now();
  if (lastPlaybackToastKey === key && now - lastPlaybackToastAt < windowMs) {
    return true;
  }

  lastPlaybackToastKey = key;
  lastPlaybackToastAt = now;
  return false;
}

function resetSyncSessionState() {
  return {
    socket: null,
    status: "disconnected" as const,
    isHost: false,
    room: null,
    members: {},
    playback: null,
    playbackSeq: 0,
    lastError: null,
  };
}

export const useSyncSessionState = create<SyncSessionState>((set, get) => ({
  ...resetSyncSessionState(),

  connect: async (room, navigate) => {
    const current = get().socket;
    if (current) current.disconnect();

    return new Promise<true | PerPlexed.WatchTogether.SocketError>((resolve) => {
      const socket = isDev
        ? io(getBackendURL(), {
            auth: {
              token: localStorage.getItem("accAccessToken"),
            },
            query: {
              room: room || "new",
            },
            autoConnect: false,
          })
        : io({
            auth: {
              token: localStorage.getItem("accAccessToken"),
            },
            query: {
              room: room || "new",
            },
            autoConnect: false,
          });

      set({
        ...resetSyncSessionState(),
        status: "connecting",
      });

      let resolved = false;

      const resolveOnce = (result: true | PerPlexed.WatchTogether.SocketError) => {
        if (resolved) return;
        resolved = true;
        resolve(result);
      };

      socket.once("wt:room:ready", (data: PerPlexed.WatchTogether.Ready) => {
        set({
          socket,
          status: "connected",
          isHost: data.host,
          room: data.room,
          playback: data.playback,
          playbackSeq: data.seq,
          lastError: null,
        });

        resolveOnce(true);
      });

      socket.once("wt:room:error", (data: PerPlexed.WatchTogether.SocketError) => {
        set({
          ...resetSyncSessionState(),
          lastError: data,
        });

        resolveOnce(data);
      });

      setTimeout(() => {
        if (resolved) return;

        const timeoutErr: PerPlexed.WatchTogether.SocketError = {
          type: "timeout",
          message: "Connection timed out",
        };

        set({
          ...resetSyncSessionState(),
          lastError: timeoutErr,
        });

        socket.disconnect();
        resolveOnce(timeoutErr);
      }, 5000);

      socket.on("connect", () => {
        console.log("Watch Together connected to server");
      });

      socket.on("disconnect", () => {
        console.log("Watch Together disconnected from server");

        set((state) => {
          const keepError = state.lastError;
          return {
            ...resetSyncSessionState(),
            lastError: keepError,
          };
        });
      });

      socket.on("wt:member:joined", (member: PerPlexed.WatchTogether.Member) => {
        set((state) => ({
          members: {
            ...state.members,
            [member.socket]: member,
          },
        }));

        useToast
          .getState()
          .addToast(member, "UserAdd", "Joined the session", 5000);
      });

      socket.on("wt:member:left", (member: PerPlexed.WatchTogether.Member) => {
        set((state) => {
          const nextMembers = { ...state.members };
          delete nextMembers[member.socket];

          return {
            members: nextMembers,
          };
        });

        useToast
          .getState()
          .addToast(member, "UserRemove", "Left the session", 5000);
      });

      socket.on("wt:state:update", (update: PerPlexed.WatchTogether.StateUpdate) => {
        set((state) => {
          if (update.seq <= state.playbackSeq) return state;

          const previous = state.playback;
          const actor = update.actor;

          if (actor && previous) {
            const mediaChanged = previous.key !== update.playback.key;
            const modeChanged = previous.state !== update.playback.state;

            if (mediaChanged && update.playback.key) {
              if (!shouldThrottlePlaybackToast(`playset:${actor.uid}:${update.seq}`)) {
                useToast
                  .getState()
                  .addToast(actor, "PlaySet", "Started Playback", 5000);
              }
            } else if (modeChanged) {
              const icon = update.playback.state === "playing" ? "Play" : "Pause";
              const message = update.playback.state === "playing" ? "Resumed Playback" : "Paused Playback";

              if (!shouldThrottlePlaybackToast(`${icon.toLowerCase()}:${actor.uid}:${update.seq}`)) {
                useToast
                  .getState()
                  .addToast(actor, icon, message, 5000);
              }
            }
          }

          return {
            playback: update.playback,
            playbackSeq: update.seq,
          };
        });
      });

      socket.on("wt:room:error", (error: PerPlexed.WatchTogether.SocketError) => {
        set({ lastError: error });

        if (error.type === "host_disconnect") {
          socket.disconnect();
          navigate?.("/");
        }
      });

      socket.connect();
    });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.emit("wt:room:leave");
      socket.disconnect();
    }

    set({
      ...resetSyncSessionState(),
    });
  },

  requestState: () => {
    get().socket?.emit("wt:state:request");
  },

  sendControl: (control) => {
    const { socket, room, status } = get();
    if (!socket || !room || status !== "connected") return false;

    const payload: PerPlexed.WatchTogether.ControlAction = {
      ...control,
      actionId: control.actionId || uuidv4(),
      actorClientTs: Date.now(),
    };

    socket.emit("wt:control", payload);
    return true;
  },
}));
