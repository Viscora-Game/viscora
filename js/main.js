import { GameManager } from './game.js?v=v378';
import { audio } from './audio.js?v=v378';
import { CloudSaveManager } from './cloud_save.js?v=v378';

const initGame = () => {
    const studioIntro = document.getElementById('cybercore-studio-intro');
    const splash = document.getElementById('splash-screen');

    // Intro oynarken splash screen'i geçici olarak gizle
    if (splash && studioIntro) {
        splash.style.display = 'none';
    }

    // CyberCore Interactive Studio Intro Ekranı Mantığı
    if (studioIntro) {
        window.isCyberCoreIntroActive = true;

        // Tıklanıp geçilmeyi kesinlikle engelle (Unskippable Intro)
        const preventSkip = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            }
        };
        studioIntro.addEventListener('click', preventSkip, true);
        studioIntro.addEventListener('touchend', preventSkip, true);
        studioIntro.addEventListener('pointerdown', preventSkip, true);
        studioIntro.addEventListener('keydown', preventSkip, true);

        // Yalnızca Stüdyo Çınlama Sesini Çal (Mobil APK ve Web Autoplay uyumlu)
        const playIntroSound = () => {
            try {
                const studioAudio = new Audio('assets/audio/cybercore_sound_2_hollywood.wav');
                studioAudio.play().catch(() => {
                    const unlockWebAudio = () => {
                        try {
                            studioAudio.play().catch(() => {});
                        } catch(e) {}
                        window.removeEventListener('click', unlockWebAudio);
                        window.removeEventListener('touchend', unlockWebAudio);
                        window.removeEventListener('pointerdown', unlockWebAudio);
                    };
                    window.addEventListener('click', unlockWebAudio, { once: true });
                    window.addEventListener('touchend', unlockWebAudio, { once: true });
                    window.addEventListener('pointerdown', unlockWebAudio, { once: true });
                });
            } catch (e) {}
        };
        playIntroSound();

        // 1.2 saniye sonra stüdyo ekranını yumuşakça kaldır ve "BAŞLAMAK İÇİN EKRANA DOKUNUN" (Splash) ekranını getir
        setTimeout(() => {
            studioIntro.classList.add('fade-out');
            studioIntro.style.pointerEvents = 'none';
            studioIntro.style.display = 'none';
            window.isCyberCoreIntroActive = false;
            if (studioIntro.parentNode) {
                try { studioIntro.parentNode.removeChild(studioIntro); } catch(e) {}
            }
            // Intro bitti, şimdi "BAŞLAMAK İÇİN EKRANA DOKUNUN" ekranını göster!
            if (splash) {
                splash.style.display = 'flex';
                splash.classList.remove('hidden', 'fade-out');
            }
        }, 1200);
    } else {
        window.isCyberCoreIntroActive = false;
        if (splash) {
            splash.style.display = 'flex';
        }
    }

    // Mobilde performansı artırmak için pahalı canvas gölge efektlerini (shadowBlur) devre dışı bırak
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
        try {
            Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
                get() { return 0; },
                set(value) { /* gölgeyi yoksay */ },
                configurable: true
            });
            console.log("Mobile context: shadowBlur optimization activated.");
        } catch (e) {
            console.warn("Failed to optimize shadowBlur:", e);
        }
    }

    // Otomatik Bulut Eşitlemesi (Startup Sync): Oyuncu bağlıysa (Google ile) başlangıçta en güncel veriyi çek
    const syncCode = localStorage.getItem('viscora_sync_code');
    if (syncCode) {
        // Sayfa yüklenme hızını etkilememesi için 5 saniye gecikmeyle arka planda eşitle
        setTimeout(() => {
            CloudSaveManager.saveProgress().then(res => {
                try {
                    if (res && res.success) {
                        localStorage.removeItem('viscora_last_save_time_updated');
                        if (window.game && window.game.ui) {
                            window.game.ui.updateMenuCrystalsUI();
                            window.game.ui.updateAllCloudStatusUI();
                        }
                    }
                } catch (uiErr) {
                    console.warn("Startup sync UI update error:", uiErr);
                }
            }).catch(err => {
                console.warn("Otomatik başlangıç eşitleme hatası:", err);
            });
        }, 5000);
    }
    // Giriş Animasyonu (Splash Screen) Kontrolü
    const splash = document.getElementById('splash-screen');
    let splashTimeout = null;
    let removeTimeout = null;

    const removeSplash = () => {
        if (splash) {
            if (splashTimeout) clearTimeout(splashTimeout);
            if (removeTimeout) clearTimeout(removeTimeout);
            splash.classList.add('fade-out');
            splash.style.pointerEvents = 'none';
            splash.style.display = 'none';
            if (splash.parentNode) {
                try { splash.parentNode.removeChild(splash); } catch(e) {}
            }
        }
    };

    if (splash) {
        // SW güncellemesinden dolayı sayfa yenilendiyse, açılış ekranını beklemeden hemen kaldır
        const isSwReload = sessionStorage.getItem('viscora_sw_reloaded') === 'true';
        if (isSwReload) {
            sessionStorage.removeItem('viscora_sw_reloaded');
            removeSplash();
        }
    }

    // GameManager nesnesi oluşturulur (Canvas kimliğini veriyoruz)
    const game = new GameManager('game-canvas');

    // Tarayıcı güvenlik kısıtlamalarını aşmak için oyuncu Açılış Ekranına dokunduğunda oyuna geçer
    let splashUnlocked = false;
    const unlockAudio = (e) => {
        if (window.isCyberCoreIntroActive) return; // Stüdyo girisi aktifken tıklama dinleyicisini blokla
        if (e) {
            e.stopPropagation();
        }
        if (splashUnlocked) return;
        splashUnlocked = true;

        try {
            audio.init();
            audio.unlock();
            audio.setTheme('default');
            audio.startMusic();
        } catch(ae) {}

        removeSplash(); // Kullanıcı bizzat tıkladığında açılış ekranını tamamen kaldır
    };

    if (splash) {
        splash.addEventListener('click', unlockAudio);
        splash.addEventListener('touchend', unlockAudio);
    }

    // OYNA butonuna basıldığında ses aktifleştirilir (Tam ekran tetikleyicisi kaldırıldı)
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            // Ses aktivasyonu click handler ile zaten gerçekleşiyor
        });
    }
};

// DOMContentLoaded yarışı engellemek için durum kontrolü
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}



