import type { PaletteMode } from '@mui/material';
import { createTheme, Theme } from '@mui/material/styles';
import { SurgeryStatus } from '@surgiplan/shared';

declare module '@mui/material/styles' {
  interface Palette {
    surface: { sunken: string; raised: string; border: string };
    navbar: { bg: string; text: string; muted: string; active: string };
  }
  interface PaletteOptions {
    surface?: { sunken: string; raised: string; border: string };
    navbar?: { bg: string; text: string; muted: string; active: string };
  }
}

export const statusColors: Record<SurgeryStatus, { main: string; soft: string; darkSoft: string }> = {
  DRAFT: { main: '#607d8b', soft: '#eceff1', darkSoft: '#263238' },
  PENDING_APPROVAL: { main: '#ad6800', soft: '#fff4e0', darkSoft: '#3b2c10' },
  SCHEDULED: { main: '#1565c0', soft: '#e3eefb', darkSoft: '#152a44' },
  PREPARING: { main: '#6a1b9a', soft: '#f2e7f7', darkSoft: '#2d1a3a' },
  IN_PROGRESS: { main: '#c62828', soft: '#fdeaea', darkSoft: '#401b1b' },
  COMPLETED: { main: '#2e7d32', soft: '#e8f3e9', darkSoft: '#1b3320' },
  POSTPONED: { main: '#d84315', soft: '#fdede6', darkSoft: '#3d2115' },
  CANCELLED: { main: '#757575', soft: '#f0f0f0', darkSoft: '#2a2a2a' },
};

export function statusTone(theme: Theme, status: SurgeryStatus) {
  const c = statusColors[status];
  return { main: c.main, soft: theme.palette.mode === 'dark' ? c.darkSoft : c.soft };
}

export function createAppTheme(mode: PaletteMode) {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#64a8e8' : '#1f4e79', contrastText: dark ? '#0b1a29' : '#fff' },
      secondary: { main: dark ? '#b39ddb' : '#5e35b1' },
      background: {
        default: dark ? '#14181d' : '#eef1f4',
        paper: dark ? '#1c2127' : '#ffffff',
      },
      divider: dark ? '#2c333b' : '#dde2e7',
      surface: {
        sunken: dark ? '#171b20' : '#f6f8fa',
        raised: dark ? '#222830' : '#ffffff',
        border: dark ? '#2c333b' : '#d6dce2',
      },
      navbar: {
        bg: dark ? '#0f1318' : '#1b2a3a',
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.68)',
        active: dark ? '#64a8e8' : '#7fb3e6',
      },
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: 'Roboto, "Segoe UI", Helvetica, Arial, sans-serif',
      h5: { fontWeight: 500, fontSize: '1.375rem' },
      h6: { fontWeight: 500, fontSize: '1rem' },
      subtitle2: { fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 500 },
      body2: { fontSize: '0.8125rem' },
      overline: { fontWeight: 500, letterSpacing: '0.06em', fontSize: '0.6875rem' },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: { defaultProps: { variant: 'outlined' } },
      MuiCardHeader: {
        styleOverrides: {
          root: { padding: '10px 16px', borderBottom: `1px solid ${dark ? '#2c333b' : '#dde2e7'}` },
          title: { fontSize: '0.9375rem', fontWeight: 500 },
          subheader: { fontSize: '0.75rem' },
        },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiAutocomplete: { defaultProps: { size: 'small' } },
      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 500, backgroundColor: dark ? '#20262d' : '#f6f8fa', color: dark ? '#b0bac4' : '#4a5663' },
          sizeSmall: { padding: '6px 12px' },
        },
      },
      MuiChip: { styleOverrides: { sizeSmall: { height: 22, fontSize: '0.75rem' } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 42 } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 42 } } },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.0625rem', fontWeight: 500 } } },
    },
  });
}
