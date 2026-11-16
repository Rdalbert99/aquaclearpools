import { describe, expect, it } from 'vitest';
import {
  isCurrentWeekVisitOverdue, isRecurringServiceOn,
  nextScheduledServiceDate, recurringScheduleIssue, type RouteScheduleFields,
} from '../service-season';

const nov = (day: number) => new Date(2026, 10, day);
const weekly: RouteScheduleFields = {
  status: 'Active', service_days: [' MON ', 'monday'], service_mode: 'in_season', in_season_frequency: 'weekly',
};
const biweekly = { ...weekly, in_season_frequency: 'biweekly', biweekly_anchor_date: '2026-11-09' };

describe('Aqua Clear recurring route schedule', () => {
  it.each(['Suspended', 'Inactive', ' suspended '])('excludes %s accounts from recurring routes and raw next dates', (status) => {
    const client = { ...weekly, status, next_service_date: '2026-11-16T00:00:00+00:00' };
    expect(isRecurringServiceOn(client, nov(16))).toBe(false);
    expect(nextScheduledServiceDate(client, nov(15))).toBeNull();
    expect(isCurrentWeekVisitOverdue(client, nov(17))).toBe(false);
  });

  it('shows two weekly dates for a verified weekly account but only the configured alternate week for biweekly', () => {
    expect([nov(9), nov(16)].map((date) => isRecurringServiceOn(weekly, date))).toEqual([true, true]);
    expect([nov(9), nov(16), nov(23), nov(30)].map((date) => isRecurringServiceOn(biweekly, date))).toEqual([true, false, true, false]);
    expect(nextScheduledServiceDate(biweekly, nov(9))).toEqual(nov(23));
    expect(isRecurringServiceOn(biweekly, nov(17))).toBe(false);
  });

  it('honors a dated off season and the weekly exception', () => {
    const winter = { ...weekly, off_season_start: '2026-10-01', off_season_end: '2027-04-30' };
    const winterBiweekly = { ...winter, off_season_frequency: 'biweekly', biweekly_anchor_date: '2026-11-09' };
    expect(isRecurringServiceOn(winterBiweekly, nov(16))).toBe(false);
    expect(isRecurringServiceOn({ ...winter, off_season_frequency: 'weekly' }, nov(16))).toBe(true);
    expect(isRecurringServiceOn(winterBiweekly, new Date(2027, 4, 3))).toBe(true);
  });

  it('keeps twice-monthly choices distinct from alternate ISO weeks', () => {
    const monthly = { ...weekly, service_mode: 'off_season', off_season_frequency: 'twice_monthly', off_season_weeks: '1_3' };
    expect([nov(2), nov(9), nov(16), nov(23), nov(30)].map((date) => isRecurringServiceOn(monthly, date)))
      .toEqual([true, false, true, false, false]);
    expect(isRecurringServiceOn({ ...monthly, off_season_weeks: '2_4' }, nov(23))).toBe(true);
  });

  it('does not generate weekly visits when Basic Bi-weekly conflicts with the Seasonal route', () => {
    const conflict = { ...weekly, service_frequency: 'bi-weekly' };
    expect(recurringScheduleIssue(conflict, nov(16))).toBe('confirm_rotation');
    expect(nextScheduledServiceDate(conflict, nov(16))).toBeNull();
    expect(isRecurringServiceOn({ ...conflict, in_season_frequency: 'biweekly', biweekly_anchor_date: '2026-11-09' }, nov(23))).toBe(true);
  });

  it('does not turn a stored profile date into a route stop or rotation anchor', () => {
    const offWeekProfileDate = { ...biweekly, next_service_date: '2026-11-16T00:00:00+00:00' };
    expect(isRecurringServiceOn(offWeekProfileDate, nov(16))).toBe(false);
    expect(nextScheduledServiceDate(offWeekProfileDate, nov(9))).toEqual(nov(23));
  });

  it('does not schedule an off-season paused account from its weekday or show it overdue', () => {
    const paused = { ...weekly, service_mode: 'off_season', off_season_frequency: 'none', last_service_date: '2026-10-26' };
    expect(recurringScheduleIssue(paused, nov(16))).toBe('paused');
    expect(isRecurringServiceOn(paused, nov(16))).toBe(false);
    expect(nextScheduledServiceDate(paused, nov(16))).toBeNull();
    expect(isCurrentWeekVisitOverdue(paused, nov(17))).toBe(false);
  });

  it('only shows unfulfilled recurring stops already missed in the current week', () => {
    expect(isCurrentWeekVisitOverdue(biweekly, nov(23))).toBe(false);
    expect(isCurrentWeekVisitOverdue(biweekly, nov(24))).toBe(true);
    expect(isCurrentWeekVisitOverdue({ ...biweekly, last_service_date: '2026-11-23' }, nov(24))).toBe(false);
    expect(isCurrentWeekVisitOverdue(biweekly, nov(17))).toBe(false);
  });

  it('ignores impossible season dates rather than letting Date roll them into a different month', () => {
    const invalidSeason = { ...weekly, off_season_start: '2026-10-32', off_season_frequency: 'none' };
    expect(isRecurringServiceOn(invalidSeason, nov(16))).toBe(true);
  });
  it('preserves twice-weekly Monday/Thursday visits when both frequency fields agree', () => {
    const account = { ...weekly, service_frequency: 'weekly', service_days: ['monday', 'thursday'] };
    expect([9, 12, 16, 19, 23, 26].every(day => isRecurringServiceOn(account, nov(day)))).toBe(true);
  });

  it('honors verified Tuesday alternate weeks, same in or out of season', () => {
    const account = { ...biweekly, service_days: ['tuesday'], biweekly_anchor_date: '2026-11-03' };
    const offSeason = { ...account, service_mode: 'off_season', off_season_frequency: 'biweekly' };
    for (const client of [account, offSeason]) {
      expect(isRecurringServiceOn(client, nov(17))).toBe(true);
      expect(isRecurringServiceOn(client, nov(24))).toBe(false);
      expect(nextScheduledServiceDate(client, nov(17))).toEqual(new Date(2026, 11, 1));
    }
  });

  it('does not guess a rotation when an every-other-week customer has no verified anchor', () => {
    const account = { ...biweekly, biweekly_anchor_date: null, next_service_date: '2026-11-03' };
    expect(recurringScheduleIssue(account, nov(16))).toBe('confirm_rotation');
    expect(nextScheduledServiceDate(account, nov(16))).toBeNull();
  });

  it('preserves fourteen days across an ISO week-53 rollover', () => {
    const account = { ...biweekly, service_days: ['tuesday'], biweekly_anchor_date: '2026-12-29' };
    expect(isRecurringServiceOn(account, new Date(2026, 11, 29))).toBe(true);
    expect(nextScheduledServiceDate(account, new Date(2026, 11, 29))).toEqual(new Date(2027, 0, 12));
  });
});
