import {
  Alert,
  Box,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import {
  anesthesiaLabels,
  ChecklistPhase,
  checklistPhaseLabels,
  lateralityLabels,
  Permission,
  surgeryStatusLabels,
  teamRoleLabels,
} from '@surgiplan/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ReactNode, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import { keys, useSurgery } from '@/api/queries';
import type { ChecklistEntry, SurgeryDetail, SurgeryEvent } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { PriorityChip, StatusChip } from '@/components/StatusChip';
import { ScheduleDialog } from '@/components/surgery/ScheduleDialog';
import { TransitionActions } from '@/components/surgery/TransitionActions';
import { UserAvatar } from '@/components/UserAvatar';
import { age, duration, fmt, fmtTime, personName, relative } from '@/lib/format';

const phases: ChecklistPhase[] = ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT'];
const phaseTitles: Record<ChecklistPhase, string> = { SIGN_IN: 'Giriş', TIME_OUT: 'Mola', SIGN_OUT: 'Çıkış' };

export default function SurgeryDetailPage() {
  const { id } = useParams();
  const { data: s, isLoading, error } = useSurgery(id);
  const [scheduling, setScheduling] = useState(false);

  if (isLoading) {
    return (
      <Box>
        <Skeleton width={320} height={40} />
        <Skeleton width={200} />
        <Skeleton variant="rectangular" height={300} sx={{ mt: 3, borderRadius: 1 }} />
      </Box>
    );
  }
  if (error || !s) {
    return <EmptyState icon={<WarningAmberRoundedIcon />} title="Vaka bulunamadı" description="Kayıt silinmiş olabilir ya da görüntüleme yetkiniz yok." />;
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Takvim', to: '/schedule' }, { label: `Vaka #${s.number}` }]}
        title={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {s.procedure.name}
            <StatusChip status={s.status} size="medium" />
            <PriorityChip priority={s.priority} />
          </Box>
        }
        subtitle={`${s.procedure.branch.name} · ${personName(s.surgeon)} · oluşturan ${s.createdBy.fullName}, ${relative(s.createdAt)}`}
        actions={
          <>
            {s.canSchedule && (
              <Button variant="contained" startIcon={<EventAvailableRoundedIcon />} onClick={() => setScheduling(true)}>
                {s.status === 'SCHEDULED' ? 'Yeniden planla' : 'Salona yerleştir'}
              </Button>
            )}
            <TransitionActions surgeryId={s.id} version={s.version} transitions={s.allowedTransitions} />
          </>
        }
      />

      {s.statusReason && ['CANCELLED', 'POSTPONED', 'DRAFT'].includes(s.status) && (
        <Alert severity={s.status === 'CANCELLED' ? 'error' : 'warning'} sx={{ mb: 2 }}>
          <b>{surgeryStatusLabels[s.status]}:</b> {s.statusReason}
        </Alert>
      )}
      {s.patient.allergies && (
        <Alert severity="error" icon={<WarningAmberRoundedIcon />} sx={{ mb: 2 }}>
          Hasta alerjisi: <b>{s.patient.allergies}</b>
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr', xl: '1.1fr 1.1fr 0.9fr' }, gap: 2, alignItems: 'start' }}>
        <Stack spacing={2}>
          <InfoCard title="Hasta">
            <Field label="Ad soyad">{s.patient.firstName} {s.patient.lastName}</Field>
            <Field label="Protokol no">{s.patient.mrn}</Field>
            <Field label="Yaş / cinsiyet">
              {age(s.patient.birthDate)} · {s.patient.gender === 'K' ? 'Kadın' : 'Erkek'}
            </Field>
            <Field label="Ön tanı">{s.diagnosis || '—'}</Field>
          </InfoCard>
          <InfoCard title="Plan">
            <Field label="Salon">{s.room ? `${s.room.code} · ${s.room.name}` : 'Atanmadı'}</Field>
            <Field label="Tarih">{s.plannedStart ? fmt(s.plannedStart, 'd MMMM yyyy, EEEE') : s.requestedDate ? `İstenen: ${fmt(s.requestedDate, 'd MMMM yyyy')}` : '—'}</Field>
            <Field label="Saat">{s.plannedStart ? `${fmtTime(s.plannedStart)} – ${fmtTime(s.plannedEnd)}` : '—'}</Field>
            <Field label="Tahmini süre">{duration(s.estimatedMinutes)}</Field>
            {s.actualStart && (
              <Field label="Gerçekleşen">
                {fmtTime(s.actualStart)} – {s.actualEnd ? fmtTime(s.actualEnd) : 'devam ediyor'}
                {s.actualEnd && <ActualDelta surgery={s} />}
              </Field>
            )}
            <Field label="Anestezi">{s.anesthesiaType ? anesthesiaLabels[s.anesthesiaType] : '—'}</Field>
            <Field label="Taraf">{lateralityLabels[s.laterality]}</Field>
            {s.notes && <Field label="Not">{s.notes}</Field>}
          </InfoCard>
          <InfoCard title="Ekip ve ekipman">
            <Stack spacing={1.5} sx={{ py: 0.5 }}>
              <Member name={personName(s.surgeon)} role="Operatör hekim" />
              <Member name={s.anesthetist ? personName(s.anesthetist) : 'Atanmadı'} role="Anestezi uzmanı" muted={!s.anesthetist} />
              {s.team.map((t) => (
                <Member key={t.userId} name={personName({ id: t.userId, fullName: t.fullName, title: t.title })} role={teamRoleLabels[t.role]} />
              ))}
            </Stack>
            {s.equipment.length > 0 && (
              <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75, mt: 2 }}>
                {s.equipment.map((e) => (
                  <Chip key={e.id} size="small" variant="outlined" label={e.name} />
                ))}
              </Stack>
            )}
          </InfoCard>
        </Stack>

        <Checklist surgery={s} />

        <Card sx={{ gridColumn: { lg: 'span 2', xl: 'auto' } }}>
          <CardHeader title="Geçmiş" titleTypographyProps={{ variant: 'h6' }} />
          <Divider />
          <Timeline events={s.events} />
        </Card>
      </Box>

      <ScheduleDialog surgery={scheduling ? s : null} onClose={() => setScheduling(false)} />
    </>
  );
}

function ActualDelta({ surgery: s }: { surgery: SurgeryDetail }) {
  const actual = Math.round((new Date(s.actualEnd!).getTime() - new Date(s.actualStart!).getTime()) / 60000);
  const delta = actual - s.estimatedMinutes;
  return (
    <Chip
      size="small"
      label={`${delta > 0 ? '+' : ''}${delta} dk`}
      color={Math.abs(delta) <= 10 ? 'success' : delta > 0 ? 'warning' : 'info'}
      sx={{ ml: 1, height: 20, fontSize: 11 }}
    />
  );
}

function Checklist({ surgery: s }: { surgery: SurgeryDetail }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState<string | null>(null);
  const editable = can(Permission.ChecklistUpdate) && ['SCHEDULED', 'PREPARING', 'IN_PROGRESS'].includes(s.status);
  const total = s.checklist.length;
  const checked = s.checklist.filter((c) => c.checked).length;

  const toggle = async (item: ChecklistEntry) => {
    setBusy(item.key);
    try {
      await api.patch(`/surgeries/${s.id}/checklist/${item.key}`, { checked: !item.checked });
      await qc.invalidateQueries(keys.surgery(s.id));
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        avatar={<VerifiedUserRoundedIcon color="primary" />}
        title="Güvenli cerrahi kontrol listesi"
        subheader={`${checked}/${total} madde tamamlandı`}
        titleTypographyProps={{ variant: 'h6' }}
      />
      <LinearProgress variant="determinate" value={total ? (checked / total) * 100 : 0} color={checked === total ? 'success' : 'primary'} sx={{ height: 3 }} />
      {!editable && s.status !== 'COMPLETED' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1.5 }}>
          {['SCHEDULED', 'PREPARING', 'IN_PROGRESS'].includes(s.status)
            ? 'Kontrol listesini hemşire ve anestezi ekibi işaretler.'
            : 'Liste, vaka planlandıktan sonra işaretlenebilir.'}
        </Typography>
      )}
      {phases.map((phase) => {
        const items = s.checklist.filter((c) => c.phase === phase);
        const done = items.every((i) => i.checked);
        return (
          <Box key={phase} sx={{ px: 2, pt: 2, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="overline" color={done ? 'success.main' : 'text.secondary'}>
                {phaseTitles[phase]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                · {checklistPhaseLabels[phase]}
              </Typography>
            </Box>
            {items.map((item) => (
              <Box
                key={item.key}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.25, borderRadius: 1.5, '&:hover': editable ? { bgcolor: 'action.hover' } : undefined }}
              >
                {busy === item.key ? (
                  <Box sx={{ width: 42, height: 38, display: 'grid', placeItems: 'center' }}>
                    <CircularProgress size={16} />
                  </Box>
                ) : (
                  <Checkbox size="small" checked={item.checked} disabled={!editable} onChange={() => toggle(item)} />
                )}
                <Box sx={{ pt: 1, flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: item.checked ? 'text.primary' : 'text.secondary', fontWeight: item.checked ? 550 : 450 }}>
                    {item.text}
                  </Typography>
                  {item.checked && item.checkedBy && (
                    <Tooltip title={fmt(item.checkedAt)}>
                      <Typography variant="caption" color="text.secondary">
                        {item.checkedBy.fullName} · {fmtTime(item.checkedAt)}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        );
      })}
    </Card>
  );
}

const eventLabels: Record<string, string> = {
  CREATED: 'Talep oluşturuldu',
  UPDATED: 'Detaylar güncellendi',
  SCHEDULED: 'Salona yerleştirildi',
  RESCHEDULED: 'Yeniden planlandı',
  STATUS: 'Durum değişti',
};

function Timeline({ events }: { events: SurgeryEvent[] }) {
  return (
    <Box sx={{ p: 2 }}>
      {events.map((e, i) => (
        <Box key={e.id} sx={{ display: 'flex', gap: 1.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: i === 0 ? 'primary.main' : 'divider', mt: 0.75, border: 2, borderColor: 'background.paper', boxShadow: (t) => `0 0 0 1px ${t.palette.divider}` }} />
            {i < events.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5 }} />}
          </Box>
          <Box sx={{ pb: 2.25, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {e.type === 'STATUS' && e.toStatus ? surgeryStatusLabels[e.toStatus] : eventLabels[e.type] ?? e.type}
            </Typography>
            {e.note && (
              <Typography variant="body2" color="text.secondary">
                {e.note}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {e.actor.fullName} · {fmt(e.createdAt, 'd MMM HH:mm')}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} titleTypographyProps={{ variant: 'h6' }} sx={{ pb: 0.5 }} />
      <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 0.75, gap: 2, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 120, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, minWidth: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

function Member({ name, role, muted }: { name: string; role: string; muted?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, opacity: muted ? 0.55 : 1 }}>
      <UserAvatar name={name} size={34} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {role}
        </Typography>
      </Box>
    </Box>
  );
}
