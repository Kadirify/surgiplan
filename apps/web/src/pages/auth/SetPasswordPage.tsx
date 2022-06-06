import { Alert, Box, LinearProgress, Link, Stack, TextField, Typography } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { FormEvent, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import { AuthShell } from './AuthShell';

export const passwordRules = [
  { label: 'En az 8 karakter', test: (p: string) => p.length >= 8 },
  { label: 'Büyük harf', test: (p: string) => /[A-ZÇĞİÖŞÜ]/.test(p) },
  { label: 'Küçük harf', test: (p: string) => /[a-zçğıöşü]/.test(p) },
  { label: 'Rakam', test: (p: string) => /\d/.test(p) },
];

export function PasswordStrength({ password }: { password: string }) {
  const passed = passwordRules.filter((r) => r.test(password)).length;
  const colors = ['error', 'error', 'warning', 'warning', 'success'] as const;
  return (
    <Box>
      <LinearProgress variant="determinate" value={(passed / passwordRules.length) * 100} color={colors[passed]} sx={{ height: 5, borderRadius: 1, mb: 1.25 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 0.5 }}>
        {passwordRules.map((r) => {
          const ok = r.test(password);
          return (
            <Box key={r.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: ok ? 'success.main' : 'text.secondary', fontSize: 13 }}>
              {ok ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 16 }} />}
              {r.label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isInvite = params.get('invite') === '1';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid = useMemo(() => passwordRules.every((r) => r.test(password)) && password === confirm, [password, confirm]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/set-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {isInvite ? 'Hesap Aktivasyonu' : 'Yeni Şifre'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {isInvite ? 'Giriş yaparken kullanacağınız şifreyi belirleyin.' : 'Yeni şifreniz önceki oturumlarınızı sonlandırır.'}
      </Typography>
      {!token ? (
        <Alert severity="error">
          Bağlantı eksik ya da hatalı.{' '}
          <Link component={RouterLink} to="/forgot-password">
            Yeni bağlantı isteyin
          </Link>
        </Alert>
      ) : done ? (
        <Alert severity="success">Şifreniz kaydedildi. Giriş sayfasına yönlendiriliyorsunuz…</Alert>
      ) : (
        <form onSubmit={submit}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Yeni şifre" type="password" fullWidth autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordStrength password={password} />
            <TextField
              label="Şifre tekrar"
              type="password"
              fullWidth
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={!!confirm && confirm !== password}
              helperText={confirm && confirm !== password ? 'Şifreler eşleşmiyor.' : ' '}
            />
            <LoadingButton type="submit" variant="contained" loading={loading} disabled={!valid} fullWidth>
              Kaydet
            </LoadingButton>
          </Stack>
        </form>
      )}
    </AuthShell>
  );
}
