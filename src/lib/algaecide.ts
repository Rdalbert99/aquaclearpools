// Scheduled maintenance algaecide dosing.
//
// Standard maintenance dose for a 60% polyquat-style algaecide is roughly
// 6 fl oz per 10,000 gallons per treatment. We keep the math in one place so the
// service screen and the customer settings agree.

export const DEFAULT_ALGAECIDE_INTERVAL_DAYS = 14;
export const OZ_PER_10K_GALLONS = 6;

export interface AlgaecideSchedule {
  intervalDays?: number | null;
  product?: string | null;
  lastDosed?: string | null; // ISO date (YYYY-MM-DD)
}

export interface AlgaecideStatus {
  enabled: boolean;
  intervalDays: number;
  product: string;
  lastDosed: Date | null;
  daysSince: number | null;
  due: boolean;
  daysUntilDue: number | null;
  doseOz: number;
  doseLabel: string;
}

/** Maintenance dose in fluid ounces for the given pool volume, rounded to 0.5 oz. */
export function algaecideDoseOz(poolGallons: number | null | undefined): number {
  const gallons = poolGallons && poolGallons > 0 ? poolGallons : 10000;
  const raw = (gallons / 10000) * OZ_PER_10K_GALLONS;
  return Math.max(1, Math.round(raw * 2) / 2);
}

export function getAlgaecideStatus(
  schedule: AlgaecideSchedule | null | undefined,
  poolGallons: number | null | undefined,
  now = new Date(),
): AlgaecideStatus {
  const intervalDays = schedule?.intervalDays ?? 0;
  const enabled = intervalDays > 0;
  const product = schedule?.product?.trim() || 'Maintenance algaecide';
  const lastDosed = schedule?.lastDosed ? new Date(`${schedule.lastDosed}T00:00:00`) : null;
  const daysSince = lastDosed ? Math.floor((now.getTime() - lastDosed.getTime()) / 86400000) : null;
  const doseOz = algaecideDoseOz(poolGallons);

  const due = enabled && (daysSince == null || daysSince >= intervalDays);
  const daysUntilDue = enabled && daysSince != null ? Math.max(0, intervalDays - daysSince) : null;

  return {
    enabled,
    intervalDays: enabled ? intervalDays : DEFAULT_ALGAECIDE_INTERVAL_DAYS,
    product,
    lastDosed,
    daysSince,
    due,
    daysUntilDue,
    doseOz,
    doseLabel: `${doseOz} fl oz of ${product}`,
  };
}
