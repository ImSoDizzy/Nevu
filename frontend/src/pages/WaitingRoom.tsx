import { Box, Button, LinearProgress, Typography } from "@mui/material";
import React, { useEffect } from "react";
import { useSyncSessionState } from "../states/SyncSessionState";
import { useSyncInterfaceState } from "../components/PerPlexedSync";
import { useNavigate } from "react-router-dom";

function WaitingRoom() {
  const [loading] = React.useState(true);

  const { room, isHost, playback, requestState } = useSyncSessionState();
  const { setOpen } = useSyncInterfaceState();
  const navigate = useNavigate();

  useEffect(() => {
    if (isHost || !room) navigate("/");
  }, [room, isHost, navigate]);

  useEffect(() => {
    if (!room) return;
    requestState();
  }, [requestState, room]);

  useEffect(() => {
    if (!room || !playback?.key) return;
    navigate(`/watch/${playback.key}?t=${Math.floor(playback.positionMs)}`);
  }, [navigate, playback?.key, playback?.positionMs, room]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "100vh",

        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <img
        src="/logoBig.png"
        alt="NEVU"
        style={{
          width: "30vw",
          height: "auto",
          display: "block",
        }}
      />

      <Typography
        sx={{
          fontSize: "24px",
          fontWeight: "bold",
          textAlign: "center",
          marginTop: "20px",
        }}
      >
        Waiting for playback to start...
      </Typography>

      {loading && (
        <LinearProgress
          sx={{
            width: "200px",
            marginTop: "20px",
          }}
        />
      )}

      <Button onClick={() => setOpen(true)} sx={{ marginTop: "20px" }}>
        Open Sync Interface
      </Button>
    </Box>
  );
}

export default WaitingRoom;
