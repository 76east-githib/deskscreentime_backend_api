var nodemailer = require('nodemailer');

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
  tls: { rejectUnauthorized: false }
});

//  const bccList = ['76eastmaurya@gmail.com'];

export const sendEmail = async function (subject: any, to: any, html: any) {

  var mailOptions = {
    from: process.env.SMTP_EMAIL_FROM,
    to: to,
    // to: '76eastmaurya@gmail.com',
    // bcc: bccList,
    subject: subject,
    html: html
  };
  const info = await transporter.sendMail(mailOptions);
  console.log('Email sent: ' + info.response);
  return info;
}