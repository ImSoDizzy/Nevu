import { createTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#5046E1",
      dark: "#3D35C6",
      light: "#6E63F2",
    },
    secondary: {
      main: "#8A82FF",
      dark: "#6B63DF",
      light: "#A29CFF",
    },
    background: {
      default: "#12131B",
      paper: "#1A1B26",
    },
    text: {
      primary: "#F2F3FF",
      secondary: "#B8BDDB",
    },
    divider: "rgba(184, 189, 219, 0.12)",
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Rubik Variable", "Rubik", sans-serif',
    h1: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h2: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h3: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      fontWeight: 700,
    },
    h4: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      fontWeight: 600,
    },
    button: {
      fontFamily: '"Rubik Variable", "Rubik", sans-serif',
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0.02em",
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 999,
          padding: "10px 20px",
          transition: "all 0.25s ease",
          fontWeight: 600,
          "&:focus-visible": {
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.35)}`,
          },
        }),
        contained: ({ theme }) => ({
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
          color: theme.palette.common.white,
          boxShadow: "0 16px 30px rgba(8, 9, 18, 0.45)",
          "&:hover": {
            background: `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
            transform: "translateY(-1px)",
            boxShadow: "0 18px 34px rgba(8, 9, 18, 0.55)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        }),
        outlined: ({ theme }) => ({
          borderColor: alpha(theme.palette.common.white, 0.18),
          color: theme.palette.text.primary,
          backgroundColor: alpha(theme.palette.common.white, 0.04),
          "&:hover": {
            borderColor: alpha(theme.palette.common.white, 0.3),
            backgroundColor: alpha(theme.palette.common.white, 0.08),
            transform: "translateY(-1px)",
          },
        }),
        text: ({ theme }) => ({
          color: theme.palette.text.primary,
          "&:hover": {
            backgroundColor: alpha(theme.palette.common.white, 0.06),
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          width: 40,
          height: 40,
          borderRadius: 12,
          color: theme.palette.text.primary,
          backgroundColor: alpha(theme.palette.common.white, 0.04),
          border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: alpha(theme.palette.common.white, 0.1),
            transform: "translateY(-1px)",
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
          borderRadius: 16,
          boxShadow: "0 16px 40px rgba(8, 9, 18, 0.45)",
          backdropFilter: "blur(18px)",
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.background.paper, 0.9),
          border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
          borderRadius: 18,
          boxShadow: "0 18px 45px rgba(8, 9, 18, 0.45)",
          transition: "transform 0.25s ease, box-shadow 0.25s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 22px 55px rgba(8, 9, 18, 0.55)",
          },
        }),
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(8, 9, 18, 0.55)",
        }),
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(8, 9, 18, 0.55)",
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          borderRadius: 18,
          boxShadow: "0 22px 55px rgba(8, 9, 18, 0.6)",
        }),
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          "& .MuiOutlinedInput-root": {
            borderRadius: 999,
            backgroundColor: alpha(theme.palette.common.white, 0.06),
            backdropFilter: "blur(12px)",
            transition: "all 0.2s ease",
            "&:hover": {
              backgroundColor: alpha(theme.palette.common.white, 0.1),
            },
            "&.Mui-focused": {
              backgroundColor: alpha(theme.palette.common.white, 0.12),
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`,
            },
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(theme.palette.common.white, 0.18),
            },
          },
        }),
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: ({ theme }) => ({
          color: theme.palette.text.secondary,
        }),
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          margin: "4px 6px",
          transition: "all 0.2s ease",
          "&:hover": {
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
          },
        }),
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: alpha(theme.palette.common.white, 0.08),
          border: `1px solid ${alpha(theme.palette.common.white, 0.16)}`,
          borderRadius: 999,
          "&:hover": {
            backgroundColor: alpha(theme.palette.common.white, 0.12),
          },
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: ({ theme }) => ({
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 999,
          padding: "8px 18px",
          "&.Mui-selected": {
            backgroundColor: alpha(theme.palette.primary.main, 0.2),
            color: theme.palette.primary.light,
          },
        }),
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: alpha(theme.palette.common.white, 0.1),
        }),
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: ({ theme }) => ({
          "& .MuiSwitch-track": {
            backgroundColor: alpha(theme.palette.common.white, 0.2),
          },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
            backgroundColor: theme.palette.primary.main,
          },
        }),
      },
    },
  },
});

export default theme;
