import { GameManager } from './game.js?v=v145';
import { audio } from './audio.js?v=v145';

// Oyun Başlatma Girişi
window.addEventListener('DOMContentLoaded', () => {
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
});


