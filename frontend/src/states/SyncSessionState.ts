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
let activeConnectAttempt = 0;

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
    activeConnectAttempt += 1;
    const attemptId = activeConnectAttempt;
    const current = get().socket;
    if (current) {
      (
        current as Socket & { __manualDisconnect?: boolean }
      ).__manualDisconnect = true;
      current.removeAllListeners();
      current.disconnect();
    }

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

      (socket as Socket & { __manualDisconnect?: boolean }).__manualDisconnect =
        false;

      set({
        ...resetSyncSessionState(),
        status: "connecting",
        socket,
      });

      let resolved = false;
      let connectTimeout: ReturnType<typeof setTimeout> | null = null;

      const isOutdatedSocket = () => {
        return attemptId !== activeConnectAttempt || get().socket !== socket;
      };

      const resolveOnce = (result: true | PerPlexed.WatchTogether.SocketError) => {
        if (resolved) return;
        resolved = true;
        if (connectTimeout) clearTimeout(connectTimeout);
        resolve(result);
      };

      socket.on("wt:room:ready", (data: PerPlexed.WatchTogether.Ready) => {
        if (isOutdatedSocket()) return;

        const manager = socket.io as { opts?: { query?: Record<string, string> } };
        if (manager?.opts) {
          manager.opts.query = {
            ...(manager.opts.query ?? {}),
            room: data.room,
          };
        }

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

      connectTimeout = setTimeout(() => {
        if (isOutdatedSocket()) {
          resolveOnce({
            type: "cancelled",
            message: "Connection attempt superseded",
          });
          return;
        }
        if (resolved) return;

        const timeoutErr: PerPlexed.WatchTogether.SocketError = {
          type: "timeout",
          message: "Connection timed out",
        };

        set({
          ...resetSyncSessionState(),
          lastError: timeoutErr,
        });

        (socket as Socket & { __manualDisconnect?: boolean }).__manualDisconnect =
          true;
        socket.disconnect();
        resolveOnce(timeoutErr);
      }, 5000);

      socket.on("connect", () => {
        if (isOutdatedSocket()) return;
        console.log("Watch Together connected to server");
      });

      socket.on("disconnect", () => {
        if (isOutdatedSocket()) return;
        console.log("Watch Together disconnected from server");

        const intentional =
          (socket as Socket & { __manualDisconnect?: boolean })
            .__manualDisconnect === true;

        if (intentional) {
          set((state) => ({
            ...resetSyncSessionState(),
            lastError: state.lastError,
          }));
          return;
        }

        set((state) => ({
          ...state,
          status: "connecting",
          socket,
          members: {},
        }));
      });

      socket.on("wt:member:joined", (member: PerPlexed.WatchTogether.Member) => {
        if (isOutdatedSocket()) return;
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
        if (isOutdatedSocket()) return;
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
        if (isOutdatedSocket()) return;
        set((state) => {
          const previous = state.playback;
          const previousUpdatedAt = previous?.updatedAtMs ?? 0;
          if (update.seq < state.playbackSeq) return state;
          if (
            update.seq === state.playbackSeq &&
            update.playback.updatedAtMs <= previousUpdatedAt
          ) {
            return state;
          }

          const actor = update.actor;
          const isNewActionSequence = update.seq > state.playbackSeq;

          if (actor && previous && isNewActionSequence) {
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
            playbackSeq: Math.max(state.playbackSeq, update.seq),
          };
        });
      });

      socket.on("wt:room:error", (error: PerPlexed.WatchTogether.SocketError) => {
        if (isOutdatedSocket()) return;
        set({ lastError: error });
        const duringConnect = !resolved;
        if (duringConnect) {
          (
            socket as Socket & { __manualDisconnect?: boolean }
          ).__manualDisconnect = true;
          socket.disconnect();
        }
        resolveOnce(error);

        if (error.type === "host_disconnect") {
          (
            socket as Socket & { __manualDisconnect?: boolean }
          ).__manualDisconnect = true;
          socket.disconnect();
          navigate?.("/");
        }
      });

      socket.connect();
    });
  },

  disconnect: () => {
    activeConnectAttempt += 1;
    const socket = get().socket;
    if (socket) {
      (
        socket as Socket & { __manualDisconnect?: boolean }
      ).__manualDisconnect = true;
      socket.emit("wt:room:leave");
      socket.disconnect();
    }

    set({
      ...resetSyncSessionState(),
    });
  },

  requestState: () => {
    const socket = get().socket;
    socket?.emit("wt:heartbeat");
    socket?.emit("wt:state:request");
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
