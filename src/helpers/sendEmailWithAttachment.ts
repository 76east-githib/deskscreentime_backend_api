var nodemailer = require("nodemailer");

const normalizeEnvValue = (value: string | undefined) => {
  if (!value) return value;
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const smtpHost = process.env.SMTP_Host || process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_Port || process.env.SMTP_PORT || 587);
const smtpUser = normalizeEnvValue(process.env.SMTP_Username || process.env.SMTP_USERNAME);
const smtpPass = normalizeEnvValue(process.env.SMTP_Password || process.env.SMTP_PASSWORD);

var transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
  tls: { rejectUnauthorized: false },
});

const bccList = ["76eastmaurya@gmail.com"];

export const sendEmailWithAttachment = async ({
  to,
  subject,
  html,
  filename,
  buffer,
}: any) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_EMAIL_FROM,
      to: to,
      bcc: bccList,
      subject,
      html,
      attachments: [
        {
          filename,
          content: buffer,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("📧 Email Sent:", info.response);
    return { success: true };
  } catch (error) {
    console.error("❌ Email Sending Failed:", error);
    return { success: false, error };
  }
};
