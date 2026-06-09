const { google } = require('googleapis');
const fs = require('fs');

/**
 * Initializes and returns a Google Drive API client using Application Default Credentials (ADC).
 * This relies on the environment having valid ADC (e.g., via gcloud auth application-default login).
 */
async function getDriveClient() {
  // ADR 0001: Strict Zero Key Enforcement
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const credsContent = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      const creds = JSON.parse(credsContent);
      if (creds.private_key) {
        throw new Error('การใช้ JSON Key ขัดต่อข้อกำหนดความปลอดภัยของโปรเจกต์ โปรดใช้ ADC หรือ WIF เท่านั้น');
      }
    } catch (err) {
      if (err.message.includes('การใช้ JSON Key')) {
        throw err;
      }
      // Ignore other errors (e.g., file not found, invalid JSON) as they will be handled by GoogleAuth
    }
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
    // By NOT providing a keyFile or credentials object, we force the use of ADC.
  });

  const authClient = await auth.getClient();
  
  return google.drive({ version: 'v3', auth: authClient });
}

module.exports = {
  getDriveClient
};
