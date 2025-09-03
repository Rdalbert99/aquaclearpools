import React from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';
import { Link } from 'react-router-dom';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-primary mb-4">Terms & Conditions for Aqua Clear Pools</h1>
          <p className="text-muted-foreground mb-8">Last updated: September 2025</p>
          
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Services</h2>
              <p className="text-foreground">
                Aqua Clear Pools ("we," "our," or "us") provides pool maintenance, cleaning, and related services. 
                By scheduling or purchasing services, you agree to these terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. Scheduling & Cancellations</h2>
              <ul className="space-y-2 text-foreground list-disc ml-6">
                <li>Service dates may be adjusted due to weather or operational needs.</li>
                <li>Customers may reschedule or cancel with at least 24 hours' notice.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. Payments</h2>
              <ul className="space-y-2 text-foreground list-disc ml-6">
                <li>Payment is due upon completion of service unless otherwise agreed.</li>
                <li>We accept cash, check, or electronic payment.</li>
                <li>Late payments may incur additional fees.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. SMS Notifications</h2>
              <div className="space-y-4 text-foreground">
                <p>
                  By providing your phone number, you consent to receive service-related SMS from Aqua Clear Pools. 
                  Frequency varies (typically 1–5 per week). Standard message and data rates may apply. 
                  Reply STOP to opt out, HELP for assistance.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Liability</h2>
              <p className="text-foreground">
                We take care to perform services professionally and safely. We are not liable for pre-existing pool 
                or equipment issues, or damage caused by misuse or neglect outside of our service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Privacy</h2>
              <p className="text-foreground">
                Please see our{' '}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>{' '}
                for details on how we handle your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Contact</h2>
              <div className="text-foreground space-y-2">
                <p>If you have questions about these Terms, contact us:</p>
                <div className="bg-muted p-4 rounded-lg">
                  <p>
                    <strong>Email:</strong>{' '}
                    <a href="mailto:randy@getaquaclear.com" className="text-primary hover:underline">
                      Randy@getaquaclear.com
                    </a>
                  </p>
                  <p>
                    <strong>Phone:</strong>{' '}
                    <a href="tel:601-447-0399" className="text-primary hover:underline">
                      601-447-0399
                    </a>
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsAndConditions;