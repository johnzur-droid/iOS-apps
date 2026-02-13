// Google API Configuration
// Copy this file to config.js and fill in your credentials.
// IMPORTANT: config.js is gitignored and should NEVER be committed to version control.
//
// To get these values:
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Create or select an OAuth 2.0 Client ID (Web application type)
// 3. Copy the Client ID below
//
// Security best practices:
// - Restrict the OAuth Client ID to your deployment origins only
// - Use read-only OAuth scopes (calendar.readonly)
// - Review active credentials quarterly and disable unused ones

const GCP_CONFIG = {
    CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
    SCOPES: 'https://www.googleapis.com/auth/calendar.readonly'
};
