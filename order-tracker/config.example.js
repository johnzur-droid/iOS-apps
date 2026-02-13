// Google API Configuration for Order Tracker
// Copy this file to config.js and fill in your credentials.
// IMPORTANT: config.js is gitignored and should NEVER be committed to version control.
//
// To get these values:
// 1. Go to https://console.cloud.google.com/apis/credentials
// 2. Create or select an OAuth 2.0 Client ID and API Key
// 3. Copy the values below
//
// Security best practices:
// - Restrict the API Key: APIs & Services > Credentials > Edit API Key
//   - Under "API restrictions", select "Restrict key" and choose "Gmail API" only
//   - Under "Application restrictions", add your HTTP referrer (e.g., https://yourdomain.github.io/*)
// - Use read-only OAuth scopes (gmail.readonly)
// - Rotate API keys periodically via the GCP Console
// - Monitor usage in APIs & Services > Dashboard for anomalies

const GCP_CONFIG = {
    CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
    API_KEY: 'YOUR_API_KEY_HERE',
    DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
    SCOPES: 'https://www.googleapis.com/auth/gmail.readonly'
};
