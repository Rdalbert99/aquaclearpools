import React from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';

const Terms = () => {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-primary mb-4">Terms & Conditions – Aqua Clear Pools</h1>
          
          <div className="space-y-8">
            <div>
              <p className="text-foreground mb-6">
                By using our website and services, you agree to these Terms.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Services</h2>
              <div className="space-y-3 text-foreground">
                <div className="flex items-start space-x-3">
                  <span className="text-primary font-bold text-lg">•</span>
                  <p>We provide pool maintenance and related services as scheduled or requested.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-primary font-bold text-lg">•</span>
                  <p>Quotes and scheduling are subject to availability and site conditions.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Billing</h2>
              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p className="text-foreground">
                  You agree to pay for services per the invoice terms. Late payments may incur fees.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">SMS Program (Customer Care)</h2>
              <div className="space-y-3 text-foreground">
                <div className="flex items-start space-x-3">
                  <span className="text-primary font-bold text-lg">•</span>
                  <p>
                    When you submit your phone number during service signup, you consent to receive service-related text messages (appointment reminders, service updates, and account notices).
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-primary font-bold text-lg">•</span>
                  <p>Message & data rates may apply. Message frequency may vary.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-primary font-bold text-lg">•</span>
                  <p>Reply STOP to unsubscribe or HELP for help.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Email Program</h2>
              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p className="text-foreground">
                  We may send service and account emails; you can unsubscribe at any time.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Liability</h2>
              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p className="text-foreground">
                  We are not liable for delays or failures caused by carriers, networks, or events beyond our control.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">Contact</h2>
              <div className="text-foreground space-y-2">
                <p>Questions?</p>
                <div className="bg-muted p-4 rounded-lg space-y-1">
                  <p>
                    <a href="mailto:randy@getaquaclear.com" className="text-primary hover:underline">
                      randy@getaquaclear.com
                    </a>
                  </p>
                  <p>
                    <a href="tel:601-447-0399" className="text-primary hover:underline">
                      (601) 447-0399
                    </a>
                  </p>
                  <p>265 Foster Rd, Sumrall, MS, USA</p>
                </div>
              </div>
            </section>

            <div className="border-t border-border pt-6 mt-8">
              <p className="text-sm text-muted-foreground">
                Effective date: {today}.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Terms;