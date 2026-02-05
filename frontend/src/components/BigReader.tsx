import { Backdrop, Box, Button, Typography } from "@mui/material";
import React from "react";
import { create } from "zustand";

interface BigReaderState {
  bigReader: string | null;
  setBigReader: (bigReader: string) => void;
  closeBigReader: () => void;
}

export const useBigReader = create<BigReaderState>((set) => ({
  bigReader: null,
  setBigReader: (bigReader) => set({ bigReader }),
  closeBigReader: () => set({ bigReader: null }),
}));

function BigReader() {
  const { bigReader, closeBigReader } = useBigReader();
  if (!bigReader) return null;
  return (
    <Backdrop
      open={Boolean(bigReader)}
      onClick={closeBigReader}
      sx={{
        zIndex: "100000",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "600px",
          maxheight: "500px",
          backgroundColor: "var(--app-surface)",
          border: "1px solid var(--app-border)",
          padding: "20px",
          borderRadius: "18px",
          boxShadow: "0 22px 45px rgba(8, 4, 2, 0.5)",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography
          sx={{
            fontSize: "1rem",
            fontWeight: "light",
            color: "var(--app-ink)",
            mb: "10px",
            whiteSpace: "pre-wrap",
          }}
        >
          {bigReader}
        </Typography>

        <Button onClick={closeBigReader}>Close</Button>
      </Box>
    </Backdrop>
  );
}

export default BigReader;
