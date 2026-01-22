export async function sendVerificationEmail(email: string, token: string, name?: string | null) {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  const appUrl = process.env.NEXTAUTH_URL || '';
  const appName = appUrl ? new URL(appUrl).hostname.split('.')[0] : 'Storyboard Prompt Builder';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🎬 Storyboard Prompt Builder</h1>
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

  try {
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_EMAIL_VERIFICATION,
        subject: 'Verify your email - Storyboard Prompt Builder',
        body: htmlBody,
        is_html: true,
        recipient_email: email,
        sender_email: appUrl ? `noreply@${new URL(appUrl).hostname}` : 'noreply@storyboard.app',
        sender_alias: appName
      })
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}
