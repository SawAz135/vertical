import * as THREE from 'three';

// Final colour-grading pass (display space, after tone mapping): vibrance + saturation,
// S-curve contrast, warm highlights / cool shadows split-toning, vignette and fine film grain.
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 },
    uSat: { value: 1.18 }, uVib: { value: 0.35 }, uContrast: { value: 1.08 }, uVignette: { value: 0.32 }, uGrain: { value: 0.025 },
    uWarm: { value: new THREE.Vector3(1.04, 1.0, 0.94) }, uCool: { value: new THREE.Vector3(0.94, 0.98, 1.06) }, uLift: { value: 0.012 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uSat, uVib, uContrast, uVignette, uGrain, uLift; uniform vec3 uWarm, uCool; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0) * 43758.5453); }
  void main(){
    vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
    float l = dot(col, vec3(0.2126,0.7152,0.0722));
    // vibrance: boosts muted colours more than already saturated ones
    float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)), s = mx - mn;
    col = mix(vec3(l), col, uSat + uVib * (1.0 - s));
    // contrast S-curve around mid grey
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
    col = mix(col, col*col*(3.0-2.0*col), 0.25);
    // split toning
    col *= mix(uCool, uWarm, smoothstep(0.15, 0.85, l));
    col += uLift;
    // vignette
    vec2 d = vUv - 0.5; col *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
    col += (h(vUv * 913.0) - 0.5) * uGrain;
    gl_FragColor = vec4(col, c.a);
  }`,
};
