// Order Tracker v64 - Improved Status Detection & Correlation
const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient, gapiInited = false, gisInited = false;
let selectedDays = 90;
let allOrders = [], filteredOrders = [], currentFilter = 'pending';

const LABEL_NAMES = ['STORE', 'PAYPAL', 'AI', 'DIVIDED WE STAND', 'BMW', 'QUALITY-WEB-TIME'];

// More comprehensive delivery detection
const DELIVERED_PATTERNS = [
    /delivered/i, /has been delivered/i, /was delivered/i,
    /left at/i, /signed for/i, /picked up/i,
    /delivery complete/i, /successfully delivered/i,
    /your package arrived/i, /your order arrived/i,
    /out for delivery.*delivered/i, /dropped off/i
];

const SHIPPED_PATTERNS = [
    /has shipped/i, /has been shipped/i, /your order shipped/i,
    /shipment.*on the way/i, /on its way/i, /in transit/i,
    /tracking number/i, /track your package/i, /track your order/i,
    /shipping confirmation/i, /out for delivery/i
];

const ORDER_PATTERNS = [
    /order confirm/i, /order received/i, /thanks for your order/i,
    /thank you for your order/i, /purchase confirm/i,
    /receipt for your/i, /your order #/i, /order number/i,
    /we received your order/i, /order has been placed/i
];

// Exclude these - NOT orders
const EXCLUDE_PATTERNS = [
    /password reset/i, /verify your email/i, /sign.?in/i,
    /security alert/i, /update from/i, /newsletter/i,
    /weekly digest/i, /unsubscribe/i, /privacy policy/i,
    /terms of service/i, /survey/i, /feedback/i,
    /how was your/i, /rate your/i, /leave.*(review|feedback)/i,
    /your opinion/i, /we miss you/i, /come back/i,
    /sale ends/i, /% off/i, /limited time/i, /deal of/i,
    /don't miss/i, /last chance/i, /flash sale/i
];

// DOM
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

document.addEventListener('DOMContentLoaded', () => {
    console.log('Order Tracker v64');
    setupEventListeners();
});

function setupEventListeners() {
    authorizeBtn?.addEventListener('click', handleAuthClick);
    refreshBtn?.addEventListener('click', () => scanEmails());
    retryBtn?.addEventListener('click', () => showSection('auth'));
    clearFilterBtn?.addEventListener('click', () => setFilter('all'));

    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedDays = parseInt(btn.dataset.days);
            if (gapi?.client?.getToken()) scanEmails();
        });
    });

    document.querySelectorAll('.summary-card').forEach(card => {
        card.addEventListener('click', () => setFilter(card.dataset.filter));
    });
}

function gapiLoaded() {
    if (typeof gapi === 'undefined') { setTimeout(gapiLoaded, 1000); return; }
    gapi.load('client', async () => {
        try {
            await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
            gapiInited = true;
            maybeEnableButtons();
        } catch (e) {
            showError('Init failed: ' + (e.message || JSON.stringify(e)));
        }
    });
}

function gisLoaded() {
    if (typeof google === 'undefined') { setTimeout(gisLoaded, 1000); return; }
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID, scope: SCOPES, callback: handleAuthCallback
        });
        gisInited = true;
        maybeEnableButtons();
    } catch (e) {
        showError('Auth init failed');
    }
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        if (gapi.client.getToken()) {
            showSection('loading');
            scanEmails();
        } else {
            showSection('auth');
        }
    }
}

function handleAuthClick() {
    if (!tokenClient) { showError('Not ready'); return; }
    tokenClient.requestAccessToken({ prompt: localStorage.getItem('orders_auth') ? '' : 'select_account' });
}

function handleAuthCallback(resp) {
    if (resp.error) { showError('Auth failed: ' + resp.error); return; }
    localStorage.setItem('orders_auth', 'true');
    showSection('loading');
    scanEmails();
}

function showSection(s) {
    [authSection, loadingSection, ordersSection, errorSection].forEach(el => el?.classList.add('hidden'));
    document.getElementById(s + 'Section')?.classList.remove('hidden');
}

function showError(msg) {
    if (errorMessage) errorMessage.textContent = msg;
    showSection('error');
}

function updateProgress(msg, note = '') {
    if (scanProgressEl) scanProgressEl.textContent = msg;
    if (loadingNoteEl) loadingNoteEl.textContent = note;
}

// ============ MAIN SCAN ============

async function scanEmails() {
    try {
        showSection('loading');
        updateProgress('Connecting...', '');

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - selectedDays);
        const afterDate = `${cutoff.getFullYear()}/${cutoff.getMonth()+1}/${cutoff.getDate()}`;

        const emails = [];

        // Get labels
        updateProgress('Getting labels...', '');
        const labelsResp = await gapi.client.gmail.users.labels.list({ userId: 'me' });
        const labels = labelsResp.result.labels || [];

        // Search each label
        for (const labelName of LABEL_NAMES) {
            const label = labels.find(l => l.name.toUpperCase() === labelName);
            if (label) {
                updateProgress(`Scanning ${labelName}...`, '');
                const found = await searchEmails(`label:${labelName} after:${afterDate}`);
                emails.push(...found.map(e => ({ ...e, labelSource: labelName })));
            }
        }

        // Amazon
        updateProgress('Scanning Amazon...', '');
        const amazon = await searchEmails(`from:amazon after:${afterDate}`);
        emails.push(...amazon.map(e => ({ ...e, labelSource: 'AMAZON' })));

        // Shipping carriers
        updateProgress('Scanning shipping...', '');
        const shipping = await searchEmails(
            `(from:ups.com OR from:usps.com OR from:fedex.com OR from:dhl.com) after:${afterDate}`
        );
        emails.push(...shipping.map(e => ({ ...e, labelSource: 'SHIPPING' })));

        updateProgress('Processing...', `${emails.length} emails`);

        // Process into orders
        allOrders = processEmails(emails);

        updateProgress('Done!', `${allOrders.length} orders`);
        updateSummary();
        setFilter('pending');
        document.getElementById('lastUpdated').textContent = new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        showSection('orders');

    } catch (e) {
        console.error(e);
        showError('Failed: ' + (e.message || 'Unknown'));
    }
}

async function searchEmails(query) {
    const emails = [];
    let pageToken = null;

    do {
        const params = { userId: 'me', q: query, maxResults: 100 };
        if (pageToken) params.pageToken = pageToken;

        const resp = await gapi.client.gmail.users.messages.list(params);
        const msgs = resp.result.messages || [];

        for (const m of msgs) {
            try {
                const full = await gapi.client.gmail.users.messages.get({
                    userId: 'me', id: m.id, format: 'full'
                });
                emails.push(full.result);
            } catch (e) { }
        }
        pageToken = resp.result.nextPageToken;
    } while (pageToken && emails.length < 300);

    return emails;
}

// ============ PROCESS EMAILS INTO ORDERS ============

function processEmails(rawEmails) {
    const validEmails = [];

    // First pass: parse and filter
    for (const email of rawEmails) {
        const parsed = parseEmail(email);
        if (parsed) validEmails.push(parsed);
    }

    console.log(`Parsed ${validEmails.length} valid emails from ${rawEmails.length} total`);

    // Group by potential order identifiers
    const orderGroups = new Map();

    for (const email of validEmails) {
        // Try to find existing group
        let foundGroup = null;

        // Match by order number
        if (email.orderNumber) {
            for (const [key, group] of orderGroups) {
                if (group.some(e => e.orderNumber === email.orderNumber)) {
                    foundGroup = key;
                    break;
                }
            }
        }

        // Match by tracking number
        if (!foundGroup && email.trackingNumber) {
            for (const [key, group] of orderGroups) {
                if (group.some(e => e.trackingNumber === email.trackingNumber)) {
                    foundGroup = key;
                    break;
                }
            }
        }

        // Match by amount + merchant + date
        if (!foundGroup && email.amount > 0) {
            for (const [key, group] of orderGroups) {
                const match = group.find(e =>
                    e.amount > 0 &&
                    Math.abs(e.amount - email.amount) < 0.50 &&
                    similarMerchant(e.merchant, email.merchant) &&
                    Math.abs(e.date - email.date) < 7 * 24 * 60 * 60 * 1000
                );
                if (match) {
                    foundGroup = key;
                    break;
                }
            }
        }

        if (foundGroup) {
            orderGroups.get(foundGroup).push(email);
        } else {
            orderGroups.set(email.id, [email]);
        }
    }

    // Convert groups to orders
    const orders = [];
    for (const [id, emails] of orderGroups) {
        const order = createOrder(emails);
        if (order) orders.push(order);
    }

    // Sort newest first
    orders.sort((a, b) => b.date - a.date);

    console.log(`Created ${orders.length} orders`);
    return orders;
}

function parseEmail(msg) {
    const headers = msg.payload?.headers || [];
    const subject = getHeader(headers, 'Subject') || '';
    const from = getHeader(headers, 'From') || '';
    const dateStr = getHeader(headers, 'Date') || '';
    const date = new Date(dateStr);

    const body = getBody(msg.payload);
    const fullText = subject + ' ' + body;

    // Check exclusions FIRST
    if (EXCLUDE_PATTERNS.some(p => p.test(fullText))) {
        return null;
    }

    // Must match at least one order/shipping/delivery pattern
    const isOrder = ORDER_PATTERNS.some(p => p.test(fullText));
    const isShipping = SHIPPED_PATTERNS.some(p => p.test(fullText));
    const isDelivered = DELIVERED_PATTERNS.some(p => p.test(fullText));
    const isPayPal = /paypal/i.test(from) && /payment|receipt|transaction/i.test(fullText);

    if (!isOrder && !isShipping && !isDelivered && !isPayPal) {
        return null;
    }

    // Determine type
    let type = 'order';
    if (isDelivered) type = 'delivered';
    else if (isShipping) type = 'shipping';
    else if (isPayPal) type = 'payment';

    return {
        id: msg.id,
        type,
        subject,
        from,
        date,
        snippet: msg.snippet,
        merchant: extractMerchant(from),
        amount: extractAmount(fullText),
        orderNumber: extractOrderNumber(fullText),
        trackingNumber: extractTracking(fullText),
        labelSource: msg.labelSource
    };
}

function createOrder(emails) {
    if (!emails.length) return null;

    // Sort chronologically
    emails.sort((a, b) => a.date - b.date);

    // Find key emails
    const orderEmail = emails.find(e => e.type === 'order') || emails.find(e => e.type === 'payment');
    const shippingEmail = emails.find(e => e.type === 'shipping');
    const deliveredEmail = emails.find(e => e.type === 'delivered');

    // DETERMINE STATUS - this is critical
    let status = 'ordered';

    // Check if ANY email indicates delivery
    if (emails.some(e => e.type === 'delivered')) {
        status = 'delivered';
    }
    // Check if shipped but not delivered
    else if (emails.some(e => e.type === 'shipping')) {
        status = 'shipped';

        // If shipped more than 10 days ago, assume delivered
        const shipDate = shippingEmail?.date;
        if (shipDate && (Date.now() - shipDate) > 10 * 24 * 60 * 60 * 1000) {
            status = 'delivered';
        }
    }
    // If order is old (more than 14 days), assume delivered
    else if (orderEmail) {
        const orderAge = Date.now() - orderEmail.date;
        if (orderAge > 14 * 24 * 60 * 60 * 1000) {
            status = 'delivered';
        }
    }

    // Get best values
    const primaryEmail = orderEmail || emails[0];
    const amount = emails.reduce((max, e) => Math.max(max, e.amount || 0), 0);
    const tracking = shippingEmail?.trackingNumber || deliveredEmail?.trackingNumber;
    const orderNum = emails.find(e => e.orderNumber)?.orderNumber;

    return {
        id: primaryEmail.id,
        merchant: primaryEmail.merchant || 'Unknown',
        item: cleanSubject(primaryEmail.subject),
        amount,
        status,
        date: primaryEmail.date,
        shipDate: shippingEmail?.date,
        deliveryDate: deliveredEmail?.date,
        tracking,
        orderNumber: orderNum,
        source: primaryEmail.labelSource,
        emailCount: emails.length,
        paymentMethod: emails.some(e => e.type === 'payment') ? 'PayPal' : 'Direct'
    };
}

function similarMerchant(m1, m2) {
    if (!m1 || !m2) return false;
    const n1 = m1.toLowerCase().replace(/[^a-z]/g, '');
    const n2 = m2.toLowerCase().replace(/[^a-z]/g, '');
    return n1.includes(n2) || n2.includes(n1) || n1 === n2;
}

// ============ EXTRACTION ============

function extractMerchant(from) {
    // Try email domain
    const domainMatch = from.match(/@([^.>]+)/);
    if (domainMatch) {
        const d = domainMatch[1].toLowerCase();
        const map = {
            'amazon': 'Amazon', 'paypal': 'PayPal', 'apple': 'Apple',
            'google': 'Google', 'bestbuy': 'Best Buy', 'walmart': 'Walmart',
            'target': 'Target', 'ebay': 'eBay', 'etsy': 'Etsy',
            'ups': 'UPS', 'usps': 'USPS', 'fedex': 'FedEx'
        };
        for (const [k, v] of Object.entries(map)) {
            if (d.includes(k)) return v;
        }
        return d.charAt(0).toUpperCase() + d.slice(1);
    }
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) return nameMatch[1].trim();
    return 'Unknown';
}

function extractAmount(text) {
    const matches = text.match(/\$\s*([\d,]+\.\d{2})/g) || [];
    const amounts = matches
        .map(m => parseFloat(m.replace(/[$,]/g, '')))
        .filter(a => a > 0 && a < 10000);
    return amounts.length ? Math.max(...amounts) : 0;
}

function extractOrderNumber(text) {
    const patterns = [
        /order\s*#?\s*[:.]?\s*([A-Z0-9-]{6,20})/i,
        /([0-9]{3}-[0-9]{7}-[0-9]{7})/  // Amazon
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1];
    }
    return null;
}

function extractTracking(text) {
    // UPS
    const ups = text.match(/\b1Z[A-Z0-9]{16}\b/i);
    if (ups) return ups[0];
    // USPS
    const usps = text.match(/\b(94|93|92)[0-9]{18,20}\b/);
    if (usps) return usps[0];
    // FedEx
    const fedex = text.match(/\b[0-9]{12,15}\b/);
    if (fedex) return fedex[0];
    return null;
}

function cleanSubject(subj) {
    return subj
        .replace(/^(re:|fwd?:)\s*/gi, '')
        .replace(/order\s*(confirm|#[A-Z0-9-]+)/gi, '')
        .replace(/your\s+(order|purchase|receipt)/gi, '')
        .replace(/thank\s+you\s+for/gi, '')
        .trim().substring(0, 60) || 'Order';
}

function getHeader(headers, name) {
    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function getBody(payload) {
    if (payload.body?.data) return decode64(payload.body.data);
    if (payload.parts) {
        for (const p of payload.parts) {
            if (p.mimeType === 'text/plain' && p.body?.data) return decode64(p.body.data);
            if (p.parts) {
                for (const sp of p.parts) {
                    if (sp.mimeType === 'text/plain' && sp.body?.data) return decode64(sp.body.data);
                }
            }
        }
    }
    return '';
}

function decode64(data) {
    try {
        return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));
    } catch {
        try { return atob(data.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; }
    }
}

// ============ UI ============

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.summary-card').forEach(c => c.classList.toggle('active', c.dataset.filter === f));

    const labels = { 'all': 'All Orders', 'pending': 'In Transit', 'delivered': 'Delivered' };
    if (filterLabel) filterLabel.textContent = 'Showing: ' + labels[f];
    clearFilterBtn?.classList.toggle('hidden', f === 'all');

    filteredOrders = f === 'all' ? [...allOrders] :
        f === 'pending' ? allOrders.filter(o => o.status !== 'delivered') :
        allOrders.filter(o => o.status === 'delivered');

    displayOrders();
}

function updateSummary() {
    const spent = allOrders.reduce((s, o) => s + (o.amount || 0), 0);
    const delivered = allOrders.filter(o => o.status === 'delivered').length;
    const pending = allOrders.filter(o => o.status !== 'delivered').length;

    document.getElementById('totalSpent').textContent = '$' + spent.toFixed(2);
    document.getElementById('totalOrders').textContent = allOrders.length;
    document.getElementById('deliveredCount').textContent = delivered;
    document.getElementById('pendingCount').textContent = pending;
}

function displayOrders() {
    if (!ordersContainer) return;

    if (!filteredOrders.length) {
        ordersContainer.innerHTML = `
            <div class="no-orders">
                <div class="no-orders-icon">${currentFilter === 'pending' ? '✓' : '📦'}</div>
                <p>${currentFilter === 'pending' ? 'No pending orders!' : 'No orders found'}</p>
            </div>`;
        return;
    }

    // Group by date
    const byDate = {};
    filteredOrders.forEach(o => {
        const key = o.date.toISOString().split('T')[0];
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(o);
    });

    let html = '';
    Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach(key => {
        const orders = byDate[key];
        const dateLabel = formatDateHeader(key);
        html += `<div class="date-group"><div class="date-header">${dateLabel}</div>`;
        html += orders.map(o => orderCard(o)).join('');
        html += '</div>';
    });

    ordersContainer.innerHTML = html;
    ordersContainer.querySelectorAll('.order-card').forEach(c => {
        c.addEventListener('click', () => c.classList.toggle('expanded'));
    });
}

function formatDateHeader(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date().toISOString().split('T')[0];
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'Today';
    if (dateStr === yest) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function orderCard(o) {
    const colors = { delivered: '#4CAF50', shipped: '#2196F3', ordered: '#FF9800' };
    const icons = { delivered: '✓', shipped: '📦', ordered: '○' };
    const color = colors[o.status] || '#999';
    const icon = icons[o.status] || '○';
    const price = o.amount > 0 ? `$${o.amount.toFixed(2)}` : '';

    let trackingHtml = '';
    if (o.status !== 'delivered' && o.tracking) {
        trackingHtml = `<div class="tracking-info"><span class="tracking-number">${o.tracking}</span></div>`;
    }

    return `
        <div class="order-card" data-status="${o.status}">
            <div class="order-main">
                <div class="order-status-icon" style="background:${color}">${icon}</div>
                <div class="order-info">
                    <div class="order-title">${esc(o.item)}</div>
                    <div class="order-meta">
                        <span class="order-merchant">${esc(o.merchant)}</span>
                        ${price ? `<span class="order-price">${price}</span>` : ''}
                    </div>
                </div>
                <div class="order-status-label" style="color:${color}">${o.status.charAt(0).toUpperCase() + o.status.slice(1)}</div>
            </div>
            ${trackingHtml}
            <div class="order-details">
                <div class="timeline-item">📋 ${fmtDate(o.date)}</div>
                ${o.shipDate ? `<div class="timeline-item">📦 Shipped ${fmtDate(o.shipDate)}</div>` : ''}
                ${o.deliveryDate ? `<div class="timeline-item">✓ Delivered ${fmtDate(o.deliveryDate)}</div>` : ''}
                ${o.orderNumber ? `<div class="order-number">Order #${o.orderNumber}</div>` : ''}
                <div class="email-count">${o.emailCount} email${o.emailCount > 1 ? 's' : ''} • ${o.paymentMethod}</div>
            </div>
        </div>`;
}

function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
