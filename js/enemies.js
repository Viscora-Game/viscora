/**
 * Viscora Enemy System
 */

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
    update(level) {
        if (this.isDead) return;

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
            for (const plat of level.platforms) {
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
            for (const plat of level.platforms) {
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

export default Enemy;
