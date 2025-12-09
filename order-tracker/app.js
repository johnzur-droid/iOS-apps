// Order Tracker v65 - Accurate Status Detection & Better Correlation
const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient, gapiInited = false, gisInited = false;
let selectedDays = 90;
let allOrders = [], filteredOrders = [], currentFilter = 'pending';

const LABEL_NAMES = ['STORE', 'PAYPAL', 'AI', 'DIVIDED WE STAND', 'BMW', 'QUALITY-WEB-TIME'];

// CARRIER-SPECIFIC delivery confirmations - these are DEFINITIVE
const CARRIER_DELIVERED = [
    /usps.*delivered/i, /ups.*delivered/i, /fedex.*delivered/i, /dhl.*delivered/i,
    /your (usps|ups|fedex|dhl) package (has been |was )?delivered/i,
    /delivered by (usps|ups|fedex|dhl)/i,
    /carrier.*delivered/i
];

// General delivery patterns
const DELIVERED_PATTERNS = [
    /has been delivered/i, /was delivered/i, /package delivered/i,
    /successfully delivered/i, /delivery complete/i, /delivered on/i,
    /delivered to/i, /left at (front|back|side|door|porch|mailbox)/i,
    /signed for by/i, /signature obtained/i, /proof of delivery/i,
    /your (package|order|item|shipment) (has |was )?(arrived|delivered)/i,
    /marked as delivered/i, /confirmed delivery/i,
    /picked up (at|from) (locker|location|store)/i,
    /available for pickup.*picked up/i,
    /item delivered/i, /parcel delivered/i
];

// Shipping patterns - NOT delivered yet
const SHIPPED_PATTERNS = [
    /has shipped/i, /has been shipped/i, /your order shipped/i,
    /shipment (is )?on the way/i, /on its way/i, /in transit/i,
    /shipping confirmation/i, /out for delivery/i,
    /expected delivery/i, /estimated delivery/i,
    /arriving (today|tomorrow|soon)/i, /scheduled for delivery/i
];

// Order confirmation patterns
const ORDER_PATTERNS = [
    /order confirm/i, /order received/i, /thanks for your order/i,
    /thank you for your (order|purchase)/i, /purchase confirm/i,
    /receipt for your/i, /order #/i, /order number/i,
    /order has been (placed|received)/i, /payment (received|confirmed|complete)/i,
    /invoice/i, /your receipt/i, /transaction complete/i
];

// EXCLUDE these - definitely NOT orders
const EXCLUDE_PATTERNS = [
    /password reset/i, /reset your password/i, /verify your email/i,
    /sign.?in attempt/i, /security alert/i, /suspicious activity/i,
    /newsletter/i, /weekly digest/i, /daily digest/i,
    /unsubscribe/i, /manage preferences/i, /email preferences/i,
    /privacy policy/i, /terms of service/i, /policy update/i,
    /survey/i, /feedback request/i, /how was your experience/i,
    /rate your (purchase|experience|order)/i, /leave.*(review|feedback)/i,
    /your opinion matters/i, /we miss you/i, /come back/i,
    /sale (ends|starts)/i, /\d+% off/i, /limited time/i, /deal of the day/i,
    /don't miss out/i, /last chance/i, /flash sale/i, /clearance/i,
    /wishlist/i, /back in stock/i, /price drop/i,
    /cart reminder/i, /forgot something/i, /still interested/i,
    /recommended for you/i, /you may also like/i,
    /account (created|updated|verified)/i, /welcome to/i,
    /subscription (renewed|started|cancelled)/i
];

// DOM elements
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
    console.log('Order Tracker v65 - Accurate Status Detection');
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
    if (typeof gapi === 'undefined') { setTimeout(gapiLoaded, 100); return; }
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
    if (typeof google === 'undefined') { setTimeout(gisLoaded, 100); return; }
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

        const allEmails = new Map(); // Use Map to dedupe by ID

        // Get labels
        updateProgress('Getting labels...', '');
        const labelsResp = await gapi.client.gmail.users.labels.list({ userId: 'me' });
        const labels = labelsResp.result.labels || [];

        // Search each label
        for (const labelName of LABEL_NAMES) {
            const label = labels.find(l => l.name.toUpperCase() === labelName);
            if (label) {
                updateProgress(`Scanning ${labelName}...`, '');
                const found = await searchEmails(`label:${labelName} after:${afterDate}`, 500);
                found.forEach(e => allEmails.set(e.id, { ...e, labelSource: labelName }));
            }
        }

        // Amazon orders
        updateProgress('Scanning Amazon...', '');
        const amazon = await searchEmails(`from:amazon after:${afterDate}`, 200);
        amazon.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, labelSource: 'AMAZON' }); });

        // Shipping carriers - CRITICAL for delivery status
        updateProgress('Scanning USPS...', '');
        const usps = await searchEmails(`from:usps.com after:${afterDate}`, 100);
        usps.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, labelSource: 'USPS' }); });

        updateProgress('Scanning UPS...', '');
        const ups = await searchEmails(`from:ups.com after:${afterDate}`, 100);
        ups.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, labelSource: 'UPS' }); });

        updateProgress('Scanning FedEx...', '');
        const fedex = await searchEmails(`from:fedex.com after:${afterDate}`, 100);
        fedex.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, labelSource: 'FEDEX' }); });

        // Generic delivery confirmations
        updateProgress('Scanning delivery confirmations...', '');
        const delivered = await searchEmails(`(delivered OR "has been delivered" OR "was delivered") after:${afterDate}`, 200);
        delivered.forEach(e => { if (!allEmails.has(e.id)) allEmails.set(e.id, { ...e, labelSource: 'DELIVERY' }); });

        const emails = Array.from(allEmails.values());
        updateProgress('Processing...', `${emails.length} emails found`);

        // Process into orders
        allOrders = processEmails(emails);

        updateProgress('Done!', `${allOrders.length} orders found`);
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

async function searchEmails(query, maxEmails = 200) {
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
            } catch (e) { console.log('Failed to get message', m.id); }
        }
        pageToken = resp.result.nextPageToken;
    } while (pageToken && emails.length < maxEmails);

    return emails;
}

// ============ PROCESS EMAILS INTO ORDERS ============

function processEmails(rawEmails) {
    const validEmails = [];

    // First pass: parse and categorize each email
    for (const email of rawEmails) {
        const parsed = parseEmail(email);
        if (parsed) validEmails.push(parsed);
    }

    console.log(`Parsed ${validEmails.length} valid emails from ${rawEmails.length} total`);

    // Group emails into orders by correlation
    const orderGroups = correlateEmails(validEmails);

    // Convert groups to orders
    const orders = [];
    for (const emails of orderGroups.values()) {
        const order = createOrder(emails);
        if (order) orders.push(order);
    }

    // Sort by date (newest first)
    orders.sort((a, b) => b.date - a.date);

    console.log(`Created ${orders.length} orders from ${validEmails.length} emails`);
    return orders;
}

function parseEmail(msg) {
    const headers = msg.payload?.headers || [];
    const subject = getHeader(headers, 'Subject') || '';
    const from = getHeader(headers, 'From') || '';
    const dateStr = getHeader(headers, 'Date') || '';
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) return null;

    const body = getBody(msg.payload);
    const fullText = subject + ' ' + body;

    // Check exclusions FIRST - skip junk
    if (EXCLUDE_PATTERNS.some(p => p.test(subject))) {
        return null;
    }

    // Determine email type - check CARRIER DELIVERY first (most reliable)
    let type = null;
    let isCarrierDelivery = CARRIER_DELIVERED.some(p => p.test(fullText));
    let isDelivered = isCarrierDelivery || DELIVERED_PATTERNS.some(p => p.test(fullText));
    let isShipping = SHIPPED_PATTERNS.some(p => p.test(fullText));
    let isOrder = ORDER_PATTERNS.some(p => p.test(fullText));
    let isPayPal = /paypal/i.test(from) && /payment|receipt|transaction|sent|received/i.test(subject);

    // If it's a carrier email, check if it's delivery or shipping
    const isCarrierEmail = /(usps|ups|fedex|dhl)/i.test(from);
    if (isCarrierEmail) {
        if (isDelivered) {
            type = 'delivered';
        } else if (isShipping || /track|shipment|package|delivery/i.test(subject)) {
            type = 'shipping';
        }
    }

    // Set type based on patterns
    if (!type) {
        if (isDelivered) type = 'delivered';
        else if (isShipping) type = 'shipping';
        else if (isOrder) type = 'order';
        else if (isPayPal) type = 'payment';
    }

    // Skip if no relevant type found
    if (!type) return null;

    const merchant = extractMerchant(from, subject);
    const amount = extractAmount(fullText);
    const orderNumber = extractOrderNumber(fullText);
    const trackingNumber = extractTracking(fullText);
    const itemDescription = extractItem(subject, body);

    return {
        id: msg.id,
        type,
        isCarrierDelivery,
        subject,
        from,
        date,
        snippet: msg.snippet || '',
        merchant,
        amount,
        orderNumber,
        trackingNumber,
        itemDescription,
        labelSource: msg.labelSource
    };
}

function correlateEmails(emails) {
    const groups = new Map();

    for (const email of emails) {
        let foundGroup = null;

        // 1. Match by order number (strongest correlation)
        if (email.orderNumber) {
            for (const [key, group] of groups) {
                if (group.some(e => e.orderNumber && e.orderNumber === email.orderNumber)) {
                    foundGroup = key;
                    break;
                }
            }
        }

        // 2. Match by tracking number
        if (!foundGroup && email.trackingNumber) {
            for (const [key, group] of groups) {
                if (group.some(e => e.trackingNumber && e.trackingNumber === email.trackingNumber)) {
                    foundGroup = key;
                    break;
                }
            }
        }

        // 3. Match by amount + merchant within time window (looser correlation)
        if (!foundGroup && email.amount > 0 && email.merchant) {
            for (const [key, group] of groups) {
                const match = group.find(e =>
                    e.amount > 0 &&
                    Math.abs(e.amount - email.amount) < 1.00 &&
                    merchantMatch(e.merchant, email.merchant) &&
                    Math.abs(e.date - email.date) < 10 * 24 * 60 * 60 * 1000 // 10 days
                );
                if (match) {
                    foundGroup = key;
                    break;
                }
            }
        }

        if (foundGroup) {
            groups.get(foundGroup).push(email);
        } else {
            // Start new group
            groups.set(email.id, [email]);
        }
    }

    return groups;
}

function createOrder(emails) {
    if (!emails.length) return null;

    // Sort chronologically
    emails.sort((a, b) => a.date - b.date);

    // Find key emails by type
    const orderEmail = emails.find(e => e.type === 'order');
    const paymentEmail = emails.find(e => e.type === 'payment');
    const shippingEmail = emails.find(e => e.type === 'shipping');
    const deliveredEmail = emails.find(e => e.type === 'delivered');
    const carrierDeliveryEmail = emails.find(e => e.isCarrierDelivery);

    // DETERMINE STATUS - Priority: carrier delivery > any delivery > shipped > ordered
    let status = 'ordered';

    // If we have a carrier delivery confirmation, it's DEFINITELY delivered
    if (carrierDeliveryEmail) {
        status = 'delivered';
    }
    // If any email says delivered
    else if (deliveredEmail) {
        status = 'delivered';
    }
    // If shipped
    else if (shippingEmail) {
        status = 'shipped';
        // If shipped more than 7 days ago, assume delivered
        const daysSinceShip = (Date.now() - shippingEmail.date) / (24 * 60 * 60 * 1000);
        if (daysSinceShip > 7) {
            status = 'delivered';
        }
    }
    // If just ordered (no shipping info)
    else {
        const primaryEmail = orderEmail || paymentEmail || emails[0];
        const daysSinceOrder = (Date.now() - primaryEmail.date) / (24 * 60 * 60 * 1000);
        // If order is more than 10 days old and no updates, assume delivered
        if (daysSinceOrder > 10) {
            status = 'delivered';
        }
    }

    // Get best values from all emails
    const primaryEmail = orderEmail || paymentEmail || emails[0];

    // Find the best amount (highest non-zero)
    const amounts = emails.map(e => e.amount).filter(a => a > 0);
    const amount = amounts.length ? Math.max(...amounts) : 0;

    // Find tracking and order numbers
    const tracking = emails.find(e => e.trackingNumber)?.trackingNumber;
    const orderNum = emails.find(e => e.orderNumber)?.orderNumber;

    // Get best item description
    const itemDesc = emails.find(e => e.itemDescription)?.itemDescription ||
                     cleanSubject(primaryEmail.subject);

    // Calculate ETA if in transit
    let eta = null;
    if (status === 'shipped' && shippingEmail) {
        // Estimate 5 days from ship date
        eta = new Date(shippingEmail.date.getTime() + 5 * 24 * 60 * 60 * 1000);
        if (eta < new Date()) eta = null; // Don't show past ETAs
    }

    return {
        id: primaryEmail.id,
        merchant: primaryEmail.merchant || 'Unknown Merchant',
        item: itemDesc,
        amount,
        status,
        date: primaryEmail.date,
        shipDate: shippingEmail?.date,
        deliveryDate: deliveredEmail?.date || carrierDeliveryEmail?.date,
        eta,
        tracking,
        orderNumber: orderNum,
        source: primaryEmail.labelSource,
        emailCount: emails.length,
        hasPayPal: emails.some(e => e.type === 'payment'),
        emails: emails // Keep reference for debugging
    };
}

function merchantMatch(m1, m2) {
    if (!m1 || !m2) return false;
    const n1 = m1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n2 = m2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (n1 === n2) return true;
    if (n1.includes(n2) || n2.includes(n1)) return true;
    // Check for common variations
    const variations = {
        'amazon': ['amzn', 'amz'],
        'paypal': ['pp'],
        'ebay': ['eb']
    };
    for (const [main, vars] of Object.entries(variations)) {
        if ((n1.includes(main) || vars.some(v => n1.includes(v))) &&
            (n2.includes(main) || vars.some(v => n2.includes(v)))) {
            return true;
        }
    }
    return false;
}

// ============ EXTRACTION FUNCTIONS ============

function extractMerchant(from, subject) {
    // Known merchant mappings
    const knownMerchants = {
        'amazon': 'Amazon', 'amzn': 'Amazon',
        'paypal': 'PayPal',
        'apple': 'Apple',
        'google': 'Google',
        'bestbuy': 'Best Buy', 'best buy': 'Best Buy',
        'walmart': 'Walmart',
        'target': 'Target',
        'ebay': 'eBay',
        'etsy': 'Etsy',
        'newegg': 'Newegg',
        'bhphoto': 'B&H Photo', 'b&h': 'B&H Photo',
        'adorama': 'Adorama',
        'lightworkz': 'Light Workz', 'light workz': 'Light Workz', 'lightwrkz': 'Light Workz',
        'homedepot': 'Home Depot', 'home depot': 'Home Depot',
        'lowes': 'Lowes',
        'costco': 'Costco',
        'ups': 'UPS', 'usps': 'USPS', 'fedex': 'FedEx', 'dhl': 'DHL'
    };

    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Check known merchants first
    for (const [key, name] of Object.entries(knownMerchants)) {
        if (fromLower.includes(key) || subjectLower.includes(key)) {
            // Don't return carrier as merchant if we can find the real merchant
            if (['UPS', 'USPS', 'FedEx', 'DHL'].includes(name)) continue;
            return name;
        }
    }

    // Try to extract from email domain
    const domainMatch = from.match(/@([^.>]+)/);
    if (domainMatch) {
        const domain = domainMatch[1].toLowerCase();
        // Skip carriers and generic domains
        if (!['ups', 'usps', 'fedex', 'dhl', 'gmail', 'yahoo', 'outlook', 'mail'].includes(domain)) {
            return domain.charAt(0).toUpperCase() + domain.slice(1);
        }
    }

    // Try to extract from display name
    const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
    if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name.length > 2 && name.length < 50) {
            return name;
        }
    }

    return 'Unknown';
}

function extractAmount(text) {
    // Multiple patterns for amounts
    const patterns = [
        /(?:total|amount|charged|paid|price|cost|subtotal)[:\s]*\$?\s*([\d,]+\.?\d{0,2})/gi,
        /\$\s*([\d,]+\.\d{2})/g,
        /USD\s*([\d,]+\.\d{2})/gi,
        /([\d,]+\.\d{2})\s*(?:USD|dollars)/gi
    ];

    const amounts = [];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const amt = parseFloat(match[1].replace(/,/g, ''));
            if (amt > 0.50 && amt < 50000) { // Reasonable range
                amounts.push(amt);
            }
        }
    }

    // Also try simple dollar amounts
    const simpleMatches = text.match(/\$[\d,]+\.\d{2}/g) || [];
    for (const m of simpleMatches) {
        const amt = parseFloat(m.replace(/[$,]/g, ''));
        if (amt > 0.50 && amt < 50000) {
            amounts.push(amt);
        }
    }

    // Return the most likely order total (often the largest or most common)
    if (amounts.length === 0) return 0;

    // If there are multiple amounts, prefer the largest (likely total)
    return Math.max(...amounts);
}

function extractOrderNumber(text) {
    const patterns = [
        /order\s*(?:#|number|num|no\.?)?[:\s]*([A-Z0-9][-A-Z0-9]{5,25})/i,
        /(?:#|number|num|no\.?)[:\s]*([A-Z0-9][-A-Z0-9]{5,25})/i,
        /([0-9]{3}-[0-9]{7}-[0-9]{7})/, // Amazon format
        /order[:\s]+([0-9]{6,})/i,
        /confirmation[:\s#]*([A-Z0-9]{6,20})/i
    ];

    for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1]) {
            const num = m[1].trim();
            // Validate it looks like an order number
            if (num.length >= 6 && num.length <= 30) {
                return num;
            }
        }
    }
    return null;
}

function extractTracking(text) {
    // UPS: 1Z followed by 16 alphanumeric
    const ups = text.match(/\b1Z[A-Z0-9]{16}\b/i);
    if (ups) return { number: ups[0], carrier: 'UPS' };

    // USPS: starts with 94, 93, 92, or 91 followed by 18-22 digits
    const usps = text.match(/\b(94|93|92|91)[0-9]{18,22}\b/);
    if (usps) return { number: usps[0], carrier: 'USPS' };

    // FedEx: 12-15 digits or 20-22 digits
    const fedex = text.match(/\b([0-9]{12}|[0-9]{15}|[0-9]{20,22})\b/);
    if (fedex) {
        // Verify it's not too short or looks like something else
        if (fedex[0].length >= 12) {
            return { number: fedex[0], carrier: 'FedEx' };
        }
    }

    // Generic tracking mention
    const genericMatch = text.match(/tracking[:\s#]*([A-Z0-9]{10,30})/i);
    if (genericMatch) return { number: genericMatch[1], carrier: 'Unknown' };

    return null;
}

function extractItem(subject, body) {
    // Try to find item name in subject
    let item = subject
        .replace(/^(re:|fwd?:|fw:)\s*/gi, '')
        .replace(/order\s*(confirmation|confirm|received|shipped|#[A-Z0-9-]+)/gi, '')
        .replace(/your\s+(order|purchase|receipt|shipment|package)/gi, '')
        .replace(/thank\s+you\s+(for\s+)?(your\s+)?(order|purchase)?/gi, '')
        .replace(/has\s+(been\s+)?(shipped|delivered|placed)/gi, '')
        .replace(/shipping\s+(confirmation|update|notification)/gi, '')
        .replace(/delivery\s+(confirmation|update|notification)/gi, '')
        .replace(/^\s*[-:]\s*/, '')
        .trim();

    // If subject is too generic, try to find product in body
    if (item.length < 5 || /^(order|your|the|a|an)$/i.test(item)) {
        // Look for product patterns in body
        const productMatch = body.match(/(?:item|product|ordered)[:\s]+([^\n]{5,60})/i);
        if (productMatch) {
            item = productMatch[1].trim();
        }
    }

    // Truncate if too long
    if (item.length > 80) {
        item = item.substring(0, 77) + '...';
    }

    return item || 'Order';
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
    let body = '';

    // Get text from body directly
    if (payload.body?.data) {
        body += decode64(payload.body.data);
    }

    // Get text from parts
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                body += ' ' + decode64(part.body.data);
            }
            // Check nested parts
            if (part.parts) {
                for (const subpart of part.parts) {
                    if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
                        body += ' ' + decode64(subpart.body.data);
                    }
                }
            }
        }
    }

    // Limit body length to prevent performance issues
    return body.substring(0, 10000);
}

function decode64(data) {
    try {
        const decoded = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
        return decodeURIComponent(escape(decoded));
    } catch {
        try {
            return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
        } catch {
            return '';
        }
    }
}

// ============ UI FUNCTIONS ============

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.summary-card').forEach(c => {
        c.classList.toggle('active', c.dataset.filter === f);
    });

    const labels = {
        'all': 'All Orders',
        'pending': 'Pending / In Transit',
        'delivered': 'Delivered'
    };
    if (filterLabel) filterLabel.textContent = 'Showing: ' + labels[f];
    clearFilterBtn?.classList.toggle('hidden', f === 'all');

    if (f === 'all') {
        filteredOrders = [...allOrders];
    } else if (f === 'pending') {
        filteredOrders = allOrders.filter(o => o.status !== 'delivered');
    } else {
        filteredOrders = allOrders.filter(o => o.status === 'delivered');
    }

    displayOrders();
}

function updateSummary() {
    const spent = allOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const delivered = allOrders.filter(o => o.status === 'delivered').length;
    const pending = allOrders.filter(o => o.status !== 'delivered').length;

    document.getElementById('totalSpent').textContent = '$' + spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                <p>${currentFilter === 'pending' ? 'All orders delivered!' : 'No orders found'}</p>
            </div>`;
        return;
    }

    // Display as order list
    let html = '<div class="orders-list">';

    for (const order of filteredOrders) {
        html += orderCard(order);
    }

    html += '</div>';

    ordersContainer.innerHTML = html;

    // Add click handlers for expansion
    ordersContainer.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', () => card.classList.toggle('expanded'));
    });
}

function orderCard(o) {
    const statusColors = {
        delivered: '#4CAF50',
        shipped: '#2196F3',
        ordered: '#FF9800'
    };
    const statusIcons = {
        delivered: '✓',
        shipped: '🚚',
        ordered: '○'
    };
    const statusLabels = {
        delivered: 'Delivered',
        shipped: 'In Transit',
        ordered: 'Ordered'
    };

    const color = statusColors[o.status] || '#999';
    const icon = statusIcons[o.status] || '○';
    const statusLabel = statusLabels[o.status] || o.status;
    const price = o.amount > 0 ? `$${o.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

    // Tracking info for pending orders
    let trackingHtml = '';
    if (o.status !== 'delivered' && o.tracking) {
        const t = o.tracking;
        const trackNum = typeof t === 'object' ? t.number : t;
        const carrier = typeof t === 'object' ? t.carrier : '';
        trackingHtml = `
            <div class="tracking-info">
                <span class="tracking-label">${carrier || 'Tracking'}:</span>
                <span class="tracking-number">${trackNum}</span>
            </div>`;
    }

    // ETA for shipped orders
    let etaHtml = '';
    if (o.status === 'shipped' && o.eta) {
        etaHtml = `<div class="eta-info">Expected: ${formatDate(o.eta)}</div>`;
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
                <div class="order-status-badge" style="background:${color}">${statusLabel}</div>
            </div>
            ${trackingHtml}
            ${etaHtml}
            <div class="order-details">
                <div class="detail-row">
                    <span class="detail-label">Ordered:</span>
                    <span class="detail-value">${formatDate(o.date)}</span>
                </div>
                ${o.shipDate ? `
                <div class="detail-row">
                    <span class="detail-label">Shipped:</span>
                    <span class="detail-value">${formatDate(o.shipDate)}</span>
                </div>` : ''}
                ${o.deliveryDate ? `
                <div class="detail-row">
                    <span class="detail-label">Delivered:</span>
                    <span class="detail-value">${formatDate(o.deliveryDate)}</span>
                </div>` : ''}
                ${o.orderNumber ? `
                <div class="detail-row">
                    <span class="detail-label">Order #:</span>
                    <span class="detail-value">${o.orderNumber}</span>
                </div>` : ''}
                ${o.tracking ? `
                <div class="detail-row">
                    <span class="detail-label">Tracking:</span>
                    <span class="detail-value">${typeof o.tracking === 'object' ? o.tracking.number : o.tracking}</span>
                </div>` : ''}
                <div class="detail-row">
                    <span class="detail-label">Source:</span>
                    <span class="detail-value">${o.source}${o.hasPayPal ? ' + PayPal' : ''}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Emails:</span>
                    <span class="detail-value">${o.emailCount} related email${o.emailCount > 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>`;
}

function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function esc(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
