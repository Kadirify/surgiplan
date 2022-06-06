import { Box } from '@mui/material';

export function Logo({ inverted = false, size = 19 }: { inverted?: boolean; size?: number }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: inverted ? '#fff' : 'text.primary',
        userSelect: 'none',
      }}
    >
      Surgi
      <Box component="span" sx={{ fontWeight: 400, color: inverted ? 'navbar.active' : 'primary.main' }}>
        Plan
      </Box>
    </Box>
  );
}
