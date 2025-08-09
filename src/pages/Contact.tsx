import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MapPin, Clock, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Contact Aqua Clear Pools</h1>
          <p className="text-xl opacity-90">
            Get in touch with us for all your pool maintenance needs in the Hattiesburg, Mississippi area
          </p>
        </div>
      </header>

      {/* Contact Information */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Details */}
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl font-bold mb-6">Get In Touch</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Ready to transform your pool experience? Contact us today for a free consultation and personalized service plan.
                </p>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardContent className="flex items-center space-x-4 pt-6">
                    <div className="bg-primary/10 rounded-full p-3">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Phone</h3>
                      <p className="text-muted-foreground">Call or text us directly</p>
                      <a href="tel:601-447-0399" className="text-primary font-medium hover:underline">
                        (601) 447-0399
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center space-x-4 pt-6">
                    <div className="bg-primary/10 rounded-full p-3">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Email</h3>
                      <p className="text-muted-foreground">Send us a message</p>
                      <a href="mailto:info@aquaclearpools.com" className="text-primary font-medium hover:underline">
                        info@aquaclearpools.com
                      </a>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center space-x-4 pt-6">
                    <div className="bg-primary/10 rounded-full p-3">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Service Area</h3>
                      <p className="text-muted-foreground">We serve the greater area</p>
                      <p className="font-medium">Hattiesburg, Mississippi</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center space-x-4 pt-6">
                    <div className="bg-primary/10 rounded-full p-3">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Business Hours</h3>
                      <p className="text-muted-foreground">Monday - Friday: 8:00 AM - 6:00 PM</p>
                      <p className="text-muted-foreground">Saturday: 9:00 AM - 4:00 PM</p>
                      <p className="text-muted-foreground">Sunday: Emergency calls only</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5" />
                    <span>Quick Contact</span>
                  </CardTitle>
                  <CardDescription>
                    Choose the best way to reach us
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <a href="tel:601-447-0399" className="block w-full">
                    <Button size="lg" className="w-full">
                      <Phone className="h-5 w-5 mr-2" />
                      Call Now: (601) 447-0399
                    </Button>
                  </a>
                  <a href="sms:601-447-0399" className="block w-full">
                    <Button variant="outline" size="lg" className="w-full">
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Send Text Message
                    </Button>
                  </a>
                  <a href="mailto:info@aquaclearpools.com" className="block w-full">
                    <Button variant="outline" size="lg" className="w-full">
                      <Mail className="h-5 w-5 mr-2" />
                      Send Email
                    </Button>
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>New Customer?</CardTitle>
                  <CardDescription>
                    Create an account to track your service history and schedule appointments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/auth/client-signup">
                    <Button size="lg" className="w-full">
                      Sign Up Today
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Existing Customer?</CardTitle>
                  <CardDescription>
                    Log in to view service history and request appointments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/auth/login">
                    <Button variant="outline" size="lg" className="w-full">
                      Customer Login
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Contact */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Emergency Pool Service</h2>
          <p className="text-xl mb-8 opacity-90">
            Pool emergency? Equipment malfunction? We're here to help when you need us most.
          </p>
          <a href="tel:601-447-0399">
            <Button size="lg" variant="secondary">
              <Phone className="h-5 w-5 mr-2" />
              Emergency Line: (601) 447-0399
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
};

export default Contact;