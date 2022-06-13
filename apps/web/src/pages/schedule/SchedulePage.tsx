import {
  Box,
  Button,
  Card,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ViewTimelineRoundedIcon from '@mui/icons-material/ViewTimelineRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import { Permission, Role, SurgeryStatus } from '@surgiplan/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { previewConflicts, useRooms, useSurgeries, useUserLookup } from '@/api/queries';
import type { Surgery } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { ScheduleDialog, ScheduleDraft } from '@/components/surgery/ScheduleDialog';
import { SurgeryDrawer } from '@/components/surgery/SurgeryDrawer';
import { fmt, fmtTime, hospitalInstant, hospitalToday, personName, shiftDate } from '@/lib/format';
import { DayBoard, DropTarget, Ghost } from './DayBoard';
import { PendingPanel } from './PendingPanel';

const legend: SurgeryStatus[] = ['SCHEDULED', 'PREPARING', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED'];

export default function SchedulePage() {
  const theme = useTheme();
  const { can } = useAuth();
  const canSchedule = can(Permission.SurgeriesSchedule);
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? hospitalToday();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [surgeonId, setSurgeonId] = useState('');

  const range = useMemo(() => ({ from: hospitalInstant(date, 0).toISOString(), to: hospitalInstant(shiftDate(date, 1), 0).toISOString() }), [date]);
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: surgeons = [] } = useUserLookup(Role.Surgeon);
  const { data: day = [], isLoading } = useSurgeries({ ...range, surgeonId: surgeonId || undefined });
  const { data: queue = [] } = useSurgeries({ status: ['PENDING_APPROVAL', 'POSTPONED'] }, canSchedule);
  const pending = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return queue.filter((s) => s.status === 'PENDING_APPROVAL' || !s.plannedStart || new Date(s.plannedStart).getTime() > cutoff);
  }, [queue]);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<{ surgery: Surgery; draft?: ScheduleDraft } | null>(null);
  const [dragging, setDragging] = useState<Surgery | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const hoverKey = useRef('');

  const scheduled = day.filter((s) => s.plannedStart);
  const all = useMemo(() => [...day, ...pending], [day, pending]);
  const stats = {
    total: scheduled.filter((s) => s.status !== 'CANCELLED' && s.status !== 'POSTPONED').length,
    inProgress: scheduled.filter((s) => s.status === 'IN_PROGRESS').length,
    done: scheduled.filter((s) => s.status === 'COMPLETED').length,
  };

  const setDate = (next: string) => {
    params.set('date', next);
    setParams(params, { replace: true });
  };

  useEffect(() => {
    if (!dragging) setGhost(null);
  }, [dragging]);

  const onHover = (target: { roomId: string; startMinutes: number } | null) => {
    if (!dragging || !target) {
      hoverKey.current = '';
      setGhost(null);
      return;
    }
    const key = `${target.roomId}:${target.startMinutes}`;
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    const minutes = dragging.estimatedMinutes;
    setGhost({ ...target, minutes, state: 'checking' });

    previewConflicts({
      surgeryId: dragging.id,
      roomId: target.roomId,
      plannedStart: hospitalInstant(date, target.startMinutes).toISOString(),
      durationMinutes: minutes,
      surgeonId: dragging.surgeon.id,
      anesthetistId: dragging.anesthetist?.id,
      teamIds: dragging.team.map((t) => t.userId),
      equipmentIds: dragging.equipment.map((e) => e.id),
    })
      .then((conflicts) => {
        if (hoverKey.current !== key) return;
        const blocking = conflicts.find((c) => c.blocking);
        setGhost({
          ...target,
          minutes,
          state: blocking ? 'blocked' : conflicts.length ? 'warning' : 'ok',
          message: blocking?.message ?? conflicts[0]?.message ?? 'Müsait',
        });
      })
      .catch(() => undefined);
  };

  const onDrop = (target: DropTarget) => {
    const surgery = all.find((s) => s.id === target.surgeryId);
    setDragging(null);
    hoverKey.current = '';
    if (!surgery) return;
    setScheduling({ surgery, draft: { roomId: target.roomId, date, startMinutes: target.startMinutes } });
  };

  return (
    <>
      <PageHeader
        title="Ameliyat Takvimi"
        subtitle={
          <>
            {fmt(hospitalInstant(date, 12 * 60), 'd MMMM yyyy, EEEE')} · {stats.total} vaka · {stats.inProgress} devam ediyor · {stats.done} tamamlandı
          </>
        }
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
            <TextField select label="Cerrah" value={surgeonId} onChange={(e) => setSurgeonId(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">Tüm cerrahlar</MenuItem>
              {surgeons.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {personName(s)}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: 'flex', alignItems: 'center', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
              <Tooltip title="Önceki gün">
                <IconButton size="small" onClick={() => setDate(shiftDate(date, -1))}>
                  <ChevronLeftRoundedIcon />
                </IconButton>
              </Tooltip>
              <Button size="small" color="inherit" onClick={() => setDate(hospitalToday())} sx={{ fontWeight: 500 }}>
                Bugün
              </Button>
              <Tooltip title="Sonraki gün">
                <IconButton size="small" onClick={() => setDate(shiftDate(date, 1))}>
                  <ChevronRightRoundedIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <TextField type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} sx={{ width: 160 }} />
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
              <ToggleButton value="board" aria-label="Zaman çizelgesi">
                <ViewTimelineRoundedIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" aria-label="Liste">
                <ViewListRoundedIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        {legend.map((s) => (
          <StatusChip key={s} status={s} sx={{ height: 22, fontSize: 11.5 }} />
        ))}
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}>
          <Box sx={{ width: 22, height: 12, borderRadius: 0.75, backgroundImage: `repeating-linear-gradient(135deg, ${theme.palette.text.disabled} 0 3px, transparent 3px 7px)` }} />
          Temizlik süresi
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: canSchedule && view === 'board' ? { xs: '1fr', lg: '1fr 280px', xl: '1fr 300px' } : '1fr', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          {roomsLoading || isLoading ? (
            <Skeleton variant="rectangular" height={480} sx={{ borderRadius: 1 }} />
          ) : view === 'board' ? (
            <DayBoard
              date={date}
              rooms={rooms}
              surgeries={scheduled}
              canDrag={canSchedule}
              ghost={ghost}
              draggingMinutes={dragging?.estimatedMinutes ?? null}
              onOpen={setDrawerId}
              onHover={onHover}
              onDrop={onDrop}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
            />
          ) : (
            <DayList surgeries={scheduled} onOpen={setDrawerId} />
          )}
        </Box>
        {canSchedule && view === 'board' && (
          <PendingPanel items={pending} onOpen={setDrawerId} onDragStart={setDragging} onDragEnd={() => setDragging(null)} />
        )}
      </Box>

      <SurgeryDrawer
        surgeryId={drawerId}
        onClose={() => setDrawerId(null)}
        onSchedule={() => {
          const s = all.find((x) => x.id === drawerId);
          if (s) setScheduling({ surgery: s });
          setDrawerId(null);
        }}
      />
      <ScheduleDialog surgery={scheduling?.surgery ?? null} draft={scheduling?.draft} onClose={() => setScheduling(null)} />
    </>
  );
}

function DayList({ surgeries, onOpen }: { surgeries: Surgery[]; onOpen: (id: string) => void }) {
  return (
    <Card sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Saat</TableCell>
            <TableCell>Salon</TableCell>
            <TableCell>İşlem</TableCell>
            <TableCell>Hasta</TableCell>
            <TableCell>Operatör</TableCell>
            <TableCell>Anestezi</TableCell>
            <TableCell>Durum</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {surgeries.map((s) => (
            <TableRow key={s.id} hover onClick={() => onOpen(s.id)} sx={{ cursor: 'pointer' }}>
              <TableCell sx={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {fmtTime(s.plannedStart)}–{fmtTime(s.plannedEnd)}
              </TableCell>
              <TableCell sx={{ fontWeight: 500 }}>{s.room?.code}</TableCell>
              <TableCell>{s.procedure.name}</TableCell>
              <TableCell>
                {s.patient.firstName} {s.patient.lastName}
                <Typography variant="caption" color="text.secondary" component="div">
                  {s.patient.mrn}
                </Typography>
              </TableCell>
              <TableCell>{personName(s.surgeon)}</TableCell>
              <TableCell>{s.anesthetist ? personName(s.anesthetist) : '—'}</TableCell>
              <TableCell>
                <StatusChip status={s.status} />
              </TableCell>
            </TableRow>
          ))}
          {!surgeries.length && (
            <TableRow>
              <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                Bu gün için planlanmış vaka yok.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
