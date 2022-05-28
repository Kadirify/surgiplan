import { HOSPITAL_TIME_ZONE } from '@surgiplan/shared';
import { differenceInYears } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import type { PersonRef } from '@/api/types';

export function fmt(date: string | Date | null | undefined, pattern = 'd MMM yyyy HH:mm') {
  if (!date) return '—';
  return formatInTimeZone(new Date(date), HOSPITAL_TIME_ZONE, pattern, { locale: tr });
}

export const fmtTime = (date: string | Date | null | undefined) => fmt(date, 'HH:mm');
export const fmtDate = (date: string | Date | null | undefined) => fmt(date, 'd MMMM yyyy');
export const fmtDay = (date: string | Date | null | undefined) => fmt(date, 'd MMMM, EEEE');

export function hospitalToday() {
  return formatInTimeZone(new Date(), HOSPITAL_TIME_ZONE, 'yyyy-MM-dd');
}

export function hospitalDateOf(date: string | Date) {
  return formatInTimeZone(new Date(date), HOSPITAL_TIME_ZONE, 'yyyy-MM-dd');
}

/** UTC instant for a wall-clock time in the hospital's time zone. */
export function hospitalInstant(isoDate: string, minutesFromMidnight: number) {
  const h = String(Math.floor(minutesFromMidnight / 60)).padStart(2, '0');
  const m = String(minutesFromMidnight % 60).padStart(2, '0');
  return zonedTimeToUtc(`${isoDate}T${h}:${m}:00`, HOSPITAL_TIME_ZONE);
}

export function minutesIntoHospitalDay(date: string | Date) {
  const d = new Date(date);
  return Number(formatInTimeZone(d, HOSPITAL_TIME_ZONE, 'H')) * 60 + Number(formatInTimeZone(d, HOSPITAL_TIME_ZONE, 'm'));
}

export function shiftDate(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function personName(p?: PersonRef | null) {
  if (!p) return '—';
  return [p.title, p.fullName].filter(Boolean).join(' ');
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
}

export function age(birthDate: string) {
  return differenceInYears(new Date(), new Date(birthDate));
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

export function percent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return '—';
  return `%${(value * 100).toFixed(digits)}`;
}

export function relative(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} gün önce`;
  return fmtDate(date);
}
