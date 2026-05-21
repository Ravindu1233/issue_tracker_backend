const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const encodeHeader = (value) => {
  const stringValue = String(value);

  if (/^[\x20-\x7E]*$/.test(stringValue)) {
    return stringValue;
  }

  return `=?UTF-8?B?${Buffer.from(stringValue, 'utf8').toString('base64')}?=`;
};

const encodeBase64Url = (value) =>
  Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Gmail API is not configured. Missing ${name}.`);
  }

  return value;
};

const getAccessToken = async () => {
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: getRequiredEnv('GMAIL_CLIENT_ID'),
      client_secret: getRequiredEnv('GMAIL_CLIENT_SECRET'),
      refresh_token: getRequiredEnv('GMAIL_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Gmail access token.');
  }

  return data.access_token;
};

const buildMimeMessage = ({ fromAddress, fromName, to, subject, text, html }) => {
  const boundary = `issue-tracker-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return [
    `From: ${encodeHeader(fromName)} <${fromAddress}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
};

const sendGmailMessage = async ({ to, subject, text, html }) => {
  const fromAddress = process.env.MAIL_FROM_ADDRESS || getRequiredEnv('GMAIL_USER');
  const fromName = process.env.MAIL_FROM_NAME || 'Issue Tracker';
  const accessToken = await getAccessToken();
  const raw = encodeBase64Url(buildMimeMessage({ fromAddress, fromName, to, subject, text, html }));

  const response = await fetch(GMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || data.error_description || 'Failed to send Gmail message.';
    throw new Error(message);
  }

  return data;
};

const sendResetOtpEmail = async (to, otp) => {
  await sendGmailMessage({
    to,
    subject: 'Issue Tracker password reset OTP',
    text: `Your Issue Tracker password reset OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <p>Your Issue Tracker password reset OTP is:</p>
      <h2>${escapeHtml(otp)}</h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request a password reset, you can ignore this email.</p>
    `,
  });
};

const sendIssueStatusEmail = async (to, issue, updatedBy) => {
  const updaterName = updatedBy.full_name || updatedBy.email || 'Another user';
  const subject = `${updaterName} updated issue status: ${issue.title}`;

  await sendGmailMessage({
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
