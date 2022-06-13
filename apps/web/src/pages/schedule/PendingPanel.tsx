import { Box, Card, Chip, Stack, Typography } from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import type { Surgery } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { PriorityChip, StatusChip } from '@/components/StatusChip';
import { duration, fmt } from '@/lib/format';
import { DRAG_MIME } from './DayBoard';

interface Props {
  items: Surgery[];
  onOpen: (id: string) => void;
  onDragStart: (s: Surgery) => void;
  onDragEnd: () => void;
}

export function PendingPanel({ items, onOpen, onDragStart, onDragEnd }: Props) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 250px)', minHeight: 360 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Planlanmayı bekleyenler
        </Typography>
        <Chip size="small" label={items.length} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 1.25 }}>
        Kartı takvimde bir salona sürükleyin.
      </Typography>
      <Box sx={{ overflowY: 'auto', p: 1.5, flex: 1 }}>
        {!items.length ? (
          <EmptyState icon={<InboxRoundedIcon />} title="Bekleyen talep yok" description="Yeni talepler geldiğinde burada listelenir." />
        ) : (
          <Stack spacing={1}>
            {items.map((s) => (
              <Box
                key={s.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, s.id);
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStart(s);
                }}
                onDragEnd={onDragEnd}
                onClick={() => onOpen(s.id)}
                sx={{
                  p: 1.25,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  cursor: 'grab',
                  display: 'flex',
                  gap: 1,
                  transition: 'border-color .15s, box-shadow .15s',
                  '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 14px rgba(15,40,45,.08)' },
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <DragIndicatorRoundedIcon sx={{ fontSize: 18, color: 'text.disabled', mt: 0.25 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                    <StatusChip status={s.status} sx={{ height: 20, fontSize: 11 }} />
                    <PriorityChip priority={s.priority} />
                  </Box>
                  <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 500 }}>
                    {s.procedure.name}
                  </Typography>
                  <Typography noWrap variant="caption" color="text.secondary" component="div">
                    {s.surgeon.fullName} · {duration(s.estimatedMinutes)}
                  </Typography>
                  {s.requestedDate && (
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                      İstenen: {fmt(s.requestedDate, 'd MMM EEE')}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Card>
  );
}
