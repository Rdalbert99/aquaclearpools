import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { 
  Droplets, 
  History, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  LogIn,
  ArrowRight,
  Bell
} from 'lucide-react';

export function PortalShowcaseSection() {
  const portalFeatures = [
    {
      icon: History,
      title: 'Service History & Photos',
      description: 'Review every visit, completed work, and before/after photos from our team.',
    },
    {
      icon: TrendingUp,
      title: 'Chemical Readings & Trends',
      description: 'Track pH, chlorine, alkalinity, and more over time with clear charts.',
    },
    {
      icon: Camera,
      title: 'AI-Powered Water Analysis',
      description: 'Snap a photo of your water or test strip and get instant guidance.',
    },
    {
      icon: Bell,
      title: 'Real-Time Status Updates',
      description: 'Know exactly when your pool was serviced and when the next visit is scheduled.',
    },
  ];

  return (
    <section id="portal" className="py-24 px-4 bg-gradient-to-b from-background to-primary/5 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy & CTA */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4 mr-2" />
                Customer Portal
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Smarter Pool Care with Your Customer Portal
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Existing customers get a private portal where every detail about their pool is always at their fingertips. Transparency and convenience are built in — so you always know what’s happening, even when you’re not home.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {portalFeatures.map((feature) => (
                <div key={feature.title} className="flex items-start space-x-3">
                  <div className="bg-primary/10 rounded-lg p-2 shrink-0">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link to="/auth/login?demo=client">
                <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                  <LogIn className="h-5 w-5 mr-2" />
                  Existing Customer Login
                </Button>
              </Link>
              <Link to="/auth/client-signup">
                <Button size="lg" variant="outline" className="w-full sm:w-auto group">
                  New to Aqua Clear?
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="flex items-start space-x-3 rounded-lg border bg-card p-4 text-card-foreground">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Privacy first.</span> Your portal is private and secure — only you and your Aqua Clear technician can see your pool’s history, photos, and readings.
              </p>
            </div>
          </div>

          {/* Right: Visual mockup of portal */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent rounded-3xl blur-2xl opacity-60" />
            
            <Card className="relative border shadow-2xl overflow-hidden bg-card/95 backdrop-blur-sm">
              <CardContent className="p-0">
                {/* Mock portal header */}
                <div className="bg-primary px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-primary-foreground">
                    <Droplets className="h-5 w-5" />
                    <span className="font-semibold">My Pool Portal</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs text-primary-foreground/90">In Balance</span>
                  </div>
                </div>

                {/* Mock dashboard content */}
                <div className="p-6 space-y-6">
                  {/* Welcome + next visit */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Welcome back</p>
                      <p className="text-lg font-semibold text-foreground">The Albert Family Pool</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Next visit</p>
                      <p className="text-lg font-semibold text-foreground">Monday, Aug 24</p>
                    </div>
                  </div>

                  {/* Mock readings chart */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Chemical Trends</span>
                      <span className="text-xs text-muted-foreground">Last 30 days</span>
                    </div>
                    <div className="h-32 flex items-end justify-between gap-2">
                      {[40, 65, 50, 80, 55, 70, 60].map((height, i) => (
                        <div key={i} className="w-full bg-primary/20 rounded-t-md relative">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Jul 28</span>
                      <span>Aug 3</span>
                      <span>Aug 10</span>
                      <span>Aug 17</span>
                    </div>
                  </div>

                  {/* Mock recent visits */}
                  <div className="space-y-3">
                    <span className="text-sm font-medium text-foreground">Recent Visits</span>
                    <div className="space-y-2">
                      {[
                        { date: 'Aug 17, 2026', action: 'Weekly maintenance', status: 'Completed' },
                        { date: 'Aug 10, 2026', action: 'Chemical balance & cleaning', status: 'Completed' },
                        { date: 'Aug 3, 2026', action: 'Deep clean + filter check', status: 'Completed' },
                      ].map((visit, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                          <div className="flex items-center space-x-3">
                            <div className="bg-primary/10 rounded-md p-1.5">
                              <Camera className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{visit.action}</p>
                              <p className="text-xs text-muted-foreground">{visit.date}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            {visit.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 bg-white dark:bg-card border shadow-lg rounded-xl p-3 max-w-[180px] hidden sm:block">
              <div className="flex items-center space-x-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">AI Analysis</span>
              </div>
              <p className="text-xs text-muted-foreground">
                "Chlorine is slightly low. Add 1 tablet to bring it back in range."
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
