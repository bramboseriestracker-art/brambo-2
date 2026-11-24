import nodemailer from 'nodemailer';

/* SMTP mail sender. Works with Gmail (app password), Brevo, Mailgun, SES, Resend SMTP and similar.
   Without SMTP settings, outside production, the message is printed to the API console instead. */
let transporter;
const configured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

function transport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465 || process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS).');
    console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return { dev: true };
  }
  await transport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
  return { dev: false };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* kind: 'verify' | 'reset' */
export function codeMessage(kind, name, code) {
  const verify = kind === 'verify';
  const subject = verify ? 'Verify your Brambo email address' : 'Reset your Brambo password';
  const lead = verify ? 'Use this code to verify your email address and finish creating your account.' : 'Use this code to reset your password.';
  const text = `Hi ${name},\n\n${lead}\n\nYour code: ${code}\n\nThe code expires in 15 minutes. If you did not request it, you can ignore this email.\n\nBrambo`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;background:#46587F;padding:32px">
  <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;color:#1B2745">
    <h2 style="margin:0 0 12px;color:#E8741E;letter-spacing:.06em">BRAMBO</h2>
    <p>Hi ${esc(name)},</p><p>${lead}</p>
    <p style="font-size:34px;letter-spacing:10px;font-weight:700;background:#FFF1E2;border-radius:10px;padding:14px;text-align:center;margin:20px 0">${code}</p>
    <p style="color:#555">The code expires in 15 minutes. If you did not request it, you can ignore this email.</p>
  </div></div>`;
  return { subject, text, html };
}
