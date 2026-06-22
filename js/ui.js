import { audio } from './audio.js?v=v179';
import { ViscosityList } from './viscosity.js?v=v179';
import { shopManager, SHOP_ITEMS } from './shop.js?v=v179';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://viscora.onrender.com';

function isOffensive(text) {
    if (!text) return false;
    let cleanText = text.toLowerCase().trim();
    
    const turkishMap = {
        'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
        'â': 'a', 'î': 'i', 'û': 'u'
    };
    for (const [k, v] of Object.entries(turkishMap)) {
        cleanText = cleanText.split(k).join(v);
    }
    
    const words = cleanText.match(/[a-z0-9]+/g) || [];
    
    const shortBad = new Set(['amk', 'aq', 'sik', 'am', 'got', 'göt', 'pic', 'piç', 'oc', 'pust', 'puşt', 'akp', 'chp', 'mhp', 'hdp', 'rte', 'feto', 'fetö']);
    const longBad = new Set([
        'yarrak', 'yarak', 'tassak', 'tasak', 'orospu', 'siktir', 'pezevenk', 'kahpe', 
        'amcik', 'amcık', 'meme', 'fuck', 'bitch', 'kaltak', 'erdogan', 'erdoğan', 'pkk', 
        'kilicdaroglu', 'kılıçdaroğlu', 'imamoglu', 'imamoğlu', 'ataturk', 'atatürk',
        'siken', 'domaltan', 'domalt'
    ]);
    
    const normalizedShortBad = Array.from(shortBad).map(word => {
        let w = word.toLowerCase();
        for (const [k, v] of Object.entries(turkishMap)) {
            w = w.split(k).join(v);
        }
        return w;
    });

    const normalizedLongBad = Array.from(longBad).map(word => {
        let w = word.toLowerCase();
        for (const [k, v] of Object.entries(turkishMap)) {
            w = w.split(k).join(v);
        }
        return w;
    });

    for (const word of words) {
        if (normalizedShortBad.includes(word) || normalizedLongBad.includes(word)) {
            return true;
        }
        for (const bad of normalizedLongBad) {
            if (word.includes(bad)) {
                return true;
            }
        }
    }

    // Noktalama işaretlerini ve boşlukları temizleyip kontrol et (Aşma koruması örn. p.k.k veya a.m.k)
    const noPuncText = cleanText.replace(/[^a-z0-9]/g, '');
    for (const bad of normalizedShortBad) {
        if (noPuncText === bad) {
            return true;
        }
    }
    for (const bad of normalizedLongBad) {
        if (noPuncText.includes(bad)) {
            return true;
        }
    }
    
    for (const bad of normalizedLongBad) {
        if (cleanText.includes(bad)) {
            return true;
        }
    }
    
    return false;
}

export class UIManager {
    constructor(game) {
        this.game = game;
        this.codexReferrer = 'start';
        
        // Initialize User ID for Community Map ownership checks
        let myUserId = localStorage.getItem('viscora_user_id');
        if (!myUserId) {
            myUserId = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            localStorage.setItem('viscora_user_id', myUserId);
        }
        
        // Girdi Kontrolleri (Keyboard)
        this.keys = {
            left: false,
            right: false,
            jump: false,
            shift: false,
            up: false,
            down: false
        };

        // DOM Elementleri
        this.screens = {
            start: document.getElementById('start-screen'),
            pause: document.getElementById('pause-screen'),
            win: document.getElementById('win-screen'),
            gameover: document.getElementById('gameover-screen'),
            codex: document.getElementById('codex-screen'),
            community: document.getElementById('community-screen'),
            shop: document.getElementById('shop-screen')
        };
        
        this.hud = document.getElementById('hud');
        this.healthDrops = document.querySelectorAll('.health-drop');
        this.viscosityBadge = document.getElementById('viscosity-badge');
        this.viscosityText = this.viscosityBadge.querySelector('.badge-text');
        this.mobileControls = document.getElementById('mobile-controls');
        this.shiftBtn = document.getElementById('btn-shift');

        // Geliştirici Modu Tespiti (localhost, 127.0.0.1 veya özel şifre parametresi ile)
        const searchLower = window.location.search.toLowerCase();
        this.devMode = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       searchLower.includes('sudenazkarkin') || 
                       searchLower.includes('sudenazkarkın');

        // Build the level selection UI
        this.buildLevelSelectionUI();

        // Kurulumlar
        this.initInputListeners();
        this.initButtonBindings();
        this.updateLevelButtonsUI();
    }

    /**
     * Touch-safe click listener that prevents double-firing
     */
    bindTouchClick(btn, callback) {
        if (!btn) return;
        let triggered = false;
        const handleEvent = (e) => {
            if (triggered) return;
            triggered = true;
            setTimeout(() => { triggered = false; }, 300);
            
            e.preventDefault();
            e.stopPropagation();
            
            // Unconditionally unlock Web Audio on menu button interaction (valid gesture)
            if (typeof audio !== 'undefined') {
                audio.init();
                audio.unlock();
            }
            
            callback(e);
        };
        btn.addEventListener('touchend', handleEvent, { passive: false });
        btn.addEventListener('click', handleEvent);
    }

    /**
     * Klavye girdi dinleyicileri (Masaüstü geliştirme/test için)
     */
    initInputListeners() {
        // Tuş basma
        window.addEventListener('keydown', (e) => {
            // F1 toggles Editor Mode ON/OFF (Sadece geliştirici modunda)
            if (e.key === 'F1' && this.devMode) {
                e.preventDefault(); // Prevent browser help panel
                if (this.game.editor) {
                    if (this.game.editor.active) {
                        this.game.editor.deactivate();
                    } else {
                        this.game.editor.init();
                    }
                }
                return;
            }

            // F3 toggles showDebug ON/OFF
            if (e.key === 'F3') {
                e.preventDefault();
                this.game.showDebug = !this.game.showDebug;
                return;
            }

            if (this.game.state !== 'PLAYING') return;
            if (e.repeat) return;

            const key = e.key ? e.key.toLowerCase() : '';
            if (key === 'a' || (e.key && e.key === 'ArrowLeft')) {
                this.keys.left = true;
            } else if (key === 'd' || (e.key && e.key === 'ArrowRight')) {
                this.keys.right = true;
            } else if (key === 'w' || (e.key && e.key === 'ArrowUp')) {
                this.keys.up = true;
                this.game.player.jump(false);
            } else if (key === 's' || (e.key && e.key === 'ArrowDown')) {
                this.keys.down = true;
            } else if (e.key && e.key === ' ') {
                this.keys.jump = true;
                this.game.player.jump(true);
            } else if ((e.key && e.key === 'Shift') || key === 'e') {
                this.triggerViscosityShift();
            } else if ((e.key && e.key === 'Escape') || key === 'p') {
                this.game.togglePause();
            }
        });

        // Tuş bırakma
        window.addEventListener('keyup', (e) => {
            const key = e.key ? e.key.toLowerCase() : '';
            if (key === 'a' || (e.key && e.key === 'ArrowLeft')) {
                this.keys.left = false;
            } else if (key === 'd' || (e.key && e.key === 'ArrowRight')) {
                this.keys.right = false;
            } else if (key === 'w' || (e.key && e.key === 'ArrowUp')) {
                this.keys.up = false;
            } else if (key === 's' || (e.key && e.key === 'ArrowDown')) {
                this.keys.down = false;
            } else if (e.key && e.key === ' ') {
                this.keys.jump = false;
            }
        });

        // Hidden mobile activation trigger: Long press (3 seconds) in top-right corner (Sadece geliştirici modunda)
        let touchStartTimer = null;
        window.addEventListener('touchstart', (e) => {
            if (!this.devMode) return;
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const width = window.innerWidth;
                // Top-right corner defined as clientX in the last 80px and clientY in the top 80px
                if (touch.clientX > width - 80 && touch.clientY < 80) {
                    if (touchStartTimer) clearTimeout(touchStartTimer);
                    touchStartTimer = setTimeout(() => {
                        if (this.game.editor) {
                            if (this.game.editor.active) {
                                this.game.editor.deactivate();
                            } else {
                                this.game.editor.init();
                            }
                            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                navigator.vibrate([100, 50, 100]); // Haptic confirmation pulse
                            }
                        }
                    }, 3000);
                }
            }
        }, { passive: true });

        const clearTouchTimer = () => {
            if (touchStartTimer) {
                clearTimeout(touchStartTimer);
                touchStartTimer = null;
            }
        };
        window.addEventListener('touchend', clearTouchTimer);
        window.addEventListener('touchcancel', clearTouchTimer);
    }

    buildLevelSelectionUI() {
        const wrapper = document.getElementById('level-selector-wrapper');
        if (!wrapper) return;

        const currentLvl = this.game.currentLevel;
        // Determine active group index (1-10)
        const activeGroupIndex = Math.max(1, Math.ceil(currentLvl / 10));

        let html = '';


        // Group metadata
        const groups = [
            { id: 1, title: '<svg class="icon-svg"><use href="#icon-run"></use></svg> İLK ADIMLAR', start: 1, end: 10, class: "group-1" },
            { id: 2, title: '<svg class="icon-svg"><use href="#icon-flask"></use></svg> TOKSİK HÜCRE', start: 11, end: 20, class: "group-2" },
            { id: 3, title: '<svg class="icon-svg"><use href="#icon-portal"></use></svg> KOZMİK ÇEKİRDEK', start: 21, end: 30, class: "group-3" }
        ];

        groups.forEach(g => {
            const isCollapsed = g.id !== activeGroupIndex;
            const collapseClass = isCollapsed ? 'collapsed' : '';
            const isGroupUnlocked = g.id === 1 || this.devMode || this.isLevelUnlocked(g.start);
            const statusText = isGroupUnlocked ? `Bölüm ${g.start}-${g.end}` : 'Kilitli <svg class="icon-svg" style="width: 12px; height: 12px; margin-left: 4px; margin-right: 0; vertical-align: middle;"><use href="#icon-lock"></use></svg>';
            const unlockedClass = isGroupUnlocked ? 'unlocked' : 'locked';
            const disabledAttr = isGroupUnlocked ? '' : 'disabled';

            // Chapter star count badge (X/30, only for chapter 1 initially)
            const chapterStars = (() => {
                let s = 0;
                for (let i = g.start; i <= g.end; i++) s += this.game.getStarsForLevel(i);
                return s;
            })();
            const maxStars = (g.end - g.start + 1) * 3; // 10 levels * 3 = 30
            const badgeGolden = chapterStars >= 24 ? 'golden' : '';
            const starBadgeHtml = isGroupUnlocked
                ? `<span id="chapter-badge-${g.id}" class="chapter-star-badge ${badgeGolden}"><svg class="icon-svg icon-star" style="width: 12px; height: 12px; margin-right: 4px; vertical-align: middle;"><use href="#icon-star"></use></svg> ${chapterStars}/${maxStars}</span>`
                : '';

            html += `
            <div class="level-group-card ${g.class} ${unlockedClass} ${collapseClass}" data-group-id="${g.id}">
                <div class="level-group-header" style="cursor: pointer;">
                    <span class="level-group-title">${g.title}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${starBadgeHtml}
                        <span class="level-group-status">${statusText}</span>
                        <span class="accordion-arrow">▼</span>
                    </div>
                </div>
                <div class="level-group-grid">
            `;

            if (g.id === 1) {
                html += `<button id="btn-level-0" class="level-btn"></button>`;
            }
            for (let i = g.start; i <= g.end; i++) {
                html += `<button id="btn-level-${i}" class="level-btn locked" ${disabledAttr}><span class="btn-num">${i}</span><span style="font-size:0.6rem; display: flex; align-items: center; justify-content: center;"><svg class="icon-svg" style="width: 10px; height: 10px; margin-right: 0;"><use href="#icon-lock"></use></svg></span></button>`;
            }

            html += `
                </div>
            </div>
            `;
        });

        wrapper.innerHTML = html;

        // Bind accordion toggles
        const cards = wrapper.querySelectorAll('.level-group-card');
        cards.forEach(card => {
            const header = card.querySelector('.level-group-header');
            if (header) {
                this.bindTouchClick(header, (e) => {
                    e.stopPropagation();
                    
                    // Only allow toggling unlocked groups
                    const isUnlocked = card.classList.contains('unlocked');
                    if (!isUnlocked) return;
                    
                    const isCollapsed = card.classList.contains('collapsed');
                    
                    // Collapse all cards first
                    cards.forEach(c => {
                        c.classList.add('collapsed');
                    });
                    
                    // Toggle current card
                    if (isCollapsed) {
                        card.classList.remove('collapsed');
                    }
                });
            }
        });

        // Collect all level buttons references dynamically
        this.levelButtons = [];
        for (let i = 0; i <= 100; i++) {
            const btn = document.getElementById(`btn-level-${i}`);
            if (btn) this.levelButtons.push(btn);
        }
    }

    /**
     * Mobil buton dokunmatik event eşlemeleri
     */
    initButtonBindings() {
        // Buton Eşleştirme Yardımcısı — pointerdown kullanılır (touchstart'tan ~daha hızlı)
        const bindTouchButton = (btnId, keyName, onDownCallback = null, vibrate = false) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;

            // pointerdown: touchstart ve mousedown'ı tek seferde karşılar, tarayıcı gecikmesi yok
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                btn.setPointerCapture(e.pointerId); // Parmak kaysa da takip et
                this.keys[keyName] = true;
                btn.classList.add('active');
                // Sadece aksiyon butonlarında titreşim (sol/sağ butonlarda gecikme olur)
                if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(12);
                }
                if (onDownCallback) onDownCallback();
            }, { passive: false });

            // pointerup / pointercancel: her iki durumu da kapsar
            const release = (e) => {
                e.preventDefault();
                this.keys[keyName] = false;
                btn.classList.remove('active');
            };
            btn.addEventListener('pointerup', release, { passive: false });
            btn.addEventListener('pointercancel', release, { passive: false });
            btn.addEventListener('lostpointercapture', release, { passive: false });
        };

        // Butonları eşle
        bindTouchButton('btn-left', 'left');
        bindTouchButton('btn-right', 'right');
        bindTouchButton('btn-jump', 'jump', () => {
            if (this.game.state === 'PLAYING') {
                this.game.player.jump();
            }
        }, true); // Zıplamada titreşim
        bindTouchButton('btn-down', 'down', null, false);

        // Viskozite Değiştirme Butonu (Shift) — pointerdown ile anında tepki
        const shiftBtn = document.getElementById('btn-shift');
        if (shiftBtn) {
            shiftBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                shiftBtn.setPointerCapture(e.pointerId);
                this.triggerViscosityShift();
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(25);
                }
            }, { passive: false });
        }

        // HUD Duraklatma Butonu
        this.bindTouchClick(document.getElementById('btn-pause'), () => {
            this.game.togglePause();
        });

        // Zorluk Seviyesi Seçimi Butonları
        const diffButtons = document.querySelectorAll('.diff-btn');
        const savedDiff = localStorage.getItem('viscora_difficulty') || 'normal';
        this.game.difficulty = savedDiff;
        diffButtons.forEach(btn => {
            const diff = btn.getAttribute('data-diff');
            if (diff === savedDiff) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            this.bindTouchClick(btn, () => {
                this.game.difficulty = diff;
                localStorage.setItem('viscora_difficulty', diff);
                diffButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                }
            });
        });

        // MENÜ BUTONLARI EYLEMLERİ
        
        // Başlangıç Ekranı - Oyna
        this.bindTouchClick(document.getElementById('btn-play'), () => {
            // Eğer geçerli bölüm seçili değilse (editör veya topluluk seviyesi sonrasındaki 999 durumu)
            if (this.game.currentLevel === 999 || this.game.currentLevel === null || this.game.currentLevel === undefined) {
                alert("Lütfen oynamak istediğiniz bölümü seçin!");
                return;
            }
            audio.init(); // İlk ses motoru tetiklemesi
            audio.startMusic();
            this.showScreen('hud');
            this.game.start();
        });

        // Duraklatma Ekranı - Devam Et
        this.bindTouchClick(document.getElementById('btn-resume'), () => {
            this.game.togglePause();
        });

        // Duraklatma Ekranı - Yeniden Başlat
        this.bindTouchClick(document.getElementById('btn-restart-pause'), () => {
            this.showScreen('hud');
            this.game.restart();
        });

        // Duraklatma Ekranı - Ana Menüye Dön
        this.bindTouchClick(document.getElementById('btn-main-menu'), () => {
            this.game.goToMenu();
        });

        // Ayrılmış Müzik ve Efekt Kontrolleri
        const sliderMenuMusic = document.getElementById('slider-menu-music');
        const sliderPauseMusic = document.getElementById('slider-pause-music');
        const textMenuMusic = document.getElementById('menu-music-text');
        const textPauseMusic = document.getElementById('pause-music-text');
        const btnMenuMusic = document.getElementById('btn-menu-music');
        const btnPauseMusic = document.getElementById('btn-pause-music');

        const sliderMenuSfx = document.getElementById('slider-menu-sfx');
        const sliderPauseSfx = document.getElementById('slider-pause-sfx');
        const textMenuSfx = document.getElementById('menu-sfx-text');
        const textPauseSfx = document.getElementById('pause-sfx-text');
        const btnMenuSfx = document.getElementById('btn-menu-sfx');
        const btnPauseSfx = document.getElementById('btn-pause-sfx');

        // Müzik Arayüzünü Güncelleme
        const updateMusicUI = (value, isMuted) => {
            if (sliderMenuMusic) {
                sliderMenuMusic.value = value;
                sliderMenuMusic.classList.toggle('muted', isMuted);
            }
            if (sliderPauseMusic) {
                sliderPauseMusic.value = value;
                sliderPauseMusic.classList.toggle('muted', isMuted);
            }

            const displayVal = isMuted ? 0 : value;
            if (textMenuMusic) textMenuMusic.textContent = `${displayVal}%`;
            if (textPauseMusic) textPauseMusic.textContent = `${displayVal}%`;

            const iconHtml = isMuted 
                ? '<svg class="icon-svg" style="width: 16px; height: 16px; margin: 0;"><use href="#icon-mute"></use></svg>' 
                : '<svg class="icon-svg" style="width: 16px; height: 16px; margin: 0;"><use href="#icon-music"></use></svg>';
            if (btnMenuMusic) {
                btnMenuMusic.innerHTML = iconHtml;
                btnMenuMusic.classList.toggle('muted', isMuted);
            }
            if (btnPauseMusic) {
                btnPauseMusic.innerHTML = iconHtml;
                btnPauseMusic.classList.toggle('muted', isMuted);
            }
        };

        // SFX Arayüzünü Güncelleme
        const updateSfxUI = (value, isMuted) => {
            if (sliderMenuSfx) {
                sliderMenuSfx.value = value;
                sliderMenuSfx.classList.toggle('muted', isMuted);
            }
            if (sliderPauseSfx) {
                sliderPauseSfx.value = value;
                sliderPauseSfx.classList.toggle('muted', isMuted);
            }

            const displayVal = isMuted ? 0 : value;
            if (textMenuSfx) textMenuSfx.textContent = `${displayVal}%`;
            if (textPauseSfx) textPauseSfx.textContent = `${displayVal}%`;

            const iconHtml = isMuted 
                ? '<svg class="icon-svg" style="width: 16px; height: 16px; margin: 0;"><use href="#icon-mute"></use></svg>' 
                : '<svg class="icon-svg" style="width: 16px; height: 16px; margin: 0;"><use href="#icon-volume"></use></svg>';
            if (btnMenuSfx) {
                btnMenuSfx.innerHTML = iconHtml;
                btnMenuSfx.classList.toggle('muted', isMuted);
            }
            if (btnPauseSfx) {
                btnPauseSfx.innerHTML = iconHtml;
                btnPauseSfx.classList.toggle('muted', isMuted);
            }
        };

        const handleMusicSliderChange = (val) => {
            const intVal = parseInt(val) || 0;
            audio.init();
            audio.setMusicVolume(intVal / 100);
            updateMusicUI(intVal, audio.isMusicMuted || intVal === 0);
        };

        const handleSfxSliderChange = (val) => {
            const intVal = parseInt(val) || 0;
            audio.init();
            audio.setSfxVolume(intVal / 100);
            updateSfxUI(intVal, audio.isSfxMuted || intVal === 0);
        };

        const handleMusicMuteToggle = () => {
            audio.init();
            const isMuted = audio.toggleMusicMute();
            updateMusicUI(Math.round(audio.musicVolumeLevel * 100), isMuted);
        };

        const handleSfxMuteToggle = () => {
            audio.init();
            const isMuted = audio.toggleSfxMute();
            updateSfxUI(Math.round(audio.sfxVolumeLevel * 100), isMuted);
        };

        if (sliderMenuMusic) sliderMenuMusic.addEventListener('input', (e) => handleMusicSliderChange(e.target.value));
        if (sliderPauseMusic) sliderPauseMusic.addEventListener('input', (e) => handleMusicSliderChange(e.target.value));
        if (sliderMenuSfx) sliderMenuSfx.addEventListener('input', (e) => handleSfxSliderChange(e.target.value));
        if (sliderPauseSfx) sliderPauseSfx.addEventListener('input', (e) => handleSfxSliderChange(e.target.value));

        this.bindTouchClick(btnMenuMusic, () => handleMusicMuteToggle());
        this.bindTouchClick(btnPauseMusic, () => handleMusicMuteToggle());
        this.bindTouchClick(btnMenuSfx, () => handleSfxMuteToggle());
        this.bindTouchClick(btnPauseSfx, () => handleSfxMuteToggle());

        // Başlangıçta ses durumlarını UI ile senkronize et
        updateMusicUI(Math.round(audio.musicVolumeLevel * 100), audio.isMusicMuted);
        updateSfxUI(Math.round(audio.sfxVolumeLevel * 100), audio.isSfxMuted);

        // Ödüllü Reklam: Devam Et (Checkpoint'ten Full Canla)
        this.bindTouchClick(document.getElementById('btn-rewarded-continue'), () => {
            this.game.rewardedContinue();
        });

        // Ödüllü Reklam: Bölümü Atla
        this.bindTouchClick(document.getElementById('btn-rewarded-skip'), () => {
            this.game.rewardedSkipLevel();
        });

        // Oyun Bitti Ekranı - Yeniden Dene
        this.bindTouchClick(document.getElementById('btn-retry'), () => {
            this.showScreen('hud');
            this.game.restart();
        });

        // Bölüm Sonu Ekranı - Tekrar Oyna
        this.bindTouchClick(document.getElementById('btn-next'), () => {
            this.showScreen('hud');
            this.game.nextLevel();
        });

        // Bölüm Sonu Ekranı - Ana Menüye Dön
        this.bindTouchClick(document.getElementById('btn-main-menu-win'), () => {
            this.game.goToMenu();
        });

        // Oyun Bitti Ekranı - Ana Menüye Dön
        this.bindTouchClick(document.getElementById('btn-main-menu-gameover'), () => {
            this.game.goToMenu();
        });

        // Bölüm Seçim Butonları
        this.levelButtons.forEach((btn) => {
            const lvlNum = parseInt(btn.id.replace('btn-level-', ''));
            this.bindTouchClick(btn, () => {
                // Yıldız kapısı kontrolü
                const canSelect = this.isLevelUnlocked(lvlNum);
                if (canSelect) {
                    this.selectLevel(lvlNum);
                } else if (lvlNum % 10 === 0 && lvlNum > 0) {
                    // Boss level kilitli: modal göster
                    this.showStarGateModal(lvlNum);
                }
            });
        });

        // Yıldız Kapısı Modalı Kapat
        this.bindTouchClick(document.getElementById('btn-close-star-gate'), () => {
            const modal = document.getElementById('star-gate-modal');
            if (modal) modal.classList.add('hidden');
        });

        // Kılavuz (Codex) Ekranı Aç/Kapat Butonları
        const btnCodex = document.getElementById('btn-codex');
        const btnCodexPause = document.getElementById('btn-codex-pause');
        const btnCloseCodex = document.getElementById('btn-close-codex');
        
        if (btnCodex) {
            this.bindTouchClick(btnCodex, () => {
                this.codexReferrer = 'start';
                this.showScreen('codex');
            });
        }

        // Ses Ayarları Modalı Aç/Kapat
        const btnOpenSettings = document.getElementById('btn-open-settings');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const settingsModal = document.getElementById('settings-modal');

        if (btnOpenSettings && settingsModal) {
            this.bindTouchClick(btnOpenSettings, () => {
                settingsModal.classList.remove('hidden');
            });
        }

        if (btnCloseSettings && settingsModal) {
            this.bindTouchClick(btnCloseSettings, () => {
                settingsModal.classList.add('hidden');
            });
        }

        if (btnCodexPause) {
            this.bindTouchClick(btnCodexPause, () => {
                this.codexReferrer = 'pause';
                this.showScreen('codex');
            });
        }
        
        if (btnCloseCodex) {
            this.bindTouchClick(btnCloseCodex, () => {
                this.showScreen(this.codexReferrer || 'start');
            });
        }
        
        // Kılavuz Sekme Geçiş Mantığı
        const tabButtons = document.querySelectorAll('.codex-tab-btn');
        tabButtons.forEach(btn => {
            this.bindTouchClick(btn, () => {
                const targetTab = btn.getAttribute('data-tab');
                
                // Aktif sekme butonunu güncelle
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Aktif sekme içeriğini güncelle
                const contents = document.querySelectorAll('.codex-tab-content');
                contents.forEach(c => {
                    c.classList.remove('active');
                    if (c.id === `tab-${targetTab}`) {
                        c.classList.add('active');
                    }
                });
            });
        });

        // --- KRİSTAL DÜKKANI BAKIYE VE EKRAN BAĞLANTILARI ---
        const btnShop = document.getElementById('btn-shop');
        const btnCloseShop = document.getElementById('btn-close-shop');
        const shopTabButtons = document.querySelectorAll('.shop-tabs .community-tab-btn');
        const listShopEl = document.getElementById('shop-item-list');
        let activeShopCategory = 'trail';

        const updateCrystalUI = () => {
            const balance = window.shopManager ? window.shopManager.getBalance() : 0;
            const menuCounter = document.getElementById('menu-crystal-count');
            const shopCounter = document.getElementById('shop-crystal-balance');
            if (menuCounter) menuCounter.textContent = balance;
            if (shopCounter) shopCounter.textContent = balance;
        };

        window.addEventListener('viscora_crystals_changed', (e) => {
            const menuCounter = document.getElementById('menu-crystal-count');
            const shopCounter = document.getElementById('shop-crystal-balance');
            if (menuCounter) menuCounter.textContent = e.detail.balance;
            if (shopCounter) shopCounter.textContent = e.detail.balance;
        });

        // initial load of crystals
        setTimeout(updateCrystalUI, 100);

        // Canlı Önizleme Geçici Seçimleri ve Animasyon Döngüsü
        let tempTrail = null;
        let tempAccessory = null;
        let tempEyes = null;
        let previewParticles = [];
        let previewHue = 0;
        let previewAnimFrame = null;

        const triggerConfetti = () => {
            const colors = ['#00f2fe', '#4facfe', '#10b981', '#fbbf24', '#f43f5e', '#a855f7'];
            for (let i = 0; i < 40; i++) {
                const piece = document.createElement('div');
                piece.className = 'confetti-particle';
                const size = 6 + Math.random() * 8;
                const startLeft = 20 + Math.random() * 60;
                
                piece.style.cssText = `
                    position: fixed;
                    top: -20px;
                    left: ${startLeft}%;
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
                    opacity: ${0.6 + Math.random() * 0.4};
                    z-index: 9999;
                    transform: rotate(${Math.random() * 360}deg);
                    pointer-events: none;
                    transition: transform 2.5s ease-out, top 2.5s ease-in-out, opacity 2.5s ease-out;
                `;
                
                document.body.appendChild(piece);
                
                setTimeout(() => {
                    const targetLeft = startLeft + (Math.random() - 0.5) * 15;
                    const targetTop = window.innerHeight + 20;
                    piece.style.top = `${targetTop}px`;
                    piece.style.left = `${targetLeft}%`;
                    piece.style.transform = `rotate(${Math.random() * 720}deg)`;
                    piece.style.opacity = '0';
                    
                    setTimeout(() => piece.remove(), 2500);
                }, 50);
            }
        };

        const showToast = (message, isSuccess = true) => {
            // Remove existing toasts first to prevent stacking overlaps
            const oldToasts = document.querySelectorAll('.shop-toast');
            oldToasts.forEach(t => t.remove());

            const toast = document.createElement('div');
            toast.className = 'shop-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 23, 42, 0.95);
                border: 1.5px solid ${isSuccess ? '#10b981' : '#ef4444'};
                box-shadow: 0 0 15px ${isSuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
                color: #fff;
                padding: 12px 24px;
                border-radius: 30px;
                font-weight: bold;
                font-size: 0.95rem;
                z-index: 10000;
                pointer-events: none;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            toast.innerHTML = `${isSuccess ? '🎉' : '❌'} ${message}`;
            document.body.appendChild(toast);
            
            if (isSuccess) {
                triggerConfetti();
            }

            setTimeout(() => {
                toast.remove();
            }, 2500);
        };

        const updatePreviewAvatar = () => {
            const canvas = document.getElementById('shop-preview-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            ctx.clearRect(0, 0, 70, 70);
            
            const activeTrail = tempTrail || (window.shopManager ? window.shopManager.getActiveCosmetic('trail') : 'default_trail');
            const activeAccessory = tempAccessory || (window.shopManager ? window.shopManager.getActiveCosmetic('accessory') : 'default_accessory');
            const activeEyes = tempEyes || (window.shopManager ? window.shopManager.getActiveCosmetic('eyes') : 'default_eyes');
            
            const px = 35;
            const py = 42;
            const radius = 12;
            
            // 1. Emit trail particles
            previewHue = (previewHue + 2.5) % 360;
            if (activeTrail && activeTrail !== 'default_trail' && Math.random() < 0.35) {
                let pColor = '#06b6d4';
                if (activeTrail === 'fire_trail') {
                    pColor = Math.random() > 0.5 ? '#ef4444' : '#f97316';
                } else if (activeTrail === 'ice_trail') {
                    pColor = Math.random() > 0.5 ? '#38bdf8' : '#ffffff';
                } else if (activeTrail === 'gold_trail') {
                    pColor = '#fbbf24';
                } else if (activeTrail === 'rainbow_trail') {
                    pColor = `hsl(${previewHue}, 100%, 60%)`;
                }
                previewParticles.push({
                    x: px + (Math.random() - 0.5) * 16,
                    y: py + radius - 3,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: 0.6 + Math.random() * 1.2,
                    size: 1.5 + Math.random() * 2.5,
                    life: 25 + Math.random() * 15,
                    color: pColor
                });
            }
            
            // Update & Draw particles
            previewParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = Math.max(0, p.life / 40);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;
            previewParticles = previewParticles.filter(p => p.life > 0);
            
            // 2. Draw Body (bobbing)
            const bob = Math.sin(Date.now() / 150) * 1.2;
            const finalY = py + bob;
            
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(px, finalY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // 3. Draw Eyes
            const eyeX = px;
            const eyeY = finalY - 1;
            
            if (activeEyes === 'cute_eyes') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(eyeX - 4.2, eyeY, 3.5, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.2, eyeY, 3.5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(eyeX - 4.2, eyeY, 1.8, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.2, eyeY, 1.8, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeEyes === 'angry_eyes') {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(eyeX - 7.5, eyeY - 2);
                ctx.lineTo(eyeX - 2, eyeY - 0.2);
                ctx.moveTo(eyeX + 7.5, eyeY - 2);
                ctx.lineTo(eyeX + 2, eyeY - 0.2);
                ctx.stroke();
                
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(eyeX - 4.2, eyeY + 0.6, 1.5, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.2, eyeY + 0.6, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeEyes === 'sunglasses') {
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1.0;
                
                ctx.beginPath();
                ctx.rect(eyeX - 8, eyeY - 1.5, 5, 3.2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.rect(eyeX + 3, eyeY - 1.5, 5, 3.2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(eyeX - 3, eyeY - 0.5);
                ctx.lineTo(eyeX + 3, eyeY - 0.5);
                ctx.stroke();
            } else if (activeEyes === 'joke_glasses') {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.2;
                ctx.fillStyle = '#ffffff';
                
                ctx.beginPath();
                ctx.arc(eyeX - 5, eyeY + 0.5, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(eyeX + 5, eyeY + 0.5, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY + 0.5, 1.0, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.5, eyeY + 0.5, 1.0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#fb7185';
                ctx.beginPath();
                ctx.arc(eyeX, eyeY + 3.2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.moveTo(eyeX - 6, eyeY + 6);
                ctx.quadraticCurveTo(eyeX - 2, eyeY + 4.5, eyeX, eyeY + 6.2);
                ctx.quadraticCurveTo(eyeX + 2, eyeY + 4.5, eyeX + 6, eyeY + 6);
                ctx.quadraticCurveTo(eyeX + 3.5, eyeY + 7.8, eyeX, eyeY + 7.0);
                ctx.quadraticCurveTo(eyeX - 3.5, eyeY + 7.8, eyeX - 6, eyeY + 6);
                ctx.fill();
            } else {
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 1.8, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.5, eyeY, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 4. Draw Accessory (Hats)
            const topX = px;
            const topY = finalY - radius + 2.5;
            
            if (activeAccessory === 'cowboy_hat') {
                ctx.fillStyle = '#78350f';
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY, 11, 2.2, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY, 6, 0, Math.PI * 2);
                }
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(topX - 6.5, topY - 0.8);
                ctx.quadraticCurveTo(topX - 6.5, topY - 8, topX - 4, topY - 9);
                ctx.quadraticCurveTo(topX, topY - 6.5, topX + 4, topY - 9);
                ctx.quadraticCurveTo(topX + 6.5, topY - 0.8, topX + 6.5, topY - 0.8);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(topX - 6.5, topY - 2.2, 13, 1.5);
            } else if (activeAccessory === 'wizard_hat') {
                ctx.fillStyle = '#581c87';
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY, 11, 2.5, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY, 6, 0, Math.PI * 2);
                }
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(topX - 6.5, topY - 0.8);
                ctx.lineTo(topX + 6.5, topY - 0.8);
                ctx.quadraticCurveTo(topX + 1.5, topY - 10, topX - 2.2, topY - 17);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(topX - 5.0, topY - 2.2, 10, 1.5);
                
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(topX - 2.2, topY - 17.5, 1.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeAccessory === 'crown') {
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(topX - 9, topY);
                ctx.lineTo(topX - 9, topY - 5);
                ctx.lineTo(topX - 5, topY - 1.8);
                ctx.lineTo(topX, topY - 7.5);
                ctx.lineTo(topX + 5, topY - 1.8);
                ctx.lineTo(topX + 9, topY - 5);
                ctx.lineTo(topX + 9, topY);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(topX - 9, topY - 5, 1.0, 0, Math.PI * 2);
                ctx.arc(topX, topY - 7.5, 1.0, 0, Math.PI * 2);
                ctx.arc(topX + 9, topY - 5, 1.0, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeAccessory === 'santa_hat') {
                // Beyaz yün siper (Kalın ve pofuduk)
                ctx.fillStyle = '#f1f5f9';
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY - 1.2, 10.4, 3.6, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY - 1.2, 7, 0, Math.PI * 2);
                }
                ctx.fill();
                
                // Kırmızı gövde (Dolu ve kıvrık duran hat)
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.moveTo(topX - 9, topY - 1.5);
                
                // Sol taraftan yukarı yuvarlakça uzanış
                ctx.quadraticCurveTo(topX - 7.2, topY - 20, topX - 0.8, topY - 21.6);
                // Tepe kıvrımından sağa doğru bükülüp aşağı sarkış
                ctx.quadraticCurveTo(topX + 5.6, topY - 21.6, topX + 9.6, topY - 12.8);
                // Ponponun bağlanacağı düz uç kısmı
                ctx.lineTo(topX + 7.2, topY - 10.4);
                // İç kıvrımın dolgunca sol tarafa geçişi
                ctx.quadraticCurveTo(topX + 2.4, topY - 15.2, topX - 1.6, topY - 15.2);
                // Sağ tabana doğru iniş ve birleşim
                ctx.quadraticCurveTo(topX + 4.0, topY - 9.6, topX + 8.8, topY - 1.6);
                // Tabandan sola doğru kapatma çizgisi
                ctx.lineTo(topX - 9, topY - 1.5);
                
                ctx.closePath();
                ctx.fill();
                
                // Beyaz ponpon (Ucun ucuna asılı durur)
                ctx.fillStyle = '#f1f5f9';
                ctx.beginPath();
                ctx.arc(topX + 9.2, topY - 11.6, 2.8, 0, Math.PI * 2);
                ctx.fill();
            }
            
            if (window.gameInstance && window.gameInstance.state === 'SHOP') {
                previewAnimFrame = requestAnimationFrame(updatePreviewAvatar);
            } else {
                previewAnimFrame = null;
            }
        };

        const renderShopItems = () => {
            if (!listShopEl || !window.shopManager || !window.SHOP_ITEMS) return;
            listShopEl.innerHTML = '';

            const items = window.SHOP_ITEMS.filter(item => item.category === activeShopCategory);
            const balance = window.shopManager.getBalance();

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'shop-item';
                
                const isOwned = window.shopManager.isOwned(item.id);
                const isActive = window.shopManager.getActiveCosmetic(item.category) === item.id;
                
                if (isActive) {
                    card.classList.add('equipped');
                }

                // Generates HTML preview based on item category
                let previewHtml = '';
                if (item.category === 'trail') {
                    if (item.id === 'default_trail') {
                        previewHtml = `<div class="preview-trail-particle" style="background: #06b6d4; left: 24px; top: 24px; box-shadow: 0 0 8px #06b6d4; border-radius: 50%;"></div>`;
                    } else if (item.id === 'fire_trail') {
                        previewHtml = `
                            <div class="preview-trail-particle" style="background: #ef4444; left: 15px; top: 24px; box-shadow: 0 0 8px #ef4444; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #f97316; left: 24px; top: 16px; box-shadow: 0 0 8px #f97316; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #f59e0b; left: 33px; top: 26px; box-shadow: 0 0 8px #f59e0b; border-radius: 50%;"></div>
                        `;
                    } else if (item.id === 'ice_trail') {
                        previewHtml = `
                            <div class="preview-trail-particle" style="background: #38bdf8; left: 15px; top: 20px; box-shadow: 0 0 8px #38bdf8; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #ffffff; left: 24px; top: 28px; box-shadow: 0 0 8px #ffffff; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #7dd3fc; left: 33px; top: 18px; box-shadow: 0 0 8px #7dd3fc; border-radius: 50%;"></div>
                        `;
                    } else if (item.id === 'gold_trail') {
                        previewHtml = `
                            <div class="preview-trail-particle" style="background: #fbbf24; left: 18px; top: 20px; box-shadow: 0 0 8px #fbbf24; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #fbbf24; left: 30px; top: 24px; box-shadow: 0 0 8px #fbbf24; border-radius: 50%;"></div>
                        `;
                    } else if (item.id === 'rainbow_trail') {
                        previewHtml = `
                            <div class="preview-trail-particle" style="background: #ef4444; left: 14px; top: 20px; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #10b981; left: 24px; top: 26px; border-radius: 50%;"></div>
                            <div class="preview-trail-particle" style="background: #3b82f6; left: 34px; top: 18px; border-radius: 50%;"></div>
                        `;
                    }
                } else if (item.category === 'accessory') {
                    if (item.id === 'cowboy_hat') {
                        previewHtml = `<div style="font-size: 2.2rem; display: flex; align-items: center; justify-content: center; height: 100%;">🤠</div>`;
                    } else if (item.id === 'wizard_hat') {
                        previewHtml = `<div style="font-size: 2.2rem; display: flex; align-items: center; justify-content: center; height: 100%;">🧙</div>`;
                    } else if (item.id === 'crown') {
                        previewHtml = `<div style="font-size: 2.2rem; display: flex; align-items: center; justify-content: center; height: 100%;">👑</div>`;
                    } else if (item.id === 'santa_hat') {
                        previewHtml = `<div style="font-size: 2.2rem; display: flex; align-items: center; justify-content: center; height: 100%;">🎅</div>`;
                    } else {
                        previewHtml = `<div style="font-size: 1.5rem; color: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; height: 100%;">❌</div>`;
                    }
                } else if (item.category === 'eyes') {
                    if (item.id === 'cute_eyes') {
                        previewHtml = `
                            <div class="preview-eye-shape">
                                <div class="preview-eye-pupil" style="width: 8px; height: 8px; border-radius: 50%; background: #000; display:flex; justify-content:center; align-items:center; position:relative;">
                                    <div style="width: 2.5px; height: 2.5px; background: #fff; border-radius: 50%; position: absolute; top: 1px; left: 1px;"></div>
                                </div>
                                <div class="preview-eye-pupil" style="width: 8px; height: 8px; border-radius: 50%; background: #000; display:flex; justify-content:center; align-items:center; position:relative;">
                                    <div style="width: 2.5px; height: 2.5px; background: #fff; border-radius: 50%; position: absolute; top: 1px; left: 1px;"></div>
                                </div>
                            </div>
                        `;
                    } else if (item.id === 'sunglasses') {
                        previewHtml = `<div style="font-size: 2.2rem; display: flex; align-items: center; justify-content: center; height: 100%;">😎</div>`;
                    } else if (item.id === 'joke_glasses') {
                        previewHtml = `<div style="font-size: 2.2rem; display: flex; align-items: center; justify-content: center; height: 100%;">🥸</div>`;
                    } else if (item.id === 'angry_eyes') {
                        previewHtml = `
                            <div class="preview-eye-shape" style="flex-direction: column;">
                                <div style="display: flex; gap: 8px; margin-bottom: -1px;">
                                    <div style="width: 8px; height: 2px; background: #000; transform: rotate(18deg); transform-origin: right;"></div>
                                    <div style="width: 8px; height: 2px; background: #000; transform: rotate(-18deg); transform-origin: left;"></div>
                                </div>
                                <div style="display: flex; gap: 10px;">
                                    <div class="preview-eye-pupil" style="width: 4px; height: 4px;"></div>
                                    <div class="preview-eye-pupil" style="width: 4px; height: 4px;"></div>
                                </div>
                            </div>
                        `;
                    } else {
                        // default eyes
                        previewHtml = `
                            <div class="preview-eye-shape">
                                <div class="preview-eye-pupil" style="width: 5px; height: 5px;"></div>
                                <div class="preview-eye-pupil" style="width: 5px; height: 5px;"></div>
                            </div>
                        `;
                    }
                }

                let actionBtnHtml = '';
                if (isActive) {
                    actionBtnHtml = `<button class="shop-item-btn active" disabled>KULLANIMDA</button>`;
                } else if (isOwned) {
                    actionBtnHtml = `<button class="shop-item-btn equip" data-id="${item.id}">DONAT</button>`;
                } else {
                    actionBtnHtml = `<button class="shop-item-btn buy" data-id="${item.id}">SATIN AL</button>`;
                }

                const priceDisplay = item.price > 0 ? `💎 ${item.price}` : 'Ücretsiz';

                card.innerHTML = `
                    <div class="shop-item-preview-box">
                        ${previewHtml}
                    </div>
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-description">${item.description}</div>
                    <div class="shop-item-price" style="${item.price === 0 ? 'color:#10b981;' : ''}">${priceDisplay}</div>
                    ${actionBtnHtml}
                `;

                // Card hover and touch listeners to preview items dynamically on the preview avatar canvas
                card.addEventListener('mouseenter', () => {
                    if (item.category === 'trail') {
                        tempTrail = item.id;
                    } else if (item.category === 'accessory') {
                        tempAccessory = item.id;
                    } else if (item.category === 'eyes') {
                        tempEyes = item.id;
                    }
                });
                
                card.addEventListener('mouseleave', () => {
                    if (item.category === 'trail') {
                        tempTrail = null;
                    } else if (item.category === 'accessory') {
                        tempAccessory = null;
                    } else if (item.category === 'eyes') {
                        tempEyes = null;
                    }
                });
                
                card.addEventListener('touchstart', () => {
                    if (item.category === 'trail') {
                        tempTrail = item.id;
                    } else if (item.category === 'accessory') {
                        tempAccessory = item.id;
                    } else if (item.category === 'eyes') {
                        tempEyes = item.id;
                    }
                }, { passive: true });
                
                card.addEventListener('touchend', () => {
                    if (item.category === 'trail') {
                        tempTrail = null;
                    } else if (item.category === 'accessory') {
                        tempAccessory = null;
                    } else if (item.category === 'eyes') {
                        tempEyes = null;
                    }
                }, { passive: true });

                const btnBuy = card.querySelector('.shop-item-btn.buy');
                if (btnBuy) {
                    btnBuy.addEventListener('click', () => {
                        const result = window.shopManager.purchase(item.id);
                        if (result.success) {
                            audio.playShopPurchase();
                            showToast("Başarıyla satın alındı!", true);
                            renderShopItems();
                            updateCrystalUI();
                        } else {
                            showToast(result.message, false);
                        }
                    });
                }

                const btnEquip = card.querySelector('.shop-item-btn.equip');
                if (btnEquip) {
                    btnEquip.addEventListener('click', () => {
                        const result = window.shopManager.equip(item.id);
                        if (result.success) {
                            audio.playShopEquip();
                            showToast("Başarıyla Donanıldı!", true);
                            renderShopItems();
                        } else {
                            showToast(result.message, false);
                        }
                    });
                }

                listShopEl.appendChild(card);
            });
        };

        if (btnShop) {
            this.bindTouchClick(btnShop, () => {
                this.showScreen('shop');
                if (window.gameInstance) {
                    window.gameInstance.state = 'SHOP';
                }
                tempTrail = null;
                tempAccessory = null;
                tempEyes = null;
                if (!previewAnimFrame) {
                    previewAnimFrame = requestAnimationFrame(updatePreviewAvatar);
                }
                renderShopItems();
                updateCrystalUI();
            });
        }

        if (btnCloseShop) {
            this.bindTouchClick(btnCloseShop, () => {
                if (window.gameInstance) {
                    window.gameInstance.state = 'MENU';
                }
                if (previewAnimFrame) {
                    cancelAnimationFrame(previewAnimFrame);
                    previewAnimFrame = null;
                }
                tempTrail = null;
                tempAccessory = null;
                tempEyes = null;
                this.showScreen('start');
            });
        }

        shopTabButtons.forEach(btn => {
            this.bindTouchClick(btn, () => {
                activeShopCategory = btn.getAttribute('data-category');
                shopTabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Clear temporary preview selections when changing tabs
                tempTrail = null;
                tempAccessory = null;
                tempEyes = null;
                renderShopItems();
            });
        });



        // --- TOPLULUK SUNUCULARI ÇALIŞMASI ---
        const btnCommunity = document.getElementById('btn-community');
        const btnCloseCommunity = document.getElementById('btn-close-community');
        const communityTabButtons = document.querySelectorAll('.community-tabs .community-tab-btn');
        const searchInput = document.getElementById('community-search-input');
        const tagFilterButtons = document.querySelectorAll('.tag-filter-btn');
        
        this.currentSort = 'popular'; // Varsayılan popüler sıralama
        this.fetchedLevels = [];
        this.activeTagFilter = null;
        this.searchQuery = '';

        const formatRemainingTime = (seconds) => {
            if (seconds <= 0) return "Süre doldu (Silinecek)";
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            let result = '';
            if (hours > 0) result += `${hours}sa `;
            if (mins > 0 || hours > 0) result += `${mins}dk `;
            result += `${secs}sn`;
            return result;
        };

        const renderFilteredCommunityMaps = () => {
            const listEl = document.getElementById('community-map-list');
            if (!listEl) return;

            if (this.communityInterval) {
                clearInterval(this.communityInterval);
                this.communityInterval = null;
            }

            let filtered = this.fetchedLevels || [];
            
            // 1. Search Query Filter
            if (this.searchQuery) {
                const q = this.searchQuery.toLowerCase().trim();
                filtered = filtered.filter(lvl => 
                    lvl.name.toLowerCase().includes(q) || 
                    lvl.author.toLowerCase().includes(q)
                );
            }

            // 2. Tag Filter
            if (this.activeTagFilter) {
                filtered = filtered.filter(lvl => {
                    const tags = lvl.tags || (lvl.data && lvl.data.tags) || [];
                    return tags.includes(this.activeTagFilter);
                });
            }

            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="no-maps">Eşleşen harita bulunamadı.</div>';
                return;
            }

            listEl.innerHTML = '';
            const likedMaps = JSON.parse(localStorage.getItem('viscora_liked_maps') || '[]');

            filtered.forEach(level => {
                const item = document.createElement('div');
                item.className = 'map-item';
                
                const isLiked = likedMaps.includes(level.id);
                
                const playedTimeStr = level.lastPlayedAt || level.createdAt;
                const playedTime = new Date(playedTimeStr).getTime();
                const now = Date.now();
                const ageSeconds = (now - playedTime) / 1000;
                const allowedSeconds = 24 * 3600 + (level.likes * 12 * 3600);
                const remainingSeconds = Math.max(0, allowedSeconds - ageSeconds);

                let expiryClass = '';
                if (level.likes >= 50) {
                    expiryClass = 'immortal';
                } else if (remainingSeconds < 6 * 3600) {
                    expiryClass = 'danger';
                } else if (remainingSeconds < 12 * 3600) {
                    expiryClass = 'warning';
                }

                // Render tag badges if any
                const tags = level.tags || (level.data && level.data.tags) || [];
                let tagsHtml = '';
                if (tags.length > 0) {
                    tagsHtml = `<div class="map-tags-row">` + tags.map(t => {
                        let iconHtml = '<svg class="icon-svg"><use href="#icon-puzzle"></use></svg>';
                        if (t === 'Aksiyon') iconHtml = '<svg class="icon-svg"><use href="#icon-sword"></use></svg>';
                        else if (t === 'Kolay') iconHtml = '<span class="dot dot-easy"></span>';
                        else if (t === 'Zor') iconHtml = '<span class="dot dot-hardcore"></span>';
                        else if (t === 'Kısa') iconHtml = '<svg class="icon-svg"><use href="#icon-bolt"></use></svg>';
                        return `<span class="map-tag-badge">${iconHtml} ${t}</span>`;
                    }).join('') + `</div>`;
                }

                item.innerHTML = `
                    <div class="map-info">
                        <h3 style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${level.name}</span>
                            <button class="btn-map-leaderboard" data-id="${level.id}" title="Liderlik Tablosu" style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); border-radius: 4px; padding: 4px 8px; color: #eab308; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-family: inherit; font-weight: bold; outline: none; transition: all 0.2s; white-space: nowrap; margin-left: auto;">
                                <svg class="icon-svg" style="width: 12px; height: 12px; margin: 0; fill: currentColor; stroke: none; vertical-align: middle;"><use href="#icon-star"></use></svg> Skorlar
                            </button>
                        </h3>
                        <div class="map-author">Tasarımcı: <span>${level.author}</span></div>
                        ${tagsHtml}
                        <div class="map-expiry ${expiryClass}" id="expiry-${level.id}" data-played-at="${playedTimeStr}" data-likes="${level.likes}">
                            <svg class="icon-svg" style="margin-right: 4px;"><use href="${level.likes >= 50 ? '#icon-star' : '#icon-time'}"></use></svg> <span class="expiry-timer">${level.likes >= 50 ? 'Kalıcı Bölüm' : formatRemainingTime(remainingSeconds)}</span>
                        </div>
                    </div>
                    <div class="map-actions">
                        <div class="map-likes">
                            <svg class="icon-svg" style="margin-right: 4px; fill: none; stroke: currentColor;"><use href="#icon-like"></use></svg>
                            <span class="like-count" id="likes-${level.id}">${level.likes}</span>
                        </div>
                        <button class="btn-like ${isLiked ? 'liked' : ''}" data-id="${level.id}" ${isLiked ? 'disabled' : ''}>
                            ${isLiked ? 'Beğenildi' : 'Beğen'}
                        </button>
                        <button class="btn-play-map" data-id="${level.id}"><svg class="icon-svg" style="fill: currentColor; stroke: none; margin-right: 4px;"><use href="#icon-play"></use></svg> Oyna</button>
                    </div>
                `;

                // Beğeni Butonu Olayı
                const likeBtn = item.querySelector('.btn-like');
                likeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (likedMaps.includes(level.id)) return;
                    
                    try {
                        const likeRes = await fetch(`${API_BASE}/api/levels/${level.id}/like`, { method: 'POST' });
                        if (likeRes.ok) {
                            const updated = await likeRes.json();
                            const countEl = item.querySelector(`#likes-${level.id}`);
                            if (countEl) countEl.textContent = updated.likes;

                            // Update in our memory list
                            level.likes = updated.likes;

                            const expiryEl = item.querySelector(`#expiry-${level.id}`);
                            if (expiryEl) {
                                expiryEl.setAttribute('data-likes', updated.likes);
                                const timerSpan = expiryEl.querySelector('.expiry-timer');
                                const useEl = expiryEl.querySelector('use');
                                if (updated.likes >= 50) {
                                    expiryEl.classList.remove('warning', 'danger');
                                    expiryEl.classList.add('immortal');
                                    if (timerSpan) timerSpan.textContent = 'Kalıcı Bölüm';
                                    if (useEl) useEl.setAttribute('href', '#icon-star');
                                } else {
                                    const pTimeStr = expiryEl.getAttribute('data-played-at');
                                    const pTime = new Date(pTimeStr).getTime();
                                    const ageSecs = (Date.now() - pTime) / 1000;
                                    const allowedSecs = 24 * 3600 + (updated.likes * 12 * 3600);
                                    const remSecs = Math.max(0, allowedSecs - ageSecs);
                                    
                                    if (timerSpan) timerSpan.textContent = formatRemainingTime(remSecs);
                                    if (useEl) useEl.setAttribute('href', '#icon-time');

                                    expiryEl.classList.remove('warning', 'danger', 'immortal');
                                    if (remSecs < 6 * 3600) {
                                        expiryEl.classList.add('danger');
                                    } else if (remSecs < 12 * 3600) {
                                        expiryEl.classList.add('warning');
                                    }
                                }
                            }
                            
                            likeBtn.classList.add('liked');
                            likeBtn.textContent = 'Beğenildi';
                            likeBtn.disabled = true;
                            
                            likedMaps.push(level.id);
                            localStorage.setItem('viscora_liked_maps', JSON.stringify(likedMaps));
                        }
                    } catch (err) {
                        console.warn("Beğeni gönderme hatası:", err);
                    }
                });

                // Skorlar / Liderlik Tablosu Olayı
                const leaderboardBtn = item.querySelector('.btn-map-leaderboard');
                if (leaderboardBtn) {
                    leaderboardBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showMapLeaderboard(level);
                    });
                }

                // Oyna Butonu Olayı
                const playBtn = item.querySelector('.btn-play-map');
                playBtn.addEventListener('click', () => {
                    if (this.communityInterval) {
                        clearInterval(this.communityInterval);
                        this.communityInterval = null;
                    }
                    this.showScreen('hud');
                    
                    audio.init();
                    audio.startMusic();
                    
                    const myUserId = localStorage.getItem('viscora_user_id') || 'anonymous';
                    fetch(`${API_BASE}/api/levels/${level.id}/play?userId=${myUserId}`, { method: 'POST' }).catch(() => {});
                    
                    this.game.isCommunityPlay = true;
                    this.game.currentCommunityLevelId = level.id;
                    this.game.startCustomLevel(level.data);
                });

                listEl.appendChild(item);
            });

            this.communityInterval = setInterval(() => {
                const timerEls = listEl.querySelectorAll('.map-expiry');
                timerEls.forEach(el => {
                    const likes = parseInt(el.getAttribute('data-likes')) || 0;
                    if (likes >= 50) {
                        const timerSpan = el.querySelector('.expiry-timer');
                        if (timerSpan && timerSpan.textContent !== 'Kalıcı Bölüm') {
                            timerSpan.textContent = 'Kalıcı Bölüm';
                        }
                        const useEl = el.querySelector('use');
                        if (useEl && useEl.getAttribute('href') !== '#icon-star') {
                            useEl.setAttribute('href', '#icon-star');
                        }
                        el.classList.remove('warning', 'danger');
                        if (!el.classList.contains('immortal')) {
                            el.classList.add('immortal');
                        }
                        return;
                    }
                    const pTimeStr = el.getAttribute('data-played-at');
                    const pTime = new Date(pTimeStr).getTime();
                    const ageSecs = (Date.now() - pTime) / 1000;
                    const allowedSecs = 24 * 3600 + (likes * 12 * 3600);
                    const remSecs = Math.max(0, allowedSecs - ageSecs);
                    
                    const timerSpan = el.querySelector('.expiry-timer');
                    if (timerSpan) {
                        timerSpan.textContent = formatRemainingTime(remSecs);
                    }
                    const useEl = el.querySelector('use');
                    if (useEl && useEl.getAttribute('href') !== '#icon-time') {
                        useEl.setAttribute('href', '#icon-time');
                    }
                    
                    el.classList.remove('warning', 'danger', 'immortal');
                    if (remSecs < 6 * 3600) {
                        el.classList.add('danger');
                    } else if (remSecs < 12 * 3600) {
                        el.classList.add('warning');
                    }
                });
            }, 1000);
        };

        const loadCommunityMaps = async (sortType) => {
            const listEl = document.getElementById('community-map-list');
            if (!listEl) return;
            listEl.innerHTML = '<div class="no-maps">Yükleniyor...</div>';

            if (this.communityInterval) {
                clearInterval(this.communityInterval);
                this.communityInterval = null;
            }

            try {
                const myUserId = localStorage.getItem('viscora_user_id') || 'anonymous';
                const res = await fetch(`${API_BASE}/api/levels?sort=${sortType}&userId=${myUserId}`);
                if (!res.ok) throw new Error("Sunucu hatası.");
                const levels = await res.json();

                this.fetchedLevels = levels;

                if (levels.length === 0) {
                    listEl.innerHTML = '<div class="no-maps">Henüz hiç harita paylaşılmamış. İlk paylaşan sen ol!</div>';
                    return;
                }

                renderFilteredCommunityMaps();

            } catch (err) {
                console.warn("Haritaları yükleme hatası:", err);
                listEl.innerHTML = `
                    <div class="no-maps" style="text-align: center; padding: 30px 10px;">
                        <p style="margin-bottom: 12px; color: #ff5555; font-weight: bold; font-size: 18px; display: flex; align-items: center; justify-content: center; gap: 6px;"><svg class="icon-svg" style="color: #ff5555; width: 18px; height: 18px; margin: 0;"><use href="#icon-warning"></use></svg> Bağlantı Başarısız</p>
                        <p style="font-size: 14px; color: #ccc; margin-bottom: 20px; line-height: 1.5;">
                            Sunucu uyandırılıyor olabilir (ilk bağlantı 30-50 saniye sürebilir).<br>
                            Lütfen biraz bekleyip tekrar deneyin.
                        </p>
                        <button id="btn-retry-community" class="menu-btn" style="padding: 10px 20px; font-size: 14px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #ff007f, #7f00ff); border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 0, 127, 0.4);">
                            <svg class="icon-svg" style="width: 14px; height: 14px; margin: 0;"><use href="#icon-time"></use></svg> Yeniden Dene
                        </button>
                    </div>
                `;
                const retryBtn = document.getElementById('btn-retry-community');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => loadCommunityMaps(sortType));
                }
            }
        };

        this.loadCommunityMaps = loadCommunityMaps;
        this.renderFilteredCommunityMaps = renderFilteredCommunityMaps;

        if (btnCommunity) {
            this.bindTouchClick(btnCommunity, () => {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    showConfirmModal(
                        '📡 Bağlantı Yok\n\nTopluluk sunucuları internet bağlantısı gerektirir.\nLütfen bağlantınızı kontrol edip tekrar deneyin.\n\nKampanya modunu çevrimdışı oynayabilirsiniz.',
                        () => {},
                        () => {}
                    );
                    return;
                }
                
                // Reset search and tag filters
                this.searchQuery = '';
                this.activeTagFilter = null;
                if (searchInput) searchInput.value = '';
                tagFilterButtons.forEach(b => b.classList.remove('active'));

                this.showScreen('community');
                loadCommunityMaps(this.currentSort);
            });
        }

        if (btnCloseCommunity) {
            this.bindTouchClick(btnCloseCommunity, () => {
                if (this.communityInterval) {
                    clearInterval(this.communityInterval);
                    this.communityInterval = null;
                }
                this.showScreen('start');
            });
        }

        // Bind tag filter click events
        tagFilterButtons.forEach(btn => {
            this.bindTouchClick(btn, () => {
                const tag = btn.getAttribute('data-tag');
                if (this.activeTagFilter === tag) {
                    this.activeTagFilter = null;
                    btn.classList.remove('active');
                } else {
                    this.activeTagFilter = tag;
                    tagFilterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
                renderFilteredCommunityMaps();
            });
        });

        // Bind search input debounce
        if (searchInput) {
            let debounceTimer = null;
            searchInput.addEventListener('input', (e) => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    renderFilteredCommunityMaps();
                }, 300);
            });
        }

        // --- BÖLÜM TASARLA KONTROLLERİ ---
        const btnDesignMap = document.getElementById('btn-design-map');
        const designSetupModal = document.getElementById('design-setup-modal');
        const btnDesignCancel = document.getElementById('btn-design-cancel');
        const btnDesignCreate = document.getElementById('btn-design-create');
        const txtDesignName = document.getElementById('txt-design-name');
        const selectDesignTheme = document.getElementById('select-design-theme');

        // Slot Seçim Elemanları
        const slotSelectionModal = document.getElementById('slot-selection-modal');
        const btnSlotSelectCancel = document.getElementById('btn-slot-select-cancel');
        const slotSelectButtons = document.querySelectorAll('.slot-select-btn');

        this.selectedSlotForDesign = null;

        const updateSlotSelectionModal = () => {
            if (!slotSelectionModal) return;
            slotSelectButtons.forEach(btn => {
                const slotId = btn.getAttribute('data-slot');
                const infoEl = btn.querySelector('.slot-info');
                if (infoEl) {
                    const slotDataStr = localStorage.getItem('viscora_draft_slot_' + slotId);
                    if (slotDataStr) {
                        try {
                            const data = JSON.parse(slotDataStr);
                            if (data && data.name) {
                                infoEl.textContent = data.name;
                                infoEl.style.color = '#10b981';
                                infoEl.style.fontWeight = 'bold';
                            } else {
                                infoEl.textContent = 'BOŞ YUVA';
                                infoEl.style.color = '#a1a1aa';
                                infoEl.style.fontWeight = 'normal';
                            }
                        } catch (e) {
                            infoEl.textContent = 'BOŞ YUVA';
                            infoEl.style.color = '#a1a1aa';
                            infoEl.style.fontWeight = 'normal';
                        }
                    } else {
                        infoEl.textContent = 'BOŞ YUVA';
                        infoEl.style.color = '#a1a1aa';
                        infoEl.style.fontWeight = 'normal';
                    }
                }
            });
        };

        if (btnDesignMap && slotSelectionModal) {
            this.bindTouchClick(btnDesignMap, () => {
                updateSlotSelectionModal();
                slotSelectionModal.classList.remove('hidden');
            });
        }

        if (btnSlotSelectCancel && slotSelectionModal) {
            this.bindTouchClick(btnSlotSelectCancel, () => {
                slotSelectionModal.classList.add('hidden');
            });
        }

        slotSelectButtons.forEach(btn => {
            this.bindTouchClick(btn, () => {
                const slotId = parseInt(btn.getAttribute('data-slot'));
                if (slotSelectionModal) slotSelectionModal.classList.add('hidden');
                
                const slotDataStr = localStorage.getItem('viscora_draft_slot_' + slotId);
                const txtDesignAuthor = document.getElementById('txt-design-author');
                
                if (slotDataStr) {
                    showConfirmModal(
                        "Kaldığınız yerden devam etmek ister misiniz? (Hayır derseniz mevcut tasarımınız silinip yeni bölüm oluşturulacaktır)",
                        () => {
                            localStorage.setItem('viscora_active_slot', slotId);
                            localStorage.setItem('viscora_custom_level_999', slotDataStr);
                            this.game.currentLevel = 999;
                            this.game.editor.init();
                        },
                        () => {
                            this.selectedSlotForDesign = slotId;
                            if (txtDesignName) txtDesignName.value = '';
                            if (selectDesignTheme) selectDesignTheme.value = 'neon_sewer';
                            if (txtDesignAuthor) {
                                txtDesignAuthor.value = localStorage.getItem('viscora_author_name') || '';
                            }
                            designSetupModal.classList.remove('hidden');
                        }
                    );
                } else {
                    this.selectedSlotForDesign = slotId;
                    if (txtDesignName) txtDesignName.value = '';
                    if (selectDesignTheme) selectDesignTheme.value = 'neon_sewer';
                    if (txtDesignAuthor) {
                        txtDesignAuthor.value = localStorage.getItem('viscora_author_name') || '';
                    }
                    designSetupModal.classList.remove('hidden');
                }
            });
        });

        if (btnDesignCancel && designSetupModal) {
            this.bindTouchClick(btnDesignCancel, () => {
                designSetupModal.classList.add('hidden');
            });
        }

        if (btnDesignCreate && designSetupModal) {
            this.bindTouchClick(btnDesignCreate, async () => {
                const today = new Date().toDateString();
                let designHistory = JSON.parse(localStorage.getItem('viscora_design_history') || '{}');
                if (designHistory.date !== today) {
                    designHistory = { date: today, count: 0 };
                }
                if (designHistory.count >= 5) {
                    alert("Günlük 5 bölüm tasarlama limitinize ulaştınız!");
                    return;
                }

                const name = txtDesignName ? txtDesignName.value.trim() : '';
                if (!name) {
                    alert("Lütfen bir bölüm adı girin!");
                    return;
                }
                const txtDesignAuthor = document.getElementById('txt-design-author');
                const author = txtDesignAuthor ? txtDesignAuthor.value.trim() : '';
                if (!author) {
                    alert("Lütfen bir tasarımcı adı girin!");
                    return;
                }

                if (isOffensive(name)) {
                    alert("Bölüm adı uygunsuz, argo veya siyasi içerik içeremez!");
                    return;
                }
                if (isOffensive(author)) {
                    alert("Tasarımcı adı uygunsuz, argo veya siyasi içerik içeremez!");
                    return;
                }

                localStorage.setItem('viscora_author_name', author);
                const themeId = selectDesignTheme ? selectDesignTheme.value : 'neon_sewer';

                btnDesignCreate.disabled = true;
                const originalText = btnDesignCreate.innerText;
                btnDesignCreate.innerText = "Kontrol ediliyor...";

                try {
                    const res = await fetch(`${API_BASE}/api/levels`);
                    if (res.ok) {
                        const levels = await res.json();
                        const exists = levels.some(lvl => lvl.name.trim().toLowerCase() === name.toLowerCase());
                        if (exists) {
                            alert("Bu bölüm adı zaten mevcut! Lütfen farklı bir isim girin.");
                            btnDesignCreate.disabled = false;
                            btnDesignCreate.innerText = originalText;
                            return;
                        }
                    }
                } catch (e) {
                    console.warn("Sunucu çakışma kontrolü başarısız, devam ediliyor:", e);
                }

                btnDesignCreate.disabled = false;
                btnDesignCreate.innerText = originalText;

                designSetupModal.classList.add('hidden');
                
                const blankLevel = {
                    name: name,
                    themeId: themeId,
                    width: 2000,
                    height: 600,
                    spawn: { x: 80, y: 350 },
                    portal: { x: 1800, y: 380, w: 60, h: 80, angle: 0 },
                    platforms: [
                        { x: 0, y: 460, w: 400, h: 140, type: 'normal' },
                        { x: 1700, y: 460, w: 300, h: 140, type: 'normal' }
                    ]
                };

                const targetSlot = this.selectedSlotForDesign || 1;
                const blankLevelStr = JSON.stringify(blankLevel);
                localStorage.setItem('viscora_active_slot', targetSlot);
                localStorage.setItem('viscora_draft_slot_' + targetSlot, blankLevelStr);
                localStorage.setItem('viscora_custom_level_999', blankLevelStr);
                this.game.currentLevel = 999;
                
                designHistory.count++;
                localStorage.setItem('viscora_design_history', JSON.stringify(designHistory));

                this.game.editor.init();
            });
        }

        communityTabButtons.forEach(btn => {
            this.bindTouchClick(btn, () => {
                this.currentSort = btn.id === 'tab-popular' ? 'popular' : 'new';
                communityTabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadCommunityMaps(this.currentSort);
            });
        });
    }

    /**
     * Viskozite değiştirme döngüsü (NORMAL -> LOW -> HIGH -> NORMAL)
     */
    triggerViscosityShift() {
        if (this.game.state !== 'PLAYING') return;

        const currentId = this.game.player.viscosity.id;
        const currentIndex = ViscosityList.findIndex(v => v.id === currentId);
        const nextIndex = (currentIndex + 1) % ViscosityList.length;
        const nextState = ViscosityList[nextIndex];
        
        this.game.player.setViscosity(nextState.id);
        this.updateHUDViscosity(nextState);

        // Dokunsal geri bildirim: Viskozite değişimi hissiyatı
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(35);
        }

        // Cilalama: Shift partikülleri fırlat
        this.game.emitParticles(
            this.game.player.x, 
            this.game.player.y, 
            'shift', 
            nextState.color, 
            18
        );
    }

    /**
     * Ana menüdeki ses butonunu senkronize eder
     */
    syncMenuSoundButton(isMuted) {
        const menuSoundBtn = document.getElementById('btn-menu-sound');
        const menuSoundText = document.getElementById('menu-sound-text');
        const menuSoundIcon = document.getElementById('menu-sound-icon');
        if (menuSoundBtn && menuSoundText) {
            menuSoundText.textContent = isMuted ? "SES: KAPALI" : "SES: AÇIK";
            if (menuSoundIcon) menuSoundIcon.textContent = isMuted ? "🔇" : "🔊";
            menuSoundBtn.classList.toggle('muted', isMuted);
        }
    }

    /**
     * HUD'daki viskozite rozetini ve mobil butonu günceller
     */
    updateHUDViscosity(state) {
        // Badge güncelleme
        this.viscosityBadge.className = 'viscosity-badge';
        this.viscosityText.textContent = state.name;
        
        // CSS sınıfları ekleme
        const classId = state.id.toLowerCase();
        this.viscosityBadge.classList.add(classId);

        // Shift butonu kenarlık renk animasyonu güncelleme
        this.shiftBtn.className = 'control-btn shift-btn';
        this.shiftBtn.classList.add(classId);
    }

    /**
     * HUD can göstergesini günceller
     */
    updateHUDHealth(health) {
        const container = document.getElementById('health-container');
        if (container) {
            container.innerHTML = '';
            const maxHealth = (this.game && this.game.player) ? this.game.player.maxHealth : 3;
            for (let i = 0; i < maxHealth; i++) {
                const drop = document.createElement('span');
                drop.className = 'health-drop';
                if (i < health) {
                    drop.classList.add('active');
                }
                container.appendChild(drop);
            }
        }
    }

    /**
     * Ekranda belirtilen paneli açar, diğerlerini kapatır
     */
    showScreen(screenName) {
        // Tüm ekranları gizle
        Object.keys(this.screens).forEach(key => {
            this.screens[key].classList.add('hidden');
        });
        
        this.hud.classList.add('hidden');
        this.mobileControls.classList.add('hidden');

        // Belirtilen ekranı göster
        if (screenName === 'hud') {
            this.hud.classList.remove('hidden');
            
            // Eğer mobil veya dokunmatik ekran ise kontrolleri göster (PWA)
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            if (isTouchDevice || window.innerWidth < 1024) {
                this.mobileControls.classList.remove('hidden');
            }
        } else {
            const screen = this.screens[screenName];
            if (screen) {
                screen.classList.remove('hidden');
            }
            
            if (screenName === 'pause' || screenName === 'gameover' || screenName === 'win') {
                const btnPause = document.getElementById('btn-main-menu');
                const btnGameover = document.getElementById('btn-main-menu-gameover');
                const btnWin = document.getElementById('btn-main-menu-win');
                const targetText = this.game.isCommunityPlay ? "🏠 TOPLULUK EKRANINA DÖN" : "🏠 ANA MENÜYE DÖN";
                
                if (btnPause) btnPause.textContent = targetText;
                if (btnGameover) btnGameover.textContent = targetText;
                if (btnWin) btnWin.textContent = targetText;
            }
        }
    }

    /**
     * Giriş tuşlarını sıfırlar (Menülerde hareket etmemek için)
     */
    resetKeys() {
        this.keys.left = false;
        this.keys.right = false;
        this.keys.jump = false;
        this.keys.shift = false;
        this.keys.up = false;
        this.keys.down = false;
    }

    isLevelUnlocked(lvlNum) {
        if (this.devMode) return true;
        if (lvlNum === 0) return true; // Eğitim her zaman açık

        // Boss level kontrolü (10, 20, 30...)
        if (lvlNum > 0 && lvlNum % 10 === 0) {
            const startLvl = lvlNum - 9;
            const endLvl = lvlNum - 1;
            let stars = 0;
            for (let i = startLvl; i <= endLvl; i++) {
                stars += this.game.getStarsForLevel(i);
            }
            if (stars < 24) return false; // Lock boss if less than 24 stars in chapter
        }

        return this.game.unlockedLevel >= lvlNum;
    }

    /**
     * Bölüm seçme işlevi
     */
    selectLevel(levelNum) {
        this.game.currentLevel = levelNum;
        this.updateLevelButtonsUI();
    }

    /**
     * Bölüm seçme butonlarının görsel durumlarını günceller
     */
    updateLevelButtonsUI() {
        // Toplam yıldız sayısını ana menüde güncelle
        const totalStarsVal = document.getElementById('total-stars-val');
        if (totalStarsVal) {
            totalStarsVal.textContent = this.game.getTotalStars();
        }

        if (!this.levelButtons || this.levelButtons.length === 0) return;

        this.levelButtons.forEach((btn) => {
            const lvlNum = parseInt(btn.id.replace('btn-level-', ''));
            const isUnlocked = this.isLevelUnlocked(lvlNum);

            if (isUnlocked) {
                btn.classList.remove('locked');
                btn.disabled = false;
                const stars = this.game.getStarsForLevel(lvlNum);
                // Always show 3 stars: filled or empty
                const starRow = [1,2,3].map(i =>
                    `<span class="btn-star${stars >= i ? '' : ' empty'}">★</span>`
                ).join('');
                btn.innerHTML = `<span class="btn-num">${lvlNum}</span><span class="btn-stars-row">${starRow}</span>`;
            } else {
                btn.classList.add('locked');
                btn.innerHTML = `<span class="btn-num">${lvlNum}</span><span style="font-size: 0.6rem; margin-top: 1px;">🔒</span>`;
            }

            if (this.game.currentLevel === lvlNum) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Chapter star badges güncelle (sadece chapter 1 görünür şu an)
        const groups = [
            { id: 1, start: 1, end: 10 },
            { id: 2, start: 11, end: 20 },
            { id: 3, start: 21, end: 30 }
        ];
        groups.forEach(g => {
            const badge = document.getElementById(`chapter-badge-${g.id}`);
            if (!badge) return;
            let s = 0;
            for (let i = g.start; i <= g.end; i++) s += this.game.getStarsForLevel(i);
            const maxStars = (g.end - g.start + 1) * 3;
            badge.textContent = `⭐ ${s}/${maxStars}`;
            if (s >= 24) {
                badge.classList.add('golden');
            } else {
                badge.classList.remove('golden');
            }
        });
    }

    /**
     * Yıldız Kapısı Modalını gösterir
     */
    showStarGateModal(bossLvl) {
        const modal = document.getElementById('star-gate-modal');
        if (!modal) return;

        // Chapter bilgisi
        const chapterStart = bossLvl - 9;
        const chapterEnd = bossLvl - 1;
        const groups = [
            { id: 1, title: "🚀 İLK ADIMLAR" },
            { id: 2, title: "🧪 TOKSİK HÜCRE" },
            { id: 3, title: "🌌 KOZMİK ÇEKİRDEK" }
        ];
        const chapterIdx = Math.ceil(bossLvl / 10) - 1;
        const chapterTitle = groups[chapterIdx] ? groups[chapterIdx].title : `BÖLÜM ${bossLvl}`;

        // Yıldız say (1'den bossLevel-1'e kadar, sadece chapter içi)
        let stars = 0;
        for (let i = chapterStart; i <= chapterEnd; i++) {
            stars += this.game.getStarsForLevel(i);
        }
        const maxStars = (chapterEnd - chapterStart + 1) * 3; // = 27 for levels 1-9

        // DOM güncelle
        const titleEl = document.getElementById('star-gate-chapter-name');
        if (titleEl) titleEl.textContent = chapterTitle;

        const countEl = document.getElementById('star-gate-count');
        if (countEl) {
            countEl.textContent = `${stars} / ${maxStars}`;
            if (stars >= 24) {
                countEl.classList.add('golden');
            } else {
                countEl.classList.remove('golden');
            }
        }

        const barEl = document.getElementById('star-gate-bar');
        if (barEl) {
            const pct = Math.min(100, (stars / maxStars) * 100);
            // Threshold line at 24/27 = 88.9%
            const thresholdPct = (24 / maxStars) * 100;
            barEl.style.width = `${pct}%`;
            // Update threshold line position dynamically
            const thresholdLine = barEl.parentElement.querySelector('.star-gate-threshold-line');
            if (thresholdLine) thresholdLine.style.left = `${thresholdPct}%`;
        }

        modal.classList.remove('hidden');
    }

    /**
     * Topluluk haritasının skor liderlik tablosunu gösterir (Modal)
     */
    showMapLeaderboard(level) {
        const existing = document.querySelector('.viscora-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'viscora-modal-overlay';
        overlay.style.zIndex = '999999';
        
        const modal = document.createElement('div');
        modal.className = 'viscora-modal';
        modal.style.width = '400px';
        modal.style.maxWidth = '90vw';
        modal.style.background = '#0d0d12';
        modal.style.border = '2px solid #00f2fe';
        modal.style.boxShadow = '0 0 25px rgba(0, 242, 254, 0.25)';
        
        const scores = level.scores || [];
        
        let scoresHtml = '';
        if (scores.length === 0) {
            scoresHtml = `
                <div style="text-align: center; padding: 25px 0; color: #94a3b8;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">⏱️</div>
                    <div style="line-height: 1.5; font-size: 0.9rem;">Henüz bu haritayı tamamlayan olmadı.<br><strong style="color: #00f2fe;">İlk bitiren sen ol!</strong></div>
                </div>
            `;
        } else {
            scoresHtml = '<div style="display: flex; flex-direction: column; gap: 8px; margin: 15px 0;">';
            scores.forEach((s, index) => {
                const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                
                // Format time to 00:00.00
                const sec = parseFloat(s.time) || 0;
                const m = Math.floor(sec / 60);
                const rSec = (sec % 60).toFixed(2);
                const timeStr = `${m.toString().padStart(2, '0')}:${rSec.padStart(5, '0')}`;
                
                scoresHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.1rem; width: 24px; text-align: center;">${badge}</span>
                            <span style="font-weight: 600; color: #f1f5f9;">${s.username}</span>
                        </div>
                        <div style="font-family: monospace; font-size: 0.95rem; color: #00f2fe; font-weight: bold;">
                            ${timeStr}
                        </div>
                    </div>
                `;
            });
            scoresHtml += '</div>';
        }

        modal.innerHTML = `
            <div class="viscora-modal-title" style="border-bottom: 1px solid rgba(0,242,254,0.2); padding-bottom: 10px; margin-bottom: 12px; color: #00f2fe; display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 1.15rem; font-family: inherit;">
                <svg class="icon-svg" style="color: #eab308; width: 18px; height: 18px; margin: 0; fill: currentColor;"><use href="#icon-star"></use></svg> 
                EN İYİ DERECELER
            </div>
            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 5px;">Harita: <strong style="color: #f1f5f9;">${level.name}</strong></div>
            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 15px;">Tasarımcı: <strong style="color: #f1f5f9;">${level.author}</strong></div>
            
            ${scoresHtml}
            
            <div class="viscora-modal-actions" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                <button class="viscora-modal-btn primary" style="background: linear-gradient(135deg, #00f2fe, #4facfe); border: none; width: 100%; font-weight: bold;" id="btn-close-leaderboard">KAPAT</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeBtn = modal.querySelector('#btn-close-leaderboard');
        if (closeBtn) {
            closeBtn.focus();
            closeBtn.addEventListener('click', () => {
                overlay.remove();
            });
        }
    }

    /**
     * Bellekteki topluluk haritasının skor tablosunu günceller
     */
    updateLevelScores(levelId, scores) {
        if (this.fetchedLevels) {
            const found = this.fetchedLevels.find(lvl => lvl.id === levelId);
            if (found) {
                found.scores = scores;
            }
        }
    }
}
export default UIManager;


