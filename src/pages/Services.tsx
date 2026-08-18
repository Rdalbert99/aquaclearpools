import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import { PublicServiceRequestForm } from '@/components/service/PublicServiceRequestForm';
import { BookServiceForm } from '@/components/service/BookServiceForm';
import { ServicesSection, weeklyVisitChecklist } from '@/components/services/ServicesSection';
import { Check, Minus, Download, Calendar } from 'lucide-react';

const tiers = ['Weekly Full Service', 'Bi-Weekly Maintenance', 'One-Time / Recovery'] as const;

const comparisonRows: { feature: string; values: (boolean | string)[] }[] = [
  { feature: 'Visit frequency', values: ['52 visits/year', '26 visits/year', 'As scheduled'] },
  { feature: 'Full water testing & dosing', values: [true, true, true] },
  { feature: 'Skim, brush, vacuum', values: [true, true, true] },
  { feature: 'Baskets emptied & filter check', values: [true, true, true] },
  { feature: 'Filter backwash / deep clean', values: ['As needed', 'As needed', 'Included once'] },
  { feature: 'Salt cell inspection & 6-month cleaning', values: [true, true, false] },
  { feature: 'Equipment inspection each visit', values: [true, 'Every visit', 'One-time check'] },
  { feature: 'Photos + readings in customer portal', values: [true, true, true] },
  { feature: 'Chemicals included', values: [true, true, 'Billed per job'] },
  { feature: 'Storm & heavy-rain response', values: ['Priority', 'Standard', 'Scheduled'] },
  { feature: 'Emergency call priority', values: [true, false, false] },
  { feature: 'Green-to-clean return visits', values: ['Discounted', 'Discounted', 'Included in package'] },
];

const faqs = [
  {
    q: 'How much does weekly pool service cost?',
    a: 'Pricing depends on pool size, surface, and whether it is chlorine or saltwater. Most Hattiesburg-area residential pools fall into a predictable weekly range, and we quote it in writing after a free on-site assessment — no surprise add-ons.',
  },
  {
    q: 'Do I need to be home during service?',
    a: 'No. We just need gate access (a code or unlocked gate) and any pets secured. Your technician logs readings and photos to your portal and texts you when the visit is complete.',
  },
  {
    q: 'Are chemicals included in the price?',
    a: 'Yes, standard chlorine, acid, and balancing chemicals are included with weekly and bi-weekly plans. Specialty treatments like heavy algaecide, phosphate remover, or a full stabilizer reset during a green-to-clean are quoted separately before we apply them.',
  },
  {
    q: 'How long does a green-to-clean take?',
    a: 'Most Mississippi green pools clear in 3 to 7 days depending on how long they sat, the water temperature, and filter condition. We return every day or every other day until the water is swim-ready, then set you up on maintenance so it does not come back.',
  },
  {
    q: 'Why does my pool turn green so fast in the summer?',
    a: 'Gulf-region heat burns off chlorine quickly, pollen and organics feed algae, and a single heavy rain can dilute chemistry overnight. Consistent weekly balancing with proper stabilizer levels is the only reliable fix.',
  },
  {
    q: 'Do you service saltwater pools?',
    a: 'Yes. Saltwater pools get salt level testing, cell inspection, and a full cell cleaning every six months — we track that date for you and notify you when it is done.',
  },
  {
    q: 'What happens if it rains on my service day?',
    a: 'We still come. Light rain does not stop chemical balancing or basket cleaning. In severe weather we reschedule to the next available day and let you know by text.',
  },
  {
    q: 'Can I cancel or pause service?',
    a: 'Yes. There is no long-term contract. You can pause for the off-season or cancel with reasonable notice — just call or message us through the portal.',
  },
];

const firstVisitChecklist = [
  'Confirm gate access, gate code, or lockbox location',
  'Secure pets during the service window',
  'Clear patio furniture or toys from the pool deck',
  'Note any equipment noises, leaks, or error codes for the tech',
  'Know your approximate pool gallons and surface type if possible',
  'Make sure the pump is running on its normal schedule',
  'Tell us about recent chemicals you added yourself',
  'Point out any stains, cracks, or areas you want us to look at',
];

const buildChecklistFile = () =>
  [
    'AQUA CLEAR POOLS — NEW CUSTOMER CHECKLIST',
    'Hattiesburg, MS | 601-447-0399 | getaquaclear.com',
    '',
    'BEFORE YOUR FIRST VISIT',
    ...firstVisitChecklist.map((i) => `  [ ] ${i}`),
    '',
    'WHAT WE DO ON A TYPICAL WEEKLY VISIT',
    ...weeklyVisitChecklist.map((i) => `  [ ] ${i}`),
    '',
    'AFTER EVERY VISIT',
    '  [ ] Check your customer portal for readings, photos, and notes',
    '  [ ] Reply to the completion text with any questions',
    '',
    'Questions? Call or text 601-447-0399.',
  ].join('\n');

const Services = () => {
  const [showRequestForm, setShowRequestForm] = useState(false);

  const downloadChecklist = () => {
    const blob = new Blob([buildChecklistFile()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aqua-clear-pools-new-customer-checklist.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const renderValue = (v: boolean | string) => {
    if (v === true) return <Check className="h-5 w-5 text-primary mx-auto" aria-label="Included" />;
    if (v === false) return <Minus className="h-5 w-5 text-muted-foreground mx-auto" aria-label="Not included" />;
    return <span className="text-sm">{v}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar onRequestService={() => setShowRequestForm(true)} />

      {/* Page hero */}
      <section className="pt-32 pb-16 px-4 bg-gradient-to-br from-primary/10 to-secondary/5">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            Serving Hattiesburg &amp; South Mississippi
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Pool Services &amp; Plans</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Weekly care, green-to-clean recovery, equipment repair and seasonal work — all documented in
            your private customer portal.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Calendar className="h-5 w-5 mr-2" />
              Get Started with Service
            </Button>
            <Button size="lg" variant="outline" onClick={downloadChecklist}>
              <Download className="h-5 w-5 mr-2" />
              Download New Customer Checklist
            </Button>
          </div>
        </div>
      </section>

      {/* Full services + packages + booking form */}
      <ServicesSection />

      {/* Tier comparison */}
      <section className="py-20 px-4 bg-muted/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Compare Service Tiers</h2>
            <p className="text-lg text-muted-foreground">
              Everything included at each level, side by side.
            </p>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Feature</TableHead>
                    {tiers.map((t) => (
                      <TableHead key={t} className="text-center min-w-[150px]">
                        {t}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonRows.map((row) => (
                    <TableRow key={row.feature}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      {row.values.map((v, i) => (
                        <TableCell key={`${row.feature}-${i}`} className="text-center">
                          {renderValue(v)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Downloadable checklist */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">First-Time Customer Checklist</h2>
            <p className="text-lg text-muted-foreground">
              A few small things make your first visit fast and thorough. Save or print this list.
            </p>
          </div>
          <Card>
            <CardContent className="py-8 px-6 md:px-10">
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-8">
                {firstVisitChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={downloadChecklist}>
                  <Download className="h-4 w-4 mr-2" />
                  Download the checklist
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  Print this page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-muted/40">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground">
              Straight answers about pricing, scheduling and Mississippi pool care.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Bottom booking CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Request a Free Pool Assessment</h2>
            <p className="text-lg text-muted-foreground">
              Pick a day and time that works — your request goes straight to our dispatch board.
            </p>
          </div>
          <BookServiceForm id="book-bottom" />
          <p className="text-center text-muted-foreground mt-8">
            Already a customer?{' '}
            <Link to="/auth/login" className="text-primary underline underline-offset-4">
              Log in to your portal
            </Link>
          </p>
        </div>
      </section>

      <PublicServiceRequestForm open={showRequestForm} onOpenChange={setShowRequestForm} />
      <Footer />
    </div>
  );
};

export default Services;
