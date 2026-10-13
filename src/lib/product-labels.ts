import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type PoolSuitability = 'verified' | 'not_verified' | 'not_suitable';

export interface ProductLabel {
  id: string;
  catalog_slug: string;
  product_name: string;
  manufacturer: string | null;
  active_ingredient: string | null;
  strength_min_pct: number | null;
  strength_max_pct: number | null;
  form: string | null;
  container_size: string | null;
  pool_suitability: PoolSuitability;
  suitability_source: string | null;
  label_notes: string | null;
  is_preferred: boolean;
  active: boolean;
  verified_at: string | null;
}

/** Validates a label before saving. Returns an error message or null. */
export function labelError(l: Pick<ProductLabel, 'product_name' | 'strength_min_pct' | 'strength_max_pct' | 'pool_suitability' | 'suitability_source'>): string | null {
  if (!l.product_name?.trim()) return 'Product name is required.';
  for (const v of [l.strength_min_pct, l.strength_max_pct]) {
    if (v != null && (!Number.isFinite(v) || v <= 0 || v > 100)) return 'Strength must be between 0 and 100%.';
  }
  if (l.strength_min_pct != null && l.strength_max_pct != null && l.strength_min_pct > l.strength_max_pct)
    return 'Minimum strength cannot be higher than maximum.';
  if (l.pool_suitability === 'verified' && !l.suitability_source?.trim())
    return 'Say where pool suitability was confirmed (label, SDS, manufacturer).';
  return null;
}

/** Exact strength only when the label states one number; a range never collapses to a guess. */
export function exactStrength(l: Pick<ProductLabel, 'strength_min_pct' | 'strength_max_pct'> | null | undefined): number | null {
  if (!l || l.strength_min_pct == null || l.strength_max_pct == null) return null;
  return l.strength_min_pct === l.strength_max_pct ? Number(l.strength_min_pct) : null;
}

/** Only an admin-verified label counts as pool-suitable. Missing label = not verified. */
export function isPoolVerified(l: Pick<ProductLabel, 'pool_suitability' | 'active'> | null | undefined): boolean {
  return !!l && l.active && l.pool_suitability === 'verified';
}

export function strengthText(l: Pick<ProductLabel, 'strength_min_pct' | 'strength_max_pct'>): string {
  const { strength_min_pct: a, strength_max_pct: b } = l;
  if (a == null && b == null) return 'strength not recorded';
  if (a != null && b != null) return a === b ? `${a}%` : `${a}–${b}%`;
  return `${a ?? b}%`;
}

export function useProductLabels(slug?: string) {
  return useQuery({
    queryKey: ['product-labels', slug ?? 'all'],
    queryFn: async (): Promise<ProductLabel[]> => {
      let q = supabase.from('chemical_product_labels' as any).select('*').order('is_preferred', { ascending: false }).order('product_name');
      if (slug) q = q.eq('catalog_slug', slug);
      const { data, error } = await q;
      if (error) return [];
      return (data as unknown as ProductLabel[]) ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/** The saved DOWFLAKE Xtra label record, if any. */
export function findDowflake(labels: ProductLabel[] | undefined): ProductLabel | null {
  return labels?.find(l => l.active && l.catalog_slug === 'calcium_chloride' && /dowflake/i.test(l.product_name)) ?? null;
}
