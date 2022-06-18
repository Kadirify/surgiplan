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
  MenuItem,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/api/client';
import { useBranches, useEquipment, useProcedures, useRooms } from '@/api/queries';
import { PageHeader } from '@/components/PageHeader';
import { duration } from '@/lib/format';

type Kind = 'rooms' | 'equipment' | 'procedures';

interface FieldDef {
  key: string;
  label: string;
  type?: 'number' | 'text' | 'select' | 'switch';
  options?: Array<{ value: string; label: string }>;
  helper?: string;
}

export default function CatalogPage() {
  const [tab, setTab] = useState<Kind>('rooms');
  const { data: rooms = [] } = useRooms(true);
  const { data: equipment = [] } = useEquipment();
  const { data: procedures = [] } = useProcedures();
  const { data: branches = [] } = useBranches();
  const [editing, setEditing] = useState<{ kind: Kind; item: Record<string, unknown> | null } | null>(null);

  const fields: Record<Kind, FieldDef[]> = {
    rooms: [
      { key: 'code', label: 'Kod', helper: 'Örn. AH-7' },
      { key: 'name', label: 'Ad' },
      { key: 'floor', label: 'Kat' },
      { key: 'turnoverMinutes', label: 'Temizlik süresi (dk)', type: 'number', helper: 'Her vakadan sonra salon bu süre kadar bloke edilir.' },
      { key: 'sortOrder', label: 'Sıra', type: 'number' },
      { key: 'isActive', label: 'Kullanımda', type: 'switch' },
    ],
    equipment: [
      { key: 'code', label: 'Kod' },
      { key: 'name', label: 'Ad' },
      { key: 'quantity', label: 'Adet', type: 'number', helper: 'Aynı anda en fazla bu kadar vakada kullanılabilir.' },
      { key: 'isActive', label: 'Kullanımda', type: 'switch' },
    ],
    procedures: [
      { key: 'code', label: 'Kod' },
      { key: 'name', label: 'Ad' },
      { key: 'branchId', label: 'Branş', type: 'select', options: branches.map((b) => ({ value: b.id, label: b.name })) },
      { key: 'defaultDurationMinutes', label: 'Katalog süresi (dk)', type: 'number', helper: 'Geçmiş veri yokken tahmin için kullanılır.' },
    ],
  };

  return (
    <>
      <PageHeader
        title="Salon ve katalog"
        subtitle="Salonlar, ekipman envanteri ve işlem kataloğu"
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setEditing({ kind: tab, item: null })}>
            Yeni ekle
          </Button>
        }
      />
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="rooms" label={`Salonlar (${rooms.length})`} />
          <Tab value="equipment" label={`Ekipman (${equipment.length})`} />
          <Tab value="procedures" label={`İşlemler (${procedures.length})`} />
        </Tabs>
        <Box sx={{ overflowX: 'auto' }}>
          {tab === 'rooms' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kod</TableCell>
                  <TableCell>Ad</TableCell>
                  <TableCell>Kat</TableCell>
                  <TableCell>Temizlik</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rooms.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.floor ?? '—'}</TableCell>
                    <TableCell>{r.turnoverMinutes} dk</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={r.isActive ? 'success' : 'default'} label={r.isActive ? 'Kullanımda' : 'Kapalı'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditing({ kind: 'rooms', item: r as unknown as Record<string, unknown> })}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === 'equipment' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kod</TableCell>
                  <TableCell>Ad</TableCell>
                  <TableCell>Adet</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {equipment.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{e.code}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.quantity}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={e.isActive ? 'success' : 'default'} label={e.isActive ? 'Kullanımda' : 'Kapalı'} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditing({ kind: 'equipment', item: e as unknown as Record<string, unknown> })}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {tab === 'procedures' && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kod</TableCell>
                  <TableCell>İşlem</TableCell>
                  <TableCell>Branş</TableCell>
                  <TableCell>Katalog süresi</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {procedures.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.branch?.name}</TableCell>
                    <TableCell>{duration(p.defaultDurationMinutes)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditing({ kind: 'procedures', item: p as unknown as Record<string, unknown> })}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      </Card>
      {editing && <CatalogDialog kind={editing.kind} item={editing.item} fields={fields[editing.kind]} onClose={() => setEditing(null)} />}
    </>
  );
}

const titles: Record<Kind, string> = { rooms: 'Salon', equipment: 'Ekipman', procedures: 'İşlem' };
const defaults: Record<Kind, Record<string, unknown>> = {
  rooms: { code: '', name: '', floor: '', turnoverMinutes: 30, sortOrder: 0, isActive: true },
  equipment: { code: '', name: '', quantity: 1, isActive: true },
  procedures: { code: '', name: '', branchId: '', defaultDurationMinutes: 60 },
};

function CatalogDialog({ kind, item, fields, onClose }: { kind: Kind; item: Record<string, unknown> | null; fields: FieldDef[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<Record<string, unknown>>(defaults[kind]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(item ? Object.fromEntries(fields.map((f) => [f.key, item[f.key] ?? defaults[kind][f.key]])) : defaults[kind]);
  }, [item, kind]);

  const save = async () => {
    setSaving(true);
    const body = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, fields.find((f) => f.key === k)?.type === 'number' ? Number(v) : v === '' ? undefined : v]),
    );
    try {
      if (item) await api.patch(`/${kind}/${item.id}`, body);
      else await api.post(`/${kind}`, body);
      qc.invalidateQueries([kind]);
      enqueueSnackbar('Kaydedildi.', { variant: 'success' });
      onClose();
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 500 }}>
        {titles[kind]} {item ? 'düzenle' : 'ekle'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
          {fields.map((f) =>
            f.type === 'switch' ? (
              <FormControlLabel key={f.key} control={<Switch checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} />} label={f.label} />
            ) : f.type === 'select' ? (
              <TextField key={f.key} select label={f.label} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                {f.options?.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                key={f.key}
                label={f.label}
                type={f.type ?? 'text'}
                helperText={f.helper}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm({ ...form, [f.key]: f.key === 'code' ? e.target.value.toUpperCase() : e.target.value })}
              />
            ),
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Vazgeç
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={save}>
          Kaydet
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
