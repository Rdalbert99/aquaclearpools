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
            <h2 className="text-xl font-semibold mb-3">Client Registration Form SMS Disclosure</h2>
            <p className="text-muted-foreground">
              Screenshot taken from our client registration form showing the phone number field 
              with full SMS opt-in disclosure and consent language as required by telecommunications regulations.
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