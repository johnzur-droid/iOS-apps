// Order Tracker - Gmail API Integration v62
// Scans Gmail for order confirmations from the last 60 days

// Google API Configuration
// Using NEW Gmail Client ID (not the calendar one)
const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
// No API key needed - OAuth token is sufficient for Gmail API
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// State
let allOrders = [];
let filteredOrders = [];
let activeFilter = 'ALL';
let activeStatusFilter = 'ALL';

// Gmail labels to search (exact names as they appear in Gmail)
const LABEL_NAMES = ['STORE', 'PAYPAL', 'AI', 'DIVIDED WE STAND', 'BMW', 'QUALITY-WEB-TIME'];

// Additional keyword searches
const KEYWORD_SEARCHES = {
    'AMAZON': 'from:amazon',
    'SUBSCRIPTIONS': 'subject:(subscription OR renewal OR billing OR receipt OR invoice OR "monthly charge")'
};

// Category colors
const CATEGORY_COLORS = {
    'AMAZON': '#FF9900',
    'PAYPAL': '#003087',
    'STORE': '#4CAF50',
    'AI': '#9C27B0',
    'DIVIDED WE STAND': '#E91E63',
    'BMW': '#1C69D4',
    'QUALITY-WEB-TIME': '#00BCD4',
    'SUBSCRIPTIONS': '#FF5722',
    'OTHER': '#607D8B'
};

// Status config
const STATUS_CONFIG = {
    'delivered': { label: 'Delivered', color: '#4CAF50', icon: '✓' },
    'shipped': { label: 'Shipped', color: '#2196F3', icon: '📦' },
    'processing': { label: 'Processing', color: '#FF9800', icon: '⏳' },
    'ordered': { label: 'Ordered', color: '#9E9E9E', icon: '○' },
    'subscription': { label: 'Active', color: '#9C27B0', icon: '↻' }
};

// DOM elements
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const ordersSection = document.getElementById('ordersSection');
const errorSection = document.getElementById('errorSection');
const ordersContainer = document.getElementById('ordersContainer');
const filterButtons = document.getElementById('filterButtons');
const statusFilterButtons = document.getElementById('statusFilterButtons');
const errorMessage = document.getElementById('errorMessage');
const authorizeBtn = document.getElementById('authorizeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const retryBtn = document.getElementById('retryBtn');
const totalSpentEl = document.getElementById('totalSpent');
const totalOrdersEl = document.getElementById('totalOrders');
const pendingOrdersEl = document.getElementById('pendingOrders');
const lastUpdatedEl = document.getElementById('lastUpdated');
const scanProgressEl = document.getElementById('scanProgress');

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('Order Tracker v5 loaded');
});

if (authorizeBtn) authorizeBtn.addEventListener('click', handleAuthClick);
if (refreshBtn) refreshBtn.addEventListener('click', () => scanGmailForOrders());
if (retryBtn) retryBtn.addEventListener('click', () => showSection('auth'));

function gapiLoaded() {
    if (typeof gapi === 'undefined') {
        console.log('gapi undefined, retrying...');
        setTimeout(gapiLoaded, 1000);
        return;
    }
    console.log('GAPI script loaded');
    gapi.load('client', async () => {
        try {
            // No API key needed - OAuth token handles auth
            await gapi.client.init({
                discoveryDocs: [DISCOVERY_DOC],
            });
            gapiInited = true;
            console.log('GAPI client initialized');
            maybeEnableButtons();
        } catch (error) {
            console.error('GAPI init error:', error);
            showError('Failed to initialize Google API: ' + (error.message || error.error || JSON.stringify(error)));
        }
    });
}

function gisLoaded() {
    if (typeof google === 'undefined') {
        setTimeout(gisLoaded, 1000);
        return;
    }
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '',
        });
        gisInited = true;
        maybeEnableButtons();
    } catch (error) {
        console.error('GIS init error:', error);
        showError('Failed to initialize authentication.');
    }
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        const token = gapi.client.getToken();
        if (token) {
            showSection('loading');
            scanGmailForOrders();
        } else {
            showSection('auth');
        }
    }
}

function handleAuthClick() {
    if (!gapiInited || !gisInited || !tokenClient) {
        showError('Not ready. Please refresh.');
        return;
    }

    tokenClient.callback = async (resp) => {
        if (resp.error) {
            showError('Auth error: ' + resp.error);
            return;
        }
        localStorage.setItem('orders_authorized', 'true');
        showSection('loading');
        await scanGmailForOrders();
    };

    const hasAuth = localStorage.getItem('orders_authorized');
    tokenClient.requestAccessToken({ prompt: hasAuth ? '' : 'select_account' });
}

function showSection(section) {
    authSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    ordersSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    switch (section) {
        case 'auth': authSection.classList.remove('hidden'); break;
        case 'loading': loadingSection.classList.remove('hidden'); break;
        case 'orders': ordersSection.classList.remove('hidden'); break;
        case 'error': errorSection.classList.remove('hidden'); break;
    }
}

function showError(message) {
    errorMessage.textContent = message;
    showSection('error');
}

function updateProgress(message) {
    if (scanProgressEl) scanProgressEl.textContent = message;
    console.log('Progress:', message);
}

// Debug output to screen (so user can see without developer tools)
const debugOutputEl = document.getElementById('debugOutput');
function debugLog(message, type = 'info') {
    console.log(message);
    if (debugOutputEl) {
        const line = document.createElement('div');
        line.className = `debug-line ${type}`;
        line.textContent = message;
        debugOutputEl.appendChild(line);
        debugOutputEl.scrollTop = debugOutputEl.scrollHeight;
    }
}

function clearDebug() {
    if (debugOutputEl) debugOutputEl.innerHTML = '';
}

/**
 * MAIN SCAN FUNCTION
 */
async function scanGmailForOrders() {
    try {
        showSection('loading');
        clearDebug();
        allOrders = [];

        // Step 1: Get all Gmail labels
        updateProgress('Fetching Gmail labels...');
        debugLog('Fetching all Gmail labels...', 'info');

        const labelsResponse = await gapi.client.gmail.users.labels.list({ userId: 'me' });
        const allLabels = labelsResponse.result.labels || [];

        debugLog(`Found ${allLabels.length} total labels in Gmail`, 'info');

        // Show all user labels (not system ones)
        const userLabels = allLabels.filter(l => l.type === 'user');
        debugLog(`User labels: ${userLabels.map(l => l.name).join(', ')}`, 'info');

        // Step 2: Find matching labels (case-insensitive)
        const labelMatches = {};
        for (const targetLabel of LABEL_NAMES) {
            const found = allLabels.find(l =>
                l.name.toUpperCase() === targetLabel.toUpperCase() ||
                l.name.toUpperCase().replace(/[\s-]/g, '') === targetLabel.toUpperCase().replace(/[\s-]/g, '')
            );
            if (found) {
                labelMatches[targetLabel] = found;
                debugLog(`✓ FOUND: "${targetLabel}" => ${found.name} (${found.id})`, 'found');
            } else {
                debugLog(`✗ NOT FOUND: "${targetLabel}"`, 'not-found');
            }
        }

        // Calculate date 60 days ago
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const afterDate = `${sixtyDaysAgo.getFullYear()}/${sixtyDaysAgo.getMonth() + 1}/${sixtyDaysAgo.getDate()}`;

        // Step 3: Search each label with pagination
        const totalSearches = Object.keys(labelMatches).length + Object.keys(KEYWORD_SEARCHES).length;
        let searchNum = 0;

        for (const [labelName, labelInfo] of Object.entries(labelMatches)) {
            searchNum++;
            updateProgress(`Searching ${labelName} (${searchNum}/${totalSearches})...`);

            const emails = await getAllEmailsWithLabel(labelInfo.id, afterDate);
            debugLog(`${labelName}: ${emails.length} emails found`, emails.length > 0 ? 'found' : 'not-found');

            for (const email of emails) {
                const order = emailToOrder(email, labelName);
                if (order) allOrders.push(order);
            }
        }

        // Step 4: Keyword searches (Amazon, Subscriptions)
        for (const [category, query] of Object.entries(KEYWORD_SEARCHES)) {
            searchNum++;
            updateProgress(`Searching ${category} (${searchNum}/${totalSearches})...`);

            const emails = await searchEmailsByQuery(`${query} after:${afterDate}`);
            debugLog(`${category}: ${emails.length} emails found`, emails.length > 0 ? 'found' : 'not-found');

            for (const email of emails) {
                // Skip if already found
                if (allOrders.some(o => o.id === email.id)) continue;
                const order = emailToOrder(email, category);
                if (order) allOrders.push(order);
            }
        }

        // Sort and dedupe
        allOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        allOrders = deduplicateOrders(allOrders);

        debugLog(`=== TOTAL: ${allOrders.length} orders ===`, 'info');

        createFilterButtons();
        createStatusFilterButtons();
        applyFilters();
        updateLastUpdated();
        showSection('orders');

    } catch (error) {
        console.error('Scan error:', error);
        showError('Failed: ' + (error.message || 'Unknown error'));
    }
}

/**
 * Get ALL emails with a specific label (handles pagination)
 */
async function getAllEmailsWithLabel(labelId, afterDate) {
    const emails = [];
    let pageToken = null;
    let page = 0;

    do {
        page++;
        console.log(`  Fetching page ${page} for label ${labelId}...`);

        const params = {
            userId: 'me',
            labelIds: [labelId],
            q: `after:${afterDate}`,
            maxResults: 100
        };
        if (pageToken) params.pageToken = pageToken;

        const response = await gapi.client.gmail.users.messages.list(params);
        const messages = response.result.messages || [];

        console.log(`  Page ${page}: ${messages.length} messages`);

        // Fetch full message details
        for (const msg of messages) {
            try {
                const full = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full'
                });
                emails.push(full.result);
            } catch (e) {
                console.error('Error fetching message:', e);
            }
        }

        pageToken = response.result.nextPageToken;
    } while (pageToken);

    return emails;
}

/**
 * Search emails by query string (handles pagination)
 */
async function searchEmailsByQuery(query) {
    const emails = [];
    let pageToken = null;

    do {
        const params = {
            userId: 'me',
            q: query,
            maxResults: 100
        };
        if (pageToken) params.pageToken = pageToken;

        const response = await gapi.client.gmail.users.messages.list(params);
        const messages = response.result.messages || [];

        for (const msg of messages) {
            try {
                const full = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full'
                });
                emails.push(full.result);
            } catch (e) {
                console.error('Error fetching message:', e);
            }
        }

        pageToken = response.result.nextPageToken;
    } while (pageToken);

    return emails;
}

/**
 * Convert email to order object - MINIMAL FILTERING
 */
function emailToOrder(message, category) {
    const headers = message.payload.headers;
    const subject = getHeader(headers, 'Subject') || 'No Subject';
    const from = getHeader(headers, 'From') || '';
    const date = getHeader(headers, 'Date') || '';

    // Only exclude obvious non-orders
    const subjectLower = subject.toLowerCase();
    const skipPatterns = ['password reset', 'verify your email', 'sign in', 'security alert'];
    if (skipPatterns.some(p => subjectLower.includes(p))) {
        return null;
    }

    const body = getEmailBody(message.payload);
    const price = extractPrice(body);
    const status = determineStatus(subject, body);

    return {
        id: message.id,
        source: category,
        orderDate: new Date(date).toISOString().split('T')[0],
        items: [{ name: cleanSubject(subject), quantity: 1, price: price }],
        totalPrice: price,
        status: status,
        subject: subject,
        from: extractSenderName(from),
        merchant: extractMerchant(from),
        trackingNumber: null,
        isSubscription: category === 'SUBSCRIPTIONS' || subjectLower.includes('subscription'),
        snippet: message.snippet
    };
}

function cleanSubject(subject) {
    return subject
        .replace(/^(re:|fwd:|fw:)\s*/gi, '')
        .replace(/order\s*(confirmation|confirmed|#?\d+)/gi, '')
        .replace(/your\s+order/gi, '')
        .trim()
        .substring(0, 100) || 'Order';
}

function extractPrice(body) {
    const matches = body.match(/\$\s*([\d,]+\.?\d*)/g) || [];
    const prices = matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(p => p > 0 && p < 10000);
    return prices.length > 0 ? Math.max(...prices) : 0;
}

function determineStatus(subject, body) {
    const content = (subject + ' ' + body).toLowerCase();
    if (content.includes('delivered') || content.includes('has arrived')) return 'delivered';
    if (content.includes('shipped') || content.includes('on its way') || content.includes('in transit')) return 'shipped';
    if (content.includes('subscription') || content.includes('renewal') || content.includes('billing')) return 'subscription';
    if (content.includes('processing') || content.includes('preparing')) return 'processing';
    return 'ordered';
}

function getEmailBody(payload) {
    let body = '';
    if (payload.body && payload.body.data) {
        body = decodeBase64(payload.body.data);
    } else if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                body = decodeBase64(part.body.data);
                break;
            }
            if (part.mimeType === 'text/html' && part.body && part.body.data) {
                body = stripHtml(decodeBase64(part.body.data));
            }
            if (part.parts) {
                for (const subpart of part.parts) {
                    if (subpart.mimeType === 'text/plain' && subpart.body && subpart.body.data) {
                        body = decodeBase64(subpart.body.data);
                        break;
                    }
                }
            }
        }
    }
    return body;
}

function decodeBase64(data) {
    try {
        return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));
    } catch (e) {
        try {
            return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
        } catch (e2) {
            return '';
        }
    }
}

function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

function getHeader(headers, name) {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
}

function extractSenderName(from) {
    const match = from.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : from.split('@')[0];
}

function extractMerchant(from) {
    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    if (emailMatch) {
        const domain = emailMatch[1].split('@')[1];
        if (domain) {
            const name = domain.split('.')[0];
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
    }
    return 'Unknown';
}

function deduplicateOrders(orders) {
    const seen = new Map();
    return orders.filter(order => {
        const key = order.id;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
}

// ============ UI Functions ============

function createFilterButtons() {
    const categories = ['ALL', ...new Set(allOrders.map(o => o.source))];

    filterButtons.innerHTML = categories.map(cat => `
        <button class="filter-btn ${cat === 'ALL' ? 'active' : ''}"
                data-category="${cat}"
                style="${cat !== 'ALL' ? `--cat-color: ${CATEGORY_COLORS[cat] || '#666'}` : ''}">
            ${cat === 'ALL' ? 'All' : cat}
            <span class="count">${cat === 'ALL' ? allOrders.length : allOrders.filter(o => o.source === cat).length}</span>
        </button>
    `).join('');

    filterButtons.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.category;
            applyFilters();
        });
    });
}

function createStatusFilterButtons() {
    const statuses = ['ALL', 'delivered', 'shipped', 'ordered', 'subscription'];

    statusFilterButtons.innerHTML = statuses.map(status => {
        const config = STATUS_CONFIG[status] || { label: 'All', icon: '📋' };
        const count = status === 'ALL' ? allOrders.length : allOrders.filter(o => o.status === status).length;
        if (count === 0 && status !== 'ALL') return '';
        return `
            <button class="status-filter-btn ${status === 'ALL' ? 'active' : ''}" data-status="${status}">
                ${status === 'ALL' ? '📋' : config.icon} ${status === 'ALL' ? 'All' : config.label}
            </button>
        `;
    }).join('');

    statusFilterButtons.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            statusFilterButtons.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeStatusFilter = btn.dataset.status;
            applyFilters();
        });
    });
}

function applyFilters() {
    filteredOrders = allOrders.filter(order => {
        const categoryMatch = activeFilter === 'ALL' || order.source === activeFilter;
        const statusMatch = activeStatusFilter === 'ALL' || order.status === activeStatusFilter;
        return categoryMatch && statusMatch;
    });
    displayOrders();
    updateSummary();
}

function displayOrders() {
    if (filteredOrders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="no-orders">
                <div class="no-orders-icon">📦</div>
                <p>No orders found</p>
                <p class="no-orders-hint">Try adjusting your filters</p>
            </div>
        `;
        return;
    }

    const ordersByDate = {};
    filteredOrders.forEach(order => {
        const dateKey = order.orderDate;
        if (!ordersByDate[dateKey]) ordersByDate[dateKey] = [];
        ordersByDate[dateKey].push(order);
    });

    let html = '';
    Object.keys(ordersByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(dateKey => {
        const orders = ordersByDate[dateKey];
        const formattedDate = formatDateHeader(dateKey);
        html += `
            <div class="date-group">
                <div class="date-header">${formattedDate}</div>
                ${orders.map(order => createOrderCard(order)).join('')}
            </div>
        `;
    });

    ordersContainer.innerHTML = html;

    ordersContainer.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', () => card.classList.toggle('expanded'));
    });
}

function formatDateHeader(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function createOrderCard(order) {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.ordered;
    const categoryColor = CATEGORY_COLORS[order.source] || '#666';
    const itemName = order.items[0]?.name || order.subject;
    const price = order.totalPrice > 0 ? `$${order.totalPrice.toFixed(2)}` : '';

    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-main">
                <div class="order-category" style="background-color: ${categoryColor}">
                    ${getCategoryIcon(order.source)}
                </div>
                <div class="order-info">
                    <div class="order-title">${escapeHtml(itemName.substring(0, 60))}</div>
                    <div class="order-meta">
                        <span class="order-merchant">${escapeHtml(order.merchant)}</span>
                        ${price ? `<span class="order-price">${price}</span>` : ''}
                    </div>
                </div>
                <div class="order-status" style="color: ${statusConfig.color}">
                    <span class="status-icon">${statusConfig.icon}</span>
                    <span class="status-text">${statusConfig.label}</span>
                </div>
            </div>
            <div class="order-details">
                <div class="order-subject">${escapeHtml(order.subject)}</div>
                <div class="order-from">From: ${escapeHtml(order.from)}</div>
                ${order.snippet ? `<div class="order-snippet">${escapeHtml(order.snippet.substring(0, 200))}...</div>` : ''}
                ${order.isSubscription ? '<div class="subscription-badge">Subscription</div>' : ''}
            </div>
        </div>
    `;
}

function getCategoryIcon(source) {
    const icons = {
        'AMAZON': '📦',
        'PAYPAL': '💳',
        'STORE': '🛒',
        'AI': '🤖',
        'DIVIDED WE STAND': '👕',
        'BMW': '🚗',
        'QUALITY-WEB-TIME': '🌐',
        'SUBSCRIPTIONS': '↻',
        'OTHER': '🛍️'
    };
    return icons[source] || '📦';
}

function updateSummary() {
    const totalSpent = filteredOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const pendingCount = filteredOrders.filter(o => ['ordered', 'processing', 'shipped'].includes(o.status)).length;

    totalSpentEl.textContent = `$${totalSpent.toFixed(2)}`;
    totalOrdersEl.textContent = filteredOrders.length;
    pendingOrdersEl.textContent = pendingCount;
}

function updateLastUpdated() {
    const now = new Date();
    lastUpdatedEl.textContent = now.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW failed:', err));
    });
}
