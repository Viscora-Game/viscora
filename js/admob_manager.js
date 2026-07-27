/**
 * VISCORA - AdMob Reklam ve 24 Saatlik Dinamik Geri Sayım Yöneticisi
 * AdMob ID'lerini, banner gösterimlerini ve 24 saatlik sıklık sınırlarını yönetir.
 */

const ADMOB_CONFIG = {
    appId: 'ca-app-pub-5810332619798187~2648255737',
    bannerId: 'ca-app-pub-5810332619798187/6308299147',
    skipLevelId: 'ca-app-pub-5810332619798187/9996528642',
    reviveId: 'ca-app-pub-5810332619798187/2049489939',
    
    // Günlük kullanım limitleri
    MAX_SKIPS_PER_24H: 3,
    MAX_REVIVES_PER_24H: 5,
    COOLDOWN_24H_MS: 24 * 60 * 60 * 1000 // 24 Saat (Milisaniye)
};

class AdMobManager {
    constructor() {
        this.initialized = false;
        this.bannerVisible = false;
        this.init();
    }

    init() {
        // TWA veya Cordova AdMob SDK kontrolü
        if (window.admob || window.GoogleMobileAds || window.admobDeviceready) {
            this.initialized = true;
            console.log("✅ AdMob SDK algılandı.");
        } else {
            console.log("ℹ️ AdMob Web / Test Modunda başlatıldı.");
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

        // 24 saat dolduysa sayacı sıfırla
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

        // 24 saat dolduysa sayacı sıfırla
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
            // Reklam başarıyla izlendiğinde kullanımı kaydet
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
            // Reklam başarıyla izlendiğinde kullanımı kaydet
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
     * AdMob Ödüllü Reklam Gösterimi (Native SDK veya Test Simülasyonu)
     */
    showRewardedAd(adUnitId, onSuccess, onError) {
        console.log(`🎬 Ödüllü reklam yükleniyor... ID: ${adUnitId}`);

        if (window.admob && typeof window.admob.rewardVideo === 'object') {
            // AdMob Native Plugin
            window.admob.rewardVideo.prepare({ adId: adUnitId });
            window.admob.rewardVideo.show();

            const onReward = () => {
                document.removeEventListener('admob.rewardVideo.events.REWARD', onReward);
                if (onSuccess) onSuccess();
            };
            document.addEventListener('admob.rewardVideo.events.REWARD', onReward);
        } else {
            // Web veya Test ortamı simülasyonu
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
    showBanner() {
        const bannerContainer = document.getElementById('admob-banner-placeholder') || document.getElementById('admob-banner-container');
        if (bannerContainer) {
            bannerContainer.style.display = 'flex';
        }

        if (window.admob && typeof window.admob.banner === 'object') {
            window.admob.banner.prepare({
                adId: ADMOB_CONFIG.bannerId,
                isTesting: false,
                autoShow: true
            });
            this.bannerVisible = true;
        }
    }

    /**
     * Ana Menü Banner Reklamını Gizler
     */
    hideBanner() {
        const bannerContainer = document.getElementById('admob-banner-placeholder') || document.getElementById('admob-banner-container');
        if (bannerContainer) {
            bannerContainer.style.display = 'none';
        }

        if (window.admob && typeof window.admob.banner === 'object' && this.bannerVisible) {
            window.admob.banner.hide();
            this.bannerVisible = false;
        }
    }
}

// Global AdMob Manager Örneği
window.admobManager = new AdMobManager();
