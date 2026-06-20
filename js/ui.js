import { audio } from './audio.js?v=v120';
import { ViscosityList } from './viscosity.js?v=v120';

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
            community: document.getElementById('community-screen')
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

            const key = e.key.toLowerCase();
            if (key === 'a' || e.key === 'ArrowLeft') {
                this.keys.left = true;
            } else if (key === 'd' || e.key === 'ArrowRight') {
                this.keys.right = true;
            } else if (key === 'w' || e.key === 'ArrowUp') {
                this.keys.up = true;
                this.game.player.jump(false);
            } else if (key === 's' || e.key === 'ArrowDown') {
                this.keys.down = true;
            } else if (e.key === ' ') {
                this.keys.jump = true;
                this.game.player.jump(true);
            } else if (e.key === 'Shift' || key === 'e') {
                this.triggerViscosityShift();
            } else if (e.key === 'Escape' || key === 'p') {
                this.game.togglePause();
            }
        });

        // Tuş bırakma
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a' || e.key === 'ArrowLeft') {
                this.keys.left = false;
            } else if (key === 'd' || e.key === 'ArrowRight') {
                this.keys.right = false;
            } else if (key === 'w' || e.key === 'ArrowUp') {
                this.keys.up = false;
            } else if (key === 's' || e.key === 'ArrowDown') {
                this.keys.down = false;
            } else if (e.key === ' ') {
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
            { id: 1, title: "🚀 İLK ADIMLAR", start: 1, end: 10, class: "group-1" },
            { id: 2, title: "🧪 TOKSİK HÜCRE", start: 11, end: 20, class: "group-2" },
            { id: 3, title: "🌌 KOZMİK ÇEKİRDEK", start: 21, end: 30, class: "group-3" }
        ];

        groups.forEach(g => {
            const isCollapsed = g.id !== activeGroupIndex;
            const collapseClass = isCollapsed ? 'collapsed' : '';
            const isGroupUnlocked = g.id === 1 || this.devMode || this.game.unlockedLevel >= g.start;
            const statusText = isGroupUnlocked ? `Bölüm ${g.start}-${g.end}` : 'Kilitli 🔒';
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
                ? `<span id="chapter-badge-${g.id}" class="chapter-star-badge ${badgeGolden}">⭐ ${chapterStars}/${maxStars}</span>`
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
                html += `<button id="btn-level-${i}" class="level-btn locked" ${disabledAttr}><span class="btn-num">${i}</span><span style="font-size:0.6rem;">🔒</span></button>`;
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

            const icon = isMuted ? '🔇' : '🎵';
            if (btnMenuMusic) {
                btnMenuMusic.textContent = icon;
                btnMenuMusic.classList.toggle('muted', isMuted);
            }
            if (btnPauseMusic) {
                btnPauseMusic.textContent = icon;
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

            const icon = isMuted ? '🔇' : '🔊';
            if (btnMenuSfx) {
                btnMenuSfx.textContent = icon;
                btnMenuSfx.classList.toggle('muted', isMuted);
            }
            if (btnPauseSfx) {
                btnPauseSfx.textContent = icon;
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

        // --- TOPLULUK SUNUCULARI ÇALIŞMASI ---
        const btnCommunity = document.getElementById('btn-community');
        const btnCloseCommunity = document.getElementById('btn-close-community');
        const communityTabButtons = document.querySelectorAll('.community-tab-btn');
        let currentSort = 'popular'; // Varsayılan popüler sıralama

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

                if (levels.length === 0) {
                    listEl.innerHTML = '<div class="no-maps">Henüz hiç harita paylaşılmamış. İlk paylaşan sen ol!</div>';
                    return;
                }

                listEl.innerHTML = '';
                const likedMaps = JSON.parse(localStorage.getItem('viscora_liked_maps') || '[]');

                levels.forEach(level => {
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
                    if (remainingSeconds < 6 * 3600) {
                        expiryClass = 'danger';
                    } else if (remainingSeconds < 12 * 3600) {
                        expiryClass = 'warning';
                    }

                    item.innerHTML = `
                        <div class="map-info">
                            <h3>${level.name}</h3>
                            <div class="map-author">Tasarımcı: <span>${level.author}</span></div>
                            <div class="map-expiry ${expiryClass}" id="expiry-${level.id}" data-played-at="${playedTimeStr}" data-likes="${level.likes}">
                                ⏳ <span class="expiry-timer">${formatRemainingTime(remainingSeconds)}</span>
                            </div>
                        </div>
                        <div class="map-actions">
                            <div class="map-likes">
                                <span>👍</span>
                                <span class="like-count" id="likes-${level.id}">${level.likes}</span>
                            </div>
                            <button class="btn-like ${isLiked ? 'liked' : ''}" data-id="${level.id}" ${isLiked ? 'disabled' : ''}>
                                ${isLiked ? 'Beğenildi' : 'Beğen'}
                            </button>
                            <button class="btn-play-map" data-id="${level.id}">▶️ Oyna</button>
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

                                const expiryEl = item.querySelector(`#expiry-${level.id}`);
                                if (expiryEl) {
                                    expiryEl.setAttribute('data-likes', updated.likes);
                                    const pTimeStr = expiryEl.getAttribute('data-played-at');
                                    const pTime = new Date(pTimeStr).getTime();
                                    const ageSecs = (Date.now() - pTime) / 1000;
                                    const allowedSecs = 24 * 3600 + (updated.likes * 12 * 3600);
                                    const remSecs = Math.max(0, allowedSecs - ageSecs);
                                    
                                    const timerSpan = expiryEl.querySelector('.expiry-timer');
                                    if (timerSpan) timerSpan.textContent = formatRemainingTime(remSecs);

                                    expiryEl.classList.remove('warning', 'danger');
                                    if (remSecs < 6 * 3600) {
                                        expiryEl.classList.add('danger');
                                    } else if (remSecs < 12 * 3600) {
                                        expiryEl.classList.add('warning');
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

                    // Oyna Butonu Olayı
                    const playBtn = item.querySelector('.btn-play-map');
                    playBtn.addEventListener('click', () => {
                        if (this.communityInterval) {
                            clearInterval(this.communityInterval);
                            this.communityInterval = null;
                        }
                        this.showScreen('hud');
                        
                        // Custom level verisini direkt loadLevel ile yükle
                        audio.init();
                        audio.startMusic();
                        
                        // Send play event to backend to update lastPlayedAt
                        fetch(`${API_BASE}/api/levels/${level.id}/play`, { method: 'POST' }).catch(() => {});
                        
                        this.game.isCommunityPlay = true;
                        this.game.startCustomLevel(level.data);
                    });

                    listEl.appendChild(item);
                });

                // Canlı sayaç interval'ini kur
                this.communityInterval = setInterval(() => {
                    const timerEls = listEl.querySelectorAll('.map-expiry');
                    timerEls.forEach(el => {
                        const pTimeStr = el.getAttribute('data-played-at');
                        const likes = parseInt(el.getAttribute('data-likes')) || 0;
                        const pTime = new Date(pTimeStr).getTime();
                        const ageSecs = (Date.now() - pTime) / 1000;
                        const allowedSecs = 24 * 3600 + (likes * 12 * 3600);
                        const remSecs = Math.max(0, allowedSecs - ageSecs);
                        
                        const timerSpan = el.querySelector('.expiry-timer');
                        if (timerSpan) {
                            timerSpan.textContent = formatRemainingTime(remSecs);
                        }
                        
                        el.classList.remove('warning', 'danger');
                        if (remSecs < 6 * 3600) {
                            el.classList.add('danger');
                        } else if (remSecs < 12 * 3600) {
                            el.classList.add('warning');
                        }
                    });
                }, 1000);

            } catch (err) {
                console.warn("Haritaları yükleme hatası:", err);
                listEl.innerHTML = `
                    <div class="no-maps" style="text-align: center; padding: 30px 10px;">
                        <p style="margin-bottom: 12px; color: #ff5555; font-weight: bold; font-size: 18px;">⚠️ Bağlantı Başarısız</p>
                        <p style="font-size: 14px; color: #ccc; margin-bottom: 20px; line-height: 1.5;">
                            Sunucu uyandırılıyor olabilir (ilk bağlantı 30-50 saniye sürebilir).<br>
                            Lütfen biraz bekleyip tekrar deneyin.
                        </p>
                        <button id="btn-retry-community" class="menu-btn" style="padding: 10px 20px; font-size: 14px; margin: 0 auto; display: block; background: linear-gradient(135deg, #ff007f, #7f00ff); border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 0, 127, 0.4);">
                            🔄 Yeniden Dene
                        </button>
                    </div>
                `;
                const retryBtn = document.getElementById('btn-retry-community');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => loadCommunityMaps(sortType));
                }
            }
        };

        if (btnCommunity) {
            this.bindTouchClick(btnCommunity, () => {
                // Proaktif çevrimdışı kontrolü
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    showConfirmModal(
                        '📡 Bağlantı Yok\n\nTopluluk sunucuları internet bağlantısı gerektirir.\nLütfen bağlantınızı kontrol edip tekrar deneyin.\n\nKampanya modunu çevrimdışı oynayabilirsiniz.',
                        () => {},
                        () => {}
                    );
                    return;
                }
                this.showScreen('community');
                loadCommunityMaps(currentSort);
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

        // --- BÖLÜM TASARLA KONTROLLERİ ---
        const btnDesignMap = document.getElementById('btn-design-map');
        const designSetupModal = document.getElementById('design-setup-modal');
        const btnDesignCancel = document.getElementById('btn-design-cancel');
        const btnDesignCreate = document.getElementById('btn-design-create');
        const txtDesignName = document.getElementById('txt-design-name');
        const selectDesignTheme = document.getElementById('select-design-theme');

        if (btnDesignMap && designSetupModal) {
            this.bindTouchClick(btnDesignMap, () => {
                const savedLevelData = localStorage.getItem('viscora_custom_level_999');
                const txtDesignAuthor = document.getElementById('txt-design-author');
                if (txtDesignAuthor) {
                    txtDesignAuthor.value = localStorage.getItem('viscora_author_name') || '';
                }
                if (savedLevelData) {
                    showConfirmModal(
                        "Kaldığınız yerden devam etmek ister misiniz? (Hayır derseniz mevcut tasarımınız silinip yeni bölüm oluşturulacaktır)",
                        () => {
                            this.game.currentLevel = 999;
                            this.game.editor.init();
                        },
                        () => {
                            if (txtDesignName) txtDesignName.value = '';
                            if (selectDesignTheme) selectDesignTheme.value = 'neon_sewer';
                            if (txtDesignAuthor) txtDesignAuthor.value = localStorage.getItem('viscora_author_name') || '';
                            designSetupModal.classList.remove('hidden');
                        }
                    );
                    return;
                }

                if (txtDesignName) txtDesignName.value = '';
                if (selectDesignTheme) selectDesignTheme.value = 'neon_sewer';
                if (txtDesignAuthor) txtDesignAuthor.value = localStorage.getItem('viscora_author_name') || '';
                designSetupModal.classList.remove('hidden');
            });
        }

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

                // Sunucuda aynı isimde harita var mı kontrol et
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

                // Modalı kapat
                designSetupModal.classList.add('hidden');
                
                // Boş bölüm verisi oluştur
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

                // LocalStorage'a 999 olarak kaydet ki editor yükleyebilsin
                localStorage.setItem('viscora_custom_level_999', JSON.stringify(blankLevel));
                this.game.currentLevel = 999;
                
                // Artır ve kaydet
                designHistory.count++;
                localStorage.setItem('viscora_design_history', JSON.stringify(designHistory));

                // Editörü başlat
                this.game.editor.init();
            });
        }

        communityTabButtons.forEach(btn => {
            this.bindTouchClick(btn, () => {
                currentSort = btn.getAttribute('data-tab');
                communityTabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadCommunityMaps(currentSort);
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
}
export default UIManager;
