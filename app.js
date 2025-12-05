// Google Calendar API Configuration
const CLIENT_ID = '457025763296-osgitgjro33vo2tcc5d2d596isroij5v.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCd0_nribWi82phleLUjuYfBcNJ-KNXMco';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// DOM elements
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const eventsSection = document.getElementById('eventsSection');
const errorSection = document.getElementById('errorSection');
const eventsList = document.getElementById('eventsList');
const errorMessage = document.getElementById('errorMessage');
const authorizeBtn = document.getElementById('authorizeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const retryBtn = document.getElementById('retryBtn');

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
});
authorizeBtn.addEventListener('click', handleAuthClick);
refreshBtn.addEventListener('click', loadCalendarEvents);
retryBtn.addEventListener('click', () => {
    showSection('auth');
});

/**
 * Callback after api.js is loaded
 */
function gapiLoaded() {
    if (typeof gapi === 'undefined') {
        console.error('Google API library failed to load');
        setTimeout(gapiLoaded, 1000); // Retry after 1 second
        return;
    }
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: [DISCOVERY_DOC],
            });
            gapiInited = true;
            maybeEnableButtons();
        } catch (error) {
            console.error('Error initializing GAPI client:', error);
            showError('Failed to initialize Google API. Please refresh the page.');
        }
    });
}

/**
 * Callback after the Google Identity Services script loads
 */
function gisLoaded() {
    if (typeof google === 'undefined') {
        console.error('Google Identity Services library failed to load');
        setTimeout(gisLoaded, 1000); // Retry after 1 second
        return;
    }
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing Google Identity Services:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
    }
}

/**
 * Enables user interaction after all libraries are loaded
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        // Check if already authorized
        const token = gapi.client.getToken();
        if (token) {
            console.log('Already authorized, loading events...');
            showSection('loading');
            loadCalendarEvents();
        } else {
            console.log('Not authorized, showing auth button');
            showSection('auth');
        }
    }
}

/**
 * Handle authorization button click
 */
function handleAuthClick() {
    console.log('Auth button clicked');

    // Check if libraries are initialized
    if (!gapiInited || !gisInited) {
        showError('Application not fully loaded. Please wait a moment and try again.');
        console.error('gapiInited:', gapiInited, 'gisInited:', gisInited);
        return;
    }

    if (!tokenClient) {
        showError('Authentication not initialized. Please refresh the page.');
        return;
    }

    try {
        tokenClient.callback = async (resp) => {
            console.log('OAuth callback received:', resp);
            if (resp.error !== undefined) {
                showError('Authentication error: ' + resp.error);
                return;
            }
            // Mark that user has authorized before
            localStorage.setItem('calendar_authorized', 'true');
            showSection('loading');
            await loadCalendarEvents();
        };

        console.log('Requesting access token...');
        const hasAuthorizedBefore = localStorage.getItem('calendar_authorized');

        if (gapi.client.getToken() === null) {
            // Use 'select_account' instead of 'consent' to avoid full consent flow every time
            tokenClient.requestAccessToken({ prompt: hasAuthorizedBefore ? '' : 'select_account' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        console.error('Error during authentication:', error);
        showError('Authentication failed: ' + error.message);
    }
}

/**
 * Show specific section and hide others
 */
function showSection(section) {
    authSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    eventsSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    switch (section) {
        case 'auth':
            authSection.classList.remove('hidden');
            break;
        case 'loading':
            loadingSection.classList.remove('hidden');
            break;
        case 'events':
            eventsSection.classList.remove('hidden');
            break;
        case 'error':
            errorSection.classList.remove('hidden');
            break;
    }
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    showSection('error');
}

/**
 * Load calendar events from all calendars
 */
async function loadCalendarEvents() {
    try {
        showSection('loading');

        // Get date range for next 3 months
        const now = new Date();
        const threeMonthsLater = new Date();
        threeMonthsLater.setMonth(now.getMonth() + 3);

        // Get all calendars
        const calendarListResponse = await gapi.client.calendar.calendarList.list();
        const allCalendars = calendarListResponse.result.items;

        if (!allCalendars || allCalendars.length === 0) {
            showError('No calendars found');
            return;
        }

        // Filter to only include specific calendars
        const allowedCalendars = ['johnzur@gmail.com', 'tj', 'holiday'];
        const calendars = allCalendars.filter(calendar => {
            const calName = calendar.summary.toLowerCase();
            const calId = calendar.id.toLowerCase();
            return allowedCalendars.some(allowed =>
                calName.includes(allowed) || calId.includes(allowed)
            );
        });

        console.log('Filtered calendars:', calendars.map(c => c.summary));

        if (calendars.length === 0) {
            showError('No matching calendars found (looking for: johnzur@gmail.com, TJ, Holiday)');
            return;
        }

        // Fetch events from filtered calendars
        const allEventsPromises = calendars.map(async (calendar) => {
            try {
                const response = await gapi.client.calendar.events.list({
                    calendarId: calendar.id,
                    timeMin: now.toISOString(),
                    timeMax: threeMonthsLater.toISOString(),
                    showDeleted: false,
                    singleEvents: true, // Expand recurring events
                    maxResults: 250,
                    orderBy: 'startTime',
                });

                return {
                    calendarName: calendar.summary,
                    events: response.result.items || []
                };
            } catch (error) {
                console.error(`Error fetching events from ${calendar.summary}:`, error);
                return {
                    calendarName: calendar.summary,
                    events: []
                };
            }
        });

        const calendarEvents = await Promise.all(allEventsPromises);

        // Flatten and filter events
        let allEvents = [];
        calendarEvents.forEach(({ calendarName, events }) => {
            events.forEach(event => {
                event.calendarName = calendarName;
                allEvents.push(event);
            });
        });

        // Filter events based on criteria
        const filteredEvents = filterEvents(allEvents);

        // Sort events by date
        filteredEvents.sort((a, b) => {
            const dateA = new Date(a.start.dateTime || a.start.date);
            const dateB = new Date(b.start.dateTime || b.start.date);
            return dateA - dateB;
        });

        // Display events
        displayEvents(filteredEvents);

    } catch (error) {
        console.error('Error loading calendar events:', error);
        let errorMsg = 'Failed to load calendar events. ';
        if (error.result && error.result.error) {
            errorMsg += error.result.error.message;
        } else if (error.message) {
            errorMsg += error.message;
        } else {
            errorMsg += 'Please try again.';
        }
        showError(errorMsg);
    }
}

/**
 * Filter events based on user criteria
 */
function filterEvents(events) {
    return events.filter(event => {
        const title = (event.summary || '').toLowerCase();

        // Exclude birthdays
        if (event.eventType === 'birthday' || title.includes('birthday')) {
            return false;
        }

        // Exclude Martin Luther King Day
        if (title.includes('martin luther king')) {
            return false;
        }

        // Exclude recurring events (keep single instances from expanded recurring events)
        // If the event has a recurringEventId, it's an instance of a recurring event
        if (event.recurringEventId) {
            return false;
        }

        // Exclude events with recurrence rules (unexpanded recurring events)
        if (event.recurrence && event.recurrence.length > 0) {
            return false;
        }

        return true;
    });
}

/**
 * Display events grouped by month
 */
function displayEvents(events) {
    if (events.length === 0) {
        eventsList.innerHTML = '<div class="no-events">No events found for the next 3 months</div>';
        showSection('events');
        return;
    }

    // Group events by month
    const eventsByMonth = {};
    events.forEach(event => {
        // Parse date correctly to avoid timezone issues
        let eventDate;
        if (event.start.date) {
            // All-day event - parse without timezone conversion
            const [year, month, day] = event.start.date.split('-').map(Number);
            eventDate = new Date(year, month - 1, day);
        } else {
            // Timed event
            eventDate = new Date(event.start.dateTime);
        }

        const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

        if (!eventsByMonth[monthKey]) {
            eventsByMonth[monthKey] = {
                name: monthName,
                events: []
            };
        }

        eventsByMonth[monthKey].events.push(event);
    });

    // Build HTML
    let html = '';
    Object.keys(eventsByMonth).sort().forEach(monthKey => {
        const month = eventsByMonth[monthKey];
        html += `
            <div class="month-group">
                <div class="month-header">${month.name}</div>
                ${month.events.map(event => createEventHTML(event)).join('')}
            </div>
        `;
    });

    eventsList.innerHTML = html;
    showSection('events');
}

/**
 * Create HTML for a single event (simplified single line format)
 */
function createEventHTML(event) {
    const title = event.summary || 'No title';
    const isHoliday = isHolidayEvent(event);

    // Format date - simple format: "Mon, Dec 5"
    let eventDate;

    if (event.start.date) {
        // All-day event - parse date without timezone conversion
        const [year, month, day] = event.start.date.split('-').map(Number);
        eventDate = new Date(year, month - 1, day);
    } else {
        // Timed event - use dateTime
        eventDate = new Date(event.start.dateTime);
    }

    const dateStr = eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    return `
        <div class="event-item ${isHoliday ? 'holiday' : ''}">
            <span class="event-date-inline">${dateStr}</span>
            <span class="event-separator">•</span>
            <span class="event-title-inline">${escapeHtml(title)}</span>
        </div>
    `;
}

/**
 * Check if event is a holiday
 */
function isHolidayEvent(event) {
    const title = (event.summary || '').toLowerCase();
    const calendarName = (event.calendarName || '').toLowerCase();

    // Check if from holidays calendar
    if (calendarName.includes('holiday')) {
        return true;
    }

    // Check for common holiday keywords
    const holidayKeywords = [
        'holiday', 'christmas', 'thanksgiving', 'new year',
        'independence day', 'memorial day', 'labor day',
        'veterans day', 'presidents day', 'columbus day',
        'easter', 'passover', 'hanukkah', 'diwali'
    ];

    return holidayKeywords.some(keyword => title.includes(keyword));
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Register service worker for PWA
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}
