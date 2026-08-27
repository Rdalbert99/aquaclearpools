import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, MapPin, Waves } from 'lucide-react';

export interface CommercialFormData {
  org_mode: 'new' | 'existing';
  organization_id: string;
  org_name: string;
  org_primary_contact: string;
  org_email: string;
  org_phone: string;
  org_billing_notes: string;

  facility_mode: 'new' | 'existing';
  facility_id: string;
  facility_name: string;
  facility_address: string;
  facility_city: string;
  facility_state: string;
  facility_zip: string;
  facility_contact_name: string;
  facility_contact_phone: string;
  facility_notes: string;

  pool_name: string;
  pool_use: string;
  pool_type: string;
  pool_size: string;
  sanitizer_type: string;
  pool_service_frequency: string;
  season_start: string;
  season_end: string;
  pool_notes: string;
}

export const emptyCommercial: CommercialFormData = {
  org_mode: 'new',
  organization_id: '',
  org_name: '',
  org_primary_contact: '',
  org_email: '',
  org_phone: '',
  org_billing_notes: '',
  facility_mode: 'new',
  facility_id: '',
  facility_name: '',
  facility_address: '',
  facility_city: '',
  facility_state: '',
  facility_zip: '',
  facility_contact_name: '',
  facility_contact_phone: '',
  facility_notes: '',
  pool_name: '',
  pool_use: '',
  pool_type: '',
  pool_size: '',
  sanitizer_type: '',
  pool_service_frequency: 'weekly',
  season_start: '',
  season_end: '',
  pool_notes: '',
};

interface OrgOption { id: string; name: string }
interface FacilityOption { id: string; name: string; organization_id: string }

interface Props {
  value: CommercialFormData;
  onChange: (next: CommercialFormData) => void;
  organizations: OrgOption[];
  facilities: FacilityOption[];
}

export function CommercialClientFields({ value, onChange, organizations, facilities }: Props) {
  const set = (patch: Partial<CommercialFormData>) => onChange({ ...value, ...patch });

  const scopedFacilities = value.org_mode === 'existing'
    ? facilities.filter((f) => f.organization_id === value.organization_id)
    : [];

  return (
    <>
      {/* ORGANIZATION */}
      <Card className="lg:col-span-2 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Commercial Organization</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization</Label>
            <Select
              value={value.org_mode}
              onValueChange={(v: 'new' | 'existing') =>
                set({ org_mode: v, organization_id: '', facility_mode: v === 'new' ? 'new' : value.facility_mode, facility_id: '' })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create a new organization</SelectItem>
                <SelectItem value="existing">Use an existing organization</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value.org_mode === 'existing' ? (
            <div className="space-y-2">
              <Label>Select organization *</Label>
              <Select value={value.organization_id} onValueChange={(v) => set({ organization_id: v, facility_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Choose organization..." /></SelectTrigger>
                <SelectContent>
                  {organizations.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organization / company name *</Label>
                <Input value={value.org_name} onChange={(e) => set({ org_name: e.target.value })} placeholder="e.g. Hattiesburg Country Club" />
              </div>
              <div className="space-y-2">
                <Label>Primary contact</Label>
                <Input value={value.org_primary_contact} onChange={(e) => set({ org_primary_contact: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Billing email</Label>
                <Input type="email" value={value.org_email} onChange={(e) => set({ org_email: e.target.value })} placeholder="billing@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={value.org_phone} onChange={(e) => set({ org_phone: e.target.value })} placeholder="(601) 555-0100" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Billing information / notes</Label>
                <Textarea rows={2} value={value.org_billing_notes} onChange={(e) => set({ org_billing_notes: e.target.value })} placeholder="PO number, billing address, invoicing terms..." />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FACILITY */}
      <Card className="lg:col-span-2 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Facility</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.org_mode === 'existing' && (
            <div className="space-y-2">
              <Label>Facility</Label>
              <Select value={value.facility_mode} onValueChange={(v: 'new' | 'existing') => set({ facility_mode: v, facility_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create a new facility</SelectItem>
                  <SelectItem value="existing">Use an existing facility</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {value.org_mode === 'existing' && value.facility_mode === 'existing' ? (
            <div className="space-y-2">
              <Label>Select facility *</Label>
              <Select value={value.facility_id} onValueChange={(v) => set({ facility_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose facility..." /></SelectTrigger>
                <SelectContent>
                  {scopedFacilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {scopedFacilities.length === 0 && (
                <p className="text-xs text-muted-foreground">This organization has no facilities yet — switch to "Create a new facility".</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Facility name *</Label>
                <Input value={value.facility_name} onChange={(e) => set({ facility_name: e.target.value })} placeholder="e.g. Main Pool Complex" />
              </div>
              <div className="space-y-2">
                <Label>Street address</Label>
                <Input value={value.facility_address} onChange={(e) => set({ facility_address: e.target.value })} placeholder="123 Club Dr" />
              </div>
              <div className="grid grid-cols-3 gap-2 md:col-span-2">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={value.facility_city} onChange={(e) => set({ facility_city: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input maxLength={2} value={value.facility_state} onChange={(e) => set({ facility_state: e.target.value.toUpperCase() })} />
                </div>
                <div className="space-y-2">
                  <Label>ZIP</Label>
                  <Input value={value.facility_zip} onChange={(e) => set({ facility_zip: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>On-site contact</Label>
                <Input value={value.facility_contact_name} onChange={(e) => set({ facility_contact_name: e.target.value })} placeholder="Facility manager" />
              </div>
              <div className="space-y-2">
                <Label>On-site phone</Label>
                <Input value={value.facility_contact_phone} onChange={(e) => set({ facility_contact_phone: e.target.value })} placeholder="(601) 555-0111" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Facility notes</Label>
                <Textarea rows={2} value={value.facility_notes} onChange={(e) => set({ facility_notes: e.target.value })} placeholder="Gate codes, access instructions, hours..." />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* POOL */}
      <Card className="lg:col-span-2 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Waves className="h-5 w-5" />
            <span>Commercial Pool</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This pool is linked automatically to the client record created below, so technician visits, chemistry and chemical usage flow into the Commercial Portal with no double entry.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pool name *</Label>
              <Input value={value.pool_name} onChange={(e) => set({ pool_name: e.target.value })} placeholder="e.g. Competition Pool" />
            </div>
            <div className="space-y-2">
              <Label>Pool use</Label>
              <Input value={value.pool_use} onChange={(e) => set({ pool_use: e.target.value })} placeholder="Lap, kids, spa, therapy..." />
            </div>
            <div className="space-y-2">
              <Label>Pool type</Label>
              <Input value={value.pool_type} onChange={(e) => set({ pool_type: e.target.value })} placeholder="Gunite, plaster, stainless..." />
            </div>
            <div className="space-y-2">
              <Label>Estimated / confirmed gallons</Label>
              <Input type="number" value={value.pool_size} onChange={(e) => set({ pool_size: e.target.value })} placeholder="e.g. 250000" />
            </div>
            <div className="space-y-2">
              <Label>Sanitizer / system type</Label>
              <Select value={value.sanitizer_type} onValueChange={(v) => set({ sanitizer_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select system..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Liquid Chlorine">Liquid chlorine</SelectItem>
                  <SelectItem value="Cal Hypo">Cal hypo</SelectItem>
                  <SelectItem value="Trichlor">Trichlor</SelectItem>
                  <SelectItem value="Salt Chlorine Generator">Salt chlorine generator</SelectItem>
                  <SelectItem value="Bromine">Bromine</SelectItem>
                  <SelectItem value="UV / Chlorine">UV + chlorine</SelectItem>
                  <SelectItem value="Ozone / Chlorine">Ozone + chlorine</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service frequency</Label>
              <Select value={value.pool_service_frequency} onValueChange={(v) => set({ pool_service_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="3x-weekly">3x weekly</SelectItem>
                  <SelectItem value="2x-weekly">2x weekly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="as-needed">As needed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Swim season start (optional)</Label>
              <Input type="date" value={value.season_start} onChange={(e) => set({ season_start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Swim season end (optional)</Label>
              <Input type="date" value={value.season_end} onChange={(e) => set({ season_end: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Pool notes</Label>
              <Textarea rows={2} value={value.pool_notes} onChange={(e) => set({ pool_notes: e.target.value })} placeholder="Bather load, health-department requirements, equipment quirks..." />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
