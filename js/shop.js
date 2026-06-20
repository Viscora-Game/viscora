export const SHOP_ITEMS = [
    // Trails
    {
        id: 'default_trail',
        name: 'Varsayılan İz',
        category: 'trail',
        price: 0,
        description: 'Klasik viskozite renginde iz bırakır.',
        config: { color: 'default', type: 'trail' }
    },
    {
        id: 'fire_trail',
        name: '🔥 Ateş İzi',
        category: 'trail',
        price: 25,
        description: 'Arkanızda yanan alev parçacıkları bırakır.',
        config: { color: 'fire', type: 'steam' }
    },
    {
        id: 'ice_trail',
        name: '❄️ Buz İzi',
        category: 'trail',
        price: 25,
        description: 'Soğuk kış rüzgarları ve buz parçacıkları.',
        config: { color: 'ice', type: 'trail' }
    },
    {
        id: 'gold_trail',
        name: '🌟 Altın İzi',
        category: 'trail',
        price: 35,
        description: 'Zengin altın ışıltıları saçan parçacıklar.',
        config: { color: 'gold', type: 'shift' }
    },
    {
        id: 'rainbow_trail',
        name: '🌈 Gökkuşağı İzi',
        category: 'trail',
        price: 50,
        description: 'Sürekli renk değiştiren büyüleyici gökkuşağı.',
        config: { color: 'rainbow', type: 'trail' }
    },

    // Glows
    {
        id: 'default_glow',
        name: 'Varsayılan Parlama',
        category: 'glow',
        price: 0,
        description: 'Karakterin kendi renginde normal neon parlama.',
        config: { color: 'default' }
    },
    {
        id: 'gold_glow',
        name: '👑 Altın Aura',
        category: 'glow',
        price: 30,
        description: 'Göz alıcı asil altın sarısı parıltı.',
        config: { color: '#f59e0b' }
    },
    {
        id: 'fire_glow',
        name: '🔥 Ateş Aurası',
        category: 'glow',
        price: 30,
        description: 'Radyaktif kırmızı renkte tehlikeli aura.',
        config: { color: '#ef4444' }
    },
    {
        id: 'diamond_glow',
        name: '💎 Elmas Aura',
        category: 'glow',
        price: 40,
        description: 'Berrak ve parlak bir elmas mavisi ışık.',
        config: { color: '#38bdf8' }
    },
    {
        id: 'night_glow',
        name: '🌙 Gece Aurası',
        category: 'glow',
        price: 40,
        description: 'Gizemli karanlık gecelerin kozmik mor aurası.',
        config: { color: '#8b5cf6' }
    },

    // Eyes
    {
        id: 'default_eyes',
        name: 'Varsayılan Gözler',
        category: 'eyes',
        price: 0,
        description: 'Karakterin orijinal sevimli bakışları.',
        config: { style: 'default' }
    },
    {
        id: 'angry_eyes',
        name: '😠 Kızgın Gözler',
        category: 'eyes',
        price: 20,
        description: 'Düşmanlara korku salan sert çatık kaşlar.',
        config: { style: 'angry' }
    },
    {
        id: 'cute_eyes',
        name: '🥺 İri Gözler',
        category: 'eyes',
        price: 20,
        description: 'Işıltılı, kocaman ve sevimli anime gözleri.',
        config: { style: 'cute' }
    },
    {
        id: 'focused_eyes',
        name: '😎 Odaklanmış',
        category: 'eyes',
        price: 25,
        description: 'Hız ve konsantrasyonu yansıtan dar bakışlar.',
        config: { style: 'focused' }
    },
    {
        id: 'pixel_eyes',
        name: '🤖 Piksel Gözler',
        category: 'eyes',
        price: 30,
        description: 'Retro tarzdaki kare 8-bit dijital gözler.',
        config: { style: 'pixel' }
    }
];

class ShopManager {
    constructor() {
        this.load();
    }

    load() {
        this.totalCrystals = parseInt(localStorage.getItem('viscora_total_crystals')) || 0;
        this.spentCrystals = parseInt(localStorage.getItem('viscora_spent_crystals')) || 0;
        
        try {
            this.ownedItems = JSON.parse(localStorage.getItem('viscora_owned_items'));
        } catch (e) {
            this.ownedItems = null;
        }
        if (!Array.isArray(this.ownedItems)) {
            this.ownedItems = ['default_trail', 'default_glow', 'default_eyes'];
        }

        this.activeTrail = localStorage.getItem('viscora_active_trail') || 'default_trail';
        this.activeGlow = localStorage.getItem('viscora_active_glow') || 'default_glow';
        this.activeEyes = localStorage.getItem('viscora_active_eyes') || 'default_eyes';
    }

    save() {
        localStorage.setItem('viscora_total_crystals', this.totalCrystals);
        localStorage.setItem('viscora_spent_crystals', this.spentCrystals);
        localStorage.setItem('viscora_owned_items', JSON.stringify(this.ownedItems));
        localStorage.setItem('viscora_active_trail', this.activeTrail);
        localStorage.setItem('viscora_active_glow', this.activeGlow);
        localStorage.setItem('viscora_active_eyes', this.activeEyes);
    }

    getBalance() {
        return Math.max(0, this.totalCrystals - this.spentCrystals);
    }

    addCrystals(count = 1) {
        this.totalCrystals += count;
        this.save();
        
        // Dispatch custom event to notify UI to refresh crystal counters
        window.dispatchEvent(new CustomEvent('viscora_crystals_changed', { detail: { balance: this.getBalance() } }));
    }

    purchase(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: 'Öğe bulunamadı.' };
        if (this.ownedItems.includes(itemId)) return { success: false, message: 'Bu öğeye zaten sahipsiniz.' };
        
        const price = item.price;
        if (this.getBalance() < price) {
            return { success: false, message: 'Yetersiz kristal bakiyesi.' };
        }

        this.spentCrystals += price;
        this.ownedItems.push(itemId);
        this.save();

        window.dispatchEvent(new CustomEvent('viscora_crystals_changed', { detail: { balance: this.getBalance() } }));
        return { success: true };
    }

    equip(itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { success: false, message: 'Öğe bulunamadı.' };
        if (!this.ownedItems.includes(itemId)) return { success: false, message: 'Bu öğeye sahip değilsiniz.' };

        if (item.category === 'trail') {
            this.activeTrail = itemId;
        } else if (item.category === 'glow') {
            this.activeGlow = itemId;
        } else if (item.category === 'eyes') {
            this.activeEyes = itemId;
        }

        this.save();
        
        // Dispatch custom event to notify cosmetic changes
        window.dispatchEvent(new CustomEvent('viscora_cosmetics_changed', { detail: { activeTrail: this.activeTrail, activeGlow: this.activeGlow, activeEyes: this.activeEyes } }));
        return { success: true };
    }

    getActiveCosmetic(category) {
        if (category === 'trail') return this.activeTrail;
        if (category === 'glow') return this.activeGlow;
        if (category === 'eyes') return this.activeEyes;
        return 'default';
    }

    isOwned(itemId) {
        return this.ownedItems.includes(itemId);
    }
}

export const shopManager = new ShopManager();

// Expose to window for access from non-module scripts or rendering context
window.shopManager = shopManager;
window.SHOP_ITEMS = SHOP_ITEMS;
