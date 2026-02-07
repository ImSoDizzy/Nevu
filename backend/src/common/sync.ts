import { Socket } from "socket.io";
import { io } from "..";
import { PerPlexed } from "../types";
import { CheckPlexUser } from "./plex";
import crypto from "crypto";

console.log(`WATCH TOGETHER is ${io ? "enabled" : "disabled"}`);

type WTMember = PerPlexed.WatchTogether.Member;
type WTPlaybackState = PerPlexed.WatchTogether.PlaybackState;
type WTControlAction = PerPlexed.WatchTogether.ControlAction;
type WTControlActionType = PerPlexed.WatchTogether.ControlActionType;

interface RoomRuntime {
  id: string;
  hostSocketId: string;
  seq: number;
  members: Map<string, WTMember>;
  playback: WTPlaybackState;
  recentActionIds: string[];
  recentActionSet: Set<string>;
  lastHeartbeatMs: number;
}

const rooms = new Map<string, RoomRuntime>();
const socketToRoom = new Map<string, string>();

io?.of("/").adapter.on("create-room", (room) => {
  console.log(`WATCH TOGETHER room created: ${room}`);
});

io?.of("/").adapter.on("delete-room", (room) => {
  console.log(`WATCH TOGETHER room deleted: ${room}`);
});

io?.of("/").adapter.on("join-room", (room, id) => {
  console.log(`WATCH TOGETHER [${id}] joined room: ${room}`);
});

io?.of("/").adapter.on("leave-room", (room, id) => {
  console.log(`WATCH TOGETHER [${id}] left room: ${room}`);
});

function createInitialPlayback(): WTPlaybackState {
  return {
    key: null,
    state: "paused",
    positionMs: 0,
    updatedAtMs: Date.now(),
  };
}

function normalizePosition(positionMs?: number): number {
  if (typeof positionMs !== "number" || Number.isNaN(positionMs)) return 0;
  if (!Number.isFinite(positionMs)) return 0;
  return Math.max(0, Math.floor(positionMs));
}

function getProjectedPlayback(room: RoomRuntime): WTPlaybackState {
  if (room.playback.state !== "playing") {
    return {
      ...room.playback,
      positionMs: normalizePosition(room.playback.positionMs),
    };
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - room.playback.updatedAtMs);

  return {
    ...room.playback,
    positionMs: normalizePosition(room.playback.positionMs + elapsed),
    updatedAtMs: now,
  };
}

function createMember(socket: Socket, user: PerPlexed.PlexTV.User): WTMember {
  return {
    uid: user.uuid,
    socket: socket.id,
    name: user.friendlyName,
    avatar: user.thumb,
  };
}

function rememberAction(room: RoomRuntime, actionId: string) {
  room.recentActionIds.push(actionId);
  room.recentActionSet.add(actionId);

  if (room.recentActionIds.length > 200) {
    const dropped = room.recentActionIds.shift();
    if (dropped) room.recentActionSet.delete(dropped);
  }
}

function emitRoomState(
  room: RoomRuntime,
  actor: WTMember | null,
  actionType: WTControlActionType | "sync"
) {
  const projected = getProjectedPlayback(room);

  const payload: PerPlexed.WatchTogether.StateUpdate = {
    room: room.id,
    seq: room.seq,
    actor,
    actionType,
    playback: projected,
  };

  io?.to(room.id).emit("wt:state:update", payload);
}

function emitSocketState(
  socket: Socket,
  room: RoomRuntime,
  actionType: WTControlActionType | "sync" = "sync"
) {
  const projected = getProjectedPlayback(room);

  const payload: PerPlexed.WatchTogether.StateUpdate = {
    room: room.id,
    seq: room.seq,
    actor: null,
    actionType,
    playback: projected,
  };

  socket.emit("wt:state:update", payload);
}

function validateControlAction(
  raw: unknown
): { ok: true; action: WTControlAction } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "Invalid control payload" };
  }

  const data = raw as Record<string, unknown>;
  const actionId = data.actionId;
  const actionType = data.actionType;

  if (typeof actionId !== "string" || !actionId.trim()) {
    return { ok: false, message: "Missing actionId" };
  }

  const validActionTypes = new Set<WTControlActionType>([
    "setMedia",
    "play",
    "pause",
    "seek",
    "end",
  ]);

  if (typeof actionType !== "string" || !validActionTypes.has(actionType as WTControlActionType)) {
    return { ok: false, message: "Invalid actionType" };
  }

  const mediaKey = data.mediaKey;
  const positionRaw = data.positionMs;
  const stateRaw = data.state;

  const action: WTControlAction = {
    actionId,
    actionType: actionType as WTControlActionType,
  };

  if (typeof mediaKey === "string" && mediaKey.trim()) {
    action.mediaKey = mediaKey;
  }

  if (typeof positionRaw === "number" && Number.isFinite(positionRaw)) {
    action.positionMs = normalizePosition(positionRaw);
  }

  if (stateRaw === "playing" || stateRaw === "paused") {
    action.state = stateRaw;
  }

  if (action.actionType === "setMedia" && !action.mediaKey) {
    return { ok: false, message: "setMedia requires mediaKey" };
  }

  if (action.actionType === "seek" && typeof action.positionMs !== "number") {
    return { ok: false, message: "seek requires positionMs" };
  }

  return { ok: true, action };
}

function emitRoomError(socket: Socket, type: string, message: string) {
  socket.emit("wt:room:error", {
    type,
    message,
  } satisfies PerPlexed.WatchTogether.SocketError);
}

function getOrCreateRoom(roomQuery: string, socketId: string): { room: RoomRuntime; isHost: boolean } | null {
  if (roomQuery === "new") {
    const roomId = generateRoomId();
    const room: RoomRuntime = {
      id: roomId,
      hostSocketId: socketId,
      seq: 0,
      members: new Map<string, WTMember>(),
      playback: createInitialPlayback(),
      recentActionIds: [],
      recentActionSet: new Set<string>(),
      lastHeartbeatMs: Date.now(),
    };

    rooms.set(roomId, room);
    return { room, isHost: true };
  }

  const room = rooms.get(roomQuery);
  if (!room) return null;
  return { room, isHost: room.hostSocketId === socketId };
}

function applyControlAction(room: RoomRuntime, action: WTControlAction) {
  const now = Date.now();
  const projectedBeforeApply = getProjectedPlayback(room);
  room.playback = projectedBeforeApply;

  switch (action.actionType) {
    case "setMedia":
      room.playback.key = action.mediaKey ?? room.playback.key;
      room.playback.positionMs = normalizePosition(action.positionMs);
      room.playback.state = action.state ?? "playing";
      break;

    case "play":
      if (action.mediaKey) room.playback.key = action.mediaKey;
      if (typeof action.positionMs === "number") {
        room.playback.positionMs = normalizePosition(action.positionMs);
      }
      room.playback.state = "playing";
      break;

    case "pause":
      if (action.mediaKey) room.playback.key = action.mediaKey;
      if (typeof action.positionMs === "number") {
        room.playback.positionMs = normalizePosition(action.positionMs);
      }
      room.playback.state = "paused";
      break;

    case "seek":
      if (action.mediaKey) room.playback.key = action.mediaKey;
      room.playback.positionMs = normalizePosition(action.positionMs);
      break;

    case "end":
      room.playback = {
        key: null,
        state: "paused",
        positionMs: 0,
        updatedAtMs: now,
      };
      break;
  }

  room.playback.updatedAtMs = now;
  room.seq += 1;
  room.lastHeartbeatMs = now;
  rememberAction(room, action.actionId);
}

function cleanupRoom(roomId: string) {
  rooms.delete(roomId);
}

io?.on("connection", async (socket) => {
  console.log(`WATCH TOGETHER [${socket.id}] connected`);

  const roomQuery = socket.handshake.query.room;
  if (!roomQuery || typeof roomQuery !== "string") {
    console.log(`WATCH TOGETHER [${socket.id}] disconnected: no room provided`);
    emitRoomError(socket, "invalid_room", "No room provided");
    return setTimeout(() => socket.disconnect(), 500);
  }

  const token = socket.handshake.auth.token;
  if (!token) {
    console.log(`WATCH TOGETHER [${socket.id}] disconnected: no token provided`);
    emitRoomError(socket, "invalid_auth", "No token provided");
    return setTimeout(() => socket.disconnect(), 500);
  }

  const user = await CheckPlexUser(token);
  if (!user) {
    console.log(`WATCH TOGETHER [${socket.id}] disconnected: invalid token`);
    emitRoomError(socket, "invalid_auth", "Invalid token");
    return setTimeout(() => socket.disconnect(), 500);
  }

  const roomResult = getOrCreateRoom(roomQuery, socket.id);
  if (!roomResult) {
    console.log(`WATCH TOGETHER [${socket.id}] disconnected: invalid room`);
    emitRoomError(socket, "invalid_room", "Invalid room");
    return setTimeout(() => socket.disconnect(), 500);
  }

  const { room, isHost } = roomResult;
  const member = createMember(socket, user);

  socketToRoom.set(socket.id, room.id);
  room.members.set(socket.id, member);
  room.lastHeartbeatMs = Date.now();

  socket.join(room.id);

  socket.emit(
    "wt:room:ready",
    {
      room: room.id,
      host: isHost,
      seq: room.seq,
      playback: getProjectedPlayback(room),
    } satisfies PerPlexed.WatchTogether.Ready
  );

  socket.to(room.id).emit("wt:member:joined", member);

  socket.on("wt:state:request", () => {
    const runtimeRoomId = socketToRoom.get(socket.id);
    if (!runtimeRoomId) return;
    const runtimeRoom = rooms.get(runtimeRoomId);
    if (!runtimeRoom) return;

    emitSocketState(socket, runtimeRoom, "sync");
  });

  socket.on("wt:heartbeat", () => {
    const runtimeRoomId = socketToRoom.get(socket.id);
    if (!runtimeRoomId) return;
    const runtimeRoom = rooms.get(runtimeRoomId);
    if (!runtimeRoom) return;

    runtimeRoom.lastHeartbeatMs = Date.now();
  });

  socket.on("wt:control", (rawAction: unknown) => {
    const runtimeRoomId = socketToRoom.get(socket.id);
    if (!runtimeRoomId) return;

    const runtimeRoom = rooms.get(runtimeRoomId);
    if (!runtimeRoom) return;

    const actor = runtimeRoom.members.get(socket.id);
    if (!actor) return;

    const parsed = validateControlAction(rawAction);
    if (!parsed.ok) {
      emitRoomError(socket, "invalid_action", parsed.message);
      return;
    }

    const action = parsed.action;
    if (runtimeRoom.recentActionSet.has(action.actionId)) {
      return;
    }

    applyControlAction(runtimeRoom, action);
    emitRoomState(runtimeRoom, actor, action.actionType);
  });

  socket.on("wt:room:leave", () => {
    socket.disconnect();
  });

  socket.on("disconnect", () => {
    console.log(`WATCH TOGETHER [${socket.id}] disconnected`);

    const runtimeRoomId = socketToRoom.get(socket.id);
    socketToRoom.delete(socket.id);

    if (!runtimeRoomId) return;
    const runtimeRoom = rooms.get(runtimeRoomId);
    if (!runtimeRoom) return;

    const leavingMember = runtimeRoom.members.get(socket.id) ?? member;
    runtimeRoom.members.delete(socket.id);

    if (socket.id === runtimeRoom.hostSocketId) {
      io?.to(runtimeRoom.id).emit(
        "wt:room:error",
        {
          type: "host_disconnect",
          message: "Host disconnected",
        } satisfies PerPlexed.WatchTogether.SocketError
      );

      const clients = io?.sockets.adapter.rooms.get(runtimeRoom.id);
      if (clients) {
        [...clients].forEach((clientId) => {
          if (clientId === socket.id) return;
          io?.sockets.sockets.get(clientId)?.disconnect();
        });
      }

      cleanupRoom(runtimeRoom.id);
      return;
    }

    socket.to(runtimeRoom.id).emit("wt:member:left", leavingMember);

    if (runtimeRoom.members.size === 0) {
      cleanupRoom(runtimeRoom.id);
    }
  });
});

function generateRoomId() {
  let id: string | null = null;
  let attempts = 0;

  do {
    id = crypto.randomBytes(3).toString("hex");
    attempts += 1;
  } while ((rooms.has(id) || !id) && attempts < 20);

  if (!id) throw new Error("Failed to generate room ID");

  return id;
}
