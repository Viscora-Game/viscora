import { audio } from './audio.js?v=v104';

export class Enemy {
    constructor(x, y, rangeX = 150, speed = 1.2, isVertical = false, color = '#f43f5e') {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        
        this.isVertical = isVertical;
        this.vx = isVertical ? 0 : speed;
        this.vy = isVertical ? speed : 0;
        this.radius = 16;
        
        // Devriye Sınırları
        this.rangeX = rangeX;
        this.minX = x - rangeX;
        this.maxX = x + rangeX;
        this.minY = y - rangeX;
        this.maxY = y + rangeX;
        
        this.isDead = false;
        this.pulseTime = Math.random() * 100; // Pulsasyon animasyonu için
        
        // Düşman Tipi Tasarımı
        this.color = color;
        this.colorSecondary = this.getSecondaryColor(color);
    }

    getSecondaryColor(color) {
        if (color === '#f43f5e') return '#e11d48';
        if (color === '#06b6d4') return '#0891b2';
        if (color === '#d946ef') return '#b55fe6';
        if (color === '#eab308') return '#ca8a04';
        return '#e11d48';
    }

    /**
     * Düşman hareket yapay zekası ve sınır kontrolleri
     */
    update(level, player, emitParticles) {
        if (this.isDead) return;

        // Ölüm çukuru tespiti (Lava/Asit nehrine temas)
        if (this.y + this.radius >= level.height - 25) {
            this.isDead = true;
            if (emitParticles) {
                emitParticles(this.x, this.y, 'enemy_pop', this.color, 15);
            } else if (window.gameInstance && window.gameInstance.emitParticles) {
                window.gameInstance.emitParticles(this.x, this.y, 'enemy_pop', this.color, 15);
            }
            return;
        }

        const allPlats = [
            ...level.platforms,
            ...(level.staticMirrors || [])
        ];

        // İtilebilir Blok Çarpışması (Push Block Collision)
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
                    // Blok ezme kontrolü (yukarıdan düşen blok)
                    const isFallenOn = block.vy > 1.0 && block.y + block.h - block.vy <= this.y - this.radius + 12;
                    if (isFallenOn) {
                        this.isDead = true;
                        try { audio.playDamage(); } catch(e){}
                        if (window.gameInstance && window.gameInstance.emitParticles) {
                            window.gameInstance.emitParticles(this.x, this.y, 'enemy_pop', this.color, 22);
                        }
                        return;
                    }

                    // AABB Çember Çarpışma Çözümü (İtme)
                    const overlap = this.radius - distance;
                    let nx = dx / distance;
                    let ny = dy / distance;
                    
                    this.x += nx * overlap;
                    this.y += ny * overlap;
                    
                    // Eğer yatayda itildiyse ve dikey devriye değilse yön değiştir
                    if (Math.abs(nx) > Math.abs(ny)) {
                        if (!this.isVertical) {
                            this.vx = -this.vx;
                        }
                    } else {
                        if (ny < 0) { // Üstüne bastı
                            if (this.isVertical) {
                                this.vy = -this.vy;
                            } else {
                                this.vy = 0;
                            }
                        } else if (ny > 0) { // Kafasına çarptı
                            if (this.isVertical) {
                                this.vy = -this.vy;
                            }
                        }
                    }
                }
            }
        }

        if (this.isVertical) {
            // Y ekseninde hareket
            this.y += this.vy;

            // Devriye sınırlarına ulaştığında veya duvara çarptığında yön değiştir
            if (this.y < this.minY) {
                this.y = this.minY;
                this.vy = -this.vy;
            } else if (this.y > this.maxY) {
                this.y = this.maxY;
                this.vy = -this.vy;
            }

            // Platform duvar çarpışma tespiti (Dikey sekme)
            for (const plat of allPlats) {
                if (plat.passage) continue;
                if (this.checkAABBIntersection(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2, plat)) {
                    if (this.vy > 0) {
                        this.y = plat.y - this.radius;
                        this.vy = -this.vy;
                    } else if (this.vy < 0) {
                        this.y = plat.y + plat.h + this.radius;
                        this.vy = -this.vy;
                    }
                }
            }
        } else {
            // X ekseninde hareket
            this.x += this.vx;

            // Devriye sınırlarına ulaştığında veya duvara çarptığında yön değiştir
            if (this.x < this.minX) {
                this.x = this.minX;
                this.vx = -this.vx;
            } else if (this.x > this.maxX) {
                this.x = this.maxX;
                this.vx = -this.vx;
            }

            // Platform duvar çarpışma tespiti (Yatay sekme)
            for (const plat of allPlats) {
                if (plat.passage) continue;
                if (this.checkAABBIntersection(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2, plat)) {
                    if (this.vx > 0) {
                        this.x = plat.x - this.radius;
                        this.vx = -this.vx;
                    } else if (this.vx < 0) {
                        this.x = plat.x + plat.w + this.radius;
                        this.vx = -this.vx;
                    }
                }
            }
        }

        // Harita dışına çıkış engellemesi (Sınır koruma)
        if (this.x < this.radius) {
            this.x = this.radius;
            if (!this.isVertical) this.vx = -this.vx;
        } else if (this.x > level.width - this.radius) {
            this.x = level.width - this.radius;
            if (!this.isVertical) this.vx = -this.vx;
        }

        // Animasyon sayacı
        this.pulseTime += 0.08;
    }

    /**
     * Oyuncu ile temas çarpışma kontrolleri
     */
    checkCollision(player, emitParticles, onStomp) {
        if (this.isDead || player.isDead) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Daire çember çarpışması (Hafifçe küçültülmüş tolerans ile daha adil bir hissiyat)
        if (dist < player.radius + this.radius - 4) {
            
            // Eğer oyuncu yukarıdan düşüyorsa ve düşmanın tepesine basıyorsa (hız sıfırlanmış olsa bile prevVy kontrol edilir):
            const stompVy = player.vy > 0 ? player.vy : (player.prevVy > 0 ? player.prevVy : 0);
            const isSteppingOn = stompVy > 0 && player.y + player.radius - stompVy <= this.y - this.radius + 10;
            
            if (isSteppingOn) {
                this.isDead = true;
                
                // Oyuncuyu yukarı fırlat
                let bounceForce = 7.5;
                if (player.viscosity.id === 'LOW') bounceForce = 8.2;
                if (player.viscosity.id === 'HIGH') bounceForce = 5.0;
                
                player.vy = -bounceForce;
                player.onGround = false;
                player.applySquish(-0.4, 0.45);
                
                // Düşman patlama parçacıklarını artır (Cilalama: 22 partikül)
                if (emitParticles) {
                    emitParticles(this.x, this.y, 'enemy_pop', this.color, 22);
                }
                
                // Geri çağırıcı stomp olayını tetikle
                if (onStomp) {
                    onStomp();
                }
            } else {
                // Normal çarpışma: Oyuncu hasar alır
                player.takeDamage(1);
            }
        }
    }

    /**
     * AABB Çarpışma Yardımcısı
     */
    checkAABBIntersection(cx, cy, cw, ch, rect) {
        return cx < rect.x + rect.w &&
               cx + cw > rect.x &&
               cy < rect.y + rect.h &&
               cy + ch > rect.y;
    }

    /**
     * Düşmanı çizer
     */
    draw(ctx, camera) {
        if (this.isDead) return;

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Pulsasyon boyutu hesapla (Düşmanı canlı hissettirir)
        const pulse = Math.sin(this.pulseTime) * 1.5;
        const currentRadius = this.radius + pulse;

        // Dış neon glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12 + Math.abs(pulse) * 3;

        // Gövde gradyanı
        const grad = ctx.createRadialGradient(this.x - 3, this.y - 3, 2, this.x, this.y, currentRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, this.colorSecondary);
        ctx.fillStyle = grad;

        // Spiky virus-like şekli çiz
        ctx.beginPath();
        const numSpikes = 8;
        for (let i = 0; i < numSpikes; i++) {
            const angle = (i / numSpikes) * Math.PI * 2 + (this.pulseTime * 0.15);
            const outerR = currentRadius + 5;
            const innerR = currentRadius;

            // Spikelerin uçları
            const sx = this.x + Math.cos(angle) * outerR;
            const sy = this.y + Math.sin(angle) * outerR;

            // İç girintiler
            const nextAngle = ((i + 0.5) / numSpikes) * Math.PI * 2 + (this.pulseTime * 0.15);
            const ix = this.x + Math.cos(nextAngle) * innerR;
            const iy = this.y + Math.sin(nextAngle) * innerR;

            if (i === 0) {
                ctx.moveTo(sx, sy);
            } else {
                ctx.lineTo(sx, sy);
            }
            ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();

        // Çekirdek (Kötücül bir göz)
        ctx.fillStyle = '#0a0a0f';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Göz bebeği
        ctx.fillStyle = '#ef4444';
        const lookDir = Math.sign(this.vx) * 1.2;
        ctx.beginPath();
        ctx.arc(this.x + lookDir, this.y, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class GelChaser extends Enemy {
    constructor(x, y, rangeX = 150, speed = 1.0, color = '#10b981', type = 'chaser') {
        super(x, y, rangeX, speed, false, color);
        this.type = type;
        
        // Jel Takipçi Özel Durumları: 'patrol' (normal), 'alert' (algılama), 'warning' (uyarı), 'chase' (takip), 'exploded' (patladı)
        this.state = 'patrol';
        this.alertTimer = 0;
        this.chaseTimer = 0;
        this.chaseSpeed = 3.2; // Tasarımda önerilen takip hızı (2.5 - 4.0)
        this.detectionRadius = 240; // Tasarımda önerilen algılama mesafesi (6 - 8 birim: 240px)
        this.explosionRadius = 100; // Tasarımda önerilen patlama yarıçapı (2 - 3 birim: 100px)
        this.isExploded = false;
        
        this.baseRadius = 16;
        this.radius = 16;
        this.vy = 0;
        this.onGround = false;
        this.facingDir = 1;
    }

    /**
     * Platformların görüş çizgisini engelleyip engellemediğini kontrol eder (Raycast LOS)
     */
    hasLineOfSight(level, player) {
        if (!player) return false;
        
        const allPlats = [
            ...level.platforms,
            ...(level.staticMirrors || [])
        ];
        
        const x1 = this.x;
        const y1 = this.y;
        const x2 = player.x;
        const y2 = player.y;

        // İki çizgi parçasının (segment) kesişim testi (Standart 2D kesişim algoritması)
        const lineIntersects = (ax, ay, bx, by, cx, cy, dx, dy) => {
            const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
            if (d === 0) return false;
            const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
            const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
            return (u >= 0 && u <= 1) && (v >= 0 && v <= 1);
        };

        // Görüş çizgisinin herhangi bir katı (solid) platform kenarı tarafından kesilip kesilmediğine bakarız
        for (const plat of allPlats) {
            // Tek yönlü platformlar (geçitler) veya saydam engeller görüşü engellemez
            if (plat.passage) continue;
            
            const px1 = plat.x;
            const py1 = plat.y;
            const px2 = plat.x + plat.w;
            const py2 = plat.y + plat.h;

            // Platformun 4 kenarı
            if (
                lineIntersects(x1, y1, x2, y2, px1, py1, px1, py2) || // Sol kenar
                lineIntersects(x1, y1, x2, y2, px2, py1, px2, py2) || // Sağ kenar
                lineIntersects(x1, y1, x2, y2, px1, py1, px2, py1) || // Üst kenar
                lineIntersects(x1, y1, x2, y2, px1, py2, px2, py2)    // Alt kenar
            ) {
                return false; // Görüş engellendi!
            }
        }
        return true; // Engel yok, görüş açık!
    }

    /**
     * Düşman yapay zekası, platform fizik hareketi ve durum geçişleri
     */
    update(level, player, emitParticles) {
        if (this.isDead) return;

        // Ölüm çukuru tespiti (Lava/Asit nehrine temas)
        if (this.y + this.radius >= level.height - 25) {
            this.explode(player, emitParticles);
            return;
        }

        const allPlats = [
            ...level.platforms,
            ...(level.staticMirrors || [])
        ];

        // İtilebilir Blok Çarpışması (Push Block Collision)
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
                    // Blok ezme kontrolü (yukarıdan düşen blok)
                    const isFallenOn = block.vy > 1.0 && block.y + block.h - block.vy <= this.y - this.radius + 12;
                    if (isFallenOn) {
                        this.isDead = true;
                        try { audio.playDamage(); } catch(e){}
                        if (emitParticles) {
                            emitParticles(this.x, this.y, 'enemy_pop', this.color, 22);
                        } else if (window.gameInstance && window.gameInstance.emitParticles) {
                            window.gameInstance.emitParticles(this.x, this.y, 'enemy_pop', this.color, 22);
                        }
                        return;
                    }

                    // AABB Çember Çarpışma Çözümü (İtme)
                    const overlap = this.radius - distance;
                    let nx = dx / distance;
                    let ny = dy / distance;
                    
                    this.x += nx * overlap;
                    this.y += ny * overlap;
                    
                    // Eğer yatayda itildiyse ve devriye durumundaysa yön değiştir
                    if (Math.abs(nx) > Math.abs(ny)) {
                        if (this.state === 'patrol') {
                            this.vx = -this.vx;
                        }
                    } else {
                        if (ny < 0) { // Üstüne bastı
                            this.vy = 0;
                            this.onGround = true;
                        } else if (ny > 0) { // Kafasına çarptı
                            this.vy = 0;
                        }
                    }
                }
            }
        }

        // --- PLATFORM YERÇEKİMİ & DİKEY FİZİK ---
        this.vy += 0.28; // Yerçekimi ivmesi
        if (this.vy > 10) this.vy = 10; // Terminal hız limiti

        // Yatay hareket girdisini belirle
        if (this.state === 'patrol') {
            // Normal devriye hareketi
            this.x += this.vx;
            
            // Devriye sınır kontrolü
            if (this.x < this.minX) {
                this.x = this.minX;
                this.vx = -this.vx;
            } else if (this.x > this.maxX) {
                this.x = this.maxX;
                this.vx = -this.vx;
            }
            this.facingDir = Math.sign(this.vx) || 1;
        } else if (this.state === 'chase') {
            // Oyuncuya doğru koş
            const chaseDir = player ? Math.sign(player.x - this.x) : 1;
            this.vx = (chaseDir || 1) * this.chaseSpeed;
            this.x += this.vx;
            this.facingDir = chaseDir || 1;
        } else {
            // Alert/Warning durumlarında duraklar
            this.vx = 0;
        }

        // Yatay çarpışma çözümü (Platform duvarları)
        let hitWall = false;
        for (const plat of allPlats) {
            if (plat.passage) continue;
            // Yatay kontrolü yaparken dikeyde 4px daraltılmış kutu kullanıyoruz ki üzerinde durduğu zemini duvar sanmasın
            if (this.checkAABBIntersection(this.x - this.radius, this.y - this.radius + 4, this.radius * 2, this.radius * 2 - 8, plat)) {
                hitWall = true;
                if (this.vx > 0) {
                    this.x = plat.x - this.radius;
                } else if (this.vx < 0) {
                    this.x = plat.x + plat.w + this.radius;
                }
                if (this.state === 'patrol') {
                    this.vx = -this.vx;
                }
            }
        }

        // Dikey hareket uygula
        this.y += this.vy;
        this.onGround = false;

        // Dikey çarpışma çözümü (Zemin & Tavan)
        for (const plat of allPlats) {
            if (plat.passage) {
                // Tek yönlü platformlar (aşağı düşerken basılabilir)
                if (this.vy > 0 && this.y + this.radius - this.vy <= plat.y + 4 &&
                    this.x + this.radius > plat.x && this.x - this.radius < plat.x + plat.w) {
                    this.y = plat.y - this.radius;
                    this.vy = 0;
                    this.onGround = true;
                }
                continue;
            }
            if (this.checkAABBIntersection(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2, plat)) {
                if (this.vy > 0) {
                    this.y = plat.y - this.radius;
                    this.vy = 0;
                    this.onGround = true;
                } else if (this.vy < 0) {
                    this.y = plat.y + plat.h + this.radius;
                    this.vy = 0;
                }
            }
        }

        // Akıllı Zıplama Yapay Zekası: Kovalama modundayken duvara çarparsa ve yerdeyse üzerinden atlar
        if (this.state === 'chase' && hitWall && this.onGround) {
            this.vy = -6.5;
            this.onGround = false;
        }

        // Harita dışına çıkış engellemesi (Sınır koruma)
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = 0;
        } else if (this.x > level.width - this.radius) {
            this.x = level.width - this.radius;
            this.vx = 0;
        }

        // --- DURUM GEÇİŞLERİ VE ZAMANLAYICILAR ---
        if (this.state === 'patrol' && player && !player.isDead) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.detectionRadius && this.hasLineOfSight(level, player)) {
                this.state = 'alert';
                this.alertTimer = 24; // 0.4 sn (60fps varsayımı ile)
                this.vx = 0;
            }
        }

        if (this.state === 'alert') {
            this.alertTimer--;
            if (this.alertTimer <= 0) {
                this.state = 'warning';
                this.alertTimer = 24; // 0.4 sn
            }
        } else if (this.state === 'warning') {
            this.alertTimer--;
            if (this.alertTimer <= 0) {
                this.state = 'chase';
                this.chaseTimer = 2.5; // Tasarımda önerilen 2.5 sn patlama süresi
            }
        } else if (this.state === 'chase') {
            this.chaseTimer -= (1 / 60);

            // Kovalarken arkasında koşma izi partikülleri yay
            if (Math.random() < 0.3 && emitParticles) {
                emitParticles(
                    this.x + (Math.random() - 0.5) * this.radius,
                    this.y + (Math.random() - 0.5) * this.radius,
                    'trail',
                    '#ef4444',
                    1
                );
            }

            // Şişme efekti (radius dinamik büyümesi)
            const oldRadius = this.radius;
            this.radius = this.baseRadius + (1 - this.chaseTimer / 2.5) * 14; // Yarıçapı 16px'ten 30px'e şişer
            if (this.onGround) {
                this.y -= (this.radius - oldRadius);
            }

            if (this.chaseTimer <= 0) {
                this.explode(player, emitParticles);
            }
        }

        this.pulseTime += (this.state === 'chase' ? 0.22 : 0.08);
    }

    /**
     * Düşmanın alan hasarlı patlaması
     */
    explode(player, emitParticles) {
        this.isDead = true;
        this.isExploded = true;

        // Patlama ses efekti tetikleme denemesi
        if (player && player.game && player.game.audio) {
            try { player.game.audio.playExplode && player.game.audio.playExplode(); } catch(e){}
        }

        // Oyuncu patlama alanındaysa hasar ver ve fırlat
        if (player && !player.isDead) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= this.explosionRadius) {
                player.takeDamage(2); // Tasarımdaki Orta-Yüksek patlama hasarı (2 can gider)
                
                // Oyuncuyu geriye ve havaya doğru fırlatma (Blast Force)
                const pushForce = 6;
                player.vx += (dx / (dist || 1)) * pushForce;
                player.vy = -5.5;
                player.applySquish(-0.5, 0.6);
            }
        }

        // Tasarımdaki sıvı patlama efekti (Etrafa saçılan 35 adet kırmızı jöle parçacığı)
        if (emitParticles) {
            emitParticles(this.x, this.y, 'enemy_pop', '#ef4444', 35);
        }
    }

    /**
     * Oyuncu ile temas/çarpışma kontrolleri (Kovalarken anında patlar)
     */
    checkCollision(player, emitParticles, onStomp) {
        if (this.isDead || player.isDead) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Daire çember çarpışması
        if (dist < player.radius + this.radius - 4) {
            const stompVy = player.vy > 0 ? player.vy : (player.prevVy > 0 ? player.prevVy : 0);
            const isSteppingOn = stompVy > 0 && player.y + player.radius - stompVy <= this.y - this.radius + 10;

            if (this.state === 'chase') {
                // Kovalama modunda patlama zamanlayıcısı kontrolü
                if (this.chaseTimer < 1.0) {
                    // Son 1 saniyede (aşırı kararsız flaş modu) her türlü temas anında patlatır!
                    this.explode(player, emitParticles);
                    if (onStomp) onStomp();
                } else {
                    // İlk 1.5 saniyede (şişme aşaması) tam üstüne basarak chaser'ı güvenle defuse edebiliriz!
                    if (isSteppingOn) {
                        this.isDead = true;
                        
                        let bounceForce = 7.5;
                        if (player.viscosity.id === 'LOW') bounceForce = 8.2;
                        if (player.viscosity.id === 'HIGH') bounceForce = 5.0;
                        
                        player.vy = -bounceForce;
                        player.onGround = false;
                        player.applySquish(-0.4, 0.45);
                        
                        // Defuse edilince güvenli yeşil parçacıklar yayarız
                        if (emitParticles) {
                            emitParticles(this.x, this.y, 'enemy_pop', '#10b981', 22);
                        }
                        
                        if (onStomp) {
                            onStomp();
                        }
                    } else {
                        // Yanına çarparsa patlar
                        this.explode(player, emitParticles);
                        if (onStomp) onStomp();
                    }
                }
            } else {
                // Diğer durumlarda (devriye, algılama, uyarı) standart ezme/ezilme davranışları
                if (isSteppingOn) {
                    this.isDead = true;
                    
                    let bounceForce = 7.5;
                    if (player.viscosity.id === 'LOW') bounceForce = 8.2;
                    if (player.viscosity.id === 'HIGH') bounceForce = 5.0;
                    
                    player.vy = -bounceForce;
                    player.onGround = false;
                    player.applySquish(-0.4, 0.45);
                    
                    if (emitParticles) {
                        emitParticles(this.x, this.y, 'enemy_pop', this.color, 22);
                    }
                    
                    if (onStomp) {
                        onStomp();
                    }
                } else {
                    player.takeDamage(1);
                }
            }
        }
    }

    /**
     * Jel Takipçiyi şablona sadık kalarak çizer
     */
    draw(ctx, camera) {
        if (this.isDead) return;

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Durum renkleri belirleme
        let bodyColor = '#10b981'; // Normal: Yeşil
        let secondaryColor = '#047857';
        let glowColor = '#10b981';
        let shakeX = 0, shakeY = 0;

        if (this.state === 'alert') {
            bodyColor = '#eab308'; // Algılama: Sarı
            secondaryColor = '#a16207';
            glowColor = '#eab308';
        } else if (this.state === 'warning') {
            bodyColor = '#f97316'; // Uyarı: Turuncu
            secondaryColor = '#c2410c';
            glowColor = '#f97316';
            // Uyarı titremesi
            shakeX = (Math.random() - 0.5) * 3;
            shakeY = (Math.random() - 0.5) * 3;
        } else if (this.state === 'chase') {
            bodyColor = '#ef4444'; // Takip/Patlama: Kırmızı
            secondaryColor = '#991b1b';
            glowColor = '#ef4444';

            // Son 1 saniyede patlama flaş efekti (kırmızı/beyaz hızlı yanıp sönme)
            if (this.chaseTimer < 1.0 && Math.floor(this.chaseTimer * 10) % 2 === 0) {
                bodyColor = '#ffffff';
                secondaryColor = '#ef4444';
                glowColor = '#ffffff';
            }
        }

        ctx.translate(shakeX, shakeY);

        const pulse = Math.sin(this.pulseTime) * 1.2;
        const currentRadius = this.radius + pulse;

        // Dış neon glow efekti
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = this.state === 'chase' ? (16 + pulse * 4) : (10 + Math.abs(pulse) * 2);

        // 3D Kubbe gradyanı
        const grad = ctx.createRadialGradient(
            this.x - currentRadius * 0.2, 
            this.y - currentRadius * 0.2, 
            2, 
            this.x, 
            this.y, 
            currentRadius
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, bodyColor);
        grad.addColorStop(1, secondaryColor);
        ctx.fillStyle = grad;

        // --- JEL KUBBE GÖVDESİ ---
        ctx.beginPath();
        // Üst yarım kubbe
        ctx.arc(this.x, this.y - currentRadius * 0.08, currentRadius, Math.PI, 0, false);
        // Alt kısmı kapat
        ctx.lineTo(this.x + currentRadius, this.y + currentRadius * 0.5);
        ctx.lineTo(this.x - currentRadius, this.y + currentRadius * 0.5);
        ctx.closePath();
        ctx.fill();

        // --- HAREKETLİ JEL AYAKLAR ---
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.arc(this.x - currentRadius * 0.6, this.y + currentRadius * 0.45, currentRadius * 0.24, 0, Math.PI * 2);
        ctx.arc(this.x, this.y + currentRadius * 0.52, currentRadius * 0.26, 0, Math.PI * 2);
        ctx.arc(this.x + currentRadius * 0.6, this.y + currentRadius * 0.45, currentRadius * 0.24, 0, Math.PI * 2);
        ctx.fill();

        // --- KIZGIN GÖZLER & EYEBROWS ---
        ctx.shadowBlur = 0; // Detay çizimlerinde gölgeyi kapat
        const eyeRadius = currentRadius * 0.22;
        const eyeSpacing = currentRadius * 0.32;
        const lookDir = this.facingDir;

        // Siyah göz yuvaları
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(this.x - eyeSpacing, this.y - currentRadius * 0.08, eyeRadius, 0, Math.PI * 2);
        ctx.arc(this.x + eyeSpacing, this.y - currentRadius * 0.08, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        // Kızgın kaşlar (Eğik siyah çizgiler)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = currentRadius * 0.15;
        ctx.lineCap = 'round';
        
        // Sol kaş
        ctx.beginPath();
        ctx.moveTo(this.x - eyeSpacing - eyeRadius * 1.2, this.y - currentRadius * 0.23);
        ctx.lineTo(this.x - eyeSpacing + eyeRadius * 1.2, this.y - currentRadius * 0.02);
        ctx.stroke();

        // Sağ kaş
        ctx.beginPath();
        ctx.moveTo(this.x + eyeSpacing + eyeRadius * 1.2, this.y - currentRadius * 0.23);
        ctx.lineTo(this.x + eyeSpacing - eyeRadius * 1.2, this.y - currentRadius * 0.02);
        ctx.stroke();

        // Göz bebekleri (Normalde beyaz, uyarılınca/kovalarken kırmızı parlar)
        ctx.fillStyle = (this.state === 'patrol') ? '#ffffff' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(this.x - eyeSpacing + lookDir * 1.2, this.y - currentRadius * 0.06, 2.2, 0, Math.PI * 2);
        ctx.arc(this.x + eyeSpacing + lookDir * 1.2, this.y - currentRadius * 0.06, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // --- TEPEDEKİ UYARI İKONLARI ---
        if (this.state === 'alert') {
            ctx.fillStyle = '#eab308';
            ctx.font = '800 16px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('!', this.x, this.y - currentRadius - 8);
        } else if (this.state === 'warning') {
            ctx.fillStyle = '#f97316';
            ctx.font = '800 18px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('💢', this.x, this.y - currentRadius - 10);
        }

        ctx.restore();
    }
}

export default Enemy;
