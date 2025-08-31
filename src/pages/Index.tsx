import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MapPin, Star, CheckCircle, LogIn, User, Users, Shield, Droplets, TestTube, Sparkles, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReviewCarousel } from '@/components/reviews/ReviewCarousel';
import { PublicServiceRequestForm } from '@/components/service/PublicServiceRequestForm';
import { BeforeAfterFade } from '@/components/ui/before-after-fade';
import { BeforeAfterCarousel } from '@/components/ui/before-after-carousel';
import heroImage from '@/assets/hero-pool-service.jpg';
import poolBefore1 from '@/assets/pool-before-1.jpg';
import poolAfter1 from '@/assets/pool-after-1.jpg';
import poolBefore2 from '@/assets/pool-before-2.jpg';
import poolAfter2 from '@/assets/pool-after-2.jpg';
import logo3D from '@/assets/aqua-clear-logo-3d.png';
import professionalTech from '@/assets/professional-tech.jpg';
import Footer from '@/components/layout/Footer';
import { PublicNavbar } from '@/components/layout/PublicNavbar';


const Index = () => {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const beforeAfterPairs = [
    { before: "/lovable-uploads/a5900411-fa64-46b8-af48-acf6bf1b1a50.png", after: "/lovable-uploads/f52d8304-05ae-44c4-b5b2-f1b5bdc742c8.png", title: "Complete Pool Restoration" },
    { before: "/lovable-uploads/77f0cfa9-2e13-4e4c-b77f-48884243e0c5.png", after: "/lovable-uploads/56e5318a-54aa-4a0f-ab6c-2104bc3dc5f1.png", title: "Chemical Balance & Cleaning" },
    { before: "/lovable-uploads/a150b2f6-b124-48d7-8cb5-15e8fecd1833.png", after: "/lovable-uploads/2849e2a6-bc48-4577-8083-425fac1212c5.png", title: "Algae Treatment & Recovery" },
    { before: "/lovable-uploads/2241bddb-0983-4dc2-b0fa-2d151374eeac.png", after: "/lovable-uploads/d5b7fe60-d3a1-4493-93ad-9afdb6c97580.png", title: "Complete Transformation" },
    { before: "/lovable-uploads/6837b855-fbb1-44eb-975c-ecff58dff5ed.png", after: "/lovable-uploads/d151f3cf-3583-4c7d-a201-541acdfeaa6c.png", title: "Professional Pool Recovery" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <PublicNavbar onRequestService={() => setShowRequestForm(true)} />
      {/* Hero Section */}
      <section id="hero" className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <div className="mb-4 flex justify-center">
            <div className="perspective-1000">
              <img 
                src="/lovable-uploads/ac1a09a4-823e-491c-bf59-fb76c8abb196.png" 
                alt="Aqua Clear Pools 3D Logo" 
                className="w-[300px] h-[500px] object-contain transform-gpu animate-spin-y-3d"
                style={{ 
                  filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.8))',
                }}
              />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-4">
            Aqua Clear Pools
          </h1>
          <p className="text-xl md:text-2xl mb-6 text-white/90">
            Professional pool maintenance, chemical balancing, and cleaning services in the Hattiesburg, Mississippi area
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <Button 
              size="lg" 
              variant="outline"
              className="bg-white/10 border-white text-white hover:bg-white/20 text-lg px-8 py-6 h-auto"
              onClick={() => setShowRequestForm(true)}
            >
              <Calendar className="h-6 w-6 mr-3" />
              Request Pool Service
            </Button>
            <Link to="/auth/login?demo=client">
              <Button size="lg" variant="outline" className="bg-white/10 border-white text-white hover:bg-white/20 text-lg px-8 py-6 h-auto">
                Existing Customer Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Pool Services</h2>
            <p className="text-xl text-muted-foreground">
              Professional pool maintenance services to keep your pool crystal clear and ready for swimming
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-20">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                  <Droplets className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Weekly Maintenance</h3>
                <p className="text-muted-foreground">
                  Regular cleaning, skimming, and filter maintenance to keep your pool in perfect condition year-round.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                  <TestTube className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Chemical Balancing</h3>
                <p className="text-muted-foreground">
                  Expert testing and adjustment of pH, chlorine, and other chemicals for safe, healthy swimming water.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Deep Cleaning</h3>
                <p className="text-muted-foreground">
                  Thorough cleaning service including brushing, vacuuming, and algae treatment for a pristine pool.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Before & After Section */}
      <section id="before-after" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">See the Difference</h2>
            <p className="text-xl text-muted-foreground">
              Our professional pool services in the Hattiesburg area transform pools in need of care into pristine swimming environments
            </p>
          </div>

          <BeforeAfterCarousel pairs={beforeAfterPairs} />
        </div>
      </section>

      {/* Customer Reviews Section */}
      <section id="reviews">
        <ReviewCarousel />
      </section>

      {/* Company History Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Our Story</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-primary rounded-full p-2 mt-1">
                  <Star className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Founded in 2024</h3>
                  <p className="text-muted-foreground">
                    Started as a family business in Hattiesburg with a simple goal: provide reliable, professional pool maintenance services to our local Mississippi community.
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
                  <h3 className="text-xl font-semibold mb-2">Many Happy Customers</h3>
                  <p className="text-muted-foreground">
                    We've built lasting relationships with pool owners throughout the Hattiesburg and greater Mississippi area, providing consistent, quality service year after year.
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
      <section id="contact" className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-12">
            Serving Hattiesburg and the greater Mississippi area - Contact us today for a free pool assessment and customized service plan
          </p>

          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <Card>
              <CardContent className="pt-6 text-center">
                <User className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Customer Portal</h3>
                <p className="text-muted-foreground text-sm mb-4">View service history and request appointments</p>
                <Link to="/auth/login?demo=client">
                  <Button variant="outline" size="sm" className="w-full">
                    Customer Login
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Technician Access</h3>
                <p className="text-muted-foreground text-sm mb-4">Field service and client management tools</p>
                <Link to="/auth/login">
                  <Button variant="outline" size="sm" className="w-full">
                    Tech Login
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Shield className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Admin Dashboard</h3>
                <p className="text-muted-foreground text-sm mb-4">Complete business management system</p>
                <Link to="/auth/login">
                  <Button variant="outline" size="sm" className="w-full">
                    Admin Login
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <Phone className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Contact Us</h3>
                <p className="text-muted-foreground text-sm mb-4">Call or text our team</p>
                <div className="space-y-2">
                  <a href="tel:601-447-0399" className="block w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      📞 Call 601-447-0399
                    </Button>
                  </a>
                  <a href="sms:601-447-0399" className="block w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      💬 Text 601-447-0399
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              New to our service? Create an account to get started
            </p>
            <Link to="/auth/client-signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Sign Up Today
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Service Request Form */}
      <PublicServiceRequestForm 
        open={showRequestForm} 
        onOpenChange={setShowRequestForm} 
      />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Index;
