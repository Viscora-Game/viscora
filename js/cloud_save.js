const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://viscora.onrender.com';

export class CloudSaveManager {
    static getLocalKeys() {
        return {
            unlockedLevel: 'viscora_unlocked_level',
            stars: 'viscora_stars',
            progress: 'viscora_progress',
            totalCrystals: 'viscora_total_crystals',
            spentCrystals: 'viscora_spent_crystals',
            ownedItems: 'viscora_owned_items',
            activeTrail: 'viscora_active_trail',
            activeAccessory: 'viscora_active_accessory',
            activeEyes: 'viscora_active_eyes',
            authorName: 'viscora_author_name',
            difficulty: 'viscora_difficulty',
            customControls: 'viscora_custom_controls',
            likedMaps: 'viscora_liked_maps',
            balanceSig: 'viscora_balance_sig'
        };
    }

    static getSaveData() {
        const keys = this.getLocalKeys();
        const data = {};
        for (const [key, storageKey] of Object.entries(keys)) {
            const val = localStorage.getItem(storageKey);
            if (val !== null) {
                try {
                    data[key] = JSON.parse(val);
                } catch {
                    data[key] = val;
                }
            }
        }
        return data;
    }

    static generateSignature(total, spent, ownedStr) {
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

    static applySaveData(data) {
        if (!data || typeof data !== 'object') return false;
        const keys = this.getLocalKeys();
        for (const [key, storageKey] of Object.entries(keys)) {
            if (data[key] !== undefined) {
                const val = data[key];
                if (typeof val === 'object') {
                    localStorage.setItem(storageKey, JSON.stringify(val));
                } else {
                    localStorage.setItem(storageKey, String(val));
                }
            }
        }

        // Legacy support: if signature is not in the restored data, generate it dynamically to prevent resetting
        if (data.balanceSig === undefined) {
            const total = data.totalCrystals !== undefined ? Number(data.totalCrystals) : 0;
            const spent = data.spentCrystals !== undefined ? Number(data.spentCrystals) : 0;
            let ownedItems = data.ownedItems || ['default_trail', 'default_accessory', 'default_eyes'];
            const ownedStr = typeof ownedItems === 'string' ? ownedItems : JSON.stringify(ownedItems);

            const sig = this.generateSignature(total, spent, ownedStr);
            localStorage.setItem('viscora_balance_sig', sig);
            console.log('Regenerated validation signature for restored crystal balance:', sig);
        }

        return true;
    }

    static async saveProgress() {
        let myUserId = localStorage.getItem('viscora_user_id');
        if (!myUserId) {
            myUserId = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            localStorage.setItem('viscora_user_id', myUserId);
        }

        const saveData = this.getSaveData();
        
        try {
            const response = await fetch(`${API_BASE}/api/user/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: myUserId,
                    saveData: saveData
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.warn('Cloud sync failed:', errData.error || response.statusText);
                return { success: false, error: errData.error || 'Server error' };
            }

            const res = await response.json();
            if (res.status === 'success') {
                if (res.syncCode) {
                    localStorage.setItem('viscora_sync_code', res.syncCode);
                }
                console.log('Cloud sync successful. SyncCode:', res.syncCode);
                return { success: true, syncCode: res.syncCode, lastUpdated: res.lastUpdated };
            }
        } catch (e) {
            console.warn('Cloud sync network error:', e);
            return { success: false, error: 'Ağ hatası. Çevrimdışı kaydedildi.' };
        }
        return { success: false, error: 'Bilinmeyen hata.' };
    }

    static async fetchProgress(syncCode) {
        if (!syncCode || syncCode.trim().length !== 6) {
            return { success: false, error: 'Geçersiz kod formatı. Kod 6 haneli olmalıdır.' };
        }

        try {
            const response = await fetch(`${API_BASE}/api/user/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    syncCode: syncCode.trim().toUpperCase()
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.warn('Cloud fetch failed:', errData.error || response.statusText);
                return { success: false, error: errData.error || 'Geçersiz veya bulunamayan kurtarma kodu.' };
            }

            const res = await response.json();
            if (res.status === 'success' && res.saveData) {
                return { 
                    success: true, 
                    userId: res.userId, 
                    saveData: res.saveData,
                    lastUpdated: res.lastUpdated
                };
            }
        } catch (e) {
            console.warn('Cloud fetch network error:', e);
            return { success: false, error: 'Bulut kaydı sorgulanırken ağ hatası oluştu.' };
        }
        return { success: false, error: 'Bilinmeyen hata.' };
    }
}
