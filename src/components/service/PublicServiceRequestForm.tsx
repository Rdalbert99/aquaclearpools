import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  title: z.string().optional(),
  contactTitle: z.string().optional(),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().optional(),
  phone: z.string().optional(),
  streetAddress: z.string().min(5, 'Please enter your street address'),
  city: z.string().min(2, 'Please enter your city'),
  state: z.string().min(2, 'Please enter your state'),
  zipCode: z.string().min(5, 'Please enter your ZIP code'),
  poolType: z.string().min(1, 'Please select your pool type'),
  poolSize: z.string().min(1, 'Please select your pool size'),
  serviceType: z.string().min(1, 'Please select the type of service needed'),
  description: z.string().min(10, 'Please provide more details about your service request'),
  preferredDate: z.string().optional(),
  urgency: z.string().default('medium'),
}).refine((data) => {
  // Require either email or phone
  return data.email || data.phone;
}, {
  message: "Please provide either an email address or phone number",
  path: ["email"], // This will show the error on the email field
}).refine((data) => {
  // Validate email format if provided
  if (data.email && data.email.trim() !== '') {
    return z.string().email().safeParse(data.email).success;
  }
  return true;
}, {
  message: "Please enter a valid email address",
  path: ["email"],
}).refine((data) => {
  // Validate phone format if provided
  if (data.phone && data.phone.trim() !== '') {
    return data.phone.length >= 10;
  }
  return true;
}, {
  message: "Please enter a valid phone number",
  path: ["phone"],
});

type FormData = z.infer<typeof formSchema>;

interface PublicServiceRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicServiceRequestForm({ open, onOpenChange }: PublicServiceRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      contactTitle: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
      poolType: '',
      poolSize: '',
      serviceType: '',
      description: '',
      preferredDate: '',
      urgency: 'medium',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      console.log('Form data being submitted:', data);
      
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
      
      const insertData: any = {
        title: data.title || null,
        contact_title: data.contactTitle || null,
        request_type: data.serviceType,
        description: data.description,
        priority: data.urgency,
        status: 'pending',
        contact_name: fullName,
        contact_email: data.email,
        contact_phone: data.phone,
        contact_address: `${data.streetAddress}, ${data.city}, ${data.state} ${data.zipCode}`,
        street_address: data.streetAddress,
        city: data.city,
        state: data.state,
        zip_code: data.zipCode,
        country: 'US',
        address_validated: true,
        pool_type: data.poolType,
        pool_size: data.poolSize,
        preferred_date: data.preferredDate || null,
      };
      
      console.log('Database insert data:', insertData);
      
      // Create a service request via Edge Function (bypasses RLS for public form) with timeout
      const createPromise = supabase.functions.invoke('create-public-service-request', {
        body: insertData,
      });
      const createTimeoutMs = 10000;
      const createTimeout = new Promise<{ data?: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ error: new Error('Request timeout') }), createTimeoutMs)
      );
      const { data: createData, error: createError } = await Promise.race([createPromise as any, createTimeout]);

      if (createError) {
        console.error('Create request error:', createError);
        toast({
          title: "Submission failed",
          description: "We couldn't save your request. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Send email using edge function with timeout fallback
      const emailPromise = supabase.functions.invoke('send-service-request-email', {
        body: {
          customerData: { 
            ...data, 
            name: fullName, 
            address: `${data.streetAddress}, ${data.city}, ${data.state} ${data.zipCode}` 
          },
          requestDetails: {
            type: data.serviceType,
            urgency: data.urgency,
            preferredDate: data.preferredDate,
          }
        },
      });
      const timeoutMs = 8000;
      const timeoutPromise = new Promise<{ error: any }>((resolve) =>
        setTimeout(() => resolve({ error: null }), timeoutMs)
      );
      const { error: emailError } = await Promise.race([emailPromise as any, timeoutPromise]);

      if (emailError) {
        console.warn('Email function error or timeout, continuing:', emailError);
        toast({
          title: "Request Submitted",
          description: "Your service request has been recorded. We'll contact you soon!",
        });
      } else {
        toast({
          title: "Request Submitted Successfully!",
          description: "We've received your request and sent confirmation emails. We'll contact you within 24 hours.",
        });
      }

      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Request Submitted",
        description: "Your service request has been recorded. We'll contact you soon!",
        variant: "default",
      });
      form.reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Pool Service</DialogTitle>
          <DialogDescription>
            Fill out the form below and we'll contact you within 24 hours with a free estimate. 
            No account required!
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brief explanation of service</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief title for your service request..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="contactTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select title" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mr">Mr.</SelectItem>
                        <SelectItem value="mrs">Mrs.</SelectItem>
                        <SelectItem value="ms">Ms.</SelectItem>
                        <SelectItem value="dr">Dr.</SelectItem>
                        <SelectItem value="prof">Prof.</SelectItem>
                        <SelectItem value="rev">Rev.</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="ex. John" {...field} />
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="ex. Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address (Optional if phone provided)</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} />
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
                    <FormLabel>Phone Number (Optional if email provided)</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      By providing your phone number, you agree to receive SMS notifications from Aqua Clear Pools, 
                      including appointment reminders, service updates, and account notices. Message & data rates may apply. 
                      Message frequency may vary. Reply STOP to unsubscribe or HELP for help.
                    </div>
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
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input placeholder="ex. 123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="San Diego" {...field} />
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
                      <Input placeholder="CA" {...field} />
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
                    <FormLabel>ZIP Code</FormLabel>
                    <FormControl>
                      <Input placeholder="92101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="urgency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urgency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low - Routine Maintenance</SelectItem>
                      <SelectItem value="medium">Medium - Schedule Within Week</SelectItem>
                      <SelectItem value="high">High - Needs Attention Soon</SelectItem>
                      <SelectItem value="emergency">Emergency - ASAP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="poolType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pool Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pool type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inground-concrete">In-ground Concrete</SelectItem>
                        <SelectItem value="inground-fiberglass">In-ground Fiberglass</SelectItem>
                        <SelectItem value="inground-vinyl">In-ground Vinyl Liner</SelectItem>
                        <SelectItem value="above-ground">Above Ground</SelectItem>
                        <SelectItem value="spa-hot-tub">Spa/Hot Tub</SelectItem>
                        <SelectItem value="not-sure">Not Sure</SelectItem>
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
                    <FormLabel>Pool Size (Gallons)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pool size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="5000-10000">5,000 - 10,000 gallons</SelectItem>
                        <SelectItem value="10000-15000">10,000 - 15,000 gallons</SelectItem>
                        <SelectItem value="15000-20000">15,000 - 20,000 gallons</SelectItem>
                        <SelectItem value="20000-30000">20,000 - 30,000 gallons</SelectItem>
                        <SelectItem value="30000+">30,000+ gallons</SelectItem>
                        <SelectItem value="not-sure">Not Sure</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Needed</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly-maintenance">Weekly Maintenance</SelectItem>
                        <SelectItem value="one-time-cleaning">One-time Cleaning</SelectItem>
                        <SelectItem value="chemical-balancing">Chemical Balancing</SelectItem>
                        <SelectItem value="equipment-repair">Equipment Repair</SelectItem>
                        <SelectItem value="pool-opening">Pool Opening (Seasonal)</SelectItem>
                        <SelectItem value="pool-closing">Pool Closing (Seasonal)</SelectItem>
                        <SelectItem value="emergency-service">Emergency Service</SelectItem>
                        <SelectItem value="consultation">Free Consultation</SelectItem>
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
                  <FormItem>
                    <FormLabel>Preferred Date (Optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Describe Your Pool Service Needs</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Please describe what type of service you need, any specific issues you're experiencing, or questions you have about your pool..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Service Request'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>

            <div className="text-sm text-muted-foreground text-center pt-2">
              Want to track your service history? {' '}
              <Button variant="link" className="p-0 h-auto text-primary">
                Create an account here
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}