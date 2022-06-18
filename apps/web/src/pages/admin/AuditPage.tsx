import { Box, Card, Chip, Collapse, IconButton, MenuItem, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { roleLabels } from '@surgiplan/shared';
import { Fragment, useState } from 'react';
import { useAudit } from '@/api/queries';
import { PageHeader } from '@/components/PageHeader';
import { fmt } from '@/lib/format';

const actionLabels: Record<string, string> = {
  'auth.login': 'Giriş yaptı',
  'auth.login_failed': 'Hatalı giriş denemesi',
  'auth.refresh_reuse': 'Yenileme anahtarı tekrar kullanıldı',
  'auth.password_changed': 'Şifresini değiştirdi',
  'auth.password_reset': 'Şifresini sıfırladı',
  'auth.reset_requested': 'Şifre sıfırlama istedi',
  'auth.invite_accepted': 'Daveti kabul etti',
  'user.invited': 'Kullanıcı davet etti',
  'user.updated': 'Kullanıcıyı güncelledi',
  'user.unlocked': 'Hesap kilidini açtı',
  'user.invite_resent': 'Daveti yeniden gönderdi',
  'user.sessions_revoked': 'Oturumları sonlandırdı',
  'surgery.created': 'Talep oluşturdu',
  'surgery.updated': 'Talebi güncelledi',
  'surgery.scheduled': 'Vakayı planladı',
  'surgery.rescheduled': 'Vakayı yeniden planladı',
  'surgery.status_changed': 'Vaka durumunu değiştirdi',
  'checklist.checked': 'Kontrol maddesi işaretledi',
  'checklist.unchecked': 'Kontrol maddesi işaretini kaldırdı',
  'patient.created': 'Hasta kaydetti',
};

const entities = [
  { value: '', label: 'Tümü' },
  { value: 'surgery', label: 'Ameliyat' },
  { value: 'user', label: 'Kullanıcı' },
  { value: 'patient', label: 'Hasta' },
  { value: 'room', label: 'Salon' },
  { value: 'equipment', label: 'Ekipman' },
  { value: 'procedure', label: 'İşlem' },
];

export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<string | null>(null);
  const { data } = useAudit({ entity: entity || undefined, page: page + 1, pageSize });

  return (
    <>
      <PageHeader title="Denetim izi" subtitle="Sistemde yapılan tüm kritik işlemlerin değiştirilemez kaydı." />
      <Card>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            select
            label="Kayıt türü"
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(0);
            }}
            sx={{ width: 200 }}
          >
            {entities.map((e) => (
              <MenuItem key={e.value} value={e.value}>
                {e.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Zaman</TableCell>
                <TableCell>Kullanıcı</TableCell>
                <TableCell>İşlem</TableCell>
                <TableCell>Kayıt</TableCell>
                <TableCell>IP</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((row) => (
                <Fragment key={row.id}>
                  <TableRow hover>
                    <TableCell>
                      {!!row.changes && (
                        <IconButton size="small" onClick={() => setOpen(open === row.id ? null : row.id)}>
                          <KeyboardArrowDownRoundedIcon sx={{ transform: open === row.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </IconButton>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.createdAt, 'd MMM yyyy HH:mm:ss')}</TableCell>
                    <TableCell>
                      {row.actor?.fullName ?? 'Sistem'}
                      {row.actor && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {roleLabels[row.actor.role]}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={actionLabels[row.action] ?? row.action}
                        color={row.action.includes('failed') || row.action.includes('reuse') ? 'error' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 12 }}>
                      {row.entity}
                      {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: 12 }}>{row.ip ?? '—'}</TableCell>
                  </TableRow>
                  {!!row.changes && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: open === row.id ? undefined : 0 }}>
                        <Collapse in={open === row.id} unmountOnExit>
                          <Box component="pre" sx={{ m: 0, my: 1.5, p: 1.5, bgcolor: 'surface.sunken', borderRadius: 1, fontSize: 12, overflowX: 'auto', border: 1, borderColor: 'divider' }}>
                            {JSON.stringify(row.changes, null, 2)}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          labelRowsPerPage="Sayfa başına"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
        />
      </Card>
    </>
  );
}
