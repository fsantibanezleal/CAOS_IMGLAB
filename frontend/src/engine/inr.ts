// Live forward pass of a trained SIREN (implicit neural representation) in a WebGL2 fragment shader. The
// image IS the network: f(x,y) = sigmoid(Wout sin(omega0 W2 sin(omega0 W1 sin(omega0 W0 [x,y])))). All
// ~2307 weights are packed into an RGBA32F data texture and read per pixel, so the architecture scales.
// The editability knobs make the thesis visceral: a frequency scale is a meaningful control, but perturbing
// the raw weights collapses the image into noise (the weight space is a compression code, not an edit space).
import { APP_VERSION } from '../lib/version';

export interface InrLayer {
  w: number[];
  b: number[];
  in: number;
  out: number;
}
export interface InrWeights {
  hidden: number;
  omega0: number;
  layers: InrLayer[]; // [l0(2->H), l1(H->H), l2(H->H), out(H->3)]
  psnr: number;
}

export async function loadInrIndex(): Promise<{ trained: string[]; size: number; hidden: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_inr/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`INR index unavailable (${res.status})`);
  return res.json();
}
export async function loadInr(imageId: string): Promise<InrWeights> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_inr/${imageId}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`no trained network for '${imageId}'`);
  return res.json();
}

/** Flatten the weights into one array in the fixed order the shader expects (W0,b0,W1,b1,W2,b2,Wout,bout). */
export function flattenWeights(w: InrWeights): Float32Array {
  const parts: number[][] = [];
  for (const l of w.layers) {
    parts.push(l.w);
    parts.push(l.b);
  }
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Add deterministic Gaussian-ish noise to every weight (the raw-weight-perturbation demo). */
export function perturbWeights(flat: Float32Array, amount: number, seed = 1): Float32Array {
  if (amount <= 0) return flat;
  let s = (seed * 2654435761) & 0x7fffffff || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  const out = new Float32Array(flat.length);
  for (let i = 0; i < flat.length; i++) out[i] = flat[i] + rnd() * amount;
  return out;
}

/** Truncate the weights to `bits` of mantissa precision (graceful degradation then noise). */
export function quantizeWeights(flat: Float32Array, bits: number): Float32Array {
  if (bits >= 23) return flat;
  const levels = Math.pow(2, bits);
  const out = new Float32Array(flat.length);
  let mx = 1e-9;
  for (let i = 0; i < flat.length; i++) mx = Math.max(mx, Math.abs(flat[i]));
  for (let i = 0; i < flat.length; i++) out[i] = (Math.round((flat[i] / mx) * levels) / levels) * mx;
  return out;
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

function frag(hidden: number): string {
  const H = hidden;
  const OFF_B0 = 2 * H;
  const OFF_W1 = OFF_B0 + H;
  const OFF_B1 = OFF_W1 + H * H;
  const OFF_W2 = OFF_B1 + H;
  const OFF_B2 = OFF_W2 + H * H;
  const OFF_WO = OFF_B2 + H;
  const OFF_BO = OFF_WO + 3 * H;
  return `#version 300 es
precision highp float;
uniform sampler2D uW;
uniform int uTexW;
uniform float uOmega0;
uniform float uFreqScale;
uniform vec2 uRes;
out vec4 fragColor;

float wget(int i) {
  int px = i / 4; int comp = i - px * 4;
  ivec2 uv = ivec2(px % uTexW, px / uTexW);
  vec4 t = texelFetch(uW, uv, 0);
  return comp == 0 ? t.r : comp == 1 ? t.g : comp == 2 ? t.b : t.a;
}

void main() {
  vec2 p = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  p.y = -p.y;
  float h0[${H}];
  for (int j = 0; j < ${H}; j++) {
    float s = wget(${OFF_B0} + j) + wget(j * 2) * p.x + wget(j * 2 + 1) * p.y;
    h0[j] = sin(uOmega0 * uFreqScale * s);
  }
  float h1[${H}];
  for (int j = 0; j < ${H}; j++) {
    float s = wget(${OFF_B1} + j);
    for (int k = 0; k < ${H}; k++) s += wget(${OFF_W1} + j * ${H} + k) * h0[k];
    h1[j] = sin(uOmega0 * s);
  }
  float h2[${H}];
  for (int j = 0; j < ${H}; j++) {
    float s = wget(${OFF_B2} + j);
    for (int k = 0; k < ${H}; k++) s += wget(${OFF_W2} + j * ${H} + k) * h1[k];
    h2[j] = sin(uOmega0 * s);
  }
  vec3 o;
  for (int c = 0; c < 3; c++) {
    float s = wget(${OFF_BO} + c);
    for (int k = 0; k < ${H}; k++) s += wget(${OFF_WO} + c * ${H} + k) * h2[k];
    o[c] = 1.0 / (1.0 + exp(-s));
  }
  fragColor = vec4(o, 1.0);
}`;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`INR shader compile failed: ${log}`);
  }
  return sh;
}

export class InrRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement, hidden: number) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    if (!gl.getExtension('EXT_color_buffer_float')) {
      /* sampling RGBA32F is core WebGL2; the extension is only needed to render TO float, which we do not */
    }
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(hidden)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`INR link failed: ${gl.getProgramInfoLog(prog)}`);
    this.program = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    for (const n of ['uW', 'uTexW', 'uOmega0', 'uFreqScale', 'uRes']) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(flat: Float32Array, omega0: number, freqScale: number, size: number): void {
    const gl = this.gl;
    const texels = Math.ceil(flat.length / 4);
    const texW = Math.min(1024, texels);
    const texH = Math.ceil(texels / texW);
    const data = new Float32Array(texW * texH * 4);
    data.set(flat);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, texW, texH, 0, gl.RGBA, gl.FLOAT, data);

    this.canvas.width = size;
    this.canvas.height = size;
    gl.viewport(0, 0, size, size);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uW!, 0);
    gl.uniform1i(this.loc.uTexW!, texW);
    gl.uniform1f(this.loc.uOmega0!, omega0);
    gl.uniform1f(this.loc.uFreqScale!, freqScale);
    gl.uniform2f(this.loc.uRes!, size, size);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
