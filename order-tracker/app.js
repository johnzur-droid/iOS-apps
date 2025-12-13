// Order Tracker v92 - Better item extraction (skip $0.00 items), better delivery detection
const CLIENT_ID = '457025763296-6mfbrdce2m9065gh24ph36sdqk9i9hi9.apps.googleusercontent.com';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient, gapiInited = false, gisInited = false;
let pendingOrders = [];

// Only check these two labels
const LABEL_NAMES = ['STORE', 'PAYPAL'];
const DAYS_TO_SCAN = 30;

// Bad merchants to filter out - payment processors and generic names
const BAD_MERCHANTS = ['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email', 'emails', 'oes', 'e', 't', 'i', 'a', 'unknown', 'paypal', 'members', 'notifications', 'service', 'noreply', 'no-reply', 'info', 'support', 'orders', 'shipping', 'customer', 'john zur', 'subtotal', 'thescarfgiraffe', 'martinsbike', 'lightwerkz', 'valleywellnessnj', 'order'];

// Subscription keywords - must be explicit subscription terms (NOT invoice alone)
const SUBSCRIPTION_PATTERNS = [
    /subscription/i, /membership/i, /renewal/i, /recurring/i,
    /monthly\s+(charge|payment|fee|plan)/i, /annual\s+(charge|payment|fee|plan)/i,
    /api\s+(usage|credit)/i, /billing\s+period/i, /pro\s+plan/i
];

// Known subscription services (digital services, not physical goods sellers)
const SUBSCRIPTION_SERVICES = ['anthropic', 'openai', 'aws', 'azure', 'google cloud', 'digitalocean', 'heroku', 'netflix', 'spotify', 'adobe', 'grammarly', 'sudowrite', 'sudo', '2sudo'];

// Physical goods sellers - NOT subscriptions even if they have "invoice"
const PHYSICAL_SELLERS = ['decals', 'amazon', 'walmart', 'target', 'ebay', 'etsy', 'lucky brand', 'macys', 'nordstrom', 'kohls', 'bestbuy', 'homedepot', 'lowes', 'newegg', 'paypal', 'costco', 'dicks', 'the shed', 'theshed'];

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
    /picked up (at|from)/i,
    /delivery confirmed/i, /item delivered/i, /order delivered/i,
    /we delivered/i, /just delivered/i, /now delivered/i,
    /arrived today/i, /has arrived/i, /out for delivery.*delivered/i,
    /thank you for your order.*delivered/i,
    /your delivery is complete/i, /dropoff complete/i
];

const ORDER_PATTERNS = [
    /order\s+(is\s+)?confirm/i,  // "order confirmed", "order is confirmed"
    /order received/i, /thanks for your order/i,
    /thank you for your (order|purchase)/i, /purchase confirm/i,
    /receipt for your/i, /order #/i, /order number/i,
    /order has been (placed|received|confirmed)/i,
    /payment (received|confirmed|complete|successful)/i,
    /your receipt/i, /receipt from/i,
    /payment\s+is\s+pending/i,  // PayPal pending
    /you\s+(sent|authorized)\s+(a\s+)?payment/i,  // PayPal sent payment
    /money\s+sent/i,  // PayPal money sent
    /you\s+paid/i,  // PayPal you paid
    /your order is/i,  // "your order is confirmed", "your order is on the way"
    /order update/i,  // eBay "Order update:"
    /ebay.*order/i,  // eBay orders
    /won\s+(the\s+)?item/i,  // eBay auction won
    /you\s+bought/i,  // eBay purchase
    /invoice/i,  // Subscription invoices
    /billing\s+(statement|summary|notification)/i,  // Billing
    /charge\s+(to|for|of)/i,  // Credit card charges
    /successfully\s+(charged|processed|renewed)/i,  // Renewals
    /subscription\s+(started|renewed|confirmed)/i,  // Subscriptions
    /your\s+\w+\s+subscription/i,  // "Your X subscription"
    /api\s+(usage|credits?)/i,  // API billing
    /newegg.*order/i,  // Newegg
    /walmart.*order/i,  // Walmart
    /amazon.*order/i,  // Amazon
    /macy'?s.*order/i,  // Macy's
    /macy'?s/i,  // Any Macy's email - they're all orders
    /target.*order/i,  // Target
    /costco.*order/i,  // Costco
    /dicks.*order/i,  // Dick's Sporting Goods
    /bestbuy.*order/i,  // Best Buy
    /nordstrom.*order/i,  // Nordstrom
    /kohls.*order/i  // Kohl's
];

const EXCLUDE_PATTERNS = [
    /password/i, /verify your email/i, /sign.?in/i, /security alert/i,
    /newsletter/i, /survey/i, /feedback/i,
    /we miss you/i, /recommended for you/i, /account (created|updated)/i,
    /tracking update/i,  // These are updates, not orders
    /return\s+(label|instructions|request)/i, /next steps for your.*return/i,  // Returns
    /refund\s+(processed|issued|confirmed)/i  // Refunds
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
    console.log('Order Tracker v76 - Better product extraction');
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
    // Consolidate by: order number, OR same merchant + same day (unless different order numbers)
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

        // Match by order number (exact match required)
        if (email.orderNumber) {
            foundGroup = orderGroups.find(g =>
                g.emails.some(e => e.orderNumber && e.orderNumber === email.orderNumber)
            );
        }

        // Match by same merchant + same day, UNLESS they have DIFFERENT order numbers
        if (!foundGroup && email.merchant && email.merchant !== 'Unknown') {
            foundGroup = orderGroups.find(g => {
                return g.emails.some(e => {
                    if (e.merchant === 'Unknown') return false;
                    const merchantMatch = isSameMerchant(e.merchant, email.merchant);
                    const dateMatch = Math.abs(e.date - email.date) < 1 * 24 * 60 * 60 * 1000; // 1 day

                    // Don't combine if both have order numbers but they're different
                    if (email.orderNumber && e.orderNumber && email.orderNumber !== e.orderNumber) {
                        return false;
                    }

                    return merchantMatch && dateMatch;
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

    // Get amount - prefer from order confirmation, then most common, then highest
    let amount = 0;
    // First try: amount from order confirmation email
    const orderAmount = orderEmails.find(e => e.amount > 0)?.amount;
    if (orderAmount) {
        amount = orderAmount;
    } else {
        // Second try: most common amount (appears multiple times)
        const amounts = emails.map(e => e.amount).filter(a => a > 0);
        if (amounts.length > 0) {
            const amountCounts = {};
            amounts.forEach(a => { amountCounts[a] = (amountCounts[a] || 0) + 1; });
            const sorted = Object.entries(amountCounts).sort((a, b) => b[1] - a[1]);
            amount = parseFloat(sorted[0][0]);
        }
    }

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

    // Get order number, tracking, and expected delivery
    const orderNumber = emails.find(e => e.orderNumber)?.orderNumber;
    const tracking = emails.find(e => e.tracking)?.tracking;
    // Get expected delivery date - prefer from shipping emails, then any email
    const expectedDelivery = shippingEmails.find(e => e.expectedDelivery)?.expectedDelivery
        || emails.find(e => e.expectedDelivery)?.expectedDelivery;

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

    // Final fallback - use merchant name + "Order" if item is garbage
    if (!item) item = orderEmail.item || 'Order';

    // Check if item looks like garbage (encoded strings, random chars, etc.)
    const isGarbageItem = (text) => {
        if (!text || text === 'Order') return true;
        if (text.length < 4) return true;
        // URL-encoded looking strings
        if (/-2F|-2B|%2F|%20/.test(text)) return true;
        // Random alphanumeric strings (no spaces, mixed case jumble)
        if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return true;
        // Just numbers and dashes
        if (/^[\d\s\-#]+$/.test(text)) return true;
        // Common garbage words that get extracted as item names (check contains, not exact)
        const garbageWords = ['subtotal', 'shipping total', 'order total', 'grand total', 'confirmation', 'status', 'summary', 'information', 'update', 'notification'];
        const lower = text.toLowerCase();
        if (garbageWords.some(w => lower.includes(w))) return true;
        // "Free" followed by price-like text
        if (/^free\s/i.test(text)) return true;
        return false;
    };

    if (isGarbageItem(item) && merchant !== 'Unknown') {
        item = merchant + ' Order';
    }

    // If item is still garbage and merchant is Unknown, this is a junk order
    if (isGarbageItem(item) && merchant === 'Unknown') {
        return null;
    }

    // Determine status
    let delivered = false;
    let shipDate = shippingEmail?.date;
    let deliveryDate = deliveryEmail?.date;

    if (deliveryEmail) {
        delivered = true;
    } else {
        // Auto-mark as delivered based on age (be generous - 14 days shipped, 21 days ordered)
        const now = Date.now();
        if (shipDate) {
            const shipAge = (now - shipDate) / (1000 * 60 * 60 * 24);
            if (shipAge > 14) delivered = true;
        } else {
            const orderAge = (now - orderEmail.date) / (1000 * 60 * 60 * 24);
            if (orderAge > 21) delivered = true;
        }
    }

    // Detect if this is a subscription/service (not a physical item)
    const allText = emails.map(e => e.subject + ' ' + (e.body || '')).join(' ');
    const merchantLower = merchant.toLowerCase();

    // Check if it's a physical goods seller (NOT a subscription)
    const isPhysicalSeller = PHYSICAL_SELLERS.some(s => merchantLower.includes(s));

    // Must have subscription keywords OR be a known subscription service
    // AND must NOT be a physical goods seller
    const hasSubscriptionKeywords = SUBSCRIPTION_PATTERNS.some(p => p.test(allText));
    const isKnownSubscriptionService = SUBSCRIPTION_SERVICES.some(s => merchantLower.includes(s));
    const isSubscription = !isPhysicalSeller && (hasSubscriptionKeywords || isKnownSubscriptionService);

    // Extract subscription details if applicable
    let billingPeriod = null;
    let planName = null;
    let expirationDate = null;

    if (isSubscription) {
        // Detect billing period - default to monthly if not specified
        if (/yearly|annual|per year|\/year|\/yr/i.test(allText)) {
            billingPeriod = 'Yearly';
            expirationDate = new Date(orderEmail.date);
            expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        } else {
            // Default to monthly for subscriptions
            billingPeriod = 'Monthly';
            expirationDate = new Date(orderEmail.date);
            expirationDate.setMonth(expirationDate.getMonth() + 1);
        }

        // Try to extract plan name
        const planMatch = allText.match(/(?:plan|tier|subscription)[\s:]+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
        if (planMatch) planName = planMatch[1];

        // Try API credits or usage pattern
        if (/api|credits?|usage/i.test(allText) && !planName) {
            planName = 'API Credits';
        }

        // If still no plan name, use merchant name
        if (!planName) {
            planName = merchant;
        }
    }

    // Filter out garbage orders
    // $999.99 is often a placeholder/error price
    if (amount === 999.99) return null;
    // Unknown merchant with no order number and no tracking = garbage
    if (merchant === 'Unknown' && !orderNumber && !tracking) return null;

    // Create stable ID based on order characteristics (not email ID which can change)
    // This ensures dismissed orders stay dismissed across scans
    let stableId;
    if (orderNumber) {
        stableId = `${merchant}-${orderNumber}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    } else {
        // Use merchant + date + amount as fallback ID
        const dateStr = orderEmail.date.toISOString().split('T')[0];
        stableId = `${merchant}-${dateStr}-${amount}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return {
        id: stableId,
        item,
        merchant,
        amount,
        orderDate: orderEmail.date,
        orderNumber,
        shipDate,
        deliveryDate,
        tracking,
        expectedDelivery,
        delivered,
        isSubscription,
        billingPeriod,
        planName,
        expirationDate,
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
    const fromLower = from.toLowerCase();

    // Check if from a known subscription service - auto-treat as order
    const isFromSubscriptionService = SUBSCRIPTION_SERVICES.some(s => fromLower.includes(s));

    // Determine email type
    const isFromCarrier = /(ups|usps|fedex|dhl)[\.\@]/i.test(from);
    const isDelivered = DELIVERED_PATTERNS.some(p => p.test(text));
    const isShipping = !isDelivered && /shipped|tracking|in transit|out for delivery/i.test(text);
    const isOrder = !isFromCarrier && (ORDER_PATTERNS.some(p => p.test(text)) || isFromSubscriptionService);

    // Must be relevant
    if (!isOrder && !isShipping && !isDelivered) {
        console.log('SKIPPED (no match):', subject.substring(0, 50), '| From:', from.substring(0, 30));
        return null;
    }

    console.log('FOUND:', isOrder ? 'ORDER' : isShipping ? 'SHIPPING' : 'DELIVERED', '|', subject.substring(0, 50));

    return {
        id: msg.id,
        isOrder,
        isShipping,
        isDelivered,
        subject,
        from,
        date,
        body: body.substring(0, 2000),
        item: extractItem(subject, body),
        merchant: extractMerchant(from, subject, body),
        amount: extractAmount(text),
        orderNumber: extractOrderNumber(text),
        tracking: extractTracking(text),
        expectedDelivery: extractExpectedDelivery(text),
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

    // PRIORITY: Search body FIRST - it has actual product names
    if (body && body.length > 10) {
        // First, remove FREE items and $0.00 items from consideration
        // Replace them so they don't get matched
        let cleanBody = body
            .replace(/^.*\$0\.00.*$/gm, '')  // Remove lines with $0.00
            .replace(/^.*FREE.*$/gmi, '')     // Remove lines with FREE
            .replace(/^.*\bfree\b.*$/gmi, ''); // Remove lines with "free" word

        // Newegg/electronics: Product with price pattern - find items with real prices
        // Look for "Product Name ... $XX.XX" but NOT $0.00
        const priceLines = cleanBody.match(/^([A-Z][A-Za-z0-9][A-Za-z0-9\s,.'"-]{5,50})\s+\$[1-9]\d*\.\d{2}/gm);
        if (priceLines && priceLines.length > 0) {
            // Get the first item with a real price
            const firstPriceLine = priceLines[0];
            match = firstPriceLine.match(/^([A-Z][A-Za-z0-9][A-Za-z0-9\s,.'"-]{5,50})\s+\$/);
            if (match) { const item = cleanItem(match[1]); if (item) return item; }
        }

        // Amazon: "Items Ordered: [product]" - very specific pattern
        match = cleanBody.match(/Items?\s+Ordered:?\s*\n\s*([A-Z][A-Za-z0-9][^\n\r]{5,55})/);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // eBay: "You bought:" or "Item:" followed by product name
        match = cleanBody.match(/(?:You\s+bought|Item\s+title|Item\s+name)[:\s]+\n?\s*([A-Z][A-Za-z0-9][^\n\r]{8,55})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // Fashion/clothing: look for specific garment patterns
        match = cleanBody.match(/((?:Men's|Women's|Boys'|Girls'|Ladies')\s+[A-Z][A-Za-z\s'-]{5,40})/);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // Clothing items with brand + type
        match = cleanBody.match(/([A-Z][A-Za-z]+\s+(?:Sweater|Shirt|Pants|Jeans|Dress|Jacket|Coat|Blouse|Skirt|Shorts|Hoodie|Cardigan|Pullover|Henley|T-Shirt|Polo))/);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // Electronics: RAM, SSD, GPU, CPU patterns
        match = cleanBody.match(/([A-Z][A-Za-z0-9\s-]*(?:RAM|DDR[45]|SSD|HDD|GPU|CPU|GB|TB|MHz)[A-Za-z0-9\s-]*)/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // Quantity pattern: "1 x Product Name" or "Qty: 1 Product Name"
        match = cleanBody.match(/(?:Qty:?\s*\d+\s*-?\s*|^\s*\d+\s+x\s+)([A-Z][A-Za-z0-9][A-Za-z0-9\s'-]{5,45})/im);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // Decals: "Your design:" or "Design name:"
        match = cleanBody.match(/(?:Your\s+design|Design\s+name|Decal\s+design)[:\s]+([A-Z][A-Za-z0-9][^\n\r]{5,35})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // "Product Name:" pattern (more specific - requires colon)
        match = cleanBody.match(/Product\s+Name:\s*([A-Z][A-Za-z0-9][^\n\r]{5,45})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }

        // "Description:" pattern
        match = cleanBody.match(/Description:\s*([A-Z][A-Za-z0-9][^\n\r]{5,45})/i);
        if (match) { const item = cleanItem(match[1]); if (item) return item; }
    }

    // THEN check subject for product names
    // Amazon: "Your Amazon.com order of [product]..."
    match = subject.match(/order\s+of\s+([A-Z][A-Za-z0-9][^\.]{3,55}?)(?:\s+has|\s+and|\s*\.\.\.|$)/i);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // Quoted product name: "Your order: 'Product Name'"
    match = subject.match(/['""']([A-Z][^'""']{3,45})['""']/);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // "Your shipment of [product]"
    match = subject.match(/(?:shipment|package)\s+of\s+([A-Z][A-Za-z0-9][^\.]{3,45}?)(?:\s+has|\s+is|\.\.\.|$)/i);
    if (match) { const item = cleanItem(match[1]); if (item) return item; }

    // Fall back: return "Order" - don't try to clean up garbage subjects
    return 'Order';
}

function cleanItem(text) {
    if (!text) return null;
    let item = text.trim()
        .replace(/^[\s\-:•'"!#@*=_]+/, '')
        .replace(/[\s\-:•'"!#@*=_]+$/, '')
        .replace(/^\d+\s*x\s*/i, '')
        .replace(/\s+/g, ' ')
        .replace(/-{3,}/g, ' ')  // Only replace 3+ dashes
        .trim();

    if (!item || item.length < 3) return null;

    // Only reject obvious garbage - be permissive otherwise
    const GARBAGE = ['normal', 'none', 'auto', 'inherit', 'important', 'undefined', 'null', 'true', 'false'];
    if (GARBAGE.includes(item.toLowerCase())) return null;

    // Skip FREE/promotional items - we want the paid item
    if (/^free\b/i.test(item)) return null;
    if (/\bfree\s+(gift|item|bonus|sample)\b/i.test(item)) return null;
    if (/\$0\.00/.test(item)) return null;

    // CSS/code
    if (/!important/i.test(item)) return null;
    if (/[{}<>]/.test(item)) return null;
    if (/^\w+\s*:\s*\d+(px|em|rem|%)/.test(item)) return null;

    // Tracking/order numbers only
    if (/^1Z[A-Z0-9]{16}$/i.test(item)) return null;
    if (/^9[1-4]\d{18,}$/.test(item)) return null;
    if (/^\d{10,}$/.test(item)) return null;
    if (/^TBA\d+$/i.test(item)) return null;
    if (/^\d{3}-\d{7}-\d{7}$/.test(item)) return null;
    if (/^[\d\s\-#]+$/.test(item)) return null;

    // Obvious non-products
    if (/^proof\s+approval/i.test(item)) return null;
    if (/^next\s+steps/i.test(item)) return null;
    if (/^from\s+\w+$/i.test(item)) return null;

    if (item.length > 55) item = item.substring(0, 52) + '...';
    return item;
}

// Generate tracking URL based on carrier
function getTrackingUrl(tracking) {
    if (!tracking) return null;

    // UPS: starts with 1Z
    if (/^1Z/i.test(tracking)) {
        return `https://www.ups.com/track?loc=en_US&tracknum=${tracking}&requester=ST/trackdetails`;
    }

    // USPS: starts with 9, typically 20-22 digits
    if (/^9[1-4]\d{18,22}$/.test(tracking)) {
        return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
    }

    // FedEx: 12-15 digits or 20-22 digits
    if (/^\d{12,15}$/.test(tracking) || /^\d{20,22}$/.test(tracking)) {
        return `https://www.fedex.com/fedextrack/?trknbr=${tracking}`;
    }

    // Amazon TBA tracking - goes to Amazon
    if (/^TBA/i.test(tracking)) {
        return `https://www.amazon.com/gp/your-account/order-history?trackingId=${tracking}`;
    }

    // DHL: 10 digits
    if (/^\d{10}$/.test(tracking)) {
        return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${tracking}`;
    }

    // Default: try Google search for the tracking number
    return `https://www.google.com/search?q=${tracking}+tracking`;
}

function extractMerchant(from, subject, body = '') {
    const isCarrier = /(ups|usps|fedex|dhl)/i.test(from);

    // FIRST: Check for known retailers - most reliable
    const knownRetailers = [
        { pattern: /newegg/i, name: 'Newegg' },
        { pattern: /amazon/i, name: 'Amazon' },
        { pattern: /walmart/i, name: 'Walmart' },
        { pattern: /target\.com|target\s/i, name: 'Target' },
        { pattern: /ebay/i, name: 'eBay' },
        { pattern: /best\s*buy/i, name: 'Best Buy' },
        { pattern: /home\s*depot/i, name: 'Home Depot' },
        { pattern: /lowes/i, name: 'Lowes' },
        { pattern: /macy/i, name: "Macy's" },
        { pattern: /nordstrom/i, name: 'Nordstrom' },
        { pattern: /dick'?s\s*sporting/i, name: "Dick's Sporting Goods" },
        { pattern: /kohls/i, name: "Kohl's" },
        { pattern: /etsy/i, name: 'Etsy' },
        { pattern: /decals\.com|decals\s/i, name: 'Decals.com' },
        { pattern: /grammarly/i, name: 'Grammarly' },
        { pattern: /sudowrite/i, name: 'Sudowrite' },
        { pattern: /anthropic/i, name: 'Anthropic' }
    ];

    // Check sender first
    for (const { pattern, name } of knownRetailers) {
        if (pattern.test(from)) return name;
    }

    // Check subject
    for (const { pattern, name } of knownRetailers) {
        if (pattern.test(subject)) return name;
    }

    // Check body (only first 500 chars to avoid false matches in footers)
    const bodyStart = body.substring(0, 500);
    for (const { pattern, name } of knownRetailers) {
        if (pattern.test(bodyStart)) return name;
    }

    // If it's a carrier email and no known retailer was found, return Unknown
    // (don't try to extract UPS/FedEx/etc as the merchant)
    if (isCarrier) return 'Unknown';

    // Check if sender is PayPal - need to find real merchant from body
    const isPaymentProcessor = /paypal|venmo|zelle|cashapp/i.test(from);

    // Try to get domain from email (unless it's a payment processor)
    if (!isPaymentProcessor) {
        const domainMatch = from.match(/@([^.>]+)/);
        if (domainMatch) {
            const domain = domainMatch[1].toLowerCase();
            if (!BAD_MERCHANTS.includes(domain) && domain.length > 2) {
                return domain.charAt(0).toUpperCase() + domain.slice(1);
            }
        }

        // Try display name (but filter out garbage)
        const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
        if (nameMatch) {
            let name = nameMatch[1].trim();
            const nameLower = name.toLowerCase();
            // Skip if contains garbage patterns
            if (name.length > 2 && name.length < 30 &&
                !BAD_MERCHANTS.includes(nameLower) &&
                !/https?:/i.test(name) &&
                !/\d+\s*months?/i.test(name) &&
                !/commerce\s*inc/i.test(name) &&
                !/^by\s/i.test(name)) {
                return name;
            }
        }
    }

    // For PayPal, try to find merchant in body with strict patterns
    if (isPaymentProcessor && body) {
        // PayPal: "You sent $X.XX USD to [Merchant]"
        let match = body.match(/sent\s+\$[\d.,]+\s+USD\s+to\s+([A-Z][A-Za-z0-9\s&'.-]{2,25})/i);
        if (match && isValidMerchant(match[1])) {
            return match[1].trim();
        }
    }

    // Try to find merchant in subject
    const subjectMatch = subject.match(/from\s+([A-Za-z][A-Za-z0-9\s&'-]{2,20}?)(?:\s+|$|\.)/i);
    if (subjectMatch && isValidMerchant(subjectMatch[1])) {
        return subjectMatch[1].trim();
    }

    return 'Unknown';
}

// Helper to check if merchant name is valid (not garbage)
function isValidMerchant(name) {
    if (!name) return false;
    const cleaned = name.trim().toLowerCase();
    if (cleaned.length < 2 || cleaned.length > 30) return false;
    if (BAD_MERCHANTS.includes(cleaned)) return false;
    // Reject garbage patterns
    if (/https?:/i.test(name)) return false;
    if (/\d+\s*months?/i.test(name)) return false;
    if (/in\s*full/i.test(name)) return false;
    if (/commerce\s*inc/i.test(name)) return false;
    if (/^by\s/i.test(name)) return false;
    if (/confirmed|shipped|delivered/i.test(name)) return false;
    return true;
}

function extractAmount(text) {
    // Remove savings/discount amounts from consideration (they're not what was paid)
    // Replace them with placeholder so they don't get picked up
    let cleanText = text
        .replace(/(?:you\s+)?sav(?:e|ed|ings)[:\s]*-?\$[\d,]+\.\d{2}/gi, 'SAVINGS_REMOVED')
        .replace(/discount[:\s]*-?\$[\d,]+\.\d{2}/gi, 'DISCOUNT_REMOVED')
        .replace(/(?:member\s+)?savings[:\s]*-?\$[\d,]+\.\d{2}/gi, 'SAVINGS_REMOVED')
        .replace(/(?:you\s+)?save[:\s]*-?\$[\d,]+\.\d{2}/gi, 'SAVINGS_REMOVED')
        .replace(/-\$[\d,]+\.\d{2}/g, 'NEGATIVE_REMOVED')  // Negative amounts are discounts
        .replace(/\$[\d,]+\.\d{2}\s+off/gi, 'DISCOUNT_REMOVED')  // "$X off"
        .replace(/rollback[:\s]*\$[\d,]+\.\d{2}/gi, 'SAVINGS_REMOVED')  // Walmart rollback
        .replace(/was\s+\$[\d,]+\.\d{2}/gi, 'WAS_PRICE_REMOVED');  // "was $X" = old price

    // First, try to find amount near "total" (order total, grand total, etc.)
    // But NOT "savings total" or "discount total"
    const totalMatch = cleanText.match(/(?:order\s+)?(?:grand\s+)?total[:\s]*\$?([\d,]+\.\d{2})/i);
    if (totalMatch) {
        const amount = parseFloat(totalMatch[1].replace(/,/g, ''));
        if (amount > 1 && amount < 50000) return amount;
    }

    // Also try "Amount" or "Charged" patterns
    const chargedMatch = cleanText.match(/(?:amount\s+(?:due|charged)|charged|you\s+paid|payment\s+total)[:\s]*\$?([\d,]+\.\d{2})/i);
    if (chargedMatch) {
        const amount = parseFloat(chargedMatch[1].replace(/,/g, ''));
        if (amount > 1 && amount < 50000) return amount;
    }

    // Fall back to finding all amounts and using most common (not max)
    const matches = cleanText.match(/\$[\d,]+\.\d{2}/g) || [];
    const amounts = matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(a => a > 1 && a < 50000);
    if (amounts.length === 0) return 0;

    // Count occurrences - the real total often appears multiple times
    const counts = {};
    amounts.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // If one amount appears more than others, use it
    if (sorted.length > 1 && sorted[0][1] > sorted[1][1]) {
        return parseFloat(sorted[0][0]);
    }

    // Otherwise return the last amount (often the total at bottom of email)
    return amounts[amounts.length - 1];
}

function extractOrderNumber(text) {
    // Amazon order numbers
    const amazon = text.match(/(\d{3}-\d{7}-\d{7})/);
    if (amazon) return amazon[1];

    // General order numbers - but filter out garbage
    const order = text.match(/order\s*#?\s*:?\s*([A-Z0-9][A-Z0-9-]{5,19})/i);
    if (order) {
        const num = order[1];
        // Reject common garbage that gets matched as order numbers
        const garbage = ['confirmed', 'confirmation', 'shipped', 'shipping', 'delivered', 'delivery', 'status', 'summary', 'number', 'information', 'tracking', 'update'];
        if (garbage.includes(num.toLowerCase())) return null;
        return num;
    }
    return null;
}

function extractTracking(text) {
    // UPS: starts with 1Z, 18 chars total
    const ups = text.match(/\b1Z[A-Z0-9]{16}\b/i);
    if (ups) return ups[0].toUpperCase();

    // USPS: starts with 9, 20-22 digits
    const usps = text.match(/\b9[1-4]\d{18,22}\b/);
    if (usps) return usps[0];

    // FedEx: 12-15 digits or 20-22 digits
    const fedex = text.match(/\b\d{12,15}\b/);
    if (fedex && !text.includes(fedex[0] + '-')) return fedex[0];  // Avoid order numbers

    // FedEx Door Tag: DT followed by digits
    const fedexDT = text.match(/\bDT\d{12}\b/i);
    if (fedexDT) return fedexDT[0].toUpperCase();

    // Amazon TBA tracking
    const tba = text.match(/\bTBA\d{12,}\b/i);
    if (tba) return tba[0].toUpperCase();

    // Generic: look for "tracking" followed by a number - but validate
    const generic = text.match(/tracking[:\s#]+([A-Z0-9]{10,25})/i);
    if (generic) {
        const track = generic[1].toUpperCase();
        // Reject garbage that looks like tracking but isn't
        const garbage = ['INFORMATION', 'UNAVAILABLE', 'AVAILABLE', 'PENDING', 'PROCESSING'];
        if (!garbage.includes(track) && /\d/.test(track)) {
            return track;
        }
    }

    return null;
}

function extractExpectedDelivery(text) {
    // Common patterns for expected delivery dates
    const patterns = [
        // "arriving by Dec 15" or "arrives Dec 15"
        /(?:arriv(?:ing|es?|al)|expected|estimated)\s+(?:by\s+)?([A-Z][a-z]{2,8}\s+\d{1,2}(?:,?\s+\d{4})?)/i,
        // "delivery by December 15" or "delivered by Dec 15"
        /(?:deliver(?:y|ed)?)\s+(?:by\s+)?([A-Z][a-z]{2,8}\s+\d{1,2}(?:,?\s+\d{4})?)/i,
        // "by Friday, Dec 15"
        /by\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Z][a-z]{2,8}\s+\d{1,2})/i,
        // "Dec 15 - Dec 17" (range - use end date)
        /([A-Z][a-z]{2,8}\s+\d{1,2})\s*[-–]\s*([A-Z][a-z]{2,8}\s+\d{1,2})/i,
        // "12/15" or "12/15/2024"
        /(?:arriv|deliver|expected|by)[:\s]+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // For range patterns, use the second date (end of range)
            const dateStr = match[2] || match[1];
            const parsed = new Date(dateStr);
            // If year not specified and date is in past, assume next year
            if (!isNaN(parsed.getTime())) {
                if (parsed < new Date() && !dateStr.includes('202')) {
                    parsed.setFullYear(parsed.getFullYear() + 1);
                }
                return parsed;
            }
        }
    }
    return null;
}

function getHeader(headers, name) {
    return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function getBody(payload) {
    let text = '';
    let html = '';

    // Direct body
    if (payload.body?.data) {
        const decoded = decode64(payload.body.data);
        if (payload.mimeType === 'text/html') html = decoded;
        else text = decoded;
    }

    // Multipart
    if (payload.parts) {
        for (const p of payload.parts) {
            if (p.body?.data) {
                const decoded = decode64(p.body.data);
                if (p.mimeType === 'text/plain') text += decoded;
                if (p.mimeType === 'text/html') html += decoded;
            }
            if (p.parts) {
                for (const sp of p.parts) {
                    if (sp.body?.data) {
                        const decoded = decode64(sp.body.data);
                        if (sp.mimeType === 'text/plain') text += decoded;
                        if (sp.mimeType === 'text/html') html += decoded;
                    }
                }
            }
        }
    }

    // Prefer plain text, fall back to stripped HTML
    if (text.length > 50) return text.substring(0, 5000);
    if (html) {
        // Strip HTML tags to get text content
        const stripped = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        return stripped.substring(0, 5000);
    }
    return text.substring(0, 5000);
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

        // Different display for subscriptions vs physical orders
        if (o.isSubscription) {
            const planInfo = o.planName || 'Service';
            const periodInfo = o.billingPeriod ? ` (${o.billingPeriod})` : '';
            const expiresInfo = o.expirationDate ? formatDate(o.expirationDate) : 'N/A';

            html += `
                <div class="order-card subscription" data-id="${o.id}">
                    <div class="order-header">
                        <div class="order-item">${esc(planInfo)}${periodInfo} <span class="sub-badge">Subscription</span></div>
                        <button class="dismiss-btn" onclick="event.stopPropagation(); dismissOrder('${o.id}')">✓ Done</button>
                    </div>
                    <div class="order-details">
                        <div class="detail"><span class="label">Provider:</span> ${esc(o.merchant)}</div>
                        ${price ? `<div class="detail"><span class="label">Amount:</span> ${price}${o.billingPeriod ? '/' + o.billingPeriod.toLowerCase().replace('ly', '') : ''}</div>` : ''}
                        <div class="detail"><span class="label">Billed:</span> ${formatDate(o.orderDate)}</div>
                        ${o.expirationDate ? `<div class="detail"><span class="label">Renews:</span> ${expiresInfo}</div>` : ''}
                        ${o.orderNumber ? `<div class="detail"><span class="label">Invoice #:</span> ${o.orderNumber}</div>` : ''}
                    </div>
                </div>`;
        } else {
            // Use extracted expected delivery date if available, otherwise calculate from ship date
            const eta = o.expectedDelivery ? formatDate(o.expectedDelivery)
                : (o.shipDate ? calcETA(o.shipDate) : null);
            const status = o.shipDate ? 'Shipped' : 'Awaiting shipment';

            // Make tracking number a clickable link
            let trackingHtml = '<div class="detail"><span class="label">Tracking:</span> --</div>';
            if (o.tracking) {
                const trackingUrl = getTrackingUrl(o.tracking);
                trackingHtml = `<div class="detail"><span class="label">Tracking:</span> <a href="${trackingUrl}" target="_blank" class="tracking-link">${o.tracking}</a></div>`;
            }

            // Consistent display - always show all fields
            html += `
                <div class="order-card" data-id="${o.id}">
                    <div class="order-header">
                        <div class="order-item">${esc(o.item)}</div>
                        <button class="dismiss-btn" onclick="event.stopPropagation(); dismissOrder('${o.id}')">✓ Received</button>
                    </div>
                    <div class="order-details">
                        <div class="detail"><span class="label">From:</span> ${esc(o.merchant)}</div>
                        <div class="detail"><span class="label">Amount:</span> ${price || '--'}</div>
                        <div class="detail"><span class="label">Ordered:</span> ${formatDate(o.orderDate)}</div>
                        <div class="detail"><span class="label">Status:</span> ${status}</div>
                        <div class="detail"><span class="label">Shipped:</span> ${o.shipDate ? formatDate(o.shipDate) : '--'}</div>
                        ${trackingHtml}
                        <div class="detail"><span class="label">ETA:</span> ${eta || '--'}</div>
                        <div class="detail"><span class="label">Order #:</span> ${o.orderNumber || '--'}</div>
                    </div>
                </div>`;
        }
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
