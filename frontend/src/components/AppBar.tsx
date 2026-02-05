/* eslint-disable no-lone-blocks */
import { Theme } from "@emotion/react";
import {
  AppBar,
  Avatar,
  Backdrop,
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  ClickAwayListener,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Popper,
  SxProps,
  TextField,
  Typography,
  Grid
} from "@mui/material";
import React, { JSX, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { getAllLibraries, getSearch, getTranscodeImageURL } from "../plex";
import { useUserSessionStore } from "../states/UserSession";
import {
  BookmarkRounded,
  FavoriteRounded,
  FullscreenRounded,
  LogoutRounded,
  PeopleRounded,
  SearchRounded,
  SettingsRounded,
  ShortcutRounded,
} from "@mui/icons-material";
import { useSyncInterfaceState } from "./PerPlexedSync";
import { useSyncSessionState } from "../states/SyncSessionState";
import { config } from "..";
import { useBigReader } from "./BigReader";
import { useUserSettings } from "../states/UserSettingsState";
import { useBrowsePageOptions } from "../states/BrowsePageOptions";

const BarSide: SxProps<Theme> = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  height: "100%",
};

function Appbar() {
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const location = useLocation();
  const { room } = useSyncSessionState();
  const [, setSearchParams] = useSearchParams();
  const { settings } = useUserSettings();

  const { user } = useUserSessionStore();

  useEffect(() => {
    const onScroll = () => {
      setScrollAtTop(window.scrollY === 0);
    };

    window.addEventListener("scroll", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const [libraries, setLibraries] = useState<Plex.LibarySection[] | null>(null);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const navigate = useNavigate();

  useEffect(() => {
    getAllLibraries().then((res) => {
      const filtered = res.filter((library) => {
        const key = `LIBRARY_${library.uuid}`;
        const rawValue = settings[key];

        return rawValue === undefined || rawValue === "true";
      });

      setLibraries(filtered.filter((lib) => ["movie", "show"].includes(lib.type)));
    });
  }, [settings]);

  const showBrowseToggle = location.pathname.startsWith("/browse/");

  return (
    <AppBar
      sx={{
        position: "fixed",
        top: { xs: 12, md: 18 },
        left: { xs: 12, md: 24 },
        right: { xs: 12, md: 24 },
        width: "auto",
        background: "transparent",
        boxShadow: "none",
        border: "none",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        zIndex: 99,
      }}
    >
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        sx={{}}
      >
        <Typography
          sx={{
            width: "100%",
            textAlign: "center",
            fontWeight: 600,
            px: 2,
            fontSize: 18,
          }}
        >
          {user?.friendlyName ?? user?.username}
        </Typography>

        <Divider />

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            window.open("https://g.ipmake.dev/perplexed", "_blank");
          }}
        >
          <ListItemIcon>
            <FavoriteRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sponsor</ListItemText>
        </MenuItem>

        {!config.DISABLE_NEVU_SYNC && (
          <MenuItem
            onClick={() => {
              useSyncInterfaceState.getState().setOpen(true);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <PeopleRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText>Watch2Gether</ListItemText>
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            // toggle Fullscreen
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          }}
        >
          <ListItemIcon>
            <FullscreenRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Fullscreen</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            useBigReader.getState().setBigReader(`
--- Hint ---
You can right click on any library item at the top to view the entire library.

--- Browsing ---
CTRL + F - Search

--- Playback ---
Space / k - Play/Pause
Left Arrow / j - Back 10s
Right Arrow / l - Forward 10s
Up Arrow - Volume Up
Down Arrow - Volume Down 
S - Skip onscreen markers (intro, credits, etc)
            `);
          }}
        >
          <ListItemIcon>
            <ShortcutRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Shortcuts</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate("/settings/info");
          }}
        >
          <ListItemIcon>
            <SettingsRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("accAccessToken");
            window.location.reload();
          }}
        >
          <ListItemIcon>
            <LogoutRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      <Box
        sx={{
          width: "100%",
          maxWidth: "1400px",
          mx: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: { xs: 2, md: 3 },
          py: 1.25,
          borderRadius: "var(--app-radius-lg)",
          position: "relative",
          background: scrollAtTop
            ? "linear-gradient(135deg, rgba(36, 38, 60, 0.72), rgba(18, 19, 30, 0.65))"
            : "linear-gradient(135deg, rgba(36, 38, 60, 0.92), rgba(18, 19, 30, 0.92))",
          border: "1px solid var(--app-border)",
          boxShadow: scrollAtTop
            ? "0 18px 45px rgba(7, 8, 15, 0.35)"
            : "0 24px 60px rgba(7, 8, 15, 0.55)",
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}
      >
      <Box
        sx={{
          justifyContent: "flex-start",
          ...BarSide,
        }}
      >
        <img
          src="/logo.png"
          alt=""
          style={{
            height: 32,
            width: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 6px 14px rgba(7, 8, 15, 0.4))",
          }}
        />

        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1.5,
            ml: { xs: 2, md: 3 },
            height: "100%",
            flexWrap: "nowrap",
          }}
        >
          <HeadLink to="/" active={location.pathname === "/"}>
            Home
          </HeadLink>
          {!libraries && <CircularProgress size="small" />}
          {libraries?.slice(0, 4).map((library) => (
            <HeadLink
              to={`/browse/${library.key}`}
              key={library.key}
              library={library}
              active={location.pathname.includes(`/browse/${library.key}`)}
            >
              {library.title}
            </HeadLink>
          ))}
          {libraries && libraries.length > 4 && (
            <LibrariesDropdown libraries={libraries} />
          )}
        </Box>
      </Box>

      <Box
        sx={{
          justifyContent: "flex-end",
          ...BarSide,
          gap: 2,
        }}
      >
        {showBrowseToggle && <BrowsePageToggle />}
        <SearchBar />

        <IconButton
          onClick={() => {
            setSearchParams(
              new URLSearchParams({
                bkey: `/plextv/watchlist`,
              })
            );
          }}
        >
          <BookmarkRounded />
        </IconButton>

        {room && (
          <IconButton
            onClick={() => {
              useSyncInterfaceState.getState().setOpen(true);
            }}
          >
            <PeopleRounded />
          </IconButton>
        )}

        <Avatar
          src={user?.thumb}
          variant="square"
          alt=""
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            cursor: "pointer",

            "&:hover": {
              boxShadow: (theme) =>
                `0px 0px 20px 0px ${theme.palette.primary.main}`,
            },
            transition: "all 0.2s ease-in-out",
          }}
        />
      </Box>
      </Box>
    </AppBar>
  );
}

export default Appbar;

function BrowsePageToggle() {
  const { page, setPage } = useBrowsePageOptions();

  return (
    <ButtonGroup
      variant="text"
      sx={{
        height: 38,
        width: "auto",
        minWidth: { xs: 220, sm: 260, md: 320 },
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 999,
        padding: "2px",
        boxShadow: "none",
        transition: "all 0.2s ease",
        "&:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.12)",
        },
        "& .MuiButtonGroup-grouped": {
          flex: 1,
          minWidth: 0,
          border: "1px solid transparent",
          borderRadius: 0,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "none",
          fontSize: "0.9rem",
          padding: "5px 12px",
          whiteSpace: "nowrap",
          transition: "all 0.2s ease",
        },
        "& .MuiButtonGroup-grouped:not(:first-of-type)": {
          borderLeft: "none",
        },
        "& .MuiButtonGroup-grouped:first-of-type": {
          borderTopLeftRadius: 999,
          borderBottomLeftRadius: 999,
        },
        "& .MuiButtonGroup-grouped:last-of-type": {
          borderTopRightRadius: 999,
          borderBottomRightRadius: 999,
        },
      }}
    >
      <Button
        sx={{
          color:
            page === "recommendations"
              ? "var(--app-nav-pill-text)"
              : "var(--app-ink)",
          backgroundColor:
            page === "recommendations"
              ? "rgba(80, 70, 225, 0.35)"
              : "transparent",
          borderColor:
            page === "recommendations"
              ? "rgba(255, 255, 255, 0.2)"
              : "transparent",
          backdropFilter:
            page === "recommendations" ? "blur(12px)" : "none",
          WebkitBackdropFilter:
            page === "recommendations" ? "blur(12px)" : "none",
          "&:hover": {
            backgroundColor:
              page === "recommendations"
                ? "rgba(80, 70, 225, 0.45)"
                : "rgba(255, 255, 255, 0.08)",
          },
        }}
        onClick={() => setPage("recommendations")}
      >
        Recommended
      </Button>
      <Button
        sx={{
          color:
            page === "browse" ? "var(--app-nav-pill-text)" : "var(--app-ink)",
          backgroundColor:
            page === "browse" ? "rgba(80, 70, 225, 0.35)" : "transparent",
          borderColor:
            page === "browse"
              ? "rgba(255, 255, 255, 0.2)"
              : "transparent",
          backdropFilter: page === "browse" ? "blur(12px)" : "none",
          WebkitBackdropFilter: page === "browse" ? "blur(12px)" : "none",
          "&:hover": {
            backgroundColor:
              page === "browse"
                ? "rgba(80, 70, 225, 0.45)"
                : "rgba(255, 255, 255, 0.08)",
          },
        }}
        onClick={() => setPage("browse")}
      >
        Browse
      </Button>
    </ButtonGroup>
  );
}

function SearchBar() {
  const [searchAnchorEl, setSearchAnchorEl] =
    React.useState<null | HTMLElement>(null);
  const searchOpen = Boolean(searchAnchorEl);
  const searchAnchorElRef = React.useRef<HTMLElement | null>(null);
  const [searchValue, setSearchValue] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Plex.SearchResult[]>(
    []
  );
  const [searchLoading, setSearchLoading] = React.useState(false);

  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  useEffect(() => {
    // listen to strg + f

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (searchAnchorElRef.current) {
          searchAnchorElRef.current.blur();
          setSearchAnchorEl(null);
          return;
        }

        setSearchAnchorEl(document.getElementById("search-bar"));
        document.getElementById("search-bar")?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    searchAnchorElRef.current = searchAnchorEl;
  }, [searchAnchorEl]);

  useEffect(() => {
    setSelectedIndex(null);
    if (searchValue.length === 0) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);

    const delayDebounceFn = setTimeout(() => {
      getSearch(searchValue).then((res) => {
        if (!res) {
          setSearchLoading(false);
          return setSearchResults([]);
        }
        setSearchResults(
          res
            .filter(
              (item) =>
                (item.Metadata &&
                  ["movie", "show"].includes(item.Metadata.type)) ||
                item.Directory
            )
            .sort((a, b) => {
              // directories first
              if (a.Directory && !b.Directory) return -1;
              if (!a.Directory && b.Directory) return 1;
              return 0;
            })
            .slice(0, 8)
        );

        setSearchLoading(false);
      });
    }, 500); // Adjust the delay as needed

    return () => clearTimeout(delayDebounceFn);
  }, [searchValue]);

  return (
    <ClickAwayListener
      onClickAway={() => {
        if (!searchOpen) return;
        setSearchAnchorEl(null);
      }}
    >
      <Box>
        <Backdrop
          open={searchOpen}
          sx={{
            zIndex: 10000,
            backgroundColor: "var(--app-overlay)",
          }}
          onClick={() => {
            setSearchAnchorEl(null);
          }}
        />
        <TextField
          id="search-bar"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded />
              </InputAdornment>
            ),
          }}
          placeholder="Search"
          variant="outlined"
          size="small"
          onKeyDown={(e) => {
            switch (e.key) {
              case "Escape":
                setSearchAnchorEl(null);
                searchAnchorEl?.blur();
                break;
              case "ArrowDown":
                e.preventDefault();
                if (searchResults.length === 0) return;
                setSelectedIndex((prev) =>
                  prev === null
                    ? 0
                    : Math.min(prev + 1, searchResults.length - 1)
                );
                break;
              case "ArrowUp":
                e.preventDefault();
                if (searchResults.length === 0) return;
                if (selectedIndex === 0) return setSelectedIndex(null);

                setSelectedIndex((prev) =>
                  prev === null ? 0 : Math.max(prev - 1, 0)
                );
                break;
              case "Tab":
                e.preventDefault();
                if (searchResults.length === 0) return;
                // if it gets to the last item, then set to null
                if (selectedIndex === searchResults.length - 1)
                  return setSelectedIndex(null);
                setSelectedIndex((prev) =>
                  prev === null
                    ? 0
                    : Math.min(prev + 1, searchResults.length - 1)
                );
                break;
              case "Enter":
                if (searchValue.length === 0) return;

                if (selectedIndex !== null && searchResults.length > 0) {
                  if (searchResults[selectedIndex].Metadata?.ratingKey) {
                    setSearchParams(
                      new URLSearchParams({
                        mid:
                          searchResults[selectedIndex].Metadata?.ratingKey ||
                          "",
                      })
                    );
                  } else if (searchResults[selectedIndex].Directory) {
                    setSearchParams(
                      new URLSearchParams({
                        bkey: `/library/sections/${searchResults[selectedIndex].Directory?.librarySectionID}/genre/${searchResults[selectedIndex].Directory?.id}`,
                      })
                    );
                  }
                } else {
                  navigate(`/search/${encodeURIComponent(searchValue.trim())}`);
                }

                searchAnchorEl?.blur();
                setSearchAnchorEl(null);
                break;
            }
          }}
          onChange={(e) => {
            setSearchValue(e.target.value);
            //navigate(`/search/${encodeURIComponent(e.target.value.trim())}`);
          }}
          onFocus={(e) => {
            setSearchAnchorEl(e.currentTarget);
          }}
          sx={{
            zIndex: 11000,
            width: searchOpen
              ? { xs: "70vw", sm: "260px", md: "320px" }
              : { xs: "160px", sm: "210px", md: "240px" },
            transition: "all 0.25s ease",
            "& .MuiOutlinedInput-root": {
              borderRadius: 999,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.12)",
              },
              "&.Mui-focused": {
                backgroundColor: "rgba(255, 255, 255, 0.16)",
                borderColor: "rgba(255, 255, 255, 0.18)",
              },
            },
            "& .MuiInputAdornment-root svg": {
              color: "var(--app-ink-muted)",
            },
          }}
        />
        <Popper
          anchorEl={searchAnchorEl}
          open={searchOpen && searchValue.length > 0}
          placement="bottom-end"
          sx={{
            borderRadius: "16px",
            backgroundColor: "var(--app-surface-2)",
            border: "1px solid var(--app-border)",
            backdropFilter: "blur(10px)",
            transition: "width 0.2s ease-in-out",
            padding: "20px 10px",
            pt: "10px",

            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: searchOpen
              ? { xs: "90vw", sm: "280px", md: "320px" }
              : { xs: "80vw", sm: "240px", md: "260px" },
            zIndex: 11000,
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {searchLoading && (
            <Box
              sx={{ display: "flex", justifyContent: "center", width: "100%" }}
            >
              <CircularProgress />
            </Box>
          )}

          {!searchLoading && searchResults.length === 0 && (
            <Typography>No Results</Typography>
          )}

          {!searchLoading &&
            searchResults.length > 0 &&
            searchResults.map((item, index) => {
              if (item.Metadata) {
                return (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      width: "100%",
                      borderRadius: "12px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      padding: "7px 10px",

                      "&:hover": {
                      backgroundColor: "var(--app-accent-soft)",
                        transition: "all 0.2s ease-in-out",
                      },

                      ...(selectedIndex === index && {
                      backgroundColor: "var(--app-accent-soft)",
                      }),

                      transition: "all 0.4s ease-in-out",

                      userSelect: "none",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      searchAnchorEl?.blur();
                      setSearchAnchorEl(null);
                      if (item.Metadata?.ratingKey) {
                        setSearchParams({
                          mid: item.Metadata.ratingKey,
                        });
                      }
                    }}
                  >
                    <img
                      src={`${getTranscodeImageURL(
                        item.Metadata.thumb,
                        100,
                        100
                      )}`}
                      alt=""
                      style={{
                        aspectRatio: 1,
                        objectFit: "cover",
                        borderRadius: "4px",
                        width: 50,
                        height: 50,
                      }}
                    />

                    <Box
                      sx={{ ml: 2, display: "flex", flexDirection: "column" }}
                    >
                      <Typography>{item.Metadata.title}</Typography>

                      <Typography
                        sx={{
                          fontSize: 12,
                          color: "var(--app-ink-muted)",
                        }}
                      >
                        {item.Metadata.librarySectionTitle}
                      </Typography>
                    </Box>
                  </Box>
                );
              } else if (item.Directory) {
                return (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      width: "100%",
                      borderRadius: "12px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      padding: "7px 10px",

                      "&:hover": {
                      backgroundColor: "var(--app-accent-soft)",
                        transition: "all 0.2s ease-in-out",
                      },

                      ...(selectedIndex === index && {
                      backgroundColor: "var(--app-accent-soft)",
                      }),

                      transition: "all 0.4s ease-in-out",

                      userSelect: "none",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSearchParams(
                        new URLSearchParams({
                          bkey: `/library/sections/${item.Directory?.librarySectionID}/genre/${item.Directory?.id}`,
                        })
                      );
                      searchAnchorEl?.blur();
                      setSearchAnchorEl(null);
                    }}
                  >
                    <Typography>
                      {item.Directory.librarySectionTitle} -{" "}
                      {item.Directory.tag}
                    </Typography>
                  </Box>
                );
              }
              return null;
            })}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
}

function LibrariesDropdown({ libraries }: { libraries: Plex.LibarySection[] }) {
  const [librariesAnchorEl, setLibrariesAnchorEl] = React.useState<null | HTMLElement>(null);
  const librariesOpen = Boolean(librariesAnchorEl);
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const remainingLibraries = libraries.slice(4);

  return (
    <>
      <Box
        sx={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => setLibrariesAnchorEl(e.currentTarget)}
        onMouseLeave={() => setLibrariesAnchorEl(null)}
      >
        <Typography
          sx={{
            textDecoration: "none",
            color: "var(--app-ink)",
            fontWeight: 600,
            transition: "all 0.2s ease-in-out",
            letterSpacing: "0.01em",
            userSelect: "none",
            cursor: "pointer",
            "&:hover": {
              color: (theme) => theme.palette.primary.light,
            },
          }}
        >
          +{remainingLibraries.length} more
        </Typography>

        <Popper
          anchorEl={librariesAnchorEl}
          open={librariesOpen}
          placement="bottom-start"
          sx={{
            zIndex: 12000,
            mt: 1,
          }}
        >
          <Box
            sx={{
              backgroundColor: "var(--app-surface-2)",
              backdropFilter: "blur(20px)",
              borderRadius: "16px",
              border: "1px solid var(--app-border)",
              boxShadow: "var(--app-shadow)",
              padding: "15px",
              maxWidth: "600px",
              maxHeight: "400px",
              minWidth: "300px",
              overflow: "hidden",
            }}
            onMouseEnter={() => setLibrariesAnchorEl(librariesAnchorEl)}
            onMouseLeave={() => setLibrariesAnchorEl(null)}
          >
            <Box
              sx={{
                maxHeight: "370px",
                overflowY: "auto",
                paddingRight: "5px",
                "&::-webkit-scrollbar": {
                  width: "4px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                        background: "rgba(184, 189, 219, 0.35)",
                        borderRadius: "2px",
                      },
                      "&::-webkit-scrollbar-thumb:hover": {
                        background: "rgba(184, 189, 219, 0.55)",
                      },
                    }}
                  >
                    <Grid container spacing={1.5}>
                {remainingLibraries.map((library) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={library.key}>
                    <Box
                      sx={{
                        padding: "12px 16px",
                        cursor: "pointer",
                        transition: "all 0.2s ease-in-out",
                        borderRadius: "4px",
                        textAlign: "left",
                        minHeight: "48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        width: "100%",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        "&:hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.12)",
                          transform: "translateY(-1px)",
                        },
                      }}
                      onClick={() => {
                        navigate(`/browse/${library.key}`);
                        setLibrariesAnchorEl(null);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSearchParams(
                          new URLSearchParams({
                            bkey: `/library/sections/${library.key}/all`,
                          })
                        );
                        setLibrariesAnchorEl(null);
                      }}
                      >
                        <Typography
                          sx={{
                          fontWeight: 500,
                          fontSize: "14px",
                          lineHeight: "1.3",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          width: "100%",
                        }}
                      >
                        {library.title}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>
        </Popper>
      </Box>
    </>
  );
}

function HeadLink({
  to,
  library,
  children,
  active,
}: {
  to: string;
  library?: Plex.LibarySection;
  children: React.ReactNode;
  active?: boolean;
}): JSX.Element {
  const [, setSearchParams] = useSearchParams();
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        px: 2,
        py: 0.75,
        borderRadius: 999,
        textDecoration: "none",
        color: active ? "var(--app-nav-pill-text)" : "var(--app-ink)",
        backgroundColor: active ? "rgba(80, 70, 225, 0.35)" : "transparent",
        backdropFilter: active ? "blur(12px)" : "none",
        WebkitBackdropFilter: active ? "blur(12px)" : "none",
        border: active ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid transparent",
        fontWeight: active ? 700 : 500,
        fontSize: "0.95rem",
        letterSpacing: "0.01em",
        transition: "all 0.2s ease",
        userSelect: "none",
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
        "&:hover": {
          backgroundColor: active
            ? "rgba(80, 70, 225, 0.45)"
            : "rgba(255,255,255,0.08)",
          color: active ? "var(--app-nav-pill-text)" : "var(--app-ink)",
        },
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (library)
          setSearchParams(
            new URLSearchParams({
              bkey: `/library/sections/${library.key}/all`,
            })
          );
      }}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Box>
  );
}
