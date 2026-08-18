import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { BookServiceForm } from '@/components/service/BookServiceForm';
import {
  Droplets,
  TestTube,
  Sparkles,
  CalendarDays,
  Wrench,
  Sun,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowRight,
} from 'lucide-react';

interface ServicesSectionProps {
  onRequestService?: () => void;
}

const coreServices = [
  {
    icon: Droplets,
    title: 'Weekly Maintenance',
    description:
      'Consistent, same-day-each-week care so your pool is always swim-ready. We skim, brush, vacuum, empty baskets and check flow — the routine that keeps Mississippi heat and pollen from ever getting ahead of your water.',
    benefits: ['Never scramble before guests arrive', 'Catches small issues before they cost money'],
  },
  {
    icon: TestTube,
    title: 'Chemical Balancing',
    description:
      'Full testing of chlorine, pH, alkalinity, stabilizer and salt, with doses measured to your exact gallonage. Every reading is logged to your customer portal so you can see the trend, not just today\u2019s number.',
    benefits: ['No burning eyes or bleached swimsuits', 'Protects plaster, liners and equipment'],
  },
  {
    icon: Sparkles,
    title: 'Deep Cleaning',
    description:
      'Wall-to-wall brushing, tile line scrubbing, filter cleaning and targeted algae treatment. Ideal after heavy rain, a pollen dump, or a stretch of 95-degree days that pushed your chlorine down.',
    benefits: ['Restores clarity fast', 'Removes the film algae grows on'],
  },
];

const packages = [
  {
    icon: CalendarDays,
    name: 'Weekly Full Service',
    tag: 'Most popular',
    summary: 'Our complete year-round plan for pools that get used.',
    includes: [
      'Full water test and chemical dosing every visit',
      'Skim, brush, vacuum and empty all baskets',
      'Filter pressure check and backwash as needed',
      'Equipment and water-level inspection',
      'Photos and readings posted to your portal',
    ],
  },
  {
    icon: Droplets,
    name: 'Bi-Weekly Maintenance',
    summary: 'Budget-friendly care for lighter-use or screened pools.',
    includes: [
      'Every-other-week full clean and chemical balance',
      'Extra stabilizer and algaecite protection between visits',
      'Written guidance for the off week',
      'Best for spring and fall, not peak Mississippi summer',
    ],
  },
  {
    icon: Sparkles,
    name: 'Green-to-Clean / Pool Recovery',
    tag: 'Rescue',
    summary: 'Swamp green to swim-ready, usually in 3\u20137 days.',
    includes: [
      'Shock treatment and phosphate/algae kill cycle',
      'Daily or every-other-day return visits until clear',
      'Heavy debris removal and full filter clean',
      'Final balance and a plan to keep it from coming back',
    ],
  },
  {
    icon: Wrench,
    name: 'Equipment Check & Repair',
    summary: 'Pumps, filters, salt cells, heaters and plumbing.',
    includes: [
      'Diagnostic on pump, motor and filtration flow',
      'Salt cell inspection and cleaning (every 6 months)',
      'Leak and seal checks at unions and valves',
      'Repair or replacement quote before any work starts',
    ],
  },
  {
    icon: Sun,
    name: 'Seasonal Opening & Closing',
    summary: 'Start the season right, end it without surprises.',
    includes: [
      'Opening: cover removal, startup, shock and full balance',
      'Closing: winterize lines, lower water, protect equipment',
      'Filter deep clean at changeover',
      'Storm and heavy-rain prep for Gulf-side weather',
    ],
  },
  {
    icon: AlertTriangle,
    name: 'Emergency Service',
    summary: 'Storm damage, cloudy water before a party, dead pump.',
    includes: [
      'Priority scheduling for active customers',
      'Post-storm debris and runoff cleanup',
      'Rapid chemical correction',
      'Same-day text updates from your technician',
    ],
  },
];

export const weeklyVisitChecklist = [
  'Test chlorine, pH, alkalinity, CYA and salt',
  'Add chemicals dosed to your pool\u2019s gallonage',
  'Skim surface and remove floating debris',
  'Brush walls, steps and waterline tile',
  'Vacuum floor as needed',
  'Empty skimmer and pump baskets',
  'Check filter pressure, backwash or clean',
  'Inspect pump, motor and water level',
  'Check salt cell and automation settings',
  'Log readings and photos to your portal',
];

export const ServicesSection = (_props: ServicesSectionProps = {}) => {
  return (
    <section id="services" className="py-20 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Our Pool Services</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Built for Mississippi pools — relentless heat, spring pollen, summer algae blooms and heavy
            rain that dilutes your chemistry overnight. We handle all of it.
          </p>
        </div>

        {/* Core services */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {coreServices.map((s) => (
            <Card key={s.title} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-8 pb-6">
                <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                  <s.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{s.title}</h3>
                <p className="text-muted-foreground mb-4">{s.description}</p>
                <ul className="space-y-2">
                  {s.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Packages */}
        <div className="text-center mb-10">
          <h3 className="text-3xl font-bold mb-3">Service Packages</h3>
          <p className="text-lg text-muted-foreground">
            Pick the level of care that fits your pool. Every plan includes portal access.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {packages.map((p) => (
            <Card key={p.name} className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 pb-6 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-primary/10 rounded-lg w-12 h-12 flex items-center justify-center">
                    <p.icon className="h-6 w-6 text-primary" />
                  </div>
                  {p.tag && <Badge variant="secondary">{p.tag}</Badge>}
                </div>
                <h4 className="text-lg font-semibold mb-2">{p.name}</h4>
                <p className="text-muted-foreground text-sm mb-4">{p.summary}</p>
                <ul className="space-y-2 mt-auto">
                  {p.includes.map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Weekly visit checklist */}
        <Card className="mb-16">
          <CardContent className="py-8 px-6 md:px-10">
            <h3 className="text-2xl font-bold mb-2">What&rsquo;s included in a typical weekly visit</h3>
            <p className="text-muted-foreground mb-6">
              The same checklist every week, documented in your portal so you always know what was done.
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              {weeklyVisitChecklist.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center bg-primary/10 rounded-2xl px-6 py-12 mb-16">
          <h3 className="text-3xl font-bold mb-3">Not sure which plan you need?</h3>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            We&rsquo;ll look at your pool, test the water and recommend the right level of service &mdash; no cost,
            no obligation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Calendar className="h-5 w-5 mr-2" />
              Request a Free Pool Assessment
            </Button>
            <a href="tel:601-447-0399">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Call 601-447-0399
              </Button>
            </a>
            <Link to="/services">
              <Button size="lg" variant="ghost" className="w-full sm:w-auto">
                Compare plans &amp; FAQ
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Online booking */}
        <BookServiceForm id="book" />
      </div>
    </section>
  );
};

export default ServicesSection;
