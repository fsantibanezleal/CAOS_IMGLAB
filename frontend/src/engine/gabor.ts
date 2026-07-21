// The Gabor-atom equation of the SELECTED image, baked offline by matching pursuit and evaluated live in a
// WebGL2 fragment shader. Each term is a wave packet, a Gaussian envelope times an oriented cosine:
//     ch(x,y) = mean_ch + sum_k A_k,ch * exp(-u_k^2/(2 sx_k^2) - v_k^2/(2 sy_k^2)) * cos(om_k u_k - ph_k,ch),
//     (u_k, v_k) = R_{th_k} ((x, y) - mu_k)
// Strictly richer structure than the global trig fit: every term is a localized, legible object.
import { APP_VERSION } from '../lib/version';

export interface GaborAtom {
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  th: number;
  om: number;
  amp: number[]; // per channel
  ph: number[]; // per channel
}
export interface GaborDoc {
  size: number;
  mean: number[];
  atoms: GaborAtom[];
  psnr: number;
}

export async function loadGaborIndex(): Promise<{ fitted: string[]; size: number; atoms: number }> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_gabor/index.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`gabor index unavailable (${res.status})`);
  return res.json();
}
export async function loadGabor(imageId: string): Promise<GaborDoc> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/_gabor/${imageId}.json?v=${APP_VERSION}`);
  if (!res.ok) throw new Error(`no gabor fit for '${imageId}'`);
  return res.json();
}

/** Pack: [mean(3)] + per atom [cx,cy,sx,sy,th,om, ampR,ampG,ampB, phR,phG,phB] (12 floats). */
export function packGabor(doc: GaborDoc, count: number): Float32Array {
  const n = Math.min(count, doc.atoms.length);
  const out = new Float32Array(3 + n * 12);
  out.set(doc.mean, 0);
  for (let k = 0; k < n; k++) {
    const a = doc.atoms[k];
    const o = 3 + k * 12;
    out[o] = a.cx;
    out[o + 1] = a.cy;
    out[o + 2] = a.sx;
    out[o + 3] = a.sy;
    out[o + 4] = a.th;
    out[o + 5] = a.om;
    out[o + 6] = a.amp[0];
    out[o + 7] = a.amp[1];
    out[o + 8] = a.amp[2];
    out[o + 9] = a.ph[0];
    out[o + 10] = a.ph[1];
    out[o + 11] = a.ph[2];
  }
  return out;
}

const g2 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(2);
const g3 = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(3);

/** KaTeX for the ACTUAL Gabor equation of one channel: the top n atoms with their real numbers. */
export function gaborEquationTex(doc: GaborDoc, ch: number, n = 4): string {
  const atoms = [...doc.atoms].sort((p, q) => Math.abs(q.amp[ch]) - Math.abs(p.amp[ch]));
  const name = ['R', 'G', 'B'][ch];
  const lines: string[] = [`${name}(x,y) = {} & ${g3(doc.mean[ch])}`];
  for (const a of atoms.slice(0, n)) {
    const ph = a.ph[ch] >= 0 ? `-${g2(a.ph[ch])}` : `+${g2(-a.ph[ch])}`;
    lines.push(
      `& +\\;${g3(a.amp[ch])}\\,e^{-u^2/${g2(2 * a.sx * a.sx)}-v^2/${g2(2 * a.sy * a.sy)}}\\cos(${g2(a.om)}u${ph})` +
        `\\;\\big|_{\\mu=(${g2(a.cx)},${g2(a.cy)}),\\,\\theta=${g2(a.th)}}`,
    );
  }
  const rest = doc.atoms.length - Math.min(n, doc.atoms.length);
  if (rest > 0) lines.push(`& +\\;\\cdots\\;(${rest}\\ \\text{more atoms}),\\quad (u,v)=R_\\theta\\big((x,y)-\\mu\\big)`);
  return `\\begin{aligned}${lines.join(' \\\\ ')}\\end{aligned}`;
}

/** The COMPLETE Gabor equation as plain text (every atom, all three channels). */
export function gaborEquationText(doc: GaborDoc, imageId: string): string {
  const out: string[] = [
    `ImageLab, the fitted Gabor-atom equation of "${imageId}"`,
    `model: ch(x,y) = mean_ch + sum_k A_k,ch * exp(-u^2/(2 sx^2) - v^2/(2 sy^2)) * cos(om*u - ph_k,ch)`,
    `       with (u, v) = Rot(th) * ((x, y) - (cx, cy)), pixel coordinates of the ${doc.size}px fit`,
    `atoms: ${doc.atoms.length} (greedy matching pursuit), fit PSNR ${doc.psnr} dB`,
    ``,
    `mean = (${doc.mean.map((v) => v.toFixed(5)).join(', ')})`,
    ``,
    `k: cx cy sx sy th om | A_R A_G A_B | ph_R ph_G ph_B`,
  ];
  doc.atoms.forEach((a, k) => {
    out.push(
      `${k + 1}: ${a.cx} ${a.cy} ${a.sx} ${a.sy} ${a.th} ${a.om} | ${a.amp.join(' ')} | ${a.ph.join(' ')}`,
    );
  });
  return out.join('\n');
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

function frag(maxAtoms: number): string {
  return `#version 300 es
precision highp float;
uniform sampler2D uW;
uniform int uTexW;
uniform int uCount;
uniform float uSize;
uniform vec2 uRes;
out vec4 fragColor;

float wget(int i) {
  int px = i / 4; int comp = i - px * 4;
  ivec2 uv = ivec2(px % uTexW, px / uTexW);
  vec4 t = texelFetch(uW, uv, 0);
  return comp == 0 ? t.r : comp == 1 ? t.g : comp == 2 ? t.b : t.a;
}

void main() {
  vec2 p = (gl_FragCoord.xy / uRes) * vec2(uSize, uSize);
  p.y = uSize - p.y;
  vec3 acc = vec3(wget(0), wget(1), wget(2));
  for (int k = 0; k < ${maxAtoms}; k++) {
    if (k >= uCount) break;
    int o = 3 + k * 12;
    vec2 mu = vec2(wget(o), wget(o + 1));
    float sx = wget(o + 2), sy = wget(o + 3), th = wget(o + 4), om = wget(o + 5);
    vec2 d = p - mu;
    float ca = cos(th), sa = sin(th);
    float u = d.x * ca + d.y * sa;
    float v = -d.x * sa + d.y * ca;
    float env = exp(-u * u / (2.0 * sx * sx) - v * v / (2.0 * sy * sy));
    float arg = om * u;
    acc.r += wget(o + 6) * env * cos(arg - wget(o + 9));
    acc.g += wget(o + 7) * env * cos(arg - wget(o + 10));
    acc.b += wget(o + 8) * env * cos(arg - wget(o + 11));
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
    throw new Error(`gabor shader compile failed: ${log}`);
  }
  return sh;
}

export class GaborRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement, maxAtoms: number) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag(maxAtoms)));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`gabor link failed: ${gl.getProgramInfoLog(prog)}`);
    this.program = prog;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    for (const n of ['uW', 'uTexW', 'uCount', 'uSize', 'uRes']) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(flat: Float32Array, count: number, fitSize: number, displaySize: number): void {
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
    gl.uniform1f(this.loc.uSize!, fitSize);
    gl.uniform2f(this.loc.uRes!, displaySize, displaySize);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
