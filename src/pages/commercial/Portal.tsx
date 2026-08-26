import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCommercialPortal } from '@/hooks/useCommercialPortal';
import { Navbar } from '@/components/layout/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Building2 } from 'lucide-react';
import { FacilityScope, PoolWithClient } from '@/components/commercial/types';
import { PortalDashboard } from '@/components/commercial/PortalDashboard';
import { ServiceHistoryPanel } from '@/components/commercial/ServiceHistoryPanel';
import { ChemistryPanel } from '@/components/commercial/ChemistryPanel';
import { ChemicalUsagePanel } from '@/components/commercial/ChemicalUsagePanel';
import { EquipmentPanel } from '@/components/commercial/EquipmentPanel';
import { IssuesPanel } from '@/components/commercial/IssuesPanel';
import { PhotosPanel } from '@/components/commercial/PhotosPanel';
import { DocumentsPanel } from '@/components/commercial/DocumentsPanel';
import { MonthlyReportPanel } from '@/components/commercial/MonthlyReportPanel';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'history', label: 'Service History' },
  { key: 'chemistry', label: 'Water Chemistry' },
  { key: 'usage', label: 'Chemical Usage' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'issues', label: 'Issues & Warranty' },
  { key: 'photos', label: 'Photos' },
  { key: 'documents', label: 'Documents' },
  { key: 'reports', label: 'Monthly Reports' },
];

const CommercialPortal = () => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const data = useCommercialPortal();
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login');
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!facilityId && data.facilities.length) setFacilityId(data.facilities[0].id);
  }, [data.facilities, facilityId]);

  const scope: FacilityScope | null = useMemo(() => {
    const facility = data.facilities.find((f) => f.id === facilityId);
    if (!facility) return null;
    const clientsById = new Map(data.clients.map((c) => [c.id, c]));
    const pools: PoolWithClient[] = data.pools
      .filter((p) => p.facility_id === facility.id)
      .map((p) => ({ ...p, client: p.client_id ? clientsById.get(p.client_id) ?? null : null }));
    const clientIds = new Set(pools.map((p) => p.client_id).filter(Boolean) as string[]);
    const services = data.services.filter((s) => s.client_id && clientIds.has(s.client_id));
    const serviceIds = new Set(services.map((s) => s.id));
    return {
      organization: data.organizations.find((o) => o.id === facility.organization_id) ?? null,
      facility,
      pools,
      services,
      chemUsage: data.chemUsage.filter((u) => serviceIds.has(u.service_id)),
      equipment: data.equipment.filter((e) => e.facility_id === facility.id),
      issues: data.issues.filter((i) => i.facility_id === facility.id),
      issueEvents: data.issueEvents,
      documents: data.documents.filter((d) => d.facility_id === facility.id),
      technicianNames: data.technicianNames,
    };
  }, [data, facilityId]);

  if (authLoading || data.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.memberships.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Navbar />
        <main className="mx-auto max-w-xl px-4 py-16">
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Commercial portal access not enabled</h1>
              <p className="text-sm text-muted-foreground">
                This account, {user?.email}, isn't linked to a commercial organization yet. Contact Aqua Clear Pools
                and we'll add you to your facility.
              </p>
              <Button asChild variant="outline"><Link to="/">Back to site</Link></Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8">
        <header className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {scope?.organization?.name ?? 'Commercial portal'}
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">{scope?.facility.name ?? 'Facility'}</h1>
          {data.facilities.length > 1 && (
            <Select value={facilityId ?? undefined} onValueChange={setFacilityId}>
              <SelectTrigger className="w-full sm:w-[280px]"><SelectValue placeholder="Select facility" /></SelectTrigger>
              <SelectContent>
                {data.facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </header>

        {/* Mobile-first scrollable tab rail */}
        <div className="-mx-3 mb-4 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                  tab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {data.error && (
          <Card className="mb-4 border-destructive/40">
            <CardContent className="p-4 text-sm text-destructive">{data.error}</CardContent>
          </Card>
        )}

        {scope && (
          <>
            {tab === 'dashboard' && <PortalDashboard scope={scope} onNavigate={setTab} />}
            {tab === 'history' && <ServiceHistoryPanel scope={scope} />}
            {tab === 'chemistry' && <ChemistryPanel scope={scope} />}
            {tab === 'usage' && <ChemicalUsagePanel scope={scope} />}
            {tab === 'equipment' && <EquipmentPanel scope={scope} />}
            {tab === 'issues' && <IssuesPanel scope={scope} />}
            {tab === 'photos' && <PhotosPanel scope={scope} />}
            {tab === 'documents' && <DocumentsPanel scope={scope} />}
            {tab === 'reports' && <MonthlyReportPanel scope={scope} />}
          </>
        )}

        {!scope && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No facilities are configured for your organization yet.</CardContent></Card>
        )}
      </main>
    </div>
  );
};

export default CommercialPortal;
