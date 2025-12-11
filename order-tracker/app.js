// Order Tracker v68 - Fixed loading issue
const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient, gapiInited = false, gisInited = false;
let pendingOrders = [];

const LABEL_NAMES = ['STORE', 'PAYPAL', 'AI', 'DIVIDED WE STAND', 'BMW', 'QUALITY-WEB-TIME'];
const DAYS_TO_SCAN = 90;

// Get dismissed orders from localStorage
function getDismissed() {
    try {
        return JSON.parse(localStorage.getItem('dismissed_orders') || '[]');
    } catch { return []; }
}

function dismissOrder(orderId) {
    const dismissed = getDismissed();
    if (!dismissed.includes(orderId)) {
        dismissed.push(orderId);
        localStorage.setItem('dismissed_orders', JSON.stringify(dismissed));
    }
    pendingOrders = pendingOrders.filter(o => o.id !== orderId);
    displayOrders();
}

// Patterns
const DELIVERED_PATTERNS = [
    /has been delivered/i, /was delivered/i, /package delivered/i,
    /successfully delivered/i, /delivery complete/i, /delivered on/i,
    /delivered to/i, /left at/i, /signed for/i, /proof of delivery/i,
    /your (package|order|item) (has |was )?(arrived|delivered)/i,
    /picked up (at|from)/i
];

const ORDER_PATTERNS = [
    /order confirm/i, /order received/i, /thanks for your order/i,
    /thank you for your (order|purchase)/i, /purchase confirm/i,
    /receipt for your/i, /order #/i, /order number/i,
    /order has been (placed|received|confirmed)/i,
    /payment (received|confirmed|complete)/i,
    /your receipt/i, /invoice/i
];

const EXCLUDE_PATTERNS = [
    /password/i, /verify your email/i, /sign.?in/i, /security alert/i,
    /newsletter/i, /unsubscribe/i, /survey/i, /feedback/i,
    /rate your/i, /sale ends/i, /% off/i, /limited time/i,
    /we miss you/i, /recommended for you/i, /account (created|updated)/i
];

// DOM
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const ordersSection = document.getElementById('ordersSection');
const errorSection = document.getElementById('errorSection');
const ordersContainer = document.getElementById('ordersContainer');
const orderCount = document.getElementById('orderCount');
const errorMessage = document.getElementById('errorMessage');

document.addEventListener('DOMContentLoaded', () => {
    console.log('Order Tracker v68');
    document.getElementById('authorizeBtn')?.addEventListener('click', handleAuthClick);
    document.getElementById('refreshBtn')?.addEventListener('click', scanEmails);
    document.getElementById('retryBtn')?.addEventListener('click', () => showSection('auth'));
});

function gapiLoaded() {
    if (typeof gapi === 'undefined') { setTimeout(gapiLoaded, 100); return; }
    gapi.load('client', async () => {
        try {
            await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
            gapiInited = true;
            console.log('GAPI ready');
            maybeStart();
        } catch (e) {
            console.error('GAPI init error:', e);
            showError('Init failed: ' + (e.message || e));
        }
    });
}

function gisLoaded() {
    if (typeof google === 'undefined') { setTimeout(gisLoaded, 100); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, callback: handleAuthCallback
    });
    gisInited = true;
    console.log('GIS ready');
    maybeStart();
}

function maybeStart() {
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
    tokenClient.requestAccessToken({ prompt: localStorage.getItem('orders_auth') ? '' : 'select_account' });
}

function handleAuthCallback(resp) {
    if (resp.error) {
        console.error('Auth error:', resp);
        showError('Auth failed: ' + resp.error);
        return;
    }
    localStorage.setItem('orders_auth', 'true');
    showSection('loading');
    scanEmails();
}

function showSection(s) {
    [authSection, loadingSection, ordersSection, errorSection].forEach(el => el?.classList.add('hidden'));
    document.getElementById(s + 'Section')?.classList.remove('hidden');
}

function showError(msg) {
    console.error('Error:', msg);
    if (errorMessage) errorMessage.textContent = msg;
    showSection('error');
}

function updateProgress(msg) {
    console.log('Progress:', msg);
    const el = document.getElementById('scanProgress');
    if (el) el.textContent = msg;
}

// ============ SCAN ============

async function scanEmails() {
    try {
        showSection('loading');
        updateProgress('Connecting...');

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - DAYS_TO_SCAN);
        const afterDate = `${cutoff.getFullYear()}/${cutoff.getMonth()+1}/${cutoff.getDate()}`;

        const allEmails = new Map();
        const dismissed = getDismissed();

        // Get labels
        updateProgress('Getting labels...');
        console.log('Fetching labels...');

        let labels = [];
        try {
            const labelsResp = await gapi.client.gmail.users.labels.list({ userId: 'me' });
            labels = labelsResp.result.labels || [];
            console.log('Found', labels.length, 'labels');
        } catch (e) {
            console.error('Label fetch failed:', e);
            // Continue without labels
        }

        // Search each label - but use message list only (faster)
        for (const labelName of LABEL_NAMES) {
            const label = labels.find(l => l.name.toUpperCase() === labelName);
            if (label) {
                updateProgress(`Scanning ${labelName}...`);
                console.log('Scanning label:', labelName);
                try {
                    const found = await fetchEmailsForLabel(labelName, afterDate);
                    console.log(`Found ${found.length} emails in ${labelName}`);
                    found.forEach(e => allEmails.set(e.id, { ...e, source: labelName }));
                } catch (e) {
                    console.error(`Error scanning ${labelName}:`, e);
                }
            }
        }

        // Search for shipping/delivery updates
        updateProgress('Scanning shipping...');
        console.log('Scanning shipping/delivery...');
        try {
            const updates = await fetchEmailsForQuery(`(shipped OR delivered) after:${afterDate}`, 100);
            console.log('Found', updates.length, 'shipping emails');
            updates.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, source: 'SEARCH' }); });
        } catch (e) {
            console.error('Shipping scan failed:', e);
        }

        updateProgress('Processing...');
        const emails = Array.from(allEmails.values());
        console.log('Total emails:', emails.length);

        // Process into pending orders
        pendingOrders = processEmails(emails, dismissed);
        console.log('Pending orders:', pendingOrders.length);

        updateProgress('Done!');
        if (orderCount) orderCount.textContent = pendingOrders.length;
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
        displayOrders();
        showSection('orders');

    } catch (e) {
        console.error('Scan failed:', e);
        showError('Failed: ' + (e.message || e));
    }
}

// Fetch emails with progress - limits individual message fetches
async function fetchEmailsForLabel(labelName, afterDate) {
    return fetchEmailsForQuery(`label:${labelName} after:${afterDate}`, 150);
}

async function fetchEmailsForQuery(query, maxEmails = 100) {
    const emails = [];

    try {
        // Get message IDs first (fast)
        const listResp = await gapi.client.gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: maxEmails
        });

        const messageIds = (listResp.result.messages || []).map(m => m.id);
        console.log(`Query returned ${messageIds.length} message IDs`);

        // Fetch each message (slower but necessary for content)
        let fetched = 0;
        for (const id of messageIds) {
            try {
                const msg = await gapi.client.gmail.users.messages.get({
                    userId: 'me',
                    id: id,
                    format: 'full'
                });
                emails.push(msg.result);
                fetched++;

                // Update progress every 10 messages
                if (fetched % 10 === 0) {
                    updateProgress(`Fetching... ${fetched}/${messageIds.length}`);
                }
            } catch (e) {
                console.log('Failed to fetch message', id);
            }
        }
    } catch (e) {
        console.error('Query failed:', query, e);
    }

    return emails;
}

// ============ PROCESS ============

function processEmails(rawEmails, dismissed) {
    const parsed = [];
    for (const email of rawEmails) {
        const p = parseEmail(email);
        if (p) parsed.push(p);
    }

    const orderEmails = parsed.filter(e => e.isOrder);
    const updateEmails = parsed.filter(e => e.isShipping || e.isDelivered);

    console.log(`Parsed: ${orderEmails.length} orders, ${updateEmails.length} updates`);

    const orders = [];
    const usedIds = new Set();

    for (const email of orderEmails) {
        if (usedIds.has(email.id)) continue;
        if (dismissed.includes(email.id)) continue;

        usedIds.add(email.id);
        orders.push({
            id: email.id,
            item: email.item,
            merchant: email.merchant,
            amount: email.amount,
            orderDate: email.date,
            orderNumber: email.orderNumber,
            shipDate: null,
            tracking: null,
            delivered: false,
            source: email.source
        });
    }

    // Match updates to orders
    for (const update of updateEmails) {
        const order = findOrderMatch(update, orders);
        if (order) {
            if (update.isDelivered) order.delivered = true;
            if (update.isShipping && !order.shipDate) order.shipDate = update.date;
            if (update.tracking && !order.tracking) order.tracking = update.tracking;
        }
    }

    // Auto-mark old orders as delivered
    const now = Date.now();
    for (const order of orders) {
        if (order.delivered) continue;
        const age = (now - order.orderDate) / (1000 * 60 * 60 * 24);
        if (order.shipDate) {
            const shipAge = (now - order.shipDate) / (1000 * 60 * 60 * 24);
            if (shipAge > 7) order.delivered = true;
        } else if (age > 10) {
            order.delivered = true;
        }
    }

    const pending = orders.filter(o => !o.delivered);
    pending.sort((a, b) => b.orderDate - a.orderDate);

    return pending;
}

function parseEmail(msg) {
    const headers = msg.payload?.headers || [];
    const subject = getHeader(headers, 'Subject') || '';
    const from = getHeader(headers, 'From') || '';
    const dateStr = getHeader(headers, 'Date') || '';
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) return null;
    if (EXCLUDE_PATTERNS.some(p => p.test(subject))) return null;

    const body = getBody(msg.payload);
    const text = subject + ' ' + body;

    const isFromCarrier = /(ups|usps|fedex|dhl)[\.\@]/i.test(from);
    const isDelivered = DELIVERED_PATTERNS.some(p => p.test(text));
    const isShipping = /shipped|tracking|in transit|out for delivery/i.test(text);
    const isOrder = !isFromCarrier && ORDER_PATTERNS.some(p => p.test(text));

    if (!isOrder && !isShipping && !isDelivered) return null;

    return {
        id: msg.id,
        isOrder,
        isShipping,
        isDelivered,
        subject,
        from,
        date,
        item: extractItem(subject),
        merchant: extractMerchant(from),
        amount: extractAmount(text),
        orderNumber: extractOrderNumber(text),
        tracking: extractTracking(text),
        source: msg.source
    };
}

function findOrderMatch(update, orders) {
    if (update.orderNumber) {
        const m = orders.find(o => o.orderNumber === update.orderNumber);
        if (m) return m;
    }
    if (update.tracking) {
        const m = orders.find(o => o.tracking === update.tracking);
        if (m) return m;
    }
    if (update.merchant && update.merchant !== 'Unknown') {
        const m = orders.find(o => {
            if (!merchantMatch(o.merchant, update.merchant)) return false;
            const days = (update.date - o.orderDate) / (1000 * 60 * 60 * 24);
            return days >= -1 && days <= 14;
        });
        if (m) return m;
    }
    return null;
}

function merchantMatch(m1, m2) {
    if (!m1 || !m2) return false;
    const n1 = m1.toLowerCase().replace(/[^a-z]/g, '');
    const n2 = m2.toLowerCase().replace(/[^a-z]/g, '');
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

// ============ EXTRACTION ============

function extractItem(subject) {
    let item = subject
        .replace(/^(re:|fwd?:)\s*/gi, '')
        .replace(/order\s*(confirm|#\w+)/gi, '')
        .replace(/your\s+(order|purchase|receipt)/gi, '')
        .replace(/thank you for/gi, '')
        .replace(/has (shipped|been delivered)/gi, '')
        .trim();
    return item.length > 60 ? item.substring(0, 57) + '...' : item || 'Order';
}

function extractMerchant(from) {
    if (/(ups|usps|fedex|dhl)/i.test(from)) return 'Unknown';
    const domain = from.match(/@([^.>]+)/);
    if (domain && !['gmail', 'yahoo', 'outlook'].includes(domain[1].toLowerCase())) {
        return domain[1].charAt(0).toUpperCase() + domain[1].slice(1);
    }
    const name = from.match(/^"?([^"<]+)"?\s*</);
    if (name) return name[1].trim();
    return 'Unknown';
}

function extractAmount(text) {
    const matches = text.match(/\$[\d,]+\.\d{2}/g) || [];
    const amounts = matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(a => a > 1 && a < 50000);
    return amounts.length ? Math.max(...amounts) : 0;
}

function extractOrderNumber(text) {
    const amazon = text.match(/(\d{3}-\d{7}-\d{7})/);
    if (amazon) return amazon[1];
    const order = text.match(/order\s*#?\s*:?\s*([A-Z0-9-]{6,20})/i);
    if (order) return order[1];
    return null;
}

function extractTracking(text) {
    const ups = text.match(/\b1Z[A-Z0-9]{16}\b/i);
    if (ups) return ups[0];
    const usps = text.match(/\b9[1-4]\d{18,22}\b/);
    if (usps) return usps[0];
    return null;
}

function getHeader(headers, name) {
    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function getBody(payload) {
    let body = '';
    if (payload.body?.data) body += decode64(payload.body.data);
    if (payload.parts) {
        for (const p of payload.parts) {
            if (p.mimeType === 'text/plain' && p.body?.data) body += decode64(p.body.data);
            if (p.parts) {
                for (const sp of p.parts) {
                    if (sp.mimeType === 'text/plain' && sp.body?.data) body += decode64(sp.body.data);
                }
            }
        }
    }
    return body.substring(0, 5000);
}

function decode64(data) {
    try {
        return decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));
    } catch { return ''; }
}

// ============ DISPLAY ============

function displayOrders() {
    if (!ordersContainer) return;

    if (!pendingOrders.length) {
        ordersContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <p>All caught up! No pending orders.</p>
            </div>`;
        return;
    }

    let html = '';
    for (const o of pendingOrders) {
        const price = o.amount > 0 ? `$${o.amount.toFixed(2)}` : '';
        const eta = o.shipDate ? calcETA(o.shipDate) : null;

        html += `
            <div class="order-card" data-id="${o.id}">
                <div class="order-header">
                    <div class="order-item">${esc(o.item)}</div>
                    <button class="dismiss-btn" onclick="event.stopPropagation(); dismissOrder('${o.id}')">✓ Received</button>
                </div>
                <div class="order-details">
                    <div class="detail"><span class="label">From:</span> ${esc(o.merchant)}</div>
                    ${price ? `<div class="detail"><span class="label">Amount:</span> ${price}</div>` : ''}
                    <div class="detail"><span class="label">Ordered:</span> ${formatDate(o.orderDate)}</div>
                    ${o.shipDate ? `<div class="detail"><span class="label">Shipped:</span> ${formatDate(o.shipDate)}</div>` : '<div class="detail"><span class="label">Status:</span> Awaiting shipment</div>'}
                    ${o.tracking ? `<div class="detail"><span class="label">Tracking:</span> ${o.tracking}</div>` : ''}
                    ${eta ? `<div class="detail"><span class="label">ETA:</span> ${eta}</div>` : ''}
                    ${o.orderNumber ? `<div class="detail"><span class="label">Order #:</span> ${o.orderNumber}</div>` : ''}
                </div>
            </div>`;
    }

    ordersContainer.innerHTML = html;
}

function calcETA(shipDate) {
    const eta = new Date(shipDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    if (eta < new Date()) return 'Any day now';
    return formatDate(eta);
}

function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function esc(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
}

window.dismissOrder = dismissOrder;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
