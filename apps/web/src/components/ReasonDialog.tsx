import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { useEffect, useState } from 'react';

const quickReasons = [
  'Hasta ameliyata hazır değil',
  'Yoğun bakım yatağı yok',
  'Hasta onam vermedi',
  'Kan ürünü hazır değil',
  'Acil vaka nedeniyle',
  'Cerrah talebi',
];

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  requireReason?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function ReasonDialog({ open, title, description, confirmLabel, danger, requireReason = true, loading, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 500 }}>{title}</DialogTitle>
      <DialogContent>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        {requireReason && (
          <>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={2}
              label="Gerekçe"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              inputProps={{ maxLength: 300 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.75 }}>
              Sık kullanılanlar
            </Typography>
            {quickReasons.map((r) => (
              <Button key={r} size="small" variant="outlined" color="inherit" onClick={() => setReason(r)} sx={{ mr: 0.75, mb: 0.75, borderColor: 'divider', fontWeight: 500 }}>
                {r}
              </Button>
            ))}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>
          Vazgeç
        </Button>
        <LoadingButton
          variant="contained"
          color={danger ? 'error' : 'primary'}
          loading={loading}
          disabled={requireReason && !reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          {confirmLabel}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
