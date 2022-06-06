import { Button, ButtonProps, Stack } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import HotelRoundedIcon from '@mui/icons-material/HotelRounded';
import type { SurgeryStatus, Transition } from '@surgiplan/shared';
import { useSnackbar } from 'notistack';
import { ReactNode, useState } from 'react';
import { errorMessage } from '@/api/client';
import { useTransition } from '@/api/queries';
import { ReasonDialog } from '@/components/ReasonDialog';

const presentation: Partial<Record<SurgeryStatus, { icon: ReactNode; color: ButtonProps['color']; variant: ButtonProps['variant'] }>> = {
  PENDING_APPROVAL: { icon: <SendRoundedIcon />, color: 'primary', variant: 'contained' },
  PREPARING: { icon: <HotelRoundedIcon />, color: 'secondary', variant: 'contained' },
  IN_PROGRESS: { icon: <PlayArrowRoundedIcon />, color: 'error', variant: 'contained' },
  COMPLETED: { icon: <StopRoundedIcon />, color: 'success', variant: 'contained' },
  POSTPONED: { icon: <EventRepeatRoundedIcon />, color: 'warning', variant: 'outlined' },
  CANCELLED: { icon: <CloseRoundedIcon />, color: 'error', variant: 'outlined' },
  DRAFT: { icon: <UndoRoundedIcon />, color: 'inherit', variant: 'outlined' },
};

interface Props {
  surgeryId: string;
  version: number;
  transitions: Transition[];
  size?: ButtonProps['size'];
  onDone?: () => void;
}

export function TransitionActions({ surgeryId, version, transitions, size = 'medium', onDone }: Props) {
  const mutation = useTransition();
  const { enqueueSnackbar } = useSnackbar();
  const [pending, setPending] = useState<Transition | null>(null);

  const run = async (t: Transition, reason?: string) => {
    try {
      await mutation.mutateAsync({ id: surgeryId, to: t.to, reason, version });
      enqueueSnackbar(`${t.label}: işlem tamamlandı`, { variant: 'success' });
      setPending(null);
      onDone?.();
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    }
  };

  if (!transitions.length) return null;

  return (
    <>
      <Stack direction="row" flexWrap="wrap" sx={{ gap: 1 }}>
        {transitions.map((t) => {
          const p = presentation[t.to];
          return (
            <Button
              key={t.to}
              size={size}
              color={p?.color ?? 'primary'}
              variant={p?.variant ?? 'outlined'}
              startIcon={p?.icon}
              disabled={mutation.isLoading}
              onClick={() => (t.requiresReason ? setPending(t) : run(t))}
            >
              {t.label}
            </Button>
          );
        })}
      </Stack>
      <ReasonDialog
        open={!!pending}
        title={pending?.label ?? ''}
        description={
          pending?.to === 'CANCELLED'
            ? 'İptal edilen vaka takvimden kaldırılır ve ekibe bildirim gönderilir.'
            : pending?.to === 'POSTPONED'
            ? 'Ertelenen vaka salonu boşaltır. Daha sonra yeniden onaya gönderilebilir.'
            : undefined
        }
        confirmLabel={pending?.label ?? ''}
        danger={pending?.to === 'CANCELLED'}
        loading={mutation.isLoading}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && run(pending, reason)}
      />
    </>
  );
}
