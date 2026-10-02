const nodemailer = require('nodemailer');

// In-memory audit log of recently sent notifications (for API visibility)
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
        console.log(`[Email Service] Configured live Gmail SMTP service for account: ${user.trim()}`);
      } else {
        transporter = nodemailer.createTransport({
          host,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user, pass }
        });
        console.log(`[Email Service] Configured live SMTP transport via ${host}:${process.env.SMTP_PORT || '587'}`);
      }
    } else {
      // Connect to Ethereal live mail service so user gets an instant clickable web preview
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
        console.log(`[Email Service] Operating via Ethereal live mail service. Clickable web preview links will be generated for every dispatched email!`);
      } catch (e) {
        transporter = nodemailer.createTransport({ jsonTransport: true });
        console.log('[Email Service] Running in local simulation mode (SMTP_HOST not set).');
      }
    }
    return transporter;
  })();

  return transporterPromise;
}

/**
 * Routine authorized entries do not send emails.
 * Email dispatch is strictly and exclusively restricted to UNAUTHORIZED access alerts and security intrusions.
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
  // Suppress email dispatch: only unauthorized entry attempts trigger emails.
  const holderName = policy?.holderName || 'Authorized User';
  const userRole = policy?.userRole || 'RESIDENT';
  console.log(`[Email Service] Authorized access granted for "${holderName}" (${userRole}) — quiet entry (emails are sent ONLY for unauthorized entry).`);
  return null;
}

/**
 * Send an urgent security alert email when an unauthorized person or credential attempts entry.
 * Dispatches immediately to the master alert address (DEFAULT_ALERT_EMAIL: pg016742@gmail.com).
 * @param {Object} options
 * @param {string} options.homeId - Home ID (e.g. home_uk_01)
 * @param {string} options.gateId - Gate ID (e.g. gate_main_01)
 * @param {string} options.credentialType - e.g. 'RFID_TAG', 'LICENSE_PLATE', 'PIN_CODE', 'PHYSICAL_BREACH'
 * @param {string} options.identifier - The unrecognized credential or vehicle plate
 * @param {string} options.method - e.g. 'RFID_CONTACTLESS_SCAN', 'ALPR_VEHICLE_SCAN', 'KEYPAD_ENTRY'
 * @param {string} options.reason - Failure explanation (e.g. 'Unregistered RFID tag presented')
 * @param {string} [options.recipient] - Optional override email address
 * @param {Date} [options.timestamp] - Event timestamp
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

    const subject = `🚨 [IoThings Gate ALERT] Unauthorized Entry Attempt Detected at Main Gate! (${identifier})`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; border: 2px solid #ef4444;">
        <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 20px; color: #ffffff;">🚨 IoThings Smart Gate Security Alert</h1>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #fee2e2; font-weight: bold;">CRITICAL: Unauthorized Access Attempt Intercepted</p>
        </div>
        
        <div style="padding: 24px;">
          <div style="background: #1e293b; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <strong style="color: #f87171; font-size: 16px;">⛔ ACCESS DENIED — GATE REMAINED LOCKED</strong>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #cbd5e1;">
              An unauthorized person or unregistered credential attempted to access the property. The linear actuators were held in stationary lock and the magnetic deadbolt remained engaged.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Event Type:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #ef4444; font-weight: bold;">UNAUTHORIZED_ACCESS_DENIED</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Attempted Identifier:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #fca5a5; font-family: monospace; font-weight: bold; font-size: 15px;">${identifier}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Credential Type:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #f8fafc;">${credentialType}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Detection Method:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #f8fafc;">${method}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Denial Reason:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #fbbf24;">${reason}</td>
            </tr>
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Gate Location:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #f8fafc;">${gateId} (${homeId})</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #94a3b8;"><strong>Timestamp:</strong></td>
              <td style="padding: 10px 0; text-align: right; color: #f8fafc;">${formattedTime}</td>
            </tr>
          </table>

          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 14px; border-radius: 6px; font-size: 12px; color: #fca5a5; margin-bottom: 15px;">
            <strong>Recommended Security Actions:</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 20px;">
              <li>Inspect driveway CCTV video stream for unrecognized individuals or vehicles.</li>
              <li>Verify visitor identity using the two-way intercom prior to manual override.</li>
              <li>Check the audit event log in the IoThings dashboard for repeated breach attempts.</li>
            </ul>
          </div>

          <div style="background: #1e293b; padding: 10px; border-radius: 6px; font-size: 11px; color: #64748b; text-align: center;">
            IoThings Distributed Security Engine • Real-time Automated Perimeter Protection
          </div>
        </div>
      </div>
    `;

    const textBody = `
[IoThings Smart Main Gate Security Alert]
🚨 CRITICAL: UNAUTHORIZED ENTRY ATTEMPT DETECTED
Access Denied & Gate Remained Locked!

Attempted Identifier: ${identifier}
Credential Type: ${credentialType}
Detection Method: ${method}
Denial Reason: ${reason}
Gate Location: ${gateId} (${homeId})
Time: ${formattedTime}
Security Alert Sent to: ${toAddresses}
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

    // Store in audit cache
    recentNotifications.unshift(notificationRecord);
    if (recentNotifications.length > MAX_HISTORY) {
      recentNotifications.pop();
    }

    console.log(`\n🚨 [SECURITY ALERT EMAIL DISPATCHED]`);
    console.log(`  ├─ To:      ${toAddresses}`);
    console.log(`  ├─ Subject: ${subject}`);
    if (previewUrl) {
      console.log(`  ├─ 🔗 View Delivered Email: ${previewUrl}`);
    }
    console.log(`  └─ Details: Unauthorized attempt with ${credentialType} [${identifier}] via ${method} (${reason}) at ${formattedTime}\n`);

    return notificationRecord;
  } catch (error) {
    console.error('[Email Service] Failed to send unauthorized entry alert:', error);
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
