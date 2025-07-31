import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MapPin, Star, CheckCircle } from 'lucide-react';
import heroImage from '@/assets/hero-pool-service.jpg';
import poolBefore1 from '@/assets/pool-before-1.jpg';
import poolAfter1 from '@/assets/pool-after-1.jpg';
import poolBefore2 from '@/assets/pool-before-2.jpg';
import poolAfter2 from '@/assets/pool-after-2.jpg';

const Index = () => {
  const beforeAfterPairs = [
    { before: poolBefore1, after: poolAfter1, title: "Complete Pool Restoration" },
    { before: poolBefore2, after: poolAfter2, title: "Chemical Balance & Cleaning" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Crystal Clear Pool Services
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90">
            Professional pool maintenance, chemical balancing, and cleaning services you can trust
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Schedule Service
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 border-white text-white hover:bg-white/20">
              Get Free Quote
            </Button>
          </div>
        </div>
      </section>

      {/* Before & After Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">See the Difference</h2>
            <p className="text-xl text-muted-foreground">
              Our professional pool services transform neglected pools into pristine swimming environments
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {beforeAfterPairs.map((pair, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-center">{pair.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-destructive">BEFORE</h4>
                    <img 
                      src={pair.before} 
                      alt="Pool before service" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-green-600">AFTER</h4>
                    <img 
                      src={pair.after} 
                      alt="Pool after service" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Company History Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Story</h2>
            <p className="text-xl text-muted-foreground">
              Over two decades of pool service excellence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-primary rounded-full p-2 mt-1">
                  <Star className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Founded in 2003</h3>
                  <p className="text-muted-foreground">
                    Started as a family business with a simple goal: provide reliable, professional pool maintenance services to our local community.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary rounded-full p-2 mt-1">
                  <CheckCircle className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Certified Professionals</h3>
                  <p className="text-muted-foreground">
                    Our team consists of certified pool technicians with extensive training in chemical balancing, equipment maintenance, and safety protocols.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary rounded-full p-2 mt-1">
                  <Star className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">500+ Happy Customers</h3>
                  <p className="text-muted-foreground">
                    We've built lasting relationships with hundreds of pool owners throughout the region, providing consistent, quality service year after year.
                  </p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Why Choose Us?</CardTitle>
                <CardDescription>
                  Experience the difference professional pool care makes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Weekly maintenance schedules</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Chemical balancing expertise</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Equipment repair & maintenance</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Emergency service available</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Fully licensed & insured</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-12">
            Contact us today for a free pool assessment and customized service plan
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card>
              <CardContent className="pt-6 text-center">
                <Phone className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Call Us</h3>
                <p className="text-muted-foreground">(555) 123-POOL</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Mail className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Email Us</h3>
                <p className="text-muted-foreground">info@poolservices.com</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <MapPin className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Service Area</h3>
                <p className="text-muted-foreground">Greater Metro Area</p>
              </CardContent>
            </Card>
          </div>

          <Button size="lg" className="bg-primary hover:bg-primary/90">
            Schedule Your Free Consultation
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;
