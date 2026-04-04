import nodemailer from 'nodemailer';

/**
 * Email utility that supports:
 * 1. Abacus.AI notification API (when ABACUSAI_API_KEY is set)
 * 2. SMTP via Nodemailer (for Docker/self-hosted deployments)
 * 3. Console logging fallback (when neither is configured)
 */

async function sendViaAbacus(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_EMAIL_VERIFICATION,
        subject,
        body: html,
        is_html: true,
        recipient_email: to,
        sender_email: `noreply@${new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').hostname}`,
        sender_alias: 'Storyshot Creator',
      }),
    });
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Abacus email failed:', error);
    return false;
  }
}

async function sendViaSMTP(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('SMTP email failed:', error);
    return false;
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Priority 1: Abacus.AI (deployed on Abacus platform)
  if (process.env.ABACUSAI_API_KEY && process.env.WEB_APP_ID) {
    return sendViaAbacus(to, subject, html);
  }

  // Priority 2: SMTP (Docker/self-hosted)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return sendViaSMTP(to, subject, html);
  }

  // Fallback: log to console
  console.warn('No email provider configured. Set SMTP_HOST/SMTP_USER or deploy on Abacus.AI.');
  console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
  console.log(`[EMAIL] Verification link would have been sent.`);
  return true; // Return true so registration flow doesn't break
}

export async function sendInviteEmail(email: string, token: string): Promise<boolean> {
  const acceptUrl = `${process.env.NEXTAUTH_URL}/invite/accept?token=${token}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎬 Storyshot Creator</h1>
      </div>
      
      <div style="background: #16213e; padding: 30px; border-radius: 8px; border: 1px solid #0f3460;">
        <h2 style="color: #e94560; margin-top: 0;">You're Invited!</h2>
        <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
          Hi there,
        </p>
        <p style="color: #cccccc; font-size: 14px; line-height: 1.6;">
          You've been invited to join <strong style="color: #ffffff;">Storyshot Creator</strong>. Click the button below to set up your account and get started.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptUrl}" style="background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        
        <p style="color: #888888; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #e94560; font-size: 12px; word-break: break-all;">
          ${acceptUrl}
        </p>
      </div>
      
      <p style="color: #666666; font-size: 11px; text-align: center; margin-top: 20px;">
        This invitation expires in 48 hours and can only be used once. If you didn't expect this invitation, please ignore this email.
      </p>
    </div>
  `;

  // Use invitation-specific notification ID if available
  if (process.env.ABACUSAI_API_KEY && process.env.WEB_APP_ID) {
    try {
      const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_USER_INVITATION || process.env.NOTIF_ID_EMAIL_VERIFICATION,
          subject: "You're invited to Storyshot Creator",
          body: htmlBody,
          is_html: true,
          recipient_email: email,
          sender_email: `noreply@${new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000').hostname}`,
          sender_alias: 'Storyshot Creator',
        }),
      });
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Invite email via Abacus failed:', error);
      return false;
    }
  }

  return sendEmail(email, "You're invited to Storyshot Creator", htmlBody);
}

export async function sendVerificationEmail(email: string, token: string, name?: string | null) {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎬 Storyshot Creator</h1>
      </div>
      
      <div style="background: #16213e; padding: 30px; border-radius: 8px; border: 1px solid #0f3460;">
        <h2 style="color: #e94560; margin-top: 0;">Verify Your Email</h2>
        <p style="color: #ffffff; font-size: 16px; line-height: 1.6;">
          Hi${name ? ` ${name}` : ''},
        </p>
        <p style="color: #cccccc; font-size: 14px; line-height: 1.6;">
          Thank you for registering! Please click the button below to verify your email address.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p style="color: #888888; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #e94560; font-size: 12px; word-break: break-all;">
          ${verifyUrl}
        </p>
        
        <p style="color: #888888; font-size: 12px; margin-top: 30px;">
          <strong>Note:</strong> After verification, your account will need to be approved by an administrator before you can log in.
        </p>
      </div>
      
      <p style="color: #666666; font-size: 11px; text-align: center; margin-top: 20px;">
        This link expires in 24 hours. If you didn't create an account, please ignore this email.
      </p>
    </div>
  `;

  return sendEmail(email, 'Verify your email - Storyshot Creator', htmlBody);
}
