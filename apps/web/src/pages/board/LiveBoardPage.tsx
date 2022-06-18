import { Box, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import { RoomLiveState } from '@surgiplan/shared';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoard } from '@/api/queries';
import type { BoardRoom } from '@/api/types';
import { Logo } from '@/components/Logo';
import { fmt, fmtTime } from '@/lib/format';
import { useRealtime } from '@/realtime/useRealtime';

const states: Record<RoomLiveState, { label: string; color: string }> = {
  IDLE: { label: 'BOŞ', color: '#64748b' },
  PREPARING: { label: 'HAZIRLIK', color: '#a78bfa' },
  IN_PROGRESS: { label: 'AMELİYATTA', color: '#f87171' },
  CLEANING: { label: 'TEMİZLİK', color: '#fbbf24' },
};

export default function LiveBoardPage() {
  useRealtime(true);
  const navigate = useNavigate();
  const { data } = useBoard();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#071113', color: '#e6efef', p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Tooltip title="Uygulamaya dön">
          <IconButton onClick={() => navigate('/')} sx={{ color: 'rgba(255,255,255,.6)' }}>
            <ArrowBackRoundedIcon />
          </IconButton>
        </Tooltip>
        <Logo inverted size={22} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>Ameliyathane Durum Panosu</Typography>
          <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,.55)' }}>{fmt(now, 'd MMMM yyyy, EEEE')}</Typography>
        </Box>
        <Typography sx={{ fontSize: 44, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{fmt(now, 'HH:mm')}</Typography>
        <Tooltip title="Tam ekran">
          <IconButton onClick={() => document.documentElement.requestFullscreen?.()} sx={{ color: 'rgba(255,255,255,.6)' }}>
            <FullscreenRoundedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' }, gap: 2.5, flex: 1, alignContent: 'start' }}>
        {data?.rooms.map((room) => <RoomPanel key={room.id} room={room} now={now} />)}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, mt: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Object.values(states).map((s) => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: 'rgba(255,255,255,.6)', fontWeight: 600, letterSpacing: '0.06em' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color }} />
            {s.label}
          </Box>
        ))}
      </Box>
      <Typography sx={{ textAlign: 'center', mt: 2, fontSize: 12, color: 'rgba(255,255,255,.35)' }}>
        Hasta mahremiyeti için yalnızca baş harfler gösterilir · Son güncelleme {data ? fmtTime(data.generatedAt) : '—'}
      </Typography>
    </Box>
  );
}

function RoomPanel({ room, now }: { room: BoardRoom; now: Date }) {
  const s = states[room.state];
  const c = room.current;
  const elapsed = c?.actualStart ? Math.max(0, Math.round((now.getTime() - new Date(c.actualStart).getTime()) / 60000)) : 0;
  const pct = c?.actualStart ? Math.min(100, (elapsed / c.estimatedMinutes) * 100) : 0;
  const overrun = elapsed > (c?.estimatedMinutes ?? Infinity);

  return (
    <Box
      sx={{
        borderRadius: 1,
        p: 3,
        bgcolor: '#0d1b1e',
        border: '1px solid',
        borderColor: room.state === 'IDLE' ? 'rgba(255,255,255,.07)' : s.color,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 220,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 30, fontWeight: 500, flex: 1 }}>{room.code}</Typography>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: '3px',
            bgcolor: `${s.color}22`,
            color: s.color,
            fontWeight: 500,
            fontSize: 13,
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              bgcolor: s.color,
              animation: room.state === 'IN_PROGRESS' ? 'blink 1.6s ease-in-out infinite' : undefined,
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.25 } },
            }}
          />
          {s.label}
        </Box>
      </Box>

      {c ? (
        <>
          <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>{c.procedure}</Typography>
          <Typography sx={{ fontSize: 15, color: 'rgba(255,255,255,.6)', mt: 0.5 }}>
            {c.surgeon} · Hasta {c.patientInitials}
          </Typography>
          {room.state === 'IN_PROGRESS' && (
            <Box sx={{ mt: 'auto', pt: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75, fontSize: 14, color: 'rgba(255,255,255,.7)' }}>
                <span>Başlangıç {fmtTime(c.actualStart)}</span>
                <Box component="span" sx={{ fontWeight: 700, color: overrun ? '#f87171' : '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {elapsed} / {c.estimatedMinutes} dk
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,.08)', '& .MuiLinearProgress-bar': { bgcolor: overrun ? '#f87171' : '#64a8e8', borderRadius: 4 } }}
              />
            </Box>
          )}
          {room.state === 'PREPARING' && (
            <Typography sx={{ mt: 'auto', pt: 2, fontSize: 14, color: 'rgba(255,255,255,.6)' }}>Planlanan başlangıç {fmtTime(c.plannedStart)}</Typography>
          )}
        </>
      ) : room.state === 'CLEANING' ? (
        <Typography sx={{ fontSize: 17, color: 'rgba(255,255,255,.75)' }}>Salon temizleniyor · {fmtTime(room.cleaningUntil)} hazır</Typography>
      ) : (
        <Typography sx={{ fontSize: 17, color: 'rgba(255,255,255,.45)' }}>Salon boş</Typography>
      )}

      <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', fontSize: 14, color: 'rgba(255,255,255,.55)' }}>
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {room.next ? (
            <>
              Sıradaki <b style={{ color: '#fff' }}>{fmtTime(room.next.plannedStart)}</b> · {room.next.procedure}
            </>
          ) : (
            'Sırada vaka yok'
          )}
        </Box>
        <Box sx={{ ml: 2, fontVariantNumeric: 'tabular-nums' }}>
          {room.completedCount}/{room.totalCount}
        </Box>
      </Box>
    </Box>
  );
}
