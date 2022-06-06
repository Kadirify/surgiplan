import { Alert, Link, Stack, TextField, Typography } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { FormEvent, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Şifre Sıfırlama
      </Typography>
      {sent ? (
        <Stack spacing={2} sx={{ mt: 2 }}>
          <Alert severity="success">
            {email} adresi sistemde kayıtlıysa sıfırlama bağlantısı gönderildi. Bağlantı 1 saat geçerlidir.
          </Alert>
          <Link component={RouterLink} to="/login" variant="body2" sx={{ textAlign: 'center' }}>
            Girişe dön
          </Link>
        </Stack>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Kayıtlı e-posta adresinize sıfırlama bağlantısı gönderilir.
          </Typography>
          <form onSubmit={submit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="E-posta" type="email" required autoFocus fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
              <LoadingButton type="submit" variant="contained" loading={loading} fullWidth>
                Bağlantı Gönder
              </LoadingButton>
              <Link component={RouterLink} to="/login" variant="body2" sx={{ textAlign: 'center' }}>
                Girişe dön
              </Link>
            </Stack>
          </form>
        </>
      )}
    </AuthShell>
  );
}
