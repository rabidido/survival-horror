// Minimal post pass: render the scene to a target, then composite with grain,
// vignette, chromatic fringe and a filmic-ish grade. Cheap enough for phones.
import * as THREE from '../vendor/three.module.min.js';

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uGrain;
uniform float uVignette;
uniform float uDamage;    // red pulse when hurt
uniform float uFade;      // 0 = visible, 1 = black
uniform float uExposure;
uniform vec2  uRes;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

// Narkowicz ACES approximation -- the scene is rendered to an offscreen
// target, which means three.js skips its own tonemap/encode, so we do both.
vec3 aces(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(max(c, 0.0031308), vec3(1.0 / 2.4)) - 0.055,
             step(0.0031308, c));
}

void main(){
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);

  // chromatic fringe, stronger toward the edges and when hurt
  float ca = 0.0015 + uDamage * 0.004;
  vec3 col;
  col.r = texture2D(tDiffuse, uv + d * ca).r;
  col.g = texture2D(tDiffuse, uv).g;
  col.b = texture2D(tDiffuse, uv - d * ca).b;

  col *= uExposure;

  // linear grade: cool the shadows, warm the highlights
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col * vec3(0.80, 0.92, 1.20), col, smoothstep(0.0, 0.22, lum));
  col += vec3(0.05, 0.028, 0.012) * smoothstep(0.25, 1.2, lum);
  col = mix(col, vec3(2.2, 0.10, 0.06) * lum, uDamage * 0.5);

  col = aces(col);
  col = toSRGB(col);

  // vignette
  float vig = 1.0 - smoothstep(0.16, 0.55, r2 * uVignette);
  col *= mix(0.22, 1.0, vig);

  // animated film grain
  float g = hash(uv * uRes + fract(uTime) * 137.0) - 0.5;
  col += g * uGrain * (1.3 - 0.75 * dot(col, vec3(0.33)));

  // faint scanline
  col *= 1.0 - 0.028 * step(0.5, fract(gl_FragCoord.y * 0.5));

  col *= (1.0 - uFade);
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false,
    });
    this.uniforms = {
      tDiffuse: { value: this.target.texture },
      uTime: { value: 0 },
      uGrain: { value: 0.085 },
      uVignette: { value: 1.25 },
      uExposure: { value: 1.25 },
      uDamage: { value: 0 },
      uFade: { value: 0 },
      uRes: { value: new THREE.Vector2(size.x, size.y) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      depthTest: false, depthWrite: false,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.Camera();
    this.enabled = true;
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.target.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.uniforms.uRes.value.set(w * pr, h * pr);
  }

  render(scene, camera, dt) {
    this.uniforms.uTime.value += dt;
    if (!this.enabled) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.renderer.setRenderTarget(this.target);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
