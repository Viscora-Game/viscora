/**
 * VISCORA - AdMob Reklam ve 24 Saatlik Dinamik Geri Sayım Yöneticisi
 * Capacitor @capacitor-community/admob plugin ile native AdMob entegrasyonu.
 */

const ADMOB_CONFIG = {
    appId: 'ca-app-pub-5810332619798187~2648255737',
    bannerId: 'ca-app-pub-5810332619798187/6308299147',
    interstitialId: 'ca-app-pub-5810332619798187/8349043080',
    skipLevelId: 'ca-app-pub-5810332619798187/9996528642',
    reviveId: 'ca-app-pub-5810332619798187/2049489939',
    crystalId: 'ca-app-pub-5810332619798187/8798569413',
    
    // Günlük kullanım limitleri
    MAX_SKIPS_PER_24H: 3,
    MAX_REVIVES_PER_24H: 5,
    COOLDOWN_24H_MS: 24 * 60 * 60 * 1000 // 24 Saat (Milisaniye)
};

class AdMobManager {
    constructor() {
        this.initialized = false;
        this.bannerVisible = false;
        this.admobPlugin = null;
        this.completedLevelsCount = 0;
        this.init();
    }

    async init() {
        try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
                this.admobPlugin = window.Capacitor.Plugins.AdMob;
            } else if (window.Capacitor) {
                try {
                    const admobModule = await import('@capacitor-community/admob');
                    this.admobPlugin = admobModule.AdMob;
                } catch(e) {
                    console.log("ℹ️ AdMob modülü dinamik olarak yüklenemedi, global deneniyor...");
                }
            }

            if (this.admobPlugin) {
                await this.admobPlugin.initialize({
                    initializeForTesting: false
                });
                this.initialized = true;
                console.log("✅ AdMob SDK başarıyla başlatıldı (Capacitor Native).");
                this.preloadInterstitial();
                setTimeout(() => {
                    if (!this.bannerVisible && !window.isCyberCoreIntroActive) {
                        this.showBanner();
                    }
                }, 2500);
            } else {
                console.log("ℹ️ AdMob plugin bulunamadı. Web/Test modunda çalışılıyor.");
            }
        } catch (err) {
            console.warn("⚠️ AdMob başlatma hatası:", err);
        }
    }

    formatRemainingTime(ms) {
        if (ms <= 0) return '0 saniye';
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours} saat ${minutes} dakika`;
        } else if (minutes > 0) {
            return `${minutes} dakika ${seconds} saniye`;
        } else {
            return `${seconds} saniye`;
        }
    }

    getSkipStatus() {
        const now = Date.now();
        let startTime = parseInt(localStorage.getItem('viscora_ad_skip_start_time')) || 0;
        let count = parseInt(localStorage.getItem('viscora_ad_skip_count')) || 0;

        if (startTime > 0 && now - startTime >= ADMOB_CONFIG.COOLDOWN_24H_MS) {
            localStorage.removeItem('viscora_ad_skip_start_time');
            localStorage.setItem('viscora_ad_skip_count', '0');
            startTime = 0;
            count = 0;
        }

        const remainingMs = startTime > 0 ? (startTime + ADMOB_CONFIG.COOLDOWN_24H_MS) - now : 0;
        const available = count < ADMOB_CONFIG.MAX_SKIPS_PER_24H;

        return {
            available: available,
            count: count,
            max: ADMOB_CONFIG.MAX_SKIPS_PER_24H,
            remainingMs: Math.max(0, remainingMs),
            formattedTime: this.formatRemainingTime(remainingMs)
        };
    }

    getReviveStatus() {
        const now = Date.now();
        let startTime = parseInt(localStorage.getItem('viscora_ad_revive_start_time')) || 0;
        let count = parseInt(localStorage.getItem('viscora_ad_revive_count')) || 0;

        if (startTime > 0 && now - startTime >= ADMOB_CONFIG.COOLDOWN_24H_MS) {
            localStorage.removeItem('viscora_ad_revive_start_time');
            localStorage.setItem('viscora_ad_revive_count', '0');
            startTime = 0;
            count = 0;
        }

        const remainingMs = startTime > 0 ? (startTime + ADMOB_CONFIG.COOLDOWN_24H_MS) - now : 0;
        const available = count < ADMOB_CONFIG.MAX_REVIVES_PER_24H;

        return {
            available: available,
            count: count,
            max: ADMOB_CONFIG.MAX_REVIVES_PER_24H,
            remainingMs: Math.max(0, remainingMs),
            formattedTime: this.formatRemainingTime(remainingMs)
        };
    }

    triggerSkipAd(onSuccess, onError) {
        const status = this.getSkipStatus();
        if (!status.available) {
            if (onError) onError(`Günlük bölüm atlama sınırına ulaşıldı (${status.max}/${status.max}). Kalan süre: ${status.formattedTime}`);
            return;
        }

        this.showRewardedAd(ADMOB_CONFIG.skipLevelId, () => {
            const now = Date.now();
            let startTime = parseInt(localStorage.getItem('viscora_ad_skip_start_time')) || 0;
            let count = parseInt(localStorage.getItem('viscora_ad_skip_count')) || 0;

            if (count === 0 || startTime === 0) {
                localStorage.setItem('viscora_ad_skip_start_time', now.toString());
            }
            localStorage.setItem('viscora_ad_skip_count', (count + 1).toString());

            if (onSuccess) onSuccess();
        }, onError);
    }

    triggerReviveAd(onSuccess, onError) {
        const status = this.getReviveStatus();
        if (!status.available) {
            if (onError) onError(`Günlük checkpoint yeniden başlama sınırına ulaşıldı (${status.max}/${status.max}). Kalan süre: ${status.formattedTime}`);
            return;
        }

        this.showRewardedAd(ADMOB_CONFIG.reviveId, () => {
            const now = Date.now();
            let startTime = parseInt(localStorage.getItem('viscora_ad_revive_start_time')) || 0;
            let count = parseInt(localStorage.getItem('viscora_ad_revive_count')) || 0;

            if (count === 0 || startTime === 0) {
                localStorage.setItem('viscora_ad_revive_start_time', now.toString());
            }
            localStorage.setItem('viscora_ad_revive_count', (count + 1).toString());

            if (onSuccess) onSuccess();
        }, onError);
    }

    getCrystalStatus() {
        const now = Date.now();
        let startTime = parseInt(localStorage.getItem('viscora_ad_crystal_start_time')) || 0;
        let count = parseInt(localStorage.getItem('viscora_ad_crystal_count')) || 0;

        if (startTime > 0 && now - startTime >= ADMOB_CONFIG.COOLDOWN_24H_MS) {
            localStorage.removeItem('viscora_ad_crystal_start_time');
            localStorage.setItem('viscora_ad_crystal_count', '0');
            startTime = 0;
            count = 0;
        }

        const remainingMs = startTime > 0 ? (startTime + ADMOB_CONFIG.COOLDOWN_24H_MS) - now : 0;
        const available = count < 3;

        return {
            available: available,
            count: count,
            remainingCount: Math.max(0, 3 - count),
            max: 3,
            remainingMs: Math.max(0, remainingMs),
            formattedTime: this.formatRemainingTime(remainingMs)
        };
    }

    triggerCrystalAd(onSuccess, onError) {
        const status = this.getCrystalStatus();
        if (!status.available) {
            if (onError) onError(`Günlük hediye kristal sınırına ulaşıldı (3/3). Kalan süre: ${status.formattedTime}`);
            return;
        }

        this.showRewardedAd(ADMOB_CONFIG.crystalId, () => {
            const now = Date.now();
            let startTime = parseInt(localStorage.getItem('viscora_ad_crystal_start_time')) || 0;
            let count = parseInt(localStorage.getItem('viscora_ad_crystal_count')) || 0;

            if (count === 0 || startTime === 0) {
                localStorage.setItem('viscora_ad_crystal_start_time', now.toString());
            }
            localStorage.setItem('viscora_ad_crystal_count', (count + 1).toString());

            if (onSuccess) onSuccess();
        }, onError);
    }

    trackLevelCompletion(onComplete) {
        let count = parseInt(localStorage.getItem('viscora_completed_levels_count')) || 0;
        count++;
        localStorage.setItem('viscora_completed_levels_count', count.toString());
        console.log(`🎮 Bölüm çıkış/tamamlama sayısı: ${count}/1`);

        localStorage.setItem('viscora_completed_levels_count', '0');
        this.triggerInterstitialAd(onComplete);
    }

    trackShopPurchase(onComplete) {
        let count = parseInt(localStorage.getItem('viscora_shop_purchases_count')) || 0;
        count++;
        localStorage.setItem('viscora_shop_purchases_count', count.toString());
        console.log(`🛍️ Dükkan satın alım sayısı: ${count}/2`);

        if (count >= 2) {
            localStorage.setItem('viscora_shop_purchases_count', '0');
            this.triggerInterstitialAd(onComplete);
        } else {
            if (onComplete) onComplete();
        }
    }

    async preloadInterstitial() {
        if (this.admobPlugin && this.initialized) {
            try {
                await this.admobPlugin.prepareInterstitial({
                    adId: ADMOB_CONFIG.interstitialId,
                    isTesting: false
                });
                console.log("⚡ Geçiş reklamı arka planda hazırlandı (Preloaded).");
            } catch (e) {
                try {
                    await this.admobPlugin.prepareInterstitial({
                        adId: 'ca-app-pub-3940256099942544/1033173712',
                        isTesting: true
                    });
                    console.log("⚡ Test Geçiş reklamı arka planda hazırlandı.");
                } catch(e2) {}
            }
        }
    }

    async triggerInterstitialAd(onComplete) {
        console.log("📺 Geçiş reklamı tetiklendi...");
        let callbackCalled = false;
        const safeComplete = () => {
            if (callbackCalled) return;
            callbackCalled = true;
            if (onComplete) onComplete();
        };

        const safetyTimer = setTimeout(() => {
            console.warn("⚠️ Reklam zaman aşımına uğradı, menüye geçiliyor.");
            this._hideAdLoadingOverlay();
            safeComplete();
        }, 4500);

        if (this.admobPlugin && this.initialized) {
            try {
                try { await this.admobPlugin.hideBanner(); } catch(e) {}

                const eventNames = ['onInterstitialAdDismissed', 'interstitialAdDismissed', 'interstitialDismissed', 'dismissed'];
                const handlers = [];
                const handleAdClose = (evtName) => {
                    console.log(`ℹ️ Geçiş reklamı kapatıldı (Etkinlik: ${evtName}).`);
                    clearTimeout(safetyTimer);
                    this._hideAdLoadingOverlay();
                    handlers.forEach(h => { try { h.remove(); } catch(e){} });
                    setTimeout(() => this.preloadInterstitial(), 400);
                    safeComplete();
                };

                eventNames.forEach(evt => {
                    try {
                        const h = this.admobPlugin.addListener(evt, () => handleAdClose(evt));
                        if (h) handlers.push(h);
                    } catch(e) {}
                });

                let prepareSuccess = false;
                try {
                    await this.admobPlugin.prepareInterstitial({
                        adId: ADMOB_CONFIG.interstitialId,
                        isTesting: false
                    });
                    prepareSuccess = true;
                } catch(peReal) {
                    console.warn("Gerçek geçiş reklamı dolmadı (No Fill), Test Reklamı deneniyor:", peReal);
                    try {
                        await this.admobPlugin.prepareInterstitial({
                            adId: 'ca-app-pub-3940256099942544/1033173712',
                            isTesting: true
                        });
                        prepareSuccess = true;
                    } catch(peTest) {
                        console.warn("Test geçiş reklamı da hazırlanamadı:", peTest);
                    }
                }

                this._hideAdLoadingOverlay();
                if (prepareSuccess) {
                    await this.admobPlugin.showInterstitial();
                } else {
                    clearTimeout(safetyTimer);
                    safeComplete();
                }
            } catch (err) {
                console.warn("⚠️ Geçiş reklamı gösterim hatası:", err);
                clearTimeout(safetyTimer);
                this._hideAdLoadingOverlay();
                safeComplete();
            }
        } else {
            console.log("ℹ️ Web fallback: Geçiş reklamı atlanıyor.");
            clearTimeout(safetyTimer);
            safeComplete();
        }
    }

    _showAdLoadingOverlay() {
        this._hideAdLoadingOverlay();
        const overlay = document.createElement('div');
        overlay.id = 'admob-loading-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px); z-index: 999999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: #fff; font-family: sans-serif; gap: 12px; pointer-events: auto;
        `;
        overlay.innerHTML = `
            <div style="width: 38px; height: 38px; border: 3.5px solid rgba(255,255,255,0.15); border-top-color: #00f2fe; border-radius: 50%; animation: adSpin 0.8s linear infinite;"></div>
            <div style="font-weight: 800; font-size: 1rem; color: #00f2fe; text-shadow: 0 0 10px rgba(0,242,254,0.5); letter-spacing: 0.5px;">🎬 Reklam Hazırlanıyor...</div>
            <style>@keyframes adSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(overlay);
    }

    _hideAdLoadingOverlay() {
        const el = document.getElementById('admob-loading-overlay');
        if (el) el.remove();
    }

    async showRewardedAd(adUnitId, onSuccess, onError) {
        console.log(`🎬 Ödüllü reklam hazırlanıyor... ID: ${adUnitId}`);
        this._showAdLoadingOverlay();

        if (this.admobPlugin && this.initialized) {
            try {
                const options = {
                    adId: adUnitId,
                    isTesting: false
                };

                let rewardEarned = false;

                const rewardHandler1 = this.admobPlugin.addListener('onRewardedVideoAdReward', () => {
                    console.log("✅ Ödüllü reklam: Ödül kazanıldı!");
                    rewardEarned = true;
                });
                const rewardHandler2 = this.admobPlugin.addListener('rewarded', () => {
                    console.log("✅ Ödüllü reklam: Ödül kazanıldı!");
                    rewardEarned = true;
                });

                const dismissHandler = this.admobPlugin.addListener('onRewardedVideoAdDismissed', () => {
                    console.log("ℹ️ Ödüllü reklam kapatıldı.");
                    this._hideAdLoadingOverlay();
                    try { if (rewardHandler1) rewardHandler1.remove(); } catch(e){}
                    try { if (rewardHandler2) rewardHandler2.remove(); } catch(e){}
                    try { if (dismissHandler) dismissHandler.remove(); } catch(e){}
                    if (rewardEarned && onSuccess) {
                        onSuccess();
                    }
                });

                try {
                    await this.admobPlugin.prepareRewardVideoAd(options);
                } catch(pe) {
                    console.warn("Prepare reward video warning:", pe);
                }
                
                this._hideAdLoadingOverlay();

                const rewardItem = await this.admobPlugin.showRewardVideoAd(options);
                if (rewardItem) {
                    rewardEarned = true;
                }

                if (rewardEarned && onSuccess) {
                    onSuccess();
                }

            } catch (err) {
                console.warn("⚠️ Native reklam gösterim hatası:", err);
                this._hideAdLoadingOverlay();
                if (onError) {
                    onError("Reklam şu an doldurulamadı, lütfen birkaç saniye sonra tekrar deneyin.");
                } else if (onSuccess) {
                    onSuccess();
                }
            }
        } else {
            console.log("ℹ️ Web simülasyonu: Reklam izleniyor (2 saniye)...");
            setTimeout(() => {
                this._hideAdLoadingOverlay();
                console.log("✅ Web simülasyonu: Ödül kazanıldı!");
                if (onSuccess) onSuccess();
            }, 2000);
        }
    }

    async showBanner(targetScreen) {
        if (typeof window !== 'undefined' && window.isCyberCoreIntroActive) {
            return;
        }
        const activeScreen = targetScreen || ((window.game && window.game.ui && typeof window.game.ui.getActiveScreenName === 'function') 
            ? window.game.ui.getActiveScreenName() : 'start');
            
        if (activeScreen === 'hud' || activeScreen === 'editor') {
            this.hideBanner();
            return;
        }
        
        if (this.admobPlugin && this.initialized) {
            this.bannerVisible = true;
            
            // 1. Önce resumeBanner ile dene
            try {
                await this.admobPlugin.resumeBanner();
                console.log("✅ Banner reklam resume edildi.");
                return;
            } catch (eResume) {
                // 2. resumeBanner olmadıysa Gerçek Banner ID ile göster
                try {
                    await this.admobPlugin.showBanner({
                        adId: ADMOB_CONFIG.bannerId,
                        adSize: 'ADAPTIVE_BANNER',
                        position: 'BOTTOM_CENTER',
                        isTesting: false,
                        margin: 0
                    });
                    console.log("✅ Gerçek Banner reklam yüklendi.");
                    return;
                } catch (eShowReal) {
                    // 3. Gerçek Banner No Fill dönerse, Google Test Banner ID ile göster!
                    try {
                        await this.admobPlugin.showBanner({
                            adId: 'ca-app-pub-3940256099942544/6300978111',
                            adSize: 'ADAPTIVE_BANNER',
                            position: 'BOTTOM_CENTER',
                            isTesting: true,
                            margin: 0
                        });
                        console.log("✅ Test Banner reklam yüklendi (Fallback).");
                    } catch (eShowTest) {
                        console.warn("⚠️ Banner gösterim hatası:", eShowReal, eShowTest);
                        this.bannerVisible = false;
                    }
                }
            }
        } else {
            const bannerContainer = document.getElementById('admob-banner-placeholder') || document.getElementById('admob-banner-container');
            if (bannerContainer) {
                bannerContainer.style.display = 'flex';
            }
            this.bannerVisible = true;
        }
    }

    async hideBanner() {
        this.bannerVisible = false;
        if (this.admobPlugin && this.initialized) {
            try {
                await this.admobPlugin.hideBanner();
                console.log("ℹ️ Banner reklam gizlendi.");
            } catch (err) {
                console.warn("⚠️ Banner gizleme hatası:", err);
            }
        }
        const bannerContainer = document.getElementById('admob-banner-placeholder') || document.getElementById('admob-banner-container');
        if (bannerContainer) {
            bannerContainer.style.display = 'none';
        }
    }
}

window.admobManager = new AdMobManager();
