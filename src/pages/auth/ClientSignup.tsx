import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { AddressComponents } from '@/lib/address-validation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Droplets, ArrowLeft, CheckCircle } from 'lucide-react';


const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  street: z.string().min(5, 'Please enter your street address'),
  city: z.string().min(2, 'Please enter your city'),
  state: z.string().min(2, 'Please enter your state'),
  zipCode: z.string().min(5, 'Please enter your ZIP code'),
  poolType: z.string().min(1, 'Please select your pool type'),
  poolSize: z.string().min(1, 'Please enter your pool size'),
  serviceFrequency: z.string().default('weekly'),
  serviceNotes: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

export default function ClientSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      poolType: '',
      poolSize: '',
      serviceFrequency: 'weekly',
      serviceNotes: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
      const fullAddress = `${data.street}, ${data.city}, ${data.state} ${data.zipCode}`;
      
      // Create auth user using the useAuth hook
      const result = await signUp(
        data.email, 
        data.password, 
        fullName, 
        'client',
        {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          street: data.street,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          address: fullAddress
        }
      );

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      // Wait a moment for the user to be created, then get the user ID
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the current user to create client record
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "Account created but could not retrieve user information. Please try logging in.",
          variant: "destructive",
        });
        return;
      }

      // Convert pool size string to number (extract first number from ranges like "15000-20000")
      const poolSizeNumber = data.poolSize.includes('-') 
        ? parseInt(data.poolSize.split('-')[0]) 
        : parseInt(data.poolSize);

      // Create client record
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          customer: fullName,
          pool_type: data.poolType,
          pool_size: poolSizeNumber,
          service_frequency: data.serviceFrequency,
          service_notes: data.serviceNotes || null,
          status: 'Active',
          join_date: new Date().toISOString(),
        });

      if (clientError) {
        console.error('Error creating client:', clientError);
        toast({
          title: "Error",
          description: "Account created but could not set up client profile. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome to Aqua Clear Pools!",
        description: "Your account has been created successfully. You can now log in to manage your pool services.",
      });

      // Redirect to login page
      navigate('/auth/login?message=account-created');
    } catch (error) {
      console.error('Error during signup:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center justify-center mb-4">
            <Droplets className="h-8 w-8 text-primary mr-2" />
            <span className="text-2xl font-bold">Aqua Clear Pools</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Join Our Pool Service Family</h1>
          <p className="text-muted-foreground">
            Create your account to start enjoying professional pool maintenance services
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Client Registration</span>
            </CardTitle>
            <CardDescription>
              Tell us about yourself and your pool so we can provide the best service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Personal Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
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
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
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
                          <FormLabel>Email Address</FormLabel>
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
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <AddressAutocomplete
                      onAddressSelect={(components: AddressComponents) => {
                        form.setValue('street', components.street_address);
                        form.setValue('city', components.city);
                        form.setValue('state', components.state);
                        form.setValue('zipCode', components.zip_code);
                      }}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
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
                            <Input placeholder="State" {...field} />
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
                            <Input placeholder="12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Pool Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Pool Information</h3>
                  
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
                              <SelectItem value="5000">Under 10,000 gallons</SelectItem>
                              <SelectItem value="10000">10,000 - 15,000 gallons</SelectItem>
                              <SelectItem value="15000">15,000 - 20,000 gallons</SelectItem>
                              <SelectItem value="20000">20,000 - 30,000 gallons</SelectItem>
                              <SelectItem value="30000">30,000+ gallons</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="serviceFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Service Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select service frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="as-needed">As Needed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any special instructions or notes about your pool..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Account Security */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Account Security</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Choose a secure password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-4 pt-6">
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <LoadingSpinner />
                        <span>Creating Account...</span>
                      </div>
                    ) : (
                      'Create My Account'
                    )}
                  </Button>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link to="/auth/login" className="text-primary hover:underline">
                      Sign in here
                    </Link>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}