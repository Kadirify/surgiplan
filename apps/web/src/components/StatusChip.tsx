import { Box, BoxProps, useTheme } from '@mui/material';
import { Priority, priorityLabels, SurgeryStatus, surgeryStatusLabels } from '@surgiplan/shared';
import { statusTone } from '@/theme';

export function StatusChip({ status, size = 'small', sx }: { status: SurgeryStatus; size?: 'small' | 'medium'; sx?: BoxProps['sx'] }) {
  const theme = useTheme();
  const tone = statusTone(theme, status);
  return (
    <Box
      component="span"
      sx={[
        {
          display: 'inline-block',
          px: 0.75,
          py: size === 'small' ? '1px' : '3px',
          fontSize: size === 'small' ? 12 : 13,
          fontWeight: 500,
          lineHeight: 1.5,
          borderRadius: '3px',
          whiteSpace: 'nowrap',
          color: tone.main,
          bgcolor: tone.soft,
          border: `1px solid ${tone.main}33`,
          verticalAlign: 'middle',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {surgeryStatusLabels[status]}
    </Box>
  );
}

export function PriorityChip({ priority }: { priority: Priority }) {
  if (priority === 'ELECTIVE') return null;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 0.5,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.6,
        borderRadius: '3px',
        verticalAlign: 'middle',
        color: '#fff',
        bgcolor: priority === 'EMERGENCY' ? 'error.main' : 'warning.main',
        textTransform: 'uppercase',
      }}
    >
      {priorityLabels[priority]}
    </Box>
  );
}
