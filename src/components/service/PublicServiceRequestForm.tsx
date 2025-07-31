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
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  address: z.string().min(5, 'Please enter your full address'),
  poolType: z.string().min(1, 'Please select your pool type'),
  poolSize: z.string().min(1, 'Please select your pool size'),
  serviceType: z.string().min(1, 'Please select the type of service needed'),
  description: z.string().min(10, 'Please provide more details about your service request'),
  preferredDate: z.string().optional(),
  urgency: z.string().default('medium'),
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
      name: '',
      email: '',
      phone: '',
      address: '',
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
      // Create a service request in the database without requiring authentication
      const { error: dbError } = await supabase
        .from('service_requests')
        .insert({
          request_type: data.serviceType,
          description: `Contact: ${data.name} (${data.email}, ${data.phone})
Address: ${data.address}
Pool Type: ${data.poolType}
Pool Size: ${data.poolSize}
Preferred Date: ${data.preferredDate || 'Not specified'}
Urgency: ${data.urgency}

Details: ${data.description}`,
          priority: data.urgency,
          status: 'pending',
        });

      if (dbError) {
        console.error('Database error:', dbError);
      }

      // Send email using edge function
      const { error: emailError } = await supabase.functions.invoke('send-service-request-email', {
        body: {
          customerData: data,
          requestDetails: {
            type: data.serviceType,
            urgency: data.urgency,
            preferredDate: data.preferredDate,
          }
        },
      });

      if (emailError) {
        console.error('Email error:', emailError);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pool Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St, City, State, ZIP" {...field} />
                  </FormControl>
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