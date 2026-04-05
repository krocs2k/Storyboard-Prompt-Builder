/**
 * Unified branded email template for Storyshot Creator
 * 
 * All emails use the SSC color scheme:
 * - Primary background: #0f172a (slate-900)
 * - Card background: #1e293b (slate-800)
 * - Accent/Gold: #d4af37
 * - Text: #ffffff, #94a3b8 (slate-400), #64748b (slate-500)
 * - Border: #334155 (slate-700)
 * 
 * The logo is loaded dynamically from the app's public icon.
 */

/**
 * Get the base URL for the app (for logo and links)
 */
function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/**
 * Get the logo URL. Uses the 192x192 PWA icon.
 * When the admin uploads a new logo, this icon gets regenerated,
 * so the email logo updates automatically.
 */
function getLogoUrl(): string {
  return `${getBaseUrl()}/icon-192x192.png`;
}

/**
 * Wraps email content in a branded Storyshot Creator template.
 * 
 * @param title - The heading inside the card (e.g., "Verify Your Email")
 * @param bodyHtml - The inner HTML content (paragraphs, buttons, etc.)
 * @param footerText - Optional footer text below the card
 */
export function brandedEmailTemplate({
  title,
  bodyHtml,
  footerText,
}: {
  title: string;
  bodyHtml: string;
  footerText?: string;
}): string {
  const logoUrl = getLogoUrl();
  const baseUrl = getBaseUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storyshot Creator</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          
          <!-- Logo & Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${baseUrl}" style="text-decoration: none;">
                <img src="${logoUrl}" alt="Storyshot Creator" width="64" height="64" style="display: block; border-radius: 16px; margin-bottom: 16px;" />
              </a>
              <h1 style="color: #d4af37; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Storyshot Creator</h1>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                <!-- Gold accent bar -->
                <tr>
                  <td style="height: 4px; background: linear-gradient(90deg, #d4af37, #f5d76e, #d4af37);"></td>
                </tr>
                <!-- Card content -->
                <tr>
                  <td style="padding: 32px 32px 28px;">
                    <h2 style="color: #ffffff; margin: 0 0 20px; font-size: 20px; font-weight: 600;">${title}</h2>
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              ${footerText ? `<p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0 0 12px;">${footerText}</p>` : ''}
              <p style="color: #475569; font-size: 11px; margin: 0;">
                &copy; ${new Date().getFullYear()} Storyshot Creator &mdash; Powered By AudioCopilot.app
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Creates a styled CTA button for emails
 */
export function emailButton(text: string, href: string): string {
  return `
    <div style="text-align: center; margin: 28px 0;">
      <a href="${href}" style="
        display: inline-block;
        background: linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%);
        color: #0f172a;
        padding: 14px 36px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: 0.3px;
        box-shadow: 0 4px 14px rgba(212, 175, 55, 0.3);
      ">${text}</a>
    </div>`;
}

/**
 * Creates a styled paragraph for emails
 */
export function emailParagraph(text: string, options?: { color?: string; size?: string; bold?: boolean }): string {
  const color = options?.color || '#94a3b8';
  const size = options?.size || '14px';
  const weight = options?.bold ? 'font-weight: 600;' : '';
  return `<p style="color: ${color}; font-size: ${size}; line-height: 1.7; margin: 0 0 14px; ${weight}">${text}</p>`;
}

/**
 * Creates a fallback link block ("If button doesn't work...")
 */
export function emailFallbackLink(url: string): string {
  return `
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #334155;">
      <p style="color: #64748b; font-size: 12px; margin: 0 0 6px;">If the button doesn&rsquo;t work, copy and paste this link:</p>
      <p style="color: #d4af37; font-size: 12px; word-break: break-all; margin: 0;">${url}</p>
    </div>`;
}

/**
 * Creates a note/info block
 */
export function emailNote(text: string): string {
  return `
    <div style="margin-top: 20px; padding: 12px 16px; background-color: #0f172a; border-radius: 8px; border: 1px solid #334155;">
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;"><strong style="color: #d4af37;">Note:</strong> ${text}</p>
    </div>`;
}
