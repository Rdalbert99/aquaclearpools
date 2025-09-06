import React from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';

const Privacy = () => {
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
          <h1 className="text-3xl font-bold text-primary mb-4">Privacy Policy – Aqua Clear Pools</h1>
          
          <div className="space-y-8">
            <div>
              <p className="text-foreground mb-6">
                At Aqua Clear Pools, we respect your privacy.
              </p>
            </div>

            <div className="space-y-6 text-foreground">
              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  We collect your name, email, phone number, service address, and pool details to schedule and deliver pool services, send appointment reminders, service updates, and account notifications.
                </p>
              </div>

              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  We do not sell or share your information with third parties except service providers who help us operate the website and deliver our services.
                </p>
              </div>

              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  <strong>SMS Program:</strong> By providing your phone number, you agree to receive service-related SMS messages (appointment reminders, service updates, account notices). Message & data rates may apply. Message frequency may vary. Reply STOP to unsubscribe or HELP for help.
                </p>
              </div>

              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  <strong>Email Program:</strong> You may unsubscribe from emails via the unsubscribe link in any message.
                </p>
              </div>

              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  <strong>Data Security:</strong> We use reasonable administrative, technical, and physical safeguards to protect your information.
                </p>
              </div>

              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  <strong>Your Choices:</strong> You can request access, correction, or deletion of your information by emailing{' '}
                  <a href="mailto:randy@getaquaclear.com" className="text-primary hover:underline">
                    randy@getaquaclear.com
                  </a>{' '}
                  or calling{' '}
                  <a href="tel:601-447-0399" className="text-primary hover:underline">
                    (601) 447-0399
                  </a>.
                </p>
              </div>

              <div className="flex items-start space-x-3">
                <span className="text-primary font-bold text-lg">•</span>
                <p>
                  <strong>Contact:</strong> Aqua Clear Pools LLC, 265 Foster Rd, Sumrall, MS, USA.
                </p>
              </div>
            </div>

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

export default Privacy;