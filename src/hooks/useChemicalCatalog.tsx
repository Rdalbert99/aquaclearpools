import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CHEMICAL_OPTIONS, ChemicalOption, ChemicalUnit } from '@/lib/chemicals-added';

export interface CatalogRow {
  id: string;
  slug: string;
  label: string;
  units: string[];
  purpose: string;
  sort_order: number;
  active: boolean;
  is_other: boolean;
}

/**
 * Loads the admin-managed chemical catalog. Falls back to the built-in
 * defaults so the UI still works if the table is empty or offline.
 */
export function useChemicalCatalog() {
  const query = useQuery({
    queryKey: ['chemical-catalog'],
    queryFn: async (): Promise<ChemicalOption[]> => {
      const { data, error } = await supabase
        .from('chemical_catalog' as any)
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) {
        return CHEMICAL_OPTIONS;
      }

      return (data as unknown as CatalogRow[]).map(r => ({
        id: r.slug,
        label: r.label,
        units: (r.units as ChemicalUnit[]),
        purpose: r.purpose ?? '',
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    options: query.data ?? CHEMICAL_OPTIONS,
    loading: query.isLoading,
  };
}
