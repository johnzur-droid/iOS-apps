// Order Tracker v70 - Better item extraction from order emails
const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient, gapiInited = false, gisInited = false;
let pendingOrders = [];

// Only check these two labels
const LABEL_NAMES = ['STORE', 'PAYPAL'];
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
    if (document.getElementById('orderCount')) {
        document.getElementById('orderCount').textContent = pendingOrders.length;
    }
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
    /your receipt/i
];

const EXCLUDE_PATTERNS = [
    /password/i, /verify your email/i, /sign.?in/i, /security alert/i,
    /newsletter/i, /unsubscribe/i, /survey/i, /feedback/i,
    /rate your/i, /sale ends/i, /% off/i, /limited time/i,
    /we miss you/i, /recommended for you/i, /account (created|updated)/i,
    /tracking update/i, /your package is/i  // These are updates, not orders
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
    console.log('Order Tracker v70 - Better item extraction');
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
        let labels = [];
        try {
            const labelsResp = await gapi.client.gmail.users.labels.list({ userId: 'me' });
            labels = labelsResp.result.labels || [];
            console.log('Found', labels.length, 'labels');
        } catch (e) {
            console.error('Label fetch failed:', e);
        }

        // Search STORE and PAYPAL labels only
        for (const labelName of LABEL_NAMES) {
            const label = labels.find(l => l.name.toUpperCase() === labelName);
            if (label) {
                updateProgress(`Scanning ${labelName}...`);
                console.log('Scanning label:', labelName);
                try {
                    const found = await fetchEmailsForQuery(`label:${labelName} after:${afterDate}`, 200);
                    console.log(`Found ${found.length} emails in ${labelName}`);
                    found.forEach(e => allEmails.set(e.id, { ...e, source: labelName }));
                } catch (e) {
                    console.error(`Error scanning ${labelName}:`, e);
                }
            }
        }

        // Search for delivery confirmations to mark orders as delivered
        updateProgress('Checking deliveries...');
        try {
            const deliveries = await fetchEmailsForQuery(`(delivered OR "has been delivered") after:${afterDate}`, 100);
            console.log('Found', deliveries.length, 'delivery emails');
            deliveries.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, source: 'DELIVERY' }); });
        } catch (e) {
            console.error('Delivery scan failed:', e);
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

async function fetchEmailsForQuery(query, maxEmails = 100) {
    const emails = [];
    try {
        const listResp = await gapi.client.gmail.users.messages.list({
            userId: 'me', q: query, maxResults: maxEmails
        });
        const messageIds = (listResp.result.messages || []).map(m => m.id);
        console.log(`Query returned ${messageIds.length} message IDs`);

        let fetched = 0;
        for (const id of messageIds) {
            try {
                const msg = await gapi.client.gmail.users.messages.get({
                    userId: 'me', id: id, format: 'full'
                });
                emails.push(msg.result);
                fetched++;
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

// ============ PROCESS - CONSOLIDATE EMAILS INTO ORDERS ============

function processEmails(rawEmails, dismissed) {
    // Step 1: Parse all emails
    const parsed = [];
    for (const email of rawEmails) {
        const p = parseEmail(email);
        if (p) parsed.push(p);
    }
    console.log(`Parsed ${parsed.length} relevant emails`);

    // Step 2: Group emails into orders
    // Key insight: consolidate by order number, or by amount+merchant+date
    const orderGroups = [];

    for (const email of parsed) {
        // Skip if this is ONLY a shipping/delivery update with no order info
        if (!email.isOrder && !email.amount && !email.orderNumber) {
            // This is just a tracking update - try to match to existing order
            const matchedGroup = findMatchingGroup(email, orderGroups);
            if (matchedGroup) {
                matchedGroup.emails.push(email);
            }
            continue;
        }

        // Try to find existing group for this email
        let foundGroup = null;

        // Match by order number
        if (email.orderNumber) {
            foundGroup = orderGroups.find(g =>
                g.emails.some(e => e.orderNumber && e.orderNumber === email.orderNumber)
            );
        }

        // Match by amount + merchant + date (within 3 days)
        if (!foundGroup && email.amount > 0 && email.merchant !== 'Unknown') {
            foundGroup = orderGroups.find(g => {
                return g.emails.some(e => {
                    if (!e.amount || e.merchant === 'Unknown') return false;
                    const amountMatch = Math.abs(e.amount - email.amount) < 1.00;
                    const merchantMatch = isSameMerchant(e.merchant, email.merchant);
                    const dateMatch = Math.abs(e.date - email.date) < 3 * 24 * 60 * 60 * 1000;
                    return amountMatch && merchantMatch && dateMatch;
                });
            });
        }

        if (foundGroup) {
            foundGroup.emails.push(email);
        } else {
            // Create new order group
            orderGroups.push({ emails: [email] });
        }
    }

    console.log(`Grouped into ${orderGroups.length} orders`);

    // Step 3: Convert groups to order objects
    const orders = [];
    for (const group of orderGroups) {
        const order = createOrderFromGroup(group.emails);
        if (order && !dismissed.includes(order.id)) {
            orders.push(order);
        }
    }

    // Step 4: Filter to pending only
    const pending = orders.filter(o => !o.delivered);
    pending.sort((a, b) => b.orderDate - a.orderDate);

    console.log(`Final: ${pending.length} pending orders`);
    return pending;
}

function findMatchingGroup(email, groups) {
    // Try to match by tracking number
    if (email.tracking) {
        const match = groups.find(g => g.emails.some(e => e.tracking === email.tracking));
        if (match) return match;
    }
    // Try to match by merchant within date window
    if (email.merchant && email.merchant !== 'Unknown') {
        const match = groups.find(g => {
            return g.emails.some(e => {
                if (!isSameMerchant(e.merchant, email.merchant)) return false;
                const days = (email.date - e.date) / (1000 * 60 * 60 * 24);
                return days >= -1 && days <= 14;
            });
        });
        if (match) return match;
    }
    return null;
}

function createOrderFromGroup(emails) {
    if (!emails.length) return null;

    // Sort chronologically - oldest first
    emails.sort((a, b) => a.date - b.date);

    // Prioritize order confirmation emails (these have product names)
    const orderEmails = emails.filter(e => e.isOrder);
    const shippingEmails = emails.filter(e => e.isShipping);
    const deliveryEmails = emails.filter(e => e.isDelivered);

    // The base email should be the order confirmation if available
    const orderEmail = orderEmails[0] || emails[0];
    const deliveryEmail = deliveryEmails[0];
    const shippingEmail = shippingEmails[0];

    // Get amount (highest value, likely the total)
    const amounts = emails.map(e => e.amount).filter(a => a > 0);
    const amount = amounts.length ? Math.max(...amounts) : 0;

    // Get merchant (prefer non-Unknown, non-PayPal for actual merchant)
    let merchant = 'Unknown';
    for (const e of emails) {
        if (e.merchant && e.merchant !== 'Unknown' && e.merchant.toLowerCase() !== 'paypal') {
            merchant = e.merchant;
            break;
        }
    }
    if (merchant === 'Unknown') {
        merchant = emails.find(e => e.merchant && e.merchant !== 'Unknown')?.merchant || 'Unknown';
    }

    // Get order number and tracking
    const orderNumber = emails.find(e => e.orderNumber)?.orderNumber;
    const tracking = emails.find(e => e.tracking)?.tracking;

    // Get best item description - PRIORITIZE ORDER EMAILS
    let item = null;

    // First try: look for good item in order confirmation emails
    for (const e of orderEmails) {
        if (e.item && e.item !== 'Order' && e.item.length > 5) {
            item = e.item;
            break;
        }
    }

    // Second try: re-extract from order email bodies (they have product names)
    if (!item) {
        for (const e of orderEmails) {
            if (e.body) {
                const extracted = extractItem(e.subject, e.body);
                if (extracted && extracted !== 'Order' && extracted.length > 5) {
                    item = extracted;
                    break;
                }
            }
        }
    }

    // Third try: check shipping emails (often have "Your shipment of [product]")
    if (!item) {
        for (const e of shippingEmails) {
            if (e.item && e.item !== 'Order' && e.item.length > 5) {
                item = e.item;
                break;
            }
        }
    }

    // Fourth try: any email with a good item name
    if (!item) {
        const goodItem = emails.find(e => e.item && e.item !== 'Order' && e.item.length > 5);
        if (goodItem) item = goodItem.item;
    }

    // Final fallback
    if (!item) item = orderEmail.item || 'Order';

    // Determine status
    let delivered = false;
    let shipDate = shippingEmail?.date;
    let deliveryDate = deliveryEmail?.date;

    if (deliveryEmail) {
        delivered = true;
    } else {
        // Auto-mark as delivered based on age
        const now = Date.now();
        if (shipDate) {
            const shipAge = (now - shipDate) / (1000 * 60 * 60 * 24);
            if (shipAge > 7) delivered = true;
        } else {
            const orderAge = (now - orderEmail.date) / (1000 * 60 * 60 * 24);
            if (orderAge > 10) delivered = true;
        }
    }

    return {
        id: orderEmail.id,
        item,
        merchant,
        amount,
        orderDate: orderEmail.date,
        orderNumber,
        shipDate,
        deliveryDate,
        tracking,
        delivered,
        source: orderEmail.source,
        emailCount: emails.length
    };
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

    // Determine email type
    const isFromCarrier = /(ups|usps|fedex|dhl)[\.\@]/i.test(from);
    const isDelivered = DELIVERED_PATTERNS.some(p => p.test(text));
    const isShipping = !isDelivered && /shipped|tracking|in transit|out for delivery/i.test(text);
    const isOrder = !isFromCarrier && ORDER_PATTERNS.some(p => p.test(text));

    // Must be relevant
    if (!isOrder && !isShipping && !isDelivered) return null;

    return {
        id: msg.id,
        isOrder,
        isShipping,
        isDelivered,
        subject,
        from,
        date,
        body: body.substring(0, 2000),  // Save body for item extraction
        item: extractItem(subject, body),
        merchant: extractMerchant(from, subject),
        amount: extractAmount(text),
        orderNumber: extractOrderNumber(text),
        tracking: extractTracking(text),
        source: msg.source
    };
}

function isSameMerchant(m1, m2) {
    if (!m1 || !m2 || m1 === 'Unknown' || m2 === 'Unknown') return false;
    const n1 = m1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n2 = m2.toLowerCase().replace(/[^a-z0-9]/g, '');
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

// ============ EXTRACTION ============

function extractItem(subject, body = '') {
    let match;

    // Amazon: "Your Amazon.com order of [product]..."
    match = subject.match(/order\s+of\s+(.{3,60}?)(?:\s+has|\s+and|\s*\.\.\.|$)/i);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // Quoted product name: "Your order: 'Product Name'"
    match = subject.match(/['""']([^'""']{3,50})['""']/);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // "Your shipment of [product]" or "Your package of [product]"
    match = subject.match(/(?:shipment|package)\s+of\s+(.{3,50}?)(?:\s+has|\s+is|\.\.\.|$)/i);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // "Item: [product]" in subject
    match = subject.match(/item[:\s]+(.{3,50}?)(?:\s+has|\s+from|\.\.\.|$)/i);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // Check body for product names
    if (body && body.length > 10) {
        // Look for "Items Ordered: [product]" in body (Amazon)
        match = body.match(/Items?\s+Ordered:?\s*\n?\s*(.{3,80})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // "Product: [name]" or "Item: [name]"
        match = body.match(/(?:product|item)\s*:\s*([^\n\r]{3,60})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // "Order Details: [product]"
        match = body.match(/order\s+details?\s*:?\s*\n?\s*([^\n\r]{3,60})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }
    }

    // Fall back: clean up subject by removing common phrases
    let item = subject
        .replace(/^(re:|fwd?:)\s*/gi, '')
        .replace(/order\s*(confirm|#[\w-]+)/gi, '')
        .replace(/your\s+(order|purchase|receipt|payment)/gi, '')
        .replace(/thank you for/gi, '')
        .replace(/has (shipped|been delivered)/gi, '')
        .replace(/payment\s+(sent|received|confirmed)/gi, '')
        .replace(/receipt\s+(for|from)/gi, '')
        .replace(/confirmation\s+(for|from)/gi, '')
        .trim();

    // Remove leading punctuation
    item = item.replace(/^[\s\-:•|]+/, '').trim();

    if (item.length > 60) item = item.substring(0, 57) + '...';
    return item.length > 2 ? item : 'Order';
}

function cleanItem(text) {
    if (!text) return null;
    let item = text.trim()
        .replace(/^[\s\-:•'"]+/, '')
        .replace(/[\s\-:•'"]+$/, '')
        .replace(/^\d+\s*x\s*/i, '')  // Remove quantity prefix like "1 x "
        .replace(/\s+/g, ' ');  // Normalize whitespace

    // Skip if it's just generic words
    if (/^(order|item|product|your|the|a|an|purchase)$/i.test(item)) return null;

    if (item.length > 60) item = item.substring(0, 57) + '...';
    return item.length > 3 ? item : null;
}

function extractMerchant(from, subject) {
    // Skip carriers
    if (/(ups|usps|fedex|dhl)/i.test(from)) return 'Unknown';

    // Try to get domain from email
    const domainMatch = from.match(/@([^.>]+)/);
    if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        // Skip bad domains
        if (['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email', 'e', 't', 'i', 'a'].includes(domain)) {
            // Fall through to name extraction
        } else if (domain.length > 1) {
            return domain.charAt(0).toUpperCase() + domain.slice(1);
        }
    }

    // Try display name
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) {
        let name = nameMatch[1].trim();
        // Skip bad names
        if (name.length > 2 && !['mail', 'no-reply', 'noreply', 'info', 'support'].includes(name.toLowerCase())) {
            // Limit length
            if (name.length > 30) name = name.substring(0, 30);
            return name;
        }
    }

    // Try to find merchant in subject
    const subjectMatch = subject.match(/from\s+([A-Za-z][A-Za-z0-9\s&'-]{2,20}?)(?:\s+|$|\.)/i);
    if (subjectMatch) {
        return subjectMatch[1].trim();
    }

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
    const order = text.match(/order\s*#?\s*:?\s*([A-Z0-9][A-Z0-9-]{5,19})/i);
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
        const status = o.shipDate ? 'Shipped' : 'Awaiting shipment';

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
                    <div class="detail"><span class="label">Status:</span> ${status}</div>
                    ${o.shipDate ? `<div class="detail"><span class="label">Shipped:</span> ${formatDate(o.shipDate)}</div>` : ''}
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
