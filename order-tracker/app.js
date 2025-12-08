// Order Tracker v63 - Smart Order Correlation
// Correlates emails from stores, PayPal, and shippers into unified orders

const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Configuration
let selectedDays = 90;
const LABEL_NAMES = ['STORE', 'PAYPAL', 'AI', 'DIVIDED WE STAND', 'BMW', 'QUALITY-WEB-TIME'];

// Shipping carriers for tracking
const CARRIERS = {
    'ups': { pattern: /\b1Z[A-Z0-9]{16}\b/i, name: 'UPS' },
    'usps': { pattern: /\b(94|93|92|94|95)[0-9]{20}\b/, name: 'USPS' },
    'fedex': { pattern: /\b[0-9]{12,22}\b/, name: 'FedEx' }
};

// Keywords to identify order-related emails
const ORDER_KEYWORDS = [
    'order confirm', 'order received', 'order placed', 'thank you for your order',
    'purchase confirm', 'receipt for your', 'payment confirm', 'transaction',
    'your order', 'order #', 'order number', 'invoice'
];

const SHIPPING_KEYWORDS = [
    'shipped', 'shipping confirm', 'on its way', 'in transit', 'out for delivery',
    'tracking number', 'track your', 'shipment', 'delivery'
];

const DELIVERY_KEYWORDS = [
    'delivered', 'has been delivered', 'was delivered', 'left at', 'signed for'
];

// Keywords to EXCLUDE - not orders
const EXCLUDE_KEYWORDS = [
    'password reset', 'verify your email', 'sign in', 'security alert',
    'update from', 'newsletter', 'weekly digest', 'unsubscribe',
    'account update', 'privacy policy', 'terms of service',
    'survey', 'feedback', 'how was your', 'rate your'
];

// State
let allOrders = [];
let filteredOrders = [];
let currentFilter = 'pending';

// DOM Elements
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const ordersSection = document.getElementById('ordersSection');
const errorSection = document.getElementById('errorSection');
const ordersContainer = document.getElementById('ordersContainer');
const errorMessage = document.getElementById('errorMessage');
const authorizeBtn = document.getElementById('authorizeBtn');
const refreshBtn = document.getElementById('refreshBtn');
const retryBtn = document.getElementById('retryBtn');
const scanProgressEl = document.getElementById('scanProgress');
const loadingNoteEl = document.getElementById('loadingNote');
const filterLabel = document.getElementById('filterLabel');
const clearFilterBtn = document.getElementById('clearFilter');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Order Tracker v63 loaded');
    setupEventListeners();
});

function setupEventListeners() {
    if (authorizeBtn) authorizeBtn.addEventListener('click', handleAuthClick);
    if (refreshBtn) refreshBtn.addEventListener('click', () => scanEmails());
    if (retryBtn) retryBtn.addEventListener('click', () => showSection('auth'));
    if (clearFilterBtn) clearFilterBtn.addEventListener('click', () => setFilter('all'));

    // Time selector buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDays = parseInt(btn.dataset.days);
            if (gapi.client.getToken()) {
                scanEmails();
            }
        });
    });

    // Summary card clicks
    document.querySelectorAll('.summary-card').forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filter;
            setFilter(filter);
        });
    });
}

function gapiLoaded() {
    if (typeof gapi === 'undefined') {
        setTimeout(gapiLoaded, 1000);
        return;
    }
    gapi.load('client', async () => {
        try {
            await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
            gapiInited = true;
            maybeEnableButtons();
        } catch (error) {
            console.error('GAPI init error:', error);
            showError('Failed to initialize: ' + (error.message || JSON.stringify(error)));
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
            callback: handleAuthCallback
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
            scanEmails();
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
    const hasAuth = localStorage.getItem('orders_authorized');
    tokenClient.requestAccessToken({ prompt: hasAuth ? '' : 'select_account' });
}

function handleAuthCallback(resp) {
    if (resp.error) {
        showError('Auth failed: ' + resp.error);
        return;
    }
    localStorage.setItem('orders_authorized', 'true');
    showSection('loading');
    scanEmails();
}

function showSection(section) {
    [authSection, loadingSection, ordersSection, errorSection].forEach(s => s?.classList.add('hidden'));
    switch (section) {
        case 'auth': authSection?.classList.remove('hidden'); break;
        case 'loading': loadingSection?.classList.remove('hidden'); break;
        case 'orders': ordersSection?.classList.remove('hidden'); break;
        case 'error': errorSection?.classList.remove('hidden'); break;
    }
}

function showError(message) {
    if (errorMessage) errorMessage.textContent = message;
    showSection('error');
}

function updateProgress(message, note = '') {
    if (scanProgressEl) scanProgressEl.textContent = message;
    if (loadingNoteEl) loadingNoteEl.textContent = note;
}

// ============ MAIN SCAN & CORRELATION ============

async function scanEmails() {
    try {
        showSection('loading');
        updateProgress('Connecting to Gmail...', '');

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - selectedDays);
        const afterDate = cutoffDate.toISOString().split('T')[0].replace(/-/g, '/');

        // Collect all raw emails
        const rawEmails = [];

        // Search labels
        updateProgress('Fetching labels...', '');
        const labelsResp = await gapi.client.gmail.users.labels.list({ userId: 'me' });
        const allLabels = labelsResp.result.labels || [];

        for (const labelName of LABEL_NAMES) {
            const label = allLabels.find(l => l.name.toUpperCase() === labelName.toUpperCase());
            if (label) {
                updateProgress(`Scanning ${labelName}...`, `Found label`);
                const emails = await fetchEmailsWithQuery(`label:${labelName} after:${afterDate}`);
                rawEmails.push(...emails.map(e => ({ ...e, source: labelName })));
            }
        }

        // Search for Amazon orders
        updateProgress('Scanning Amazon...', '');
        const amazonEmails = await fetchEmailsWithQuery(`from:amazon after:${afterDate}`);
        rawEmails.push(...amazonEmails.map(e => ({ ...e, source: 'AMAZON' })));

        // Search for shipping notifications
        updateProgress('Scanning shipping updates...', '');
        const shippingEmails = await fetchEmailsWithQuery(
            `(from:ups OR from:usps OR from:fedex OR subject:shipped OR subject:tracking) after:${afterDate}`
        );
        rawEmails.push(...shippingEmails.map(e => ({ ...e, source: 'SHIPPING' })));

        updateProgress('Processing emails...', `${rawEmails.length} emails found`);

        // Parse all emails
        const parsedEmails = rawEmails.map(parseEmail).filter(e => e !== null);

        updateProgress('Correlating orders...', `${parsedEmails.length} relevant emails`);

        // Correlate into orders
        allOrders = correlateOrders(parsedEmails);

        updateProgress('Finalizing...', `${allOrders.length} orders found`);

        // Update UI
        updateSummary();
        setFilter('pending');
        updateLastUpdated();
        showSection('orders');

    } catch (error) {
        console.error('Scan error:', error);
        showError('Failed: ' + (error.message || 'Unknown error'));
    }
}

async function fetchEmailsWithQuery(query) {
    const emails = [];
    let pageToken = null;

    do {
        const params = { userId: 'me', q: query, maxResults: 100 };
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
    } while (pageToken && emails.length < 500); // Cap at 500 emails

    return emails;
}

function parseEmail(message) {
    const headers = message.payload?.headers || [];
    const subject = getHeader(headers, 'Subject') || '';
    const from = getHeader(headers, 'From') || '';
    const date = getHeader(headers, 'Date') || '';
    const body = getEmailBody(message.payload);
    const fullText = (subject + ' ' + body).toLowerCase();

    // Skip excluded emails
    if (EXCLUDE_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()))) {
        return null;
    }

    // Determine email type
    let type = 'unknown';
    if (DELIVERY_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()))) {
        type = 'delivery';
    } else if (SHIPPING_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()))) {
        type = 'shipping';
    } else if (ORDER_KEYWORDS.some(kw => fullText.includes(kw.toLowerCase()))) {
        type = 'order';
    } else if (from.toLowerCase().includes('paypal')) {
        type = 'payment';
    } else {
        // Not order-related
        return null;
    }

    // Extract data
    const amount = extractAmount(body);
    const orderNumber = extractOrderNumber(subject + ' ' + body);
    const trackingInfo = extractTracking(body);
    const merchant = extractMerchant(from, subject, body);

    return {
        id: message.id,
        type,
        source: message.source,
        subject,
        from,
        date: new Date(date),
        amount,
        orderNumber,
        tracking: trackingInfo,
        merchant,
        snippet: message.snippet,
        body: body.substring(0, 2000) // Limit body size
    };
}

function correlateOrders(emails) {
    const orders = [];
    const used = new Set();

    // Sort by date (oldest first for correlation)
    emails.sort((a, b) => a.date - b.date);

    // First pass: Group by order number
    const byOrderNumber = {};
    emails.forEach(email => {
        if (email.orderNumber && email.orderNumber.length > 3) {
            if (!byOrderNumber[email.orderNumber]) {
                byOrderNumber[email.orderNumber] = [];
            }
            byOrderNumber[email.orderNumber].push(email);
        }
    });

    // Create orders from order number groups
    for (const [orderNum, emailGroup] of Object.entries(byOrderNumber)) {
        if (emailGroup.length > 0) {
            const order = createOrderFromEmails(emailGroup, orderNum);
            orders.push(order);
            emailGroup.forEach(e => used.add(e.id));
        }
    }

    // Second pass: Match remaining by amount + merchant + date proximity
    const remaining = emails.filter(e => !used.has(e.id));

    for (const email of remaining) {
        if (used.has(email.id)) continue;
        if (email.type === 'order' || email.type === 'payment') {
            // Find related emails
            const related = [email];
            used.add(email.id);

            // Look for shipping/delivery emails with similar merchant or tracking
            for (const other of remaining) {
                if (used.has(other.id)) continue;
                if (isRelated(email, other)) {
                    related.push(other);
                    used.add(other.id);
                }
            }

            const order = createOrderFromEmails(related);
            orders.push(order);
        }
    }

    // Third pass: Standalone shipping/delivery (no matching order)
    for (const email of remaining) {
        if (used.has(email.id)) continue;
        if (email.type === 'shipping' || email.type === 'delivery') {
            const order = createOrderFromEmails([email]);
            orders.push(order);
            used.add(email.id);
        }
    }

    // Sort by date (newest first)
    orders.sort((a, b) => b.orderDate - a.orderDate);

    return orders;
}

function isRelated(email1, email2) {
    // Same merchant
    if (email1.merchant && email2.merchant &&
        email1.merchant.toLowerCase() === email2.merchant.toLowerCase()) {
        // Within 14 days
        const daysDiff = Math.abs(email1.date - email2.date) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 14) return true;
    }

    // Similar amount (within $1)
    if (email1.amount > 0 && email2.amount > 0) {
        if (Math.abs(email1.amount - email2.amount) < 1) {
            const daysDiff = Math.abs(email1.date - email2.date) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 7) return true;
        }
    }

    return false;
}

function createOrderFromEmails(emails, orderNumber = null) {
    // Sort by date
    emails.sort((a, b) => a.date - b.date);

    const orderEmail = emails.find(e => e.type === 'order') || emails[0];
    const paymentEmail = emails.find(e => e.type === 'payment');
    const shippingEmail = emails.find(e => e.type === 'shipping');
    const deliveryEmail = emails.find(e => e.type === 'delivery');

    // Determine status
    let status = 'ordered';
    if (deliveryEmail) {
        status = 'delivered';
    } else if (shippingEmail) {
        status = 'shipped';
    }

    // Get best amount
    const amount = orderEmail?.amount || paymentEmail?.amount || shippingEmail?.amount || 0;

    // Get tracking
    const tracking = shippingEmail?.tracking || deliveryEmail?.tracking || null;

    // Get merchant
    const merchant = orderEmail?.merchant || paymentEmail?.merchant ||
                     shippingEmail?.merchant || 'Unknown';

    // Payment method
    const paymentMethod = paymentEmail ? 'PayPal' : (orderEmail?.source === 'PAYPAL' ? 'PayPal' : 'Direct');

    return {
        id: orderEmail?.id || emails[0].id,
        orderNumber: orderNumber || orderEmail?.orderNumber || null,
        merchant,
        amount,
        paymentMethod,
        status,
        orderDate: orderEmail?.date || emails[0].date,
        shipDate: shippingEmail?.date || null,
        deliveryDate: deliveryEmail?.date || null,
        tracking,
        itemName: cleanSubject(orderEmail?.subject || emails[0].subject),
        emails: emails.map(e => ({
            type: e.type,
            date: e.date,
            subject: e.subject,
            snippet: e.snippet
        })),
        source: orderEmail?.source || emails[0].source
    };
}

// ============ EXTRACTION HELPERS ============

function extractAmount(text) {
    const patterns = [
        /(?:total|amount|charge|paid|price)[:\s]*\$?([\d,]+\.?\d*)/gi,
        /\$\s*([\d,]+\.\d{2})/g
    ];

    let amounts = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const amt = parseFloat(match[1].replace(/,/g, ''));
            if (amt > 0 && amt < 50000) {
                amounts.push(amt);
            }
        }
    }

    // Return the largest reasonable amount (likely the total)
    return amounts.length > 0 ? Math.max(...amounts) : 0;
}

function extractOrderNumber(text) {
    const patterns = [
        /order\s*(?:#|number|num|no\.?)?[:\s]*([A-Z0-9-]{5,20})/gi,
        /(?:#|number|no\.?)[:\s]*([A-Z0-9-]{5,20})/gi,
        /([0-9]{3}-[0-9]{7}-[0-9]{7})/g // Amazon format
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) return match[1];
    }
    return null;
}

function extractTracking(text) {
    for (const [carrier, config] of Object.entries(CARRIERS)) {
        const match = config.pattern.exec(text);
        if (match) {
            return {
                carrier: config.name,
                number: match[0]
            };
        }
    }
    return null;
}

function extractMerchant(from, subject, body) {
    // Try to get from email domain
    const emailMatch = from.match(/@([^.>]+)/);
    if (emailMatch) {
        const domain = emailMatch[1].toLowerCase();
        // Common mappings
        const mappings = {
            'amazon': 'Amazon',
            'paypal': 'PayPal',
            'apple': 'Apple',
            'google': 'Google',
            'microsoft': 'Microsoft',
            'bestbuy': 'Best Buy',
            'walmart': 'Walmart',
            'target': 'Target',
            'ebay': 'eBay',
            'etsy': 'Etsy',
            'nike': 'Nike',
            'adidas': 'Adidas'
        };

        for (const [key, value] of Object.entries(mappings)) {
            if (domain.includes(key)) return value;
        }

        // Capitalize first letter
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    }

    // Try to get from "From" name
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) return nameMatch[1].trim();

    return 'Unknown';
}

function cleanSubject(subject) {
    return subject
        .replace(/^(re:|fwd:|fw:)\s*/gi, '')
        .replace(/order\s*(confirmation|confirmed|#[A-Z0-9-]+)/gi, '')
        .replace(/your\s+(order|purchase|receipt)/gi, '')
        .replace(/thank\s+you\s+for\s+your\s+(order|purchase)/gi, '')
        .replace(/^\s*[-:]\s*/, '')
        .trim()
        .substring(0, 80) || 'Order';
}

function getHeader(headers, name) {
    const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return h ? h.value : null;
}

function getEmailBody(payload) {
    let body = '';
    if (payload.body?.data) {
        body = decodeBase64(payload.body.data);
    } else if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                body = decodeBase64(part.body.data);
                break;
            }
            if (part.parts) {
                for (const subpart of part.parts) {
                    if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
                        body = decodeBase64(subpart.body.data);
                        break;
                    }
                }
            }
        }
        if (!body) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/html' && part.body?.data) {
                    body = stripHtml(decodeBase64(part.body.data));
                    break;
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

// ============ UI FUNCTIONS ============

function setFilter(filter) {
    currentFilter = filter;

    // Update card highlighting
    document.querySelectorAll('.summary-card').forEach(card => {
        card.classList.toggle('active', card.dataset.filter === filter);
    });

    // Update filter label
    const labels = {
        'all': 'All Orders',
        'pending': 'In Transit',
        'delivered': 'Delivered'
    };
    if (filterLabel) filterLabel.textContent = 'Showing: ' + (labels[filter] || 'All');

    // Show/hide clear button
    if (clearFilterBtn) {
        clearFilterBtn.classList.toggle('hidden', filter === 'all');
    }

    // Filter and display
    if (filter === 'all') {
        filteredOrders = [...allOrders];
    } else if (filter === 'pending') {
        filteredOrders = allOrders.filter(o => o.status !== 'delivered');
    } else if (filter === 'delivered') {
        filteredOrders = allOrders.filter(o => o.status === 'delivered');
    }

    displayOrders();
}

function updateSummary() {
    const totalSpent = allOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const delivered = allOrders.filter(o => o.status === 'delivered').length;
    const pending = allOrders.filter(o => o.status !== 'delivered').length;

    document.getElementById('totalSpent').textContent = '$' + totalSpent.toFixed(2);
    document.getElementById('totalOrders').textContent = allOrders.length;
    document.getElementById('deliveredCount').textContent = delivered;
    document.getElementById('pendingCount').textContent = pending;
}

function displayOrders() {
    if (!ordersContainer) return;

    if (filteredOrders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="no-orders">
                <div class="no-orders-icon">${currentFilter === 'pending' ? '✓' : '📦'}</div>
                <p>${currentFilter === 'pending' ? 'No pending orders!' : 'No orders found'}</p>
            </div>
        `;
        return;
    }

    // Group by date
    const ordersByDate = {};
    filteredOrders.forEach(order => {
        const dateKey = order.orderDate.toISOString().split('T')[0];
        if (!ordersByDate[dateKey]) ordersByDate[dateKey] = [];
        ordersByDate[dateKey].push(order);
    });

    let html = '';
    Object.keys(ordersByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(dateKey => {
        const orders = ordersByDate[dateKey];
        html += `
            <div class="date-group">
                <div class="date-header">${formatDateHeader(dateKey)}</div>
                ${orders.map(order => createOrderCard(order)).join('')}
            </div>
        `;
    });

    ordersContainer.innerHTML = html;

    // Add click handlers for expansion
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
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function createOrderCard(order) {
    const statusColors = {
        'delivered': '#4CAF50',
        'shipped': '#2196F3',
        'ordered': '#FF9800'
    };
    const statusIcons = {
        'delivered': '✓',
        'shipped': '📦',
        'ordered': '○'
    };

    const statusColor = statusColors[order.status] || '#999';
    const statusIcon = statusIcons[order.status] || '○';
    const price = order.amount > 0 ? `$${order.amount.toFixed(2)}` : '';

    // Build tracking info for pending orders
    let trackingHtml = '';
    if (order.status !== 'delivered' && order.tracking) {
        trackingHtml = `
            <div class="tracking-info">
                <span class="tracking-carrier">${order.tracking.carrier}</span>
                <span class="tracking-number">${order.tracking.number}</span>
            </div>
        `;
    }

    // Build timeline
    let timelineHtml = '<div class="order-timeline">';
    if (order.orderDate) {
        timelineHtml += `<div class="timeline-item">📋 Ordered: ${formatDate(order.orderDate)}</div>`;
    }
    if (order.paymentMethod) {
        timelineHtml += `<div class="timeline-item">💳 Paid via ${order.paymentMethod}</div>`;
    }
    if (order.shipDate) {
        timelineHtml += `<div class="timeline-item">📦 Shipped: ${formatDate(order.shipDate)}</div>`;
    }
    if (order.deliveryDate) {
        timelineHtml += `<div class="timeline-item">✓ Delivered: ${formatDate(order.deliveryDate)}</div>`;
    }
    timelineHtml += '</div>';

    return `
        <div class="order-card" data-status="${order.status}">
            <div class="order-main">
                <div class="order-status-icon" style="background-color: ${statusColor}">
                    ${statusIcon}
                </div>
                <div class="order-info">
                    <div class="order-title">${escapeHtml(order.itemName)}</div>
                    <div class="order-meta">
                        <span class="order-merchant">${escapeHtml(order.merchant)}</span>
                        ${price ? `<span class="order-price">${price}</span>` : ''}
                    </div>
                </div>
                <div class="order-status-label" style="color: ${statusColor}">
                    ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </div>
            </div>
            ${trackingHtml}
            <div class="order-details">
                ${timelineHtml}
                ${order.orderNumber ? `<div class="order-number">Order #${order.orderNumber}</div>` : ''}
                ${order.emails.length > 1 ? `<div class="email-count">${order.emails.length} related emails</div>` : ''}
            </div>
        </div>
    `;
}

function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
}

function updateLastUpdated() {
    const el = document.getElementById('lastUpdated');
    if (el) {
        el.textContent = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW failed:', err));
    });
}
