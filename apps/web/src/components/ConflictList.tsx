import { Alert, AlertTitle, Box, Stack, Typography } from '@mui/material';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import type { Conflict, ConflictKind } from '@surgiplan/shared';

const kindLabels: Record<ConflictKind, string> = {
  ROOM: 'Salon',
  TURNOVER: 'Temizlik',
  SURGEON: 'Operatör',
  ANESTHETIST: 'Anestezi',
  TEAM_MEMBER: 'Ekip',
  EQUIPMENT: 'Ekipman',
  UNAVAILABLE: 'İzin',
  OUTSIDE_HOURS: 'Mesai',
};

export function ConflictList({ conflicts }: { conflicts: Conflict[] }) {
  if (!conflicts.length) return null;
  const blocking = conflicts.filter((c) => c.blocking);
  const warnings = conflicts.filter((c) => !c.blocking);

  return (
    <Stack spacing={1.5}>
      {blocking.length > 0 && (
        <Alert severity="error" icon={<BlockRoundedIcon />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle sx={{ fontWeight: 500 }}>Bu saate planlanamaz</AlertTitle>
          <Rows items={blocking} />
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning" icon={<ReportProblemRoundedIcon />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle sx={{ fontWeight: 500 }}>Uyarı</AlertTitle>
          <Rows items={warnings} />
        </Alert>
      )}
    </Stack>
  );
}

function Rows({ items }: { items: Conflict[] }) {
  return (
    <Stack spacing={0.75}>
      {items.map((c, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
          <Typography
            component="span"
            sx={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', minWidth: 64, opacity: 0.8 }}
          >
            {kindLabels[c.kind]}
          </Typography>
          <Typography component="span" variant="body2">
            {c.message}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
