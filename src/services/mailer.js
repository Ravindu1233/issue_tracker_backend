const nodemailer = require('nodemailer');

const getMailTransport = () => {
  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 587);
  const user = process.env.MAIL_USERNAME;
  const pass = process.env.MAIL_APP_PASSWORD || process.env.MAIL_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured. Check MAIL_HOST, MAIL_USERNAME, and MAIL_APP_PASSWORD.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.MAIL_SECURE).toLowerCase() === 'true',
    auth: { user, pass },
  });
};

const sendResetOtpEmail = async (to, otp) => {
  const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME;
  const fromName = process.env.MAIL_FROM_NAME || 'Issue Tracker';

  await getMailTransport().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: 'Issue Tracker password reset OTP',
    text: `Your Issue Tracker password reset OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <p>Your Issue Tracker password reset OTP is:</p>
      <h2>${otp}</h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request a password reset, you can ignore this email.</p>
    `,
  });
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendIssueStatusEmail = async (to, issue, updatedBy) => {
  const fromAddress = process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME;
  const fromName = process.env.MAIL_FROM_NAME || 'Issue Tracker';
  const updaterName = updatedBy.full_name || updatedBy.email || 'Another user';
  const subject = `${updaterName} updated issue status: ${issue.title}`;

  await getMailTransport().sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text: `${updaterName} changed your issue "${issue.title}" from ${issue.previous_status} to ${issue.status}.`,
    html: `
      <p>${escapeHtml(updaterName)} changed your issue status.</p>
      <p><strong>Issue:</strong> ${escapeHtml(issue.title)}</p>
      <p><strong>Previous status:</strong> ${escapeHtml(issue.previous_status)}</p>
      <p><strong>New status:</strong> ${escapeHtml(issue.status)}</p>
    `,
  });
};

module.exports = {
  sendResetOtpEmail,
  sendIssueStatusEmail,
};
