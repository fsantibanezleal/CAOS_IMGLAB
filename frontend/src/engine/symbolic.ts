// Live evaluation of the SELECTED image's fitted closed-form equation in a WebGL2 fragment shader. The image
// is written as an explicit trigonometric formula, channel(x,y) = bias + sum_k [ a_k cos(w_k . p) + b_k sin(w_k . p) ],
// with random frequencies w_k and coefficients a_k, b_k fitted offline by ridge regression. The whole picture
// is a compact analytic expression; perturbing its coefficients morphs it smoothly, the readable, editable
// "image as a complex formula" pole (Naderi-Yeganeh formula art, here recovered from a real image).
import { APP_VERSION } from '../lib/version';

export interface SymDoc {
  size: number;
  d: number;
  sigma: number;
  omega: number[]; // d*2 (fx,fy) row-major
  bias: number[]; // 3
  acos: number[]; // 3*d channel-major
  bsin: number[]; // 3*d channel-major
  psnr: number;
}

export async function loadSymIndex(): Promise<{ fitted: string[]; size: number; d: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_sym/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`symbolic index unavailable (${res.status})`);
  return res.json();
}
export async function loadSym(imageId: string): Promise<SymDoc> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_sym/${imageId}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`no fitted equation for '${imageId}'`);
  return res.json();
}

/** Pack into the fixed order the shader expects: [omega 2D][bias 3][acos 3D][bsin 3D]. */
export function packSym(doc: SymDoc): Float32Array {
  const D = doc.d;
  const out = new Float32Array(2 * D + 3 + 3 * D + 3 * D);
  let o = 0;
  out.set(doc.omega, o);
  o += 2 * D;
  out.set(doc.bias, o);
  o += 3;
  out.set(doc.acos, o);
  o += 3 * D;
  out.set(doc.bsin, o);
  return out;
}

/** Perturb only the amplitude coefficients (a_k, b_k), leaving the frequencies fixed: the editability demo. */
export function perturbSym(flat: Float32Array, D: number, amount: number, seed = 1): Float32Array {
  if (amount <= 0) return flat;
  let s = (seed * 2654435761) & 0x7fffffff || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  const out = flat.slice();
  const start = 2 * D + 3; // skip omega + bias, perturb acos+bsin
  for (let i = start; i < out.length; i++) out[i] += rnd() * amount;
  return out;
}

export type Channel = 0 | 1 | 2;
export const CHANNEL_NAMES = ['R', 'G', 'B'] as const;

interface SymTerm {
  amp: number; // A_k = sqrt(a_k^2 + b_k^2)
  phase: number; // phi_k = atan2(b_k, a_k), so a cos t + b sin t = A cos(t - phi)
  fx: number;
  fy: number;
}

/** The channel's terms in amplitude-phase form, sorted by descending amplitude. */
function channelTerms(doc: SymDoc, ch: Channel): SymTerm[] {
  const D = doc.d;
  const terms: SymTerm[] = [];
  for (let k = 0; k < D; k++) {
    const a = doc.acos[ch * D + k];
    const b = doc.bsin[ch * D + k];
    terms.push({ amp: Math.hypot(a, b), phase: Math.atan2(b, a), fx: doc.omega[2 * k], fy: doc.omega[2 * k + 1] });
  }
  terms.sort((p, q) => q.amp - p.amp);
  return terms;
}

const f2 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(2);
const f3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the ACTUAL fitted equation of one channel: the top `n` terms with their real numbers. */
export function symEquationTex(doc: SymDoc, ch: Channel, n = 8): string {
  const terms = channelTerms(doc, ch);
  const name = CHANNEL_NAMES[ch];
  const lines: string[] = [`${name}(x,y) = {} & ${f3(doc.bias[ch])}`];
  for (const t of terms.slice(0, n)) {
    const fy = t.fy >= 0 ? `+${f2(t.fy)}` : f2(t.fy);
    const ph = t.phase >= 0 ? `-${f2(t.phase)}` : `+${f2(-t.phase)}`;
    lines.push(`& +\\;${f3(t.amp)}\\,\\cos(${f2(t.fx)}x${fy}y${ph})`);
  }
  const rest = doc.d - n;
  if (rest > 0) lines.push(`& +\\;\\cdots\\;(${rest}\\ \\text{more terms})`);
  return `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}`;
}

/** The COMPLETE fitted equation of the image as plain text (all D terms, all three channels). */
export function symEquationText(doc: SymDoc, imageId: string): string {
  const out: string[] = [
    `ImageLab, the fitted closed-form equation of "${imageId}"`,
    `model: ch(x,y) = a0 + sum_k A_k*cos(fx_k*x + fy_k*y - phi_k), x,y in [-1,1]`,
    `terms per channel: ${doc.d} (random Fourier features, sigma=${doc.sigma}), fit PSNR ${doc.psnr} dB`,
    ``,
  ];
  for (const ch of [0, 1, 2] as Channel[]) {
    const terms = channelTerms(doc, ch);
    out.push(`${CHANNEL_NAMES[ch]}(x,y) =`);
    out.push(`  ${doc.bias[ch].toFixed(5)}`);
    for (const t of terms) {
      out.push(`  + ${t.amp.toFixed(5)}*cos(${t.fx.toFixed(4)}*x + ${t.fy.toFixed(4)}*y - ${t.phase.toFixed(4)})`);
    }
    out.push(``);
  }
  return out.join('\n');
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

function frag(D: number): string {
  const BIAS = 2 * D;
  const ACOS = 2 * D + 3;
  const BSIN = 5 * D + 3;
  return `#version 300 es
precision highp float;
uniform sampler2D uW;
uniform int uTexW;
uniform float uScale;
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
  vec3 acc = vec3(wget(${BIAS}), wget(${BIAS} + 1), wget(${BIAS} + 2));
  for (int d = 0; d < ${D}; d++) {
    float fx = wget(2 * d);
    float fy = wget(2 * d + 1);
    float ph = uScale * (fx * p.x + fy * p.y);
    float c = cos(ph), s = sin(ph);
    acc.r += wget(${ACOS} + d) * c + wget(${BSIN} + d) * s;
    acc.g += wget(${ACOS} + ${D} + d) * c + wget(${BSIN} + ${D} + d) * s;
    acc.b += wget(${ACOS} + 2 * ${D} + d) * c + wget(${BSIN} + 2 * ${D} + d) * s;
  }
  fragColor = vec4(clamp(acc, 0.0, 1.0), 1.0);
}`;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`symbolic shader compile failed: ${log}`);
  }
  return sh;
}

export class SymRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement, D: number) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(D)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`symbolic link failed: ${gl.getProgramInfoLog(prog)}`);
    this.program = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    for (const n of ['uW', 'uTexW', 'uScale', 'uRes']) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(flat: Float32Array, scale: number, size: number): void {
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
    gl.uniform1f(this.loc.uScale!, scale);
    gl.uniform2f(this.loc.uRes!, size, size);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
