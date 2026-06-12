/**
 * Viscora Procedural Audio Engine
 * Uses the Web Audio API to synthesize all sound effects and ambient music in real-time.
 * Requires zero external audio files.
 */

class AudioManager {
    constructor() {
        // Load persisted audio configurations
        const savedMusicVol = localStorage.getItem('viscora_music_volume');
        const savedSfxVol = localStorage.getItem('viscora_sfx_volume');
        const savedMusicMuted = localStorage.getItem('viscora_music_muted');
        const savedSfxMuted = localStorage.getItem('viscora_sfx_muted');

        this.musicVolumeLevel = savedMusicVol !== null ? parseFloat(savedMusicVol) : 0.5;
        this.sfxVolumeLevel = savedSfxVol !== null ? parseFloat(savedSfxVol) : 0.8;
        this.isMusicMuted = savedMusicMuted !== null ? savedMusicMuted === 'true' : false;
        this.isSfxMuted = savedSfxMuted !== null ? savedSfxMuted === 'true' : false;

        this.ctx = null;
        this.masterVolume = null;
        this.musicVolume = null;
        this.sfxVolume = null;
        this.musicIntervalId = null;
        this.isMuted = false;
        this.musicPlaying = false;
        this.volumeLevel = 0.8;
        
        // Ambient chord progression: Cmaj7 - Am9 - Fmaj7 - G6/9
        this.chords = [
            [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3
            [110.00, 146.83, 164.81, 220.00], // A2, D3, E3, A3
            [87.31,  130.81, 174.61, 218.08], // F2, C3, F3, A3
            [98.00,  146.83, 196.00, 246.94]  // G2, D3, G3, B3
        ];
        this.currentChordIndex = 0;
    }

    /**
     * Initialize AudioContext upon user interaction
     */
    init() {
        if (this.ctx) return;

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            
            // Setup master nodes
            this.masterVolume = this.ctx.createGain();
            this.masterVolume.gain.setValueAtTime(1.0, this.ctx.currentTime);
            this.masterVolume.connect(this.ctx.destination);
            
            // Web Audio Filter for dynamic state music transitions
            this.viscosityFilter = this.ctx.createBiquadFilter();
            this.viscosityFilter.type = 'lowpass';
            this.viscosityFilter.frequency.setValueAtTime(20000, this.ctx.currentTime);
            this.viscosityFilter.connect(this.masterVolume);

            this.musicVolume = this.ctx.createGain();
            const initialMusicGain = this.isMusicMuted ? 0 : (this.musicVolumeLevel * 0.35);
            this.musicVolume.gain.setValueAtTime(initialMusicGain, this.ctx.currentTime);
            this.musicVolume.connect(this.viscosityFilter);
            
            this.sfxVolume = this.ctx.createGain();
            const initialSfxGain = this.isSfxMuted ? 0 : (this.sfxVolumeLevel * 0.75);
            this.sfxVolume.gain.setValueAtTime(initialSfxGain, this.ctx.currentTime);
            this.sfxVolume.connect(this.masterVolume);

            // Resume context if suspended (common on Chrome/mobile)
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            // Android/iOS: AudioContext'i ilk dokunuşta kilit aç (Autoplay Policy)
            if (!this._unlockHandlerAdded) {
                this._unlockHandlerAdded = true;
                const unlock = () => {
                    if (this.ctx && this.ctx.state === 'suspended') {
                        this.ctx.resume().then(() => {
                            // Müzik çalması gerekiyorsa yeniden başlat
                            if (this.musicPlaying && !this.musicIntervalId) {
                                this.startMusic();
                            }
                        });
                    }
                    document.removeEventListener('touchstart', unlock);
                    document.removeEventListener('touchend', unlock);
                    document.removeEventListener('click', unlock);
                };
                document.addEventListener('touchstart', unlock, { passive: true });
                document.addEventListener('touchend', unlock, { passive: true });
                document.addEventListener('click', unlock);
            }

            // Auto-suspend/resume AudioContext on visibility change to stop background audio
            if (!this._visibilityHandlerAdded) {
                this._visibilityHandlerAdded = true;
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        if (this.ctx && this.ctx.state === 'running') {
                            this.ctx.suspend();
                        }
                    } else {
                        if (this.ctx && this.ctx.state === 'suspended') {
                            this.ctx.resume().then(() => {
                                if (this.musicPlaying && this.playChordRef) {
                                    if (this.musicIntervalId) {
                                        clearInterval(this.musicIntervalId);
                                    }
                                    this.playChordRef();
                                    this.musicIntervalId = setInterval(this.playChordRef, 5000);
                                }
                            });
                        }
                    }
                });
            }

            console.log("Viscora Audio Engine Initialized successfully.");
        } catch (e) {
            console.error("Web Audio API not supported on this browser:", e);
        }
    }

    /**
     * Robust Web Audio unlock for mobile browsers (iOS/Android)
     * Plays a brief silent buffer sound inside user interaction callback
     */
    unlock() {
        if (!this.ctx) return;
        this.ctx.resume().then(() => {
            if (this.musicPlaying && !this.musicIntervalId) {
                this.startMusic();
            }
        });
        try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start(0);
        } catch (e) {
            console.warn("Silent buffer play failed:", e);
        }
    }

    /**
     * Ensure the AudioContext is running
     * Returns a Promise that resolves when context is running
     */
    resume() {
        try {
            if (this.ctx && this.ctx.state === 'suspended') {
                return this.ctx.resume();
            }
        } catch (e) {
            console.error("Error resuming AudioContext:", e);
        }
        return Promise.resolve();
    }

    /**
     * Mute or Unmute audio
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        try {
            if (this.masterVolume && this.ctx) {
                const targetGain = this.isMuted ? 0 : this.volumeLevel;
                this.masterVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
                this.masterVolume.gain.value = targetGain;
            }
        } catch (e) {
            console.error("Error toggling mute:", e);
        }
        return this.isMuted;
    }

    /**
     * Set master volume level (0 to 1)
     */
    setVolume(val) {
        this.volumeLevel = val;
        if (this.volumeLevel < 0) this.volumeLevel = 0;
        if (this.volumeLevel > 1) this.volumeLevel = 1;
        this.isMuted = (this.volumeLevel === 0);
        try {
            if (this.masterVolume && this.ctx) {
                const targetGain = this.isMuted ? 0 : this.volumeLevel;
                this.masterVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
                this.masterVolume.gain.value = targetGain;
            }
        } catch (e) {
            console.error("Error setting volume:", e);
        }
        return this.volumeLevel;
    }

    /**
     * Set music volume level (0 to 1)
     */
    setMusicVolume(val) {
        const prevVolume = this.musicVolumeLevel;
        this.musicVolumeLevel = val;
        if (this.musicVolumeLevel < 0) this.musicVolumeLevel = 0;
        if (this.musicVolumeLevel > 1) this.musicVolumeLevel = 1;
        localStorage.setItem('viscora_music_volume', this.musicVolumeLevel.toString());
        
        try {
            if (this.musicVolume && this.ctx) {
                const targetGain = this.isMusicMuted ? 0 : (this.musicVolumeLevel * 0.35);
                this.musicVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
                this.musicVolume.gain.value = targetGain;
            }
            if (prevVolume === 0 && this.musicVolumeLevel > 0 && !this.isMusicMuted && this.playChordRef && this.musicPlaying) {
                this.playChordRef();
            }
        } catch (e) {
            console.error("Error setting music volume:", e);
        }
        return this.musicVolumeLevel;
    }

    /**
     * Set SFX volume level (0 to 1)
     */
    setSfxVolume(val) {
        this.sfxVolumeLevel = val;
        if (this.sfxVolumeLevel < 0) this.sfxVolumeLevel = 0;
        if (this.sfxVolumeLevel > 1) this.sfxVolumeLevel = 1;
        localStorage.setItem('viscora_sfx_volume', this.sfxVolumeLevel.toString());
        
        try {
            if (this.sfxVolume && this.ctx) {
                const targetGain = this.isSfxMuted ? 0 : (this.sfxVolumeLevel * 0.75);
                this.sfxVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
                this.sfxVolume.gain.value = targetGain;
            }
        } catch (e) {
            console.error("Error setting SFX volume:", e);
        }
        return this.sfxVolumeLevel;
    }

    /**
     * Toggle music mute state
     */
    toggleMusicMute() {
        this.isMusicMuted = !this.isMusicMuted;
        localStorage.setItem('viscora_music_muted', this.isMusicMuted.toString());
        try {
            if (this.musicVolume && this.ctx) {
                const targetGain = this.isMusicMuted ? 0 : (this.musicVolumeLevel * 0.35);
                this.musicVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
                this.musicVolume.gain.value = targetGain;
            }
            if (!this.isMusicMuted && this.musicVolumeLevel > 0 && this.playChordRef && this.musicPlaying) {
                this.playChordRef();
            }
        } catch (e) {
            console.error("Error toggling music mute:", e);
        }
        return this.isMusicMuted;
    }

    /**
     * Toggle SFX mute state
     */
    toggleSfxMute() {
        this.isSfxMuted = !this.isSfxMuted;
        localStorage.setItem('viscora_sfx_muted', this.isSfxMuted.toString());
        try {
            if (this.sfxVolume && this.ctx) {
                const targetGain = this.isSfxMuted ? 0 : (this.sfxVolumeLevel * 0.75);
                this.sfxVolume.gain.setValueAtTime(targetGain, this.ctx.currentTime);
                this.sfxVolume.gain.value = targetGain;
            }
        } catch (e) {
            console.error("Error toggling SFX mute:", e);
        }
        return this.isSfxMuted;
    }

    /**
     * Sound Effect: Jump
     * Synthesizes a squishy, gel-like ascending sweep
     */
    playJump() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            
            // 1. Core pop tone with pitch variation
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            const randDetune = (Math.random() * 2 - 1) * 110; // ±110 cents detune
            osc.frequency.setValueAtTime(140, now);
            osc.detune.setValueAtTime(randDetune, now);
            osc.frequency.exponentialRampToValueAtTime(360, now + 0.12);
            
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            
            osc.connect(gain);
            gain.connect(this.sfxVolume);
            
            osc.start(now);
            osc.stop(now + 0.15);

            // 2. Extra click transient for wetness
            const clickOsc = this.ctx.createOscillator();
            const clickGain = this.ctx.createGain();
            
            clickOsc.type = 'sine';
            clickOsc.frequency.setValueAtTime(450, now);
            clickOsc.frequency.exponentialRampToValueAtTime(150, now + 0.04);
            
            clickGain.gain.setValueAtTime(0.3, now);
            clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
            
            clickOsc.connect(clickGain);
            clickGain.connect(this.sfxVolume);
            
            clickOsc.start(now);
            clickOsc.stop(now + 0.05);
        } catch (e) {
            console.error("Error playing jump SFX:", e);
        }
    }

    /**
     * Sound Effect: Land
     * Synthesizes a low squish
     */
    playLand(landingSpeed = 0) {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(65, now + 0.18);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, now);
            filter.frequency.exponentialRampToValueAtTime(80, now + 0.18);

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxVolume);

            osc.start(now);
            osc.stop(now + 0.2);

            // Şiddetli inişlerde (hız > 4) sub-bass sarsıntı sesi ekle
            if (landingSpeed > 4.2) {
                const subOsc = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(90, now);
                subOsc.frequency.linearRampToValueAtTime(35, now + 0.35);
                
                // Hızla orantılı ses seviyesi
                const volume = Math.min((landingSpeed - 4) * 0.15, 0.55);
                subGain.gain.setValueAtTime(volume, now);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                
                subOsc.connect(subGain);
                subGain.connect(this.sfxVolume);
                
                subOsc.start(now);
                subOsc.stop(now + 0.35);
            }
        } catch (e) {
            console.error("Error playing land SFX:", e);
        }
    }

    /**
     * Sound Effect: Enemy Stomp
     * Synthesizes a squishy organic crunch pop
     */
    playStomp() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            
            // 1. Düşük gövdeli pop
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(75, now + 0.16);
            
            gain.gain.setValueAtTime(0.7, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
            
            osc.connect(gain);
            gain.connect(this.sfxVolume);
            osc.start(now);
            osc.stop(now + 0.16);

            // 2. Yüksek çıtırtı (organic squish)
            const clickOsc = this.ctx.createOscillator();
            const clickGain = this.ctx.createGain();
            clickOsc.type = 'triangle';
            clickOsc.frequency.setValueAtTime(620, now);
            clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.07);
            
            clickGain.gain.setValueAtTime(0.45, now);
            clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
            
            clickOsc.connect(clickGain);
            clickGain.connect(this.sfxVolume);
            clickOsc.start(now);
            clickOsc.stop(now + 0.07);
        } catch (e) {
            console.error("Error playing stomp SFX:", e);
        }
    }

    /**
     * Sound Effect: Viscosity Shift
     * Sweeps frequency depending on state
     */
    playShift(stateId) {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            
            // 1. Double oscillators: detuned sine and triangle voices
            const oscSine = this.ctx.createOscillator();
            const oscTri = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();
            const oscFilter = this.ctx.createBiquadFilter();

            oscSine.type = 'sine';
            oscTri.type = 'triangle';
            oscFilter.type = 'bandpass';
            oscFilter.Q.value = 4.0;

            // Frequency ranges depending on target viscosity state
            let startFreq = 200;
            let endFreq = 400;
            let duration = 0.22;

            if (stateId === 'LOW') {
                // Changing to liquid (LOW viscosity) -> high wet bubbly sweep up
                startFreq = 220;
                endFreq = 880;
                duration = 0.25;
            } else if (stateId === 'HIGH') {
                // Changing to gel (HIGH viscosity) -> deep sticky thick drop sweep down
                startFreq = 380;
                endFreq = 120;
                duration = 0.28;
            } else {
                // Changing to normal (NORMAL viscosity) -> moderate sweep
                startFreq = 180;
                endFreq = 340;
                duration = 0.2;
            }

            oscSine.frequency.setValueAtTime(startFreq, now);
            oscSine.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
            oscSine.detune.setValueAtTime(-12, now); // slightly flat

            oscTri.frequency.setValueAtTime(startFreq, now);
            oscTri.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
            oscTri.detune.setValueAtTime(12, now); // slightly sharp

            oscFilter.frequency.setValueAtTime(startFreq, now);
            oscFilter.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

            oscGain.gain.setValueAtTime(0.35, now);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

            oscSine.connect(oscFilter);
            oscTri.connect(oscFilter);
            oscFilter.connect(oscGain);
            oscGain.connect(this.sfxVolume);

            oscSine.start(now);
            oscTri.start(now);
            oscSine.stop(now + duration);
            oscTri.stop(now + duration);

            // 2. High-passed noise burst for wet organic squish splash
            const noiseLength = 0.08; // very short splash burst
            const sampleRate = this.ctx.sampleRate || 44100;
            const bufferSize = sampleRate * noiseLength;
            const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = buffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            // Liquid shift has higher frequency splash, Gel has lower/muffled splash
            let highpassFreq = 1500;
            if (stateId === 'LOW') {
                highpassFreq = 2200;
            } else if (stateId === 'HIGH') {
                highpassFreq = 800;
            }
            noiseFilter.frequency.setValueAtTime(highpassFreq, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(highpassFreq * 0.5, now + noiseLength);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.18, now); // subtle but noticeable wet transient
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLength);

            noiseSource.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.sfxVolume);

            noiseSource.start(now);
            noiseSource.stop(now + noiseLength);

            // 3. Extra organic textures depending on form
            if (stateId === 'HIGH') {
                // Deep sticky sub bass thud for heavy gel form
                const subOsc = this.ctx.createOscillator();
                const subGain = this.ctx.createGain();
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(90, now);
                subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
                
                subGain.gain.setValueAtTime(0.5, now);
                subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                
                subOsc.connect(subGain);
                subGain.connect(this.sfxVolume);
                subOsc.start(now);
                subOsc.stop(now + 0.3);
            } else if (stateId === 'LOW') {
                // 3 quick bubbly splash plops for liquid form
                for (let b = 0; b < 3; b++) {
                    const popTime = now + b * 0.05;
                    const popOsc = this.ctx.createOscillator();
                    const popGain = this.ctx.createGain();
                    
                    popOsc.type = 'sine';
                    popOsc.frequency.setValueAtTime(800 + b * 300 + Math.random() * 200, popTime);
                    popOsc.frequency.exponentialRampToValueAtTime(2000, popTime + 0.04);
                    
                    popGain.gain.setValueAtTime(0.08, popTime);
                    popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.04);
                    
                    popOsc.connect(popGain);
                    popGain.connect(this.sfxVolume);
                    
                    popOsc.start(popTime);
                    popOsc.stop(popTime + 0.04);
                }
            }

        } catch (e) {
            console.error("Error playing shift SFX:", e);
        }
    }

    /**
     * Start procedural low heartbeat thump thump sound
     */
    startHeartbeat() {
        try {
            if (this.heartbeatIntervalId || !this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const playHeartbeat = () => {
                if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
                const now = this.ctx.currentTime;
                
                // First thud
                const osc1 = this.ctx.createOscillator();
                const gain1 = this.ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(60, now);
                osc1.frequency.exponentialRampToValueAtTime(10, now + 0.15);
                gain1.gain.setValueAtTime(0.5, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                osc1.connect(gain1);
                gain1.connect(this.sfxVolume);
                osc1.start(now);
                osc1.stop(now + 0.15);

                // Second thud (delayed by 250ms)
                const osc2 = this.ctx.createOscillator();
                const gain2 = this.ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(55, now + 0.25);
                osc2.frequency.exponentialRampToValueAtTime(10, now + 0.4);
                gain2.gain.setValueAtTime(0.4, now + 0.25);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                osc2.connect(gain2);
                gain2.connect(this.sfxVolume);
                osc2.start(now + 0.25);
                osc2.stop(now + 0.4);
            };

            playHeartbeat();
            this.heartbeatIntervalId = setInterval(playHeartbeat, 1100);
        } catch (e) {
            console.error("Error starting heartbeat SFX:", e);
        }
    }

    /**
     * Stop procedural low heartbeat thump thump sound
     */
    stopHeartbeat() {
        if (this.heartbeatIntervalId) {
            clearInterval(this.heartbeatIntervalId);
            this.heartbeatIntervalId = null;
        }
    }

    /**
     * Sound Effect: Damage
     * Noise crunch & pitch sweep
     */
    playDamage() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            
            // Synthesize noise buffer
            const bufferSize = (this.ctx.sampleRate || 44100) * 0.25; // 0.25s
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate || 44100);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = buffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(500, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.25);

            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(0.7, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

            noiseNode.connect(noiseFilter);
            noiseFilter.connect(gainNode);
            gainNode.connect(this.sfxVolume);

            // Add a low bass drop frequency sweep underneath
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'sawtooth';
            subOsc.frequency.setValueAtTime(180, now);
            subOsc.frequency.linearRampToValueAtTime(45, now + 0.25);

            subGain.gain.setValueAtTime(0.4, now);
            subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

            subOsc.connect(subGain);
            subGain.connect(this.sfxVolume);

            noiseNode.start(now);
            noiseNode.stop(now + 0.25);
            subOsc.start(now);
            subOsc.stop(now + 0.25);
        } catch (e) {
            console.error("Error playing damage SFX:", e);
        }
    }

    /**
     * Sound Effect: Level Win Chord arpeggio
     */
    playWin() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5

            notes.forEach((freq, idx) => {
                const timeOffset = idx * 0.08;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + timeOffset);

                gain.gain.setValueAtTime(0.25, now + timeOffset);
                gain.gain.exponentialRampToValueAtTime(0.005, now + timeOffset + 0.4);

                osc.connect(gain);
                gain.connect(this.sfxVolume);

                osc.start(now + timeOffset);
                osc.stop(now + timeOffset + 0.45);
            });
        } catch (e) {
            console.error("Error playing win SFX:", e);
        }
    }

    /**
     * Start procedural ambient background music
     */
    startMusic() {
        try {
            if (this.musicPlaying) return;
            this.init(); // Auto init if not done
            this.musicPlaying = true;

            const playChord = () => {
                try {
                    if (!this.musicPlaying || this.isMuted || this.isMusicMuted || this.musicVolumeLevel === 0 || !this.ctx) return;
                    // Eğer context suspend'deyse, resume et ve bekle
                    if (this.ctx.state === 'suspended') {
                        this.ctx.resume().then(() => playChord());
                        return;
                    }
                    const now = this.ctx.currentTime;
                    
                    // Get notes for current chord
                    const currentChord = this.chords[this.currentChordIndex];
                    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;

                    const duration = 5.0; // 5 seconds per chord

                    // Create oscillators for each note in chord
                    currentChord.forEach((freq, i) => {
                        const osc = this.ctx.createOscillator();
                        const filter = this.ctx.createBiquadFilter();
                        const gainNode = this.ctx.createGain();

                        // Mix oscillator types for nice rich ambient pad
                        osc.type = (i % 2 === 0) ? 'sine' : 'triangle';
                        osc.frequency.setValueAtTime(freq, now);
                        // Slight pitch detune for chorusing effect
                        osc.detune.setValueAtTime(i * 1.5 - 3, now);

                        // Setup slow volume envelope
                        gainNode.gain.setValueAtTime(0, now);
                        gainNode.gain.linearRampToValueAtTime(0.08, now + 2.0); // Slow attack
                        gainNode.gain.setValueAtTime(0.08, now + duration - 2.0);
                        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); // Slow decay

                        // Resonance filter sweeping slowly
                        filter.type = 'lowpass';
                        filter.frequency.setValueAtTime(400, now);
                        filter.frequency.exponentialRampToValueAtTime(800 + i * 100, now + 2.5);
                        filter.frequency.exponentialRampToValueAtTime(300, now + duration);

                        osc.connect(filter);
                        filter.connect(gainNode);
                        gainNode.connect(this.musicVolume);

                        osc.start(now);
                        osc.stop(now + duration);
                    });
                } catch (err) {
                    console.error("Error playing background music chord:", err);
                }
            };

            this.playChordRef = playChord;

            // Önce context'i resume et, sonra müziği başlat
            this.resume().then(() => {
                playChord();
                this.musicIntervalId = setInterval(playChord, 5000);
            });


        } catch (e) {
            console.error("Error starting music:", e);
        }
    }

    /**
     * Stop background music
     */
    stopMusic() {
        try {
            if (!this.musicPlaying) return;
            this.musicPlaying = false;
            if (this.musicIntervalId) {
                clearInterval(this.musicIntervalId);
                this.musicIntervalId = null;
            }
        } catch (e) {
            console.error("Error stopping music:", e);
        }
    }

    /**
     * Update Web Audio filter depending on character state
     */
    updateViscosityFilter(stateId) {
        if (!this.ctx || !this.viscosityFilter) return;

        try {
            const now = this.ctx.currentTime;
            if (stateId === 'LOW') {
                // Liquid: bubbles sweep highpass filter
                this.viscosityFilter.type = 'highpass';
                this.viscosityFilter.frequency.exponentialRampToValueAtTime(750, now + 0.35);
            } else if (stateId === 'HIGH') {
                // Gel: heavy muffled lowpass filter
                this.viscosityFilter.type = 'lowpass';
                this.viscosityFilter.frequency.exponentialRampToValueAtTime(280, now + 0.35);
            } else {
                // Normal: full range lowpass bypass
                this.viscosityFilter.type = 'lowpass';
                this.viscosityFilter.frequency.exponentialRampToValueAtTime(20000, now + 0.35);
            }
        } catch (e) {
            console.error("Error updating viscosity audio filter:", e);
        }
    }

    /**
     * Sound Effect: Glowing collectible pickup
     */
    playCollect() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

            osc.connect(gain);
            gain.connect(this.sfxVolume);

            osc.start(now);
            osc.stop(now + 0.16);
        } catch (e) {
            console.error("Error playing collect SFX:", e);
        }
    }

    playPlateActivate() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(261.63, now); // C4
            osc.frequency.setValueAtTime(329.63, now + 0.05); // E4
            osc.frequency.setValueAtTime(523.25, now + 0.1); // C5

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);

            osc.connect(gain);
            gain.connect(this.sfxVolume);

            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {
            console.error("Error playing plate activate SFX:", e);
        }
    }

    playPlateDeactivate() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(329.63, now); // E4
            osc.frequency.setValueAtTime(261.63, now + 0.05); // C4
            osc.frequency.setValueAtTime(196.00, now + 0.1); // G3

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);

            osc.connect(gain);
            gain.connect(this.sfxVolume);

            osc.start(now);
            osc.stop(now + 0.25);
        } catch (e) {
            console.error("Error playing plate deactivate SFX:", e);
        }
    }

    playBlockPush() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            // Prevent audio clipping/overlapping by enforcing a minimum interval
            const now = this.ctx.currentTime;
            if (this.lastPushSoundTime && now - this.lastPushSoundTime < 0.2) return;
            this.lastPushSoundTime = now;

            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(80, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.18);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(150, now);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxVolume);

            osc.start(now);
            osc.stop(now + 0.2);

            // Add scraping noise transient
            const bufferSize = (this.ctx.sampleRate || 44100) * 0.15;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate || 44100);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(300, now);
            noiseFilter.Q.setValueAtTime(3.0, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.06, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.sfxVolume);

            noise.start(now);
            noise.stop(now + 0.15);
        } catch (e) {
            console.error("Error playing block push SFX:", e);
        }
    }

    playTeleport() {
        try {
            if (!this.ctx || this.isMuted || this.isSfxMuted || this.sfxVolumeLevel === 0) return;
            this.resume();

            const now = this.ctx.currentTime;
            
            // 1. Synth sweep up
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(950, now + 0.35);

            filter.type = 'bandpass';
            filter.Q.value = 6.0;
            filter.frequency.setValueAtTime(150, now);
            filter.frequency.exponentialRampToValueAtTime(1200, now + 0.35);

            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxVolume);

            osc.start(now);
            osc.stop(now + 0.35);

            // 2. High chime/bell ring
            const chimeOsc = this.ctx.createOscillator();
            const chimeGain = this.ctx.createGain();

            chimeOsc.type = 'sine';
            chimeOsc.frequency.setValueAtTime(1200, now + 0.1);
            chimeOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.25);

            chimeGain.gain.setValueAtTime(0.2, now + 0.1);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            chimeOsc.connect(chimeGain);
            chimeGain.connect(this.sfxVolume);

            chimeOsc.start(now + 0.1);
            chimeOsc.stop(now + 0.35);
        } catch (e) {
            console.error("Error playing teleport SFX:", e);
        }
    }
}

// Export single audio instance
export const audio = new AudioManager();
export default audio;

// Global capturing listener to unlock AudioContext on first user interaction (safeguard for Android/Chrome/iOS)
if (typeof window !== 'undefined') {
    const globalUnlock = () => {
        if (audio) {
            audio.init();
            audio.unlock();
        }
        // Remove listeners
        window.removeEventListener('touchstart', globalUnlock, { capture: true });
        window.removeEventListener('touchend', globalUnlock, { capture: true });
        window.removeEventListener('click', globalUnlock, { capture: true });
    };
    window.addEventListener('touchstart', globalUnlock, { capture: true, passive: true });
    window.addEventListener('touchend', globalUnlock, { capture: true, passive: true });
    window.addEventListener('click', globalUnlock, { capture: true });
}
