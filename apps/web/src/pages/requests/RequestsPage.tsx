import { Box, Button, Card, Chip, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import { Permission, SurgeryStatus } from '@surgiplan/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSurgeries } from '@/api/queries';
import type { Surgery } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { PriorityChip, StatusChip } from '@/components/StatusChip';
import { ScheduleDialog } from '@/components/surgery/ScheduleDialog';
import { duration, fmt, personName, relative } from '@/lib/format';

const tabs: Array<{ key: string; label: string; status: SurgeryStatus[] }> = [
  { key: 'pending', label: 'Onay bekleyen', status: ['PENDING_APPROVAL'] },
  { key: 'draft', label: 'Taslak', status: ['DRAFT'] },
  { key: 'postponed', label: 'Ertelenen', status: ['POSTPONED'] },
  { key: 'scheduled', label: 'Planlanan', status: ['SCHEDULED', 'PREPARING'] },
];

export default function RequestsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const isCoordinator = can(Permission.SurgeriesSchedule);
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [scheduling, setScheduling] = useState<Surgery | null>(null);
  const { data = [], isLoading } = useSurgeries({ status: tabs[tab].status, q: q || undefined });

  return (
    <>
      <PageHeader
        title={isCoordinator ? 'Ameliyat talepleri' : 'Taleplerim'}
        subtitle={isCoordinator ? 'Onay bekleyen talepleri inceleyin ve bir salona yerleştirin.' : 'Hazırladığınız ve onaya gönderdiğiniz talepler.'}
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} component={Link} to="/surgeries/new">
            Yeni talep
          </Button>
        }
      />
      <Card>
        <Box sx={{ px: 2, display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" sx={{ flex: 1 }}>
            {tabs.map((t) => (
              <Tab key={t.key} label={t.label} />
            ))}
          </Tabs>
          <TextField placeholder="Hasta, protokol ya da işlem ara" value={q} onChange={(e) => setQ(e.target.value)} sx={{ width: { xs: '100%', sm: 280 }, my: 1 }} />
        </Box>
        {!isLoading && !data.length ? (
          <EmptyState icon={<AssignmentRoundedIcon />} title="Bu listede talep yok" description="Yeni bir talep oluşturduğunuzda burada görünür." />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>İşlem</TableCell>
                  <TableCell>Hasta</TableCell>
                  <TableCell>Operatör</TableCell>
                  <TableCell>İstenen</TableCell>
                  <TableCell>Süre</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/surgeries/${s.id}`)}>
                    <TableCell sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{s.number}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {s.procedure.name}
                        </Typography>
                        <PriorityChip priority={s.priority} />
                      </Stack>
                      {s.diagnosis && (
                        <Typography variant="caption" color="text.secondary">
                          {s.diagnosis}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.patient.firstName} {s.patient.lastName}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {s.patient.mrn}
                      </Typography>
                    </TableCell>
                    <TableCell>{personName(s.surgeon)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {s.plannedStart ? fmt(s.plannedStart, 'd MMM HH:mm') : s.requestedDate ? fmt(s.requestedDate, 'd MMM EEE') : '—'}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {relative(s.createdAt)} oluşturuldu
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{duration(s.estimatedMinutes)}</TableCell>
                    <TableCell>
                      <StatusChip status={s.status} />
                      {s.statusReason && s.status !== 'SCHEDULED' && (
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, maxWidth: 200 }} noWrap>
                          {s.statusReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                        {s.team.length === 0 && s.status === 'PENDING_APPROVAL' && <Chip size="small" label="Ekip eksik" variant="outlined" />}
                        {isCoordinator && ['PENDING_APPROVAL', 'POSTPONED', 'SCHEDULED'].includes(s.status) && (
                          <Button size="small" variant={s.status === 'SCHEDULED' ? 'text' : 'outlined'} startIcon={<EventAvailableRoundedIcon />} onClick={() => setScheduling(s)}>
                            {s.status === 'SCHEDULED' ? 'Taşı' : 'Planla'}
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
      <ScheduleDialog surgery={scheduling} onClose={() => setScheduling(null)} />
    </>
  );
}
