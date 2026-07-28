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
    crystalId: 'ca-app-pub-5810332619798187/4935773657',
    
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
            // Capacitor plugin'ini yükle
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) {
                this.admobPlugin = window.Capacitor.Plugins.AdMob;
            } else if (window.Capacitor) {
                // Capacitor v5+ dinamik import
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
            } else {
                console.log("ℹ️ AdMob plugin bulunamadı. Web/Test modunda çalışılıyor.");
            }
        } catch (err) {
            console.warn("⚠️ AdMob başlatma hatası:", err);
        }
    }

    /**
     * Kalan milisaniyeyi "21 saat 34 dakika" veya "45 dakika 12 saniye" formatına dönüştürür.
     */
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

    /**
     * Bölüm Atlama (Skip Level) Durumunu ve Geri Sayımı Döner
     */
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

    /**
     * Yeniden Dene (Revive Checkpoint) Durumunu ve Geri Sayımı Döner
     */
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

    /**
     * Bölüm Atlama Reklamını Tetikler
     */
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

    /**
     * Yeniden Dene (Checkpoint Revive) Reklamını Tetikler
     */
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

    /**
     * Ücretsiz Kristal Ödüllü Reklamını Tetikler
     */
    triggerCrystalAd(onSuccess, onError) {
        this.showRewardedAd(ADMOB_CONFIG.crystalId, () => {
            if (onSuccess) onSuccess();
        }, onError);
    }

    /**
     * Geçiş Reklamı (Interstitial) Tetikler
     */
    async triggerInterstitialAd(onComplete) {
        console.log("📺 Geçiş reklamı tetiklendi...");
        if (this.admobPlugin && this.initialized) {
            try {
                await this.admobPlugin.prepareInterstitial({
                    adId: ADMOB_CONFIG.interstitialId,
                    isTesting: false
                });

                const dismissHandler = this.admobPlugin.addListener('onInterstitialAdDismissed', () => {
                    console.log("ℹ️ Geçiş reklamı kapatıldı.");
                    dismissHandler.remove();
                    if (onComplete) onComplete();
                });

                await this.admobPlugin.showInterstitial();
            } catch (err) {
                console.warn("⚠️ Geçiş reklamı gösterim hatası:", err);
                if (onComplete) onComplete();
            }
        } else {
            console.log("ℹ️ Web fallback: Geçiş reklamı atlanıyor.");
            if (onComplete) onComplete();
        }
    }

    /**
     * AdMob Ödüllü Reklam Gösterimi (Capacitor Native veya Web Fallback)
     */
    async showRewardedAd(adUnitId, onSuccess, onError) {
        console.log(`🎬 Ödüllü reklam yükleniyor... ID: ${adUnitId}`);

        if (this.admobPlugin && this.initialized) {
            try {
                // Capacitor Native AdMob SDK ile ödüllü reklam
                const options = {
                    adId: adUnitId,
                    isTesting: false
                };

                // Reklam yükle
                await this.admobPlugin.prepareRewardVideoAd(options);

                // Ödül event'ini dinle
                const rewardHandler = this.admobPlugin.addListener('onRewardedVideoAdReward', () => {
                    console.log("✅ Ödüllü reklam: Ödül kazanıldı!");
                    rewardHandler.remove();
                    if (onSuccess) onSuccess();
                });

                const dismissHandler = this.admobPlugin.addListener('onRewardedVideoAdDismissed', () => {
                    console.log("ℹ️ Ödüllü reklam kapatıldı.");
                    dismissHandler.remove();
                });

                // Reklamı göster
                await this.admobPlugin.showRewardVideoAd();

            } catch (err) {
                console.warn("⚠️ Native reklam hatası:", err);
                // Native başarısız olursa, ödülü yine de ver (kullanıcıyı cezalandırma)
                if (onSuccess) onSuccess();
            }
        } else {
            // Web/Test ortamı simülasyonu
            console.log("ℹ️ Web simülasyonu: Reklam izleniyor (1.2 saniye)...");
            setTimeout(() => {
                console.log("✅ Web simülasyonu: Ödül kazanıldı!");
                if (onSuccess) onSuccess();
            }, 1200);
        }
    }

    /**
     * Ana Menü Banner Reklamını Gösterir
     */
    async showBanner() {
        if (this.admobPlugin && this.initialized) {
            try {
                await this.admobPlugin.showBanner({
                    adId: ADMOB_CONFIG.bannerId,
                    adSize: 'ADAPTIVE_BANNER',
                    position: 'BOTTOM_CENTER',
                    isTesting: false
                });
                this.bannerVisible = true;
                console.log("✅ Banner reklam gösterildi.");
            } catch (err) {
                console.warn("⚠️ Banner gösterim hatası:", err);
            }
        } else {
            // Web fallback — placeholder'ı göster
            const bannerContainer = document.getElementById('admob-banner-placeholder') || document.getElementById('admob-banner-container');
            if (bannerContainer) {
                bannerContainer.style.display = 'flex';
            }
        }
    }

    /**
     * Ana Menü Banner Reklamını Gizler
     */
    async hideBanner() {
        if (this.admobPlugin && this.initialized && this.bannerVisible) {
            try {
                await this.admobPlugin.hideBanner();
                this.bannerVisible = false;
                console.log("ℹ️ Banner reklam gizlendi.");
            } catch (err) {
                console.warn("⚠️ Banner gizleme hatası:", err);
            }
        } else {
            const bannerContainer = document.getElementById('admob-banner-placeholder') || document.getElementById('admob-banner-container');
            if (bannerContainer) {
                bannerContainer.style.display = 'none';
            }
        }
    }
}

// Global AdMob Manager Örneği
window.admobManager = new AdMobManager();
