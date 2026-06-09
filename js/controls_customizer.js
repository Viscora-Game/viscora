/**
 * VISCORA — Mobil Kontrol Özelleştirici
 * Oyuncunun butonları sürükleyip boyutunu ayarlamasına olanak tanır.
 */
class ControlsCustomizer {
    constructor() {
        this.STORAGE_KEY = 'viscora_controls_v3';
        this.buttonIds = ['btn-left', 'btn-right', 'btn-jump', 'btn-down', 'btn-shift'];
        this.layer = document.getElementById('mobile-controls');
        this.isEditing = false;
        this.draggingBtn = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.currentSize = 90;

        // Arrow function bound methods for event removal
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd   = this._onTouchEnd.bind(this);

        this.activeBtn = null; // Seçili buton (bireysel boyutlandırma için)
        this.savedLayout = this._load();
        if (this.savedLayout) this._applyLayout(this.savedLayout);

        this._createPanel();
        this._injectGearButton();
    }

    /* ── Storage ─────────────────────────────────────── */

    _load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data && data.positions) {
                // Pozisyonların geçerli olup olmadığını doğrula (NaN veya Infinity olmamalı)
                for (const id in data.positions) {
                    const pos = data.positions[id];
                    if (!isFinite(pos.leftPct) || !isFinite(pos.topPct)) {
                        return null; // Geçersiz düzeni yok say ve sıfırla
                    }
                }
            }
            return data;
        } catch { return null; }
    }

    _persist() {
        if (!this.layer) return;
        const positions = {};
        let valid = true;
        this.buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const ur = this._getUnrotatedRect(btn);
            if (ur.containerWidth <= 0 || ur.containerHeight <= 0) {
                valid = false;
                return;
            }
            positions[id] = {
                leftPct: (ur.left / ur.containerWidth) * 100,
                topPct:  (ur.top  / ur.containerHeight) * 100,
                size: parseInt(btn.dataset.customSize || btn.style.width) || this.currentSize
            };
        });
        if (!valid) return;
        const data = { positions, size: this.currentSize };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        this.savedLayout = data;
    }

    /* ── Apply layout ────────────────────────────────── */

    _applyLayout(layout) {
        if (!layout || !layout.positions) return;
        this.currentSize = layout.size || 90;

        // Butonları doğrudan layer'ın içine taşı
        this.buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            if (btn.parentElement !== this.layer) this.layer.appendChild(btn);

            const pos = layout.positions[id];
            if (!pos) return;

            const size = pos.size || this.currentSize;
            btn.style.position = 'absolute';
            btn.style.left     = pos.leftPct + '%';
            btn.style.top      = pos.topPct  + '%';
            btn.style.right    = 'auto';
            btn.style.bottom   = 'auto';
            btn.dataset.customSize = size;

            if (id === 'btn-shift') {
                btn.style.width  = Math.round(size * 1.15) + 'px';
                btn.style.height = size + 'px';
            } else {
                btn.style.width  = size + 'px';
                btn.style.height = size + 'px';
            }
        });

        // Orijinal flex kapsayıcıları gizle
        this._setDpadVisibility(false);
    }

    _setDpadVisibility(visible) {
        ['dpad-left', 'dpad-right'].forEach(cls => {
            const el = this.layer.querySelector('.' + cls);
            if (el) el.style.display = visible ? '' : 'none';
        });
    }

    /* ── Capture current (default) positions ─────────── */

    _captureCurrentPositions() {
        const positions = {};
        this.buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const ur = this._getUnrotatedRect(btn);
            positions[id] = {
                leftPct: (ur.left / ur.containerWidth) * 100,
                topPct:  (ur.top  / ur.containerHeight) * 100,
                size: this.currentSize
            };
        });
        return { positions, size: this.currentSize };
    }

    /* ── Edit mode ───────────────────────────────────── */

    enterEditMode() {
        if (this.isEditing) return;
        this.isEditing = true;

        // Oyunu arka planda dondur
        if (window.gameInstance) {
            window.gameInstance.pausedForCustomizer = true;
        }

        // Controls'ı geçici olarak göster (gizliyse)
        this.layer.classList.remove('hidden');

        // Eğer kaydedilmiş layout yoksa, mevcut pozisyonları yakala
        if (!this.savedLayout) {
            const captured = this._captureCurrentPositions();
            this._applyLayout(captured);
        }

        this.layer.classList.add('ctrl-editing');
        this.layer.style.pointerEvents = 'auto';

        this.buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.add('ctrl-editable');
                btn.addEventListener('touchstart', this._onTouchStart, { passive: false });
                btn.addEventListener('mousedown',  this._onMouseDown);
            }
        });

        const panel = document.getElementById('ctrl-edit-panel');
        if (panel) {
            panel.style.display = 'flex';
        }

        // İlk butonu varsayılan olarak seç
        const firstBtn = document.getElementById(this.buttonIds[0]);
        if (firstBtn) {
            this._selectButton(firstBtn);
        }
    }

    exitEditMode(doSave) {
        if (!this.isEditing) return;
        this.isEditing = false;

        // Oyunu devam ettir
        if (window.gameInstance) {
            window.gameInstance.pausedForCustomizer = false;
            window.gameInstance.lastTime = performance.now();
        }

        // Seçim çerçevesini kaldır
        if (this.activeBtn) {
            this.activeBtn.classList.remove('ctrl-selected');
            this.activeBtn = null;
        }

        this.buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('ctrl-editable', 'ctrl-dragging');
                btn.removeEventListener('touchstart', this._onTouchStart);
                btn.removeEventListener('mousedown',  this._onMouseDown);
            }
        });

        this.layer.classList.remove('ctrl-editing');
        this.layer.style.pointerEvents = 'none';

        const panel = document.getElementById('ctrl-edit-panel');
        if (panel) panel.style.display = 'none';

        if (doSave) {
            this._persist();
        } else if (this.savedLayout) {
            // İptal — önceki layout'u geri yükle
            this._applyLayout(this.savedLayout);
        }

        // Oyun kontrollerinin pointer events'ini geri aç
        ['dpad-left', 'dpad-right'].forEach(cls => {
            const el = this.layer.querySelector('.' + cls);
            if (el) el.style.pointerEvents = 'auto';
        });
    }

    resetToDefault() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.savedLayout = null;
        this.currentSize = 90;

        if (this.activeBtn) {
            this.activeBtn.classList.remove('ctrl-selected');
            this.activeBtn = null;
        }

        // Butonları orijinal flex kaplarına geri taşı
        const dpadLeft  = this.layer.querySelector('.dpad-left');
        const dpadRight = this.layer.querySelector('.dpad-right');

        ['btn-left', 'btn-right'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn && dpadLeft) {
                this._clearBtnStyles(btn);
                dpadLeft.appendChild(btn);
            }
        });
        ['btn-shift', 'btn-jump', 'btn-down'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn && dpadRight) {
                this._clearBtnStyles(btn);
                dpadRight.appendChild(btn);
            }
        });

        this._setDpadVisibility(true);

        // Slider'ı sıfırla
        const slider = document.getElementById('cep-slider');
        if (slider) {
            slider.value = 90;
            document.getElementById('cep-size-val').textContent = '90px';
        }

        this.exitEditMode(false);
    }

    _clearBtnStyles(btn) {
        btn.style.position = '';
        btn.style.left     = '';
        btn.style.top      = '';
        btn.style.right    = '';
        btn.style.bottom   = '';
        btn.style.width    = '';
        btn.style.height   = '';
        delete btn.dataset.customSize;
    }

    /* ── Bireysel Seçim ve Boyutlandırma Metotları ────── */

    _selectButton(btn) {
        if (this.activeBtn) {
            this.activeBtn.classList.remove('ctrl-selected');
        }
        this.activeBtn = btn;
        this.activeBtn.classList.add('ctrl-selected');

        const size = parseInt(btn.dataset.customSize || btn.style.width) || this.currentSize;
        const slider = document.getElementById('cep-slider');
        if (slider) {
            slider.value = size;
            document.getElementById('cep-size-val').textContent = size + 'px';
        }

        const names = {
            'btn-left': 'Sol Buton',
            'btn-right': 'Sağ Buton',
            'btn-jump': 'Zıplama Butonu',
            'btn-down': 'Eğilme Butonu',
            'btn-shift': 'Shift Butonu'
        };
        const activeText = document.getElementById('cep-active-text');
        if (activeText) {
            activeText.textContent = `Seçili: ${names[btn.id] || btn.id}`;
        }
    }

    _resizeButton(btn, size) {
        btn.dataset.customSize = size;
        if (btn.id === 'btn-shift') {
            btn.style.width  = Math.round(size * 1.15) + 'px';
            btn.style.height = size + 'px';
        } else {
            btn.style.width  = size + 'px';
            btn.style.height = size + 'px';
        }
    }

    /* ── Rotasyon Destekli Yardımcı Metotlar ─────────── */

    _getUnrotatedRect(btn) {
        const r = btn.getBoundingClientRect();
        const lr = this.layer.getBoundingClientRect();
        const isPortrait = window.innerHeight > window.innerWidth;
        const isGameActive = document.body.classList.contains('game-active');

        if (isPortrait && isGameActive) {
            const W = window.innerWidth;
            const H = window.innerHeight;
            // Dikey ekran döndüğünde katman genişliği H, yüksekliği W olur
            const unrotLeft = r.top;
            const unrotTop = W - r.left - r.width;
            return {
                left: unrotLeft,
                top: unrotTop,
                width: r.height,
                height: r.width,
                containerWidth: H,
                containerHeight: W
            };
        } else {
            return {
                left: r.left - lr.left,
                top: r.top - lr.top,
                width: r.width,
                height: r.height,
                containerWidth: lr.width,
                containerHeight: lr.height
            };
        }
    }

    /* ── Touch drag ──────────────────────────────────── */

    _onTouchStart(e) {
        if (!this.isEditing) return;
        e.preventDefault();
        const btn = e.currentTarget;
        this._selectButton(btn); // Butonu seç
        const touch = e.touches[0];
        const ur = this._getUnrotatedRect(btn);
        
        const isPortrait = window.innerHeight > window.innerWidth;
        const isGameActive = document.body.classList.contains('game-active');
        this.draggingBtn = btn;
        
        if (isPortrait && isGameActive) {
            const W = window.innerWidth;
            const clickX = touch.clientY;
            const clickY = W - touch.clientX;
            this.dragOffsetX = clickX - ur.left;
            this.dragOffsetY = clickY - ur.top;
        } else {
            const lr = this.layer.getBoundingClientRect();
            this.dragOffsetX = touch.clientX - lr.left - ur.left;
            this.dragOffsetY = touch.clientY - lr.top - ur.top;
        }
        
        btn.classList.add('ctrl-dragging');
        document.addEventListener('touchmove', this._onTouchMove, { passive: false });
        document.addEventListener('touchend',  this._onTouchEnd);
    }

    _onTouchMove(e) {
        if (!this.draggingBtn) return;
        e.preventDefault();
        const touch = e.touches[0];
        this._moveDragging(touch.clientX, touch.clientY);
    }

    _onTouchEnd() {
        if (this.draggingBtn) this.draggingBtn.classList.remove('ctrl-dragging');
        this.draggingBtn = null;
        document.removeEventListener('touchmove', this._onTouchMove);
        document.removeEventListener('touchend',  this._onTouchEnd);
    }

    /* Mouse drag (PC'de test için) */
    _onMouseDown = (e) => {
        if (!this.isEditing) return;
        const btn = e.currentTarget;
        this._selectButton(btn); // Butonu seç
        const ur = this._getUnrotatedRect(btn);
        
        const isPortrait = window.innerHeight > window.innerWidth;
        const isGameActive = document.body.classList.contains('game-active');
        this.draggingBtn = btn;
        
        if (isPortrait && isGameActive) {
            const W = window.innerWidth;
            const clickX = e.clientY;
            const clickY = W - e.clientX;
            this.dragOffsetX = clickX - ur.left;
            this.dragOffsetY = clickY - ur.top;
        } else {
            const lr = this.layer.getBoundingClientRect();
            this.dragOffsetX = e.clientX - lr.left - ur.left;
            this.dragOffsetY = e.clientY - lr.top - ur.top;
        }
        
        btn.classList.add('ctrl-dragging');

        const onMove = (ev) => this._moveDragging(ev.clientX, ev.clientY);
        const onUp   = () => {
            if (this.draggingBtn) this.draggingBtn.classList.remove('ctrl-dragging');
            this.draggingBtn = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
    }

    _moveDragging(clientX, clientY) {
        if (!this.draggingBtn) return;
        const isPortrait = window.innerHeight > window.innerWidth;
        const isGameActive = document.body.classList.contains('game-active');
        
        let containerWidth, containerHeight;
        let x, y;
        
        if (isPortrait && isGameActive) {
            const W = window.innerWidth;
            const H = window.innerHeight;
            containerWidth = H;
            containerHeight = W;
            x = clientY - this.dragOffsetX;
            y = (W - clientX) - this.dragOffsetY;
        } else {
            const lr = this.layer.getBoundingClientRect();
            containerWidth = lr.width;
            containerHeight = lr.height;
            x = clientX - this.dragOffsetX - lr.left;
            y = clientY - this.dragOffsetY - lr.top;
        }
        
        const bw = this.draggingBtn.offsetWidth;
        const bh = this.draggingBtn.offsetHeight;
        
        x = Math.max(0, Math.min(x, containerWidth  - bw));
        y = Math.max(0, Math.min(y, containerHeight - bh));
        
        this.draggingBtn.style.position = 'absolute';
        this.draggingBtn.style.left   = (x / containerWidth  * 100) + '%';
        this.draggingBtn.style.top    = (y / containerHeight * 100) + '%';
        this.draggingBtn.style.right  = 'auto';
        this.draggingBtn.style.bottom = 'auto';
    }

    /* ── UI Creation ─────────────────────────────────── */

    _createPanel() {
        const panel = document.createElement('div');
        panel.id = 'ctrl-edit-panel';
        panel.innerHTML = `
            <div class="cep-title">🎮 Kontrolleri Düzenle</div>
            <p id="cep-active-text" class="cep-hint">Boyutlandırmak için bir butona basın</p>
            <div class="cep-row">
                <span class="cep-label">Boyut</span>
                <input type="range" id="cep-slider" min="50" max="130" value="90" step="5" class="cep-slider">
                <span id="cep-size-val" class="cep-val">90px</span>
            </div>
            <div class="cep-btns">
                <button id="cep-cancel" class="cep-btn cep-secondary">✕ İptal</button>
                <button id="cep-reset-btn" class="cep-btn cep-danger">↺ Sıfırla</button>
                <button id="cep-save-btn" class="cep-btn cep-primary">✓ Kaydet</button>
            </div>
        `;
        panel.style.display = 'none';
        document.body.appendChild(panel);

        document.getElementById('cep-save-btn').addEventListener('click',   () => this.exitEditMode(true));
        document.getElementById('cep-cancel').addEventListener('click',     () => this.exitEditMode(false));
        document.getElementById('cep-reset-btn').addEventListener('click',  () => this.resetToDefault());
        document.getElementById('cep-slider').addEventListener('input', (e) => {
            const v = parseInt(e.target.value);
            document.getElementById('cep-size-val').textContent = v + 'px';
            if (this.activeBtn) {
                this._resizeButton(this.activeBtn, v);
            }
        });
    }

    _injectGearButton() {
        // Sadece dokunmatik cihazlarda göster
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!isTouchDevice) return;

        const btn = document.createElement('button');
        btn.id        = 'btn-ctrl-gear';
        btn.className = 'hud-btn ctrl-gear-hud-btn';
        btn.title     = 'Kontrolleri Düzenle';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        btn.addEventListener('click', () => this.enterEditMode());

        // HUD'a ekle
        const hud = document.querySelector('.hud-right-panel') || document.querySelector('.hud-top') || document.getElementById('hud-top') || document.getElementById('game-hud');
        if (hud) hud.appendChild(btn);
    }
}

// Başlat
window.addEventListener('DOMContentLoaded', () => {
    window.controlsCustomizer = new ControlsCustomizer();
});
