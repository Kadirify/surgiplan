import { Box, Card, Skeleton, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
}

export function StatCard({ label, value, hint, loading }: Props) {
  return (
    <Card sx={{ px: 2, py: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 500, lineHeight: 1.3 }}>{loading ? <Skeleton width={48} /> : value}</Typography>
      {hint && (
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {hint}
        </Box>
      )}
    </Card>
  );
}
