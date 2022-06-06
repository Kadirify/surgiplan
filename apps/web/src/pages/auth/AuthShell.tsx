import { Box, Paper, Typography } from '@mui/material';
import { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ height: 52, bgcolor: 'navbar.bg', display: 'flex', alignItems: 'center', px: 3 }}>
        <Logo inverted />
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', px: 2, pt: { xs: 4, sm: '12vh' } }}>
        <Box sx={{ width: '100%', maxWidth: 380 }}>
          <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
            {children}
          </Paper>
          {footer}
          <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: 'center', mt: 3 }}>
            SurgiPlan Ameliyathane Planlama Sistemi · v1.4.2
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
