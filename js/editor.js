/**
 * Viscora Level Editor
 * An interactive, visual level designer for Viscora.
 * Activated by appending ?editor=true to the URL.
 */
import { Enemy, GelChaser, TractorUFO, SweeperUFO } from './enemies.js?v=v300';
import { audio } from './audio.js?v=v300';
import { LevelGenerator } from './generator.js?v=v300';

const API_BASE = 'https://viscora.onrender.com';

function isOffensive(text) {
    if (!text) return false;
    let raw = text.toLowerCase().trim();

    const turkishMap = {
        'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
        'â': 'a', 'î': 'i', 'û': 'u'
    };
    // Leet speak / rakam-harf karışımı (ör: s1k → sik, @m → am)
    const leetMap = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a',
        '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i'
    };

    // Önce Türkçe normalize (31/69 kontrolü leet'ten önce)
    let norm = raw;
    for (const [k, v] of Object.entries(turkishMap)) norm = norm.split(k).join(v);

    // 31/69 argo sayı kontrolü (leet öncesi)
    if (/(?<!\d)(31|69)(?!\d)/.test(norm)) return true;
    if (/(?<!\d)(31|69)(?!\d)/.test(norm.replace(/[^a-z0-9]/g, ''))) return true;

    // Leet normalizasyonu
    for (const [k, v] of Object.entries(leetMap)) norm = norm.split(k).join(v);

    const shortBad = new Set([
        // Türkçe — tek başına
        'amk', 'aq', 'sik', 'am', 'got', 'pic', 'oc', 'pust',
        'akp', 'chp', 'mhp', 'hdp', 'rte', 'feto',
        'bok', 'ibne', 'gavat', 'gavad', 'gerzek', 'angut', 'cuk', 'dalyo',
        // İngilizce — tek başına
        'ass', 'shit', 'cunt', 'dick', 'cock', 'slut', 'nigga', 'fag', 'cum', 'rape',
        'bastard', 'boner', 'piss', 'wank', 'twat', 'tit', 'hoe', 'dyke', 'crap',
        // Sayı bypass’ları (s2m = sikim, 2 = iki anlamında)
        's2m', 's2k', 's2ks', 'am2', 'g2t'
    ]);

    const longBad = new Set([
        // Türkçe — alt kelime
        'yarrak', 'yarak', 'assak', 'tasak', 'tassak', 'dassak', 'dasak', 'orospu', 'siktir', 'pezevenk', 'kahpe',
        'amcik', 'kaltak', 'erdogan', 'pkk', 'abaza', 'abazan', 'bosalmak', 'bizir',
        'kilicdaroglu', 'imamoglu', 'ataturk', 'dallama', 'daltassak',
        'siken', 'domalt', 'domalan', 'domalm', 'sokuk', 'soktugum', 'sokuklar',
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
        'orosbuc', 'orospuc', 'kancik', 'kasar', 'meme', 'gogu',
        'fahişe', 'itoglu', 'itogluity', 'picin', 'gotos', 'gotluk',
        'gottan', 'gotune', 'gotunu', 'sokam', 'amciklar',
        // İngilizce — alt kelime
        'fuck', 'bitch', 'asshole', 'motherfuck', 'nigger', 'faggot',
        'whore', 'porn', 'dildo', 'fucker', 'fuckin', 'goddamn',
        'pussy', 'rapist', 'pedophil', 'pedofil', 'meme', 'blowjob',
        'prick', 'jackoff', 'bollocks', 'clitoris', 'clit', 'dumbass',
        'scumbag', 'wanker', 'twatwaffle', 'cooter'
    ]);

    // Normalize short/long bad (Türkçe harfleri de dönüştür)
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

    // Harf tekrarı temizle: siikim → sikim
    const collapse = t => t.replace(/(.)(\1+)/g, '$1');

    const sanitizeBypass = t => {
        return t.split('s2').join('siki')
                .split('g2').join('go')
                .split('am2').join('am');
    };

    // 4 versiyon kontrol: normal / boşluksuz / tekrar temizlenmiş / her ikisi
    const noSpace = norm.replace(/\s+/g, '');
    for (const v of [norm, noSpace, collapse(norm), collapse(noSpace)]) {
        if (_check(sanitizeBypass(v))) return true;
    }

    return false;
}

export class LevelEditor {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.initialized = false;
        
        this.selectedObject = null;
        this.selectedObjectType = ''; // 'platform', 'hazard', 'movingPlatform', 'gate', 'collectible', 'enemy', 'portal', 'spawn'
        this.activeTool = 'select'; // 'select', 'create_platform_normal', ...
        this.activeSlot = 1; // 1, 2, 3, 4
        
        // Double tap/click delete overlay state
        this.lastClickTime = 0;
        this.lastClickObject = null;
        this.lastClickX = 0;
        this.lastClickY = 0;
        this.deleteOverlayObject = null;
        this.deleteOverlayObjectType = '';
        this.gridSnap = true;
        this.gridSize = 20;
        
        // Panning state
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.cameraStartX = 0;
        this.cameraStartY = 0;

        // Dragging object state
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Touch states for mobile pinch zoom & drag
        this.touchStartDistance = 0;
        this.touchStartZoom = 1.0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchHasMoved = false;

        // UI Panel DOM Element
        this.panel = null;

        // Keyboard navigation keys focused state
        this.inputFocused = false;

        // Keyboard movement keys states
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            Shift: false
        };
    }

    /**
     * Editoru başlatır ve DOM elemanlarını enjekte eder
     */
    init() {
        this.active = true;
        this.game.state = 'EDITOR';
        this.game.ui.resetKeys();

        // Editörde yön tuşlarını gizle
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.classList.add('hidden');

        // Active slot verilerini yükle ve campaign custom level ile senkronize et
        this.activeSlot = parseInt(localStorage.getItem('viscora_active_slot') || '1');
        const activeSlotData = localStorage.getItem('viscora_draft_slot_' + this.activeSlot);
        if (activeSlotData) {
            localStorage.setItem('viscora_custom_level_' + this.game.currentLevel, activeSlotData);
        }

        // Load custom level from localStorage if it exists (otherwise loads campaign default)
        this.game.level.loadLevel(this.game.currentLevel, true);
        
        // Change cursor to crosshair for editor mode
        this.game.canvas.style.cursor = 'crosshair';

        // Reset camera zoom when starting editor
        if (this.game.camera) {
            this.game.camera.zoom = 1.0;
        }

        if (!this.initialized) {
            // Canvas mouse olaylarını dinle
            this.game.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
            window.addEventListener('mousemove', (e) => this.onMouseMove(e));
            window.addEventListener('mouseup', (e) => this.onMouseUp(e));
            this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // Sağ tık menüsünü engelle

            // Klavye ile yön tuşları pan kontrolü
            window.addEventListener('keydown', (e) => this.onKeyDown(e));
            window.addEventListener('keyup', (e) => this.onKeyUp(e));

            // Zoom ve Touch olayları
            this.game.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
            this.game.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            this.game.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            this.game.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            this.game.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));

            this.initialized = true;
        }

        // UI Panelini oluştur
        this.createEditorUI();
        this.updateInspector();

        // Editor moduna özel arka plan stili enjekte et
        const style = document.createElement('style');
        style.id = 'editor-custom-styles';
        style.innerHTML = `
            #viscora-editor-panel {
                position: fixed;
                top: 0;
                right: 0;
                width: 320px;
                height: 100vh;
                background: rgba(11, 15, 25, 0.85);
                backdrop-filter: blur(12px);
                border-left: 2px solid rgba(217, 70, 239, 0.3);
                box-shadow: -5px 0 25px rgba(0, 0, 0, 0.6);
                color: #e2e8f0;
                font-family: 'Outfit', sans-serif;
                z-index: 999999;
                display: flex;
                flex-direction: column;
                padding: 0;
                box-sizing: border-box;
                overflow: visible !important;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                touch-action: none !important;
            }
            #viscora-editor-panel-scroll {
                width: 100%;
                height: 100%;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                padding: 15px;
                box-sizing: border-box;
                touch-action: pan-y !important;
                -webkit-overflow-scrolling: touch;
            }
            #viscora-editor-panel-scroll::-webkit-scrollbar {
                width: 6px !important;
            }
            #viscora-editor-panel-scroll::-webkit-scrollbar-track {
                background: rgba(15, 23, 42, 0.4) !important;
            }
            #viscora-editor-panel-scroll::-webkit-scrollbar-thumb {
                background: rgba(217, 70, 239, 0.4) !important;
                border-radius: 3px !important;
            }
            #viscora-editor-panel-scroll::-webkit-scrollbar-thumb:hover {
                background: rgba(217, 70, 239, 0.6) !important;
            }
            #viscora-editor-panel * {
                touch-action: pan-y !important;
            }
            #viscora-editor-panel input, 
            #viscora-editor-panel select, 
            #viscora-editor-panel textarea {
                user-select: text !important;
                -webkit-user-select: text !important;
            }
            #viscora-editor-panel.collapsed {
                transform: translateX(320px);
            }
            .panel-toggle-btn {
                position: absolute;
                left: -32px;
                top: 50%;
                transform: translateY(-50%);
                width: 30px;
                height: 70px;
                background: rgba(11, 15, 25, 0.85);
                backdrop-filter: blur(12px);
                border: 2px solid rgba(217, 70, 239, 0.3);
                border-right: none;
                border-radius: 8px 0 0 8px;
                color: #d946ef;
                font-size: 20px;
                font-weight: 800;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                box-shadow: -5px 5px 15px rgba(0,0,0,0.3);
                outline: none;
            }
            .panel-toggle-btn:hover {
                color: #fff;
                background: rgba(217, 70, 239, 0.2);
                border-color: rgba(217, 70, 239, 0.6);
            }
            .editor-title {
                font-size: 18px;
                font-weight: 800;
                color: #d946ef;
                text-shadow: 0 0 10px rgba(217, 70, 239, 0.3);
                margin-bottom: 5px;
                letter-spacing: 1px;
                text-align: center;
            }
            .editor-subtitle {
                font-size: 11px;
                color: #10b981;
                text-align: center;
                margin-bottom: 20px;
                font-weight: 600;
                text-transform: uppercase;
            }
            .editor-section {
                margin-bottom: 18px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                padding-bottom: 12px;
            }
            .section-lbl {
                font-size: 12px;
                font-weight: 600;
                color: #94a3b8;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .tools-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            .editor-btn {
                background: rgba(30, 41, 59, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #cbd5e1;
                padding: 8px 10px;
                font-size: 12px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                white-space: normal;
                word-break: break-word;
                line-height: 1.2;
            }
            .editor-btn:hover {
                background: rgba(217, 70, 239, 0.15);
                border-color: rgba(217, 70, 239, 0.5);
                color: #fff;
            }
            .editor-btn.active {
                background: #d946ef;
                border-color: #d946ef;
                color: #fff;
                box-shadow: 0 0 10px rgba(217, 70, 239, 0.4);
            }
            .editor-btn.primary {
                background: #10b981;
                border-color: #10b981;
                color: #fff;
                grid-column: span 2;
                font-size: 14px;
                padding: 10px;
                margin-top: 5px;
            }
            .editor-btn.primary:hover {
                background: #059669;
                box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
            }
            .editor-btn.danger {
                background: rgba(239, 68, 68, 0.2);
                border-color: rgba(239, 68, 68, 0.4);
                color: #f87171;
            }
            .editor-btn.danger:hover {
                background: #ef4444;
                color: #fff;
            }
            .editor-input-group {
                display: flex;
                align-items: center;
                margin-bottom: 6px;
                font-size: 12px;
            }
            .editor-input-group label {
                width: 100px;
                color: #94a3b8;
            }
            .editor-input-group input, .editor-input-group select {
                flex: 1;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 4px;
                color: #fff;
                padding: 4px 6px;
                font-size: 12px;
                outline: none;
                font-family: inherit;
            }
            .editor-input-group input:focus, .editor-input-group select:focus {
                border-color: #d946ef;
            }
            .editor-checkbox-group {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                margin-bottom: 10px;
            }
            .editor-checkbox-group input {
                cursor: pointer;
            }
            #editor-json-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 600px;
                max-width: 90vw;
                height: 450px;
                background: #0f172a;
                border: 2px solid #d946ef;
                box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
                border-radius: 12px;
                z-index: 1000000;
                padding: 20px;
                display: flex;
                flex-direction: column;
                color: #fff;
            }
            #editor-json-modal textarea {
                flex: 1;
                background: #020617;
                border: 1px solid rgba(255,255,255,0.1);
                color: #38bdf8;
                font-family: monospace;
                font-size: 11px;
                padding: 10px;
                border-radius: 6px;
                resize: none;
                outline: none;
                margin-bottom: 12px;
            }
            #editor-json-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                z-index: 999999;
            }
            .modal-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            .editor-sub-section {
                background: rgba(30, 41, 59, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 6px;
                margin-bottom: 8px;
                overflow: hidden;
            }
            .editor-sub-section summary {
                padding: 8px 10px;
                font-size: 12px;
                font-weight: bold;
                color: #cbd5e1;
                cursor: pointer;
                user-select: none;
                background: rgba(15, 23, 42, 0.5);
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                outline: none;
            }
            .editor-sub-section summary::-webkit-details-marker {
                display: none;
            }
            .editor-sub-section[open] summary {
                border-bottom: 1px solid rgba(217, 70, 239, 0.3);
                color: #d946ef;
            }
            .editor-sub-section .tools-grid {
                padding: 8px;
            }
            /* Hide HTML Screens when editing */
            .editor-active-screen-override {
                display: none !important;
            }
            
            /* Responsive styles for mobile phones */
            @media (max-width: 768px) {
                #viscora-editor-panel {
                    width: 240px !important;
                    padding: 0 !important;
                }
                #viscora-editor-panel-scroll {
                    padding: 8px !important;
                }
                #viscora-editor-panel.collapsed {
                    transform: translateX(240px) !important;
                }
                .panel-toggle-btn {
                    width: 26px !important;
                    height: 50px !important;
                    left: -26px !important;
                    font-size: 15px !important;
                }
                .editor-title {
                    font-size: 14px !important;
                    margin-bottom: 3px !important;
                }
                .editor-subtitle {
                    font-size: 9px !important;
                    margin-bottom: 10px !important;
                }
                .editor-section {
                    margin-bottom: 10px !important;
                    padding-bottom: 8px !important;
                }
                .section-lbl {
                    font-size: 10px !important;
                    margin-bottom: 4px !important;
                }
                .tools-grid {
                    gap: 4px !important;
                }
                .editor-btn {
                    padding: 5px 6px !important;
                    font-size: 10px !important;
                    gap: 3px !important;
                    border-radius: 4px !important;
                }
                .editor-btn.primary {
                    font-size: 11px !important;
                    padding: 7px !important;
                }
                .editor-input-group {
                    font-size: 10px !important;
                    margin-bottom: 4px !important;
                }
                .editor-input-group label {
                    width: 60px !important;
                }
                .editor-input-group input, .editor-input-group select {
                    padding: 3px 4px !important;
                    font-size: 10px !important;
                }
                .editor-checkbox-group {
                    font-size: 10px !important;
                    margin-bottom: 6px !important;
                }
                .editor-sub-section summary {
                    padding: 6px 8px !important;
                    font-size: 10px !important;
                }
                #editor-inspector-content {
                    font-size: 10px !important;
                }
                #editor-inspector-content div {
                    font-size: 10px !important;
                }
                #editor-inspector-content span {
                    font-size: 9px !important;
                }
                #editor-inspector-content button {
                    font-size: 9px !important;
                    padding: 4px 6px !important;
                }
            }
            .editor-tag-btn {
                background: rgba(30, 41, 59, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #94a3b8;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: 600;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                gap: 3px;
            }
            .editor-tag-btn:hover {
                background: rgba(6, 182, 212, 0.12);
                border-color: rgba(6, 182, 212, 0.3);
                color: #22d3ee;
            }
            .editor-tag-btn.active {
                background: rgba(6, 182, 212, 0.25);
                border-color: #22d3ee;
                color: #fff;
                box-shadow: 0 0 8px rgba(6, 182, 212, 0.35);
            }
        `;
        document.head.appendChild(style);

        // Gizle menü ekranlarını
        this.hideAllScreens();
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(scr => {
            scr.classList.add('editor-active-screen-override');
        });
        document.getElementById('hud').classList.add('hidden');
    }

    showAllScreens() {
        document.querySelectorAll('.screen').forEach(scr => {
            scr.classList.remove('editor-active-screen-override');
        });
        const styles = document.getElementById('editor-custom-styles');
        if (styles) styles.remove();
        if (this.panel) this.panel.remove();
    }

    /**
     * Editör modunu tamamen kapatır ve normal oyuna döner
     */
    deactivate() {
        this.active = false;
        
        // Remove panel from DOM
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }

        // Remove custom styles
        const styles = document.getElementById('editor-custom-styles');
        if (styles) styles.remove();

        // Restore UI screens
        this.showAllScreens();

        // Reset cursor
        this.game.canvas.style.cursor = 'default';

        // Return to gameplay state with edited level instead of reloading campaign level
        this.game.state = 'PLAYING';
        this.game.ui.showScreen('hud');
        
        // Initialize enemies from edited state
        this.game.enemies = [];
        if (this.game.level.enemies) {
            this.game.enemies = this.game.level.enemies.map(e => {
                if (e.type === 'chaser') {
                    return new GelChaser(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.0, e.color || '#10b981');
                } else if (e.type === 'tractor_ufo') {
                    return new TractorUFO(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.0);
                } else if (e.type === 'sweeper_ufo') {
                    return new SweeperUFO(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.2, e.laserType);
                } else {
                    return new Enemy(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.2, !!e.isVertical, e.color || '#f43f5e');
                }
            });
        }

        // Respawn player
        this.game.player.respawn(this.game.level.spawnX, this.game.level.spawnY);
        this.game.ui.updateHUDHealth(this.game.player.health);
        this.game.ui.updateHUDViscosity(this.game.player.viscosity);
        
        // Remove tip if playtesting
        const tip = document.getElementById('editor-playtest-tip');
        if (tip) tip.remove();
    }

    /**
     * Editörden çıkıp doğrudan ana menüye döner (Sayfa yenilemeden)
     */
    exitEditorToMenu() {
        this.active = false;
        
        // Remove panel from DOM
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }

        // Remove custom styles
        const styles = document.getElementById('editor-custom-styles');
        if (styles) styles.remove();

        // Restore UI screens
        this.showAllScreens();

        // Reset cursor
        this.game.canvas.style.cursor = 'default';

        // Set game state and transition to main menu screen
        this.game.state = 'MENU';
        if (this.game.currentLevel === 999) {
            this.game.ui.showScreen('community');
            if (this.game.ui.loadCommunityMaps) {
                this.game.ui.loadCommunityMaps(this.game.ui.currentSort || 'popular');
            }
        } else {
            this.game.ui.showScreen('start');
        }
        
        // Clean the ?editor=true parameter from URL without reloading
        if (window.location.search.includes('editor=true')) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Restart menu music if audio is initialized
        if (typeof audio !== 'undefined' && audio.init) {
            audio.init();
            audio.startMusic();
        }
    }

    /**
     * Editör UI Sidebar panelini kurar
     */
    createEditorUI() {
        if (document.getElementById('viscora-editor-panel')) return;

        this.panel = document.createElement('div');
        this.panel.id = 'viscora-editor-panel';

        const activeTags = this.game.level.tags || [];
        const isBulmacaActive = activeTags.includes('Bulmaca') ? 'active' : '';
        const isAksiyonActive = activeTags.includes('Aksiyon') ? 'active' : '';
        const isKolayActive = activeTags.includes('Kolay') ? 'active' : '';
        const isZorActive = activeTags.includes('Zor') ? 'active' : '';
        const isKisaActive = activeTags.includes('Kısa') ? 'active' : '';

        this.panel.innerHTML = `
            <div id="viscora-editor-panel-scroll">
            <div class="editor-title">VISCORA EDITOR</div>
            <div class="editor-subtitle">BÖLÜM TASARIMCISI</div>

            <!-- Seviye Havuzu (Slotlar) -->
            <div class="editor-section" style="border-bottom: 1px solid rgba(34, 211, 238, 0.2); padding-bottom: 12px;">
                <div class="section-lbl" style="color: #22d3ee; display: flex; align-items: center; gap: 5px; margin-bottom: 8px;">
                    <svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-portal"></use></svg> HARİTA HAVUZU (SLOTLAR)
                </div>
                <div class="editor-slots-container" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                    <button class="editor-btn slot-btn ${this.activeSlot === 1 ? 'active' : ''}" data-slot="1" style="font-weight: bold; padding: 6px 0;">SLOT 1</button>
                    <button class="editor-btn slot-btn ${this.activeSlot === 2 ? 'active' : ''}" data-slot="2" style="font-weight: bold; padding: 6px 0;">SLOT 2</button>
                    <button class="editor-btn slot-btn ${this.activeSlot === 3 ? 'active' : ''}" data-slot="3" style="font-weight: bold; padding: 6px 0;">SLOT 3</button>
                    <button class="editor-btn slot-btn ${this.activeSlot === 4 ? 'active' : ''}" data-slot="4" style="font-weight: bold; padding: 6px 0;">SLOT 4</button>
                </div>
            </div>

            <!-- Sistem Kontrolleri -->
            <div class="editor-section">
                <div class="section-lbl">Sistem</div>
                <div class="tools-grid">
                    <button class="editor-btn primary" id="editor-playtest-btn" style="display: flex; align-items: center; justify-content: center; gap: 4px;"><svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-play"></use></svg> PLAY TEST (P)</button>
                    <button class="editor-btn" id="editor-export-btn" style="display: flex; align-items: center; justify-content: center; gap: 4px;"><svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-book"></use></svg> KAYDET</button>
                    <button class="editor-btn" id="editor-share-btn" style="background: rgba(6, 182, 212, 0.15); color: #22d3ee; border-color: rgba(6, 182, 212, 0.35); grid-column: span 2; display: flex; align-items: center; justify-content: center; gap: 4px;"><svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-portal"></use></svg> PAYLAŞ</button>
                    <button class="editor-btn danger" id="editor-clear-btn" style="grid-column: span 2; display: flex; align-items: center; justify-content: center; gap: 4px;"><svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-warning"></use></svg> CLEAR LEVEL</button>
                    <button class="editor-btn danger" id="editor-exit-btn" style="grid-column: span 2; margin-top: 5px; background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.35); display: flex; align-items: center; justify-content: center; gap: 4px;"><svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-home"></use></svg> EXIT TO MENU</button>
                </div>
            </div>

            <!-- Rastgele Bölüm Üretici -->
            <div class="editor-section" style="border-bottom: 1px solid rgba(217, 70, 239, 0.2); padding-bottom: 15px;">
                <div class="section-lbl" style="color: #d946ef; display: flex; align-items: center; gap: 5px;">
                    <svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-bolt"></use></svg> RASTGELE BÖLÜM ÜRETİCİ
                </div>
                <div class="editor-input-group" style="margin-top: 8px;">
                    <label style="width: 75px;">Seed (Tohum)</label>
                    <input type="text" id="generator-seed-input" placeholder="Rastgele (Boş bırakın)" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(217, 70, 239, 0.4); box-shadow: 0 0 5px rgba(217, 70, 239, 0.1);">
                </div>
                <div class="editor-input-group" style="margin-top: 6px;">
                    <label style="width: 75px;">Zorluk</label>
                    <select id="generator-difficulty-sel" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(217, 70, 239, 0.4); color: #fff;">
                        <option value="random" selected>Rastgele</option>
                        <option value="easy">Kolay</option>
                        <option value="medium">Orta</option>
                        <option value="hard">Zor</option>
                    </select>
                </div>
                <button class="editor-btn" id="editor-generate-btn" style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%); color: #fff; border: none; font-weight: 800; font-size: 13px; text-shadow: 0 1px 2px rgba(0,0,0,0.5); box-shadow: 0 0 15px rgba(217, 70, 239, 0.2); transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <svg class="icon-svg" style="width: 12px; height: 12px; margin: 0;"><use href="#icon-bolt"></use></svg> BÖLÜMÜ BASTAN YARAT
                </button>
            </div>

            <!-- Ayarlar -->
            <div class="editor-section">
                <div class="section-lbl">Seviye & Izgara</div>
                <div class="editor-checkbox-group">
                    <input type="checkbox" id="editor-grid-snap-chk" ${this.gridSnap ? 'checked' : ''}>
                    <label for="editor-grid-snap-chk">Izgaraya Hizala (Snap)</label>
                </div>
                <div class="editor-input-group">
                    <label>Izgara Boyutu</label>
                    <select id="editor-grid-size-sel">
                        <option value="10">10 px</option>
                        <option value="20" selected>20 px</option>
                        <option value="50">50 px</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Bölüm Adı</label>
                    <input type="text" id="editor-level-name" value="${this.game.level.name || ''}" placeholder="Bölüm Adı">
                </div>
                <div class="editor-input-group">
                    <label>Tasarımcı Adı</label>
                    <input type="text" id="editor-author-name" value="${localStorage.getItem('viscora_author_name') || 'Tasarımcı'}" placeholder="Tasarımcı Adı">
                </div>
                <div class="editor-input-group">
                    <label>Harita Genişlik</label>
                    <input type="number" id="editor-level-width" value="${this.game.level.width}" min="800" max="5000">
                </div>
                <div class="editor-input-group">
                    <label>Harita Yükseklik</label>
                    <input type="number" id="editor-level-height" value="${this.game.level.height}" min="600" max="1500">
                </div>
                <div class="editor-capacity-section" style="grid-column: span 2; margin-top: 10px; border: 1px solid rgba(168, 85, 247, 0.2); padding: 10px; border-radius: 6px; background: rgba(15, 23, 42, 0.6); box-shadow: 0 0 10px rgba(168, 85, 247, 0.05); display: flex; flex-direction: column; gap: 6px;">
                    <div style="font-size: 11px; font-weight: 800; color: #a855f7; display: flex; align-items: center; gap: 4px; border-bottom: 1px solid rgba(168, 85, 247, 0.15); padding-bottom: 4px; margin-bottom: 2px;">
                        <svg class="icon-svg" style="width: 10px; height: 10px; margin: 0;"><use href="#icon-warning"></use></svg> HARİTA KAPASİTESİ (NESNE SINIRLARI)
                    </div>
                    <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #94a3b8;">Zeminler (Maks 200):</span>
                        <span id="capacity-platforms" style="font-family: monospace; font-weight: bold; color: #10b981;">0/200</span>
                    </div>
                    <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #94a3b8;">Engeller (Maks 100):</span>
                        <span id="capacity-hazards" style="font-family: monospace; font-weight: bold; color: #10b981;">0/100</span>
                    </div>
                    <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #94a3b8;">Lazer Elemanları (Maks 40):</span>
                        <span id="capacity-lasers" style="font-family: monospace; font-weight: bold; color: #10b981;">0/40</span>
                    </div>
                    <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #94a3b8;">Kutular & Aynalar (Maks 45):</span>
                        <span id="capacity-mirrors" style="font-family: monospace; font-weight: bold; color: #10b981;">0/45</span>
                    </div>
                    <div style="font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #94a3b8;">Düşmanlar (Maks 40):</span>
                        <span id="capacity-enemies" style="font-family: monospace; font-weight: bold; color: #10b981;">0/40</span>
                    </div>
                </div>
                <div class="editor-input-group" style="grid-column: span 2; margin-top: 8px; flex-direction: column; align-items: flex-start;">
                    <label style="display: block; margin-bottom: 6px; width: 100%;">Etiketler (En Fazla 2 Adet)</label>
                    <div class="editor-tags-container" style="display: flex; flex-wrap: wrap; gap: 6px; width: 100%;">
                        <button class="editor-tag-btn ${isBulmacaActive}" data-tag="Bulmaca">🧩 Bulmaca</button>
                        <button class="editor-tag-btn ${isAksiyonActive}" data-tag="Aksiyon">⚔️ Aksiyon</button>
                        <button class="editor-tag-btn ${isKolayActive}" data-tag="Kolay">🟢 Kolay</button>
                        <button class="editor-tag-btn ${isZorActive}" data-tag="Zor">🔴 Zor</button>
                        <button class="editor-tag-btn ${isKisaActive}" data-tag="Kısa">⚡ Kısa</button>
                    </div>
                </div>
            </div>

            <!-- Araçlar / Objeler -->
            <div class="editor-section">
                <div class="section-lbl">Araçlar & Objeler</div>
                
                <details open class="editor-sub-section">
                    <summary>🔍 Temel Araçlar</summary>
                    <div class="tools-grid">
                        <button class="editor-btn active" data-tool="select" style="grid-column: span 2;">🔍 Seç / Taşı</button>
                        <button class="editor-btn" data-tool="create_spawn">🟢 Oyuncu Başlangıç</button>
                        <button class="editor-btn" data-tool="create_portal">🌀 Bitiş Portalı</button>
                        <button class="editor-btn" data-tool="create_collectible_yellow">💛 Sarı Kristal</button>
                        <button class="editor-btn" data-tool="create_collectible_blue">💙 Mavi Kristal</button>
                        <button class="editor-btn" data-tool="create_collectible_pink">💗 Pembe Kristal</button>
                        <button class="editor-btn" data-tool="create_collectible_green">💚 Yeşil Kristal</button>
                        <button class="editor-btn" data-tool="create_collectible_diamond">💎 Kırmızı Elmas</button>
                        <button class="editor-btn" data-tool="create_checkpoint" style="grid-column: span 2; background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.35);">🚩 Checkpoint</button>
                    </div>
                </details>

                <details class="editor-sub-section">
                    <summary>🧱 Zeminler & Duvarlar</summary>
                    <div class="tools-grid">
                        <button class="editor-btn" data-tool="create_platform_normal">🧱 Normal Zemin</button>
                        <button class="editor-btn" data-tool="create_platform_long">🧱 Uzun Zemin</button>
                        <button class="editor-btn" data-tool="create_platform_narrow">🧱 Dar Zemin</button>
                        <button class="editor-btn" data-tool="create_wall_normal">🧱 Normal Duvar</button>
                        <button class="editor-btn" data-tool="create_platform_sticky">🟣 Pembe Yapışkan</button>
                        <button class="editor-btn" data-tool="create_platform_sticky_purple">💜 Mor Yapışkan</button>
                        <button class="editor-btn" data-tool="create_platform_slippery">🔵 Mavi Kaygan</button>
                        <button class="editor-btn" data-tool="create_moving">🟡 Hareketli Zemin</button>
                        <button class="editor-btn" data-tool="create_platform_falling">⏳ Düşen Zemin</button>
                        <button class="editor-btn" data-tool="create_platform_breakable">💥 Kırılabilir Zemin</button>
                        <button class="editor-btn" data-tool="create_wall_breakable">💥 Kırılabilir Duvar</button>
                        <button class="editor-btn" data-tool="create_hidden_passage">👁️ Gizli Geçit (İnce)</button>
                    </div>
                </details>

                <details class="editor-sub-section">
                    <summary>⚙️ Mekanikler & Etkileşim</summary>
                    <div class="tools-grid">
                        <button class="editor-btn" data-tool="create_plate">🟨 Basınç Plakası</button>
                        <button class="editor-btn" data-tool="create_pushblock">📦 İtilebilir Blok</button>
                        <button class="editor-btn" data-tool="create_conveyor">🧡 Konveyör Bant</button>
                        <button class="editor-btn" data-tool="create_bouncepad">🦘 Zıplama Pedi</button>
                        <button class="editor-btn" data-tool="create_teleport" style="grid-column: span 2;">🌌 Işınlanma Portalı (Pair)</button>
                        <button class="editor-btn" data-tool="create_button">🔘 Buton (Bas/Çek)</button>
                        <button class="editor-btn" data-tool="create_lever">🕹️ Kol (Şalter)</button>
                        <button class="editor-btn" data-tool="create_vantuz" style="grid-column: span 2;">🧲 Vantuz Noktası (Pembe)</button>
                        <button class="editor-btn" data-tool="create_mirror_slash">🪞 Ayna (/)</button>
                        <button class="editor-btn" data-tool="create_mirror_backslash">🪞 Ayna (\)</button>
                        <button class="editor-btn" data-tool="create_static_mirror_slash">📐 Köşe Ayna (/)</button>
                        <button class="editor-btn" data-tool="create_static_mirror_backslash">📐 Köşe Ayna (\)</button>
                        <button class="editor-btn" data-tool="create_laser_emitter">📡 Lazer Verici</button>
                        <button class="editor-btn" data-tool="create_laser_receiver">🎯 Lazer Alıcı</button>
                    </div>
                </details>

                <details class="editor-sub-section">
                    <summary>⚡ Engeller, Tuzaklar & Silahlar</summary>
                    <div class="tools-grid">
                        <button class="editor-btn" data-tool="create_gate_blue">🔵 Mavi Lazer</button>
                        <button class="editor-btn" data-tool="create_gate_pink">💗 Pembe Lazer</button>
                        <button class="editor-btn" data-tool="create_gate_green">💚 Yeşil Lazer</button>
                        <button class="editor-btn" data-tool="create_gate_yellow">💛 Sarı Lazer</button>
                        <button class="editor-btn" data-tool="create_gate_net" style="grid-column: span 2;">🟣 Mor Ağ Kapısı</button>
                        <button class="editor-btn" data-tool="create_flamethrower" style="grid-column: span 2;">🔥 Alev Silahı (Flamethrower)</button>
                        <button class="editor-btn" data-tool="create_arrow_shooter" style="grid-column: span 2; background: rgba(6, 182, 212, 0.12); color: #67e8f9; border-color: rgba(6, 182, 212, 0.35);">🏹 Ok Fırlatıcı (Arrow Shooter)</button>
                        <button class="editor-btn" data-tool="create_trap_falling_block" style="grid-column: span 2;">🗿 Düşen Blok Tuzağı</button>
                        <button class="editor-btn" data-tool="create_hazard_acid" style="grid-column: span 2;">🧪 Asit Havuzu</button>
                        <button class="editor-btn" data-tool="create_hazard_spike">🔺 Yer Dikeni</button>
                        <button class="editor-btn" data-tool="create_hazard_spike_down">🔻 Tavan Dikeni</button>
                        <button class="editor-btn" data-tool="create_hazard_spike_left">◀️ Duvar Dikeni (S)</button>
                        <button class="editor-btn" data-tool="create_hazard_spike_right">▶️ Duvar Dikeni (D)</button>
                    </div>
                </details>

                <details class="editor-sub-section">
                    <summary>👾 Düşmanlar & Canavarlar</summary>
                    <div class="tools-grid">
                        <button class="editor-btn" data-tool="create_enemy">🔴 Yatay Diken</button>
                        <button class="editor-btn" data-tool="create_enemy_vertical">🔵 Dikey Diken</button>
                        <button class="editor-btn" data-tool="create_enemy_jumping">🟣 Zıplayan Diken</button>
                        <button class="editor-btn" data-tool="create_enemy_flying">🟡 Uçan Diken</button>
                        <button class="editor-btn" data-tool="create_enemy_chaser" style="grid-column: span 2; background: rgba(16, 185, 129, 0.12); color: #34d399; border-color: rgba(16, 185, 129, 0.35);">🧬 Jel Takipçi (Gel Chaser)</button>
                        <button class="editor-btn" data-tool="create_enemy_tractor" style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border-color: rgba(168, 85, 247, 0.35);">🛸 Çekim UFO (Tractor)</button>
                        <button class="editor-btn" data-tool="create_enemy_sweeper" style="background: rgba(6, 182, 212, 0.12); color: #22d3ee; border-color: rgba(6, 182, 212, 0.35);">⚡ Lazer UFO (Sweeper)</button>
                    </div>
                </details>

                <details class="editor-sub-section">
                    <summary>🎀 Dekoratif Objeler</summary>
                    <div class="tools-grid">
                        <button class="editor-btn" data-tool="create_deco_neon">💡 Neon Işık</button>
                        <button class="editor-btn" data-tool="create_deco_box">📦 Kutu</button>
                        <button class="editor-btn" data-tool="create_deco_pipe">🔧 Boru</button>
                        <button class="editor-btn" data-tool="create_deco_cable">🔌 Kablo</button>
                        <button class="editor-btn" data-tool="create_deco_pano">🖥️ Pano</button>
                        <button class="editor-btn" data-tool="create_deco_fan">🌀 Fan</button>
                        <button class="editor-btn" data-tool="create_deco_warning">🚨 Arıza Işığı</button>
                        <button class="editor-btn" data-tool="create_deco_steam">💨 Sis / Buhar</button>
                        <button class="editor-btn" data-tool="create_deco_pillar">🏛️ Sütun (Pillar)</button>
                        <button class="editor-btn" data-tool="create_deco_gear">⚙️ Dişli (Gear)</button>
                        <button class="editor-btn" data-tool="create_deco_window_space">🌌 Hologram Pencere</button>
                        <button class="editor-btn" data-tool="create_deco_server_rack">🖥️ Sunucu Konsolu</button>
                        <button class="editor-btn" data-tool="create_deco_textbox" style="grid-column: span 2;">💬 Bilgi / Yazı Kutusu</button>
                    </div>
                </details>
            </div>

            <!-- Tetikleyici Yardım Rehberi -->
            <details class="editor-sub-section" style="margin-bottom: 15px;">
                <summary>💡 Tetikleyiciler Nasıl Çalışır?</summary>
                <div style="font-size: 11px; padding: 10px; line-height: 1.45; color: #94a3b8; background: rgba(30, 41, 59, 0.2); border-radius: 4px;">
                    <strong>Kapı Açma / Tetikleme Sistemi:</strong><br>
                    1. Bir Lazer veya Ağ kapısı yerleştirin ve seçerek müfettişteki <strong>Bariyer ID</strong> değerine bakın (örn. <code>101</code>).<br>
                    2. Bir <strong>Basınç Plakası</strong>, <strong>Buton</strong> veya <strong>Şalter (Kol)</strong> yerleştirin.<br>
                    3. Tetikleyiciyi seçip müfettişteki <strong>Bağlı Kapı ID</strong> değerini kapı ID'si ile aynı yapın (örn. <code>101</code>).<br><br>
                    <strong>Tetikleyici Farkları:</strong><br>
                    - <strong>Plaka</strong>: Üzerine basıldığı sürece kapıyı açık tutar (İtilebilir Blok da yerleştirilebilir).<br>
                    - <strong>Buton</strong>: Basıldığında kapıyı 3 saniye boyunca açık tutar, sonra kapanır.<br>
                    - <strong>Şalter</strong>: Her etkileşimde kapıyı kalıcı açar/kapatır.
                </div>
            </details>

            <!-- Müfettiş (Inspector) -->
            <div class="editor-section" style="flex: 1; border-bottom: none;">
                <div class="section-lbl">Obje Detayları (Müfettiş)</div>
                <div id="editor-inspector-content">
                    <span style="color:#64748b; font-style:italic; font-size:12px;">Seçili obje yok.</span>
                </div>
            </div>
            
            <div style="font-size: 10px; color:#64748b; text-align:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:10px;">
                Sağ Tık + Sürükle: Kamerayı Kaydır<br>
                Yön Tuşları: Kamerayı Kaydır<br>
                Delete / Backspace: Seçiliyi Sil
            </div>
            </div>
        `;

        document.getElementById('game-container').appendChild(this.panel);

        // Etiket Butonları Bağlantısı
        const tagBtns = this.panel.querySelectorAll('.editor-tag-btn');
        tagBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.game.level.tags = this.game.level.tags || [];
                const tag = btn.getAttribute('data-tag');
                const idx = this.game.level.tags.indexOf(tag);
                
                if (idx !== -1) {
                    this.game.level.tags.splice(idx, 1);
                } else {
                    if (this.game.level.tags.length >= 2) {
                        alert("En fazla 2 etiket seçebilirsiniz!");
                        return;
                    }
                    this.game.level.tags.push(tag);
                }
                this.updateTagButtonsUI();
                this.saveToLocalStorage();
            });
        });

        // Olay Dinleyicileri Ekle
        this.panel.querySelectorAll('.editor-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.panel.querySelectorAll('.editor-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeTool = btn.getAttribute('data-tool');
                this.selectedObject = null;
                this.selectedObjectType = '';
                this.updateInspector();
            });
        });

        // Grid Snap ve Izgara Ayarları
        const snapChk = document.getElementById('editor-grid-snap-chk');
        snapChk.addEventListener('change', (e) => {
            this.gridSnap = snapChk.checked;
        });

        const sizeSel = document.getElementById('editor-grid-size-sel');
        sizeSel.addEventListener('change', (e) => {
            this.gridSize = parseInt(sizeSel.value);
        });

        // Harita Başlığı ve Boyutları
        const nameInput = document.getElementById('editor-level-name');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                const newName = nameInput.value.trim();
                if (isOffensive(newName)) {
                    alert("Bölüm adı uygunsuz, argo veya siyasi içerik içeremez!");
                    nameInput.value = this.game.level.name || '';
                    return;
                }
                this.game.level.name = newName || "Özel Harita";
                this.saveToLocalStorage();
            });
        }

        const authorInput = document.getElementById('editor-author-name');
        if (authorInput) {
            authorInput.addEventListener('change', (e) => {
                const newAuthor = authorInput.value.trim();
                if (isOffensive(newAuthor)) {
                    alert("Tasarımcı adı uygunsuz, argo veya siyasi içerik içeremez!");
                    authorInput.value = localStorage.getItem('viscora_author_name') || 'Tasarımcı';
                    return;
                }
                localStorage.setItem('viscora_author_name', newAuthor || "Tasarımcı");
            });
        }

        const widthInput = document.getElementById('editor-level-width');
        widthInput.addEventListener('change', (e) => {
            this.game.level.width = Math.min(5000, Math.max(800, parseInt(widthInput.value) || 2000));
            widthInput.value = this.game.level.width;
        });
        const heightInput = document.getElementById('editor-level-height');
        heightInput.addEventListener('change', (e) => {
            this.game.level.height = Math.min(1500, Math.max(600, parseInt(heightInput.value) || 600));
            heightInput.value = this.game.level.height;
        });

        // Slot Seçim Butonları Dinleyicisi
        const slotButtons = this.panel.querySelectorAll('.slot-btn');
        slotButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedSlot = parseInt(btn.getAttribute('data-slot'));
                this.changeSlot(selectedSlot);
            });
        });

        // Klavye alanına tıklanınca klavye navigasyonunu durdur
        this.panel.addEventListener('focusin', () => { this.inputFocused = true; });
        this.panel.addEventListener('focusout', () => { this.inputFocused = false; });

        // Sistem butonları
        document.getElementById('editor-playtest-btn').addEventListener('click', () => this.startPlaytest());
        document.getElementById('editor-export-btn').addEventListener('click', () => {
            this.saveToLocalStorage();
            alert('Tasarımınız başarıyla kaydedildi!');
        });
        document.getElementById('editor-share-btn').addEventListener('click', () => this.publishToCommunity());
        document.getElementById('editor-clear-btn').addEventListener('click', () => {
            showConfirmModal('Bölümdeki tüm objeler silinecek! Emin misiniz?', () => {
                this.clearLevel();
            });
        });

        document.getElementById('editor-exit-btn').addEventListener('click', () => {
            showConfirmModal('Editörden çıkıp ana menüye dönmek istiyor musunuz? Kaydedilmemiş değişiklikler kaybolabilir.', () => {
                this.exitEditorToMenu();
            });
        });

        // Rastgele Seviye Üretme Butonu
        document.getElementById('editor-generate-btn').addEventListener('click', () => {
            let seedInput = document.getElementById('generator-seed-input').value.trim();
            if (!seedInput) {
                // Generate a random seed if none is provided
                seedInput = Math.floor(Math.random() * 90000 + 10000).toString();
                document.getElementById('generator-seed-input').value = seedInput;
            }
            
            let difficulty = document.getElementById('generator-difficulty-sel').value;
            if (difficulty === 'random') {
                // Procedurally determine difficulty based on the seed
                let hash = 0;
                const s = String(seedInput);
                for (let i = 0; i < s.length; i++) {
                    hash = (hash << 5) - hash + s.charCodeAt(i);
                    hash |= 0;
                }
                const diffs = ['easy', 'medium', 'hard'];
                difficulty = diffs[Math.abs(hash) % 3];
            }
            
            // Clear current level
            this.clearLevel();
            
            // Generate using LevelGenerator
            LevelGenerator.generate(this.game, seedInput, difficulty);
            
            // Update input values on the screen
            const nameEl = document.getElementById('editor-level-name');
            if (nameEl) nameEl.value = this.game.level.name || '';
            document.getElementById('editor-level-width').value = this.game.level.width;
            document.getElementById('editor-level-height').value = this.game.level.height;
            
            // Select nothing, refresh inspector
            this.selectedObject = null;
            this.selectedObjectType = '';
            this.updateInspector();
            
            // Save to localStorage immediately
            this.saveToLocalStorage();
            
            // Center the camera on the spawn point
            this.game.camera.x = Math.max(0, this.game.level.spawnX - this.game.cssWidth / 2);
            this.game.camera.y = Math.max(0, this.game.level.spawnY - this.game.cssHeight / 2);
            
            audio.playCollect(); // Play sound effect
        });

        // Panel Aç/Kapat Butonu (Toggle Handle Button) enjekte et
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'editor-panel-toggle';
        toggleBtn.className = 'panel-toggle-btn';
        toggleBtn.innerHTML = '›';
        toggleBtn.title = 'Paneli Kapat / Aç (Tab)';
        this.panel.appendChild(toggleBtn);

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePanel();
        });

        toggleBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.togglePanel();
        }, { passive: false });
    }

    updateTagButtonsUI() {
        if (!this.panel) return;
        const activeTags = this.game.level.tags || [];
        const btns = this.panel.querySelectorAll('.editor-tag-btn');
        btns.forEach(btn => {
            const tag = btn.getAttribute('data-tag');
            if (activeTags.includes(tag)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * Editör yan panelinin görünürlüğünü açar/kapatır (Drawer Slide)
     */
    togglePanel() {
        if (!this.panel) return;
        
        const isCollapsed = this.panel.classList.toggle('collapsed');
        const toggleBtn = document.getElementById('editor-panel-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = isCollapsed ? '‹' : '›';
        }
        audio.playPlateActivate(); // Sesli geribildirim
        this.clampCamera();
    }

    /**
     * Tüm bölüm verilerini sıfırlar
     */
    clearLevel() {
        // Clear saved custom level from localStorage
        localStorage.removeItem('viscora_custom_level_' + this.game.currentLevel);
        if (this.activeSlot) {
            localStorage.removeItem('viscora_draft_slot_' + this.activeSlot);
        }

        const lvl = this.game.level;
        lvl.platforms = [{ x: 0, y: 460, w: 400, h: 140, type: 'normal' }]; // En azından bir başlangıç zemini
        lvl.hazards = [];
        lvl.movingPlatforms = [];
        lvl.gates = [];
        lvl.collectibles = [];
        lvl.enemies = [];
        lvl.pressurePlates = [];
        lvl.pushBlocks = [];
        lvl.conveyors = [];
        lvl.teleportPairs = [];
        lvl.bouncePads = [];
        lvl.buttons = [];
        lvl.levers = [];
        lvl.flamethrowers = [];
        lvl.arrowShooters = [];
        lvl.laserEmitters = [];
        lvl.laserReceivers = [];
        lvl.staticMirrors = [];
        lvl.fallingPlatforms = [];
        lvl.breakablePlatforms = [];
        lvl.hiddenPassages = [];
        lvl.fallingBlockTraps = [];
        lvl.vantuzPoints = [];
        lvl.decorations = [];
        lvl.spawnX = 80;
        lvl.spawnY = 350;
        lvl.portal = { x: 300, y: 380, w: 60, h: 80, angle: 0 };
        lvl.serverLevelId = null;
        
        // Center the camera on the spawn point
        this.game.camera.x = 0;
        this.game.camera.y = 0;
        
        this.selectedObject = null;
        this.selectedObjectType = '';
        this.updateInspector();
        
        lvl.tags = [];
        this.updateTagButtonsUI();
    }

    /**
     * Mevcut seviye verilerini tarayıcı hafızasına (localStorage) otomatik kaydeder.
     */
    saveToLocalStorage() {
        const exportObj = this.getLevelDataObj();
        const jsonStr = JSON.stringify(exportObj, null, 4);
        localStorage.setItem('viscora_custom_level_' + this.game.currentLevel, jsonStr);
        if (this.activeSlot) {
            localStorage.setItem('viscora_draft_slot_' + this.activeSlot, jsonStr);
        }
        this.updateCapacityUI();
    }

    /**
     * Tasarım slotunu değiştirir, eski slotu kaydeder ve yeni slotu yükler.
     */
    changeSlot(newSlot) {
        if (newSlot === this.activeSlot) return;
        
        // Mevcut seviyeyi eski slota kaydet
        const currentData = this.getLevelDataObj();
        localStorage.setItem('viscora_draft_slot_' + this.activeSlot, JSON.stringify(currentData));
        
        // Aktif slotu güncelle
        this.activeSlot = newSlot;
        localStorage.setItem('viscora_active_slot', this.activeSlot);
        
        // Yeni slotun verilerini yükle
        const slotDataStr = localStorage.getItem('viscora_draft_slot_' + this.activeSlot);
        if (slotDataStr) {
            try {
                const data = JSON.parse(slotDataStr);
                // Haritayı yükle
                this.game.level.loadLevel(data, true);
                // Yedek PWA kaydıyla eşitle
                localStorage.setItem('viscora_custom_level_' + this.game.currentLevel, slotDataStr);
            } catch (err) {
                console.error("Error loading slot level:", err);
                this.clearLevel();
            }
        } else {
            // Yeni ve boş slot ise temizle
            this.clearLevel();
            const emptyData = this.getLevelDataObj();
            const emptyDataStr = JSON.stringify(emptyData);
            localStorage.setItem('viscora_draft_slot_' + this.activeSlot, emptyDataStr);
            localStorage.setItem('viscora_custom_level_' + this.game.currentLevel, emptyDataStr);
        }
        
        // UI alanlarını güncelle
        const nameEl = document.getElementById('editor-level-name');
        if (nameEl) nameEl.value = this.game.level.name || '';
        const authorEl = document.getElementById('editor-author-name');
        if (authorEl) authorEl.value = localStorage.getItem('viscora_author_name') || 'Tasarımcı';
        
        const widthEl = document.getElementById('editor-level-width');
        if (widthEl) widthEl.value = this.game.level.width;
        const heightEl = document.getElementById('editor-level-height');
        if (heightEl) heightEl.value = this.game.level.height;
        
        this.updateTagButtonsUI();
        this.selectedObject = null;
        this.selectedObjectType = '';
        this.updateInspector();
        
        // Slot butonlarındaki aktiflik sınıfını güncelle
        const slotButtons = this.panel.querySelectorAll('.slot-btn');
        slotButtons.forEach(btn => {
            const btnSlot = parseInt(btn.getAttribute('data-slot'));
            if (btnSlot === this.activeSlot) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        audio.playLand(); // Sesli geribildirim
    }

    /**
     * Müfettiş alanını seçili objeye göre günceller
     */
    updateInspector() {
        const container = document.getElementById('editor-inspector-content');
        if (!container) return;

        if (!this.selectedObject) {
            container.innerHTML = `<span style="color:#64748b; font-style:italic; font-size:12px;">Seçili obje yok.</span>`;
            return;
        }

        const obj = this.selectedObject;
        const type = this.selectedObjectType;

        let html = `<div style="font-size:13px; font-weight:bold; margin-bottom:10px; color:#10b981;">TÜR: ${type.toUpperCase()}</div>`;
        
        // Temel Boyutlar
        if (type !== 'spawn' && type !== 'portal' && type !== 'collectible' && type !== 'teleportPair' && type !== 'vantuzPoint' && type !== 'checkpoint' && type !== 'laserEmitter' && type !== 'laserReceiver') {
            html += `
                <div class="editor-input-group">
                    <label>X Konum</label>
                    <input type="number" id="inspect-x" value="${Math.round(obj.x)}">
                </div>
                <div class="editor-input-group">
                    <label>Y Konum</label>
                    <input type="number" id="inspect-y" value="${Math.round(obj.y)}">
                </div>
                <div class="editor-input-group">
                    <label>Genişlik (W)</label>
                    <input type="number" id="inspect-w" value="${Math.round(obj.w)}">
                </div>
                <div class="editor-input-group">
                    <label>Yükseklik (H)</label>
                    <input type="number" id="inspect-h" value="${Math.round(obj.h)}">
                </div>
            `;
        } else if (type === 'teleportPair') {
            html += `
                <div class="editor-input-group">
                    <label>Portal 1 X</label>
                    <input type="number" id="inspect-x1" value="${Math.round(obj.x1)}">
                </div>
                <div class="editor-input-group">
                    <label>Portal 1 Y</label>
                    <input type="number" id="inspect-y1" value="${Math.round(obj.y1)}">
                </div>
                <div class="editor-input-group">
                    <label>Portal 2 X</label>
                    <input type="number" id="inspect-x2" value="${Math.round(obj.x2)}">
                </div>
                <div class="editor-input-group">
                    <label>Portal 2 Y</label>
                    <input type="number" id="inspect-y2" value="${Math.round(obj.y2)}">
                </div>
            `;
        } else if (type === 'portal' || type === 'collectible' || type === 'vantuzPoint' || type === 'checkpoint' || type === 'laserEmitter' || type === 'laserReceiver') {
            html += `
                <div class="editor-input-group">
                    <label>X Konum</label>
                    <input type="number" id="inspect-x" value="${Math.round(obj.x)}">
                </div>
                <div class="editor-input-group">
                    <label>Y Konum</label>
                    <input type="number" id="inspect-y" value="${Math.round(obj.y)}">
                </div>
            `;
        } else if (type === 'spawn') {
            html += `
                <div class="editor-input-group">
                    <label>Spawn X</label>
                    <input type="number" id="inspect-spawn-x" value="${Math.round(this.game.level.spawnX)}">
                </div>
                <div class="editor-input-group">
                    <label>Spawn Y</label>
                    <input type="number" id="inspect-spawn-y" value="${Math.round(this.game.level.spawnY)}">
                </div>
            `;
        }

        // Objeye Özgü Ek Parametreler
        if (type === 'platform') {
            html += `
                <div class="editor-input-group">
                    <label>Yüzey Türü</label>
                    <select id="inspect-plat-type">
                        <option value="normal" ${obj.type === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="sticky" ${obj.type === 'sticky' ? 'selected' : ''}>Pembe Yapışkan</option>
                        <option value="slippery" ${obj.type === 'slippery' ? 'selected' : ''}>Mavi Kaygan</option>
                    </select>
                </div>
            `;
        } else if (type === 'movingPlatform') {
            html += `
                <div class="editor-input-group">
                    <label>Hedef X</label>
                    <input type="number" id="inspect-target-x" value="${Math.round(obj.targetX)}">
                </div>
                <div class="editor-input-group">
                    <label>Hedef Y</label>
                    <input type="number" id="inspect-target-y" value="${Math.round(obj.targetY)}">
                </div>
                <div class="editor-input-group">
                    <label>Hız Katsayısı</label>
                    <input type="number" step="0.001" id="inspect-speed" value="${obj.speed || 0.015}">
                </div>
                <div style="margin-top: 8px; display:flex; gap:5px;">
                    <button class="editor-btn" id="inspect-set-start-btn" style="flex:1; padding:4px; font-size:10px;">Mevcutu Başlangıç Yap</button>
                    <button class="editor-btn" id="inspect-set-target-btn" style="flex:1; padding:4px; font-size:10px;">Mevcutu Hedef Yap</button>
                </div>
            `;
        } else if (type === 'gate') {
            html += `
                <div class="editor-input-group">
                    <label>Bariyer Türü</label>
                    <select id="inspect-gate-type">
                        <option value="laser" ${obj.type === 'laser' ? 'selected' : ''}>Mavi Lazer</option>
                        <option value="pinkLaser" ${obj.type === 'pinkLaser' ? 'selected' : ''}>Pembe Lazer</option>
                        <option value="greenLaser" ${obj.type === 'greenLaser' ? 'selected' : ''}>Yeşil Lazer</option>
                        <option value="yellowLaser" ${obj.type === 'yellowLaser' ? 'selected' : ''}>Sarı Lazer</option>
                        <option value="net" ${obj.type === 'net' ? 'selected' : ''}>Mor Ağ Kapısı</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Bariyer ID</label>
                    <input type="number" id="inspect-gate-id" value="${obj.id || 101}">
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: -3px; margin-bottom: 8px; line-height: 1.2;">
                    * Tetikleyiciyi bu kapıya bağlamak için tetikleyicinin 'Bağlı Kapı ID' değerini bu ID ile eşleştirin.
                </div>
            `;
        } else if (type === 'enemy') {
            const isChaser = obj.type === 'chaser';
            const isTractor = obj.type === 'tractor_ufo';
            const isSweeper = obj.type === 'sweeper_ufo';
            const isPatrol = !isChaser && !isTractor && !isSweeper;
            html += `
                <div class="editor-input-group">
                    <label>Düşman Sınıfı</label>
                    <select id="inspect-enemy-type">
                        <option value="patrol" ${isPatrol ? 'selected' : ''}>Devriye (Normal)</option>
                        <option value="chaser" ${isChaser ? 'selected' : ''}>Jel Takipçi (🧬)</option>
                        <option value="tractor_ufo" ${isTractor ? 'selected' : ''}>Çekim UFO (🛸🧲)</option>
                        <option value="sweeper_ufo" ${isSweeper ? 'selected' : ''}>Lazer UFO (⚡🛸)</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Patrol Menzil</label>
                    <input type="number" id="inspect-enemy-range" value="${obj.rangeX || 150}">
                </div>
                <div class="editor-input-group">
                    <label>Devriye Hızı</label>
                    <input type="number" step="0.1" id="inspect-enemy-speed" value="${obj.speed !== undefined ? obj.speed : (isChaser ? 1.0 : (isTractor ? 1.0 : 1.2))}">
                </div>
            `;
            if (isPatrol) {
                html += `
                    <div class="editor-checkbox-group">
                        <input type="checkbox" id="inspect-enemy-vertical" ${obj.isVertical ? 'checked' : ''}>
                        <label for="inspect-enemy-vertical">Dikey Devriye</label>
                    </div>
                    <div class="editor-input-group">
                        <label>Renk</label>
                        <select id="inspect-enemy-color">
                            <option value="#f43f5e" ${obj.color === '#f43f5e' || !obj.color ? 'selected' : ''}>Kırmızı</option>
                            <option value="#06b6d4" ${obj.color === '#06b6d4' ? 'selected' : ''}>Mavi</option>
                            <option value="#d946ef" ${obj.color === '#d946ef' ? 'selected' : ''}>Mor/Pembe</option>
                            <option value="#eab308" ${obj.color === '#eab308' ? 'selected' : ''}>Sarı</option>
                        </select>
                    </div>
                `;
            } else if (isSweeper) {
                html += `
                    <div class="editor-input-group">
                        <label>Lazer Türü</label>
                        <select id="inspect-enemy-laser-type">
                            <option value="cyan" ${obj.laserType === 'cyan' || !obj.laserType ? 'selected' : ''}>Mavi Lazer (Mavi Form)</option>
                            <option value="pink" ${obj.laserType === 'pink' ? 'selected' : ''}>Pembe Lazer (Pembe Form)</option>
                            <option value="green" ${obj.laserType === 'green' ? 'selected' : ''}>Yeşil Lazer (Yeşil Form)</option>
                        </select>
                    </div>
                    <div style="font-size: 11px; color: #ff0055; margin-top: 5px; line-height: 1.3; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 5px;">
                        ℹ️ Lazer UFO 3 saniye lazer verir, 2 saniye beklemede kalır. Lazer rengiyle aynı viscosity formundaysanız hasar almazsınız!
                    </div>
                `;
            } else if (isChaser) {
                html += `
                    <div style="font-size: 11px; color: #34d399; margin-top: 5px; line-height: 1.3; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 5px;">
                        ℹ️ Jel Takipçi yeşil renkte devriye gezer, oyuncuyu 240px yakınına girdiğinde algılar ve 2.5 saniye şişip kovalayarak patlar!
                    </div>
                `;
            } else if (isTractor) {
                html += `
                    <div style="font-size: 11px; color: #c084fc; margin-top: 5px; line-height: 1.3; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 5px;">
                        ℹ️ Çekim UFO (Tractor UFO) oyuncuyu yavaşça yukarı doğru çeken bir çekim alanına sahiptir!
                    </div>
                `;
            } else if (isSweeper) {
                html += `
                    <div style="font-size: 11px; color: #22d3ee; margin-top: 5px; line-height: 1.3; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 5px;">
                        ℹ️ Lazer UFO (Sweeper UFO) dikey olarak zemine doğru periyodik elektrik lazeri ateşler!
                    </div>
                `;
            }
        } else if (type === 'collectible') {
            html += `
                <div class="editor-input-group">
                    <label>Renk</label>
                    <select id="inspect-collectible-color">
                        <option value="#eab308" ${obj.color === '#eab308' || !obj.color ? 'selected' : ''}>Altın (Sarı)</option>
                        <option value="#06b6d4" ${obj.color === '#06b6d4' ? 'selected' : ''}>Mavi</option>
                        <option value="#d946ef" ${obj.color === '#d946ef' ? 'selected' : ''}>Pembe</option>
                        <option value="#10b981" ${obj.color === '#10b981' ? 'selected' : ''}>Yeşil</option>
                        <option value="#f43f5e" ${obj.color === '#f43f5e' ? 'selected' : ''}>Kırmızı (Elmas)</option>
                    </select>
                </div>
            `;
        } else if (type === 'conveyor') {
            html += `
                <div class="editor-input-group">
                    <label>Yön</label>
                    <select id="inspect-conveyor-dir">
                        <option value="1" ${obj.direction === 1 ? 'selected' : ''}>Sağa</option>
                        <option value="-1" ${obj.direction === -1 ? 'selected' : ''}>Sola</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Hız</label>
                    <input type="number" step="0.1" id="inspect-conveyor-speed" value="${obj.speed || 1.5}">
                </div>
            `;
        } else if (type === 'bouncePad') {
            html += `
                <div class="editor-input-group">
                    <label>Zıplatma Gücü</label>
                    <input type="number" step="0.5" id="inspect-bounce-force" value="${obj.force || 12.0}">
                </div>
            `;
        } else if (type === 'teleportPair') {
            html += `
                <div class="editor-input-group">
                    <label>Portal Rengi</label>
                    <input type="color" id="inspect-teleport-color" value="${obj.color || '#a855f7'}">
                </div>
            `;
        } else if (type === 'pressurePlate' || type === 'button' || type === 'lever') {
            html += `
                <div class="editor-input-group">
                    <label>Bağlı Kapı ID</label>
                    <input type="number" id="inspect-trigger-gate" value="${obj.linkedGateId || 101}">
                </div>
                <div style="font-size: 10px; color: #64748b; margin-top: -3px; margin-bottom: 8px; line-height: 1.2;">
                    * Bu tetikleyici aktif olduğunda yukarıdaki ID'ye sahip olan kapı devre dışı bırakılır (açılır).
                </div>
            `;
        } else if (type === 'arrowShooter') {
            html += `
                <div class="editor-input-group">
                    <label>Atış Yönü</label>
                    <select id="inspect-arrow-dir">
                        <option value="right" ${obj.dir === 'right' ? 'selected' : ''}>Sağa ➡️</option>
                        <option value="left" ${obj.dir === 'left' ? 'selected' : ''}>Sola ⬅️</option>
                        <option value="up" ${obj.dir === 'up' ? 'selected' : ''}>Yukarı ⬆️</option>
                        <option value="down" ${obj.dir === 'down' ? 'selected' : ''}>Aşağı ⬇️</option>
                        <option value="target" ${obj.dir === 'target' ? 'selected' : ''}>🎯 Hedef Takip (360°)</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Algılama Yarıçapı (px)</label>
                    <input type="number" id="inspect-arrow-radius" value="${obj.detectionRadius !== undefined ? obj.detectionRadius : 200}">
                </div>
                <div class="editor-input-group">
                    <label>Atış Aralığı (sn)</label>
                    <input type="number" step="0.1" id="inspect-arrow-interval" value="${obj.fireInterval !== undefined ? obj.fireInterval : 2.5}">
                </div>
                <div class="editor-input-group">
                    <label>Ok Hızı</label>
                    <input type="number" step="0.5" id="inspect-arrow-speed" value="${obj.arrowSpeed !== undefined ? obj.arrowSpeed : 4.5}">
                </div>
                <div class="editor-input-group">
                    <label>Ok Menzili (px)</label>
                    <input type="number" id="inspect-arrow-range" value="${obj.arrowRange !== undefined ? obj.arrowRange : 400}">
                </div>
            `;
        } else if (type === 'flamethrower') {
            html += `
                <div class="editor-input-group">
                    <label>Alev Yönü</label>
                    <select id="inspect-flame-dir">
                        <option value="right" ${obj.dir === 'right' ? 'selected' : ''}>Sağa</option>
                        <option value="left" ${obj.dir === 'left' ? 'selected' : ''}>Sola</option>
                        <option value="up" ${obj.dir === 'up' ? 'selected' : ''}>Yukarı</option>
                        <option value="down" ${obj.dir === 'down' ? 'selected' : ''}>Aşağı</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Alev Menzili</label>
                    <input type="number" id="inspect-flame-range" value="${obj.range || 200}">
                </div>
                <div class="editor-input-group">
                    <label>Bağlantı ID (Tetikleme için)</label>
                    <input type="number" id="inspect-flame-id" value="${obj.id || 9001}">
                </div>
                <div class="editor-checkbox-group">
                    <input type="checkbox" id="inspect-flame-active" ${obj.active !== false ? 'checked' : ''}>
                    <label for="inspect-flame-active">Varsayılan Aktif (Alev Açık)</label>
                </div>
                <div class="editor-checkbox-group">
                    <input type="checkbox" id="inspect-flame-moving" ${obj.moving ? 'checked' : ''}>
                    <label for="inspect-flame-moving">Hareketli Cihaz</label>
                </div>
            `;
            if (obj.moving) {
                html += `
                    <div class="editor-input-group">
                        <label>Hareket Ekseni</label>
                        <select id="inspect-flame-move-axis">
                            <option value="y" ${obj.moveAxis === 'y' || !obj.moveAxis ? 'selected' : ''}>Dikey (Y)</option>
                            <option value="x" ${obj.moveAxis === 'x' ? 'selected' : ''}>Yatay (X)</option>
                        </select>
                    </div>
                    <div class="editor-input-group">
                        <label>Hareket Menzili</label>
                        <input type="number" id="inspect-flame-move-range" value="${obj.moveRange || 100}">
                    </div>
                    <div class="editor-input-group">
                        <label>Hareket Hızı</label>
                        <input type="number" step="0.1" id="inspect-flame-move-speed" value="${obj.moveSpeed || 1.5}">
                    </div>
                `;
            }
        } else if (type === 'hazard' && obj.type === 'spike') {
            html += `
                <div class="editor-input-group">
                    <label>Diken Yönü</label>
                    <select id="inspect-spike-dir">
                        <option value="up" ${obj.direction === 'up' || !obj.direction ? 'selected' : ''}>Yukarı (Yer)</option>
                        <option value="down" ${obj.direction === 'down' ? 'selected' : ''}>Aşağı (Tavan)</option>
                        <option value="left" ${obj.direction === 'left' ? 'selected' : ''}>Sola (Sağ Duvar)</option>
                        <option value="right" ${obj.direction === 'right' ? 'selected' : ''}>Sağa (Sol Duvar)</option>
                    </select>
                </div>
            `;
        } else if (type === 'decoration') {
            html += `
                <div class="editor-input-group">
                    <label>Süs Tipi</label>
                    <select id="inspect-deco-type">
                        <option value="neon_light" ${obj.type === 'neon_light' ? 'selected' : ''}>Neon Işık</option>
                        <option value="textbox" ${obj.type === 'textbox' ? 'selected' : ''}>Yazı Kutusu (Text)</option>
                        <option value="box" ${obj.type === 'box' ? 'selected' : ''}>Kutu</option>
                        <option value="pipe" ${obj.type === 'pipe' ? 'selected' : ''}>Boru</option>
                        <option value="cable" ${obj.type === 'cable' ? 'selected' : ''}>Kablo</option>
                        <option value="pano" ${obj.type === 'pano' ? 'selected' : ''}>Pano</option>
                        <option value="fan" ${obj.type === 'fan' ? 'selected' : ''}>Fan</option>
                        <option value="warning_light" ${obj.type === 'warning_light' ? 'selected' : ''}>Arıza Işığı</option>
                        <option value="steam" ${obj.type === 'steam' ? 'selected' : ''}>Sis / Buhar</option>
                        <option value="pillar" ${obj.type === 'pillar' ? 'selected' : ''}>Sütun (Pillar)</option>
                        <option value="gear" ${obj.type === 'gear' ? 'selected' : ''}>Dişli (Gear)</option>
                        <option value="window_space" ${obj.type === 'window_space' ? 'selected' : ''}>Pencere (Window)</option>
                        <option value="server_rack" ${obj.type === 'server_rack' ? 'selected' : ''}>Sunucu Konsolu (Server Rack)</option>
                    </select>
                </div>
            `;
            
            if (obj.type === 'textbox') {
                html += `
                    <div class="editor-input-group">
                        <label>Yazı Metni</label>
                        <input type="text" id="inspect-deco-text" value="${obj.text || ''}">
                    </div>
                    <div class="editor-input-group">
                        <label>Neon Rengi</label>
                        <select id="inspect-deco-color">
                            <option value="#06b6d4" ${obj.color === '#06b6d4' || !obj.color ? 'selected' : ''}>Siyan (Mavi)</option>
                            <option value="#d946ef" ${obj.color === '#d946ef' ? 'selected' : ''}>Fuşya (Pembe)</option>
                            <option value="#10b981" ${obj.color === '#10b981' ? 'selected' : ''}>Yeşil</option>
                            <option value="#eab308" ${obj.color === '#eab308' ? 'selected' : ''}>Sarı</option>
                        </select>
                    </div>
                `;
            }

            const rotDegrees = Math.round((obj.rotation || 0) * (180 / Math.PI));
            html += `
                <div class="editor-input-group" style="margin-top: 8px;">
                    <label>Rotasyon</label>
                    <div style="flex: 1; display: flex; gap: 5px;">
                        <input type="text" readonly id="inspect-deco-rotation-text" value="${rotDegrees}°" style="width: 50px; text-align: center; background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 11px;">
                        <button class="editor-btn" id="inspect-deco-rotate-btn" style="flex: 1; padding: 2px 5px; font-size: 11px;">90° Döndür 🔄</button>
                    </div>
                </div>
            `;
        } else if (type === 'laserEmitter') {
            html += `
                <div class="editor-input-group">
                    <label>Lazer Yönü</label>
                    <select id="inspect-laser-emitter-dir">
                        <option value="0" ${obj.direction === 0 ? 'selected' : ''}>Sağa (Right)</option>
                        <option value="1" ${obj.direction === 1 ? 'selected' : ''}>Aşağı (Down)</option>
                        <option value="2" ${obj.direction === 2 ? 'selected' : ''}>Sola (Left)</option>
                        <option value="3" ${obj.direction === 3 ? 'selected' : ''}>Yukarı (Up)</option>
                    </select>
                </div>
                <div class="editor-input-group">
                    <label>Lazer Rengi</label>
                    <select id="inspect-laser-emitter-color">
                        <option value="blue" ${obj.color === 'blue' ? 'selected' : ''}>Mavi (Sıvı Geçer)</option>
                        <option value="pink" ${obj.color === 'pink' ? 'selected' : ''}>Pembe (Jel Geçer)</option>
                        <option value="green" ${obj.color === 'green' ? 'selected' : ''}>Yeşil (Normal Geçer)</option>
                        <option value="yellow" ${obj.color === 'yellow' ? 'selected' : ''}>Sarı (Ölümcül)</option>
                    </select>
                </div>
            `;
        } else if (type === 'laserReceiver') {
            html += `
                <div class="editor-input-group">
                    <label>Bağlı Kapı ID</label>
                    <input type="number" id="inspect-laser-receiver-gate" value="${obj.linkedGateId || 101}">
                </div>
            `;
        } else if (type === 'staticMirror') {
            html += `
                <div class="editor-input-group">
                    <label>Köşe Konumu</label>
                    <select id="inspect-static-mirror-type">
                        <option value="top-left" ${obj.mirrorType === 'top-left' || obj.mirrorType === 'slash' ? 'selected' : ''}>Sol-Üst (/) (Top-Left)</option>
                        <option value="top-right" ${obj.mirrorType === 'top-right' || obj.mirrorType === 'backslash' ? 'selected' : ''}>Sağ-Üst (\\) (Top-Right)</option>
                        <option value="bottom-left" ${obj.mirrorType === 'bottom-left' ? 'selected' : ''}>Sol-Alt (\\) (Bottom-Left)</option>
                        <option value="bottom-right" ${obj.mirrorType === 'bottom-right' ? 'selected' : ''}>Sağ-Alt (/) (Bottom-Right)</option>
                    </select>
                </div>
            `;
        } else if (type === 'pushBlock') {
            html += `
                <div class="editor-checkbox-group">
                    <input type="checkbox" id="inspect-block-mirror" ${obj.isMirror ? 'checked' : ''}>
                    <label for="inspect-block-mirror">Yansıtıcı Ayna (Mirror)</label>
                </div>
                <div class="editor-input-group" id="inspect-block-mirror-type-container" style="display: ${obj.isMirror ? 'block' : 'none'};">
                    <label>Ayna Yönü</label>
                    <select id="inspect-block-mirror-type">
                        <option value="slash" ${obj.mirrorType === 'slash' ? 'selected' : ''}>Slash (/) (Sağ-Yukarı / Sol-Aşağı)</option>
                        <option value="backslash" ${obj.mirrorType === 'backslash' ? 'selected' : ''}>Backslash (\\) (Sağ-Aşağı / Sol-Yukarı)</option>
                    </select>
                </div>
            `;
        }

        html += `<button class="editor-btn danger" id="inspect-delete-btn" style="width:100%; margin-top:12px;">🔴 OBJEYİ SİL (DEL)</button>`;

        container.innerHTML = html;

        // Olay Dinleyicileri Ekle
        const deleteBtn = document.getElementById('inspect-delete-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteSelected());

        // Değer Değişimlerini Kaydet
        const addUpdateEvent = (elementId, callback) => {
            const el = document.getElementById(elementId);
            if (el) {
                const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
                el.addEventListener(eventType, (e) => {
                    callback(e.target.value);
                    this.saveToLocalStorage(); // Auto-save on change!
                });
                
                // Track focus/blur explicitly to disable key shortcuts
                el.addEventListener('focus', () => {
                    this.inputFocused = true;
                });
                el.addEventListener('blur', (e) => {
                    this.inputFocused = false;
                    // On blur, update the input value with the actual clamped value
                    if (el.tagName === 'INPUT') {
                        const finalVal = callback(e.target.value);
                        if (finalVal !== undefined && finalVal !== null) {
                            el.value = finalVal;
                        }
                    }
                });
            }
        };

        if (type !== 'spawn' && type !== 'teleportPair') {
            addUpdateEvent('inspect-x', (val) => { 
                const xVal = parseInt(val) || 0;
                obj.x = Math.max(-5000, Math.min(xVal, 25000)); 
                if(obj.startX !== undefined) obj.startX = obj.x; 
                return obj.x;
            });
            addUpdateEvent('inspect-y', (val) => { 
                const yVal = parseInt(val) || 0;
                obj.y = Math.max(-5000, Math.min(yVal, 15000)); 
                if(obj.startY !== undefined) obj.startY = obj.y; 
                return obj.y;
            });
            addUpdateEvent('inspect-w', (val) => { 
                const wVal = parseInt(val) || 4;
                obj.w = Math.max(4, Math.min(wVal, 3000)); 
                return obj.w;
            });
            addUpdateEvent('inspect-h', (val) => { 
                const hVal = parseInt(val) || 4;
                obj.h = Math.max(4, Math.min(hVal, 3000)); 
                return obj.h;
            });
        } else if (type === 'teleportPair') {
            addUpdateEvent('inspect-x1', (val) => { obj.x1 = Math.max(-5000, Math.min(parseInt(val) || 0, 25000)); return obj.x1; });
            addUpdateEvent('inspect-y1', (val) => { obj.y1 = Math.max(-5000, Math.min(parseInt(val) || 0, 15000)); return obj.y1; });
            addUpdateEvent('inspect-x2', (val) => { obj.x2 = Math.max(-5000, Math.min(parseInt(val) || 0, 25000)); return obj.x2; });
            addUpdateEvent('inspect-y2', (val) => { obj.y2 = Math.max(-5000, Math.min(parseInt(val) || 0, 15000)); return obj.y2; });
        } else {
            addUpdateEvent('inspect-spawn-x', (val) => { this.game.level.spawnX = Math.max(0, Math.min(parseInt(val) || 80, 25000)); return this.game.level.spawnX; });
            addUpdateEvent('inspect-spawn-y', (val) => { this.game.level.spawnY = Math.max(0, Math.min(parseInt(val) || 350, 15000)); return this.game.level.spawnY; });
        }

        addUpdateEvent('inspect-spike-dir', (val) => {
            const oldDir = obj.direction || 'up';
            const newDir = val;
            obj.direction = newDir;

            const wasHorizontal = (oldDir === 'up' || oldDir === 'down');
            const isHorizontal = (newDir === 'up' || newDir === 'down');

            if (wasHorizontal !== isHorizontal) {
                const temp = obj.w;
                obj.w = obj.h;
                obj.h = temp;
            }
            this.updateInspector();
        });

        addUpdateEvent('inspect-deco-type', (val) => {
            obj.type = val;
            if (val === 'neon_light') { obj.w = 20; obj.h = 80; }
            else if (val === 'textbox') { obj.w = 200; obj.h = 80; }
            else if (val === 'box') { obj.w = 40; obj.h = 40; }
            else if (val === 'pipe') { obj.w = 80; obj.h = 20; }
            else if (val === 'cable') { obj.w = 80; obj.h = 40; }
            else if (val === 'pano') { obj.w = 50; obj.h = 40; }
            else if (val === 'warning_light' || val === 'steam') { obj.w = 32; obj.h = 32; }
            else if (val === 'pillar') { obj.w = 32; obj.h = 120; }
            else if (val === 'gear') { obj.w = 40; obj.h = 40; }
            else if (val === 'window_space') { obj.w = 60; obj.h = 60; }
            else if (val === 'server_rack') { obj.w = 40; obj.h = 60; }
            this.updateInspector();
        });

        if (type === 'decoration') {
            addUpdateEvent('inspect-deco-text', (val) => {
                if (isOffensive(val)) {
                    alert('Yazı kutusu içeriği uygunsuz veya küfürlü içerik içeremez!');
                    const input = document.getElementById('inspect-deco-text');
                    if (input) input.value = obj.text || '';
                    return obj.text || '';
                }
                obj.text = val;
                return val;
            });
            
            addUpdateEvent('inspect-deco-color', (val) => {
                obj.color = val;
                return val;
            });
            
            const rotateBtn = document.getElementById('inspect-deco-rotate-btn');
            if (rotateBtn) {
                rotateBtn.addEventListener('click', () => {
                    obj.rotation = (obj.rotation || 0) + Math.PI / 2;
                    if (obj.rotation >= Math.PI * 2) {
                        obj.rotation = 0;
                    }
                    obj.startRotation = obj.rotation;
                    const deg = Math.round(obj.rotation * (180 / Math.PI));
                    const rotText = document.getElementById('inspect-deco-rotation-text');
                    if (rotText) rotText.value = deg + "°";
                    this.saveToLocalStorage();
                });
            }
        }

        addUpdateEvent('inspect-plat-type', (val) => { 
            obj.type = val; 
            if (val === 'sticky') { obj.sticky = true; obj.slippery = false; }
            else if (val === 'slippery') { obj.sticky = false; obj.slippery = true; }
            else { obj.sticky = false; obj.slippery = false; }
        });

        addUpdateEvent('inspect-target-x', (val) => { obj.targetX = Math.max(-5000, Math.min(parseInt(val) || 0, 25000)); return obj.targetX; });
        addUpdateEvent('inspect-target-y', (val) => { obj.targetY = Math.max(-5000, Math.min(parseInt(val) || 0, 15000)); return obj.targetY; });
        addUpdateEvent('inspect-speed', (val) => { obj.speed = Math.max(0.001, Math.min(parseFloat(val) || 0.015, 0.5)); return obj.speed; });
        
        const setStartBtn = document.getElementById('inspect-set-start-btn');
        if (setStartBtn) {
            setStartBtn.addEventListener('click', () => {
                obj.startX = obj.x;
                obj.startY = obj.y;
                alert('Platform başlangıç noktası olarak güncellendi.');
                this.saveToLocalStorage(); // Auto-save start pos
            });
        }
        const setTargetBtn = document.getElementById('inspect-set-target-btn');
        if (setTargetBtn) {
            setTargetBtn.addEventListener('click', () => {
                obj.targetX = obj.x;
                obj.targetY = obj.y;
                alert('Platform hedef noktası olarak güncellendi.');
                this.updateInspector();
                this.saveToLocalStorage(); // Auto-save target pos
            });
        }

        addUpdateEvent('inspect-gate-type', (val) => { obj.type = val; });
        addUpdateEvent('inspect-gate-id', (val) => { obj.id = parseInt(val) || 101; return obj.id; });

        addUpdateEvent('inspect-enemy-type', (val) => {
            obj.type = val;
            if (val === 'chaser') {
                obj.color = '#10b981';
                obj.isVertical = false;
            } else if (val === 'tractor_ufo') {
                obj.color = '#a855f7';
                obj.isVertical = false;
            } else if (val === 'sweeper_ufo') {
                obj.color = '#06b6d4';
                obj.isVertical = false;
            }
            this.updateInspector();
        });

        addUpdateEvent('inspect-enemy-range', (val) => { obj.rangeX = Math.max(10, Math.min(parseInt(val) || 150, 2500)); return obj.rangeX; });
        addUpdateEvent('inspect-enemy-speed', (val) => { obj.speed = Math.max(0.1, Math.min(parseFloat(val) || 1.2, 10.0)); return obj.speed; });
        
        const enemyVert = document.getElementById('inspect-enemy-vertical');
        if (enemyVert) {
            enemyVert.addEventListener('change', () => {
                obj.isVertical = enemyVert.checked;
                this.saveToLocalStorage();
            });
        }
        addUpdateEvent('inspect-enemy-color', (val) => { obj.color = val; return val; });
        addUpdateEvent('inspect-enemy-laser-type', (val) => { obj.laserType = val; });
        addUpdateEvent('inspect-collectible-color', (val) => { obj.color = val; return val; });
        addUpdateEvent('inspect-conveyor-dir', (val) => { obj.direction = parseInt(val) || 1; return obj.direction; });
        addUpdateEvent('inspect-conveyor-speed', (val) => { obj.speed = Math.max(0.1, Math.min(parseFloat(val) || 1.5, 15.0)); return obj.speed; });
        addUpdateEvent('inspect-bounce-force', (val) => { obj.force = Math.max(1.0, Math.min(parseFloat(val) || 12.0, 40.0)); return obj.force; });
        addUpdateEvent('inspect-teleport-color', (val) => { obj.color = val; return val; });
        addUpdateEvent('inspect-trigger-gate', (val) => { obj.linkedGateId = parseInt(val) || 101; return obj.linkedGateId; });

        addUpdateEvent('inspect-flame-dir', (val) => { obj.dir = val; });
        addUpdateEvent('inspect-flame-range', (val) => { obj.range = Math.max(10, Math.min(parseInt(val) || 200, 2000)); return obj.range; });
        addUpdateEvent('inspect-flame-id', (val) => { obj.id = parseInt(val) || 9001; return obj.id; });
        
        const flameActive = document.getElementById('inspect-flame-active');
        if (flameActive) {
            flameActive.addEventListener('change', () => {
                obj.active = flameActive.checked;
                this.saveToLocalStorage();
            });
        }

        const flameMoving = document.getElementById('inspect-flame-moving');
        if (flameMoving) {
            flameMoving.addEventListener('change', () => {
                obj.moving = flameMoving.checked;
                if (obj.moving) {
                    obj.moveRange = obj.moveRange || 100;
                    obj.moveSpeed = obj.moveSpeed || 1.5;
                    obj.moveAxis = obj.moveAxis || 'y';
                    obj.startX = obj.startX !== undefined ? obj.startX : obj.x;
                    obj.startY = obj.startY !== undefined ? obj.startY : obj.y;
                }
                this.updateInspector();
                this.saveToLocalStorage();
            });
        }

        addUpdateEvent('inspect-flame-move-axis', (val) => { obj.moveAxis = val; });
        addUpdateEvent('inspect-flame-move-range', (val) => { obj.moveRange = Math.max(10, Math.min(parseInt(val) || 100, 2000)); return obj.moveRange; });
        addUpdateEvent('inspect-flame-move-speed', (val) => { obj.moveSpeed = Math.max(0.1, Math.min(parseFloat(val) || 1.5, 15.0)); return obj.moveSpeed; });

        addUpdateEvent('inspect-arrow-dir', (val) => { obj.dir = val; });
        addUpdateEvent('inspect-arrow-radius', (val) => { obj.detectionRadius = Math.max(10, Math.min(parseInt(val) || 200, 1500)); return obj.detectionRadius; });
        addUpdateEvent('inspect-arrow-interval', (val) => { obj.fireInterval = Math.max(0.2, Math.min(parseFloat(val) || 2.5, 15.0)); return obj.fireInterval; });
        addUpdateEvent('inspect-arrow-speed', (val) => { obj.arrowSpeed = Math.max(0.5, Math.min(parseFloat(val) || 4.5, 25.0)); return obj.arrowSpeed; });
        addUpdateEvent('inspect-arrow-range', (val) => { obj.arrowRange = Math.max(10, Math.min(parseInt(val) || 400, 3000)); return obj.arrowRange; });

        addUpdateEvent('inspect-laser-emitter-dir', (val) => { obj.direction = parseInt(val) || 0; return obj.direction; });
        addUpdateEvent('inspect-laser-emitter-color', (val) => { obj.color = val; return val; });
        addUpdateEvent('inspect-laser-receiver-gate', (val) => { obj.linkedGateId = parseInt(val) || 101; return obj.linkedGateId; });

        const blockMirror = document.getElementById('inspect-block-mirror');
        if (blockMirror) {
            blockMirror.addEventListener('change', () => {
                obj.isMirror = blockMirror.checked;
                const container = document.getElementById('inspect-block-mirror-type-container');
                if (container) {
                    container.style.display = blockMirror.checked ? 'block' : 'none';
                }
                this.saveToLocalStorage();
            });
        }
        addUpdateEvent('inspect-block-mirror-type', (val) => { obj.mirrorType = val; });
        addUpdateEvent('inspect-static-mirror-type', (val) => { obj.mirrorType = val; });
        this.updateCapacityUI();
    }

    updateCapacityUI() {
        const lvl = this.game.level;
        if (!lvl) return;

        // Platforms: platforms, fallingPlatforms, breakablePlatforms, movingPlatforms, conveyors
        const platformCount = (lvl.platforms ? lvl.platforms.length : 0) +
                              (lvl.fallingPlatforms ? lvl.fallingPlatforms.length : 0) +
                              (lvl.breakablePlatforms ? lvl.breakablePlatforms.length : 0) +
                              (lvl.movingPlatforms ? lvl.movingPlatforms.length : 0) +
                              (lvl.conveyors ? lvl.conveyors.length : 0);

        // Hazards: spikes/hazards (except acid), acidPools, flamethrowers, fallingBlockTraps, arrowShooters
        const spikeCount = lvl.hazards ? lvl.hazards.filter(h => h.type === 'spike').length : 0;
        const acidCount = lvl.hazards ? lvl.hazards.filter(h => h.type === 'acid').length : 0;
        const flameCount = lvl.flamethrowers ? lvl.flamethrowers.length : 0;
        const fallingTrapCount = lvl.fallingBlockTraps ? lvl.fallingBlockTraps.length : 0;
        const shooterCount = lvl.arrowShooters ? lvl.arrowShooters.length : 0;
        const hazardCount = spikeCount + acidCount + flameCount + fallingTrapCount + shooterCount;

        // Lasers: laser gates, laserEmitters, laserReceivers
        const laserGateCount = lvl.gates ? lvl.gates.filter(g => g.type === 'laser' || g.type === 'pinkLaser' || g.type === 'greenLaser' || g.type === 'yellowLaser').length : 0;
        const laserEmitterCount = lvl.laserEmitters ? lvl.laserEmitters.length : 0;
        const laserReceiverCount = lvl.laserReceivers ? lvl.laserReceivers.length : 0;
        const laserCount = laserGateCount + laserEmitterCount + laserReceiverCount;

        // Mirrors: pushBlocks, staticMirrors
        const mirrorCount = (lvl.pushBlocks ? lvl.pushBlocks.length : 0) +
                            (lvl.staticMirrors ? lvl.staticMirrors.length : 0);

        // Enemies
        const enemyCount = lvl.enemies ? lvl.enemies.length : 0;

        const elPlatforms = document.getElementById('capacity-platforms');
        const elHazards = document.getElementById('capacity-hazards');
        const elLasers = document.getElementById('capacity-lasers');
        const elMirrors = document.getElementById('capacity-mirrors');
        const elEnemies = document.getElementById('capacity-enemies');

        if (elPlatforms) {
            elPlatforms.textContent = `${platformCount}/200`;
            elPlatforms.style.color = platformCount > 200 ? '#ef4444' : (platformCount > 160 ? '#eab308' : '#10b981');
        }
        if (elHazards) {
            elHazards.textContent = `${hazardCount}/100`;
            elHazards.style.color = hazardCount > 100 ? '#ef4444' : (hazardCount > 80 ? '#eab308' : '#10b981');
        }
        if (elLasers) {
            elLasers.textContent = `${laserCount}/40`;
            elLasers.style.color = laserCount > 40 ? '#ef4444' : (laserCount > 32 ? '#eab308' : '#10b981');
        }
        if (elMirrors) {
            elMirrors.textContent = `${mirrorCount}/45`;
            elMirrors.style.color = mirrorCount > 45 ? '#ef4444' : (mirrorCount > 36 ? '#eab308' : '#10b981');
        }
        if (elEnemies) {
            elEnemies.textContent = `${enemyCount}/40`;
            elEnemies.style.color = enemyCount > 40 ? '#ef4444' : (enemyCount > 32 ? '#eab308' : '#10b981');
        }
    }

    /**
     * Seçili objeyi siler
     */
    deleteSelected() {
        if (!this.selectedObject) return;
        const lvl = this.game.level;
        const obj = this.selectedObject;

        if (this.selectedObjectType === 'platform') {
            lvl.platforms = lvl.platforms.filter(p => p !== obj);
        } else if (this.selectedObjectType === 'hazard') {
            lvl.hazards = lvl.hazards.filter(h => h !== obj);
        } else if (this.selectedObjectType === 'movingPlatform') {
            lvl.movingPlatforms = lvl.movingPlatforms.filter(p => p !== obj);
        } else if (this.selectedObjectType === 'gate') {
            lvl.gates = lvl.gates.filter(g => g !== obj);
        } else if (this.selectedObjectType === 'collectible') {
            lvl.collectibles = lvl.collectibles.filter(c => c !== obj);
        } else if (this.selectedObjectType === 'enemy') {
            lvl.enemies = lvl.enemies.filter(e => e !== obj);
        } else if (this.selectedObjectType === 'pressurePlate') {
            lvl.pressurePlates = lvl.pressurePlates.filter(pp => pp !== obj);
        } else if (this.selectedObjectType === 'pushBlock') {
            lvl.pushBlocks = lvl.pushBlocks.filter(pb => pb !== obj);
        } else if (this.selectedObjectType === 'conveyor') {
            lvl.conveyors = lvl.conveyors.filter(c => c !== obj);
        } else if (this.selectedObjectType === 'bouncePad') {
            lvl.bouncePads = lvl.bouncePads.filter(bp => bp !== obj);
        } else if (this.selectedObjectType === 'teleportPair') {
            lvl.teleportPairs = lvl.teleportPairs.filter(tp => tp !== obj);
        } else if (this.selectedObjectType === 'button') {
            lvl.buttons = lvl.buttons.filter(b => b !== obj);
        } else if (this.selectedObjectType === 'lever') {
            lvl.levers = lvl.levers.filter(l => l !== obj);
        } else if (this.selectedObjectType === 'arrowShooter') {
            lvl.arrowShooters = (lvl.arrowShooters || []).filter(a => a !== obj);
        } else if (this.selectedObjectType === 'flamethrower') {
            lvl.flamethrowers = (lvl.flamethrowers || []).filter(f => f !== obj);
        } else if (this.selectedObjectType === 'fallingPlatform') {
            lvl.fallingPlatforms = lvl.fallingPlatforms.filter(fp => fp !== obj);
        } else if (this.selectedObjectType === 'breakablePlatform') {
            lvl.breakablePlatforms = lvl.breakablePlatforms.filter(bp => bp !== obj);
        } else if (this.selectedObjectType === 'hiddenPassage') {
            lvl.hiddenPassages = lvl.hiddenPassages.filter(hp => hp !== obj);
        } else if (this.selectedObjectType === 'fallingBlockTrap') {
            lvl.fallingBlockTraps = lvl.fallingBlockTraps.filter(fbt => fbt !== obj);
        } else if (this.selectedObjectType === 'vantuzPoint') {
            lvl.vantuzPoints = lvl.vantuzPoints.filter(vp => vp !== obj);
        } else if (this.selectedObjectType === 'laserEmitter') {
            lvl.laserEmitters = (lvl.laserEmitters || []).filter(e => e !== obj);
        } else if (this.selectedObjectType === 'laserReceiver') {
            lvl.laserReceivers = (lvl.laserReceivers || []).filter(r => r !== obj);
        } else if (this.selectedObjectType === 'staticMirror') {
            lvl.staticMirrors = (lvl.staticMirrors || []).filter(m => m !== obj);
        } else if (this.selectedObjectType === 'decoration') {
            lvl.decorations = lvl.decorations.filter(d => d !== obj);
        } else if (this.selectedObjectType === 'checkpoint') {
            lvl.checkpoints = lvl.checkpoints.filter(cp => cp !== obj);
        } else if (this.selectedObjectType === 'portal') {
            alert('Bitiş portalı silinemez. Sadece yerini değiştirebilirsiniz.');
            return;
        } else if (this.selectedObjectType === 'spawn') {
            alert('Oyuncu başlangıç noktası silinemez. Sadece yerini değiştirebilirsiniz.');
            return;
        }

        this.selectedObject = null;
        this.selectedObjectType = '';
        this.updateInspector();
        this.saveToLocalStorage(); // Auto-save after delete
        audio.playDamage(); // Silme efekti sesi
    }

    /**
     * Playtest modunu başlatır
     */
    startPlaytest() {
        audio.playCollect();
        // Editor panelini geçici olarak gizle
        this.panel.style.display = 'none';

        const tip = document.createElement('div');
        tip.id = 'editor-playtest-tip';
        tip.style.position = 'fixed';
        tip.style.top = '10px';
        tip.style.left = '50%';
        tip.style.transform = 'translateX(-50%)';
        tip.style.background = 'rgba(15, 23, 42, 0.95)';
        tip.style.color = '#10b981';
        tip.style.padding = '6px 16px';
        tip.style.borderRadius = '30px';
        tip.style.fontSize = '12px';
        tip.style.fontWeight = 'bold';
        tip.style.border = '1px solid #10b981';
        tip.style.zIndex = '999999';
        tip.style.display = 'flex';
        tip.style.alignItems = 'center';
        tip.style.justifyContent = 'center';
        tip.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)';
        
        tip.innerHTML = `
            <span>🎮 PLAYTEST MODU (ESC / T)</span>
            <button id="editor-playtest-exit-btn" style="
                background: linear-gradient(135deg, #f43f5e 0%, #be123c 100%);
                color: #fff;
                border: none;
                padding: 6px 14px;
                border-radius: 20px;
                font-weight: 800;
                font-size: 11px;
                cursor: pointer;
                margin-left: 14px;
                box-shadow: 0 0 10px rgba(244, 63, 94, 0.4);
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: inherit;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                transition: transform 0.1s ease;
            ">🛑 TESTİ BİTİR</button>
        `;
        document.body.appendChild(tip);

        // Bind touch and click to exit playtest
        const exitBtn = document.getElementById('editor-playtest-exit-btn');
        if (exitBtn) {
            exitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopPlaytest();
            });
            exitBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stopPlaytest();
            }, { passive: false });
        }

        // Reset level state first
        this.game.level.resetLevelRuntimeState();

        // Seviye ve Düşmanları yükle
        this.game.state = 'PLAYING';
        this.game.currentLevel = 999;
        this.game.boss = null;
        document.getElementById('hud').classList.remove('hidden');

        // Mobil/Dokunmatik cihaz ise yön tuşlarını göster
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isTouchDevice || window.innerWidth < 1024) {
            const mobileControls = document.getElementById('mobile-controls');
            if (mobileControls) mobileControls.classList.remove('hidden');
        }

        // Düşmanları başlat
        this.game.enemies = [];
        if (this.game.level.enemies) {
            this.game.enemies = this.game.level.enemies.map(e => {
                if (e.type === 'chaser') {
                    return new GelChaser(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.0, e.color || '#10b981');
                } else if (e.type === 'tractor_ufo') {
                    return new TractorUFO(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.0);
                } else if (e.type === 'sweeper_ufo') {
                    return new SweeperUFO(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.2, e.laserType);
                } else {
                    return new Enemy(e.x, e.y, e.rangeX !== undefined ? e.rangeX : 150, e.speed !== undefined ? e.speed : 1.2, !!e.isVertical, e.color || '#f43f5e');
                }
            });
        }

        // Oyuncuyu canlandır
        this.game.player.respawn(this.game.level.spawnX, this.game.level.spawnY);
        this.game.ui.updateHUDHealth(this.game.player.health);
        this.game.ui.updateHUDViscosity(this.game.player.viscosity);
    }

    /**
     * Playtest modundan çıkıp editöre geri döner
     */
    stopPlaytest() {
        this.game.state = 'EDITOR';
        this.hideAllScreens();
        
        const tip = document.getElementById('editor-playtest-tip');
        if (tip) tip.remove();

        // Playtest bittiğinde yön tuşlarını gizle
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.classList.add('hidden');

        this.panel.style.display = 'flex';
        this.game.enemies = [];
        this.game.particles = [];
        this.game.splatters = [];
        
        // Reset level state back to pristine editor state
        this.game.level.resetLevelRuntimeState();

        // Kamerayı başlangıca odakla
        this.game.camera.x = Math.max(0, this.game.level.spawnX - this.game.cssWidth / 2);
        this.game.camera.y = Math.max(0, this.game.level.spawnY - this.game.cssHeight / 2);
    }

    /**
     * Seviyedeki tüm elemanları bir JSON nesnesi olarak derler
     */
    getLevelDataObj() {
        const lvl = this.game.level;
        
        const platforms = lvl.platforms.map(p => ({
            x: Math.round(p.x),
            y: Math.round(p.y),
            w: Math.round(p.w),
            h: Math.round(p.h),
            type: p.type || 'normal'
        }));

        const spikes = lvl.hazards
            .filter(h => h.type === 'spike')
            .map(h => ({ x: Math.round(h.x), y: Math.round(h.y), w: Math.round(h.w), h: Math.round(h.h), direction: h.direction || 'up' }));

        const acidPools = lvl.hazards
            .filter(h => h.type === 'acid')
            .map(h => ({ x: Math.round(h.x), y: Math.round(h.y), w: Math.round(h.w), h: Math.round(h.h) }));

        const lasers = lvl.gates
            .filter(g => g.type === 'laser' || g.type === 'pinkLaser' || g.type === 'greenLaser' || g.type === 'yellowLaser')
            .map(g => ({
                x: Math.round(g.x),
                y: Math.round(g.y),
                w: Math.round(g.w),
                h: Math.round(g.h),
                type: g.type,
                id: g.id
            }));

        const netGates = lvl.gates
            .filter(g => g.type === 'net')
            .map(g => ({ x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.w), h: Math.round(g.h), id: g.id }));

        const movingPlatforms = lvl.movingPlatforms.map(p => ({
            startX: Math.round(p.startX),
            startY: Math.round(p.startY),
            targetX: Math.round(p.targetX),
            targetY: Math.round(p.targetY),
            w: Math.round(p.w),
            h: Math.round(p.h),
            speed: p.speed || 0.015
        }));

        const crystals = lvl.collectibles.map(c => ({ x: Math.round(c.x), y: Math.round(c.y), color: c.color || '#eab308' }));

        const enemies = lvl.enemies.map(e => ({
            x: Math.round(e.x),
            y: Math.round(e.y),
            rangeX: Math.round(e.rangeX || 120),
            speed: e.speed || 1.2,
            isVertical: !!e.isVertical,
            color: e.color || '#f43f5e',
            type: e.type || 'patrol'
        }));

        const pressurePlates = (lvl.pressurePlates || []).map(pp => ({
            x: Math.round(pp.x),
            y: Math.round(pp.y),
            w: Math.round(pp.w),
            h: Math.round(pp.h),
            linkedGateId: pp.linkedGateId
        }));

        const pushBlocks = (lvl.pushBlocks || []).map(pb => ({
            x: Math.round(pb.startX !== undefined ? pb.startX : pb.x),
            y: Math.round(pb.startY !== undefined ? pb.startY : pb.y),
            w: Math.round(pb.w),
            h: Math.round(pb.h),
            startX: Math.round(pb.startX !== undefined ? pb.startX : pb.x),
            startY: Math.round(pb.startY !== undefined ? pb.startY : pb.y),
            isMirror: pb.isMirror || false,
            mirrorType: pb.mirrorType || 'slash'
        }));

        const conveyors = (lvl.conveyors || []).map(c => ({
            x: Math.round(c.x),
            y: Math.round(c.y),
            w: Math.round(c.w),
            h: Math.round(c.h),
            direction: c.direction,
            speed: c.speed
        }));

        const teleportPairs = (lvl.teleportPairs || []).map(tp => ({
            x1: Math.round(tp.x1),
            y1: Math.round(tp.y1),
            x2: Math.round(tp.x2),
            y2: Math.round(tp.y2),
            color: tp.color || '#a855f7'
        }));

        const bouncePads = (lvl.bouncePads || []).map(bp => ({
            x: Math.round(bp.x),
            y: Math.round(bp.y),
            w: Math.round(bp.w),
            h: Math.round(bp.h),
            force: bp.force
        }));

        const buttons = (lvl.buttons || []).map(b => ({
            x: Math.round(b.x),
            y: Math.round(b.y),
            w: Math.round(b.w),
            h: Math.round(b.h),
            linkedGateId: b.linkedGateId
        }));

        const levers = (lvl.levers || []).map(l => ({
            x: Math.round(l.x),
            y: Math.round(l.y),
            w: Math.round(l.w),
            h: Math.round(l.h),
            linkedGateId: l.linkedGateId
        }));

        const flamethrowers = (lvl.flamethrowers || []).map(f => ({
            id: f.id !== undefined ? f.id : Math.random(),
            startX: Math.round(f.startX !== undefined ? f.startX : f.x),
            startY: Math.round(f.startY !== undefined ? f.startY : f.y),
            x: Math.round(f.x),
            y: Math.round(f.y),
            w: Math.round(f.w),
            h: Math.round(f.h),
            dir: f.dir || 'right',
            range: Math.round(f.range || 200),
            moving: !!f.moving,
            moveRange: Math.round(f.moveRange || 100),
            moveSpeed: f.moveSpeed || 1.5,
            moveAxis: f.moveAxis || 'y',
            disabled: !!f.disabled,
            active: f.active !== undefined ? f.active : true
        }));

        const fallingPlatforms = (lvl.fallingPlatforms || []).map(p => ({
            startX: Math.round(p.startX !== undefined ? p.startX : p.x),
            startY: Math.round(p.startY !== undefined ? p.startY : p.y),
            x: Math.round(p.startX !== undefined ? p.startX : p.x),
            y: Math.round(p.startY !== undefined ? p.startY : p.y),
            w: Math.round(p.w),
            h: Math.round(p.h),
            timer: 0,
            triggered: false,
            vy: 0,
            fallen: false
        }));

        const breakablePlatforms = (lvl.breakablePlatforms || []).map(p => ({
            x: Math.round(p.x),
            y: Math.round(p.y),
            w: Math.round(p.w),
            h: Math.round(p.h),
            type: p.type || 'platform',
            broken: false,
            timer: 0,
            triggered: false
        }));

        const hiddenPassages = (lvl.hiddenPassages || []).map(p => ({
            x: Math.round(p.x),
            y: Math.round(p.y),
            w: Math.round(p.w),
            h: Math.round(p.h)
        }));

        const fallingBlockTraps = (lvl.fallingBlockTraps || []).map(t => ({
            startX: Math.round(t.startX !== undefined ? t.startX : t.x),
            startY: Math.round(t.startY !== undefined ? t.startY : t.y),
            x: Math.round(t.startX !== undefined ? t.startX : t.x),
            y: Math.round(t.startY !== undefined ? t.startY : t.y),
            w: Math.round(t.w),
            h: Math.round(t.h),
            state: 'idle',
            vy: 0,
            timer: 0
        }));

        const vantuzPoints = (lvl.vantuzPoints || []).map(v => ({
            x: Math.round(v.x),
            y: Math.round(v.y)
        }));

        const decorations = (lvl.decorations || []).map(d => ({
            x: Math.round(d.x),
            y: Math.round(d.y),
            w: Math.round(d.w),
            h: Math.round(d.h),
            type: d.type || 'neon_light',
            rotation: d.rotation || 0,
            state: d.state || 0,
            text: d.text || '',
            color: d.color || ''
        }));

        const laserEmitters = (lvl.laserEmitters || []).map(e => ({
            x: Math.round(e.x),
            y: Math.round(e.y),
            w: Math.round(e.w),
            h: Math.round(e.h),
            direction: e.direction !== undefined ? e.direction : 0,
            color: e.color || 'blue'
        }));

        const laserReceivers = (lvl.laserReceivers || []).map(r => ({
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.w),
            h: Math.round(r.h),
            linkedGateId: r.linkedGateId
        }));

        const staticMirrors = (lvl.staticMirrors || []).map(m => ({
            x: Math.round(m.x),
            y: Math.round(m.y),
            w: Math.round(m.w),
            h: Math.round(m.h),
            mirrorType: m.mirrorType
        }));

        const arrowShooters = (lvl.arrowShooters || []).map(a => ({
            x: Math.round(a.x),
            y: Math.round(a.y),
            w: Math.round(a.w || 48),
            h: Math.round(a.h || 48),
            dir: a.dir || 'right',
            detectionRadius: a.detectionRadius !== undefined ? a.detectionRadius : 200,
            fireInterval: a.fireInterval !== undefined ? a.fireInterval : 2.5,
            arrowSpeed: a.arrowSpeed !== undefined ? a.arrowSpeed : 4.5,
            arrowRange: a.arrowRange !== undefined ? a.arrowRange : 400
        }));

        return {
            serverLevelId: lvl.serverLevelId || null,
            name: lvl.name || "Özel Seviye",
            tags: lvl.tags || [],
            themeId: (lvl.theme && lvl.theme.id) ? lvl.theme.id : 'neon_sewer',
            levelWidth: lvl.width,
            levelHeight: lvl.height,
            spawn: { x: Math.round(lvl.spawnX), y: Math.round(lvl.spawnY) },
            portal: { x: Math.round(lvl.portal.x), y: Math.round(lvl.portal.y) },
            platforms,
            spikes,
            acidPools,
            lasers,
            netGates,
            movingPlatforms,
            crystals,
            enemies,
            pressurePlates,
            pushBlocks,
            conveyors,
            teleportPairs,
            bouncePads,
            buttons,
            levers,
            flamethrowers,
            fallingPlatforms,
            breakablePlatforms,
            hiddenPassages,
            fallingBlockTraps,
            vantuzPoints,
            decorations,
            laserEmitters,
            laserReceivers,
            staticMirrors,
            arrowShooters
        };
    }

    /**
     * Level verilerini JSON koduna dönüştürür ve gösterir
     */
    exportLevelJSON() {
        const exportObj = this.getLevelDataObj();
        const jsonStr = JSON.stringify(exportObj, null, 4);

        // Modal oluştur
        const overlay = document.createElement('div');
        overlay.id = 'editor-json-modal-overlay';
        
        const modal = document.createElement('div');
        modal.id = 'editor-json-modal';
        
        modal.innerHTML = `
            <div style="font-size:16px; font-weight:800; color:#d946ef; margin-bottom:10px;">💾 SAVE LEVEL (JSON EXPORT)</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">Seviye verileriniz aşağıdaki formatta oluşturuldu. Kopyalayabilir veya dosya olarak indirebilirsiniz:</div>
            <textarea readonly onclick="this.select()">${jsonStr}</textarea>
            <div class="modal-actions">
                <button class="editor-btn" id="modal-download-btn">📥 DOSYA İNDİR</button>
                <button class="editor-btn" id="modal-copy-btn">📋 KOPYALA</button>
                <button class="editor-btn primary" id="modal-close-btn">KAPAT</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());
        
        document.getElementById('modal-copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(jsonStr);
            alert('Bölüm verisi panoya kopyalandı!');
        });

        // Dosya İndirme Desteği
        document.getElementById('modal-download-btn').addEventListener('click', () => {
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `viscora_level_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    /**
     * Seviyeyi topluluk sunucusunda paylaşır
     */
    publishToCommunity() {
        // Proaktif çevrimdışı kontrolü
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            showConfirmModal(
                '📡 Bağlantı Yok\n\nHarita paylaşmak için internet bağlantısı gereklidir.\nLütfen bağlantınızı kontrol edip tekrar deneyin.',
                () => {},
                () => {}
            );
            return;
        }

        const mapName = this.game.level.name || "Özel Harita";
        const authorName = localStorage.getItem('viscora_author_name') || "Tasarımcı";

        if (isOffensive(mapName)) {
            alert("Bölüm adı uygunsuz, argo veya siyasi içerik içeremez!");
            return;
        }
        if (isOffensive(authorName)) {
            alert("Tasarımcı adı uygunsuz, argo veya siyasi içerik içeremez!");
            return;
        }

        const lvl = this.game.level;

        // Dekorasyon yazı kutularını tara
        const decorations = lvl.decorations || [];
        for (const deco of decorations) {
            if (deco.type === 'textbox' && isOffensive(deco.text || '')) {
                alert('Haritadaki bir yazı kutusu uygunsuz içerik içeriyor. Lütfen kontrol edin!');
                return;
            }
        }
        const platformCount = (lvl.platforms ? lvl.platforms.length : 0) +
                              (lvl.fallingPlatforms ? lvl.fallingPlatforms.length : 0) +
                              (lvl.breakablePlatforms ? lvl.breakablePlatforms.length : 0) +
                              (lvl.movingPlatforms ? lvl.movingPlatforms.length : 0) +
                              (lvl.conveyors ? lvl.conveyors.length : 0);

        const spikeCount = lvl.hazards ? lvl.hazards.filter(h => h.type === 'spike').length : 0;
        const acidCount = lvl.hazards ? lvl.hazards.filter(h => h.type === 'acid').length : 0;
        const flameCount = lvl.flamethrowers ? lvl.flamethrowers.length : 0;
        const fallingTrapCount = lvl.fallingBlockTraps ? lvl.fallingBlockTraps.length : 0;
        const shooterCount = lvl.arrowShooters ? lvl.arrowShooters.length : 0;
        const hazardCount = spikeCount + acidCount + flameCount + fallingTrapCount + shooterCount;

        const laserGateCount = lvl.gates ? lvl.gates.filter(g => g.type === 'laser' || g.type === 'pinkLaser' || g.type === 'greenLaser' || g.type === 'yellowLaser').length : 0;
        const laserEmitterCount = lvl.laserEmitters ? lvl.laserEmitters.length : 0;
        const laserReceiverCount = lvl.laserReceivers ? lvl.laserReceivers.length : 0;
        const laserCount = laserGateCount + laserEmitterCount + laserReceiverCount;

        const mirrorCount = (lvl.pushBlocks ? lvl.pushBlocks.length : 0) +
                            (lvl.staticMirrors ? lvl.staticMirrors.length : 0);

        const enemyCount = lvl.enemies ? lvl.enemies.length : 0;

        if (lvl.width > 5000 || lvl.height > 1500) {
            alert(`Harita boyut sınırları aşıldı! Maksimum boyutlar 5000px genişlik ve 1500px yükseklik olmalıdır. (Mevcut: ${lvl.width}x${lvl.height}px)`);
            return;
        }
        if (platformCount > 200) {
            alert(`Harita zemin sınırı aşıldı! En fazla 200 adet zemin yerleştirebilirsiniz. (Mevcut: ${platformCount})`);
            return;
        }
        if (hazardCount > 100) {
            alert(`Harita engel sınırı aşıldı! En fazla 100 adet engel/tuzak yerleştirebilirsiniz. (Mevcut: ${hazardCount})`);
            return;
        }
        if (laserCount > 40) {
            alert(`Harita lazer sınırı aşıldı! En fazla 40 adet lazer elemanı yerleştirebilirsiniz. (Mevcut: ${laserCount})`);
            return;
        }
        if (mirrorCount > 45) {
            alert(`Harita ayna/kutu sınırı aşıldı! En fazla 45 adet itilebilir kutu/ayna yerleştirebilirsiniz. (Mevcut: ${mirrorCount})`);
            return;
        }
        if (enemyCount > 40) {
            alert(`Harita düşman sınırı aşıldı! En fazla 40 adet düşman yerleştirebilirsiniz. (Mevcut: ${enemyCount})`);
            return;
        }

        const exportObj = this.getLevelDataObj();
        const myUserId = localStorage.getItem('viscora_user_id') || 'anonymous';
        const serverLevelId = this.game.level.serverLevelId;

        const performNewPublish = () => {
            // Sunucuya yeni harita olarak gönder (serverLevelId'yi yoksay/yeni id oluşturulacak)
            const newExport = { ...exportObj };
            newExport.serverLevelId = null;

            fetch(`${API_BASE}/api/levels`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: mapName,
                    author: authorName,
                    creatorId: myUserId,
                    tags: newExport.tags || [],
                    data: newExport
                })
            })
            .then(async res => {
                if (!res.ok) {
                    let errMsg = "Sunucu hatası.";
                    try {
                        const errData = await res.json();
                        if (errData && errData.error) errMsg = errData.error;
                    } catch(e) {}
                    throw new Error(errMsg);
                }
                return res.json();
            })
            .then(data => {
                // Sunucudan dönen yeni level ID'sini kaydet
                this.game.level.serverLevelId = data.id;
                this.saveToLocalStorage();
                if (this.game.ui.loadCommunityMaps) {
                    this.game.ui.loadCommunityMaps(this.game.ui.currentSort || 'popular');
                }
                if (this.game.ui && this.game.ui.updateWeeklyChallenge) {
                    this.game.ui.updateWeeklyChallenge(3, 1);
                }
                alert(`Haritanız "${data.name}" başarıyla yeni bir bölüm olarak topluluk sunucusunda paylaşıldı!`);
            })
            .catch(err => {
                console.warn("Paylaşım hatası:", err);
                if (err.message === "Bu bölüm adı zaten mevcut.") {
                    alert("Bu bölüm adı zaten mevcut! Lütfen editörün 'Seviye & Izgara' ayarlarından farklı bir bölüm adı girip tekrar deneyin.");
                } else {
                    alert("Harita paylaşılamadı. Sunucu uykuda olabilir veya geçici bir internet sorunu yaşanıyor olabilir. Lütfen birkaç saniye sonra tekrar deneyin!");
                }
            });
        };

        const performUpdate = () => {
            // Sunucudaki mevcut haritayı güncelle
            fetch(`${API_BASE}/api/levels/${serverLevelId}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: mapName,
                    creatorId: myUserId,
                    tags: exportObj.tags || [],
                    data: exportObj
                })
            })
            .then(async res => {
                if (!res.ok) {
                    let errMsg = "Güncelleme hatası.";
                    try {
                        const errData = await res.json();
                        if (errData && errData.error) errMsg = errData.error;
                    } catch(e) {}
                    throw new Error(errMsg);
                }
                return res.json();
            })
            .then(data => {
                if (this.game.ui.loadCommunityMaps) {
                    this.game.ui.loadCommunityMaps(this.game.ui.currentSort || 'popular');
                }
                alert(`Haritanız "${data.name}" başarıyla güncellendi! Süresi ve beğenileri aynen korunacaktır.`);
            })
            .catch(err => {
                console.warn("Güncelleme hatası:", err);
                if (err.message === "Bu bölüm adı zaten mevcut.") {
                    alert("Bu bölüm adı zaten mevcut! Lütfen farklı bir isim girip tekrar deneyin.");
                } else if (err.message === "Bu bölümü güncelleme izniniz yok.") {
                    alert("Bu bölümü güncelleme yetkiniz bulunmamaktadır (bölümün sahibi siz değilsiniz). Yeni bir bölüm olarak paylaşmayı deneyebilirsiniz.");
                } else {
                    alert("Harita güncellenemedi. Sunucu uykuda veya çevrimdışı olabilir. Lütfen birkaç saniye sonra tekrar deneyin!");
                }
            });
        };

        if (serverLevelId) {
            // Eğer daha önce paylaşılmışsa kullanıcıya seçenek sun
            window.showShareModal(
                `"${mapName}" bölümünü daha önce paylaştınız. Bu bölümü değişikliklerinizle güncellemek mi istersiniz, yoksa yeni (ayrı) bir bölüm olarak mı yayınlamak istersiniz?`,
                performUpdate,
                performNewPublish
            );
        } else {
            // İlk kez paylaşılıyorsa standart confirm modalı göster
            showConfirmModal("Bölümünüzü paylaşmak istediğinize emin misiniz?", () => {
                performNewPublish();
            });
        }
    }

    /**
     * Dışarıdan kopyalanan JSON verisini seviyeye yükler
     */
    importLevelJSON() {
        const overlay = document.createElement('div');
        overlay.id = 'editor-json-modal-overlay';
        
        const modal = document.createElement('div');
        modal.id = 'editor-json-modal';
        
        modal.innerHTML = `
            <div style="font-size:16px; font-weight:800; color:#10b981; margin-bottom:10px;">📂 BÖLÜMÜ İÇE AKTAR (JSON IMPORT)</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">JSON formatındaki bölüm kodunu aşağıya yapıştırın:</div>
            <textarea id="import-textarea" placeholder="Buraya yapıştırın..."></textarea>
            <div class="modal-actions">
                <button class="editor-btn danger" id="modal-cancel-btn">İPTAL</button>
                <button class="editor-btn primary" id="modal-import-btn">İÇE AKTAR</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.remove());
        
        document.getElementById('modal-import-btn').addEventListener('click', () => {
            const code = document.getElementById('import-textarea').value;
            try {
                const data = JSON.parse(code);
                
                const lvl = this.game.level;
                
                // Clear existing level objects first to prevent leftovers
                lvl.platforms = [];
                lvl.hazards = [];
                lvl.movingPlatforms = [];
                lvl.gates = [];
                lvl.collectibles = [];
                lvl.enemies = [];
                lvl.pressurePlates = [];
                lvl.pushBlocks = [];
                lvl.conveyors = [];
                lvl.teleportPairs = [];
                lvl.bouncePads = [];
                lvl.buttons = [];
                lvl.levers = [];
                lvl.flamethrowers = [];
                lvl.fallingPlatforms = [];
                lvl.breakablePlatforms = [];
                lvl.hiddenPassages = [];
                lvl.fallingBlockTraps = [];
                lvl.vantuzPoints = [];
                lvl.decorations = [];
                lvl.checkpoints = [];
                lvl.arrowShooters = [];
                lvl.laserEmitters = [];
                lvl.laserReceivers = [];
                lvl.staticMirrors = [];

                // Parse dimensions
                lvl.width = Math.min(5000, Math.max(800, data.levelWidth || data.width || 2000));
                lvl.height = Math.min(1500, Math.max(600, data.levelHeight || data.height || 600));

                // Parse spawn point
                if (data.spawn) {
                    lvl.spawnX = data.spawn.x !== undefined ? data.spawn.x : 80;
                    lvl.spawnY = data.spawn.y !== undefined ? data.spawn.y : 350;
                } else {
                    lvl.spawnX = data.spawnX !== undefined ? data.spawnX : 80;
                    lvl.spawnY = data.spawnY !== undefined ? data.spawnY : 350;
                }

                // Parse portal
                if (data.portal) {
                    lvl.portal = {
                        x: data.portal.x !== undefined ? data.portal.x : 300,
                        y: data.portal.y !== undefined ? data.portal.y : 380,
                        w: data.portal.w || 60,
                        h: data.portal.h || 80,
                        angle: data.portal.angle || 0
                    };
                } else {
                    lvl.portal = { x: 300, y: 380, w: 60, h: 80, angle: 0 };
                }

                // Parse platforms
                if (Array.isArray(data.platforms)) {
                    lvl.platforms = data.platforms.map(p => ({
                        x: p.x,
                        y: p.y,
                        w: p.w || 120,
                        h: p.h || 40,
                        type: p.type || 'normal',
                        sticky: p.type === 'sticky',
                        slippery: p.type === 'slippery'
                    }));
                }

                // Parse hazards (spikes & acid pools)
                if (Array.isArray(data.spikes)) {
                    data.spikes.forEach(s => {
                        let dir = s.direction || 'up';
                        if (s.type === 'spike_down') dir = 'down';
                        else if (s.type === 'spike_left') dir = 'left';
                        else if (s.type === 'spike_right') dir = 'right';

                        let w = s.w;
                        let h = s.h;
                        if (w === undefined || h === undefined) {
                            if (dir === 'left' || dir === 'right') {
                                w = 20;
                                h = 60;
                            } else {
                                w = 60;
                                h = 20;
                            }
                        }

                        lvl.hazards.push({
                            x: s.x,
                            y: s.y,
                            w: w,
                            h: h,
                            type: 'spike',
                            direction: dir
                        });
                    });
                }
                if (Array.isArray(data.acidPools)) {
                    data.acidPools.forEach(a => {
                        lvl.hazards.push({
                            x: a.x,
                            y: a.y,
                            w: a.w !== undefined ? a.w : 120,
                            h: a.h !== undefined ? a.h : 70,
                            type: 'acid'
                        });
                    });
                }
                // Fallback for hazards array in pasted JSON
                if (Array.isArray(data.hazards)) {
                    data.hazards.forEach(h => {
                        // Avoid duplicates if spikes or acidPools already parsed them
                        if (!lvl.hazards.some(exist => exist.x === h.x && exist.y === h.y)) {
                            let dir = h.direction || 'up';
                            if (h.type === 'spike_down') dir = 'down';
                            else if (h.type === 'spike_left') dir = 'left';
                            else if (h.type === 'spike_right') dir = 'right';

                            let w = h.w;
                            let hVal = h.h;
                            if (w === undefined || hVal === undefined) {
                                if (dir === 'left' || dir === 'right') {
                                    w = 20;
                                    hVal = 60;
                                } else if (h.type === 'acid') {
                                    w = 120;
                                    hVal = 70;
                                } else {
                                    w = 60;
                                    hVal = 20;
                                }
                            }

                            lvl.hazards.push({
                                x: h.x,
                                y: h.y,
                                w: w,
                                h: hVal,
                                type: h.type === 'acid' ? 'acid' : 'spike',
                                direction: dir
                            });
                        }
                    });
                }

                // Parse moving platforms
                if (Array.isArray(data.movingPlatforms)) {
                    lvl.movingPlatforms = data.movingPlatforms.map(mp => ({
                        startX: mp.startX !== undefined ? mp.startX : mp.x,
                        startY: mp.startY !== undefined ? mp.startY : mp.y,
                        targetX: mp.targetX !== undefined ? mp.targetX : (mp.x !== undefined ? mp.x + 150 : 150),
                        targetY: mp.targetY !== undefined ? mp.targetY : (mp.y !== undefined ? mp.y : 0),
                        x: mp.startX !== undefined ? mp.startX : mp.x,
                        y: mp.startY !== undefined ? mp.startY : mp.y,
                        w: mp.w !== undefined ? mp.w : 100,
                        h: mp.h !== undefined ? mp.h : 20,
                        type: 'moving',
                        speed: mp.speed || 0.015,
                        dir: 1,
                        progress: 0
                    }));
                }

                // Parse lasers
                if (Array.isArray(data.lasers)) {
                    data.lasers.forEach(l => {
                        let ltype = l.type;
                        if (ltype === 'pink') ltype = 'pinkLaser';
                        else if (ltype === 'green') ltype = 'greenLaser';
                        else if (ltype === 'yellow') ltype = 'yellowLaser';
                        else if (ltype === 'blue') ltype = 'laser';

                        lvl.gates.push({
                            x: l.x,
                            y: l.y,
                            w: l.w !== undefined ? l.w : 20,
                            h: l.h !== undefined ? l.h : 220,
                            type: ltype || 'laser',
                            id: l.id !== undefined ? l.id : (100 + Math.floor(Math.random() * 900)),
                            disabled: false
                        });
                    });
                }

                // Parse net gates
                if (Array.isArray(data.netGates)) {
                    data.netGates.forEach(n => {
                        lvl.gates.push({
                            x: n.x,
                            y: n.y,
                            w: n.w !== undefined ? n.w : 20,
                            h: n.h !== undefined ? n.h : 220,
                            type: 'net',
                            id: n.id !== undefined ? n.id : (100 + Math.floor(Math.random() * 900)),
                            disabled: false
                        });
                    });
                }

                // Fallback for gates array in pasted JSON
                if (Array.isArray(data.gates)) {
                    data.gates.forEach(g => {
                        // Avoid duplicates if lasers or netGates already parsed them
                        if (!lvl.gates.some(exist => exist.x === g.x && exist.y === g.y)) {
                            lvl.gates.push({
                                x: g.x,
                                y: g.y,
                                w: g.w || 20,
                                h: g.h || 220,
                                type: g.type || 'laser',
                                id: g.id || (100 + Math.floor(Math.random() * 900)),
                                disabled: g.disabled || false
                            });
                        }
                    });
                }

                // Parse crystals (collectibles)
                if (Array.isArray(data.crystals)) {
                    lvl.collectibles = data.crystals.map(c => ({
                        x: c.x,
                        y: c.y,
                        collected: false,
                        color: c.color || '#eab308'
                    }));
                } else if (Array.isArray(data.collectibles)) {
                    lvl.collectibles = data.collectibles.map(c => ({
                        x: c.x,
                        y: c.y,
                        collected: false,
                        color: c.color || '#eab308'
                    }));
                }

                // Parse enemies
                if (Array.isArray(data.enemies)) {
                    lvl.enemies = data.enemies.map(e => ({
                        x: e.x,
                        y: e.y,
                        rangeX: e.rangeX !== undefined ? e.rangeX : 120,
                        speed: e.speed !== undefined ? e.speed : 1.2,
                        isVertical: !!e.isVertical,
                        color: e.color || '#f43f5e',
                        type: e.type || 'patrol'
                    }));
                }

                // Parse pressurePlates
                if (Array.isArray(data.pressurePlates)) {
                    lvl.pressurePlates = data.pressurePlates.map(pp => ({
                        x: pp.x,
                        y: pp.y,
                        w: pp.w || 50,
                        h: pp.h || 10,
                        activated: pp.activated || false,
                        linkedGateId: pp.linkedGateId
                    }));
                }

                // Parse pushBlocks
                if (Array.isArray(data.pushBlocks)) {
                    lvl.pushBlocks = data.pushBlocks.map(pb => ({
                        startX: pb.startX !== undefined ? pb.startX : pb.x,
                        startY: pb.startY !== undefined ? pb.startY : pb.y,
                        x: pb.x,
                        y: pb.y,
                        w: pb.w || 50,
                        h: pb.h || 50,
                        vx: pb.vx || 0,
                        vy: pb.vy || 0,
                        isMirror: pb.isMirror || false,
                        mirrorType: pb.mirrorType || 'slash'
                    }));
                }

                // Parse conveyors
                if (Array.isArray(data.conveyors)) {
                    lvl.conveyors = data.conveyors.map(c => ({
                        x: c.x,
                        y: c.y,
                        w: c.w || 120,
                        h: c.h || 20,
                        direction: c.direction !== undefined ? c.direction : 1,
                        speed: c.speed !== undefined ? c.speed : 1.5
                    }));
                }

                // Parse teleportPairs
                if (Array.isArray(data.teleportPairs)) {
                    lvl.teleportPairs = data.teleportPairs.map(tp => ({
                        x1: tp.x1,
                        y1: tp.y1,
                        x2: tp.x2,
                        y2: tp.y2,
                        color: tp.color || '#a855f7',
                        cooldown: 0
                    }));
                }

                // Parse bouncePads
                if (Array.isArray(data.bouncePads)) {
                    lvl.bouncePads = data.bouncePads.map(bp => ({
                        x: bp.x,
                        y: bp.y,
                        w: bp.w || 50,
                        h: bp.h || 20,
                        force: bp.force !== undefined ? bp.force : 12.0,
                        active: false,
                        timer: 0
                    }));
                }

                // Parse buttons
                if (Array.isArray(data.buttons)) {
                    lvl.buttons = data.buttons.map(b => ({
                        x: b.x,
                        y: b.y,
                        w: b.w || 32,
                        h: b.h || 32,
                        activated: b.activated || false,
                        linkedGateId: b.linkedGateId,
                        timer: b.timer || 0
                    }));
                }

                // Parse levers
                if (Array.isArray(data.levers)) {
                    lvl.levers = data.levers.map(l => ({
                        x: l.x,
                        y: l.y,
                        w: l.w || 32,
                        h: l.h || 32,
                        activated: l.activated || false,
                        linkedGateId: l.linkedGateId,
                        cooldown: 0
                    }));
                }

                // Parse fallingPlatforms
                if (Array.isArray(data.fallingPlatforms)) {
                    lvl.fallingPlatforms = data.fallingPlatforms.map(p => ({
                        startX: p.startX !== undefined ? p.startX : p.x,
                        startY: p.startY !== undefined ? p.startY : p.y,
                        x: p.x,
                        y: p.y,
                        w: p.w || 120,
                        h: p.h || 40,
                        timer: p.timer !== undefined ? p.timer : 0,
                        triggered: !!p.triggered,
                        vy: p.vy || 0,
                        fallen: !!p.fallen
                    }));
                }

                // Parse breakablePlatforms
                if (Array.isArray(data.breakablePlatforms)) {
                    lvl.breakablePlatforms = data.breakablePlatforms.map(p => ({
                        x: p.x,
                        y: p.y,
                        w: p.w || 120,
                        h: p.h || 40,
                        type: p.type || 'platform',
                        broken: !!p.broken,
                        timer: p.timer !== undefined ? p.timer : 0,
                        triggered: !!p.triggered
                    }));
                }

                // Parse hiddenPassages
                if (Array.isArray(data.hiddenPassages)) {
                    lvl.hiddenPassages = data.hiddenPassages.map(p => ({
                        x: p.x,
                        y: p.y,
                        w: p.w || 120,
                        h: p.h || 40
                    }));
                }

                // Parse fallingBlockTraps
                if (Array.isArray(data.fallingBlockTraps)) {
                    lvl.fallingBlockTraps = data.fallingBlockTraps.map(t => ({
                        startX: t.startX !== undefined ? t.startX : t.x,
                        startY: t.startY !== undefined ? t.startY : t.y,
                        x: t.x,
                        y: t.y,
                        w: t.w || 60,
                        h: t.h || 60,
                        state: t.state || 'idle',
                        vy: t.vy || 0,
                        timer: t.timer || 0
                    }));
                }

                // Parse vantuzPoints
                if (Array.isArray(data.vantuzPoints)) {
                    lvl.vantuzPoints = data.vantuzPoints.map(v => ({
                        x: v.x,
                        y: v.y,
                        cooldown: 0
                    }));
                }

                // Parse decorations
                if (Array.isArray(data.decorations)) {
                    lvl.decorations = data.decorations.map(d => {
                        let dtype = d.type || 'neon_light';
                        if (dtype === 'neon') dtype = 'neon_light';
                        if (dtype === 'warning') dtype = 'warning_light';
                        return {
                            x: d.x,
                            y: d.y,
                            w: d.w || 40,
                            h: d.h || 40,
                            type: dtype,
                            rotation: d.rotation || 0,
                            state: d.state || 0,
                            text: d.text || '',
                            color: d.color || ''
                        };
                    });
                }

                // Parse checkpoints
                if (Array.isArray(data.checkpoints)) {
                    lvl.checkpoints = data.checkpoints.map(cp => ({
                        x: cp.x,
                        y: cp.y,
                        r: cp.r || 15,
                        activated: cp.activated || false
                    }));
                } else {
                    lvl.checkpoints = [];
                }

                // Parse flamethrowers
                if (Array.isArray(data.flamethrowers)) {
                    lvl.flamethrowers = data.flamethrowers.map(f => ({
                        id: f.id !== undefined ? f.id : Math.random(),
                        startX: f.startX !== undefined ? f.startX : f.x,
                        startY: f.startY !== undefined ? f.startY : f.y,
                        x: f.x,
                        y: f.y,
                        w: f.w || 32,
                        h: f.h || 32,
                        dir: f.dir || 'right',
                        range: f.range || 200,
                        moving: !!f.moving,
                        moveRange: f.moveRange || 100,
                        moveSpeed: f.moveSpeed || 1.5,
                        moveAxis: f.moveAxis || 'y',
                        disabled: !!f.disabled,
                        active: f.active !== undefined ? f.active : true
                    }));
                }

                // Parse arrowShooters
                if (Array.isArray(data.arrowShooters)) {
                    lvl.arrowShooters = data.arrowShooters.map(a => ({
                        x: a.x,
                        y: a.y,
                        w: a.w || 48,
                        h: a.h || 48,
                        dir: a.dir || 'right',
                        detectionRadius: a.detectionRadius !== undefined ? a.detectionRadius : 200,
                        fireInterval: a.fireInterval !== undefined ? a.fireInterval : 2.5,
                        arrowSpeed: a.arrowSpeed !== undefined ? a.arrowSpeed : 4.5,
                        arrowRange: a.arrowRange !== undefined ? a.arrowRange : 400,
                        fireTimer: 0,
                        arrows: []
                    }));
                } else {
                    lvl.arrowShooters = [];
                }

                // Parse laserEmitters
                if (Array.isArray(data.laserEmitters)) {
                    lvl.laserEmitters = data.laserEmitters.map(e => ({
                        x: e.x,
                        y: e.y,
                        w: 40,
                        h: 40,
                        direction: e.direction !== undefined ? e.direction : 0,
                        color: e.color || 'blue',
                        path: []
                    }));
                } else {
                    lvl.laserEmitters = [];
                }

                // Parse laserReceivers
                if (Array.isArray(data.laserReceivers)) {
                    lvl.laserReceivers = data.laserReceivers.map(r => ({
                        x: r.x,
                        y: r.y,
                        w: 40,
                        h: 40,
                        linkedGateId: r.linkedGateId || 101,
                        activated: false
                    }));
                } else {
                    lvl.laserReceivers = [];
                }

                // Parse staticMirrors
                if (Array.isArray(data.staticMirrors)) {
                    lvl.staticMirrors = data.staticMirrors.map(m => ({
                        x: m.x,
                        y: m.y,
                        w: m.w || 40,
                        h: m.h || 40,
                        mirrorType: m.mirrorType || 'top-left'
                    }));
                } else {
                    lvl.staticMirrors = [];
                }

                const nameEl = document.getElementById('editor-level-name');
                if (nameEl) nameEl.value = lvl.name || '';
                document.getElementById('editor-level-width').value = lvl.width;
                document.getElementById('editor-level-height').value = lvl.height;
                
                // Center the camera on the new level spawn position
                this.game.camera.x = Math.max(0, lvl.spawnX - this.game.cssWidth / 2);
                this.game.camera.y = Math.max(0, lvl.spawnY - this.game.cssHeight / 2);
                
                this.selectedObject = null;
                this.selectedObjectType = '';
                this.updateInspector();
                this.saveToLocalStorage(); // Auto-save after import

                overlay.remove();
                alert('Bölüm başarıyla yüklendi!');
                audio.playCollect();
            } catch (err) {
                alert('Geçersiz JSON formatı! Lütfen kodu kontrol edin.');
            }
        });
    }

    /**
     * Mouse tıklamaları ile obje seçimi ve yaratımı
     */
    onMouseDown(e) {
        if (!this.active || this.game.state !== 'EDITOR') return;

        // Tıklanan koordinatları oyun dünyasına çevir (Kamera kayması ve Zoom dahil)
        const rect = this.game.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const zoom = this.game.camera.zoom || 1.0;
        const halfW = this.game.cssWidth / 2;
        const halfH = this.game.cssHeight / 2;
        
        const mouseX = (clientX - halfW) / zoom + this.game.camera.x + halfW;
        const mouseY = (clientY - halfH) / zoom + this.game.camera.y + halfH;

        // Sağ tık veya Shift tık kamerayı sürükler (Pan)
        if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.cameraStartX = this.game.camera.x;
            this.cameraStartY = this.game.camera.y;
            return;
        }

        if (e.button !== 0) return; // Sadece sol tık ile obje yönetilir

        // 0. CHECK DELETE OVERLAY
        if (this.deleteOverlayObject) {
            const center = this.getObjectCenter(this.deleteOverlayObject, this.deleteOverlayObjectType);
            const distToX = Math.sqrt(Math.pow(mouseX - center.x, 2) + Math.pow(mouseY - center.y, 2));
            if (distToX < 20) {
                const objToDelete = this.deleteOverlayObject;
                const typeToDelete = this.deleteOverlayObjectType;
                this.deleteOverlayObject = null;
                this.deleteOverlayObjectType = '';
                
                this.selectedObject = objToDelete;
                this.selectedObjectType = typeToDelete;
                this.deleteSelected();
                return;
            } else {
                this.deleteOverlayObject = null;
                this.deleteOverlayObjectType = '';
            }
        }

        // 1. SEÇİM MODU
        if (this.activeTool === 'select') {
            const hit = this.getObjectAt(mouseX, mouseY);
            if (hit) {
                // Double click check
                const now = performance.now();
                if (now - this.lastClickTime < 300 && this.lastClickObject === hit.obj) {
                    if (hit.type !== 'spawn' && hit.type !== 'portal') {
                        this.deleteOverlayObject = hit.obj;
                        this.deleteOverlayObjectType = hit.type;
                        this.selectedObject = hit.obj;
                        this.selectedObjectType = hit.type;
                        this.updateInspector();
                        
                        this.lastClickTime = 0;
                        this.lastClickObject = null;
                        this.isDragging = false;
                        this.isPanning = false;
                        return;
                    }
                } else {
                    this.lastClickTime = now;
                    this.lastClickObject = hit.obj;
                    this.lastClickX = mouseX;
                    this.lastClickY = mouseY;
                }

                this.selectedObject = hit.obj;
                this.selectedObjectType = hit.type;
                this.isDragging = true;
                
                if (hit.type === 'spawn') {
                    this.dragOffsetX = mouseX - this.game.level.spawnX;
                    this.dragOffsetY = mouseY - this.game.level.spawnY;
                } else if (hit.type === 'portal' || hit.type === 'collectible') {
                    this.dragOffsetX = mouseX - (hit.obj.x + 20); // portal center
                    this.dragOffsetY = mouseY - (hit.obj.y + 30);
                } else if (hit.type === 'teleportPair') {
                    if (this.draggedPortalEnd === 1) {
                        this.dragOffsetX = mouseX - hit.obj.x1;
                        this.dragOffsetY = mouseY - hit.obj.y1;
                    } else {
                        this.dragOffsetX = mouseX - hit.obj.x2;
                        this.dragOffsetY = mouseY - hit.obj.y2;
                    }
                } else {
                    this.dragOffsetX = mouseX - hit.obj.x;
                    this.dragOffsetY = mouseY - hit.obj.y;
                }

                audio.playPlateActivate(); // Hafif çıt sesi
            } else {
                this.selectedObject = null;
                this.selectedObjectType = '';
                
                // Boş alana sol tıklayınca kamerayı kaydırmayı (Pan) başlat
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.cameraStartX = this.game.camera.x;
                this.cameraStartY = this.game.camera.y;
            }
            this.updateInspector();
        } 
        // 2. YARATMA MODU
        else {
            let snapX = mouseX;
            let snapY = mouseY;
            
            if (this.gridSnap) {
                snapX = Math.round(mouseX / this.gridSize) * this.gridSize;
                snapY = Math.round(mouseY / this.gridSize) * this.gridSize;
            }

            const lvl = this.game.level;
            
            if (this.activeTool === 'create_platform_normal') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 40,
                    type: 'normal',
                    sticky: false,
                    slippery: false
                });
            } else if (this.activeTool === 'create_platform_long') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 240,
                    h: 40,
                    type: 'normal',
                    sticky: false,
                    slippery: false
                });
            } else if (this.activeTool === 'create_platform_narrow') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 60,
                    h: 20,
                    type: 'normal',
                    sticky: false,
                    slippery: false
                });
            } else if (this.activeTool === 'create_wall_normal') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 120,
                    type: 'normal',
                    sticky: false,
                    slippery: false
                });
            } else if (this.activeTool === 'create_platform_sticky') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 40,
                    type: 'sticky',
                    sticky: true,
                    slippery: false
                });
            } else if (this.activeTool === 'create_platform_sticky_purple') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 120,
                    type: 'sticky',
                    sticky: true,
                    slippery: false,
                    color: '#a855f7'
                });
            } else if (this.activeTool === 'create_platform_slippery') {
                lvl.platforms.push({
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 40,
                    type: 'slippery',
                    sticky: false,
                    slippery: true
                });
            } else if (this.activeTool === 'create_platform_falling') {
                if (!lvl.fallingPlatforms) lvl.fallingPlatforms = [];
                lvl.fallingPlatforms.push({
                    startX: snapX,
                    startY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 40,
                    timer: 0,
                    triggered: false,
                    fallen: false
                });
            } else if (this.activeTool === 'create_platform_breakable') {
                if (!lvl.breakablePlatforms) lvl.breakablePlatforms = [];
                lvl.breakablePlatforms.push({
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 40,
                    type: 'platform',
                    broken: false,
                    timer: 0,
                    triggered: false
                });
            } else if (this.activeTool === 'create_wall_breakable') {
                if (!lvl.breakablePlatforms) lvl.breakablePlatforms = [];
                lvl.breakablePlatforms.push({
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 120,
                    type: 'wall',
                    broken: false,
                    timer: 0,
                    triggered: false
                });
            } else if (this.activeTool === 'create_hidden_passage') {
                if (!lvl.hiddenPassages) lvl.hiddenPassages = [];
                lvl.hiddenPassages.push({
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 40
                });
            } else if (this.activeTool.startsWith('create_collectible')) {
                let color = '#eab308'; // Default yellow
                if (this.activeTool === 'create_collectible_blue') color = '#06b6d4';
                else if (this.activeTool === 'create_collectible_pink') color = '#d946ef';
                else if (this.activeTool === 'create_collectible_green') color = '#10b981';
                else if (this.activeTool === 'create_collectible_diamond') color = '#f43f5e';

                lvl.collectibles.push({
                    x: snapX,
                    y: snapY,
                    collected: false,
                    color: color
                });
            } else if (this.activeTool.startsWith('create_hazard_')) {
                const hType = this.activeTool.replace('create_hazard_', '');
                let dir = 'up';
                let w = 60;
                let h = 20;
                if (hType === 'spike_down') {
                    dir = 'down';
                } else if (hType === 'spike_left') {
                    dir = 'left';
                    w = 20;
                    h = 60;
                } else if (hType === 'spike_right') {
                    dir = 'right';
                    w = 20;
                    h = 60;
                } else if (hType === 'acid') {
                    w = 120;
                    h = 70;
                }
                lvl.hazards.push({
                    x: snapX,
                    y: snapY,
                    w: w,
                    h: h,
                    type: hType.startsWith('spike') ? 'spike' : 'acid',
                    direction: dir
                });
            } else if (this.activeTool === 'create_moving') {
                lvl.movingPlatforms.push({
                    startX: snapX,
                    startY: snapY,
                    targetX: snapX + 150,
                    targetY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 100,
                    h: 20,
                    type: 'moving',
                    speed: 0.015,
                    dir: 1,
                    progress: 0
                });
            } else if (this.activeTool.startsWith('create_gate_')) {
                const gType = this.activeTool.replace('create_gate_', '');
                let gateType = 'laser';
                if (gType === 'pink') gateType = 'pinkLaser';
                else if (gType === 'green') gateType = 'greenLaser';
                else if (gType === 'yellow') gateType = 'yellowLaser';
                else if (gType === 'net') gateType = 'net';
                
                lvl.gates.push({
                    x: snapX,
                    y: snapY,
                    w: 20,
                    h: 220,
                    type: gateType,
                    id: 100 + Math.floor(Math.random() * 900),
                    disabled: false
                });
            } else if (this.activeTool === 'create_enemy') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 120,
                    speed: 1.2,
                    isVertical: false,
                    color: '#f43f5e'
                });
            } else if (this.activeTool === 'create_enemy_vertical') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 120,
                    speed: 1.2,
                    isVertical: true,
                    color: '#06b6d4'
                });
            } else if (this.activeTool === 'create_enemy_jumping') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 120,
                    speed: 1.5,
                    isVertical: true,
                    color: '#d946ef'
                });
            } else if (this.activeTool === 'create_enemy_flying') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 180,
                    speed: 2.0,
                    isVertical: false,
                    color: '#eab308'
                });
            } else if (this.activeTool === 'create_enemy_chaser') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 150,
                    speed: 1.0,
                    isVertical: false,
                    color: '#10b981',
                    type: 'chaser'
                });
            } else if (this.activeTool === 'create_enemy_tractor') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 150,
                    speed: 1.0,
                    isVertical: false,
                    color: '#a855f7',
                    type: 'tractor_ufo'
                });
            } else if (this.activeTool === 'create_enemy_sweeper') {
                lvl.enemies.push({
                    x: snapX,
                    y: snapY,
                    rangeX: 150,
                    speed: 1.2,
                    isVertical: false,
                    color: '#06b6d4',
                    type: 'sweeper_ufo'
                });
            } else if (this.activeTool === 'create_plate') {
                if (!lvl.pressurePlates) lvl.pressurePlates = [];
                lvl.pressurePlates.push({
                    x: snapX,
                    y: snapY,
                    w: 50,
                    h: 10,
                    activated: false,
                    linkedGateId: 101
                });
            } else if (this.activeTool === 'create_pushblock') {
                if (!lvl.pushBlocks) lvl.pushBlocks = [];
                lvl.pushBlocks.push({
                    startX: snapX,
                    startY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 50,
                    h: 50,
                    vx: 0,
                    vy: 0,
                    isMirror: false,
                    mirrorType: 'slash'
                });
            } else if (this.activeTool === 'create_mirror_slash') {
                if (!lvl.pushBlocks) lvl.pushBlocks = [];
                lvl.pushBlocks.push({
                    startX: snapX,
                    startY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 50,
                    h: 50,
                    vx: 0,
                    vy: 0,
                    isMirror: true,
                    mirrorType: 'slash'
                });
            } else if (this.activeTool === 'create_mirror_backslash') {
                if (!lvl.pushBlocks) lvl.pushBlocks = [];
                lvl.pushBlocks.push({
                    startX: snapX,
                    startY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 50,
                    h: 50,
                    vx: 0,
                    vy: 0,
                    isMirror: true,
                    mirrorType: 'backslash'
                });
            } else if (this.activeTool === 'create_static_mirror_slash') {
                if (!lvl.staticMirrors) lvl.staticMirrors = [];
                lvl.staticMirrors.push({
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 40,
                    mirrorType: 'top-left'
                });
            } else if (this.activeTool === 'create_static_mirror_backslash') {
                if (!lvl.staticMirrors) lvl.staticMirrors = [];
                lvl.staticMirrors.push({
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 40,
                    mirrorType: 'top-right'
                });
            } else if (this.activeTool === 'create_laser_emitter') {
                if (!lvl.laserEmitters) lvl.laserEmitters = [];
                lvl.laserEmitters.push({
                    id: 1000 + Math.floor(Math.random() * 9000),
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 40,
                    direction: 0,
                    color: 'blue'
                });
            } else if (this.activeTool === 'create_laser_receiver') {
                if (!lvl.laserReceivers) lvl.laserReceivers = [];
                lvl.laserReceivers.push({
                    id: 1000 + Math.floor(Math.random() * 9000),
                    x: snapX,
                    y: snapY,
                    w: 40,
                    h: 40,
                    linkedGateId: 101
                });
            } else if (this.activeTool === 'create_conveyor') {
                if (!lvl.conveyors) lvl.conveyors = [];
                lvl.conveyors.push({
                    x: snapX,
                    y: snapY,
                    w: 120,
                    h: 20,
                    direction: 1,
                    speed: 1.5
                });
            } else if (this.activeTool === 'create_bouncepad') {
                if (!lvl.bouncePads) lvl.bouncePads = [];
                lvl.bouncePads.push({
                    x: snapX,
                    y: snapY,
                    w: 50,
                    h: 20,
                    force: 12.0,
                    active: false,
                    timer: 0
                });
            } else if (this.activeTool === 'create_teleport') {
                if (!lvl.teleportPairs) lvl.teleportPairs = [];
                lvl.teleportPairs.push({
                    x1: snapX,
                    y1: snapY,
                    x2: snapX + 100,
                    y2: snapY,
                    color: '#a855f7',
                    cooldown: 0
                });
            } else if (this.activeTool === 'create_button') {
                if (!lvl.buttons) lvl.buttons = [];
                lvl.buttons.push({
                    x: snapX,
                    y: snapY,
                    w: 32,
                    h: 32,
                    activated: false,
                    linkedGateId: 101,
                    timer: 0
                });
            } else if (this.activeTool === 'create_lever') {
                if (!lvl.levers) lvl.levers = [];
                lvl.levers.push({
                    x: snapX,
                    y: snapY,
                    w: 32,
                    h: 32,
                    activated: false,
                    linkedGateId: 101,
                    cooldown: 0
                });
            } else if (this.activeTool === 'create_vantuz') {
                if (!lvl.vantuzPoints) lvl.vantuzPoints = [];
                lvl.vantuzPoints.push({
                    x: snapX,
                    y: snapY,
                    cooldown: 0
                });
            } else if (this.activeTool === 'create_trap_falling_block') {
                if (!lvl.fallingBlockTraps) lvl.fallingBlockTraps = [];
                lvl.fallingBlockTraps.push({
                    startX: snapX,
                    startY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 60,
                    h: 60,
                    state: 'idle',
                    vy: 0,
                    timer: 0
                });
            } else if (this.activeTool.startsWith('create_deco_')) {
                let dType = this.activeTool.replace('create_deco_', '');
                if (dType === 'neon') dType = 'neon_light';
                if (dType === 'warning') dType = 'warning_light';
                
                if (!lvl.decorations) lvl.decorations = [];
                let w = 40, h = 40;
                if (dType === 'neon_light') { w = 20; h = 80; }
                else if (dType === 'textbox') { w = 200; h = 80; }
                else if (dType === 'pipe') { w = 80; h = 20; }
                else if (dType === 'cable') { w = 80; h = 40; }
                else if (dType === 'pano') { w = 50; h = 40; }
                else if (dType === 'warning_light' || dType === 'steam') { w = 32; h = 32; }
                else if (dType === 'pillar') { w = 32; h = 120; }
                else if (dType === 'gear') { w = 40; h = 40; }
                else if (dType === 'window_space') { w = 60; h = 60; }
                else if (dType === 'server_rack') { w = 40; h = 60; }

                lvl.decorations.push({
                    x: snapX,
                    y: snapY,
                    w: w,
                    h: h,
                    type: dType,
                    rotation: 0,
                    startRotation: 0,
                    state: 0,
                    text: dType === 'textbox' ? 'Yeni Bilgi Kutusu' : '',
                    color: dType === 'textbox' ? '#06b6d4' : ''
                });
            } else if (this.activeTool === 'create_portal') {
                lvl.portal.x = snapX;
                lvl.portal.y = snapY;
            } else if (this.activeTool === 'create_spawn') {
                lvl.spawnX = snapX;
                lvl.spawnY = snapY;
            } else if (this.activeTool === 'create_checkpoint') {
                if (!lvl.checkpoints) lvl.checkpoints = [];
                lvl.checkpoints.push({
                    x: snapX,
                    y: snapY,
                    r: 15,
                    activated: false
                });
            } else if (this.activeTool === 'create_flamethrower') {
                if (!lvl.flamethrowers) lvl.flamethrowers = [];
                lvl.flamethrowers.push({
                    id: 9000 + Math.floor(Math.random() * 1000),
                    startX: snapX,
                    startY: snapY,
                    x: snapX,
                    y: snapY,
                    w: 32,
                    h: 32,
                    dir: 'right',
                    range: 200,
                    moving: false,
                    moveRange: 100,
                    moveSpeed: 1.5,
                    moveAxis: 'y',
                    disabled: false,
                    active: true
                });
            } else if (this.activeTool === 'create_arrow_shooter') {
                if (!lvl.arrowShooters) lvl.arrowShooters = [];
                lvl.arrowShooters.push({
                    x: snapX,
                    y: snapY,
                    w: 48,
                    h: 48,
                    dir: 'right',
                    detectionRadius: 200,
                    fireInterval: 2.5,
                    arrowSpeed: 4.5,
                    arrowRange: 400,
                    fireTimer: 0,
                    arrows: []
                });
            }

            this.saveToLocalStorage(); // Auto-save after creation
            audio.playCollect(); // Ekleme onay sesi

            // Seç aracı durumuna dön
            this.activeTool = 'select';
            this.panel.querySelectorAll('.editor-btn[data-tool]').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-tool') === 'select') btn.classList.add('active');
            });
            
            // Yeni yaratılan objeyi seçili yap
            const hit = this.getObjectAt(mouseX, mouseY);
            if (hit) {
                this.selectedObject = hit.obj;
                this.selectedObjectType = hit.type;
            }
            this.updateInspector();
        }
    }

    /**
     * Mouse koordinatlarında duran objeyi bulur
     */
    getObjectAt(mx, my) {
        const lvl = this.game.level;

        // 1. Oyuncu Spawn
        const dxs = mx - lvl.spawnX;
        const dys = my - lvl.spawnY;
        if (Math.sqrt(dxs*dxs + dys*dys) < 20) {
            return { type: 'spawn', obj: { x: lvl.spawnX, y: lvl.spawnY } };
        }

        // Checkpoints
        if (lvl.checkpoints) {
            for (const cp of lvl.checkpoints) {
                const dx = mx - cp.x;
                const dy = my - cp.y;
                if (Math.sqrt(dx*dx + dy*dy) < 18) {
                    return { type: 'checkpoint', obj: cp };
                }
            }
        }

        // 2. Portal
        if (mx > lvl.portal.x && mx < lvl.portal.x + lvl.portal.w &&
            my > lvl.portal.y && my < lvl.portal.y + lvl.portal.h) {
            return { type: 'portal', obj: lvl.portal };
        }

        // 3. Collectibles
        for (const c of lvl.collectibles) {
            const dx = mx - c.x;
            const dy = my - c.y;
            if (Math.sqrt(dx*dx + dy*dy) < 15) {
                return { type: 'collectible', obj: c };
            }
        }

        // 4. Enemies
        for (const e of lvl.enemies) {
            const dx = mx - e.x;
            const dy = my - e.y;
            if (Math.sqrt(dx*dx + dy*dy) < 18) {
                return { type: 'enemy', obj: e };
            }
        }

        // 5. Gates
        for (const g of lvl.gates) {
            if (mx > g.x && mx < g.x + g.w && my > g.y && my < g.y + g.h) {
                return { type: 'gate', obj: g };
            }
        }

        // 6. Moving platforms
        for (const mp of lvl.movingPlatforms) {
            if (mx > mp.x && mx < mp.x + mp.w && my > mp.y && my < mp.y + mp.h) {
                return { type: 'movingPlatform', obj: mp };
            }
        }

        // 7. Hazards
        for (const h of lvl.hazards) {
            if (mx > h.x && mx < h.x + h.w && my > h.y && my < h.y + h.h) {
                return { type: 'hazard', obj: h };
            }
        }

        if (lvl.laserEmitters) {
            for (const e of lvl.laserEmitters) {
                if (mx > e.x && mx < e.x + e.w && my > e.y && my < e.y + e.h) {
                    return { type: 'laserEmitter', obj: e };
                }
            }
        }

        if (lvl.laserReceivers) {
            for (const r of lvl.laserReceivers) {
                if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
                    return { type: 'laserReceiver', obj: r };
                }
            }
        }

        if (lvl.staticMirrors) {
            for (const m of lvl.staticMirrors) {
                if (mx > m.x && mx < m.x + m.w && my > m.y && my < m.y + m.h) {
                    return { type: 'staticMirror', obj: m };
                }
            }
        }

        // --- NEW INTERACTIVE MECHANICS DETECTIONS ---
        if (lvl.pressurePlates) {
            for (const pp of lvl.pressurePlates) {
                if (mx > pp.x && mx < pp.x + pp.w && my > pp.y && my < pp.y + pp.h) {
                    return { type: 'pressurePlate', obj: pp };
                }
            }
        }

        if (lvl.pushBlocks) {
            for (const pb of lvl.pushBlocks) {
                if (mx > pb.x && mx < pb.x + pb.w && my > pb.y && my < pb.y + pb.h) {
                    return { type: 'pushBlock', obj: pb };
                }
            }
        }

        if (lvl.conveyors) {
            for (const c of lvl.conveyors) {
                if (mx > c.x && mx < c.x + c.w && my > c.y && my < c.y + c.h) {
                    return { type: 'conveyor', obj: c };
                }
            }
        }

        if (lvl.bouncePads) {
            for (const bp of lvl.bouncePads) {
                if (mx > bp.x && mx < bp.x + bp.w && my > bp.y && my < bp.y + bp.h) {
                    return { type: 'bouncePad', obj: bp };
                }
            }
        }

        if (lvl.buttons) {
            for (const b of lvl.buttons) {
                if (mx > b.x && mx < b.x + b.w && my > b.y && my < b.y + b.h) {
                    return { type: 'button', obj: b };
                }
            }
        }

        if (lvl.levers) {
            for (const l of lvl.levers) {
                if (mx > l.x && mx < l.x + l.w && my > l.y && my < l.y + l.h) {
                    return { type: 'lever', obj: l };
                }
            }
        }

        if (lvl.teleportPairs) {
            for (const tp of lvl.teleportPairs) {
                // Portal 1: 40x60
                if (mx > tp.x1 && mx < tp.x1 + 40 && my > tp.y1 && my < tp.y1 + 60) {
                    this.draggedPortalEnd = 1;
                    return { type: 'teleportPair', obj: tp };
                }
                // Portal 2: 40x60
                if (mx > tp.x2 && mx < tp.x2 + 40 && my > tp.y2 && my < tp.y2 + 60) {
                    this.draggedPortalEnd = 2;
                    return { type: 'teleportPair', obj: tp };
                }
            }
        }
        if (lvl.fallingPlatforms) {
            for (const fp of lvl.fallingPlatforms) {
                if (mx > fp.x && mx < fp.x + fp.w && my > fp.y && my < fp.y + fp.h) {
                    return { type: 'fallingPlatform', obj: fp };
                }
            }
        }

        if (lvl.breakablePlatforms) {
            for (const bp of lvl.breakablePlatforms) {
                if (mx > bp.x && mx < bp.x + bp.w && my > bp.y && my < bp.y + bp.h) {
                    return { type: 'breakablePlatform', obj: bp };
                }
            }
        }

        if (lvl.hiddenPassages) {
            for (const hp of lvl.hiddenPassages) {
                if (mx > hp.x && mx < hp.x + hp.w && my > hp.y && my < hp.y + hp.h) {
                    return { type: 'hiddenPassage', obj: hp };
                }
            }
        }

        if (lvl.fallingBlockTraps) {
            for (const fbt of lvl.fallingBlockTraps) {
                if (mx > fbt.x && mx < fbt.x + fbt.w && my > fbt.y && my < fbt.y + fbt.h) {
                    return { type: 'fallingBlockTrap', obj: fbt };
                }
            }
        }

        if (lvl.vantuzPoints) {
            for (const vp of lvl.vantuzPoints) {
                const dx = mx - vp.x;
                const dy = my - vp.y;
                if (Math.sqrt(dx*dx + dy*dy) < 15) {
                    return { type: 'vantuzPoint', obj: vp };
                }
            }
        }

        if (lvl.decorations) {
            for (const d of lvl.decorations) {
                if (mx > d.x && mx < d.x + d.w && my > d.y && my < d.y + d.h) {
                    return { type: 'decoration', obj: d };
                }
            }
        }

        if (lvl.flamethrowers) {
            for (const f of lvl.flamethrowers) {
                if (mx > f.x && mx < f.x + f.w && my > f.y && my < f.y + f.h) {
                    return { type: 'flamethrower', obj: f };
                }
            }
        }

        if (lvl.arrowShooters) {
            for (const a of lvl.arrowShooters) {
                if (mx > a.x && mx < a.x + a.w && my > a.y && my < a.y + a.h) {
                    return { type: 'arrowShooter', obj: a };
                }
            }
        }

        // 8. Platforms (Tersten arat ki üsttekiler önce seçilsin)
        for (let i = lvl.platforms.length - 1; i >= 0; i--) {
            const p = lvl.platforms[i];
            if (mx > p.x && mx < p.x + p.w && my > p.y && my < p.y + p.h) {
                return { type: 'platform', obj: p };
            }
        }

        return null;
    }

    /**
     * Mouse sürükleme güncellemeleri
     */
    onMouseMove(e) {
        if (!this.active || this.game.state !== 'EDITOR') return;

        // 1. Kamera Kaydırma (Pan)
        if (this.isPanning) {
            const dx = e.clientX - this.panStartX;
            const dy = e.clientY - this.panStartY;
            const zoom = this.game.camera.zoom || 1.0;
            this.game.camera.x = this.cameraStartX - dx / zoom;
            this.game.camera.y = this.cameraStartY - dy / zoom;
            this.clampCamera();
            return;
        }

        // 2. Obje Sürükleme (Drag)
        if (this.isDragging && this.selectedObject) {
            const rect = this.game.canvas.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            const zoom = this.game.camera.zoom || 1.0;
            const halfW = this.game.cssWidth / 2;
            const halfH = this.game.cssHeight / 2;
            
            const mouseX = (clientX - halfW) / zoom + this.game.camera.x + halfW;
            const mouseY = (clientY - halfH) / zoom + this.game.camera.y + halfH;
            
            let newX = mouseX - this.dragOffsetX;
            let newY = mouseY - this.dragOffsetY;

            if (this.gridSnap) {
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }

            const type = this.selectedObjectType;
            const obj = this.selectedObject;

            if (type === 'spawn') {
                this.game.level.spawnX = Math.max(0, Math.min(newX, 25000));
                this.game.level.spawnY = Math.max(0, Math.min(newY, 15000));
            } else if (type === 'portal') {
                obj.x = Math.max(-5000, Math.min(newX, 25000));
                obj.y = Math.max(-5000, Math.min(newY, 15000));
            } else if (type === 'collectible' || type === 'enemy') {
                obj.x = Math.max(-5000, Math.min(newX, 25000));
                obj.y = Math.max(-5000, Math.min(newY, 15000));
            } else if (type === 'movingPlatform') {
                const diffX = newX - obj.x;
                const diffY = newY - obj.y;
                obj.x = Math.max(-5000, Math.min(newX, 25000));
                obj.y = Math.max(-5000, Math.min(newY, 15000));
                obj.startX = obj.x;
                obj.startY = obj.y;
                obj.targetX = Math.max(-5000, Math.min(obj.targetX + diffX, 25000));
                obj.targetY = Math.max(-5000, Math.min(obj.targetY + diffY, 15000));
            } else if (type === 'teleportPair') {
                if (this.draggedPortalEnd === 1) {
                    obj.x1 = Math.max(-5000, Math.min(newX, 25000));
                    obj.y1 = Math.max(-5000, Math.min(newY, 15000));
                } else {
                    obj.x2 = Math.max(-5000, Math.min(newX, 25000));
                    obj.y2 = Math.max(-5000, Math.min(newY, 15000));
                }
            } else {
                obj.x = Math.max(-5000, Math.min(newX, 25000));
                obj.y = Math.max(-5000, Math.min(newY, 15000));
                if (obj.startX !== undefined) {
                    obj.startX = obj.x;
                    obj.startY = obj.y;
                }
            }

            this.updateInspector();
        }
    }

    onMouseUp(e) {
        if (this.isDragging) {
            this.saveToLocalStorage(); // Auto-save after dragging
        }
        this.isPanning = false;
        this.isDragging = false;
    }

    /**
     * Klavye kısayol tuşları (Basma)
     */
    onKeyDown(e) {
        if (!this.active) return;
        
        // Eğer bir input alanı seçiliyse kısayol tuşlarını devre dışı bırak
        if (this.inputFocused) return;

        // 1. Playtest modundayken (PLAYING, GAMEOVER veya WIN) ESC/T basılırsa editöre dön
        if (this.game.state === 'PLAYING' || this.game.state === 'GAMEOVER' || this.game.state === 'WIN') {
            if (e.key === 'Escape' || e.key === 't' || e.key === 'T') {
                this.stopPlaytest();
                e.preventDefault();
            }
            return;
        }

        if (this.game.state !== 'EDITOR') return;

        // Yön ve WASD tuşlarını takip et
        if (e.key && e.key in this.keys) {
            this.keys[e.key] = true;
        }
        const lowerKey = e.key ? e.key.toLowerCase() : '';
        if (lowerKey === 'w' || lowerKey === 'a' || lowerKey === 's' || lowerKey === 'd') {
            this.keys[lowerKey] = true;
        }
        if (e.key === 'Shift') {
            this.keys['Shift'] = true;
        }

        // 2. Playtest Başlat (P)
        if (e.key === 'p' || e.key === 'P') {
            this.startPlaytest();
            e.preventDefault();
        }

        // 3. Seçili Objeyi Sil (Delete / Backspace)
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedObject) {
            this.deleteSelected();
            e.preventDefault();
        }

        // 4. Yan Paneli Gizle / Göster (Tab)
        if (e.key === 'Tab') {
            this.togglePanel();
            e.preventDefault();
        }
    }

    /**
     * Klavye kısayol tuşları (Bırakma)
     */
    onKeyUp(e) {
        if (!this.active) return;
        
        if (e.key && e.key in this.keys) {
            this.keys[e.key] = false;
        }
        const lowerKey = e.key ? e.key.toLowerCase() : '';
        if (lowerKey === 'w' || lowerKey === 'a' || lowerKey === 's' || lowerKey === 'd') {
            this.keys[lowerKey] = false;
        }
        if (e.key === 'Shift') {
            this.keys['Shift'] = false;
        }
    }

    /**
     * Mouse tekerleği ile zoom kontrolü
     */
    onWheel(e) {
        if (!this.active || this.game.state !== 'EDITOR') return;
        e.preventDefault(); // Sayfa kaydırmayı engelle

        const oldZoom = this.game.camera.zoom || 1.0;
        const zoomFactor = 1.15;
        let newZoom = oldZoom;

        if (e.deltaY < 0) {
            // Zoom In (Max 3.0x)
            newZoom = Math.min(3.0, oldZoom * zoomFactor);
        } else {
            // Zoom Out (Min 0.3x)
            newZoom = Math.max(0.3, oldZoom / zoomFactor);
        }

        if (newZoom !== oldZoom) {
            const rect = this.game.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const halfW = this.game.cssWidth / 2;
            const halfH = this.game.cssHeight / 2;

            // Zoom'u fare imlecine göre odakla (Centering)
            this.game.camera.x += (mouseX - halfW) * (1 / oldZoom - 1 / newZoom);
            this.game.camera.y += (mouseY - halfH) * (1 / oldZoom - 1 / newZoom);

            this.game.camera.zoom = newZoom;
            this.clampCamera();
        }
    }

    /**
     * Mobil dokunmatik pinch zoom ve sürükleme başlangıcı
     */
    handleTouchStart(e) {
        if (!this.active || this.game.state !== 'EDITOR') return;

        if (e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            this.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
            this.touchStartZoom = this.game.camera.zoom || 1.0;
            this.isPanning = false;
            this.isDragging = false;
        } else if (e.touches.length === 1) {
            const t = e.touches[0];
            this.touchStartX = t.clientX;
            this.touchStartY = t.clientY;
            this.touchHasMoved = false;

            const rect = this.game.canvas.getBoundingClientRect();
            const clientX = t.clientX - rect.left;
            const clientY = t.clientY - rect.top;
            const zoom = this.game.camera.zoom || 1.0;
            const halfW = this.game.cssWidth / 2;
            const halfH = this.game.cssHeight / 2;
            
            const mouseX = (clientX - halfW) / zoom + this.game.camera.x + halfW;
            const mouseY = (clientY - halfH) / zoom + this.game.camera.y + halfH;

            // 0. CHECK DELETE OVERLAY
            if (this.deleteOverlayObject) {
                const center = this.getObjectCenter(this.deleteOverlayObject, this.deleteOverlayObjectType);
                const distToX = Math.sqrt(Math.pow(mouseX - center.x, 2) + Math.pow(mouseY - center.y, 2));
                if (distToX < 20) {
                    const objToDelete = this.deleteOverlayObject;
                    const typeToDelete = this.deleteOverlayObjectType;
                    this.deleteOverlayObject = null;
                    this.deleteOverlayObjectType = '';
                    
                    this.selectedObject = objToDelete;
                    this.selectedObjectType = typeToDelete;
                    this.deleteSelected();
                    return;
                } else {
                    this.deleteOverlayObject = null;
                    this.deleteOverlayObjectType = '';
                }
            }

            if (this.activeTool === 'select') {
                const hit = this.getObjectAt(mouseX, mouseY);
                if (hit) {
                    // Double tap detection
                    const now = performance.now();
                    if (now - this.lastClickTime < 300 && this.lastClickObject === hit.obj) {
                        if (hit.type !== 'spawn' && hit.type !== 'portal') {
                            this.deleteOverlayObject = hit.obj;
                            this.deleteOverlayObjectType = hit.type;
                            this.selectedObject = hit.obj;
                            this.selectedObjectType = hit.type;
                            this.updateInspector();
                            
                            this.lastClickTime = 0;
                            this.lastClickObject = null;
                            this.isDragging = false;
                            this.isPanning = false;
                            return;
                        }
                    } else {
                        this.lastClickTime = now;
                        this.lastClickObject = hit.obj;
                        this.lastClickX = mouseX;
                        this.lastClickY = mouseY;
                    }

                    this.selectedObject = hit.obj;
                    this.selectedObjectType = hit.type;
                    this.isDragging = true;
                    this.isPanning = false;
                    
                    if (hit.type === 'spawn') {
                        this.dragOffsetX = mouseX - this.game.level.spawnX;
                        this.dragOffsetY = mouseY - this.game.level.spawnY;
                    } else if (hit.type === 'portal' || hit.type === 'collectible') {
                        this.dragOffsetX = mouseX - (hit.obj.x + 20);
                        this.dragOffsetY = mouseY - (hit.obj.y + 30);
                    } else if (hit.type === 'teleportPair') {
                        if (this.draggedPortalEnd === 1) {
                            this.dragOffsetX = mouseX - hit.obj.x1;
                            this.dragOffsetY = mouseY - hit.obj.y1;
                        } else {
                            this.dragOffsetX = mouseX - hit.obj.x2;
                            this.dragOffsetY = mouseY - hit.obj.y2;
                        }
                    } else {
                        this.dragOffsetX = mouseX - hit.obj.x;
                        this.dragOffsetY = mouseY - hit.obj.y;
                    }
                    audio.playPlateActivate(); // Hafif çıt sesi
                } else {
                    this.selectedObject = null;
                    this.selectedObjectType = '';
                    this.isDragging = false;
                    this.isPanning = true;
                    this.panStartX = t.clientX;
                    this.panStartY = t.clientY;
                    this.cameraStartX = this.game.camera.x;
                    this.cameraStartY = this.game.camera.y;
                }
                this.updateInspector();
            } else {
                // Yaratım modunda varsayılan olarak kaydırma (Pan) başlat
                // Eğer parmak hareket ettirilmeden çekilirse (tap), handleTouchEnd objeyi yerleştirecek
                this.isPanning = true;
                this.panStartX = t.clientX;
                this.panStartY = t.clientY;
                this.cameraStartX = this.game.camera.x;
                this.cameraStartY = this.game.camera.y;
            }
        }
    }

    /**
     * Mobil dokunmatik pinch zoom ve sürükleme hareketi
     */
    handleTouchMove(e) {
        if (!this.active || this.game.state !== 'EDITOR') return;

        if (e.touches.length === 2 && this.touchStartDistance > 0) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const scale = dist / this.touchStartDistance;
            let newZoom = Math.max(0.3, Math.min(3.0, this.touchStartZoom * scale));

            const rect = this.game.canvas.getBoundingClientRect();
            const centerX = ((t1.clientX + t2.clientX) / 2) - rect.left;
            const centerY = ((t1.clientY + t2.clientY) / 2) - rect.top;

            const oldZoom = this.game.camera.zoom || 1.0;
            if (newZoom !== oldZoom) {
                const halfW = this.game.cssWidth / 2;
                const halfH = this.game.cssHeight / 2;

                this.game.camera.x += (centerX - halfW) * (1 / oldZoom - 1 / newZoom);
                this.game.camera.y += (centerY - halfH) * (1 / oldZoom - 1 / newZoom);

                this.game.camera.zoom = newZoom;
                this.clampCamera();
            }
        } else if (e.touches.length === 1) {
            const t = e.touches[0];

            // Dokunma hareket etti mi kontrol et (hata marjı: 8px)
            const moveDist = Math.sqrt(Math.pow(t.clientX - this.touchStartX, 2) + Math.pow(t.clientY - this.touchStartY, 2));
            if (moveDist > 8) {
                this.touchHasMoved = true;
            }

            if (this.isDragging && this.selectedObject) {
                e.preventDefault();
                const rect = this.game.canvas.getBoundingClientRect();
                const clientX = t.clientX - rect.left;
                const clientY = t.clientY - rect.top;
                const zoom = this.game.camera.zoom || 1.0;
                const halfW = this.game.cssWidth / 2;
                const halfH = this.game.cssHeight / 2;
                
                const mouseX = (clientX - halfW) / zoom + this.game.camera.x + halfW;
                const mouseY = (clientY - halfH) / zoom + this.game.camera.y + halfH;
                
                let newX = mouseX - this.dragOffsetX;
                let newY = mouseY - this.dragOffsetY;

                if (this.gridSnap) {
                    newX = Math.round(newX / this.gridSize) * this.gridSize;
                    newY = Math.round(newY / this.gridSize) * this.gridSize;
                }

                const type = this.selectedObjectType;
                const obj = this.selectedObject;

                if (type === 'spawn') {
                    this.game.level.spawnX = newX;
                    this.game.level.spawnY = newY;
                } else if (type === 'portal') {
                    obj.x = newX;
                    obj.y = newY;
                } else if (type === 'collectible' || type === 'enemy') {
                    obj.x = newX;
                    obj.y = newY;
                } else if (type === 'movingPlatform') {
                    const diffX = newX - obj.x;
                    const diffY = newY - obj.y;
                    obj.x = newX;
                    obj.y = newY;
                    obj.startX = newX;
                    obj.startY = newY;
                    obj.targetX += diffX;
                    obj.targetY += diffY;
                } else if (type === 'teleportPair') {
                    if (this.draggedPortalEnd === 1) {
                        obj.x1 = newX;
                        obj.y1 = newY;
                    } else {
                        obj.x2 = newX;
                        obj.y2 = newY;
                    }
                } else {
                    obj.x = newX;
                    obj.y = newY;
                    if (obj.startX !== undefined) {
                        obj.startX = newX;
                        obj.startY = newY;
                    }
                }
                this.updateInspector();
            } else if (this.isPanning) {
                e.preventDefault();
                const dx = t.clientX - this.panStartX;
                const dy = t.clientY - this.panStartY;
                const zoom = this.game.camera.zoom || 1.0;
                this.game.camera.x = this.cameraStartX - dx / zoom;
                this.game.camera.y = this.cameraStartY - dy / zoom;
                this.clampCamera();
            }
        }
    }

    /**
     * Dokunma bitişi
     */
    handleTouchEnd(e) {
        this.touchStartDistance = 0;

        if (this.isDragging) {
            this.saveToLocalStorage(); // Sürükleme sonrası kaydet
        }

        // Eğer kaydırma/sürükleme yapılmadıysa ve yaratım modundaysa objeyi yerleştir
        if (!this.touchHasMoved && this.activeTool !== 'select') {
            this.onMouseDown({
                clientX: this.touchStartX,
                clientY: this.touchStartY,
                button: 0,
                preventDefault: () => {}
            });
        }

        this.isPanning = false;
        this.isDragging = false;
    }

    /**
     * Kamera koordinatlarını harita sınırları içinde tutar (Zoom-aware)
     */
    clampCamera() {
        const zoom = this.game.camera.zoom || 1.0;
        const visibleW = this.game.cssWidth / zoom;
        const visibleH = this.game.cssHeight / zoom;

        // Harita dışına çıkmayı engelle (Sınırlar)
        const minX = 0;
        
        // Editör paneli açıksa ve gizlenmemişse sağ tarafa 320px ek boşluk hakkı tanı
        const panelWidth = (!this.panel || this.panel.classList.contains('collapsed')) ? 0 : 320;
        const maxX = Math.max(0, this.game.level.width - visibleW + (panelWidth / zoom));
        
        const minY = -350; // Üst boşluk toleransı (Artırıldı)
        const maxY = Math.max(0, this.game.level.height - visibleH + 350);

        this.game.camera.x = Math.max(minX, Math.min(this.game.camera.x, maxX));
        this.game.camera.y = Math.max(minY, Math.min(this.game.camera.y, maxY));
    }

    /**
     * Her karede akıcı kamera hareketi ve güncellemeler (Game loop)
     */
    update(dt) {
        if (!this.active || this.game.state !== 'EDITOR') return;

        // Akıcı kamera kaydırma hızı (Shift basılırsa 2.5 kat hızlı)
        const baseSpeed = 8;
        const speed = this.keys['Shift'] ? baseSpeed * 2.5 : baseSpeed;
        
        let dx = 0;
        let dy = 0;

        if (this.keys['ArrowLeft'] || this.keys['a']) dx -= speed;
        if (this.keys['ArrowRight'] || this.keys['d']) dx += speed;
        if (this.keys['ArrowUp'] || this.keys['w']) dy -= speed;
        if (this.keys['ArrowDown'] || this.keys['s']) dy += speed;

        if (dx !== 0 || dy !== 0) {
            const zoom = this.game.camera.zoom || 1.0;
            this.game.camera.x += (dx / zoom) * dt;
            this.game.camera.y += (dy / zoom) * dt;
            this.clampCamera();
        }
    }

    /**
     * Objenin merkez koordinatlarını döner
     */
    getObjectCenter(obj, type) {
        if (type === 'spawn') {
            return { x: this.game.level.spawnX, y: this.game.level.spawnY };
        }
        if (type === 'portal') {
            return { x: obj.x + (obj.w || 40) / 2, y: obj.y + (obj.h || 60) / 2 };
        }
        if (type === 'collectible') {
            return { x: obj.x, y: obj.y };
        }
        if (type === 'enemy') {
            return { x: obj.x, y: obj.y };
        }
        if (type === 'teleportPair') {
            const d1 = Math.pow(this.lastClickX - (obj.x1 + 20), 2) + Math.pow(this.lastClickY - (obj.y1 + 30), 2);
            const d2 = Math.pow(this.lastClickX - (obj.x2 + 20), 2) + Math.pow(this.lastClickY - (obj.y2 + 30), 2);
            if (d1 < d2) {
                return { x: obj.x1 + 20, y: obj.y1 + 30 };
            } else {
                return { x: obj.x2 + 20, y: obj.y2 + 30 };
            }
        }
        if (type === 'checkpoint') {
            return { x: obj.x, y: obj.y };
        }
        
        const w = obj.w !== undefined ? obj.w : 40;
        const h = obj.h !== undefined ? obj.h : 40;
        return { x: obj.x + w / 2, y: obj.y + h / 2 };
    }

    /**
     * Editör Çizim Arayüzü (Grid ve Seçim Alanı)
     */
    draw(ctx) {
        if (!this.active || this.game.state !== 'EDITOR') return;

        ctx.save();
        ctx.translate(-this.game.camera.x, -this.game.camera.y);

        // 1. Izgara (Grid Lines) Çizimi
        if (this.gridSnap) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            
            const startX = Math.floor(this.game.camera.x / this.gridSize) * this.gridSize;
            const endX = startX + this.game.cssWidth + this.gridSize;
            const startY = Math.floor(this.game.camera.y / this.gridSize) * this.gridSize;
            const endY = startY + this.game.cssHeight + this.gridSize;

            for (let x = startX; x < endX; x += this.gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, startY);
                ctx.lineTo(x, endY);
                ctx.stroke();
            }
            for (let y = startY; y < endY; y += this.gridSize) {
                ctx.beginPath();
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // 2. Oyuncu Spawn Noktası Göstergesi
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.game.level.spawnX, this.game.level.spawnY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#10b981';
        ctx.font = '10px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('SPAWN', this.game.level.spawnX, this.game.level.spawnY - 24);
        ctx.restore();

        // 3. Seçim Kutusu Çizimi (Selected Object Highlight)
        if (this.selectedObject) {
            ctx.save();
            ctx.strokeStyle = '#d946ef';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 10;

            const obj = this.selectedObject;
            const type = this.selectedObjectType;

            if (type === 'spawn') {
                ctx.beginPath();
                ctx.arc(this.game.level.spawnX, this.game.level.spawnY, 21, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'portal') {
                ctx.strokeRect(obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);
            } else if (type === 'collectible') {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, 16, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'enemy') {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, 22, 0, Math.PI * 2);
                ctx.stroke();

                // Düşman devriye menzil çizgisi
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(obj.x - obj.rangeX, obj.y);
                ctx.lineTo(obj.x + obj.rangeX, obj.y);
                ctx.stroke();

                ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
                ctx.fillRect(obj.x - obj.rangeX - 2, obj.y - 6, 4, 12);
                ctx.fillRect(obj.x + obj.rangeX - 2, obj.y - 6, 4, 12);
            } else if (type === 'movingPlatform') {
                ctx.strokeRect(obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);

                // Yol rotasını çiz (hedef noktaya kesikli çizgi)
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(obj.startX + obj.w / 2, obj.startY + obj.h / 2);
                ctx.lineTo(obj.targetX + obj.w / 2, obj.targetY + obj.h / 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Hedefte hayali bir platform kutusu
                ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
                ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
                ctx.strokeRect(obj.targetX, obj.targetY, obj.w, obj.h);
                ctx.fillRect(obj.targetX, obj.targetY, obj.w, obj.h);
            } else if (type === 'teleportPair') {
                ctx.strokeRect(obj.x1 - 4, obj.y1 - 4, 48, 68);
                ctx.strokeRect(obj.x2 - 4, obj.y2 - 4, 48, 68);
                
                // Draw connecting dashed line
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#a855f7';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(obj.x1 + 20, obj.y1 + 30);
                ctx.lineTo(obj.x2 + 20, obj.y2 + 30);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (type === 'checkpoint') {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.r + 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'decoration') {
                ctx.save();
                if (obj.rotation) {
                    ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
                    ctx.rotate(obj.rotation);
                    ctx.translate(-(obj.x + obj.w / 2), -(obj.y + obj.h / 2));
                }
                ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
                ctx.restore();
            } else {
                ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
            }

            ctx.restore();
        }

        // 3.5. Obje Silme (Double Click X Overlay) Gösterimi
        if (this.deleteOverlayObject) {
            ctx.save();
            const obj = this.deleteOverlayObject;
            const type = this.deleteOverlayObjectType;
            const center = this.getObjectCenter(obj, type);
            
            // Pulsing scale
            const pulse = 1 + Math.sin(Date.now() / 150) * 0.08;
            const radius = 16 * pulse;
            
            // Draw red glow around the object
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 15;
            
            // Highlight the object with a red border
            if (type === 'spawn') {
                ctx.beginPath();
                ctx.arc(this.game.level.spawnX, this.game.level.spawnY, 21, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'portal') {
                ctx.strokeRect(obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);
            } else if (type === 'collectible') {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, 16, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'enemy') {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, 22, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'movingPlatform') {
                ctx.strokeRect(obj.x - 4, obj.y - 4, obj.w + 8, obj.h + 8);
            } else if (type === 'teleportPair') {
                ctx.strokeRect(obj.x1 - 4, obj.y1 - 4, 48, 68);
                ctx.strokeRect(obj.x2 - 4, obj.y2 - 4, 48, 68);
            } else if (type === 'checkpoint') {
                ctx.beginPath();
                ctx.arc(obj.x, obj.y, obj.r + 3, 0, Math.PI * 2);
                ctx.stroke();
            } else if (type === 'decoration') {
                ctx.save();
                if (obj.rotation) {
                    ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
                    ctx.rotate(obj.rotation);
                    ctx.translate(-(obj.x + obj.w / 2), -(obj.y + obj.h / 2));
                }
                ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
                ctx.restore();
            } else {
                const w = obj.w !== undefined ? obj.w : 40;
                const h = obj.h !== undefined ? obj.h : 40;
                ctx.strokeRect(obj.x - 3, obj.y - 3, w + 6, h + 6);
            }
            
            // Draw the red delete button
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw 'X' lines inside the circle
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            const size = 6 * pulse;
            ctx.beginPath();
            ctx.moveTo(center.x - size, center.y - size);
            ctx.lineTo(center.x + size, center.y + size);
            ctx.moveTo(center.x + size, center.y - size);
            ctx.lineTo(center.x - size, center.y + size);
            ctx.stroke();
            
            ctx.restore();
        }

        // 4. Sağ Kenar Sınır Çizgisi
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(this.game.level.width, 0);
        ctx.lineTo(this.game.level.width, this.game.level.height);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.font = '10px Outfit';
        ctx.fillText('HARİTA SAĞ SINIRI', this.game.level.width - 100, 20);
        ctx.restore();

        // 5. Ok Fırlatıcıları Çiz (editör statik görünümü)
        const lvl = this.game.level;
        if (lvl.arrowShooters) {
            lvl.arrowShooters.forEach(a => {
                const cx = a.x + a.w / 2;
                const cy = a.y + a.h / 2;

                // Algılama yarıçapı çemberi
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, a.detectionRadius || 200, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
                ctx.fill();
                ctx.setLineDash([]);
                ctx.restore();

                // Ok fırlatıcı gövdesi (basit önizleme)
                ctx.save();
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#c8963c';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(a.x, a.y, a.w, a.h, 6);
                ctx.fill();
                ctx.stroke();

                // Mavi kristal
                ctx.beginPath();
                ctx.arc(cx, cy, a.w * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = '#0ea5e9';
                ctx.shadowColor = '#06b6d4';
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;

                // Yön ok simgesi
                ctx.fillStyle = '#94a3b8';
                ctx.font = '14px Outfit';
                ctx.textAlign = 'center';
                const dirEmoji = a.dir === 'right' ? '→' : a.dir === 'left' ? '←' : a.dir === 'up' ? '↑' : a.dir === 'down' ? '↓' : '⊙';
                ctx.fillText(dirEmoji, cx, cy + a.h * 0.55);
                ctx.restore();

                // Etiket
                ctx.save();
                ctx.fillStyle = '#67e8f9';
                ctx.font = '9px Outfit';
                ctx.textAlign = 'center';
                ctx.fillText('🏹 OK FIR.', cx, a.y - 6);
                ctx.restore();
            });
        }

        // 6. Düşmanları Çiz (Static Editor view for dev)
        if (lvl.enemies) {
            lvl.enemies.forEach(e => {
                ctx.save();
                if (e.type === 'chaser') {
                    ctx.fillStyle = '#10b981'; // Green gel color
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '11px Outfit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🧬', e.x, e.y);
                } else if (e.type === 'tractor_ufo') {
                    ctx.fillStyle = '#a855f7'; // Purple UFO
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '11px Outfit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🛸🧲', e.x, e.y);
                } else if (e.type === 'sweeper_ufo') {
                    ctx.fillStyle = '#06b6d4'; // Cyan Laser UFO
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '11px Outfit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🛸⚡', e.x, e.y);
                } else {
                    ctx.fillStyle = e.color || '#f43f5e';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(e.x - 8, e.y); ctx.lineTo(e.x + 8, e.y);
                    ctx.moveTo(e.x, e.y - 8); ctx.lineTo(e.x, e.y + 8);
                    ctx.stroke();
                }
                ctx.restore();
            });
        }

        ctx.restore();
    }
}


