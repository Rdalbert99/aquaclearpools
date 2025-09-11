const optinProofScreenshot = '/lovable-uploads/39ceb9da-017e-4762-9dc1-4b7cbfc29af7.png';

export default function OptinProof() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Opt-In Form Proof – Aqua Clear Pools</h1>
          <p className="text-muted-foreground text-lg">
            Documentation of SMS opt-in consent collection in our client registration form.
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
          <div className="mb-6">
            <p className="text-base mb-6">
              By providing your phone number, you agree to receive SMS notifications from Aqua Clear Pools, including appointment reminders, service updates, and account notices. Message & data rates may apply. Message frequency varies. Reply STOP to unsubscribe or HELP for help. No mobile information will be sold or shared with third parties for promotional or marketing purposes.
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">Client Registration Form SMS Disclosure</h2>
            
            <div className="flex justify-center mb-4">
              <img 
                src={optinProofScreenshot}
                alt="Screenshot of Aqua Clear Pools client registration form showing phone number field with SMS opt-in disclosure text"
                className="max-w-full h-auto rounded-lg border border-border shadow-md"
                style={{ maxHeight: '80vh' }}
              />
            </div>
            
            <p className="text-center text-sm text-muted-foreground mb-6">
              Screenshot of the Aqua Clear Pools client registration form with SMS opt-in disclosure, as required for compliance.
            </p>
          </div>
          
          <div className="mt-6 text-sm text-muted-foreground text-center">
            <p className="mb-2">
              <strong>Compliance Note:</strong> This form clearly displays SMS opt-in consent language 
              before phone number submission, including frequency expectations, carrier charges, 
              and opt-out instructions per TCPA requirements.
            </p>
            <p>
              Screenshot captured: {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}