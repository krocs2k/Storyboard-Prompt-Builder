import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';
import { brandedEmailTemplate, emailButton, emailParagraph, emailFallbackLink, emailNote } from '@/lib/email-template';

/**
 * Email utility that supports:
 * 1. Abacus.AI notification API (when ABACUSAI_API_KEY is set)
 * 2. SMTP via Nodemailer — config from DB (Admin panel) or env vars
 * 3. Console logging fallback (when neither is configured)
 *
 * All outgoing emails use the branded Storyshot Creator template with:
 * - Gold/slate color scheme matching the app
 * - Dynamic logo from /icon-192x192.png (updates when admin uploads new logo)
 * - Subject lines prefixed with "Storyshot Creator - "
 */

// ---------- SMTP config cache (reads DB once per 60s) ----------
interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

let smtpCache: { config: SmtpConfig | null; fetchedAt: number } = { config: null, fetchedAt: 0 };
const SMTP_CACHE_TTL = 60_000;

/** Force the SMTP config cache to refresh on next send */
export function invalidateSmtpCache() {
  smtpCache.fetchedAt = 0;
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const now = Date.now();
  if (now - smtpCache.fetchedAt < SMTP_CACHE_TTL) return smtpCache.config;

  try {
    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] } },
    });
    const db = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const host = db['SMTP_HOST'] || process.env.SMTP_HOST || '';
    const user = db['SMTP_USER'] || process.env.SMTP_USER || '';
    const pass = db['SMTP_PASS'] || process.env.SMTP_PASS || '';
    const port = parseInt(db['SMTP_PORT'] || process.env.SMTP_PORT || '587', 10);
    const from = db['SMTP_FROM'] || process.env.SMTP_FROM || user;

    if (host && user && pass) {
      smtpCache = { config: { host, port, user, pass, from, secure: port === 465 }, fetchedAt: now };
    } else {
      smtpCache = { config: null, fetchedAt: now };
    }
  } catch (e) {
    console.warn('Failed to load SMTP config from DB:', e);
    // Fallback to env vars only
    const host = process.env.SMTP_HOST || '';
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const from = process.env.SMTP_FROM || user;
    smtpCache = {
      config: host && user && pass ? { host, port, user, pass, from, secure: port === 465 } : null,
      fetchedAt: now,
    };
  }

  return smtpCache.config;
}

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

async function sendViaSMTP(to: string, subject: string, html: string, smtpCfg?: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  const cfg = smtpCfg || await getSmtpConfig();
  if (!cfg) return { success: false, error: 'No SMTP configuration found' };

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });

    await transporter.sendMail({ from: cfg.from, to, subject, html });
    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown SMTP error';
    // Extract the human-readable part from SMTP response errors
    const smtpResponse = (error as { response?: string })?.response;
    const displayError = smtpResponse
      ? smtpResponse.replace(/^\d+[-\s]*/gm, '').trim()
      : errMsg;
    console.error('SMTP email failed:', error);
    return { success: false, error: displayError };
  }
}

/** Test an SMTP connection (used by admin panel) */
export async function testSmtpConnection(cfg: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
    await transporter.verify();
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

/** Send a test email via SMTP (used by admin panel) */
export async function sendTestEmail(cfg: SmtpConfig, recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const html = brandedEmailTemplate({
      title: '✅ SMTP Test Successful',
      bodyHtml: [
        emailParagraph('Your mail server is correctly configured for <strong style="color: #ffffff;">Storyshot Creator</strong>.'),
        emailParagraph('This is an automated test email. No action is required.', { color: '#64748b', size: '12px' }),
      ].join(''),
      footerText: 'This test was triggered from the Admin &gt; Email panel.',
    });
    const result = await sendViaSMTP(recipientEmail, 'Storyshot Creator - SMTP Test', html, cfg);
    return result;
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Send failed' };
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Priority 1: Abacus.AI (deployed on Abacus platform)
  if (process.env.ABACUSAI_API_KEY && process.env.WEB_APP_ID) {
    return sendViaAbacus(to, subject, html);
  }

  // Priority 2: SMTP (DB config or env vars)
  const smtpCfg = await getSmtpConfig();
  if (smtpCfg) {
    const result = await sendViaSMTP(to, subject, html, smtpCfg);
    return result.success;
  }

  // Fallback: log to console
  console.warn('No email provider configured. Set SMTP in Admin > Email or deploy on Abacus.AI.');
  console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
  console.log(`[EMAIL] Verification link would have been sent.`);
  return true; // Return true so registration flow doesn't break
}

export async function sendInviteEmail(email: string, token: string): Promise<boolean> {
  const acceptUrl = `${process.env.NEXTAUTH_URL}/invite/accept?token=${token}`;

  const htmlBody = brandedEmailTemplate({
    title: "You're Invited! 🎬",
    bodyHtml: [
      emailParagraph('Hi there,', { color: '#ffffff', size: '16px' }),
      emailParagraph('You\'ve been invited to join <strong style="color: #ffffff;">Storyshot Creator</strong> — the cinematic storyboard prompt builder. Click the button below to set up your account and get started.'),
      emailButton('Accept Invitation', acceptUrl),
      emailFallbackLink(acceptUrl),
    ].join(''),
    footerText: 'This invitation expires in 48 hours and can only be used once. If you didn\'t expect this invitation, please ignore this email.',
  });

  const subject = 'Storyshot Creator - You\'re Invited';

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
          subject,
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

  return sendEmail(email, subject, htmlBody);
}

export async function sendVerificationEmail(email: string, token: string, name?: string | null) {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;

  const htmlBody = brandedEmailTemplate({
    title: 'Verify Your Email',
    bodyHtml: [
      emailParagraph(`Hi${name ? ` ${name}` : ''},`, { color: '#ffffff', size: '16px' }),
      emailParagraph('Thank you for registering with <strong style="color: #ffffff;">Storyshot Creator</strong>! Please click the button below to verify your email address.'),
      emailButton('Verify Email Address', verifyUrl),
      emailFallbackLink(verifyUrl),
      emailNote('After verification, your account will need to be approved by an administrator before you can log in.'),
    ].join(''),
    footerText: 'This link expires in 24 hours. If you didn\'t create an account, please ignore this email.',
  });

  return sendEmail(email, 'Storyshot Creator - Verify Your Email', htmlBody);
}
