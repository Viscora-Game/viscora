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
            likedMaps: 'viscora_liked_maps'
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

    static async restoreProgress(syncCode) {
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
                console.warn('Cloud restore failed:', errData.error || response.statusText);
                return { success: false, error: errData.error || 'Geçersiz veya bulunamayan kurtarma kodu.' };
            }

            const res = await response.json();
            if (res.status === 'success' && res.saveData) {
                this.applySaveData(res.saveData);
                if (res.userId) {
                    localStorage.setItem('viscora_user_id', res.userId);
                }
                localStorage.setItem('viscora_sync_code', syncCode.trim().toUpperCase());
                console.log('Cloud restore successful.');
                return { success: true };
            }
        } catch (e) {
            console.warn('Cloud restore network error:', e);
            return { success: false, error: 'Kurtarma sırasında ağ hatası oluştu.' };
        }
        return { success: false, error: 'Bilinmeyen hata.' };
    }
}
