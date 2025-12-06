// Order Tracker App
// Displays orders from the last 60 days across all categories

// State
let allOrders = [];
let filteredOrders = [];
let activeFilter = 'ALL';
let activeStatusFilter = 'ALL';

// DOM Elements
const ordersContainer = document.getElementById('ordersContainer');
const filterButtons = document.getElementById('filterButtons');
const statusFilterButtons = document.getElementById('statusFilterButtons');
const summaryStats = document.getElementById('summaryStats');
const totalSpentEl = document.getElementById('totalSpent');
const totalOrdersEl = document.getElementById('totalOrders');
const pendingOrdersEl = document.getElementById('pendingOrders');
const lastUpdatedEl = document.getElementById('lastUpdated');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Load orders data
    allOrders = filterLast60Days(ORDERS_DATA);

    // Sort by date (newest first)
    allOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

    // Initialize filters
    createFilterButtons();
    createStatusFilterButtons();

    // Apply initial filter
    applyFilters();

    // Update last updated time
    updateLastUpdated();
}

// Filter orders to last 60 days
function filterLast60Days(orders) {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    return orders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= sixtyDaysAgo;
    });
}

// Create category filter buttons
function createFilterButtons() {
    const categories = ['ALL', ...new Set(allOrders.map(o => o.source))];

    filterButtons.innerHTML = categories.map(cat => `
        <button class="filter-btn ${cat === 'ALL' ? 'active' : ''}"
                data-category="${cat}"
                style="${cat !== 'ALL' ? `--cat-color: ${CATEGORY_COLORS[cat] || '#666'}` : ''}">
            ${cat === 'ALL' ? 'All Orders' : cat}
            <span class="count">${cat === 'ALL' ? allOrders.length : allOrders.filter(o => o.source === cat).length}</span>
        </button>
    `).join('');

    // Add click handlers
    filterButtons.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.category;
            applyFilters();
        });
    });
}

// Create status filter buttons
function createStatusFilterButtons() {
    const statuses = ['ALL', 'delivered', 'shipped', 'processing', 'pending', 'active'];

    statusFilterButtons.innerHTML = statuses.map(status => {
        const config = STATUS_CONFIG[status] || { label: 'All', icon: '📋' };
        const count = status === 'ALL'
            ? allOrders.length
            : allOrders.filter(o => o.status === status).length;

        if (count === 0 && status !== 'ALL') return '';

        return `
            <button class="status-filter-btn ${status === 'ALL' ? 'active' : ''}"
                    data-status="${status}">
                ${status === 'ALL' ? '📋' : config.icon} ${status === 'ALL' ? 'All' : config.label}
            </button>
        `;
    }).join('');

    // Add click handlers
    statusFilterButtons.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            statusFilterButtons.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeStatusFilter = btn.dataset.status;
            applyFilters();
        });
    });
}

// Apply both filters
function applyFilters() {
    filteredOrders = allOrders.filter(order => {
        const categoryMatch = activeFilter === 'ALL' || order.source === activeFilter;
        const statusMatch = activeStatusFilter === 'ALL' || order.status === activeStatusFilter;
        return categoryMatch && statusMatch;
    });

    displayOrders();
    updateSummary();
}

// Display orders grouped by date
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

    // Build HTML
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

    // Add click handlers for expandable orders
    ordersContainer.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('expanded');
        });
    });
}

// Format date for section headers
function formatDateHeader(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
        return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
        return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

// Create order card HTML
function createOrderCard(order) {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const categoryColor = CATEGORY_COLORS[order.source] || '#666';

    // Format items summary
    const itemsSummary = order.items.length === 1
        ? order.items[0].name
        : `${order.items[0].name} +${order.items.length - 1} more`;

    // Format status text
    let statusText = statusConfig.label;
    if (order.status === 'delivered' && order.deliveredDate) {
        statusText += ` ${formatShortDate(order.deliveredDate)}`;
    } else if (order.status === 'shipped' && order.estimatedDelivery) {
        statusText = `Arriving ${formatShortDate(order.estimatedDelivery)}`;
    } else if (order.isSubscription && order.renewalDate) {
        statusText = `Renews ${formatShortDate(order.renewalDate)}`;
    }

    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-main">
                <div class="order-category" style="background-color: ${categoryColor}">
                    ${getCategoryIcon(order.source)}
                </div>
                <div class="order-info">
                    <div class="order-title">${escapeHtml(itemsSummary)}</div>
                    <div class="order-meta">
                        <span class="order-merchant">${order.merchant || order.source}</span>
                        <span class="order-price">$${order.totalPrice.toFixed(2)}</span>
                    </div>
                </div>
                <div class="order-status" style="color: ${statusConfig.color}">
                    <span class="status-icon">${statusConfig.icon}</span>
                    <span class="status-text">${statusText}</span>
                </div>
            </div>
            <div class="order-details">
                <div class="order-id">Order: ${order.id}</div>
                <div class="items-list">
                    ${order.items.map(item => `
                        <div class="item-row">
                            <span class="item-name">${escapeHtml(item.name)}</span>
                            <span class="item-qty">x${item.quantity}</span>
                            <span class="item-price">$${item.price.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                ${order.trackingNumber ? `
                    <div class="tracking-info">
                        <span class="tracking-label">Tracking:</span>
                        <span class="tracking-number">${order.trackingNumber}</span>
                    </div>
                ` : ''}
                ${order.isDigital ? '<div class="digital-badge">Digital Delivery</div>' : ''}
                ${order.isService ? '<div class="service-badge">Service</div>' : ''}
            </div>
        </div>
    `;
}

// Get category icon
function getCategoryIcon(source) {
    const icons = {
        'AMAZON': '📦',
        'PAYPAL': '💳',
        'STORE': '🛒',
        'AI': '🤖',
        'DIVIDED WE STAND': '👕',
        'BMW': '🚗',
        'QUALITY WEB TIME': '🌐',
        'SUBSCRIPTIONS': '↻'
    };
    return icons[source] || '📦';
}

// Update summary statistics
function updateSummary() {
    const totalSpent = filteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const pendingCount = filteredOrders.filter(o =>
        ['pending', 'processing', 'shipped'].includes(o.status)
    ).length;

    totalSpentEl.textContent = `$${totalSpent.toFixed(2)}`;
    totalOrdersEl.textContent = filteredOrders.length;
    pendingOrdersEl.textContent = pendingCount;
}

// Format short date
function formatShortDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    lastUpdatedEl.textContent = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Escape HTML for XSS prevention
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Refresh data (for pull-to-refresh or manual refresh)
function refreshData() {
    // In a real app, this would fetch fresh data
    // For now, just re-render
    allOrders = filterLast60Days(ORDERS_DATA);
    allOrders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    createFilterButtons();
    applyFilters();
    updateLastUpdated();
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}
