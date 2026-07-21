// The radial-basis-function equation of the SELECTED image, solved offline in closed form and evaluated live
// in a WebGL2 fragment shader. The image is a linear combination of fixed thin-plate kernels on a grid of
// centers plus an affine term:
//   ch(x,y) = a0 + a1 x + a2 y + sum_i w_i,ch * phi(||(x,y) - c_i||),  phi(r) = r^2 log r,  x,y in [-1,1].
// Only the linear weights are fitted (ridge least squares), so unlike the Gaussian mixture this is a solved
// interpolation equation, not a gradient search.
import { APP_VERSION } from '../lib/version';

export interface RbfDoc {
  size: number;
  grid: number;
  centers: number[]; // K*2
  weights: number[]; // 3*K channel-major
  affine: number[]; // 3*3 channel-major (a0,a1,a2 per channel)
  psnr: number;
}

export async function loadRbfIndex(): Promise<{ fitted: string[]; size: number; grid: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_rbf/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`rbf index unavailable (${res.status})`);
  return res.json();
}
export async function loadRbf(imageId: string): Promise<RbfDoc> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_rbf/${imageId}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`no rbf fit for '${imageId}'`);
  return res.json();
}

/** Pack: [affine 9][centers 2K][weights 3K]. */
export function packRbf(doc: RbfDoc): Float32Array {
  const K = doc.grid * doc.grid;
  const out = new Float32Array(9 + 2 * K + 3 * K);
  out.set(doc.affine, 0);
  out.set(doc.centers, 9);
  out.set(doc.weights, 9 + 2 * K);
  return out;
}

const r3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the fitted RBF equation of one channel: the affine part + the top n kernels by |w|. */
export function rbfEquationTex(doc: RbfDoc, ch: number, n = 6): string {
  const K = doc.grid * doc.grid;
  const idx: { i: number; w: number }[] = [];
  for (let i = 0; i < K; i++) idx.push({ i, w: doc.weights[ch * K + i] });
  idx.sort((p, q) => Math.abs(q.w) - Math.abs(p.w));
  const name = ['R', 'G', 'B'][ch];
  const a0 = doc.affine[ch * 3];
  const a1 = doc.affine[ch * 3 + 1];
  const a2 = doc.affine[ch * 3 + 2];
  const lines: string[] = [
    `${name}(x,y) = {} & ${r3(a0)}${a1 >= 0 ? '+' : '-'}${r3(Math.abs(a1))}x${a2 >= 0 ? '+' : '-'}${r3(Math.abs(a2))}y`,
  ];
  for (const t of idx.slice(0, n)) {
    const cx = doc.centers[2 * t.i];
    const cy = doc.centers[2 * t.i + 1];
    const sign = t.w >= 0 ? '+' : '-';
    lines.push(`& ${sign}\\;${r3(Math.abs(t.w))}\\,\\phi\\!\\left(\\lVert(x,y)-(${r3(cx)},${r3(cy)})\\rVert\\right)`);
  }
  const rest = K - Math.min(n, K);
  if (rest > 0) lines.push(`& +\\;\\cdots\\;(${rest}\\ \\text{more centers}),\\quad \\phi(r)=r^2\\log r`);
  return `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}`;
}

/** The COMPLETE RBF equation as plain text (affine + every center weight, all channels). */
export function rbfEquationText(doc: RbfDoc, imageId: string): string {
  const K = doc.grid * doc.grid;
  const out: string[] = [
    `ImageLab, the fitted thin-plate RBF equation of "${imageId}"`,
    `model: ch(x,y) = a0 + a1*x + a2*y + sum_i w_i,ch * phi(||(x,y) - c_i||), phi(r) = r^2*log(r), x,y in [-1,1]`,
    `${K} centers on a ${doc.grid}x${doc.grid} grid, ridge least squares, fit PSNR ${doc.psnr} dB`,
    ``,
  ];
  for (let ch = 0; ch < 3; ch++) {
    out.push(`${['R', 'G', 'B'][ch]}: affine a0=${doc.affine[ch * 3].toFixed(5)} a1=${doc.affine[ch * 3 + 1].toFixed(5)} a2=${doc.affine[ch * 3 + 2].toFixed(5)}`);
    out.push(`   i: cx cy w`);
    for (let i = 0; i < K; i++) {
      out.push(`   ${i}: ${doc.centers[2 * i].toFixed(4)} ${doc.centers[2 * i + 1].toFixed(4)} ${doc.weights[ch * K + i].toFixed(6)}`);
    }
    out.push(``);
  }
  return out.join('\n');
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

function frag(K: number): string {
  const OFF_CEN = 9;
  const OFF_W = 9 + 2 * K;
  return `#version 300 es
precision highp float;
uniform sampler2D uW;
uniform int uTexW;
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
  vec3 acc = vec3(wget(0), wget(3), wget(6))
           + vec3(wget(1), wget(4), wget(7)) * p.x
           + vec3(wget(2), wget(5), wget(8)) * p.y;
  for (int i = 0; i < ${K}; i++) {
    vec2 c = vec2(wget(${OFF_CEN} + i * 2), wget(${OFF_CEN} + i * 2 + 1));
    vec2 d = p - c;
    float r2 = dot(d, d);
    float phi = r2 > 1e-12 ? 0.5 * r2 * log(r2) : 0.0;
    acc.r += wget(${OFF_W} + i) * phi;
    acc.g += wget(${OFF_W} + ${K} + i) * phi;
    acc.b += wget(${OFF_W} + 2 * ${K} + i) * phi;
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
    throw new Error(`rbf shader compile failed: ${log}`);
  }
  return sh;
}

export class RbfRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement, K: number) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(K)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`rbf link failed: ${gl.getProgramInfoLog(prog)}`);
    this.program = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    for (const n of ['uW', 'uTexW', 'uRes']) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(flat: Float32Array, displaySize: number): void {
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
    this.canvas.width = displaySize;
    this.canvas.height = displaySize;
    gl.viewport(0, 0, displaySize, displaySize);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.loc.uW!, 0);
    gl.uniform1i(this.loc.uTexW!, texW);
    gl.uniform2f(this.loc.uRes!, displaySize, displaySize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
