import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CalendarIcon, CheckCircle2, Loader2 } from 'lucide-react';

const SERVICE_TYPES = [
  { value: 'weekly-maintenance', label: 'Weekly Full Service' },
  { value: 'maintenance', label: 'Bi-Weekly Maintenance' },
  { value: 'one-time-cleaning', label: 'Green-to-Clean / Pool Recovery' },
  { value: 'chemical-balancing', label: 'Chemical Balancing' },
  { value: 'equipment-repair', label: 'Equipment Check & Repair' },
  { value: 'pool-opening', label: 'Seasonal Opening' },
  { value: 'pool-closing', label: 'Seasonal Closing' },
  { value: 'emergency-service', label: 'Emergency Service' },
  { value: 'consultation', label: 'Free Pool Assessment' },
] as const;

const TIME_SLOTS = [
  '8:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 2:00 PM',
  '2:00 PM - 4:00 PM',
  '4:00 PM - 6:00 PM',
];

const schema = z
  .object({
    firstName: z.string().trim().min(2, 'First name is required').max(50),
    lastName: z.string().trim().min(2, 'Last name is required').max(50),
    email: z.string().trim().max(255).optional().or(z.literal('')),
    phone: z.string().trim().max(20).optional().or(z.literal('')),
    sms_consent: z.boolean().optional(),
    streetAddress: z.string().trim().min(5, 'Street address is required').max(150),
    city: z.string().trim().min(2, 'City is required').max(80),
    state: z.string().trim().min(2, 'State is required').max(30),
    zipCode: z.string().trim().min(5, 'ZIP code is required').max(10),
    poolType: z.string().min(1, 'Select your pool type'),
    poolSize: z.string().min(1, 'Select your pool size'),
    poolSurface: z.string().optional(),
    serviceType: z.string().min(1, 'Select a service'),
    urgency: z.string().default('medium'),
    preferredDate: z.date({ required_error: 'Choose a preferred date' }),
    preferredTime: z.string().min(1, 'Choose a time window'),
    details: z.string().trim().min(10, 'Tell us a bit more (10+ characters)').max(1500),
  })
  .refine((d) => !!(d.email || d.phone), {
    message: 'Provide an email address or a phone number',
    path: ['email'],
  })
  .refine((d) => !d.email || z.string().email().safeParse(d.email).success, {
    message: 'Enter a valid email address',
    path: ['email'],
  })
  .refine((d) => !d.phone || d.phone.replace(/\D/g, '').length >= 10, {
    message: 'Enter a valid phone number',
    path: ['phone'],
  })
  .refine((d) => !d.phone || d.sms_consent === true, {
    message: 'Please agree to receive text updates to continue.',
    path: ['sms_consent'],
  });

type FormData = z.infer<typeof schema>;

interface BookServiceFormProps {
  id?: string;
  className?: string;
}

export const BookServiceForm = ({ id = 'book', className }: BookServiceFormProps) => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ date: string; time: string } | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      sms_consent: false,
      streetAddress: '',
      city: '',
      state: 'MS',
      zipCode: '',
      poolType: '',
      poolSize: '',
      poolSurface: '',
      serviceType: '',
      urgency: 'medium',
      preferredTime: '',
      details: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const dateLabel = format(data.preferredDate, 'EEEE, MMMM d, yyyy');
      const serviceLabel =
        SERVICE_TYPES.find((s) => s.value === data.serviceType)?.label ?? data.serviceType;

      const description = [
        `Online booking request: ${serviceLabel}`,
        `Requested window: ${dateLabel} — ${data.preferredTime}`,
        `Pool: ${data.poolType}, ${data.poolSize}${data.poolSurface ? `, ${data.poolSurface} surface` : ''}`,
        '',
        data.details,
      ].join('\n');

      const payload = {
        request_type: data.serviceType,
        description,
        priority: data.urgency,
        contact_name: `${data.firstName} ${data.lastName}`.trim(),
        contact_email: data.email || null,
        contact_phone: data.phone || null,
        contact_address: `${data.streetAddress}, ${data.city}, ${data.state} ${data.zipCode}`,
        street_address: data.streetAddress,
        city: data.city,
        state: data.state,
        zip_code: data.zipCode,
        country: 'US',
        pool_type: data.poolType,
        pool_size: data.poolSize,
        preferred_date: data.preferredDate.toISOString(),
      };

      const { error } = await supabase.functions.invoke('create-public-service-request', {
        body: payload,
      });

      if (error) {
        toast({
          title: 'Booking failed',
          description: "We couldn't save your request. Please call 601-447-0399 and we'll get you booked.",
          variant: 'destructive',
        });
        return;
      }

      // Best-effort notification email; never blocks the booking confirmation
      supabase.functions
        .invoke('send-service-request-email', {
          body: {
            customerData: {
              ...data,
              preferredDate: dateLabel,
              name: `${data.firstName} ${data.lastName}`.trim(),
              address: payload.contact_address,
            },
            requestDetails: {
              type: serviceLabel,
              urgency: data.urgency,
              preferredDate: `${dateLabel} — ${data.preferredTime}`,
            },
          },
        })
        .catch(() => undefined);

      setSubmitted({ date: dateLabel, time: data.preferredTime });
      form.reset();
      toast({
        title: 'Booking request received',
        description: `We'll confirm ${dateLabel} (${data.preferredTime}) within one business day.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card id={id} className={cn('scroll-mt-24', className)}>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">You&rsquo;re on the schedule request list</h3>
          <p className="text-muted-foreground mb-6">
            We received your request for <strong>{submitted.date}</strong> ({submitted.time}). Our office
            will confirm the exact arrival window within one business day.
          </p>
          <Button variant="outline" onClick={() => setSubmitted(null)}>
            Book another service
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id={id} className={cn('scroll-mt-24', className)}>
      <CardHeader>
        <CardTitle className="text-2xl">Book Your Service Online</CardTitle>
        <CardDescription>
          Tell us about your pool and pick a day that works. Your request lands in our dispatch dashboard
          immediately — no account needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Service + schedule */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                1. Service &amp; schedule
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service needed</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a service" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          {SERVICE_TYPES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How soon do you need us?</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="low">Flexible — anytime</SelectItem>
                          <SelectItem value="medium">Within a week</SelectItem>
                          <SelectItem value="high">ASAP / urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Preferred date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'justify-start font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return date < today || date.getDay() === 0;
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>We service Monday through Saturday.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred arrival window</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {TIME_SLOTS.map((slot) => (
                          <Button
                            key={slot}
                            type="button"
                            size="sm"
                            variant={field.value === slot ? 'default' : 'outline'}
                            onClick={() => field.onChange(slot)}
                            className="text-xs"
                          >
                            {slot}
                          </Button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Pool details */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                2. Pool details
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="poolType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pool type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="chlorine">Chlorine</SelectItem>
                          <SelectItem value="saltwater">Saltwater</SelectItem>
                          <SelectItem value="above-ground">Above ground</SelectItem>
                          <SelectItem value="spa">Spa / hot tub</SelectItem>
                          <SelectItem value="not-sure">Not sure</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="poolSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Approx. size</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="small">Small (under 10,000 gal)</SelectItem>
                          <SelectItem value="medium">Medium (10,000-20,000 gal)</SelectItem>
                          <SelectItem value="large">Large (20,000-35,000 gal)</SelectItem>
                          <SelectItem value="xlarge">Extra large (35,000+ gal)</SelectItem>
                          <SelectItem value="not-sure">Not sure</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="poolSurface"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surface (optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select surface" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="plaster">Plaster / gunite</SelectItem>
                          <SelectItem value="vinyl">Vinyl liner</SelectItem>
                          <SelectItem value="fiberglass">Fiberglass</SelectItem>
                          <SelectItem value="pebble">Pebble / aggregate</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What&rsquo;s going on with the pool?</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Green water after last week's rain, equipment noise, pollen buildup, gate code, pets in the yard..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                3. Contact &amp; location
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="601-555-0123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="streetAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Hattiesburg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="MS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zipCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP code</FormLabel>
                      <FormControl>
                        <Input placeholder="39401" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="sms_consent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Text me service updates</FormLabel>
                      <FormDescription>
                        Required if you provide a phone number. Message and data rates may apply; reply
                        STOP to opt out.
                      </FormDescription>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitting ? 'Sending your request...' : 'Request This Time Slot'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default BookServiceForm;
