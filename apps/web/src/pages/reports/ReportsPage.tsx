import {
  Box,
  Button,
  Card,
  CardHeader,
  Divider,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/api/client';
import { useReport } from '@/api/queries';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { fmt, hospitalToday, percent, shiftDate } from '@/lib/format';

export default function ReportsPage() {
  const theme = useTheme();
  const [days, setDays] = useState(14);
  const to = hospitalToday();
  const from = shiftDate(to, -days + 1);
  const { data, isFetching } = useReport(from, to);

  const axis = { fontSize: 12, fill: theme.palette.text.secondary };
  const grid = theme.palette.divider;

  const utilization = useMemo(() => data?.utilization.map((u) => ({ ...u, pct: Math.round(u.rate * 100) })) ?? [], [data]);
  const daily = useMemo(() => data?.daily.map((d) => ({ ...d, label: fmt(`${d.date}T12:00:00Z`, 'd MMM') })) ?? [], [data]);

  const downloadCsv = async () => {
    const res = await api.get('/reports/utilization.csv', { params: { from, to }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salon-dolulugu-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Raporlar"
        subtitle={`${fmt(`${from}T12:00:00Z`, 'd MMMM')} – ${fmt(`${to}T12:00:00Z`, 'd MMMM yyyy')} · ${data?.range.workingDays ?? '—'} iş günü`}
        actions={
          <>
            <ToggleButtonGroup size="small" exclusive value={days} onChange={(_, v) => v && setDays(v)}>
              <ToggleButton value={7} sx={{ px: 1.75 }}>7 gün</ToggleButton>
              <ToggleButton value={14} sx={{ px: 1.75 }}>14 gün</ToggleButton>
              <ToggleButton value={30} sx={{ px: 1.75 }}>30 gün</ToggleButton>
            </ToggleButtonGroup>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadCsv}>
              CSV
            </Button>
          </>
        }
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 2, opacity: isFetching ? 0.6 : 1, transition: 'opacity .2s' }}>
        <StatCard label="Salon doluluğu" value={percent(data?.summary.utilizationRate)} hint="Mesai saatlerine göre" loading={!data} />
        <StatCard label="Tamamlanan vaka" value={data?.summary.completed ?? '—'} hint={`${data?.summary.total ?? 0} planlı vakadan`} loading={!data} />
        <StatCard
          label="İptal ve erteleme"
          value={data ? data.summary.cancelled + data.summary.postponed : '—'}
          hint={data ? `${data.summary.cancelled} iptal · ${data.summary.postponed} erteleme` : undefined}
         
         
          loading={!data}
        />
        <StatCard label="İlk vaka zamanında" value={percent(data?.summary.firstCaseOnTimeRate)} hint="10 dk tolerans" loading={!data} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
        <Card>
          <CardHeader title="Salon doluluğu" subheader="Gerçekleşen ameliyat süresi / kullanılabilir süre" titleTypographyProps={{ variant: 'h6' }} />
          <Divider />
          <Box sx={{ height: 300, p: 2 }}>
            {data ? (
              <ResponsiveContainer>
                <BarChart data={utilization} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke={grid} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `%${v}`} tick={axis} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="code" tick={{ ...axis, fontWeight: 500 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip cursor={{ fill: theme.palette.action.hover }} contentStyle={{ borderRadius: 10, border: `1px solid ${grid}`, background: theme.palette.background.paper }} />
                  <Bar dataKey="pct" name="Doluluk" unit="%" fill={theme.palette.primary.main} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
            )}
          </Box>
        </Card>

        <Card>
          <CardHeader title="Günlük vaka dağılımı" titleTypographyProps={{ variant: 'h6' }} />
          <Divider />
          <Box sx={{ height: 300, p: 2 }}>
            {data ? (
              <ResponsiveContainer>
                <BarChart data={daily} margin={{ right: 8 }}>
                  <CartesianGrid vertical={false} stroke={grid} />
                  <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={28} />
                  <Tooltip cursor={{ fill: theme.palette.action.hover }} contentStyle={{ borderRadius: 10, border: `1px solid ${grid}`, background: theme.palette.background.paper }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="completed" name="Tamamlandı" stackId="a" fill="#10b981" />
                  <Bar dataKey="postponed" name="Ertelendi" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="cancelled" name="İptal" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton variant="rectangular" height="100%" sx={{ borderRadius: 1 }} />
            )}
          </Box>
        </Card>

        <Card>
          <CardHeader title="İptal ve erteleme nedenleri" titleTypographyProps={{ variant: 'h6' }} />
          <Divider />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Neden</TableCell>
                <TableCell align="right">İptal</TableCell>
                <TableCell align="right">Erteleme</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.lostCases.map((r) => (
                <TableRow key={r.reason}>
                  <TableCell>{r.reason}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500, color: r.cancelled ? 'error.main' : 'text.disabled' }}>
                    {r.cancelled}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500, color: r.postponed ? 'warning.main' : 'text.disabled' }}>
                    {r.postponed}
                  </TableCell>
                </TableRow>
              ))}
              {data && !data.lostCases.length && (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                    Bu dönemde iptal ya da erteleme yok.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Süre tahmini doğruluğu" subheader="Planlanan ve gerçekleşen ortalama süre" titleTypographyProps={{ variant: 'h6' }} />
          <Divider />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>İşlem</TableCell>
                <TableCell align="right">Vaka</TableCell>
                <TableCell align="right">Plan</TableCell>
                <TableCell align="right">Gerçek</TableCell>
                <TableCell sx={{ width: 140 }}>Fark</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.durationAccuracy.slice(0, 10).map((r) => {
                const max = 40;
                const w = Math.min(Math.abs(r.avgDelta), max) / max;
                return (
                  <TableRow key={r.procedure}>
                    <TableCell>{r.procedure}</TableCell>
                    <TableCell align="right">{r.count}</TableCell>
                    <TableCell align="right">{r.avgEstimated} dk</TableCell>
                    <TableCell align="right">{r.avgActual} dk</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ position: 'relative', flex: 1, height: 6, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              borderRadius: 1,
                              left: r.avgDelta >= 0 ? '50%' : `${50 - w * 50}%`,
                              width: `${w * 50}%`,
                              bgcolor: Math.abs(r.avgDelta) <= 10 ? 'success.main' : r.avgDelta > 0 ? 'warning.main' : 'info.main',
                            }}
                          />
                          <Box sx={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, bgcolor: 'text.disabled' }} />
                        </Box>
                        <Typography variant="caption" sx={{ width: 44, textAlign: 'right', fontWeight: 500 }}>
                          {r.avgDelta > 0 ? '+' : ''}
                          {r.avgDelta}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </Box>
    </>
  );
}
