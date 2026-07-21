// The Gaussian-mixture equation of the SELECTED image (2D Gaussian splatting, accumulated-sum variant),
// baked offline by gradient descent and evaluated live in a WebGL2 fragment shader:
//     ch(x,y) = bias_ch + sum_k col_k,ch * exp(-1/2 (a_k dx^2 + 2 b_k dx dy + c_k dy^2)),
//     (dx, dy) = (x, y) - mu_k, coordinates in [-1, 1].
// Every term is a colored anisotropic Gaussian bump with a legible position, shape and color.
import { APP_VERSION } from '../lib/version';

export interface Gauss {
  mx: number;
  my: number;
  a: number;
  b: number;
  c: number;
  col: number[];
}
export interface GsplatDoc {
  size: number;
  n: number;
  bias: number[];
  gauss: Gauss[];
  psnr: number;
}

export async function loadGsplatIndex(): Promise<{ fitted: string[]; size: number; n: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_gsplat/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`gsplat index unavailable (${res.status})`);
  return res.json();
}
export async function loadGsplat(imageId: string): Promise<GsplatDoc> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_gsplat/${imageId}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`no gaussian fit for '${imageId}'`);
  return res.json();
}

/** Pack: [bias(3)] + per gaussian [mx,my,a,b,c, colR,colG,colB] (8 floats). */
export function packGsplat(doc: GsplatDoc, count: number): Float32Array {
  const n = Math.min(count, doc.gauss.length);
  const out = new Float32Array(3 + n * 8);
  out.set(doc.bias, 0);
  for (let k = 0; k < n; k++) {
    const g = doc.gauss[k];
    const o = 3 + k * 8;
    out[o] = g.mx;
    out[o + 1] = g.my;
    out[o + 2] = g.a;
    out[o + 3] = g.b;
    out[o + 4] = g.c;
    out[o + 5] = g.col[0];
    out[o + 6] = g.col[1];
    out[o + 7] = g.col[2];
  }
  return out;
}

const s2 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(2);
const s3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the ACTUAL Gaussian-mixture equation of one channel: the top n bumps with their real numbers. */
export function gsplatEquationTex(doc: GsplatDoc, ch: number, n = 5): string {
  const gs = [...doc.gauss].sort((p, q) => Math.abs(q.col[ch]) - Math.abs(p.col[ch]));
  const name = ['R', 'G', 'B'][ch];
  const lines: string[] = [`${name}(x,y) = {} & ${s3(doc.bias[ch])}`];
  for (const g of gs.slice(0, n)) {
    const sign = g.col[ch] >= 0 ? '+' : '-';
    const bTerm = g.b === 0 ? '' : `${g.b > 0 ? '+' : '-'}${s2(Math.abs(2 * g.b))}\\,dx\\,dy`;
    lines.push(
      `& ${sign}\\;${s3(Math.abs(g.col[ch]))}\\,e^{-\\frac12(${s2(g.a)}\\,dx^2${bTerm}+${s2(g.c)}\\,dy^2)}` +
        `\\;\\big|_{\\mu=(${s2(g.mx)},${s2(g.my)})}`,
    );
  }
  const rest = doc.gauss.length - Math.min(n, doc.gauss.length);
  if (rest > 0) lines.push(`& +\\;\\cdots\\;(${rest}\\ \\text{more Gaussians}),\\quad (dx,dy)=(x,y)-\\mu`);
  return `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}`;
}

/** The COMPLETE Gaussian-mixture equation as plain text (every Gaussian, all three channels). */
export function gsplatEquationText(doc: GsplatDoc, imageId: string): string {
  const out: string[] = [
    `ImageLab, the fitted 2D-Gaussian-mixture equation of "${imageId}"`,
    `model: ch(x,y) = bias_ch + sum_k col_k,ch * exp(-1/2*(a*dx^2 + 2*b*dx*dy + c*dy^2)), (dx,dy)=(x,y)-mu_k`,
    `       coordinates in [-1,1]; ${doc.gauss.length} Gaussians (gradient-descent fit), PSNR ${doc.psnr} dB`,
    ``,
    `bias = (${doc.bias.map((v) => v.toFixed(4)).join(', ')})`,
    ``,
    `k: mx my a b c | col_R col_G col_B`,
  ];
  doc.gauss.forEach((g, k) => {
    out.push(`${k + 1}: ${g.mx} ${g.my} ${g.a} ${g.b} ${g.c} | ${g.col.join(' ')}`);
  });
  return out.join('\n');
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

function frag(maxG: number): string {
  return `#version 300 es
precision highp float;
uniform sampler2D uW;
uniform int uTexW;
uniform int uCount;
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
  vec3 acc = vec3(wget(0), wget(1), wget(2));
  for (int k = 0; k < ${maxG}; k++) {
    if (k >= uCount) break;
    int o = 3 + k * 8;
    vec2 d = p - vec2(wget(o), wget(o + 1));
    float q = wget(o + 2) * d.x * d.x + 2.0 * wget(o + 3) * d.x * d.y + wget(o + 4) * d.y * d.y;
    float w = exp(-0.5 * q);
    acc += w * vec3(wget(o + 5), wget(o + 6), wget(o + 7));
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
    throw new Error(`gsplat shader compile failed: ${log}`);
  }
  return sh;
}

export class GsplatRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement, maxG: number) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(maxG)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`gsplat link failed: ${gl.getProgramInfoLog(prog)}`);
    this.program = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    for (const n of ['uW', 'uTexW', 'uCount', 'uRes']) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(flat: Float32Array, count: number, displaySize: number): void {
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
    gl.uniform1i(this.loc.uCount!, count);
    gl.uniform2f(this.loc.uRes!, displaySize, displaySize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
