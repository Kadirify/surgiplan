import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Link, Stack, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { roleLabels, Role } from '@surgiplan/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { AuthShell } from './AuthShell';

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin.'),
  password: z.string().min(1, 'Şifre gerekli.'),
});
type Form = z.infer<typeof schema>;

const demoAccounts: Array<{ email: string; role: Role }> = [
  { email: 'koordinator@surgiplan.com', role: Role.Coordinator },
  { email: 'cerrah@surgiplan.com', role: Role.Surgeon },
  { email: 'asistan@surgiplan.com', role: Role.Assistant },
  { email: 'anestezi@surgiplan.com', role: Role.Anesthetist },
  { email: 'hemsire@surgiplan.com', role: Role.Nurse },
  { email: 'admin@surgiplan.com', role: Role.Admin },
];

const showDemo = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, setValue, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={from} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthShell
      footer={
        showDemo && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Test hesapları (şifre: Demo1234!)
            </Typography>
            <Table size="small" sx={{ mt: 0.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
              <TableBody>
                {demoAccounts.map((a) => (
                  <TableRow
                    key={a.email}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setValue('email', a.email);
                      setValue('password', 'Demo1234!');
                    }}
                  >
                    <TableCell sx={{ fontSize: 12 }}>{a.email}</TableCell>
                    <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{roleLabels[a.role]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )
      }
    >
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Kullanıcı Girişi
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Ameliyathane planlama sistemi
      </Typography>

      <form onSubmit={onSubmit} noValidate>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="E-posta"
            type="email"
            autoComplete="username"
            autoFocus
            fullWidth
            {...register('email')}
            error={!!formState.errors.email}
            helperText={formState.errors.email?.message}
          />
          <TextField
            label="Şifre"
            type="password"
            autoComplete="current-password"
            fullWidth
            {...register('password')}
            error={!!formState.errors.password}
            helperText={formState.errors.password?.message}
          />
          <LoadingButton type="submit" variant="contained" loading={formState.isSubmitting} fullWidth>
            Giriş
          </LoadingButton>
          <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ textAlign: 'center' }}>
            Şifremi unuttum
          </Link>
        </Stack>
      </form>
    </AuthShell>
  );
}
