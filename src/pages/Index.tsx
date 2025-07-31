import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MapPin, Star, CheckCircle, LogIn, User, Users, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
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
      {/* Header/Navigation */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/06513546-e1ef-499e-b26c-b920614b3e03.png" 
              alt="Aqua Clear Pools" 
              className="h-16 w-16 object-contain bg-transparent"
              style={{ 
                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
                mixBlendMode: 'multiply'
              }}
            />
            <span className="text-white font-bold text-xl">Aqua Clear Pools</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link to="/auth/login">
              <Button variant="outline" className="bg-white/10 border-white text-white hover:bg-white/20">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
            </Link>
          </div>
        </div>
      </header>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <div className="mb-8 flex justify-center">
            <div className="perspective-1000">
              <img 
                src="/lovable-uploads/06513546-e1ef-499e-b26c-b920614b3e03.png" 
                alt="Aqua Clear Pools" 
                className="h-48 w-48 md:h-56 md:w-56 object-contain transform-gpu bg-transparent animate-spin-3d"
                style={{ 
                  filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.5))',
                  mixBlendMode: 'multiply'
                }}
              />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            Aqua Clear Pools
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-white/90">
            Professional pool maintenance, chemical balancing, and cleaning services you can trust
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Get Started
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button size="lg" variant="outline" className="bg-white/10 border-white text-white hover:bg-white/20">
                Existing Customer Login
              </Button>
            </Link>
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
                  <h3 className="text-xl font-semibold mb-2">Founded in 2024</h3>
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
                  <h3 className="text-xl font-semibold mb-2">Many Happy Customers</h3>
                  <p className="text-muted-foreground">
                    We've built lasting relationships with pool owners throughout the region, providing consistent, quality service year after year.
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

          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <Card>
              <CardContent className="pt-6 text-center">
                <User className="h-8 w-8 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold mb-2">Customer Portal</h3>
                <p className="text-muted-foreground text-sm mb-4">View service history and request appointments</p>
                <Link to="/auth/login">
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
                <h3 className="font-semibold mb-2">Call Us</h3>
                <p className="text-muted-foreground text-sm mb-4">Speak directly with our team</p>
                <Button variant="outline" size="sm" className="w-full">
                  601-447-0399
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              New to our service? Create an account to get started
            </p>
            <Link to="/auth/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Sign Up Today
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
