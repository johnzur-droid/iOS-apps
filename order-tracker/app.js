// Order Tracker - Gmail API Integration
// Scans Gmail for order confirmations from the last 60 days

// Google API Configuration (uses same credentials as calendar app)
const CLIENT_ID = '457025763296-osgitgjro33vo2tcc5d2d596isroij5v.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCd0_nribWi82phleLUjuYfBcNJ-KNXMco';
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

// Gmail search queries - search by Gmail label first
// Labels are: STORE, PAYPAL, AI, DIVIDED WE STAND, BMW, QUALITY-WEB-TIME (all uppercase)
const FOLDER_SEARCHES = {
    'STORE': {
        label: 'STORE',
        query: null  // Only search by label
    },
    'PAYPAL': {
        label: 'PAYPAL',
        query: null
    },
    'AI': {
        label: 'AI',
        query: null
    },
    'DIVIDED WE STAND': {
        label: 'DIVIDED-WE-STAND',  // Gmail converts spaces to dashes in label search
        query: null
    },
    'BMW': {
        label: 'BMW',
        query: null
    },
    'QUALITY WEB TIME': {
        label: 'QUALITY-WEB-TIME',  // User confirmed dashes
        query: null
    },
    'AMAZON': {
        label: null,
        query: 'from:amazon'  // All Amazon emails
    },
    'SUBSCRIPTIONS': {
        label: null,
        query: 'subject:(subscription OR renewal OR billing OR "monthly charge" OR "your receipt")'
    }
};

// Additional broad search to catch anything missed
const BROAD_ORDER_SEARCH = 'subject:(order confirmed OR order confirmation OR your order has shipped OR delivery OR "thank you for your order" OR receipt OR invoice) -subject:(password OR verify OR survey)';

// Category colors
const CATEGORY_COLORS = {
    'AMAZON': '#FF9900',
    'PAYPAL': '#003087',
    'STORE': '#4CAF50',
    'AI': '#9C27B0',
    'DIVIDED WE STAND': '#E91E63',
    'BMW': '#1C69D4',
    'QUALITY WEB TIME': '#00BCD4',
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
    console.log('Order Tracker loaded');
});

if (authorizeBtn) authorizeBtn.addEventListener('click', handleAuthClick);
if (refreshBtn) refreshBtn.addEventListener('click', () => scanGmailForOrders());
if (retryBtn) retryBtn.addEventListener('click', () => showSection('auth'));

/**
 * Callback after api.js is loaded
 */
function gapiLoaded() {
    if (typeof gapi === 'undefined') {
        console.error('Google API library failed to load');
        setTimeout(gapiLoaded, 1000);
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
 * Callback after Google Identity Services loads
 */
function gisLoaded() {
    if (typeof google === 'undefined') {
        console.error('Google Identity Services library failed to load');
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
        console.error('Error initializing Google Identity Services:', error);
        showError('Failed to initialize authentication. Please refresh the page.');
    }
}

/**
 * Enable buttons when APIs are ready
 */
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        const token = gapi.client.getToken();
        if (token) {
            console.log('Already authorized, scanning emails...');
            showSection('loading');
            scanGmailForOrders();
        } else {
            console.log('Not authorized, showing auth button');
            showSection('auth');
        }
    }
}

/**
 * Handle auth button click
 */
function handleAuthClick() {
    if (!gapiInited || !gisInited) {
        showError('Application not fully loaded. Please wait and try again.');
        return;
    }

    if (!tokenClient) {
        showError('Authentication not initialized. Please refresh the page.');
        return;
    }

    try {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                showError('Authentication error: ' + resp.error);
                return;
            }
            localStorage.setItem('orders_authorized', 'true');
            showSection('loading');
            await scanGmailForOrders();
        };

        const hasAuthorizedBefore = localStorage.getItem('orders_authorized');
        if (gapi.client.getToken() === null) {
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
 * Show/hide sections
 */
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

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    showSection('error');
}

/**
 * Update scan progress
 */
function updateProgress(message) {
    if (scanProgressEl) {
        scanProgressEl.textContent = message;
    }
}

/**
 * Main function: Scan Gmail for orders
 */
async function scanGmailForOrders() {
    try {
        showSection('loading');
        allOrders = [];

        // Calculate date 60 days ago
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const dateQuery = `after:${formatDateForQuery(sixtyDaysAgo)}`;

        const categories = Object.keys(FOLDER_SEARCHES);
        let totalSteps = categories.length + 1; // +1 for broad search
        let currentStep = 0;

        // Search each category
        for (const category of categories) {
            currentStep++;
            updateProgress(`Scanning ${category} (${currentStep}/${totalSteps})...`);

            const config = FOLDER_SEARCHES[category];

            try {
                // Search by Gmail label if configured
                if (config.label) {
                    const labelQuery = `label:${config.label} ${dateQuery}`;
                    console.log(`Searching: ${labelQuery}`);
                    const labelOrders = await searchAndParseEmails(category, labelQuery);
                    allOrders.push(...labelOrders);
                }

                // Also search by keyword query if configured
                if (config.query) {
                    const keywordQuery = `${config.query} ${dateQuery}`;
                    console.log(`Searching: ${keywordQuery}`);
                    const orders = await searchAndParseEmails(category, keywordQuery);
                    allOrders.push(...orders);
                }
            } catch (error) {
                console.error(`Error scanning ${category}:`, error);
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Do a broad search to catch anything missed
        currentStep++;
        updateProgress(`Deep scan for missed orders (${currentStep}/${totalSteps})...`);
        try {
            const broadQuery = `${BROAD_ORDER_SEARCH} ${dateQuery}`;
            const broadOrders = await searchAndParseEmails('OTHER', broadQuery);

            // Only add orders that aren't already captured
            for (const order of broadOrders) {
                const isDuplicate = allOrders.some(existing =>
                    existing.id === order.id ||
                    (existing.subject === order.subject && existing.orderDate === order.orderDate)
                );
                if (!isDuplicate) {
                    // Try to categorize based on sender
                    order.source = categorizeOrder(order);
                    allOrders.push(order);
                }
            }
        } catch (error) {
            console.error('Error in broad search:', error);
        }

        // Sort by date (newest first)
        allOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

        // Remove duplicates
        allOrders = deduplicateOrders(allOrders);

        console.log(`Found ${allOrders.length} total orders`);

        // Initialize filters and display
        createFilterButtons();
        createStatusFilterButtons();
        applyFilters();
        updateLastUpdated();

        showSection('orders');

    } catch (error) {
        console.error('Error scanning Gmail:', error);
        showError('Failed to scan emails: ' + (error.message || 'Unknown error'));
    }
}

/**
 * Try to categorize an order based on sender
 */
function categorizeOrder(order) {
    const from = (order.from || '').toLowerCase();
    const merchant = (order.merchant || '').toLowerCase();

    if (from.includes('amazon') || merchant.includes('amazon')) return 'AMAZON';
    if (from.includes('paypal')) return 'PAYPAL';
    if (from.includes('bmw')) return 'BMW';
    if (from.includes('dividedwestand') || from.includes('divided')) return 'DIVIDED WE STAND';
    if (from.includes('qualitywebtime') || from.includes('qwt')) return 'QUALITY WEB TIME';
    if (from.includes('openai') || from.includes('anthropic') || from.includes('midjourney') ||
        from.includes('runway') || from.includes('cursor') || from.includes('perplexity')) return 'AI';
    if (from.includes('spotify') || from.includes('netflix') || from.includes('adobe') ||
        from.includes('apple') || from.includes('google') || from.includes('youtube')) return 'SUBSCRIPTIONS';

    return 'STORE';
}

/**
 * Search emails and parse order info
 */
async function searchAndParseEmails(category, query) {
    const orders = [];

    try {
        // Search for messages - get more results
        const response = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 100
        });

        const messages = response.result.messages || [];
        console.log(`${category}: Found ${messages.length} emails`);

        // Fetch each message
        for (const msg of messages) {
            try {
                const msgResponse = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full'
                });

                const order = parseEmailToOrder(msgResponse.result, category);
                if (order) {
                    orders.push(order);
                }
            } catch (error) {
                console.error('Error fetching message:', error);
            }
        }
    } catch (error) {
        console.error(`Error searching ${category}:`, error);
    }

    return orders;
}

/**
 * Parse email message to order object
 */
function parseEmailToOrder(message, category) {
    const headers = message.payload.headers;
    const subject = getHeader(headers, 'Subject') || 'No Subject';
    const from = getHeader(headers, 'From') || '';
    const date = getHeader(headers, 'Date') || '';

    // Skip if not an order-related email
    if (!isOrderEmail(subject, from, category)) {
        return null;
    }

    // Parse email body
    const body = getEmailBody(message.payload);

    // Extract order details
    const orderInfo = extractOrderDetails(subject, body, from, category);

    // Determine status based on keywords
    const status = determineStatus(subject, body);

    return {
        id: message.id,
        source: category,
        orderDate: new Date(date).toISOString().split('T')[0],
        items: orderInfo.items,
        totalPrice: orderInfo.price,
        status: status,
        subject: subject,
        from: extractSenderName(from),
        merchant: extractMerchant(from, category),
        trackingNumber: orderInfo.tracking,
        isSubscription: category === 'SUBSCRIPTIONS' || isSubscriptionEmail(subject, body),
        snippet: message.snippet
    };
}

/**
 * Check if email is order-related - now more permissive
 */
function isOrderEmail(subject, from, category) {
    const subjectLower = subject.toLowerCase();
    const fromLower = from.toLowerCase();

    // Strong exclude patterns - definitely not orders
    const strongExclude = [
        'password reset', 'verify your email', 'sign in alert', 'login alert',
        'security alert', 'suspicious', 'verify your account',
        'unsubscribe', 'update your preferences'
    ];

    if (strongExclude.some(pattern => subjectLower.includes(pattern))) {
        return false;
    }

    // If it came from our search query, it's probably an order
    // Be more permissive - the Gmail search already filtered
    return true;
}

/**
 * Extract order details from email body
 */
function extractOrderDetails(subject, body, from, category) {
    let price = 0;
    let items = [];
    let tracking = null;

    // Extract price - look for currency patterns
    const pricePatterns = [
        /\$\s*([\d,]+\.?\d*)/g,
        /USD\s*([\d,]+\.?\d*)/gi,
        /Total:?\s*\$?([\d,]+\.?\d*)/gi,
        /Amount:?\s*\$?([\d,]+\.?\d*)/gi,
        /Charged:?\s*\$?([\d,]+\.?\d*)/gi
    ];

    const prices = [];
    for (const pattern of pricePatterns) {
        const matches = body.matchAll(pattern);
        for (const match of matches) {
            const value = parseFloat(match[1].replace(/,/g, ''));
            if (value > 0 && value < 100000) {
                prices.push(value);
            }
        }
    }

    // Use the largest reasonable price as the total
    if (prices.length > 0) {
        price = Math.max(...prices.filter(p => p < 10000));
    }

    // Extract tracking number
    const trackingPatterns = [
        /(?:tracking|track)[:\s#]*([A-Z0-9]{10,30})/gi,
        /(?:1Z)[A-Z0-9]{16}/g,  // UPS
        /(?:94|93|92|91)\d{20,22}/g,  // USPS
        /\d{12,15}/g  // FedEx
    ];

    for (const pattern of trackingPatterns) {
        const match = body.match(pattern);
        if (match) {
            tracking = match[0].replace(/tracking[:\s#]*/i, '').trim();
            break;
        }
    }

    // Extract item name from subject or body
    let itemName = extractItemName(subject, body, category);
    items.push({
        name: itemName,
        quantity: 1,
        price: price
    });

    return { items, price, tracking };
}

/**
 * Extract item name from email
 */
function extractItemName(subject, body, category) {
    // Try to get item from subject
    let itemName = subject
        .replace(/^(re:|fwd:|fw:)\s*/gi, '')
        .replace(/order\s*(confirmation|confirmed|#?\d+)/gi, '')
        .replace(/your\s+order/gi, '')
        .replace(/has\s+shipped/gi, '')
        .replace(/is\s+arriving/gi, '')
        .replace(/receipt\s+for/gi, '')
        .trim();

    // If subject is too generic, try to extract from body
    if (itemName.length < 5 || itemName.toLowerCase().includes('amazon')) {
        // Look for item patterns in body
        const itemPatterns = [
            /(?:Item|Product|Description):\s*([^\n\r$]+)/i,
            /(?:You ordered|Ordered):\s*([^\n\r$]+)/i,
        ];

        for (const pattern of itemPatterns) {
            const match = body.match(pattern);
            if (match && match[1].length > 3) {
                itemName = match[1].trim().substring(0, 80);
                break;
            }
        }
    }

    // Fallback to category-based generic name
    if (itemName.length < 3) {
        itemName = `${category} Order`;
    }

    // Clean and truncate
    return itemName.substring(0, 100);
}

/**
 * Determine order status from email content
 */
function determineStatus(subject, body) {
    const content = (subject + ' ' + body).toLowerCase();

    if (content.includes('delivered') || content.includes('has arrived')) {
        return 'delivered';
    }
    if (content.includes('shipped') || content.includes('on its way') || content.includes('in transit')) {
        return 'shipped';
    }
    if (content.includes('subscription') || content.includes('renewal') || content.includes('monthly') || content.includes('billing')) {
        return 'subscription';
    }
    if (content.includes('processing') || content.includes('preparing')) {
        return 'processing';
    }
    return 'ordered';
}

/**
 * Check if email is subscription related
 */
function isSubscriptionEmail(subject, body) {
    const content = (subject + ' ' + body).toLowerCase();
    return content.includes('subscription') ||
           content.includes('monthly') ||
           content.includes('renewal') ||
           content.includes('recurring');
}

/**
 * Get email body text
 */
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
            // Check nested parts
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

/**
 * Decode base64 email content
 */
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

/**
 * Strip HTML tags
 */
function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
}

/**
 * Get header value
 */
function getHeader(headers, name) {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : null;
}

/**
 * Extract sender name from email address
 */
function extractSenderName(from) {
    const match = from.match(/^"?([^"<]+)"?\s*</);
    if (match) {
        return match[1].trim();
    }
    return from.split('@')[0];
}

/**
 * Extract merchant name
 */
function extractMerchant(from, category) {
    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    if (emailMatch) {
        const domain = emailMatch[1].split('@')[1];
        if (domain) {
            return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
        }
    }
    return category;
}

/**
 * Format date for Gmail query
 */
function formatDateForQuery(date) {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * Remove duplicate orders
 */
function deduplicateOrders(orders) {
    const seen = new Map();
    return orders.filter(order => {
        const key = `${order.source}-${order.orderDate}-${order.subject.substring(0, 30)}`;
        if (seen.has(key)) {
            return false;
        }
        seen.set(key, true);
        return true;
    });
}

// ============ UI Functions ============

/**
 * Create category filter buttons
 */
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

/**
 * Create status filter buttons
 */
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

/**
 * Apply filters
 */
function applyFilters() {
    filteredOrders = allOrders.filter(order => {
        const categoryMatch = activeFilter === 'ALL' || order.source === activeFilter;
        const statusMatch = activeStatusFilter === 'ALL' || order.status === activeStatusFilter;
        return categoryMatch && statusMatch;
    });

    displayOrders();
    updateSummary();
}

/**
 * Display orders
 */
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

    // Group by date
    const ordersByDate = {};
    filteredOrders.forEach(order => {
        const dateKey = order.orderDate;
        if (!ordersByDate[dateKey]) {
            ordersByDate[dateKey] = [];
        }
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

    // Add click handlers
    ordersContainer.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });
    });
}

/**
 * Format date header
 */
function formatDateHeader(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Create order card HTML
 */
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
                ${order.trackingNumber ? `<div class="tracking-info">Tracking: ${order.trackingNumber}</div>` : ''}
                ${order.snippet ? `<div class="order-snippet">${escapeHtml(order.snippet.substring(0, 200))}...</div>` : ''}
                ${order.isSubscription ? '<div class="subscription-badge">Subscription</div>' : ''}
            </div>
        </div>
    `;
}

/**
 * Get category icon
 */
function getCategoryIcon(source) {
    const icons = {
        'AMAZON': '📦',
        'PAYPAL': '💳',
        'STORE': '🛒',
        'AI': '🤖',
        'DIVIDED WE STAND': '👕',
        'BMW': '🚗',
        'QUALITY WEB TIME': '🌐',
        'SUBSCRIPTIONS': '↻',
        'OTHER': '🛍️'
    };
    return icons[source] || '📦';
}

/**
 * Update summary stats
 */
function updateSummary() {
    const totalSpent = filteredOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const pendingCount = filteredOrders.filter(o => ['ordered', 'processing', 'shipped'].includes(o.status)).length;

    totalSpentEl.textContent = `$${totalSpent.toFixed(2)}`;
    totalOrdersEl.textContent = filteredOrders.length;
    pendingOrdersEl.textContent = pendingCount;
}

/**
 * Update last updated time
 */
function updateLastUpdated() {
    const now = new Date();
    lastUpdatedEl.textContent = now.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}
