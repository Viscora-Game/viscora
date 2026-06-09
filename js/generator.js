/**
 * Viscora Procedural Level Generator
 * Generates seedable, contiguous, and playable levels from pre-defined segments.
 */

// Simple hashing function for seed strings to generate a 32-bit integer state
function cyrb128(str) {
    let h1 = 1779033703, h2 = 302473319, h3 = 3362453611, h4 = 502494819;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

// Mulberry32 generator helper
export function createPRNG(seed) {
    let seedVal;
    if (typeof seed === 'number') {
        seedVal = seed;
    } else {
        const hash = cyrb128(String(seed));
        seedVal = hash[0];
    }
    
    return function() {
        let t = seedVal += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Visual theme configurations
export const THEMES = [
    {
        id: 'neon_sewer',
        name: 'Neon Kanalizasyon',
        bgColors: ['#040b08', '#081812'],
        cellColor: 'rgba(16, 185, 129, 0.8)',
        cellShadowColor: '#10b981',
        platformColor: '#0c1a14',
        platformStroke: '#10b981',
        platformShadow: 'rgba(16, 185, 129, 0.25)',
        platformHighlight: '#1e3f32',
        spikeFill: '#0b1c15',
        spikeStroke: '#10b981',
        acidColor: 'rgba(16, 185, 129, 0.85)',
        acidGlowColor: 'rgba(16, 185, 129, 0.5)',
        bottomRiverColors: ['#10b981', '#059669', '#064e3b'],
        bottomRiverShadow: '#10b981'
    },
    {
        id: 'toxic_lab',
        name: 'Toksik Laboratuvar',
        bgColors: ['#0d0c04', '#1b1809'],
        cellColor: 'rgba(234, 179, 8, 0.8)',
        cellShadowColor: '#eab308',
        platformColor: '#1a180e',
        platformStroke: '#eab308',
        platformShadow: 'rgba(234, 179, 8, 0.25)',
        platformHighlight: '#3c3519',
        spikeFill: '#1c1a0f',
        spikeStroke: '#eab308',
        acidColor: 'rgba(234, 179, 8, 0.85)',
        acidGlowColor: 'rgba(234, 179, 8, 0.5)',
        bottomRiverColors: ['#eab308', '#ca8a04', '#854d0e'],
        bottomRiverShadow: '#eab308'
    },
    {
        id: 'magma_core',
        name: 'Magma Çekirdeği',
        bgColors: ['#0f0505', '#1e0c0c'],
        cellColor: 'rgba(249, 115, 22, 0.8)',
        cellShadowColor: '#f97316',
        platformColor: '#1f0d0d',
        platformStroke: '#ef4444',
        platformShadow: 'rgba(239, 68, 68, 0.25)',
        platformHighlight: '#4c1d1d',
        spikeFill: '#220808',
        spikeStroke: '#ef4444',
        acidColor: 'rgba(249, 115, 22, 0.85)', // styled as lava!
        acidGlowColor: 'rgba(249, 115, 22, 0.5)',
        bottomRiverColors: ['#f97316', '#ea580c', '#7c2d12'],
        bottomRiverShadow: '#f97316'
    },
    {
        id: 'gravity_chasm',
        name: 'Yerçekimi Yarası',
        bgColors: ['#0b040e', '#160824'],
        cellColor: 'rgba(217, 70, 239, 0.8)',
        cellShadowColor: '#d946ef',
        platformColor: '#170c22',
        platformStroke: '#d946ef',
        platformShadow: 'rgba(217, 70, 239, 0.25)',
        platformHighlight: '#3c1c5a',
        spikeFill: '#1a0b29',
        spikeStroke: '#d946ef',
        acidColor: 'rgba(168, 85, 247, 0.85)', // purple acid!
        acidGlowColor: 'rgba(168, 85, 247, 0.5)',
        bottomRiverColors: ['#a855f7', '#7e22ce', '#581c87'],
        bottomRiverShadow: '#a855f7'
    }
];

export class LevelGenerator {
    /**
     * Generates a new level procedurally and loads it into the game
     * @param {Game} game The game instance
     * @param {string|number} seed The seed for PRNG
     * @param {string} difficulty The difficulty level: 'easy' | 'medium' | 'hard'
     */
    static generate(game, seed, difficulty = 'medium') {
        const random = createPRNG(seed);
        const lvl = game.level;

        // Clear all arrays
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
        lvl.fallingPlatforms = [];
        lvl.breakablePlatforms = [];
        lvl.hiddenPassages = [];
        lvl.fallingBlockTraps = [];
        lvl.vantuzPoints = [];
        lvl.decorations = [];

        // Choose number of random segments between 3 and 5
        const numSegments = 3 + Math.floor(random() * 3); // 3, 4, or 5

        // Difficulty variables
        let wScale = 1.0;
        let enemySpeedMult = 1.0;

        if (difficulty === 'easy') {
            wScale = 1.2;
            enemySpeedMult = 0.8;
        } else if (difficulty === 'hard') {
            wScale = 0.8;
            enemySpeedMult = 1.35;
        }

        // Snaps any position to a 20px grid limit
        const randRange = (min, max, snap = 20) => {
            const val = min + random() * (max - min);
            return Math.round(val / snap) * snap;
        };

        const clampY = (y) => {
            return Math.max(160, Math.min(460, Math.round(y / 20) * 20));
        };

        // Builders list (hoisting will allow these functions to be resolved)
        const builders = [
            buildBasicJumps,
            buildVerticalStairs,
            buildMovingPlatforms,
            buildStickyClimb,
            buildLaserSwitchGate,
            buildTeleportPortals,
            buildBounceLauncher,
            buildFallingPlatforms
        ];

        // 1. Pre-select builder indices using seed PRNG
        const chosenBuilders = [];
        const lastTwo = [-1, -1];
        for (let i = 0; i < numSegments; i++) {
            let idx;
            do {
                idx = Math.floor(random() * builders.length);
            } while (lastTwo.includes(idx));
            lastTwo.shift();
            lastTwo.push(idx);
            chosenBuilders.push(idx);
        }

        // 2. Score themes based on chosenBuilders
        let scores = {
            neon_sewer: 1,
            toxic_lab: 1,
            magma_core: 1,
            gravity_chasm: 1
        };
        chosenBuilders.forEach(idx => {
            if (idx === 0 || idx === 1) scores.neon_sewer += 3;
            else if (idx === 2 || idx === 6) scores.magma_core += 3;
            else if (idx === 3 || idx === 5) scores.gravity_chasm += 3;
            else if (idx === 4 || idx === 7) scores.toxic_lab += 3;
        });

        // Find themes with the highest score
        let maxScore = -1;
        let candidates = [];
        for (const tId in scores) {
            if (scores[tId] > maxScore) {
                maxScore = scores[tId];
                candidates = [tId];
            } else if (scores[tId] === maxScore) {
                candidates.push(tId);
            }
        }

        // Pick dynamically from candidates using Math.random() for non-deterministic variety
        const chosenThemeId = candidates[Math.floor(Math.random() * candidates.length)];
        const theme = THEMES.find(t => t.id === chosenThemeId) || THEMES[0];
        lvl.theme = theme;

        let offsetX = 0;
        let segmentIdCounter = 1;

        // 3. Build Start Segment (Floating Base Platform)
        const startWidth = 500;
        const startY = 460;
        lvl.platforms.push({ x: offsetX, y: startY, w: startWidth, h: 40, type: 'normal' });
        lvl.spawnX = offsetX + 100;
        lvl.spawnY = startY - 40;
        
        // Add theme window decoration
        if (theme.id === 'gravity_chasm') {
            lvl.decorations.push({ x: offsetX + 200, y: 160, w: 60, h: 60, type: 'window_space', rotation: 0, state: 0 });
        } else {
            lvl.decorations.push({ x: offsetX + 200, y: 200, w: 60, h: 60, type: 'pano', rotation: 0, state: 0 });
        }
        lvl.decorations.push({ x: offsetX + 350, y: startY - 32, w: 32, h: 32, type: 'warning_light', rotation: 0, state: 0 });

        offsetX += startWidth;
        let currentY = startY;

        // --- SEGMENT BUILDERS ---
        // Every builder assumes there is already solid ground ending at sX at height sY.
        // It does NOT push a duplicate entry platform at sX, preventing block stacking.

        // Segment 1: Basic Jumps & Height Transitions
        function buildBasicJumps(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Classic jump
                const dy = randRange(-80, 80);
                const targetY = clampY(sY + dy);
                const gap = randRange(90, 130 + (targetY - sY) * 0.3);
                const landingW = randRange(160, 220) * wScale;
                const landingX = sX + gap;

                const plat = { x: landingX, y: targetY, w: landingW, h: 40, type: 'normal' };
                lvl.platforms.push(plat);

                // Hazard pool
                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });

                // Collectible aligned on top of landing platform
                lvl.collectibles.push({
                    x: landingX + 30,
                    y: targetY - 35,
                    collected: false,
                    color: '#eab308'
                });

                if (difficulty !== 'easy') {
                    lvl.enemies.push({
                        x: landingX + landingW / 2,
                        y: targetY - 26,
                        rangeX: Math.round(landingW / 3),
                        speed: 1.0 * enemySpeedMult,
                        isVertical: false,
                        color: '#f43f5e'
                    });
                }

                width = gap + landingW;
                exitY = targetY;
            } else if (subType === 1) {
                // Sub-type B: Stepping Stones (Multiple small platforms)
                const stoneCount = 2 + Math.floor(random() * 2); // 2 or 3 stones
                let currentX = sX;
                let lastY = sY;
                const stoneW = 60 * wScale;

                for (let i = 0; i < stoneCount; i++) {
                    const stepGap = randRange(85, 100);
                    const stepY = clampY(lastY + randRange(-40, 40));
                    currentX += stepGap;
                    lvl.platforms.push({ x: currentX, y: stepY, w: stoneW, h: 40, type: 'normal' });
                    
                    // Collectible hovering above stone
                    if (random() > 0.4) {
                        lvl.collectibles.push({ x: currentX + stoneW / 2 - 10, y: stepY - 35, collected: false, color: '#06b6d4' });
                    }
                    currentX += stoneW;
                    lastY = stepY;
                }

                const finalGap = randRange(85, 100);
                const finalY = clampY(lastY + randRange(-40, 40));
                const finalW = 160 * wScale;
                const finalX = currentX + finalGap;
                lvl.platforms.push({ x: finalX, y: finalY, w: finalW, h: 40, type: 'normal' });

                // Hazard pool under all stones
                lvl.hazards.push({ x: sX, y: 530, w: finalX - sX, h: 70, type: 'acid' });

                width = finalX + finalW - sX;
                exitY = finalY;
            } else {
                // Sub-type C: Double-tier jump (Upper rewarding path, lower dangerous path)
                const gap = randRange(90, 110);
                const lowerY = clampY(sY + 80);
                const upperY = clampY(sY - 80);
                const tierW = 180 * wScale;

                // Lower platform
                lvl.platforms.push({ x: sX + gap, y: lowerY, w: tierW, h: 40, type: 'normal' });
                // Upper platform
                lvl.platforms.push({ x: sX + gap + 40, y: upperY, w: tierW - 40, h: 40, type: 'normal' });

                // Hazard pool
                lvl.hazards.push({ x: sX, y: 530, w: gap + tierW, h: 70, type: 'acid' });

                // Reward on upper path
                lvl.collectibles.push({ x: sX + gap + 80, y: upperY - 40, collected: false, color: '#d946ef' });
                
                // Hazard/Enemy on lower path
                if (difficulty !== 'easy') {
                    lvl.enemies.push({
                        x: sX + gap + tierW / 2,
                        y: lowerY - 26,
                        rangeX: 40,
                        speed: 1.2 * enemySpeedMult,
                        isVertical: false,
                        color: '#ef4444'
                    });
                }

                const exitX = sX + gap + tierW + 80;
                const exitYVal = clampY(lowerY - 40);
                lvl.platforms.push({ x: exitX, y: exitYVal, w: 140 * wScale, h: 40, type: 'normal' });

                width = exitX + 140 * wScale - sX;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 2: Vertical Staircase
        function buildVerticalStairs(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Zig-Zag Stairs
                const goUp = sY > 280;
                const dy1 = goUp ? -60 : 60;
                const gap1 = randRange(70, 85);
                const stepW = 100 * wScale;
                const x1 = sX + gap1;
                const y1 = clampY(sY + dy1);
                lvl.platforms.push({ x: x1, y: y1, w: stepW, h: 40, type: 'normal' });

                const gap2 = -40; // Zig-zag back horizontally
                const dy2 = goUp ? -60 : 60;
                const x2 = x1 + gap2;
                const y2 = clampY(y1 + dy2);
                lvl.platforms.push({ x: x2, y: y2, w: stepW, h: 40, type: 'normal' });

                const gap3 = randRange(80, 100);
                const x3 = x1 + stepW + gap3;
                const y3 = clampY(y2 + (goUp ? 40 : -40));
                const exitW = 150 * wScale;
                lvl.platforms.push({ x: x3, y: y3, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: x3 + exitW - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: x2 + stepW / 2 - 10, y: y2 - 35, collected: false, color: '#06b6d4' });

                width = x3 + exitW - sX;
                exitY = y3;
            } else if (subType === 1) {
                // Sub-type B: Breakable/Falling Steps
                const stepY1 = clampY(sY - 50);
                const stepX1 = sX + 80;
                lvl.fallingPlatforms.push({
                    startX: stepX1, startY: stepY1, x: stepX1, y: stepY1, w: 80, h: 40,
                    timer: 0, triggered: false, vy: 0, fallen: false
                });

                const stepY2 = clampY(stepY1 - 50);
                const stepX2 = stepX1 + 140;
                lvl.breakablePlatforms.push({
                    x: stepX2, y: stepY2, w: 80, h: 20, broken: false, timer: 0
                });

                const exitX = stepX2 + 140;
                const exitYVal = clampY(stepY2 - 30);
                const exitW = 150 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: stepX2 + 30, y: stepY2 - 35, collected: false, color: '#eab308' });

                width = exitX + exitW - sX;
                exitY = exitYVal;
            } else {
                // Sub-type C: Conveyor Stairs
                const stepY1 = clampY(sY - 60);
                const stepX1 = sX + 80;
                lvl.conveyors.push({
                    x: stepX1, y: stepY1, w: 100, h: 20,
                    speed: 2.0 * (random() > 0.5 ? 1 : -1)
                });
                lvl.platforms.push({ x: stepX1, y: stepY1, w: 100, h: 20, type: 'normal' });

                const stepY2 = clampY(stepY1 - 60);
                const stepX2 = stepX1 + 160;
                lvl.conveyors.push({
                    x: stepX2, y: stepY2, w: 100, h: 20,
                    speed: 2.0 * (random() > 0.5 ? 1 : -1)
                });
                lvl.platforms.push({ x: stepX2, y: stepY2, w: 100, h: 20, type: 'normal' });

                const exitX = stepX2 + 160;
                const exitYVal = clampY(stepY2 - 30);
                const exitW = 150 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: stepX2 + 40, y: stepY2 - 35, collected: false, color: '#eab308' });

                width = exitX + exitW - sX;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 3: Moving Platforms over Hazard Pools
        function buildMovingPlatforms(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Sync Patrols
                const gapW = 400;
                const midY = clampY((sY + sY) / 2);
                
                lvl.movingPlatforms.push({
                    startX: sX + 20, startY: midY - 20,
                    targetX: sX + gapW / 2 - 60, targetY: midY - 20,
                    x: sX + 20, y: midY - 20, w: 80, h: 20,
                    type: 'moving', speed: 0.012 * enemySpeedMult, dir: 1, progress: 0
                });

                lvl.movingPlatforms.push({
                    startX: sX + gapW - 100, startY: midY + 20,
                    targetX: sX + gapW / 2 + 20, targetY: midY + 20,
                    x: sX + gapW - 100, y: midY + 20, w: 80, h: 20,
                    type: 'moving', speed: 0.012 * enemySpeedMult, dir: -1, progress: 0.5
                });

                const exitX = sX + gapW;
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: sY, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: gapW, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: sX + gapW / 2 - 10, y: midY - 60, collected: false, color: '#eab308' });

                width = gapW + exitW;
                exitY = sY;
            } else if (subType === 1) {
                // Sub-type B: Chasm Elevator
                const gapW = 220;
                const elevatorX = sX + 50;
                const targetY = clampY(sY - 140);

                lvl.movingPlatforms.push({
                    startX: elevatorX, startY: sY + 60,
                    targetX: elevatorX, targetY: targetY - 20,
                    x: elevatorX, y: sY + 60, w: 90, h: 20,
                    type: 'moving', speed: 0.01 * enemySpeedMult, dir: 1, progress: 0
                });

                lvl.platforms.push({ x: elevatorX + 110, y: targetY, w: 40, h: 200, type: 'normal' });
                lvl.hazards.push({ x: elevatorX + 110, y: targetY + 40, w: 20, h: 60, type: 'spike', direction: 'left' });

                const exitX = elevatorX + 150;
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: targetY, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: elevatorX + 35, y: targetY - 60, collected: false, color: '#06b6d4' });

                width = exitX + exitW - sX;
                exitY = targetY;
            } else {
                // Sub-type C: Conveyor Moving Platform
                const gapW = 320;
                const exitX = sX + gapW;
                const exitYVal = clampY(sY + randRange(-30, 30));
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                const midY = (sY + exitYVal) / 2;
                lvl.movingPlatforms.push({
                    startX: sX + 20, startY: midY,
                    targetX: sX + gapW - 120, targetY: midY,
                    x: sX + 20, y: midY, w: 100, h: 20,
                    type: 'moving', speed: 0.015 * enemySpeedMult, dir: 1, progress: 0
                });

                lvl.conveyors.push({
                    x: sX + 20, y: midY, w: 100, h: 20,
                    speed: 1.5,
                    isMovingPlatformLink: true
                });

                lvl.hazards.push({ x: sX, y: 530, w: gapW, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: sX + gapW / 2 - 10, y: midY - 40, collected: false, color: '#eab308' });

                width = gapW + exitW;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 4: Sticky Wall Climb
        function buildStickyClimb(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Parallel Shaft Climb
                const gap1 = 60;
                const wallX1 = sX + gap1;
                const wallY = 120;
                const wallH = 340;
                lvl.platforms.push({ x: wallX1, y: wallY, w: 30, h: wallH, type: 'sticky', sticky: true });
                const wallX2 = wallX1 + 110;
                lvl.platforms.push({ x: wallX2, y: wallY, w: 30, h: wallH, type: 'sticky', sticky: true });

                const gap2 = 60;
                const exitX = wallX2 + 30 + gap2;
                const exitYVal = clampY(wallY + 40);
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                
                if (difficulty !== 'easy') {
                    lvl.enemies.push({
                        x: wallX1 + 65, y: wallY + 150, rangeY: 80, speed: 1.2 * enemySpeedMult,
                        isVertical: true, color: '#ec4899'
                    });
                }

                lvl.collectibles.push({ x: wallX1 + 55, y: wallY + 50, collected: false, color: '#d946ef' });
                lvl.collectibles.push({ x: exitX + 40, y: exitYVal - 40, collected: false, color: '#eab308' });

                width = gap1 + 170 + gap2 + exitW;
                exitY = exitYVal;
            } else if (subType === 1) {
                // Sub-type B: Sticky ceiling maze
                const gap1 = 80;
                const climbX = sX + gap1;
                const ceilingY = 160;
                lvl.platforms.push({ x: climbX, y: ceilingY, w: 40, h: 240, type: 'sticky', sticky: true });
                lvl.platforms.push({ x: climbX + 40, y: ceilingY, w: 200, h: 30, type: 'sticky', sticky: true });

                const gap2 = 80;
                const exitX = climbX + 240 + gap2;
                const exitYVal = clampY(ceilingY + 180);
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.hazards.push({ x: climbX + 80, y: 510, w: 120, h: 20, type: 'spike', direction: 'up' });

                lvl.collectibles.push({ x: climbX + 120, y: ceilingY + 60, collected: false, color: '#d946ef' });
                lvl.collectibles.push({ x: exitX + 40, y: exitYVal - 40, collected: false, color: '#eab308' });

                width = gap1 + 240 + gap2 + exitW;
                exitY = exitYVal;
            } else {
                // Sub-type C: Original single wall climb
                const gap1 = 80;
                const wallX = sX + gap1;
                const wallY = 160;
                const wallH = 320;
                lvl.platforms.push({ x: wallX, y: wallY, w: 40, h: wallH, type: 'sticky', sticky: true });

                const gap2 = 80;
                const exitX = wallX + 40 + gap2;
                const exitYVal = clampY(wallY + 40);
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });

                if (theme.id === 'gravity_chasm') {
                    lvl.vantuzPoints.push({ x: wallX + 20, y: wallY - 40, cooldown: 0 });
                }

                lvl.collectibles.push({ x: wallX + 10, y: wallY + 60, collected: false, color: '#d946ef' });
                lvl.collectibles.push({ x: exitX + 30, y: exitYVal - 40, collected: false, color: '#eab308' });

                width = gap1 + 40 + gap2 + exitW;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 5: Laser Switch Puzzle Gate
        function buildLaserSwitchGate(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;
            const gateId = segIdx * 1000 + 5;

            if (subType === 0) {
                // Sub-type A: Timed Double Lock Gate
                const gap = 160;
                const exitX = sX + gap;
                const exitW = 300 * wScale;
                lvl.platforms.push({ x: exitX, y: sY, w: exitW, h: 40, type: 'normal' });

                lvl.conveyors.push({ x: exitX, y: sY, w: 100, h: 20, speed: -2.0 });

                let timerVal = 200;
                if (difficulty === 'easy') timerVal = 280;
                else if (difficulty === 'hard') timerVal = 140;

                lvl.buttons.push({
                    x: sX - 50, y: sY - 32, w: 32, h: 32,
                    activated: false, linkedGateId: gateId, timer: timerVal
                });

                lvl.gates.push({
                    x: exitX + 120, y: sY - 260, w: 20, h: 260,
                    type: theme.id === 'toxic_lab' ? 'yellowLaser' : 'laser',
                    id: gateId, disabled: false
                });

                const secondGateId = gateId + 1;
                lvl.gates.push({
                    x: exitX + 220, y: sY - 260, w: 20, h: 260,
                    type: theme.id === 'gravity_chasm' ? 'pinkLaser' : 'laser',
                    id: secondGateId, disabled: false
                });

                lvl.pushBlocks.push({
                    startX: exitX + 20, startY: sY - 60, x: exitX + 20, y: sY - 60,
                    w: 50, h: 50, vx: 0, vy: 0
                });
                lvl.pressurePlates.push({
                    x: exitX + 160, y: sY - 10, w: 40, h: 10,
                    activated: false, linkedGateId: secondGateId
                });

                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 260, y: sY - 40, collected: false, color: '#10b981' });

                width = gap + exitW;
                exitY = sY;
            } else if (subType === 1) {
                // Sub-type B: Form Gates
                const gap = 120;
                const exitX = sX + gap;
                const exitW = 240 * wScale;
                lvl.platforms.push({ x: exitX, y: sY, w: exitW, h: 40, type: 'normal' });

                lvl.gates.push({
                    x: exitX + 60, y: sY - 260, w: 20, h: 260,
                    type: 'laser', id: gateId, disabled: false
                });

                lvl.gates.push({
                    x: exitX + 140, y: sY - 260, w: 20, h: 260,
                    type: 'pinkLaser', id: gateId + 1, disabled: false
                });

                lvl.levers.push({
                    x: exitX + 200, y: sY - 120, w: 32, h: 32,
                    activated: false, linkedGateId: gateId, cooldown: 0
                });

                lvl.platforms.push({ x: exitX + 180, y: sY - 80, w: 50, h: 20, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 10, y: sY - 40, collected: false, color: '#d946ef' });

                width = gap + exitW;
                exitY = sY;
            } else {
                // Sub-type C: Original single laser/button
                const isTimed = (theme.id === 'toxic_lab' || theme.id === 'gravity_chasm');
                if (isTimed) {
                    let timerVal = 180;
                    if (difficulty === 'easy') timerVal = 240;
                    else if (difficulty === 'hard') timerVal = 120;
                    
                    lvl.buttons.push({
                        x: sX - 50, y: sY - 32, w: 32, h: 32,
                        activated: false, linkedGateId: gateId, timer: timerVal
                    });
                } else {
                    lvl.levers.push({
                        x: sX - 50, y: sY - 32, w: 32, h: 32,
                        activated: false, linkedGateId: gateId, cooldown: 0
                    });
                }

                const gap = randRange(90, 120);
                const exitX = sX + gap;
                const exitYVal = clampY(sY + randRange(-30, 30));
                const exitW = randRange(200, 260) * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                let laserType = 'laser';
                if (theme.id === 'gravity_chasm') laserType = 'pinkLaser';
                else if (theme.id === 'toxic_lab') laserType = 'yellowLaser';

                lvl.gates.push({
                    x: exitX + 80, y: exitYVal - 260, w: 20, h: 260,
                    type: laserType, id: gateId, disabled: false
                });

                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 30, y: exitYVal - 40, collected: false, color: '#10b981' });

                width = gap + exitW;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 6: Teleport Portal Matrix
        function buildTeleportPortals(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Portal Maze with boxes
                const gap = 300;
                const exitX = sX + gap;
                const exitW = 220 * wScale;
                lvl.platforms.push({ x: exitX, y: sY, w: exitW, h: 40, type: 'normal' });

                const wallX = sX + 100;
                lvl.platforms.push({ x: wallX, y: 120, w: 40, h: sY - 120, type: 'normal' });

                lvl.teleportPairs.push({
                    x1: sX - 50, y1: sY - 60,
                    x2: exitX + 40, y2: sY - 60,
                    color: '#a855f7', cooldown: 0
                });

                const gateId = segIdx * 1000 + 6;
                lvl.teleportPairs.push({
                    x1: sX + 30, y1: sY - 60,
                    x2: wallX + 80, y2: 120,
                    color: '#06b6d4', cooldown: 0
                });

                lvl.pushBlocks.push({
                    startX: sX + 20, startY: sY - 60, x: sX + 20, y: sY - 60,
                    w: 50, h: 50, vx: 0, vy: 0
                });

                lvl.pressurePlates.push({
                    x: wallX + 80, y: sY - 10, w: 50, h: 10,
                    activated: false, linkedGateId: gateId
                });

                lvl.gates.push({
                    x: exitX + exitW - 30, y: sY - 260, w: 20, h: 260,
                    type: 'net', id: gateId, disabled: false
                });

                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: wallX + 80, y: sY - 50, collected: false, color: '#eab308' });

                width = gap + exitW;
                exitY = sY;
            } else if (subType === 1) {
                // Sub-type B: Vertical Momentum Loop
                const gap = 160;
                const exitX = sX + gap;
                const exitW = 160 * wScale;
                const targetY = clampY(sY - 120);
                lvl.platforms.push({ x: exitX, y: targetY, w: exitW, h: 40, type: 'normal' });

                const portalX1 = sX + 30;
                const portalY1 = sY - 20;
                const portalX2 = exitX + exitW / 2 - 30;
                const portalY2 = targetY - 180;

                lvl.teleportPairs.push({
                    x1: portalX1, y1: portalY1,
                    x2: portalX2, y2: portalY2,
                    color: '#a855f7', cooldown: 0
                });

                lvl.platforms.push({ x: portalX2 - 20, y: portalY2 - 20, w: 100, h: 20, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.hazards.push({ x: sX + 80, y: 510, w: 60, h: 20, type: 'spike', direction: 'up' });

                lvl.collectibles.push({ x: portalX2 + 10, y: portalY2 + 60, collected: false, color: '#ec4899' });

                width = gap + exitW;
                exitY = targetY;
            } else {
                // Sub-type C: Original portal pair
                lvl.teleportPairs.push({
                    x1: sX - 50, y1: sY - 60,
                    x2: sX + 240, y2: sY - 60,
                    color: theme.id === 'gravity_chasm' ? '#a855f7' : '#eab308',
                    cooldown: 0
                });

                const wallW = 40;
                const wallX = sX + 60;
                const wallY = 120;
                const wallH = sY - 120;
                lvl.platforms.push({ x: wallX, y: wallY, w: wallW, h: wallH, type: 'normal' });

                const gap2 = 80;
                const exitX = wallX + wallW + gap2;
                const exitYVal = clampY(sY + randRange(-40, 40));
                const exitW = randRange(140, 180) * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.teleportPairs[lvl.teleportPairs.length - 1].x2 = exitX + exitW - 80;
                lvl.teleportPairs[lvl.teleportPairs.length - 1].y2 = exitYVal - 60;

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: wallX + wallW / 2 - 10, y: wallY + wallH - 40, collected: false, color: '#ec4899' });

                width = 60 + wallW + gap2 + exitW;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 7: Bounce Pad Launcher
        function buildBounceLauncher(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Pinball Chain
                lvl.bouncePads.push({
                    x: sX - 50, y: sY - 15, w: 40, h: 15,
                    force: 10.0, active: false, timer: 0
                });

                const midX = sX + 80;
                const midY = clampY(sY - 80);
                lvl.platforms.push({ x: midX, y: midY, w: 60, h: 20, type: 'normal' });
                lvl.bouncePads.push({
                    x: midX + 10, y: midY - 15, w: 40, h: 15,
                    force: 10.0, active: false, timer: 0
                });

                const finalGap = 100;
                const exitX = midX + 60 + finalGap;
                const exitYVal = clampY(midY - 100);
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 40, y: exitYVal - 40, collected: false, color: '#eab308' });

                width = (midX + 60 - sX) + finalGap + exitW;
                exitY = exitYVal;
            } else if (subType === 1) {
                // Sub-type B: Ceiling Spike Dodge
                lvl.bouncePads.push({
                    x: sX - 50, y: sY - 15, w: 40, h: 15,
                    force: 13.5, active: false, timer: 0
                });

                const gap = 160;
                const exitX = sX + gap;
                const exitYVal = clampY(sY - 160);
                const exitW = 160 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX + 40, y: 0, w: 80, h: 100, type: 'spike', direction: 'down' });
                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 30, y: exitYVal - 40, collected: false, color: '#eab308' });

                width = gap + exitW;
                exitY = exitYVal;
            } else {
                // Sub-type C: Original bounce pad launcher
                lvl.bouncePads.push({
                    x: sX - 50, y: sY - 15, w: 40, h: 15,
                    force: 12.0, active: false, timer: 0
                });

                const gap = randRange(80, 120);
                const exitX = sX + gap;
                const exitYVal = clampY(sY - 160);
                const exitW = randRange(140, 180) * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: gap, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 30, y: exitYVal - 40, collected: false, color: '#eab308' });
                lvl.decorations.push({ x: exitX + exitW - 50, y: exitYVal - 32, w: 32, h: 32, type: 'steam', rotation: 0, state: 0 });

                width = gap + exitW;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // Segment 8: Falling Bridge & Ceiling Spikes
        function buildFallingPlatforms(sX, sY, theme, segIdx) {
            const subType = Math.floor(random() * 3); // 0, 1, 2
            let width = 0;
            let exitY = sY;

            if (subType === 0) {
                // Sub-type A: Long Bridge Collapse
                const platCount = 4;
                let currentX = sX + 40;
                let lastY = sY;
                const gap = 40;
                const fallW = 70;

                for (let i = 0; i < platCount; i++) {
                    const stepY = clampY(lastY + randRange(-15, 15));
                    lvl.fallingPlatforms.push({
                        startX: currentX, startY: stepY, x: currentX, y: stepY, w: fallW, h: 30,
                        timer: 0, triggered: false, vy: 0, fallen: false
                    });
                    
                    if (random() > 0.5) {
                        lvl.collectibles.push({ x: currentX + fallW/2 - 10, y: stepY - 35, collected: false, color: '#10b981' });
                    }
                    currentX += fallW + gap;
                    lastY = stepY;
                }

                const exitX = currentX + 20;
                const exitYVal = clampY(lastY);
                const exitW = 150 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });

                width = exitX + exitW - sX;
                exitY = exitYVal;
            } else if (subType === 1) {
                // Sub-type B: Falling Platform with a Crusher Trap
                const gap1 = 60;
                const fallX = sX + gap1;
                const fallY = clampY(sY - 20);
                const fallW = 90;
                
                lvl.fallingPlatforms.push({
                    startX: fallX, startY: fallY, x: fallX, y: fallY, w: fallW, h: 40,
                    timer: 0, triggered: false, vy: 0, fallen: false
                });

                lvl.fallingBlockTraps.push({
                    startX: fallX + 15, startY: 20, x: fallX + 15, y: 20, w: 60, h: 60,
                    triggered: false, state: 'idle', timer: 0, speedY: 0
                });

                const gap2 = 60;
                const exitX = fallX + fallW + gap2;
                const exitYVal = clampY(fallY + 20);
                const exitW = 150 * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });
                lvl.collectibles.push({ x: exitX + 30, y: exitYVal - 40, collected: false, color: '#eab308' });

                width = gap1 + fallW + gap2 + exitW;
                exitY = exitYVal;
            } else {
                // Sub-type C: Original falling platforms
                const gap1 = 60;
                const fallW1 = 80;
                const fallX1 = sX + gap1;
                const fallY1 = clampY(sY - 20);
                lvl.fallingPlatforms.push({
                    startX: fallX1, startY: fallY1, x: fallX1, y: fallY1, w: fallW1, h: 40,
                    timer: 0, triggered: false, vy: 0, fallen: false
                });

                const gap2 = 60;
                const fallW2 = 80;
                const fallX2 = fallX1 + fallW1 + gap2;
                const fallY2 = clampY(fallY1 - 20);
                lvl.fallingPlatforms.push({
                    startX: fallX2, startY: fallY2, x: fallX2, y: fallY2, w: fallW2, h: 40,
                    timer: 0, triggered: false, vy: 0, fallen: false
                });

                const gap3 = 60;
                const exitX = fallX2 + fallW2 + gap3;
                const exitYVal = clampY(fallY2 + 40);
                const exitW = randRange(120, 160) * wScale;
                lvl.platforms.push({ x: exitX, y: exitYVal, w: exitW, h: 40, type: 'normal' });

                lvl.hazards.push({ x: sX, y: 530, w: exitX - sX, h: 70, type: 'acid' });

                if (difficulty === 'hard') {
                    lvl.hazards.push({
                        x: fallX1 + 10, y: 0, w: 60, h: 120,
                        type: 'spike', direction: 'down'
                    });
                }

                lvl.collectibles.push({ x: fallX2 + fallW2/2 - 10, y: fallY2 - 40, collected: false, color: '#10b981' });

                width = gap1 + fallW1 + gap2 + fallW2 + gap3 + exitW;
                exitY = exitYVal;
            }

            return { width, exitY };
        }

        // 4. Build intermediate segments using chosen builders list
        currentY = startY;
        for (let i = 0; i < chosenBuilders.length; i++) {
            const idx = chosenBuilders[i];
            const builder = builders[idx];
            const result = builder(offsetX, currentY, theme, segmentIdCounter);
            
            offsetX += result.width;
            currentY = result.exitY;
            segmentIdCounter++;
        }

        // 3. Build End Segment (contains portal)
        const endWidth = 500;
        lvl.platforms.push({ x: offsetX, y: currentY, w: endWidth, h: 40, type: 'normal' });
        
        lvl.portal = {
            x: offsetX + 350,
            y: currentY - 80,
            w: 60,
            h: 80,
            angle: 0
        };

        lvl.collectibles.push({ x: offsetX + 200, y: currentY - 60, collected: false, color: '#eab308' });

        // End decorations
        lvl.decorations.push({ x: offsetX + 50, y: currentY - 32, w: 32, h: 32, type: 'warning_light', rotation: 0, state: 0 });
        lvl.decorations.push({ x: offsetX + 280, y: currentY - 32, w: 32, h: 32, type: 'steam', rotation: 0, state: 0 });

        offsetX += endWidth;

        // Set level dimensions
        lvl.width = offsetX;
        lvl.height = 600;

        // Procedurally scatter detailed decoration props matching the theme
        LevelGenerator.addDecorationsForPlatforms(lvl, theme, random);

        // Force runtime initialization
        lvl.resetLevelRuntimeState();
    }

    /**
     * Procedurally scatters detailed decoration props matching the level's theme.
     * @param {Level} lvl The level instance
     * @param {object} theme The chosen theme configuration
     * @param {function} random The seeded PRNG function
     */
    static addDecorationsForPlatforms(lvl, theme, random) {
        if (!lvl.platforms || lvl.platforms.length === 0) return;

        lvl.platforms.forEach(plat => {
            // Skip the very first start platform and very last end platform to keep them clean
            if (plat.x < 300 || plat.x > lvl.width - 500) return;

            const themeId = theme.id;

            // 1. Horizontal pipes behind platforms (common tech/sewer detail)
            if (random() < 0.35) {
                const pipeY = plat.y + 10 + Math.floor(random() * 20);
                lvl.decorations.push({
                    x: plat.x - 40,
                    y: pipeY,
                    w: plat.w + 80,
                    h: 12,
                    type: 'pipe',
                    rotation: 0,
                    state: 0
                });
            }

            // 2. Server racks on top of normal platforms (labs / sewer consoles)
            if ((themeId === 'toxic_lab' || themeId === 'neon_sewer') && plat.w >= 140 && random() < 0.5) {
                const isOccupied = lvl.collectibles.some(c => Math.abs(c.x - (plat.x + plat.w / 2)) < 60) ||
                                   lvl.enemies.some(e => Math.abs(e.x - (plat.x + plat.w / 2)) < 60) ||
                                   (lvl.portal && Math.abs(lvl.portal.x - (plat.x + plat.w / 2)) < 80);

                if (!isOccupied) {
                    lvl.decorations.push({
                        x: plat.x + plat.w / 2 - 20,
                        y: plat.y - 50,
                        w: 40,
                        h: 50,
                        type: 'server_rack',
                        rotation: 0,
                        state: 0
                    });
                }
            }

            // 3. Rotating industrial gears behind platforms in magma core
            if (themeId === 'magma_core' && random() < 0.6) {
                // Left corner
                if (random() > 0.4) {
                    lvl.decorations.push({
                        x: plat.x - 20,
                        y: plat.y + plat.h - 20,
                        w: 40,
                        h: 40,
                        type: 'gear',
                        rotation: random() * Math.PI,
                        state: 0
                    });
                }
                // Right corner
                if (random() > 0.4) {
                    lvl.decorations.push({
                        x: plat.x + plat.w - 20,
                        y: plat.y + plat.h - 20,
                        w: 40,
                        h: 40,
                        type: 'gear',
                        rotation: random() * Math.PI,
                        state: 0
                    });
                }
            }

            // 4. Cosmic void windows floating above platforms in gravity chasm
            if (themeId === 'gravity_chasm' && plat.w >= 120 && random() < 0.5) {
                lvl.decorations.push({
                    x: plat.x + plat.w / 2 - 30,
                    y: plat.y - 120,
                    w: 60,
                    h: 60,
                    type: 'window_space',
                    rotation: 0,
                    state: 0
                });
            }

            // 5. Hanging warning light from bottom of platforms that have hazards below them
            const hasHazardBelow = lvl.hazards && lvl.hazards.some(h => 
                h.x < plat.x + plat.w && h.x + h.w > plat.x && h.y > plat.y
            );
            if (hasHazardBelow && random() < 0.7) {
                lvl.decorations.push({
                    x: plat.x + plat.w / 2 - 16,
                    y: plat.y + plat.h,
                    w: 32,
                    h: 32,
                    type: 'warning_light',
                    rotation: Math.PI, // point down
                    state: 0
                });
            }

            // 6. Technical backdrop panels (pano) showing sine waves
            if (random() < 0.2 && plat.w >= 120) {
                const isOccupied = lvl.collectibles.some(c => Math.abs(c.x - (plat.x + plat.w / 2)) < 60);
                if (!isOccupied) {
                    lvl.decorations.push({
                        x: plat.x + plat.w / 2 - 25,
                        y: plat.y - 40,
                        w: 50,
                        h: 35,
                        type: 'pano',
                        rotation: 0,
                        state: 0
                    });
                }
            }
        });
    }
}
