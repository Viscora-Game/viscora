import { GameManager } from './game.js?v=v86';
import { audio } from './audio.js?v=v86';

// Oyun Başlatma Girişi
window.addEventListener('DOMContentLoaded', () => {
    // Giriş Animasyonu (Splash Screen) Kontrolü
    const splash = document.getElementById('splash-screen');
    if (splash) {
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => {
                splash.remove();
            }, 600);
        }, 3500);
    }

    // GameManager nesnesi oluşturulur (Canvas kimliğini veriyoruz)
    const game = new GameManager('game-canvas');

    // Tarayıcı güvenlik kısıtlamalarını aşmak için ilk etkileşimde ses motorunu hazırlarız
    const unlockAudio = () => {
        audio.init();
        audio.unlock();
        requestFullScreen();
        
        // Dinleyicileri temizle
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchend', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchend', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // Mobil tam ekran desteği tetikleyicisi (Opsiyonel estetik iyileştirme)
    const requestFullScreen = () => {
        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFullScreenFunc = docEl.requestFullscreen || 
                                      docEl.mozRequestFullScreen || 
                                      docEl.webkitRequestFullScreen || 
                                      docEl.msRequestFullscreen;

        if (requestFullScreenFunc && !doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            requestFullScreenFunc.call(docEl).catch(err => {
                console.log(`Tam ekrana geçiş hatası: ${err.message}`);
            });
        }
    };

    // OYNA butonuna basıldığında ses aktifleştirilir
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            requestFullScreen();
        });
    }
});
