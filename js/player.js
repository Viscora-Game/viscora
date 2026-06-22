import { ViscosityStates } from './viscosity.js?v=v172';
import { audio } from './audio.js?v=v172';

export class Player {
    constructor(x, y, game = null) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.vx = 0;
        this.vy = 0;
        this.radius = 18;
        this.baseRadius = 18;
        
        // Viskozite Ayarları
        this.viscosity = ViscosityStates.NORMAL;
        
        // Dynamic physical parameters for lerping state transition
        this.currentGravity = ViscosityStates.NORMAL.gravity;
        this.currentMaxSpeed = ViscosityStates.NORMAL.maxSpeed;
        this.currentAccel = ViscosityStates.NORMAL.accel;
        this.currentFriction = ViscosityStates.NORMAL.friction;
        
        // State mechanics
        this.slingshotCharge = 0;
        this.isRolling = false;
        this.rollAngle = 0;
        this.ridingPlatform = null;
        this.ridingBlock = null;
        this.clingTimer = 0;
        this.clingCooldown = 0;
        
        // Kinematik Durumları
        this.onGround = false;
        this.wasOnGround = false;
        this.clingingWall = 0; // -1: Sol duvar, 1: Sağ duvar, 0: Yok
        this.isClinging = false;
        this.isStickingCeiling = false;
        
        // Can Sistemi
        this.health = 3;
        this.maxHealth = 3;
        this.invulnerableFrames = 0;
        this.isDead = false;

        // Son hızlar (Leke/Deformasyon hesabı için)
        this.ax = 0;
        this.ay = 0;
        this.prevVx = 0;
        this.prevVy = 0;

        // Yumuşak Gövde (Spring-Mass Blob) Vertex Tanımları
        this.numVertices = 12;
        this.vertices = [];
        this.initVertices();

        // Cilalama / His İyileştirmeleri
        this.trailTimer = 0;
        this.coyoteTimeTimer = 0;
        this.wallCoyoteTimer = 0;
        this.ceilingCoyoteTimer = 0;
        this.lastClingingWall = 0;
        this.jumpBufferTimer = 0;
        this.glowBoost = 0;
        this.onEvent = null;
        this.hasDoubleJumped = false;

        // Alev/Sıcaklık mekanizması durumları
        this.flameHeat = 0; // 0.0 - 1.0 arası alev sıcaklığı
        this.inFlame = false; // Alevin içinde olup olmadığı
    }

    /**
     * Blob etrafında yay sistemini başlatır
     */
    initVertices() {
        this.vertices = [];
        for (let i = 0; i < this.numVertices; i++) {
            const angle = (i / this.numVertices) * Math.PI * 2;
            this.vertices.push({
                angle: angle,
                // Merkeze göre göreceli koordinatlar
                rx: Math.cos(angle) * this.radius,
                ry: Math.sin(angle) * this.radius,
                // Göreceli hızlar
                rvx: 0,
                rvy: 0
            });
        }
    }

    /**
     * Zıplama/Yere düşme gibi aksiyonlarda dış çeperi deforme eder
     */
    applySquish(amountX, amountY) {
        this.vertices.forEach(v => {
            // Açıya göre deforme kuvveti uygula
            const cos = Math.cos(v.angle);
            const sin = Math.sin(v.angle);
            
            // X yönünde genişlet, Y yönünde basıklaştır
            v.rx += cos * amountX * this.radius;
            v.ry += sin * amountY * this.radius;
        });
    }

    /**
     * Viskozite durumunu değiştirir
     */
    setViscosity(stateId) {
        if (this.viscosity.id === stateId) return;

        // Alev içindeyken pembe (HIGH) formdan başka forma geçilirse anında hasar ver
        if (this.viscosity.id === 'HIGH' && stateId !== 'HIGH' && this.inFlame) {
            this.takeDamage(1);
        }

        this.viscosity = ViscosityStates[stateId];
        audio.playShift(stateId);
        audio.updateViscosityFilter(stateId);
        
        // Görsel parlama patlaması
        this.glowBoost = 20;

        // Durum geçişinde hafif bir patlama efekti ver
        this.applySquish(
            stateId === 'LOW' ? 0.35 : -0.25, 
            stateId === 'LOW' ? -0.35 : 0.25
        );
    }

    /**
     * Hasar alma mekanizması
     */
    takeDamage(amount = 1, type = 'normal') {
        if (this.invulnerableFrames > 0 || this.isDead) return;
        
        this.health -= amount;
        this.invulnerableFrames = 60; // 1 saniye dokunulmazlık (60 FPS)
        this.glowBoost = 25; // Hasar durumunda aşırı parlama
        
        audio.playDamage();
        if (navigator.vibrate) navigator.vibrate(60);
        
        if (this.onEvent) this.onEvent('damage');
        
        // Hasarda rastgele şiddetli sarsıntı ver
        this.applySquish(0.6, 0.6);
        
        // Fırlatma tepkisi (Geriye doğru sekme) - Erime durumunda sekme olmaz, karakter durur
        if (type !== 'melt') {
            this.vy = -5.0;
            this.vx = (this.vx > 0 ? -1 : 1) * 4.0;
            this.onGround = false;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
            this.deathType = type;
            if (type === 'melt') {
                this.meltTimer = 120; // 2 saniye toplam süre (erime + yerde yassı bekleme)
                this.meltParticlesEmitted = false;
            }
        }
    }

    /**
     * Oyuncuyu canlandır / Yeniden başlat
     */
    respawn(x, y, targetHealth = null) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.health = targetHealth !== null ? targetHealth : this.maxHealth;
        this.isDead = false;
        this.invulnerableFrames = 0;
        this.viscosity = ViscosityStates.NORMAL;
        this.currentGravity = ViscosityStates.NORMAL.gravity;
        
        // Ölüm değişkenlerini sıfırla
        this.deathType = null;
        this.meltTimer = 0;
        this.deathSplashDone = false;
        this.currentMaxSpeed = ViscosityStates.NORMAL.maxSpeed;
        this.currentAccel = ViscosityStates.NORMAL.accel;
        this.currentFriction = ViscosityStates.NORMAL.friction;
        this.slingshotCharge = 0;
        this.isRolling = false;
        this.rollAngle = 0;
        this.ridingPlatform = null;
        this.ridingBlock = null;
        this.radius = this.baseRadius;
        this.wallCoyoteTimer = 0;
        this.ceilingCoyoteTimer = 0;
        this.lastClingingWall = 0;
        this.hasDoubleJumped = false;
        this.clingTimer = 0;
        this.clingCooldown = 0;
        this.initVertices();
        audio.updateViscosityFilter('NORMAL');
    }

    /**
     * Can doldurma mekanizması (Collectible pickup)
     */
    heal(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
    }

    jump(isSpacePress = true) {
        if (this.isDead) return;

        // Determine if we can do a wall jump using coyote time
        const canWallJump = this.viscosity.clingable && (this.clingingWall !== 0 || this.wallCoyoteTimer > 0);
        const activeWall = this.clingingWall !== 0 ? this.clingingWall : (this.lastClingingWall || 0);

        // Determine if we can do a ceiling drop using coyote time
        const canCeilingDrop = this.viscosity.clingable && (this.isStickingCeiling || this.ceilingCoyoteTimer > 0);

        if (this.onGround || (this.coyoteTimeTimer > 0 && !canWallJump && !canCeilingDrop)) {
            // Normal zıplama
            let force = this.viscosity.jumpForce;

            // Mavi form + kaygan blok üzerinde %15 zıplama bonusu
            if (this.viscosity.id === 'LOW' && this.onSlippery) {
                force *= 1.15;
                this.glowBoost = 22;
                if (this.game) {
                    this.game.emitParticles(this.x, this.y + this.radius, 'shift', '#06b6d4', 10);
                }
            }

            // If we are jumping from a moving platform, give a high jump boost!
            if (this.ridingPlatform) {
                force *= 1.175; // 17.5% extra jump height/force boost (50% reduction of the original 35% boost)
                this.glowBoost = 20;
                if (this.game) {
                    this.game.shakeCamera(3, 6);
                    this.game.emitParticles(this.x, this.y, 'shift', '#eab308', 12);
                }
            }

            this.vy = force;
            this.onGround = false;
            this.coyoteTimeTimer = 0;
            this.jumpBufferTimer = 0;
            this.glowBoost = 15;
            audio.playJump();
            
            // Emit landing-like dust particles under the player when jumping!
            if (this.game) {
                this.game.emitParticles(this.x, this.y + this.radius, 'land', this.viscosity.particleColor, 10);
            }
            
            // Anticipation: Önce yatay genişleme/basılma, yay tepkisiyle dikey uzama
            this.applySquish(0.3, -0.35);
            
            if (this.onEvent) this.onEvent('jump');
        } else if (canWallJump) {
            // Duvar zıplaması sadece Space tuşuna basıldığında tetiklenir (climb yerine)
            if (isSpacePress) {
                let launchVx = -activeWall * (this.viscosity.maxSpeed * 2.3);
                let launchVy = this.viscosity.jumpForce * 0.95;

                // Slingshot launch boost
                if (this.slingshotCharge > 0.25) {
                    const boost = 1.0 + this.slingshotCharge * 0.9;
                    launchVx *= boost;
                    launchVy *= (1.0 + this.slingshotCharge * 0.25);
                    this.glowBoost = 25;
                    
                    if (this.game) {
                        this.game.shakeCamera(8, 12);
                        this.game.emitParticles(this.x, this.y, 'shift', '#d946ef', 20);
                    }
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        navigator.vibrate([40, 30, 40]);
                    }
                }

                this.vx = launchVx;
                this.vy = launchVy;
                this.clingingWall = 0;
                this.isClinging = false;
                this.wallCoyoteTimer = 0;
                this.coyoteTimeTimer = 0;
                this.jumpBufferTimer = 0;
                this.glowBoost = 15;
                audio.playJump();
                this.applySquish(0.4, -0.4);
                this.slingshotCharge = 0;
                this.clingCooldown = 18; // Cooldown ~0.3s
                
                // Emit wall-jump dust particles from the contact point
                if (this.game) {
                    this.game.emitParticles(this.x + activeWall * this.radius, this.y, 'land', this.viscosity.particleColor, 10);
                }
                
                if (this.onEvent) this.onEvent('jump');
            }
        } else if (canCeilingDrop) {
            // Tavandan kendini bırakma/itme
            this.vy = 3.0; // Aşağı doğru it
            this.isStickingCeiling = false;
            this.ceilingCoyoteTimer = 0;
            this.glowBoost = 10;
            audio.playJump();
            this.applySquish(0.3, -0.3);
        } else if (this.viscosity.id === 'LOW' && !this.hasDoubleJumped) {
            // Double Jump for liquid form
            this.hasDoubleJumped = true;
            this.vy = this.viscosity.jumpForce;
            this.onGround = false;
            this.coyoteTimeTimer = 0;
            this.jumpBufferTimer = 0;
            this.glowBoost = 20;
            audio.playJump();
            
            // Visual double jump effect: squish and emit cyan particles
            this.applySquish(0.35, -0.4);
            if (this.game) {
                this.game.shakeCamera(2, 4);
                this.game.emitParticles(this.x, this.y, 'shift', '#06b6d4', 16);
            }
            
            if (this.onEvent) this.onEvent('jump');
        }
    }

    update(keys, level, emitParticles, onEvent) {
        this.onEvent = onEvent;

        // Build the active colliders list once per frame instead of 20 times inside resolveCollisions
        const colliders = [];
        if (level.platforms) {
            for (let i = 0; i < level.platforms.length; i++) {
                const plat = level.platforms[i];
                if (!plat.passage) {
                    colliders.push(plat);
                }
            }
        }
        if (level.movingPlatforms) {
            for (let i = 0; i < level.movingPlatforms.length; i++) {
                colliders.push(level.movingPlatforms[i]);
            }
        }
        if (level.fallingPlatforms) {
            for (let i = 0; i < level.fallingPlatforms.length; i++) {
                const p = level.fallingPlatforms[i];
                if (!p.fallen) colliders.push(p);
            }
        }
        if (level.breakablePlatforms) {
            for (let i = 0; i < level.breakablePlatforms.length; i++) {
                const p = level.breakablePlatforms[i];
                if (!p.broken) colliders.push(p);
            }
        }
        if (level.fallingBlockTraps) {
            for (let i = 0; i < level.fallingBlockTraps.length; i++) {
                colliders.push(level.fallingBlockTraps[i]);
            }
        }
        if (level.flamethrowers) {
            for (let i = 0; i < level.flamethrowers.length; i++) {
                colliders.push(level.flamethrowers[i]);
            }
        }
        if (level.staticMirrors) {
            for (let i = 0; i < level.staticMirrors.length; i++) {
                colliders.push(level.staticMirrors[i]);
            }
        }
        this.activeColliders = colliders;

        if (this.isDead) {
            this.flameHeat = 0;
            if (typeof audio !== 'undefined' && audio.updateSizzle) {
                audio.updateSizzle(0);
            }
            if (this.deathType === 'melt' && this.meltTimer > 0) {
                this.meltTimer--;
            }
            this.updateBlobPhysics();
            return;
        }

        // Dokunulmazlık süresi düşüşü
        if (this.invulnerableFrames > 0) {
            this.invulnerableFrames--;
        }

        // Glow sönümleme
        if (this.glowBoost > 0) {
            this.glowBoost -= 0.4;
        }

        // Coyote Time & Jump Buffer Sayaçları
        if (this.onGround) {
            this.clingCooldown = 0; // Reset wall cling cooldown on ground
            this.coyoteTimeTimer = 7; // ~0.11 saniye tolerans (60 FPS'te 7 kare)
            this.hasDoubleJumped = false; // Reset double jump on ground
            if (this.jumpBufferTimer > 0) {
                this.jump();
            }
        } else {
            if (this.coyoteTimeTimer > 0) this.coyoteTimeTimer--;
            if (this.clingCooldown > 0) this.clingCooldown--;
        }

        if (this.isClinging) {
            this.wallCoyoteTimer = 7;
            this.lastClingingWall = this.clingingWall;
            this.hasDoubleJumped = false; // Reset double jump on walls
            if (this.jumpBufferTimer > 0) {
                this.jump();
            }
        } else {
            if (this.wallCoyoteTimer > 0) this.wallCoyoteTimer--;
        }

        if (this.isStickingCeiling) {
            this.ceilingCoyoteTimer = 7;
            this.hasDoubleJumped = false; // Reset double jump on ceilings
            if (this.jumpBufferTimer > 0) {
                this.jump();
            }
        } else {
            if (this.ceilingCoyoteTimer > 0) this.ceilingCoyoteTimer--;
        }

        if (this.jumpBufferTimer > 0) {
            this.jumpBufferTimer--;
        }

        // Zıplama tuşu kontrolü (Jump Buffer tespiti için)
        if (keys.jump) {
            const canWallJump = this.viscosity.clingable && (this.clingingWall !== 0 || this.wallCoyoteTimer > 0);
            const canCeilingDrop = this.viscosity.clingable && (this.isStickingCeiling || this.ceilingCoyoteTimer > 0);
            if (this.onGround || this.coyoteTimeTimer > 0 || canWallJump || canCeilingDrop) {
                this.jump();
            } else {
                this.jumpBufferTimer = 9; // 0.15 saniye önbelleğe al
            }
        }

        // İvmelenmeleri hesapla (Görsel deformasyon için)
        this.ax = this.vx - this.prevVx;
        this.ay = this.vy - this.prevVy;
        this.prevVx = this.vx;
        this.prevVy = this.vy;

        // --- HAREKET GİRDİLERİ & FİZİK (SIFIDAN YAZILDI) ---
        
        // Lerp physical parameters for smooth state transitions
        const lerpSpeed = 0.25;
        this.currentGravity += (this.viscosity.gravity - this.currentGravity) * lerpSpeed;
        this.currentMaxSpeed += (this.viscosity.maxSpeed - this.currentMaxSpeed) * lerpSpeed;
        this.currentAccel += (this.viscosity.accel - this.currentAccel) * lerpSpeed;
        this.currentFriction += (this.viscosity.friction - this.currentFriction) * lerpSpeed;

        // If riding a moving platform, translate player position by its delta
        if (this.onGround && this.ridingPlatform) {
            const mPlat = this.ridingPlatform;
            if (mPlat.prevX !== undefined) {
                const dx = mPlat.x - mPlat.prevX;
                const dy = mPlat.y - mPlat.prevY;
                this.x += dx;
                this.y += dy;
            }
        } else {
            this.ridingPlatform = null;
        }

        // If riding a push block, translate player position by its delta
        if (this.onGround && this.ridingBlock) {
            const block = this.ridingBlock;
            if (block.prevX !== undefined) {
                const dx = block.x - block.prevX;
                const dy = block.y - block.prevY;
                this.x += dx;
                this.y += dy;
            }
        } else {
            this.ridingBlock = null;
        }

        // --- VANTUZ NOKTASI ETKİLEŞİMİ (PINK/JEL PLAYER CLING & LAUNCH) ---
        this.isClingingToVantuz = this.isClingingToVantuz || false;
        if (this.viscosity.id === 'HIGH' && level.vantuzPoints) {
            if (!this.isClingingToVantuz) {
                for (const v of level.vantuzPoints) {
                    if (v.cooldown === 0 || v.cooldown === undefined) {
                        const dx = this.x - v.x;
                        const dy = this.y - v.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist < 32) {
                            this.isClingingToVantuz = true;
                            this.vantuzPoint = v;
                            audio.playPlateActivate();
                            break;
                        }
                    }
                }
            }
        } else {
            this.isClingingToVantuz = false;
            this.vantuzPoint = null;
        }

        if (this.isClingingToVantuz && this.vantuzPoint) {
            this.x = this.vantuzPoint.x;
            this.y = this.vantuzPoint.y;
            this.vx = 0;
            this.vy = 0;
            this.onGround = false;
            this.isClinging = false;
            this.isStickingCeiling = false;

            let dirX = 0;
            let dirY = 0;
            if (keys.left) dirX = -1;
            if (keys.right) dirX = 1;
            if (keys.up) dirY = -1;
            if (keys.down) dirY = 1;

            if (keys.jump || dirX !== 0 || dirY !== 0) {
                if (dirX === 0 && dirY === 0) dirY = -1; // Default launch upwards
                
                this.vx = dirX * 7.5;
                this.vy = dirY * 9.0;
                this.isClingingToVantuz = false;
                this.vantuzPoint.cooldown = 45; // ~750ms cooldown
                this.vantuzPoint = null;
                
                audio.playJump();
                this.applySquish(0.4, -0.4);
                if (this.game) {
                    this.game.shakeCamera(4, 6);
                    this.game.emitParticles(this.x, this.y, 'shift', '#d946ef', 15);
                }
            }
            this.updateBlobPhysics();
            return;
        }

        // Normal Form Ball Roll
        this.isRolling = this.viscosity.id === 'NORMAL' && keys.down && this.onGround;
        if (this.isRolling) {
            this.radius = 12;
            this.rollAngle += this.vx * 0.15;
            this.currentFriction = 0.98;
            this.currentMaxSpeed = 5.2; // Gaining speed / momentum while rolling
        } else {
            let canStand = true;
            if (this.radius === 12) {
                this.radius = 18;
                for (const plat of this.activeColliders) {
                    if (this.checkAABBIntersection(this.x - 18, this.y - 18, 36, 36, plat)) {
                        canStand = false;
                        break;
                    }
                }
                if (!canStand) {
                    this.radius = 12;
                    this.isRolling = true;
                    this.rollAngle += this.vx * 0.15;
                }
            }
        }

        // Purple Net gate slow-down inside net for JEL (HIGH) form
        let insideNet = false;
        if (level.gates) {
            for (const gate of level.gates) {
                if (gate.type === 'net') {
                    if (this.x + this.radius > gate.x && this.x - this.radius < gate.x + gate.w &&
                        this.y + this.radius > gate.y && this.y - this.radius < gate.y + gate.h) {
                        insideNet = true;
                        break;
                    }
                }
            }
        }
        if (insideNet && this.viscosity.id === 'HIGH') {
            this.vx *= 0.75;
            if (this.vy > 0) this.vy *= 0.75;
        }

        // Konveyör Bant hız etkisi
        if (level.conveyors) {
            for (const conv of level.conveyors) {
                if (this.x + this.radius > conv.x && this.x - this.radius < conv.x + conv.w &&
                    this.y + this.radius > conv.y - 4 && this.y + this.radius < conv.y + conv.h + 8 && this.onGround) {
                    this.vx += conv.speed * conv.direction * 0.2;
                }
            }
        }

        // Slingshot Charge on Hold
        if (this.isClinging) {
            const pushingAway = (this.clingingWall === 1 && keys.left) || (this.clingingWall === -1 && keys.right);
            if (pushingAway) {
                this.slingshotCharge = Math.min(this.slingshotCharge + 0.05, 1.0);
                this.applySquish(-this.clingingWall * 0.06 * this.slingshotCharge, 0);
            } else {
                this.slingshotCharge = Math.max(0, this.slingshotCharge - 0.1);
            }
        } else {
            this.slingshotCharge = 0;
        }

        // Yerçekimi ivmesi uygulaması
        let activeGravity = this.currentGravity;
        let isClimbing = false;

        if (this.isClinging) {
            // Disable gravity completely when clinging so player doesn't slide/fall down
            this.vx = 0; // Prevent horizontal jitter
            this.clingTimer = (this.clingTimer || 0) + 1;

            let goUp = keys.up;
            let goDown = keys.down;

            // Use left/right keys for climbing on mobile
            if (this.clingingWall === -1) { // Left wall
                if (keys.left) goUp = true;
                if (keys.right) goDown = true;
            } else if (this.clingingWall === 1) { // Right wall
                if (keys.right) goUp = true;
                if (keys.left) goDown = true;
            }

            if (goUp) {
                this.vy = -2.0;
            } else if (goDown) {
                this.vy = 2.0;
            } else {
                this.vy = 0; // Stay completely still when keys are released
            }
            activeGravity = 0;
            isClimbing = true;
        } else if (this.isStickingCeiling) {
            activeGravity = 0;
            this.clingTimer = 0;
        } else {
            this.clingTimer = 0;
        }

        if (!isClimbing) {
            this.vy += activeGravity;
        }

        // Hava sürtünmesi (Havada yatay sürtünme)
        if (!this.onGround) {
            this.vx *= this.viscosity.drag;
        }

        // Klavye girdilerine göre hız ivmelendirmesi
        let inputX = 0;
        if (keys.left) inputX = -1;
        if (keys.right) inputX = 1;

        if (inputX !== 0) {
            // In HIGH viscosity, Left/Right is used for vertical climbing, so don't detach
            if (this.isClinging && inputX === -this.clingingWall && this.viscosity.id !== 'HIGH') {
                this.isClinging = false;
                this.clingingWall = 0;
            }
            
            // Only apply horizontal velocity if NOT clinging
            if (!this.isClinging) {
                const currentAccel = this.onGround ? this.currentAccel : this.currentAccel * 1.35;
                this.vx += inputX * currentAccel;
                
                if (Math.abs(this.vx) > this.currentMaxSpeed) {
                    this.vx = Math.sign(this.vx) * this.currentMaxSpeed;
                }
                this.applySquish(inputX * 0.02 * this.viscosity.squishiness, 0);
            }
        } else {
            if (this.onGround) {
                this.vx *= this.currentFriction;
            }
        }

        // Tavanda iken zıplamaya basarsa bırakır
        if (this.isStickingCeiling && keys.jump) {
            this.isStickingCeiling = false;
        }

        // Tünelleme (platform içinden geçme) riskini tamamen yok etmek için maksimum hız sınırlaması
        const maxVelocityLimit = 16.0;
        if (Math.abs(this.vx) > maxVelocityLimit) {
            this.vx = Math.sign(this.vx) * maxVelocityLimit;
        }
        if (Math.abs(this.vy) > maxVelocityLimit) {
            this.vy = Math.sign(this.vy) * maxVelocityLimit;
        }

        // --- HAREKET VE ÇARPIŞMA (SUB-STEPPING 10x) ---
        this.wasOnGround = this.onGround;
        this.onGround = false;
        this.onSlippery = false; // Her frame başında sıfırla, resolveCollisions yeniden set eder
        this.clingingWall = 0;

        const subSteps = 10;

        for (let step = 0; step < subSteps; step++) {
            // X ekseninde küçük bir adım at ve çarpışmayı çöz
            this.x += this.vx / subSteps;
            this.resolveCollisions(level, true);

            // Ekran sınırlarında oyuncuyu kısıtla
            if (this.x < this.radius) {
                this.x = this.radius;
                this.vx = 0;
            } else if (this.x > level.width - this.radius) {
                this.x = level.width - this.radius;
                this.vx = 0;
            }

            // Y ekseninde küçük bir adım at ve çarpışmayı çöz
            this.y += this.vy / subSteps;
            this.resolveCollisions(level, false);

            // Tavanda ekran dışına (harita limitine) çıkmasını engelle
            const ceilingLimit = (level.ceilingY !== undefined ? level.ceilingY : -135) + this.radius;
            if (this.y < ceilingLimit) {
                this.y = ceilingLimit;
                this.vy = 0;
            }
        }

        // --- ÇARPIŞMA SONRASI EFEKTLER & SESLER ---
        
        // Duvara Yapışma durumu tespiti (HIGH viskozitesi için geçerli)
        const nearStickyWall = this.isTouchingStickyWall(level);
        const canCling = this.viscosity.clingable && (this.clingCooldown || 0) === 0;
        if (canCling && (this.clingingWall !== 0 || nearStickyWall !== 0) && !this.onGround) {
            this.isClinging = true;
            if (this.clingingWall === 0) {
                this.clingingWall = nearStickyWall;
            }
        } else {
            this.isClinging = false;
            this.clingingWall = 0;
            this.clingTimer = 0;
        }

        // Yere yumuşak/sert iniş tespiti ve squash deformasyon efekti
        if (this.onGround && !this.wasOnGround) {
            const squishImpact = Math.min(this.prevVy * 0.075, 0.7);
            this.applySquish(squishImpact * 0.95, -squishImpact * 0.85);
            audio.playLand(this.prevVy);
            
            // Hard landing triggers haptic vibration
            if (navigator.vibrate && this.prevVy > 4) {
                navigator.vibrate(Math.min(20 + Math.floor(this.prevVy * 3), 50));
            }

            if (this.onEvent) {
                this.onEvent('land', this.prevVy);
            }
            
            if (emitParticles) {
                const particleCount = Math.floor(Math.min(12 + this.prevVy * 1.5, 26));
                emitParticles(this.x, this.y + this.radius, 'land', this.viscosity.particleColor, particleCount);
            }
        }

        // Ölüm çukuru tespiti (Lava/Asit nehrine temas)
        if (this.y + this.radius >= level.height - 35) {
            if (!this.isDead) {
                // Snap to surface and stop velocity
                this.y = level.height - 35 - this.radius;
                this.vx = 0;
                this.vy = 0;

                // Hasar alma (melt tipi ile anında erime ölüm animasyonu başlatılır)
                this.takeDamage(this.health, 'melt');

                // Kamerayı sars ve duman/buhar pufu çıkar
                if (this.game) {
                    this.game.shakeCamera(8, 15);
                    const theme = (this.game.level && this.game.level.theme) ? this.game.level.theme : null;
                    const riverColor = (theme && theme.bottomRiverShadow) ? theme.bottomRiverShadow : '#10b981';
                    
                    // Gri/beyaz duman pufu
                    this.game.emitParticles(this.x, level.height - 35, 'smoke', '#e2e8f0', 20);
                    // Renkli nehir buharı pufu
                    this.game.emitParticles(this.x, level.height - 35, 'steam', riverColor, 20);
                }
            }
        }

        // Blob yay kuvvetleri fiziğini güncelle
        this.updateBlobPhysics();

        // Alev/Sıcaklık mekanizması güncellemeleri
        if (this.viscosity.id === 'HIGH') {
            if (this.inFlame) {
                if (this.invulnerableFrames <= 0) {
                    this.flameHeat = Math.min(1.0, this.flameHeat + 1 / 120); // 120 frame = 2 saniye alev toleransı
                    
                    if (this.flameHeat >= 1.0) {
                        this.takeDamage(1);
                        this.flameHeat = 0;
                    }
                } else {
                    // Hasar aldıktan sonra/dokunulmazken ısıyı sıfırla
                    this.flameHeat = 0;
                }
            } else {
                // Alevde değilse yavaşça soğusun
                if (this.flameHeat > 0) {
                    this.flameHeat = Math.max(0, this.flameHeat - 1 / 120); // 2 saniyede tamamen soğuma
                }
            }
        } else {
            // Diğer formlarda ısı her zaman sıfır
            this.flameHeat = 0;
        }

        // Alevdeyken parçacık (steam) salınımı
        if (this.inFlame && this.flameHeat > 0.1 && Math.random() < 0.3 && emitParticles) {
            const particleColor = Math.random() < 0.5 ? '#f97316' : '#ef4444'; // Turuncu / Kırmızı
            emitParticles(this.x, this.y, 'steam', particleColor, 1);
        }

        // Soğurken duman/buhar salınımı (Açık mavi veya beyaz soğuma buharı)
        if (!this.inFlame && this.flameHeat > 0 && Math.random() < 0.15 && emitParticles) {
            const coolColor = Math.random() < 0.5 ? '#e0f2fe' : '#ffffff'; // Açık mavi veya Beyaz
            emitParticles(this.x, this.y, 'steam', coolColor, 1);
        }

        // Isınma ses efekti şiddetini güncelle
        if (typeof audio !== 'undefined' && audio.updateSizzle) {
            audio.updateSizzle(this.flameHeat);
        }

        // Parçacık izi (trail) salınımı
        this.trailTimer++;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const trailFrequency = speed > 4 ? 2 : (this.viscosity.id === 'LOW' ? 3 : 6);
        
        if (this.trailTimer % trailFrequency === 0 && emitParticles && speed > 0.8) {
            const count = Math.min(Math.floor(speed * 0.35) + 1, 3);
            let trailColor = this.viscosity.particleColor;
            let trailType = 'trail';
            
            if (window.shopManager) {
                const activeTrail = window.shopManager.getActiveCosmetic('trail');
                if (activeTrail && activeTrail !== 'default_trail') {
                    if (activeTrail === 'fire_trail') {
                        const colors = ['#ef4444', '#f97316', '#f59e0b'];
                        trailColor = colors[Math.floor(Math.random() * colors.length)];
                        trailType = 'steam';
                    } else if (activeTrail === 'ice_trail') {
                        const colors = ['#38bdf8', '#7dd3fc', '#e0f2fe', '#ffffff'];
                        trailColor = colors[Math.floor(Math.random() * colors.length)];
                        trailType = 'trail';
                    } else if (activeTrail === 'gold_trail') {
                        const colors = ['#fbbf24', '#f59e0b', '#ffffff'];
                        trailColor = colors[Math.floor(Math.random() * colors.length)];
                        trailType = 'shift';
                    } else if (activeTrail === 'rainbow_trail') {
                        if (this.rainbowHue === undefined) this.rainbowHue = 0;
                        this.rainbowHue = (this.rainbowHue + 8) % 360;
                        trailColor = `hsl(${this.rainbowHue}, 100%, 60%)`;
                        trailType = 'trail';
                    }
                }
            }
            
            emitParticles(
                this.x - (this.vx / (speed || 1)) * (this.radius * 0.8),
                this.y - (this.vy / (speed || 1)) * (this.radius * 0.8),
                trailType,
                trailColor,
                count
            );
        }
    }

    /**
     * Checks if player is close enough to any sticky wall in the level to latch state.
     */
    isTouchingStickyWall(level) {
        if (!level || !level.platforms) return 0;
        
        const checkRange = 5;
        const allPlats = [
            ...level.platforms,
            ...(level.movingPlatforms || [])
        ];
        
        for (const plat of allPlats) {
            if (plat.sticky) {
                let closestX = Math.max(plat.x, Math.min(this.x, plat.x + plat.w));
                let closestY = Math.max(plat.y, Math.min(this.y, plat.y + plat.h));
                let dx = this.x - closestX;
                let dy = this.y - closestY;
                let distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.radius + checkRange) {
                    // Only cling to vertical-like surfaces (walls), not flat floors/ceilings
                    if (Math.abs(dx) > 5) {
                        if (this.x < plat.x + plat.w / 2) {
                            return 1; // Wall is to the right of the player
                        } else {
                            return -1; // Wall is to the left of the player
                        }
                    }
                }
            }
        }
        return 0;
    }

    /**
     * Daire ve AABB dikdörtgen çarpışmalarını en yakın nokta projeksiyonuna göre çözer.
     */
    resolveCollisions(level, isX) {
        let touchedCeilingThisFrame = false;
        const allPlats = this.activeColliders || [];

        for (const plat of allPlats) {
            let closestX = Math.max(plat.x, Math.min(this.x, plat.x + plat.w));
            let closestY = Math.max(plat.y, Math.min(this.y, plat.y + plat.h));

            let dx = this.x - closestX;
            let dy = this.y - closestY;
            let distanceSq = dx * dx + dy * dy;

            let inside = false;

            // Daire merkezinin platform AABB'si içinde veya sınırlarında olup olmadığını kontrol et
            if (this.x >= plat.x && this.x <= plat.x + plat.w &&
                this.y >= plat.y && this.y <= plat.y + plat.h) {
                inside = true;

                const dl = this.x - plat.x;
                const dr = plat.x + plat.w - this.x;
                const dt = this.y - plat.y;
                const db = plat.y + plat.h - this.y;

                const minDist = Math.min(dl, dr, dt, db);

                if (minDist === dl) {
                    closestX = plat.x;
                    closestY = this.y;
                } else if (minDist === dr) {
                    closestX = plat.x + plat.w;
                    closestY = this.y;
                } else if (minDist === dt) {
                    closestX = this.x;
                    closestY = plat.y;
                } else {
                    closestX = this.x;
                    closestY = plat.y + plat.h;
                }

                dx = this.x - closestX;
                dy = this.y - closestY;
                distanceSq = dx * dx + dy * dy;
            }

            const distance = Math.sqrt(distanceSq) || 0.0001;

            if (inside || distance < this.radius) {
                const overlap = inside ? (this.radius + distance) : (this.radius - distance);

                let nx = dx / distance;
                let ny = dy / distance;

                if (inside) {
                    nx = -nx;
                    ny = -ny;
                }

                // İTME (PUSH OUT)
                this.x += nx * overlap;
                this.y += ny * overlap;

                // HIZ SIFIRLAMA (VELOCITY CANCEL)
                if (Math.abs(nx) > Math.abs(ny)) {
                    // Check if player hit wall at speed in liquid form
                    const impactX = Math.abs(this.prevVx);
                    if (this.viscosity.id === 'LOW' && impactX > 3.0 && this.game) {
                        this.game.addSplatter(this.x, this.y, '#06b6d4');
                    }

                    this.vx = 0;
                    if (this.viscosity.clingable && plat.sticky) {
                        if (nx < 0) {
                            this.clingingWall = 1; // Duvar sağda
                        } else {
                            this.clingingWall = -1; // Duvar solda
                        }
                    }
                } else {
                    if (ny < 0) {
                        // Only land and cancel velocity if falling or stationary
                        if (this.vy >= 0) {
                            this.vy = 0;
                            this.onGround = true;
                            if (plat.targetX !== undefined || (plat.type === 'flamethrower' && plat.moving)) {
                                this.ridingPlatform = plat;
                            }
                            if (plat.slippery) {
                                this.vx *= 0.995;
                                this.onSlippery = true; // Kaygan blok üzerinde
                            } else {
                                this.onSlippery = false;
                            }

                            // Trigger falling platforms
                            if (plat.timer !== undefined && plat.vy !== undefined && !plat.triggered) {
                                plat.triggered = true;
                                plat.timer = 30; // 500ms shake
                                audio.playBlockPush();
                            }
                            // Trigger breakable platforms
                            if (plat.broken !== undefined && plat.broken === false && !plat.triggered) {
                                plat.triggered = true;
                                if (this.prevVy > 5 || this.viscosity.id === 'HIGH') {
                                    plat.timer = 2; // break instantly
                                } else {
                                    plat.timer = 18; // 300ms delay
                                }
                                audio.playBlockPush();
                            }
                        }
                    } else if (ny > 0) {
                        // Tavan çarpışması — oyuncunun bloğa 15px daha yaklaşmasına izin ver
                        // overlap <= 15 ise görsel sınıra henüz ulaşılmadı, itmeyi geri al
                        const CEILING_BUFFER = 15;
                        if (!inside && overlap <= CEILING_BUFFER) {
                            // Pushout'u geri al — oyuncu bloğa 15px daha yaklaşabilir
                            this.x -= nx * overlap;
                            this.y -= ny * overlap;
                        } else {
                            this.vy = 0;
                            if (this.viscosity.clingable && plat.sticky) {
                                this.isStickingCeiling = true;
                                touchedCeilingThisFrame = true;
                            }
                        }
                    }
                }
            }
        }

        // Treat net gates as solid walls if player is not in HIGH state
        if (level.gates) {
            for (const gate of level.gates) {
                if (gate.type === 'net' && !gate.disabled && this.viscosity.id !== 'HIGH') {
                    let closestX = Math.max(gate.x, Math.min(this.x, gate.x + gate.w));
                    let closestY = Math.max(gate.y, Math.min(this.y, gate.y + gate.h));
                    let dx = this.x - closestX;
                    let dy = this.y - closestY;
                    let distanceSq = dx * dx + dy * dy;
                    let inside = false;

                    if (this.x >= gate.x && this.x <= gate.x + gate.w &&
                        this.y >= gate.y && this.y <= gate.y + gate.h) {
                        inside = true;
                        const dl = this.x - gate.x;
                        const dr = gate.x + gate.w - this.x;
                        const dt = this.y - gate.y;
                        const db = gate.y + gate.h - this.y;
                        const minDist = Math.min(dl, dr, dt, db);
                        if (minDist === dl) { closestX = gate.x; closestY = this.y; }
                        else if (minDist === dr) { closestX = gate.x + gate.w; closestY = this.y; }
                        else if (minDist === dt) { closestX = this.x; closestY = gate.y; }
                        else { closestX = this.x; closestY = gate.y + gate.h; }
                        dx = this.x - closestX;
                        dy = this.y - closestY;
                        distanceSq = dx * dx + dy * dy;
                    }

                    const distance = Math.sqrt(distanceSq) || 0.0001;
                    if (inside || distance < this.radius) {
                        const overlap = inside ? (this.radius + distance) : (this.radius - distance);
                        let nx = dx / distance;
                        let ny = dy / distance;
                        if (inside) { nx = -nx; ny = -ny; }
                        this.x += nx * overlap;
                        this.y += ny * overlap;
                        if (Math.abs(nx) > Math.abs(ny)) {
                            this.vx = 0;
                        } else {
                            this.vy = 0;
                            if (ny < 0) {
                                this.onGround = true;
                                if (gate.moving) {
                                    this.ridingPlatform = gate;
                                }
                            }
                        }
                    }
                }
            }
        }

        // İtilebilir Blok Çarpışması
        if (level.pushBlocks) {
            for (const block of level.pushBlocks) {
                if (block.broken) continue;
                let closestX = Math.max(block.x, Math.min(this.x, block.x + block.w));
                let closestY = Math.max(block.y, Math.min(this.y, block.y + block.h));
                let dx = this.x - closestX;
                let dy = this.y - closestY;
                let distanceSq = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSq) || 0.0001;
                
                if (distance < this.radius) {
                    const overlap = this.radius - distance;
                    let nx = dx / distance;
                    let ny = dy / distance;
                    
                    this.x += nx * overlap;
                    this.y += ny * overlap;
                    
                    if (Math.abs(nx) > Math.abs(ny)) {
                        // Yatay itme
                        const pushAmount = -nx * overlap;
                        const pushed = level.tryPushBlock(block, pushAmount);
                        if (!pushed) {
                            this.vx = 0;
                        } else {
                            block.vx = this.vx * 1.02; // Set to exactly 1.02
                            this.vx *= 0.92;
                            if (Math.abs(block.vx) > 0.05) {
                                audio.playBlockPush();
                            }
                        }
                    } else {
                        if (ny < 0 && this.vy >= 0) {
                            // Bloğun üstüne bindi
                            this.vy = 0;
                            this.onGround = true;
                            this.ridingBlock = block;
                        } else if (ny > 0) {
                            this.vy = 0;
                        }
                    }
                }
            }
        }

        // Tavandan çıkıp çıkmadığının tespiti
        if (this.isStickingCeiling && !touchedCeilingThisFrame) {
            let touchingCeilingCheck = false;
            for (const plat of level.platforms) {
                if (plat.sticky && 
                    this.checkAABBIntersection(this.x - this.radius, this.y - this.radius - 4, this.radius * 2, 8, plat)) {
                    touchingCeilingCheck = true;
                    break;
                }
            }
            if (!touchingCeilingCheck) {
                this.isStickingCeiling = false;
            }
        }
    }

    /**
     * AABB (Kutu) Kesişim Kontrolü
     */
    checkAABBIntersection(cx, cy, cw, ch, rect) {
        return cx < rect.x + rect.w &&
               cx + cw > rect.x &&
               cy < rect.y + rect.h &&
               cy + ch > rect.y;
    }

    /**
     * Blob dış vertex yay fiziği güncellemesi
     * Verlet/Yay kuvvetleri ile şeklin eski haline dönmesini ve ivmeye göre uzamasını sağlar.
     */
    updateBlobPhysics() {
        // Yay katsayısı (stiffness) ve sönümleme (damping) viskoziteye göre belirlenir
        const ks = this.viscosity.squishiness * 1.5;
        const damping = 1 - (this.viscosity.id === 'HIGH' ? 0.25 : this.viscosity.id === 'LOW' ? 0.08 : 0.12);

        this.vertices.forEach(v => {
            // Vertex'in ideal / dinlenme pozisyonu
            const targetRx = Math.cos(v.angle) * this.radius;
            const targetRy = Math.sin(v.angle) * this.radius;

            // 1. Geri çağırıcı yay kuvveti (F = -k * x)
            const forceX = (targetRx - v.rx) * ks;
            const forceY = (targetRy - v.ry) * ks;

            // 2. İvme tepkisi (Hız değişimine ters yönde gecikme - eylemsizlik)
            const inertiaLag = this.viscosity.id === 'LOW' ? 0.25 : 0.12;
            const lagForceX = -this.ax * inertiaLag * Math.abs(Math.cos(v.angle));
            const lagForceY = -this.ay * inertiaLag * Math.abs(Math.sin(v.angle));

            // Göreceli hızları güncelle
            v.rvx += forceX + lagForceX;
            v.rvy += forceY + lagForceY;

            // Sönümleme uygula
            v.rvx *= damping;
            v.rvy *= damping;

            // Göreceli konumları güncelle
            v.rx += v.rvx;
            v.ry += v.rvy;

            // Aşırı deformasyonu önlemek için sınırla (clamp)
            const dist = Math.sqrt(v.rx * v.rx + v.ry * v.ry);
            const minAllowed = this.radius * 0.45;
            const maxAllowed = this.radius * 1.75;
            if (dist < minAllowed) {
                const angle = v.angle;
                v.rx = Math.cos(angle) * minAllowed;
                v.ry = Math.sin(angle) * minAllowed;
                v.rvx = 0;
                v.rvy = 0;
            } else if (dist > maxAllowed) {
                const d = dist || 1;
                v.rx = (v.rx / d) * maxAllowed;
                v.ry = (v.ry / d) * maxAllowed;
                v.rvx = 0;
                v.rvy = 0;
            }
        });
    }

    /**
     * Blob'u ekrana çizer
     */
    draw(ctx, camera) {
        if (this.isDead) {
            if (this.deathType === 'melt' && this.meltTimer > 0) {
                // Draw melting puddle animation (karakter yere yayılarak sıvılaşır)
                ctx.save();
                if (camera) {
                    ctx.translate(-camera.x, -camera.y);
                }
                
                // 55 framede erir, kalan 65 framede yerde yassı şekilde bekler (Toplam 120 frame = 2 saniye)
                const meltDuration = 55;
                const totalDuration = 120;
                const progress = (totalDuration - this.meltTimer);
                const t = Math.min(1.0, progress / meltDuration);
                
                const spreadW = this.radius * (1 + t * 2.4); // spreads to 3.4x radius
                const flatH = this.radius * (1 - t * 0.88);  // flattens to 12% height
                const centerY = this.y + this.radius * t * 0.88; // shifts center down to keep bottom on ground
                
                // Specular gradient for shiny gel puddle
                const grad = ctx.createRadialGradient(this.x - 2, centerY - flatH / 2, 2, this.x, centerY, spreadW);
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.3, this.viscosity.colorSecondary);
                grad.addColorStop(1, this.viscosity.color);
                
                ctx.fillStyle = grad;
                ctx.shadowColor = this.viscosity.color;
                ctx.shadowBlur = 15 * (1 - t * 0.5); // shadow fades slightly
                
                ctx.beginPath();
                ctx.ellipse(this.x, centerY, spreadW, flatH, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Add some small splattering droplets as it melts
                if (progress > 20 && !this.meltParticlesEmitted && this.game) {
                    this.game.emitParticles(this.x, centerY, 'trail', this.viscosity.color, 16);
                    this.meltParticlesEmitted = true;
                }
                
                // Draw eyes on top of/inside the melting puddle (İkonik olarak gözler kalır ve yassılaşır)
                const eyeY = centerY - flatH * 0.3;
                
                // Beyaz göz akı
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 4 * (1 - t * 0.5);
                
                // Sol Göz
                ctx.beginPath();
                ctx.ellipse(this.x - 6 * (1 + t * 0.8), eyeY, 3, Math.max(1, 3 * (1 - t * 0.65)), 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Sağ Göz
                ctx.beginPath();
                ctx.ellipse(this.x + 6 * (1 + t * 0.8), eyeY, 3, Math.max(1, 3 * (1 - t * 0.65)), 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Göz bebekleri (Merkeze şaşkın/üzgün bakan küçük siyah noktalar)
                ctx.fillStyle = '#0a0a0f';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.ellipse(this.x - 6 * (1 + t * 0.8), eyeY, 1.2, Math.max(0.5, 1.2 * (1 - t * 0.65)), 0, 0, Math.PI * 2);
                ctx.ellipse(this.x + 6 * (1 + t * 0.8), eyeY, 1.2, Math.max(0.5, 1.2 * (1 - t * 0.65)), 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
                return;
            }
            return;
        }

        ctx.save();
        if (camera) {
            ctx.translate(-camera.x, -camera.y);
        }

        // Dokunulmazlık durumunda yanıp sönme
        if (this.invulnerableFrames > 0 && Math.floor(this.invulnerableFrames / 4) % 2 === 0) {
            ctx.globalAlpha = 0.35;
        }

        // Gövde gradyanı (Işıltılı modern görünüm)
        const grad = ctx.createRadialGradient(this.x - 4, this.y - 4, 2, this.x, this.y, this.radius * 1.2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, this.viscosity.colorSecondary);
        grad.addColorStop(1, this.viscosity.color);

        ctx.fillStyle = grad;

        // Dinamik parlama katsayısı (Hız, zıplama ve viskozite geçişine duyarlı)
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedGlow = Math.min(speed * 1.6, 12);
        const airGlow = !this.onGround ? 8 : 0;
        let totalGlow = 10 + speedGlow + airGlow + (this.glowBoost || 0);

        if (this.flameHeat > 0) {
            totalGlow += this.flameHeat * 15; // Isındıkça neon parlama artsın
        }

        // Gölge rengini alev sıcaklığına göre fuchsidan kırmızıya kaydır
        if (this.flameHeat > 0 && this.viscosity.id === 'HIGH') {
            const r = Math.round(217 + (239 - 217) * this.flameHeat);
            const g = Math.round(70 + (68 - 70) * this.flameHeat);
            const b = Math.round(239 + (68 - 239) * this.flameHeat);
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.5 + this.flameHeat * 0.3})`;
        } else {
            ctx.shadowColor = this.viscosity.color;
        }
        ctx.shadowBlur = Math.min(totalGlow, 20); // Performans için gölge bulanıklığını 20px ile sınırla

        // Şekli Bezier eğrileriyle yumuşatılmış olarak çiz
        ctx.beginPath();
        
        // Rotating function for ball rolls
        const getRotated = (v) => {
            if (this.rollAngle === 0) return { rx: v.rx, ry: v.ry };
            const cos = Math.cos(this.rollAngle);
            const sin = Math.sin(this.rollAngle);
            return {
                rx: v.rx * cos - v.ry * sin,
                ry: v.rx * sin + v.ry * cos
            };
        };

        const firstRot = getRotated(this.vertices[0]);
        let startX = this.x + firstRot.rx;
        let startY = this.y + firstRot.ry;
        ctx.moveTo(startX, startY);

        for (let i = 0; i < this.numVertices; i++) {
            const current = this.vertices[i];
            const next = this.vertices[(i + 1) % this.numVertices];
            
            const currRot = getRotated(current);
            const nextRot = getRotated(next);

            const cx = this.x + currRot.rx;
            const cy = this.y + currRot.ry;
            const nx = this.x + nextRot.rx;
            const ny = this.y + nextRot.ry;

            const midX = (cx + nx) / 2;
            const midY = (cy + ny) / 2;

            ctx.quadraticCurveTo(cx, cy, midX, midY);
        }

        ctx.closePath();
        ctx.fill();

        // Isınma kızarıklık efekti (Gövde üzerine yarı saydam kırmızı katman)
        if (this.flameHeat > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${this.flameHeat * 0.75})`;
            ctx.shadowBlur = 0; // Katman üzerine ekstra parlama vermemek için gölgeyi sıfırlıyoruz
            ctx.fill();
            ctx.restore();
        }

        // İnce bir dış sınır (kontur) ekle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0; // Konturda gölgeyi kapat
        ctx.stroke();

        // --- GÖZLER (Viscora'ya sevimli/organik bir canlı havası katar) ---
        // Gözlerin konumu oyuncunun hız yönüne göre hafifçe kayar (Look-ahead)
        const eyeOffsetMultiplier = 2.5;
        const speedMagnitude = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const dx = speedMagnitude > 0.1 ? (this.vx / speedMagnitude) * eyeOffsetMultiplier : 0;
        const dy = speedMagnitude > 0.1 ? (this.vy / speedMagnitude) * eyeOffsetMultiplier : 0;

        let activeEyes = 'default_eyes';
        if (window.shopManager) {
            activeEyes = window.shopManager.getActiveCosmetic('eyes') || 'default_eyes';
        }

        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = (activeEyes === 'sunglasses' || activeEyes === 'joke_glasses') ? 0 : 4;

        if (activeEyes === 'cute_eyes') {
            // İri Gözler
            ctx.beginPath();
            ctx.arc(this.x - 6 + dx, this.y - 3 + dy, 4.5, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(this.x + 6 + dx, this.y - 3 + dy, 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Göz bebekleri (İri)
            ctx.fillStyle = '#0a0a0f';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(this.x - 6 + dx + dx*0.3, this.y - 3 + dy + dy*0.3, 2.2, 0, Math.PI * 2);
            ctx.arc(this.x + 6 + dx + dx*0.3, this.y - 3 + dy + dy*0.3, 2.2, 0, Math.PI * 2);
            ctx.fill();

            // Parıltı ekle
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x - 7.5 + dx + dx*0.3, this.y - 4.5 + dy + dy*0.3, 0.8, 0, Math.PI * 2);
            ctx.arc(this.x + 4.5 + dx + dx*0.3, this.y - 4.5 + dy + dy*0.3, 0.8, 0, Math.PI * 2);
            ctx.fill();
        } else if (activeEyes === 'sunglasses') {
            // Güneş Gözlüğü (Havalı siyah camlar)
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.2;
            
            // Sol cam (hafif açılı yuvarlatılmış dikdörtgen)
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(this.x - 10 + dx, this.y - 5 + dy, 6, 4, 1);
            } else {
                ctx.rect(this.x - 10 + dx, this.y - 5 + dy, 6, 4);
            }
            ctx.fill();
            ctx.stroke();
            
            // Sağ cam
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(this.x + 4 + dx, this.y - 5 + dy, 6, 4, 1);
            } else {
                ctx.rect(this.x + 4 + dx, this.y - 5 + dy, 6, 4);
            }
            ctx.fill();
            ctx.stroke();
            
            // Köprü
            ctx.beginPath();
            ctx.moveTo(this.x - 4 + dx, this.y - 3 + dy);
            ctx.lineTo(this.x + 4 + dx, this.y - 3 + dy);
            ctx.stroke();
            
            // Gözlük parıltısı (Beyaz minik çizgi)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(this.x - 9 + dx, this.y - 4 + dy);
            ctx.lineTo(this.x - 7 + dx, this.y - 2 + dy);
            ctx.moveTo(this.x + 5 + dx, this.y - 4 + dy);
            ctx.lineTo(this.x + 7 + dx, this.y - 2 + dy);
            ctx.stroke();
        } else if (activeEyes === 'joke_glasses') {
            // Şaka Gözlüğü (Kalın çerçeveler, pembe burun, bıyık)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            
            // Kalın siyah çerçeveler (Gözler)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x - 6 + dx, this.y - 3 + dy, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(this.x + 6 + dx, this.y - 3 + dy, 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Göz bebekleri (Komik)
            ctx.fillStyle = '#0a0a0f';
            ctx.beginPath();
            ctx.arc(this.x - 5.5 + dx, this.y - 3 + dy, 1.2, 0, Math.PI * 2);
            ctx.arc(this.x + 5.5 + dx, this.y - 3 + dy, 1.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Köprü
            ctx.beginPath();
            ctx.moveTo(this.x - 2 + dx, this.y - 4 + dy);
            ctx.lineTo(this.x + 2 + dx, this.y - 4 + dy);
            ctx.stroke();

            // Büyük Pembe Komik Burun
            ctx.fillStyle = '#fb7185';
            ctx.beginPath();
            ctx.arc(this.x + dx, this.y + 0.5 + dy, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Bıyık (Siyah kıvrım)
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(this.x - 7 + dx, this.y + 4 + dy);
            ctx.quadraticCurveTo(this.x - 3 + dx, this.y + 2 + dy, this.x + dx, this.y + 4.5 + dy);
            ctx.quadraticCurveTo(this.x + 3 + dx, this.y + 2 + dy, this.x + 7 + dx, this.y + 4 + dy);
            ctx.quadraticCurveTo(this.x + 4 + dx, this.y + 6.5 + dy, this.x + dx, this.y + 5.5 + dy);
            ctx.quadraticCurveTo(this.x - 4 + dx, this.y + 6.5 + dy, this.x - 7 + dx, this.y + 4 + dy);
            ctx.fill();
        } else {
            // Varsayılan / Kızgın
            ctx.beginPath();
            ctx.arc(this.x - 6 + dx, this.y - 3 + dy, 3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(this.x + 6 + dx, this.y - 3 + dy, 3, 0, Math.PI * 2);
            ctx.fill();

            // Göz bebekleri
            ctx.fillStyle = '#0a0a0f';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(this.x - 6 + dx + dx*0.3, this.y - 3 + dy + dy*0.3, 1.2, 0, Math.PI * 2);
            ctx.arc(this.x + 6 + dx + dx*0.3, this.y - 3 + dy + dy*0.3, 1.2, 0, Math.PI * 2);
            ctx.fill();

            if (activeEyes === 'angry_eyes') {
                ctx.strokeStyle = '#0a0a0f';
                ctx.lineWidth = 1.5;
                // Sol Kaş
                ctx.beginPath();
                ctx.moveTo(this.x - 9 + dx, this.y - 7 + dy);
                ctx.lineTo(this.x - 2 + dx, this.y - 4 + dy);
                ctx.stroke();
                
                // Sağ Kaş
                ctx.beginPath();
                ctx.moveTo(this.x + 9 + dx, this.y - 7 + dy);
                ctx.lineTo(this.x + 2 + dx, this.y - 4 + dy);
                ctx.stroke();
            }
        }

        // --- AKSESUARLAR (Şapkalar) ---
        let activeAccessory = 'default_accessory';
        if (window.shopManager) {
            activeAccessory = window.shopManager.getActiveCosmetic('accessory') || 'default_accessory';
        }

        if (activeAccessory && activeAccessory !== 'default_accessory') {
            ctx.save();
            ctx.shadowBlur = 0; // Şapkada gölge parlaması olmasın
            
            const topX = this.x;
            const topY = this.y - this.radius + 3; // Başın üst kenarına hafifçe gömülü dursun
            
            if (activeAccessory === 'cowboy_hat') {
                // Kovboy Şapkası (Kahverengi)
                ctx.fillStyle = '#78350f';
                
                // Şapka siperi (Brim)
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY, 15, 3, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY, 8, 0, Math.PI * 2);
                }
                ctx.fill();
                
                // Şapka gövdesi (Crown)
                ctx.beginPath();
                ctx.moveTo(topX - 8, topY - 1);
                ctx.quadraticCurveTo(topX - 8, topY - 10, topX - 5, topY - 11);
                ctx.quadraticCurveTo(topX, topY - 8, topX + 5, topY - 11);
                ctx.quadraticCurveTo(topX + 8, topY - 1, topX + 8, topY - 1);
                ctx.closePath();
                ctx.fill();
                
                // Şapka şeridi (Siyah band)
                ctx.fillStyle = '#1e293b';
                ctx.fillRect(topX - 8, topY - 3, 16, 2);
            } else if (activeAccessory === 'wizard_hat') {
                // Büyücü Şapkası (Mor & Altın Yıldızlı) - Daha uzun ve belirgin
                ctx.fillStyle = '#581c87';
                
                // Siper
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY, 14, 3, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY, 8, 0, Math.PI * 2);
                }
                ctx.fill();
                
                // Koni (Daha yüksek)
                ctx.beginPath();
                ctx.moveTo(topX - 8, topY - 1);
                ctx.lineTo(topX + 8, topY - 1);
                ctx.quadraticCurveTo(topX + 2, topY - 13, topX - 3, topY - 22);
                ctx.closePath();
                ctx.fill();
                
                // Altın şerit
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(topX - 6.5, topY - 3, 13, 2);
                
                // Yıldız ucu
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(topX - 3, topY - 22.5, 1.8, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeAccessory === 'crown') {
                // Kral Tacı (Altın & Yakut) - Daha görkemli ve geniş
                ctx.fillStyle = '#f59e0b';
                
                // Gövde ve 3 sivri uç
                ctx.beginPath();
                ctx.moveTo(topX - 11, topY);
                ctx.lineTo(topX - 11, topY - 6);
                ctx.lineTo(topX - 6, topY - 2);
                ctx.lineTo(topX, topY - 10);
                ctx.lineTo(topX + 6, topY - 2);
                ctx.lineTo(topX + 11, topY - 6);
                ctx.lineTo(topX + 11, topY);
                ctx.closePath();
                ctx.fill();
                
                // Yakut süslemeler (Kırmızı noktalar)
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(topX - 11, topY - 6, 1.5, 0, Math.PI * 2);
                ctx.arc(topX, topY - 10, 1.5, 0, Math.PI * 2);
                ctx.arc(topX + 11, topY - 6, 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                // Mavi süslemeler (Bandın üzerinde)
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(topX - 5, topY - 1.5, 1.2, 0, Math.PI * 2);
                ctx.arc(topX + 5, topY - 1.5, 1.2, 0, Math.PI * 2);
                ctx.fill();
            } else if (activeAccessory === 'santa_hat') {
                // Noel Baba Şapkası (Kırmızı & Beyaz ponpon) - Dolgun, pofuduk ve sarkık tasarım
                
                // Beyaz yün siper (Kalın ve pofuduk)
                ctx.fillStyle = '#f1f5f9';
                ctx.beginPath();
                if (ctx.ellipse) {
                    ctx.ellipse(topX, topY - 1.5, 13, 4.5, 0, 0, Math.PI * 2);
                } else {
                    ctx.arc(topX, topY - 1.5, 9, 0, Math.PI * 2);
                }
                ctx.fill();
                
                // Kırmızı gövde (Dolu ve kıvrık duran hat)
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.moveTo(topX - 11, topY - 2);
                
                // Sol taraftan yukarı yuvarlakça uzanış
                ctx.quadraticCurveTo(topX - 9, topY - 25, topX - 1, topY - 27);
                // Tepe kıvrımından sağa doğru bükülüp aşağı sarkış
                ctx.quadraticCurveTo(topX + 7, topY - 27, topX + 12, topY - 16);
                // Ponponun bağlanacağı düz uç kısmı
                ctx.lineTo(topX + 9, topY - 13);
                // İç kıvrımın dolgunca sol tarafa geçişi
                ctx.quadraticCurveTo(topX + 3, topY - 19, topX - 2, topY - 19);
                // Sağ tabana doğru iniş ve birleşim
                ctx.quadraticCurveTo(topX + 5, topY - 12, topX + 11, topY - 2);
                ctx.lineTo(topX - 11, topY - 2);
                
                ctx.closePath();
                ctx.fill();
                
                // Beyaz ponpon (Ucun ucuna asılı durur)
                ctx.fillStyle = '#f1f5f9';
                ctx.beginPath();
                ctx.arc(topX + 11.5, topY - 14.5, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.restore();
    }
}
export default Player;


