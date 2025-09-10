import optinProofScreenshot from '@/assets/optin-proof-screenshot.png';

export default function OptinProof() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Opt-In Form Proof – Aqua Clear Pools</h1>
          <p className="text-muted-foreground text-lg">
            Documentation of SMS opt-in consent collection in our client registration form
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">SMS Opt-In Disclosure</h2>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <p className="text-sm font-medium mb-2">Current SMS Disclosure Text:</p>
              <p className="text-sm italic">
                "By providing your phone number, you agree to receive SMS notifications from Aqua Clear Pools, including appointment reminders, service updates, and account notices. Message & data rates may apply. Message frequency varies. Reply STOP to unsubscribe or HELP for help. No mobile information will be sold or shared with third parties for promotional or marketing purposes."
              </p>
            </div>
            <p className="text-muted-foreground">
              This disclosure appears in our client registration form below the phone number field 
              and complies with TCPA requirements for SMS consent collection.
            </p>
          </div>
          
          <div className="flex justify-center">
            <img 
              src={optinProofScreenshot}
              alt="Screenshot of Aqua Clear Pools client registration form showing phone number field with SMS opt-in disclosure text"
              className="max-w-full h-auto rounded-lg border border-border shadow-md"
              style={{ maxHeight: '80vh' }}
            />
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