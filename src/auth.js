const { google } = require('googleapis');

/**
 * Initializes and returns a Google Drive API client using Application Default Credentials (ADC).
 * This relies on the environment having valid ADC (e.g., via gcloud auth application-default login).
 */
async function getDriveClient() {
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
