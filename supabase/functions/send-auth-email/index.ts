import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Switched to Mailjet for email delivery
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const MJ_API_URL = "https://api.mailjet.com/v3.1/send";
function encodeBasicAuth(key: string, secret: string) {
  try { return btoa(`${key}:${secret}`); } catch {
    // @ts-ignore
    return Buffer.from(`${key}:${secret}`).toString("base64");
  }
}
const hookSecret = Deno.env.get("SEND_AUTH_EMAIL_HOOK_SECRET") || "your-webhook-secret";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    // For webhook verification (when configured)
    let emailData;
    try {
      const wh = new Webhook(hookSecret);
      emailData = wh.verify(payload, headers) as any;
    } catch (verifyError) {
      // If webhook verification fails, try parsing as regular JSON
      console.log("Webhook verification failed, trying regular JSON parse");
      emailData = JSON.parse(payload);
    }

    const {
      user,
      email_data: { 
        token, 
        token_hash, 
        redirect_to, 
        email_action_type,
        site_url 
      } = {}
    } = emailData;

    console.log("Processing auth email:", { 
      email: user?.email, 
      action_type: email_action_type 
    });

    // Determine email content based on action type
    let subject = "";
    let emailContent = "";

    switch (email_action_type) {
      case "signup":
      case "email_change":
        subject = "Welcome to Aqua Clear Pools - Confirm Your Email";
        emailContent = generateConfirmationEmail(
          user?.email || "",
          token_hash,
          redirect_to || site_url || "https://aquaclearpools.lovable.app",
          site_url || "https://aquaclearpools.lovable.app"
        );
        break;
      case "recovery":
        subject = "Reset Your Aqua Clear Pools Password";
        emailContent = generatePasswordResetEmail(
          user?.email || "",
          token_hash,
          redirect_to || site_url || "https://aquaclearpools.lovable.app",
          site_url || "https://aquaclearpools.lovable.app"
        );
        break;
      case "magic_link":
        subject = "Your Aqua Clear Pools Login Link";
        emailContent = generateMagicLinkEmail(
          user?.email || "",
          token_hash,
          redirect_to || site_url || "https://aquaclearpools.lovable.app",
          site_url || "https://aquaclearpools.lovable.app"
        );
        break;
      default:
        subject = "Aqua Clear Pools - Account Verification";
        emailContent = generateGenericEmail(
          user?.email || "",
          token_hash,
          redirect_to || site_url || "https://aquaclearpools.lovable.app"
        );
    }

    const replyToEmail = Deno.env.get("RESEND_REPLY_TO") || undefined;
    const defaultFromEmail = "randy@getaquaclear.com";
    const defaultFromName = "AquaClear Pools";

    const apiKey = Deno.env.get("MAILJET_API_KEY");
    const apiSecret = Deno.env.get("MAILJET_API_SECRET");
    if (!apiKey || !apiSecret) {
      throw new Error("Missing MAILJET_API_KEY/MAILJET_API_SECRET");
    }

    const payload = {
      Messages: [
        {
          From: { Email: defaultFromEmail, Name: defaultFromName },
          To: [{ Email: user?.email || "" }],
          Subject: subject,
          TextPart: `Aqua Clear Pools - ${subject}. If you requested this action, follow the link in this email.`,
          HTMLPart: emailContent,
          ...(replyToEmail ? { ReplyTo: replyToEmail } : {}),
          Headers: { "List-Unsubscribe": replyToEmail ? `<mailto:${replyToEmail}>` : `<mailto:support@getaquaclear.com>` }
        }
      ]
    };

    const auth = encodeBasicAuth(apiKey, apiSecret);
    const mjRes = await fetch(MJ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const mjJson = await mjRes.json();
    if (!mjRes.ok) {
      console.error("Mailjet API error:", mjJson);
      throw new Error("Mailjet send failed");
    }

    console.log("Auth email sent successfully (Mailjet):", mjJson);

    return new Response(
      JSON.stringify({ success: true, provider: "mailjet", response: mjJson }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateConfirmationEmail(email: string, tokenHash: string, redirectTo: string, siteUrl: string): string {
  const confirmUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Welcome to Aqua Clear Pools!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Professional Pool Cleaning & Maintenance</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e293b; margin-top: 0;">Confirm Your Email Address</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Thank you for joining Aqua Clear Pools! To complete your registration and start managing your pool services, please confirm your email address.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" 
             style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            Confirm Email Address
          </a>
        </div>
        
        <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="color: #0c4a6e; margin-top: 0;">What You'll Get Access To:</h3>
          <ul style="color: #0369a1; margin: 10px 0;">
            <li>Schedule and manage pool service appointments</li>
            <li>View detailed service reports and chemical readings</li>
            <li>Upload and track pool photos</li>
            <li>Receive service notifications and reminders</li>
            <li>Access your complete service history</li>
          </ul>
        </div>

        <p style="color: #64748b; font-size: 14px; margin-top: 25px;">
          If the button above doesn't work, copy and paste this link into your browser:
          <br>
          <a href="${confirmUrl}" style="color: #0ea5e9; word-break: break-all;">${confirmUrl}</a>
        </p>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
          <p style="color: #64748b; font-size: 14px; margin: 0;">
            Need help? Contact us at <a href="mailto:support@aquaclearpools.com" style="color: #0ea5e9;">support@aquaclearpools.com</a> or call <strong>601-447-0399</strong>
          </p>
        </div>
      </div>
      
      <div style="background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">&copy; 2024 Aqua Clear Pools. All rights reserved.</p>
        <p style="margin: 5px 0 0 0;">Professional Pool Services You Can Trust</p>
      </div>
    </div>
  `;
}

function generatePasswordResetEmail(email: string, tokenHash: string, redirectTo: string, siteUrl: string): string {
  const resetUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Aqua Clear Pools</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e293b; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          We received a request to reset your password for your Aqua Clear Pools account. Click the button below to create a new password.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 25px 0;">
          <p style="color: #7f1d1d; margin: 0; font-size: 14px;">
            <strong>Security Notice:</strong> This link will expire in 24 hours. If you didn't request this password reset, you can safely ignore this email.
          </p>
        </div>

        <p style="color: #64748b; font-size: 14px; margin-top: 25px;">
          If the button above doesn't work, copy and paste this link into your browser:
          <br>
          <a href="${resetUrl}" style="color: #dc2626; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
      
      <div style="background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">&copy; 2024 Aqua Clear Pools. All rights reserved.</p>
      </div>
    </div>
  `;
}

function generateMagicLinkEmail(email: string, tokenHash: string, redirectTo: string, siteUrl: string): string {
  const magicUrl = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Your Login Link</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Aqua Clear Pools</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e293b; margin-top: 0;">Sign In to Your Account</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Click the button below to securely sign in to your Aqua Clear Pools account.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${magicUrl}" 
             style="background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            Sign In Now
          </a>
        </div>
        
        <div style="background: #ecfdf5; border-left: 4px solid #059669; padding: 15px; margin: 25px 0;">
          <p style="color: #064e3b; margin: 0; font-size: 14px;">
            <strong>Security Notice:</strong> This login link will expire in 1 hour for your security.
          </p>
        </div>

        <p style="color: #64748b; font-size: 14px; margin-top: 25px;">
          If the button above doesn't work, copy and paste this link into your browser:
          <br>
          <a href="${magicUrl}" style="color: #059669; word-break: break-all;">${magicUrl}</a>
        </p>
      </div>
      
      <div style="background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">&copy; 2024 Aqua Clear Pools. All rights reserved.</p>
      </div>
    </div>
  `;
}

function generateGenericEmail(email: string, tokenHash: string, redirectTo: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">Account Verification</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Aqua Clear Pools</p>
      </div>
      
      <div style="padding: 30px; background: #f8fafc;">
        <h2 style="color: #1e293b; margin-top: 0;">Verify Your Account</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Please click the button below to verify your Aqua Clear Pools account.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${redirectTo}?token=${tokenHash}" 
             style="background: #0ea5e9; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
            Verify Account
          </a>
        </div>
      </div>
      
      <div style="background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">&copy; 2024 Aqua Clear Pools. All rights reserved.</p>
      </div>
    </div>
  `;
}

serve(handler);