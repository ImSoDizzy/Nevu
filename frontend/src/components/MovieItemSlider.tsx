import { Box, Typography } from "@mui/material";
import React from "react";
import { getLibraryDir } from "../plex";
import { ArrowForwardIosRounded } from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import MovieItem from "./MovieItem";

function MovieItemSlider({
  title,
  dir,
  props,
  filter,
  link,
  shuffle,
  data,
  plexTvSource,
}: {
  title: string;
  dir?: string;
  props?: { [key: string]: any };
  filter?: (item: Plex.Metadata) => boolean;
  link?: string;
  shuffle?: boolean;
  data?: Plex.Metadata[];
  plexTvSource?: boolean;
}) {
  const [, setSearchParams] = useSearchParams();
  const [items, setItems] = React.useState<Plex.Metadata[] | null>(
    data ?? null
  );

  const [currPage, setCurrPage] = React.useState(0);

  const calculateItemsPerPage = (width: number) => {
    if (width < 400) return 1;
    if (width < 600) return 1;
    if (width < 1200) return 2;
    if (width < 1500) return 4;
    if (width < 2000) return 5;
    if (width < 3000) return 6;
    if (width < 4000) return 7;
    if (width < 5000) return 8;
    return 6;
  };

  const [itemsPerPage, setItemsPerPage] = React.useState(
    calculateItemsPerPage(window.innerWidth)
  );
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = React.useState(0);
  const itemGap = 16;
  const edgeWidth = 56;

  React.useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(calculateItemsPerPage(window.innerWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (!trackRef.current) return;
    const element = trackRef.current;
    const updateWidth = () => {
      setTrackWidth(element.getBoundingClientRect().width);
    };
    updateWidth();
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      setTrackWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  const fetchData = async () => {
    if (!dir) return;

    getLibraryDir(dir, props).then((res) => {
      // cut the array down so its a multiple of itemsPerPage
      if (!res.Metadata) return;

      let media: Plex.Metadata[] = res.Metadata;
      if (filter) media = res.Metadata.filter(filter);

      if (!media) return;
      setItems(shuffle ? shuffleArray(media) : media);
    });
  };

  React.useEffect(() => {
    if (data) return setItems(data);

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dir, filter, props, shuffle]);

  if (!items || items.length === 0) return <></>;

  const itemCount = items.slice(0, itemsPerPage * 5).length;
  const visibleWidth = Math.max(trackWidth - edgeWidth * 2, 0);
  const itemWidth =
    itemsPerPage && visibleWidth
      ? (visibleWidth - itemGap * (itemsPerPage - 1)) / itemsPerPage
      : undefined;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        width: "100%",
        height: "auto",
        gap: "12px",
        position: "relative",
        zIndex: 1,
        "&:hover": {
          zIndex: 5,
        },
      }}
    >
      <Box
        sx={{
          width: "100%",
          height: "auto",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          px: 0,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            mb: "-10px",
            cursor: link ? "pointer" : "default",
            "&:hover": {
              gap: "20px",
            },
            "&:hover > :nth-child(2)": {
              opacity: 1,
              gap: "5px",
            },
            transition: "all 0.5s ease",
            userSelect: "none",
          }}
          onClick={() => {
            if (link)
              setSearchParams(
                new URLSearchParams({
                  bkey: link,
                })
              );
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: "1.4rem", md: "1.9rem" },
              fontWeight: 700,
              letterSpacing: "0.02em",
              mb: "0px",
            }}
          >
            {title}
          </Typography>

          {link && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                mt: "0px",
                opacity: 0,
                gap: "0px",
                transition: "all 0.5s ease",
                color: "var(--app-ink-muted)",
              }}
            >
              <Typography sx={{ fontSize: "0.95rem", fontWeight: 600 }}>
                Browse
              </Typography>
              <ArrowForwardIosRounded fontSize="small" />
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            visibility: itemCount > itemsPerPage ? "visible" : "hidden",
          }}
        >
          {Array(Math.ceil(itemCount / itemsPerPage))
            .fill(0)
            .map((_, i) => {
              return (
                <Box
                  sx={{
                    width: "18px",
                    height: "3px",
                    borderRadius: "999px",
                    backgroundColor:
                      i === currPage
                        ? "var(--app-nav-pill)"
                        : "rgba(255,255,255,0.25)",
                    transition: "all 0.5s ease",
                    mx: "2px",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setCurrPage(i);
                  }}
                />
              );
            })}
        </Box>
      </Box>
      <Box
        ref={trackRef}
        sx={{
          width: "100%",
          height: "auto",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",

          py: 1.5,
          whiteSpace: "nowrap",
          // clipPath: "inset(0px 0px -10px 0px)",
          overflowX: "hidden",
          overflowY: "visible",
          position: "relative",
        }}
      >
        <Box
          sx={{
            width: `${edgeWidth}px`,
            height: "100%",
            position: "absolute",
            left: "0px",
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(20, 10, 6, 0.35)",
            backdropFilter: "blur(8px)",
            borderTopLeftRadius: "14px",
            borderBottomLeftRadius: "14px",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            visibility: itemCount > itemsPerPage ? "visible" : "hidden",

            "&:hover": {
              backgroundColor: "rgba(20, 10, 6, 0.65)",
            },

            transition: "all 0.5s ease",
          }}
          onClick={() => {
            setCurrPage((currPage) =>
              currPage - 1 < 0
                ? Math.ceil(itemCount / itemsPerPage) - 1
                : currPage - 1
            );
          }}
        >
          <ArrowForwardIosRounded
            sx={{
              transform: "rotate(180deg)",
            }}
            fontSize="large"
          />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            transform: `translateX(${edgeWidth - currPage * visibleWidth}px)`,
            alignItems: "flex-start",
            justifyContent: "center",
            width: "max-content",
            gap: `${itemGap}px`,
            transition: "transform 0.8s ease",
          }}
        >
          {items?.slice(0, itemsPerPage * 5).map((item, i) => {
            const start = currPage * itemsPerPage - itemsPerPage;
            const end = currPage * itemsPerPage + itemsPerPage * 2;

            if (i >= start && i < end) {
              return (
                <MovieItem
                  key={item.ratingKey}
                  item={item}
                  itemsPerPage={itemsPerPage}
                  itemWidth={itemWidth}
                  index={i}
                  PlexTvSource={plexTvSource}
                  refetchData={
                    dir && dir.endsWith("onDeck") ? fetchData : undefined
                  }
                />
              );
            } else {
              return (
                <Box
                  style={{
                    width: itemWidth ? `${itemWidth}px` : "200px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "16px",
                    border: "1px solid var(--app-border)",
                  }}
                  key={i}
                >
                  <Box
                    sx={{ width: "100%", height: "auto", aspectRatio: "16/9" }}
                  />
                  <Box sx={{ width: "100%", height: "104px" }} />
                </Box>
              );
            }
          })}
        </Box>
        <Box
          sx={{
            width: `${edgeWidth}px`,
            height: "100%",
            position: "absolute",
            right: "0px",
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(20, 10, 6, 0.35)",
            backdropFilter: "blur(8px)",
            borderTopRightRadius: "14px",
            borderBottomRightRadius: "14px",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            visibility: itemCount > itemsPerPage ? "visible" : "hidden",

            "&:hover": {
              backgroundColor: "rgba(20, 10, 6, 0.65)",
            },

            transition: "all 0.5s ease",
          }}
          onClick={() => {
            setCurrPage(
              currPage + 1 > Math.ceil(itemCount / itemsPerPage) - 1
                ? 0
                : currPage + 1
            );
          }}
        >
          <ArrowForwardIosRounded fontSize="large" />
        </Box>
      </Box>
    </Box>
  );
}

export default MovieItemSlider;

export function durationToText(duration: number): string {
  const hours = Math.floor(duration / 1000 / 60 / 60);
  const minutes = (duration / 1000 / 60 / 60 - hours) * 60;

  return (
    (hours > 0 ? `${hours}h` : "") +
    (Math.floor(minutes) > 0 ? ` ${Math.floor(minutes)}m` : "")
  ).trim();
}

export const shuffleArray = (array: any[]) => {
  const oldArray = [...array];
  const newArray = [];

  while (oldArray.length) {
    const index = Math.floor(Math.random() * oldArray.length);
    newArray.push(oldArray.splice(index, 1)[0]);
  }

  return newArray;
};
