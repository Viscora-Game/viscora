import { GameManager } from './game.js?v=v369';
import { audio } from './audio.js?v=v369';
import { CloudSaveManager } from './cloud_save.js?v=v369';

const initGame = () => {
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
        if (splash && !splash.classList.contains('fade-out')) {
            if (splashTimeout) clearTimeout(splashTimeout);
            if (removeTimeout) clearTimeout(removeTimeout);
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.remove();
            }, 600);
        }
    };

    if (splash) {
        // SW güncellemesinden dolayı sayfa yenilendiyse, açılış ekranını beklemeden hemen kaldır
        const isSwReload = sessionStorage.getItem('viscora_sw_reloaded') === 'true';
        if (isSwReload) {
            sessionStorage.removeItem('viscora_sw_reloaded');
            splash.remove();
        }
        // Otomatik kaldırma kaldırıldı; kullanıcının dokunarak tam ekrana geçmesi beklenir.
    }

    // GameManager nesnesi oluşturulur (Canvas kimliğini veriyoruz)
    const game = new GameManager('game-canvas');

    // Tarayıcı güvenlik kısıtlamalarını aşmak için oyuncu Açılış Ekranına dokunduğunda oyuna geçer
    let splashUnlocked = false;
    const unlockAudio = (e) => {
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

        removeSplash(); // Kullanıcı bizzat tıkladığında açılış ekranını kaldır
        
        // İlk kez giren oyuncu için ana menüye geçildiğinde profil kurulum modalını göster
        if (!localStorage.getItem('viscora_username_set') && !localStorage.getItem('viscora_google_email')) {
            setTimeout(() => {
                if (window.game && window.game.ui && typeof window.game.ui.openProfileModal === 'function') {
                    window.game.ui.openProfileModal(true);
                }
            }, 600);
        }
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



