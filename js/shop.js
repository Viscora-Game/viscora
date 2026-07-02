import { CloudSaveManager } from './cloud_save.js?v=v207';

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
        price: 50,
        description: 'Arkanızda yanan alev parçacıkları bırakır.',
        config: { color: 'fire', type: 'steam' }
    },
    {
        id: 'ice_trail',
        name: '❄️ Buz İzi',
        category: 'trail',
        price: 50,
        description: 'Soğuk kış rüzgarları ve buz parçacıkları.',
        config: { color: 'ice', type: 'trail' }
    },
    {
        id: 'gold_trail',
        name: '🌟 Altın İzi',
        category: 'trail',
        price: 50,
        description: 'Zengin altın ışıltıları saçan parçacıklar.',
        config: { color: 'gold', type: 'shift' }
    },
    {
        id: 'rainbow_trail',
        name: '🌈 Gökkuşağı İzi',
        category: 'trail',
        price: 100,
        description: 'Sürekli renk değiştiren büyüleyici gökkuşağı.',
        config: { color: 'rainbow', type: 'trail' }
    },
    {
        id: 'lightning_trail',
        name: '⚡ Plazma Yıldırım İzi',
        category: 'trail',
        price: 120,
        description: 'Arkada parlayan elektrik kıvılcımları ve yıldırımlar bırakır.',
        config: { color: 'lightning', type: 'trail' }
    },
    {
        id: 'toxic_trail',
        name: '🧪 Siber Toksik İzi',
        category: 'trail',
        price: 110,
        description: 'Yavaşça havaya süzülen parlayan yeşil toksik baloncuklar.',
        config: { color: 'toxic', type: 'trail' }
    },
    {
        id: 'binary_trail',
        name: '💾 Matrix Veri İzi',
        category: 'trail',
        price: 130,
        description: 'Ekranda süzülen parlayan dijital sıfırlar ve birler.',
        config: { color: 'binary', type: 'trail' }
    },

    // Accessories
    {
        id: 'default_accessory',
        name: 'Aksesuar Yok',
        category: 'accessory',
        price: 0,
        description: 'Herhangi bir başlık veya şapka takmaz.',
        config: { type: 'none' }
    },
    {
        id: 'cowboy_hat',
        name: '🤠 Kovboy Şapkası',
        category: 'accessory',
        price: 30,
        description: 'Vahşi batının efsanevi kovboy şapkası.',
        config: { type: 'cowboy' }
    },
    {
        id: 'wizard_hat',
        name: '🧙 Büyücü Şapkası',
        category: 'accessory',
        price: 35,
        description: 'Gizemli güçler barındıran büyücü şapkası.',
        config: { type: 'wizard' }
    },
    {
        id: 'crown',
        name: '👑 Kral Tacı',
        category: 'accessory',
        price: 45,
        description: 'Viscora dünyasının gerçek yöneticilerine özel.',
        config: { type: 'crown' }
    },
    {
        id: 'santa_hat',
        name: '🎅 Noel Şapkası',
        category: 'accessory',
        price: 50,
        description: 'Kırmızı, yumuşak ve şenlikli noel şapkası.',
        config: { type: 'santa' }
    },

    {
        id: 'gaming_headset',
        name: '🎧 RGB Oyuncu Kulaklığı',
        category: 'accessory',
        price: 150,
        description: 'Yanal RGB ışık halkaları bulunan efor kulaklığı.',
        config: { type: 'gaming_headset' }
    },
    {
        id: 'cat_ears',
        name: '🐱 Siber Kedi Kulakları',
        category: 'accessory',
        price: 100,
        description: 'Yayıncıların favorisi neon ışıklı siber kulaklar.',
        config: { type: 'cat_ears' }
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
        price: 30,
        description: 'Düşmanlara korku salan sert çatık kaşlar.',
        config: { style: 'angry' }
    },
    {
        id: 'cute_eyes',
        name: '🥺 İri Gözler',
        category: 'eyes',
        price: 35,
        description: 'Işıltılı, kocaman ve sevimli anime gözleri.',
        config: { style: 'cute' }
    },
    {
        id: 'sunglasses',
        name: '😎 Güneş Gözlüğü',
        category: 'eyes',
        price: 45,
        description: 'Havalı ve tarz sahibi güneş gözlüğü.',
        config: { style: 'sunglasses' }
    },
    {
        id: 'joke_glasses',
        name: '🥸 Şaka Gözlüğü',
        category: 'eyes',
        price: 100,
        description: 'Büyük burunlu ve bıyıklı eğlenceli gözlük.',
        config: { style: 'joke' }
    },
    {
        id: 'cyber_matrix_eyes',
        name: '💻 Matrix Kod Gözler',
        category: 'eyes',
        price: 50,
        description: 'İçerisinde yeşil veri şeritleri akan siber gözler.',
        config: { style: 'matrix' }
    },
    {
        id: 'targeting_eye',
        name: '🎯 Terminatör Göz',
        category: 'eyes',
        price: 60,
        description: 'Tek taraflı lazer hedefleyicisi olan mekanik göz.',
        config: { style: 'targeting' }
    },
    {
        id: 'pixel_glasses',
        name: '👾 8-Bit Retro Gözlük',
        category: 'eyes',
        price: 45,
        description: 'Atari oyunlarından fırlamış ikonik retro gözlük.',
        config: { style: 'pixel' }
    },
    {
        id: 'cyber_visor',
        name: '🤖 Siber Vizör',
        category: 'eyes',
        price: 100,
        description: 'Neon pembe ve mavi parlayan siberpunk gözlük/vizör.',
        config: { style: 'cyber_visor' }
    }
];

class ShopManager {
    constructor() {
        this.load();
    }

    generateSignature(total, spent, ownedStr) {
        const salt = "ViscoraSecretSaltKey_2026_xYz";
        const str = `${total}_${spent}_${ownedStr}_${salt}`;
        let hash1 = 5381;
        let hash2 = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash1 = ((hash1 << 5) + hash1) + char;
            hash2 = char + (hash2 << 6) + (hash2 << 16) - hash2;
        }
        return (hash1 >>> 0).toString(16) + (hash2 >>> 0).toString(16);
    }

    load() {
        this.totalCrystals = parseInt(localStorage.getItem('viscora_total_crystals')) || 0;
        this.spentCrystals = parseInt(localStorage.getItem('viscora_spent_crystals')) || 0;
        
        let ownedStr = localStorage.getItem('viscora_owned_items');
        try {
            this.ownedItems = JSON.parse(ownedStr);
        } catch (e) {
            this.ownedItems = null;
        }
        if (!Array.isArray(this.ownedItems)) {
            this.ownedItems = ['default_trail', 'default_accessory', 'default_eyes'];
            ownedStr = JSON.stringify(this.ownedItems);
        }

        // Validate local signature to prevent client-side hacks (F12 Console / Storage edits)
        const storedSig = localStorage.getItem('viscora_balance_sig');
        const expectedSig = this.generateSignature(this.totalCrystals, this.spentCrystals, ownedStr);
        
        if ((this.totalCrystals > 0 || this.ownedItems.length > 3) && storedSig !== expectedSig) {
            console.warn("Kozmetik veri doğrulaması başarısız! Veriler sıfırlandı.");
            this.totalCrystals = 0;
            this.spentCrystals = 0;
            this.ownedItems = ['default_trail', 'default_accessory', 'default_eyes'];
            this.activeTrail = 'default_trail';
            this.activeAccessory = 'default_accessory';
            this.activeEyes = 'default_eyes';
            this.save();
            return;
        }

        this.activeTrail = localStorage.getItem('viscora_active_trail') || 'default_trail';
        this.activeAccessory = localStorage.getItem('viscora_active_accessory') || localStorage.getItem('viscora_active_glow') || 'default_accessory';
        this.activeEyes = localStorage.getItem('viscora_active_eyes') || 'default_eyes';

        // Migrate old glow and eye cosmetics to new accessories and glasses
        let migrated = false;
        const migrationMap = {
            'default_glow': 'default_accessory',
            'gold_glow': 'cowboy_hat',
            'fire_glow': 'wizard_hat',
            'diamond_glow': 'crown',
            'night_glow': 'santa_hat',
            'pixel_eyes': 'joke_glasses',
            'focused_eyes': 'sunglasses'
        };

        for (let i = 0; i < this.ownedItems.length; i++) {
            const oldId = this.ownedItems[i];
            if (migrationMap[oldId]) {
                const newId = migrationMap[oldId];
                if (!this.ownedItems.includes(newId)) {
                    this.ownedItems[i] = newId;
                } else {
                    this.ownedItems[i] = null;
                }
                migrated = true;
            }
        }
        this.ownedItems = this.ownedItems.filter(item => item !== null);

        if (migrationMap[this.activeAccessory]) {
            this.activeAccessory = migrationMap[this.activeAccessory];
            migrated = true;
        }
        if (migrationMap[this.activeEyes]) {
            this.activeEyes = migrationMap[this.activeEyes];
            migrated = true;
        }

        // Clean up any remaining default_glow references
        if (this.ownedItems.includes('default_glow')) {
            this.ownedItems = this.ownedItems.filter(item => item !== 'default_glow');
            migrated = true;
        }
        if (!this.ownedItems.includes('default_accessory')) {
            this.ownedItems.push('default_accessory');
            migrated = true;
        }

        if (migrated) {
            this.save();
        }
    }

    save() {
        const ownedStr = JSON.stringify(this.ownedItems);
        const sig = this.generateSignature(this.totalCrystals, this.spentCrystals, ownedStr);
        
        localStorage.setItem('viscora_last_save_time', Date.now().toString());
        localStorage.setItem('viscora_total_crystals', this.totalCrystals);
        localStorage.setItem('viscora_spent_crystals', this.spentCrystals);
        localStorage.setItem('viscora_owned_items', ownedStr);
        localStorage.setItem('viscora_balance_sig', sig);
        localStorage.setItem('viscora_active_trail', this.activeTrail);
        localStorage.setItem('viscora_active_accessory', this.activeAccessory);
        localStorage.setItem('viscora_active_eyes', this.activeEyes);
        
        // Sunucu ile yedekleme eşitlemesi
        CloudSaveManager.saveProgress();
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
        } else if (item.category === 'accessory') {
            this.activeAccessory = itemId;
        } else if (item.category === 'eyes') {
            this.activeEyes = itemId;
        }

        this.save();
        
        // Dispatch custom event to notify cosmetic changes
        window.dispatchEvent(new CustomEvent('viscora_cosmetics_changed', { detail: { activeTrail: this.activeTrail, activeAccessory: this.activeAccessory, activeEyes: this.activeEyes } }));
        return { success: true };
    }

    getActiveCosmetic(category) {
        if (category === 'trail') return this.activeTrail;
        if (category === 'accessory') return this.activeAccessory;
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


