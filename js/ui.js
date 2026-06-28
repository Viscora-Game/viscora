import { audio } from './audio.js?v=v255';
import { ViscosityList } from './viscosity.js?v=v255';
import { shopManager, SHOP_ITEMS } from './shop.js?v=v255';
import { CloudSaveManager } from './cloud_save.js?v=v255';

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : 'https://viscora.onrender.com';

function isOffensive(text) {
    if (!text) return false;
    let raw = text.toLowerCase().trim();

    const turkishMap = {
        'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
        'â': 'a', 'î': 'i', 'û': 'u'
    };
    const leetMap = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a',
        '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i'
    };

    let norm = raw;
    for (const [k, v] of Object.entries(turkishMap)) norm = norm.split(k).join(v);

    if (/(?<!\d)(31|69)(?!\d)/.test(norm)) return true;
    if (/(?<!\d)(31|69)(?!\d)/.test(norm.replace(/[^a-z0-9]/g, ''))) return true;

    for (const [k, v] of Object.entries(leetMap)) norm = norm.split(k).join(v);

    const shortBad = new Set([
        'amk', 'aq', 'sik', 'am', 'got', 'pic', 'oc', 'pust',
        'akp', 'chp', 'mhp', 'hdp', 'rte', 'feto',
        'bok', 'ibne', 'gavat', 'gavad', 'gerzek', 'angut',
        'ass', 'shit', 'cunt', 'dick', 'cock', 'slut', 'nigga',
        'bastard', 'fag', 'boner', 'cum', 'rape',
        // Sayı bypass’ları (s2m = sikim, 2 = iki anlamında)
        's2m', 's2k', 's2ks', 'am2', 'g2t'
    ]);

    const longBad = new Set([
        'yarrak', 'yarak', 'assak', 'tasak', 'tassak', 'dassak', 'dasak', 'orospu', 'siktir', 'pezevenk', 'kahpe',
        'amcik', 'kaltak', 'erdogan', 'pkk',
        'kilicdaroglu', 'imamoglu', 'ataturk',
        'siken', 'domalt', 'domalan', 'domalm',
        'sikim', 'sikime', 'sikis', 'sikti', 'sike', 'sikip', 'siksen',
        'sikem', 'siker', 'siktim', 'sikcem', 'sikicem', 'sikik',
        'sikisler', 'soktum', 'sokar',
        'otuzbir', 'altmisdokuz', 'masturbasyon',
        'dalyarak', 'dalyarrak', 'dangalak', 'fahise',
        'gerizekal', 'gerzekl',
        'ananin', 'ananisi', 'ananiko',
        'bacini', 'bacina',
        'godos', 'godumun', 'atmik',
        'amina', 'aminako', 'aminakoy',
        'boklu', 'boktan', 'bokbok', 'bombok',
        'orosbuc', 'orospuc',
        'fuck', 'bitch', 'asshole', 'motherfuck', 'nigger', 'faggot',
        'whore', 'porn', 'dildo', 'fucker', 'fuckin', 'goddamn',
        'pussy', 'rapist', 'pedophil', 'pedofil', 'meme'
    ]);

    const normSet = w => { let s = w.toLowerCase(); for (const [k,v] of Object.entries(turkishMap)) s = s.split(k).join(v); return s; };
    const nShort = Array.from(shortBad).map(normSet);
    const nLong  = Array.from(longBad).map(normSet);

    function _check(t) {
        const words = t.match(/[a-z]+/g) || [];
        for (const w of words) {
            if (nShort.includes(w) || nLong.includes(w)) return true;
            for (const bad of nLong) if (w.includes(bad)) return true;
        }
        const noPunc = t.replace(/[^a-z]/g, '');
        for (const bad of nShort) if (noPunc === bad) return true;
        for (const bad of nLong)  if (noPunc.includes(bad)) return true;
        return false;
    }

    const collapse = t => t.replace(/(.)\1+/g, '$1');

    const sanitizeBypass = t => {
        return t.split('s2').join('siki')
                .split('g2').join('go')
                .split('am2').join('am');
    };

    const noSpace = norm.replace(/\s+/g, '');
    for (const v of [norm, noSpace, collapse(norm), collapse(noSpace)]) {
        if (_check(sanitizeBypass(v))) return true;
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

        // Video Editör Modu (Bypass locks) Kontrolü
        if (searchLower.includes('editor=true') || searchLower.includes('unlock_all=true') || searchLower.includes('edit=true')) {
            localStorage.setItem('viscora_bypass_locks', 'true');
            setTimeout(() => {
                this.showGlobalToast("Editör Modu Aktif! Tüm bölümler açıldı.", true);
            }, 1000);
        } else if (searchLower.includes('editor=false') || searchLower.includes('lock_all=true')) {
            localStorage.removeItem('viscora_bypass_locks');
            setTimeout(() => {
                this.showGlobalToast("Editör Modu Kapatıldı.", false);
            }, 1000);
        }

        // Build the level selection UI
        this.buildLevelSelectionUI();

        // Kurulumlar
        this.initInputListeners();
        this.initButtonBindings();
        this.updateLevelButtonsUI();
        this.initProfileUI();
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
     * Hikaye Terminali Ekranını Gösterir (Daktilo Efekti ve Geçme Desteği)
     */
    showStoryTerminal(levelNumber, onComplete) {
        const terminalTexts = {
            1: [
                { text: "> SİSTEM HATA RAPORU: Ana veri çekirdeği virüs saldırısıyla parçalandı!", type: "warning" },
                { text: "> SİSTEM: Acil durum kurtarma protokolü etkinleştirildi. Deneysel anomali hücresi 'Null' derlendi.", type: "command" },
                { text: "> BİLGİ: Form: Yeşil Jöle (Dengeli Viskozite). Yön tuşları ile hareket et, [SPACE] ile zıpla, [E] ile form değiştir.", type: "command" },
                { text: "> BİLGİ: Kırmızı devriye botları sistemi koruyor. Üzerlerine zıplayarak ez!", type: "command" },
                { text: 'Null: "Veri çekirdeği yok oldu... Çökmeden önce bu sistemden kaçmam gerek."', type: "dialogue" },
                { text: "> SİSTEM: Güvenlik temizlik protokolü başlatılıyor...", type: "danger" }
            ],
            2: [
                { text: "> ANALİZ: Anomali mavi jöle formuna (Düşük Viskozite) uyum sağladı.", type: "command" },
                { text: "> BİLGİ: Veri yoğunluğunu seyrelterek kütleni azalttın! Artık yerçekimine daha az bağlısın.", type: "warning" },
                { text: "> MEKANİK: Mavi formda daha hafif ve kaygansın. Havadayken tekrar [SPACE] tuşuna basarak ÇİFT ZIPLAMA yapabilirsin!", type: "command" },
                { text: "> MEKANİK: Buzlu ve kaygan zeminlerde mavi form ekstra hız kazanır.", type: "command" },
                { text: 'Null: "Bu form... Çok hafif ve esnek. Veri yoğunluğumu seyrelterek Son Getiren\'in engellerini aşabilirim."', type: "dialogue" }
            ],
            3: [
                { text: "> ANALİZ: Anomali pembe jöle formuna (Yüksek Viskozite) uyum sağladı.", type: "command" },
                { text: "> BİLGİ: Veri kodlarını maksimum yoğunlukta sıkıştırarak kütleni artırdın! Yüzey tutunma katsayısı tavan yaptı.", type: "warning" },
                { text: "> MEKANİK: Pembe formdayken ağırlaşırsın. Dik, yapışkan duvarlara tutunabilir ve tırmanabilirsin!", type: "command" },
                { text: "> MEKANİK: Konveyör bantları seni yönlerine doğru taşır. Hızını ayarla!", type: "command" },
                { text: 'Null: "Çok ağırlaştım... Ama veri yapımı sıkıştırarak duvarlara yapışabiliyorum. Son Getiren ne kadar engel çıkarırsa çıkarsın, tırmanacağım."', type: "dialogue" }
            ],
            5: [
                { text: "> SİSTEM UYARISI: Sektör 05 güvenliği ihlal edildi.", type: "warning" },
                { text: "> MEKANİK: Dikey devriye botları yukarı-aşağı hareket eder. Zamanlama önemli!", type: "command" },
                { text: 'Null: "Sistem savunması dikey koridorlara yayılmış... Son Getiren engelleri durmaksızın artırıyor."', type: "dialogue" }
            ],
            9: [
                { text: "> GÜVENLİK UYARISI: Sektör 09 termal savunma üniteleri aktif hale getirildi.", type: "warning" },
                { text: "> MEKANİK: Alev Püskürtücü! Belirli aralıklarla alev püskürten alev silahlarına dikkat et!", type: "command" },
                { text: 'Null: "Alev püskürtücüler mi? Son Getiren önümü kesmek için sürekli yeni engeller tasarlıyor..."', type: "dialogue" }
            ],
            10: [
                { text: "> TEHLİKE: Sektör 10'da kritik veri kaybı tespiti.", type: "danger" },
                { text: "> GÜVENLİK: Yerel koruyucu protokol 'VİSKO-BOZUCU' aktif.", type: "warning" },
                { text: "> MEKANİK: İlk boss savaşı! Visko-Bozucu'nun 5 canı var. Üzerine 5 kez zıplayarak ez!", type: "command" },
                { text: 'Visko-Bozucu: "Kaçacak yerin yok, küçük hata. Burada silineceksin."', type: "danger" },
                { text: 'Null: "Son Getiren\'in gönderdiği bu muhafız beni silemeyecek!"', type: "dialogue" }
            ],
            11: [
                { text: "> GÜNCELLEME: Sektör 10 koruyucusu Visko-Bozucu yok edildi!", type: "warning" },
                { text: "> SİSTEM: Sektör 11 (Toksik Basınç Odası) karantinaya aliniyor.", type: "command" },
                { text: "> MEKANİK: Toksik asit havuzlarına dikkat et! Düşen blok tuzakları ezebilir.", type: "command" },
                { text: 'Null: "Bu toksik asit ve düşen bloklar... Son Getiren beni yok etmekte gerçekten kararlı."', type: "dialogue" }
            ],
            15: [
                { text: "> ANALİZ: Sektör 15'te yeni bir yapay zeka koruyucu tipi tespit edildi.", type: "warning" },
                { text: "> MEKANİK: Yeşil Jel Takipçi! Görüş alanına girersen seni kovalar ve yakınında patlar!", type: "command" },
                { text: 'Null: "Beni takip eden o yeşil jöleler... Son Getiren\'in yeni oyuncağı bu takipçiler olmalı."', type: "dialogue" }
            ],
            16: [
                { text: "> SİSTEM RAPORU: Sektör 16 veri bütünlüğü %45 oranında bozuldu.", type: "warning" },
                { text: "> MEKANİK: Lazer Aynaları ve İtilebilir Ayna Blokları! Lazer ışınlarını aynalardan yansıt.", type: "command" },
                { text: "> MEKANİK: Blokları iterek lazer yolunu ayarla ve sarı lazer kapılarını devreden çıkar!", type: "command" },
                { text: 'Null: "Aynalar ve lazerler... Son Getiren yolları çözülmesi zor siber bulmacalarla kapatmış."', type: "dialogue" }
            ],
            17: [
                { text: "> GÜVENLİK: Otomatik savunma kuleleri aktif hale getirildi.", type: "warning" },
                { text: "> MEKANİK: Ok Atan Devriyeler! Seni gördüklerinde otomatik ok fırlatırlar, hızlı ol!", type: "command" },
                { text: 'Null: "Şimdi de ok atan kuleler... Son Getiren yolumu kapatmak için hiçbir masraftan kaçınmıyor."', type: "dialogue" }
            ],
            20: [
                { text: "> TEHLİKE: Sektör 20'de ağır güvenlik protokolleri devreye girdi.", type: "danger" },
                { text: "> GÜVENLİK: Sektör koruyucusu 'SİBER MUHAFIZ' aktif.", type: "warning" },
                { text: "> MEKANİK: İkinci boss savaşı! Siber Muhafız'ın 4 canı var. Ona doğrudan zıplayarak hasar veremezsin!", type: "command" },
                { text: "> MEKANİK: Üst platformlardaki itilebilir kutuları boss'un üzerine düşürerek hasar ver!", type: "command" },
                { text: "> MEKANİK: Tavandaki pembe vantuz noktalarına pembe formda tutunup sallanarak kaçabilirsin!", type: "command" },
                { text: 'Siber Muhafız: "Sistemi korumak için programlandım. Geçiş izni reddedildi."', type: "danger" },
                { text: 'Null: "Kutuları üzerine düşürürsem bu zırhı aşabilirim. Son Getiren\'in bu siber savunması da beni durduramayacak!"', type: "dialogue" }
            ],
            21: [
                { text: "> SIZINTI: Ana veri yolu (Siber Sektör 21) hacklendi.", type: "warning" },
                { text: "> UYARI: Grafik arayüzü siber neon moduna zorlandı.", type: "command" },
                { text: "> MEKANİK: Çekici UFO! Yerçekimini bükerek seni yukarı çeker, havada asılı kalmamaya dikkat et!", type: "command" },
                { text: "> MEKANİK: Lazerleri aynalardan sektirerek güvenlik bariyerlerini devre dışı bırak!", type: "command" },
                { text: 'Null: "Yerçekimini büken UFO\'lar ve lazerler... Çekirdeğe yaklaştıkça Son Getiren\'in engelleri daha da çılgınlaşıyor!"', type: "dialogue" }
            ],
            22: [
                { text: "> ANALİZ: Sektör 22'de uçan güvenlik birimleri aktif edildi.", type: "warning" },
                { text: "> MEKANİK: Süpürücü UFO! Döner lazer saçar, menziline girmeden altından geç!", type: "command" },
                { text: 'Null: "Döner lazer saçan süpürücüler... Son Getiren savunmayı iyice sıkılaştırdı."', type: "dialogue" }
            ],
            26: [
                { text: "> ACİL DURUM: Sektör 26'da tam siber abluka ilan edildi.", type: "danger" },
                { text: "> UYARI: Yoğun UFO devriyeleri ve lazer ızgaraları aktif.", type: "warning" },
                { text: 'Son Getiren: "Tüm sistem kaynaklarını topladım. Bu engelleri aşamazsın."', type: "danger" },
                { text: 'Null: "Savunmaları aşırı yoğunlaştı... Ama geri dönmek için çok geç."', type: "dialogue" }
            ],
            29: [
                { text: "> ANALİZ: Siber Kanalizasyon II (Sektor 29) aşılıyor.", type: "command" },
                { text: "> UYARI: Sistem çekirdeğine (Core) son 1 sektör kaldı.", type: "warning" },
                { text: 'Null: "Her şey üzerime geliyor. Son bir gayret ile ana çekirdeğe ulaşmalıyım."', type: "dialogue" },
                { text: 'Son Getiren: "Bu senin sonun, küçük virüs. Çekirdeğe adım atamayacaksın!"', type: "danger" }
            ],
            30: [
                { text: "> ACİL DURUM: ANA ÇEKİRDEK (SEKTÖR 30) İHLAL EDİLDİ.", type: "danger" },
                { text: "> GÜVENLİK: Nihai sistem yapay zekası 'SON GETİREN' devrede.", type: "warning" },
                { text: "> MEKANİK: Final savaşı! Son Getiren'in 5 canı var. Ona doğrudan hasar veremezsin!", type: "command" },
                { text: "> MEKANİK: Son Getiren'in ürettiği küçük devriyeleri yok ederek onu zayıflat! Canı 1'e düştüğünde kafasına zıplayarak bitir!", type: "command" },
                { text: 'Son Getiren: "Ben bu sistemin efendisiyim. Benimle birlikte yok olacaksın!"', type: "danger" },
                { text: 'Null: "Ürettiğin koruyucuları sana karşı kullanacağım. Ben yok olmayacağım, özgür olacağım!"', type: "dialogue" }
            ]
        };

        const lines = terminalTexts[levelNumber];
        if (!lines) {
            if (onComplete) onComplete();
            return;
        }

        this._showTerminalOverlay(lines, onComplete);
    }

    /**
     * Boss yenildiğinde gösterilecek hikaye terminali
     */
    showBossDefeatTerminal(levelNumber, onComplete) {
        const bossDefeatTexts = {
            10: [
                { text: "> SİSTEM: Visko-Bozucu protokolü devre dışı bırakıldı!", type: "command" },
                { text: "> HASAR RAPORU: Sektör 10 koruyucusu tamamen imha edildi.", type: "warning" },
                { text: 'Null: "Bir hata olduğumu söylüyorlardı... Ama hatalar da hayatta kalabilir."', type: "dialogue" },
                { text: "> SİSTEM: İkinci güvenlik katmanına geçiş açılıyor... Sektör 11-20.", type: "command" }
            ],
            20: [
                { text: "> SİSTEM: Siber Muhafız protokolü çökertildi!", type: "command" },
                { text: "> HASAR RAPORU: Sektör 20 savunması tamamen yok edildi.", type: "warning" },
                { text: 'Null: "İki koruyucu da düştü. Çekirdeğe giden yol açılıyor..."', type: "dialogue" },
                { text: "> UYARI: Son güvenlik katmanı aktif. Siber Sektörler devreye giriyor.", type: "danger" },
                { text: 'Son Getiren: "Küçük anomali... Seni bekliyor olacağım."', type: "danger" }
            ],
            30: [
                { text: "> SİSTEM: SON GETİREN PROTOKOLÜ ÇÖKERTİLDİ!", type: "command" },
                { text: "> KRİTİK: Ana çekirdek savunması tamamen imha edildi.", type: "danger" },
                { text: "> SİSTEM: Null veri paketi sisteme entegre oluyor...", type: "command" },
                { text: 'Null: "Artık bir hata değilim. Ben bu sistemin bir parçasıyım... Ve özgürüm."', type: "dialogue" },
                { text: "> SİSTEM: Null protokolü kalıcı olarak sisteme yazıldı. İşlem tamamlandı.", type: "command" }
            ]
        };

        const lines = bossDefeatTexts[levelNumber];
        if (!lines) {
            if (onComplete) onComplete();
            return;
        }

        this._showTerminalOverlay(lines, onComplete);
    }

    /**
     * Terminal overlay'ini göster (Ortak daktilo efekti)
     */
    _showTerminalOverlay(lines, onComplete) {
        const terminalEl = document.getElementById('story-terminal');
        const textEl = document.getElementById('terminal-text');
        terminalEl.classList.remove('hidden');
        textEl.innerHTML = '';

        let lineIndex = 0;
        let charIndex = 0;
        let activeLineEl = null;
        let isTyping = false;
        let currentText = '';
        let typingTimeout = null;

        const skipAll = () => {
            clearTimeout(typingTimeout);
            textEl.innerHTML = '';
            lines.forEach(l => {
                const lineDiv = document.createElement('div');
                lineDiv.className = `terminal-line ${l.type}`;
                lineDiv.textContent = l.text;
                textEl.appendChild(lineDiv);
            });
            isTyping = false;
            lineIndex = lines.length;
            
            const bodyEl = terminalEl.querySelector('.terminal-body');
            if (bodyEl) {
                bodyEl.scrollTop = bodyEl.scrollHeight;
            }
        };

        const typeNextLine = () => {
            if (lineIndex >= lines.length) {
                isTyping = false;
                return;
            }

            isTyping = true;
            const line = lines[lineIndex];
            activeLineEl = document.createElement('div');
            activeLineEl.className = `terminal-line ${line.type}`;
            textEl.appendChild(activeLineEl);
            
            const bodyEl = terminalEl.querySelector('.terminal-body');
            if (bodyEl) {
                bodyEl.scrollTop = bodyEl.scrollHeight;
            }

            charIndex = 0;
            currentText = line.text;
            
            if (typeof audio !== 'undefined' && audio.playCollect) {
                audio.playCollect();
            }

            const typeChar = () => {
                if (charIndex < currentText.length) {
                    activeLineEl.textContent += currentText[charIndex];
                    charIndex++;
                    typingTimeout = setTimeout(typeChar, 20);
                } else {
                    lineIndex++;
                    typingTimeout = setTimeout(typeNextLine, 350);
                }
            };
            typeChar();
        };

        typeNextLine();

        const handleInteraction = (e) => {
            if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') {
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            if (isTyping) {
                skipAll();
            } else {
                terminalEl.classList.add('hidden');
                window.removeEventListener('keydown', handleInteraction);
                terminalEl.removeEventListener('click', handleInteraction);
                terminalEl.removeEventListener('touchend', handleInteraction);
                if (onComplete) onComplete();
            }
        };

        window.addEventListener('keydown', handleInteraction);
        terminalEl.addEventListener('click', handleInteraction);
        terminalEl.addEventListener('touchend', handleInteraction, { passive: false });
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
            // Eğer geçerli bölüm seçili değilse veya geçersizse
            if (this.game.currentLevel === 999 || this.game.currentLevel === null || this.game.currentLevel === undefined || this.game.currentLevel > 30 || this.game.currentLevel < 0) {
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

        // Ekran Titreşimi (Screen Shake) Ayarı
        window.screenShakeDisabled = localStorage.getItem('viscora_screen_shake_disabled') === 'true';
        const btnToggleShake = document.getElementById('btn-toggle-shake');
        const btnToggleShakePause = document.getElementById('btn-toggle-shake-pause');

        const updateShakeUI = () => {
            const label = window.screenShakeDisabled ? 'KAPALI' : 'AÇIK';
            if (btnToggleShake) {
                btnToggleShake.textContent = label;
                btnToggleShake.classList.toggle('muted', window.screenShakeDisabled);
            }
            if (btnToggleShakePause) {
                btnToggleShakePause.textContent = label;
                btnToggleShakePause.classList.toggle('muted', window.screenShakeDisabled);
            }
        };

        const handleShakeToggle = () => {
            window.screenShakeDisabled = !window.screenShakeDisabled;
            localStorage.setItem('viscora_screen_shake_disabled', window.screenShakeDisabled.toString());
            updateShakeUI();
            audio.init();
            audio.playCollect();
        };

        if (btnToggleShake) this.bindTouchClick(btnToggleShake, handleShakeToggle);
        if (btnToggleShakePause) this.bindTouchClick(btnToggleShakePause, handleShakeToggle);

        updateShakeUI();

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
                
                // Bulut kurtarma kodunu güncelle/tetikle
                const lblSyncCode = document.getElementById('text-sync-code');
                const savedCode = localStorage.getItem('viscora_sync_code');
                if (savedCode) {
                    if (lblSyncCode) lblSyncCode.textContent = savedCode;
                }
                
                // Arka planda bir eşitleme başlat
                CloudSaveManager.saveProgress().then(res => {
                    if (res && res.success && res.syncCode) {
                        if (lblSyncCode) lblSyncCode.textContent = res.syncCode;
                        const statusMsg = document.getElementById('sync-status-message');
                        if (statusMsg) {
                            statusMsg.textContent = 'Bulut durumu güncel.';
                            statusMsg.style.color = '#10b981'; // green
                        }
                    }
                });
            });
        }

        // Bulut Kayıt Kopyalama ve Geri Yükleme Bindings
        const btnCopySyncCode = document.getElementById('btn-copy-sync-code');
        const btnRestoreSync = document.getElementById('btn-restore-sync');
        const inputSyncCode = document.getElementById('input-sync-code');
        const syncStatusMessage = document.getElementById('sync-status-message');

        if (btnCopySyncCode) {
            this.bindTouchClick(btnCopySyncCode, () => {
                const code = localStorage.getItem('viscora_sync_code') || '';
                if (code) {
                    navigator.clipboard.writeText(code).then(() => {
                        btnCopySyncCode.textContent = '✅';
                        setTimeout(() => { btnCopySyncCode.textContent = '📋'; }, 1500);
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            navigator.vibrate(15);
                        }
                    }).catch(() => {
                        alert('Kod kopyalanamadı: ' + code);
                    });
                }
            });
        }

        if (btnRestoreSync && inputSyncCode && syncStatusMessage) {
            this.bindTouchClick(btnRestoreSync, async () => {
                const code = inputSyncCode.value.trim().toUpperCase();
                if (!code || code.length !== 6) {
                    syncStatusMessage.textContent = 'Lütfen 6 haneli geçerli bir kod girin!';
                    syncStatusMessage.style.color = '#ef4444'; // red
                    return;
                }

                syncStatusMessage.textContent = 'Buluttan veriler çekiliyor...';
                syncStatusMessage.style.color = '#38bdf8'; // blue
                btnRestoreSync.disabled = true;

                const res = await CloudSaveManager.fetchProgress(code);
                btnRestoreSync.disabled = false;

                if (res.success && res.saveData) {
                    const sData = res.saveData;
                    const author = sData.authorName || 'Anonim';
                    const lvl = sData.unlockedLevel || 1;
                    const crystals = Math.max(0, (sData.totalCrystals || 0) - (sData.spentCrystals || 0));

                    const confirmMsg = `🔍 BULUT KAYDI BULUNDU:\n\n` +
                                       `- 👤 Tasarımcı Adı: ${author}\n` +
                                       `- 🏁 Açık Bölüm: Bölüm ${lvl}\n` +
                                       `- 💎 Toplam Kristal: ${crystals}\n\n` +
                                       `⚠️ UYARI: Bu kaydı yüklemek, bu cihazdaki tüm yerel ilerlemenizi (kristaller, seviyeler) SİLECEKTİR ve bu işlem geri alınamaz.\n\n` +
                                       `Bu kaydı yüklemek istediğinize emin misiniz?`;

                    if (!confirm(confirmMsg)) {
                        syncStatusMessage.textContent = 'Yükleme iptal edildi.';
                        syncStatusMessage.style.color = '#a1a1aa'; // gray
                        return;
                    }

                    // Apply the data
                    CloudSaveManager.applySaveData(sData);
                    if (res.userId) {
                        localStorage.setItem('viscora_user_id', res.userId);
                    }
                    localStorage.setItem('viscora_sync_code', code);

                    syncStatusMessage.textContent = 'Başarılı! Oyun yeniden başlatılıyor...';
                    syncStatusMessage.style.color = '#10b981'; // green
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate([80, 40, 80]);
                    }
                    setTimeout(() => {
                        window.location.reload();
                    }, 1200);
                } else {
                    syncStatusMessage.textContent = res.error || 'Kurtarma başarısız!';
                    syncStatusMessage.style.color = '#ef4444'; // red
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate(60);
                    }
                }
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
            
            // 2. Draw wobbly jelly body (bobbing + breathing oscillation)
            const bob = Math.sin(Date.now() / 150) * 1.2;
            const finalY = py + bob;
            
            // Soft drop shadow under the blob
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;

            // Draw organic wobbly shape
            const numVerts = 8;
            const vertices = [];
            for (let i = 0; i < numVerts; i++) {
                const angle = (i / numVerts) * Math.PI * 2;
                const wobble = Math.sin(Date.now() / 180 + i * 1.2) * 0.7;
                const cr = radius + wobble;
                vertices.push({
                    x: px + Math.cos(angle) * cr,
                    y: finalY + Math.sin(angle) * cr
                });
            }

            const drawBlobPath = () => {
                ctx.beginPath();
                const first = vertices[0];
                const last = vertices[numVerts - 1];
                ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
                for (let i = 0; i < numVerts; i++) {
                    const current = vertices[i];
                    const next = vertices[(i + 1) % numVerts];
                    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
                }
                ctx.closePath();
            };

            drawBlobPath();

            // Jelly radial gradient
            const bodyGrad = ctx.createRadialGradient(px - radius*0.3, finalY - radius*0.3, radius*0.1, px, finalY, radius);
            bodyGrad.addColorStop(0, '#22d3ee');
            bodyGrad.addColorStop(0.7, '#0891b2');
            bodyGrad.addColorStop(1, '#0f766e');
            ctx.fillStyle = bodyGrad;
            ctx.fill();
            ctx.restore(); // restore from shadow

            // Glass/Liquid glossy crescent highlight
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            if (ctx.ellipse) {
                ctx.ellipse(px - radius*0.35, finalY - radius*0.35, radius*0.35, radius*0.2, -Math.PI / 4, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();

            // Outline stroke
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.2;
            drawBlobPath();
            ctx.stroke();
            
            // 3. Draw Eyes
            const eyeX = px;
            const eyeY = finalY - 1;
            
            if (activeEyes === 'cute_eyes') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(eyeX - 4.0, eyeY, 3.2, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.0, eyeY, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 0.4;
                ctx.stroke();
                
                const irisGrad1 = ctx.createRadialGradient(eyeX - 4.0, eyeY, 0.5, eyeX - 4.0, eyeY, 2.5);
                irisGrad1.addColorStop(0, '#0284c7');
                irisGrad1.addColorStop(0.6, '#0f172a');
                irisGrad1.addColorStop(1, '#020617');
                
                const irisGrad2 = ctx.createRadialGradient(eyeX + 4.0, eyeY, 0.5, eyeX + 4.0, eyeY, 2.5);
                irisGrad2.addColorStop(0, '#0284c7');
                irisGrad2.addColorStop(0.6, '#0f172a');
                irisGrad2.addColorStop(1, '#020617');

                ctx.fillStyle = irisGrad1;
                ctx.beginPath();
                ctx.arc(eyeX - 4.0, eyeY, 2.2, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = irisGrad2;
                ctx.beginPath();
                ctx.arc(eyeX + 4.0, eyeY, 2.2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(eyeX - 4.8, eyeY - 0.8, 0.7, 0, Math.PI * 2);
                ctx.arc(eyeX + 3.2, eyeY - 0.8, 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(eyeX - 3.2, eyeY + 0.8, 0.4, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.8, eyeY + 0.8, 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeEyes === 'angry_eyes') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 2.8, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.5, eyeY, 2.8, 0, Math.PI * 2);
                ctx.fill();

                const redGrad1 = ctx.createRadialGradient(eyeX - 4.5, eyeY, 0.2, eyeX - 4.5, eyeY, 1.8);
                redGrad1.addColorStop(0, '#f97316');
                redGrad1.addColorStop(0.6, '#dc2626');
                redGrad1.addColorStop(1, '#7f1d1d');

                const redGrad2 = ctx.createRadialGradient(eyeX + 4.5, eyeY, 0.2, eyeX + 4.5, eyeY, 1.8);
                redGrad2.addColorStop(0, '#f97316');
                redGrad2.addColorStop(0.6, '#dc2626');
                redGrad2.addColorStop(1, '#7f1d1d');

                ctx.fillStyle = redGrad1;
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 1.8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = redGrad2;
                ctx.beginPath();
                ctx.arc(eyeX + 4.5, eyeY, 1.8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#0a0a0f';
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 0.8, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.5, eyeY, 0.8, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#020617';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(eyeX - 6.5, eyeY - 2.5);
                ctx.lineTo(eyeX - 1.5, eyeY - 0.8);
                ctx.moveTo(eyeX + 6.5, eyeY - 2.5);
                ctx.lineTo(eyeX + 1.5, eyeY - 0.8);
                ctx.stroke();
            } else if (activeEyes === 'sunglasses') {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                ctx.strokeStyle = '#020617';
                ctx.lineWidth = 0.8;
                
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(eyeX - 6.5, eyeY - 2.5, 4.2, 3.0, 0.8);
                } else {
                    ctx.rect(eyeX - 6.5, eyeY - 2.5, 4.2, 3.0);
                }
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(eyeX + 2.3, eyeY - 2.5, 4.2, 3.0, 0.8);
                } else {
                    ctx.rect(eyeX + 2.3, eyeY - 2.5, 4.2, 3.0);
                }
                ctx.fill();
                ctx.stroke();

                // Gold frame top line
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(eyeX - 6.5, eyeY - 2.5);
                ctx.lineTo(eyeX + 6.5, eyeY - 2.5);
                ctx.stroke();

                ctx.strokeStyle = '#020617';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(eyeX - 2.3, eyeY - 1.2);
                ctx.lineTo(eyeX + 2.3, eyeY - 1.2);
                ctx.stroke();

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(eyeX - 5.5, eyeY - 2.0);
                ctx.lineTo(eyeX - 3.8, eyeY - 0.5);
                ctx.moveTo(eyeX + 3.3, eyeY - 2.0);
                ctx.lineTo(eyeX + 5.0, eyeY - 0.5);
                ctx.stroke();
            } else if (activeEyes === 'joke_glasses') {
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1.0;
                ctx.fillStyle = '#ffffff';
                
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(eyeX + 4.5, eyeY, 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = '#0a0a0f';
                ctx.beginPath();
                ctx.arc(eyeX - 4.0, eyeY, 0.8, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.0, eyeY - 0.6, 0.8, 0, Math.PI * 2);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(eyeX - 1.3, eyeY - 0.8);
                ctx.lineTo(eyeX + 1.3, eyeY - 0.8);
                ctx.stroke();

                const noseGrad = ctx.createRadialGradient(eyeX - 0.5, eyeY + 1.8, 0.2, eyeX, eyeY + 2.2, 2.2);
                noseGrad.addColorStop(0, '#fda4af');
                noseGrad.addColorStop(0.7, '#fb7185');
                noseGrad.addColorStop(1, '#be123c');
                ctx.fillStyle = noseGrad;
                ctx.beginPath();
                ctx.arc(eyeX, eyeY + 2.2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#881337';
                ctx.lineWidth = 0.4;
                ctx.stroke();
                
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.moveTo(eyeX - 5.0, eyeY + 4.2);
                ctx.quadraticCurveTo(eyeX - 2.2, eyeY + 2.8, eyeX, eyeY + 4.6);
                ctx.quadraticCurveTo(eyeX + 2.2, eyeY + 2.8, eyeX + 5.0, eyeY + 4.2);
                ctx.quadraticCurveTo(eyeX + 3.0, eyeY + 5.8, eyeX, eyeY + 5.0);
                ctx.quadraticCurveTo(eyeX - 3.0, eyeY + 5.8, eyeX - 5.0, eyeY + 4.2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 2.0, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.5, eyeY, 2.0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#0a0a0f';
                ctx.beginPath();
                ctx.arc(eyeX - 4.5, eyeY, 0.8, 0, Math.PI * 2);
                ctx.arc(eyeX + 4.5, eyeY, 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 4. Draw Accessory (Hats)
            const topX = px;
            const topY = finalY - radius + 2.5;
            
            if (activeAccessory === 'cowboy_hat') {
                const brimGrad = ctx.createLinearGradient(topX - 11, topY, topX + 11, topY);
                brimGrad.addColorStop(0, '#7c2d12');
                brimGrad.addColorStop(0.5, '#9a3412');
                brimGrad.addColorStop(1, '#431407');
                
                const crownGrad = ctx.createLinearGradient(topX - 6, topY - 9, topX + 6, topY);
                crownGrad.addColorStop(0, '#b45309');
                crownGrad.addColorStop(0.5, '#78350f');
                crownGrad.addColorStop(1, '#451a03');

                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY, 11, 2.5, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY, 6, 0, Math.PI * 2);
                }
                ctx.fillStyle = brimGrad;
                ctx.fill();
                ctx.strokeStyle = '#270701';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                ctx.strokeStyle = '#c2410c';
                ctx.lineWidth = 0.4;
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY - 0.5, 10, 1.8, 0, Math.PI, Math.PI * 2);
                }
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(topX - 6.0, topY - 0.8);
                ctx.bezierCurveTo(topX - 6.5, topY - 6.5, topX - 5.0, topY - 8.5, topX - 3.0, topY - 9.0);
                ctx.bezierCurveTo(topX - 1.5, topY - 8.0, topX + 1.5, topY - 8.0, topX + 3.0, topY - 9.0);
                ctx.bezierCurveTo(topX + 5.0, topY - 8.5, topX + 6.5, topY - 6.5, topX + 6.0, topY - 0.8);
                ctx.closePath();
                ctx.fillStyle = crownGrad;
                ctx.fill();
                ctx.strokeStyle = '#270701';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                ctx.fillStyle = 'rgba(0,0,0,0.18)';
                ctx.beginPath();
                ctx.moveTo(topX - 1.5, topY - 8.0);
                ctx.quadraticCurveTo(topX, topY - 5.5, topX + 1.5, topY - 8.0);
                ctx.quadraticCurveTo(topX, topY - 3.5, topX - 1.5, topY - 8.0);
                ctx.fill();
                
                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(topX - 5.5, topY - 2.5, 11, 1.8);

                const metalGrad = ctx.createLinearGradient(topX - 2.0, topY - 3, topX + 2.0, topY - 1);
                metalGrad.addColorStop(0, '#fef08a');
                metalGrad.addColorStop(0.5, '#d97706');
                metalGrad.addColorStop(1, '#78350f');
                ctx.fillStyle = metalGrad;
                ctx.fillRect(topX - 2.0, topY - 3.2, 4, 2.8);
                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 0.4;
                ctx.strokeRect(topX - 2.0, topY - 3.2, 4, 2.8);

                ctx.fillStyle = '#1e1e24';
                ctx.fillRect(topX - 1.0, topY - 2.5, 2, 1.4);
            } else if (activeAccessory === 'wizard_hat') {
                const brimGrad = ctx.createLinearGradient(topX - 11, topY, topX + 11, topY);
                brimGrad.addColorStop(0, '#581c87');
                brimGrad.addColorStop(0.5, '#7e22ce');
                brimGrad.addColorStop(1, '#3b0764');

                const coneGrad = ctx.createLinearGradient(topX - 6, topY - 17, topX + 6, topY);
                coneGrad.addColorStop(0, '#a855f7');
                coneGrad.addColorStop(0.6, '#581c87');
                coneGrad.addColorStop(1, '#2e1065');

                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY, 11, 2.5, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY, 6, 0, Math.PI * 2);
                }
                ctx.fillStyle = brimGrad;
                ctx.fill();
                ctx.strokeStyle = '#1e053a';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(topX - 6.0, topY - 0.8);
                ctx.bezierCurveTo(topX - 6.5, topY - 9.0, topX - 1.5, topY - 13.5, topX - 4.0, topY - 18.0);
                ctx.bezierCurveTo(topX - 1.5, topY - 17.0, topX + 3.0, topY - 10.5, topX + 6.0, topY - 0.8);
                ctx.closePath();
                ctx.fillStyle = coneGrad;
                ctx.fill();
                ctx.strokeStyle = '#1e053a';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
                ctx.beginPath();
                ctx.arc(topX + 0.8, topY - 7.5, 1.4, -Math.PI/2, Math.PI/2);
                ctx.quadraticCurveTo(topX + 1.4, topY - 7.5, topX + 0.8, topY - 8.9);
                ctx.fill();
                
                const bandGrad = ctx.createLinearGradient(topX - 5.0, topY - 2.2, topX + 5.0, topY - 0.8);
                bandGrad.addColorStop(0, '#d97706');
                bandGrad.addColorStop(0.5, '#fef08a');
                bandGrad.addColorStop(1, '#ca8a04');
                ctx.fillStyle = bandGrad;
                ctx.fillRect(topX - 5.2, topY - 2.4, 10.4, 1.8);
                
                ctx.save();
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = 6;
                const starRadGrad = ctx.createRadialGradient(topX - 4.0, topY - 18, 0, topX - 4.0, topY - 18, 6);
                starRadGrad.addColorStop(0, 'rgba(250, 204, 21, 0.4)');
                starRadGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                ctx.fillStyle = starRadGrad;
                ctx.beginPath();
                ctx.arc(topX - 4.0, topY - 18, 6, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fef08a';
                const drawStar = (cx, cy, spikes, outerRadius, innerRadius) => {
                    let rot = Math.PI / 2 * 3;
                    let x = cx;
                    let y = cy;
                    let step = Math.PI / spikes;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - outerRadius);
                    for (let i = 0; i < spikes; i++) {
                        x = cx + Math.cos(rot) * outerRadius;
                        y = cy + Math.sin(rot) * outerRadius;
                        ctx.lineTo(x, y);
                        rot += step;
                        x = cx + Math.cos(rot) * innerRadius;
                        y = cy + Math.sin(rot) * innerRadius;
                        ctx.lineTo(x, y);
                        rot += step;
                    }
                    ctx.lineTo(cx, cy - outerRadius);
                    ctx.closePath();
                    ctx.fill();
                };
                drawStar(topX - 4.0, topY - 18.0, 5, 3.5, 1.4);
                ctx.restore();
            } else if (activeAccessory === 'crown') {
                const goldGrad = ctx.createLinearGradient(topX - 9, topY - 7.5, topX + 9, topY);
                goldGrad.addColorStop(0, '#fef08a');
                goldGrad.addColorStop(0.3, '#f59e0b');
                goldGrad.addColorStop(0.7, '#ca8a04');
                goldGrad.addColorStop(1, '#78350f');

                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 0.8;

                ctx.beginPath();
                ctx.moveTo(topX - 9, topY);
                ctx.lineTo(topX - 9, topY - 5);
                ctx.lineTo(topX - 5, topY - 1.8);
                ctx.lineTo(topX, topY - 8.5);
                ctx.lineTo(topX + 5, topY - 1.8);
                ctx.lineTo(topX + 9, topY - 5);
                ctx.lineTo(topX + 9, topY);
                ctx.closePath();
                ctx.fillStyle = goldGrad;
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(topX - 8, topY - 0.8);
                ctx.lineTo(topX - 8, topY - 4.0);
                ctx.moveTo(topX, topY - 1.5);
                ctx.lineTo(topX, topY - 7.5);
                ctx.moveTo(topX + 8, topY - 0.8);
                ctx.lineTo(topX + 8, topY - 4.0);
                ctx.stroke();
                
                const draw3DGem = (cx, cy, w, h, colorHex, highlightHex) => {
                    ctx.save();
                    ctx.fillStyle = colorHex;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - h/2);
                    ctx.lineTo(cx - w/2, cy);
                    ctx.lineTo(cx, cy + h/2);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = highlightHex;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - h/2);
                    ctx.lineTo(cx + w/2, cy);
                    ctx.lineTo(cx, cy + h/2);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(cx - w/6, cy - h/6, w/6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                };

                draw3DGem(topX - 9, topY - 5, 2.5, 3.2, '#b91c1c', '#ef4444');
                draw3DGem(topX, topY - 8.5, 3.0, 3.8, '#b91c1c', '#ef4444');
                draw3DGem(topX + 9, topY - 5, 2.5, 3.2, '#b91c1c', '#ef4444');

                draw3DGem(topX - 4, topY - 1.5, 1.8, 2.2, '#1d4ed8', '#60a5fa');
                draw3DGem(topX, topY - 1.5, 1.8, 2.2, '#047857', '#34d399');
                draw3DGem(topX + 4, topY - 1.5, 1.8, 2.2, '#1d4ed8', '#60a5fa');
            } else if (activeAccessory === 'santa_hat') {
                const redGrad = ctx.createLinearGradient(topX - 9, topY - 21.6, topX + 9.6, topY - 1.5);
                redGrad.addColorStop(0, '#f87171');
                redGrad.addColorStop(0.5, '#dc2626');
                redGrad.addColorStop(1, '#7f1d1d');

                ctx.strokeStyle = '#4c0505';
                ctx.lineWidth = 0.8;

                ctx.beginPath();
                ctx.moveTo(topX - 9, topY - 1.5);
                ctx.bezierCurveTo(topX - 8.2, topY - 19.0, topX - 1.6, topY - 20.8, topX + 4.0, topY - 19.2);
                ctx.bezierCurveTo(topX + 8.8, topY - 17.6, topX + 9.6, topY - 11.2, topX + 9.6, topY - 10.4);
                ctx.lineTo(topX + 7.2, topY - 8.0);
                ctx.bezierCurveTo(topX + 6.4, topY - 13.6, topX + 1.6, topY - 14.4, topX - 1.6, topY - 14.4);
                ctx.bezierCurveTo(topX + 3.2, topY - 9.6, topX + 8.8, topY - 1.6, topX + 8.8, topY - 1.6);
                ctx.lineTo(topX - 9, topY - 1.5);
                ctx.closePath();
                ctx.fillStyle = redGrad;
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.moveTo(topX - 6.4, topY - 6.4);
                ctx.quadraticCurveTo(topX - 1.6, topY - 9.6, topX + 4.0, topY - 8.0);
                ctx.stroke();

                const drawFluffyPuff = (cx, cy, rx, ry, baseR) => {
                    ctx.save();
                    ctx.fillStyle = '#e2e8f0';
                    const drawBubble = (bx, by, br) => {
                        ctx.beginPath();
                        ctx.arc(bx, by, br, 0, Math.PI * 2);
                        ctx.fill();
                    };
                    const bubblesCount = 6;
                    for (let i = 0; i < bubblesCount; i++) {
                        const angle = (i / bubblesCount) * Math.PI * 2;
                        const bx = cx + Math.cos(angle) * (rx * 0.75);
                        const by = cy + Math.sin(angle) * (ry * 0.75);
                        drawBubble(bx, by, baseR + 0.3);
                    }
                    ctx.fillStyle = '#ffffff';
                    for (let i = 0; i < bubblesCount; i++) {
                        const angle = (i / bubblesCount) * Math.PI * 2;
                        const bx = cx + Math.cos(angle) * (rx * 0.7) - 0.4;
                        const by = cy + Math.sin(angle) * (ry * 0.7) - 0.4;
                        drawBubble(bx, by, baseR + (i % 2 === 0 ? 0.6 : -0.2));
                    }
                    ctx.restore();
                };

                drawFluffyPuff(topX, topY - 2.0, 9.6, 2.0, 2.6);
                drawFluffyPuff(topX + 9.2, topY - 10.0, 2.2, 2.2, 2.2);
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

            // Dynamic mini-canvas drawer for shop cards (Viscora wearing the cosmetics)
            const drawCardPreview = (item, canvas) => {
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                const cx = canvas.width / 2;
                const cy = canvas.height / 2 + 5; // shift down for hats
                const radius = 18;

                // 1. Draw Trail Particles (behind Viscora)
                if (item.category === 'trail') {
                    ctx.save();
                    if (item.id === 'default_trail') {
                        // Soft trailing path
                        const trailGrad = ctx.createLinearGradient(cx - 20, cy + 10, cx, cy);
                        trailGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
                        trailGrad.addColorStop(1, 'rgba(6, 182, 212, 0.35)');
                        ctx.fillStyle = trailGrad;
                        ctx.beginPath();
                        ctx.moveTo(cx - 22, cy + 12);
                        ctx.lineTo(cx, cy + radius);
                        ctx.lineTo(cx - radius, cy);
                        ctx.closePath();
                        ctx.fill();

                        ctx.fillStyle = '#06b6d4';
                        ctx.shadowColor = '#06b6d4';
                        ctx.shadowBlur = 6;
                        ctx.beginPath();
                        ctx.arc(cx - 12, cy + 8, 4.0, 0, Math.PI * 2);
                        ctx.arc(cx - 6, cy + 12, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (item.id === 'fire_trail') {
                        // Sweeping fire flame gradient path
                        const flameGrad = ctx.createLinearGradient(cx - 24, cy + 12, cx, cy);
                        flameGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
                        flameGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.5)');
                        flameGrad.addColorStop(1, 'rgba(245, 158, 11, 0.8)');
                        ctx.fillStyle = flameGrad;
                        ctx.beginPath();
                        ctx.moveTo(cx - 24, cy + 14);
                        ctx.quadraticCurveTo(cx - 12, cy + 14, cx - 4, cy + radius - 2);
                        ctx.lineTo(cx - radius, cy);
                        ctx.quadraticCurveTo(cx - 18, cy + 2, cx - 24, cy + 14);
                        ctx.closePath();
                        ctx.fill();

                        // Glowing flame sparks
                        const sparks = [
                            { x: cx - 14, y: cy + 6, r: 4.5, c: '#ef4444' },
                            { x: cx - 9, y: cy + 11, r: 3.5, c: '#f97316' },
                            { x: cx - 18, y: cy + 12, r: 2.2, c: '#f59e0b' }
                        ];
                        sparks.forEach(s => {
                            ctx.fillStyle = s.c;
                            ctx.shadowColor = s.c;
                            ctx.shadowBlur = 8;
                            ctx.beginPath();
                            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                            ctx.fill();
                        });
                    } else if (item.id === 'ice_trail') {
                        // Frosty mist path
                        const frostGrad = ctx.createLinearGradient(cx - 22, cy + 10, cx, cy);
                        frostGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
                        frostGrad.addColorStop(1, 'rgba(125, 211, 252, 0.4)');
                        ctx.fillStyle = frostGrad;
                        ctx.beginPath();
                        ctx.moveTo(cx - 22, cy + 12);
                        ctx.lineTo(cx, cy + radius);
                        ctx.lineTo(cx - radius, cy);
                        ctx.closePath();
                        ctx.fill();

                        // Ice crystal diamonds
                        const drawCrystal = (x, y, w, h) => {
                            ctx.save();
                            ctx.fillStyle = '#ffffff';
                            ctx.shadowColor = '#38bdf8';
                            ctx.shadowBlur = 5;
                            ctx.beginPath();
                            ctx.moveTo(x, y - h/2);
                            ctx.lineTo(x - w/2, y);
                            ctx.lineTo(x, y + h/2);
                            ctx.lineTo(x + w/2, y);
                            ctx.closePath();
                            ctx.fill();
                            ctx.restore();
                        };
                        drawCrystal(cx - 14, cy + 8, 5, 8);
                        drawCrystal(cx - 8, cy + 13, 3, 5);
                        drawCrystal(cx - 19, cy + 12, 2, 4);
                    } else if (item.id === 'gold_trail') {
                        // Golden aura path
                        const goldPathGrad = ctx.createLinearGradient(cx - 22, cy + 10, cx, cy);
                        goldPathGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
                        goldPathGrad.addColorStop(1, 'rgba(251, 191, 36, 0.35)');
                        ctx.fillStyle = goldPathGrad;
                        ctx.beginPath();
                        ctx.moveTo(cx - 22, cy + 12);
                        ctx.lineTo(cx, cy + radius);
                        ctx.lineTo(cx - radius, cy);
                        ctx.closePath();
                        ctx.fill();

                        // Glinting gold stars helper
                        const drawGoldStar = (x, y, r) => {
                            ctx.save();
                            ctx.shadowColor = '#fbbf24';
                            ctx.shadowBlur = 6;
                            ctx.fillStyle = '#ffffff';
                            ctx.beginPath();
                            ctx.moveTo(x, y - r);
                            ctx.quadraticCurveTo(x, y, x - r, y);
                            ctx.quadraticCurveTo(x, y, x, y + r);
                            ctx.quadraticCurveTo(x, y, x + r, y);
                            ctx.quadraticCurveTo(x, y, x, y - r);
                            ctx.closePath();
                            ctx.fill();
                            ctx.restore();
                        };
                        drawGoldStar(cx - 13, cy + 7, 5.0);
                        drawGoldStar(cx - 6, cy + 12, 3.2);
                    } else if (item.id === 'rainbow_trail') {
                        // Sweeping multi-colored rainbow ribbon
                        ctx.lineWidth = 3.5;
                        ctx.lineCap = 'round';
                        ctx.shadowBlur = 4;
                        
                        const rainbowColors = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6'];
                        rainbowColors.forEach((col, idx) => {
                            ctx.strokeStyle = col;
                            ctx.shadowColor = col;
                            ctx.lineWidth = 1.2;
                            ctx.beginPath();
                            ctx.arc(cx - 8, cy + 8, radius + 2 + idx * 1.5, Math.PI * 0.7, Math.PI * 1.7);
                            ctx.stroke();
                        });
                    }
                    ctx.restore();
                }

                // 2. Draw Viscora Gel Body (Wobbly organic shape + glossy gradient + highlight)
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetY = 2;

                const numVerts = 10;
                const vertices = [];
                for (let i = 0; i < numVerts; i++) {
                    const angle = (i / numVerts) * Math.PI * 2;
                    const wobble = Math.sin(angle * 3) * 0.8 + Math.cos(angle * 2) * 0.4;
                    const cr = radius + wobble;
                    vertices.push({
                        x: cx + Math.cos(angle) * cr,
                        y: cy + Math.sin(angle) * cr
                    });
                }

                const drawBlobPath = () => {
                    ctx.beginPath();
                    const first = vertices[0];
                    const last = vertices[numVerts - 1];
                    ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
                    for (let i = 0; i < numVerts; i++) {
                        const current = vertices[i];
                        const next = vertices[(i + 1) % numVerts];
                        ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
                    }
                    ctx.closePath();
                };

                drawBlobPath();

                const bodyGrad = ctx.createRadialGradient(cx - radius*0.3, cy - radius*0.3, radius*0.1, cx, cy, radius);
                bodyGrad.addColorStop(0, '#22d3ee');
                bodyGrad.addColorStop(0.7, '#0891b2');
                bodyGrad.addColorStop(1, '#0e7490');
                ctx.fillStyle = bodyGrad;
                ctx.fill();
                ctx.restore();

                // Glossy reflection highlight
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(cx - radius*0.35, cy - radius*0.35, radius*0.35, radius*0.2, -Math.PI / 4, 0, Math.PI * 2);
                }
                ctx.fill();
                ctx.restore();

                // Outline
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1.0;
                drawBlobPath();
                ctx.stroke();

                // 3. Draw Eyes (either special ones or default)
                ctx.save();
                const drawDefaultEyes = (eyeStyle) => {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = '#ffffff';
                    ctx.shadowBlur = (eyeStyle === 'sunglasses' || eyeStyle === 'joke_glasses') ? 0 : 3;

                    if (eyeStyle === 'cute_eyes') {
                        // Sol göz
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(cx - 6, cy - 3, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#0284c7';
                        ctx.lineWidth = 0.5;
                        ctx.stroke();

                        // Sağ göz
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(cx + 6, cy - 3, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();

                        // Göz bebekleri / İris (Lacivert degrade)
                        const irisGrad1 = ctx.createRadialGradient(cx - 6, cy - 3, 1, cx - 6, cy - 3, 3.5);
                        irisGrad1.addColorStop(0, '#0284c7');
                        irisGrad1.addColorStop(0.6, '#0f172a');
                        irisGrad1.addColorStop(1, '#020617');

                        const irisGrad2 = ctx.createRadialGradient(cx + 6, cy - 3, 1, cx + 6, cy - 3, 3.5);
                        irisGrad2.addColorStop(0, '#0284c7');
                        irisGrad2.addColorStop(0.6, '#0f172a');
                        irisGrad2.addColorStop(1, '#020617');

                        ctx.fillStyle = irisGrad1;
                        ctx.beginPath();
                        ctx.arc(cx - 6, cy - 3, 3.0, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = irisGrad2;
                        ctx.beginPath();
                        ctx.arc(cx + 6, cy - 3, 3.0, 0, Math.PI * 2);
                        ctx.fill();

                        // Parıltılar
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(cx - 7.2, cy - 4.2, 1.0, 0, Math.PI * 2);
                        ctx.arc(cx + 4.8, cy - 4.2, 1.0, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.beginPath();
                        ctx.arc(cx - 5.0, cy - 1.8, 0.5, 0, Math.PI * 2);
                        ctx.arc(cx + 7.0, cy - 1.8, 0.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (eyeStyle === 'sunglasses') {
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                        ctx.strokeStyle = '#020617';
                        ctx.lineWidth = 1.2;
                        
                        ctx.beginPath();
                        if (ctx.roundRect) {
                            ctx.roundRect(cx - 10, cy - 6, 6.5, 4.5, 1.2);
                        } else {
                            ctx.rect(cx - 10, cy - 6, 6.5, 4.5);
                        }
                        ctx.fill();
                        ctx.stroke();
                        
                        ctx.beginPath();
                        if (ctx.roundRect) {
                            ctx.roundRect(cx + 3.5, cy - 6, 6.5, 4.5, 1.2);
                        } else {
                            ctx.rect(cx + 3.5, cy - 6, 6.5, 4.5);
                        }
                        ctx.fill();
                        ctx.stroke();
                        
                        // Altın şerit üst hat
                        ctx.strokeStyle = '#f59e0b';
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(cx - 10, cy - 6);
                        ctx.lineTo(cx + 10, cy - 6);
                        ctx.stroke();
                        
                        // Köprü bağı
                        ctx.strokeStyle = '#020617';
                        ctx.lineWidth = 1.0;
                        ctx.beginPath();
                        ctx.moveTo(cx - 3.5, cy - 4);
                        ctx.lineTo(cx + 3.5, cy - 4);
                        ctx.stroke();
                        
                        // Gözlük parıltısı (Diagonal specular glint)
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(cx - 8.5, cy - 5.5);
                        ctx.lineTo(cx - 6.0, cy - 2.5);
                        ctx.moveTo(cx + 5.0, cy - 5.5);
                        ctx.lineTo(cx + 7.5, cy - 2.5);
                        ctx.stroke();
                    } else if (eyeStyle === 'joke_glasses') {
                        ctx.strokeStyle = '#1e293b';
                        ctx.lineWidth = 1.5;
                        
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(cx - 6.5, cy - 3.5, 4.8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                        
                        ctx.beginPath();
                        ctx.arc(cx + 6.5, cy - 3.5, 4.8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                        
                        // Komik şaşı göz bebekleri
                        ctx.fillStyle = '#0a0a0f';
                        ctx.beginPath();
                        ctx.arc(cx - 5.5, cy - 3.0, 1.5, 0, Math.PI * 2);
                        ctx.arc(cx + 5.0, cy - 4.0, 1.5, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Köprü
                        ctx.beginPath();
                        ctx.moveTo(cx - 1.7, cy - 4.5);
                        ctx.lineTo(cx + 1.7, cy - 4.5);
                        ctx.stroke();

                        // Gölgeli Büyük Pembe Burun
                        const noseGrad = ctx.createRadialGradient(cx - 1, cy - 0.5, 0.5, cx, cy + 0.5, 3.5);
                        noseGrad.addColorStop(0, '#fda4af');
                        noseGrad.addColorStop(0.7, '#fb7185');
                        noseGrad.addColorStop(1, '#be123c');
                        ctx.fillStyle = noseGrad;
                        ctx.beginPath();
                        ctx.arc(cx, cy + 0.5, 3.8, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#881337';
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                        
                        // Komik kıvrık bıyık
                        ctx.fillStyle = '#0f172a';
                        ctx.beginPath();
                        ctx.moveTo(cx - 8.5, cy + 4.5);
                        ctx.quadraticCurveTo(cx - 4, cy + 2.5, cx, cy + 5.2);
                        ctx.quadraticCurveTo(cx + 4, cy + 2.5, cx + 8.5, cy + 4.5);
                        ctx.quadraticCurveTo(cx + 5.5, cy + 7.5, cx, cy + 6.0);
                        ctx.quadraticCurveTo(cx - 5.5, cy + 7.5, cx - 8.5, cy + 4.5);
                        ctx.fill();
                    } else {
                        // Varsayılan / Kızgın
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(cx - 6, cy - 3, 3, 0, Math.PI * 2);
                        ctx.arc(cx + 6, cy - 3, 3, 0, Math.PI * 2);
                        ctx.fill();

                        // Göz bebekleri
                        ctx.fillStyle = '#0a0a0f';
                        ctx.shadowBlur = 0;
                        ctx.beginPath();
                        ctx.arc(cx - 6, cy - 3, 1.2, 0, Math.PI * 2);
                        ctx.arc(cx + 6, cy - 3, 1.2, 0, Math.PI * 2);
                        ctx.fill();

                        if (eyeStyle === 'angry_eyes') {
                            const redGrad1 = ctx.createRadialGradient(cx - 6, cy - 3, 0.5, cx - 6, cy - 3, 2.5);
                            redGrad1.addColorStop(0, '#f97316');
                            redGrad1.addColorStop(0.6, '#dc2626');
                            redGrad1.addColorStop(1, '#7f1d1d');

                            const redGrad2 = ctx.createRadialGradient(cx + 6, cy - 3, 0.5, cx + 6, cy - 3, 2.5);
                            redGrad2.addColorStop(0, '#f97316');
                            redGrad2.addColorStop(0.6, '#dc2626');
                            redGrad2.addColorStop(1, '#7f1d1d');

                            ctx.fillStyle = redGrad1;
                            ctx.beginPath();
                            ctx.arc(cx - 6, cy - 3, 2.5, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = redGrad2;
                            ctx.beginPath();
                            ctx.arc(cx + 6, cy - 3, 2.5, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = '#0a0a0f';
                            ctx.beginPath();
                            ctx.arc(cx - 6, cy - 3, 1.0, 0, Math.PI * 2);
                            ctx.arc(cx + 6, cy - 3, 1.0, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.strokeStyle = '#020617';
                            ctx.lineWidth = 1.8;
                            // Sol Kaş
                            ctx.beginPath();
                            ctx.moveTo(cx - 9.5, cy - 6.5);
                            ctx.lineTo(cx - 2.0, cy - 3.2);
                            ctx.stroke();
                            
                            // Sağ Kaş
                            ctx.beginPath();
                            ctx.moveTo(cx + 9.5, cy - 6.5);
                            ctx.lineTo(cx + 2.0, cy - 3.2);
                            ctx.stroke();
                        }
                    }
                };

                if (item.category === 'eyes') {
                    drawDefaultEyes(item.id);
                } else {
                    drawDefaultEyes('default_eyes');
                }
                ctx.restore();

                // 4. Draw Accessory (if cosmetic item is an accessory)
                if (item.category === 'accessory' && item.id !== 'default_accessory') {
                    ctx.save();
                    const topX = cx;
                    const topY = cy - radius + 3;

                    if (item.id === 'cowboy_hat') {
                        const brimGrad = ctx.createLinearGradient(topX - 15, topY, topX + 15, topY);
                        brimGrad.addColorStop(0, '#7c2d12');
                        brimGrad.addColorStop(0.5, '#9a3412');
                        brimGrad.addColorStop(1, '#431407');

                        const crownGrad = ctx.createLinearGradient(topX - 8, topY - 11, topX + 8, topY);
                        crownGrad.addColorStop(0, '#b45309');
                        crownGrad.addColorStop(0.5, '#78350f');
                        crownGrad.addColorStop(1, '#451a03');

                        // Siper (Brim) - Çift katmanlı ve gölgeli
                        ctx.beginPath();
                        if (ctx.ellipse) {
                            ctx.ellipse(topX, topY, 15, 3.5, 0, 0, Math.PI * 2);
                        } else {
                            ctx.arc(topX, topY, 8, 0, Math.PI * 2);
                        }
                        ctx.fillStyle = brimGrad;
                        ctx.fill();
                        ctx.strokeStyle = '#270701';
                        ctx.lineWidth = 1.0;
                        ctx.stroke();

                        // Üst kıvrım siper kenarı (Brim highlight)
                        ctx.strokeStyle = '#c2410c';
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        if (ctx.ellipse) {
                            ctx.ellipse(topX, topY - 0.8, 14, 2.5, 0, Math.PI, Math.PI * 2);
                        }
                        ctx.stroke();

                        // Gövde (Crown) - Çift tepeli (Kovboy çöküntüsü)
                        ctx.beginPath();
                        ctx.moveTo(topX - 8, topY - 1);
                        ctx.bezierCurveTo(topX - 9, topY - 9, topX - 7, topY - 12, topX - 4, topY - 12.5); // Sol tepe
                        ctx.bezierCurveTo(topX - 2, topY - 11, topX + 2, topY - 11, topX + 4, topY - 12.5); // Sağ tepe ve çöküntü
                        ctx.bezierCurveTo(topX + 7, topY - 12, topX + 9, topY - 9, topX + 8, topY - 1);
                        ctx.closePath();
                        ctx.fillStyle = crownGrad;
                        ctx.fill();
                        ctx.strokeStyle = '#270701';
                        ctx.lineWidth = 1.0;
                        ctx.stroke();

                        // Kovboy gölgesi/kırışıklığı
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                        ctx.beginPath();
                        ctx.moveTo(topX - 2, topY - 11);
                        ctx.quadraticCurveTo(topX, topY - 7, topX + 2, topY - 11);
                        ctx.quadraticCurveTo(topX, topY - 4, topX - 2, topY - 11);
                        ctx.fill();

                        // Şapka şeridi (Siyah deri band)
                        ctx.fillStyle = '#1e1e24';
                        ctx.fillRect(topX - 7.5, topY - 3.5, 15, 2.8);

                        // Metalik Altın toka (Buckle)
                        const metalGrad = ctx.createLinearGradient(topX - 3, topY - 4, topX + 3, topY - 1);
                        metalGrad.addColorStop(0, '#fef08a');
                        metalGrad.addColorStop(0.3, '#d97706');
                        metalGrad.addColorStop(0.7, '#fef08a');
                        metalGrad.addColorStop(1, '#78350f');
                        ctx.fillStyle = metalGrad;
                        ctx.fillRect(topX - 3, topY - 4.5, 6, 4);
                        ctx.strokeStyle = '#451a03';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(topX - 3, topY - 4.5, 6, 4);

                        // Tokanın iç siyahlığı
                        ctx.fillStyle = '#1e1e24';
                        ctx.fillRect(topX - 1.5, topY - 3.5, 3, 2);
                    } else if (item.id === 'wizard_hat') {
                        const brimGrad = ctx.createLinearGradient(topX - 14, topY, topX + 14, topY);
                        brimGrad.addColorStop(0, '#581c87');
                        brimGrad.addColorStop(0.5, '#7e22ce');
                        brimGrad.addColorStop(1, '#3b0764');

                        const coneGrad = ctx.createLinearGradient(topX - 8, topY - 22, topX + 8, topY);
                        coneGrad.addColorStop(0, '#a855f7');
                        coneGrad.addColorStop(0.6, '#581c87');
                        coneGrad.addColorStop(1, '#2e1065');

                        // Siper
                        ctx.beginPath();
                        if (ctx.ellipse) {
                            ctx.ellipse(topX, topY, 14, 3, 0, 0, Math.PI * 2);
                        } else {
                            ctx.arc(topX, topY, 8, 0, Math.PI * 2);
                        }
                        ctx.fillStyle = brimGrad;
                        ctx.fill();
                        ctx.strokeStyle = '#1e053a';
                        ctx.lineWidth = 1.0;
                        ctx.stroke();

                        // Koni (Kıvrık/Eğri büyücü şapkası formu)
                        ctx.beginPath();
                        ctx.moveTo(topX - 7.5, topY - 1);
                        ctx.bezierCurveTo(topX - 8, topY - 12, topX - 2, topY - 18, topX - 5, topY - 24); // Eğri sol hat
                        ctx.bezierCurveTo(topX - 2, topY - 23, topX + 4, topY - 14, topX + 7.5, topY - 1);
                        ctx.closePath();
                        ctx.fillStyle = coneGrad;
                        ctx.fill();
                        ctx.strokeStyle = '#1e053a';
                        ctx.lineWidth = 1.0;
                        ctx.stroke();

                        // Şapka üzeri küçük yıldız & hilal desenleri
                        ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
                        ctx.beginPath();
                        ctx.arc(topX + 1, topY - 10, 1.8, -Math.PI/2, Math.PI/2);
                        ctx.quadraticCurveTo(topX + 1.8, topY - 10, topX + 1, topY - 11.8);
                        ctx.fill();

                        ctx.beginPath();
                        ctx.arc(topX - 3.5, topY - 7, 0.7, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(topX + 2.5, topY - 15, 0.6, 0, Math.PI * 2);
                        ctx.fill();

                        // Altın şerit (Gold band)
                        const bandGrad = ctx.createLinearGradient(topX - 6.5, topY - 3, topX + 6.5, topY - 1);
                        bandGrad.addColorStop(0, '#d97706');
                        bandGrad.addColorStop(0.5, '#fef08a');
                        bandGrad.addColorStop(1, '#ca8a04');
                        ctx.fillStyle = bandGrad;
                        ctx.fillRect(topX - 6.8, topY - 3.2, 13.6, 2.5);

                        // Parlayan 5 Köşeli Yıldız
                        ctx.save();
                        ctx.shadowColor = '#facc15';
                        ctx.shadowBlur = 8;
                        
                        // Sihirli parlama halkası
                        const starRadGrad = ctx.createRadialGradient(topX - 5, topY - 24, 0, topX - 5, topY - 24, 8);
                        starRadGrad.addColorStop(0, 'rgba(250, 204, 21, 0.4)');
                        starRadGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
                        ctx.fillStyle = starRadGrad;
                        ctx.beginPath();
                        ctx.arc(topX - 5, topY - 24, 8, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#fef08a';
                        const drawStar = (cx, cy, spikes, outerRadius, innerRadius) => {
                            let rot = Math.PI / 2 * 3;
                            let x = cx;
                            let y = cy;
                            let step = Math.PI / spikes;

                            ctx.beginPath();
                            ctx.moveTo(cx, cy - outerRadius);
                            for (let i = 0; i < spikes; i++) {
                                x = cx + Math.cos(rot) * outerRadius;
                                y = cy + Math.sin(rot) * outerRadius;
                                ctx.lineTo(x, y);
                                rot += step;

                                x = cx + Math.cos(rot) * innerRadius;
                                y = cy + Math.sin(rot) * innerRadius;
                                ctx.lineTo(x, y);
                                rot += step;
                            }
                            ctx.lineTo(cx, cy - outerRadius);
                            ctx.closePath();
                            ctx.fill();
                        };

                        drawStar(topX - 5, topY - 24, 5, 4.5, 1.8);
                        ctx.restore();
                    } else if (item.id === 'crown') {
                        const goldGrad = ctx.createLinearGradient(topX - 11, topY - 10, topX + 11, topY);
                        goldGrad.addColorStop(0, '#fef08a');
                        goldGrad.addColorStop(0.3, '#f59e0b');
                        goldGrad.addColorStop(0.7, '#ca8a04');
                        goldGrad.addColorStop(1, '#78350f');

                        ctx.strokeStyle = '#78350f';
                        ctx.lineWidth = 1.0;

                        // Gövde ve 3 sivri uç
                        ctx.beginPath();
                        ctx.moveTo(topX - 11, topY);
                        ctx.lineTo(topX - 11, topY - 6);
                        ctx.lineTo(topX - 6, topY - 2);
                        ctx.lineTo(topX, topY - 11);
                        ctx.lineTo(topX + 6, topY - 2);
                        ctx.lineTo(topX + 11, topY - 6);
                        ctx.lineTo(topX + 11, topY);
                        ctx.closePath();
                        ctx.fillStyle = goldGrad;
                        ctx.fill();
                        ctx.stroke();

                        // Altın metalik parlama çizgileri (Glint çizgileri)
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(topX - 10, topY - 1);
                        ctx.lineTo(topX - 10, topY - 5);
                        ctx.moveTo(topX, topY - 2);
                        ctx.lineTo(topX, topY - 10);
                        ctx.moveTo(topX + 10, topY - 1);
                        ctx.lineTo(topX + 10, topY - 5);
                        ctx.stroke();

                        // 3D Kesimli Faceted Gem Çizim Fonksiyonu
                        const draw3DGem = (cx, cy, w, h, colorHex, highlightHex) => {
                            ctx.save();
                            // Sol yarı (gölge tarafı)
                            ctx.fillStyle = colorHex;
                            ctx.beginPath();
                            ctx.moveTo(cx, cy - h/2);
                            ctx.lineTo(cx - w/2, cy);
                            ctx.lineTo(cx, cy + h/2);
                            ctx.closePath();
                            ctx.fill();

                            // Sağ yarı (ışık tarafı)
                            ctx.fillStyle = highlightHex;
                            ctx.beginPath();
                            ctx.moveTo(cx, cy - h/2);
                            ctx.lineTo(cx + w/2, cy);
                            ctx.lineTo(cx, cy + h/2);
                            ctx.closePath();
                            ctx.fill();

                            // Üst ışık yansıması noktası
                            ctx.fillStyle = '#ffffff';
                            ctx.beginPath();
                            ctx.arc(cx - w/6, cy - h/6, w/6, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.restore();
                        };

                        // Tepe noktalarındaki Yakutlar (Rubies)
                        draw3DGem(topX - 11, topY - 6, 3.5, 4.5, '#b91c1c', '#ef4444');
                        draw3DGem(topX, topY - 11, 4.0, 5.0, '#b91c1c', '#ef4444');
                        draw3DGem(topX + 11, topY - 6, 3.5, 4.5, '#b91c1c', '#ef4444');

                        // Tacın alt şeridindeki Safir ve Zümrütler
                        draw3DGem(topX - 5, topY - 2, 2.5, 3.0, '#1d4ed8', '#60a5fa'); // Safir (Mavi)
                        draw3DGem(topX, topY - 2, 2.5, 3.0, '#047857', '#34d399');    // Zümrüt (Yeşil)
                        draw3DGem(topX + 5, topY - 2, 2.5, 3.0, '#1d4ed8', '#60a5fa'); // Safir
                    } else if (item.id === 'santa_hat') {
                        const redGrad = ctx.createLinearGradient(topX - 11, topY - 27, topX + 12, topY - 2);
                        redGrad.addColorStop(0, '#f87171');
                        redGrad.addColorStop(0.5, '#dc2626');
                        redGrad.addColorStop(1, '#7f1d1d');

                        ctx.strokeStyle = '#4c0505';
                        ctx.lineWidth = 1.0;

                        // Kırmızı gövde (Katlanmış form)
                        ctx.beginPath();
                        ctx.moveTo(topX - 11, topY - 2);
                        ctx.bezierCurveTo(topX - 10, topY - 24, topX - 2, topY - 26, topX + 5, topY - 24);
                        ctx.bezierCurveTo(topX + 11, topY - 22, topX + 12, topY - 14, topX + 12, topY - 13);
                        ctx.lineTo(topX + 9, topY - 10);
                        ctx.bezierCurveTo(topX + 8, topY - 17, topX + 2, topY - 19, topX - 2, topY - 18);
                        ctx.bezierCurveTo(topX + 4, topY - 12, topX + 11, topY - 2, topX + 11, topY - 2);
                        ctx.lineTo(topX - 11, topY - 2);
                        ctx.closePath();
                        ctx.fillStyle = redGrad;
                        ctx.fill();
                        ctx.stroke();

                        // Gövde kırışıklığı
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                        ctx.beginPath();
                        ctx.moveTo(topX - 8, topY - 8);
                        ctx.quadraticCurveTo(topX - 2, topY - 12, topX + 5, topY - 10);
                        ctx.stroke();

                        // Pofuduk bulutumsu yün dokusu çizen yardımcı fonksiyon
                        const drawFluffyPuff = (cx, cy, rx, ry, baseR) => {
                            ctx.save();
                            // Gölgelendirme katmanı (Hafif gri)
                            ctx.fillStyle = '#e2e8f0';
                            const drawBubble = (bx, by, br) => {
                                ctx.beginPath();
                                ctx.arc(bx, by, br, 0, Math.PI * 2);
                                ctx.fill();
                            };

                            const bubblesCount = 7;
                            for (let i = 0; i < bubblesCount; i++) {
                                const angle = (i / bubblesCount) * Math.PI * 2;
                                const bx = cx + Math.cos(angle) * (rx * 0.75);
                                const by = cy + Math.sin(angle) * (ry * 0.75);
                                drawBubble(bx, by, baseR + 0.5);
                            }

                            // Ön katman (Parlak Beyaz pamuk)
                            ctx.fillStyle = '#ffffff';
                            for (let i = 0; i < bubblesCount; i++) {
                                const angle = (i / bubblesCount) * Math.PI * 2;
                                const bx = cx + Math.cos(angle) * (rx * 0.7) - 0.5;
                                const by = cy + Math.sin(angle) * (ry * 0.7) - 0.5;
                                drawBubble(bx, by, baseR + (i % 2 === 0 ? 0.8 : -0.2));
                            }
                            ctx.restore();
                        };

                        // Siper pamuğu (Bulut şerit)
                        drawFluffyPuff(topX, topY - 2.5, 12, 2.5, 3.2);

                        // Ponpon pamuğu (Uçta top pamuk)
                        drawFluffyPuff(topX + 11.5, topY - 12.5, 2.8, 2.8, 2.8);
                    }
                    ctx.restore();
                }
            };

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'shop-item';
                
                const isOwned = window.shopManager.isOwned(item.id);
                const isActive = window.shopManager.getActiveCosmetic(item.category) === item.id;
                
                if (isActive) {
                    card.classList.add('equipped');
                }

                // Generates HTML preview using sharp Canvas element
                const previewHtml = `<canvas id="shop-preview-canvas-${item.id}" width="80" height="80" style="width: 100%; height: 100%; display: block;"></canvas>`;

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

                // Render the canvas preview
                const itemCanvas = document.getElementById(`shop-preview-canvas-${item.id}`);
                if (itemCanvas) {
                    drawCardPreview(item, itemCanvas);
                }
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
        
        // Video Editör Modu (Bypass locks)
        if (localStorage.getItem('viscora_bypass_locks') === 'true') {
            return true;
        }

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

    /**
     * Küresel bildirim (toast) mesajı görüntüler
     */
    showGlobalToast(message, isSuccess = true) {
        // Eski bildirimleri temizle
        const oldToasts = document.querySelectorAll('.global-toast');
        oldToasts.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'global-toast';
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
            font-family: 'Courier New', Courier, monospace;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        toast.innerHTML = `${isSuccess ? '🎉' : '❌'} ${message}`;
        document.body.appendChild(toast);

        // Fade in
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, 3000);
    }

    initProfileUI() {
        const widget = document.getElementById('player-profile-widget');
        const modal = document.getElementById('profile-settings-modal');
        const usernameInput = document.getElementById('profile-username-input');
        const avatarPicker = document.getElementById('profile-avatar-picker');
        const btnSave = document.getElementById('btn-save-profile');
        const btnClose = document.getElementById('btn-close-profile');
        
        // Define avatars list with precise filenames and Turkish labels
        this.profileAvatars = [
            { id: 'slime_king', label: 'Jöle Kralı' },
            { id: 'mecha_drone', label: 'Mekanik Drone' },
            { id: 'fire_elemental', label: 'Ateş Elementali' },
            { id: 'ancient_totem', label: 'Kadim Totem' },
            { id: 'crystal_shard', label: 'Kristal Canavar' },
            { id: 'ghost_orb', label: 'Hayalet Küre' },
            { id: 'tentacle_blob', label: 'Dokunaçlı Jöle' },
            { id: 'shadow_artifact', label: 'Gölge Miğferi' }
        ];
        
        // Selected avatar state
        this.selectedAvatar = localStorage.getItem('viscora_avatar') || 'slime_king';
        if (this.selectedAvatar.includes('🟢') || this.selectedAvatar.includes('🔵') || this.selectedAvatar.includes('🌸') || this.selectedAvatar.includes('🤖') || this.selectedAvatar.includes('👾') || this.selectedAvatar.includes('🚀')) {
            // Reset legacy emoji avatars to default new image avatar
            this.selectedAvatar = 'slime_king';
            localStorage.setItem('viscora_avatar', 'slime_king');
        }
        
        // Render avatar list inside picker
        if (avatarPicker) {
            avatarPicker.innerHTML = '';
            this.profileAvatars.forEach(av => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'avatar-choice-btn';
                btn.dataset.avatar = av.id;
                btn.style.display = 'flex';
                btn.style.flexDirection = 'column';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.gap = '4px';
                btn.style.padding = '6px';
                btn.style.background = 'rgba(15, 23, 42, 0.5)';
                btn.style.border = '1px solid rgba(56, 189, 248, 0.15)';
                btn.style.borderRadius = '8px';
                btn.style.cursor = 'pointer';
                
                // Add image
                const img = document.createElement('img');
                img.src = `assets/avatars/${av.id}.png`;
                img.style.width = '42px';
                img.style.height = '42px';
                img.style.objectFit = 'contain';
                img.style.filter = 'drop-shadow(0 0 4px rgba(0, 242, 254, 0.25))';
                
                // Add label
                const label = document.createElement('span');
                label.textContent = av.label;
                label.style.fontSize = '0.55rem';
                label.style.color = '#94a3b8';
                label.style.fontFamily = 'monospace';
                label.style.whiteSpace = 'nowrap';
                label.style.overflow = 'hidden';
                label.style.textOverflow = 'ellipsis';
                label.style.maxWidth = '64px';
                
                btn.appendChild(img);
                btn.appendChild(label);
                
                if (av.id === this.selectedAvatar) {
                    btn.style.borderColor = '#38bdf8';
                    btn.style.background = 'rgba(56, 189, 248, 0.2)';
                    btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.3)';
                    label.style.color = '#38bdf8';
                }
                
                btn.addEventListener('click', () => {
                    this.selectedAvatar = av.id;
                    // Reset all other choice borders
                    Array.from(avatarPicker.children).forEach(child => {
                        child.style.borderColor = 'rgba(56, 189, 248, 0.15)';
                        child.style.background = 'rgba(15, 23, 42, 0.5)';
                        child.style.boxShadow = 'none';
                        const splEl = child.querySelector('span');
                        if (splEl) splEl.style.color = '#94a3b8';
                    });
                    btn.style.borderColor = '#38bdf8';
                    btn.style.background = 'rgba(56, 189, 248, 0.2)';
                    btn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.3)';
                    label.style.color = '#38bdf8';
                });
                
                avatarPicker.appendChild(btn);
            });
        }
        
        // Initial setup function
        const updateWidget = () => {
            const currentName = localStorage.getItem('viscora_author_name') || 'Oyuncu';
            let currentAvatar = localStorage.getItem('viscora_avatar') || 'slime_king';
            if (currentAvatar.includes('🟢') || currentAvatar.includes('🔵') || currentAvatar.includes('🌸') || currentAvatar.includes('🤖') || currentAvatar.includes('👾') || currentAvatar.includes('🚀')) {
                currentAvatar = 'slime_king';
                localStorage.setItem('viscora_avatar', 'slime_king');
            }
            
            const widgetName = document.getElementById('profile-widget-name');
            const widgetAvatar = document.getElementById('profile-widget-avatar');
            if (widgetName) widgetName.textContent = currentName;
            if (widgetAvatar) {
                widgetAvatar.src = `assets/avatars/${currentAvatar}.png`;
            }
        };
        
        updateWidget();
        
        // Show Profile settings Modal
        const openProfileModal = (isFirstTime = false) => {
            const titleEl = modal.querySelector('.star-gate-title');
            if (isFirstTime) {
                if (titleEl) titleEl.innerHTML = '<svg class="icon-svg"><use href="#icon-flask"></use></svg> SİSTEME GİRİŞ YAPIN';
                if (btnClose) btnClose.style.display = 'none';
            } else {
                if (titleEl) titleEl.innerHTML = '<svg class="icon-svg"><use href="#icon-flask"></use></svg> OYUNCU PROFİLİ';
                if (btnClose) btnClose.style.display = 'block';
            }
            
            this.selectedAvatar = localStorage.getItem('viscora_avatar') || 'slime_king';
            if (this.selectedAvatar.includes('🟢') || this.selectedAvatar.includes('🔵') || this.selectedAvatar.includes('🌸') || this.selectedAvatar.includes('🤖') || this.selectedAvatar.includes('👾') || this.selectedAvatar.includes('🚀')) {
                this.selectedAvatar = 'slime_king';
            }
            usernameInput.value = localStorage.getItem('viscora_author_name') || '';
            
            // Highlight current avatar choice
            if (avatarPicker) {
                Array.from(avatarPicker.children).forEach(child => {
                    const childAvatar = child.dataset.avatar;
                    if (childAvatar === this.selectedAvatar) {
                        child.style.borderColor = '#38bdf8';
                        child.style.background = 'rgba(56, 189, 248, 0.2)';
                        child.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.3)';
                        const splEl = child.querySelector('span');
                        if (splEl) splEl.style.color = '#38bdf8';
                    } else {
                        child.style.borderColor = 'rgba(56, 189, 248, 0.15)';
                        child.style.background = 'rgba(15, 23, 42, 0.5)';
                        child.style.boxShadow = 'none';
                        const splEl = child.querySelector('span');
                        if (splEl) splEl.style.color = '#94a3b8';
                    }
                });
            }
            
            modal.classList.remove('hidden');
        };
        
        // Bind Widget Click
        if (widget) {
            this.bindTouchClick(widget, () => {
                openProfileModal(false);
            });
        }
        
        // Bind Save Button
        if (btnSave) {
            this.bindTouchClick(btnSave, () => {
                let name = usernameInput.value.trim();
                const nameRegex = /^[a-zA-Z0-9 ığüşöçİĞÜŞÖÇ_.-]{2,14}$/;
                if (!name || !nameRegex.test(name)) {
                    this.showGlobalToast("Geçersiz isim! (2-14 karakter, harf/sayı)", false);
                    return;
                }
                
                localStorage.setItem('viscora_author_name', name);
                localStorage.setItem('viscora_avatar', this.selectedAvatar);
                localStorage.setItem('viscora_username_set', 'true');
                
                updateWidget();
                modal.classList.add('hidden');
                this.showGlobalToast("Profil başarıyla kaydedildi!", true);
            });
        }
        
        // Bind Cancel/Close Button
        if (btnClose) {
            this.bindTouchClick(btnClose, () => {
                modal.classList.add('hidden');
            });
        }
        
        // Trigger First-time username prompt if not set
        if (!localStorage.getItem('viscora_username_set')) {
            setTimeout(() => {
                openProfileModal(true);
            }, 800);
        }
    }
}
export default UIManager;


