// A Compositional Pattern Producing Network (Stanley 2007) rendered live in a WebGL2 fragment shader:
// (x, y, r) -> a small MLP with interpretable periodic/Gaussian activations -> RGB, evaluated per pixel.
// The whole image is a compact function of ~72 weights; perturbing them morphs the pattern smoothly, which
// is the readable-and-editable formula-art pole (contrast the brittle dense fitted formula).
export const CPPN_INPUTS = 6; // x, y, r, sin(x), sin(y), bias
export const CPPN_HIDDEN = 10;
export const CPPN_OUTPUTS = 3;

export interface CppnWeights {
  w1: Float32Array; // HIDDEN * INPUTS
  w2: Float32Array; // OUTPUTS * HIDDEN
}

// deterministic pseudo-random weights from a seed (no Math.random so patterns are reproducible/shareable)
export function randomCppn(seed: number): CppnWeights {
  let s = (seed | 0) || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
  const w1 = new Float32Array(CPPN_HIDDEN * CPPN_INPUTS);
  const w2 = new Float32Array(CPPN_OUTPUTS * CPPN_HIDDEN);
  for (let i = 0; i < w1.length; i++) w1[i] = rnd() * 2.5;
  for (let i = 0; i < w2.length; i++) w2[i] = rnd() * 2.0;
  return { w1, w2 };
}

export type Activation = 'sin' | 'tanh' | 'gauss' | 'abs';
export const ACTIVATIONS: Activation[] = ['sin', 'tanh', 'gauss', 'abs'];

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform float uW1[${CPPN_HIDDEN * CPPN_INPUTS}];
uniform float uW2[${CPPN_OUTPUTS * CPPN_HIDDEN}];
uniform int uAct;
uniform float uFreq;
uniform vec2 uRes;
out vec4 fragColor;

float act(float v) {
  if (uAct == 0) return sin(v);
  if (uAct == 1) return tanh(v);
  if (uAct == 2) return exp(-v * v);
  return abs(fract(v) * 2.0 - 1.0);
}

void main() {
  vec2 p = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float x = p.x * uFreq, y = p.y * uFreq, r = length(p) * uFreq;
  float inp[${CPPN_INPUTS}];
  inp[0] = x; inp[1] = y; inp[2] = r; inp[3] = sin(x); inp[4] = sin(y); inp[5] = 1.0;
  float hid[${CPPN_HIDDEN}];
  for (int h = 0; h < ${CPPN_HIDDEN}; h++) {
    float s = 0.0;
    for (int i = 0; i < ${CPPN_INPUTS}; i++) s += uW1[h * ${CPPN_INPUTS} + i] * inp[i];
    hid[h] = act(s);
  }
  vec3 o;
  for (int k = 0; k < ${CPPN_OUTPUTS}; k++) {
    float s = 0.0;
    for (int hh = 0; hh < ${CPPN_HIDDEN}; hh++) s += uW2[k * ${CPPN_HIDDEN} + hh] * hid[hh];
    o[k] = 0.5 + 0.5 * sin(s);
  }
  fragColor = vec4(o, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`CPPN shader compile failed: ${log}`);
  }
  return sh;
}

export class CppnRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`CPPN link failed: ${gl.getProgramInfoLog(prog)}`);
    this.program = prog;
    gl.useProgram(prog);
    // full-screen triangle
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uW1', 'uW2', 'uAct', 'uFreq', 'uRes']) this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(weights: CppnWeights, activation: Activation, freq: number, size: number): void {
    const gl = this.gl;
    this.canvas.width = size;
    this.canvas.height = size;
    gl.viewport(0, 0, size, size);
    gl.useProgram(this.program);
    gl.uniform1fv(this.loc.uW1!, weights.w1);
    gl.uniform1fv(this.loc.uW2!, weights.w2);
    gl.uniform1i(this.loc.uAct!, ACTIVATIONS.indexOf(activation));
    gl.uniform1f(this.loc.uFreq!, freq);
    gl.uniform2f(this.loc.uRes!, size, size);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const lose = this.gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
  }
}
