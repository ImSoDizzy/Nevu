import { Box, Typography } from "@mui/material";
import React from "react";
import { useStartupState } from "./Startup";

function Utility() {
  const { lastStatus, frontEndStatus } = useStartupState();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "var(--app-bg)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          px: "2.5vw",
          py: "1.5vh",
          width: "700px",
          height: "auto",
          backgroundColor: "var(--app-surface)",
          border: "1px solid var(--app-border)",
          borderRadius: "18px",
          boxShadow: "0 22px 45px rgba(8, 4, 2, 0.5)",
        }}
      >
        <Typography
          sx={{
            color: "var(--app-ink)",
            fontSize: "2rem",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          NEVU has encountered an error
        </Typography>

        {lastStatus?.error && (
          <Typography
            sx={{
              color: "var(--app-accent)",
              fontSize: "1rem",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "20px",
              whiteSpace: "pre-wrap",
            }}
          >
            {lastStatus.message.split(" ").map((word, index) => (
              <React.Fragment key={index}>
                {word.match(/https?:\/\/[^\s]+/) ? (
                  <>
                    <br />
                    <br />
                      <a
                        href={word}
                        style={{ color: "var(--app-ink)", textDecoration: "underline" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                      {word}
                    </a>
                    <br />
                  </>
                ) : (
                  word + " "
                )}
              </React.Fragment>
            ))}
          </Typography>
        )}

        {frontEndStatus?.error && (
            <Typography
                sx={{
                color: "var(--app-accent)",
                fontSize: "1rem",
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "20px",
                whiteSpace: "pre-wrap",
                }}
            >
                {frontEndStatus.message.split(" ").map((word, index) => (
                <React.Fragment key={index}>
                    {word.match(/https?:\/\/[^\s]+/) ? (
                    <>
                        <br />
                        <br />
                        <a
                        href={word}
                        style={{ color: "var(--app-ink)", textDecoration: "underline" }}
                        target="_blank"
                        rel="noopener noreferrer"
                        >
                        {word}
                        </a>
                        <br />
                    </>
                    ) : (
                    word + " "
                    )}
                </React.Fragment>
                ))}
            </Typography>
        )}
      </Box>
    </Box>
  );
}

export default Utility;
