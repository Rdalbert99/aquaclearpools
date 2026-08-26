import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FacilityScope, technicianName } from './types';
import { formatDate } from '@/lib/commercial';
import { getSignedStorageUrl } from '@/lib/storage-urls';

interface Props {
  scope: FacilityScope;
}

interface Photo {
  key: string;
  url: string;
  caption: string;
  date: string;
}

/** Surfaces the before/after photos technicians already capture during service. */
export const PhotosPanel = ({ scope }: Props) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const raw: Photo[] = [];
      scope.services.forEach((s) => {
        const pool = scope.pools.find((p) => p.client_id === s.client_id);
        const base = `${pool?.name ?? 'Pool'} · ${technicianName(scope, s.technician_id)}`;
        if (s.before_photo_url) raw.push({ key: `${s.id}-b`, url: s.before_photo_url, caption: `Before — ${base}`, date: s.performed_at });
        if (s.after_photo_url) raw.push({ key: `${s.id}-a`, url: s.after_photo_url, caption: `After — ${base}`, date: s.performed_at });
      });

      const resolved = await Promise.all(
        raw.map(async (p) => ({
          ...p,
          url: (await getSignedStorageUrl(p.url, 'photos')) ?? p.url,
        })),
      );
      if (!cancelled) {
        setPhotos(resolved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [scope]);

  if (loading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading photos…</CardContent></Card>;
  if (photos.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No service photos have been captured for this facility yet.</CardContent></Card>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {photos.map((p) => (
        <figure key={p.key} className="overflow-hidden rounded-lg border">
          <img src={p.url} alt={p.caption} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <figcaption className="p-2">
            <p className="text-xs font-medium leading-tight">{p.caption}</p>
            <p className="text-[11px] text-muted-foreground">{formatDate(p.date)}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
};
