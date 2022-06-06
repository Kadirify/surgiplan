import { PaletteMode } from '@mui/material';
import { createContext, useContext } from 'react';

export const ColorModeContext = createContext<{ mode: PaletteMode; setMode: (mode: PaletteMode) => void }>({
  mode: 'light',
  setMode: () => undefined,
});

export const useColorMode = () => useContext(ColorModeContext);
