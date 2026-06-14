import { audio } from './audio.js?v=v77';
import { THEMES } from './generator.js?v=v77';

/**
 * Viscora Level Design & Manager
 */

export class Level {
    constructor() {
        this.currentLevel = 1;
        this.dragonHeadImage = new Image();
        this.dragonHeadImage.src = 'assets/dragon_head.png';
        this.dragonHeadLoaded = false;
        this.dragonHeadImage.onload = () => {
            this.dragonHeadLoaded = true;
        };
        this.laserEmitters = [];
        this.laserReceivers = [];
        this.staticMirrors = [];
        this.loadLevel(1);
    }

    /**
     * Belirtilen bölümün platform, tehlike ve zıplatma pedi koordinatlarını yükler.
     */
    loadLevel(levelNumber, isEditorOrPlaytest = false) {
        this.currentLevel = levelNumber;
        this.time = 0;
        this.platforms = [];
        this.hazards = [];
        this.enemies = [];
        this.movingPlatforms = [];
        this.gates = [];
        this.collectibles = [];
        this.pressurePlates = [];
        this.pushBlocks = [];
        this.conveyors = [];
        this.teleportPairs = [];
        this.bouncePads = [];
        this.buttons = [];
        this.levers = [];
        this.fallingPlatforms = [];
        this.breakablePlatforms = [];
        this.hiddenPassages = [];
        this.fallingBlockTraps = [];
        this.vantuzPoints = [];
        this.decorations = [];
        this.flamethrowers = [];
        this.arrowShooters = [];
        this.laserEmitters = [];
        this.laserReceivers = [];
        this.staticMirrors = [];

        let data = null;
        if (typeof levelNumber === 'object' && levelNumber !== null) {
            data = levelNumber;
        } else if (isEditorOrPlaytest) {
            // Boss bölümleri (10 ve 20) için lokal kayıtlı özel haritaları yükleme, orijinal boss dövüşünü yükle
            const isBossLvl = (levelNumber === 10 || levelNumber === 20);
            if (!isBossLvl) {
                const savedLevelData = localStorage.getItem('viscora_custom_level_' + levelNumber);
                if (savedLevelData) {
                    try {
                        data = JSON.parse(savedLevelData);
                    } catch (err) {
                        console.error("Error parsing saved custom level:", err);
                    }
                }
            }
        }

        if (data) {
            try {
                this.width = Math.max(800, data.levelWidth || data.width || 2000);
                this.height = Math.max(600, data.levelHeight || data.height || 600);

                if (data.spawn) {
                    this.spawnX = data.spawn.x !== undefined ? data.spawn.x : 80;
                    this.spawnY = data.spawn.y !== undefined ? data.spawn.y : 350;
                } else {
                    this.spawnX = data.spawnX !== undefined ? data.spawnX : 80;
                    this.spawnY = data.spawnY !== undefined ? data.spawnY : 350;
                }

                if (data.portal) {
                    this.portal = {
                        x: data.portal.x !== undefined ? data.portal.x : 300,
                        y: data.portal.y !== undefined ? data.portal.y : 380,
                        w: data.portal.w || 60,
                        h: data.portal.h || 80,
                        angle: data.portal.angle || 0
                    };
                } else {
                    this.portal = { x: 300, y: 380, w: 60, h: 80, angle: 0 };
                }

                if (Array.isArray(data.platforms)) {
                    this.platforms = data.platforms.map(p => ({
                        x: p.x,
                        y: p.y,
                        w: p.w || 120,
                        h: p.h || 40,
                        type: p.type || 'normal',
                        sticky: p.type === 'sticky',
                        slippery: p.type === 'slippery',
                        passage: p.type === 'passage' || !!p.passage
                    }));
                } else {
                    this.platforms = [];
                }

                this.hazards = [];
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

                        this.hazards.push({
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
                        this.hazards.push({
                            x: a.x,
                            y: a.y,
                            w: a.w !== undefined ? a.w : 120,
                            h: a.h !== undefined ? a.h : 70,
                            type: 'acid'
                        });
                    });
                }
                if (Array.isArray(data.hazards)) {
                    data.hazards.forEach(h => {
                        if (!this.hazards.some(exist => exist.x === h.x && exist.y === h.y)) {
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

                            this.hazards.push({
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

                if (Array.isArray(data.movingPlatforms)) {
                    this.movingPlatforms = data.movingPlatforms.map(mp => ({
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

                if (Array.isArray(data.lasers)) {
                    data.lasers.forEach(l => {
                        this.gates.push({
                            x: l.x,
                            y: l.y,
                            w: l.w !== undefined ? l.w : 20,
                            h: l.h !== undefined ? l.h : 220,
                            type: l.type === 'pink' ? 'pinkLaser' :
                                  l.type === 'green' ? 'greenLaser' :
                                  l.type === 'yellow' ? 'yellowLaser' :
                                  l.type === 'blue' ? 'laser' :
                                  (l.type || 'laser'),
                            id: l.id !== undefined ? l.id : (100 + Math.floor(Math.random() * 900)),
                            disabled: false,
                            moving: l.moving || false,
                            startX: l.startX !== undefined ? l.startX : l.x,
                            startY: l.startY !== undefined ? l.startY : l.y,
                            targetX: l.targetX !== undefined ? l.targetX : l.x,
                            targetY: l.targetY !== undefined ? l.targetY : l.y,
                            speed: l.speed || 0.015,
                            dir: l.dir || 1,
                            progress: l.progress || 0
                        });
                    });
                }

                if (Array.isArray(data.netGates)) {
                    data.netGates.forEach(n => {
                        this.gates.push({
                            x: n.x,
                            y: n.y,
                            w: n.w !== undefined ? n.w : 20,
                            h: n.h !== undefined ? n.h : 220,
                            type: 'net',
                            id: n.id !== undefined ? n.id : (100 + Math.floor(Math.random() * 900)),
                            disabled: false,
                            moving: n.moving || false,
                            startX: n.startX !== undefined ? n.startX : n.x,
                            startY: n.startY !== undefined ? n.startY : n.y,
                            targetX: n.targetX !== undefined ? n.targetX : n.x,
                            targetY: n.targetY !== undefined ? n.targetY : n.y,
                            speed: n.speed || 0.015,
                            dir: n.dir || 1,
                            progress: n.progress || 0
                        });
                    });
                }

                if (Array.isArray(data.gates)) {
                    data.gates.forEach(g => {
                        if (!this.gates.some(exist => exist.x === g.x && exist.y === g.y)) {
                            this.gates.push({
                                x: g.x,
                                y: g.y,
                                w: g.w || 20,
                                h: g.h || 220,
                                type: g.type || 'laser',
                                id: g.id || (100 + Math.floor(Math.random() * 900)),
                                disabled: g.disabled || false,
                                moving: g.moving || false,
                                startX: g.startX !== undefined ? g.startX : g.x,
                                startY: g.startY !== undefined ? g.startY : g.y,
                                targetX: g.targetX !== undefined ? g.targetX : g.x,
                                targetY: g.targetY !== undefined ? g.targetY : g.y,
                                speed: g.speed || 0.015,
                                dir: g.dir || 1,
                                progress: g.progress || 0
                            });
                        }
                    });
                }

                if (Array.isArray(data.crystals)) {
                    this.collectibles = data.crystals.map(c => ({
                        x: c.x,
                        y: c.y,
                        collected: false
                    }));
                } else if (Array.isArray(data.collectibles)) {
                    this.collectibles = data.collectibles.map(c => ({
                        x: c.x,
                        y: c.y,
                        collected: false,
                        color: c.color || '#eab308'
                    }));
                }

                if (Array.isArray(data.enemies)) {
                    this.enemies = data.enemies.map(e => ({
                        x: e.x,
                        y: e.y,
                        rangeX: e.rangeX !== undefined ? e.rangeX : 120,
                        speed: e.speed !== undefined ? e.speed : 1.2,
                        isVertical: !!e.isVertical,
                        color: e.color || '#f43f5e',
                        type: e.type || 'patrol'
                    }));
                }

                if (Array.isArray(data.pressurePlates)) {
                    this.pressurePlates = data.pressurePlates.map(pp => ({
                        x: pp.x,
                        y: pp.y,
                        w: pp.w || 50,
                        h: pp.h || 10,
                        activated: pp.activated || false,
                        linkedGateId: pp.linkedGateId
                    }));
                }

                if (Array.isArray(data.pushBlocks)) {
                    this.pushBlocks = data.pushBlocks.map(pb => ({
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

                if (Array.isArray(data.conveyors)) {
                    this.conveyors = data.conveyors.map(c => ({
                        x: c.x,
                        y: c.y,
                        w: c.w || 120,
                        h: c.h || 20,
                        direction: c.direction !== undefined ? c.direction : 1,
                        speed: c.speed !== undefined ? c.speed : 1.5
                    }));
                }

                if (Array.isArray(data.teleportPairs)) {
                    this.teleportPairs = data.teleportPairs.map(tp => ({
                        x1: tp.x1,
                        y1: tp.y1,
                        x2: tp.x2,
                        y2: tp.y2,
                        color: tp.color || '#a855f7',
                        cooldown: 0
                    }));
                }

                if (Array.isArray(data.bouncePads)) {
                    this.bouncePads = data.bouncePads.map(bp => ({
                        x: bp.x,
                        y: bp.y,
                        w: bp.w || 50,
                        h: bp.h || 20,
                        force: bp.force !== undefined ? bp.force : 12.0,
                        active: false,
                        timer: 0
                    }));
                }

                if (Array.isArray(data.buttons)) {
                    this.buttons = data.buttons.map(b => ({
                        x: b.x,
                        y: b.y,
                        w: b.w || 32,
                        h: b.h || 32,
                        activated: b.activated || false,
                        linkedGateId: b.linkedGateId,
                        timer: b.timer || 0
                    }));
                }

                if (Array.isArray(data.flamethrowers)) {
                    this.flamethrowers = data.flamethrowers.map(f => {
                        const dir = f.dir || 'right';
                        const isVert = dir === 'right' || dir === 'left';
                        const targetW = isVert ? 32 : 58;
                        const targetH = isVert ? 58 : 32;
                        return {
                            id: f.id !== undefined ? f.id : Math.random(),
                            startX: f.startX !== undefined ? f.startX : f.x,
                            startY: f.startY !== undefined ? f.startY : f.y,
                            x: f.x,
                            y: f.y,
                            w: targetW,
                            h: targetH,
                            dir: dir,
                            range: f.range || 200,
                            moving: !!f.moving,
                            moveRange: f.moveRange || 100,
                            moveSpeed: f.moveSpeed || 1.5,
                            moveAxis: f.moveAxis || 'y',
                            moveDir: f.moveDir || 1,
                            progress: f.progress || 0,
                            disabled: !!f.disabled,
                            active: f.active !== undefined ? f.active : true,
                            currentLength: f.currentLength || 0
                        };
                    });
                }

                if (Array.isArray(data.levers)) {
                    this.levers = data.levers.map(l => ({
                        x: l.x,
                        y: l.y,
                        w: l.w || 32,
                        h: l.h || 32,
                        activated: l.activated || false,
                        linkedGateId: l.linkedGateId,
                        cooldown: 0
                    }));
                }

                if (Array.isArray(data.fallingPlatforms)) {
                    this.fallingPlatforms = data.fallingPlatforms.map(p => ({
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

                if (Array.isArray(data.breakablePlatforms)) {
                    this.breakablePlatforms = data.breakablePlatforms.map(p => ({
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

                if (Array.isArray(data.hiddenPassages)) {
                    this.hiddenPassages = data.hiddenPassages.map(p => ({
                        x: p.x,
                        y: p.y,
                        w: p.w || 120,
                        h: p.h || 40
                    }));
                }

                if (Array.isArray(data.fallingBlockTraps)) {
                    this.fallingBlockTraps = data.fallingBlockTraps.map(t => ({
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

                if (Array.isArray(data.vantuzPoints)) {
                    this.vantuzPoints = data.vantuzPoints.map(v => ({
                        x: v.x,
                        y: v.y,
                        cooldown: 0
                    }));
                }

                if (Array.isArray(data.decorations)) {
                    this.decorations = data.decorations.map(d => {
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
                            startRotation: d.rotation || 0,
                            state: d.state || 0,
                            text: d.text || '',
                            color: d.color || ''
                        };
                    });
                }

                if (Array.isArray(data.checkpoints)) {
                    this.checkpoints = data.checkpoints.map(cp => ({
                        x: cp.x,
                        y: cp.y,
                        r: cp.r || 15,
                        activated: cp.activated || false
                    }));
                } else {
                    this.generateCheckpoints();
                }

                if (Array.isArray(data.arrowShooters)) {
                    this.arrowShooters = data.arrowShooters.map(a => ({
                        x: a.x,
                        y: a.y,
                        w: a.w || 48,
                        h: a.h || 48,
                        dir: a.dir || 'right',
                        detectionRadius: a.detectionRadius !== undefined ? a.detectionRadius : 200,
                        fireInterval: a.fireInterval !== undefined ? a.fireInterval : 2.5,
                        arrowSpeed: a.arrowSpeed !== undefined ? a.arrowSpeed : 4.5,
                        arrowRange: a.arrowRange !== undefined ? a.arrowRange : 400,
                        // Runtime state
                        fireTimer: 0,
                        arrows: []
                    }));
                } else {
                    this.arrowShooters = [];
                }

                if (Array.isArray(data.laserEmitters)) {
                    this.laserEmitters = data.laserEmitters.map(e => ({
                        x: e.x,
                        y: e.y,
                        w: 40,
                        h: 40,
                        direction: e.direction !== undefined ? e.direction : 0,
                        color: e.color || 'blue',
                        path: []
                    }));
                } else {
                    this.laserEmitters = [];
                }

                if (Array.isArray(data.laserReceivers)) {
                    this.laserReceivers = data.laserReceivers.map(r => ({
                        x: r.x,
                        y: r.y,
                        w: 40,
                        h: 40,
                        linkedGateId: r.linkedGateId,
                        activated: false
                    }));
                } else {
                    this.laserReceivers = [];
                }

                if (Array.isArray(data.staticMirrors)) {
                    this.staticMirrors = data.staticMirrors.map(m => ({
                        x: m.x,
                        y: m.y,
                        w: m.w || 40,
                        h: m.h || 40,
                        mirrorType: m.mirrorType || 'slash'
                    }));
                } else {
                    this.staticMirrors = [];
                }

                // Resolve custom level theme
                const customThemeId = data.themeId || data.theme || 'neon_sewer';
                this.theme = THEMES.find(t => t.id === customThemeId) || THEMES[0];

                this.resetLevelRuntimeState();
                
                // Notify audio engine of theme change
                try {
                    audio.setTheme(this.theme.id);
                } catch(e) {}
                
                return; // Return early, custom level loaded!
            } catch (err) {
                console.error("Error loading custom level from localStorage, falling back to campaign default:", err);
            }
        }

        // Assign Visual Theme based on Campaign Level Number
        let campaignThemeId = null;
        if (levelNumber <= 20) {
            if (levelNumber === 0 || levelNumber === 1 || levelNumber === 6 || levelNumber === 12 || levelNumber === 19) {
                campaignThemeId = 'neon_sewer';
            } else if (levelNumber === 2 || levelNumber === 4 || levelNumber === 8 || levelNumber === 9 || levelNumber === 11 || levelNumber === 13 || levelNumber === 17 || levelNumber === 18) {
                campaignThemeId = 'toxic_lab';
            } else if (levelNumber === 3 || levelNumber === 7 || levelNumber === 14 || levelNumber === 15) {
                campaignThemeId = 'magma_core';
            } else if (levelNumber === 5 || levelNumber === 10 || levelNumber === 16 || levelNumber === 20) {
                campaignThemeId = 'gravity_chasm';
            }
        } else {
            // For levels > 20, map based on group
            const groupIndex = Math.ceil(levelNumber / 10);
            if (groupIndex === 3 || groupIndex === 7) {
                campaignThemeId = 'magma_core';
            } else if (groupIndex === 4 || groupIndex === 8) {
                campaignThemeId = 'gravity_chasm';
            } else if (groupIndex === 5 || groupIndex === 9) {
                campaignThemeId = 'neon_sewer';
            } else {
                campaignThemeId = 'toxic_lab';
            }
        }

        if (campaignThemeId) {
            this.theme = THEMES.find(t => t.id === campaignThemeId) || null;
        } else {
            this.theme = null;
        }

        if (levelNumber === 0) {
// ═══════════════════════════════════════════════
            // BÖLÜM 0: EĞİTİM LABORATUVARI — İlk Adımlar
            // ═══════════════════════════════════════════════
            this.width = 2420;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 380;

            this.platforms = [
                {
                                "x": 0,
                                "y": 460,
                                "w": 1200,
                                "h": 140,
                                "type": "normal"
                },
                {
                                "x": 1560,
                                "y": 320,
                                "w": 120,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 300,
                                "y": 200,
                                "w": 140,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 1720,
                                "y": 220,
                                "w": 440,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 2080,
                                "y": 340,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 1520,
                                "y": 120,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 1340,
                                "y": 40,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 1020,
                                "y": -20,
                                "w": 240,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 580,
                                "y": 240,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 760,
                                "y": 140,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 640,
                                "y": 40,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 820,
                                "y": -20,
                                "w": 60,
                                "h": 20,
                                "type": "normal"
                },
                {
                                "x": 2300,
                                "y": 40,
                                "w": 120,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 2300,
                                "y": 160,
                                "w": 120,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 2180,
                                "y": 120,
                                "w": 140,
                                "h": 40,
                                "type": "normal"
                },
                {
                                "x": 2220,
                                "y": 80,
                                "w": 100,
                                "h": 15,
                                "type": "normal"
                }
];

            this.hazards = [
                {
                                "x": 460,
                                "y": 440,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 820,
                                "y": 440,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 1060,
                                "y": 440,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 1000,
                                "y": 440,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 300,
                                "y": 180,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 380,
                                "y": 180,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 1880,
                                "y": 200,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 1960,
                                "y": 200,
                                "w": 60,
                                "h": 20,
                                "type": "spike",
                                "direction": "up"
                },
                {
                                "x": 1200,
                                "y": 460,
                                "w": 420,
                                "h": 70,
                                "type": "acid"
                },
                {
                                "x": 2260,
                                "y": 460,
                                "w": 155,
                                "h": 70,
                                "type": "acid"
                }
];

            this.gates = [
                {
                                "x": 1940,
                                "y": -60,
                                "w": 20,
                                "h": 260,
                                "type": "yellowLaser",
                                "id": 312,
                                "disabled": false
                }
];

            this.movingPlatforms = [
                {
                                "startX": 1340,
                                "startY": 380,
                                "targetX": 1353,
                                "targetY": 380,
                                "x": 1340,
                                "y": 380,
                                "w": 100,
                                "h": 20,
                                "type": "moving",
                                "speed": 0.015,
                                "dir": 1,
                                "progress": 0
                }
];

            this.collectibles = [];
            this.pressurePlates = [];
            this.pushBlocks = [];
            this.conveyors = [];
            this.teleportPairs = [];

            this.enemies = [
                {
                                "x": 960,
                                "y": 420,
                                "rangeX": 120,
                                "speed": 1.2,
                                "isVertical": false,
                                "color": "#f43f5e"
                },
                {
                                "x": 680,
                                "y": 400,
                                "rangeX": 180,
                                "speed": 2,
                                "isVertical": false,
                                "color": "#eab308"
                },
                {
                                "x": 1280,
                                "y": 320,
                                "rangeX": 120,
                                "speed": 1.2,
                                "isVertical": true,
                                "color": "#06b6d4"
                },
                {
                                "x": 1620,
                                "y": 240,
                                "rangeX": 180,
                                "speed": 2,
                                "isVertical": false,
                                "color": "#eab308"
                }
];

            this.bouncePads = [
                {
                                "x": 340,
                                "y": 440,
                                "w": 50,
                                "h": 20,
                                "force": 12,
                                "active": false,
                                "timer": 0
                }
];

            this.levers = [
                {
                                "x": 1100,
                                "y": -40,
                                "w": 32,
                                "h": 32,
                                "linkedGateId": 312,
                                "cooldown": 0
                }
];
            this.buttons = [];

            this.fallingBlockTraps = [
                {
                                "startX": 340,
                                "startY": 240,
                                "x": 340,
                                "y": 240,
                                "w": 60,
                                "h": 60,
                                "state": "idle",
                                "vy": 0,
                                "timer": 0
                }
];

            this.portal = {
                "x": 2340,
                "y": 80,
                "w": 60,
                "h": 80,
                "angle": 0
};

            this.decorations = [
                {
                                "x": 40,
                                "y": 120,
                                "w": 200,
                                "h": 100,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "ÖĞRETİCİ BÖLÜME HOŞGELDİNİZ !  Viskozite \" E \" ile değiştirilecek bunu sana hatırlatıcam :D ",
                                "color": "#06b6d4"
                },
                {
                                "x": 320,
                                "y": 80,
                                "w": 100,
                                "h": 80,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "zamanlama önemli",
                                "color": "#06b6d4"
                },
                {
                                "x": 980,
                                "y": 120,
                                "w": 200,
                                "h": 60,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "Her zaman birden fazla yol bulabilirsiniz !",
                                "color": "#06b6d4"
                },
                {
                                "x": 580,
                                "y": 480,
                                "w": 200,
                                "h": 80,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "Kafalarına basarak dikenli topları öldürebilirsin !",
                                "color": "#06b6d4"
                },
                {
                                "x": 1760,
                                "y": 360,
                                "w": 200,
                                "h": 80,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "Hareketli platformlara her zaman dikkat etmeyi unutma !",
                                "color": "#06b6d4"
                },
                {
                                "x": 1620,
                                "y": -100,
                                "w": 200,
                                "h": 100,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "Şalterler ile bölümlerdeki Sarı Lazer Kapıları açabilirsiniz , aksi halde canınız epey yanıcaktır ...",
                                "color": "#06b6d4"
                },
                {
                                "x": 2300,
                                "y": 160,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2180,
                                "y": 120,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2300,
                                "y": 40,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2380,
                                "y": 160,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2280,
                                "y": 120,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2380,
                                "y": 40,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2320,
                                "y": 180,
                                "w": 80,
                                "h": 40,
                                "type": "cable",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2320,
                                "y": 60,
                                "w": 80,
                                "h": 40,
                                "type": "cable",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2200,
                                "y": 140,
                                "w": 100,
                                "h": 40,
                                "type": "cable",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2240,
                                "y": 80,
                                "w": 20,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2220,
                                "y": 60,
                                "w": 40,
                                "h": 40,
                                "type": "gear",
                                "rotation": 7.560000000000018,
                                "startRotation": 7.560000000000018,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 1620,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 1700,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 1780,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 1860,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 1940,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2180,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2020,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2100,
                                "y": 500,
                                "w": 80,
                                "h": 20,
                                "type": "pipe",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "",
                                "color": ""
                },
                {
                                "x": 2040,
                                "y": -20,
                                "w": 200,
                                "h": 60,
                                "type": "textbox",
                                "rotation": 0,
                                "startRotation": 0,
                                "state": 0,
                                "text": "Yeterince küçülürsen her yerden  geçebilirsin",
                                "color": "#06b6d4"
                }
];
        } else if (levelNumber === 1) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 1: NEON GİRİŞİ — Tehlikeli Işıklar
            // ═══════════════════════════════════════════════
            this.width = 3000;
            this.height = 600;
            this.spawnX = 100;
            this.spawnY = 380;

            this.platforms = [
                { x: 0, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 550, y: 460, w: 120, h: 140, type: 'normal' },
                { x: 920, y: 380, w: 350, h: 220, type: 'normal' },
                { x: 1360, y: 460, w: 350, h: 140, type: 'normal' },
                { x: 1540, y: -20, w: 50, h: 420, type: 'sticky', sticky: true },
                { x: 1600, y: 320, w: 250, h: 280, type: 'normal' },
                { x: 1840, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 1960, y: -90, w: 200, h: 520, type: 'normal' },
                { x: 2240, y: 380, w: 550, h: 220, type: 'normal' },
                { x: 1040, y: 40, w: 140, h: 40, type: 'normal' },
                { x: 1460, y: -120, w: 220, h: 40, type: 'normal' },
                { x: 2360, y: 60, w: 100, h: 40, type: 'normal' }
            ];

            this.hazards = [
                { x: 160, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1640, y: 300, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1020, y: 360, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1140, y: 360, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1080, y: 360, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 280, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1940, y: -100, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2000, y: -100, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2120, y: -100, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2060, y: -100, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1860, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1540, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1400, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1080, y: 80, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1940, y: 220, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 2160, y: 280, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 2380, y: 360, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1040, y: 20, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1120, y: 20, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 400, y: 480, w: 150, h: 70, type: 'acid' },
                { x: 675, y: 480, w: 241, h: 70, type: 'acid' }
            ];

            this.movingPlatforms = [
                { startX: 660, startY: 360, targetX: 815, targetY: 360, x: 660, y: 360, w: 100, h: 25, type: 'moving', speed: 0.015, dir: 1, progress: 0 }
            ];

            this.gates = [
                { x: 1100, y: 120, w: 20, h: 220, type: 'laser', id: 101, disabled: false },
                { x: 2400, y: 100, w: 20, h: 260, type: 'laser', id: 102, disabled: false }
            ];

            this.collectibles = [
                { x: 1180, y: 200, color: '#eab308', collected: false },
                { x: 760, y: 140, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 500, y: 260, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 2340, y: 360, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 940, y: 120, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 880, y: 280, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 620, y: 80, rangeX: 120, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1100, y: -20, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' }
            ];

            this.bouncePads = [];

            this.fallingBlockTraps = [
                { startX: 2520, startY: 180, x: 2520, y: 180, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.portal = {
                x: 2700,
                y: 300,
                w: 60,
                h: 80,
                angle: 0
            };

            this.decorations = [
                { x: 40, y: 420, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 80, y: 420, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 40, y: 380, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 120, y: 420, w: 40, h: 40, type: 'fan', rotation: 281.39999999999884, startRotation: 281.39999999999884, state: 0, text: '', color: '' },
                { x: 20, y: 300, w: 20, h: 80, type: 'neon_light', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 20, y: 380, w: 20, h: 80, type: 'neon_light', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 180, y: 220, w: 200, h: 90, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Viscoraya Hoşgeldiniz !              "E" tuşu ile karakter viskozitesini değiştirebilirsin.', color: '#eab308' },
                { x: 800, y: -60, w: 200, h: 90, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Sadece uygun renk ile lazerden geçebilirsin !  Unutma her zaman farklı bir seçenek mümkündür :)', color: '#06b6d4' },
                { x: 1660, y: -40, w: 200, h: 90, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Pembe(Katı) formda duvarlara yapışabilirsin ama unutma çok daha ağır olucaksın !', color: '#d946ef' },
                { x: 1960, y: 280, w: 200, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Normal formda küçülme yeteneğini kullanarak dar bölgelerden geçebilirsin . ', color: '#eab308' },
                { x: 2500, y: 20, w: 200, h: 40, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Aman KAFANA dikkat et !', color: '#06b6d4' },
                { x: 1000, y: 420, w: 200, h: 90, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Mavi(Sıvı) formda                           double jump (Çifte Zıplama)özelliğini kullanmayı unutma ! ', color: '#06b6d4' }
            ];
        } else if (levelNumber === 2) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 2: YAPIŞKAN GEÇİTLER — Dikey Tırmanış
            // ═══════════════════════════════════════════════
            this.width = 2700;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 350;

            this.platforms = [
                { x: 0, y: 440, w: 556, h: 160, type: 'normal' },
                { x: 880, y: 380, w: 320, h: 220, type: 'normal' },
                { x: 1200, y: 460, w: 150, h: 140, type: 'normal' },
                { x: 1340, y: 140, w: 40, h: 430, type: 'sticky', sticky: true },
                { x: 1580, y: 100, w: 40, h: 420, type: 'sticky', sticky: true },
                { x: 1620, y: 300, w: 260, h: 300, type: 'normal' },
                { x: 1880, y: 480, w: 276, h: 120, type: 'normal' },
                { x: 1960, y: 10, w: 140, h: 445, type: 'normal' },
                { x: 2380, y: 380, w: 320, h: 220, type: 'normal' },
                { x: 880, y: 40, w: 240, h: 40, type: 'normal' },
                { x: 1500, y: 440, w: 60, h: 20, type: 'normal' },
                { x: 1400, y: 360, w: 60, h: 20, type: 'normal' },
                { x: 1380, y: 0, w: 240, h: 40, type: 'normal' },
                { x: 1220, y: 100, w: 60, h: 20, type: 'normal' }
            ];

            this.hazards = [
                // Spikes
                { x: 220, y: 420, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1880, y: 460, w: 40, h: 20, type: 'spike', direction: 'up' },
                { x: 1620, y: 280, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1200, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 880, y: 80, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1000, y: 80, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1060, y: 80, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 940, y: 80, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1220, y: 120, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1940, y: 180, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 2100, y: 360, w: 20, h: 60, type: 'spike', direction: 'right' },
                // Acid pools
                { x: 560, y: 500, w: 323, h: 70, type: 'acid' },
                { x: 1380, y: 500, w: 235, h: 70, type: 'acid' },
                { x: 2160, y: 500, w: 220, h: 70, type: 'acid' }
            ];

            this.movingPlatforms = [
                { startX: 620, startY: 420, targetX: 718, targetY: 423, x: 620, y: 420, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 }
            ];

            this.bouncePads = [];
            this.pressurePlates = [];
            this.pushBlocks = [];
            this.conveyors = [];
            this.teleportPairs = [];

            this.gates = [
                { x: 1000, y: 120, w: 20, h: 260, type: 'laser', id: 201, disabled: false }
            ];

            this.collectibles = [
                { x: 1080, y: 320, color: '#eab308', collected: false },
                { x: 2480, y: 320, color: '#eab308', collected: false },
                { x: 620, y: 380, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 380, y: 410, rangeX: 60, speed: 1.1, isVertical: false, color: '#f43f5e' },
                { x: 720, y: 220, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 1580, y: -20, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 1420, y: -20, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 1500, y: -40, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' }
            ];

            this.fallingBlockTraps = [
                { startX: 2420, startY: 180, x: 2420, y: 180, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.portal = {
                x: 2550,
                y: 300,
                w: 60,
                h: 80,
                angle: 0
            };

            this.decorations = [
                { x: 80, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 160, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 320, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 240, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 480, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 400, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 520, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 440, w: 20, h: 80, type: 'neon_light', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 900, y: 400, w: 40, h: 40, type: 'fan', rotation: 2560.200000000822, startRotation: 2560.200000000822, state: 0, text: '', color: '' },
                { x: 1140, y: 400, w: 40, h: 40, type: 'fan', rotation: 2560.200000000822, startRotation: 2560.200000000822, state: 0, text: '', color: '' },
                { x: 920, y: 420, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1080, y: 420, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1060, y: 400, w: 40, h: 40, type: 'fan', rotation: 2560.200000000822, startRotation: 2560.200000000822, state: 0, text: '', color: '' },
                { x: 980, y: 400, w: 40, h: 40, type: 'fan', rotation: 2560.200000000822, startRotation: 2560.200000000822, state: 0, text: '', color: '' },
                { x: 1000, y: 420, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 960, y: 440, w: 20, h: 80, type: 'neon_light', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1240, y: 240, w: 20, h: 80, type: 'neon_light', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1100, y: 440, w: 20, h: 80, type: 'neon_light', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 980, y: 460, w: 120, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1800, y: 300, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1720, y: 300, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1640, y: 300, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1620, y: 300, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1840, y: 320, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1840, y: 360, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1840, y: 400, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1840, y: 440, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1840, y: 480, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1800, y: 480, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1620, y: 340, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1620, y: 380, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1620, y: 420, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1620, y: 460, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1620, y: 500, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1660, y: 460, w: 40, h: 40, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1700, y: 500, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1660, y: 320, w: 175, h: 140, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1660, y: 460, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1620, y: 300, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1620, y: 340, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1620, y: 380, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1620, y: 420, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1620, y: 460, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1840, y: 320, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1840, y: 360, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1840, y: 400, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1840, y: 440, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1840, y: 480, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1800, y: 480, w: 40, h: 40, type: 'fan', rotation: 1006.1999999998932, startRotation: 1006.1999999998932, state: 0, text: '', color: '' },
                { x: 1760, y: 460, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1700, y: 460, w: 60, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1780, y: 500, w: 20, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 160, y: 180, w: 200, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Yeterince zorlandıysan artık başlayabilirsin ! ', color: '#eab308' }
            ];
        } else if (levelNumber === 3) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 3: KONVEYÖR HATTI — Koş Koş Koş!
            // ═══════════════════════════════════════════════
            this.width = 2850;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 400;

            this.platforms = [
                { x: 0, y: 480, w: 1140, h: 40, type: 'normal' },
                { x: 0, y: 120, w: 2580, h: 40, type: 'normal' },
                { x: 40, y: 480, w: 1060, h: 40, type: 'slippery', slippery: true },
                { x: 1100, y: 480, w: 500, h: 40, type: 'normal' },
                { x: 1140, y: 480, w: 1450, h: 40, type: 'normal' }
            ];

            this.hazards = [
                { x: 280, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 400, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 540, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 660, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 780, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 900, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1020, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1420, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1800, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1240, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1600, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1980, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2160, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2400, y: 460, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2400, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' }
            ];

            this.movingPlatforms = [];
            this.bouncePads = [];
            this.pressurePlates = [];
            this.pushBlocks = [];
            this.conveyors = [
                { x: 40, y: 460, w: 1060, h: 20, direction: 1, speed: 1.5 }
            ];
            this.teleportPairs = [];

            this.gates = [
                { x: 360, y: 240, w: 20, h: 220, type: 'laser', id: 866, disabled: false },
                { x: 600, y: 240, w: 20, h: 220, type: 'laser', id: 299, disabled: false },
                { x: 820, y: 240, w: 20, h: 220, type: 'laser', id: 575, disabled: false },
                { x: 2420, y: 180, w: 20, h: 280, type: 'net', id: 911, disabled: false }
            ];

            this.collectibles = [];

            this.enemies = [
                { x: 1360, y: 360, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1720, y: 360, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2100, y: 340, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1920, y: 380, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 2340, y: 440, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' }
            ];

            this.fallingBlockTraps = [
                { startX: 240, startY: 260, x: 240, y: 260, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 460, startY: 260, x: 460, y: 260, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 700, startY: 260, x: 700, y: 260, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 900, startY: 260, x: 900, y: 260, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.portal = {
                x: 2540,
                y: 320,
                w: 60,
                h: 80,
                angle: 0
            };

            this.decorations = [
                { x: 40, y: 200, w: 1060, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 260, y: 180, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.416814692820392, text: '', color: '' },
                { x: 480, y: 180, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.416814692820392, text: '', color: '' },
                { x: 720, y: 180, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.416814692820392, text: '', color: '' },
                { x: 920, y: 180, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.416814692820392, text: '', color: '' },
                { x: 0, y: 480, w: 2580, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1100, y: 160, w: 40, h: 320, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 120, w: 2570, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 160, w: 40, h: 320, type: 'box', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 60, y: 240, w: 160, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: '                                                               KOŞ KOŞ KOŞ ! ! !', color: '#d946ef' },
                { x: 2480, y: 200, w: 200, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Ağ Kapısından sadece doğru renk ile geçebilirsin !', color: '#06b6d4' }
            ];
        } else if (levelNumber === 4) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 4: YAPIŞKAN DEHLİZ — Dar Tüneller
            // ═══════════════════════════════════════════════
            this.width = 2200;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 320;

            this.platforms = [
                { x: 0, y: 420, w: 2100, h: 140, type: 'normal' },
                { x: 220, y: 360, w: 60, h: 20, type: 'normal' },
                { x: 420, y: 300, w: 60, h: 20, type: 'normal' },
                { x: 620, y: 220, w: 60, h: 20, type: 'normal' },
                { x: 420, y: 160, w: 60, h: 20, type: 'normal' },
                { x: 40, y: 100, w: 220, h: 40, type: 'normal' },
                { x: 40, y: 40, w: 170, h: 30, type: 'normal' },
                { x: 40, y: -80, w: 2100, h: 20, type: 'normal' },
                { x: 1680, y: 20, w: 160, h: 40, type: 'normal' }
            ];

            this.hazards = [
                // Spikes
                { x: 620, y: 240, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 420, y: 320, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 420, y: 180, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 100, y: 140, w: 100, h: 20, type: 'spike', direction: 'down' },
                { x: 1520, y: 400, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1520, y: -60, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1760, y: 400, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1900, y: 400, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1680, y: 60, w: 160, h: 20, type: 'spike', direction: 'down' }
            ];

            this.movingPlatforms = [];
            this.bouncePads = [
                { x: 1700, y: 400, w: 50, h: 20, force: 12.0, active: false, timer: 0 }
            ];
            this.pressurePlates = [];
            this.pushBlocks = [];
            this.conveyors = [];
            this.teleportPairs = [];

            this.gates = [
                { x: 1540, y: -40, w: 20, h: 435, type: 'yellowLaser', id: 1, disabled: false }
            ];

            this.collectibles = [
                { x: 560, y: 140, color: '#eab308', collected: false },
                { x: 1000, y: 40, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 540, y: 260, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 360, y: 80, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1100, y: 400, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 1360, y: 400, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 1220, y: 180, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' }
            ];

            this.fallingBlockTraps = [
                { startX: 740, startY: 180, x: 740, y: 180, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.levers = [
                { x: 80, y: 80, w: 32, h: 32, activated: false, linkedGateId: 1, cooldown: 0 }
            ];
            this.buttons = [];

            this.portal = {
                x: 2020,
                y: 300,
                w: 60,
                h: 80,
                angle: 0
            };

            this.decorations = [
                { x: 660, y: -40, w: 125, h: 100, type: 'window_space', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 860, y: 300, w: 32, h: 120, type: 'pillar', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 860, y: 180, w: 32, h: 120, type: 'pillar', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 860, y: 60, w: 32, h: 120, type: 'pillar', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 860, y: -60, w: 32, h: 120, type: 'pillar', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 420, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 520, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 180, y: 520, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 180, y: 420, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 20, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 100, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 200, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 280, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 20, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 100, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 200, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 280, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 20, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 120, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 200, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 300, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 360, y: 420, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 360, y: 520, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 540, y: 520, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 540, y: 420, w: 180, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 380, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 460, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 640, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 560, y: 440, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 560, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 380, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 640, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 460, y: 540, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 720, y: 420, w: 140, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 720, y: 520, w: 140, h: 40, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 860, y: 420, w: 32, h: 140, type: 'pillar', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 740, y: 540, w: 120, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 740, y: 440, w: 120, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 380, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 780, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 660, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 560, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 480, y: 480, w: 40, h: 40, type: 'fan', rotation: 715.1999999999373, startRotation: 715.1999999999373, state: 0, text: '', color: '' },
                { x: 0, y: 200, w: 200, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Butonlar, şalterler basınç plakaları her biri sana yardımcı olacaklar , aktif etmeyi unutma patron !', color: '#06b6d4' }
            ];
        } else if (levelNumber === 5) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 5: BOYUTSAL KORİDOR — Uzay-Zaman Bükülmesi
            // ═══════════════════════════════════════════════
            this.width = 3750;
            this.height = 600;
            this.spawnX = 60;
            this.spawnY = 380;

            this.platforms = [
                { x: 0, y: 460, w: 500, h: 140, type: 'normal' },
                { x: 500, y: 460, w: 180, h: 140, type: 'normal' },
                { x: 1100, y: 40, w: 150, h: 120, type: 'normal' },
                { x: 1250, y: 460, w: 200, h: 140, type: 'normal' },
                { x: 1450, y: 460, w: 150, h: 140, type: 'normal' },
                { x: 1750, y: 300, w: 200, h: 40, type: 'normal' },
                { x: 2100, y: 460, w: 200, h: 140, type: 'normal' },
                { x: 2300, y: 460, w: 180, h: 140, type: 'normal' },
                { x: 2900, y: 20, w: 140, h: 120, type: 'normal' },
                { x: 3050, y: 460, w: 200, h: 140, type: 'normal' },
                { x: 800, y: 220, w: 80, h: 20, type: 'normal' },
                { x: 1060, y: 40, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 0, y: -40, w: 3520, h: 40, type: 'normal' },
                { x: 3400, y: 140, w: 120, h: 40, type: 'normal' },
                { x: 3520, y: -40, w: 40, h: 320, type: 'normal' },
                { x: 3520, y: 280, w: 40, h: 160, type: 'sticky', sticky: true },
                { x: 3260, y: 200, w: 60, h: 20, type: 'normal' },
                { x: 3420, y: 340, w: 60, h: 20, type: 'normal' },
                { x: 3340, y: 220, w: 40, h: 120, type: 'sticky', sticky: true }
            ];

            this.hazards = [
                // Spikes
                { x: 1820, y: 280, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1820, y: 0, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 2240, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2300, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                // Acid Pools
                { x: 680, y: 480, w: 570, h: 70, type: 'acid' },
                { x: 1600, y: 480, w: 500, h: 70, type: 'acid' },
                { x: 2480, y: 480, w: 570, h: 70, type: 'acid' }
            ];

            this.movingPlatforms = [];
            this.bouncePads = [
                { x: 1540, y: 445, w: 50, h: 15, force: 13.0, active: false, timer: 0 }
            ];
            this.pressurePlates = [];
            this.pushBlocks = [];
            this.conveyors = [];
            this.teleportPairs = [];

            this.gates = [
                { x: 1840, y: 20, w: 20, h: 260, type: 'laser', id: 2003, disabled: false }
            ];

            this.collectibles = [
                { x: 1900, y: 220, color: '#eab308', collected: false },
                { x: 3140, y: 380, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 1260, y: 420, rangeX: 80, speed: 1.4, isVertical: false, color: '#06b6d4' },
                { x: 3070, y: 414, rangeX: 80, speed: 1.4, isVertical: false, color: '#06b6d4' },
                { x: 1460, y: 420, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 540, y: 420, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 620, y: 300, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2260, y: 180, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2660, y: 200, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' }
            ];

            this.fallingBlockTraps = [
                { startX: 1100, startY: 160, x: 1100, y: 160, w: 150, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 2920, startY: 180, x: 2920, y: 180, w: 100, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.fallingPlatforms = [
                { startX: 740, startY: 400, x: 740, y: 400, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false },
                { startX: 920, startY: 340, x: 920, y: 340, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false },
                { startX: 2540, startY: 380, x: 2540, y: 380, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false },
                { startX: 2720, startY: 320, x: 2720, y: 320, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false }
            ];

            this.breakablePlatforms = [
                { x: 3360, y: 460, w: 120, h: 40, type: 'platform', broken: false, timer: 0, triggered: false }
            ];

            this.buttons = [
                { x: 1760, y: 268, w: 32, h: 32, activated: false, linkedGateId: 2003, timer: 0 }
            ];
            this.levers = [];

            this.portal = {
                x: 3440,
                y: 40,
                w: 60,
                h: 80,
                angle: 0
            };

            this.decorations = [
                { x: 200, y: 200, w: 60, h: 60, type: 'window_space', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 350, y: 428, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 5.133629385640809, text: '', color: '' },
                { x: 600, y: 400, w: 50, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 2170, y: 428, w: 32, h: 32, type: 'steam', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 2400, y: 400, w: 50, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 3530, y: 428, w: 32, h: 32, type: 'steam', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 20, y: 480, w: 40, h: 40, type: 'gear', rotation: 5.31, startRotation: 5.31, state: 0, text: '', color: '' },
                { x: 120, y: 480, w: 40, h: 40, type: 'gear', rotation: 5.31, startRotation: 5.31, state: 0, text: '', color: '' },
                { x: 220, y: 480, w: 40, h: 40, type: 'gear', rotation: 5.31, startRotation: 5.31, state: 0, text: '', color: '' },
                { x: 320, y: 480, w: 40, h: 40, type: 'gear', rotation: 5.31, startRotation: 5.31, state: 0, text: '', color: '' },
                { x: 420, y: 480, w: 40, h: 40, type: 'gear', rotation: 5.31, startRotation: 5.31, state: 0, text: '', color: '' },
                { x: 40, y: 500, w: 100, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 240, y: 500, w: 100, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 140, y: 500, w: 100, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 340, y: 500, w: 100, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 520, y: 480, w: 40, h: 60, type: 'server_rack', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 620, y: 480, w: 40, h: 60, type: 'server_rack', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1160, y: 80, w: 40, h: 40, type: 'fan', rotation: 26.549999999999926, startRotation: 26.549999999999926, state: 0, text: '', color: '' },
                { x: 560, y: 480, w: 60, h: 55, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' }
            ];
        } else if (levelNumber === 6) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 6: KARGO DEPOSU — Fabrika Düzeni
            // ═══════════════════════════════════════════════
            this.width = 4800;
            this.height = 600;
            this.spawnX = 60;
            this.spawnY = 380;

            this.platforms = [
                { x: 0, y: 460, w: 500, h: 140, type: 'normal' },
                { x: 500, y: 460, w: 180, h: 140, type: 'normal' },
                { x: 1100, y: 0, w: 150, h: 120, type: 'normal' },
                { x: 1260, y: 460, w: 205, h: 140, type: 'normal' },
                { x: 1480, y: 460, w: 220, h: 140, type: 'normal' },
                { x: 1700, y: 480, w: 300, h: 120, type: 'normal' },
                { x: 2200, y: 460, w: 250, h: 140, type: 'normal' },
                { x: 2450, y: 460, w: 150, h: 140, type: 'normal' },
                { x: 2760, y: 120, w: 100, h: 460, type: 'normal' },
                { x: 3150, y: 460, w: 200, h: 140, type: 'normal' },
                { x: 3350, y: 460, w: 180, h: 140, type: 'normal' },
                { x: 3950, y: 0, w: 160, h: 120, type: 'normal' },
                { x: 4100, y: 460, w: 200, h: 140, type: 'normal' },
                { x: 4300, y: 460, w: 500, h: 140, type: 'normal' },
                { x: 0, y: 120, w: 120, h: 40, type: 'normal' },
                { x: 120, y: 120, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 160, y: 260, w: 100, h: 20, type: 'normal' },
                { x: 260, y: 220, w: 40, h: 120, type: 'normal' },
                { x: 780, y: 20, w: 120, h: 40, type: 'normal' }
            ];

            this.hazards = [
                // Spikes
                { x: 180, y: 280, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 240, y: 280, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 300, y: 260, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 180, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                // Acid pools
                { x: 680, y: 530, w: 570, h: 70, type: 'acid' },
                { x: 3530, y: 530, w: 570, h: 70, type: 'acid' }
            ];

            this.movingPlatforms = [
                { startX: 580, startY: 220, targetX: 730, targetY: 220, x: 580, y: 220, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 },
                { startX: 460, startY: 120, targetX: 405, targetY: 159, x: 460, y: 120, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 }
            ];

            this.bouncePads = [];
            this.pressurePlates = [
                { x: 1620, y: 455, w: 35, h: 10, activated: false, linkedGateId: 2001 }
            ];

            this.pushBlocks = [
                { startX: 1380, startY: 400, x: 1380, y: 400, w: 50, h: 50, vx: 0, vy: 0 }
            ];

            this.conveyors = [
                { x: 1700, y: 460, w: 300, h: 20, direction: 1, speed: 1.6 }
            ];

            this.teleportPairs = [
                { x1: 2530, y1: 400, x2: 2800, y2: 60, color: '#a855f7', cooldown: 0 }
            ];

            this.gates = [
                { x: 2200, y: 100, w: 20, h: 360, type: 'yellowLaser', id: 2001, disabled: false },
                { x: 3360, y: 40, w: 20, h: 420, type: 'yellowLaser', id: 2, disabled: false },
                { x: 3100, y: -60, w: 20, h: 260, type: 'net', id: 3002, disabled: false }
            ];

            this.collectibles = [
                { x: 970, y: 240, color: '#eab308', collected: false },
                { x: 2050, y: 400, color: '#eab308', collected: false },
                { x: 2930, y: 350, color: '#eab308', collected: false },
                { x: 3820, y: 240, color: '#eab308', collected: false },
                { x: 4500, y: 400, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 1270, y: 414, rangeX: 80, speed: 1.4, isVertical: false, color: '#06b6d4' },
                { x: 4120, y: 414, rangeX: 80, speed: 1.4, isVertical: false, color: '#06b6d4' },
                { x: 560, y: 420, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 300, y: 80, rangeX: 180, speed: 2, isVertical: false, color: '#d946ef' },
                { x: 520, y: 200, rangeX: 130, speed: 1, isVertical: false, color: '#eab308' },
                { x: 880, y: 340, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' }
            ];

            this.fallingBlockTraps = [
                { startX: 1140, startY: 120, x: 1140, y: 120, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 3960, startY: 160, x: 3960, y: 160, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 4040, startY: 160, x: 4040, y: 160, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.fallingPlatforms = [
                { startX: 740, startY: 380, x: 740, y: 380, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false },
                { startX: 920, startY: 320, x: 920, y: 320, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false },
                { startX: 3590, startY: 380, x: 3590, y: 380, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false },
                { startX: 3770, startY: 320, x: 3770, y: 320, w: 120, h: 40, timer: 0, triggered: false, vy: 0, fallen: false }
            ];

            this.breakablePlatforms = [
                { x: 1560, y: 340, w: 40, h: 120, type: 'wall', broken: false, timer: 0, triggered: false }
            ];

            this.hiddenPassages = [
                { x: 300, y: 240, w: 60, h: 20 },
                { x: 1100, y: -80, w: 150, h: 80 }
            ];

            this.buttons = [];
            this.levers = [
                { x: 0, y: 80, w: 32, h: 32, activated: false, linkedGateId: 2, cooldown: 0 }
            ];

            this.portal = {
                x: 4650,
                y: 380,
                w: 60,
                h: 80,
                angle: 0
            };

            this.decorations = [
                { x: 20, y: 200, w: 60, h: 60, type: 'window_space', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 350, y: 428, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.016814692820393, text: '', color: '' },
                { x: 600, y: 400, w: 50, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 2220, y: 480, w: 40, h: 60, type: 'server_rack', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 2760, y: 100, w: 32, h: 22, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.016814692820393, text: '', color: '' },
                { x: 3450, y: 400, w: 50, h: 40, type: 'pano', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 4350, y: 428, w: 32, h: 32, type: 'warning_light', rotation: 0, startRotation: 0, state: 4.016814692820393, text: '', color: '' },
                { x: 4580, y: 428, w: 32, h: 32, type: 'steam', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 1480, y: 120, w: 200, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Bazen blokların üzerine zıplarsan kırılır ... Aynı viscoranın kalbi gibi :/', color: '#06b6d4' }
            ];
        } else if (levelNumber === 7) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 7: ÇÖKEN SEKTÖR — Zaman Kısıtı
            // ═══════════════════════════════════════════════
            this.width = 2200;
            this.height = 600;
            this.spawnX = 100;
            this.spawnY = 350;

            this.platforms = [
                { x: 0, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 1800, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 1000, y: 420, w: 60, h: 20, type: 'normal' },
                { x: 760, y: 260, w: 60, h: 120, type: 'normal' },
                { x: 760, y: -80, w: 60, h: 120, type: 'normal' },
                { x: 1620, y: -60, w: 60, h: 120, type: 'normal' },
                { x: 1620, y: 280, w: 60, h: 120, type: 'normal' }
            ];

            this.hazards = [
                { x: 740, y: 280, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 820, y: 280, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 820, y: -60, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 740, y: -60, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 760, y: 380, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 760, y: -100, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1620, y: 400, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1620, y: -80, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1600, y: -40, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 1600, y: 320, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 1680, y: 320, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 1680, y: -40, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 400, y: 460, w: 1400, h: 70, type: 'acid' }
            ];

            this.movingPlatforms = [
                { startX: 500, startY: 400, targetX: 500, targetY: 216, x: 500, y: 400, w: 100, h: 30, type: 'moving', speed: 0.015, dir: 1, progress: 0 },
                { startX: 720, startY: 160, targetX: 1096, targetY: 160, x: 720, y: 160, w: 120, h: 30, type: 'moving', speed: 0.012, dir: 1, progress: 0 },
                { startX: 1360, startY: 180, targetX: 1360, targetY: 400, x: 1360, y: 180, w: 100, h: 30, type: 'moving', speed: 0.018, dir: 1, progress: 0 }
            ];

            this.gates = [
                { x: 780, y: 40, w: 20, h: 220, type: 'laser', id: 564, disabled: false },
                { x: 1640, y: 60, w: 20, h: 220, type: 'laser', id: 267, disabled: false }
            ];

            this.collectibles = [
                { x: 550, y: 120, color: '#eab308', collected: false },
                { x: 1000, y: 120, color: '#eab308', collected: false },
                { x: 1400, y: 120, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 680, y: 240, rangeX: 100, speed: 2, isVertical: true, color: '#f43f5e' },
                { x: 1100, y: 80, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 1200, y: 340, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1640, y: 160, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 280, y: 420, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' }
            ];

            this.bouncePads = [];
            this.levers = [];
            this.buttons = [];
            this.fallingBlockTraps = [];
            this.vantuzPoints = [];
            this.decorations = [];
            this.portal = {
                x: 2000,
                y: 380,
                w: 60,
                h: 80,
                angle: 0
            };
        } else if (levelNumber === 8) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 8: TOKSİK HAVZA — Hassas Sıçrayışlar
            // ═══════════════════════════════════════════════
            // Sarı (Toxic Lab) Tema (assigned globally)
            this.width = 3232;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 350;

            this.platforms = [
                { x: 0, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 500, y: 400, w: 60, h: 20, type: 'normal' },
                { x: 700, y: 480, w: 60, h: 20, type: 'normal' },
                { x: 880, y: 360, w: 60, h: 20, type: 'normal' },
                { x: 700, y: 300, w: 60, h: 20, type: 'normal' },
                { x: 900, y: 500, w: 60, h: 20, type: 'normal' },
                { x: 1060, y: 440, w: 60, h: 20, type: 'normal' },
                { x: 860, y: 240, w: 60, h: 20, type: 'normal' },
                { x: 1000, y: 180, w: 60, h: 20, type: 'normal' },
                { x: 1060, y: 320, w: 60, h: 20, type: 'normal' },
                { x: 1160, y: 220, w: 60, h: 20, type: 'normal' },
                { x: 1220, y: 380, w: 60, h: 20, type: 'normal' },
                { x: 1300, y: 300, w: 60, h: 20, type: 'normal' },
                { x: 700, y: 200, w: 60, h: 20, type: 'normal' },
                { x: 1360, y: 380, w: 60, h: 20, type: 'normal' },
                { x: 1480, y: 460, w: 60, h: 20, type: 'normal' },
                { x: 1620, y: 400, w: 60, h: 20, type: 'normal' },
                { x: 1760, y: 360, w: 60, h: 20, type: 'normal' },
                { x: 1920, y: 260, w: 60, h: 20, type: 'normal' },
                { x: 1580, y: 260, w: 60, h: 20, type: 'normal' },
                { x: 1460, y: 180, w: 60, h: 20, type: 'normal' },
                { x: 1600, y: 100, w: 60, h: 20, type: 'normal' },
                { x: 1780, y: 140, w: 60, h: 20, type: 'normal' },
                { x: 880, y: 120, w: 60, h: 20, type: 'normal' },
                { x: 1720, y: -20, w: 60, h: 20, type: 'normal' },
                { x: 1460, y: -20, w: 60, h: 20, type: 'normal' },
                { x: 1280, y: 100, w: 60, h: 20, type: 'normal' },
                { x: 1880, y: -100, w: 60, h: 20, type: 'normal' },
                { x: 1700, y: -180, w: 60, h: 20, type: 'normal' },
                { x: 1540, y: -220, w: 60, h: 20, type: 'normal' },
                { x: 1380, y: -260, w: 60, h: 20, type: 'normal' },
                { x: 760, y: -240, w: 60, h: 20, type: 'normal' },
                { x: 640, y: -140, w: 60, h: 20, type: 'normal' },
                { x: 520, y: -20, w: 60, h: 20, type: 'normal' }
            ];

            this.hazards = [
                { x: 520, y: 0, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 640, y: -120, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 760, y: -220, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 880, y: 140, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 700, y: 220, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 700, y: 320, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1000, y: 200, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1160, y: 240, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1280, y: 120, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1460, y: 0, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1380, y: -240, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1540, y: -200, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1700, y: -160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1880, y: -80, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1720, y: 0, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1600, y: 120, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1780, y: 160, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1580, y: 280, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1920, y: 280, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1760, y: 380, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1620, y: 420, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1460, y: 200, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1480, y: 480, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1360, y: 400, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1300, y: 320, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1220, y: 400, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1060, y: 340, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1060, y: 460, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 900, y: 520, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 880, y: 380, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 860, y: 260, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 700, y: 500, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 500, y: 420, w: 60, h: 20, type: 'spike', direction: 'down' }
            ];

            this.movingPlatforms = [];
            this.gates = [];
            this.collectibles = [];

            this.enemies = [
                { x: 580, y: 100, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1120, y: 40, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1480, y: -100, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1460, y: 340, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 920, y: 300, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1760, y: 240, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 760, y: -60, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1180, y: -220, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 960, y: -160, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 1300, y: -100, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' }
            ];

            this.bouncePads = [];
            this.levers = [];
            this.buttons = [];
            this.fallingPlatforms = [];
            this.fallingBlockTraps = [];
            this.vantuzPoints = [];
            this.decorations = [];
            this.portal = {
                x: 1080,
                y: -200,
                w: 60,
                h: 80,
                angle: 0
            };
        } else if (levelNumber === 9) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 9: KİMYASAL REAKTÖR — Reaksiyon Odası
            // ═══════════════════════════════════════════════
            this.width = 2860;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 320;

            this.platforms = [
                { x: 20, y: 380, w: 120, h: 40, type: 'normal' },
                { x: 300, y: 440, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 560, y: 380, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 800, y: 320, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 1040, y: 400, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 1300, y: 340, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 1600, y: 280, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 1900, y: 220, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 2220, y: 360, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 2720, y: 160, w: 120, h: 40, type: 'slippery', slippery: true },
                { x: 2560, y: -20, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 2300, y: -20, w: 120, h: 40, type: 'sticky', sticky: true },
                { x: 1660, y: -20, w: 500, h: 40, type: 'normal' },
                { x: 1400, y: 0, w: 60, h: 20, type: 'normal' },
                { x: 1220, y: 30, w: 40, h: 20, type: 'normal' },
                { x: 1760, y: 520, w: 60, h: 20, type: 'normal' },
                { x: 2620, y: 520, w: 60, h: 20, type: 'normal' },
                { x: 2260, y: 520, w: 60, h: 20, type: 'normal' },
                { x: 860, y: 20, w: 120, h: 40, type: 'normal' },
                { x: 980, y: 70, w: 240, h: 90, type: 'normal' },
                { x: 590, y: -20, w: 60, h: 20, type: 'normal' }
            ];

            this.hazards = [];

            this.movingPlatforms = [
                { startX: 2420, startY: 260, targetX: 2570, targetY: 260, x: 2420, y: 260, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 }
            ];

            this.gates = [
                { x: 1560, y: -220, w: 20, h: 220, type: 'yellowLaser', id: 69, disabled: false }
            ];

            this.collectibles = [];

            this.enemies = [
                { x: 1340, y: 280, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1740, y: 200, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2220, y: 240, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2000, y: -40, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 1820, y: -40, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' }
            ];

            this.pushBlocks = [
                { x: 860, y: -30, w: 50, h: 50, startX: 860, startY: -30, vx: 0, vy: 0 },
                { x: 860, y: -80, w: 50, h: 50, startX: 860, startY: -80, vx: 0, vy: 0 },
                { x: 860, y: -130, w: 50, h: 50, startX: 860, startY: -130, vx: 0, vy: 0 },
                { x: 860, y: -180, w: 50, h: 50, startX: 860, startY: -180, vx: 0, vy: 0 }
            ];

            this.bouncePads = [];
            this.levers = [
                { x: 1780, y: 500, w: 32, h: 32, linkedGateId: 101, cooldown: 0 },
                { x: 2280, y: 500, w: 32, h: 32, linkedGateId: 101, cooldown: 0 },
                { x: 2640, y: 500, w: 32, h: 32, linkedGateId: 69, cooldown: 0 }
            ];
            this.buttons = [
                { x: 850, y: 290, w: 32, h: 32, activated: false, linkedGateId: 1, timer: 0 }
            ];
            this.flamethrowers = [
                { id: 9588, startX: 490, startY: 250, x: 490, y: 315, w: 32, h: 58, dir: 'right', range: 200, moving: true, moveRange: 100, moveSpeed: 1.5, moveAxis: 'y', moveDir: 1, progress: 0, disabled: false, active: true, currentLength: 0 },
                { id: 1, startX: 1080, startY: 160, x: 1080, y: 160, w: 58, h: 32, dir: 'down', range: 200, moving: false, moveRange: 100, moveSpeed: 1.5, moveAxis: 'y', moveDir: 1, progress: 0, disabled: false, active: true, currentLength: 0 }
            ];
            this.fallingPlatforms = [];
            this.fallingBlockTraps = [
                { startX: 1700, startY: -220, x: 1700, y: -220, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 2060, startY: -220, x: 2060, y: -220, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 1880, startY: -220, x: 1880, y: -220, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];
            this.vantuzPoints = [];
            this.decorations = [
                { x: 200, y: 180, w: 200, h: 80, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'DOĞRU ŞALTERİ BUL VE LAZER KAPIYI AÇ !', color: '#06b6d4' },
                { x: 560, y: 80, w: 200, h: 50, type: 'textbox', rotation: 0, startRotation: 0, state: 0, text: 'Alev silahlarına dikkat et yakar :D', color: '#06b6d4' }
            ];
            this.portal = {
                x: 590,
                y: -110,
                w: 60,
                h: 80,
                angle: 0
            };
} else if (levelNumber === 10) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 10: KOZMİK ÇEKİRDEK — Viscoruptor Karşılaşması
            // ═══════════════════════════════════════════════
            this.width = 2600;
            this.height = 600;
            this.spawnX = 280;
            this.spawnY = 220;

            this.platforms = [
                { x: 0, y: 80, w: 40, h: 500, type: 'sticky', sticky: true },
                { x: 2560, y: 80, w: 40, h: 500, type: 'sticky', sticky: true },
                { x: 40, y: 460, w: 570, h: 140, type: 'normal' },
                { x: 610, y: 460, w: 1100, h: 140, type: 'normal' },
                { x: 1870, y: 460, w: 690, h: 140, type: 'normal' },
                { x: 200, y: 300, w: 180, h: 20, type: 'normal' },
                { x: 740, y: 240, w: 200, h: 20, type: 'normal' },
                { x: 1100, y: 120, w: 300, h: 20, type: 'normal' },
                { x: 1540, y: 220, w: 200, h: 20, type: 'normal' },
                { x: 2100, y: 320, w: 180, h: 20, type: 'normal' },
                { x: 560, y: 140, w: 60, h: 20, type: 'normal' },
                { x: 2360, y: 160, w: 60, h: 20, type: 'normal' },
                { x: 1920, y: 140, w: 60, h: 20, type: 'normal' },
                { x: 1700, y: 440, w: 167, h: 155, type: 'normal' },
                { x: 1140, y: 400, w: 240, h: 30, type: 'normal' },
                { x: 520, y: 400, w: 240, h: 30, type: 'normal' }
            ];

            this.hazards = [];
            this.conveyors = [];
            this.teleportPairs = [];

            this.pushBlocks = [
                { startX: 820, startY: 180, x: 820, y: 180, w: 50, h: 50, vx: 0, vy: 0 },
                { startX: 1220, startY: 60, x: 1220, y: 60, w: 50, h: 50, vx: 0, vy: 0 },
                { startX: 1620, startY: 160, x: 1620, y: 160, w: 50, h: 50, vx: 0, vy: 0 }
            ];

            this.pressurePlates = [];
            this.gates = [];

            this.collectibles = [
                { x: 360, y: 80, color: '#eab308', collected: false },
                { x: 1240, y: 0, color: '#eab308', collected: false },
                { x: 2180, y: 0, color: '#eab308', collected: false }
            ];

            this.enemies = [];

            this.portal = {
                x: 2420,
                y: 380,
                w: 60,
                h: 80,
                angle: 0
            };
        } else if (levelNumber === 11) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 11: ÖLÜMCÜL BASINÇ ODASI
            // ═══════════════════════════════════════════════
            this.width = 2652;
            this.height = 600;
            this.spawnX = 40;
            this.spawnY = 340;

            this.platforms = [
                { x: 0, y: 460, w: 1000, h: 140, type: 'normal' },
                { x: 160, y: 400, w: 60, h: 20, type: 'normal' },
                { x: 380, y: 300, w: 60, h: 20, type: 'normal' },
                { x: 160, y: 160, w: 60, h: 20, type: 'normal' },
                { x: 0, y: 100, w: 60, h: 20, type: 'normal' },
                { x: 0, y: 0, w: 220, h: 40, type: 'normal' },
                { x: 380, y: 100, w: 60, h: 20, type: 'normal' },
                { x: 1120, y: 160, w: 40, h: 200, type: 'sticky', sticky: true },
                { x: 1240, y: 440, w: 60, h: 20, type: 'normal' },
                { x: 1380, y: 180, w: 60, h: 20, type: 'normal' },
                { x: 1540, y: 80, w: 240, h: 40, type: 'normal' },
                { x: 1040, y: 160, w: 60, h: 20, type: 'normal' },
                { x: 1900, y: 280, w: 240, h: 40, type: 'normal' },
                { x: 2320, y: 280, w: 240, h: 40, type: 'normal' },
                { x: 1760, y: 440, w: 60, h: 20, type: 'normal' },
                { x: 540, y: -200, w: 40, h: 250, type: 'normal' },
                { x: 600, y: -40, w: 160, h: 40, type: 'normal' }
            ];

            this.hazards = [
                { x: 2060, y: 260, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2340, y: 260, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1000, y: 460, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 520, y: -200, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 580, y: -200, w: 20, h: 60, type: 'spike', direction: 'right' }
            ];

            this.conveyors = [
                { x: 500, y: 460, w: 120, h: 20, direction: 1, speed: 1.5 },
                { x: 860, y: 460, w: 120, h: 20, direction: 1, speed: 1.5 }
            ];

            this.gates = [
                { x: 780, y: -140, w: 20, h: 600, type: 'yellowLaser', id: 1, disabled: false }
            ];

            this.levers = [
                { x: 100, y: -20, w: 32, h: 32, linkedGateId: 1, activated: false, cooldown: 0 }
            ];

            this.enemies = [
                { x: 1660, y: 60, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e' },
                { x: 1560, y: 360, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1480, y: 460, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1700, y: 260, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1980, y: 240, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 2480, y: 240, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 200, y: -60, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 880, y: 120, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' }
            ];

            this.fallingBlockTraps = [
                { startX: 2200, startY: 20, x: 2200, y: 20, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 940, startY: 140, x: 940, y: 140, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 600, startY: 60, x: 600, y: 60, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 680, startY: 20, x: 680, y: 20, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.portal = {
                x: 2540,
                y: 80,
                w: 60,
                h: 80,
                angle: 0
            };
        } else if (levelNumber === 12) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 12: MEKANİK HAVALANDIRMA
            // ═══════════════════════════════════════════════
            this.width = 2188;
            this.height = 600;
            this.spawnX = 40;
            this.spawnY = 400;

            this.platforms = [
                { x: 0, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 1260, y: 420, w: 60, h: 20, type: 'normal' },
                { x: 840, y: 80, w: 120, h: 40, type: 'sticky', sticky: true },
                { x: 1700, y: 20, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 1820, y: 80, w: 60, h: 20, type: 'normal' },
                { x: 1960, y: 180, w: 60, h: 20, type: 'normal' },
                { x: 1900, y: 520, w: 60, h: 20, type: 'normal' },
                { x: 2100, y: 420, w: 60, h: 20, type: 'normal' },
                { x: 1800, y: 300, w: 240, h: 40, type: 'normal' },
                { x: 1700, y: 140, w: 40, h: 120, type: 'normal' }
            ];

            this.hazards = [
                { x: 1800, y: 280, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1860, y: 280, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1920, y: 280, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1980, y: 280, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1740, y: 160, w: 20, h: 60, type: 'spike', direction: 'right' },
                { x: 1680, y: 160, w: 20, h: 60, type: 'spike', direction: 'left' },
                { x: 340, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 220, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 100, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' }
            ];

            this.movingPlatforms = [
                { startX: 540, startY: 400, targetX: 690, targetY: 400, x: 540, y: 400, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 },
                { startX: 840, startY: 300, targetX: 990, targetY: 300, x: 840, y: 300, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 },
                { startX: 1220, startY: 200, targetX: 1370, targetY: 200, x: 1220, y: 200, w: 100, h: 20, type: 'moving', speed: 0.015, dir: 1, progress: 0 }
            ];

            this.collectibles = [
                { x: 980, y: 220, color: '#eab308', collected: false },
                { x: 1840, y: 40, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 540, y: 360, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 880, y: 360, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 1220, y: 260, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 1580, y: 140, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' }
            ];

            this.decorations = [
                { x: 520, y: 0, w: 60, h: 60, type: 'window_space', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 720, y: 460, w: 40, h: 40, type: 'fan', rotation: 44.25, startRotation: 44.25, state: 0, text: '', color: '' },
                { x: 1040, y: 460, w: 40, h: 40, type: 'fan', rotation: 44.25, startRotation: 44.25, state: 0, text: '', color: '' },
                { x: 740, y: 480, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 820, y: 480, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 900, y: 480, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 980, y: 480, w: 80, h: 40, type: 'cable', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 960, y: 460, w: 40, h: 40, type: 'fan', rotation: 44.25, startRotation: 44.25, state: 0, text: '', color: '' },
                { x: 880, y: 460, w: 40, h: 40, type: 'fan', rotation: 44.25, startRotation: 44.25, state: 0, text: '', color: '' },
                { x: 800, y: 460, w: 40, h: 40, type: 'fan', rotation: 44.25, startRotation: 44.25, state: 0, text: '', color: '' },
                { x: 320, y: 460, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 240, y: 460, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 160, y: 460, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 80, y: 460, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 0, y: 460, w: 80, h: 20, type: 'pipe', rotation: 0, startRotation: 0, state: 0, text: '', color: '' },
                { x: 760, y: 420, w: 40, h: 40, type: 'gear', rotation: 8.85, startRotation: 8.85, state: 0, text: '', color: '' },
                { x: 840, y: 420, w: 40, h: 40, type: 'gear', rotation: 8.85, startRotation: 8.85, state: 0, text: '', color: '' },
                { x: 920, y: 420, w: 40, h: 40, type: 'gear', rotation: 8.85, startRotation: 8.85, state: 0, text: '', color: '' },
                { x: 1000, y: 420, w: 40, h: 40, type: 'gear', rotation: 8.85, startRotation: 8.85, state: 0, text: '', color: '' }
            ];

            this.portal = {
                x: 1900,
                y: 440,
                w: 60,
                h: 80,
                angle: 0
            };
        } else if (levelNumber === 13) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 13: TOKSİK PORTAL AĞI
            // ═══════════════════════════════════════════════
            this.width = 2916;
            this.height = 650;
            this.spawnX = 60;
            this.spawnY = 380;

            this.platforms = [
                { x: 0, y: 460, w: 400, h: 140, type: 'normal' },
                { x: 740, y: 140, w: 60, h: 20, type: 'normal' },
                { x: 1280, y: 440, w: 120, h: 40, type: 'normal' },
                { x: 2080, y: 400, w: 60, h: 20, type: 'normal' },
                { x: 2380, y: 240, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 2240, y: 40, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 1980, y: 60, w: 240, h: 40, type: 'normal' },
                { x: 1640, y: 60, w: 240, h: 40, type: 'normal' },
                { x: 960, y: 460, w: 65, h: 140, type: 'normal' }
            ];

            this.hazards = [
                { x: 2080, y: 40, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1720, y: 40, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 400, y: 460, w: 560, h: 70, type: 'acid' }
            ];

            this.collectibles = [
                { x: 1620, y: 140, color: '#eab308', collected: false },
                { x: 2040, y: 0, color: '#eab308', collected: false },
                { x: 2280, y: 280, color: '#eab308', collected: false }
            ];

            this.enemies = [
                { x: 1920, y: 20, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 560, y: 300, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1160, y: 220, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1480, y: 320, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' }
            ];

            this.teleportPairs = [
                { x1: 340, y1: 380, x2: 640, y2: 20, color: '#a855f7', cooldown: 0 },
                { x1: 980, y1: 20, x2: 1220, y2: 340, color: '#55f7b9', cooldown: 0 }
            ];

            this.breakablePlatforms = [
                { x: 1500, y: 380, w: 120, h: 40, type: 'platform', broken: false, timer: 0, triggered: false },
                { x: 1680, y: 320, w: 120, h: 40, type: 'platform', broken: false, timer: 0, triggered: false }
            ];

            this.fallingBlockTraps = [
                { startX: 160, startY: 160, x: 160, y: 160, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 240, startY: 160, x: 240, y: 160, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.portal = {
                x: 1500,
                y: -60,
                w: 60,
                h: 80,
                angle: 0
            };
        } else if (levelNumber === 14) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 14: TOKSİK LABİRİNT / ENGEL PARKURU
            // ═══════════════════════════════════════════════
            this.width = 3000;
            this.height = 600;
            this.spawnX = 80;
            this.spawnY = 380;

            this.platforms = [
                { x: 0, y: 450, w: 3000, h: 140, type: 'normal' },
                { x: 0, y: 260, w: 2850, h: 40, type: 'normal' },
                { x: 150, y: 50, w: 2790, h: 40, type: 'normal' },
                { x: 0, y: 80, w: 40, h: 120, type: 'sticky', sticky: true },
                { x: 2950, y: 240, w: 40, h: 120, type: 'sticky', sticky: true }
            ];

            this.hazards = [
                { x: 800, y: 430, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1170, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1890, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1530, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 730, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1090, y: 430, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 570, y: 430, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 320, y: 430, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 250, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 430, y: 240, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2050, y: 300, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1740, y: 300, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1450, y: 300, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 2270, y: 300, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 210, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 770, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1190, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 1630, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2070, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2370, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' },
                { x: 2630, y: 30, w: 60, h: 20, type: 'spike', direction: 'up' }
            ];

            this.gates = [
                { x: 850, y: -350, w: 20, h: 600, type: 'yellowLaser', id: 1, disabled: false }
            ];

            this.pressurePlates = [
                { x: 1600, y: 450, w: 50, h: 10, activated: false, linkedGateId: 1 }
            ];

            this.pushBlocks = [
                { x: 1270, y: 400, w: 50, h: 50, startX: 1270, startY: 400 }
            ];

            this.enemies = [
                { x: 2490, y: 390, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2530, y: 200, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1760, y: 220, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2090, y: 420, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1620, y: 420, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1370, y: 220, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 980, y: 400, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 960, y: 220, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 710, y: 400, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 520, y: 220, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 460, y: 400, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 2800, y: 200, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 560, y: -70, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 1000, y: -80, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 1410, y: -50, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' },
                { x: 1850, y: -50, rangeX: 120, speed: 1.5, isVertical: true, color: '#d946ef' }
            ];

            this.hiddenPassages = [
                { x: 2930, y: 50, w: 60, h: 40 }
            ];

            this.fallingBlockTraps = [
                { startX: 380, startY: -210, x: 380, y: -210, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 780, startY: -210, x: 780, y: -210, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 1170, startY: -210, x: 1170, y: -210, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 1600, startY: -210, x: 1600, y: -210, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 2020, startY: -210, x: 2020, y: -210, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 2450, startY: -210, x: 2450, y: -210, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];

            this.portal = { x: 2800, y: -100, w: 60, h: 80, angle: 0 };
        } else if (levelNumber === 15) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 15: TERMAL KORİDOR
            // ═══════════════════════════════════════════════
            this.width = 2500;
            this.height = 700;
            this.spawnX = 60;
            this.spawnY = 360;

            this.portal = { x: 40, y: 20, w: 60, h: 80, angle: 0 };

            this.platforms = [
                { x: 0, y: 460, w: 1500, h: 140, type: 'normal' },
                { x: 320, y: 400, w: 40, h: 60, type: 'normal' },
                { x: 1040, y: 400, w: 40, h: 60, type: 'normal' },
                { x: 0, y: 200, w: 1500, h: 40, type: 'normal' },
                { x: 680, y: 400, w: 40, h: 60, type: 'normal' },
                { x: 1680, y: 360, w: 60, h: 20, type: 'normal' },
                { x: 1460, y: 80, w: 40, h: 120, type: 'sticky' },
                { x: 1940, y: 260, w: 60, h: 20, type: 'normal' },
                { x: 2420, y: 80, w: 60, h: 20, type: 'normal' },
                { x: 2420, y: 420, w: 60, h: 20, type: 'normal' },
                { x: 2040, y: 440, w: 60, h: 20, type: 'normal' },
                { x: 2140, y: 40, w: 60, h: 20, type: 'normal' }
            ];

            this.hazards = [
                { x: 460, y: 240, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 860, y: 240, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 1220, y: 240, w: 60, h: 20, type: 'spike', direction: 'down' },
                { x: 140, y: 440, w: 60, h: 20, type: 'spike', direction: 'up' }
            ];

            this.gates = [
                { x: 480, y: -220, w: 20, h: 420, type: 'yellowLaser', id: 31, disabled: false }
            ];

            this.enemies = [
                { x: 880, y: 420, rangeX: 150, speed: 1.0, isVertical: false, color: '#10b981', type: 'chaser' },
                { x: 520, y: 420, rangeX: 150, speed: 1.0, isVertical: false, color: '#10b981', type: 'chaser' },
                { x: 1240, y: 420, rangeX: 150, speed: 1.0, isVertical: false, color: '#10b981', type: 'chaser' },
                { x: 1140, y: 160, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e', type: 'patrol' },
                { x: 1800, y: 60, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4', type: 'patrol' },
                { x: 2100, y: 140, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4', type: 'patrol' },
                { x: 1940, y: 380, rangeX: 180, speed: 2.0, isVertical: false, color: '#eab308', type: 'patrol' },
                { x: 300, y: 60, rangeX: 180, speed: 2.0, isVertical: false, color: '#eab308', type: 'patrol' },
                { x: 300, y: 160, rangeX: 120, speed: 1.2, isVertical: false, color: '#f43f5e', type: 'patrol' }
            ];

            this.conveyors = [
                { x: 1140, y: 200, w: 120, h: 20, direction: 1, speed: 1.5 },
                { x: 1020, y: 200, w: 120, h: 20, direction: 1, speed: 1.5 }
            ];

            this.levers = [
                { x: 2440, y: 60, w: 32, h: 32, linkedGateId: 31, activated: false },
                { x: 2440, y: 400, w: 32, h: 32, linkedGateId: 9, activated: false }
            ];

            this.flamethrowers = [
                { id: 9226, startX: 1380, startY: 200, x: 1380, y: 200, w: 32, h: 32, dir: 'down', range: 180, moving: false, moveRange: 100, moveSpeed: 1.5, moveAxis: 'y', progress: 0, disabled: false, active: true, currentLength: 0 },
                { id: 9, startX: 780, startY: 200, x: 780, y: 200, w: 32, h: 32, dir: 'up', range: 600, moving: false, moveRange: 100, moveSpeed: 1.5, moveAxis: 'y', progress: 0, disabled: false, active: true, currentLength: 0 }
            ];

            this.breakablePlatforms = [
                { x: 2200, y: 220, w: 120, h: 40, type: 'platform', broken: false, timer: 0, triggered: false }
            ];

            this.fallingBlockTraps = [
                { startX: 1240, startY: -120, x: 1240, y: -120, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 920, startY: -120, x: 920, y: -120, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 },
                { startX: 600, startY: -120, x: 600, y: -120, w: 60, h: 60, state: 'idle', vy: 0, timer: 0 }
            ];
        } else if (levelNumber === 16) {
            // ═══════════════════════════════════════════════
            // BÖLÜM 16: MEKANİK KORİDORLAR
            // ═══════════════════════════════════════════════
            this.width = 1600;
            this.height = 600;
            this.spawnX = 40;
            this.spawnY = 180;
            this.portal = { x: 1530, y: 240, w: 60, h: 80, angle: 0 };

            this.platforms = [
                { x: 0, y: 440, w: 1600, h: 140, type: 'normal' },
                { x: 0, y: 260, w: 240, h: 40, type: 'normal' },
                { x: 400, y: 260, w: 240, h: 40, type: 'normal' },
                { x: 820, y: 260, w: 240, h: 40, type: 'normal' },
                { x: 1200, y: 260, w: 240, h: 40, type: 'normal' },
                { x: 350, y: 50, w: 290, h: 40, type: 'normal' },
                { x: 750, y: 50, w: 370, h: 40, type: 'normal' },
                { x: 0, y: 50, w: 320, h: 40, type: 'normal' },
                { x: 1160, y: 50, w: 435, h: 40, type: 'normal' }
            ];

            this.gates = [
                { x: 1500, y: 110, w: 20, h: 330, type: 'yellowLaser', id: 1, disabled: false },
                { x: 1460, y: 110, w: 20, h: 330, type: 'yellowLaser', id: 101, disabled: false }
            ];

            this.pushBlocks = [
                { startX: 80, startY: 210, x: 80, y: 210, w: 50, h: 50, vx: 0, vy: 0, isMirror: true, mirrorType: 'slash' },
                { startX: 500, startY: 210, x: 500, y: 210, w: 50, h: 50, vx: 0, vy: 0, isMirror: true, mirrorType: 'slash' },
                { startX: 910, startY: 210, x: 910, y: 210, w: 50, h: 50, vx: 0, vy: 0, isMirror: true, mirrorType: 'slash' }
            ];

            this.breakablePlatforms = [
                { x: 300, y: 320, w: 40, h: 120, type: 'wall', broken: false, timer: 0, triggered: false },
                { x: 710, y: 320, w: 40, h: 120, type: 'wall', broken: false, timer: 0, triggered: false },
                { x: 1110, y: 320, w: 40, h: 120, type: 'wall', broken: false, timer: 0, triggered: false }
            ];

            this.laserEmitters = [
                { x: 0, y: 390, w: 40, h: 40, direction: 0, color: 'blue', path: [] }
            ];

            this.laserReceivers = [
                { x: 320, y: 90, w: 40, h: 40, linkedGateId: 101, activated: false },
                { x: 710, y: 90, w: 40, h: 40, linkedGateId: 1, activated: false },
                { x: 1120, y: 90, w: 40, h: 40, linkedGateId: 101, activated: false }
            ];

            this.staticMirrors = [
                { x: 780, y: 260, w: 40, h: 40, mirrorType: 'top-right' },
                { x: 640, y: 260, w: 40, h: 40, mirrorType: 'bottom-left' },
                { x: 640, y: 80, w: 40, h: 40, mirrorType: 'top-left' },
                { x: 360, y: 260, w: 40, h: 40, mirrorType: 'top-right' },
                { x: 240, y: 260, w: 40, h: 40, mirrorType: 'top-left' },
                { x: 1060, y: 260, w: 40, h: 40, mirrorType: 'bottom-left' },
                { x: 1160, y: 260, w: 40, h: 40, mirrorType: 'top-right' }
            ];
        } else if (levelNumber === 17) {
            this.width = 1600;
            this.height = 600;
            this.spawnX = 100;
            this.spawnY = 380;
            this.platforms = [
                { x: 0, y: 460, w: 1600, h: 140, type: 'normal' }
            ];
            this.hazards = [];
            this.collectibles = [];
            this.enemies = [];
            this.portal = { x: 1400, y: 380, w: 60, h: 80, angle: 0 };
        } else if (levelNumber === 18) {
            this.width = 1600;
            this.height = 600;
            this.spawnX = 100;
            this.spawnY = 380;
            this.platforms = [
                { x: 0, y: 460, w: 1600, h: 140, type: 'normal' }
            ];
            this.hazards = [];
            this.collectibles = [];
            this.enemies = [];
            this.portal = { x: 1400, y: 380, w: 60, h: 80, angle: 0 };
        } else if (levelNumber === 19) {
            this.width = 1600;
            this.height = 600;
            this.spawnX = 100;
            this.spawnY = 380;
            this.platforms = [
                { x: 0, y: 460, w: 1600, h: 140, type: 'normal' }
            ];
            this.hazards = [];
            this.collectibles = [];
            this.enemies = [];
            this.portal = { x: 1400, y: 380, w: 60, h: 80, angle: 0 };
        } else if (levelNumber === 20) {
            this.width = 2000;
            this.height = 600;
            this.spawnX = 300;
            this.spawnY = 360;
            this.platforms = [
                { x: 0, y: 460, w: 2000, h: 140, type: 'normal' },
                { x: 330, y: 130, w: 120, h: 40, type: 'normal' },
                { x: 780, y: 130, w: 120, h: 40, type: 'normal' },
                { x: 1270, y: 130, w: 120, h: 40, type: 'normal' },
                { x: 130, y: 280, w: 60, h: 20, type: 'normal' },
                { x: 1540, y: 270, w: 60, h: 20, type: 'normal' },
                { x: 20, y: 180, w: 60, h: 20, type: 'normal' },
                { x: 1630, y: 140, w: 60, h: 20, type: 'normal' },
                { x: 40, y: 310, w: 40, h: 120, type: 'normal' },
                { x: 1920, y: 310, w: 40, h: 120, type: 'normal' }
            ];
            this.hazards = [];
            this.collectibles = [];
            this.enemies = [
                { x: 600, y: 150, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 1080, y: 140, rangeX: 180, speed: 2, isVertical: false, color: '#eab308' },
                { x: 20, y: 270, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' },
                { x: 1980, y: 310, rangeX: 120, speed: 1.2, isVertical: true, color: '#06b6d4' }
            ];
            this.pushBlocks = [
                { x: 360, y: 70, w: 50, h: 50, startX: 360, startY: 70, broken: false, respawnTimer: 0 },
                { x: 810, y: 70, w: 50, h: 50, startX: 810, startY: 70, broken: false, respawnTimer: 0 },
                { x: 1300, y: 70, w: 50, h: 50, startX: 1300, startY: 70, broken: false, respawnTimer: 0 }
            ];
            this.conveyors = [
                { x: 550, y: 460, w: 120, h: 20, direction: 1, speed: 1.5 },
                { x: 1080, y: 460, w: 120, h: 20, direction: 1, speed: 1.5 }
            ];
            this.vantuzPoints = [
                { x: 280, y: 240 },
                { x: 1470, y: 230 }
            ];
            this.portal = { x: 820, y: 180, w: 60, h: 80, angle: 0 };
        }
        this.generateCheckpoints();
        this.resetLevelRuntimeState();
        
        // Notify audio engine of theme change
        const themeId = (this.theme && this.theme.id) ? this.theme.id : 'neon_sewer';
        try {
            audio.setTheme(themeId);
        } catch(e) {}
    }

    generateCheckpoints() {
        this.checkpoints = [];
        if (this.currentLevel !== 0 && this.platforms && this.platforms.length > 0) {
            const targetPercentages = [0.35, 0.70];
            const hazards = this.hazards || [];
            const gates = this.gates || [];

            targetPercentages.forEach(pct => {
                const targetX = this.width * pct;

                // Hem 'normal' hem de 'slippery' platformları destekle, en az 50 genişlik yeterli
                const candidates = this.platforms
                    .filter(p => (p.type === 'normal' || p.type === 'slippery') && p.w >= 50 && p.y >= 180 && p.y <= 490)
                    .map(p => ({ p, dist: Math.abs((p.x + p.w / 2) - targetX) }))
                    .filter(({ dist }) => dist < 600)
                    .sort((a, b) => a.dist - b.dist);

                // Güvenli bir platform ve uygun X konumu bulana kadar dene
                for (const { p: platform } of candidates) {
                    const margin = 25;
                    // Hedef X konumunu platform sınırlarına sıkıştır (güvenlik payı ile)
                    const baseX = Math.max(platform.x + margin, Math.min(platform.x + platform.w - margin, targetX));

                    // Offset taraması yap (en yakın olandan uzağa doğru)
                    const scanOffsets = [0];
                    for (let o = 20; o < 200; o += 20) {
                        scanOffsets.push(-o, o);
                    }

                    let foundCpX = null;

                    for (const offset of scanOffsets) {
                        const cpX = baseX + offset;
                        // Platform sınırlarının dışına taşmasını engelle
                        if (cpX < platform.x + margin || cpX > platform.x + platform.w - margin) {
                            continue;
                        }

                        const cpY = platform.y - 32;

                        // Güvenlik kontrolleri
                        const tooCloseToSpawn = Math.abs(cpX - this.spawnX) < 200;
                        const tooCloseToOther = this.checkpoints.some(cp => Math.abs(cp.x - cpX) < 150);

                        if (tooCloseToSpawn || tooCloseToOther) continue;

                        // Platform üstünde tehlike var mı?
                        const cpRadius = 25;
                        const hasNearbyHazard = hazards.some(h => {
                            const xOverlap = (cpX + cpRadius) > h.x && (cpX - cpRadius) < (h.x + h.w);
                            
                            // Eğer bu platformun altına asılı bir aşağı-diken ise, üst yüzeydeki checkpoint için engel teşkil etmez.
                            if (h.type === 'spike' && h.direction === 'down') {
                                if (h.y >= platform.y) {
                                    return false;
                                }
                            }

                            const yNear = (h.y + h.h) >= (platform.y - 60) && h.y <= (platform.y + 30);
                            return xOverlap && yNear;
                        });

                        if (hasNearbyHazard) continue;

                        // Lazer kapısı gibi engeller var mı?
                        const hasNearbyGate = gates.some(g => {
                            const xOverlap = (cpX + cpRadius) > g.x && (cpX - cpRadius) < (g.x + g.w);
                            const yNear = (g.y + g.h) >= (platform.y - 60) && g.y <= (platform.y + 30);
                            return xOverlap && yNear;
                        });

                        if (hasNearbyGate) continue;

                        foundCpX = cpX;
                        break;
                    }

                    if (foundCpX !== null) {
                        this.checkpoints.push({
                            x: foundCpX,
                            y: platform.y - 32,
                            r: 15,
                            activated: false
                        });
                        break; // Bu hedef yüzdesi için bir checkpoint başarıyla yerleştirildi, sonrakine geç
                    }
                }
            });
        }
    }

    canPushBlock(block, dx, visited = new Set()) {
        if (visited.has(block)) return true;
        visited.add(block);

        const nextX = block.x + dx;
        
        const activeFalling = this.fallingPlatforms ? this.fallingPlatforms.filter(p => !p.fallen) : [];
        const activeBreakable = this.breakablePlatforms ? this.breakablePlatforms.filter(p => !p.broken) : [];
        const activeNetGates = this.gates ? this.gates.filter(g => g.type === 'net' && !g.disabled) : [];
        const allPlats = [
            ...this.platforms,
            ...this.movingPlatforms,
            ...activeFalling,
            ...activeBreakable,
            ...activeNetGates,
            ...(this.flamethrowers || [])
        ];
        
        for (const plat of allPlats) {
            if (plat.passage) continue;
            if (nextX + block.w > plat.x && nextX < plat.x + plat.w &&
                block.y + block.h > plat.y && block.y < plat.y + plat.h) {
                return false; // Blocked by static platform
            }
        }

        // Horizontal chain pushing check
        if (this.pushBlocks) {
            for (const other of this.pushBlocks) {
                if (other === block || other.broken) continue;
                
                // Do they overlap vertically?
                const verticalOverlap = block.y + block.h > other.y && block.y < other.y + other.h;
                if (!verticalOverlap) continue;

                // Do they collide horizontally due to the push?
                let willCollide = false;
                if (dx > 0) {
                    if (other.x > block.x && nextX + block.w > other.x) {
                        willCollide = true;
                    }
                } else if (dx < 0) {
                    if (other.x < block.x && nextX < other.x + other.w) {
                        willCollide = true;
                    }
                }

                if (willCollide) {
                    if (!this.canPushBlock(other, dx, visited)) {
                        return false;
                    }
                }
            }
        }

        // Stack pushing check (blocks resting on top of this block)
        if (this.pushBlocks) {
            for (const other of this.pushBlocks) {
                if (other === block || other.broken) continue;

                // Is other stacked on top of block?
                const isStacked = Math.abs((other.y + other.h) - block.y) < 1.5;
                const horizOverlap = other.x + other.w > block.x && other.x < block.x + block.w;

                if (isStacked && horizOverlap) {
                    if (!this.canPushBlock(other, dx, visited)) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    tryPushBlock(startBlock, dx) {
        const steps = Math.ceil(Math.abs(dx));
        if (steps === 0) return true;
        
        const stepDx = dx / steps;
        let success = false;
        
        for (let i = 0; i < steps; i++) {
            const visited = new Set();
            if (this.canPushBlock(startBlock, stepDx, visited)) {
                for (const block of visited) {
                    block.x += stepDx;
                }
                success = true;
            } else {
                break;
            }
        }
        return success;
    }

    /**
     * Level verilerini günceller (Animasyonlar ve etkileşimler)
     */
    update(player) {
        this.time += 0.05;
        this.portal.angle += 0.02;

        // Hareketli platform konumlarını güncelle (Ping-Pong & Smoothstep)
        if (this.movingPlatforms) {
            this.movingPlatforms.forEach(plat => {
                plat.prevX = plat.x;
                plat.prevY = plat.y;

                plat.progress = (plat.progress || 0) + (plat.speed || 0.02) * plat.dir;
                if (plat.progress >= 1) {
                    plat.progress = 1;
                    plat.dir = -1;
                } else if (plat.progress <= 0) {
                    plat.progress = 0;
                    plat.dir = 1;
                }

                const t = plat.progress;
                const ease = t * t * (3 - 2 * t); // Smoothstep

                plat.x = plat.startX + (plat.targetX - plat.startX) * ease;
                plat.y = plat.startY + (plat.targetY - plat.startY) * ease;
            });
        }

        // Hareketli lazer ve ağ kapılarının (gates) konumlarını güncelle
        if (this.gates) {
            this.gates.forEach(gate => {
                if (gate.moving) {
                    if (gate.startX === undefined) gate.startX = gate.x;
                    if (gate.startY === undefined) gate.startY = gate.y;
                    if (gate.targetX === undefined) gate.targetX = gate.x;
                    if (gate.targetY === undefined) gate.targetY = gate.y;
                    if (gate.speed === undefined) gate.speed = 0.015;
                    if (gate.dir === undefined) gate.dir = 1;
                    if (gate.progress === undefined) gate.progress = 0;

                    gate.prevX = gate.x;
                    gate.prevY = gate.y;

                    gate.progress += gate.speed * gate.dir;
                    if (gate.progress >= 1) {
                        gate.progress = 1;
                        gate.dir = -1;
                    } else if (gate.progress <= 0) {
                        gate.progress = 0;
                        gate.dir = 1;
                    }

                    const t = gate.progress;
                    const ease = t * t * (3 - 2 * t); // Smoothstep

                    gate.x = gate.startX + (gate.targetX - gate.startX) * ease;
                    gate.y = gate.startY + (gate.targetY - gate.startY) * ease;
                }
            });
        }

        // Toplanabilir Hücre Çekirdekleri ile çarpışma kontrolü
        if (this.collectibles) {
            this.collectibles.forEach(c => {
                if (!c.collected &&
                    player.x + player.radius > c.x - 12 && player.x - player.radius < c.x + 12 &&
                    player.y + player.radius > c.y - 12 && player.y - player.radius < c.y + 12) {
                    
                    c.collected = true;
                    player.heal(1);
                    audio.playCollect();
                    
                    if (player.game) {
                        player.game.emitParticles(c.x, c.y, 'shift', '#eab308', 12);
                    }
                }
            });
        }

        // Checkpoint çarpışma kontrolü (Sadece kolay modda)
        if (this.checkpoints && player.game && player.game.difficulty === 'easy') {
            this.checkpoints.forEach(cp => {
                const dx = player.x - cp.x;
                const dy = player.y - cp.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < player.radius + cp.r) {
                    if (!cp.activated) {
                        this.checkpoints.forEach(other => other.activated = false);
                        cp.activated = true;
                        player.game.checkpointX = cp.x;
                        player.game.checkpointY = cp.y;
                        audio.playCollect();
                        if (player.game.emitParticles) {
                            player.game.emitParticles(cp.x, cp.y, 'shift', '#10b981', 15);
                        }
                    }
                }
            });
        }

        // Lazer Geçiş Kapılarının kontrolü
        if (this.gates) {
            this.gates.forEach(gate => {
                if (gate.type === 'laser' && !gate.disabled) {
                    if (player.x + player.radius - 4 > gate.x && player.x - player.radius + 4 < gate.x + gate.w &&
                        player.y + player.radius - 4 > gate.y && player.y - player.radius + 4 < gate.y + gate.h) {
                        
                        if (player.viscosity.id !== 'LOW') {
                            player.takeDamage(1);
                        }
                    }
                }

                if (gate.type === 'pinkLaser' && !gate.disabled) {
                    if (player.x + player.radius - 4 > gate.x && player.x - player.radius + 4 < gate.x + gate.w &&
                        player.y + player.radius - 4 > gate.y && player.y - player.radius + 4 < gate.y + gate.h) {
                        if (player.viscosity.id !== 'HIGH') {
                            player.takeDamage(1);
                        }
                    }
                }

                if (gate.type === 'greenLaser' && !gate.disabled) {
                    if (player.x + player.radius - 4 > gate.x && player.x - player.radius + 4 < gate.x + gate.w &&
                        player.y + player.radius - 4 > gate.y && player.y - player.radius + 4 < gate.y + gate.h) {
                        if (player.viscosity.id !== 'NORMAL') {
                            player.takeDamage(1);
                        }
                    }
                }

                if (gate.type === 'yellowLaser' && !gate.disabled) {
                    if (player.x + player.radius - 4 > gate.x && player.x - player.radius + 4 < gate.x + gate.w &&
                        player.y + player.radius - 4 > gate.y && player.y - player.radius + 4 < gate.y + gate.h) {
                        player.takeDamage(3, 'melt');
                    }
                }
            });
        }

        // Basınç Plakası Kontrolü
        if (this.pressurePlates) {
            this.pressurePlates.forEach(plate => {
                let wasActivated = plate.activated;
                let touched = false;
                
                // Oyuncu üzerinde mi? (Generous Y check to stay stable while standing)
                if (player.x + player.radius > plate.x && player.x - player.radius < plate.x + plate.w &&
                    player.y + player.radius >= plate.y - 2 && player.y - player.radius < plate.y + plate.h) {
                    touched = true;
                }
                
                // İtilebilir blok üzerinde mi?
                if (this.pushBlocks) {
                    this.pushBlocks.forEach(block => {
                        if (block.broken) return; // Skip broken blocks
                        if (block.x + block.w > plate.x && block.x < plate.x + plate.w &&
                            block.y + block.h >= plate.y - 2 && block.y < plate.y + plate.h) {
                            touched = true;
                        }
                    });
                }
                
                let deactivateTimer = plate.deactivateTimer || 0;
                if (touched) {
                    plate.activated = true;
                    plate.deactivateTimer = 15; // Keep active for at least 15 frames to prevent rapid toggling
                } else {
                    if (deactivateTimer > 0) {
                        deactivateTimer--;
                        plate.deactivateTimer = deactivateTimer;
                        if (deactivateTimer === 0) {
                            plate.activated = false;
                        }
                    } else {
                        plate.activated = false;
                    }
                }
                
                // Bağlı kapıyı aç/kapat
                if (plate.linkedGateId !== undefined && this.gates) {
                    const linkedGate = this.gates.find(g => g.id === plate.linkedGateId);
                    if (linkedGate) {
                        linkedGate.disabled = plate.activated;
                    }
                }
                if (plate.linkedGateId !== undefined && this.flamethrowers) {
                    const linkedF = this.flamethrowers.find(f => f.id === plate.linkedGateId);
                    if (linkedF) {
                        linkedF.disabled = plate.activated;
                    }
                }
                
                if (plate.activated && !wasActivated) {
                    audio.playPlateActivate();
                } else if (!plate.activated && wasActivated) {
                    audio.playPlateDeactivate();
                }
            });
        }

        // İtilebilir Blok Fiziği
        if (this.pushBlocks) {
            // Sort a copy descending by Y to update bottom blocks first (larger Y coordinate is lower)
            const sortedBlocks = [...this.pushBlocks].sort((a, b) => b.y - a.y);
            sortedBlocks.forEach(block => {
                if (block.broken) {
                    block.respawnTimer = (block.respawnTimer || 0) - 1;
                    if (block.respawnTimer <= 0) {
                        block.broken = false;
                        block.x = block.startX !== undefined ? block.startX : block.x;
                        block.y = block.startY !== undefined ? block.startY : block.y;
                        block.vx = 0;
                        block.vy = 0;
                        block.onGround = false;
                        block.prevX = block.x;
                        block.prevY = block.y;
                    }
                    return;
                }

                // Store previous position before movement
                block.prevX = block.x;
                block.prevY = block.y;

                // Yerçekimi
                block.vy = (block.vy || 0) + 0.35;
                block.vx = (block.vx || 0) * 0.93; // Sürtünme (Daha da azaltıldı)
                
                // Y hareketi + platform çarpışma
                block.y += block.vy;
                block.onGround = false;
                
                const activeFalling = this.fallingPlatforms ? this.fallingPlatforms.filter(p => !p.fallen) : [];
                const activeBreakable = this.breakablePlatforms ? this.breakablePlatforms.filter(p => !p.broken) : [];
                const activeNetGates = this.gates ? this.gates.filter(g => g.type === 'net' && !g.disabled) : [];
                const allPlats = [
                    ...this.platforms,
                    ...this.movingPlatforms,
                    ...activeFalling,
                    ...activeBreakable,
                    ...activeNetGates,
                    ...(this.flamethrowers || [])
                ];
                for (const plat of allPlats) {
                    if (plat.passage) continue;
                    if (block.x + block.w > plat.x && block.x < plat.x + plat.w &&
                        block.y + block.h > plat.y && block.y < plat.y + plat.h) {
                        if (block.vy > 0) {
                            block.y = plat.y - block.h;
                            block.vy = 0;
                            block.onGround = true;
                        } else if (block.vy < 0) {
                            block.y = plat.y + plat.h;
                            block.vy = 0;
                        }
                    }
                }

                // Diğer itilebilir bloklarla dikey çarpışma
                this.pushBlocks.forEach(other => {
                    if (other === block || other.broken) return;
                    if (block.x + block.w > other.x && block.x < other.x + other.w &&
                        block.y + block.h > other.y && block.y < other.y + other.h) {
                        if (block.vy > 0) {
                            block.y = other.y - block.h;
                            block.vy = 0;
                            block.onGround = true;
                        } else if (block.vy < 0) {
                            block.y = other.y + other.h;
                            block.vy = 0;
                        }
                    }
                });
                
                // X hareketi + platform çarpışma (using the recursive chain/stack pushing system)
                if (Math.abs(block.vx) > 0.001) {
                    const moved = this.tryPushBlock(block, block.vx);
                    if (!moved) {
                        block.vx = 0;
                    }
                }
                
                // Konveyör bant etkisi
                if (this.conveyors) {
                    for (const conv of this.conveyors) {
                        if (block.x + block.w > conv.x && block.x < conv.x + conv.w &&
                            block.y + block.h > conv.y - 4 && block.y + block.h < conv.y + conv.h) {
                            block.vx += conv.speed * conv.direction * 0.15;
                        }
                    }
                }
                
                // Düşme sınırı
                if (block.y > 700) {
                    block.y = block.startY;
                    block.x = block.startX;
                    block.vx = 0;
                    block.vy = 0;
                    block.prevX = block.x;
                    block.prevY = block.y;
                }
            });
        }

        // Teleport Portal Kontrolü
        if (this.teleportPairs) {
            this.teleportPairs.forEach(tp => {
                if (tp.cooldown > 0) { tp.cooldown--; }
                
                // Oyuncu Işınlanma Kontrolü
                if (tp.cooldown === 0) {
                    const r = player.radius;
                    // Portal 1'e giriş
                    if (player.x + r > tp.x1 && player.x - r < tp.x1 + 40 &&
                        player.y + r > tp.y1 && player.y - r < tp.y1 + 60) {
                        player.x = tp.x2 + 20;
                        player.y = tp.y2 + 30;
                        player.vx *= 0.5;
                        player.vy *= 0.5;
                        tp.cooldown = 180;
                        player.glowBoost = 25;
                        if (player.game) {
                            player.game.shakeCamera(3, 6);
                            player.game.emitParticles(tp.x2 + 20, tp.y2 + 30, 'shift', tp.color || '#a855f7', 18);
                        }
                        audio.playTeleport();
                        return;
                    }
                    // Portal 2'ye giriş
                    else if (player.x + r > tp.x2 && player.x - r < tp.x2 + 40 &&
                             player.y + r > tp.y2 && player.y - r < tp.y2 + 60) {
                        player.x = tp.x1 + 20;
                        player.y = tp.y1 + 30;
                        player.vx *= 0.5;
                        player.vy *= 0.5;
                        tp.cooldown = 180;
                        player.glowBoost = 25;
                        if (player.game) {
                            player.game.shakeCamera(3, 6);
                            player.game.emitParticles(tp.x1 + 20, tp.y1 + 30, 'shift', tp.color || '#a855f7', 18);
                        }
                        audio.playTeleport();
                        return;
                    }
                }

                // İtilebilir Blok Işınlanma Kontrolü
                if (this.pushBlocks && tp.cooldown === 0) {
                    this.pushBlocks.forEach(block => {
                        if (block.broken) return; // Skip broken blocks
                        // Portal 1'e giriş
                        if (block.x + block.w > tp.x1 && block.x < tp.x1 + 40 &&
                            block.y + block.h > tp.y1 && block.y < tp.y1 + 60) {
                            block.x = tp.x2 + 20 - block.w / 2;
                            block.y = tp.y2 + 30 - block.h / 2;
                            block.vx *= 0.5;
                            block.vy *= 0.5;
                            tp.cooldown = 180;
                            if (player.game) {
                                player.game.shakeCamera(2, 4);
                                player.game.emitParticles(tp.x2 + 20, tp.y2 + 30, 'shift', tp.color || '#a855f7', 12);
                            }
                            audio.playTeleport();
                        }
                        // Portal 2'ye giriş
                        else if (block.x + block.w > tp.x2 && block.x < tp.x2 + 40 &&
                                 block.y + block.h > tp.y2 && block.y < tp.y2 + 60) {
                            block.x = tp.x1 + 20 - block.w / 2;
                            block.y = tp.y1 + 30 - block.h / 2;
                            block.vx *= 0.5;
                            block.vy *= 0.5;
                            tp.cooldown = 180;
                            if (player.game) {
                                player.game.shakeCamera(2, 4);
                                player.game.emitParticles(tp.x1 + 20, tp.y1 + 30, 'shift', tp.color || '#a855f7', 12);
                            }
                            audio.playTeleport();
                        }
                    });
                }
            });
        }

        // Zıplatma pedlerinin yay animasyonlarını yönet
        this.bouncePads.forEach(pad => {
            if (pad.active) {
                pad.timer -= 0.1;
                if (pad.timer <= 0) {
                    pad.active = false;
                    pad.timer = 0;
                }
            }

            // Oyuncu ile temas kontrolü
            if (player.vy >= 0 && 
                player.x + player.radius > pad.x && 
                player.x - player.radius < pad.x + pad.w &&
                player.y + player.radius >= pad.y &&
                player.y - player.radius < pad.y + pad.h) {
                
                // Ped tetiklenir
                pad.active = true;
                pad.timer = 1.0;
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                // Viskoziteye göre zıplama gücünü ayarla!
                // LOW (Hafif) -> Daha yüksek sıçrar
                // HIGH (Ağır) -> Daha az sıçrar
                let launchForce = pad.force;
                if (player.viscosity.id === 'LOW') launchForce *= 1.15;
                if (player.viscosity.id === 'HIGH') launchForce *= 0.65;
                
                player.vy = -launchForce;
                player.onGround = false;
                player.isClinging = false;
                player.isStickingCeiling = false;
                
                audio.playJump();
                player.applySquish(-0.5, 0.65);
            }
        });

        // Tehlikelerin oyuncuya hasar vermesi kontrolü
        this.hazards.forEach(hazard => {
            // İğnelerin uzaktan vurmasını engellemek için daha geniş tolerans (buffer) tanımlanır
            const bufferX = hazard.type === 'spike' ? 13 : 5;
            const bufferY = hazard.type === 'spike' ? 12 : 5;
            if (player.x + player.radius - bufferX > hazard.x && 
                player.x - player.radius + bufferX < hazard.x + hazard.w &&
                player.y + player.radius - bufferY > hazard.y &&
                player.y - player.radius + bufferY < hazard.y + hazard.h) {
                
                player.takeDamage(1);
            }

            // Düşmanların tehlikeye düşme kontrolü (Baiting - Sadece Jel Takipçi)
            if (player.game && player.game.enemies) {
                player.game.enemies.forEach(enemy => {
                    if (enemy.isDead || enemy.type !== 'chaser') return;
                    // Düşmanlar için toleransı daha dar tutup tam içine girdiklerinde tetiklenmesini sağlıyoruz
                    const eBufferX = 4;
                    const eBufferY = 4;
                    if (enemy.x + enemy.radius - eBufferX > hazard.x && 
                        enemy.x - enemy.radius + eBufferX < hazard.x + hazard.w &&
                        enemy.y + enemy.radius - eBufferY > hazard.y &&
                        enemy.y - enemy.radius + eBufferY < hazard.y + hazard.h) {
                        
                        if (enemy.explode) {
                            enemy.explode(player, player.game.emitParticles.bind(player.game));
                        }
                    }
                });
            }
        });

        // --- BUTON KONTROLLERİ ---
        if (this.buttons) {
            this.buttons.forEach(button => {
                let touched = false;
                
                // Oyuncu ile temas
                if (player.x + player.radius > button.x && player.x - player.radius < button.x + button.w &&
                    player.y + player.radius > button.y && player.y - player.radius < button.y + button.h) {
                    touched = true;
                }
                
                // İtilebilir blok ile temas
                if (this.pushBlocks) {
                    this.pushBlocks.forEach(block => {
                        if (block.broken) return; // Skip broken blocks
                        if (block.x + block.w > button.x && block.x < block.x + block.w &&
                            block.y + block.h > button.y && block.y < button.y + block.h) {
                            touched = true;
                        }
                    });
                }
                
                if (touched) {
                    if (!button.activated) {
                        audio.playPlateActivate();
                    }
                    button.activated = true;
                    button.timer = 180; // 3 saniye aktif kalır
                } else {
                    if (button.timer > 0) {
                        button.timer--;
                        if (button.timer === 0) {
                            button.activated = false;
                            audio.playPlateDeactivate();
                        }
                    }
                }
                
                // Bağlı kapıyı aç/kapat
                if (button.linkedGateId !== undefined && this.gates) {
                    const linkedGate = this.gates.find(g => g.id === button.linkedGateId);
                    if (linkedGate) {
                        linkedGate.disabled = button.activated;
                    }
                }
                if (button.linkedGateId !== undefined && this.flamethrowers) {
                    const linkedF = this.flamethrowers.find(f => f.id === button.linkedGateId);
                    if (linkedF) {
                        linkedF.disabled = button.activated;
                    }
                }
            });
        }

        // --- KOL (ŞALTER) KONTROLLERİ ---
        if (this.levers) {
            this.levers.forEach(lever => {
                if (lever.cooldown > 0) {
                    lever.cooldown--;
                }
                
                let touched = false;
                if (player.x + player.radius > lever.x && player.x - player.radius < lever.x + lever.w &&
                    player.y + player.radius > lever.y && player.y - player.radius < lever.y + lever.h) {
                    touched = true;
                }
                
                if (touched && lever.cooldown === 0) {
                    lever.activated = !lever.activated;
                    lever.cooldown = 48; // Increased from 30 (60% more time) to prevent immediate toggle while moving away
                    audio.playCollect(); // şalter sesi olarak
                }
                
                // Bağlı kapıyı aç/kapat
                if (lever.linkedGateId !== undefined && this.gates) {
                    const linkedGate = this.gates.find(g => g.id === lever.linkedGateId);
                    if (linkedGate) {
                        linkedGate.disabled = lever.activated;
                    }
                }
                if (lever.linkedGateId !== undefined && this.flamethrowers) {
                    const linkedF = this.flamethrowers.find(f => f.id === lever.linkedGateId);
                    if (linkedF) {
                        linkedF.disabled = lever.activated;
                    }
                }
            });
        }

        // --- DÜŞEN ZEMİNLER KONTROLÜ (FALLING PLATFORMS) ---
        if (this.fallingPlatforms) {
            this.fallingPlatforms.forEach(plat => {
                if (plat.triggered && !plat.fallen) {
                    plat.timer--;
                    if (plat.timer <= 0) {
                        plat.vy = (plat.vy || 0) + 0.25; // gravity
                        plat.y += plat.vy;
                        if (plat.y > this.height + 200) {
                            plat.fallen = true;
                        }
                    }
                }
            });
        }

        // --- KIRILABİLİR ZEMİNLER KONTROLÜ (BREAKABLE PLATFORMS) ---
        if (this.breakablePlatforms) {
            this.breakablePlatforms.forEach(plat => {
                if (plat.triggered && !plat.broken) {
                    plat.timer--;
                    if (plat.timer <= 0) {
                        plat.broken = true;
                        audio.playDamage(); // crack sound
                        if (player.game) {
                            // spawn shatter debris particles
                            player.game.emitParticles(plat.x + plat.w / 2, plat.y + plat.h / 2, 'shift', '#38bdf8', 15);
                        }
                    }
                }
            });
        }

        // --- DÜŞEN BLOK TUZAĞI (FALLING BLOCK TRAPS) ---
        if (this.fallingBlockTraps) {
            this.fallingBlockTraps.forEach(trap => {
                // Alt kısımdaki dikenlerin her durumda (idle, falling, waiting, rising) hasar vermesi tespiti
                const spikeBufferX = 2;
                if (player.x + player.radius - spikeBufferX > trap.x && 
                    player.x - player.radius + spikeBufferX < trap.x + trap.w &&
                    player.y - player.radius < trap.y + trap.h + 10 && 
                    player.y + player.radius > trap.y + trap.h) {
                    player.takeDamage(1);
                }

                if (trap.state === 'idle') {
                    // Check if player is directly underneath the trap
                    const toleranceX = 40; // detection zone width around trap center
                    if (player.x > trap.x - toleranceX && player.x < trap.x + trap.w + toleranceX &&
                        player.y > trap.y + trap.h && player.y < trap.y + trap.h + 600) {
                        trap.state = 'falling';
                        trap.vy = 0.5;
                        audio.playBlockPush();
                    }
                } else if (trap.state === 'falling') {
                    trap.vy += 0.5; // fast acceleration
                    trap.y += trap.vy;

                    // Check if it hit any standard/moving platform
                    const allPlats = [...this.platforms, ...this.movingPlatforms];
                    let hitGround = false;
                    for (const plat of allPlats) {
                        if (trap.x + trap.w > plat.x && trap.x < plat.x + plat.w &&
                            trap.y + trap.h >= plat.y && trap.y + trap.h <= plat.y + 15) {
                            trap.y = plat.y - trap.h;
                            hitGround = true;
                            break;
                        }
                    }
                    // Or hit the floor bounds
                    if (trap.y + trap.h >= 570) {
                        trap.y = 570 - trap.h;
                        hitGround = true;
                    }

                    if (hitGround) {
                        trap.state = 'waiting';
                        trap.vy = 0;
                        trap.timer = 60; // wait for 1 second
                        if (player.game) {
                            player.game.shakeCamera(5, 8);
                        }
                        audio.playLand(8.0); // slam sound
                    }

                    // Check collision with player
                    const buffer = 4;
                    if (player.x + player.radius - buffer > trap.x && player.x - player.radius + buffer < trap.x + trap.w &&
                        player.y + player.radius - buffer > trap.y && player.y - player.radius + buffer < trap.y + trap.h) {
                        player.takeDamage(1);
                    }
                } else if (trap.state === 'waiting') {
                    trap.timer--;
                    if (trap.timer <= 0) {
                        trap.state = 'rising';
                    }
                } else if (trap.state === 'rising') {
                    trap.y -= 1.0; // slow retract speed
                    if (trap.y <= trap.startY) {
                        trap.y = trap.startY;
                        trap.state = 'idle';
                    }
                }
            });
        }

        // --- VANTUZ NOKTALARI (SUCTION HOOK POINTS) ---
        if (this.vantuzPoints) {
            this.vantuzPoints.forEach(v => {
                if (v.cooldown > 0) v.cooldown--;
            });
        }

        // --- ANIMATED DECORATIONS ---
        if (this.decorations) {
            this.decorations.forEach(d => {
                if (d.type === 'fan') {
                    d.rotation = (d.rotation || 0) + 0.15;
                } else if (d.type === 'gear') {
                    d.rotation = (d.rotation || 0) + 0.03;
                } else if (d.type === 'warning_light' || d.type === 'warning') {
                    d.state = (this.time * 2) % (Math.PI * 2);
                } else if (d.type === 'steam') {
                    // Randomly spawn grey rising steam particles
                    if (Math.random() < 0.08 && player.game) {
                        player.game.emitParticles(d.x + d.w / 2, d.y + d.h - 5, 'trail', 'rgba(148, 163, 184, 0.2)', 1);
                    }
                }
            });
        }

        // --- OK FIRLATICIlar (ARROW SHOOTERS) KONTROLÜ ---
        if (this.arrowShooters) {
            this.arrowShooters.forEach(shooter => {
                const cx = shooter.x + shooter.w / 2;
                const cy = shooter.y + shooter.h / 2;

                // 1. Oyuncu mesafe kontrolü
                const dx = player.x - cx;
                const dy = player.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const inRange = dist <= shooter.detectionRadius;

                // 2. Ateşleme zamanlayıcısı
                if (inRange) {
                    shooter.fireTimer -= (1 / 60); // Assume 60fps delta
                    if (shooter.fireTimer <= 0) {
                        shooter.fireTimer = shooter.fireInterval;

                        // Ok başlangıç noktası ve yön vektörü
                        let ox = cx, oy = cy;
                        let vx = 0, vy = 0;
                        const spd = shooter.arrowSpeed;
                        if (shooter.dir === 'right')  { ox = shooter.x + shooter.w; vx =  spd; }
                        else if (shooter.dir === 'left')   { ox = shooter.x;            vx = -spd; }
                        else if (shooter.dir === 'up')     { oy = shooter.y;            vy = -spd; }
                        else if (shooter.dir === 'down')   { oy = shooter.y + shooter.h; vy =  spd; }
                        else if (shooter.dir === 'target') {
                            const angle = Math.atan2(player.y - cy, player.x - cx);
                            const r = shooter.w / 2 + 8; // Namlu ucundan fırlatılması için
                            ox = cx + Math.cos(angle) * r;
                            oy = cy + Math.sin(angle) * r;
                            vx = Math.cos(angle) * spd;
                            vy = Math.sin(angle) * spd;
                        }

                        shooter.arrows.push({ x: ox, y: oy, vx, vy, life: shooter.arrowRange, alive: true });

                        // Ses efekti
                        if (player.game && player.game.audio) {
                            try { player.game.audio.playCollect && player.game.audio.playCollect(); } catch(e){}
                        }
                    }
                } else {
                    // Menzil dışındaysa zamanlayıcıyı sıfırla (ama hemen ateşlemesin)
                    if (shooter.fireTimer <= 0) shooter.fireTimer = 0;
                }

                // 3. Aktif okları güncelle
                const checkObjects = [
                    ...this.platforms,
                    ...(this.movingPlatforms || []),
                    ...(this.breakablePlatforms ? this.breakablePlatforms.filter(p => !p.broken) : []),
                    ...(this.fallingPlatforms ? this.fallingPlatforms.filter(p => !p.fallen) : []),
                    ...(this.pushBlocks ? this.pushBlocks.filter(pb => !pb.broken) : [])
                ];

                shooter.arrows = shooter.arrows.filter(arrow => arrow.alive);
                shooter.arrows.forEach(arrow => {
                    arrow.x += arrow.vx;
                    arrow.y += arrow.vy;
                    arrow.life -= Math.sqrt(arrow.vx * arrow.vx + arrow.vy * arrow.vy);

                    if (arrow.life <= 0) { arrow.alive = false; return; }

                    // Platform çarpışma kontrolü (AABB)
                    for (const obj of checkObjects) {
                        if (arrow.x >= obj.x && arrow.x <= obj.x + obj.w &&
                            arrow.y >= obj.y && arrow.y <= obj.y + obj.h) {
                            arrow.alive = false;
                            // Çarpma partikülü
                            if (player.game && player.game.particles) {
                                for (let i = 0; i < 5; i++) {
                                    player.game.particles.push({
                                        x: arrow.x, y: arrow.y,
                                        vx: (Math.random() - 0.5) * 3,
                                        vy: (Math.random() - 0.5) * 3,
                                        life: 18 + Math.random() * 12,
                                        maxLife: 30,
                                        color: '#94a3b8',
                                        size: 2 + Math.random() * 2
                                    });
                                }
                            }
                            break;
                        }
                    }

                    if (!arrow.alive) return;

                    // Düşman çarpışma kontrolü (Baiting - Sadece Jel Takipçi)
                    if (player.game && player.game.enemies) {
                        for (const enemy of player.game.enemies) {
                            if (enemy.isDead || enemy.type !== 'chaser') continue;
                            const edx = arrow.x - enemy.x;
                            const edy = arrow.y - enemy.y;
                            const dist = Math.sqrt(edx * edx + edy * edy);
                            if (dist < enemy.radius + 6) {
                                arrow.alive = false;
                                if (enemy.explode) {
                                    enemy.explode(player, player.game.emitParticles.bind(player.game));
                                }
                                break;
                            }
                        }
                    }

                    if (!arrow.alive) return;

                    // Oyuncu çarpışma kontrolü
                    const adx = arrow.x - player.x;
                    const ady = arrow.y - player.y;
                    if (Math.sqrt(adx * adx + ady * ady) < player.radius + 6) {
                        arrow.alive = false;
                        player.takeDamage(1);
                    }
                });
            });
        }

        // --- ALEV SİLAHLARI (THERMAL FLAMETHROWERS) KONTROLÜ ---
        if (this.flamethrowers) {
            this.flamethrowers.forEach(f => {
                // 1. Hareket Güncelleme (Yavaş ve akıcı devriye için 0.015'ten 0.005'e düşürüldü)
                f.prevX = f.x;
                f.prevY = f.y;
                if (f.moving) {
                    f.progress = (f.progress || 0) + (f.moveSpeed || 1.5) * (f.moveDir || 1) * 0.005;
                    if (f.progress >= 1) {
                        f.progress = 1;
                        f.moveDir = -1;
                    } else if (f.progress <= 0) {
                        f.progress = 0;
                        f.moveDir = 1;
                    }
                    if (f.moveAxis === 'x') {
                        f.x = f.startX + f.moveRange * f.progress;
                    } else {
                        f.y = f.startY + f.moveRange * f.progress;
                    }
                }

                if (f.disabled) {
                    f.currentLength = 0;
                    return;
                }

                // 2. Alevin Boyunu Raycast ile Hesapla (Blok ve Platform Engellemesi)
                let rayStartX = f.x + f.w / 2;
                let rayStartY = f.y + f.h / 2;
                if (f.dir === 'right') rayStartX = f.x + f.w;
                else if (f.dir === 'left') rayStartX = f.x;
                else if (f.dir === 'down') rayStartY = f.y + f.h;
                else if (f.dir === 'up') rayStartY = f.y;

                let minDistance = f.range || 200;

                const activeBreakable = this.breakablePlatforms ? this.breakablePlatforms.filter(p => !p.broken) : [];
                const activeFalling = this.fallingPlatforms ? this.fallingPlatforms.filter(p => !p.fallen) : [];
                const checkObjects = [
                    ...this.platforms,
                    ...(this.movingPlatforms || []),
                    ...activeBreakable,
                    ...activeFalling,
                    ...(this.pushBlocks ? this.pushBlocks.filter(pb => !pb.broken) : [])
                ];

                checkObjects.forEach(obj => {
                    if (f.dir === 'right') {
                        if (obj.x >= rayStartX && obj.x < rayStartX + minDistance &&
                            rayStartY >= obj.y && rayStartY <= obj.y + obj.h) {
                            minDistance = obj.x - rayStartX;
                        }
                    } else if (f.dir === 'left') {
                        if (obj.x + obj.w <= rayStartX && obj.x + obj.w > rayStartX - minDistance &&
                            rayStartY >= obj.y && rayStartY <= obj.y + obj.h) {
                            minDistance = rayStartX - (obj.x + obj.w);
                        }
                    } else if (f.dir === 'down') {
                        if (obj.y >= rayStartY && obj.y < rayStartY + minDistance &&
                            rayStartX >= obj.x && rayStartX <= obj.x + obj.w) {
                            minDistance = obj.y - rayStartY;
                        }
                    } else if (f.dir === 'up') {
                        if (obj.y + obj.h <= rayStartY && obj.y + obj.h > rayStartY - minDistance &&
                            rayStartX >= obj.x && rayStartX <= obj.x + obj.w) {
                            minDistance = rayStartY - (obj.y + obj.h);
                        }
                    }
                });

                f.currentLength = minDistance;

                // 3. Oyuncu ile Çarpışma (Hasar) Kontrolü
                if (f.active) {
                    let flameArea = { x: 0, y: 0, w: 0, h: 0 };
                    const thickness = 22; // Alevin çarpışma genişliği

                    if (f.dir === 'right') {
                        flameArea = { x: rayStartX, y: rayStartY - thickness/2, w: f.currentLength, h: thickness };
                    } else if (f.dir === 'left') {
                        flameArea = { x: rayStartX - f.currentLength, y: rayStartY - thickness/2, w: f.currentLength, h: thickness };
                    } else if (f.dir === 'down') {
                        flameArea = { x: rayStartX - thickness/2, y: rayStartY, w: thickness, h: f.currentLength };
                    } else if (f.dir === 'up') {
                        flameArea = { x: rayStartX - thickness/2, y: rayStartY - f.currentLength, w: thickness, h: f.currentLength };
                    }

                    const buffer = 4;
                    if (player.x + player.radius - buffer > flameArea.x && player.x - player.radius + buffer < flameArea.x + flameArea.w &&
                        player.y + player.radius - buffer > flameArea.y && player.y - player.radius + buffer < flameArea.y + flameArea.h) {
                        player.takeDamage(1);
                    }

                    // Düşman alev temas kontrolü (Baiting - Sadece Jel Takipçi)
                    if (player.game && player.game.enemies) {
                        player.game.enemies.forEach(enemy => {
                            if (enemy.isDead || enemy.type !== 'chaser') return;
                            const eBuffer = 4;
                            if (enemy.x + enemy.radius - eBuffer > flameArea.x && enemy.x - enemy.radius + eBuffer < flameArea.x + flameArea.w &&
                                enemy.y + enemy.radius - eBuffer > flameArea.y && enemy.y - enemy.radius + eBuffer < flameArea.y + flameArea.h) {
                                if (enemy.explode) {
                                    enemy.explode(player, player.game.emitParticles.bind(player.game));
                                }
                            }
                        });
                    }
                }

                // 4. Parçacık Emisyonu (Yavaş yavaş partikül fırlatarak alev yayma)
                if (f.active && player.game && player.game.particles && f.currentLength > 5) {
                    let dirX = 0;
                    let dirY = 0;
                    if (f.dir === 'right') dirX = 1;
                    else if (f.dir === 'left') dirX = -1;
                    else if (f.dir === 'down') dirY = 1;
                    else if (f.dir === 'up') dirY = -1;

                    // Her karede yoğunluk için 1-2 alev puf partikülü üret
                    const spawnCount = Math.random() < 0.7 ? 2 : 1;
                    for (let i = 0; i < spawnCount; i++) {
                        const speed = 2.4 + Math.random() * 2.0;
                        const angleSpread = (Math.random() - 0.5) * 0.42; // Koni yayılımını artırdık (üçgen şeklinde dağılım için)
                        
                        let vx = 0;
                        let vy = 0;
                        if (f.dir === 'right') {
                            vx = speed;
                            vy = angleSpread * speed;
                        } else if (f.dir === 'left') {
                            vx = -speed;
                            vy = angleSpread * speed;
                        } else if (f.dir === 'down') {
                            vy = speed;
                            vx = angleSpread * speed;
                        } else if (f.dir === 'up') {
                            vy = -speed;
                            vx = angleSpread * speed;
                        }

                        const offsetNoiseX = (Math.random() - 0.5) * 5;
                        const offsetNoiseY = (Math.random() - 0.5) * 5;

                        // Alev engele değdiğinde partikül sönmeli (dinamik yaşam süresi)
                        const life = Math.max(10, Math.ceil(f.currentLength / speed));

                        player.game.particles.push({
                            x: rayStartX + offsetNoiseX,
                            y: rayStartY + offsetNoiseY,
                            vx: vx,
                            vy: vy,
                            startSize: 3.5 + Math.random() * 3,
                            size: 3.5,
                            color: 'rgba(254, 240, 138, 0.9)',
                            alpha: 0.9,
                            life: life,
                            maxLife: life,
                            type: 'fire'
                        });
                    }
                }
            });
        }

        // --- AKTİF ALEV PARTİKÜLLERİNİN HAREKET VE RENK GEÇİŞLERİ ---
        if (player.game && player.game.particles) {
            player.game.particles.forEach(p => {
                if (p.type === 'fire') {
                    const ratio = 1 - (p.life / p.maxLife); // ömür oranı
                    
                    // Zamanla alev üçgen şeklinde belirgin şekilde genişler (8.5'ten 15.0'a çıkarıldı)
                    p.size = p.startSize + ratio * 15.0;
                    
                    // Yellow -> Orange -> Red -> Grey/Fading smoke
                    if (ratio < 0.22) {
                        p.color = `rgba(254, 240, 138, ${0.9 * (1 - ratio)})`;
                    } else if (ratio < 0.55) {
                        p.color = `rgba(249, 115, 22, ${0.75 * (1 - ratio)})`;
                    } else if (ratio < 0.82) {
                        p.color = `rgba(239, 68, 68, ${0.55 * (1 - ratio)})`;
                    } else {
                        p.color = `rgba(100, 116, 139, ${0.22 * (1 - ratio)})`; // duman
                    }
                    
                    // Hafif dikey yükselme ve rüzgar dalgalanması (yükselme azaltıldı ki düzgün üçgen kalsın)
                    p.vy -= 0.015; 
                    p.vx += (Math.random() - 0.5) * 0.12;
                }
            });
        }
        this.updateLaserRouting(player);
    }

    /**
     * Lazer yönlendirme ve yansıma fiziğini günceller
     */
    updateLaserRouting(player) {
        if (!this.laserEmitters) this.laserEmitters = [];
        if (!this.laserReceivers) this.laserReceivers = [];

        // 1. Alıcıları sıfırla
        this.laserReceivers.forEach(r => r.activated = false);

        // Yardımcı AABB kesişim fonksiyonu
        const rayIntersectsAABB = (rx, ry, dx, dy, box) => {
            const minX = box.x;
            const maxX = box.x + box.w;
            const minY = box.y;
            const maxY = box.y + box.h;

            if (dx === 1) { // Right
                if (ry >= minY && ry <= maxY && rx <= minX) return minX - rx;
            } else if (dx === -1) { // Left
                if (ry >= minY && ry <= maxY && rx >= maxX) return rx - maxX;
            } else if (dy === 1) { // Down
                if (rx >= minX && rx <= maxX && ry <= minY) return minY - ry;
            } else if (dy === -1) { // Up
                if (rx >= minX && rx <= maxX && ry >= maxY) return ry - maxY;
            }
            return -1;
        };

        // 2. Her bir lazer vericisi için ışın yayılımını hesapla
        this.laserEmitters.forEach(emitter => {
            let currX = emitter.x + emitter.w / 2;
            let currY = emitter.y + emitter.h / 2;
            let dir = emitter.direction; // 0: Right, 1: Down, 2: Left, 3: Up
            let dx = 0, dy = 0;
            if (dir === 0) dx = 1;
            else if (dir === 1) dy = 1;
            else if (dir === 2) dx = -1;
            else if (dir === 3) dy = -1;

            emitter.path = [{ x: currX, y: currY }];

            let reflections = 0;
            const maxReflections = 12;
            let rayActive = true;
            let lastHitCollider = null;

            while (rayActive && reflections < maxReflections) {
                let closestDist = Infinity;
                let closestCollider = null;
                let hitX = currX;
                let hitY = currY;

                // A. Zeminler ve duvarlar ile çarpışma
                this.platforms.forEach(plat => {
                    if (plat.passage) return; // Gizli geçitleri atla
                    const dist = rayIntersectsAABB(currX, currY, dx, dy, plat);
                    if (dist >= 0 && dist < closestDist) {
                        closestDist = dist;
                        closestCollider = { type: 'platform', obj: plat };
                    }
                });

                // A1. Kırılabilir platformlar ile çarpışma (Lazer geçmesin)
                if (this.breakablePlatforms) {
                    this.breakablePlatforms.forEach(plat => {
                        if (plat.broken) return;
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, plat);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'platform', obj: plat };
                        }
                    });
                }

                // A2. Düşen platformlar ile çarpışma (Lazer geçmesin)
                if (this.fallingPlatforms) {
                    this.fallingPlatforms.forEach(plat => {
                        if (plat.fallen) return;
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, plat);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'platform', obj: plat };
                        }
                    });
                }

                // A3. Hareketli platformlar ile çarpışma (Lazer geçmesin)
                if (this.movingPlatforms) {
                    this.movingPlatforms.forEach(plat => {
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, plat);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'platform', obj: plat };
                        }
                    });
                }

                // A4. Kapılar / Lazer bariyerleri ile çarpışma (Aktif olanlar lazeri engeller)
                if (this.gates) {
                    this.gates.forEach(gate => {
                        if (gate.disabled) return;
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, gate);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'platform', obj: gate };
                        }
                    });
                }

                // A5. Düşen blok tuzakları ile çarpışma (Lazer geçmesin)
                if (this.fallingBlockTraps) {
                    this.fallingBlockTraps.forEach(trap => {
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, trap);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'platform', obj: trap };
                        }
                    });
                }

                // B. İtilebilir bloklar (Aynalı veya normal) ile çarpışma
                if (this.pushBlocks) {
                    this.pushBlocks.forEach(block => {
                        if (block.broken) return;
                        if (lastHitCollider && lastHitCollider.type === 'block' && lastHitCollider.obj === block) return;
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, block);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'block', obj: block };
                        }
                    });
                }

                // B2. Statik Köşe Aynaları ile çarpışma
                if (this.staticMirrors) {
                    this.staticMirrors.forEach(mirror => {
                        if (lastHitCollider && lastHitCollider.type === 'staticMirror' && lastHitCollider.obj === mirror) return;
                        const dist = rayIntersectsAABB(currX, currY, dx, dy, mirror);
                        if (dist >= 0 && dist < closestDist) {
                            closestDist = dist;
                            closestCollider = { type: 'staticMirror', obj: mirror };
                        }
                    });
                }

                // C. Oyuncu ile çarpışma (Eşleşmeyen form ise lazeri bloke eder ve oyuncuya hasar verir)
                let playerMatchesColor = false;
                if (emitter.color === 'blue' && player.viscosity.id === 'LOW') playerMatchesColor = true;
                else if (emitter.color === 'pink' && player.viscosity.id === 'HIGH') playerMatchesColor = true;
                else if (emitter.color === 'green' && player.viscosity.id === 'NORMAL') playerMatchesColor = true;

                if (!playerMatchesColor) {
                    const pBox = {
                        x: player.x - player.radius,
                        y: player.y - player.radius,
                        w: player.radius * 2,
                        h: player.radius * 2
                    };
                    const dist = rayIntersectsAABB(currX, currY, dx, dy, pBox);
                    if (dist > 0 && dist < closestDist) {
                        closestDist = dist;
                        closestCollider = { type: 'player', obj: player };
                    }
                }

                // Kesişim noktasını ve bir sonraki adımı belirle
                if (closestDist < Infinity) {
                    hitX = currX + dx * closestDist;
                    hitY = currY + dy * closestDist;
                } else {
                    // Ekran / Seviye sınırı
                    let distToBorder = Infinity;
                    if (dx === 1) distToBorder = this.width - currX;
                    else if (dx === -1) distToBorder = currX;
                    else if (dy === 1) distToBorder = this.height - currY;
                    else if (dy === -1) distToBorder = currY;

                    closestDist = distToBorder;
                    hitX = currX + dx * closestDist;
                    hitY = currY + dy * closestDist;
                    rayActive = false;
                }

                // Noktayı kaydet
                emitter.path.push({ x: hitX, y: hitY });

                // Çarpışan objenin türüne göre davranış belirle
                if (closestCollider) {
                    if (closestCollider.type === 'staticMirror' || (closestCollider.type === 'block' && closestCollider.obj.isMirror)) {
                        // Yansıma açısı hesabı
                        const mirror = closestCollider.obj;
                        let nextDx = dx;
                        let nextDy = dy;

                        const mType = mirror.mirrorType;
                        const isSlash = (mType === 'slash' || mType === 'top-left' || mType === 'bottom-right');

                        if (isSlash) { // /
                            if (dx === 1) { nextDx = 0; nextDy = -1; }
                            else if (dx === -1) { nextDx = 0; nextDy = 1; }
                            else if (dy === 1) { nextDx = -1; nextDy = 0; }
                            else if (dy === -1) { nextDx = 1; nextDy = 0; }
                        } else { // \
                            if (dx === 1) { nextDx = 0; nextDy = 1; }
                            else if (dx === -1) { nextDx = 0; nextDy = -1; }
                            else if (dy === 1) { nextDx = 1; nextDy = 0; }
                            else if (dy === -1) { nextDx = -1; nextDy = 0; }
                        }

                        currX = hitX;
                        currY = hitY;
                        dx = nextDx;
                        dy = nextDy;
                        reflections++;
                        lastHitCollider = closestCollider; // Son çarptığımız objeyi yoksayacağız
                    } else {
                        rayActive = false;
                        if (closestCollider.type === 'player') {
                            if (emitter.color === 'yellow') {
                                player.takeDamage(3, 'melt');
                            } else {
                                player.takeDamage(1);
                            }
                        }
                    }
                } else {
                    rayActive = false;
                }
            }

            // 3. Işın yollarını kontrol edip sensörleri aktif et
            if (this.laserReceivers && emitter.path.length > 1) {
                this.laserReceivers.forEach(receiver => {
                    for (let i = 0; i < emitter.path.length - 1; i++) {
                        const p1 = emitter.path[i];
                        const p2 = emitter.path[i+1];

                        let intersects = false;
                        if (p1.y === p2.y) { // Yatay segment
                            if (receiver.y <= p1.y && receiver.y + receiver.h >= p1.y) {
                                const minX = Math.min(p1.x, p2.x);
                                const maxX = Math.max(p1.x, p2.x);
                                if (minX <= receiver.x + receiver.w && maxX >= receiver.x) {
                                    intersects = true;
                                }
                            }
                        } else { // Dikey segment
                            if (receiver.x <= p1.x && receiver.x + receiver.w >= p1.x) {
                                const minY = Math.min(p1.y, p2.y);
                                const maxY = Math.max(p1.y, p2.y);
                                if (minY <= receiver.y + receiver.h && maxY >= receiver.y) {
                                    intersects = true;
                                }
                            }
                        }

                        if (intersects) {
                            receiver.activated = true;
                            break;
                        }
                    }
                });
            }
        });

        // 4. Bağlı kapıları/flamethrower'ları güncelle
        if (this.laserReceivers) {
            this.laserReceivers.forEach(receiver => {
                if (receiver.linkedGateId !== undefined) {
                    if (this.gates) {
                        const linkedGates = this.gates.filter(g => g.id === receiver.linkedGateId);
                        linkedGates.forEach(g => {
                            if (receiver.activated) {
                                g.disabled = true;
                            } else {
                                const otherActive = (this.pressurePlates || []).some(pp => pp.linkedGateId === receiver.linkedGateId && pp.activated) ||
                                                    (this.buttons || []).some(b => b.linkedGateId === receiver.linkedGateId && b.activated) ||
                                                    (this.levers || []).some(l => l.linkedGateId === receiver.linkedGateId && l.activated) ||
                                                    (this.laserReceivers || []).some(r => r !== receiver && r.linkedGateId === receiver.linkedGateId && r.activated);
                                if (!otherActive) {
                                    g.disabled = false;
                                }
                            }
                        });
                    }
                    if (this.flamethrowers) {
                        const linkedFs = this.flamethrowers.filter(f => f.id === receiver.linkedGateId);
                        linkedFs.forEach(f => {
                            if (receiver.activated) {
                                f.disabled = true;
                            } else {
                                const otherActive = (this.pressurePlates || []).some(pp => pp.linkedGateId === receiver.linkedGateId && pp.activated) ||
                                                    (this.buttons || []).some(b => b.linkedGateId === receiver.linkedGateId && b.activated) ||
                                                    (this.levers || []).some(l => l.linkedGateId === receiver.linkedGateId && l.activated) ||
                                                    (this.laserReceivers || []).some(r => r !== receiver && r.linkedGateId === receiver.linkedGateId && r.activated);
                                if (!otherActive) {
                                    f.disabled = false;
                                }
                            }
                        });
                    }
                }
            });
        }
    }

    /**
     * Seviyeyi ekrana çizer
     */
    draw(ctx, camera, game) {
        const zoom = (game && game.camera && game.camera.zoom) ? game.camera.zoom : 1;
        const viewW = (game && game.cssWidth) ? game.cssWidth : (ctx.canvas.width || 800);
        const viewH = (game && game.cssHeight) ? game.cssHeight : (ctx.canvas.height || 600);
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // --- AMBIENT COLOR GLOWS (EYE-FRIENDLY THEME BACKGROUNDS) ---
        if (this.theme) {
            const themeId = this.theme.id || 'neon_sewer';
            let glowColor = 'rgba(16, 185, 129, 0.08)'; // Default neon sewer green
            if (themeId === 'toxic_lab') {
                glowColor = 'rgba(234, 179, 8, 0.08)'; // Yellow
            } else if (themeId === 'magma_core') {
                glowColor = 'rgba(249, 115, 22, 0.08)'; // Orange/red
            } else if (themeId === 'gravity_chasm') {
                glowColor = 'rgba(217, 70, 239, 0.08)'; // Purple
            }

            const glowPositions = [
                { x: this.width * 0.15, y: this.height * 0.3, r: 350 },
                { x: this.width * 0.45, y: this.height * 0.6, r: 400 },
                { x: this.width * 0.75, y: this.height * 0.3, r: 350 },
                { x: this.width * 0.90, y: this.height * 0.5, r: 400 }
            ];

            ctx.save();
            glowPositions.forEach(pos => {
                const gx = pos.x + camera.x * 0.3;
                const gy = pos.y + camera.y * 0.3;
                const screenX = gx - camera.x;
                const screenY = gy - camera.y;

                if (screenX + pos.r > 0 && screenX - pos.r < viewW &&
                    screenY + pos.r > 0 && screenY - pos.r < viewH) {
                    const radGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, pos.r);
                    radGrad.addColorStop(0, glowColor);
                    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    ctx.fillStyle = radGrad;
                    ctx.beginPath();
                    ctx.arc(gx, gy, pos.r, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
            ctx.restore();
        }

        // Background panels grid, rivets, and cross lines removed for a clean flat colored background as requested by user.


        // --- PLATFORM DESTEK SÜTUNLARI VE ASKI KABLOLARI ---
        const getSupportBottomY = (plat) => {
            let bottomY = 530; // Zemin truss limiti
            this.platforms.forEach(other => {
                if (other !== plat && other.y > plat.y + plat.h) {
                    if (plat.x + 5 < other.x + other.w && plat.x + plat.w - 5 > other.x) {
                        if (other.y < bottomY) {
                            bottomY = other.y;
                        }
                    }
                }
            });
            return bottomY;
        };

        const getSupportTopY = (plat) => {
            let topY = 0; // Tavan limiti
            this.platforms.forEach(other => {
                if (other !== plat && other.y + other.h < plat.y) {
                    if (plat.x + 5 < other.x + other.w && plat.x + plat.w - 5 > other.x) {
                        if (other.y + other.h > topY) {
                            topY = other.y + other.h;
                        }
                    }
                }
            });
            return topY;
        };

        this.platforms.forEach(plat => {
            // Yalnızca havada asılı duran platformlar için destek çiz
            if (plat.y + plat.h >= 530) return;

            const supports = [];
            if (plat.w >= 100) {
                supports.push(plat.x + 20);
                supports.push(plat.x + plat.w - 20);
            } else {
                supports.push(plat.x + plat.w / 2);
            }

            // Platform yüksekse kabloyla as, alçaksa sütunla destekle
            const useCable = plat.y < 260;

            supports.forEach(sx => {
                if (useCable) {
                    const topY = getSupportTopY(plat);
                    if (topY >= plat.y) return; // Çizilecek alan yok

                    ctx.save();
                    const themeId = this.theme ? this.theme.id : 'default';

                    if (themeId === 'magma_core') {
                        // Ağır çelik zincirler
                        ctx.strokeStyle = '#334155';
                        ctx.lineWidth = 1.5;
                        const linkH = 10;
                        for (let cy = topY; cy < plat.y - 3; cy += linkH - 2) {
                            ctx.strokeRect(sx - 2.5, cy, 5, linkH);
                            ctx.beginPath();
                            ctx.moveTo(sx - 2.5, cy + 2);
                            ctx.lineTo(sx + 2.5, cy + 8);
                            ctx.stroke();
                        }
                    } else if (themeId === 'toxic_lab' || themeId === 'neon_sewer') {
                        // Işıltılı asit/kimyasal sıvısı taşıyan cam boru
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.fillStyle = '#0f172a';
                        ctx.lineWidth = 1.5;
                        ctx.fillRect(sx - 4, topY, 8, plat.y - topY);
                        ctx.strokeRect(sx - 4, topY, 8, plat.y - topY);

                        ctx.strokeStyle = (this.theme && this.theme.acidColor) ? this.theme.acidColor : '#10b981';
                        ctx.shadowColor = ctx.strokeStyle;
                        ctx.shadowBlur = 5;
                        ctx.lineWidth = 2.5;
                        ctx.beginPath();
                        ctx.moveTo(sx, topY + 2);
                        ctx.lineTo(sx, plat.y - 2);
                        ctx.stroke();
                    } else {
                        // Standart / Default: Neon mavi askı kablosu
                        ctx.strokeStyle = '#020617';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(sx, topY);
                        ctx.lineTo(sx, plat.y);
                        ctx.stroke();

                        ctx.strokeStyle = (this.theme && this.theme.platformStroke) ? this.theme.platformStroke : '#38bdf8';
                        ctx.shadowColor = ctx.strokeStyle;
                        ctx.shadowBlur = 6;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(sx, topY + 2);
                        ctx.lineTo(sx, plat.y - 2);
                        ctx.stroke();
                    }
                    ctx.restore();
                } else {
                    // Alttan dikey destek sütunu
                    const bottomY = getSupportBottomY(plat);
                    if (bottomY <= plat.y + plat.h) return; // Çizilecek alan yok

                    ctx.save();
                    const themeId = this.theme ? this.theme.id : 'default';

                    if (themeId === 'magma_core') {
                        // Lav damarlı ağır bazalt sütun
                        const grad = ctx.createLinearGradient(sx - 10, 0, sx + 10, 0);
                        grad.addColorStop(0, '#1c1917');
                        grad.addColorStop(0.5, '#44403c');
                        grad.addColorStop(1, '#1c1917');
                        ctx.fillStyle = grad;
                        ctx.strokeStyle = '#ea580c';
                        ctx.lineWidth = 2;
                        
                        const pillarW = 20;
                        ctx.fillRect(sx - pillarW / 2, plat.y + plat.h, pillarW, bottomY - (plat.y + plat.h));
                        ctx.strokeRect(sx - pillarW / 2, plat.y + plat.h, pillarW, bottomY - (plat.y + plat.h));

                        ctx.strokeStyle = '#f97316';
                        ctx.shadowColor = '#f97316';
                        ctx.shadowBlur = 4;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        let seed = (plat.x + sx) % 100;
                        ctx.moveTo(sx, plat.y + plat.h);
                        for (let ty = plat.y + plat.h + 5; ty < bottomY - 5; ty += 8) {
                            const dx = Math.sin(seed++) * 4;
                            ctx.lineTo(sx + dx, ty);
                        }
                        ctx.stroke();
                    } else if (themeId === 'toxic_lab') {
                        // Göstergeli sarı laboratuvar kolonu
                        ctx.fillStyle = '#0f172a';
                        ctx.strokeStyle = '#eab308';
                        ctx.lineWidth = 2;
                        const pillarW = 14;
                        ctx.fillRect(sx - pillarW / 2, plat.y + plat.h, pillarW, bottomY - (plat.y + plat.h));
                        ctx.strokeRect(sx - pillarW / 2, plat.y + plat.h, pillarW, bottomY - (plat.y + plat.h));

                        ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(sx, plat.y + plat.h + 2);
                        ctx.lineTo(sx, bottomY - 2);
                        ctx.stroke();

                        ctx.fillStyle = '#ffffff';
                        ctx.shadowColor = '#eab308';
                        ctx.shadowBlur = 5;
                        for (let ty = plat.y + plat.h + 10; ty < bottomY - 10; ty += 30) {
                            if (Math.sin(this.time * 4 + ty * 0.08) > 0.3) {
                                ctx.beginPath();
                                ctx.arc(sx, ty, 2, 0, Math.PI * 2);
                                ctx.fill();
                            }
                        }
                    } else if (themeId === 'gravity_chasm') {
                        // Mor yerçekimi enerji sütunu (Floating rings)
                        ctx.strokeStyle = 'rgba(217, 70, 239, 0.5)';
                        ctx.lineWidth = 1.5;
                        ctx.shadowColor = '#d946ef';
                        ctx.shadowBlur = 6;
                        ctx.setLineDash([4, 4]);
                        ctx.beginPath();
                        ctx.moveTo(sx - 7, plat.y + plat.h);
                        ctx.lineTo(sx - 7, bottomY);
                        ctx.moveTo(sx + 7, plat.y + plat.h);
                        ctx.lineTo(sx + 7, bottomY);
                        ctx.stroke();

                        const energyGrad = ctx.createLinearGradient(sx - 5, 0, sx + 5, 0);
                        energyGrad.addColorStop(0, 'rgba(217, 70, 239, 0)');
                        energyGrad.addColorStop(0.5, 'rgba(217, 70, 239, 0.2)');
                        energyGrad.addColorStop(1, 'rgba(217, 70, 239, 0)');
                        ctx.fillStyle = energyGrad;
                        ctx.fillRect(sx - 7, plat.y + plat.h, 14, bottomY - (plat.y + plat.h));

                        ctx.strokeStyle = '#d946ef';
                        ctx.setLineDash([]);
                        ctx.lineWidth = 1.5;
                        const ringOffset = (this.time * 20) % 40;
                        for (let ry = plat.y + plat.h + ringOffset; ry < bottomY; ry += 40) {
                            ctx.beginPath();
                            ctx.ellipse(sx, ry, 11, 2.5, 0, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    } else {
                        // Standart / Neon Sewer: Endüstriyel kafes kolon (truss)
                        ctx.fillStyle = '#111827';
                        ctx.strokeStyle = (this.theme && this.theme.platformStroke) ? this.theme.platformStroke : '#475569';
                        ctx.lineWidth = 2;
                        const pillarW = 12;
                        ctx.fillRect(sx - pillarW / 2, plat.y + plat.h, pillarW, bottomY - (plat.y + plat.h));
                        ctx.strokeRect(sx - pillarW / 2, plat.y + plat.h, pillarW, bottomY - (plat.y + plat.h));

                        ctx.strokeStyle = (this.theme && this.theme.platformStroke) ? this.theme.platformStroke : '#334155';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        for (let ty = plat.y + plat.h + 4; ty < bottomY - 10; ty += 14) {
                            ctx.moveTo(sx - 6, ty);
                            ctx.lineTo(sx + 6, ty + 10);
                            ctx.moveTo(sx + 6, ty);
                            ctx.lineTo(sx - 6, ty + 10);
                        }
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            });
        });

        // --- EN ALTTAKİ LAV NEHRİ (Minimized — sadece ince bir çizgi) ---
        // Arka plan lav dolgusu kaldırıldı, bölüm engelleri ön planda kalsın

        // --- PLATFORMLARI ÇİZ ---
        this.platforms.forEach(plat => {
            ctx.save();
            
            // Gölgeli modern platform kutusu
            ctx.shadowBlur = 8;
            
            if (plat.slippery) {
                // Kaygan Buz Yüzeyi (Gelişmiş Işıltılı Cam Buz)
                const iceGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
                iceGrad.addColorStop(0, '#e0f2fe'); // Soft snowy top
                iceGrad.addColorStop(0.2, '#7dd3fc'); // Glow cyan
                iceGrad.addColorStop(0.8, '#0284c7'); // Deep ice blue
                iceGrad.addColorStop(1, '#0c4a6e'); // Dark base depth
                ctx.fillStyle = iceGrad;
                
                const iceStrokeGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x + plat.w, plat.y);
                iceStrokeGrad.addColorStop(0, '#06b6d4');
                iceStrokeGrad.addColorStop(0.5, '#ffffff'); // Center sheen reflection
                iceStrokeGrad.addColorStop(1, '#06b6d4');
                ctx.strokeStyle = iceStrokeGrad;
                ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
            } else if (plat.sticky) {
                // Yapışkan Jel Yüzeyi (Gelişmiş Organik Ooze Tipi)
                const stickyGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
                stickyGrad.addColorStop(0, '#f472b6'); // Bright hot pink
                stickyGrad.addColorStop(0.25, '#c084fc'); // Light purple
                stickyGrad.addColorStop(0.75, '#7e22ce'); // Deep purple
                stickyGrad.addColorStop(1, '#3b0764'); // Dark purple base depth
                ctx.fillStyle = stickyGrad;
                ctx.strokeStyle = '#f472b6'; // Glowing pink outline
                ctx.shadowColor = 'rgba(217, 70, 239, 0.6)';
            } else {
                // Standart Platform
                const platformFill = (this.theme && this.theme.platformColor) ? this.theme.platformColor : '#111118';
                const platformStroke = (this.theme && this.theme.platformStroke) ? this.theme.platformStroke : '#1f2937';
                
                // Create a sleek 3D metallic gradient
                const platGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
                platGrad.addColorStop(0, platformFill);
                platGrad.addColorStop(1, '#050508'); // Darken at the bottom for 3D depth
                
                ctx.fillStyle = platGrad;
                ctx.strokeStyle = platformStroke;
                ctx.shadowColor = (this.theme && this.theme.platformShadow) ? this.theme.platformShadow : 'rgba(0, 0, 0, 0.5)';
            }

            ctx.lineWidth = 2;
            
            // Dinamik köşe pahı (bozulmayı engeller, AABB kutusuyla görseli eşleştirir)
            const cornerRadius = Math.min(6, plat.w / 2, plat.h / 2);
            this.drawRoundedRect(ctx, plat.x, plat.y, plat.w, plat.h, cornerRadius);
            
            // Katı Dolgu: Gövdeyi tamamen opak doldur, neon kenarlığı tam opak çiz
            ctx.save();
            ctx.fill();
            ctx.restore();
            
            ctx.stroke();

            // Yüzey süslemeleri (Detay ve estetik)
            ctx.shadowBlur = 0; // İç süslemede gölgeyi kapat
            if (plat.slippery) {
                // Buz ışıltıları ve kristal detayları
                ctx.save();
                // Köşe parıltıları ve buz çizgileri
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 1.5;
                for (let ox = 15; ox < plat.w - 15; ox += 30) {
                    ctx.beginPath();
                    ctx.moveTo(plat.x + ox, plat.y + 4);
                    ctx.lineTo(plat.x + ox + 6, plat.y + 10);
                    ctx.stroke();
                }
                
                // Gömülü geometrik buz kristalleri
                ctx.fillStyle = 'rgba(224, 242, 254, 0.3)';
                ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
                ctx.lineWidth = 1;
                let seed = (plat.x * 7 + plat.y * 31) % 100;
                const prng = () => {
                    let x = Math.sin(seed++) * 10000;
                    return x - Math.floor(x);
                };
                const numCrystals = Math.max(1, Math.floor(plat.w / 45));
                for (let j = 0; j < numCrystals; j++) {
                    const cx = plat.x + 12 + prng() * (plat.w - 24);
                    const cy = plat.y + 8 + prng() * (plat.h - 16);
                    const size = 3 + prng() * 4;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - size);
                    ctx.lineTo(cx + size * 0.6, cy);
                    ctx.lineTo(cx, cy + size);
                    ctx.lineTo(cx - size * 0.6, cy);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();
            } else if (plat.sticky) {
                // Jel damlaları deseni ve dalgalı jel üst yüzeyi
                ctx.save();
                ctx.shadowBlur = 0;
                
                // 1. Dalgalı yapışkan jel dalgacıkları (Wobbly slime bubbles on top)
                ctx.fillStyle = 'rgba(244, 114, 182, 0.85)'; // Hot pink slime top
                ctx.beginPath();
                ctx.moveTo(plat.x, plat.y + 6);
                for (let wx = 0; wx <= plat.w; wx += 12) {
                    const px = plat.x + wx;
                    const wobble = Math.sin(this.time * 5 + wx * 0.15) * 3;
                    ctx.lineTo(px, plat.y + wobble);
                }
                ctx.lineTo(plat.x + plat.w, plat.y + 6);
                ctx.lineTo(plat.x + plat.w, plat.y);
                ctx.lineTo(plat.x, plat.y);
                ctx.closePath();
                ctx.fill();
                
                // 2. Platform içinde yavaşça parıldayan/yükselen jel kabarcıkları
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.strokeStyle = 'rgba(217, 70, 239, 0.4)';
                ctx.lineWidth = 1;
                let seed = (plat.x * 17 + plat.y * 7) % 100;
                const prng = () => {
                    let x = Math.sin(seed++) * 10000;
                    return x - Math.floor(x);
                };
                
                const numBubbles = Math.max(1, Math.floor(plat.w / 40));
                for (let j = 0; j < numBubbles; j++) {
                    const bx = plat.x + 12 + prng() * (plat.w - 24);
                    const floatOffset = (this.time * 12 + prng() * 30) % (plat.h - 12);
                    const by = plat.y + plat.h - 8 - floatOffset;
                    
                    const r = 2.5 + Math.sin(this.time * 3 + j) * 1 + prng() * 1.5;
                    ctx.beginPath();
                    ctx.arc(bx, by, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                
                ctx.restore();
            } else {
                // Premium industrial surface styling
                ctx.save();
                ctx.shadowBlur = 0;
                
                // Top highlight border
                ctx.strokeStyle = (this.theme && this.theme.platformHighlight) ? this.theme.platformHighlight : '#374151';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(plat.x + 4, plat.y + 2);
                ctx.lineTo(plat.x + plat.w - 4, plat.y + 2);
                ctx.stroke();
                
                // Draw vertical panel division lines if platform is wide
                if (plat.w >= 100) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
                    ctx.lineWidth = 1;
                    for (let px = 60; px < plat.w - 20; px += 60) {
                        ctx.beginPath();
                        ctx.moveTo(plat.x + px, plat.y + 4);
                        ctx.lineTo(plat.x + px, plat.y + plat.h - 4);
                        ctx.stroke();
                    }
                }
                
                // Draw tiny metallic bolts/rivets in the 4 corners (if height is reasonable)
                if (plat.h >= 20) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                    ctx.lineWidth = 0.5;
                    const rivets = [
                        { rx: 8, ry: 8 },
                        { rx: plat.w - 8, ry: 8 },
                        { rx: 8, ry: plat.h - 8 },
                        { rx: plat.w - 8, ry: plat.h - 8 }
                    ];
                    rivets.forEach(r => {
                        ctx.beginPath();
                        ctx.arc(plat.x + r.rx, plat.y + r.ry, 2, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    });
                }
                ctx.restore();
            }

            ctx.restore();
        });

        // --- HAREKETLİ PLATFORMLARI ÇİZ ---
        if (this.movingPlatforms) {
            this.movingPlatforms.forEach(plat => {
                // Draw engine thruster nozzles at the bottom first, so the platform overlays them
                ctx.save();
                ctx.fillStyle = '#334155'; // Dark grey steel
                ctx.strokeStyle = '#eab308'; // Glowing gold details
                ctx.lineWidth = 1;
                
                const nozzleW = 8;
                const nozzleH = 6;
                const offset = Math.min(12, plat.w / 4);
                
                // Left engine nozzle
                ctx.fillRect(plat.x + offset - nozzleW/2, plat.y + plat.h, nozzleW, nozzleH);
                ctx.strokeRect(plat.x + offset - nozzleW/2, plat.y + plat.h, nozzleW, nozzleH);
                
                // Right engine nozzle
                ctx.fillRect(plat.x + plat.w - offset - nozzleW/2, plat.y + plat.h, nozzleW, nozzleH);
                ctx.strokeRect(plat.x + plat.w - offset - nozzleW/2, plat.y + plat.h, nozzleW, nozzleH);
                
                // Draw thruster exhaust flame plumes that flicker
                const flameScale = 4 + Math.sin(this.time * 20) * 2 + Math.random() * 2;
                ctx.shadowColor = '#f97316'; // Orange flame glow
                ctx.shadowBlur = 10;
                
                // Flame gradient (bright white center, orange tip)
                const flameGrad = ctx.createLinearGradient(plat.x, plat.y + plat.h, plat.x, plat.y + plat.h + flameScale);
                flameGrad.addColorStop(0, '#ffffff');
                flameGrad.addColorStop(0.3, '#f97316'); // Orange
                flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)'); // Red fade
                ctx.fillStyle = flameGrad;
                
                // Left flame cone
                ctx.beginPath();
                ctx.moveTo(plat.x + offset - nozzleW/2, plat.y + plat.h + nozzleH);
                ctx.lineTo(plat.x + offset + nozzleW/2, plat.y + plat.h + nozzleH);
                ctx.lineTo(plat.x + offset, plat.y + plat.h + nozzleH + flameScale);
                ctx.closePath();
                ctx.fill();
                
                // Right flame cone
                ctx.beginPath();
                ctx.moveTo(plat.x + plat.w - offset - nozzleW/2, plat.y + plat.h + nozzleH);
                ctx.lineTo(plat.x + plat.w - offset + nozzleW/2, plat.y + plat.h + nozzleH);
                ctx.lineTo(plat.x + plat.w - offset, plat.y + plat.h + nozzleH + flameScale);
                ctx.closePath();
                ctx.fill();
                
                ctx.restore();

                // Now draw the platform body
                ctx.save();
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(234, 179, 8, 0.4)'; // Gold glow warning
                
                // 3D metallic gradient
                const platGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
                platGrad.addColorStop(0, '#334155'); // Metallic grey-blue top
                platGrad.addColorStop(0.5, '#1e293b'); // Dark mid
                platGrad.addColorStop(1, '#0f172a'); // Very dark bottom
                ctx.fillStyle = platGrad;
                ctx.strokeStyle = '#eab308'; // Glowing gold outline
                ctx.lineWidth = 2.5;
                
                const cornerRadius = Math.min(6, plat.w / 2, plat.h / 2);
                this.drawRoundedRect(ctx, plat.x, plat.y, plat.w, plat.h, cornerRadius);
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fill();
                ctx.restore();
                ctx.stroke();
                
                ctx.shadowBlur = 0; // Disable heavy glow for internal details
                
                // Draw yellow/black hazard warning stripes inside
                ctx.save();
                ctx.beginPath();
                this.drawRoundedRect(ctx, plat.x + 3, plat.y + 3, plat.w - 6, plat.h - 6, Math.max(0, cornerRadius - 2));
                ctx.clip();
                
                ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
                ctx.lineWidth = 4;
                for (let ox = -20; ox < plat.w + 20; ox += 15) {
                    ctx.beginPath();
                    ctx.moveTo(plat.x + ox, plat.y);
                    ctx.lineTo(plat.x + ox + 15, plat.y + plat.h);
                    ctx.stroke();
                }
                
                // Draw mechanical rivets at left/right centers
                ctx.fillStyle = 'rgba(234, 179, 8, 0.6)';
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(plat.x + offset, plat.y + plat.h / 2, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(plat.x + plat.w - offset, plat.y + plat.h / 2, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.restore();
                ctx.restore();
            });
        }

        // --- KAPILARI (GATES) ÇİZ ---
        if (this.gates) {
            this.gates.forEach(gate => {
                ctx.save();
                
                if ((gate.type === 'laser' || gate.type === 'pinkLaser' || gate.type === 'greenLaser' || gate.type === 'yellowLaser') && !gate.disabled) {
                    let laserColor = '#06b6d4'; // Default blue
                    if (gate.type === 'pinkLaser') laserColor = '#d946ef';
                    else if (gate.type === 'greenLaser') laserColor = '#10b981';
                    else if (gate.type === 'yellowLaser') laserColor = '#eab308';

                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = laserColor;
                    ctx.lineWidth = 2;
                    
                    // Top post
                    ctx.fillRect(gate.x - 4, gate.y, gate.w + 8, 8);
                    ctx.strokeRect(gate.x - 4, gate.y, gate.w + 8, 8);
                    // Bottom post
                    ctx.fillRect(gate.x - 4, gate.y + gate.h - 8, gate.w + 8, 8);
                    ctx.strokeRect(gate.x - 4, gate.y + gate.h - 8, gate.w + 8, 8);
                    
                    // Flickering Laser beam
                    ctx.shadowColor = laserColor;
                    ctx.shadowBlur = 10 + Math.random() * 8;
                    ctx.strokeStyle = laserColor;
                    ctx.lineWidth = 4 + Math.sin(this.time * 10) * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(gate.x + gate.w / 2, gate.y + 8);
                    ctx.lineTo(gate.x + gate.w / 2, gate.y + gate.h - 8);
                    ctx.stroke();
                    
                    // White core
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                } else if (gate.type === 'net') {
                    // Mor Ağ Bariyeri
                    ctx.strokeStyle = '#d946ef';
                    ctx.lineWidth = 1.5;
                    ctx.shadowColor = '#d946ef';
                    ctx.shadowBlur = 8;
                    
                    ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(gate.x, gate.y, gate.w, gate.h);
                    ctx.clip();
                    
                    ctx.strokeStyle = 'rgba(217, 70, 239, 0.4)';
                    ctx.lineWidth = 1;
                    const spacing = 15;
                    
                    for (let val = -gate.h; val < gate.w; val += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(gate.x + val, gate.y);
                        ctx.lineTo(gate.x + val + gate.h, gate.y + gate.h);
                        ctx.stroke();
                    }
                    for (let val = 0; val < gate.w + gate.h; val += spacing) {
                        ctx.beginPath();
                        ctx.moveTo(gate.x + val, gate.y);
                        ctx.lineTo(gate.x + val - gate.h, gate.y + gate.h);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                
                ctx.restore();
            });
        }

        // --- ALEV SİLAHLARINI (FLAMETHROWERS) ÇİZ ---
        if (this.flamethrowers) {
            this.flamethrowers.forEach(f => {
                ctx.save();

                // 1. Alev efektini çiz (aktif ve devredışı değilse)
                if (f.active && !f.disabled && f.currentLength > 0) {
                    ctx.save();
                    
                    let rayStartX = f.x + f.w / 2;
                    let rayStartY = f.y + f.h / 2;
                    if (f.dir === 'right') rayStartX = f.x + f.w;
                    else if (f.dir === 'left') rayStartX = f.x;
                    else if (f.dir === 'down') rayStartY = f.y + f.h;
                    else if (f.dir === 'up') rayStartY = f.y;

                    let dirX = 0;
                    let dirY = 0;
                    if (f.dir === 'right') dirX = 1;
                    else if (f.dir === 'left') dirX = -1;
                    else if (f.dir === 'down') dirY = 1;
                    else if (f.dir === 'up') dirY = -1;

                    // Katman katman, büyüyen ve dalgalanan ateş pufları çiz (üçgen koni şeklinde)
                    const stepSize = 6;
                    const maxPuffs = Math.ceil(f.currentLength / stepSize);

                    for (let i = 0; i <= maxPuffs; i++) {
                        const dist = i * stepSize;
                        if (dist > f.currentLength) break;

                        const ratio = dist / (f.range || 200);
                        const wobbleSpeed = 20;
                        const wobble = Math.sin(this.time * wobbleSpeed - dist * 0.05) * (1.5 + ratio * 3.5);

                        // Koni yarı genişliği (uzaklaştıkça artar, üçgen yayılımı sağlar)
                        const halfConeWidth = ratio * 26.0;

                        // Üçgen formunu doldurmak için 3 adet paralel akış (sol, orta, sağ) çiziyoruz
                        const offsets = [-0.6, 0, 0.6];
                        offsets.forEach(offsetRatio => {
                            let px = rayStartX + dirX * dist;
                            let py = rayStartY + dirY * dist;

                            // Perpendicular (dik) sapma
                            const perpOffset = wobble + offsetRatio * halfConeWidth;

                            if (dirX !== 0) {
                                py += perpOffset;
                            } else {
                                px += perpOffset;
                            }

                            // Puf yarıçapı da uçlara doğru büyür
                            const puffRadius = 5.0 + ratio * 16.0;

                            // Renk geçişi
                            let puffColor = 'rgba(254, 240, 138, 0.85)'; // Sarı (kaynakta en sıcak)
                            if (ratio > 0.12) {
                                puffColor = 'rgba(249, 115, 22, 0.70)'; // Turuncu
                            }
                            if (ratio > 0.45) {
                                puffColor = 'rgba(239, 68, 68, 0.48)'; // Kırmızı
                            }
                            if (ratio > 0.82) {
                                puffColor = 'rgba(239, 68, 68, 0.12)'; // Alev ucu sönme
                            }

                            ctx.save();
                            ctx.fillStyle = puffColor;
                            
                            // Performans ve görsel için bazı puflara shadow ekle
                            if (i % 4 === 0) {
                                ctx.shadowColor = ratio > 0.4 ? '#ef4444' : '#f97316';
                                ctx.shadowBlur = 6 + Math.random() * 4;
                            }
                            ctx.beginPath();
                            ctx.arc(px, py, puffRadius, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.restore();
                        });
                    }
                    
                    ctx.restore();
                }

                // 2. Taban Metal Kutuyu Çiz veya Ejderha Kafası Assetini Çiz
                if (this.dragonHeadLoaded) {
                    ctx.save();
                    const cx = f.x + f.w / 2;
                    const cy = f.y + f.h / 2;
                    ctx.translate(cx, cy);
                    
                    if (f.dir === 'left') {
                        ctx.scale(-1, 1);
                    } else if (f.dir === 'down') {
                        ctx.rotate(Math.PI / 2);
                    } else if (f.dir === 'up') {
                        ctx.rotate(-Math.PI / 2);
                    }
                    
                    // Draw dragon head centered (width 32, height 58 based on ratio 1.82)
                    ctx.drawImage(this.dragonHeadImage, -16, -29, 32, 58);
                    
                    // 3. Glowing Eye Effect (active state)
                    if (f.active && !f.disabled) {
                        const pulse = Math.sin(this.time * 15) * 1.5;
                        ctx.fillStyle = '#ffb700';
                        ctx.shadowColor = '#ff5100';
                        ctx.shadowBlur = 8 + pulse;
                        ctx.beginPath();
                        ctx.arc(6.5, 0, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    ctx.restore();
                } else {
                    // Fallback: Taban Metal Kutuyu Çiz (Launcher Body)
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 2.5;
                    ctx.fillRect(f.x, f.y, f.w, f.h);
                    ctx.strokeRect(f.x, f.y, f.w, f.h);

                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(f.x + 6, f.y + 6, f.w - 12, f.h - 12);
                    ctx.strokeRect(f.x + 6, f.y + 6, f.w - 12, f.h - 12);

                    // Üfleç Borusunu Çiz (Nozzle)
                    ctx.fillStyle = '#475569';
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = 2;
                    
                    let nozzleX = f.x + f.w / 2 - 8;
                    let nozzleY = f.y + f.h / 2 - 8;
                    let nozzleW = 16;
                    let nozzleH = 16;

                    if (f.dir === 'right') {
                        nozzleX = f.x + f.w;
                        nozzleY = f.y + f.h / 2 - 6;
                        nozzleW = 8;
                        nozzleH = 12;
                    } else if (f.dir === 'left') {
                        nozzleX = f.x - 8;
                        nozzleY = f.y + f.h / 2 - 6;
                        nozzleW = 8;
                        nozzleH = 12;
                    } else if (f.dir === 'down') {
                        nozzleX = f.x + f.w / 2 - 6;
                        nozzleY = f.y + f.h;
                        nozzleW = 12;
                        nozzleH = 8;
                    } else if (f.dir === 'up') {
                        nozzleX = f.x + f.w / 2 - 6;
                        nozzleY = f.y - 8;
                        nozzleW = 12;
                        nozzleH = 8;
                    }
                    ctx.fillRect(nozzleX, nozzleY, nozzleW, nozzleH);
                    ctx.strokeRect(nozzleX, nozzleY, nozzleW, nozzleH);

                    // Durum Işığı Çiz (LED Indicator)
                    let ledColor = '#ef4444';
                    if (f.active && !f.disabled) {
                        ledColor = (this.time * 5) % 2 > 1 ? '#eab308' : '#f97316';
                    }
                    ctx.fillStyle = ledColor;
                    ctx.beginPath();
                    ctx.arc(f.x + f.w / 2, f.y + f.h / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            });
        }

        // --- OK FIRLATICIlarI ÇİZ ---
        this.drawArrowShooters(ctx, this.time, game ? game.player : null);

        // --- TOPLANABİLİR HÜCRE ÇEKİRDEKLERİNİ ÇİZ ---
        if (this.collectibles) {
            this.collectibles.forEach(c => {
                if (c.collected) return;
                
                ctx.save();
                const colColor = c.color || '#eab308';
                ctx.shadowColor = colColor;
                ctx.shadowBlur = 10 + Math.sin(this.time * 2) * 4;
                ctx.fillStyle = colColor;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                
                ctx.translate(c.x, c.y);
                ctx.rotate(this.time * 1.5);
                
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(6, 0);
                ctx.lineTo(0, 8);
                ctx.lineTo(-6, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.restore();
            });
        }

        // --- BASINÇ PLAKALARI ÇİZ ---
        if (this.pressurePlates) {
            this.pressurePlates.forEach(plate => {
                ctx.save();
                const plateColor = plate.color || '#eab308';
                ctx.shadowColor = plateColor;
                ctx.shadowBlur = plate.activated ? 15 : 6;
                
                const pressDepth = plate.activated ? 4 : 0;
                ctx.fillStyle = plate.activated ? plateColor : '#1e293b';
                ctx.strokeStyle = plateColor;
                ctx.lineWidth = 2;
                
                this.drawRoundedRect(ctx, plate.x, plate.y + pressDepth, plate.w, plate.h - pressDepth, 3);
                ctx.fill();
                ctx.stroke();
                
                // İç gösterge ışığı
                ctx.fillStyle = plate.activated ? '#ffffff' : 'rgba(234, 179, 8, 0.3)';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(plate.x + plate.w / 2, plate.y + plate.h / 2 + pressDepth, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            });
        }

        // --- İTİLEBİLİR BLOKLAR ÇİZ ---
        if (this.pushBlocks) {
            this.pushBlocks.forEach(block => {
                if (block.broken) return; // Do not draw broken blocks
                ctx.save();
                
                // Theme-based accent color
                const themeColor = (this.theme && this.theme.platformStroke) ? this.theme.platformStroke : '#38bdf8';
                ctx.shadowColor = themeColor;
                ctx.shadowBlur = 10;
                
                // Outer crate body gradient
                const grad = ctx.createLinearGradient(block.x, block.y, block.x, block.y + block.h);
                grad.addColorStop(0, '#1e293b');
                grad.addColorStop(0.5, '#0f172a');
                grad.addColorStop(1, '#020617');
                ctx.fillStyle = grad;
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 3;
                
                this.drawRoundedRect(ctx, block.x, block.y, block.w, block.h, 6);
                ctx.fill();
                ctx.stroke();
                
                ctx.shadowBlur = 0; // Disable heavy shadow for details
                
                // Inset border
                ctx.strokeStyle = 'rgba(71, 85, 105, 0.6)';
                ctx.lineWidth = 1.5;
                this.drawRoundedRect(ctx, block.x + 4, block.y + 4, block.w - 8, block.h - 8, 4);
                ctx.stroke();
                
                // Diagonal warning hash marks on corners
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                // Top-left
                ctx.moveTo(block.x + 4, block.y + 12); ctx.lineTo(block.x + 12, block.y + 4);
                // Top-right
                ctx.moveTo(block.x + block.w - 12, block.y + 4); ctx.lineTo(block.x + block.w - 4, block.y + 12);
                // Bottom-left
                ctx.moveTo(block.x + 4, block.y + block.h - 12); ctx.lineTo(block.x + 12, block.y + block.h - 4);
                // Bottom-right
                ctx.moveTo(block.x + block.w - 12, block.y + block.h - 4); ctx.lineTo(block.x + block.w - 4, block.y + block.h - 12);
                ctx.stroke();
                
                // Glowing Neon Core or Mirror reflection pane
                if (block.isMirror) {
                    ctx.save();
                    ctx.shadowColor = '#00f0ff';
                    ctx.shadowBlur = 10;
                    ctx.strokeStyle = '#00f0ff';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    if (block.mirrorType === 'slash') {
                        ctx.moveTo(block.x + 10, block.y + block.h - 10);
                        ctx.lineTo(block.x + block.w - 10, block.y + 10);
                    } else {
                        ctx.moveTo(block.x + 10, block.y + 10);
                        ctx.lineTo(block.x + block.w - 10, block.y + block.h - 10);
                    }
                    ctx.stroke();

                    // White center highlight
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                    ctx.restore();

                    // Mini label "M" for visual clarity
                    ctx.save();
                    ctx.fillStyle = '#00f0ff';
                    ctx.font = '800 9px Outfit';
                    ctx.textAlign = 'center';
                    ctx.fillText('M', block.x + block.w / 2, block.y + block.h / 2 + 3);
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.shadowColor = themeColor;
                    ctx.shadowBlur = 8;
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                    ctx.strokeStyle = themeColor;
                    ctx.lineWidth = 2;
                    ctx.fillRect(block.x + block.w/2 - 12, block.y + block.h/2 - 12, 24, 24);
                    ctx.strokeRect(block.x + block.w/2 - 12, block.y + block.h/2 - 12, 24, 24);
                    
                    // Center white core pulse
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 4;
                    ctx.beginPath();
                    ctx.arc(block.x + block.w/2, block.y + block.h/2, 4 + Math.sin(this.time * 2) * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                
                // Corner bolts/rivets
                ctx.fillStyle = '#64748b';
                const boltOffset = 8;
                const bolts = [
                    { bx: boltOffset, by: boltOffset },
                    { bx: block.w - boltOffset, by: boltOffset },
                    { bx: boltOffset, by: block.h - boltOffset },
                    { bx: block.w - boltOffset, by: block.h - boltOffset }
                ];
                bolts.forEach(bolt => {
                    ctx.beginPath();
                    ctx.arc(block.x + bolt.bx, block.y + bolt.by, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
                
                ctx.restore();
            });
        }

        // --- KONVEYÖR BANTLAR ÇİZ ---
        if (this.conveyors) {
            this.conveyors.forEach(conv => {
                ctx.save();
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = 6;
                
                ctx.fillRect(conv.x, conv.y, conv.w, conv.h);
                ctx.strokeRect(conv.x, conv.y, conv.w, conv.h);
                
                // Animasyonlu yön okları
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(245, 158, 11, 0.5)';
                const arrowSpacing = 30;
                const offset = (this.time * conv.speed * conv.direction * 80) % arrowSpacing;
                
                for (let ax = offset; ax < conv.w; ax += arrowSpacing) {
                    const arrowX = conv.x + ax;
                    const arrowY = conv.y + conv.h / 2;
                    const dir = conv.direction;
                    
                    ctx.beginPath();
                    ctx.moveTo(arrowX - 5 * dir, arrowY - 4);
                    ctx.lineTo(arrowX + 5 * dir, arrowY);
                    ctx.lineTo(arrowX - 5 * dir, arrowY + 4);
                    ctx.closePath();
                    ctx.fill();
                }
                
                ctx.restore();
            });
        }

        // --- TELEPORT PORTALLARI ÇİZ ---
        if (this.teleportPairs) {
            this.teleportPairs.forEach(tp => {
                const drawPortal = (px, py) => {
                    ctx.save();
                    const pColor = tp.color || '#a855f7';
                    ctx.shadowColor = pColor;
                    ctx.shadowBlur = 12 + Math.sin(this.time * 3) * 5;
                    
                    // Dış çerçeve
                    ctx.strokeStyle = pColor;
                    ctx.lineWidth = 3;
                    this.drawRoundedRect(ctx, px, py, 40, 60, 8);
                    ctx.stroke();
                    
                    // İç girdap efekti
                    ctx.shadowBlur = 0;
                    for (let ring = 0; ring < 3; ring++) {
                        const ringR = 12 - ring * 3;
                        const ringAlpha = 0.3 + ring * 0.15;
                        ctx.strokeStyle = `rgba(168, 85, 247, ${ringAlpha})`;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(px + 20, py + 30, ringR, this.time * 2 + ring, this.time * 2 + ring + Math.PI * 1.5);
                        ctx.stroke();
                    }
                    
                    // Merkez parıltı
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = pColor;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(px + 20, py + 30, 3, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.restore();
                };
                
                drawPortal(tp.x1, tp.y1);
                drawPortal(tp.x2, tp.y2);
            });
        }

        // --- BUTONLARI ÇİZ ---
        if (this.buttons) {
            this.buttons.forEach(button => {
                ctx.save();
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2;
                
                // Draw plate backing
                ctx.fillRect(button.x, button.y + button.h - 6, button.w, 6);
                ctx.strokeRect(button.x, button.y + button.h - 6, button.w, 6);
                
                // Draw pushable button knob
                const knobColor = button.activated ? '#10b981' : '#ef4444';
                ctx.fillStyle = knobColor;
                ctx.strokeStyle = '#ffffff';
                ctx.shadowColor = knobColor;
                ctx.shadowBlur = button.activated ? 12 : 4;
                ctx.lineWidth = 1;
                
                const knobH = button.activated ? 6 : 14;
                ctx.fillRect(button.x + button.w / 4, button.y + button.h - 6 - knobH, button.w / 2, knobH);
                ctx.strokeRect(button.x + button.w / 4, button.y + button.h - 6 - knobH, button.w / 2, knobH);
                
                ctx.restore();
            });
        }

        // --- KOLLARI (ŞALTERLERİ) ÇİZ ---
        if (this.levers) {
            this.levers.forEach(lever => {
                ctx.save();
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                
                // Draw base
                ctx.fillRect(lever.x + lever.w / 4, lever.y + lever.h - 8, lever.w / 2, 8);
                ctx.strokeRect(lever.x + lever.w / 4, lever.y + lever.h - 8, lever.w / 2, 8);
                
                // Draw lever stick
                ctx.strokeStyle = lever.activated ? '#10b981' : '#94a3b8';
                ctx.lineWidth = 4;
                ctx.shadowColor = lever.activated ? '#10b981' : 'transparent';
                ctx.shadowBlur = lever.activated ? 8 : 0;
                
                ctx.beginPath();
                const startX = lever.x + lever.w / 2;
                const startY = lever.y + lever.h - 6;
                const endX = lever.activated ? (lever.x + lever.w - 4) : (lever.x + 4);
                const endY = lever.y + 4;
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Knob at the end of stick
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(endX, endY, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            });
        }

        // --- LAZER BULMACA ELEMANLARINI ÇİZ (EMITTERS, RECEIVERS, BEAMS) ---
        // A. Lazer Işın Yollarını Çiz
        if (this.laserEmitters) {
            this.laserEmitters.forEach(emitter => {
                if (emitter.path && emitter.path.length > 1) {
                    ctx.save();
                    
                    let laserColor = '#00f0ff'; // Varsayılan mavi/turkuaz
                    if (emitter.color === 'pink') laserColor = '#d946ef';
                    else if (emitter.color === 'green') laserColor = '#10b981';
                    else if (emitter.color === 'yellow') laserColor = '#eab308';

                    ctx.shadowColor = laserColor;
                    ctx.shadowBlur = 10 + Math.random() * 8;
                    ctx.strokeStyle = laserColor;
                    ctx.lineWidth = 3 + Math.sin(this.time * 10) * 1.0;
                    ctx.beginPath();
                    ctx.moveTo(emitter.path[0].x, emitter.path[0].y);
                    for (let i = 1; i < emitter.path.length; i++) {
                        ctx.lineTo(emitter.path[i].x, emitter.path[i].y);
                    }
                    ctx.stroke();

                    // Parlak beyaz merkez hattı
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.2;
                    ctx.stroke();
                    ctx.restore();
                }
            });
        }

        // B. Lazer Vericilerini (Emitters) Çiz
        if (this.laserEmitters) {
            this.laserEmitters.forEach(emitter => {
                ctx.save();
                
                // Gövde (Metalik koyu kutu)
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.5;
                ctx.fillRect(emitter.x, emitter.y, emitter.w, emitter.h);
                ctx.strokeRect(emitter.x, emitter.y, emitter.w, emitter.h);

                // Renkli ışın üreteç çekirdeği
                let coreColor = '#00f0ff';
                if (emitter.color === 'pink') coreColor = '#d946ef';
                else if (emitter.color === 'green') coreColor = '#10b981';
                else if (emitter.color === 'yellow') coreColor = '#eab308';

                ctx.fillStyle = coreColor;
                ctx.beginPath();
                ctx.arc(emitter.x + emitter.w / 2, emitter.y + emitter.h / 2, 6, 0, Math.PI * 2);
                ctx.fill();

                // Çıkış namlusu/nozulu
                ctx.fillStyle = '#334155';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                
                const cx = emitter.x + emitter.w / 2;
                const cy = emitter.y + emitter.h / 2;
                const dir = emitter.direction;
                
                if (dir === 0) { // Sağ (Right)
                    ctx.rect(emitter.x + emitter.w - 4, cy - 4, 8, 8);
                } else if (dir === 1) { // Aşağı (Down)
                    ctx.rect(cx - 4, emitter.y + emitter.h - 4, 8, 8);
                } else if (dir === 2) { // Sol (Left)
                    ctx.rect(emitter.x - 4, cy - 4, 8, 8);
                } else if (dir === 3) { // Yukarı (Up)
                    ctx.rect(cx - 4, emitter.y - 4, 8, 8);
                }
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            });
        }

        // C. Lazer Alıcılarını (Receivers) Çiz
        if (this.laserReceivers) {
            this.laserReceivers.forEach(receiver => {
                ctx.save();

                // Panel gövdesi
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 2.5;
                ctx.fillRect(receiver.x, receiver.y, receiver.w, receiver.h);
                ctx.strokeRect(receiver.x, receiver.y, receiver.w, receiver.h);

                // Sensör hedef halkası
                const activeColor = receiver.activated ? '#10b981' : '#ef4444';
                ctx.shadowColor = activeColor;
                ctx.shadowBlur = receiver.activated ? 12 : 0;
                ctx.strokeStyle = activeColor;
                ctx.lineWidth = 2;
                
                ctx.beginPath();
                ctx.arc(receiver.x + receiver.w / 2, receiver.y + receiver.h / 2, 10, 0, Math.PI * 2);
                ctx.stroke();

                // Merkez ışık noktası
                ctx.fillStyle = activeColor;
                ctx.beginPath();
                ctx.arc(receiver.x + receiver.w / 2, receiver.y + receiver.h / 2, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            });
        }

        // D. Statik Köşe Aynalarını Çiz
        if (this.staticMirrors) {
            this.staticMirrors.forEach(mirror => {
                ctx.save();
                
                // Koyu metalik gövde
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.0;
                
                ctx.beginPath();
                const mType = mirror.mirrorType;
                if (mType === 'slash' || mType === 'top-left') {
                    // Sol-Üst Köşe (/) - Sol-Alt, Sol-Üst, Sağ-Üst
                    ctx.moveTo(mirror.x, mirror.y + mirror.h);
                    ctx.lineTo(mirror.x, mirror.y);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y);
                } else if (mType === 'backslash' || mType === 'top-right') {
                    // Sağ-Üst Köşe (\) - Sol-Üst, Sağ-Üst, Sağ-Alt
                    ctx.moveTo(mirror.x, mirror.y);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y + mirror.h);
                } else if (mType === 'bottom-left') {
                    // Sol-Alt Köşe (\) - Sol-Üst, Sol-Alt, Sağ-Alt
                    ctx.moveTo(mirror.x, mirror.y);
                    ctx.lineTo(mirror.x, mirror.y + mirror.h);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y + mirror.h);
                } else if (mType === 'bottom-right') {
                    // Sağ-Alt Köşe (/) - Sol-Alt, Sağ-Alt, Sağ-Üst
                    ctx.moveTo(mirror.x, mirror.y + mirror.h);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y + mirror.h);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Parlayan ayna yüzeyi (Neon diagonal şerit)
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 8;
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 4;
                
                ctx.beginPath();
                if (mType === 'slash' || mType === 'top-left' || mType === 'bottom-right') {
                    ctx.moveTo(mirror.x, mirror.y + mirror.h);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y);
                } else {
                    ctx.moveTo(mirror.x, mirror.y);
                    ctx.lineTo(mirror.x + mirror.w, mirror.y + mirror.h);
                }
                ctx.stroke();

                // Beyaz parlama hattı
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.2;
                ctx.stroke();

                ctx.restore();
            });
        }

        // --- EN ALTTAKİ LAVA/SIVI TABAKASI (İnce tek çizgi — bölüm ağırlıklı) ---
        {
            ctx.save();
            const lavaY = 580;
            
            // Dinamik renk belirleme (Tema bazlı)
            let surfaceColor = '#f97316';
            let glowColor = '#f97316';
            
            const themeId = (this.theme && this.theme.id) ? this.theme.id : null;
            if (themeId) {
                if (themeId === 'neon_sewer') {
                    surfaceColor = '#10b981';
                    glowColor = '#10b981';
                } else if (themeId === 'toxic_lab') {
                    surfaceColor = '#eab308';
                    glowColor = '#eab308';
                } else if (themeId === 'gravity_chasm') {
                    surfaceColor = '#d946ef';
                    glowColor = '#d946ef';
                }
            } else {
                const hasAcidPools = this.hazards && this.hazards.some(h => h.type === 'acid');
                if (hasAcidPools) {
                    surfaceColor = '#10b981';
                    glowColor = '#10b981';
                }
            }

            // Dalgalı lav/sıvı dolgusu (globalAlpha = 0.85 ile içi dolgun ve opak)
            ctx.beginPath();
            const lavaSegmentW = 30;
            const lavaSegments = Math.ceil(this.width / lavaSegmentW);
            
            // Sağ alt köşeden başla
            ctx.moveTo(this.width, this.height);
            // Sol alt köşeye git
            ctx.lineTo(0, this.height);
            
            // Dalga çizgisini takip et
            for (let i = 0; i <= lavaSegments; i++) {
                const lx = i * lavaSegmentW;
                const ly = lavaY + Math.sin(this.time * 1.5 + (i * 0.7)) * 3;
                if (i === 0) ctx.lineTo(lx, ly);
                else ctx.lineTo(lx, ly);
            }
            ctx.closePath();
            
            const fillGrad = ctx.createLinearGradient(0, lavaY, 0, this.height);
            fillGrad.addColorStop(0, surfaceColor);
            fillGrad.addColorStop(1, '#000000'); // Derine indikçe siyaha doğru söner
            
            ctx.fillStyle = fillGrad;
            ctx.globalAlpha = 0.85; // Arkadaki öğeleri kapatacak şekilde yüksek opaklık
            ctx.fill();

            // Üst kısımdaki parlak neon yüzey çizgisi
            ctx.beginPath();
            for (let i = 0; i <= lavaSegments; i++) {
                const lx = i * lavaSegmentW;
                const ly = lavaY + Math.sin(this.time * 1.5 + (i * 0.7)) * 3;
                if (i === 0) ctx.moveTo(lx, ly);
                else ctx.lineTo(lx, ly);
            }
            ctx.strokeStyle = surfaceColor;
            ctx.lineWidth = 3;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 10;
            ctx.globalAlpha = 1.0;
            ctx.stroke();

            ctx.restore();
        }

        // --- TEHLİKELERİ ÇİZ ---
        this.hazards.forEach(hazard => {
            ctx.save();

            if (hazard.type === 'spike') {
                // Dikenler (Glowing Neon Red Spikes)
                ctx.fillStyle = (this.theme && this.theme.spikeFill) ? this.theme.spikeFill : '#270c0c';
                ctx.strokeStyle = (this.theme && this.theme.spikeStroke) ? this.theme.spikeStroke : '#ef4444';
                ctx.lineWidth = 1.5;
                ctx.shadowColor = (this.theme && this.theme.spikeStroke) ? this.theme.spikeStroke : '#ef4444';
                ctx.shadowBlur = 10;

                const spikeWidth = 20;
                
                if (hazard.direction === 'down') {
                    const count = Math.ceil(hazard.w / spikeWidth);
                    for (let i = 0; i < count; i++) {
                        const sx = hazard.x + i * spikeWidth;
                        ctx.beginPath();
                        ctx.moveTo(sx, hazard.y);
                        ctx.lineTo(sx + spikeWidth / 2, hazard.y + hazard.h);
                        ctx.lineTo(sx + spikeWidth, hazard.y);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
                } else if (hazard.direction === 'left') {
                    const count = Math.ceil(hazard.h / spikeWidth);
                    for (let i = 0; i < count; i++) {
                        const sy = hazard.y + i * spikeWidth;
                        ctx.beginPath();
                        ctx.moveTo(hazard.x + hazard.w, sy);
                        ctx.lineTo(hazard.x, sy + spikeWidth / 2);
                        ctx.lineTo(hazard.x + hazard.w, sy + spikeWidth);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
                } else if (hazard.direction === 'right') {
                    const count = Math.ceil(hazard.h / spikeWidth);
                    for (let i = 0; i < count; i++) {
                        const sy = hazard.y + i * spikeWidth;
                        ctx.beginPath();
                        ctx.moveTo(hazard.x, sy);
                        ctx.lineTo(hazard.x + hazard.w, sy + spikeWidth / 2);
                        ctx.lineTo(hazard.x, sy + spikeWidth);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
                } else { // 'up' (default)
                    const count = Math.ceil(hazard.w / spikeWidth);
                    for (let i = 0; i < count; i++) {
                        const sx = hazard.x + i * spikeWidth;
                        ctx.beginPath();
                        ctx.moveTo(sx, hazard.y + hazard.h);
                        ctx.lineTo(sx + spikeWidth / 2, hazard.y);
                        ctx.lineTo(sx + spikeWidth, hazard.y + hazard.h);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    }
                }
            } else if (hazard.type === 'acid') {
                // Destek kolonları (y=600 tabanına kadar uzanan metal ayaklar)
                ctx.save();
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(hazard.x + 3, hazard.y + hazard.h);
                ctx.lineTo(hazard.x + 3, 600);
                ctx.moveTo(hazard.x + hazard.w - 3, hazard.y + hazard.h);
                ctx.lineTo(hazard.x + hazard.w - 3, 600);
                if (hazard.w > 180) {
                    ctx.moveTo(hazard.x + hazard.w / 2, hazard.y + hazard.h);
                    ctx.lineTo(hazard.x + hazard.w / 2, 600);
                }
                ctx.stroke();
                ctx.restore();

                // U-Şeklinde Metal Hazne/Kazan
                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'; // Yarı saydam tank içi metal arka plan
                ctx.fillRect(hazard.x - 3, hazard.y + 4, hazard.w + 6, hazard.h);

                ctx.strokeStyle = '#334155'; // Kalın metal kenarlık
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(hazard.x - 2.5, hazard.y);
                ctx.lineTo(hazard.x - 2.5, hazard.y + hazard.h);
                ctx.lineTo(hazard.x + hazard.w + 2.5, hazard.y + hazard.h);
                ctx.lineTo(hazard.x + hazard.w + 2.5, hazard.y);
                ctx.stroke();

                // Neon Yeşil Hazne Kenar Parlaması
                ctx.strokeStyle = (this.theme && this.theme.acidGlowColor) ? this.theme.acidGlowColor : 'rgba(16, 185, 129, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();

                // Dalgalı Asit Havuzu
                ctx.save();
                ctx.fillStyle = (this.theme && this.theme.acidColor) ? this.theme.acidColor : 'rgba(16, 185, 129, 0.8)'; // Yeşil asit
                ctx.shadowColor = (this.theme && this.theme.acidColor) ? this.theme.acidColor : 'rgba(16, 185, 129, 0.5)';
                ctx.shadowBlur = 15;

                ctx.beginPath();
                ctx.moveTo(hazard.x, hazard.y + hazard.h);
                ctx.lineTo(hazard.x, hazard.y);

                // Sinüs dalgalarıyla asit yüzeyi çiz (kenarlar sınırlandırılmış)
                const waveCount = 12;
                const step = hazard.w / waveCount;
                for (let i = 0; i <= waveCount; i++) {
                    const wx = hazard.x + i * step;
                    let wy = hazard.y + 6 + Math.sin(this.time + (i * 0.8)) * 4;
                    if (i === 0 || i === waveCount) {
                        wy = hazard.y + 8; // Edge clamping
                    }
                    ctx.lineTo(wx, wy);
                }

                ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
                ctx.closePath();
                ctx.fill();

                // Kabarcıklar (Asit içindeki baloncuklar)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.shadowBlur = 0;
                for (let b = 0; b < 6; b++) {
                    const bx = hazard.x + ((this.time * 20 + b * 70) % hazard.w);
                    const by = hazard.y + hazard.h - 10 - ((this.time * 15 + b * 20) % (hazard.h - 10));
                    ctx.beginPath();
                    ctx.arc(bx, by, 2 + (b % 3), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }

            ctx.restore();
        });

        // --- ZIPLATMA PEDLERİNİ ÇİZ ---
        this.bouncePads.forEach(pad => {
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#eab308'; // Sarı glow

            // Alt yay şasesi
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(pad.x, pad.y + pad.h);
            ctx.lineTo(pad.x + pad.w, pad.y + pad.h);
            ctx.stroke();

            // Jel sıçrama tablası
            const animOffset = pad.active ? Math.sin(pad.timer * Math.PI) * 8 : 0;
            ctx.fillStyle = '#eab308'; // Canlı sarı pad
            this.drawRoundedRect(ctx, pad.x, pad.y + animOffset, pad.w, pad.h - animOffset, 4);
            ctx.fill();

            ctx.restore();
        });

        // --- BİTİŞ PORTALINI ÇİZ ---
        const isBossActive = game && (game.currentLevel === 10 || game.currentLevel === 20) && game.boss && !game.boss.isDead;
        if (!isBossActive) {
            ctx.save();
            const p = this.portal;
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
            ctx.rotate(p.angle);

            // Neon ışıma
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 20;

            // Portalı iç içe geçmiş elipslerle çiz (Vortex efekti)
            for (let i = 0; i < 4; i++) {
                ctx.strokeStyle = i % 2 === 0 ? '#06b6d4' : '#d946ef';
                ctx.lineWidth = 3 - i * 0.5;
                ctx.beginPath();
                ctx.ellipse(0, 0, (p.w / 2) - i * 6, (p.h / 2) - i * 8, (i * Math.PI) / 6, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Merkez çekirdeği
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore(); // Portal çizim bağlamını kapat
        }

        // --- DÜŞEN ZEMİNLERİ ÇİZ (FALLING PLATFORMS) ---
        if (this.fallingPlatforms) {
            this.fallingPlatforms.forEach(plat => {
                if (plat.fallen) return;
                ctx.save();
                
                // Determine colors based on trigger/countdown state
                let strokeColor = '#f59e0b';
                let glowColor = 'rgba(245, 158, 11, 0.4)';
                if (plat.triggered && plat.timer > 0) {
                    const rate = plat.timer < 10 ? 25 : (plat.timer < 20 ? 15 : 8);
                    const flash = Math.floor(this.time * rate) % 2 === 0;
                    strokeColor = flash ? '#ef4444' : '#f59e0b';
                    glowColor = flash ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.5)';
                }
                
                ctx.shadowBlur = 8;
                ctx.shadowColor = glowColor;
                
                // 3D metallic dark-indigo gradient
                const platGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
                platGrad.addColorStop(0, '#1e1b4b');
                platGrad.addColorStop(0.5, '#0f0e26');
                platGrad.addColorStop(1, '#050410');
                ctx.fillStyle = platGrad;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2.5;

                const shakeX = (plat.triggered && plat.timer > 0) ? (Math.random() - 0.5) * 3.5 : 0;
                const shakeY = (plat.triggered && plat.timer > 0) ? (Math.random() - 0.5) * 3.5 : 0;

                // Draw side metal anchor brackets
                ctx.save();
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#475569';
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 1;
                // Left bracket
                ctx.fillRect(plat.x + shakeX - 4, plat.y + shakeY + plat.h/2 - 6, 4, 12);
                ctx.strokeRect(plat.x + shakeX - 4, plat.y + shakeY + plat.h/2 - 6, 4, 12);
                // Right bracket
                ctx.fillRect(plat.x + shakeX + plat.w, plat.y + shakeY + plat.h/2 - 6, 4, 12);
                ctx.strokeRect(plat.x + shakeX + plat.w, plat.y + shakeY + plat.h/2 - 6, 4, 12);
                
                // Spark effects near brackets when triggered
                if (plat.triggered && plat.timer > 0 && Math.random() < 0.4) {
                    const sx = Math.random() < 0.5 ? plat.x + shakeX : plat.x + shakeX + plat.w;
                    const sy = plat.y + shakeY + Math.random() * plat.h;
                    ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#f59e0b';
                    ctx.fillRect(sx + (Math.random()-0.5)*12, sy + (Math.random()-0.5)*12, 2.5, 2.5);
                }
                ctx.restore();

                // Draw main body
                this.drawRoundedRect(ctx, plat.x + shakeX, plat.y + shakeY, plat.w, plat.h, 4);
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fill();
                ctx.restore();
                ctx.stroke();

                // Draw animated scrolling caution stripes inside
                ctx.save();
                ctx.shadowBlur = 0;
                ctx.beginPath();
                this.drawRoundedRect(ctx, plat.x + shakeX, plat.y + shakeY, plat.w, plat.h, 4);
                ctx.clip();
                ctx.strokeStyle = plat.triggered ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.25)';
                ctx.lineWidth = 4;
                
                // Animate offset when triggered
                const scrollOffset = plat.triggered ? (this.time * 60) % 15 : 0;
                for (let ox = -20 - scrollOffset; ox < plat.w + 20; ox += 15) {
                    ctx.beginPath();
                    ctx.moveTo(plat.x + shakeX + ox, plat.y + shakeY);
                    ctx.lineTo(plat.x + shakeX + ox + 10, plat.y + shakeY + plat.h);
                    ctx.stroke();
                }
                ctx.restore();
                ctx.restore();
            });
        }

        // --- KIRILABİLİR ZEMİNLERİ ÇİZ (BREAKABLE PLATFORMS) ---
        if (this.breakablePlatforms) {
            this.breakablePlatforms.forEach(plat => {
                if (plat.broken) return;
                ctx.save();
                
                const isTriggered = plat.triggered && plat.timer > 0;
                
                // Color flashing and glowing values
                let strokeColor = '#38bdf8'; // Default sky blue
                let glowColor = 'rgba(56, 189, 248, 0.4)';
                let fillGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
                
                if (isTriggered) {
                    const rate = plat.timer < 5 ? 35 : (plat.timer < 12 ? 20 : 10);
                    const flash = Math.floor(this.time * rate) % 2 === 0;
                    strokeColor = flash ? '#ef4444' : '#f97316'; // Flash red/orange warning
                    glowColor = flash ? 'rgba(239, 68, 68, 0.6)' : 'rgba(249, 115, 22, 0.5)';
                    
                    fillGrad.addColorStop(0, 'rgba(127, 29, 29, 0.75)'); // Alert red glass
                    fillGrad.addColorStop(1, 'rgba(69, 10, 10, 0.9)');
                } else {
                    fillGrad.addColorStop(0, 'rgba(8, 51, 68, 0.7)'); // Cyber cyan glass
                    fillGrad.addColorStop(1, 'rgba(8, 47, 73, 0.9)');
                }
                
                ctx.shadowBlur = 8;
                ctx.shadowColor = glowColor;
                ctx.fillStyle = fillGrad;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2.5;

                const shakeX = isTriggered ? (Math.random() - 0.5) * 3 : 0;
                const shakeY = isTriggered ? (Math.random() - 0.5) * 3 : 0;

                this.drawRoundedRect(ctx, plat.x + shakeX, plat.y + shakeY, plat.w, plat.h, 4);
                ctx.fill();
                ctx.stroke();

                // Draw high-tech corner brackets
                ctx.save();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2;
                const bracketSize = 6;
                const drawCornerBracket = (cx, cy, dx, dy) => {
                    ctx.beginPath();
                    ctx.moveTo(cx + dx * bracketSize, cy);
                    ctx.lineTo(cx, cy);
                    ctx.lineTo(cx, cy + dy * bracketSize);
                    ctx.stroke();
                };
                drawCornerBracket(plat.x + shakeX + 3, plat.y + shakeY + 3, 1, 1); // Top-left
                drawCornerBracket(plat.x + shakeX + plat.w - 3, plat.y + shakeY + 3, -1, 1); // Top-right
                drawCornerBracket(plat.x + shakeX + 3, plat.y + shakeY + plat.h - 3, 1, -1); // Bottom-left
                drawCornerBracket(plat.x + shakeX + plat.w - 3, plat.y + shakeY + plat.h - 3, -1, -1); // Bottom-right
                ctx.restore();

                // Draw procedural branching cracks that grow based on the countdown progress
                ctx.save();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = isTriggered ? 'rgba(239, 68, 68, 0.8)' : 'rgba(56, 189, 248, 0.55)';
                ctx.lineWidth = 1.5;
                
                let seed = (plat.x * 23 + plat.y * 7) % 100;
                const prng = () => {
                    let x = Math.sin(seed++) * 10000;
                    return x - Math.floor(x);
                };
                
                const maxTimer = 18;
                const progress = isTriggered ? Math.max(0.1, Math.min(1.0, (maxTimer - plat.timer) / maxTimer)) : 0.15;
                const rootsCount = 3 + Math.floor(prng() * 2);
                
                for (let r = 0; r < rootsCount; r++) {
                    let curX = plat.x + plat.w / 2;
                    let curY = plat.y + plat.h / 2;
                    let angle = (r / rootsCount) * Math.PI * 2 + (prng() - 0.5) * 0.4;
                    
                    const maxSegments = 4;
                    const visibleSegments = Math.ceil(progress * maxSegments);
                    
                    ctx.beginPath();
                    ctx.moveTo(curX + shakeX, curY + shakeY);
                    for (let s = 0; s < visibleSegments; s++) {
                        const length = 5 + prng() * 9;
                        curX += Math.cos(angle) * length;
                        curY += Math.sin(angle) * length;
                        
                        const margin = 4;
                        if (curX > plat.x + margin && curX < plat.x + plat.w - margin &&
                            curY > plat.y + margin && curY < plat.y + plat.h - margin) {
                            ctx.lineTo(curX + shakeX, curY + shakeY);
                        }
                        angle += (prng() - 0.5) * 0.7;
                    }
                    ctx.stroke();
                }
                ctx.restore();

                ctx.restore();
            });
        }

        // --- GİZLİ GEÇİTLERİ ÇİZ (HIDDEN PASSAGES) ---
        if (this.hiddenPassages) {
            this.hiddenPassages.forEach(p => {
                ctx.save();
                const isEditor = game && game.state === 'EDITOR';
                if (isEditor) {
                    ctx.fillStyle = '#111118';
                    ctx.strokeStyle = '#374151';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.45; // semi-transparent so developers/players can realize it's a passage
                    this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, 6);
                    ctx.fill();
                    ctx.stroke();

                    // Dotted warning line inside
                    ctx.setLineDash([4, 4]);
                    ctx.strokeStyle = '#94a3b8';
                    ctx.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
                } else {
                    // Draw as a normal solid platform so it is hidden!
                    const platformFill = (this.theme && this.theme.platformColor) ? this.theme.platformColor : '#111118';
                    const platformStroke = (this.theme && this.theme.platformStroke) ? this.theme.platformStroke : '#1f2937';
                    const platGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
                    platGrad.addColorStop(0, platformFill);
                    platGrad.addColorStop(1, '#050508');
                    
                    ctx.fillStyle = platGrad;
                    ctx.strokeStyle = platformStroke;
                    ctx.lineWidth = 2;
                    const cornerRadius = Math.min(6, p.w / 2, p.h / 2);
                    this.drawRoundedRect(ctx, p.x, p.y, p.w, p.h, cornerRadius);
                    ctx.save();
                    ctx.globalAlpha = 0.25;
                    ctx.fill();
                    ctx.restore();
                    ctx.stroke();
                }
                ctx.restore();
            });
        }

        // --- DÜŞEN BLOK TUZAĞI ÇİZ (FALLING BLOCK TRAPS) ---
        if (this.fallingBlockTraps) {
            this.fallingBlockTraps.forEach(trap => {
                ctx.save();
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ef4444'; // Red alarm glow

                // Metallic body
                const grad = ctx.createLinearGradient(trap.x, trap.y, trap.x, trap.y + trap.h);
                grad.addColorStop(0, '#4b5563');
                grad.addColorStop(0.5, '#1f2937');
                grad.addColorStop(1, '#111827');
                ctx.fillStyle = grad;
                ctx.strokeStyle = '#ef4444'; // Red borders
                ctx.lineWidth = 2.5;

                this.drawRoundedRect(ctx, trap.x, trap.y, trap.w, trap.h, 8);
                ctx.fill();
                ctx.stroke();

                // Red glowing center eye
                ctx.fillStyle = trap.state === 'falling' ? '#ff0000' : '#b91c1c';
                ctx.shadowBlur = trap.state === 'falling' ? 18 : 6;
                ctx.beginPath();
                ctx.arc(trap.x + trap.w / 2, trap.y + trap.h / 2, 8, 0, Math.PI * 2);
                ctx.fill();

                // Spikes on the bottom
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 1.5;
                const numSpikes = 3;
                const spikeW = trap.w / numSpikes;
                for (let i = 0; i < numSpikes; i++) {
                    const sx = trap.x + i * spikeW;
                    ctx.beginPath();
                    ctx.moveTo(sx, trap.y + trap.h);
                    ctx.lineTo(sx + spikeW / 2, trap.y + trap.h + 10);
                    ctx.lineTo(sx + spikeW, trap.y + trap.h);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }

                ctx.restore();
            });
        }

        // --- VANTUZ NOKTALARI ÇİZ (VANTUZ POINTS) ---
        if (this.vantuzPoints) {
            this.vantuzPoints.forEach(v => {
                ctx.save();
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#d946ef'; // Pink glow

                // Outer dotted guide ring
                ctx.strokeStyle = 'rgba(217, 70, 239, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(v.x, v.y, 22, 0, Math.PI * 2);
                ctx.stroke();

                // Central node
                ctx.setLineDash([]);
                ctx.fillStyle = '#2e1035';
                ctx.strokeStyle = '#d946ef';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(v.x, v.y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Center light
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(v.x, v.y, 3, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            });
        }

        // --- DEKORASYON OBJELERİNİ ÇİZ ---
        if (this.decorations) {
            this.decorations.forEach(d => {
                ctx.save();
                
                // Rotasyon Matrix Uygulaması
                if (d.rotation) {
                    ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
                    ctx.rotate(d.rotation);
                    ctx.translate(-(d.x + d.w / 2), -(d.y + d.h / 2));
                }
                
                if (d.type === 'neon_light' || d.type === 'neon') {
                    // Vertical neon tube
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = '#38bdf8';
                    ctx.lineWidth = 2;
                    ctx.fillRect(d.x + d.w / 2 - 4, d.y, 8, d.h);
                    ctx.strokeRect(d.x + d.w / 2 - 4, d.y, 8, d.h);

                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
                    ctx.shadowColor = '#38bdf8';
                    ctx.shadowBlur = 15;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(d.x + d.w / 2, d.y + 4);
                    ctx.lineTo(d.x + d.w / 2, d.y + d.h - 4);
                    ctx.stroke();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                } else if (d.type === 'box') {
                    // Static wooden box design
                    ctx.fillStyle = '#3f220f';
                    ctx.strokeStyle = '#7c2d12';
                    ctx.lineWidth = 2;
                    ctx.fillRect(d.x, d.y, d.w, d.h);
                    ctx.strokeRect(d.x, d.y, d.w, d.h);

                    // Wooden panels details
                    ctx.strokeStyle = 'rgba(124, 45, 18, 0.4)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(d.x + 4, d.y + 4, d.w - 8, d.h - 8);
                    ctx.beginPath();
                    ctx.moveTo(d.x + 4, d.y + 4);
                    ctx.lineTo(d.x + d.w - 4, d.y + d.h - 4);
                    ctx.moveTo(d.x + d.w - 4, d.y + 4);
                    ctx.lineTo(d.x + 4, d.y + d.h - 4);
                    ctx.stroke();
                } else if (d.type === 'pipe') {
                    // Metal pipe drawing
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 2.5;
                    // Horizontal pipe by default
                    ctx.fillRect(d.x, d.y + d.h / 2 - 6, d.w, 12);
                    ctx.strokeRect(d.x, d.y + d.h / 2 - 6, d.w, 12);
                    // Connection joint flange
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(d.x + 4, d.y + d.h / 2 - 10, 8, 20);
                    ctx.strokeRect(d.x + 4, d.y + d.h / 2 - 10, 8, 20);
                } else if (d.type === 'cable') {
                    // Hanging thick cable wire
                    ctx.strokeStyle = '#0f172a';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.quadraticCurveTo(d.x + d.w / 2, d.y + d.h + 10, d.x + d.w, d.y);
                    ctx.stroke();
                } else if (d.type === 'pano') {
                    // Tech background console screen
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = 2;
                    ctx.fillRect(d.x, d.y, d.w, d.h);
                    ctx.strokeRect(d.x, d.y, d.w, d.h);

                    // Screen lines
                    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
                    ctx.fillRect(d.x + 3, d.y + 3, d.w - 6, d.h - 6);

                    // Sine waves/grid details
                    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (let lx = 4; lx < d.w - 4; lx += 2) {
                        const ly = d.y + d.h / 2 + Math.sin(this.time * 2 + lx * 0.2) * 5;
                        if (lx === 4) ctx.moveTo(d.x + lx, ly);
                        else ctx.lineTo(d.x + lx, ly);
                    }
                    ctx.stroke();
                } else if (d.type === 'fan') {
                    // Rotating industrial ventilation fan
                    const cx = d.x + d.w / 2;
                    const cy = d.y + d.h / 2;
                    const r = Math.max(2, d.w / 2 - 4);

                    // Outer circular housing frame
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.stroke();

                    // Fan blades rotating
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(d.rotation || 0);
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = '#64748b';
                    ctx.lineWidth = 1.5;
                    for (let b = 0; b < 4; b++) {
                        ctx.rotate(Math.PI / 2);
                        ctx.beginPath();
                        ctx.ellipse(0, -r / 2, 4, Math.max(1, r / 2), 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                    ctx.restore();
                } else if (d.type === 'warning_light' || d.type === 'warning') {
                    // Blinking alarm hazard warning light
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 2;
                    // base
                    ctx.fillRect(d.x + d.w / 4, d.y + d.h - 8, d.w / 2, 8);
                    ctx.strokeRect(d.x + d.w / 4, d.y + d.h - 8, d.w / 2, 8);

                    // glass cover
                    const intensity = 0.5 + Math.sin(d.state || 0) * 0.5;
                    ctx.fillStyle = `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`;
                    ctx.strokeStyle = '#ef4444';
                    ctx.lineWidth = 1.5;
                    ctx.shadowColor = '#ef4444';
                    ctx.shadowBlur = intensity * 15;

                    ctx.beginPath();
                    ctx.arc(d.x + d.w / 2, d.y + d.h - 8, 8, Math.PI, 0, false);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else if (d.type === 'steam') {
                    // Simple steam nozzle base decoration
                    ctx.fillStyle = '#334155';
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineWidth = 2;
                    ctx.fillRect(d.x + d.w / 2 - 6, d.y + d.h - 8, 12, 8);
                    ctx.strokeRect(d.x + d.w / 2 - 6, d.y + d.h - 8, 12, 8);
                } else if (d.type === 'pillar') {
                    // Futuristic Pillar
                    ctx.save();
                    // Column gradient body
                    const colGrad = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y);
                    colGrad.addColorStop(0, '#0f172a');
                    colGrad.addColorStop(0.3, '#1e293b');
                    colGrad.addColorStop(0.7, '#334155');
                    colGrad.addColorStop(1, '#0f172a');
                    ctx.fillStyle = colGrad;
                    ctx.strokeStyle = '#475569';
                    ctx.lineWidth = 2;
                    
                    this.drawRoundedRect(ctx, d.x, d.y, d.w, d.h, 4);
                    ctx.fill();
                    ctx.stroke();

                    // Neon strips in the middle
                    ctx.strokeStyle = '#d946ef'; // Fuchsia neon
                    ctx.shadowColor = '#d946ef';
                    ctx.shadowBlur = 8;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(d.x + d.w / 2, d.y + 10);
                    ctx.lineTo(d.x + d.w / 2, d.y + d.h - 10);
                    ctx.stroke();

                    // Subtle horizontal tech panels
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 1;
                    for (let py = d.y + 20; py < d.y + d.h - 10; py += 30) {
                        ctx.beginPath();
                        ctx.moveTo(d.x + 2, py);
                        ctx.lineTo(d.x + d.w - 2, py);
                        ctx.stroke();
                    }
                    ctx.restore();
                } else if (d.type === 'gear') {
                    // Rotating Gear
                    ctx.save();
                    const cx = d.x + d.w / 2;
                    const cy = d.y + d.h / 2;
                    const r = Math.max(2, d.w / 2 - 2);

                    ctx.translate(cx, cy);
                    ctx.rotate(d.rotation || 0);

                    // Draw gear teeth
                    ctx.fillStyle = '#334155';
                    ctx.strokeStyle = '#06b6d4'; // Cyan neon outlines
                    ctx.lineWidth = 1.5;
                    ctx.shadowColor = '#06b6d4';
                    ctx.shadowBlur = 4;

                    const numTeeth = 8;
                    for (let i = 0; i < numTeeth; i++) {
                        ctx.rotate((Math.PI * 2) / numTeeth);
                        ctx.fillRect(-6, -r - 4, 12, 6);
                        ctx.strokeRect(-6, -r - 4, 12, 6);
                    }

                    // Main gear wheel body
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Central hole and spokes
                    ctx.fillStyle = '#0f172a';
                    ctx.beginPath();
                    ctx.arc(0, 0, Math.max(1, r - 6), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Spikes/spokes
                    ctx.strokeStyle = '#06b6d4';
                    ctx.lineWidth = 3;
                    for (let i = 0; i < 4; i++) {
                        ctx.rotate(Math.PI / 2);
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(0, -r + 2);
                        ctx.stroke();
                    }

                    // Inner hub center
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(0, 0, 4, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.restore();
                } else if (d.type === 'window_space') {
                    // Cyber Space Window
                    ctx.save();
                    // Border Frame
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = '#06b6d4'; // Cyan glowing frame
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#06b6d4';
                    ctx.shadowBlur = 10;
                    this.drawRoundedRect(ctx, d.x, d.y, d.w, d.h, 6);
                    ctx.fill();
                    ctx.stroke();

                    // Inner window screen space
                    ctx.shadowBlur = 0;
                    ctx.save();
                    ctx.beginPath();
                    this.drawRoundedRect(ctx, d.x + 4, d.y + 4, Math.max(1, d.w - 8), Math.max(1, d.h - 8), 4);
                    ctx.clip();

                    // Window space background (Deep cosmos purple)
                    const rEnd = Math.max(2, d.w / 2);
                    const spaceGrad = ctx.createRadialGradient(d.x + d.w / 2, d.y + d.h / 2, 5, d.x + d.w / 2, d.y + d.h / 2, rEnd);
                    spaceGrad.addColorStop(0, '#1e1b4b');
                    spaceGrad.addColorStop(1, '#020617');
                    ctx.fillStyle = spaceGrad;
                    ctx.fillRect(d.x, d.y, d.w, d.h);

                    // Digital hologram grids sliding down
                    ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
                    ctx.lineWidth = 1;
                    const gridOffset = (this.time * 20) % 20;
                    for (let gx = d.x; gx < d.x + d.w; gx += 20) {
                        ctx.beginPath();
                        ctx.moveTo(gx, d.y);
                        ctx.lineTo(gx, d.y + d.h);
                        ctx.stroke();
                    }
                    for (let gy = d.y + gridOffset; gy < d.y + d.h; gy += 20) {
                        ctx.beginPath();
                        ctx.moveTo(d.x, gy);
                        ctx.lineTo(d.x + d.w, gy);
                        ctx.stroke();
                    }

                    // Cyber Star dots
                    ctx.fillStyle = '#ffffff';
                    const moduloW = Math.max(1, d.w - 16);
                    const moduloH = Math.max(1, d.h - 16);
                    for (let i = 0; i < 4; i++) {
                        const sx = d.x + 8 + ((i * 17 + Math.floor(this.time * 0.1)) % moduloW);
                        const sy = d.y + 8 + ((i * 23) % moduloH);
                        const size = 1 + (Math.sin(this.time * 3 + i) * 0.5 + 0.5) * 1.5;
                        ctx.beginPath();
                        ctx.arc(sx, sy, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                    ctx.restore();
                } else if (d.type === 'server_rack') {
                    // Server Console / Cabinet Rack
                    ctx.save();
                    // Rack chassis
                    const rackGrad = ctx.createLinearGradient(d.x, d.y, d.x + d.w, d.y);
                    rackGrad.addColorStop(0, '#1e293b');
                    rackGrad.addColorStop(0.5, '#0f172a');
                    rackGrad.addColorStop(1, '#1e293b');
                    ctx.fillStyle = rackGrad;
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = 2;
                    this.drawRoundedRect(ctx, d.x, d.y, d.w, d.h, 4);
                    ctx.fill();
                    ctx.stroke();

                    // Server bays/slots inside
                    ctx.fillStyle = '#020617';
                    const numBays = 5;
                    const bayH = (d.h - 12) / numBays;
                    for (let i = 0; i < numBays; i++) {
                        const bx = d.x + 4;
                        const by = d.y + 6 + i * bayH + 1;
                        const bw = d.w - 8;
                        const bh = bayH - 2;
                        ctx.fillRect(bx, by, bw, bh);

                        // Heat vents slots on server face
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(bx + 4, by + bh / 2);
                        ctx.lineTo(bx + bw - 15, by + bh / 2);
                        ctx.stroke();

                        // Blinking color LED lights
                        const led1Active = Math.sin(this.time * 8 + i * 2) > 0;
                        const led2Active = Math.sin(this.time * 5 + i * 3) > -0.3;
                        
                        // LED 1: Cyan/Blue
                        ctx.fillStyle = led1Active ? '#06b6d4' : '#083344';
                        ctx.beginPath();
                        ctx.arc(bx + bw - 10, by + bh / 2, 2, 0, Math.PI * 2);
                        ctx.fill();

                        // LED 2: Green or Pink
                        const led2Color = i % 2 === 0 ? '#10b981' : '#d946ef';
                        const led2ColorOff = i % 2 === 0 ? '#064e3b' : '#4a044e';
                        ctx.fillStyle = led2Active ? led2Color : led2ColorOff;
                        ctx.beginPath();
                        ctx.arc(bx + bw - 4, by + bh / 2, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                } else if (d.type === 'textbox') {
                    // Glassmorphic Info Text Panel
                    ctx.save();
                    
                    const boxColor = d.color || '#06b6d4';
                    
                    // Dark glassmorphic background
                    ctx.fillStyle = 'rgba(11, 15, 25, 0.78)';
                    ctx.strokeStyle = boxColor;
                    ctx.lineWidth = 2.5;
                    ctx.shadowColor = boxColor;
                    ctx.shadowBlur = 10;
                    
                    // Draw panel body
                    this.drawRoundedRect(ctx, d.x, d.y, d.w, d.h, 8);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Draw text inside
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                    ctx.fillStyle = '#f1f5f9';
                    ctx.font = "bold 14px 'Outfit', sans-serif";
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    
                    const padding = 12;
                    const text = d.text || 'Yeni Bilgi Kutusu';
                    const lineHeight = 20;
                    const maxWidth = Math.max(10, d.w - padding * 2);
                    
                    // Wrapped text rendering helper
                    const words = text.split(' ');
                    let line = '';
                    let currentY = d.y + padding;
                    
                    for (let n = 0; n < words.length; n++) {
                        let testLine = line + words[n] + ' ';
                        let metrics = ctx.measureText(testLine);
                        let testWidth = metrics.width;
                        if (testWidth > maxWidth && n > 0) {
                            ctx.fillText(line.trim(), d.x + padding, currentY);
                            line = words[n] + ' ';
                            currentY += lineHeight;
                        } else {
                            line = testLine;
                        }
                    }
                    ctx.fillText(line.trim(), d.x + padding, currentY);
                    
                    ctx.restore();
                }
                ctx.restore();
            });
        }

        // --- CHECKPOINTS'I ÇİZ ---
        if (this.checkpoints && game && game.difficulty === 'easy') {
            this.checkpoints.forEach(cp => {
                ctx.save();
                
                ctx.shadowBlur = cp.activated ? 15 : 6;
                ctx.shadowColor = cp.activated ? '#10b981' : '#475569';
                
                ctx.strokeStyle = cp.activated ? '#10b981' : 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = cp.activated ? 3 : 1.5;
                if (!cp.activated) {
                    ctx.setLineDash([4, 2]);
                }
                ctx.beginPath();
                ctx.arc(cp.x, cp.y, cp.r, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.setLineDash([]);
                ctx.fillStyle = cp.activated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)';
                ctx.beginPath();
                ctx.arc(cp.x, cp.y, cp.r - 3, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = cp.activated ? '#10b981' : '#64748b';
                ctx.beginPath();
                ctx.arc(cp.x, cp.y, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = cp.activated ? '#10b981' : '#64748b';
                ctx.font = "bold 9px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(cp.activated ? "CHECKPOINT ACTIVE" : "CHECKPOINT", cp.x, cp.y - cp.r - 6);
                
                ctx.restore();
            });
        }

        // --- DRAW WAVY BOTTOM RIVER ---
        if (this.theme && this.theme.bottomRiverColors) {
            const riverColors = this.theme.bottomRiverColors;
            const shadowColor = this.theme.bottomRiverShadow;
            const startX = Math.max(0, camera.x - 50);
            const endX = Math.min(this.width, camera.x + viewW + 50);
            const numLayers = Math.min(3, riverColors.length);
            const baseHeight = this.height - 25; // River surface baseline
            
            for (let layer = 0; layer < numLayers; layer++) {
                ctx.save();
                
                // Color and glow settings
                ctx.fillStyle = riverColors[layer];
                if (layer === 0 && shadowColor) {
                    ctx.shadowColor = shadowColor;
                    ctx.shadowBlur = 15;
                } else {
                    ctx.shadowBlur = 0;
                }
                
                // Wave parameters
                const waveFreq = 0.015 - layer * 0.003;
                const waveAmp = 6 + layer * 3;
                const speed = 1.5 + layer * 0.8;
                
                ctx.beginPath();
                // Start at bottom-left of viewport
                ctx.moveTo(startX, this.height + 200);
                
                // Draw wavy top surface
                for (let x = startX; x <= endX; x += 15) {
                    const y = baseHeight + Math.sin(x * waveFreq + this.time * speed) * waveAmp;
                    ctx.lineTo(x, y);
                }
                
                // Close path at bottom-right of viewport
                ctx.lineTo(endX, this.height + 200);
                ctx.closePath();
                ctx.fill();
                
                ctx.restore();
            }
        }

        ctx.restore();
    }

    /**
     * Resets the level's interactive components to their initial editor state
     */
    resetLevelRuntimeState() {
        this.time = 0;
        
        if (this.movingPlatforms) {
            this.movingPlatforms.forEach(mp => {
                mp.x = mp.startX !== undefined ? mp.startX : mp.x;
                mp.y = mp.startY !== undefined ? mp.startY : mp.y;
                mp.progress = 0;
                mp.dir = 1;
                mp.prevX = mp.x;
                mp.prevY = mp.y;
            });
        }

        if (this.gates) {
            this.gates.forEach(gate => {
                gate.disabled = false;
            });
        }

        if (this.flamethrowers) {
            this.flamethrowers.forEach(f => {
                f.x = f.startX !== undefined ? f.startX : f.x;
                f.y = f.startY !== undefined ? f.startY : f.y;
                f.progress = 0;
                f.moveDir = 1;
                f.disabled = false;
                f.active = true;
                f.currentLength = 0;
            });
        }

        if (this.arrowShooters) {
            this.arrowShooters.forEach(a => {
                a.fireTimer = 0;
                a.arrows = [];
            });
        }

        if (this.collectibles) {
            this.collectibles.forEach(c => {
                c.collected = false;
            });
        }

        if (this.pressurePlates) {
            this.pressurePlates.forEach(plate => {
                plate.activated = false;
            });
        }

        if (this.pushBlocks) {
            this.pushBlocks.forEach(block => {
                block.x = block.startX !== undefined ? block.startX : block.x;
                block.y = block.startY !== undefined ? block.startY : block.y;
                block.vx = 0;
                block.vy = 0;
                block.onGround = false;
                block.broken = false;
                block.respawnTimer = 0;
            });
        }

        if (this.teleportPairs) {
            this.teleportPairs.forEach(tp => {
                tp.cooldown = 0;
            });
        }

        if (this.bouncePads) {
            this.bouncePads.forEach(pad => {
                pad.active = false;
                pad.timer = 0;
            });
        }

        if (this.buttons) {
            this.buttons.forEach(button => {
                button.activated = false;
                button.timer = 0;
            });
        }

        if (this.levers) {
            this.levers.forEach(lever => {
                lever.activated = false;
                lever.cooldown = 0;
            });
        }

        if (this.fallingPlatforms) {
            this.fallingPlatforms.forEach(plat => {
                plat.x = plat.startX !== undefined ? plat.startX : plat.x;
                plat.y = plat.startY !== undefined ? plat.startY : plat.y;
                plat.timer = 0;
                plat.triggered = false;
                plat.vy = 0;
                plat.fallen = false;
            });
        }

        if (this.breakablePlatforms) {
            this.breakablePlatforms.forEach(plat => {
                plat.broken = false;
                plat.timer = 0;
                plat.triggered = false;
            });
        }

        if (this.fallingBlockTraps) {
            this.fallingBlockTraps.forEach(trap => {
                trap.x = trap.startX !== undefined ? trap.startX : trap.x;
                trap.y = trap.startY !== undefined ? trap.startY : trap.y;
                trap.state = 'idle';
                trap.vy = 0;
                trap.timer = 0;
            });
        }

        if (this.vantuzPoints) {
            this.vantuzPoints.forEach(vp => {
                vp.cooldown = 0;
            });
        }

        if (this.decorations) {
            this.decorations.forEach(d => {
                if (d.startRotation === undefined) {
                    d.startRotation = d.rotation || 0;
                }
                d.rotation = d.startRotation;
                d.state = 0;
            });
        }

        // En yüksek platformu veya interaktif objeyi (itilebilir bloklar, düşen tuzaklar, lazer kapılar vb.) bul ve tavan sınırını onun yukarısına sabitle
        let minY = this.height || 600;
        const allInteractiveObjects = [
            ...(this.platforms || []),
            ...(this.movingPlatforms || []),
            ...(this.breakablePlatforms || []),
            ...(this.fallingPlatforms || []),
            ...(this.pushBlocks || []),
            ...(this.fallingBlockTraps || []),
            ...(this.gates || [])
        ];
        allInteractiveObjects.forEach(p => {
            let py = p.y !== undefined ? p.y : (p.startY !== undefined ? p.startY : p.y);
            if (py !== undefined && py < minY) {
                minY = py;
            }
        });
        this.ceilingY = Math.min(-95, minY - 115);
    }

    /**
     * Yuvarlatılmış Köşeli Dikdörtgen Çizim Yardımcısı
     */
    /**
     * Ok Fırlatıcıları Çizer (level.js draw loop'undan çağrılır)
     */
    drawArrowShooters(ctx, time, player = null) {
        if (!this.arrowShooters || this.arrowShooters.length === 0) return;

        this.arrowShooters.forEach(shooter => {
            const cx = shooter.x + shooter.w / 2;
            const cy = shooter.y + shooter.h / 2;

            // --- GÖVDE ÇİZİMİ ---
            ctx.save();
            ctx.translate(cx, cy);

            // Yön döndürme
            if (shooter.dir === 'left')  ctx.rotate(Math.PI);
            else if (shooter.dir === 'up')    ctx.rotate(-Math.PI / 2);
            else if (shooter.dir === 'down')  ctx.rotate(Math.PI / 2);
            else if (shooter.dir === 'target') {
                let angle = 0;
                if (player) {
                    const dx = player.x - cx;
                    const dy = player.y - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= shooter.detectionRadius) {
                        angle = Math.atan2(dy, dx);
                        shooter.lastTargetAngle = angle;
                    } else if (shooter.lastTargetAngle !== undefined) {
                        angle = shooter.lastTargetAngle;
                    }
                }
                ctx.rotate(angle);
            }

            const r = shooter.w / 2;

            // Taş zemin (arka panel)
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-r, -r, r * 2, r * 2, 6);
            ctx.fill();
            ctx.stroke();

            // Dış altın halka
            const pulse = Math.sin(time * 4) * 0.5 + 0.5;
            const grad = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r * 0.95);
            grad.addColorStop(0, `rgba(200, 150, 60, ${0.7 + pulse * 0.3})`);
            grad.addColorStop(0.6, `rgba(180, 120, 30, 0.9)`);
            grad.addColorStop(1, `rgba(100, 70, 10, 0.4)`);
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // İç taş ring
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(218, 165, 32, ${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Mavi kristal merkez
            const crystalGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.38);
            crystalGrad.addColorStop(0, '#7dd3fc');
            crystalGrad.addColorStop(0.5, '#0ea5e9');
            crystalGrad.addColorStop(1, '#0369a1');
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = crystalGrad;
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 8 + pulse * 6;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Ok namlusu (sağa bakan)
            ctx.fillStyle = '#475569';
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 1.5;
            ctx.fillRect(r * 0.35, -r * 0.12, r * 0.7, r * 0.24);
            ctx.strokeRect(r * 0.35, -r * 0.12, r * 0.7, r * 0.24);

            // Namlu ucu (ufak kare)
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(r * 0.95, -r * 0.18, r * 0.15, r * 0.36);

            ctx.restore();

            // --- UÇAN OKLARI ÇİZ ---
            shooter.arrows.forEach(arrow => {
                if (!arrow.alive) return;
                ctx.save();
                const angle = Math.atan2(arrow.vy, arrow.vx);
                ctx.translate(arrow.x, arrow.y);
                ctx.rotate(angle);

                // Ok kuyruk ışıltısı
                const arrowGrad = ctx.createLinearGradient(-28, 0, 8, 0);
                arrowGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
                arrowGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.5)');
                arrowGrad.addColorStop(1, 'rgba(186, 230, 253, 0.9)');
                ctx.fillStyle = arrowGrad;
                ctx.fillRect(-28, -2, 36, 4);

                // Ok gövdesi (gri metal)
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(-16, -2.5, 22, 5);

                // Ok ucu (üçgen)
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(-2, -5);
                ctx.lineTo(-2, 5);
                ctx.closePath();
                ctx.fill();

                // Ok parlama efekti
                ctx.shadowColor = '#67e8f9';
                ctx.shadowBlur = 6;
                ctx.strokeStyle = 'rgba(103, 232, 249, 0.7)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-16, 0); ctx.lineTo(6, 0);
                ctx.stroke();

                ctx.restore();
            });
        });
    }

    drawRoundedRect(ctx, x, y, w, h, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}
export default Level;
