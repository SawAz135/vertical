import { storage, Emitter, isTouch } from './util.js';

// Quality presets (applied in main.js / field.js). Field potato count scales with quality.
export const QUALITY = {
  low:    { pixelRatio: 1.0, shadows: false, shadowMap: 1024, bloom: false, potatoRadius: 22, nearLod: 7,  field: 14000, grass: 1500, jarMax: 6500, antialias: false },
  medium: { pixelRatio: 1.5, shadows: true,  shadowMap: 1024, bloom: true,  potatoRadius: 32, nearLod: 10, field: 26000, grass: 3500, jarMax: 8000, antialias: true },
  high:   { pixelRatio: 1.5, shadows: true,  shadowMap: 2048, bloom: true,  potatoRadius: 45, nearLod: 14, field: 42000, grass: 7000, jarMax: 9000, antialias: true },
  ultra:  { pixelRatio: 2.0, shadows: true,  shadowMap: 4096, bloom: true,  potatoRadius: 70, nearLod: 20, field: 65000, grass: 12000, jarMax: 11000, antialias: true },
};

const DEFAULTS = {
  quality: isTouch() ? 'medium' : 'high',
  adaptiveResolution: true,
  fov: 76, mouseSens: 1.0, padSens: 1.0, touchSens: 1.0, invertY: false,
  headBob: 0.7, cameraShake: 0.7, cameraSmoothing: 0.1, sprintToggle: false,
  volMaster: 0.9, volMusic: 0.45, volSfx: 0.9, volVoice: 1.0, volAmbience: 0.8,
  showFps: false,
};

class Settings extends Emitter {
  constructor() {
    super();
    this.v = Object.assign({}, DEFAULTS, storage.get('wmp.settings', {}));
    if (!QUALITY[this.v.quality]) this.v.quality = DEFAULTS.quality;
  }
  get q() { return QUALITY[this.v.quality]; }
  set(k, val) {
    if (this.v[k] === val) return;
    this.v[k] = val; storage.set('wmp.settings', this.v);
    this.emit('change', k, val); this.emit('change:' + k, val);
  }
}
export const settings = new Settings();
