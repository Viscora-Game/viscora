import { Player } from './player.js?v=v273';
import { Level } from './level.js?v=v273';
import { Enemy, GelChaser, TractorUFO, SweeperUFO } from './enemies.js?v=v273';
import { UIManager } from './ui.js?v=v273';
import { CloudSaveManager } from './cloud_save.js?v=v273';
import { audio } from './audio.js?v=v273';
import { LevelEditor } from './editor.js?v=v273';
import { Boss, CyberBoss, UfoBoss } from './boss.js?v=v273';

const LEVEL_NAMES = [
    "EĞİTİM LABORATUVARI",
    "NEON GİRİŞİ",
    "YAPIŞKAN GEÇİTLER",
    "KONVEYÖR HATTI",
    "YAPIŞKAN DEHLİZ",
    "BOYUTSAL KORİDOR",
    "KARGO DEPOSU",
    "ÇÖKEN SEKTÖR",
    "TOKSİK HAVZA",
    "KİMYASAL REAKTÖR",
    "KOZMİK ÇEKİRDEK",
    "ÖLÜMCÜL BASINÇ ODASI",
    "SİBER VERİ AKIŞI",
    "TOKSİK PORTAL AĞI",
    "HAVALANDIRMA ŞAFTI",
    "ASİT KANALLARI",
    "MEKANİK KORİDORLAR",
    "KONTAMİNASYON ODASI",
    "FİLTRELEME TESİSİ",
    "SİBER KANALİZASYON",
    "VISCOREX REAKTÖRÜ",
    "SİBER VERİ AKIŞI: SİBER GİRİŞİ",
    "SİBER VERİ AKIŞI: MİKROÇİP LABİRENTİ",
    "SİBER VERİ AKIŞI: PORTAL BAĞLANTISI",
    "SİBER VERİ AKIŞI: KRONO TETİKLEYİCİ",
    "SİBER VERİ AKIŞI: YERÇEKİMİ BOŞLUĞU",
    "SİBER VERİ AKIŞI: KARA DÜŞMAN ALANI",
    "SİBER VERİ AKIŞI: LAZER KAFESİ",
    "SİBER VERİ AKIŞI: KOD DEPOSU",
    "SİBER VERİ AKIŞI: SİBER KANALİZASYON II",
    "SİBER VERİ AKIŞI: SON GETİREN"
];

// Bölüm bazlı bağlamsal ipuçları — ilk kez tanıtılan mekanikler için kısa yardım metinleri
const LEVEL_HINTS = {
    0:  '⚡ E ile Form Değiştir!',
    1:  '⚡ Pembe Formda Duvara Yapış!',
    3:  '⚠ Bantlara Dikkat, Pembe Sızar!',
    5:  '⚠ Bazı Zeminler Çöker!',
    6:  '◆ Kutuları İt, Plakalara Bas!',
    9:  '⚠ Pembe Form Alevlere Dayanır!',
    10: '☠ Kutuları Boss\'a Düşür!',
    16: '⚡ Lazerleri Aynalarla Yönlendir!',
    17: '⚠ Oklara Dikkat Et!',
    20: '☠ Fazlarını Öğren, Vuruşları Sav!'
};

export class GameManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        window.gameInstance = this;
        this.pausedForCustomizer = false;
        this.physicsAccumulator = 0;
        
        // Oyun Durumu
        // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'WIN'
        this.state = 'MENU';
        this.isCommunityPlay = false;
        this.showDebug = false; // F3 ile hata ayıklama katmanını göster/gizle
        
        // Çözünürlük ve Boyutlar
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Fullscreen geçişlerinde ekran boyutlarının gecikmeli güncellenmesini önlemek için dinleyiciler
        document.addEventListener('fullscreenchange', () => {
            this.resizeCanvas();
            setTimeout(() => this.resizeCanvas(), 100);
            setTimeout(() => this.resizeCanvas(), 300);
            setTimeout(() => this.resizeCanvas(), 600);
        });
        document.addEventListener('webkitfullscreenchange', () => {
            this.resizeCanvas();
            setTimeout(() => this.resizeCanvas(), 100);
            setTimeout(() => this.resizeCanvas(), 300);
            setTimeout(() => this.resizeCanvas(), 600);
        });
        document.addEventListener('mozfullscreenchange', () => {
            this.resizeCanvas();
            setTimeout(() => this.resizeCanvas(), 100);
            setTimeout(() => this.resizeCanvas(), 300);
            setTimeout(() => this.resizeCanvas(), 600);
        });
        document.addEventListener('MSFullscreenChange', () => {
            this.resizeCanvas();
            setTimeout(() => this.resizeCanvas(), 100);
            setTimeout(() => this.resizeCanvas(), 300);
            setTimeout(() => this.resizeCanvas(), 600);
        });

        // Modül Nesneleri
        const savedLvl = localStorage.getItem('viscora_unlocked_level');
        this.unlockedLevel = savedLvl !== null ? Math.max(1, parseInt(savedLvl)) : 1;
        
        // Geçmiş önbellek veya maxLevel sınırından dolayı tamamlanan bölümlerin kilitli kalmasını önle:
        // Eğer kullanıcı bir bölümü bitirdiyse (yıldız aldıysa), bir sonraki bölümün kilidi en azından açık olmalıdır.
        for (let i = 1; i <= 30; i++) {
            if (this.getStarsForLevel(i) > 0) {
                this.unlockedLevel = Math.max(this.unlockedLevel, i + 1);
            }
        }
        this.unlockedLevel = Math.min(this.unlockedLevel, 30);
        localStorage.setItem('viscora_unlocked_level', this.unlockedLevel.toString());

        this.currentLevel = savedLvl !== null ? this.unlockedLevel : 0;
        if (this.currentLevel >= 30 && this.getStarsForLevel(30) > 0) {
            this.currentLevel = null;
        }
        this.difficulty = localStorage.getItem('viscora_difficulty') || 'normal';
        this.ui = new UIManager(this);
        this.player = new Player(100, 300, this);
        this.level = new Level();
        this.enemies = [];
        this.boss = null;
        this.splatters = [];
        this.particles = [];
        this.menuBlobCanvases = null;

        // Kamera Ayarları ve Cilaları
        this.camera = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            lerpSpeed: 0.085,
            lookAhead: 0,
            verticalLook: 0,
            shakeIntensity: 0,
            shakeDuration: 0,
            zoom: this._pendingMobileZoom || 1.0
        };

        // Editor Desteği
        this.editor = new LevelEditor(this);
        if (location.search.includes('editor=true')) {
            this.editor.init();
        }

        // Ekran Efektleri
        this.hitStopTimer = 0;
        this.flashColor = null;
        this.flashDuration = 0;
        this.flashMaxDuration = 0;
        this.levelCardTimer = 0;
        this.levelCardMaxTime = 180;

        // Bağlamsal İpucu Sistemi
        this.levelDeaths = 0;       // Mevcut bölümdeki ölüm sayacı
        this.hintTimer = 0;         // İpucu gösterim sayacı (frame)
        this.hintMaxTime = 180;     // İpucu toplam süresi (~3 saniye)

        // Ödüllü Reklam Bayrakları
        this.rewardedContinueUsed = false;  // Bu bölümde devam hakkı kullanıldı mı?
        this.rewardedSkipUsed = false;      // Bu bölümde atlama hakkı kullanıldı mı?

        // Zaman Takibi
        this.lastTime = 0;
        this.gameTime = 0; // Toplam saniye
        this.timeString = "00:00";
        this.bossRespawnsUsed = 0;

        // Arka Plan ve Ön Plan Paralaks Süslemeleri
        this.bgCells = [];
        this.fgElements = [];
        this.initBackgroundCells();

        // Ana Menü İnteraktif Sıvı ve Baloncuk Efektleri
        this.mouseX = undefined;
        this.mouseY = undefined;
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        this.menuBlobs = [];
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const blobCount = isMobile ? 3 : 6;
        for (let i = 0; i < blobCount; i++) {
            this.menuBlobs.push({
                x: Math.random() * (window.innerWidth || 800),
                y: Math.random() * (window.innerHeight || 600),
                vx: (Math.random() * 2 - 1) * 0.45,
                vy: (Math.random() * 2 - 1) * 0.45,
                radius: 120 + Math.random() * 100,
                color: i % 3 === 0 ? '#10b981' : (i % 3 === 1 ? '#06b6d4' : '#d946ef'),
                pulseSpeed: 0.005 + Math.random() * 0.01,
                angle: Math.random() * Math.PI * 2
            });
        }

        this.menuBubbles = [];
        const bubbleCount = isMobile ? 10 : 25;
        for (let i = 0; i < bubbleCount; i++) {
            this.menuBubbles.push({
                x: Math.random() * (window.innerWidth || 800),
                y: Math.random() * (window.innerHeight || 600),
                speed: 0.3 + Math.random() * 0.7,
                radius: 2 + Math.random() * 5,
                alpha: 0.1 + Math.random() * 0.35,
                color: Math.random() > 0.5 ? '#06b6d4' : '#d946ef'
            });
        }

        // Gamepad State variables
        this.gamepadPrevButtons = {};
        this.gamepadKeys = { left: false, right: false, up: false, down: false, jump: false, shift: false };

        // Döngüyü Başlat
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    /**
     * Arka plan için yavaş yüzen derinlik hissi veren hücre partikülleri üretir
     */
    initBackgroundCells() {
        this.bgCells = [];
        const levelW = this.level ? this.level.width : 3000;
        const levelH = this.level ? this.level.height : 600;
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const cellCount = isMobile ? 18 : 40;
        for (let i = 0; i < cellCount; i++) {
            const isSpecial = Math.random() < 0.45;
            this.bgCells.push({
                x: Math.random() * levelW,
                y: Math.random() * levelH,
                size: 15 + Math.random() * 30,
                alpha: 0.03 + Math.random() * 0.05,
                parallax: 0.08 + Math.random() * 0.15, // Yavaş hareket
                pulseSpeed: 0.01 + Math.random() * 0.02,
                angle: Math.random() * Math.PI * 2,
                type: isSpecial ? 'special' : 'standard'
            });
        }
        // Ön plan elemanlarını da oluştur
        this.initForegroundElements();
    }

    /**
     * Ön plan derinlik hissi veren yakın boru, tel ve pus elemanlarını üretir
     */
    initForegroundElements() {
        this.fgElements = [];
        const levelW = this.level ? this.level.width : 3000;
        const levelH = this.level ? this.level.height : 600;
        
        // 1. Tavandan sarkan ve sallanan kablolar (Hanging wires)
        const numWires = Math.max(2, Math.floor(levelW / 450));
        for (let i = 0; i < numWires; i++) {
            this.fgElements.push({
                type: 'wire',
                x: 100 + i * 450 + Math.random() * 150,
                y: -10,
                length: 50 + Math.random() * 90,
                wobbleSpeed: 0.8 + Math.random() * 1.2,
                phase: Math.random() * Math.PI * 2,
                parallax: 1.15
            });
        }
        
        // 2. Ön plandan geçen büyük dikey borular (Vertical pipes)
        const numPipes = Math.max(1, Math.floor(levelW / 750));
        for (let i = 0; i < numPipes; i++) {
            this.fgElements.push({
                type: 'pipe_vertical',
                x: 300 + i * 750 + Math.random() * 250,
                y: -50,
                w: 18 + Math.random() * 14,
                h: levelH + 100,
                parallax: 1.25
            });
        }

        // 3. Ön plandan geçen büyük yatay borular (Horizontal pipes)
        this.fgElements.push({
            type: 'pipe_horizontal',
            x: -100,
            y: 40 + Math.random() * 60,
            w: levelW + 200,
            h: 18,
            parallax: 1.2
        });
        
        // 4. Ön planda uçuşan büyük bulanık toz/gaz zerreleri (Blurry dust motes)
        for (let i = 0; i < 15; i++) {
            this.fgElements.push({
                type: 'bubble',
                x: Math.random() * levelW,
                y: Math.random() * levelH,
                size: 8 + Math.random() * 14,
                alpha: 0.03 + Math.random() * 0.04,
                parallax: 1.3,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -0.15 - Math.random() * 0.3
            });
        }
    }

    /**
     * Converts a hex color string to an RGBA color string with specified alpha opacity
     */
    hexToRgba(hex, alpha) {
        let c = hex.substring(1);
        if (c.length === 3) {
            c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Ekran boyutuna göre canvas çizim alanını piksel oranına göre ayarlar
     */
    resizeCanvas() {
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        // Yüksek DPI ekranlar için devicePixelRatio kullan (Retina, Android)
        // Mobilde performans için max 1.5 ile sınırla (GPU fillrate bottleneck'ini çözer)
        const dpr = Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.5 : 2.0);
        this._dpr = dpr;

        const cssWidth  = this.canvas.clientWidth || window.innerWidth;
        const cssHeight = this.canvas.clientHeight || window.innerHeight;

        // Canvas buffer boyutu (gerçek piksel — net çizim, CSS boyutuna göre otomatik ayarlanır)
        this.canvas.width  = Math.round(cssWidth  * dpr);
        this.canvas.height = Math.round(cssHeight * dpr);

        // Context'i DPR ile ölçekle — koordinatlar değişmeden kalır
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Metin ve geometri netliği için
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Mobil ekranlarda harita otomatik küçültülür
        const isLandscape = cssWidth > cssHeight;
        let mobileZoom = 1.0;
        if (isTouchDevice && isLandscape) {
            const referenceHeight = 600;
            const rawZoom = cssHeight / referenceHeight;
            mobileZoom = Math.min(0.85, Math.max(0.55, rawZoom));
        }
        if (this.camera) {
            this.camera.zoom = mobileZoom;
        }
        this._pendingMobileZoom = mobileZoom;
    }

    // Koordinat hesaplamaları için CSS piksel boyutları (DPR'dan bağımsız, rotasyon uyumlu)
    get cssWidth()  { return this.canvas.clientWidth || window.innerWidth;  }
    get cssHeight() { return this.canvas.clientHeight || window.innerHeight; }

    /**
     * Düşmanları Seviyeye göre başlatır
     */
    initEnemies(levelNumber) {
        if (this.level.enemies) {
            this.enemies = this.level.enemies.map(e => {
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
            return;
        }

        if (levelNumber === 1) {
            this.enemies = [
                // ② Düşman Devriye Platformu (yükseltilmiş, y:340 → enemy y = 340-16 = 324)
                new Enemy(750, 324, 120, 1.2),               // Yatay devriye 1
                new Enemy(920, 324, 80, 1.5),                // Yatay devriye 2
                // ⑧ Düşman Ezme Hedefleri (y:460 → enemy y = 460-16 = 444)
                new Enemy(3350, 444, 100, 1.3),              // Stomp hedef 1
                new Enemy(3550, 444, 80, 1.0, false, '#eab308')  // Stomp hedef 2 (sarı)
            ];
        } else if (levelNumber === 2) {
            this.enemies = [
                new Enemy(300, 444, 80, 1.2),   // Platform 1
                new Enemy(1400, 444, 100, 1.4), // Platform 3
                new Enemy(1480, 444, 70, 1.6),  // Platform 3 (çift devriye)
                new Enemy(3300, 444, 120, 1.5)  // Platform 7 Final
            ];
        } else if (levelNumber === 3) {
            this.enemies = [
                new Enemy(475, 350, 100, 1.5, true, '#06b6d4'), // Dikey devriye 1
                new Enemy(750, 234, 80, 1.0),                  // Platform 2
                new Enemy(1025, 350, 100, 1.8, true, '#06b6d4'), // Dikey devriye 2
                new Enemy(2600, 424, 150, 1.4)                  // Final platform
            ];
        } else if (levelNumber === 4) {
            this.enemies = [
                new Enemy(300, 464, 80, 1.0),
                new Enemy(850, 184, 50, 1.2),
                new Enemy(1700, 464, 150, 2.2, false, '#06b6d4'), // Hızlı buz devriyesi
                new Enemy(2000, 300, 150, 1.8, true, '#d946ef'),  // Dikey mor devriye
                new Enemy(2900, 464, 100, 1.3)
            ];
        } else if (levelNumber === 5) {
            this.enemies = [
                new Enemy(600, 300, 150, 2.0, true, '#d946ef'),
                new Enemy(1200, 300, 150, 2.0, true, '#d946ef'),
                new Enemy(1700, 444, 60, 1.2),
                new Enemy(2100, 300, 150, 2.0, true, '#d946ef'),
                new Enemy(2700, 300, 150, 2.0, true, '#d946ef'),
                new Enemy(3200, 444, 100, 1.4)
            ];
        } else if (levelNumber === 6) {
            this.enemies = [
                new Enemy(250, 444, 50, 1.0),
                new Enemy(700, 444, 80, 2.5, false, '#06b6d4'),
                new Enemy(1090, 384, 50, 1.2),
                new Enemy(1500, 334, 80, 2.8, false, '#06b6d4'),
                new Enemy(2900, 424, 150, 1.5)
            ];
        } else if (levelNumber === 7) {
            this.enemies = [
                new Enemy(500, 380, 60, 1.3, false, '#eab308'),  // Sarı stomp hedefleri
                new Enemy(850, 280, 60, 1.5, false, '#eab308'),
                new Enemy(1370, 424, 80, 1.2),
                new Enemy(1600, 380, 60, 1.4, false, '#eab308'),
                new Enemy(2500, 250, 120, 1.6, true, '#d946ef'),
                new Enemy(2850, 444, 100, 1.3)
            ];
        } else if (levelNumber === 8) {
            this.enemies = [];
        } else if (levelNumber === 9) {
            this.enemies = [
                new Enemy(500, 300, 150, 1.8, true, '#d946ef'),
                new Enemy(850, 64, 80, 1.5, false, '#eab308'),
                new Enemy(1120, 300, 150, 2.2, true, '#d946ef'),
                new Enemy(1700, 64, 120, 1.6, false, '#eab308'),
                new Enemy(2200, 334, 60, 1.2),
                new Enemy(2800, 300, 150, 2.0, true, '#d946ef'),
                new Enemy(3200, 444, 100, 1.3)
            ];
        } else if (levelNumber === 10) {
            this.enemies = [
                new Enemy(650, 444, 80, 2.0, false, '#06b6d4'),
                new Enemy(950, 344, 40, 1.0),
                new Enemy(1080, 250, 150, 2.0, true, '#d946ef'),
                new Enemy(1320, 184, 60, 1.2),
                new Enemy(1520, 300, 150, 1.8, true, '#d946ef'),
                new Enemy(2000, 64, 150, 1.8, false, '#eab308'),
                new Enemy(2620, 184, 50, 1.2),
                new Enemy(2900, 334, 30, 1.5, false, '#06b6d4'),
                new Enemy(3750, 444, 150, 2.5, false, '#f43f5e')
            ];
        }
    }

    getStarsForLevel(lvl) {
        try {
            const data = localStorage.getItem('viscora_stars');
            if (!data) return 0;
            const parsed = JSON.parse(data);
            return parsed[lvl] || 0;
        } catch(e) {
            return 0;
        }
    }

    saveStarsForLevel(lvl, stars) {
        try {
            const data = localStorage.getItem('viscora_stars') || '{}';
            const parsed = JSON.parse(data);
            parsed[lvl] = Math.max(parsed[lvl] || 0, stars);
            localStorage.setItem('viscora_stars', JSON.stringify(parsed));
            CloudSaveManager.saveProgress();
        } catch(e) {}
    }

    getTotalStars() {
        try {
            const data = localStorage.getItem('viscora_stars');
            if (!data) return 0;
            const parsed = JSON.parse(data);
            let total = 0;
            for (const k in parsed) {
                if (parseInt(k) !== 999) {
                    total += parsed[k];
                }
            }
            return total;
        } catch(e) {
            return 0;
        }
    }

    getMappedLevel() {
        let lvl = this.currentLevel;
        if (typeof lvl === 'number' && lvl > 20 && lvl !== 999) {
            return ((lvl - 1) % 20) + 1;
        }
        return lvl;
    }

    isBossLevel() {
        const mapped = this.getMappedLevel();
        return (mapped === 10 || mapped === 20);
    }

    calculateStars() {
        let limit3Stars = 40;
        let limit2Stars = 50;

        const isChapter3 = (this.currentLevel >= 21 && this.currentLevel <= 30);
        if (isChapter3) {
            if (this.difficulty === 'easy') {
                limit3Stars = 60;
                limit2Stars = 75;
            } else if (this.difficulty === 'normal') {
                limit3Stars = 75;
                limit2Stars = 95;
            } else if (this.difficulty === 'hard') {
                limit3Stars = 90;
                limit2Stars = 115;
            } else if (this.difficulty === 'hardcore') {
                limit3Stars = 120;
                limit2Stars = 150;
            }
        } else {
            if (this.difficulty === 'easy') {
                limit3Stars = 45;
                limit2Stars = 55;
            } else if (this.difficulty === 'normal') {
                limit3Stars = 40;
                limit2Stars = 50;
            } else if (this.difficulty === 'hard') {
                limit3Stars = 52.5;
                limit2Stars = 67.5;
            } else if (this.difficulty === 'hardcore') {
                limit3Stars = 67.5;
                limit2Stars = 90;
            }
        }

        // Seviye genişliğine göre ek süre ekleme: 3000 px üzerindeki her 1000 px için tüm modlara +12.5 saniye ek süre
        const levelWidth = this.level ? (this.level.width || 2000) : 2000;
        if (levelWidth > 3000) {
            const extraWidth = levelWidth - 3000;
            const extraTime = (extraWidth / 1000) * 12.5;
            limit3Stars += extraTime;
            limit2Stars += extraTime;
        }

        // Boss bölümlerinde süre limiti %30 artar
        const isBossLevel = (this.isBossLevel() || this.boss !== null);
        if (isBossLevel) {
            limit3Stars *= 1.3;
            limit2Stars *= 1.3;
        }

        if (this.gameTime <= limit3Stars) return 3;
        if (this.gameTime <= limit2Stars) return 2;
        return 1;
    }

    /**
     * Oyunu ilk kez başlatır
     */
    start(showTitleCard = true) {
        this.state = 'PLAYING';
        this.gameTime = 0;
        this.particles = [];
        this.splatters = [];
        this.bossRespawnsUsed = 0;
        this.levelCardTimer = showTitleCard ? this.levelCardMaxTime : 0;
        if (showTitleCard) {
            this.levelDeaths = 0; // Sadece yeni bölümde ölüm sayacını sıfırla
            this.hintTimer = LEVEL_HINTS[this.currentLevel] ? this.hintMaxTime : 0;
            this.rewardedContinueUsed = false;
            this.rewardedSkipUsed = false;
        }
        this.level.loadLevel(this.currentLevel);
        this.initBackgroundCells(); // Refresh theme-specific decoration layout for this level
        this.initEnemies(this.currentLevel);
        const mappedLvl = this.getMappedLevel();
        if (this.currentLevel === 30) {
            this.boss = new UfoBoss(1200, 150); // UfoBoss spawn at x: 1200, y: 150
        } else if (mappedLvl === 10) {
            this.boss = new Boss(1200, 300); // Boss spawn at x: 1200, y: 300
        } else if (mappedLvl === 20) {
            this.boss = new CyberBoss(1200, 300); // CyberBoss spawn at x: 1200, y: 300
        } else {
            this.boss = null;
        }
        let maxH = 3;
        if (this.difficulty === 'easy') maxH = 3;
        else if (this.difficulty === 'normal') maxH = 3;
        else if (this.difficulty === 'hard') maxH = 2;
        else if (this.difficulty === 'hardcore') maxH = 1;
        this.player.maxHealth = maxH;
        this.player.health = maxH;

        this.checkpointX = this.level.spawnX;
        this.checkpointY = this.level.spawnY;
        this.player.respawn(this.level.spawnX, this.level.spawnY);

        // Kamera pozisyonunu hemen oyuncu başlangıç noktasına sabitle ve sınırla
        this.camera.x = this.player.x - this.cssWidth / 2;
        this.camera.y = this.player.y - this.cssHeight / 1.38;
        const minX = 0;
        const maxX = this.level.width - this.cssWidth;
        this.camera.x = Math.max(minX, Math.min(this.camera.x, maxX));
        const minY = -350;
        const maxY = this.level.height - this.cssHeight + 350;
        this.camera.y = Math.max(minY, Math.min(this.camera.y, maxY));

        this.ui.updateHUDHealth(this.player.health);
        this.ui.updateHUDViscosity(this.player.viscosity);
        audio.resume();
        this.lastTime = performance.now(); // Reset delta clock to prevent large frame jumps on initial load

        // Hikaye Terminali Tetikleme (Belirtilen bölümlerde ilk girişte)
        const storyLevels = [1, 2, 3, 5, 9, 10, 11, 15, 16, 17, 20, 21, 22, 26, 29, 30];
        if (showTitleCard && storyLevels.includes(this.currentLevel)) {
            if (this.currentLevel === 1) {
                this.state = 'INTRO_CINEMATIC';
                this.initIntroCinematic();
            } else {
                this.state = 'STORY';
                // Hikaye terminali açıkken oyuncunun maddeleşme animasyonunu henüz başlatma ve gizle
                this.player.introState = null;
                this.player.introTimer = 0;

                this.ui.showStoryTerminal(this.currentLevel, () => {
                    this.state = 'PLAYING';
                    // Terminal kapandıktan sonra maddeleşme animasyonunu tetikle
                    this.player.introState = 'materializing';
                    this.player.introTimer = 60;
                    this.lastTime = performance.now();
                });
            }
        } else {
            this.state = 'PLAYING';
        }
        this.physicsAccumulator = 0;
    }

    /**
     * Topluluk haritasını yükler ve başlatır
     */
    startCustomLevel(levelData) {
        this.state = 'PLAYING';
        this.currentLevel = 999; // Custom level ID indicator
        this.currentCustomLevelData = levelData; // Save reference for restart/replay
        this.gameTime = 0;
        this.particles = [];
        this.splatters = [];
        this.boss = null; // Önceki boss bölümünden kalan boss'u temizle
        this.bossRespawnsUsed = 0;
        this.enemies = []; // Önceki bölümden kalan düşmanları temizle
        this.levelCardTimer = 0; // No level title card for custom maps
        this.level.loadLevel(levelData);
        this.initEnemies(this.currentLevel);
        this.initBackgroundCells(); // Generate standard decorations
        let maxH = 3;
        if (this.difficulty === 'easy') maxH = 3;
        else if (this.difficulty === 'normal') maxH = 3;
        else if (this.difficulty === 'hard') maxH = 2;
        else if (this.difficulty === 'hardcore') maxH = 1;
        this.player.maxHealth = maxH;
        this.player.health = maxH;

        this.checkpointX = this.level.spawnX;
        this.checkpointY = this.level.spawnY;
        this.player.respawn(this.level.spawnX, this.level.spawnY);
        this.ui.updateHUDHealth(this.player.health);
        this.ui.updateHUDViscosity(this.player.viscosity);
        audio.resume();
        this.lastTime = performance.now();
        this.physicsAccumulator = 0;
    }

    /**
     * Oyunu Yeniden Başlatır (Ölüm veya Tekrar Oyna sonrası)
     */
    restart() {
        // Her 3 ölümde bir ipucu göster (sayaç gameover geçişinde artırılıyor)
        if (this.levelDeaths % 3 === 0 && LEVEL_HINTS[this.currentLevel]) {
            this.hintTimer = this.hintMaxTime;
        } else {
            this.hintTimer = 0;
        }

        if (this.difficulty === 'easy' && this.checkpointX !== undefined && this.checkpointY !== undefined && (this.checkpointX !== this.level.spawnX || this.checkpointY !== this.level.spawnY)) {
            this.state = 'PLAYING';
            this.particles = [];
            this.splatters = [];
            this.level.resetLevelRuntimeState(true);
            this.initEnemies(this.currentLevel);
            this.bossRespawnsUsed = 0;
            const mappedLvl = this.getMappedLevel();
            if (this.currentLevel === 30) {
                this.boss = new UfoBoss(1200, 150);
            } else if (mappedLvl === 10) {
                this.boss = new Boss(1200, 300);
            } else if (mappedLvl === 20) {
                this.boss = new CyberBoss(1200, 300);
            } else {
                this.boss = null;
            }
            let maxH = 3;
            this.player.maxHealth = maxH;
            this.player.health = 1;
            this.player.respawn(this.checkpointX, this.checkpointY, 1);
            this.ui.updateHUDHealth(this.player.health);
            this.ui.updateHUDViscosity(this.player.viscosity);
            audio.resume();
            this.lastTime = performance.now();
            this.physicsAccumulator = 0;
        } else {
            if (this.currentLevel === 999 && this.currentCustomLevelData) {
                this.startCustomLevel(this.currentCustomLevelData);
            } else {
                this.start(false);
            }
        }
    }

    /**
     * Ödüllü Reklam: Checkpoint'ten Full Canla Devam Et
     * Oyuncu reklam izledikten sonra son checkpoint'inden tam canla başlar.
     * Eğer checkpoint yoksa bölümün ~%50'sinde güvenli bir nokta hesaplanır.
     */
    rewardedContinue() {
        const game = this;
        adBreak({
            type: 'reward',
            name: 'rewarded-continue',
            beforeAd: () => {
                audio.suspend();
            },
            afterAd: () => {
                audio.resume();
            },
            adDismissed: () => {
                audio.resume();
            },
            adViewed: () => {
                game._executeRewardedContinue();
            },
            adBreakDone: (info) => {
                if (info.breakStatus === 'notReady' || info.breakStatus === 'frequencyCapped' || info.breakStatus === 'other') {
                    game._executeRewardedContinue();
                }
            }
        });
    }

    /**
     * Ödüllü devam mantığını yürüten iç metot.
     * Checkpoint yoksa bölümün %50'sinde güvenli bir platform üzerinde otomatik checkpoint oluşturur.
     */
    _executeRewardedContinue() {
        this.rewardedContinueUsed = true;

        // Reklam izlendiğinde en yakın checkpoint'i bul ve oraya at (doğrudan değmemiş olsa bile)
        if (this.level.checkpoints && this.level.checkpoints.length > 0) {
            let closestCp = null;
            let minDistance = Infinity;
            this.level.checkpoints.forEach(cp => {
                const dx = this.player.x - cp.x;
                const dy = this.player.y - cp.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestCp = cp;
                }
            });
            if (closestCp) {
                // Oyuncu checkpoint'i geçmişse VEYA checkpoint'e çok yakınsa (en fazla 200px gerisindeyse)
                if (this.player.x >= closestCp.x - 200) {
                    this.checkpointX = closestCp.x;
                    this.checkpointY = closestCp.y;
                }
            }
        }

        // Eğer checkpoint hâlâ spawn noktasıysa (checkpoint yoksa veya henüz ilkine ulaşılmamışsa), sadece bölümün kendi checkpoint'i yoksa %50 noktasını bul
        if (this.checkpointX === this.level.spawnX && this.checkpointY === this.level.spawnY) {
            const hasCheckpoints = this.level.checkpoints && this.level.checkpoints.length > 0;
            if (!hasCheckpoints) {
                const midPoint = this._findMidLevelSafePoint();
                if (midPoint) {
                    this.checkpointX = midPoint.x;
                    this.checkpointY = midPoint.y;
                }
            }
        }

        this.state = 'PLAYING';
        this.particles = [];
        this.splatters = [];
        this.level.resetLevelRuntimeState(true);
        this.initEnemies(this.currentLevel);
        this.bossRespawnsUsed = 0;
        const mappedLvl = this.getMappedLevel();
        if (this.currentLevel === 30) {
            this.boss = new UfoBoss(1200, 150);
        } else if (mappedLvl === 10) {
            this.boss = new Boss(1200, 300);
        } else if (mappedLvl === 20) {
            this.boss = new CyberBoss(1200, 300);
        } else {
            this.boss = null;
        }
        let maxH = 3;
        if (this.difficulty === 'easy') maxH = 3;
        else if (this.difficulty === 'normal') maxH = 3;
        else if (this.difficulty === 'hard') maxH = 2;
        this.player.maxHealth = maxH;
        this.player.health = maxH;
        this.player.respawn(this.checkpointX, this.checkpointY, maxH);
        this.player.invulnerableFrames = 90; // 1.5 saniye yeniden doğuş koruması
        this.ui.showScreen('hud');
        this.ui.updateHUDHealth(this.player.health);
        this.ui.updateHUDViscosity(this.player.viscosity);
        this.emitParticles(this.checkpointX, this.checkpointY, 'shift', '#f59e0b', 30);
        audio.playShift('LOW');
        audio.resume();
        this.lastTime = performance.now();
        this.physicsAccumulator = 0;
    }

    /**
     * Bölümün yaklaşık %50 noktasında güvenli bir platform üzerinde konum bulur.
     * Checkpoint olmayan bölümlerde ödüllü devam için kullanılır.
     */
    _findMidLevelSafePoint() {
        const targetX = this.level.width * 0.50;
        const platforms = this.level.platforms || [];
        const hazards = this.level.hazards || [];

        // Normal veya kaygan platformları hedef X'e yakınlığa göre sırala
        const candidates = platforms
            .filter(p => (p.type === 'normal' || p.type === 'slippery') && p.w >= 50 && p.y >= 180 && p.y <= 490)
            .map(p => ({ p, dist: Math.abs((p.x + p.w / 2) - targetX) }))
            .filter(({ dist }) => dist < 600)
            .sort((a, b) => a.dist - b.dist);

        for (const { p: platform } of candidates) {
            const margin = 25;
            const cpX = Math.max(platform.x + margin, Math.min(platform.x + platform.w - margin, targetX));
            const cpY = platform.y - 32;

            // Platform üstünde tehlike var mı?
            const cpRadius = 25;
            const hasNearbyHazard = hazards.some(h => {
                const xOverlap = (cpX + cpRadius) > h.x && (cpX - cpRadius) < (h.x + h.w);
                const yNear = (h.y + h.h) >= (platform.y - 60) && h.y <= (platform.y + 30);
                if (h.type === 'spike' && h.direction === 'down' && h.y >= platform.y) return false;
                return xOverlap && yNear;
            });

            if (hasNearbyHazard) continue;

            return { x: cpX, y: cpY };
        }

        // Hiçbir güvenli nokta bulunamadıysa null dön (spawn noktasında kalır)
        return null;
    }

    /**
     * Ödüllü Reklam: Bölümü Atla
     * Oyuncu reklam izledikten sonra bir sonraki bölüme geçer (0 yıldız).
     */
    rewardedSkipLevel() {
        const game = this;
        adBreak({
            type: 'reward',
            name: 'rewarded-skip-level',
            beforeAd: () => {
                audio.suspend();
            },
            afterAd: () => {
                audio.resume();
            },
            adDismissed: () => {
                audio.resume();
            },
            adViewed: () => {
                // Reklam başarıyla tamamlandı — bölümü atla
                game.rewardedSkipUsed = true;
                // İlerlemeyi kaydet (0 yıldız)
                try {
                    let progress = JSON.parse(localStorage.getItem('viscora_progress') || '{}');
                    const lvlKey = 'level_' + game.currentLevel;
                    if (!progress[lvlKey]) {
                        progress[lvlKey] = { stars: 0, completed: true, skipped: true };
                    }
                    // Sonraki bölümün kilidini de aç
                    const nextLvlKey = 'level_' + (game.currentLevel + 1);
                    if (!progress[nextLvlKey]) {
                        progress[nextLvlKey] = { unlocked: true };
                    }
                    localStorage.setItem('viscora_progress', JSON.stringify(progress));
                } catch(e) { /* localStorage hatası yoksay */ }
                game.ui.showScreen('hud');
                game.nextLevel();
            },
            adBreakDone: (info) => {
                // SDK hazır değilse de ödülü ver (test ortamı)
                if (info.breakStatus === 'notReady' || info.breakStatus === 'frequencyCapped' || info.breakStatus === 'other') {
                    game.rewardedSkipUsed = true;
                    try {
                        let progress = JSON.parse(localStorage.getItem('viscora_progress') || '{}');
                        const lvlKey = 'level_' + game.currentLevel;
                        if (!progress[lvlKey]) {
                            progress[lvlKey] = { stars: 0, completed: true, skipped: true };
                        }
                        const nextLvlKey = 'level_' + (game.currentLevel + 1);
                        if (!progress[nextLvlKey]) {
                            progress[nextLvlKey] = { unlocked: true };
                        }
                        localStorage.setItem('viscora_progress', JSON.stringify(progress));
                    } catch(e) {}
                    game.ui.showScreen('hud');
                    game.nextLevel();
                }
            }
        });
    }

    /**
     * Bölüm atlama veya başa dönme
     */
    nextLevel() {
        if (this.currentLevel === 999 && this.currentCustomLevelData) {
            this.startCustomLevel(this.currentCustomLevelData);
            return;
        }
        const isDev = this.ui && this.ui.devMode;
        const maxLvl = 30;
        if (this.currentLevel < maxLvl) {
            const nextLvl = this.currentLevel + 1;
            // Bir sonraki bölüm (özellikle Boss seviyesi ise) kilitli mi kontrol et
            if (isDev || (this.ui && this.ui.isLevelUnlocked(nextLvl))) {
                this.currentLevel = nextLvl;
                this.ui.updateLevelButtonsUI();
                this.start();
            } else {
                // Eğer kilitliyse (örneğin yeterli yıldız yoksa) ana menüye dön ve uyarı modalını göster
                this.goToMenu();
                if (this.ui && nextLvl % 10 === 0) {
                    this.ui.showStarGateModal(nextLvl);
                }
            }
        } else {
            this.currentLevel = isDev ? 0 : 1;
            this.ui.updateLevelButtonsUI();
            this.start();
        }
    }

    /**
     * Oyunu Duraklat / Devam Et
     */
    togglePause() {
        if (this.editor && this.editor.active) return; // Editör aktifken (Playtest dahil) duraklatmayı engelle
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            this.ui.showScreen('pause');
            this.ui.resetKeys();
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.ui.showScreen('hud');
            audio.resume();
        }
    }

    /**
     * Ana Menüye Döner
     */
    goToMenu() {
        this.state = 'MENU';
        this.ui.resetKeys();
        this.particles = [];
        this.splatters = [];
        this.boss = null;
        this.enemies = [];
        audio.stopMusic();
        
        if (this.isCommunityPlay) {
            this.isCommunityPlay = false;
            this.ui.showScreen('community');
            if (this.ui.loadCommunityMaps) {
                this.ui.loadCommunityMaps(this.ui.currentSort || 'popular');
            }
        } else {
            this.ui.showScreen('start');
        }
        
        this.ui.updateLevelButtonsUI();
    }

    /**
     * Parçacık Sistemi Ekleme Yardımcısı
     */
    emitParticles(x, y, type, color, count = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            let speed = 0.5 + Math.random() * 3;
            let size = 2 + Math.random() * 5;
            let maxLife = 20 + Math.random() * 30;
            
            let vx = Math.cos(angle) * speed;
            let vy = Math.sin(angle) * speed;

            if (type === 'land') {
                // Yere basma halkası şeklinde yana fırlayan parçacıklar
                speed = 1.0 + Math.random() * 4;
                size = 3 + Math.random() * 4;
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
            } else if (type === 'shift') {
                // Viskozite geçişi dairesel saçılımı
                speed = 1.5 + Math.random() * 4.5;
                size = 3.5 + Math.random() * 4;
                maxLife = 20 + Math.random() * 15;
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
            } else if (type === 'enemy_pop') {
                // Patlama dağılması
                speed = 2.0 + Math.random() * 5;
                size = 4 + Math.random() * 6;
                maxLife = 35 + Math.random() * 20;
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
            } else if (type === 'trail') {
                // Arkada kalan yavaş sönen damla
                speed = 0.1 + Math.random() * 0.5;
                size = 3 + Math.random() * 4;
                maxLife = 15 + Math.random() * 15;
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed - 0.2;
            } else if (type === 'smoke') {
                // Gri duman bulutu, yukarı doğru süzülür ve genleşir
                size = 6 + Math.random() * 8;
                maxLife = 45 + Math.random() * 30;
                vx = (Math.random() - 0.5) * 1.5;
                vy = -1.2 - Math.random() * 1.8;
            } else if (type === 'steam') {
                // Hızlı yükselen renkli buhar
                size = 3 + Math.random() * 4;
                maxLife = 25 + Math.random() * 20;
                vx = (Math.random() - 0.5) * 2.0;
                vy = -2.2 - Math.random() * 2.8;
            }

            this.particles.push({
                x: x,
                y: y,
                vx: vx,
                vy: vy,
                size: size,
                color: color,
                alpha: 1.0,
                life: maxLife,
                maxLife: maxLife,
                type: type
            });
        }
    }

    /**
     * Oyun Ana Döngüsü
     */
    loop(time) {
        // Gamepad'i sorgula (Duraklatıldığında da çalışması için en üstte)
        this.pollGamepad();

        // Heartbeat'i PLAYING durumu dışında durdur
        if (this.state !== 'PLAYING') {
            audio.stopHeartbeat();
        }

        // Calculate raw elapsed time in ms
        let elapsed = time - this.lastTime;
        this.lastTime = time;
        if (isNaN(elapsed) || elapsed < 0) {
            elapsed = 0;
        }
        if (elapsed > 250) { // Limit huge lag spikes (e.g. background tab)
            elapsed = 250;
        }

        // Menülerde dikey modda gezinmeye izin ver, oyun başlarken veya editördeyken yatay mod uyarısı göster
        const isGameActive = this.state === 'PLAYING' || this.state === 'INTRO_CINEMATIC' || this.state === 'STORY' || this.state === 'EDITOR' || this.state === 'PAUSED' || this.state === 'WIN' || this.state === 'GAMEOVER';
        if (isGameActive) {
            document.body.classList.add('game-active');
        } else {
            document.body.classList.remove('game-active');
        }

        if (this.state === 'PLAYING') {
            if (this.pausedForCustomizer) {
                // Do not update physics while customizing controls
            } else if (this.hitStopTimer > 0) {
                this.hitStopTimer--; // Donma efekti sayaç düşüşü
            } else {
                this.physicsAccumulator = (this.physicsAccumulator || 0) + elapsed;
                const stepMs = 16.666; // ~60fps step
                let updates = 0;
                while (this.physicsAccumulator >= stepMs) {
                    this.update(1.0); // dt is exactly 1.0 logic-step
                    this.physicsAccumulator -= stepMs;
                    updates++;
                    if (updates >= 5) { // Cap updates per render frame to prevent spiral of death
                        this.physicsAccumulator = 0;
                        break;
                    }
                }
            }
        } else if (this.state === 'INTRO_CINEMATIC') {
            this.updateIntroCinematic(elapsed);
        } else if (this.state === 'EDITOR') {
            if (this.editor && this.editor.active) {
                const dt = elapsed / 16.666;
                this.editor.update(dt);
            }
        } else if (this.state === 'MENU' || this.state === 'SHOP') {
            const dt = elapsed / 16.666;
            this.updateMenuPhysics(dt);
        }
        this.draw();

        requestAnimationFrame(this.loop);
    }

    /**
     * Bölüm kazanıldığında win ekranını hazırlar ve gösterir
     */
    _showWinScreen() {
        document.getElementById('win-time').textContent = this.timeString;

        // Yıldızları Hesapla, Kaydet ve Göster (3 yıldız her zaman gösterilir)
        const stars = this.calculateStars();
        const isCampaignLvl = this.currentLevel !== 999 && this.currentLevel >= 1 && this.currentLevel <= 30;
        const leadContainer = document.getElementById('win-leaderboard-container');
        if (leadContainer) {
            leadContainer.style.display = isCampaignLvl ? 'flex' : 'none';
        }

        if (isCampaignLvl) {
            this.saveStarsForLevel(this.currentLevel, stars);
            this.submitCampaignScore(this.currentLevel, this.gameTime);
            if (this.difficulty === 'hardcore' && this.ui) {
                this.ui.updateWeeklyChallenge(2, 1);
            }
        } else if (this.currentLevel !== 999) {
            this.saveStarsForLevel(this.currentLevel, stars);
        } else if (this.isCommunityPlay && this.currentCommunityLevelId) {
            if (this.ui) {
                this.ui.updateWeeklyChallenge(1, 1);
            }
            // Topluluk haritası bitirildiğinde skoru gönder
            const levelId = this.currentCommunityLevelId;
            const timeValue = this.gameTime;
            
            let username = localStorage.getItem('viscora_author_name');
            if (!username || username === 'Tasarımcı' || username.trim() === '') {
                username = window.prompt("Tebrikler! Liderlik tablosu için adınızı girin:", "Oyuncu");
                if (username) {
                    username = username.trim();
                    if (username) {
                        localStorage.setItem('viscora_author_name', username);
                    }
                }
            }
            if (!username || username.trim() === '') {
                username = 'Anonim';
            }

            const API_BASE = 'https://viscora.onrender.com';
            
            fetch(`${API_BASE}/api/levels/${levelId}/score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, time: timeValue })
            })
            .then(res => {
                if (!res.ok) throw new Error("Skor kaydedilemedi.");
                return res.json();
            })
            .then(updatedLevel => {
                console.log("Skor başarıyla kaydedildi:", updatedLevel);
                if (this.ui) {
                    this.ui.updateLevelScores(levelId, updatedLevel.scores);
                }
            })
            .catch(err => console.error("Skor kaydetme hatası:", err));
        }
        // Eski win-stars elementi varsa güncelle (geriye dönük uyum)
        const winStarsEl = document.getElementById('win-stars');
        if (winStarsEl) {
            winStarsEl.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        }
        // Yeni animasyonlu 3-yıldız gösterimi
        for (let i = 1; i <= 3; i++) {
            const starEl = document.getElementById(`win-star-${i}`);
            if (starEl) {
                starEl.classList.remove('earned');
                starEl.textContent = '★';
                if (i <= stars) {
                    // Staggered pop-in: 1st star at 0.15s, 2nd at 0.5s, 3rd at 0.85s
                    setTimeout(() => { starEl.classList.add('earned'); }, (i - 1) * 350 + 150);
                }
            }
        }

        // Kristal İstatistiklerini Hesapla ve Göster
        const totalCrystals = (this.level.collectibles || []).filter(c => !c.enemyDropped).length;
        const collectedCrystals = (this.level.collectibles || []).filter(c => c.collected && !c.enemyDropped).length;
        const crystalContainer = document.getElementById('win-crystals-container');
        const crystalText = document.getElementById('win-crystals');
        const crystalPerfect = document.getElementById('win-crystals-perfect');

        if (crystalContainer) {
            if (totalCrystals > 0) {
                crystalContainer.style.display = 'block';
                if (crystalText) {
                    crystalText.textContent = `${collectedCrystals} / ${totalCrystals}`;
                }
                if (crystalPerfect) {
                    if (collectedCrystals === totalCrystals) {
                        crystalPerfect.textContent = ' (MÜKEMMEL! 🌟)';
                    } else {
                        crystalPerfect.textContent = '';
                    }
                }
            } else {
                crystalContainer.style.display = 'none';
            }
        }

        // Bölüm bazlı başlık ve buton yazısı güncellemesi
        const isDev = this.ui && this.ui.devMode;
        const maxLvl = 30;
        if (this.currentLevel < maxLvl) {
            const nextLvl = this.currentLevel + 1;
            this.unlockedLevel = Math.max(this.unlockedLevel, nextLvl);
            localStorage.setItem('viscora_unlocked_level', this.unlockedLevel.toString());
            CloudSaveManager.saveProgress();
            this.ui.updateLevelButtonsUI();

            document.getElementById('win-title').textContent = `BÖLÜM ${this.currentLevel} TAMAMLANDI!`;
            document.getElementById('btn-next').textContent = "SONRAKİ BÖLÜM";
        } else {
            document.getElementById('win-title').textContent = "TEBRİKLER, OYUNU BİTİRDİNİZ!";
            document.getElementById('btn-next').textContent = "EN BAŞTAN OYNA";
        }
        // Esprili ölüm sayacı mesajı
        const deathEl = document.getElementById('win-deaths-text');
        if (deathEl) {
            const d = this.levelDeaths;
            let deathMsg = '';
            if (d === 0) {
                deathMsg = '☠️ 0 Ölüm — Bir damla bile dökülmedi!';
            } else if (d === 1) {
                deathMsg = '☠️ 1 Ölüm — Sadece bir kaza, olur böyle şeyler.';
            } else if (d <= 3) {
                deathMsg = `☠️ ${d} Ölüm — Hâlâ formdasın!`;
            } else if (d <= 6) {
                deathMsg = `☠️ ${d} Ölüm — Bu bölüm seni sevmedi galiba.`;
            } else if (d <= 10) {
                deathMsg = `☠️ ${d} Ölüm — Zemin seni tanıyor artık.`;
            } else if (d <= 20) {
                deathMsg = `☠️ ${d} Ölüm — İnatçı jel, asla pes etmez!`;
            } else {
                deathMsg = `☠️ ${d} Ölüm — Efsanevi direniş! Saygılar.`;
            }
            deathEl.textContent = deathMsg;
        }

        // Dokunsal geri bildirim: Bölüm tamamlandı kutlama hissiyatı
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([50, 40, 80, 40, 50]);
        }

        this.ui.showScreen('win');
        this.ui.resetKeys();
    }

    /**
     * Gamepad (Kontrolcü) durumunu sorgular ve girdileri eşleştirir
     */
    pollGamepad() {
        if (!navigator.getGamepads) return;
        const gamepads = navigator.getGamepads();
        let gp = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
                gp = gamepads[i];
                break;
            }
        }

        if (!gp) {
            this.gamepadKeys = { left: false, right: false, up: false, down: false, jump: false, shift: false };
            return;
        }

        const buttons = gp.buttons;
        const axes = gp.axes;

        const isPressed = (index) => {
            if (index >= buttons.length) return false;
            return buttons[index].pressed;
        };

        const justPressed = (index) => {
            const cur = isPressed(index);
            const prev = !!this.gamepadPrevButtons[index];
            this.gamepadPrevButtons[index] = cur;
            return cur && !prev;
        };

        // Yön tuşu (DPad) yukarı hassasiyeti için eksen geçiş algılama
        const upAxisPressed = (axes[1] !== undefined && axes[1] < -0.25);
        const upAxisJustPressed = upAxisPressed && !this._prevUpAxis;
        this._prevUpAxis = upAxisPressed;

        const leftActive = isPressed(14) || (axes[0] !== undefined && axes[0] < -0.25);
        const rightActive = isPressed(15) || (axes[0] !== undefined && axes[0] > 0.25);
        const upActive = isPressed(12) || upAxisPressed;
        const downActive = isPressed(13) || (axes[1] !== undefined && axes[1] > 0.25);
        const jumpActive = isPressed(0) || isPressed(3);
        const shiftActive = isPressed(5) || isPressed(6) || isPressed(7) || isPressed(1) || isPressed(2);

        this.gamepadKeys = {
            left: leftActive,
            right: rightActive,
            up: upActive,
            down: downActive,
            jump: jumpActive,
            shift: shiftActive
        };

        // Oynanış sırasında tek seferlik tetiklenen eylemler (Edge-Triggered)
        if (this.state === 'PLAYING' && this.player) {
            if (justPressed(0) || justPressed(3)) {
                this.player.jump(true);
            }
            if (justPressed(12) || upAxisJustPressed) {
                this.player.jump(false);
            }
            if (justPressed(5) || justPressed(6) || justPressed(7) || justPressed(1) || justPressed(2)) {
                if (this.ui) this.ui.triggerViscosityShift();
            }
        }

        // Duraklatma Tetiklemesi (Start, Select veya Sol Omuz/Tetik Butonu)
        if (justPressed(9) || justPressed(8) || justPressed(4)) {
            this.togglePause();
        }

        // Menü navigasyon tetiklemeleri (A butonu tıklamaları simüle eder)
        if (justPressed(0)) {
            if (this.state === 'MENU') {
                const playBtn = document.getElementById('btn-play');
                if (playBtn) playBtn.click();
            } else if (this.state === 'WIN') {
                const nextBtn = document.getElementById('btn-next');
                if (nextBtn) nextBtn.click();
            } else if (this.state === 'GAMEOVER') {
                const retryBtn = document.getElementById('btn-retry');
                if (retryBtn) retryBtn.click();
            }
        }
    }

    /**
     * Fizik, girdiler ve çarpışma güncellemeleri
     */
    update(dt) {
        // Süreyi artır
        this.gameTime += dt * 0.01666; // Frame -> Saniye dönüştür
        const min = Math.floor(this.gameTime / 60);
        const sec = Math.floor(this.gameTime % 60);
        this.timeString = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

        // Seviye (Zıplatma pedleri vs.) güncelle (Run before player update for moving platforms synchronization)
        this.level.update(this.player);

        // Klavye/mobil ve gamepad girdilerini birleştir
        const combinedKeys = {
            left: this.ui.keys.left || this.gamepadKeys.left,
            right: this.ui.keys.right || this.gamepadKeys.right,
            up: this.ui.keys.up || this.gamepadKeys.up,
            down: this.ui.keys.down || this.gamepadKeys.down,
            jump: this.ui.keys.jump || this.gamepadKeys.jump,
            shift: this.ui.keys.shift || this.gamepadKeys.shift
        };

        // Oyuncu güncelleme
        this.player.update(
            combinedKeys, 
            this.level, 
            this.emitParticles.bind(this),
            (event, data) => this.handlePlayerEvent(event, data)
        );
        
        // Ekran flaş sayacı güncelleme
        if (this.flashDuration > 0) {
            this.flashDuration--;
        }

        // Seviye başlık kartı sayacı güncelleme
        if (this.levelCardTimer > 0) {
            this.levelCardTimer -= dt;
        }
        // İpucu sayacı güncelleme
        if (this.hintTimer > 0) {
            this.hintTimer -= dt;
        }
        
        // HUD Canını Güncelle
        this.ui.updateHUDHealth(this.player.health);

        // Canı 1 ise procedural kalp ritmini çal, yoksa durdur
        if (this.player.health === 1 && !this.player.isDead) {
            audio.startHeartbeat();
        } else {
            audio.stopHeartbeat();
        }

        // Splatters güncelleme (In-place filtreleme ile GC yükünü azalt)
        if (this.splatters) {
            this.splatters.forEach(s => {
                s.life -= dt;
            });
            let writeSplatIdx = 0;
            for (let i = 0; i < this.splatters.length; i++) {
                const s = this.splatters[i];
                if (s.life > 0) {
                    this.splatters[writeSplatIdx++] = s;
                }
            }
            this.splatters.length = writeSplatIdx;
        }

        // Düşmanları Güncelle & Çarpışma Kontrolü
        this.enemies.forEach(enemy => {
            enemy.update(this.level, this.player, this.emitParticles.bind(this));
            enemy.checkCollision(this.player, this.emitParticles.bind(this), () => {
                // Cilalama: Düşmana basınca kamera sallanır, oyun kısa süreli donar ve stomping sesi tetiklenir
                this.shakeCamera(7, 10);
                this.triggerHitStop(4); // 70ms donma efekti
                audio.playStomp();
            }, this.level);
        });

        // Temizleme: Ölü düşmanları sil (In-place filtreleme)
        let writeEnemyIdx = 0;
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isDead) {
                this.enemies[writeEnemyIdx++] = e;
            }
        }
        this.enemies.length = writeEnemyIdx;

        // Boss güncelle
        if (this.boss) {
            this.boss.update(this.level, this.player);
            this.boss.checkPlayerCollision(this.player);
        }

        // Parçacıkları Güncelle
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            p.alpha = p.life / p.maxLife;
            
            // Sıvı parçacıkları yavaşça süzülür
            if (p.type === 'trail') {
                p.vy += 0.01; // Hafif yerçekimi
            } else if (p.type === 'smoke') {
                p.size += 0.12; // Duman genişler
                p.vx *= 0.95;   // Sürtünme
                p.vy *= 0.96;
            } else if (p.type === 'steam') {
                p.size += 0.06; // Buhar hafifçe genişler
                p.vx *= 0.94;
                p.vy *= 0.94;
            }
        });
        
        // Parçacıkları temizle (In-place filtreleme)
        let writePartIdx = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (p.life > 0) {
                this.particles[writePartIdx++] = p;
            }
        }
        this.particles.length = writePartIdx;

        // --- KAMERA YÖNETİMİ ---
        // Look-ahead: Hareket yönüne göre kamerayı hafifçe öne kaydır
        const targetLookAhead = this.player.vx * 15;
        this.camera.lookAhead += (targetLookAhead - this.camera.lookAhead) * 0.05;

        // Dikey Görünüm (Jump: yukarı bak, Fall: aşağı bak)
        const targetVerticalLook = Math.max(-100, Math.min(this.player.vy * 9, 100));
        this.camera.verticalLook += (targetVerticalLook - this.camera.verticalLook) * 0.05;

        // İdeal kamera hedefleri (Kamerayı yukarı kaydırarak üstteki HUD elemanlarının platformları kapatmasını engeller)
        this.camera.targetX = this.player.x - this.cssWidth / 2 + this.camera.lookAhead;
        this.camera.targetY = this.player.y - this.cssHeight / 1.38 + this.camera.verticalLook;

        // Kamera yumuşatma (Lerp)
        this.camera.x += (this.camera.targetX - this.camera.x) * this.camera.lerpSpeed;
        this.camera.y += (this.camera.targetY - this.camera.y) * 0.25; // Dikey takip hızı artırıldı

        // Seviye sınırlarına kilitle veya ekran seviyeden büyükse haritayı ortala (Clamp / Center)
        // Zoom oranını göz önünde bulundurarak görünür alanı hesapla
        const zoom = this.camera.zoom || 1.0;
        const visibleWidth = this.cssWidth / zoom;
        if (visibleWidth > this.level.width) {
            this.camera.x = (this.level.width - this.cssWidth) / 2;
        } else {
            const minX = (this.cssWidth / 2) / zoom - (this.cssWidth / 2);
            const maxX = this.level.width - (this.cssWidth / 2) / zoom - (this.cssWidth / 2);
            this.camera.x = Math.max(minX, Math.min(this.camera.x, maxX));
        }

        // Haritadaki en yüksek platformun (negatif Y) konumuna göre kamera sınırını dinamik genişlet
        let minPlatformY = 0;
        if (this.level && this.level.platforms) {
            this.level.platforms.forEach(p => {
                if (p.y < minPlatformY) minPlatformY = p.y;
            });
        }
        const cameraYBuffer = Math.max(350, -minPlatformY + 250);

        if (this.cssHeight > this.level.height + cameraYBuffer * 2) {
            this.camera.y = (this.level.height - this.cssHeight) / 2;
        } else {
            this.camera.y = Math.max(-cameraYBuffer, Math.min(this.camera.y, this.level.height - this.cssHeight + cameraYBuffer));
        }

        // Kamera Sallantısı (Camera Shake) Uygulaması
        if (this.camera.shakeDuration > 0) {
            this.camera.shakeDuration--;
            const shakeX = (Math.random() * 2 - 1) * this.camera.shakeIntensity;
            const shakeY = (Math.random() * 2 - 1) * this.camera.shakeIntensity;
            this.camera.x += shakeX;
            this.camera.y += shakeY;
            // Sönümleme
            this.camera.shakeIntensity *= 0.9;
        }

        // --- KAZANMA KONTROLÜ ---
        const p = this.level.portal;
        const dx = this.player.x - (p.x + p.w / 2);
        const dy = this.player.y - (p.y + p.h / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 10, 20, 30, 40 vb. tüm boss bölümleri için boss'un ölmüş olması gerekir
        const isBossDefeated = (this.currentLevel <= 0 || this.currentLevel % 10 !== 0 || this.currentLevel === 999) || (this.boss && this.boss.isDead);
        
        if (dist < this.player.radius + p.w / 2 - 10 && isBossDefeated && !this.player.outroState) {
            this.player.outroState = 'sucking';
            this.player.outroTimer = 45;
            this.player.portalTargetX = p.x + p.w / 2;
            this.player.portalTargetY = p.y + p.h / 2;
            audio.playWin();
        }

        if (this.player.outroState === 'sucking' && this.player.outroTimer <= 0) {
            this.player.outroState = null;

            // Boss bölümlerinde yenilgi terminali göster (10, 20, 30)
            const bossDefeatLevels = [10, 20, 30];
            if (bossDefeatLevels.includes(this.currentLevel) && this.boss && this.boss.isDead) {
                this.state = 'STORY';
                this.ui.showBossDefeatTerminal(this.currentLevel, () => {
                    this.state = 'WIN';
                    this._showWinScreen();
                });
                return;
            }

            this.state = 'WIN';
            this._showWinScreen();

        }

        // --- OYUN BİTTİ (ÖLÜM) KONTROLÜ ---
        if (this.player.isDead && this.state === 'PLAYING') {
            // Eğer erime animasyonu varsa, animasyon bitene kadar gameover ekranını beklet
            if (this.player.deathType === 'melt' && this.player.meltTimer > 0) {
                // Not: Oyuncu güncellenmesi döngünün yukarısında zaten yapıldığı için
                // burada tekrar update çağrısı yapılmaz, böylece animasyon hızı normal kalır.
            } else {
                // Tek seferlik ölüm patlaması (eğer önceden yapılmadıysa)
                if (!this.player.deathSplashDone) {
                    this.emitParticles(this.player.x, this.player.y, 'enemy_pop', this.player.viscosity.color, 35);
                    this.shakeCamera(18, 25);
                    if (navigator.vibrate) navigator.vibrate(120);
                    this.player.deathSplashDone = true;
                }
                
                const isBossFight = (this.currentLevel > 0 && this.currentLevel % 10 === 0 && this.currentLevel !== 999);
                const isHardcore = (this.difficulty === 'hardcore');
                let usedRespawn = false;

                if (isBossFight && !isHardcore) {
                    const isEasy = (this.difficulty === 'easy');
                    if (isEasy || (this.bossRespawnsUsed || 0) < 1) {
                        if (!isEasy) {
                            this.bossRespawnsUsed = (this.bossRespawnsUsed || 0) + 1;
                        }
                        
                        // Boss'un o anki canını sakla
                        const savedBossHealth = this.boss ? this.boss.health : null;
                        
                        this.particles = [];
                        this.splatters = [];
                        
                        // Oyuncuyu başlangıç noktasında 1 canla canlandır
                        this.player.respawn(this.level.spawnX, this.level.spawnY, 1);
                        this.ui.updateHUDHealth(this.player.health);
                        this.ui.updateHUDViscosity(this.player.viscosity);
                        
                        // Başlangıç noktasında güzel bir canlanma efekti
                        this.emitParticles(this.level.spawnX, this.level.spawnY, 'shift', '#06b6d4', 25);
                        audio.playShift('LOW');
                        
                        // Boss'u başlangıç pozisyonuna çek ama canını koru
                        if (this.boss) {
                            this.boss.x = this.boss.startX;
                            this.boss.y = this.boss.startY;
                            this.boss.vx = 0;
                            this.boss.vy = 0;
                            if (this.currentLevel === 30) {
                                this.boss.state = 'HOVERING';
                            } else {
                                this.boss.state = (this.currentLevel === 20) ? 'GREEN_ATTACK' : 'GREEN_ROLL';
                            }
                            this.boss.stateTimer = 0;
                            if (savedBossHealth !== null) {
                                this.boss.health = savedBossHealth;
                            }
                        }
                        
                        audio.resume();
                        this.lastTime = performance.now();
                        this.physicsAccumulator = 0;
                        usedRespawn = true;
                    }
                }

                if (!usedRespawn) {
                    this.state = 'GAMEOVER';
                    this.levelDeaths++; // Ölüm sayacını gameover anında artır

                    // Ödüllü reklam butonlarının görünürlüğünü ayarla
                    const btnContinue = document.getElementById('btn-rewarded-continue');
                    const btnSkip = document.getElementById('btn-rewarded-skip');
                    const isCustom = (this.currentLevel === 999);
                    const isHardcoreMode = (this.difficulty === 'hardcore');

                    let canContinueRewardingly = false;
                    if (this.levelDeaths >= 4 && !this.rewardedContinueUsed && !isHardcoreMode && !isCustom) {
                        let checkX = this.checkpointX;
                        let checkY = this.checkpointY;
                        if (this.level.checkpoints && this.level.checkpoints.length > 0) {
                            let closestCp = null;
                            let minDistance = Infinity;
                            this.level.checkpoints.forEach(cp => {
                                const dx = this.player.x - cp.x;
                                const dy = this.player.y - cp.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestCp = cp;
                                }
                            });
                            if (closestCp && this.player.x >= closestCp.x - 200) {
                                checkX = closestCp.x;
                                checkY = closestCp.y;
                            }
                        }
                        if (checkX === this.level.spawnX && checkY === this.level.spawnY) {
                            const hasCheckpoints = this.level.checkpoints && this.level.checkpoints.length > 0;
                            if (!hasCheckpoints) {
                                const midPoint = this._findMidLevelSafePoint();
                                if (midPoint) {
                                    checkX = midPoint.x;
                                    checkY = midPoint.y;
                                }
                            }
                        }
                        if (checkX !== this.level.spawnX || checkY !== this.level.spawnY) {
                            canContinueRewardingly = true;
                        }
                    }

                    if (btnContinue) {
                        btnContinue.style.display = canContinueRewardingly ? '' : 'none';
                    }
                    if (btnSkip) {
                        const maxLvl = 30;
                        const isBossLevel = this.isBossLevel();
                        const deathThreshold = isBossLevel ? 10 : 7;
                        btnSkip.style.display = (this.levelDeaths >= deathThreshold && !this.rewardedSkipUsed && !isHardcoreMode && !isCustom && this.currentLevel < maxLvl) ? '' : 'none';
                    }

                    this.ui.showScreen('gameover');
                    this.ui.resetKeys();
                }
            }
        }
    }

    /**
     * Pre-renders soft radial gradient menu blobs on offscreen canvases for smooth menu rendering
     */
    preRenderMenuBlobs() {
        this.menuBlobCanvases = {};
        const colors = {
            green: { r: 16, g: 185, b: 129 },
            cyan: { r: 6, g: 182, b: 212 },
            pink: { r: 217, g: 70, b: 239 }
        };
        for (const [key, rgb] of Object.entries(colors)) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            const radial = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            radial.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`);
            radial.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
            radial.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
            
            ctx.fillStyle = radial;
            ctx.beginPath();
            ctx.arc(64, 64, 64, 0, Math.PI * 2);
            ctx.fill();
            
            this.menuBlobCanvases[key] = canvas;
        }
    }

    /**
     * Ana menü arka planındaki sıvı parçacıklarının fizik ve mouse tepki hareketlerini günceller
     */
    updateMenuPhysics(dt) {
        if (this.menuBlobs) {
            this.menuBlobs.forEach(blob => {
                blob.x += blob.vx * dt;
                blob.y += blob.vy * dt;
                blob.angle += blob.pulseSpeed * dt;
                
                // Bounce off canvas/window boundaries
                if (blob.x - blob.radius < 0) {
                    blob.x = blob.radius;
                    blob.vx = Math.abs(blob.vx);
                } else if (blob.x + blob.radius > this.cssWidth) {
                    blob.x = this.cssWidth - blob.radius;
                    blob.vx = -Math.abs(blob.vx);
                }
                
                if (blob.y - blob.radius < 0) {
                    blob.y = blob.radius;
                    blob.vy = Math.abs(blob.vy);
                } else if (blob.y + blob.radius > this.cssHeight) {
                    blob.y = this.cssHeight - blob.radius;
                    blob.vy = -Math.abs(blob.vy);
                }
            });
        }
        
        if (this.menuBubbles) {
            this.menuBubbles.forEach(bubble => {
                bubble.y -= bubble.speed * dt;
                
                // Interact with mouse cursor
                if (this.mouseX !== undefined && this.mouseY !== undefined) {
                    const dx = bubble.x - this.mouseX;
                    const dy = bubble.y - this.mouseY;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 0.0001;
                    if (dist < 120) {
                        const force = ((120 - dist) / 120) * 0.9 * dt;
                        bubble.x += (dx / dist) * force;
                    }
                }
                
                // Wrap around when bubble floats off-screen
                if (bubble.y < -10) {
                    bubble.y = this.cssHeight + 10;
                    bubble.x = Math.random() * this.cssWidth;
                }
                if (bubble.x < -10) bubble.x = this.cssWidth + 10;
                if (bubble.x > this.cssWidth + 10) bubble.x = -10;
            });
        }
    }

    /**
     * Ekran Çizimleri
     */
    draw() {
        // Reset transform to base DPR scale to prevent any accumulated camera/zoom transformations from previous frames
        const dpr = this._dpr || 1;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Ekranı temizle
        this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

        // --- INTRO CINEMATIC DRAWING ---
        if (this.state === 'INTRO_CINEMATIC') {
            this.drawIntroCinematic();
            return;
        }

        // --- MENU ARKA PLAN SIMULASYON ÇIZIMI ---
        if (this.state === 'MENU' || this.state === 'SHOP') {
            const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.cssHeight);
            bgGrad.addColorStop(0, '#050508');
            bgGrad.addColorStop(1, '#0e0e15');
            this.ctx.fillStyle = bgGrad;
            this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
            
            // Grid çizgileri çiz (Premium hissi)
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
            this.ctx.lineWidth = 1;
            const gridSize = 60;
            for (let x = 0; x < this.cssWidth; x += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.cssHeight);
                this.ctx.stroke();
            }
            for (let y = 0; y < this.cssHeight; y += gridSize) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.cssWidth, y);
                this.ctx.stroke();
            }
            
            // Sıvı Blobları (Metaball stili - Optimize edilmiş drawImage)
            if (this.menuBlobs) {
                if (!this.menuBlobCanvases) {
                    this.preRenderMenuBlobs();
                }
                this.menuBlobs.forEach(blob => {
                    const pulseR = blob.radius + Math.sin(blob.angle) * 15;
                    let key = 'cyan';
                    if (blob.color === '#10b981') key = 'green';
                    else if (blob.color === '#d946ef') key = 'pink';
                    
                    const canvas = this.menuBlobCanvases[key];
                    if (canvas) {
                        this.ctx.drawImage(
                            canvas,
                            blob.x - pulseR,
                            blob.y - pulseR,
                            pulseR * 2,
                            pulseR * 2
                        );
                    }
                });
            }
            
            // Baloncuklar (Optimize edilmiş, shadowBlur ve save/restore kaldırıldı)
            if (this.menuBubbles) {
                const prevAlpha = this.ctx.globalAlpha;
                this.menuBubbles.forEach(bubble => {
                    this.ctx.globalAlpha = bubble.alpha;
                    this.ctx.fillStyle = bubble.color;
                    this.ctx.beginPath();
                    this.ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
                    this.ctx.fill();
                });
                this.ctx.globalAlpha = prevAlpha;
            }
            return; // Ana menüde diğer oyun elemanlarını çizmeyi atla
        }

        // --- ARKA PLAN ÇİZİMİ ---
        const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.cssHeight);
        if (this.level.theme && this.level.theme.bgColors) {
            bgGrad.addColorStop(0, this.level.theme.bgColors[0]);
            bgGrad.addColorStop(1, this.level.theme.bgColors[1]);
        } else {
            bgGrad.addColorStop(0, '#07070b');
            bgGrad.addColorStop(1, '#0e0e18');
        }
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

        // 1. Far Parallax Cyber-Grid (Scrolling at 0.025)
        this.ctx.save();
        const themeCellColor = (this.level.theme && this.level.theme.cellColor) ? this.level.theme.cellColor : 'rgba(6, 182, 212, 0.8)';
        this.ctx.strokeStyle = themeCellColor;
        this.ctx.globalAlpha = 0.035;
        this.ctx.lineWidth = 1.0;
        const gridX = - (this.camera.x * 0.025) % 100;
        const gridY = - (this.camera.y * 0.025) % 100;
        
        // Dikey grid çizgileri
        for (let x = gridX; x < this.cssWidth; x += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.cssHeight);
            this.ctx.stroke();
        }
        // Yatay grid çizgileri
        for (let y = gridY; y < this.cssHeight; y += 100) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.cssWidth, y);
            this.ctx.stroke();
        }
        this.ctx.restore();

        // 2. Distant Neon Mountains/Pipes (Scrolling at 0.06)
        this.ctx.save();
        this.ctx.fillStyle = bgGrad;
        this.ctx.strokeStyle = themeCellColor;
        this.ctx.globalAlpha = 0.06;
        this.ctx.lineWidth = 2.0;
        this.ctx.beginPath();
        const baseHeight = this.cssHeight * 0.65;
        this.ctx.moveTo(0, this.cssHeight);
        
        for (let x = 0; x <= this.cssWidth; x += 30) {
            const worldX = x + this.camera.x * 0.06;
            const y = baseHeight + Math.sin(worldX * 0.003) * 45 + Math.cos(worldX * 0.007) * 20;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.cssWidth, this.cssHeight);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
        this.ctx.restore();

        // Paraks Derinlik Hücrelerini Çiz
        this.bgCells.forEach(cell => {
            cell.angle += cell.pulseSpeed;
            const currentSize = cell.size + Math.sin(cell.angle) * 3;
            
            // Kamera konumuna göre kaydırma miktarı (Paralaks)
            const cx = (cell.x - this.camera.x * cell.parallax + this.level.width) % this.level.width;
            const cy = (cell.y - this.camera.y * cell.parallax + this.level.height) % this.level.height;

            // Ekrandaysa çiz
            if (cx + currentSize > 0 && cx - currentSize < this.cssWidth &&
                cy + currentSize > 0 && cy - currentSize < this.cssHeight) {
                
                this.ctx.save();
                
                const themeId = (this.level.theme && this.level.theme.id) ? this.level.theme.id : 'neon_sewer';
                const color = (this.level.theme && this.level.theme.cellColor) ? this.level.theme.cellColor : 'rgba(6, 182, 212, 0.8)';
                
                this.ctx.globalAlpha = cell.alpha * 1.5; // Boost visibility for custom details
                
                if (cell.type === 'special') {
                    // Draw theme-specific background vectors
                    if (themeId === 'neon_sewer') {
                        // Spinning ventilation fan
                        const spinAngle = this.gameTime * 2.2 + cell.x;
                        this.ctx.save();
                        this.ctx.translate(cx, cy);
                        
                        // Fan outer casing
                        this.ctx.strokeStyle = color;
                        this.ctx.lineWidth = 2.5;
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
                        this.ctx.stroke();
                        
                        // Fan blades
                        this.ctx.rotate(spinAngle);
                        this.ctx.fillStyle = color;
                        for (let b = 0; b < 4; b++) {
                            this.ctx.rotate(Math.PI / 2);
                            this.ctx.beginPath();
                            this.ctx.moveTo(0, 0);
                            this.ctx.quadraticCurveTo(currentSize * 0.3, -currentSize * 0.4, currentSize * 0.9, -currentSize * 0.2);
                            this.ctx.lineTo(currentSize * 0.8, 0);
                            this.ctx.closePath();
                            this.ctx.fill();
                        }
                        
                        // Center rivet cap
                        this.ctx.fillStyle = '#ffffff';
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, currentSize * 0.16, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.restore();
                    }
                    else if (themeId === 'toxic_lab') {
                        // High-tech terminal panel outline
                        this.ctx.strokeStyle = color;
                        this.ctx.lineWidth = 1.5;
                        
                        const w = currentSize * 2;
                        const h = currentSize * 1.5;
                        this.ctx.strokeRect(cx - w/2, cy - h/2, w, h);
                        
                        // Console grid lines
                        this.ctx.strokeStyle = 'rgba(234, 179, 8, 0.15)';
                        this.ctx.lineWidth = 1;
                        for (let ly = -h/2 + 5; ly < h/2; ly += 7) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(cx - w/2 + 5, cy + ly);
                            this.ctx.lineTo(cx + w/2 - 5, cy + ly);
                            this.ctx.stroke();
                        }
                        // Flashing indicators
                        this.ctx.fillStyle = color;
                        for (let led = 0; led < 3; led++) {
                            const flash = Math.sin(this.gameTime * 6 + cell.x + led) > 0;
                            if (flash) {
                                this.ctx.beginPath();
                                this.ctx.arc(cx - w/2 + 8 + led * 10, cy + h/2 - 6, 2, 0, Math.PI * 2);
                                this.ctx.fill();
                            }
                        }
                    }
                    else if (themeId === 'magma_core') {
                        // Rotating heavy gears
                        const spinAngle = this.gameTime * 0.4 + cell.x;
                        this.ctx.save();
                        this.ctx.translate(cx, cy);
                        this.ctx.rotate(spinAngle);
                        
                        this.ctx.fillStyle = color;
                        this.ctx.strokeStyle = color;
                        this.ctx.lineWidth = 1;
                        
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, currentSize * 0.4, 0, Math.PI * 2);
                        const teeth = 8;
                        for (let t = 0; t < teeth; t++) {
                            const theta = (t / teeth) * Math.PI * 2;
                            this.ctx.lineTo(Math.cos(theta - 0.1) * currentSize, Math.sin(theta - 0.1) * currentSize);
                            this.ctx.lineTo(Math.cos(theta - 0.05) * (currentSize + 4), Math.sin(theta - 0.05) * (currentSize + 4));
                            this.ctx.lineTo(Math.cos(theta + 0.05) * (currentSize + 4), Math.sin(theta + 0.05) * (currentSize + 4));
                            this.ctx.lineTo(Math.cos(theta + 0.1) * currentSize, Math.sin(theta + 0.1) * currentSize);
                        }
                        this.ctx.closePath();
                        this.ctx.fill();
                        this.ctx.stroke();
                        
                        // Center shaft hole
                        this.ctx.globalCompositeOperation = 'destination-out';
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, currentSize * 0.2, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.restore();
                    }
                    else if (themeId === 'gravity_chasm') {
                        // Rotating cosmic void crystals
                        const spinAngle = this.gameTime * 0.7 + cell.x;
                        this.ctx.save();
                        this.ctx.translate(cx, cy);
                        this.ctx.rotate(spinAngle);
                        
                        const grad = this.ctx.createLinearGradient(-currentSize, -currentSize, currentSize, currentSize);
                        grad.addColorStop(0, '#ffffff');
                        grad.addColorStop(0.5, color);
                        grad.addColorStop(1, '#3b0764');
                        this.ctx.fillStyle = grad;
                        
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, -currentSize);
                        this.ctx.lineTo(currentSize * 0.5, 0);
                        this.ctx.lineTo(0, currentSize);
                        this.ctx.lineTo(-currentSize * 0.5, 0);
                        this.ctx.closePath();
                        this.ctx.fill();
                        
                        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        this.ctx.lineWidth = 1;
                        this.ctx.beginPath();
                        this.ctx.moveTo(0, -currentSize * 0.6);
                        this.ctx.lineTo(currentSize * 0.3, 0);
                        this.ctx.lineTo(0, currentSize * 0.6);
                        this.ctx.lineTo(-currentSize * 0.3, 0);
                        this.ctx.closePath();
                        this.ctx.stroke();
                        
                        this.ctx.restore();
                    }
                } else {
                    // Standard circular dust cloud
                    this.ctx.fillStyle = color;
                    this.ctx.beginPath();
                    this.ctx.arc(cx, cy, currentSize, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                
                this.ctx.restore();
            }
        });

        // Wrap level and game elements under scaling if zoomed
        this.ctx.save();
        const activeZoom = this.camera.zoom && this.camera.zoom !== 1;
        if (activeZoom) {
            this.ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.ctx.translate(-this.cssWidth / 2, -this.cssHeight / 2);
        }

        // Seviye Çiz
        this.level.draw(this.ctx, this.camera, this);
 
        if (this.state === 'EDITOR' && this.editor) {
            this.editor.draw(this.ctx);
        } else {
            // Düşmanları Çiz
            this.enemies.forEach(enemy => {
                enemy.draw(this.ctx, this.camera);
            });

            // Boss Çiz
            if (this.boss) {
                this.boss.draw(this.ctx, this.camera, this.level);
            }

            // Splatters Çiz (mavi parlayan boya izleri) - Optimize edilmiş, save/restore kaldırıldı, shadowBlur kaldırıldı
            if (this.splatters && this.splatters.length > 0) {
                const prevAlpha = this.ctx.globalAlpha;
                this.splatters.forEach(s => {
                    this.ctx.globalAlpha = s.life / s.maxLife;
                    this.ctx.fillStyle = s.color;
                    this.ctx.beginPath();
                    this.ctx.arc(s.x - this.camera.x, s.y - this.camera.y, s.radius, 0, Math.PI * 2);
                    this.ctx.fill();
                });
                this.ctx.globalAlpha = prevAlpha;
            }

            // Parçacıkları Çiz - Optimize edilmiş, save/restore kaldırıldı
            if (this.particles && this.particles.length > 0) {
                const prevAlpha = this.ctx.globalAlpha;
                this.particles.forEach(p => {
                    this.ctx.globalAlpha = p.alpha;
                    this.ctx.fillStyle = p.color;
                    this.ctx.beginPath();
                    this.ctx.arc(p.x - this.camera.x, p.y - this.camera.y, p.size, 0, Math.PI * 2);
                    this.ctx.fill();
                });
                this.ctx.globalAlpha = prevAlpha;
            }

            // Oyuncu Çiz
            this.player.draw(this.ctx, this.camera);

            // Ön plan paralaks elemanlarını çiz (Boru, tel, uçuşan zerreler)
            this.drawForegroundElements();

            // --- EKRAN FLAŞ KATMANI ÇİZİMİ ---
            // Flash efekti zoom'dan BAĞIMSIZ çizilir — her zaman tam ekranı kapsar
            if (this.flashDuration > 0 && this.flashColor) {
                this.ctx.save();
                // zoom transform'unu sıfırla — düz canvas koordinatlarında çiz
                this.ctx.setTransform(this._dpr || 1, 0, 0, this._dpr || 1, 0, 0);
                const alpha = (this.flashDuration / this.flashMaxDuration);
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = this.flashColor;
                this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
                this.ctx.restore();
            }

            // --- BÖLÜM TANITIM KARTI ÇİZİMİ ---
            if (this.levelCardTimer > 0) {
                const t = this.levelCardMaxTime - this.levelCardTimer;
                let alpha = 1.0;
                if (t < 30) {
                    alpha = t / 30;
                } else if (t > 150) {
                    alpha = Math.max(0, (this.levelCardMaxTime - t) / 30);
                }
                
                this.ctx.save();
                const centerY = this.cssHeight / 2;
                const hintText = LEVEL_HINTS[this.currentLevel];
                const stripeH = hintText ? 140 : 120;
                
                // Glassmorphic background stripe in the center of the screen (Fades out to 0 opacity on left and right)
                const bgGrad = this.ctx.createLinearGradient(0, 0, this.cssWidth, 0);
                bgGrad.addColorStop(0, 'rgba(7, 11, 22, 0)');
                bgGrad.addColorStop(0.25, 'rgba(7, 11, 22, 0)');
                bgGrad.addColorStop(0.5, `rgba(7, 11, 22, ${alpha * 0.45})`);
                bgGrad.addColorStop(0.75, 'rgba(7, 11, 22, 0)');
                bgGrad.addColorStop(1, 'rgba(7, 11, 22, 0)');
                
                this.ctx.fillStyle = bgGrad;
                this.ctx.fillRect(0, centerY - stripeH / 2, this.cssWidth, stripeH);
                
                // Borders also fade out towards the left and right edges
                const strokeGrad = this.ctx.createLinearGradient(0, 0, this.cssWidth, 0);
                strokeGrad.addColorStop(0, 'rgba(217, 70, 239, 0)');
                strokeGrad.addColorStop(0.25, 'rgba(217, 70, 239, 0)');
                strokeGrad.addColorStop(0.5, `rgba(217, 70, 239, ${alpha * 0.28})`);
                strokeGrad.addColorStop(0.75, 'rgba(217, 70, 239, 0)');
                strokeGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
                
                this.ctx.strokeStyle = strokeGrad;
                this.ctx.lineWidth = 1.5;
                
                this.ctx.beginPath();
                this.ctx.moveTo(0, centerY - stripeH / 2);
                this.ctx.lineTo(this.cssWidth, centerY - stripeH / 2);
                this.ctx.moveTo(0, centerY + stripeH / 2);
                this.ctx.lineTo(this.cssWidth, centerY + stripeH / 2);
                this.ctx.stroke();
                
                const lvlNum = this.currentLevel;
                const lvlName = (this.level && this.level.name) || LEVEL_NAMES[lvlNum] || "BİLİNMEYEN ALAN";
                
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                // Subtitle: BÖLÜM X
                this.ctx.font = '800 14px Outfit, sans-serif';
                this.ctx.fillStyle = `rgba(217, 70, 239, ${alpha * 0.9})`;
                this.ctx.shadowColor = '#d946ef';
                this.ctx.shadowBlur = 8;
                this.ctx.fillText(`BÖLÜM ${lvlNum}`, this.cssWidth / 2, centerY - 24);
                
                // Main Title
                this.ctx.font = '800 36px Outfit, sans-serif';
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.shadowColor = '#ffffff';
                this.ctx.shadowBlur = 12;
                this.ctx.fillText(lvlName, this.cssWidth / 2, centerY + 12);
                
                // Expanding underline
                const barProgress = Math.min(1.0, t / 40);
                const maxBarW = 280;
                const barW = maxBarW * barProgress;
                
                this.ctx.fillStyle = `rgba(217, 70, 239, ${alpha * 0.8})`;
                this.ctx.shadowColor = '#d946ef';
                this.ctx.shadowBlur = 10;
                this.ctx.fillRect(this.cssWidth / 2 - barW / 2, centerY + 38, barW, 3);
                
                // --- İPUCU METNİ (Bölüm kartı ile birlikte) ---
                if (hintText) {
                    const hintAlpha = alpha * Math.min(1.0, Math.max(0, (t - 30) / 20)); // Bölüm adından biraz sonra belirir
                    this.ctx.font = '600 13px Outfit, sans-serif';
                    this.ctx.fillStyle = `rgba(6, 182, 212, ${hintAlpha * 0.95})`;
                    this.ctx.shadowColor = '#06b6d4';
                    this.ctx.shadowBlur = 6;
                    this.ctx.fillText(hintText, this.cssWidth / 2, centerY + 54);
                }
                
                this.ctx.restore();
            }

            // --- ÖLÜM SONRASI BAĞIMSIZ İPUCU GÖSTERİMİ ---
            if (this.hintTimer > 0 && this.levelCardTimer <= 0) {
                const hText = LEVEL_HINTS[this.currentLevel];
                if (hText) {
                    const ht = this.hintMaxTime - this.hintTimer;
                    let hAlpha = 1.0;
                    if (ht < 20) {
                        hAlpha = ht / 20; // Fade in
                    } else if (ht > this.hintMaxTime - 30) {
                        hAlpha = Math.max(0, (this.hintMaxTime - ht) / 30); // Fade out
                    }

                    this.ctx.save();
                    const hY = 50; // Ekranın üst bölgesi

                    // Glassmorphic arka plan şeridi
                    const hBgGrad = this.ctx.createLinearGradient(0, 0, this.cssWidth, 0);
                    hBgGrad.addColorStop(0, 'rgba(7, 11, 22, 0)');
                    hBgGrad.addColorStop(0.3, `rgba(7, 11, 22, ${hAlpha * 0.4})`);
                    hBgGrad.addColorStop(0.7, `rgba(7, 11, 22, ${hAlpha * 0.4})`);
                    hBgGrad.addColorStop(1, 'rgba(7, 11, 22, 0)');
                    this.ctx.fillStyle = hBgGrad;
                    this.ctx.fillRect(0, hY - 18, this.cssWidth, 36);

                    // İpucu metni
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.font = '600 14px Outfit, sans-serif';
                    this.ctx.fillStyle = `rgba(6, 182, 212, ${hAlpha * 0.95})`;
                    this.ctx.shadowColor = '#06b6d4';
                    this.ctx.shadowBlur = 8;
                    this.ctx.fillText(hText, this.cssWidth / 2, hY);

                    this.ctx.restore();
                }
            }
        }

        // Draw version indicator in the corner
        this.ctx.save();
        this.ctx.setTransform(this._dpr || 1, 0, 0, this._dpr || 1, 0, 0);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('v108', this.cssWidth - 10, 10);
        
        // Print laser path coordinates for debug (yalnızca F3 ile açıldığında)
        if (this.showDebug && this.level && this.level.laserEmitters) {
            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.font = '10px monospace';
            this.level.laserEmitters.forEach((emitter, idx) => {
                if (emitter.path) {
                    let pathStr = `Emitter ${idx}: `;
                    emitter.path.forEach(pt => {
                        pathStr += `(${Math.round(pt.x)}, ${Math.round(pt.y)}) -> `;
                    });
                    this.ctx.fillText(pathStr, 10, 30 + idx * 20);
                }
            });
            if (window.laserDebugs && window.laserDebugs.length > 0) {
                this.ctx.fillStyle = '#00ff00';
                window.laserDebugs.slice(0, 6).forEach((d, idx) => {
                    let debugStr = `Dbg ${idx}: r(${Math.round(d.rx)},${Math.round(d.ry)}) dir(${d.dx},${d.dy}) box(${Math.round(d.x)},${Math.round(d.y)}) pct(${d.pct.toFixed(2)}) ix/iy(${Math.round(d.ix || d.iy)}) dst(${Math.round(d.dist)}) t(${d.mType})`;
                    this.ctx.fillText(debugStr, 10, 70 + idx * 15);
                });
            }
        }
        this.ctx.restore();

        this.ctx.restore();

        // --- AMBIENT THEME VIGNETTE OVERLAY ---
        if (this.state === 'PLAYING' && this.level.theme) {
            const themeColor = (this.level.theme && this.level.theme.cellShadowColor) ? this.level.theme.cellShadowColor : '#06b6d4';
            
            // Caching gradient to avoid expensive recreation every frame
            if (!this._cachedVignette || this._cachedVignetteWidth !== this.cssWidth || this._cachedVignetteHeight !== this.cssHeight || this._cachedVignetteThemeColor !== themeColor) {
                this._cachedVignetteWidth = this.cssWidth;
                this._cachedVignetteHeight = this.cssHeight;
                this._cachedVignetteThemeColor = themeColor;
                this._cachedVignette = this.ctx.createRadialGradient(
                    this.cssWidth / 2, this.cssHeight / 2, this.cssWidth * 0.35,
                    this.cssWidth / 2, this.cssHeight / 2, this.cssWidth * 0.72
                );
                this._cachedVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
                this._cachedVignette.addColorStop(1, this.hexToRgba(themeColor, 0.07));
            }
            
            this.ctx.save();
            this.ctx.fillStyle = this._cachedVignette;
            this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
            this.ctx.restore();
        }

        // --- LOW HEALTH WARNING VIGNETTE ---
        if (this.state === 'PLAYING' && this.player && this.player.health === 1 && !this.player.isDead) {
            // Caching red vignette gradient to avoid expensive recreation every frame
            if (!this._cachedRedVignette || this._cachedRedVignetteWidth !== this.cssWidth || this._cachedRedVignetteHeight !== this.cssHeight) {
                this._cachedRedVignetteWidth = this.cssWidth;
                this._cachedRedVignetteHeight = this.cssHeight;
                this._cachedRedVignette = this.ctx.createRadialGradient(
                    this.cssWidth / 2, this.cssHeight / 2, this.cssWidth * 0.3,
                    this.cssWidth / 2, this.cssHeight / 2, this.cssWidth * 0.76
                );
                this._cachedRedVignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
                this._cachedRedVignette.addColorStop(1, 'rgba(239, 68, 68, 1)');
            }
            
            this.ctx.save();
            const pulse = 0.22 + 0.14 * Math.sin(this.gameTime * Math.PI * 2.0); // Pulse warning overlay
            this.ctx.globalAlpha = pulse;
            this.ctx.fillStyle = this._cachedRedVignette;
            this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
            this.ctx.restore();
        }

        // --- DYNAMIC HUD MINIMAP ---
        if (this.state === 'PLAYING' && this.level) {
            this.ctx.save();
            
            // Read position from HTML placeholder to support dynamic scaling & safe areas
            const minimapEl = document.getElementById('minimap-container');
            let mapW = 260;
            let mapH = 45;
            let mapX = this.cssWidth - mapW - 24;
            let mapY = 24;
            if (minimapEl) {
                const rect = minimapEl.getBoundingClientRect();
                mapX = rect.left;
                mapY = rect.top;
                mapW = rect.width;
                mapH = rect.height;
            }
            
            // Draw glassmorphic backing panel
            this.ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            this.ctx.lineWidth = 1.5;
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 6;
            
            // Draw rounded rect panel
            this.ctx.beginPath();
            const radius = 6;
            this.ctx.moveTo(mapX + radius, mapY);
            this.ctx.lineTo(mapX + mapW - radius, mapY);
            this.ctx.quadraticCurveTo(mapX + mapW, mapY, mapX + mapW, mapY + radius);
            this.ctx.lineTo(mapX + mapW, mapY + mapH - radius);
            this.ctx.quadraticCurveTo(mapX + mapW, mapY + mapH, mapX + mapW - radius, mapY + mapH);
            this.ctx.lineTo(mapX + radius, mapY + mapH);
            this.ctx.quadraticCurveTo(mapX, mapY + mapH, mapX, mapY + mapH - radius);
            this.ctx.lineTo(mapX, mapY + radius);
            this.ctx.quadraticCurveTo(mapX, mapY, mapX + radius, mapY);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Coordinate ratios
            // Calculate active height of the level to prevent squishing when level height is arbitrarily large (like Level 14 typo or custom levels)
            let activeHeight = 600;
            let maxY = 600;
            if (this.level.platforms && this.level.platforms.length > 0) {
                const maxPlatY = Math.max(...this.level.platforms.map(p => p.y + p.h));
                if (maxPlatY > maxY) maxY = maxPlatY;
            }
            if (this.level.portal) {
                const portalBottom = this.level.portal.y + this.level.portal.h;
                if (portalBottom > maxY) maxY = portalBottom;
            }
            activeHeight = Math.min(this.level.height, Math.max(600, maxY + 50));

            const scaleX = mapW / this.level.width;
            const scaleY = mapH / activeHeight;
            
            // Set clip path to keep all map contents strictly inside the glassmorphic backing panel
            this.ctx.clip();

            // Draw bottom lava layer (thin line + soft glow gradient to keep it level-focused rather than dominating)
            const lavaY = (this.level.height - 35) * scaleY;
            
            // Determine color based on theme
            let lavaColor = '#f97316';
            if (this.level.theme && this.level.theme.id) {
                const themeId = this.level.theme.id;
                if (themeId === 'neon_sewer') lavaColor = '#10b981';
                else if (themeId === 'toxic_lab') lavaColor = '#eab308';
                else if (themeId === 'gravity_chasm') lavaColor = '#d946ef';
            }
            
            // Soft gradient below the surface line
            const lavaGrad = this.ctx.createLinearGradient(mapX, mapY + lavaY, mapX, mapY + mapH);
            lavaGrad.addColorStop(0, lavaColor + '66'); // 40% opacity neon at the surface
            lavaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.fillStyle = lavaGrad;
            this.ctx.fillRect(mapX, mapY + lavaY, mapW, mapH - lavaY);

            // Thin neon surface line
            this.ctx.fillStyle = lavaColor;
            this.ctx.fillRect(mapX, mapY + lavaY, mapW, 2);


            // Draw hazards (spikes, acid pools)
            if (this.level.hazards) {
                this.level.hazards.forEach(hazard => {
                    const hx = mapX + hazard.x * scaleX;
                    const hy = mapY + hazard.y * scaleY;
                    const hw = Math.max(2, hazard.w * scaleX);
                    let hh = Math.max(2, hazard.h * scaleY);
                    
                    if (hazard.type === 'acid') {
                        hh = Math.max(2, (this.level.height - hazard.y) * scaleY);
                        this.ctx.fillStyle = (this.level.theme && this.level.theme.acidColor) ? this.level.theme.acidColor : '#22c55e'; // Toxic neon green for acid pools
                        this.ctx.fillRect(hx, hy, hw, hh);
                    } else if (hazard.type === 'spike') {
                        this.ctx.fillStyle = (this.level.theme && this.level.theme.spikeStroke) ? this.level.theme.spikeStroke : '#ef4444'; // Red for spikes
                        this.ctx.fillRect(hx, hy, hw, hh);
                    }
                });
            }

            // Draw normal & special platforms
            if (this.level.platforms) {
                this.level.platforms.forEach(plat => {
                    const px = mapX + plat.x * scaleX;
                    const py = mapY + plat.y * scaleY;
                    const pw = Math.max(2, plat.w * scaleX);
                    const ph = Math.max(2, plat.h * scaleY);
                    
                    if (plat.sticky) {
                        this.ctx.fillStyle = 'rgba(217, 70, 239, 0.55)'; // Pink sticky
                    } else if (plat.slippery) {
                        this.ctx.fillStyle = 'rgba(6, 182, 212, 0.55)'; // Blue slippery
                    } else {
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // Normal
                    }
                    this.ctx.fillRect(px, py, pw, ph);
                });
            }
            
            // Draw moving platforms
            if (this.level.movingPlatforms) {
                this.ctx.fillStyle = 'rgba(234, 179, 8, 0.45)';
                this.level.movingPlatforms.forEach(plat => {
                    const px = mapX + plat.x * scaleX;
                    const py = mapY + plat.y * scaleY;
                    const pw = Math.max(2, plat.w * scaleX);
                    const ph = Math.max(2, plat.h * scaleY);
                    this.ctx.fillRect(px, py, pw, ph);
                });
            }

            // Draw gates (lasers, pinkLasers, net gates)
            if (this.level.gates) {
                this.level.gates.forEach(gate => {
                    const gx = mapX + gate.x * scaleX;
                    const gy = mapY + gate.y * scaleY;
                    const gw = Math.max(2, gate.w * scaleX);
                    const gh = Math.max(2, gate.h * scaleY);
                    
                    if (gate.disabled) {
                        // Inactive/open gate: Very faint indicator
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
                        this.ctx.fillRect(gx, gy, gw, gh);
                    } else {
                        // Active gate: Color by type
                        if (gate.type === 'laser') {
                            this.ctx.fillStyle = '#06b6d4'; // Cyan for blue laser
                        } else if (gate.type === 'pinkLaser') {
                            this.ctx.fillStyle = '#d946ef'; // Fuchsia/Pink for pink laser
                        } else if (gate.type === 'greenLaser') {
                            this.ctx.fillStyle = '#10b981'; // Emerald Green for green laser
                        } else if (gate.type === 'yellowLaser') {
                            this.ctx.fillStyle = '#eab308'; // Gold/Yellow for yellow laser
                        } else if (gate.type === 'net') {
                            this.ctx.fillStyle = '#a855f7'; // Purple for net gate
                        } else {
                            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                        }
                        this.ctx.fillRect(gx, gy, gw, gh);
                    }
                });
            }

            // Draw pressure plates
            if (this.level.pressurePlates) {
                this.level.pressurePlates.forEach(plate => {
                    const px = mapX + plate.x * scaleX;
                    const py = mapY + plate.y * scaleY;
                    const pw = Math.max(2, plate.w * scaleX);
                    const ph = Math.max(2, plate.h * scaleY);
                    
                    if (plate.activated) {
                        this.ctx.fillStyle = '#eab308'; // Active yellow
                    } else {
                        this.ctx.fillStyle = 'rgba(234, 179, 8, 0.25)'; // Inactive dark yellow
                    }
                    this.ctx.fillRect(px, py, pw, ph);
                });
            }

            // Draw buttons (switches)
            if (this.level.buttons) {
                this.level.buttons.forEach(button => {
                    const bx = mapX + button.x * scaleX;
                    const by = mapY + button.y * scaleY;
                    const bw = Math.max(2, button.w * scaleX);
                    const bh = Math.max(2, button.h * scaleY);
                    
                    if (button.activated) {
                        this.ctx.fillStyle = '#10b981'; // Active green
                    } else {
                        this.ctx.fillStyle = '#ef4444'; // Inactive red
                    }
                    this.ctx.fillRect(bx, by, bw, bh);
                });
            }

            // Draw crystals (collectibles)
            if (this.level.collectibles) {
                this.ctx.fillStyle = '#eab308';
                this.level.collectibles.forEach(crystal => {
                    if (!crystal.collected) {
                        const cx = mapX + crystal.x * scaleX;
                        const cy = mapY + crystal.y * scaleY;
                        this.ctx.beginPath();
                        this.ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                });
            }
            
            // Draw exit portal
            if (this.level.portal) {
                const p = this.level.portal;
                const px = mapX + (p.x + p.w / 2) * scaleX;
                const py = mapY + (p.y + p.h / 2) * scaleY;
                
                this.ctx.fillStyle = '#a855f7';
                this.ctx.shadowColor = '#a855f7';
                this.ctx.shadowBlur = 4;
                this.ctx.beginPath();
                this.ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
            
            // Draw boss (if present)
            if (this.boss && !this.boss.isDead) {
                const bx = mapX + this.boss.x * scaleX;
                const by = mapY + this.boss.y * scaleY;
                this.ctx.fillStyle = '#ef4444';
                this.ctx.shadowColor = '#ef4444';
                this.ctx.shadowBlur = 4;
                this.ctx.beginPath();
                this.ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
            
            // Draw player position
            if (this.player && !this.player.isDead) {
                const px = mapX + this.player.x * scaleX;
                const py = mapY + this.player.y * scaleY;
                const pColor = this.player.viscosity.color || '#10b981';
                
                this.ctx.fillStyle = pColor;
                this.ctx.shadowColor = pColor;
                this.ctx.shadowBlur = 5;
                this.ctx.beginPath();
                this.ctx.arc(px, py, 2.8, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            this.ctx.restore();
        }

        // UI Watermark for Editor Mode (outside the zoom scaling)
        if (this.state === 'EDITOR') {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(217, 70, 239, 0.8)'; // Bright Fuchsia
            this.ctx.shadowColor = '#d946ef';
            this.ctx.shadowBlur = 8;
            this.ctx.font = '800 13px Outfit, sans-serif';
            this.ctx.fillText('🛠️ EDITOR MODE (F1 to Exit)', 20, 30);
            this.ctx.restore();
        }
    }

    /**
     * Ön plan paralaks elemanlarını (yakın dikey/yatay borular, sarkan teller, zerreler) çizer
     */
    drawForegroundElements() {
        if (!this.fgElements || this.state !== 'PLAYING') return;
        
        const ctx = this.ctx;
        const levelW = this.level ? this.level.width : 3000;
        const levelH = this.level ? this.level.height : 600;
        
        this.fgElements.forEach(el => {
            if (el.type === 'wire') {
                // Swaying sagging cable
                ctx.save();
                ctx.strokeStyle = 'rgba(10, 15, 30, 0.88)';
                ctx.lineWidth = 3.5;
                
                const cx = el.x - this.camera.x * el.parallax;
                const cy = el.y - this.camera.y * el.parallax;
                
                const wobble = Math.sin(this.gameTime * el.wobbleSpeed + el.phase) * 12;
                
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.quadraticCurveTo(cx + wobble, cy + el.length * 0.5, cx, cy + el.length);
                ctx.stroke();
                ctx.restore();
            }
            else if (el.type === 'pipe_vertical') {
                // Vertical industrial pipe in the foreground
                ctx.save();
                const cx = el.x - this.camera.x * el.parallax;
                const cy = el.y - this.camera.y * el.parallax;
                
                // Realistic metallic gradient
                const grad = ctx.createLinearGradient(cx, 0, cx + el.w, 0);
                grad.addColorStop(0, 'rgba(10, 15, 26, 0.96)');
                grad.addColorStop(0.35, 'rgba(47, 57, 72, 0.96)');
                grad.addColorStop(0.65, 'rgba(26, 32, 44, 0.96)');
                grad.addColorStop(1, 'rgba(10, 15, 26, 0.96)');
                
                ctx.fillStyle = grad;
                ctx.fillRect(cx, cy, el.w, el.h);
                
                // Industrial collar connector ring
                ctx.fillStyle = '#090d16';
                ctx.fillRect(cx - 3, cy + el.h * 0.28, el.w + 6, 8);
                ctx.restore();
            }
            else if (el.type === 'pipe_horizontal') {
                // Horizontal industrial pipe near top
                ctx.save();
                const cx = el.x - this.camera.x * el.parallax;
                const cy = el.y - this.camera.y * el.parallax;
                
                const grad = ctx.createLinearGradient(0, cy, 0, cy + el.h);
                grad.addColorStop(0, 'rgba(10, 15, 26, 0.96)');
                grad.addColorStop(0.35, 'rgba(47, 57, 72, 0.96)');
                grad.addColorStop(0.65, 'rgba(26, 32, 44, 0.96)');
                grad.addColorStop(1, 'rgba(10, 15, 26, 0.96)');
                
                ctx.fillStyle = grad;
                ctx.fillRect(cx, cy, 15000, el.h); // Span indefinitely across width
                ctx.restore();
            }
            else if (el.type === 'bubble') {
                // Large blurry foreground gas bubble / dust mote
                el.x += el.vx;
                el.y += el.vy;
                
                // Wrap boundaries
                if (el.y < -50) {
                    el.y = levelH + 50;
                    el.x = Math.random() * levelW;
                }
                if (el.x < 0) el.x = levelW;
                if (el.x > levelW) el.x = 0;
                
                const cx = el.x - this.camera.x * el.parallax;
                const cy = el.y - this.camera.y * el.parallax;
                
                ctx.save();
                const color = (this.level.theme && this.level.theme.cellShadowColor) ? this.level.theme.cellShadowColor : '#06b6d4';
                
                // Outer soft halo
                ctx.globalAlpha = el.alpha * 0.35;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(cx, cy, el.size * 1.8, 0, Math.PI * 2);
                ctx.fill();
                
                // Inner core
                ctx.globalAlpha = el.alpha;
                ctx.beginPath();
                ctx.arc(cx, cy, el.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    /**
     * Kamera sarsıntısı tetikler
     */
    shakeCamera(intensity, duration) {
        if (window.screenShakeDisabled) return;
        this.camera.shakeIntensity = intensity;
        this.camera.shakeDuration = duration;
    }

    /**
     * Ekran donması (Hit Stop) tetikler
     */
    triggerHitStop(duration) {
        this.hitStopTimer = duration;
    }

    /**
     * Ekran flaş efekti tetikler
     */
    triggerFlash(color, duration) {
        this.flashColor = color;
        this.flashDuration = duration;
        this.flashMaxDuration = duration;
    }

    /**
     * Oyuncudan gelen fiziksel olayları ele alır (Hissiyat tetikleyicileri)
     */
    handlePlayerEvent(event, data) {
        if (event === 'land') {
            const landingSpeed = data || 0;
            if (landingSpeed > 3.0) {
                // İniş hızına göre sarsıntı şiddeti ayarı
                const intensity = Math.min((landingSpeed - 3) * 1.3 + 1, 8);
                const duration = Math.min((landingSpeed - 3) * 1.5 + 4, 14);
                this.shakeCamera(intensity, duration);
            }
        } else if (event === 'damage') {
            // Hasar hissi: Şiddetli sarsıntı, donma ve kırmızı flaş
            this.shakeCamera(14, 20);
            this.triggerHitStop(6); // 100ms donma
            this.triggerFlash('rgba(239, 68, 68, 0.55)', 15); // Kırmızı flaş
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([80, 50, 80]); // Damage haptic pattern
            }
        } else if (event === 'jump') {
            // Küçük bir fırlama sarsıntısı
            this.shakeCamera(1.5, 4);
        }
    }

    addSplatter(x, y, color) {
        const count = 4 + Math.floor(Math.random() * 4);
        const splatterGroup = [];
        
        // Center main spot
        splatterGroup.push({
            x: x,
            y: y,
            radius: 5 + Math.random() * 4,
            color: color,
            life: 150 + Math.random() * 60, // 2.5 - 3.5 seconds
            maxLife: 150 + Math.random() * 60
        });
        
        // Small radial spots
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 4 + Math.random() * 12;
            splatterGroup.push({
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                radius: 1.2 + Math.random() * 2.0,
                color: color,
                life: 150 + Math.random() * 60,
                maxLife: 150 + Math.random() * 60
            });
        }
        
        this.splatters.push(...splatterGroup);
    }

    initIntroCinematic() {
        this.introTimer = 0;
        // phases: 'matrix', 'glitch_alarm', 'shatter', 'scan', 'null_birth', 'flash', 'end'
        this.introPhase = 'matrix';
        this.introMatrixLines = [];
        this.introGlitchIntensity = 0;
        this.introCoreParticles = [];
        this.introCoreX = this.cssWidth / 2;
        this.introCoreY = this.cssHeight / 2;
        this.introCoreRadius = 60;
        this.introAlarmPlayed = false;
        this.introShatterPlayed = false;
        this.introScanSoundPlayed = false;
        this.introMatrixChars = "01010101ABCDEF#@$*".split("");
        this.introSkippable = false;
        this.introSkipped = false;

        // Sinematik sırasında HUD ve mobil kontrolleri gizle
        this.ui.hud.classList.add('hidden');
        this.ui.mobileControls.classList.add('hidden');

        // Scan phase variables
        this.introScanLines = [];
        this.introScanProgress = 0;
        this.introScanWarnings = [];

        // Null birth phase variables
        this.introNullParticles = [];
        this.introNullAssembled = false;

        // Initialize matrix columns
        const cols = Math.floor(this.cssWidth / 20) + 1;
        for (let i = 0; i < cols; i++) {
            this.introMatrixLines.push({
                x: i * 20,
                y: Math.random() * -this.cssHeight,
                speed: 3 + Math.random() * 5,
                chars: []
            });
        }

        // Skip handler — 3.5 saniye sonra geçilebilir
        const skipHandler = (e) => {
            if (!this.introSkippable) return;
            if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Escape') return;
            if (e.preventDefault) e.preventDefault();

            this.introSkipped = true;
            window.removeEventListener('keydown', skipHandler);
            this.canvas.removeEventListener('click', skipHandler);
            this.canvas.removeEventListener('touchend', skipHandler);
        };
        this._introSkipHandler = skipHandler;
        window.addEventListener('keydown', skipHandler);
        this.canvas.addEventListener('click', skipHandler);
        this.canvas.addEventListener('touchend', skipHandler, { passive: false });
    }

    updateIntroCinematic(elapsed) {
        this.introTimer += elapsed;

        // 3.5 saniye sonra geçme izni
        if (this.introTimer >= 3500) {
            this.introSkippable = true;
        }

        // Geçme tetiklendiğinde direkt sona atla
        if (this.introSkipped) {
            this.introPhase = 'end';
            this._finishIntroCinematic();
            return;
        }
        
        // Matrix lines update
        this.introMatrixLines.forEach(line => {
            line.y += line.speed * (elapsed / 16.66);
            if (line.y > this.cssHeight + 100) {
                line.y = -100;
                line.speed = 3 + Math.random() * 5;
            }
            if (Math.random() < 0.15) {
                const char = this.introMatrixChars[Math.floor(Math.random() * this.introMatrixChars.length)];
                line.chars.push({ char, yOffset: 0 });
                if (line.chars.length > 15) {
                    line.chars.shift();
                }
            }
        });

        // Phase transitions
        if (this.introTimer < 2500) {
            this.introPhase = 'matrix';
        } else if (this.introTimer < 4000) {
            this.introPhase = 'glitch_alarm';
            this.introGlitchIntensity = 0.15 + Math.sin(this.introTimer * 0.05) * 0.1;
            
            if (!this.introAlarmPlayed) {
                this.introAlarmPlayed = true;
                audio.playSystemAlert();
            }
        } else if (this.introTimer < 5200) {
            this.introPhase = 'shatter';
            this.introGlitchIntensity = 0.45;
            
            if (!this.introShatterPlayed) {
                this.introShatterPlayed = true;
                audio.playShatter();
                
                for (let i = 0; i < 80; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 8;
                    this.introCoreParticles.push({
                        x: this.introCoreX,
                        y: this.introCoreY,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        radius: 2 + Math.random() * 4,
                        color: Math.random() < 0.6 ? '#ef4444' : '#f59e0b',
                        alpha: 1.0,
                        life: 1.0,
                        decay: 0.015 + Math.random() * 0.02
                    });
                }
            }
            
            this.introCoreParticles.forEach(p => {
                p.x += p.vx * (elapsed / 16.66);
                p.y += p.vy * (elapsed / 16.66);
                p.life -= p.decay;
                p.alpha = Math.max(0, p.life);
            });
        } else if (this.introTimer < 7500) {
            // ★ YENİ FAZ: Antivirüs Tarama (scan)
            this.introPhase = 'scan';
            this.introGlitchIntensity = 0.05;
            const scanElapsed = this.introTimer - 5200;
            this.introScanProgress = Math.min(1.0, scanElapsed / 2300);

            if (!this.introScanSoundPlayed) {
                this.introScanSoundPlayed = true;
                // Alarm sesini tarama için de kullan
                audio.playSystemAlert();
            }

            // Tarama sırasında ekranda beliren uyarı metinleri
            const warningTexts = [
                { time: 300, text: "SCANNING SECTOR_01..." },
                { time: 800, text: "ANOMALY SIGNATURE DETECTED" },
                { time: 1300, text: "CLASSIFICATION: PARASITIC_CODE" },
                { time: 1800, text: "THREAT LEVEL: ████ CRITICAL ████" },
                { time: 2100, text: "INITIATING PURGE PROTOCOL..." }
            ];
            warningTexts.forEach(w => {
                if (scanElapsed >= w.time && !this.introScanWarnings.includes(w.text)) {
                    this.introScanWarnings.push(w.text);
                }
            });

        } else if (this.introTimer < 9500) {
            // ★ YENİ FAZ: Null'un Doğuşu (null_birth)
            this.introPhase = 'null_birth';
            this.introGlitchIntensity = 0.02;
            const birthElapsed = this.introTimer - 7500;

            // Null parçacıklarını oluştur
            if (!this.introNullAssembled) {
                this.introNullAssembled = true;
                const cx = this.cssWidth / 2;
                const cy = this.cssHeight / 2;
                for (let i = 0; i < 60; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 80 + Math.random() * 200;
                    this.introNullParticles.push({
                        startX: cx + Math.cos(angle) * dist,
                        startY: cy + Math.sin(angle) * dist,
                        targetX: cx + (Math.random() - 0.5) * 30,
                        targetY: cy + (Math.random() - 0.5) * 30,
                        progress: 0,
                        speed: 0.3 + Math.random() * 0.5,
                        size: 2 + Math.random() * 3,
                        hue: 120 + Math.random() * 40 // yeşil tonları
                    });
                }
            }

            // Parçacıkları merkeze doğru hareket ettir
            this.introNullParticles.forEach(p => {
                p.progress = Math.min(1.0, p.progress + p.speed * (elapsed / 300));
            });

        } else if (this.introTimer < 10000) {
            this.introPhase = 'flash';
            this.introGlitchIntensity = 0.05;
        } else {
            // End of cinematic
            this._finishIntroCinematic();
        }
    }

    /** Sinematik bitişini gerçekleştir */
    _finishIntroCinematic() {
        if (this.introPhase === 'done') return; // çift çağrıyı engelle
        this.introPhase = 'done';
        this.state = 'STORY';

        // Skip handler'ı temizle
        if (this._introSkipHandler) {
            window.removeEventListener('keydown', this._introSkipHandler);
            this.canvas.removeEventListener('click', this._introSkipHandler);
            this.canvas.removeEventListener('touchend', this._introSkipHandler);
            this._introSkipHandler = null;
        }

        this.ui.showStoryTerminal(this.currentLevel, () => {
            this.state = 'PLAYING';
            this.player.introState = 'materializing';
            this.player.introTimer = 60;
            this.lastTime = performance.now();
        });
    }

    drawIntroCinematic() {
        // Clear screen with solid black
        this.ctx.fillStyle = '#020204';
        this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

        // 1. Draw falling Matrix code
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'center';
        
        this.introMatrixLines.forEach(line => {
            if (this.introPhase === 'matrix') {
                this.ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
            } else if (this.introPhase === 'glitch_alarm') {
                this.ctx.fillStyle = Math.random() < 0.5 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)';
            } else if (this.introPhase === 'scan') {
                this.ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            } else if (this.introPhase === 'null_birth') {
                this.ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
            } else {
                this.ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
            }
            
            let y = line.y;
            line.chars.forEach((c, idx) => {
                const charY = y - (idx * 16);
                if (charY > 0 && charY < this.cssHeight) {
                    if (idx === line.chars.length - 1 && this.introPhase === 'matrix') {
                        this.ctx.fillStyle = '#ffffff';
                    }
                    this.ctx.fillText(c.char, line.x, charY);
                }
            });
        });

        // 2. Draw Core Node (matrix & glitch_alarm phases)
        if (this.introPhase === 'matrix' || this.introPhase === 'glitch_alarm') {
            const centerX = this.cssWidth / 2;
            const centerY = this.cssHeight / 2;
            this.introCoreX = centerX;
            this.introCoreY = centerY;
            
            const pulse = 1 + Math.sin(this.introTimer * 0.005) * 0.05;
            const radius = this.introCoreRadius * pulse;
            
            this.ctx.save();
            this.ctx.shadowColor = this.introPhase === 'matrix' ? '#10b981' : '#ef4444';
            this.ctx.shadowBlur = 15;
            
            this.ctx.strokeStyle = this.introPhase === 'matrix' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.7)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = this.introPhase === 'matrix' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 12px monospace';
            this.ctx.textAlign = 'center';
            if (this.introPhase === 'matrix') {
                this.ctx.fillText("CORE: VISCORA_NET [STATUS: OK]", centerX, centerY + radius + 25);
            } else {
                this.ctx.fillStyle = '#ef4444';
                if (Math.floor(this.introTimer / 150) % 2 === 0) {
                    this.ctx.fillText("SYSTEM WARNING: UNKNOWN EXPLOIT DETECTED", centerX, centerY + radius + 25);
                }
            }
        }

        // 3. Core Shattered Particles
        if (this.introPhase === 'shatter') {
            this.introCoreParticles.forEach(p => {
                if (p.alpha > 0) {
                    this.ctx.fillStyle = p.color;
                    this.ctx.globalAlpha = p.alpha;
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            });
            this.ctx.globalAlpha = 1.0;
        }

        // 4. ★ YENİ: Antivirüs Tarama Fazı
        if (this.introPhase === 'scan') {
            const cx = this.cssWidth / 2;
            const cy = this.cssHeight / 2;

            // Kırmızı tarama çizgileri — ekranın yukarısından aşağısına doğru hareket ediyor
            const scanY = this.introScanProgress * this.cssHeight;
            this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, scanY);
            this.ctx.lineTo(this.cssWidth, scanY);
            this.ctx.stroke();

            // Tarama çizgisi etrafında parlama
            const scanGrad = this.ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
            scanGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
            scanGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.15)');
            scanGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
            this.ctx.fillStyle = scanGrad;
            this.ctx.fillRect(0, scanY - 30, this.cssWidth, 60);

            // Dönen radar/hedef işareti
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(this.introTimer * 0.003);
            this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            this.ctx.lineWidth = 1.5;
            // Artı işareti
            const crossSize = 40;
            this.ctx.beginPath();
            this.ctx.moveTo(-crossSize, 0); this.ctx.lineTo(crossSize, 0);
            this.ctx.moveTo(0, -crossSize); this.ctx.lineTo(0, crossSize);
            this.ctx.stroke();
            // Daire
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 50, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();

            // Uyarı metinleri (hacker terminali stili)
            this.ctx.font = 'bold 11px monospace';
            this.ctx.textAlign = 'left';
            this.introScanWarnings.forEach((text, idx) => {
                const alpha = 0.6 + Math.sin(this.introTimer * 0.01 + idx) * 0.3;
                this.ctx.fillStyle = text.includes('CRITICAL') ? `rgba(239, 68, 68, ${alpha})` : `rgba(245, 158, 11, ${alpha})`;
                this.ctx.fillText(`> ${text}`, 30, 40 + idx * 22);
            });

            // Sağ alt köşede tarama yüzdesi
            this.ctx.font = 'bold 14px monospace';
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillText(`SCAN: ${Math.floor(this.introScanProgress * 100)}%`, this.cssWidth - 30, this.cssHeight - 30);
        }

        // 5. ★ YENİ: Null'un Doğuşu Fazı
        if (this.introPhase === 'null_birth') {
            const cx = this.cssWidth / 2;
            const cy = this.cssHeight / 2;

            // Parçacıklar merkeze toplanıyor
            this.introNullParticles.forEach(p => {
                const t = p.progress;
                const easeT = t * t * (3 - 2 * t); // smoothstep
                const x = p.startX + (p.targetX - p.startX) * easeT;
                const y = p.startY + (p.targetY - p.startY) * easeT;

                this.ctx.fillStyle = `hsla(${p.hue}, 80%, 55%, ${0.3 + t * 0.7})`;
                this.ctx.beginPath();
                this.ctx.arc(x, y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
                this.ctx.fill();
            });

            // Merkezdeki oluşan jöle formu (progress arttıkça daha belirgin)
            const avgProgress = this.introNullParticles.length > 0
                ? this.introNullParticles.reduce((s, p) => s + p.progress, 0) / this.introNullParticles.length
                : 0;

            if (avgProgress > 0.3) {
                this.ctx.save();
                this.ctx.globalAlpha = Math.min(1.0, (avgProgress - 0.3) * 2);
                this.ctx.shadowColor = '#10b981';
                this.ctx.shadowBlur = 20 + avgProgress * 15;

                // Jöle formu (basit yuvarlak blob)
                this.ctx.fillStyle = `rgba(16, 185, 129, ${0.5 + avgProgress * 0.4})`;
                this.ctx.beginPath();
                const blobSize = 12 + avgProgress * 10;
                this.ctx.arc(cx, cy, blobSize, 0, Math.PI * 2);
                this.ctx.fill();

                // İç parlama
                this.ctx.fillStyle = `rgba(52, 211, 153, ${avgProgress * 0.6})`;
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, blobSize * 0.6, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            }

            // "Null" etiketi yavaşça beliriyor
            if (avgProgress > 0.6) {
                this.ctx.save();
                this.ctx.globalAlpha = Math.min(1.0, (avgProgress - 0.6) * 2.5);
                this.ctx.font = 'bold 13px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillStyle = '#10b981';
                this.ctx.shadowColor = '#10b981';
                this.ctx.shadowBlur = 10;
                this.ctx.fillText('> ANOMALY_CELL "NULL" COMPILED', cx, cy + 45);
                this.ctx.fillStyle = '#94a3b8';
                this.ctx.shadowBlur = 0;
                this.ctx.font = '11px monospace';
                this.ctx.fillText('Form: Jöle | Sınıf: Bilinmeyen | Tehdit: ?', cx, cy + 65);
                this.ctx.restore();
            }
        }

        // 6. Glitch Screen Slices
        if (this.introGlitchIntensity > 0 && Math.random() < this.introGlitchIntensity) {
            const slices = 3 + Math.floor(Math.random() * 5);
            for (let i = 0; i < slices; i++) {
                const sy = Math.random() * this.cssHeight;
                const sh = 10 + Math.random() * 40;
                const disp = (Math.random() - 0.5) * 45;
                
                this.ctx.drawImage(
                    this.canvas,
                    0, sy, this.cssWidth, sh,
                    disp, sy, this.cssWidth, sh
                );
            }
            
            this.ctx.fillStyle = Math.random() < 0.5 ? 'rgba(239, 68, 68, 0.45)' : 'rgba(245, 158, 11, 0.45)';
            this.ctx.fillRect(0, Math.random() * this.cssHeight, this.cssWidth, 2 + Math.random() * 6);
        }

        // 7. Recovery flash
        if (this.introPhase === 'flash') {
            this.ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
            this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("BACKUP_RECOVERY INITIALIZED... DEPLOYING NULL", this.cssWidth / 2, this.cssHeight / 2);
        }

        // 8. ★ YENİ: Geçme ipucu (3.5 saniye sonra)
        if (this.introSkippable && this.introPhase !== 'flash' && this.introPhase !== 'done') {
            const blinkAlpha = 0.4 + Math.sin(this.introTimer * 0.006) * 0.3;
            this.ctx.save();
            this.ctx.globalAlpha = blinkAlpha;
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#94a3b8';
            const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            const skipText = isTouchDevice ? '[ Geçmek için dokun ]' : '[ Geçmek için SPACE ]';
            this.ctx.fillText(skipText, this.cssWidth / 2, this.cssHeight - 25);
            this.ctx.restore();
        }
    }

    submitCampaignScore(levelNumber, timeValue) {
        let username = localStorage.getItem('viscora_author_name');
        if (!username || username === 'Tasarımcı' || username.trim() === '') {
            username = 'Oyuncu';
        }
        const myUserId = localStorage.getItem('viscora_user_id') || 'user_anon';
        
        const API_BASE = 'https://viscora.onrender.com';
            
        // Reset container to loading state
        const boardList = document.getElementById('win-leaderboard-list');
        const percentileText = document.getElementById('win-percentile-text');
        if (boardList) boardList.innerHTML = '<div style="color: #9ca3af; text-align:center;">Skorlar yükleniyor...</div>';
        if (percentileText) percentileText.textContent = '';
        
        fetch(`${API_BASE}/api/campaign/${levelNumber}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myUserId, username: username, time: timeValue })
        })
        .then(res => {
            if (!res.ok) throw new Error("Kampanya skoru kaydedilemedi.");
            return res.json();
        })
        .then(data => {
            if (boardList) {
                boardList.innerHTML = '';
                if (data.leaderboard && data.leaderboard.length > 0) {
                    data.leaderboard.forEach((s, idx) => {
                        const medalEmoji = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉');
                        const medalColor = idx === 0 ? '#f59e0b' : (idx === 1 ? '#cbd5e1' : '#b45309');
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.justifyContent = 'space-between';
                        row.style.alignItems = 'center';
                        row.style.padding = '3px 0';
                        row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
                        
                        const left = document.createElement('span');
                        left.style.color = '#f3f4f6';
                        left.style.display = 'flex';
                        left.style.alignItems = 'center';
                        left.style.gap = '6px';
                        left.innerHTML = `<span style="color: ${medalColor}">${medalEmoji}</span> ${s.username}`;
                        
                        const right = document.createElement('span');
                        right.style.color = '#38bdf8';
                        right.textContent = this.formatTime(s.time);
                        
                        row.appendChild(left);
                        row.appendChild(right);
                        boardList.appendChild(row);
                    });
                } else {
                    boardList.innerHTML = '<div style="color: #9ca3af; text-align:center;">Henüz derece yok.</div>';
                }
            }
            if (percentileText && data.percentile !== null) {
                percentileText.innerHTML = `Süreniz en hızlı oyuncular arasında <span style="color: #34d399; font-weight: bold;">ilk %${data.percentile}'lik</span> dilimde! (Sıralama: ${data.rank}/${data.totalPlayers})`;
            }
        })
        .catch(err => {
            console.error("Kampanya skor kaydetme hatası:", err);
            if (boardList) boardList.innerHTML = '<div style="color: #ef4444; text-align:center;">Yükleme başarısız.</div>';
        });
    }

    formatTime(timeSecs) {
        const min = Math.floor(timeSecs / 60);
        const sec = Math.floor(timeSecs % 60);
        const ms = Math.floor((timeSecs % 1) * 100);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}
export default GameManager;





