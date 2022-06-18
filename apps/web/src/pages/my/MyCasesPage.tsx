import { Box, Card, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSurgeries } from '@/api/queries';
import type { Surgery } from '@/api/types';
import { useMe } from '@/auth/AuthProvider';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { PriorityChip, StatusChip } from '@/components/StatusChip';
import { duration, fmt, fmtTime, hospitalDateOf, hospitalInstant, hospitalToday, personName, shiftDate } from '@/lib/format';

export default function MyCasesPage() {
  const me = useMe();
  const [period, setPeriod] = useState<'upcoming' | 'past'>('upcoming');
  const today = hospitalToday();
  const range = useMemo(
    () =>
      period === 'upcoming'
        ? { from: hospitalInstant(today, 0).toISOString(), to: hospitalInstant(shiftDate(today, 30), 0).toISOString() }
        : { from: hospitalInstant(shiftDate(today, -30), 0).toISOString(), to: hospitalInstant(today, 0).toISOString() },
    [period, today],
  );
  const { data = [], isLoading } = useSurgeries({ ...range, mine: true });

  const groups = useMemo(() => {
    const map = new Map<string, Surgery[]>();
    const list = period === 'past' ? [...data].reverse() : data;
    for (const s of list) {
      if (!s.plannedStart) continue;
      const key = hospitalDateOf(s.plannedStart);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [data, period]);

  return (
    <>
      <PageHeader
        title="Vakalarım"
        subtitle={`${personName(me)} olarak ekibinde yer aldığınız ameliyatlar`}
        actions={
          <ToggleButtonGroup size="small" exclusive value={period} onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="upcoming" sx={{ px: 2 }}>
              Yaklaşan
            </ToggleButton>
            <ToggleButton value="past" sx={{ px: 2 }}>
              Geçmiş 30 gün
            </ToggleButton>
          </ToggleButtonGroup>
        }
      />
      {!isLoading && !groups.length ? (
        <Card>
          <EmptyState icon={<MedicalServicesRoundedIcon />} title="Vaka bulunamadı" description="Bu dönemde ekibinde olduğunuz bir ameliyat yok." />
        </Card>
      ) : (
        <Stack spacing={3}>
          {groups.map(([day, items]) => (
            <Box key={day}>
              <Typography variant="overline" color={day === today ? 'primary.main' : 'text.secondary'} sx={{ display: 'block', mb: 1 }}>
                {day === today ? 'Bugün · ' : ''}
                {fmt(items[0].plannedStart, 'd MMMM, EEEE')} · {items.length} vaka
              </Typography>
              <Card>
                {items.map((s, i) => (
                  <Box
                    key={s.id}
                    component={Link}
                    to={`/surgeries/${s.id}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '64px 1fr', md: '80px 1fr 200px 160px' },
                      gap: 2,
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.75,
                      color: 'inherit',
                      textDecoration: 'none',
                      borderTop: i ? 1 : 0,
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 500, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.plannedStart)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.room?.code}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography noWrap sx={{ fontWeight: 500 }}>
                          {s.procedure.name}
                        </Typography>
                        <PriorityChip priority={s.priority} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {s.patient.firstName} {s.patient.lastName} · {duration(s.estimatedMinutes)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }} noWrap>
                      {s.surgeon.id === me.id ? 'Operatör' : s.anesthetist?.id === me.id ? 'Anestezi' : 'Ekip'} · {personName(s.surgeon)}
                    </Typography>
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end' }}>
                      <StatusChip status={s.status} />
                    </Box>
                  </Box>
                ))}
              </Card>
            </Box>
          ))}
        </Stack>
      )}
    </>
  );
}
