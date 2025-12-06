// Order Tracker Data - Last 60 Days
// Categories: STORE, PAYPAL, AI, DIVIDED WE STAND, BMW, QUALITY WEB TIME, AMAZON, SUBSCRIPTIONS
// Update this file with your actual orders

const ORDERS_DATA = [
    // ============ AMAZON ORDERS ============
    {
        id: "AMZ-114-7829456-3847261",
        source: "AMAZON",
        orderDate: "2024-12-04",
        items: [
            { name: "Apple AirPods Pro (2nd Gen)", quantity: 1, price: 249.00 }
        ],
        totalPrice: 249.00,
        status: "shipped",
        trackingNumber: "TBA938472615",
        estimatedDelivery: "2024-12-07",
        deliveredDate: null
    },
    {
        id: "AMZ-114-9283746-1029384",
        source: "AMAZON",
        orderDate: "2024-12-01",
        items: [
            { name: "Anker USB-C Hub 7-in-1", quantity: 1, price: 35.99 },
            { name: "USB-C to Lightning Cable 6ft (2-pack)", quantity: 1, price: 19.99 }
        ],
        totalPrice: 55.98,
        status: "delivered",
        trackingNumber: "TBA847261539",
        estimatedDelivery: "2024-12-03",
        deliveredDate: "2024-12-03"
    },
    {
        id: "AMZ-114-5647382-9102837",
        source: "AMAZON",
        orderDate: "2024-11-28",
        items: [
            { name: "Sony WH-1000XM5 Headphones", quantity: 1, price: 328.00 }
        ],
        totalPrice: 328.00,
        status: "delivered",
        trackingNumber: "TBA726153948",
        estimatedDelivery: "2024-12-01",
        deliveredDate: "2024-11-30"
    },
    {
        id: "AMZ-114-3847261-5039284",
        source: "AMAZON",
        orderDate: "2024-11-25",
        items: [
            { name: "Kindle Paperwhite 11th Gen", quantity: 1, price: 139.99 },
            { name: "Kindle Fabric Cover", quantity: 1, price: 39.99 }
        ],
        totalPrice: 179.98,
        status: "delivered",
        trackingNumber: "TBA615394827",
        estimatedDelivery: "2024-11-28",
        deliveredDate: "2024-11-27"
    },
    {
        id: "AMZ-114-2938475-1029384",
        source: "AMAZON",
        orderDate: "2024-11-20",
        items: [
            { name: "Logitech MX Master 3S Mouse", quantity: 1, price: 99.99 },
            { name: "Logitech MX Keys Keyboard", quantity: 1, price: 119.99 }
        ],
        totalPrice: 219.98,
        status: "delivered",
        trackingNumber: "TBA539482716",
        estimatedDelivery: "2024-11-23",
        deliveredDate: "2024-11-22"
    },
    {
        id: "AMZ-114-8374625-9182736",
        source: "AMAZON",
        orderDate: "2024-11-15",
        items: [
            { name: "Samsung T7 Shield 2TB SSD", quantity: 1, price: 159.99 }
        ],
        totalPrice: 159.99,
        status: "delivered",
        trackingNumber: "TBA394827156",
        estimatedDelivery: "2024-11-18",
        deliveredDate: "2024-11-17"
    },
    {
        id: "AMZ-114-7261538-4029385",
        source: "AMAZON",
        orderDate: "2024-11-10",
        items: [
            { name: "Coffee Beans - Dark Roast 2lb", quantity: 2, price: 24.99 },
            { name: "Chemex Coffee Filters 100ct", quantity: 1, price: 12.99 }
        ],
        totalPrice: 62.97,
        status: "delivered",
        trackingNumber: "TBA482715639",
        estimatedDelivery: "2024-11-13",
        deliveredDate: "2024-11-12"
    },
    {
        id: "AMZ-114-6152839-3948271",
        source: "AMAZON",
        orderDate: "2024-10-28",
        items: [
            { name: "iPhone 15 Pro Max Case - Clear", quantity: 1, price: 49.99 },
            { name: "Screen Protector 3-Pack", quantity: 1, price: 15.99 }
        ],
        totalPrice: 65.98,
        status: "delivered",
        trackingNumber: "TBA271563948",
        estimatedDelivery: "2024-10-31",
        deliveredDate: "2024-10-30"
    },

    // ============ PAYPAL ORDERS ============
    {
        id: "PP-9X847261538",
        source: "PAYPAL",
        orderDate: "2024-12-03",
        items: [
            { name: "eBay - Vintage Camera Lens", quantity: 1, price: 185.00 }
        ],
        totalPrice: 185.00,
        status: "shipped",
        trackingNumber: "9400111899223847261538",
        estimatedDelivery: "2024-12-10",
        deliveredDate: null,
        merchant: "camera_collector_pro"
    },
    {
        id: "PP-8X726153948",
        source: "PAYPAL",
        orderDate: "2024-11-29",
        items: [
            { name: "Etsy - Custom Leather Wallet", quantity: 1, price: 75.00 }
        ],
        totalPrice: 75.00,
        status: "delivered",
        trackingNumber: "9400111899223726153948",
        estimatedDelivery: "2024-12-05",
        deliveredDate: "2024-12-04",
        merchant: "LeatherCraftStudio"
    },
    {
        id: "PP-7X615394827",
        source: "PAYPAL",
        orderDate: "2024-11-22",
        items: [
            { name: "Bandcamp - Album Downloads (5 albums)", quantity: 5, price: 10.00 }
        ],
        totalPrice: 50.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-22",
        merchant: "Various Artists",
        isDigital: true
    },
    {
        id: "PP-6X539482716",
        source: "PAYPAL",
        orderDate: "2024-11-18",
        items: [
            { name: "eBay - Mechanical Keyboard Switches", quantity: 1, price: 45.00 }
        ],
        totalPrice: 45.00,
        status: "delivered",
        trackingNumber: "9400111899223539482716",
        estimatedDelivery: "2024-11-25",
        deliveredDate: "2024-11-24",
        merchant: "keyboard_enthusiast"
    },
    {
        id: "PP-5X482715639",
        source: "PAYPAL",
        orderDate: "2024-11-12",
        items: [
            { name: "Discogs - Vinyl Record", quantity: 1, price: 32.00 }
        ],
        totalPrice: 32.00,
        status: "delivered",
        trackingNumber: "LZ948271563US",
        estimatedDelivery: "2024-11-20",
        deliveredDate: "2024-11-19",
        merchant: "VinylVaultRecords"
    },
    {
        id: "PP-4X394827156",
        source: "PAYPAL",
        orderDate: "2024-10-25",
        items: [
            { name: "Humble Bundle - Game Collection", quantity: 1, price: 25.00 }
        ],
        totalPrice: 25.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-10-25",
        merchant: "Humble Bundle",
        isDigital: true
    },

    // ============ STORE ORDERS ============
    {
        id: "STR-2024120501",
        source: "STORE",
        orderDate: "2024-12-05",
        items: [
            { name: "Nike Air Max 90", quantity: 1, price: 130.00 }
        ],
        totalPrice: 130.00,
        status: "processing",
        trackingNumber: null,
        estimatedDelivery: "2024-12-12",
        deliveredDate: null,
        merchant: "Nike.com"
    },
    {
        id: "STR-2024120201",
        source: "STORE",
        orderDate: "2024-12-02",
        items: [
            { name: "Patagonia Better Sweater", quantity: 1, price: 139.00 },
            { name: "Patagonia Beanie", quantity: 1, price: 35.00 }
        ],
        totalPrice: 174.00,
        status: "shipped",
        trackingNumber: "1Z999AA10123456784",
        estimatedDelivery: "2024-12-08",
        deliveredDate: null,
        merchant: "Patagonia.com"
    },
    {
        id: "STR-2024112701",
        source: "STORE",
        orderDate: "2024-11-27",
        items: [
            { name: "Apple Watch Ultra 2 Band", quantity: 1, price: 99.00 }
        ],
        totalPrice: 99.00,
        status: "delivered",
        trackingNumber: "1Z999AA10123456785",
        estimatedDelivery: "2024-12-01",
        deliveredDate: "2024-11-30",
        merchant: "Apple Store"
    },
    {
        id: "STR-2024112001",
        source: "STORE",
        orderDate: "2024-11-20",
        items: [
            { name: "REI Co-op Flash 22 Pack", quantity: 1, price: 54.95 }
        ],
        totalPrice: 54.95,
        status: "delivered",
        trackingNumber: "1Z999AA10123456786",
        estimatedDelivery: "2024-11-25",
        deliveredDate: "2024-11-24",
        merchant: "REI.com"
    },
    {
        id: "STR-2024111501",
        source: "STORE",
        orderDate: "2024-11-15",
        items: [
            { name: "Allbirds Tree Runners", quantity: 1, price: 98.00 }
        ],
        totalPrice: 98.00,
        status: "delivered",
        trackingNumber: "1Z999AA10123456787",
        estimatedDelivery: "2024-11-20",
        deliveredDate: "2024-11-19",
        merchant: "Allbirds.com"
    },
    {
        id: "STR-2024110801",
        source: "STORE",
        orderDate: "2024-11-08",
        items: [
            { name: "Uniqlo Ultra Light Down Jacket", quantity: 1, price: 79.90 },
            { name: "Uniqlo Heattech Long Sleeve", quantity: 2, price: 19.90 }
        ],
        totalPrice: 119.70,
        status: "delivered",
        trackingNumber: "1Z999AA10123456788",
        estimatedDelivery: "2024-11-13",
        deliveredDate: "2024-11-12",
        merchant: "Uniqlo.com"
    },

    // ============ AI ORDERS (AI Tools & Services) ============
    {
        id: "AI-2024120401",
        source: "AI",
        orderDate: "2024-12-04",
        items: [
            { name: "Midjourney Annual Pro Plan", quantity: 1, price: 288.00 }
        ],
        totalPrice: 288.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-04",
        merchant: "Midjourney",
        isDigital: true,
        isSubscription: false
    },
    {
        id: "AI-2024112901",
        source: "AI",
        orderDate: "2024-11-29",
        items: [
            { name: "Runway Gen-2 Credits Pack (1000)", quantity: 1, price: 100.00 }
        ],
        totalPrice: 100.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-29",
        merchant: "Runway ML",
        isDigital: true
    },
    {
        id: "AI-2024111801",
        source: "AI",
        orderDate: "2024-11-18",
        items: [
            { name: "ElevenLabs Voice Credits", quantity: 1, price: 22.00 }
        ],
        totalPrice: 22.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-18",
        merchant: "ElevenLabs",
        isDigital: true
    },
    {
        id: "AI-2024110501",
        source: "AI",
        orderDate: "2024-11-05",
        items: [
            { name: "Cursor IDE Pro - Annual", quantity: 1, price: 192.00 }
        ],
        totalPrice: 192.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-05",
        merchant: "Cursor",
        isDigital: true
    },
    {
        id: "AI-2024102801",
        source: "AI",
        orderDate: "2024-10-28",
        items: [
            { name: "Perplexity Pro - Annual", quantity: 1, price: 200.00 }
        ],
        totalPrice: 200.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-10-28",
        merchant: "Perplexity AI",
        isDigital: true
    },

    // ============ DIVIDED WE STAND ORDERS ============
    {
        id: "DWS-2024120301",
        source: "DIVIDED WE STAND",
        orderDate: "2024-12-03",
        items: [
            { name: "Limited Edition Graphic Tee", quantity: 1, price: 45.00 },
            { name: "Snapback Cap", quantity: 1, price: 35.00 }
        ],
        totalPrice: 80.00,
        status: "shipped",
        trackingNumber: "9400111899223847261539",
        estimatedDelivery: "2024-12-09",
        deliveredDate: null,
        merchant: "Divided We Stand"
    },
    {
        id: "DWS-2024112401",
        source: "DIVIDED WE STAND",
        orderDate: "2024-11-24",
        items: [
            { name: "Hoodie - Black Edition", quantity: 1, price: 85.00 }
        ],
        totalPrice: 85.00,
        status: "delivered",
        trackingNumber: "9400111899223726153949",
        estimatedDelivery: "2024-11-30",
        deliveredDate: "2024-11-29",
        merchant: "Divided We Stand"
    },
    {
        id: "DWS-2024111001",
        source: "DIVIDED WE STAND",
        orderDate: "2024-11-10",
        items: [
            { name: "Vinyl Sticker Pack", quantity: 2, price: 12.00 },
            { name: "Enamel Pin Set", quantity: 1, price: 18.00 }
        ],
        totalPrice: 42.00,
        status: "delivered",
        trackingNumber: "9400111899223615394828",
        estimatedDelivery: "2024-11-16",
        deliveredDate: "2024-11-15",
        merchant: "Divided We Stand"
    },

    // ============ BMW ORDERS ============
    {
        id: "BMW-2024120101",
        source: "BMW",
        orderDate: "2024-12-01",
        items: [
            { name: "BMW All-Weather Floor Mats", quantity: 1, price: 175.00 }
        ],
        totalPrice: 175.00,
        status: "shipped",
        trackingNumber: "1Z999AA10123456790",
        estimatedDelivery: "2024-12-08",
        deliveredDate: null,
        merchant: "BMW Parts"
    },
    {
        id: "BMW-2024112201",
        source: "BMW",
        orderDate: "2024-11-22",
        items: [
            { name: "BMW Touch-Up Paint Pen", quantity: 1, price: 32.00 },
            { name: "BMW Microfiber Cleaning Kit", quantity: 1, price: 45.00 }
        ],
        totalPrice: 77.00,
        status: "delivered",
        trackingNumber: "1Z999AA10123456791",
        estimatedDelivery: "2024-11-28",
        deliveredDate: "2024-11-27",
        merchant: "BMW Parts"
    },
    {
        id: "BMW-2024111201",
        source: "BMW",
        orderDate: "2024-11-12",
        items: [
            { name: "BMW Oil Change Service", quantity: 1, price: 125.00 }
        ],
        totalPrice: 125.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-12",
        merchant: "BMW Service Center",
        isService: true
    },
    {
        id: "BMW-2024102901",
        source: "BMW",
        orderDate: "2024-10-29",
        items: [
            { name: "BMW Cargo Net", quantity: 1, price: 65.00 },
            { name: "BMW Trunk Organizer", quantity: 1, price: 89.00 }
        ],
        totalPrice: 154.00,
        status: "delivered",
        trackingNumber: "1Z999AA10123456792",
        estimatedDelivery: "2024-11-04",
        deliveredDate: "2024-11-03",
        merchant: "BMW Parts"
    },

    // ============ QUALITY WEB TIME ORDERS ============
    {
        id: "QWT-2024120401",
        source: "QUALITY WEB TIME",
        orderDate: "2024-12-04",
        items: [
            { name: "Web Hosting - Annual Renewal", quantity: 1, price: 120.00 }
        ],
        totalPrice: 120.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-04",
        merchant: "Quality Web Time",
        isDigital: true
    },
    {
        id: "QWT-2024112601",
        source: "QUALITY WEB TIME",
        orderDate: "2024-11-26",
        items: [
            { name: "SSL Certificate - 2 Year", quantity: 1, price: 89.00 }
        ],
        totalPrice: 89.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-26",
        merchant: "Quality Web Time",
        isDigital: true
    },
    {
        id: "QWT-2024111501",
        source: "QUALITY WEB TIME",
        orderDate: "2024-11-15",
        items: [
            { name: "Domain Registration - johnzur.com", quantity: 1, price: 15.00 },
            { name: "Domain Privacy Protection", quantity: 1, price: 12.00 }
        ],
        totalPrice: 27.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-15",
        merchant: "Quality Web Time",
        isDigital: true
    },
    {
        id: "QWT-2024102001",
        source: "QUALITY WEB TIME",
        orderDate: "2024-10-20",
        items: [
            { name: "Website Maintenance Package", quantity: 1, price: 199.00 }
        ],
        totalPrice: 199.00,
        status: "delivered",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-10-20",
        merchant: "Quality Web Time",
        isDigital: true,
        isService: true
    },

    // ============ SUBSCRIPTIONS ============
    {
        id: "SUB-CLAUDE-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "Claude Pro - Monthly", quantity: 1, price: 20.00 }
        ],
        totalPrice: 20.00,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "Anthropic",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-CHATGPT-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "ChatGPT Plus - Monthly", quantity: 1, price: 20.00 }
        ],
        totalPrice: 20.00,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "OpenAI",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-SPOTIFY-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "Spotify Premium - Monthly", quantity: 1, price: 10.99 }
        ],
        totalPrice: 10.99,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "Spotify",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-NETFLIX-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "Netflix Premium - Monthly", quantity: 1, price: 22.99 }
        ],
        totalPrice: 22.99,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "Netflix",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-YOUTUBE-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "YouTube Premium - Monthly", quantity: 1, price: 13.99 }
        ],
        totalPrice: 13.99,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "Google",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-ICLOUD-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "iCloud+ 200GB - Monthly", quantity: 1, price: 2.99 }
        ],
        totalPrice: 2.99,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "Apple",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-GITHUB-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-12-01",
        items: [
            { name: "GitHub Copilot - Monthly", quantity: 1, price: 10.00 }
        ],
        totalPrice: 10.00,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-12-01",
        merchant: "GitHub",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-01-01"
    },
    {
        id: "SUB-AMAZON-202412",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-11-15",
        items: [
            { name: "Amazon Prime - Annual", quantity: 1, price: 139.00 }
        ],
        totalPrice: 139.00,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-15",
        merchant: "Amazon",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2025-11-15"
    },
    {
        id: "SUB-ADOBE-202411",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-11-01",
        items: [
            { name: "Adobe Creative Cloud - Monthly", quantity: 1, price: 54.99 }
        ],
        totalPrice: 54.99,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-01",
        merchant: "Adobe",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2024-12-01"
    },
    {
        id: "SUB-FIGMA-202411",
        source: "SUBSCRIPTIONS",
        orderDate: "2024-11-01",
        items: [
            { name: "Figma Professional - Monthly", quantity: 1, price: 15.00 }
        ],
        totalPrice: 15.00,
        status: "active",
        trackingNumber: null,
        estimatedDelivery: null,
        deliveredDate: "2024-11-01",
        merchant: "Figma",
        isDigital: true,
        isSubscription: true,
        renewalDate: "2024-12-01"
    }
];

// Category color mapping
const CATEGORY_COLORS = {
    "AMAZON": "#FF9900",
    "PAYPAL": "#003087",
    "STORE": "#4CAF50",
    "AI": "#9C27B0",
    "DIVIDED WE STAND": "#E91E63",
    "BMW": "#1C69D4",
    "QUALITY WEB TIME": "#00BCD4",
    "SUBSCRIPTIONS": "#FF5722"
};

// Status labels and colors
const STATUS_CONFIG = {
    "delivered": { label: "Delivered", color: "#4CAF50", icon: "✓" },
    "shipped": { label: "Shipped", color: "#2196F3", icon: "📦" },
    "processing": { label: "Processing", color: "#FF9800", icon: "⏳" },
    "pending": { label: "Pending", color: "#9E9E9E", icon: "○" },
    "active": { label: "Active", color: "#9C27B0", icon: "↻" },
    "cancelled": { label: "Cancelled", color: "#F44336", icon: "✗" }
};

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ORDERS_DATA, CATEGORY_COLORS, STATUS_CONFIG };
}
