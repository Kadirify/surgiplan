import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ForwardToInboxRoundedIcon from '@mui/icons-material/ForwardToInboxRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { Role, roleLabels, ROLES } from '@surgiplan/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/api/client';
import { useBranches, useUserLookup, useUsers } from '@/api/queries';
import type { UserRow, UserStatus } from '@/api/types';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { personName, relative } from '@/lib/format';

const statusChip: Record<UserStatus, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  ACTIVE: { label: 'Aktif', color: 'success' },
  INVITED: { label: 'Davet bekliyor', color: 'warning' },
  LOCKED: { label: 'Kilitli', color: 'error' },
  INACTIVE: { label: 'Pasif', color: 'default' },
};

export default function UsersPage() {
  const [role, setRole] = useState<Role | ''>('');
  const [q, setQ] = useState('');
  const { data = [] } = useUsers({ role: role || undefined, q: q || undefined });
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; user: UserRow } | null>(null);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const action = async (path: string, message: string) => {
    if (!menu) return;
    const id = menu.user.id;
    setMenu(null);
    try {
      await api.post(`/users/${id}/${path}`);
      qc.invalidateQueries(['users']);
      enqueueSnackbar(message, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    }
  };

  const counts = ROLES.map((r) => ({ role: r, count: data.filter((u) => u.role === r).length }));

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        subtitle="Yeni kullanıcılar e-postayla davet edilir ve şifrelerini kendileri belirler."
        actions={
          <Button variant="contained" startIcon={<PersonAddAltRoundedIcon />} onClick={() => setEditing('new')}>
            Kullanıcı davet et
          </Button>
        }
      />
      <Card>
        <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <TextField placeholder="Ad ya da e-posta ara" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: '100%', sm: 260 } }} />
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
            <Chip label="Tümü" onClick={() => setRole('')} color={role === '' ? 'primary' : 'default'} variant={role === '' ? 'filled' : 'outlined'} />
            {counts.map(({ role: r, count }) => (
              <Chip
                key={r}
                label={`${roleLabels[r]}${role === '' ? ` · ${count}` : ''}`}
                onClick={() => setRole(r)}
                color={role === r ? 'primary' : 'default'}
                variant={role === r ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Kullanıcı</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Branş</TableCell>
                <TableCell>Durum</TableCell>
                <TableCell>Son giriş</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <UserAvatar name={u.fullName} size={36} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {personName(u)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {u.email}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {roleLabels[u.role]}
                    {u.supervisor && (
                      <Typography variant="caption" color="text.secondary" component="div">
                        Sorumlu: {personName(u.supervisor)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{u.branch?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={statusChip[u.status].label} color={statusChip[u.status].color} />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{u.lastLoginAt ? relative(u.lastLoginAt) : 'Hiç giriş yapmadı'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })}>
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Card>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setEditing(menu!.user);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          Düzenle
        </MenuItem>
        {menu?.user.status === 'INVITED' && (
          <MenuItem onClick={() => action('resend-invite', 'Davet e-postası yeniden gönderildi.')}>
            <ListItemIcon>
              <ForwardToInboxRoundedIcon fontSize="small" />
            </ListItemIcon>
            Daveti yeniden gönder
          </MenuItem>
        )}
        {menu?.user.status === 'LOCKED' && (
          <MenuItem onClick={() => action('unlock', 'Hesap kilidi açıldı.')}>
            <ListItemIcon>
              <LockOpenRoundedIcon fontSize="small" />
            </ListItemIcon>
            Kilidi aç
          </MenuItem>
        )}
        <MenuItem onClick={() => action('revoke-sessions', 'Tüm oturumlar sonlandırıldı.')}>
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          Oturumları sonlandır
        </MenuItem>
      </Menu>

      <UserDialog user={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function UserDialog({ user, onClose }: { user: UserRow | 'new' | null; onClose: () => void }) {
  const isNew = user === 'new';
  const { data: branches = [] } = useBranches();
  const { data: surgeons = [] } = useUserLookup(Role.Surgeon);
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', title: '', phone: '', role: Role.Surgeon as Role, branchId: '', supervisorId: '', isActive: true });

  useEffect(() => {
    if (!user) return;
    if (user === 'new') {
      setForm({ email: '', fullName: '', title: '', phone: '', role: Role.Surgeon, branchId: '', supervisorId: '', isActive: true });
    } else {
      setForm({
        email: user.email,
        fullName: user.fullName,
        title: user.title ?? '',
        phone: user.phone ?? '',
        role: user.role,
        branchId: user.branch?.id ?? '',
        supervisorId: user.supervisor?.id ?? '',
        isActive: user.isActive,
      });
    }
  }, [user]);

  const save = async () => {
    setSaving(true);
    const body = {
      fullName: form.fullName,
      title: form.title || undefined,
      phone: form.phone || undefined,
      role: form.role,
      branchId: form.branchId || undefined,
      supervisorId: form.role === Role.Assistant ? form.supervisorId || undefined : undefined,
    };
    try {
      if (isNew) {
        await api.post('/users', { ...body, email: form.email });
        enqueueSnackbar(`${form.email} adresine davet gönderildi.`, { variant: 'success' });
      } else if (user) {
        await api.patch(`/users/${user.id}`, { ...body, isActive: form.isActive });
        enqueueSnackbar('Kullanıcı güncellendi.', { variant: 'success' });
      }
      qc.invalidateQueries(['users']);
      onClose();
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const needsBranch = form.role === Role.Surgeon || form.role === Role.Assistant;

  return (
    <Dialog open={!!user} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 500 }}>{isNew ? 'Kullanıcı davet et' : 'Kullanıcıyı düzenle'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
          <TextField label="E-posta" type="email" value={form.email} disabled={!isNew} onChange={(e) => setForm({ ...form, email: e.target.value })} sx={{ gridColumn: { sm: 'span 2' } }} />
          <TextField label="Ad soyad" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <TextField label="Unvan" placeholder="Op. Dr., Uzm. Dr." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {roleLabels[r]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {needsBranch && (
            <TextField select label="Branş" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {form.role === Role.Assistant && (
            <TextField select label="Sorumlu hekim" value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
              <MenuItem value="">—</MenuItem>
              {surgeons.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {personName(s)}
                </MenuItem>
              ))}
            </TextField>
          )}
          {!isNew && (
            <FormControlLabel
              sx={{ gridColumn: { sm: 'span 2' } }}
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Hesap aktif"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Vazgeç
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={save} disabled={!form.fullName || (isNew && !form.email)}>
          {isNew ? 'Davet gönder' : 'Kaydet'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
