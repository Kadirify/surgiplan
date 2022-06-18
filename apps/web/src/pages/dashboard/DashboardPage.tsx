import {
  Box,
  Button,
  Card,
  CardHeader,
  LinearProgress,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Permission, RoomLiveState } from '@surgiplan/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBoard, useSurgeries } from '@/api/queries';
import type { Surgery } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PriorityChip, StatusChip } from '@/components/StatusChip';
import { ScheduleDialog } from '@/components/surgery/ScheduleDialog';
import { fmt, fmtTime, hospitalInstant, hospitalToday, minutesIntoHospitalDay, personName, shiftDate } from '@/lib/format';

const roomState: Record<RoomLiveState, { label: string; color: string }> = {
  IDLE: { label: 'Boş', color: '#757575' },
  PREPARING: { label: 'Hazırlık', color: '#6a1b9a' },
  IN_PROGRESS: { label: 'Ameliyatta', color: '#c62828' },
  CLEANING: { label: 'Temizlik', color: '#ad6800' },
};

export default function DashboardPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const today = hospitalToday();
  const range = useMemo(() => ({ from: hospitalInstant(today, 0).toISOString(), to: hospitalInstant(shiftDate(today, 1), 0).toISOString() }), [today]);
  const upcomingRange = useMemo(() => ({ from: new Date().toISOString(), to: hospitalInstant(shiftDate(today, 8), 0).toISOString() }), [today]);

  const canRequest = can(Permission.SurgeriesCreate);
  const isCoordinator = can(Permission.SurgeriesSchedule);
  const { data: todays = [] } = useSurgeries(range);
  const { data: board } = useBoard();
  const { data: pending = [] } = useSurgeries({ status: ['PENDING_APPROVAL'] }, canRequest);
  const { data: mine = [] } = useSurgeries({ ...upcomingRange, mine: true, status: ['SCHEDULED', 'PREPARING', 'IN_PROGRESS'] });
  const [scheduling, setScheduling] = useState<Surgery | null>(null);

  const active = todays.filter((s) => s.plannedStart && s.status !== 'CANCELLED' && s.status !== 'POSTPONED');
  const counts = {
    planned: active.length,
    completed: active.filter((s) => s.status === 'COMPLETED').length,
    running: active.filter((s) => s.status === 'IN_PROGRESS').length,
    waiting: active.filter((s) => s.status === 'SCHEDULED' || s.status === 'PREPARING').length,
    lost: todays.filter((s) => s.status === 'CANCELLED' || s.status === 'POSTPONED').length,
  };

  const summary: Array<[string, number | string]> = [
    ['Planlı vaka', counts.planned],
    ['Tamamlanan', counts.completed],
    ['Ameliyatta', counts.running],
    ['Sırada', counts.waiting],
    ['İptal / erteleme', counts.lost],
    ...(canRequest ? ([['Onay bekleyen', pending.length]] as Array<[string, number]>) : []),
  ];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5">Günlük Durum</Typography>
        <Typography color="text.secondary">{fmt(new Date(), 'd MMMM yyyy, EEEE')}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" component={Link} to="/schedule">
          Takvime git
        </Button>
      </Box>

      <Card sx={{ mb: 2, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: `repeat(${summary.length}, 1fr)` } }}>
        {summary.map(([label, value], i) => (
          <Box
            key={label}
            sx={(t) => ({
              px: 2,
              py: 1.25,
              borderTop: `1px solid ${t.palette.divider}`,
              mt: '-1px',
              [t.breakpoints.up('lg')]: { borderTop: 0, mt: 0, borderLeft: i ? `1px solid ${t.palette.divider}` : 0 },
            })}
          >
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 500, lineHeight: 1.3 }}>{value}</Typography>
          </Box>
        ))}
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '3fr 2fr' }, gap: 2, alignItems: 'start' }}>
        <Card>
          <CardHeader
            title="Salonlar"
            action={
              <Button size="small" component={Link} to="/board">
                Canlı pano
              </Button>
            }
            sx={{ '& .MuiCardHeader-action': { m: 0 } }}
          />
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Salon</TableCell>
                  <TableCell>Durum</TableCell>
                  <TableCell>Mevcut vaka</TableCell>
                  <TableCell sx={{ width: 140 }}>Süre</TableCell>
                  <TableCell>Sıradaki</TableCell>
                  <TableCell align="right">Biten</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {board?.rooms.map((r) => {
                  const c = r.current;
                  const elapsed = c?.actualStart ? Math.max(0, minutesIntoHospitalDay(new Date()) - minutesIntoHospitalDay(c.actualStart)) : 0;
                  return (
                    <TableRow key={r.id} hover sx={{ cursor: c ? 'pointer' : 'default' }} onClick={() => c && navigate(`/surgeries/${c.id}`)}>
                      <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{r.code}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: roomState[r.state].color, fontWeight: 500 }}>
                        {roomState[r.state].label}
                        {r.state === 'CLEANING' && (
                          <Typography component="span" variant="caption" color="text.secondary">
                            {' '}
                            ({fmtTime(r.cleaningUntil)})
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {c ? (
                          <>
                            {c.procedure}
                            <Typography variant="caption" color="text.secondary" component="div">
                              {c.surgeon}
                            </Typography>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {r.state === 'IN_PROGRESS' && c ? (
                          <>
                            <Typography variant="caption">
                              {elapsed} / {c.estimatedMinutes} dk
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, (elapsed / c.estimatedMinutes) * 100)}
                              color={elapsed > c.estimatedMinutes ? 'error' : 'primary'}
                            />
                          </>
                        ) : c ? (
                          <Typography variant="caption">Plan {fmtTime(c.plannedStart)}</Typography>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.next ? `${fmtTime(r.next.plannedStart)} ${r.next.procedure}` : '—'}</TableCell>
                      <TableCell align="right">
                        {r.completedCount}/{r.totalCount}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Card>

        <Box sx={{ display: 'grid', gap: 2 }}>
          {canRequest && (
            <Card>
              <CardHeader
                title={isCoordinator ? 'Onay bekleyen talepler' : 'Onaydaki taleplerim'}
                action={
                  <Button size="small" component={Link} to="/requests">
                    Tümü
                  </Button>
                }
                sx={{ '& .MuiCardHeader-action': { m: 0 } }}
              />
              <Table size="small">
                <TableBody>
                  {pending.slice(0, 6).map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <MuiLink component={Link} to={`/surgeries/${s.id}`} underline="hover" color="inherit">
                          {s.procedure.name}
                        </MuiLink>{' '}
                        <PriorityChip priority={s.priority} />
                        <Typography variant="caption" color="text.secondary" component="div">
                          {personName(s.surgeon)} · {s.requestedDate ? fmt(s.requestedDate, 'd MMM') : '—'} · {s.estimatedMinutes} dk
                        </Typography>
                      </TableCell>
                      {isCoordinator && (
                        <TableCell align="right">
                          <Button size="small" onClick={() => setScheduling(s)}>
                            Planla
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {!pending.length && (
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary' }}>Bekleyen talep yok.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          <Card>
            <CardHeader title="Yaklaşan vakalarım (7 gün)" />
            <Table size="small">
              <TableBody>
                {mine.slice(0, 8).map((s) => (
                  <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/surgeries/${s.id}`)}>
                    <TableCell sx={{ whiteSpace: 'nowrap', width: 110 }}>{fmt(s.plannedStart, 'd MMM HH:mm')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.room?.code}</TableCell>
                    <TableCell>{s.procedure.name}</TableCell>
                    <TableCell align="right">
                      <StatusChip status={s.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {!mine.length && (
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary' }}>Size atanmış yaklaşan vaka yok.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Box>
      </Box>

      <ScheduleDialog surgery={scheduling} onClose={() => setScheduling(null)} />
    </>
  );
}
