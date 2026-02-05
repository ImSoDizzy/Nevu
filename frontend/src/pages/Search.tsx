import { Box, CircularProgress, Grid, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getSearch } from "../plex";
import MovieItem from "../components/MovieItem";

export default function Search() {
  const { query } = useParams();
  const [, setSearchParams] = useSearchParams();

  const [results, setResults] = useState<Plex.Metadata[] | null>(null);
  const [directories, setDirectories] = useState<Plex.Directory[] | null>(null);

  useEffect(() => {
    setResults(null);
    setDirectories(null);

    if (!query) return;

    const delayDebounceFn = setTimeout(() => {
      getSearch(query).then((res) => {
        if (!res) return setResults([]);
        setResults(
          res
            .filter(
              (item) =>
                item.Metadata && ["movie", "show"].includes(item.Metadata.type)
            )
            .map((item) => item.Metadata)
            .filter(
              (metadata): metadata is Plex.Metadata => metadata !== undefined
            )
        );

        setDirectories(
          res
            .filter((item) => item.Directory)
            .map((item) => item.Directory)
            .filter(
              (directory): directory is Plex.Directory =>
                directory !== undefined
            )
        );
      });
    }, 500); // Adjust the delay as needed

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <Box
      className="app-page"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        height: "100%",
        width: "100%",
        mt: 0,
        px: 0,
        py: 0,
      }}
    >
      <Typography variant="h3" sx={{ mt: 2 }}>
        {query ? (
          <>
            Results for <strong>{query}</strong>
          </>
        ) : (
          "Use Search Bar to Search"
        )}
      </Typography>

      {!results && <CircularProgress sx={{ mt: 4 }} />}

      <Grid container spacing={2} sx={{ mt: 2, width: "100%" }}>
        {directories && directories.length > 0 && (
          <>
            <Grid key={"dir"} size={{ xs: 12 }}>
              <Typography variant="h4">Categories</Typography>
            </Grid>

            {directories.map((item) => (
              <Grid key={item.key} size={{ xl: 2, lg: 3, md: 6, sm: 12, xs: 12 }}>
                <DirectoryItem
                  item={item}
                  onClick={() => {
                    setSearchParams(
                      new URLSearchParams({
                        bkey: `/library/sections/${item.librarySectionID}/genre/${item.id}`,
                      })
                    );
                  }}
                />
              </Grid>
            ))}

            <Grid key={"dir"} size={{ xs: 12 }}></Grid>
          </>
        )}

        {results &&
          results.map((item) => (
            <Grid
              key={item.ratingKey}
              size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}
            >
              <MovieItem item={item} />
            </Grid>
          ))}
      </Grid>
    </Box>
  );
}

export function DirectoryItem({
  item,
  onClick,
}: {
  item: Plex.Directory;
  onClick: () => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        p: 2.5,
        background: "var(--app-surface-2)",
        border: "1px solid var(--app-border)",
        boxShadow: "0 16px 32px rgba(7, 8, 15, 0.35)",
        cursor: "pointer",

        "&:hover": {
          background: "var(--app-surface-3)",
        },
        userSelect: "none",
      }}
      onClick={onClick}
    >
      <Typography variant="h5">
        {item.librarySectionTitle} - {item.tag}
      </Typography>
    </Box>
  );
}
