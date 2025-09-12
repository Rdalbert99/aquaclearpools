const optinProofScreenshot = '/lovable-uploads/3ddd4698-ce51-4a50-a1e7-4bd5f0e332eb.png';

export default function OptinProof() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">Opt-In Form Proof – Aqua Clear Pools</h1>
          <p className="text-muted-foreground text-lg">
            Proof of SMS opt-in consent as displayed on our Client Registration form.
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-center">Client Registration Form SMS Consent</h2>
            
            <div className="flex justify-center mb-6">
              <div className="w-full max-w-3xl bg-background border border-border rounded-lg p-4">
                <img 
                  src={optinProofScreenshot}
                  alt="Screenshot of Aqua Clear Pools client registration form showing SMS opt-in consent checkbox with full legal text"
                  className="w-full h-auto rounded-lg border border-border shadow-md"
                  style={{ maxHeight: '70vh' }}
                />
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-4">Exact Consent Text Used on Form</h3>
            <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-primary">
              <p className="text-sm leading-relaxed">
                "I agree to receive SMS notifications from Aqua Clear Pools, including appointment reminders, service updates, and account notices. Message & data rates may apply. Message frequency varies. Reply STOP to unsubscribe or HELP for help. No mobile information will be sold or shared with third parties for promotional or marketing purposes."
              </p>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Links included: <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> • <a href="/terms" className="text-primary hover:underline">Terms & Conditions</a>
            </div>
          </div>
          
          <div className="mt-6 text-sm text-muted-foreground text-center">
            <p className="mb-2">
              <strong>Compliance Note:</strong> This form includes a required checkbox with complete SMS opt-in consent language, 
              carrier charge disclosures, and opt-out instructions per TCPA requirements.
            </p>
            <p>
              Page updated: {new Date().toLocaleDateString('en-US', { 
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