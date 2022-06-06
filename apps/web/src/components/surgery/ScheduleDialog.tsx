import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Conflict, Role } from '@surgiplan/shared';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage, problemOf } from '@/api/client';
import { previewConflicts, useRooms, useScheduleSurgery, useUserLookup } from '@/api/queries';
import type { Surgery } from '@/api/types';
import { ConflictList } from '@/components/ConflictList';
import { duration, hospitalDateOf, hospitalInstant, hospitalToday, minutesIntoHospitalDay, personName } from '@/lib/format';

export interface ScheduleDraft {
  roomId?: string;
  date?: string;
  startMinutes?: number;
}

interface Props {
  surgery: Surgery | null;
  draft?: ScheduleDraft;
  onClose: () => void;
  onScheduled?: () => void;
}

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function ScheduleDialog({ surgery, draft, onClose, onScheduled }: Props) {
  const { data: rooms = [] } = useRooms();
  const { data: anesthetists = [] } = useUserLookup(Role.Anesthetist);
  const schedule = useScheduleSurgery();
  const { enqueueSnackbar } = useSnackbar();

  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(hospitalToday());
  const [time, setTime] = useState('08:00');
  const [minutes, setMinutes] = useState(60);
  const [anesthetistId, setAnesthetistId] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!surgery) return;
    const start = draft?.startMinutes ?? (surgery.plannedStart ? minutesIntoHospitalDay(surgery.plannedStart) : 8 * 60);
    setRoomId(draft?.roomId ?? surgery.room?.id ?? '');
    setDate(draft?.date ?? (surgery.plannedStart ? hospitalDateOf(surgery.plannedStart) : surgery.requestedDate?.slice(0, 10) ?? hospitalToday()));
    setTime(toTime(start));
    setMinutes(surgery.estimatedMinutes);
    setAnesthetistId(surgery.anesthetist?.id ?? '');
    setAcknowledged(false);
    setConflicts(null);
  }, [surgery, draft]);

  const plannedStart = useMemo(() => (date && time ? hospitalInstant(date, fromTime(time)) : null), [date, time]);

  useEffect(() => {
    if (!surgery || !roomId || !plannedStart || !minutes) return;
    setChecking(true);
    const handle = setTimeout(() => {
      previewConflicts({
        surgeryId: surgery.id,
        roomId,
        plannedStart: plannedStart.toISOString(),
        durationMinutes: minutes,
        surgeonId: surgery.surgeon.id,
        anesthetistId: anesthetistId || undefined,
        teamIds: surgery.team.map((t) => t.userId),
        equipmentIds: surgery.equipment.map((e) => e.id),
      })
        .then(setConflicts)
        .catch(() => setConflicts(null))
        .finally(() => setChecking(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [surgery, roomId, plannedStart, minutes, anesthetistId]);

  const blocking = conflicts?.some((c) => c.blocking) ?? false;
  const warnings = conflicts?.filter((c) => !c.blocking) ?? [];

  const submit = async () => {
    if (!surgery || !plannedStart) return;
    try {
      await schedule.mutateAsync({
        id: surgery.id,
        roomId,
        plannedStart: plannedStart.toISOString(),
        durationMinutes: minutes,
        anesthetistId: anesthetistId || undefined,
        version: surgery.version,
        acknowledgeWarnings: acknowledged,
      });
      enqueueSnackbar('Vaka planlandı, ekibe bildirim gönderildi.', { variant: 'success' });
      onScheduled?.();
      onClose();
    } catch (err) {
      const problem = problemOf(err);
      if (problem.conflicts) setConflicts(problem.conflicts);
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    }
  };

  return (
    <Dialog open={!!surgery} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography variant="h6" component="span">
          {surgery?.status === 'SCHEDULED' ? 'Vakayı yeniden planla' : 'Vakayı planla'}
        </Typography>
        {surgery && (
          <Typography variant="body2" color="text.secondary">
            #{surgery.number} · {surgery.procedure.name} · {personName(surgery.surgeon)}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
          <TextField select label="Salon" value={roomId} onChange={(e) => setRoomId(e.target.value)} sx={{ gridColumn: { sm: 'span 2' } }}>
            {rooms.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.code} · {r.name}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  temizlik {r.turnoverMinutes} dk
                </Typography>
              </MenuItem>
            ))}
          </TextField>
          <TextField type="date" label="Tarih" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="time" label="Başlangıç" value={time} onChange={(e) => setTime(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ step: 900 }} />
          <TextField
            type="number"
            label="Süre (dk)"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            inputProps={{ min: 10, max: 960, step: 5 }}
            helperText={minutes ? duration(minutes) : ' '}
          />
          <TextField select label="Anestezi uzmanı" value={anesthetistId} onChange={(e) => setAnesthetistId(e.target.value)}>
            <MenuItem value="">
              <em>Daha sonra atanacak</em>
            </MenuItem>
            {anesthetists.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {personName(a)}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box sx={{ mt: 2.5, minHeight: 56 }}>
          {checking ? (
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ color: 'text.secondary' }}>
              <CircularProgress size={16} />
              <Typography variant="body2">Çakışmalar kontrol ediliyor…</Typography>
            </Stack>
          ) : conflicts && conflicts.length === 0 ? (
            <Alert icon={<CheckCircleRoundedIcon />} severity="success">
              Salon, ekip ve ekipman bu saatte müsait.
            </Alert>
          ) : conflicts ? (
            <ConflictList conflicts={conflicts} />
          ) : null}
          {!blocking && warnings.length > 0 && (
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />}
              label={<Typography variant="body2">Uyarıları gördüm, yine de planla</Typography>}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose}>
          Vazgeç
        </Button>
        <LoadingButton
          variant="contained"
          loading={schedule.isLoading}
          disabled={!roomId || checking || blocking || (warnings.length > 0 && !acknowledged)}
          onClick={submit}
        >
          Planla ve bildir
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
