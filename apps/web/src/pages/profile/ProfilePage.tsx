import { Box, Card, CardContent, CardHeader, Divider, FormControlLabel, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { roleLabels, rolePermissions } from '@surgiplan/shared';
import { useSnackbar } from 'notistack';
import { FormEvent, useState } from 'react';
import { api, errorMessage } from '@/api/client';
import { useAuth, useMe } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { useColorMode } from '@/layout/ColorMode';
import { fmt, personName } from '@/lib/format';
import { passwordRules, PasswordStrength } from '../auth/SetPasswordPage';

const permissionLabels: Record<string, string> = {
  'users.read': 'Kullanıcı listesini görme',
  'users.manage': 'Kullanıcı yönetimi',
  'catalog.manage': 'Salon ve katalog yönetimi',
  'surgeries.read.all': 'Tüm vakaları görme',
  'surgeries.create': 'Ameliyat talebi oluşturma',
  'surgeries.schedule': 'Vaka planlama',
  'checklist.update': 'Kontrol listesi işaretleme',
  'patients.write': 'Hasta kaydı',
  'unavailability.manage.all': 'Tüm ekibin izinlerini yönetme',
  'reports.read': 'Raporlar',
  'audit.read': 'Denetim izi',
};

export default function ProfilePage() {
  const me = useMe();
  const { reload } = useAuth();
  const { mode, setMode } = useColorMode();
  const { enqueueSnackbar } = useSnackbar();
  const [profile, setProfile] = useState({ fullName: me.fullName, phone: me.phone ?? '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', { fullName: profile.fullName, phone: profile.phone || undefined });
      await reload();
      enqueueSnackbar('Profil güncellendi.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.current, newPassword: pw.next });
      await reload();
      setPw({ current: '', next: '' });
      enqueueSnackbar('Şifreniz değiştirildi.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSavingPw(false);
    }
  };

  const setPreference = async (body: { theme?: 'light' | 'dark'; emailNotifications?: boolean }) => {
    if (body.theme) setMode(body.theme);
    try {
      await api.patch('/auth/me', body);
      await reload();
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    }
  };

  return (
    <>
      <PageHeader title="Profil ve ayarlar" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' }, gap: 2, alignItems: 'start' }}>
        <Card>
          <CardContent sx={{ textAlign: 'center', pt: 4 }}>
            <UserAvatar name={me.fullName} size={76} sx={{ mx: 'auto', mb: 2 }} />
            <Typography variant="h6">{personName(me)}</Typography>
            <Typography color="text.secondary">{roleLabels[me.role]}</Typography>
            {me.branch && (
              <Typography variant="body2" color="text.secondary">
                {me.branch.name}
              </Typography>
            )}
            {me.supervisor && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Sorumlu hekim: {personName(me.supervisor)}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              Son giriş {fmt(me.lastLoginAt)}
            </Typography>
          </CardContent>
          <Divider />
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              Yetkileriniz
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {rolePermissions[me.role].map((p) => (
                <Typography key={p} variant="body2">
                  · {permissionLabels[p] ?? p}
                </Typography>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2}>
          <Card>
            <CardHeader title="Kişisel bilgiler" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent component="form" onSubmit={saveProfile}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField label="Ad soyad" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
                <TextField label="Telefon" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                <TextField label="E-posta" value={me.email} disabled helperText="E-posta adresinizi sistem yöneticisi değiştirebilir." sx={{ gridColumn: { md: 'span 2' } }} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <LoadingButton type="submit" variant="contained" loading={savingProfile}>
                  Kaydet
                </LoadingButton>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Tercihler" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent>
              <Stack spacing={2.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography sx={{ fontWeight: 500 }}>Tema</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Koyu tema gece vardiyasında göz yorgunluğunu azaltır.
                    </Typography>
                  </Box>
                  <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setPreference({ theme: v })}>
                    <ToggleButton value="light" sx={{ px: 2, gap: 1 }}>
                      <LightModeRoundedIcon fontSize="small" /> Açık
                    </ToggleButton>
                    <ToggleButton value="dark" sx={{ px: 2, gap: 1 }}>
                      <DarkModeRoundedIcon fontSize="small" /> Koyu
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Divider />
                <FormControlLabel
                  sx={{ alignItems: 'flex-start', m: 0, gap: 2, justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                  control={<Switch checked={me.emailNotifications} onChange={(e) => setPreference({ emailNotifications: e.target.checked })} />}
                  label={
                    <Box>
                      <Typography sx={{ fontWeight: 500 }}>E-posta bildirimleri</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Vaka ataması, plan değişikliği, iptal ve her gün 17:00'de ertesi günün listesi.
                      </Typography>
                    </Box>
                  }
                />
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Şifre değiştir" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent component="form" onSubmit={savePassword}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField type="password" label="Mevcut şifre" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                <TextField type="password" label="Yeni şifre" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </Box>
              <Box sx={{ mt: 2, maxWidth: 420 }}>
                <PasswordStrength password={pw.next} />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <LoadingButton type="submit" variant="contained" loading={savingPw} disabled={!pw.current || !passwordRules.every((r) => r.test(pw.next))}>
                  Şifreyi değiştir
                </LoadingButton>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </>
  );
}
