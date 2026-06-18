import { audio } from './audio.js?v=v100';

export class Boss {
    constructor(x, y) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 36;
        this.health = 5;
        this.maxHealth = 5;
        this.isDead = false;

        // State machine
        this.state = 'GREEN_ROLL'; // 'GREEN_ROLL', 'BLUE_STOMP', 'PINK_SWEEP', 'SLEEP'
        this.stateTimer = 0;
        this.onGround = false;

        // Phase specific variables
        this.pulseTime = 0;
        this.rollAngle = 0;
        
        // BLUE_STOMP state sub-machine
        this.stompCount = 0;
        this.stompState = 'idle'; // 'idle', 'rising', 'falling', 'cooldown'
        this.stompTimer = 0;

        // PINK_SWEEP state shockwaves
        this.shockwaves = [];
        this.sweepTimer = 0;

        // SLEEP state particles
        this.zzzParticles = [];
        this.zzzTimer = 0;

        // Damage invulnerability frames
        this.invulnFrames = 0;
        this.squishX = 0;
        this.squishY = 0;
        this.enragedShockwaveCooldown = 0;
    }

    /**
     * Boss update logic
     */
    update(level, player) {
        if (this.isDead) return;
        this.levelRef = level;

        this.pulseTime += 0.05;
        if (this.invulnFrames > 0) this.invulnFrames--;
        if (this.enragedShockwaveCooldown > 0) this.enragedShockwaveCooldown--;

        // Decelerate squish
        this.squishX *= 0.85;
        this.squishY *= 0.85;

        // 1. Apply gravity
        this.vy += 0.32;

        // 2. State behavior
        switch (this.state) {
            case 'GREEN_ROLL':
                this.updateGreenRoll(level, player);
                break;
            case 'BLUE_STOMP':
                this.updateBlueStomp(level, player);
                break;
            case 'PINK_SWEEP':
                this.updatePinkSweep(level, player);
                break;
            case 'SLEEP':
                this.updateSleep(level, player);
                break;
        }

        // 3. Shockwaves update
        this.updateShockwaves(player);

        // 4. Zzz particles update
        this.updateZzzParticles();

        // 5. Physics and collision with platforms
        const wasOnGround = this.onGround;
        this.resolveCollisions(level);

        // Spawn ground shockwave on landing in any state when enraged!
        if (this.health <= 2 && this.onGround && !wasOnGround && this.vy >= 0) {
            if (this.state !== 'PINK_SWEEP') {
                if ((this.enragedShockwaveCooldown || 0) <= 0) {
                    this.shockwaves.push({
                        x: this.x,
                        y: this.y + this.radius - 4,
                        radius: 10,
                        maxRadius: 350,
                        speed: 5.5,
                        hasHitPlayer: false
                    });
                    this.enragedShockwaveCooldown = 150; // 2.5 seconds cooldown between landing shockwaves
                    audio.playStomp();
                    if (player.game) {
                        player.game.shakeCamera(10, 16);
                    }
                }
            }
        }

        // 6. Check push block falling damage
        this.checkPushBlockDamage(level, player);

        // 7. Check boss collision with push blocks to shatter them
        this.checkPushBlockCollision(level, player);
    }

    /**
     * Checks if there is any platform directly above the boss's head
     */
    isPlatformAbove(level) {
        if (!level || !level.platforms) return false;

        const allPlats = [
            ...(level.platforms ? level.platforms.filter(p => !p.passage) : []),
            ...(level.movingPlatforms || []),
            ...(level.fallingPlatforms ? level.fallingPlatforms.filter(p => !p.fallen) : []),
            ...(level.breakablePlatforms ? level.breakablePlatforms.filter(p => !p.broken) : [])
        ];

        for (const plat of allPlats) {
            // Check if platform overlaps horizontally with the boss's bounding box
            // and is vertically within 250px above the boss
            if (this.x + this.radius > plat.x && this.x - this.radius < plat.x + plat.w) {
                if (plat.y < this.y && plat.y + plat.h > this.y - 250) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * GREEN_ROLL: Charges horizontally at player
     */
    updateGreenRoll(level, player) {
        this.stateTimer++;

        // Roll towards player
        const rollSpeed = this.health <= 2 ? 3.8 : 2.6;
        const targetVx = Math.sign(player.x - this.x) * rollSpeed;
        this.vx += (targetVx - this.vx) * 0.08;

        // Visual rolling rotation based on horizontal movement
        this.rollAngle = (this.rollAngle || 0) + this.vx * 0.05;

        // If stuck against a wall or block while trying to roll, do a small jump to get over it
        if (this.onGround && Math.abs(this.vx) < 0.5 && Math.abs(targetVx) > 1.0) {
            this.vy = -5.5;
            audio.playJump();
        }

        // Shift to BLUE_STOMP after 8 seconds
        if (this.stateTimer > 480) {
            this.state = 'BLUE_STOMP';
            this.stateTimer = 0;
            this.vx = 0;
            this.stompCount = 0;
            this.stompState = 'idle';
            this.stompTimer = 0;
            audio.playShift('LOW'); // Shift sound
        }
    }

    updateBlueStomp(level, player) {
        this.stateTimer++;

        const prepTime = this.health <= 2 ? 50 : 100;
        const cooldownTime = this.health <= 2 ? 45 : 90;
        const stompSpeed = this.health <= 2 ? 6.0 : 4.86;

        if (this.stompState === 'idle') {
            // Unconditional prep: slow down slightly to jump
            this.vx += (0 - this.vx) * 0.15;
            this.stompTimer++;
            if (this.stompTimer > prepTime) { // Prep time
                this.stompState = 'jumping';
                this.stompTimer = 0;
                this.vy = this.health <= 2 ? -17.0 : -15.2; // Massive jump force
                this.vx = Math.sign(player.x - this.x) * stompSpeed; // Increased by 35% (from 3.6)
                audio.playJump();
                this.squishX = -0.3;
                this.squishY = 0.4;
            }
        } 
        else if (this.stompState === 'jumping') {
            // Dynamic mid-air steering (Air Control) towards player
            const targetVx = Math.sign(player.x - this.x) * stompSpeed; // Increased by 35% (from 3.6)
            this.vx += (targetVx - this.vx) * 0.08;
            this.rollAngle = (this.rollAngle || 0) + this.vx * 0.05;

            if (this.onGround) {
                this.stompState = 'cooldown';
                this.stompTimer = 0;
                this.vx = 0;
                audio.playLand(12);
                if (player.game) {
                    player.game.shakeCamera(16, 24);
                    player.game.emitParticles(this.x, this.y + this.radius, 'land', '#06b6d4', 18);
                }
                this.squishX = 0.45;
                this.squishY = -0.4;

                // Knock player off walls if they are clinging on stomp impact
                if (player.isClinging) {
                    player.isClinging = false;
                    player.clingingWall = 0;
                    player.clingCooldown = 60; // 1 second cooldown
                    player.vy = 2.0; // Start falling down
                    player.takeDamage(1); // Take damage from wall vibration
                }
            }
        }
        else if (this.stompState === 'cooldown') {
            this.vx = 0;
            this.stompTimer++;
            if (this.stompTimer > cooldownTime) { // Rest briefly
                this.stompCount++;
                this.stompState = 'idle';
                this.stompTimer = 0;

                // Shift to PINK_SWEEP after 3 jumps
                if (this.stompCount >= 3) {
                    this.state = 'PINK_SWEEP';
                    this.stateTimer = 0;
                    this.sweepTimer = 0;
                    this.stompState = 'idle'; // Reset stomp state for pink phase
                    audio.playShift('HIGH');
                }
            }
        }
    }

    /**
     * PINK_SWEEP: Expands horizontal ground shockwaves
     */
    updatePinkSweep(level, player) {
        this.stateTimer++;

        const hopPrepTime = this.health <= 2 ? 87 : 139; // Jump rate increased by 15% (100→87, 160→139)
        const cooldownTime = this.health <= 2 ? 30 : 60;

        if (this.stompState === 'idle') {
            // Slow heavy walk towards player (speed increased by 35%: from 0.56 to 0.76)
            const targetVx = Math.sign(player.x - this.x) * 0.76;
            this.vx += (targetVx - this.vx) * 0.05;

            this.sweepTimer++;
            if (this.sweepTimer > hopPrepTime) { // Hop prep time
                this.stompState = 'jumping';
                this.sweepTimer = 0;
                this.vy = -4.37; // Jump force increased by 15% (from -3.8)
                // Jump speed increased by 35%: from 0.84 to 1.13
                this.vx = Math.sign(player.x - this.x) * 1.13;
                audio.playJump();
                this.squishX = -0.2;
                this.squishY = 0.25;
            }
        }
        else if (this.stompState === 'jumping') {
            if (this.onGround) {
                this.stompState = 'cooldown';
                this.sweepTimer = 0;
                this.vx = 0;
                audio.playStomp();
                if (player.game) {
                    player.game.shakeCamera(10, 16);
                }
                // Spawn circular shockwave
                if (this.health > 2 || (this.enragedShockwaveCooldown || 0) <= 0) {
                    this.shockwaves.push({
                        x: this.x,
                        y: this.y + this.radius - 4,
                        radius: 10,
                        maxRadius: this.health <= 2 ? 350 : 308,
                        speed: this.health <= 2 ? 5.5 : 4.5,
                        hasHitPlayer: false
                    });
                    if (this.health <= 2) {
                        this.enragedShockwaveCooldown = 150; // 2.5s cooldown
                    }
                }
                this.squishX = 0.3;
                this.squishY = -0.3;
            }
        }
        else if (this.stompState === 'cooldown') {
            this.vx = 0;
            this.sweepTimer++;
            if (this.sweepTimer > cooldownTime) { // Rest briefly
                this.stompState = 'idle';
                this.sweepTimer = 0;
            }
        }

        // Shift to SLEEP after 8 seconds (Skip sleep and go to GREEN_ROLL if enraged)
        if (this.stateTimer > 480) {
            if (this.health <= 2) {
                this.state = 'GREEN_ROLL';
                this.stateTimer = 0;
                audio.playShift('NORMAL');
            } else {
                this.state = 'SLEEP';
                this.stateTimer = 0;
                this.vx = 0;
                this.zzzTimer = 0;
                this.zzzParticles = [];
            }
        }
    }

    /**
     * SLEEP: Tired, vulnerable sleep state
     */
    updateSleep(level, player) {
        this.stateTimer++;
        this.zzzTimer++;
        this.vx = 0;

        // Spawn "Zzz" text particles
        if (this.zzzTimer % 35 === 0) {
            this.zzzParticles.push({
                x: this.x + (Math.random() * 20 - 10),
                y: this.y - this.radius,
                vx: Math.random() * 0.6 - 0.3,
                vy: -0.9 - Math.random() * 0.6,
                text: Math.random() > 0.4 ? 'Zzz' : 'zZz',
                size: 10 + Math.random() * 6,
                alpha: 1.0
            });
        }

        // Wake up after 20 seconds (1200 frames)
        if (this.stateTimer > 1200) {
            this.wakeUp();
        }
    }

    /**
     * Wake up boss and switch back to GREEN_ROLL
     */
    wakeUp() {
        this.state = 'GREEN_ROLL';
        this.stateTimer = 0;
        this.zzzParticles = [];
        this.vx = 0;
        audio.playShift('NORMAL');
        this.squishX = -0.2;
        this.squishY = 0.2;
    }

    /**
     * Update expanding ground shockwaves
     */
    updateShockwaves(player) {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed;

            // Damage player if they are inside the expanding circle area and close to ground level
            const dx = player.x - sw.x;
            const dy = player.y - sw.y;
            const distToSW = Math.sqrt(dx * dx + dy * dy);
            
            // Check if player is inside the circular area
            if (distToSW < sw.radius) {
                if (!sw.hasHitPlayer && !player.isDead) {
                    const isPlayerPink = player.viscosity.id === 'HIGH';
                    if (!isPlayerPink) {
                        player.takeDamage(1);
                    }
                    sw.hasHitPlayer = true;

                    // Knock player off walls if hit by the shockwave
                    if (player.isClinging) {
                        player.isClinging = false;
                        player.clingingWall = 0;
                        player.clingCooldown = 60;
                        player.vy = 2.0; // Start falling down
                    }
                }
            }

            // Remove out-of-bounds shockwaves
            if (sw.radius >= sw.maxRadius) {
                this.shockwaves.splice(i, 1);
            }
        }
    }

    /**
     * Update sleepy Zzz floating particles
     */
    updateZzzParticles() {
        for (let i = this.zzzParticles.length - 1; i >= 0; i--) {
            const p = this.zzzParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.007;

            if (p.alpha <= 0) {
                this.zzzParticles.splice(i, 1);
            }
        }
    }

    /**
     * Stomp damage checking (vulnerability) when player lands on head
     */
    checkPlayerCollision(player) {
        if (this.isDead || player.isDead) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Circular overlap check
        if (dist < player.radius + this.radius - 4) {
            
            // Check if player is hitting head while boss is asleep
            if (this.state === 'SLEEP' && this.invulnFrames === 0) {
                const stompVy = player.vy > 0 ? player.vy : (player.prevVy > 0 ? player.prevVy : 0);
                const isSteppingOn = stompVy >= 0 && player.y + player.radius - stompVy <= this.y - this.radius + 15;

                if (isSteppingOn) {
                    // Stomp hit!
                    player.vy = -7.5;
                    player.onGround = false;
                    player.applySquish(-0.4, 0.45);
                    this.takeDamage(1, player);
                    return;
                }
            }

            // Normal state: Boss inflicts damage to player (only if boss is not invulnerable)
            if (this.state !== 'SLEEP' && this.invulnFrames === 0) {
                player.takeDamage(1);
            }
        }
    }

    /**
     * Checks if a falling push block hit the boss
     */
    checkPushBlockDamage(level, player) {
        if (this.isDead || this.invulnFrames > 0) return;

        if (level.pushBlocks) {
            level.pushBlocks.forEach(block => {
                if (block.broken) return;

                // Check if block is falling and overlaps the boss
                if (block.vy > 0.4) {
                    let closestX = Math.max(block.x, Math.min(this.x, block.x + block.w));
                    let closestY = Math.max(block.y, Math.min(this.y, block.y + block.h));
                    let dx = this.x - closestX;
                    let dy = this.y - closestY;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.radius) {
                        // Ensure it hits the top half of the boss (on his head)
                        if (block.y + block.h <= this.y + 20) {
                            this.takeDamage(1, player);
                            
                            // Shatter the block immediately on impact for satisfying visual feedback
                            block.broken = true;
                            block.respawnTimer = 1200; // 20 seconds respawn (1200 frames at 60fps)
                            audio.playBlockPush();
                            if (player.game) {
                                player.game.shakeCamera(5, 8);
                                player.game.emitParticles(block.x + block.w / 2, block.y + block.h / 2, 'enemy_pop', '#64748b', 20);
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Checks if the boss collides with a push block to shatter it
     */
    checkPushBlockCollision(level, player) {
        if (this.isDead) return;

        if (level.pushBlocks) {
            level.pushBlocks.forEach(block => {
                if (block.broken) return;

                let closestX = Math.max(block.x, Math.min(this.x, block.x + block.w));
                let closestY = Math.max(block.y, Math.min(this.y, block.y + block.h));
                let dx = this.x - closestX;
                let dy = this.y - closestY;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.radius) {
                    // Shatter the block!
                    block.broken = true;
                    block.respawnTimer = 1200; // 20 seconds (1200 frames at 60fps)
                    audio.playBlockPush(); // Play sound effect
                    
                    // Emit slate/debris colored particles
                    if (player.game) {
                        player.game.shakeCamera(4, 6);
                        player.game.emitParticles(block.x + block.w / 2, block.y + block.h / 2, 'enemy_pop', '#64748b', 15);
                    }
                }
            });
        }
    }

    /**
     * Deal damage to boss
     */
    takeDamage(amount, player) {
        if (this.isDead || this.invulnFrames > 0) return;

        this.health -= amount;
        this.invulnFrames = 40; // 0.6 seconds invuln
        this.squishX = 0.5;
        this.squishY = -0.5;
        audio.playDamage();

        if (player && player.game) {
            player.game.shakeCamera(12, 18);
            player.game.emitParticles(this.x, this.y, 'enemy_pop', this.getStateColor(), 30);
        }

        if (this.health <= 0) {
            this.die(player);
        } else {
            // Wake up immediately upon taking damage
            this.wakeUp();
        }
    }

    /**
     * Trigger boss death sequence
     */
    die(player) {
        this.isDead = true;
        this.vx = 0;
        this.vy = 0;
        this.shockwaves = [];
        audio.playWin();

        if (player && player.game) {
            player.game.shakeCamera(18, 30);
            player.game.emitParticles(this.x, this.y, 'enemy_pop', '#ffffff', 45);
            player.game.emitParticles(this.x, this.y, 'enemy_pop', '#eab308', 30);
        }
    }

    /**
     * Resolve collisions with platforms (normal, moving, breakable, falling)
     */
    resolveCollisions(level) {
        this.onGround = false;
        
        const activeFalling = level.fallingPlatforms ? level.fallingPlatforms.filter(p => !p.fallen) : [];
        const activeBreakable = level.breakablePlatforms ? level.breakablePlatforms.filter(p => !p.broken) : [];
        const allPlats = [
            ...(level.platforms ? level.platforms.filter(p => !p.passage) : []),
            ...(level.movingPlatforms || []),
            ...activeFalling,
            ...activeBreakable
        ];

        // 1. Vertical collisions
        this.y += this.vy;
        for (const plat of allPlats) {
            let closestX = Math.max(plat.x, Math.min(this.x, plat.x + plat.w));
            let closestY = Math.max(plat.y, Math.min(this.y, plat.y + plat.h));
            let dx = this.x - closestX;
            let dy = this.y - closestY;
            let distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

            if (distance < this.radius) {
                if (Math.abs(dy) > Math.abs(dx)) {
                    if (this.vy > 0 && this.y < plat.y) {
                        this.y = plat.y - this.radius;
                        this.vy = 0;
                        this.onGround = true;
                    } else if (this.vy < 0 && this.y > plat.y + plat.h) {
                        this.y = plat.y + plat.h + this.radius;
                        this.vy = 0;
                    }
                }
            }
        }

        // 2. Horizontal collisions
        this.x += this.vx;
        for (const plat of allPlats) {
            let closestX = Math.max(plat.x, Math.min(this.x, plat.x + plat.w));
            let closestY = Math.max(plat.y, Math.min(this.y, plat.y + plat.h));
            let dx = this.x - closestX;
            let dy = this.y - closestY;
            let distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

            if (distance < this.radius) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (this.vx > 0 && this.x < plat.x) {
                        this.x = plat.x - this.radius;
                        this.vx = -this.vx * 0.4;
                    } else if (this.vx < 0 && this.x > plat.x + plat.w) {
                        this.x = plat.x + plat.w + this.radius;
                        this.vx = -this.vx * 0.4;
                    }
                }
            }
        }

        // 3. Screen bounds restriction
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = -this.vx * 0.5;
        } else if (this.x > level.width - this.radius) {
            this.x = level.width - this.radius;
            this.vx = -this.vx * 0.5;
        }
    }

    /**
     * Get primary color code based on phase
     */
    getStateColor() {
        if (this.health <= 2) {
            const cycle = Math.floor(this.pulseTime * 8) % 3;
            if (cycle === 0) return '#10b981'; // Green
            if (cycle === 1) return '#06b6d4'; // Cyan
            return '#d946ef'; // Pink
        }
        if (this.state === 'GREEN_ROLL') return '#10b981'; // Green
        if (this.state === 'BLUE_STOMP') return '#06b6d4'; // Cyan
        if (this.state === 'PINK_SWEEP') return '#d946ef'; // Pink
        if (this.state === 'SLEEP') return '#64748b';      // Gray
        return '#f43f5e';
    }

    /**
     * Get secondary color code based on phase
     */
    getStateSecondaryColor() {
        if (this.health <= 2) {
            const cycle = Math.floor(this.pulseTime * 8) % 3;
            if (cycle === 0) return '#047857'; // Green
            if (cycle === 1) return '#0891b2'; // Cyan
            return '#a21caf'; // Pink
        }
        if (this.state === 'GREEN_ROLL') return '#047857';
        if (this.state === 'BLUE_STOMP') return '#0891b2';
        if (this.state === 'PINK_SWEEP') return '#a21caf';
        if (this.state === 'SLEEP') return '#334155';
        return '#e11d48';
    }

    /**
     * Draw Boss and health bar
     */
    draw(ctx, camera, level) {
        if (this.isDead) return;

        // 1. Draw shockwaves in world coordinates (Expanding circles area)
        this.shockwaves.forEach(sw => {
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            const alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
            
            // Draw filled area
            ctx.fillStyle = `rgba(217, 70, 239, ${alpha * 0.18})`;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw border line
            ctx.strokeStyle = `rgba(217, 70, 239, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        });

        // 2. Draw Zzz particles in world coordinates
        this.zzzParticles.forEach(p => {
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha})`;
            ctx.font = `bold ${p.size}px Courier New, monospace`;
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        });

        // 2.5. Draw stomp landing warning if boss is in BLUE_STOMP jumping phase
        const activeLevel = level || this.levelRef;
        if (this.state === 'BLUE_STOMP' && this.stompState === 'jumping' && activeLevel) {
            let landingY = activeLevel.height;
            const allPlats = [
                ...(activeLevel.platforms || []),
                ...(activeLevel.movingPlatforms || []),
                ...(activeLevel.fallingPlatforms ? activeLevel.fallingPlatforms.filter(p => !p.fallen) : []),
                ...(activeLevel.breakablePlatforms ? activeLevel.breakablePlatforms.filter(p => !p.broken) : [])
            ];
            
            for (const plat of allPlats) {
                if (this.x >= plat.x && this.x <= plat.x + plat.w) {
                    if (plat.y > this.y && plat.y < landingY) {
                        landingY = plat.y;
                    }
                }
            }
            
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            
            const pulse = (Math.sin(this.pulseTime * 8) + 1) / 2;
            const warnAlpha = 0.3 + pulse * 0.5;
            
            // Draw vertical laser warning line
            const beamGrad = ctx.createLinearGradient(this.x, this.y, this.x, landingY);
            beamGrad.addColorStop(0, `rgba(239, 68, 68, 0)`);
            beamGrad.addColorStop(1, `rgba(239, 68, 68, ${warnAlpha * 0.45})`);
            ctx.fillStyle = beamGrad;
            ctx.fillRect(this.x - 3, this.y, 6, landingY - this.y);
            
            // Draw target circle
            ctx.strokeStyle = `rgba(239, 68, 68, ${warnAlpha})`;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10 + pulse * 8;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.arc(this.x, landingY, 24, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(this.x, landingY, 12, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(239, 68, 68, ${warnAlpha * 0.9})`;
            ctx.beginPath();
            ctx.arc(this.x, landingY, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }

        // 3. Draw Boss body in world coordinates
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        const currentRadius = this.radius + Math.sin(this.pulseTime * 2) * 1.2;
        const color = this.getStateColor();
        const secColor = this.getStateSecondaryColor();

        // Glow effects (fades if invulnerable blinking)
        if (this.invulnFrames === 0 || Math.floor(this.invulnFrames / 4) % 2 === 0) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 18 + Math.abs(Math.sin(this.pulseTime) * 6);
        }

        // Apply deformation matrix for squash/stretch
        ctx.translate(this.x, this.y);
        ctx.scale(1 + this.squishX, 1 + this.squishY);

        if (this.state === 'GREEN_ROLL') {
            ctx.rotate(this.rollAngle || 0);
        }

        const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, currentRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, color);
        grad.addColorStop(1, secColor);
        ctx.fillStyle = grad;

        if (this.state === 'GREEN_ROLL' || this.health <= 2) {
            // Spiky virus-like body
            ctx.beginPath();
            const numSpikes = 10;
            for (let i = 0; i < numSpikes; i++) {
                const angle = (i / numSpikes) * Math.PI * 2 + (this.pulseTime * 0.12);
                const outerR = currentRadius + 8;
                const innerR = currentRadius;
                
                const sx = Math.cos(angle) * outerR;
                const sy = Math.sin(angle) * outerR;

                const nextAngle = ((i + 0.5) / numSpikes) * Math.PI * 2 + (this.pulseTime * 0.12);
                const ix = Math.cos(nextAngle) * innerR;
                const iy = Math.sin(nextAngle) * innerR;

                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
                ctx.lineTo(ix, iy);
            }
            ctx.closePath();
            ctx.fill();
        } 
        else if (this.state === 'BLUE_STOMP') {
            // Liquid blob body
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.state === 'PINK_SWEEP') {
            // Sticky circle
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.state === 'SLEEP') {
            // Dim sleep body (shrinks slightly)
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius * 0.95, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw sticky nodes around body if in PINK_SWEEP state OR if enraged (health <= 2)
        if (this.state === 'PINK_SWEEP' || this.health <= 2) {
            ctx.fillStyle = secColor;
            ctx.shadowBlur = 0;
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + (this.pulseTime * 0.05);
                const nx = Math.cos(angle) * (currentRadius - 2);
                const ny = Math.sin(angle) * (currentRadius - 2);
                ctx.beginPath();
                ctx.arc(nx, ny, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 4. Draw Boss eye(s)
        ctx.shadowBlur = 0;
        if (this.state === 'SLEEP') {
            // Sleeping eyes: _ _
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            // Left eye curve
            ctx.arc(-8, -4, 4, 0, Math.PI, false);
            // Right eye curve
            ctx.arc(8, -4, 4, 0, Math.PI, false);
            ctx.stroke();
        } else {
            // Aggressive eye
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, -5, 8, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = '#ef4444'; // Red pupil
            let lookX = 0;
            if (Math.abs(this.vx) > 0.1) lookX = Math.sign(this.vx) * 2.5;
            ctx.beginPath();
            ctx.arc(lookX, -5, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // 5. Draw Boss health bar at top center of canvas (Absolute HUD space)
        ctx.save();
        
        const cssWidth = ctx.canvas.clientWidth || window.innerWidth;
        const dpr = ctx.canvas.width / cssWidth;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Keep DPR scaling, reset camera zoom/translation

        const barW = 320;
        const barH = 14;
        const barX = (cssWidth - barW) / 2;
        const barY = 28;

        // Container background
        ctx.fillStyle = '#0b0f19';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;

        this.drawRoundedRectHelper(ctx, barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        // Boss Name label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VISCORUPTOR - SLIME KING', barX + barW / 2, barY - 8);

        // Fill HP segments
        const healthPercent = Math.max(0, this.health / this.maxHealth);
        const hpColor = this.getStateColor();

        if (healthPercent > 0) {
            ctx.fillStyle = hpColor;
            ctx.shadowColor = hpColor;
            ctx.shadowBlur = 8;
            this.drawRoundedRectHelper(ctx, barX + 2, barY + 2, (barW - 4) * healthPercent, barH - 4, 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawRoundedRectHelper(ctx, x, y, w, h, radius) {
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

export class CyberBoss extends Boss {
    constructor(x, y) {
        super(x, y);
        this.radius = 42;
        this.health = 4;
        this.maxHealth = 4;

        this.state = 'GREEN_ATTACK'; // 'GREEN_ATTACK', 'BLUE_STOMP', 'PINK_LASER', 'OVERHEAT', 'DESPERATE_INTRO', 'RAGE_MODE'
        this.stateTimer = 0;
        this.projectiles = [];
        this.laserTimer = 0;
        this.laserCharged = false;

        this.jumpCount = 0;
        this.stompState = 'idle'; // 'idle', 'jumping', 'cooldown'
        this.stompTimer = 0;

        this.desperation = false;
        this.introTimer = 0;

        this.rageAttackTimer = 0;
        this.overheatTimer = 0;
        this.invulnFrames = 0;
    }

    die(player) {
        super.die(player);
        this.projectiles = [];
        this.laserCharged = false;
    }

    update(level, player) {
        if (this.isDead) {
            this.projectiles = []; // Safeguard
            this.laserCharged = false;
            this.resolveCollisions(level);
            return;
        }

        this.levelRef = level;
        this.playerRef = player;
        this.pulseTime += 0.05;
        if (this.invulnFrames > 0) this.invulnFrames--;

        this.squishX *= 0.85;
        this.squishY *= 0.85;

        // Apply gravity
        this.vy += 0.32;

        // Update green projectiles
        this.updateProjectiles(level, player);

        // Check push block collisions
        this.checkPushBlockDamage(level, player);
        this.checkPushBlockCollision(level, player);

        // State Machine
        switch (this.state) {
            case 'GREEN_ATTACK':
                this.updateGreenAttack(level, player);
                break;
            case 'BLUE_STOMP':
                this.updateBlueStompState(level, player);
                break;
            case 'PINK_LASER':
                this.updatePinkLaser(level, player);
                break;
            case 'OVERHEAT':
                this.updateOverheat(level, player);
                break;
            case 'DESPERATE_INTRO':
                this.updateDesperateIntro(level, player);
                break;
            case 'RAGE_MODE':
                this.updateRageMode(level, player);
                break;
        }

        // Apply vertical/horizontal collisions
        this.resolveCollisions(level);
    }

    checkPushBlockDamage(level, player) {
        if (this.isDead || this.invulnFrames > 0) return;

        if (level.pushBlocks) {
            level.pushBlocks.forEach(block => {
                if (block.broken) return;

                if (block.vy > 0.4) {
                    let closestX = Math.max(block.x, Math.min(this.x, block.x + block.w));
                    let closestY = Math.max(block.y, Math.min(this.y, block.y + block.h));
                    let dx = this.x - closestX;
                    let dy = this.y - closestY;
                    let distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.radius) {
                        if (block.y + block.h <= this.y + 20) {
                            this.takeDamage(1, player);
                            block.broken = true;
                            block.respawnTimer = 450; // 7.5 seconds respawn for CyberBoss!
                            audio.playBlockPush();
                            if (player.game) {
                                player.game.shakeCamera(5, 8);
                                player.game.emitParticles(block.x + block.w / 2, block.y + block.h / 2, 'enemy_pop', '#64748b', 20);
                            }
                        }
                    }
                }
            });
        }
    }

    checkPushBlockCollision(level, player) {
        if (this.isDead) return;

        if (level.pushBlocks) {
            level.pushBlocks.forEach(block => {
                if (block.broken) return;

                let closestX = Math.max(block.x, Math.min(this.x, block.x + block.w));
                let closestY = Math.max(block.y, Math.min(this.y, block.y + block.h));
                let dx = this.x - closestX;
                let dy = this.y - closestY;
                let distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.radius) {
                    block.broken = true;
                    block.respawnTimer = 450; // 7.5 seconds respawn for CyberBoss!
                    audio.playBlockPush();
                    if (player.game) {
                        player.game.shakeCamera(4, 6);
                        player.game.emitParticles(block.x + block.w / 2, block.y + block.h / 2, 'enemy_pop', '#64748b', 15);
                    }
                }
            });
        }
    }

    updateGreenAttack(level, player) {
        this.stateTimer++;
        // Slow walk towards player
        const speed = 0.8;
        this.vx += (Math.sign(player.x - this.x) * speed - this.vx) * 0.05;

        if (this.stateTimer % 75 === 0) {
            // Shoot 4-way cross projectiles
            const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
            angles.forEach(angle => {
                const spd = 3.2;
                this.projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    radius: 9,
                    color: '#10b981',
                    life: 300
                });
            });
            audio.playJump();
            if (player.game) {
                player.game.emitParticles(this.x, this.y, 'enemy_pop', '#10b981', 10);
            }
        }

        if (this.stateTimer >= 300) {
            this.state = 'BLUE_STOMP';
            this.stateTimer = 0;
            this.jumpCount = 0;
            this.stompState = 'idle';
            this.stompTimer = 0;
            this.vx = 0;
            audio.playShift('LOW');
        }
    }

    updateBlueStompState(level, player) {
        if (this.stompState === 'idle') {
            this.vx += (0 - this.vx) * 0.1;
            this.stompTimer++;
            if (this.stompTimer > 45) {
                this.stompState = 'jumping';
                this.stompTimer = 0;
                this.vy = -14.0;
                this.vx = Math.sign(player.x - this.x) * 4.5;
                audio.playJump();
                this.squishX = -0.3;
                this.squishY = 0.35;
            }
        } else if (this.stompState === 'jumping') {
            // Steer mid-air
            this.vx += (Math.sign(player.x - this.x) * 4.5 - this.vx) * 0.05;
            if (this.onGround) {
                this.stompState = 'cooldown';
                this.stompTimer = 0;
                this.vx = 0;
                audio.playLand(12);
                if (player.game) {
                    player.game.shakeCamera(12, 18);
                    player.game.emitParticles(this.x, this.y + this.radius, 'land', '#06b6d4', 15);
                }
                this.squishX = 0.4;
                this.squishY = -0.35;
            }
        } else if (this.stompState === 'cooldown') {
            this.stompTimer++;
            if (this.stompTimer > 45) {
                this.jumpCount++;
                this.stompState = 'idle';
                this.stompTimer = 0;
                if (this.jumpCount >= 2) {
                    this.state = 'PINK_LASER';
                    this.stateTimer = 0;
                    this.laserTimer = 0;
                    this.laserCharged = false;
                    this.vx = 0;
                    audio.playShift('HIGH');
                }
            }
        }
    }

    updatePinkLaser(level, player) {
        this.vx += (0 - this.vx) * 0.1;
        this.laserTimer++;

        if (this.laserTimer < 120) {
            // Charging phase
            this.laserCharged = false;
            if (this.laserTimer % 15 === 0) {
                audio.playStomp();
            }
        } else if (this.laserTimer < 240) {
            // Firing phase
            this.laserCharged = true;

            const isBlocked = this.isLineBlockedByPlatforms(this.x, this.y, player.x, player.y, level);
            const isPlayerPink = player.viscosity.id === 'HIGH';

            if (!isBlocked && !isPlayerPink && !player.isDead) {
                player.takeDamage(1);
            }
        } else {
            this.state = 'OVERHEAT';
            this.stateTimer = 0;
            this.overheatTimer = 0;
            this.laserCharged = false;
            audio.playShift('LOW');
        }
    }

    updateOverheat(level, player) {
        this.vx = 0;
        this.overheatTimer++;

        if (this.overheatTimer % 30 === 0 && player.game) {
            player.game.emitParticles(this.x, this.y - this.radius, 'steam', '#ef4444', 5);
        }

        if (this.overheatTimer >= 180) {
            this.wakeUp();
        }
    }

    updateDesperateIntro(level, player) {
        this.vx = 0;
        this.introTimer++;
        if (this.introTimer % 8 === 0 && player.game) {
            player.game.emitParticles(this.x, this.y, 'steam', '#ec4899', 4);
        }

        if (this.onGround) {
            this.vy = -4.5;
            audio.playJump();
            if (player.game) {
                player.game.emitParticles(this.x, this.y + this.radius, 'land', '#ef4444', 8);
            }
        }

        if (this.introTimer >= 120) {
            this.state = 'RAGE_MODE';
            this.stateTimer = 0;
            this.rageAttackTimer = 0;
        }
    }

    updateRageMode(level, player) {
        this.stateTimer++;
        this.rageAttackTimer++;

        const speed = 1.3;
        this.vx += (Math.sign(player.x - this.x) * speed - this.vx) * 0.05;

        // Periodic green projectiles (every 100 frames)
        if (this.rageAttackTimer % 100 === 0) {
            const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
            angles.forEach(angle => {
                const spd = 3.5;
                this.projectiles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * spd,
                    vy: Math.sin(angle) * spd,
                    radius: 9,
                    color: '#10b981',
                    life: 240
                });
            });
            audio.playJump();
        }

        // Periodic hops
        if (this.rageAttackTimer % 140 === 0 && this.onGround) {
            this.vy = -7.5;
            audio.playJump();
        }

        // Periodic brief pink laser sweep (every 450 frames)
        const laserCycle = this.rageAttackTimer % 450;
        if (laserCycle >= 330 && laserCycle < 450) {
            if (laserCycle < 390) {
                this.laserCharged = false; // Warning charging phase (60 frames)
                if (laserCycle % 15 === 0) {
                    audio.playStomp();
                }
            } else {
                this.laserCharged = true; // Firing phase (60 frames)
                const isBlocked = this.isLineBlockedByPlatforms(this.x, this.y, player.x, player.y, level);
                const isPlayerPink = player.viscosity.id === 'HIGH';
                if (!isBlocked && !isPlayerPink && !player.isDead) {
                    player.takeDamage(1);
                }
            }
        } else {
            this.laserCharged = false;
        }

        // Overheat every 12 seconds (Only if health > 1. In the final enraged form, it never overheats/sleeps!)
        if (this.rageAttackTimer >= 720 && this.health > 1) {
            this.state = 'OVERHEAT';
            this.stateTimer = 0;
            this.overheatTimer = 0;
            this.laserCharged = false;
            audio.playShift('LOW');
        }
    }

    wakeUp() {
        if (this.health === 1) {
            this.state = 'DESPERATE_INTRO';
            this.stateTimer = 0;
            this.introTimer = 0;
            this.desperation = true;
        } else {
            this.state = 'GREEN_ATTACK';
            this.stateTimer = 0;
        }
        this.vx = 0;
    }

    isLineBlockedByPlatforms(x1, y1, x2, y2, level) {
        const steps = 30;
        const allPlats = [
            ...(level.platforms || []),
            ...(level.movingPlatforms || []),
            ...(level.fallingPlatforms ? level.fallingPlatforms.filter(p => !p.fallen) : []),
            ...(level.breakablePlatforms ? level.breakablePlatforms.filter(p => !p.broken) : [])
        ];
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            for (const plat of allPlats) {
                if (px >= plat.x && px <= plat.x + plat.w && py >= plat.y && py <= plat.y + plat.h) {
                    return true;
                }
            }
        }
        return false;
    }

    updateProjectiles(level, player) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            const allPlats = [
                ...(level.platforms || []),
                ...(level.movingPlatforms || []),
                ...(level.fallingPlatforms ? level.fallingPlatforms.filter(pl => !pl.fallen) : []),
                ...(level.breakablePlatforms ? level.breakablePlatforms.filter(pl => !pl.broken) : [])
            ];

            for (const plat of allPlats) {
                if (p.x + p.radius > plat.x && p.x - p.radius < plat.x + plat.w &&
                    p.y + p.radius > plat.y && p.y - p.radius < plat.y + plat.h) {
                    if (p.x - p.vx <= plat.x || p.x - p.vx >= plat.x + plat.w) {
                        p.vx = -p.vx;
                    } else {
                        p.vy = -p.vy;
                    }
                    break;
                }
            }

            if (p.x < p.radius || p.x > level.width - p.radius) p.vx = -p.vx;
            if (p.y < p.radius || p.y > level.height - p.radius) p.vy = -p.vy;

            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < player.radius + p.radius - 2) {
                if (!player.isDead) {
                    player.takeDamage(1);
                }
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    checkPlayerCollision(player) {
        if (this.isDead || player.isDead) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.radius + this.radius - 4) {
            if (this.state === 'OVERHEAT' && this.invulnFrames === 0) {
                const stompVy = player.vy > 0 ? player.vy : (player.prevVy > 0 ? player.prevVy : 0);
                const isSteppingOn = stompVy >= 0 && player.y + player.radius - stompVy <= this.y - this.radius + 20;

                if (isSteppingOn) {
                    this.takeDamage(1, player);
                    player.vy = -9.0;
                    player.vx = Math.sign(player.x - this.x) * 8.0;
                    player.onGround = false;
                    player.applySquish(-0.4, 0.5);
                    audio.playLand(15);
                    return;
                }
            }

            if (this.state !== 'OVERHEAT' && this.invulnFrames === 0) {
                player.takeDamage(1);
            }
        }
    }

    getStateColor() {
        if (this.state === 'GREEN_ATTACK') return '#10b981';
        if (this.state === 'BLUE_STOMP') return '#06b6d4';
        if (this.state === 'PINK_LASER') {
            if (!this.laserCharged) {
                // Flash pink and red during warning phase
                return Math.floor(this.pulseTime * 15) % 2 === 0 ? '#ef4444' : '#d946ef';
            }
            return '#d946ef';
        }
        if (this.state === 'OVERHEAT') return '#ef4444';
        if (this.state === 'DESPERATE_INTRO' || this.state === 'RAGE_MODE') {
            const cycle = this.rageAttackTimer % 450;
            if (cycle >= 330 && cycle < 390) {
                return Math.floor(this.pulseTime * 15) % 2 === 0 ? '#ef4444' : '#ec4899';
            }
            return Math.floor(this.pulseTime * 10) % 2 === 0 ? '#ef4444' : '#f43f5e';
        }
        return '#f43f5e';
    }

    getStateSecondaryColor() {
        if (this.state === 'GREEN_ATTACK') return '#047857';
        if (this.state === 'BLUE_STOMP') return '#0891b2';
        if (this.state === 'PINK_LASER') return '#a21caf';
        if (this.state === 'OVERHEAT') return '#991b1b';
        return '#be123c';
    }

    draw(ctx, camera, level) {
        if (this.isDead) return;

        // Draw projectiles
        this.projectiles.forEach(p => {
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        const activeLevel = level || this.levelRef;

        // Draw stomp landing warning if boss is in BLUE_STOMP jumping phase
        if (this.state === 'BLUE_STOMP' && this.stompState === 'jumping' && activeLevel) {
            let landingY = activeLevel.height;
            const allPlats = [
                ...(activeLevel.platforms || []),
                ...(activeLevel.movingPlatforms || []),
                ...(activeLevel.fallingPlatforms ? activeLevel.fallingPlatforms.filter(p => !p.fallen) : []),
                ...(activeLevel.breakablePlatforms ? activeLevel.breakablePlatforms.filter(p => !p.broken) : [])
            ];
            
            for (const plat of allPlats) {
                if (this.x >= plat.x && this.x <= plat.x + plat.w) {
                    if (plat.y > this.y && plat.y < landingY) {
                        landingY = plat.y;
                    }
                }
            }
            
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            
            const pulse = (Math.sin(this.pulseTime * 8) + 1) / 2;
            const warnAlpha = 0.3 + pulse * 0.5;
            
            // Draw vertical laser warning line
            const beamGrad = ctx.createLinearGradient(this.x, this.y, this.x, landingY);
            beamGrad.addColorStop(0, `rgba(239, 68, 68, 0)`);
            beamGrad.addColorStop(1, `rgba(239, 68, 68, ${warnAlpha * 0.45})`);
            ctx.fillStyle = beamGrad;
            ctx.fillRect(this.x - 3, this.y, 6, landingY - this.y);
            
            // Draw target circle
            ctx.strokeStyle = `rgba(239, 68, 68, ${warnAlpha})`;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10 + pulse * 8;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.arc(this.x, landingY, this.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.restore();
        }

        // Draw laser
        if ((this.state === 'PINK_LASER' || (this.state === 'RAGE_MODE' && this.rageAttackTimer % 450 >= 330)) && activeLevel) {
            const player = this.playerRef || (window.gameInstance ? window.gameInstance.player : null);
            if (player) {
                ctx.save();
                ctx.translate(-camera.x, -camera.y);
                if (this.laserCharged) {
                    // Thick fired laser
                    ctx.strokeStyle = '#d946ef';
                    ctx.lineWidth = 14 + Math.sin(this.pulseTime * 15) * 4;
                    ctx.shadowColor = '#d946ef';
                    ctx.shadowBlur = 24;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(player.x, player.y);
                    ctx.stroke();

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 4;
                    ctx.shadowBlur = 0;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(player.x, player.y);
                    ctx.stroke();
                } else {
                    // Charging Warning Phase
                    ctx.strokeStyle = '#d946ef';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#d946ef';
                    ctx.shadowBlur = 10;
                    ctx.setLineDash([6, 6]);
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(player.x, player.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.shadowBlur = 0;

                    // Concentric warning circles centered on player
                    const warnTimer = this.state === 'PINK_LASER' ? this.laserTimer : (this.rageAttackTimer % 450 - 330);
                    const circleRadius = (1.0 - ((warnTimer / 15) % 1.0)) * 50 + 10;
                    ctx.strokeStyle = `rgba(217, 70, 239, 0.8)`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, circleRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        // Draw overheat text
        if (this.state === 'OVERHEAT') {
            ctx.save();
            ctx.translate(-camera.x, -camera.y);
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 12px Courier New, monospace';
            ctx.textAlign = 'center';
            const pulse = (Math.sin(this.pulseTime * 10) + 1) / 2;
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 4 + pulse * 6;
            ctx.fillText('⚠️ AŞIRI ISINMA / OVERHEAT ⚠️', this.x, this.y - this.radius - 20);
            ctx.fillStyle = '#f8fafc';
            ctx.font = '9px Courier New, monospace';
            ctx.fillText('STOMP ON HEAD!', this.x, this.y - this.radius - 8);
            ctx.restore();
        }

        // Draw core body
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        const color = this.getStateColor();
        const secColor = this.getStateSecondaryColor();
        const currentRadius = this.radius + Math.sin(this.pulseTime * 2.5) * 1.5;

        if (this.invulnFrames === 0 || Math.floor(this.invulnFrames / 4) % 2 === 0) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 20 + Math.abs(Math.sin(this.pulseTime) * 8);
        }

        ctx.translate(this.x, this.y);
        ctx.scale(1 + this.squishX, 1 + this.squishY);

        const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, currentRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, color);
        grad.addColorStop(1, secColor);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, -6, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.state === 'OVERHEAT' ? '#ef4444' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -6, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Armor Ring & Cyber Spikes
        ctx.shadowBlur = 0;

        const drawArmorArc = (startAngle, endAngle) => {
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#64748b';
            ctx.beginPath();
            ctx.arc(0, 0, currentRadius + 5, startAngle, endAngle);
            ctx.stroke();
        };

        const drawSpikesOnArc = (startAngle, endAngle, numSpikes) => {
            ctx.fillStyle = '#334155'; // Dark metallic base
            ctx.strokeStyle = color; // Glow outline using state color
            ctx.lineWidth = 1.5;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            
            for (let i = 0; i < numSpikes; i++) {
                const fraction = numSpikes > 1 ? i / (numSpikes - 1) : 0.5;
                const ang = startAngle + 0.12 + fraction * (endAngle - startAngle - 0.24);
                
                const rBase = currentRadius + 4;
                const rTip = currentRadius + 15 + Math.sin(this.pulseTime * 5 + i) * 1.5;
                const halfBaseAngle = 0.07;
                
                const ax = Math.cos(ang - halfBaseAngle) * rBase;
                const ay = Math.sin(ang - halfBaseAngle) * rBase;
                const bx = Math.cos(ang + halfBaseAngle) * rBase;
                const by = Math.sin(ang + halfBaseAngle) * rBase;
                const tx = Math.cos(ang) * rTip;
                const ty = Math.sin(ang) * rTip;
                
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(tx, ty);
                ctx.lineTo(bx, by);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        };

        if (this.health === 4) {
            drawSpikesOnArc(0.1, 1.9, 5);
            drawSpikesOnArc(2.2, 4.0, 5);
            drawSpikesOnArc(4.3, 6.1, 5);
            
            drawArmorArc(0.1, 1.9);
            drawArmorArc(2.2, 4.0);
            drawArmorArc(4.3, 6.1);
        } else if (this.health === 3) {
            drawSpikesOnArc(0.1, 1.5, 4);
            drawSpikesOnArc(2.4, 4.0, 4);
            
            drawArmorArc(0.1, 1.5);
            drawArmorArc(2.4, 4.0);
            
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(currentRadius + 3, 0);
            ctx.lineTo(currentRadius + 8, 3);
            ctx.stroke();
        } else if (this.health === 2) {
            drawSpikesOnArc(3.0, 4.5, 4);
            
            drawArmorArc(3.0, 4.5);
            
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(currentRadius * -1 - 3, 0);
            ctx.lineTo(currentRadius * -1 - 8, -4);
            ctx.stroke();
        } else if (this.health === 1) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
                const spAngle = Math.random() * Math.PI * 2;
                const spLen = 12 + Math.random() * 8;
                ctx.beginPath();
                ctx.moveTo(Math.cos(spAngle) * currentRadius, Math.sin(spAngle) * currentRadius);
                ctx.lineTo(Math.cos(spAngle) * (currentRadius + spLen), Math.sin(spAngle) * (currentRadius + spLen));
                ctx.stroke();
            }
        }

        ctx.restore();

        // Draw HP segment
        ctx.save();
        const cssWidth = ctx.canvas.clientWidth || window.innerWidth;
        const dpr = ctx.canvas.width / cssWidth;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const barW = 320;
        const barH = 14;
        const barX = (cssWidth - barW) / 2;
        const barY = 28;

        ctx.fillStyle = '#0b0f19';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        this.drawRoundedRectHelper(ctx, barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('VISCOREX - PROTOTİP REAKTÖR', barX + barW / 2, barY - 8);

        const healthPercent = Math.max(0, this.health / this.maxHealth);
        if (healthPercent > 0) {
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            this.drawRoundedRectHelper(ctx, barX + 2, barY + 2, (barW - 4) * healthPercent, barH - 4, 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

