import { GameManager } from './game.js?v=v54';
import { audio } from './audio.js?v=v54';

// Oyun Başlatma Girişi
window.addEventListener('DOMContentLoaded', () => {
    // GameManager nesnesi oluşturulur (Canvas kimliğini veriyoruz)
    const game = new GameManager('game-canvas');

    // Tarayıcı güvenlik kısıtlamalarını aşmak için ilk etkileşimde ses motorunu hazırlarız
    const unlockAudio = () => {
        audio.init();
        audio.unlock();
        
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

    // OYNA butonuna basıldığında ses aktifleştirilir (tam ekranı devre dışı bıraktık test amaçlı)
    const playBtn = document.getElementById('btn-play');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            // requestFullScreen(); // Geliştirici incelemeleri için otomatik tam ekranı devre dışı bıraktık
        });
    }
});
