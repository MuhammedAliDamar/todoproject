import nodemailer from "nodemailer";

// SMTP env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendMail(to: string, subject: string, html: string) {
  const transport = getTransport();

  // SMTP yapılandırılmamışsa (örn. local) e-postayı konsola düş
  if (!transport) {
    console.log("\n[mail:dev] SMTP yok — e-posta gönderilmedi. İçerik:");
    console.log(`  to: ${to}\n  subject: ${subject}\n  html: ${html}\n`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}
