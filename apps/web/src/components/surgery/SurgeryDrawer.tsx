import { Box, Button, Chip, Divider, Drawer, IconButton, Skeleton, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { anesthesiaLabels, lateralityLabels, teamRoleLabels } from '@surgiplan/shared';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSurgery } from '@/api/queries';
import { PriorityChip, StatusChip } from '@/components/StatusChip';
import { UserAvatar } from '@/components/UserAvatar';
import { age, duration, fmt, fmtTime, personName } from '@/lib/format';
import { TransitionActions } from './TransitionActions';

interface Props {
  surgeryId: string | null;
  onClose: () => void;
  onSchedule?: () => void;
}

export function SurgeryDrawer({ surgeryId, onClose, onSchedule }: Props) {
  const { data: s, isLoading } = useSurgery(surgeryId ?? undefined);

  return (
    <Drawer anchor="right" open={!!surgeryId} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}>
      <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ flex: 1 }}>
          {s ? `Vaka #${s.number}` : 'Vaka'}
        </Typography>
        {s && (
          <Button size="small" component={Link} to={`/surgeries/${s.id}`} endIcon={<OpenInNewRoundedIcon />} onClick={onClose}>
            Detay
          </Button>
        )}
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {isLoading || !s ? (
        <Box sx={{ p: 3 }}>
          <Skeleton width="70%" height={32} />
          <Skeleton width="40%" />
          <Skeleton variant="rectangular" height={120} sx={{ mt: 2, borderRadius: 1 }} />
        </Box>
      ) : (
        <Box sx={{ p: 3, overflowY: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <StatusChip status={s.status} />
            <PriorityChip priority={s.priority} />
          </Stack>
          <Typography variant="h6" sx={{ fontSize: 19 }}>
            {s.procedure.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {s.procedure.branch.name}
            {s.laterality !== 'NONE' && ` · ${lateralityLabels[s.laterality]}`}
          </Typography>

          {s.statusReason && (s.status === 'CANCELLED' || s.status === 'POSTPONED' || s.status === 'DRAFT') && (
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, bgcolor: 'warning.main', color: '#fff', display: 'flex', gap: 1, fontSize: 14 }}>
              <WarningAmberRoundedIcon fontSize="small" />
              {s.statusReason}
            </Box>
          )}

          <Box sx={{ mt: 2.5, p: 2, borderRadius: 1, bgcolor: 'surface.sunken', border: 1, borderColor: 'divider' }}>
            <Row label="Hasta">
              {s.patient.firstName} {s.patient.lastName}
              <Typography component="span" variant="body2" color="text.secondary">
                {' '}
                · {age(s.patient.birthDate)} yaş · {s.patient.gender === 'K' ? 'Kadın' : 'Erkek'}
              </Typography>
            </Row>
            <Row label="Protokol">{s.patient.mrn}</Row>
            {s.patient.allergies && (
              <Row label="Alerji">
                <Chip size="small" color="error" label={s.patient.allergies} />
              </Row>
            )}
            <Row label="Salon">{s.room ? `${s.room.code} · ${s.room.name}` : '—'}</Row>
            <Row label="Zaman">
              {s.plannedStart ? `${fmt(s.plannedStart, 'd MMM EEE')} · ${fmtTime(s.plannedStart)}–${fmtTime(s.plannedEnd)}` : s.requestedDate ? `İstenen: ${fmt(s.requestedDate, 'd MMMM')}` : '—'}
            </Row>
            <Row label="Süre">{duration(s.estimatedMinutes)}</Row>
            <Row label="Anestezi">{s.anesthesiaType ? anesthesiaLabels[s.anesthesiaType] : '—'}</Row>
          </Box>

          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1 }}>
            Ekip
          </Typography>
          <Stack spacing={1.25}>
            <Person name={personName(s.surgeon)} role="Operatör" />
            {s.anesthetist ? <Person name={personName(s.anesthetist)} role="Anestezi" /> : <Person name="Atanmadı" role="Anestezi" muted />}
            {s.team.map((t) => (
              <Person key={t.userId} name={personName({ id: t.userId, fullName: t.fullName, title: t.title })} role={teamRoleLabels[t.role]} />
            ))}
          </Stack>

          {s.equipment.length > 0 && (
            <>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1 }}>
                Ekipman
              </Typography>
              <Stack direction="row" flexWrap="wrap" sx={{ gap: 0.75 }}>
                {s.equipment.map((e) => (
                  <Chip key={e.id} size="small" variant="outlined" label={e.name} />
                ))}
              </Stack>
            </>
          )}

          {(s.allowedTransitions.length > 0 || s.canSchedule) && (
            <>
              <Divider sx={{ my: 3 }} />
              <Stack spacing={1.5}>
                {s.canSchedule && onSchedule && (
                  <Button variant="contained" startIcon={<EventAvailableRoundedIcon />} onClick={onSchedule}>
                    {s.status === 'SCHEDULED' ? 'Yeniden planla' : 'Salona yerleştir'}
                  </Button>
                )}
                <TransitionActions surgeryId={s.id} version={s.version} transitions={s.allowedTransitions.filter((t) => t.to !== 'SCHEDULED')} />
              </Stack>
            </>
          )}
        </Box>
      )}
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 0.6, gap: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 84, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, minWidth: 0 }}>
        {children}
      </Typography>
    </Box>
  );
}

function Person({ name, role, muted }: { name: string; role: string; muted?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, opacity: muted ? 0.55 : 1 }}>
      <UserAvatar name={name} size={30} />
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
