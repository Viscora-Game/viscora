const API_BASE = 'https://viscora.onrender.com';

export class CloudSaveManager {
    static getLocalKeys() {
        return {
            unlockedLevel: 'viscora_unlocked_level',
            stars: 'viscora_stars',
            progress: 'viscora_progress',
            totalCrystals: 'viscora_total_crystals',
            spentCrystals: 'viscora_spent_crystals',
            ownedItems: 'viscora_owned_items',
            achievements: 'viscora_achievements',
            statsDeaths: 'viscora_stats_deaths',
            statsFormShifts: 'viscora_stats_form_shifts',
            statsPatrolKills: 'viscora_stats_patrol_kills',
            statsGelKills: 'viscora_stats_gel_kills',
            statsUfoKills: 'viscora_stats_ufo_kills',
            activeTrail: 'viscora_active_trail',
            activeAccessory: 'viscora_active_accessory',
            activeEyes: 'viscora_active_eyes',
            authorName: 'viscora_author_name',
            difficulty: 'viscora_difficulty',
            customControls: 'viscora_custom_controls',
            likedMaps: 'viscora_liked_maps',
            balanceSig: 'viscora_balance_sig',
            avatar: 'viscora_avatar',
            dailyLastClaimDate: 'viscora_daily_last_claim_date',
            dailyStreak: 'viscora_daily_streak',
            draftSlot1: 'viscora_draft_slot_1',
            draftSlot2: 'viscora_draft_slot_2',
            draftSlot3: 'viscora_draft_slot_3',
            draftSlot4: 'viscora_draft_slot_4',
            draftSlot5: 'viscora_draft_slot_5',
            activeSlot: 'viscora_active_slot',
            profileLastChanged: 'viscora_profile_last_changed',
            weeklyProgress: 'viscora_weekly_progress',
            weeklyClaimed: 'viscora_weekly_claimed',
            weeklyResetTime: 'viscora_weekly_reset_time',
            lastSaveTime: 'viscora_last_save_time'
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
        
        const currentLocalTime = localStorage.getItem('viscora_last_save_time') || '0';
        const incomingTime = data.lastSaveTime ? String(data.lastSaveTime) : '0';
        if (incomingTime !== '0' && incomingTime !== currentLocalTime) {
            localStorage.setItem('viscora_last_save_time_updated', 'true');
        }

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

    static async saveProgress(force = false) {
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
                    saveData: saveData,
                    force: force
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
                if (res.saveData && Object.keys(res.saveData).length > 0) {
                    this.applySaveData(res.saveData);
                }
                console.log('Cloud sync successful. SyncCode:', res.syncCode);
                return { success: true, syncCode: res.syncCode, lastUpdated: res.lastUpdated };
            } else if (res.status === 'conflict') {
                console.log('Cloud sync conflict: Server has better progress. Restoring server progress.');
                this.applySaveData(res.saveData);
                if (res.syncCode) {
                    localStorage.setItem('viscora_sync_code', res.syncCode);
                }
                window.dispatchEvent(new CustomEvent('viscora_cloud_restored', { detail: { saveData: res.saveData } }));
                return { success: true, restored: true, syncCode: res.syncCode, lastUpdated: res.lastUpdated };
            }
        } catch (e) {
            console.warn('Cloud sync network error:', e);
            return { success: false, error: 'Ağ hatası. Çevrimdışı kaydedildi.' };
        }
        return { success: false, error: 'Bilinmeyen hata.' };
    }

    static async forceDownloadProgress() {
        try {
            const syncCode = localStorage.getItem('viscora_sync_code');
            if (!syncCode) {
                return { success: false, error: 'Kurtarma kodunuz bulunamadı. Lütfen önce hesabınızı bağlayın.' };
            }
            const res = await this.fetchProgress(syncCode);
            if (res.success && res.saveData) {
                this.applySaveData(res.saveData);
                return { success: true };
            }
            return { success: false, error: res.error || 'Buluttan indirme başarısız oldu.' };
        } catch (e) {
            return { success: false, error: e.message || 'Bir hata oluştu.' };
        }
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

    static async loginWithGoogle(idToken) {
        const currentUserId = localStorage.getItem('viscora_user_id') || '';
        try {
            const response = await fetch(`${API_BASE}/api/user/google_auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    idToken: idToken,
                    currentUserId: currentUserId
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                return { success: false, error: errData.error || 'Google girişi başarısız.' };
            }

            const res = await response.json();
            if (res.status === 'success') {
                localStorage.setItem('viscora_user_id', res.userId);
                if (res.syncCode) {
                    localStorage.setItem('viscora_sync_code', res.syncCode);
                }
                
                // Eğer sunucuda eski kayıt varsa yerel hafızaya uygula
                if (res.saveData && Object.keys(res.saveData).length > 0) {
                    this.applySaveData(res.saveData);
                }
                
                // Google e-posta adresini JWT içinden çözerek yerelde sakla (Arayüzde göstermek için)
                try {
                    const base64Url = idToken.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    const payload = JSON.parse(jsonPayload);
                    if (payload.email) {
                        localStorage.setItem('viscora_google_email', payload.email);
                    }
                } catch (e) {
                    console.warn('Google email decode error:', e);
                }

                return { success: true, userId: res.userId, syncCode: res.syncCode };
            }
        } catch (e) {
            console.error('Google Auth network error:', e);
            return { success: false, error: 'Ağ hatası. Google bağlantısı kurulamadı.' };
        }
        return { success: false, error: 'Bilinmeyen hata.' };
    }
}
