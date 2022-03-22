import { addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz';
import { HOSPITAL_TIME_ZONE } from '@surgiplan/shared';

export function startOfHospitalDay(isoDate: string): Date {
  return zonedTimeToUtc(`${isoDate}T00:00:00`, HOSPITAL_TIME_ZONE);
}

export function hospitalDayRange(isoDate: string): { from: Date; to: Date } {
  const from = startOfHospitalDay(isoDate);
  return { from, to: startOfHospitalDay(formatInTimeZone(addDays(from, 1), HOSPITAL_TIME_ZONE, 'yyyy-MM-dd')) };
}

export function hospitalDate(date: Date): string {
  return formatInTimeZone(date, HOSPITAL_TIME_ZONE, 'yyyy-MM-dd');
}

export function hospitalHour(date: Date): number {
  return Number(formatInTimeZone(date, HOSPITAL_TIME_ZONE, 'H')) + Number(formatInTimeZone(date, HOSPITAL_TIME_ZONE, 'm')) / 60;
}

export function formatHospital(date: Date, pattern = 'd MMMM yyyy HH:mm'): string {
  return formatInTimeZone(date, HOSPITAL_TIME_ZONE, pattern, { locale: tr });
}
