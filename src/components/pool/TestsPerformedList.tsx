import { POOL_TESTS, isTestId, type TestId } from '@/lib/pool-tests';

interface TestsPerformedListProps {
  /** `tests_performed` array stored on the service row. */
  testsPerformed?: unknown;
  /** The service `readings` JSON. */
  readings?: Record<string, unknown> | null;
  /** Legacy column fallbacks keyed by test id. */
  fallbacks?: Partial<Record<TestId, number | null | undefined>>;
  className?: string;
}

/**
 * Shows every water test with its result, and clearly marks the ones
 * that were not run on that visit.
 */
export function TestsPerformedList({ testsPerformed, readings, fallbacks, className }: TestsPerformedListProps) {
  const explicit = Array.isArray(testsPerformed) ? testsPerformed.filter(isTestId) : null;

  const rows = POOL_TESTS.map(t => {
    const raw = (readings?.[t.readingKey] as number | null | undefined) ?? fallbacks?.[t.id] ?? null;
    const value = raw == null || raw === ('' as unknown) ? null : raw;
    const tested = explicit ? explicit.includes(t.id) : value != null;
    return { t, value, tested };
  });

  const anyTested = rows.some(r => r.tested);
  if (!anyTested) {
    return <p className={`text-sm text-muted-foreground ${className ?? ''}`}>No water tests were recorded for this service.</p>;
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm ${className ?? ''}`}>
      {rows.map(({ t, value, tested }) => (
        <div
          key={t.id}
          className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${tested ? '' : 'opacity-60 border-dashed'}`}
        >
          <span className="text-muted-foreground">{t.label}</span>
          {tested ? (
            <span className="font-medium">
              {value != null ? `${value}${t.unit ? ` ${t.unit}` : ''}` : '—'}
            </span>
          ) : (
            <span className="text-xs italic text-muted-foreground">Not tested</span>
          )}
        </div>
      ))}
    </div>
  );
}
