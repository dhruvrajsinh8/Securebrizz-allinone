import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'SecureBiz Security <onboarding@resend.dev>';

/**
 * Determine the app base URL for links in emails.
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

/**
 * Common HTML wrapper with SecureBiz warm editorial styling.
 */
function wrapEmailTemplate(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #efe1c4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #2a2013;
    }
    .wrapper {
      width: 100%;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background-color: #fffbf3;
      border: 1px solid #e3d2a9;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 12px rgba(42, 32, 19, 0.05);
    }
    .logo-badge {
      display: inline-block;
      padding: 6px 12px;
      background-color: rgba(127, 149, 72, 0.15);
      border: 1px solid rgba(127, 149, 72, 0.25);
      border-radius: 6px;
      font-weight: 700;
      font-size: 14px;
      color: #47601f;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #2a2013;
      margin: 0 0 16px 0;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #6b572f;
      margin: 0 0 20px 0;
    }
    .button {
      display: inline-block;
      background-color: #6b7f3a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      margin: 8px 0 24px 0;
    }
    .token-box {
      background-color: #efe1c4;
      border: 1px solid #e3d2a9;
      border-radius: 6px;
      padding: 12px;
      font-family: monospace;
      font-size: 13px;
      color: #2a2013;
      word-break: break-all;
      margin: 12px 0 20px 0;
    }
    .footer {
      font-size: 12px;
      color: #937d57;
      border-top: 1px solid #e3d2a9;
      padding-top: 20px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo-badge">SecureBiz</div>
      ${contentHtml}
      <div class="footer">
        If you did not request this email, please ignore it or contact your security administrator.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send an email verification link to a user.
 */
export async function sendVerificationEmail(email: string, rawToken: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getAppBaseUrl();
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`;

  const subject = 'Verify your SecureBiz email address';
  const html = wrapEmailTemplate(
    subject,
    `
      <h1>Confirm your email address</h1>
      <p>Thank you for registering with SecureBiz. Please confirm your email address to secure your account and enable security notifications.</p>
      <a href="${verifyUrl}" class="button" target="_blank">Verify Email Address</a>
      <p>Or paste this link into your browser:</p>
      <div class="token-box">${verifyUrl}</div>
      <p>This verification link expires in 24 hours.</p>
    `
  );
  const text = `Confirm your email address for SecureBiz:\n\nVisit: ${verifyUrl}\n\nThis link expires in 24 hours.\nIf you did not request this, you can safely ignore this email.`;

  if (!resend) {
    console.info(`[email:dev] Verification email to ${email}:\nURL: ${verifyUrl}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send verification email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
  }
}

/**
 * Send password reset instructions with a reset link.
 */
export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getAppBaseUrl();
  const resetUrl = `${baseUrl}/?reset_token=${encodeURIComponent(rawToken)}`;

  const subject = 'Reset your SecureBiz password';
  const html = wrapEmailTemplate(
    subject,
    `
      <h1>Password Reset Request</h1>
      <p>We received a request to reset your SecureBiz password. Click the button below to choose a new password.</p>
      <a href="${resetUrl}" class="button" target="_blank">Reset Password</a>
      <p>Or paste this link into your browser:</p>
      <div class="token-box">${resetUrl}</div>
      <p>This reset link will expire in 1 hour. If you didn't ask for a reset, someone may have entered your email address by mistake; your current password remains secure.</p>
    `
  );
  const text = `Reset your SecureBiz password:\n\nVisit: ${resetUrl}\n\nThis link expires in 1 hour.\nIf you did not request a password reset, you can safely ignore this email.`;

  if (!resend) {
    console.info(`[email:dev] Password reset email to ${email}:\nURL: ${resetUrl}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[email] Failed to send password reset email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
  }
}
