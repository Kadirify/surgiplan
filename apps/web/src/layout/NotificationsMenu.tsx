import { Badge, Box, Button, Divider, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { keys, useNotifications } from '@/api/queries';
import type { AppNotification } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { relative } from '@/lib/format';

const typeColors: Record<string, string> = {
  'surgery.scheduled': '#1d4ed8',
  'surgery.rescheduled': '#b45309',
  'surgery.cancelled': '#dc2626',
  'surgery.postponed': '#c2410c',
  'surgery.pending': '#0f766e',
  'surgery.returned': '#7c3aed',
  'surgery.draft': '#64748b',
};

export function NotificationsMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data } = useNotifications();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    if (!n.readAt) api.post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries(keys.notifications));
    setAnchor(null);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await api.post('/notifications/read-all');
    qc.invalidateQueries(keys.notifications);
  };

  return (
    <>
      <Tooltip title="Bildirimler">
        <IconButton color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge color="error" badgeContent={data?.unreadCount ?? 0} max={9}>
            <NotificationsNoneRoundedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ elevation: 4, sx: { width: 380, maxWidth: 'calc(100vw - 24px)', mt: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            Bildirimler
          </Typography>
          {!!data?.unreadCount && (
            <Button size="small" startIcon={<DoneAllRoundedIcon />} onClick={markAll}>
              Tümünü okundu say
            </Button>
          )}
        </Box>
        <Divider />
        <Box sx={{ maxHeight: 440, overflowY: 'auto' }}>
          {!data?.items.length ? (
            <EmptyState icon={<NotificationsNoneRoundedIcon />} title="Bildirim yok" description="Size atanan vakalar ve plan değişiklikleri burada görünecek." />
          ) : (
            <Stack divider={<Divider />}>
              {data.items.map((n) => (
                <Box
                  key={n.id}
                  onClick={() => open(n)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    display: 'flex',
                    gap: 1.5,
                    cursor: n.link ? 'pointer' : 'default',
                    bgcolor: n.readAt ? 'transparent' : 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <Box sx={{ width: 8, height: 8, mt: 0.9, borderRadius: '50%', flexShrink: 0, bgcolor: n.readAt ? 'transparent' : typeColors[n.type] ?? 'primary.main' }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: n.readAt ? 500 : 650 }}>
                      {n.title}
                    </Typography>
                    {n.body && (
                      <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {n.body}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {relative(n.createdAt)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Popover>
    </>
  );
}
