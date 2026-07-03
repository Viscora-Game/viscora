import { GameManager } from './game.js?v=v332';
import { audio } from './audio.js?v=v332';
import { CloudSaveManager } from './cloud_save.js?v=v332';

const initGame = () => {
    // Otomatik Bulut Eşitlemesi (Startup Sync): Oyuncu bağlıysa başlangıçta en güncel veriyi çek
    const syncCode = localStorage.getItem('viscora_sync_code') || localStorage.getItem('viscora_user_id');
    if (syncCode) {
        CloudSaveManager.saveProgress().then(res => {
            if (res && res.success) {
                const hasUpdated = localStorage.getItem('viscora_last_save_time_updated') === 'true';
                if (hasUpdated) {
                    localStorage.removeItem('viscora_last_save_time_updated');
                    console.log("Daha güncel bir bulut kaydı bulundu, oyun yenileniyor...");
                    window.location.reload();
                }
            }
        }).catch(err => {
            console.warn("Otomatik başlangıç eşitleme hatası:", err);
        });
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

    // Tarayıcı güvenlik kısıtlamalarını aşmak için ilk etkileşimde ses motorunu hazırlarız
    const unlockAudio = () => {
        audio.init();
        audio.unlock();
        removeSplash(); // Dokunulduğunda splash'ı hemen geç
        
        // Dinleyicileri temizle
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchend', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };

    // 500ms gecikme ile dinleyicileri ekle ki sayfa yüklenirken kazara tetiklenmesin (event bleeding engellenir)
    setTimeout(() => {
        window.addEventListener('click', unlockAudio);
        window.addEventListener('touchend', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
    }, 500);

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


