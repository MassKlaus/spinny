// High-precision WebGL2 / WebGL1 GPU spiral renderer with analytical anti-aliasing

const VERTEX_SHADER_WEBGL2 = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_WEBGL2 = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  u_resolution;
uniform float u_phase;
uniform float u_clock;
uniform vec2  u_pointer;
uniform float u_pointerStrength;

uniform int   u_mode;        // 0=Log, 1=Archimedean, 2=Tunnel, 3=Counter-Spin, 4=Ripple
uniform float u_arms;        // integer 1..24
uniform float u_tightness;   // 0.5..14
uniform float u_balance;     // 0.15..0.85
uniform float u_pulse;       // 0..1
uniform float u_warp;        // 0..1
uniform float u_softness;    // 0..1
uniform float u_chroma;      // 0..1
uniform float u_iridescence; // 0..1
uniform float u_depth;       // 0..1

uniform vec3  u_colorA;
uniform vec3  u_colorB;
uniform vec3  u_colorGlow;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// Subtle blue-noise-like hash to completely eliminate 8-bit banding
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Smooth cosine spectral palette (Inigo Quilez)
vec3 cosinePalette(float t) {
  vec3 a = vec3(0.52, 0.50, 0.58);
  vec3 b = vec3(0.48, 0.45, 0.42);
  vec3 c = vec3(1.00, 1.00, 1.00);
  vec3 d = vec3(0.00, 0.33, 0.67);
  return a + b * cos(TAU * (c * t + d));
}

// Evaluates a continuous, seam-free spiral field value in [-1, 1]
float evalSpiralField(vec2 p, float phaseOffset) {
  float r = length(p);
  float angle = atan(p.y, p.x);

  float phase = u_phase + phaseOffset;

  // Breathing radial rhythm
  float breath = 1.0 + u_pulse * 0.16 * sin(u_clock * 1.45 - log(r + 0.04) * 1.8);
  float rMod = r * breath;

  // Organic harmonic domain warp
  float warpWave = u_warp * (
    0.55 * sin(angle * 3.0 - u_clock * 0.9 + log(r + 0.08) * 2.2) +
    0.30 * cos(angle * 5.0 + u_clock * 0.65 - r * 4.5)
  );

  // Tactile pointer swirl torque near cursor / finger
  float swirl = u_pointerStrength * 0.55 * exp(-r * 1.6);
  float theta = angle + swirl;

  float arms = floor(u_arms + 0.5);
  float logR = log(max(rMod, 0.00025));

  if (u_mode == 0) {
    // Logarithmic Golden Vortex (scale-invariant, strongest optical aftereffect)
    float spiral = arms * theta + u_tightness * 2.35 * logR - phase + warpWave;
    return sin(spiral);
  } else if (u_mode == 1) {
    // Classic Archimedean Hypno Wheel
    float spiral = arms * theta + u_tightness * 5.2 * rMod - phase + warpWave;
    return sin(spiral);
  } else if (u_mode == 2) {
    // Hyperbolic 3D Tunnel Pull
    float tunnel = u_tightness * (1.15 / (rMod + 0.12) + 1.55 * logR);
    float spiral = arms * theta + tunnel - phase * 1.15 + warpWave;
    float rings = sin(u_tightness * 3.2 * logR - phase * 1.5);
    return mix(sin(spiral), sin(spiral) * (0.72 + 0.28 * rings), 0.45);
  } else if (u_mode == 3) {
    // Counter-Spinning Interference Lattice
    float s1 = sin(arms * theta + u_tightness * 2.1 * logR - phase + warpWave);
    float s2 = sin(arms * theta - u_tightness * 2.1 * logR + phase * 0.88 - warpWave * 0.7);
    return 0.58 * s1 + 0.42 * s2;
  } else {
    // Organic Vortex Ripple
    float ripple = 0.85 * sin(u_tightness * 4.2 * rMod - phase * 0.9) * (0.35 + 0.65 * u_warp);
    float spiral = arms * theta + u_tightness * (1.85 * logR + 1.9 * rMod) - phase + warpWave * 1.35 + ripple;
    return sin(spiral);
  }
}

// Convert continuous field [-1, 1] into razor-sharp analytically anti-aliased stripe mask [0, 1]
float fieldToMask(float field, float balance, float softness) {
  float threshold = (0.5 - balance) * 1.85;
  float aa = max(fwidth(field) * 1.15, 0.0025);
  float blur = aa + softness * 0.92;
  return smoothstep(threshold - blur, threshold + blur, field);
}

void main() {
  vec2 res = u_resolution;
  float minDim = min(res.x, res.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / minDim;

  // Gently pull optical center toward cursor / dragged finger
  vec2 p = uv - u_pointer * 0.28 * u_pointerStrength;
  float r = length(p);

  // Chromatic dispersion scales gracefully near high-energy areas & edges
  float chromaShift = u_chroma * (0.045 + 0.11 * smoothstep(0.02, 0.75, r));

  float fG = evalSpiralField(p, 0.0);
  float maskG = fieldToMask(fG, u_balance, u_softness);

  vec3 maskRGB;
  if (chromaShift > 0.001) {
    float fR = evalSpiralField(p,  chromaShift);
    float fB = evalSpiralField(p, -chromaShift);
    maskRGB = vec3(
      fieldToMask(fR, u_balance, u_softness),
      maskG,
      fieldToMask(fB, u_balance, u_softness)
    );
  } else {
    maskRGB = vec3(maskG);
  }

  // Smooth singularity damping at dead center (< 2.5px) to prevent Nyquist flicker
  float centerDamp = smoothstep(0.0, 0.011, r);
  maskRGB = mix(vec3(0.5), maskRGB, centerDamp);

  // Base dual-tone coloring
  vec3 primaryCol = u_colorA;
  vec3 abyssCol   = u_colorB;

  // Optional iridescent spectral shift
  if (u_iridescence > 0.001) {
    float specT = log(r + 0.04) * 0.45 - u_phase * 0.07 + atan(p.y, p.x) / TAU;
    vec3 rainbow = cosinePalette(specT);
    primaryCol = mix(primaryCol, rainbow * 1.08, u_iridescence * 0.85);
    abyssCol   = mix(abyssCol, rainbow * 0.16, u_iridescence * 0.45);
  }

  vec3 col = mix(abyssCol, primaryCol, maskRGB);

  // Caustic rim aura along spiral edge transitions
  float edgeBand = 1.0 - abs(maskG * 2.0 - 1.0);
  edgeBand = pow(clamp(edgeBand, 0.0, 1.0), 1.6);
  float auraStrength = (0.14 + 0.52 * u_softness + 0.35 * u_chroma) * centerDamp;
  col += u_colorGlow * edgeBand * auraStrength * 0.65;

  // Center singularity depth well + luminous halo
  float coreWell = exp(-r * (14.0 - 5.0 * u_depth));
  float coreHalo = exp(-pow((r - 0.045) * 9.0, 2.0));
  col = mix(col, abyssCol * 0.35, coreWell * u_depth * 0.85);
  col += u_colorGlow * coreHalo * u_depth * 0.38;

  // Cinematic depth vignette toward screen corners
  float vig = smoothstep(1.25, 0.25, length(uv));
  col *= mix(1.0, 0.38 + 0.62 * vig, u_depth * 0.88);

  // Micro film-grain dithering (eliminates dark gradient banding)
  float grain = (hash12(gl_FragCoord.xy + fract(u_clock) * 100.0) - 0.5) / 140.0;
  col = clamp(col + grain, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}
`;

// WebGL1 fallback (automatically used on older GPUs / Safari versions without WebGL2)
const VERTEX_SHADER_WEBGL1 = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_WEBGL1 = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  u_resolution;
uniform float u_phase;
uniform float u_clock;
uniform vec2  u_pointer;
uniform float u_pointerStrength;

uniform int   u_mode;
uniform float u_arms;
uniform float u_tightness;
uniform float u_balance;
uniform float u_pulse;
uniform float u_warp;
uniform float u_softness;
uniform float u_chroma;
uniform float u_iridescence;
uniform float u_depth;

uniform vec3  u_colorA;
uniform vec3  u_colorB;
uniform vec3  u_colorGlow;

const float TAU = 6.28318530718;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 cosinePalette(float t) {
  return vec3(0.52, 0.50, 0.58) + vec3(0.48, 0.45, 0.42) * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}

float evalSpiralField(vec2 p, float phaseOffset) {
  float r = length(p);
  float angle = atan(p.y, p.x);
  float phase = u_phase + phaseOffset;
  float breath = 1.0 + u_pulse * 0.16 * sin(u_clock * 1.45 - log(r + 0.04) * 1.8);
  float rMod = r * breath;
  float warpWave = u_warp * (
    0.55 * sin(angle * 3.0 - u_clock * 0.9 + log(r + 0.08) * 2.2) +
    0.30 * cos(angle * 5.0 + u_clock * 0.65 - r * 4.5)
  );
  float theta = angle + u_pointerStrength * 0.55 * exp(-r * 1.6);
  float arms = floor(u_arms + 0.5);
  float logR = log(max(rMod, 0.00025));

  if (u_mode == 0) {
    return sin(arms * theta + u_tightness * 2.35 * logR - phase + warpWave);
  } else if (u_mode == 1) {
    return sin(arms * theta + u_tightness * 5.2 * rMod - phase + warpWave);
  } else if (u_mode == 2) {
    float tunnel = u_tightness * (1.15 / (rMod + 0.12) + 1.55 * logR);
    float s = sin(arms * theta + tunnel - phase * 1.15 + warpWave);
    float rings = sin(u_tightness * 3.2 * logR - phase * 1.5);
    return mix(s, s * (0.72 + 0.28 * rings), 0.45);
  } else if (u_mode == 3) {
    float s1 = sin(arms * theta + u_tightness * 2.1 * logR - phase + warpWave);
    float s2 = sin(arms * theta - u_tightness * 2.1 * logR + phase * 0.88 - warpWave * 0.7);
    return 0.58 * s1 + 0.42 * s2;
  } else {
    float ripple = 0.85 * sin(u_tightness * 4.2 * rMod - phase * 0.9) * (0.35 + 0.65 * u_warp);
    return sin(arms * theta + u_tightness * (1.85 * logR + 1.9 * rMod) - phase + warpWave * 1.35 + ripple);
  }
}

float fieldToMask(float field, float balance, float softness) {
  float threshold = (0.5 - balance) * 1.85;
  #ifdef GL_OES_standard_derivatives
    float aa = max(fwidth(field) * 1.15, 0.003);
  #else
    float aa = 0.025;
  #endif
  float blur = aa + softness * 0.92;
  return smoothstep(threshold - blur, threshold + blur, field);
}

void main() {
  vec2 res = u_resolution;
  float minDim = min(res.x, res.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / minDim;
  vec2 p = uv - u_pointer * 0.28 * u_pointerStrength;
  float r = length(p);

  float chromaShift = u_chroma * (0.045 + 0.11 * smoothstep(0.02, 0.75, r));
  float fG = evalSpiralField(p, 0.0);
  float maskG = fieldToMask(fG, u_balance, u_softness);
  vec3 maskRGB = vec3(
    fieldToMask(evalSpiralField(p,  chromaShift), u_balance, u_softness),
    maskG,
    fieldToMask(evalSpiralField(p, -chromaShift), u_balance, u_softness)
  );

  float centerDamp = smoothstep(0.0, 0.011, r);
  maskRGB = mix(vec3(0.5), maskRGB, centerDamp);

  vec3 primaryCol = u_colorA;
  vec3 abyssCol = u_colorB;
  if (u_iridescence > 0.001) {
    float specT = log(r + 0.04) * 0.45 - u_phase * 0.07 + atan(p.y, p.x) / TAU;
    vec3 rainbow = cosinePalette(specT);
    primaryCol = mix(primaryCol, rainbow * 1.08, u_iridescence * 0.85);
    abyssCol = mix(abyssCol, rainbow * 0.16, u_iridescence * 0.45);
  }

  vec3 col = mix(abyssCol, primaryCol, maskRGB);
  float edgeBand = pow(clamp(1.0 - abs(maskG * 2.0 - 1.0), 0.0, 1.0), 1.6);
  col += u_colorGlow * edgeBand * (0.14 + 0.52 * u_softness + 0.35 * u_chroma) * centerDamp * 0.65;

  float coreWell = exp(-r * (14.0 - 5.0 * u_depth));
  float coreHalo = exp(-pow((r - 0.045) * 9.0, 2.0));
  col = mix(col, abyssCol * 0.35, coreWell * u_depth * 0.85);
  col += u_colorGlow * coreHalo * u_depth * 0.38;

  float vig = smoothstep(1.25, 0.25, length(uv));
  col *= mix(1.0, 0.38 + 0.62 * vig, u_depth * 0.88);
  col = clamp(col + (hash12(gl_FragCoord.xy + fract(u_clock) * 100.0) - 0.5) / 140.0, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function hexToRgbNorm(hex) {
  const clean = (hex || '#ffffff').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export class SpiralRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    };

    let gl = canvas.getContext('webgl2', opts);
    this.isWebGL2 = Boolean(gl);

    if (!gl) {
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (gl) {
        gl.getExtension('OES_standard_derivatives');
      }
    }

    this.gl = gl;
    this.fallback2d = null;

    if (gl) {
      this._initGL();
    } else {
      this.fallback2d = canvas.getContext('2d');
    }

    this.resize();
  }

  _initGL() {
    const gl = this.gl;
    const vsSource = this.isWebGL2 ? VERTEX_SHADER_WEBGL2 : VERTEX_SHADER_WEBGL1;
    const fsSource = this.isWebGL2 ? FRAGMENT_SHADER_WEBGL2 : FRAGMENT_SHADER_WEBGL1;

    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }

    gl.useProgram(program);
    this.program = program;

    // Full-screen triangle (faster and cleaner than 2-triangle quad)
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const loc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uniformNames = [
      'u_resolution',
      'u_phase',
      'u_clock',
      'u_pointer',
      'u_pointerStrength',
      'u_mode',
      'u_arms',
      'u_tightness',
      'u_balance',
      'u_pulse',
      'u_warp',
      'u_softness',
      'u_chroma',
      'u_iridescence',
      'u_depth',
      'u_colorA',
      'u_colorB',
      'u_colorGlow',
    ];

    this.uniforms = {};
    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  render(state, runtime) {
    if (!this.gl) {
      this._renderFallback2D(state, runtime);
      return;
    }

    const gl = this.gl;
    const u = this.uniforms;

    gl.uniform2f(u.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_phase, runtime.phase);
    gl.uniform1f(u.u_clock, runtime.clock);
    gl.uniform2f(u.u_pointer, runtime.pointerX, runtime.pointerY);
    gl.uniform1f(u.u_pointerStrength, runtime.pointerStrength);

    gl.uniform1i(u.u_mode, state.mode);
    gl.uniform1f(u.u_arms, state.arms);
    gl.uniform1f(u.u_tightness, state.tightness);
    gl.uniform1f(u.u_balance, state.balance);
    gl.uniform1f(u.u_pulse, state.pulse);
    gl.uniform1f(u.u_warp, state.warp);
    gl.uniform1f(u.u_softness, state.softness);
    gl.uniform1f(u.u_chroma, state.chroma);
    gl.uniform1f(u.u_iridescence, state.iridescence);
    gl.uniform1f(u.u_depth, state.depth);

    const cA = runtime.colorA;
    const cB = runtime.colorB;
    const cG = runtime.colorGlow;
    gl.uniform3f(u.u_colorA, cA[0], cA[1], cA[2]);
    gl.uniform3f(u.u_colorB, cB[0], cB[1], cB[2]);
    gl.uniform3f(u.u_colorGlow, cG[0], cG[1], cG[2]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Graceful Canvas2D fallback if WebGL is disabled in browser settings
  _renderFallback2D(state, runtime) {
    const ctx = this.fallback2d;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.hypot(cx, cy);

    ctx.fillStyle = state.colorB;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = state.colorA;
    ctx.lineWidth = Math.max(4, maxR / (state.arms * 4.5));

    for (let a = 0; a < state.arms; a++) {
      ctx.beginPath();
      const baseAngle = (a / state.arms) * Math.PI * 2;
      for (let i = 0; i <= 140; i++) {
        const t = i / 140;
        const r = Math.pow(t, 1.8) * maxR;
        const theta = baseAngle + t * state.tightness * 2.2 - runtime.phase * 0.5;
        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
