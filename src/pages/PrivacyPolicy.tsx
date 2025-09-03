import React from 'react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import Footer from '@/components/layout/Footer';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold text-primary mb-4">Privacy Policy for Aqua Clear Pools</h1>
          <p className="text-muted-foreground mb-8">Last updated: September 2025</p>
          
          <div className="space-y-8">
            <div>
              <p className="text-foreground mb-6">
                Aqua Clear Pools ("we," "our," or "us") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your information when you use our pool maintenance services.
              </p>
            </div>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Information We Collect</h2>
              <ul className="space-y-2 text-foreground list-disc ml-6">
                <li><strong>Personal Information:</strong> Name, address, email, phone number (provided when you sign up for services).</li>
                <li><strong>Pool Service Information:</strong> Service history, maintenance requests, chemical data.</li>
                <li><strong>Payment Information:</strong> Processed securely by third-party providers. We do not store full credit card details.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">2. How We Use Information</h2>
              <ul className="space-y-2 text-foreground list-disc ml-6">
                <li>To schedule and complete pool service.</li>
                <li>To send service updates, reminders, and invoices.</li>
                <li>To send SMS notifications if you provide your phone number.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">3. SMS Messaging Policy</h2>
              <div className="space-y-4 text-foreground">
                <p>
                  By providing your phone number, you agree to receive service-related text messages from Aqua Clear Pools. 
                  Message frequency varies by service schedule (typically 1–5 per week).
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <p><strong className="text-primary">STOP:</strong> You can unsubscribe anytime by replying STOP.</p>
                  <p><strong className="text-primary">HELP:</strong> Reply HELP for assistance.</p>
                  <p className="text-sm text-muted-foreground mt-2">Standard message and data rates may apply.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">4. Sharing Information</h2>
              <p className="text-foreground">
                We do not sell your information. We only share with service providers (billing, SMS delivery, scheduling software) 
                or when required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">5. Security</h2>
              <p className="text-foreground">
                We use commercially reasonable measures to protect your data.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Your Rights</h2>
              <p className="text-foreground">
                You may request to update, correct, or delete your personal information by contacting us at{' '}
                <a href="mailto:randy@getaquaclear.com" className="text-primary hover:underline">
                  randy@getaquaclear.com
                </a>{' '}
                or{' '}
                <a href="tel:601-447-0399" className="text-primary hover:underline">
                  601-447-0399
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Updates</h2>
              <p className="text-foreground">
                We may update this Privacy Policy occasionally. Updates will be posted on this page.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;