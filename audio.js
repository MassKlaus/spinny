// Pure Web Audio API hypnotic binaural & harmonic drone synthesizer
// Zero external audio files — instant startup, smooth gain ramps, synced to spiral kinetics

export class HypnoAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this.nodes = null;
  }

  _init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);

    // Warm low-pass filter to keep the drone velvety and never harsh
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    // Stereo binaural pair (left 110Hz, right 115.5Hz -> soothing 5.5Hz theta beat)
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.setValueAtTime(110, ctx.currentTime);
    oscR.frequency.setValueAtTime(115.5, ctx.currentTime);

    const panL = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const panR = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panL && panR) {
      panL.pan.setValueAtTime(-0.65, ctx.currentTime);
      panR.pan.setValueAtTime(0.65, ctx.currentTime);
    }

    // Soft fifth harmonic overtone with gentle LFO breathing
    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(165, ctx.currentTime);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.16, ctx.currentTime);

    // Sub-bass anchor
    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(55, ctx.currentTime);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.32, ctx.currentTime);

    // Slow LFO modulating filter cutoff for breathing trance feel
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.22, ctx.currentTime);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(110, ctx.currentTime);

    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);

    const oscGainL = ctx.createGain();
    const oscGainR = ctx.createGain();
    oscGainL.gain.setValueAtTime(0.36, ctx.currentTime);
    oscGainR.gain.setValueAtTime(0.36, ctx.currentTime);

    if (panL && panR) {
      oscL.connect(oscGainL).connect(panL).connect(filter);
      oscR.connect(oscGainR).connect(panR).connect(filter);
    } else {
      oscL.connect(oscGainL).connect(filter);
      oscR.connect(oscGainR).connect(filter);
    }

    oscHarm.connect(harmGain).connect(filter);
    oscSub.connect(subGain).connect(filter);

    filter.connect(master);
    master.connect(ctx.destination);

    oscL.start();
    oscR.start();
    oscHarm.start();
    oscSub.start();
    lfo.start();

    this.ctx = ctx;
    this.master = master;
    this.nodes = { oscL, oscR, oscHarm, oscSub, lfo, filter };
    return true;
  }

  async toggle() {
    if (!this.enabled) {
      if (!this.ctx && !this._init()) return false;
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
      this.master.gain.exponentialRampToValueAtTime(0.16, now + 0.9);
      this.enabled = true;
    } else {
      this.mute();
    }
    return this.enabled;
  }

  mute() {
    if (!this.ctx || !this.master) {
      this.enabled = false;
      return;
    }
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    this.enabled = false;
  }

  sync(speed, direction, isPlaying) {
    if (!this.enabled || !this.ctx || !this.nodes) return;
    const now = this.ctx.currentTime;
    const effectiveSpeed = isPlaying ? speed : 0.15;
    const baseFreq = direction > 0 ? 108 : 122;
    const beatHz = 3.5 + Math.min(effectiveSpeed, 4.5) * 1.4;
    const cutoff = 240 + Math.min(effectiveSpeed, 4.5) * 95;

    this.nodes.oscL.frequency.setTargetAtTime(baseFreq, now, 0.25);
    this.nodes.oscR.frequency.setTargetAtTime(baseFreq + beatHz, now, 0.25);
    this.nodes.oscHarm.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.25);
    this.nodes.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.25);
    this.nodes.lfo.frequency.setTargetAtTime(0.14 + effectiveSpeed * 0.11, now, 0.25);
    this.nodes.filter.frequency.setTargetAtTime(cutoff, now, 0.3);
  }
}
