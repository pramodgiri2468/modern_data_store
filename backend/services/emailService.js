const nodemailer = require('nodemailer');

const recentNotifications = [];
const MAX_HISTORY = 50;

let transporter = null;
let transporterPromise = null;
let isEthereal = false;

async function getTransporter() {
  if (transporter) return transporter;
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && user && pass) {
      if (host.includes('gmail.com')) {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: user.trim(),
            pass: pass.trim().replace(/\s+/g, '')
          }
        });
        console.log(`[email] Configured Gmail SMTP transport for ${user.trim()}`);
      } else {
        transporter = nodemailer.createTransport({
          host,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user, pass }
        });
        console.log(`[email] Configured SMTP transport via ${host}:${process.env.SMTP_PORT || '587'}`);
      }
    } else {
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        isEthereal = true;
        console.log('[email] Using Ethereal test mail service (preview URLs will be logged)');
      } catch {
        transporter = nodemailer.createTransport({ jsonTransport: true });
        console.log('[email] Using local fallback transport');
      }
    }
    return transporter;
  })();

  return transporterPromise;
}

/**
 * Handles authorized access events. Routine entries do not dispatch emails
 * to avoid alert spam.
 */
async function sendAuthorizedEntryNotification({
  policy,
  homeId = 'home_uk_01',
  gateId = 'gate_main_01',
  credentialType,
  identifier,
  method,
  timestamp = new Date()
} = {}) {
  const holderName = policy?.holderName || 'Authorized User';
  const userRole = policy?.userRole || 'RESIDENT';
  console.log(`[notifications] Authorized access for "${holderName}" (${userRole}) - no email required`);
  return null;
}

/**
 * Sends urgent alert email when an unauthorized credential or physical intrusion is detected.
 */
async function sendUnauthorizedAttemptNotification({
  homeId = 'home_uk_01',
  gateId = 'gate_main_01',
  credentialType = 'UNKNOWN_CREDENTIAL',
  identifier = 'UNKNOWN',
  method = 'RFID_CONTACTLESS_SCAN',
  reason = 'Credential not registered or inactive in AccessPolicy',
  recipient = null,
  timestamp = new Date()
}) {
  try {
    const defaultAlertMail = process.env.DEFAULT_ALERT_EMAIL || 'pg016742@gmail.com';
    const recipients = [];

    if (recipient && recipient.trim()) {
      recipients.push(recipient.trim());
    }
    if (defaultAlertMail && !recipients.includes(defaultAlertMail)) {
      recipients.push(defaultAlertMail);
    }
    if (recipients.length === 0) {
      recipients.push('pg016742@gmail.com');
    }

    const toAddresses = recipients.join(', ');
    const fromAddress = process.env.EMAIL_FROM || '"IoThings Gate Security" <notifications@iothings.co.uk>';
    const formattedTime = new Date(timestamp).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    const subject = `[Security Alert] Unauthorized gate access attempt (${identifier})`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #dc2626;">
        <div style="background: #dc2626; padding: 18px 24px; text-align: left;">
          <h1 style="margin: 0; font-size: 18px; color: #ffffff;">IoThings Security Alert</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #fee2e2;">Unauthorized access attempt intercepted</p>
        </div>
        
        <div style="padding: 24px;">
          <div style="background: #1e293b; border-left: 4px solid #ef4444; padding: 14px; border-radius: 4px; margin-bottom: 20px;">
            <strong style="color: #f87171; font-size: 15px;">Access Denied — Gate Remained Locked</strong>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
              An unverified credential or perimeter sensor event occurred. The gate actuators remained stationary and mechanical locks engaged.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 9px 0; color: #94a3b8;">Event</td>
              <td style="padding: 9px 0; text-align: right; color: #ef4444; font-weight: 600;">UNAUTHORIZED_ACCESS_DENIED</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 9px 0; color: #94a3b8;">Identifier</td>
              <td style="padding: 9px 0; text-align: right; color: #fca5a5; font-family: monospace; font-size: 14px;">${identifier}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 9px 0; color: #94a3b8;">Type</td>
              <td style="padding: 9px 0; text-align: right; color: #f8fafc;">${credentialType}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 9px 0; color: #94a3b8;">Method</td>
              <td style="padding: 9px 0; text-align: right; color: #f8fafc;">${method}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 9px 0; color: #94a3b8;">Reason</td>
              <td style="padding: 9px 0; text-align: right; color: #fbbf24;">${reason}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 9px 0; color: #94a3b8;">Location</td>
              <td style="padding: 9px 0; text-align: right; color: #f8fafc;">${gateId} (${homeId})</td>
            </tr>
            <tr>
              <td style="padding: 9px 0; color: #94a3b8;">Timestamp</td>
              <td style="padding: 9px 0; text-align: right; color: #f8fafc;">${formattedTime}</td>
            </tr>
          </table>

          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #fca5a5; margin-bottom: 16px;">
            <strong>Recommended verification:</strong>
            <ul style="margin: 4px 0 0 0; padding-left: 18px; line-height: 1.5;">
              <li>Check driveway camera feed for unrecognized visitors or vehicles.</li>
              <li>Confirm identity via intercom before manual override.</li>
              <li>Inspect dashboard logs for repeated breach attempts.</li>
            </ul>
          </div>

          <div style="border-top: 1px solid #334155; padding-top: 12px; font-size: 11px; color: #64748b; text-align: center;">
            IoThings Gate Security Controller • Automated Alert Dispatch
          </div>
        </div>
      </div>
    `;

    const textBody = `
[IoThings Gate Security Alert]
UNAUTHORIZED ENTRY ATTEMPT DETECTED
Access Denied & Gate Remained Locked

Identifier: ${identifier}
Credential Type: ${credentialType}
Detection Method: ${method}
Denial Reason: ${reason}
Gate Location: ${gateId} (${homeId})
Time: ${formattedTime}
Alert Sent to: ${toAddresses}
    `.trim();

    const mailOptions = {
      from: fromAddress,
      to: toAddresses,
      subject,
      text: textBody,
      html: htmlBody
    };

    const client = await getTransporter();
    const info = await client.sendMail(mailOptions);
    let previewUrl = null;
    if (isEthereal) {
      previewUrl = nodemailer.getTestMessageUrl(info);
    }

    const notificationRecord = {
      id: `NOTIF-ALERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'UNAUTHORIZED_ATTEMPT',
      timestamp: new Date(),
      recipient: toAddresses,
      holderName: 'UNAUTHORIZED PERSON / UNKNOWN',
      userRole: 'UNAUTHORIZED_INTRUDER',
      credentialType,
      identifier,
      reason,
      subject,
      status: 'SECURITY_ALERT',
      previewUrl,
      messageId: info.messageId || 'local-dispatch'
    };

    recentNotifications.unshift(notificationRecord);
    if (recentNotifications.length > MAX_HISTORY) {
      recentNotifications.pop();
    }

    console.log(`[notifications] Security alert email dispatched to ${toAddresses}`);
    if (previewUrl) {
      console.log(`[notifications] Preview link: ${previewUrl}`);
    }

    return notificationRecord;
  } catch (error) {
    console.error('[email] Failed to send alert email:', error.message);
    return null;
  }
}

function getRecentNotifications() {
  return recentNotifications;
}

module.exports = {
  sendAuthorizedEntryNotification,
  sendUnauthorizedAttemptNotification,
  getRecentNotifications
};
