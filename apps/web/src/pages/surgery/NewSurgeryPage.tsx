import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/InsightsRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  AnesthesiaType,
  anesthesiaLabels,
  Laterality,
  lateralityLabels,
  Priority,
  priorityLabels,
  Role,
  TeamRole,
  teamRoleLabels,
} from '@surgiplan/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/api/client';
import { keys, useBranches, useEquipment, useEstimate, usePatientSearch, useProcedures, useUserLookup } from '@/api/queries';
import type { Patient, Procedure, Surgery, UserLookup } from '@/api/types';
import { useMe } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/PageHeader';
import { age, duration, fmtDate, hospitalToday, personName, shiftDate } from '@/lib/format';

const steps = ['Hasta', 'İşlem', 'Ekip ve ekipman', 'Özet'];

interface TeamEntry {
  user: UserLookup;
  role: TeamRole;
}

export default function NewSurgeryPage() {
  const me = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [step, setStep] = useState(0);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [branchId, setBranchId] = useState(me.branch?.id ?? '');
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [laterality, setLaterality] = useState<Laterality>('NONE');
  const [priority, setPriority] = useState<Priority>('ELECTIVE');
  const [anesthesiaType, setAnesthesiaType] = useState<AnesthesiaType>('GENERAL');
  const [requestedDate, setRequestedDate] = useState(shiftDate(hospitalToday(), 1));
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState<number | null>(null);

  const isSurgeon = me.role === Role.Surgeon;
  const isAssistant = me.role === Role.Assistant;
  const [surgeonId, setSurgeonId] = useState(isSurgeon ? me.id : isAssistant ? me.supervisor?.id ?? '' : '');
  const [anesthetistId, setAnesthetistId] = useState('');
  const [team, setTeam] = useState<TeamEntry[]>([]);
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<'draft' | 'submit' | null>(null);

  const { data: estimate } = useEstimate(procedure?.id, surgeonId || undefined);
  useEffect(() => {
    if (estimate) setMinutes(estimate.minutes);
  }, [estimate]);

  const canNext = [!!patient, !!procedure && !!minutes, !!surgeonId, true][step];

  const submit = async (send: boolean) => {
    if (!patient || !procedure || !minutes) return;
    setSubmitting(send ? 'submit' : 'draft');
    try {
      const { data } = await api.post<Surgery>('/surgeries', {
        patientId: patient.id,
        procedureId: procedure.id,
        surgeonId: isSurgeon || isAssistant ? undefined : surgeonId,
        anesthetistId: anesthetistId || undefined,
        laterality,
        priority,
        anesthesiaType,
        estimatedMinutes: minutes,
        requestedDate,
        diagnosis: diagnosis || undefined,
        notes: notes || undefined,
        team: team.map((t) => ({ userId: t.user.id, role: t.role })),
        equipmentIds,
        submit: send,
      });
      qc.invalidateQueries(keys.surgeries);
      enqueueSnackbar(data.status === 'PENDING_APPROVAL' ? 'Talep koordinatör onayına gönderildi.' : 'Taslak kaydedildi.', { variant: 'success' });
      navigate(`/surgeries/${data.id}`);
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <>
      <PageHeader title="Yeni ameliyat talebi" subtitle="Talep, koordinatör onayından sonra bir salona ve saate yerleştirilir." crumbs={[{ label: 'Talepler', to: '/requests' }, { label: 'Yeni talep' }]} />

      <Card sx={{ maxWidth: 960 }}>
        <Box sx={{ px: { xs: 2, md: 4 }, pt: 3, pb: 2 }}>
          <Stepper activeStep={step} alternativeLabel>
            {steps.map((s) => (
              <Step key={s}>
                <StepLabel>{s}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
        <Divider />
        <Box sx={{ p: { xs: 2, md: 4 }, minHeight: 360 }}>
          {step === 0 && <PatientStep patient={patient} onChange={setPatient} />}
          {step === 1 && (
            <Stack spacing={2.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: 2 }}>
                <BranchSelect value={branchId} onChange={(v) => { setBranchId(v); setProcedure(null); }} />
                <ProcedureSelect branchId={branchId} value={procedure} onChange={setProcedure} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                <TextField select label="Taraf" value={laterality} onChange={(e) => setLaterality(e.target.value as Laterality)}>
                  {Object.entries(lateralityLabels).map(([v, l]) => (
                    <MenuItem key={v} value={v}>{l}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="Anestezi tipi" value={anesthesiaType} onChange={(e) => setAnesthesiaType(e.target.value as AnesthesiaType)}>
                  {Object.entries(anesthesiaLabels).map(([v, l]) => (
                    <MenuItem key={v} value={v}>{l}</MenuItem>
                  ))}
                </TextField>
                <TextField type="date" label="İstenen tarih" value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Öncelik
                </Typography>
                <ToggleButtonGroup exclusive size="small" value={priority} onChange={(_, v) => v && setPriority(v)}>
                  {Object.entries(priorityLabels).map(([v, l]) => (
                    <ToggleButton key={v} value={v} sx={{ px: 2 }}>{l}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '200px 1fr' }, gap: 2, alignItems: 'start' }}>
                <TextField type="number" label="Tahmini süre (dk)" value={minutes ?? ''} onChange={(e) => setMinutes(Number(e.target.value) || null)} inputProps={{ min: 10, max: 960, step: 5 }} disabled={!procedure} />
                {estimate && procedure && (
                  <Alert icon={<AutoAwesomeRoundedIcon />} severity="info" sx={{ py: 0.25 }}>
                    {estimate.basis === 'SURGEON'
                      ? `Bu cerrahın son ${estimate.sampleSize} vakasının ortalaması: ${duration(estimate.minutes)}`
                      : estimate.basis === 'PROCEDURE'
                      ? `Bu işlemin son ${estimate.sampleSize} vakasının ortalaması: ${duration(estimate.minutes)}`
                      : `Katalog süresi: ${duration(estimate.minutes)} (yeterli geçmiş veri yok)`}
                  </Alert>
                )}
              </Box>
              <TextField label="Ön tanı" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} inputProps={{ maxLength: 300 }} />
              <TextField label="Not (koordinatör ve ekip için)" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} inputProps={{ maxLength: 1000 }} />
            </Stack>
          )}
          {step === 2 && (
            <TeamStep
              surgeonId={surgeonId}
              setSurgeonId={setSurgeonId}
              surgeonLocked={isSurgeon || isAssistant}
              anesthetistId={anesthetistId}
              setAnesthetistId={setAnesthetistId}
              team={team}
              setTeam={setTeam}
              equipmentIds={equipmentIds}
              setEquipmentIds={setEquipmentIds}
            />
          )}
          {step === 3 && patient && procedure && (
            <Summary
              rows={[
                ['Hasta', `${patient.firstName} ${patient.lastName} · ${patient.mrn} · ${age(patient.birthDate)} yaş`],
                ['İşlem', `${procedure.name}${laterality !== 'NONE' ? ` (${lateralityLabels[laterality]})` : ''}`],
                ['Öncelik', priorityLabels[priority]],
                ['Anestezi', anesthesiaLabels[anesthesiaType]],
                ['İstenen tarih', fmtDate(`${requestedDate}T12:00:00Z`)],
                ['Tahmini süre', duration(minutes ?? 0)],
                ['Ekip', team.length ? team.map((t) => `${personName(t.user)} (${teamRoleLabels[t.role]})`).join(', ') : 'Koordinatör tarafından tamamlanacak'],
                ['Ön tanı', diagnosis || '—'],
              ]}
              warning={patient.allergies ? `Hasta alerjisi: ${patient.allergies}` : undefined}
              note={isAssistant ? 'Asistan olarak hazırladığınız talep, sorumlu hekiminizin onayına taslak olarak gider.' : undefined}
            />
          )}
        </Box>
        <Divider />
        <Box sx={{ px: { xs: 2, md: 4 }, py: 2, display: 'flex', gap: 1 }}>
          <Button color="inherit" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Geri
          </Button>
          <Box sx={{ flex: 1 }} />
          {step < steps.length - 1 ? (
            <Button variant="contained" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Devam
            </Button>
          ) : (
            <>
              <LoadingButton variant="outlined" loading={submitting === 'draft'} disabled={!!submitting} onClick={() => submit(false)}>
                Taslak olarak kaydet
              </LoadingButton>
              {!isAssistant && (
                <LoadingButton variant="contained" loading={submitting === 'submit'} disabled={!!submitting} onClick={() => submit(true)}>
                  Onaya gönder
                </LoadingButton>
              )}
            </>
          )}
        </Box>
      </Card>
    </>
  );
}

function PatientStep({ patient, onChange }: { patient: Patient | null; onChange: (p: Patient | null) => void }) {
  const [q, setQ] = useState('');
  const { data: results = [], isFetching } = usePatientSearch(q);
  const [creating, setCreating] = useState(false);

  return (
    <Stack spacing={2.5}>
      <Autocomplete
        options={results}
        value={patient}
        loading={isFetching}
        filterOptions={(x) => x}
        onInputChange={(_, v) => setQ(v)}
        onChange={(_, v) => onChange(v)}
        getOptionLabel={(p) => `${p.firstName} ${p.lastName} · ${p.mrn}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText={q.length < 2 ? 'Ad, soyad ya da protokol numarası yazın' : 'Hasta bulunamadı'}
        renderOption={(props, p) => (
          <li {...props} key={p.id}>
            <Box>
              <Typography sx={{ fontWeight: 500, fontSize: 14 }}>
                {p.firstName} {p.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Protokol {p.mrn} · {age(p.birthDate)} yaş · {p.gender === 'K' ? 'Kadın' : 'Erkek'}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => <TextField {...params} size="medium" label="Hasta ara" placeholder="Ad, soyad ya da protokol no" autoFocus />}
      />

      {patient && (
        <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'surface.sunken', border: 1, borderColor: 'divider', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Info label="Ad soyad" value={`${patient.firstName} ${patient.lastName}`} />
          <Info label="Protokol" value={patient.mrn} />
          <Info label="Yaş" value={`${age(patient.birthDate)}`} />
          <Info label="Cinsiyet" value={patient.gender === 'K' ? 'Kadın' : 'Erkek'} />
          {patient.allergies && <Chip color="error" icon={<WarningAmberRoundedIcon />} label={`Alerji: ${patient.allergies}`} />}
        </Box>
      )}

      <Box>
        <Button startIcon={<PersonAddAltRoundedIcon />} onClick={() => setCreating((v) => !v)}>
          Sistemde olmayan hasta ekle
        </Button>
        <Collapse in={creating}>
          <NewPatientForm
            onCreated={(p) => {
              onChange(p);
              setCreating(false);
            }}
          />
        </Collapse>
      </Box>
    </Stack>
  );
}

function NewPatientForm({ onCreated }: { onCreated: (p: Patient) => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({ mrn: '', firstName: '', lastName: '', birthDate: '', gender: 'K', allergies: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.post<Patient>('/patients', { ...form, allergies: form.allergies || undefined });
      enqueueSnackbar('Hasta kaydedildi.', { variant: 'success' });
      onCreated(data);
    } catch (err) {
      enqueueSnackbar(errorMessage(err), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5, p: 2, border: 1, borderColor: 'divider', borderRadius: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
      <TextField label="Protokol no" value={form.mrn} onChange={set('mrn')} />
      <TextField label="Ad" value={form.firstName} onChange={set('firstName')} />
      <TextField label="Soyad" value={form.lastName} onChange={set('lastName')} />
      <TextField type="date" label="Doğum tarihi" value={form.birthDate} onChange={set('birthDate')} InputLabelProps={{ shrink: true }} />
      <TextField select label="Cinsiyet" value={form.gender} onChange={set('gender')}>
        <MenuItem value="K">Kadın</MenuItem>
        <MenuItem value="E">Erkek</MenuItem>
      </TextField>
      <TextField label="Alerji" value={form.allergies} onChange={set('allergies')} />
      <Box sx={{ gridColumn: { md: 'span 3' }, display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton variant="contained" loading={saving} onClick={save} disabled={!form.mrn || !form.firstName || !form.lastName || !form.birthDate}>
          Kaydet ve seç
        </LoadingButton>
      </Box>
    </Box>
  );
}

function BranchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data = [] } = useBranches();
  return (
    <TextField select label="Branş" value={value} onChange={(e) => onChange(e.target.value)}>
      <MenuItem value="">Tüm branşlar</MenuItem>
      {data.map((b) => (
        <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
      ))}
    </TextField>
  );
}

function ProcedureSelect({ branchId, value, onChange }: { branchId: string; value: Procedure | null; onChange: (p: Procedure | null) => void }) {
  const { data = [] } = useProcedures(branchId || undefined);
  return (
    <Autocomplete
      options={data}
      value={value}
      onChange={(_, v) => onChange(v)}
      groupBy={(p) => p.branch?.name ?? ''}
      getOptionLabel={(p) => `${p.name} (${p.code})`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderInput={(params) => <TextField {...params} label="İşlem" />}
    />
  );
}

interface TeamStepProps {
  surgeonId: string;
  setSurgeonId: (v: string) => void;
  surgeonLocked: boolean;
  anesthetistId: string;
  setAnesthetistId: (v: string) => void;
  team: TeamEntry[];
  setTeam: (t: TeamEntry[]) => void;
  equipmentIds: string[];
  setEquipmentIds: (v: string[]) => void;
}

function TeamStep(p: TeamStepProps) {
  const { data: surgeons = [] } = useUserLookup(Role.Surgeon);
  const { data: anesthetists = [] } = useUserLookup(Role.Anesthetist);
  const { data: assistants = [] } = useUserLookup(Role.Assistant);
  const { data: nurses = [] } = useUserLookup(Role.Nurse);
  const { data: equipment = [] } = useEquipment();

  const candidates = useMemo(
    () => [...assistants, ...nurses].filter((u) => !p.team.some((t) => t.user.id === u.id)),
    [assistants, nurses, p.team],
  );

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField select label="Operatör hekim" value={p.surgeonId} onChange={(e) => p.setSurgeonId(e.target.value)} disabled={p.surgeonLocked}>
          {surgeons.map((s) => (
            <MenuItem key={s.id} value={s.id}>{personName(s)}</MenuItem>
          ))}
        </TextField>
        <TextField select label="Anestezi uzmanı (isteğe bağlı)" value={p.anesthetistId} onChange={(e) => p.setAnesthetistId(e.target.value)}>
          <MenuItem value="">
            <em>Koordinatör atasın</em>
          </MenuItem>
          {anesthetists.map((a) => (
            <MenuItem key={a.id} value={a.id}>{personName(a)}</MenuItem>
          ))}
        </TextField>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Ekip üyeleri
        </Typography>
        <Autocomplete
          options={candidates}
          value={null}
          blurOnSelect
          onChange={(_, u) => u && p.setTeam([...p.team, { user: u, role: u.role === Role.Assistant ? 'ASSISTANT' : 'SCRUB_NURSE' }])}
          groupBy={(u) => (u.role === Role.Assistant ? 'Asistan doktorlar' : 'Hemşireler')}
          getOptionLabel={(u) => personName(u)}
          renderInput={(params) => <TextField {...params} label="Ekibe kişi ekle" />}
        />
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {p.team.map((t, i) => (
            <Box key={t.user.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, pl: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Typography sx={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{personName(t.user)}</Typography>
              <TextField
                select
                value={t.role}
                onChange={(e) => p.setTeam(p.team.map((x, j) => (j === i ? { ...x, role: e.target.value as TeamRole } : x)))}
                sx={{ width: 180 }}
              >
                {Object.entries(teamRoleLabels).map(([v, l]) => (
                  <MenuItem key={v} value={v}>{l}</MenuItem>
                ))}
              </TextField>
              <IconButton onClick={() => p.setTeam(p.team.filter((_, j) => j !== i))} aria-label="Çıkar">
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </Box>

      <Autocomplete
        multiple
        options={equipment.filter((e) => e.isActive)}
        value={equipment.filter((e) => p.equipmentIds.includes(e.id))}
        onChange={(_, v) => p.setEquipmentIds(v.map((e) => e.id))}
        getOptionLabel={(e) => `${e.name} (${e.quantity} adet)`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => <TextField {...params} label="Gerekli ekipman" helperText="Aynı saatte tüm adetleri kullanımda olan ekipman için planlama engellenir." />}
      />
    </Stack>
  );
}

function Summary({ rows, warning, note }: { rows: Array<[string, ReactNode]>; warning?: string; note?: string }) {
  return (
    <Stack spacing={2}>
      {warning && <Alert severity="error">{warning}</Alert>}
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        {rows.map(([k, v], i) => (
          <Box key={k} sx={{ display: 'flex', px: 2, py: 1.25, bgcolor: i % 2 ? 'transparent' : 'surface.sunken', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
              {k}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {v}
            </Typography>
          </Box>
        ))}
      </Box>
      {note && <Alert severity="info">{note}</Alert>}
    </Stack>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}
