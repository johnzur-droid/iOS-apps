# 📅 3-Month Calendar View for iPhone

A Progressive Web App (PWA) that displays your Google Calendar events for the next 3 months, with smart filtering to exclude recurring events, birthdays, and Martin Luther King Day while keeping other holidays.

## Features

✨ **Instant Access** - Tap the home screen icon to immediately view your calendar
📱 **iPhone Optimized** - Designed specifically for iPhone 16
🗓️ **3-Month View** - See all your upcoming events at a glance
🎯 **Smart Filtering** - Excludes recurring events, birthdays, and MLK Day
🎉 **Includes Holidays** - Shows all holidays except MLK Day
📊 **Multi-Calendar Support** - Pulls from all your Google Calendar calendars
🎨 **Beautiful Design** - Clean, modern interface with smooth scrolling

## Setup Instructions

### Step 1: Get Google Calendar API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Click "Enable APIs and Services"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create credentials:
   - Go to "Credentials" in the left sidebar
   - Click "Create Credentials" → "API Key"
   - Copy the API key and save it for later
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Configure the OAuth consent screen if prompted
   - Choose "Web application" as the application type
   - Add authorized JavaScript origins:
     - For local testing: `http://localhost:8000`
     - For production: Your deployed URL (e.g., `https://yourdomain.com`)
   - Copy the Client ID and save it for later

### Step 2: Configure the App

1. Open `app.js` in a text editor
2. Replace the placeholder values at the top of the file:
   ```javascript
   const CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // Replace with your OAuth 2.0 Client ID
   const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your API Key
   ```

### Step 3: Create App Icons

You need to create two icon files for the PWA:
- `icon-192.png` (192x192 pixels)
- `icon-512.png` (512x512 pixels)

You can create these icons using:
- An online icon generator like [Favicon.io](https://favicon.io/)
- Design tools like Canva or Figma
- Any image editor (just make sure they're the right size)

Save these icons in the same folder as `index.html`.

### Step 4: Deploy the App

You have several options to deploy this app:

#### Option A: GitHub Pages (Recommended - Free)

1. Create a new GitHub repository
2. Upload all files to the repository
3. Go to repository Settings → Pages
4. Select the main branch and save
5. Your app will be available at `https://yourusername.github.io/repository-name`

#### Option B: Netlify (Free)

1. Create a [Netlify](https://www.netlify.com/) account
2. Drag and drop all files to Netlify
3. Your app will be deployed instantly with a URL

#### Option C: Local Testing (For development only)

1. Install Python (if not already installed)
2. Open Terminal/Command Prompt in the project folder
3. Run: `python3 -m http.server 8000`
4. Open Safari on your iPhone and go to your computer's IP address: `http://YOUR_COMPUTER_IP:8000`

**Note:** Make sure to update the authorized JavaScript origins in Google Cloud Console with your deployment URL.

### Step 5: Add to iPhone Home Screen

1. Open Safari on your iPhone 16
2. Navigate to your deployed app URL
3. Tap the Share button (square with arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Name it (e.g., "Calendar") and tap "Add"
6. The icon will now appear on your home screen!

### Step 6: First Use

1. Tap the icon on your home screen
2. Tap "Connect Google Calendar"
3. Sign in to your Google account
4. Grant permission to read your calendars
5. Your events will load automatically!

## How It Works

### Filtering Logic

The app automatically filters out:
- ❌ **Recurring events** - Events that repeat (daily, weekly, monthly, etc.)
- ❌ **Birthdays** - Any event marked as a birthday or with "birthday" in the title
- ❌ **Martin Luther King Day** - Specifically excluded as requested
- ✅ **Other holidays** - Christmas, Thanksgiving, New Year, etc. are included

### Event Display

Events are:
- Grouped by month
- Sorted chronologically
- Color-coded (holidays in red, regular events in purple)
- Showing date, time, title, and which calendar they're from

## Customization

### Change the Date Range

Edit `app.js` to change from 3 months to a different range:

```javascript
const threeMonthsLater = new Date();
threeMonthsLater.setMonth(now.getMonth() + 3); // Change 3 to any number
```

### Add More Exclusions

Edit the `filterEvents` function in `app.js`:

```javascript
// Exclude specific event titles
if (title.includes('your-event-name')) {
    return false;
}
```

### Change Colors

Edit `styles.css` to change the color scheme:

```css
/* Main gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Holiday color */
.event-item.holiday {
    border-left-color: #e74c3c;
}
```

## Troubleshooting

### "Failed to load calendar events"
- Check that you've replaced the CLIENT_ID and API_KEY in `app.js`
- Verify your Google Cloud Console credentials are correct
- Make sure the Google Calendar API is enabled
- Check that your deployment URL is added to authorized JavaScript origins

### Icon not showing on home screen
- Make sure `icon-192.png` and `icon-512.png` exist in the same folder
- Try clearing Safari cache and re-adding to home screen
- Verify the manifest.json file is accessible

### Events not filtering correctly
- Check the browser console for errors (Safari → Develop → Show Web Inspector)
- Verify that the filtering logic matches your needs in `app.js`

### App requires login every time
- This is normal for security - Google's OAuth tokens expire
- The app will cache events after loading for offline viewing
- Refresh when connected to internet to update events

## Privacy & Security

- 🔒 All authentication happens directly with Google
- 🔒 No data is stored on any server
- 🔒 Events are only cached locally on your device
- 🔒 The app only requests read-only calendar access

## Files Included

- `index.html` - Main app interface
- `app.js` - JavaScript for Google Calendar API integration
- `styles.css` - Styling and layout
- `manifest.json` - PWA configuration
- `service-worker.js` - Offline caching
- `README.md` - This file

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Verify all setup steps were completed
4. Make sure you're using Safari on iOS (other browsers have limited PWA support)

## License

Free to use and modify for personal use.

---

Enjoy your instant 3-month calendar view! 🎉
