import { alpha, Box, Tooltip, Typography, useTheme } from '@mui/material';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import { SLOT_MINUTES, SurgeryStatus } from '@surgiplan/shared';
import { DragEvent, useEffect, useRef, useState } from 'react';
import type { Room, Surgery } from '@/api/types';
import { fmtTime, hospitalToday, minutesIntoHospitalDay, personName } from '@/lib/format';
import { statusTone } from '@/theme';

export const DAY_START = 7 * 60;
export const DAY_END = 21 * 60;
const PX_PER_MIN = 2;
const ROW_HEIGHT = 92;
const ROOM_COL = 150;
const HEADER = 40;

export interface DropTarget {
  surgeryId: string;
  roomId: string;
  startMinutes: number;
}

export interface Ghost {
  roomId: string;
  startMinutes: number;
  minutes: number;
  state: 'checking' | 'ok' | 'warning' | 'blocked';
  message?: string;
}

interface Props {
  date: string;
  rooms: Room[];
  surgeries: Surgery[];
  canDrag: boolean;
  ghost: Ghost | null;
  draggingMinutes: number | null;
  onOpen: (id: string) => void;
  onHover: (target: { roomId: string; startMinutes: number } | null) => void;
  onDrop: (target: DropTarget) => void;
  onDragStart: (surgery: Surgery) => void;
  onDragEnd: () => void;
}

const MOVABLE: SurgeryStatus[] = ['SCHEDULED'];
export const DRAG_MIME = 'application/x-surgiplan-surgery';

function snap(minutes: number) {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

export function DayBoard({ date, rooms, surgeries, canDrag, ghost, draggingMinutes, onOpen, onHover, onDrop, onDragStart, onDragEnd }: Props) {
  const theme = useTheme();
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => minutesIntoHospitalDay(new Date()));
  const isToday = date === hospitalToday();
  const width = (DAY_END - DAY_START) * PX_PER_MIN;
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

  useEffect(() => {
    const t = setInterval(() => setNow(minutesIntoHospitalDay(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = isToday ? Math.floor(Math.max(now - 90, DAY_START) / 60) * 60 : DAY_START;
    el.scrollLeft = (focus - DAY_START) * PX_PER_MIN;
  }, [date, isToday]);

  const positionFrom = (e: DragEvent<HTMLDivElement>, roomId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = (draggingMinutes ?? 60) / 2;
    const minutes = snap(DAY_START + (e.clientX - rect.left) / PX_PER_MIN - offset);
    return { roomId, startMinutes: Math.min(Math.max(minutes, DAY_START), DAY_END - SLOT_MINUTES) };
  };

  const ghostColors = {
    checking: theme.palette.text.secondary,
    ok: theme.palette.success.main,
    warning: theme.palette.warning.main,
    blocked: theme.palette.error.main,
  };

  return (
    <Box
      ref={scroller}
      sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', maxHeight: 'calc(100vh - 250px)', minHeight: 360 }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onHover(null);
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: `${ROOM_COL}px ${width}px`, minWidth: ROOM_COL + width, position: 'relative' }}>
        <Box sx={{ position: 'sticky', top: 0, left: 0, zIndex: 4, height: HEADER, bgcolor: 'background.paper', borderBottom: 1, borderRight: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Salon
          </Typography>
        </Box>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 3, height: HEADER, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          {hours.map((h) => (
            <Typography
              key={h}
              variant="caption"
              sx={{ position: 'absolute', left: (h - DAY_START) * PX_PER_MIN + 6, top: 12, color: 'text.secondary', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
            >
              {String(h / 60).padStart(2, '0')}:00
            </Typography>
          ))}
        </Box>

        {rooms.map((room, index) => {
          const cases = surgeries.filter((s) => s.room?.id === room.id && s.plannedStart);
          const booked = cases.filter((c) => c.status !== 'CANCELLED' && c.status !== 'POSTPONED').reduce((sum, c) => sum + c.estimatedMinutes, 0);
          return (
            <Box key={room.id} sx={{ display: 'contents' }}>
              <Box
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  height: ROW_HEIGHT,
                  bgcolor: 'background.paper',
                  borderRight: 1,
                  borderBottom: index === rooms.length - 1 ? 0 : 1,
                  borderColor: 'divider',
                  px: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography sx={{ fontWeight: 500, fontSize: 15 }}>{room.code}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {room.name.replace(/^Ameliyathane \d+\s*/, '') || room.floor}
                </Typography>
                <Box sx={{ mt: 0.75, height: 4, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.min(100, (booked / (12 * 60)) * 100)}%`, bgcolor: 'primary.main', borderRadius: 1 }} />
                </Box>
              </Box>

              <Box
                onDragOver={(e) => {
                  if (!canDrag || !e.dataTransfer.types.includes(DRAG_MIME)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  onHover(positionFrom(e, room.id));
                }}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData(DRAG_MIME);
                  if (!id) return;
                  e.preventDefault();
                  onDrop({ surgeryId: id, ...positionFrom(e, room.id) });
                }}
                sx={{
                  position: 'relative',
                  height: ROW_HEIGHT,
                  borderBottom: index === rooms.length - 1 ? 0 : 1,
                  borderColor: 'divider',
                  backgroundImage: `repeating-linear-gradient(90deg, ${theme.palette.divider} 0 1px, transparent 1px ${60 * PX_PER_MIN}px), repeating-linear-gradient(90deg, ${alpha(theme.palette.divider, 0.45)} 0 1px, transparent 1px ${30 * PX_PER_MIN}px)`,
                  bgcolor: index % 2 ? 'surface.sunken' : 'transparent',
                }}
              >
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (8 * 60 - DAY_START) * PX_PER_MIN, bgcolor: alpha(theme.palette.text.primary, 0.025) }} />
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: (20 * 60 - DAY_START) * PX_PER_MIN, right: 0, bgcolor: alpha(theme.palette.text.primary, 0.025) }} />

                {cases.map((s) => (
                  <CaseBlock
                    key={s.id}
                    surgery={s}
                    turnover={room.turnoverMinutes}
                    draggable={canDrag && MOVABLE.includes(s.status)}
                    onOpen={onOpen}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}

                {ghost && ghost.roomId === room.id && (
                  <Tooltip open title={ghost.message ?? ''} placement="top" disableHoverListener>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        bottom: 8,
                        left: (ghost.startMinutes - DAY_START) * PX_PER_MIN,
                        width: ghost.minutes * PX_PER_MIN,
                        border: '2px dashed',
                        borderColor: ghostColors[ghost.state],
                        bgcolor: alpha(ghostColors[ghost.state], 0.12),
                        borderRadius: 1,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        px: 1,
                        zIndex: 5,
                      }}
                    >
                      <Typography sx={{ fontSize: 12, fontWeight: 500, color: ghostColors[ghost.state] }}>
                        {String(Math.floor(ghost.startMinutes / 60)).padStart(2, '0')}:{String(ghost.startMinutes % 60).padStart(2, '0')}
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
              </Box>
            </Box>
          );
        })}

        {isToday && now >= DAY_START && now <= DAY_END && (
          <Box
            sx={{
              position: 'absolute',
              top: HEADER - 6,
              bottom: 0,
              left: ROOM_COL + (now - DAY_START) * PX_PER_MIN,
              width: 2,
              bgcolor: 'error.main',
              zIndex: 3,
              pointerEvents: 'none',
              '&::before': { content: '""', position: 'absolute', top: 0, left: -4, width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' },
            }}
          />
        )}
      </Box>
    </Box>
  );
}

interface CaseBlockProps {
  surgery: Surgery;
  turnover: number;
  draggable: boolean;
  onOpen: (id: string) => void;
  onDragStart: (surgery: Surgery) => void;
  onDragEnd: () => void;
}

function CaseBlock({ surgery: s, turnover, draggable, onOpen, onDragStart, onDragEnd }: CaseBlockProps) {
  const theme = useTheme();
  const tone = statusTone(theme, s.status);
  const rawStart = minutesIntoHospitalDay(s.actualStart ?? s.plannedStart!);
  const start = Math.max(rawStart, DAY_START);
  const end = Math.min(s.actualEnd ? minutesIntoHospitalDay(s.actualEnd) : rawStart + s.estimatedMinutes, DAY_END);
  const minutes = Math.max(end - start, 15);
  const left = (start - DAY_START) * PX_PER_MIN;
  const w = minutes * PX_PER_MIN;
  const inactive = s.status === 'CANCELLED' || s.status === 'POSTPONED';
  const compact = w < 130;

  return (
    <>
      {!inactive && (
        <Box
          sx={{
            position: 'absolute',
            top: 14,
            bottom: 14,
            left: left + w,
            width: turnover * PX_PER_MIN,
            borderRadius: '0 6px 6px 0',
            backgroundImage: `repeating-linear-gradient(135deg, ${alpha(theme.palette.text.secondary, 0.16)} 0 4px, transparent 4px 9px)`,
            pointerEvents: 'none',
          }}
        />
      )}
      <Tooltip
        placement="top"
        title={
          <Box sx={{ p: 0.5 }}>
            <Typography sx={{ fontWeight: 500, fontSize: 13 }}>{s.procedure.name}</Typography>
            <Typography sx={{ fontSize: 12 }}>
              {fmtTime(s.plannedStart)}–{fmtTime(s.plannedEnd)} · {personName(s.surgeon)}
            </Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.8 }}>
              {s.patient.firstName} {s.patient.lastName} · {s.patient.mrn}
            </Typography>
          </Box>
        }
      >
        <Box
          role="button"
          tabIndex={0}
          draggable={draggable}
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, s.id);
            e.dataTransfer.effectAllowed = 'move';
            onDragStart(s);
          }}
          onDragEnd={onDragEnd}
          onClick={() => onOpen(s.id)}
          onKeyDown={(e) => e.key === 'Enter' && onOpen(s.id)}
          sx={{
            position: 'absolute',
            top: 8,
            bottom: 8,
            left,
            width: w - 3,
            borderRadius: 1,
            bgcolor: tone.soft,
            borderLeft: `4px solid ${tone.main}`,
            px: 1.25,
            py: 0.75,
            overflow: 'hidden',
            cursor: draggable ? 'grab' : 'pointer',
            opacity: inactive ? 0.55 : 1,
            textDecoration: s.status === 'CANCELLED' ? 'line-through' : 'none',
            transition: 'box-shadow .15s, transform .15s',
            outline: 'none',
            '&:hover, &:focus-visible': { boxShadow: `0 0 0 2px ${alpha(tone.main, 0.45)}, 0 6px 16px ${alpha('#000', 0.12)}`, zIndex: 2 },
            '&:hover .drag': { opacity: 0.6 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 500, color: tone.main, fontVariantNumeric: 'tabular-nums' }}>
              {fmtTime(s.actualStart ?? s.plannedStart)}
              {!compact && `–${fmtTime(s.actualEnd ?? s.plannedEnd)}`}
            </Typography>
            {s.priority !== 'ELECTIVE' && <PriorityHighRoundedIcon sx={{ fontSize: 14, color: 'error.main' }} />}
            <Box sx={{ flex: 1 }} />
            {draggable && <DragIndicatorRoundedIcon className="drag" sx={{ fontSize: 16, opacity: 0, transition: 'opacity .15s', color: 'text.secondary' }} />}
          </Box>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35, color: 'text.primary' }}>
            {s.procedure.name}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
            {s.surgeon.fullName}
            {!compact && ` · ${s.patient.firstName} ${s.patient.lastName.charAt(0)}.`}
          </Typography>
        </Box>
      </Tooltip>
    </>
  );
}
