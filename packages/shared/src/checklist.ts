export const ChecklistPhase = {
  SignIn: 'SIGN_IN',
  TimeOut: 'TIME_OUT',
  SignOut: 'SIGN_OUT',
} as const;
export type ChecklistPhase = typeof ChecklistPhase[keyof typeof ChecklistPhase];

export const checklistPhaseLabels: Record<ChecklistPhase, string> = {
  SIGN_IN: 'Anestezi indüksiyonu öncesi',
  TIME_OUT: 'Cilt insizyonu öncesi',
  SIGN_OUT: 'Hasta ameliyathaneden çıkmadan önce',
};

export interface ChecklistTemplateItem {
  key: string;
  phase: ChecklistPhase;
  text: string;
}

// Adapted from the WHO Surgical Safety Checklist (2009).
export const checklistTemplate: readonly ChecklistTemplateItem[] = [
  { key: 'identity_confirmed', phase: 'SIGN_IN', text: 'Hasta kimliği, bölge, işlem ve onam doğrulandı' },
  { key: 'site_marked', phase: 'SIGN_IN', text: 'Ameliyat bölgesi işaretlendi' },
  { key: 'anesthesia_check', phase: 'SIGN_IN', text: 'Anestezi cihaz ve ilaç kontrolü tamamlandı' },
  { key: 'pulse_oximeter', phase: 'SIGN_IN', text: 'Pulse oksimetre takılı ve çalışıyor' },
  { key: 'allergy_known', phase: 'SIGN_IN', text: 'Bilinen alerji soruldu' },
  { key: 'airway_risk', phase: 'SIGN_IN', text: 'Zor hava yolu / aspirasyon riski değerlendirildi' },
  { key: 'blood_loss_risk', phase: 'SIGN_IN', text: '>500 ml kan kaybı riski değerlendirildi' },
  { key: 'team_introduced', phase: 'TIME_OUT', text: 'Ekip üyeleri isim ve görevleriyle tanıtıldı' },
  { key: 'verbal_confirmation', phase: 'TIME_OUT', text: 'Hasta, bölge ve işlem sözlü olarak teyit edildi' },
  { key: 'antibiotic_given', phase: 'TIME_OUT', text: 'Son 60 dk içinde profilaktik antibiyotik verildi' },
  { key: 'critical_events', phase: 'TIME_OUT', text: 'Kritik adımlar ve beklenen süre konuşuldu' },
  { key: 'imaging_displayed', phase: 'TIME_OUT', text: 'Gerekli görüntüleme ekranda' },
  { key: 'procedure_recorded', phase: 'SIGN_OUT', text: 'Yapılan işlemin adı kaydedildi' },
  { key: 'counts_correct', phase: 'SIGN_OUT', text: 'Alet, gazlı bez ve iğne sayımları doğru' },
  { key: 'specimen_labelled', phase: 'SIGN_OUT', text: 'Patoloji materyali etiketlendi' },
  { key: 'equipment_issues', phase: 'SIGN_OUT', text: 'Ekipman sorunları bildirildi' },
  { key: 'recovery_plan', phase: 'SIGN_OUT', text: 'Derlenme ve takip planı konuşuldu' },
];
