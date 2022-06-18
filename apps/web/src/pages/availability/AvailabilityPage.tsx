import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import { Permission, roleLabels } from '@surgiplan/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { api, errorMessage } from '@/api/client';
import { useUnavailability, useUserLookup } from '@/api/queries';
import type { Unavailability } from '@/api/types';
import { useAuth, useMe } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { fmt, hospitalInstant, hospitalToday, personName, shiftDate } from '@/lib/format';

const kinds: Record<Unavailability['kind'], { label: string; color: 'default' | 'primary' | 'secondary' | 'warning' | 'info' }> = {
  LEAVE: { label: 'İzin', color: 'primary' },
  DUTY: { label: 'Nöbet ertesi', color: 'warning' },
  CONGRESS: { label: 'Kongre', color: 'info' },
  OTHER: { label: 'Diğer', color: 'default' },
};

export default function AvailabilityPage() {
  const me = useMe();
  const { can } = useAuth();
  const manageAll = can(Permission.UnavailabilityManageAll);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const today = hospitalToday();
  const range = useMemo(() => ({ from: hospitalInstant(today, 0).toISOString(), to: hospitalInstant(shiftDate(today, 90), 0).toISOString() }), [today]);
  const { data = [] } = useUnavailability(range);
  const [open, setOpen] = useState(false);

  const remove = async (id: string) => {
    try {
      await api.delete(`/unavailability/${id}`);
      qc.invalidateQueries(['unavailability']);
      enqueueSnackbar('Kayıt silindi.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    }
  };

  return (
    <>
      <PageHeader
        title="İzin ve nöbet"
        subtitle="Girilen izinler, planlama sırasında çakışma olarak kontrol edilir."
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
            Kayıt ekle
          </Button>
        }
      />
      <Card>
        {!data.length ? (
          <EmptyState icon={<EventBusyRoundedIcon />} title="Önümüzdeki 90 günde kayıt yok" description="İzin, kongre ya da nöbet ertesi günlerinizi ekleyin; bu saatlere vaka planlanamaz." />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kişi</TableCell>
                  <TableCell>Tür</TableCell>
                  <TableCell>Başlangıç</TableCell>
                  <TableCell>Bitiş</TableCell>
                  <TableCell>Not</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <UserAvatar name={u.user.fullName} size={30} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {personName(u.user)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {roleLabels[u.user.role]}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={kinds[u.kind].label} color={kinds[u.kind].color} variant="outlined" />
                    </TableCell>
                    <TableCell>{fmt(u.startsAt, 'd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>{fmt(u.endsAt, 'd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>{u.note ?? '—'}</TableCell>
                    <TableCell align="right">
                      {(manageAll || u.userId === me.id) && (
                        <Tooltip title="Sil">
                          <IconButton size="small" onClick={() => remove(u.id)}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
      <NewUnavailabilityDialog open={open} onClose={() => setOpen(false)} manageAll={manageAll} />
    </>
  );
}

function NewUnavailabilityDialog({ open, onClose, manageAll }: { open: boolean; onClose: () => void; manageAll: boolean }) {
  const me = useMe();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: people = [] } = useUserLookup();
  const today = hospitalToday();
  const [form, setForm] = useState({ userId: me.id, kind: 'LEAVE', start: today, end: shiftDate(today, 1), note: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/unavailability', {
        userId: form.userId,
        kind: form.kind,
        startsAt: hospitalInstant(form.start, 0).toISOString(),
        endsAt: hospitalInstant(shiftDate(form.end, 1), 0).toISOString(),
        note: form.note || undefined,
      });
      qc.invalidateQueries(['unavailability']);
      enqueueSnackbar('Kayıt eklendi.', { variant: 'success' });
      onClose();
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 500 }}>İzin / nöbet kaydı</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {manageAll && (
            <TextField select label="Kişi" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              {people.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {personName(p)} · {roleLabels[p.role]}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField select label="Tür" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(kinds).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v.label}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField type="date" label="İlk gün" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="Son gün" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Box>
          <TextField label="Not" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Vazgeç
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={save} disabled={form.end < form.start}>
          Kaydet
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
