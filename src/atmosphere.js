window.Aura = window.Aura || {};

Aura.atmosphere = {
  defaults: { enabled: true, intensity: "medium", speed: 1, preset: "ether" },
  presets: {
    ether: [[0, 1, .8], [.8, 0, 1]],
    ocean: [[0, .65, 1], [0, 1, .72]],
    violet: [[.35, .15, 1], [1, .1, .75]]
  },
  state: null,
  gl: null,
  canvas: null,
  uniforms: null,
  rafId: null,
  reduceMotion: false,
  lastFrameTime: 0,
  targetFrameMs: 1000 / 30,
  normalize(value = {}) {
    const speed = Number(value.speed);
    return {
      enabled: value.enabled !== false,
      intensity: ["low", "medium", "high"].includes(value.intensity) ? value.intensity : "medium",
      speed: Number.isFinite(speed) ? Math.min(2, Math.max(.25, speed)) : 1,
      preset: Object.hasOwn(this.presets, value.preset) ? value.preset : "ether"
    };
  },
  apply(next = {}) {
    this.state = this.normalize({ ...this.state, ...next });
    Aura.storage.set("atmosphere", this.state);
    document.body.dataset.intensity = this.state.intensity;
    document.body.dataset.atmosphereEnabled = this.state.enabled;
    if (this.canvas) this.canvas.hidden = !this.state.enabled;
    this.renderControls();
    if (this.state.enabled && !document.hidden) this.start();
    else this.stop();
  },
  renderControls() {
    document.getElementById("atmosphere-enabled").checked = this.state.enabled;
    document.getElementById("atmosphere-intensity").value = this.state.intensity;
    document.getElementById("atmosphere-speed").value = this.state.speed;
    document.getElementById("atmosphere-speed-value").textContent = `${this.state.speed}×`;
    document.querySelectorAll("[data-atmosphere-preset]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.atmospherePreset === this.state.preset);
    });
  },
  start() {
    if (!this.gl || !this.state?.enabled || document.hidden || this.canvas?.hidden) return;
    if (this.reduceMotion) this.draw(0);
    else if (this.rafId === null) this.rafId = requestAnimationFrame(time => this.draw(time));
  },
  stop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastFrameTime = 0;
  },
  draw(frameTime) {
    this.rafId = null;
    const { gl, canvas, uniforms, state } = this;
    if (!gl || !canvas || !uniforms || !state?.enabled || document.hidden || canvas.hidden) return;

    if (!this.reduceMotion && this.lastFrameTime && frameTime - this.lastFrameTime < this.targetFrameMs) {
      this.rafId = requestAnimationFrame(time => this.draw(time));
      return;
    }
    this.lastFrameTime = frameTime;

    const colors = this.presets[state.preset];
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, frameTime / 1000);
    gl.uniform1f(uniforms.intensity, { low: .5, medium: .9, high: 1 }[state.intensity]);
    gl.uniform1f(uniforms.speed, state.speed);
    gl.uniform3fv(uniforms.colorA, colors[0]);
    gl.uniform3fv(uniforms.colorB, colors[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (state.enabled && !this.reduceMotion && !document.hidden && !canvas.hidden) {
      this.rafId = requestAnimationFrame(time => this.draw(time));
    }
  },
  initWebGL() {
    const canvas = document.getElementById("atmosphere");
    const gl = canvas.getContext("webgl", { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return;
    this.canvas = canvas;
    this.gl = gl;
    const resize = () => {
      const scale = Math.min(devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(innerWidth * scale);
      canvas.height = Math.round(innerHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    addEventListener("resize", resize);
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      uniform vec2 resolution;
      uniform float time;
      uniform float intensity;
      uniform float speed;
      uniform vec3 colorA;
      uniform vec3 colorB;

      mat2 rotate(float angle) {
        float s=sin(angle), c=cos(angle);
        return mat2(c,-s,s,c);
      }

      float flowerOfLife(vec2 uv, float scale) {
        uv*=scale;
        vec2 cell=fract(uv)-.5;
        float distanceToRing=10.;
        for(int y=-1;y<=1;y++) {
          for(int x=-1;x<=1;x++) {
            float ring=abs(length(cell-vec2(float(x),float(y)))-1.);
            distanceToRing=min(distanceToRing,ring);
          }
        }
        return 1.-smoothstep(0.,.025,distanceToRing);
      }

      void main() {
        vec2 uv=(gl_FragCoord.xy/resolution-.5)*2.;
        uv.x*=resolution.x/resolution.y;
        float t=time*speed*.15;
        vec2 cloudPosition=vec2(cos(t*2.),sin(t*2.))*.6;
        float cloud=smoothstep(1.,0.,length(uv-cloudPosition));
        vec3 accent=mix(colorA,colorB,sin(t)*.5+.5);
        float zoom=fract(t*.4);
        vec3 color=vec3(0.);

        for(int i=0;i<3;i++) {
          float layer=float(i)/3.;
          float depth=fract(zoom+layer);
          float scale=pow(10.,1.-depth*2.);
          float alpha=smoothstep(0.,.2,depth)*(1.-smoothstep(.8,1.,depth));
          float pattern=flowerOfLife(uv*rotate(t*.1+layer),scale);
          color+=mix(vec3(.1),accent,cloud*.8)*pattern*alpha;
        }

        color+=accent*cloud*.15;
        gl_FragColor=vec4(mix(vec3(.01),color,intensity),1.);
      }`));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = {
      resolution: gl.getUniformLocation(program, "resolution"),
      time: gl.getUniformLocation(program, "time"),
      intensity: gl.getUniformLocation(program, "intensity"),
      speed: gl.getUniformLocation(program, "speed"),
      colorA: gl.getUniformLocation(program, "colorA"),
      colorB: gl.getUniformLocation(program, "colorB")
    };
    this.reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  },
  init(preferences = {}) {
    document.getElementById("atmosphere-controls").innerHTML = `
      <section class="atmosphere-panel card">
        <label class="setting"><span><b>Enabled</b><small>Show the animated background</small></span><input id="atmosphere-enabled" type="checkbox" role="switch"></label>
        <label class="setting select-setting"><span><b>Intensity</b><small>Control the background contrast</small></span><select id="atmosphere-intensity"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label class="atmosphere-speed"><span><b>Speed</b><small>Animation pace</small></span><span><input id="atmosphere-speed" type="range" min="0.25" max="2" step="0.25"><output id="atmosphere-speed-value"></output></span></label>
        <fieldset class="atmosphere-presets"><legend>Preset</legend><button type="button" data-atmosphere-preset="ether">Ether</button><button type="button" data-atmosphere-preset="ocean">Ocean</button><button type="button" data-atmosphere-preset="violet">Violet</button></fieldset>
      </section>`;
    document.getElementById("atmosphere-enabled").addEventListener("change", event => this.apply({ enabled: event.target.checked }));
    document.getElementById("atmosphere-intensity").addEventListener("change", event => this.apply({ intensity: event.target.value }));
    document.getElementById("atmosphere-speed").addEventListener("input", event => this.apply({ speed: event.target.value }));
    document.querySelectorAll("[data-atmosphere-preset]").forEach(button => {
      button.addEventListener("click", () => this.apply({ preset: button.dataset.atmospherePreset }));
    });
    addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else if (this.state?.enabled) this.start();
    });
    this.initWebGL();
    const stored = Aura.storage.get("atmosphere", null);
    this.state = this.normalize(stored || { intensity: preferences.intensity });
    this.apply();
  }
};
