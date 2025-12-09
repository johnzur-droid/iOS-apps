# 📅 3-Month Calendar View for iPhone

A Progressive Web App (PWA) that displays your Google Calendar events for the next 3 months on your iPhone 16, with smart filtering and a clean, easy-to-scan interface.

## 🎯 What It Does

This app gives you an instant view of your upcoming calendar events for the next 3 months, displayed in a clean, single-line format that's perfect for quick glances on your iPhone.

**Key Features:**
- 📱 **Accessible from Home Screen** - Add to your iPhone like a native app
- 🗓️ **3-Month View** - See the next 90 days of events at a glance
- 🎯 **Smart Filtering** - Only shows events from specific calendars
- 🚫 **Excludes** - Recurring events, birthdays, Martin Luther King Day
- ✅ **Includes** - All other holidays and one-time events
- 📊 **Simple Display** - Date and event name only, grouped by month
- 🎨 **Color Coded** - Holidays in red, regular events in purple

---

## 📋 What You See

**Display Format:**
```
December 2024

Mon, Dec 9 • Doctor Appointment
Wed, Dec 11 • Team Meeting
Thu, Dec 25 • Christmas (highlighted in red)

January 2025

Fri, Jan 3 • Project Review
Mon, Jan 20 • Presidents Day (highlighted in red)
```

**Filtered Calendars:**
- johnzur@gmail.com calendar
- TJ calendar
- Holiday calendar

**Excluded:**
- Recurring events (weekly meetings, daily reminders, etc.)
- Birthdays
- Martin Luther King Day
- Any calendars not in the allowed list

---

## 🚀 How It Works

### Technology Stack
- **Frontend:** HTML, CSS, JavaScript
- **Authentication:** Google OAuth 2.0 (Google Identity Services)
- **API:** Google Calendar API
- **Deployment:** GitHub Pages
- **App Type:** Progressive Web App (PWA)

### Architecture
1. User opens app from iPhone home screen
2. App loads Google API libraries
3. User taps "Connect Google Calendar" (one tap)
4. Silent OAuth authorization happens in background
5. App fetches events from allowed calendars (next 3 months)
6. Events are filtered based on criteria
7. Events are displayed in simple, scannable format

---

## 🛠️ Setup Instructions

### Step 1: Google Cloud Console Setup

#### 1.1 Create Project
1. Go to https://console.cloud.google.com/
2. Create new project or select existing one
3. Note the project name

#### 1.2 Enable Google Calendar API
1. In left sidebar: **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and click **ENABLE**

#### 1.3 Create API Key
1. In left sidebar: **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API key**
3. Copy the API key (save it for later)
4. (Optional) Click **EDIT API KEY** to restrict it to Google Calendar API only

#### 1.4 Configure OAuth Consent Screen
1. In left sidebar: **OAuth consent screen**
2. User Type: Select **External**
3. Click **CREATE**
4. Fill in required fields:
   - App name: `Calendar Viewer`
   - User support email: Your email
   - Developer contact: Your email
5. Click **SAVE AND CONTINUE** through all steps
6. On **Test users** page:
   - Click **+ ADD USERS**
   - Add your email address (the one with your calendars)
   - Click **ADD**
7. Click **SAVE AND CONTINUE**
8. Click **BACK TO DASHBOARD**

#### 1.5 Create OAuth Client ID
1. In left sidebar: **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Calendar Viewer Web Client`
5. **Authorized JavaScript origins:**
   - Click **+ ADD URI**
   - Add: `http://localhost:8000`
   - Click **+ ADD URI**
   - Add: `https://johnzur-droid.github.io`
6. Click **CREATE**
7. Copy the **Client ID** (save it for later)

### Step 2: Configure the App

#### 2.1 Update Credentials in Code
1. Open `app.js`
2. At the top of the file, replace these lines:
   ```javascript
   const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
   const API_KEY = 'YOUR_API_KEY_HERE';
   ```
   With your actual credentials:
   ```javascript
   const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
   // Note: API key is not required - OAuth token is sufficient
   ```

#### 2.2 Customize Calendar Filters (Optional)
To change which calendars are shown, edit `app.js` around line 152:
```javascript
const allowedCalendars = ['johnzur@gmail.com', 'tj', 'holiday'];
```

Change these to match your calendar names.

#### 2.3 Customize Exclusions (Optional)
To change what events are excluded, edit the `filterEvents` function in `app.js`.

### Step 3: Deploy to GitHub Pages

#### 3.1 Create Repository
1. Go to https://github.com
2. Create new repository named `iOS-apps`
3. Make it public or private (your choice)

#### 3.2 Upload Files
Upload all files to the repository:
- index.html
- app.js
- styles.css
- manifest.json
- service-worker.js
- icon-192.png
- icon-512.png
- README.md

#### 3.3 Enable GitHub Pages
1. Go to repository **Settings**
2. In left sidebar, click **Pages**
3. Under "Branch":
   - Select your branch (e.g., `claude/iphone-calendar-widget-...` or `main`)
   - Folder: `/ (root)`
   - Click **Save**
4. Wait 30-60 seconds
5. Page will show: "Your site is live at `https://johnzur-droid.github.io/iOS-apps/`"
6. Copy this URL

#### 3.4 Update Google OAuth Settings
1. Go back to Google Cloud Console
2. **Credentials** → Click on your OAuth Client ID
3. Under "Authorized JavaScript origins":
   - Click **+ ADD URI**
   - Add your GitHub Pages URL: `https://johnzur-droid.github.io`
4. Click **SAVE**

### Step 4: Add to iPhone Home Screen

#### 4.1 Open in Safari
1. On your iPhone, open **Safari**
2. Go to: `https://johnzur-droid.github.io/iOS-apps/`
3. Verify it loads and shows "Connect Google Calendar" button

#### 4.2 Add to Home Screen
1. Tap the **Share** button (bottom of Safari)
2. Scroll and tap **"Add to Home Screen"**
3. Name it (e.g., "Calendar")
4. Tap **Add**
5. You'll see the purple calendar icon with "3" on your home screen

#### 4.3 First Use
1. Tap the home screen icon
2. Tap **"Connect Google Calendar"**
3. Sign in with your Google account
4. Grant permission to read calendars
5. Your events will load!

---

## 📱 How to Use

### Opening the App
1. Tap the calendar icon on your home screen
2. Tap "Connect Google Calendar" button (one tap)
3. Background authorization happens (no additional steps)
4. Your events load automatically

**Note:** You'll need to tap "Connect Google Calendar" each time you open the app due to iOS security limitations. This is normal and expected.

### Viewing Events
- Events are grouped by month
- Scroll to see all 3 months
- Holidays are highlighted in red
- Regular events have a purple border
- Format: `Date • Event Name`

### Refreshing
- Tap the 🔄 Refresh button at the top to reload events
- Or close and reopen the app

---

## 🔧 Troubleshooting

### "Failed to load calendar events"
**Causes:**
- Google Calendar API not enabled
- API Key or Client ID incorrect
- User email not added as test user

**Solutions:**
1. Verify Google Calendar API is enabled in Google Cloud Console
2. Check that API Key and Client ID in `app.js` are correct
3. Ensure your email is added as a test user in OAuth consent screen

### "404 Not Found" when opening from home screen
**Cause:** Incorrect `start_url` in manifest.json

**Solution:**
1. Open `manifest.json`
2. Verify `start_url` is: `https://johnzur-droid.github.io/iOS-apps/`
3. If you changed the repository name, update the URL accordingly

### Events from unwanted calendars showing
**Solution:**
1. Open `app.js`
2. Find line ~152: `const allowedCalendars = ['johnzur@gmail.com', 'tj', 'holiday'];`
3. Update the calendar names to match your allowed calendars
4. Commit and push changes to GitHub

### Recurring events still showing
**Causes:**
- Event is marked as single instance (not actually recurring)
- Event doesn't have `recurringEventId` or `recurrence` property

**Solution:**
Events are filtered based on Google's API properties. If an event appears recurring but shows up, it may not be marked as recurring in Google Calendar.

### Cache Issues (Old version showing)
**Solution:**
1. Close Safari completely (swipe away)
2. Open Settings → Safari → Clear History and Website Data
3. Reopen Safari and go to the app URL
4. Delete old home screen icon
5. Add fresh home screen icon

### Authorization Required Every Time
**This is normal!** Due to iOS PWA security limitations:
- OAuth tokens don't persist across PWA launches
- You'll tap "Connect Google Calendar" each time
- Background authorization happens quickly (1 tap)
- This is the expected behavior for web-based solutions on iPhone

---

## 📁 File Structure

```
iOS-apps/
├── index.html           # Main app interface
├── app.js              # Calendar logic and Google API integration
├── styles.css          # Styling and layout
├── manifest.json       # PWA configuration
├── service-worker.js   # Offline caching
├── icon-192.png        # App icon (192x192)
├── icon-512.png        # App icon (512x512)
├── generate_icons.py   # Script to generate icons
├── create-icons.html   # Icon generator utility
└── README.md          # This file
```

---

## 🔐 Security & Privacy

- **No data storage:** Events are only cached locally on your device
- **Read-only access:** App only requests calendar read permissions
- **No backend:** All processing happens in your browser
- **Direct to Google:** Authentication happens directly with Google
- **Open source:** All code is visible in the repository

---

## ⚙️ Technical Details

### API Credentials
- **Client ID:** Configure in `app.js` with your own Google OAuth Client ID
- **API Key:** Not required - OAuth token is sufficient for Calendar API

### Deployment
- **Live URL:** https://johnzur-droid.github.io/iOS-apps/
- **Branch:** `claude/iphone-calendar-widget-017CoV7YLXq9zcgiJQkfKsT5`
- **Platform:** GitHub Pages

### Calendar Filtering Logic
```javascript
// Allowed calendars
const allowedCalendars = ['johnzur@gmail.com', 'tj', 'holiday'];

// Excluded event types
- Birthdays (eventType === 'birthday')
- Martin Luther King Day (title contains 'martin luther king')
- Recurring events (has recurringEventId or recurrence property)
```

### Date Range
- **Start:** Current date
- **End:** Current date + 3 months
- **Auto-updates:** Shows next 3 months from whenever you open it

---

## 🚧 Known Limitations

1. **Re-authorization Required**
   - Must tap "Connect Google Calendar" each time you open the app
   - Due to iOS PWA security model
   - Background auth is quick (1 tap)

2. **No Offline Support**
   - Requires internet connection to fetch events
   - Service worker caches app files, but not calendar data

3. **Google API Limits**
   - Free tier: 1 million requests/day (more than enough for personal use)
   - Rate limit: 10 requests/second

4. **iOS Only**
   - Optimized for iPhone (specifically iPhone 16)
   - May work on other devices but not tested

5. **PWA Limitations**
   - No background refresh
   - No notifications
   - No widgets

---

## 🔄 Updating the App

### To Update Calendar Filters
1. Edit `app.js` - line 152
2. Commit and push to GitHub
3. Wait 30 seconds for GitHub Pages to update
4. Clear Safari cache on iPhone
5. Reopen app

### To Update Display Format
1. Edit `createEventHTML` function in `app.js`
2. Edit corresponding CSS in `styles.css`
3. Commit and push
4. Clear cache and reload

### To Update Credentials
1. Edit `CLIENT_ID` and `API_KEY` in `app.js`
2. Commit and push
3. Update authorized origins in Google Cloud Console if needed

---

## 🎨 Customization

### Change Color Scheme
Edit `styles.css`:

```css
/* Main gradient (header, accents) */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Regular event border */
.event-item {
    border-left: 3px solid #667eea;
}

/* Holiday event border and background */
.event-item.holiday {
    border-left-color: #e74c3c;
    background: #fff5f5;
}
```

### Change Date Range
Edit `app.js` around line 140:

```javascript
const threeMonthsLater = new Date();
threeMonthsLater.setMonth(now.getMonth() + 3); // Change 3 to any number
```

### Add More Exclusions
Edit `filterEvents` function in `app.js`:

```javascript
// Exclude specific event titles
if (title.includes('weekly standup')) {
    return false;
}
```

---

## 🆘 Support

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review the **Setup Instructions** to ensure all steps were completed
3. Check browser console for errors (Safari → Develop → Show Web Inspector)
4. Verify Google Cloud Console settings
5. Try clearing cache and re-adding to home screen

---

## 📝 Version History

### Current Version (December 2024)
- Initial release
- 3-month calendar view
- Smart filtering (exclude recurring, birthdays, MLK Day)
- Single-line event display
- PWA with home screen support
- Google OAuth integration
- GitHub Pages deployment

---

## 🎯 Future Enhancements (Potential)

- [ ] Offline caching of calendar data
- [ ] Adjustable date range (1 month, 6 months, etc.)
- [ ] Custom color coding by calendar
- [ ] Search/filter events
- [ ] Export events to PDF or email
- [ ] Native iOS app version (requires Mac, Xcode, App Store)

---

## 📄 License

Free to use and modify for personal use.

---

## 🙏 Acknowledgments

Built with:
- Google Calendar API
- Google Identity Services
- GitHub Pages
- Progressive Web App technologies

Created for: John Zur
Date: December 2024
Device: iPhone 16 Pro

---

**Enjoy your instant 3-month calendar view! 📅**
