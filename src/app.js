window.Aura = window.Aura || {};

(() => {
  const defaults = {
    is24Hour: Aura.config.clock.format === "24h",
    isCelsius: true,
    showWeather: true,
    showScratchpad: true,
    searchEngine: Aura.config.search.defaultEngine,
    intensity: "medium"
  };
  const preferences = { ...defaults, ...Aura.storage.get("preferences", {}) };
  const savePreferences = () => {
    Aura.storage.set("preferences", preferences);
    syncSettings();
  };

  function resolveViewName(name) {
    return ["home", "productivity", "atmosphere", "library"].includes(name) ? name : "home";
  }
  function showView(name) {
    const selected = resolveViewName(name);
    document.querySelectorAll("[data-view]").forEach(view => { view.hidden = view.dataset.view !== selected; });
    document.querySelectorAll("[data-view-target]").forEach(button => {
      button.classList.toggle("active", button.dataset.viewTarget === selected);
    });
    history.replaceState(null, "", `#${selected}`);
  }
  document.querySelectorAll("[data-view-target]").forEach(button =>
    button.addEventListener("click", () => showView(button.dataset.viewTarget))
  );
  showView(location.hash.slice(1) || "home");

  const spaces = document.getElementById("spaces");
  Aura.config.spaces.forEach(space => {
    const link = document.createElement("a");
    link.className = `space-card ${space.color}`;
    link.href = space.target;
    link.innerHTML = `<span><svg><use href="#i-${space.icon}"></use></svg></span><b>${space.title}</b>`;
    spaces.appendChild(link);
  });
  const add = document.createElement("button");
  add.className = "space-card add-card";
  add.innerHTML = '<span><svg><use href="#i-plus"></use></svg></span><b>Add New</b>';
  add.addEventListener("click", openSettings);
  spaces.appendChild(add);

  const dialog = document.getElementById("settings-dialog");
  function openSettings() { dialog.showModal(); }
  document.querySelectorAll("[data-open-settings]").forEach(button => button.addEventListener("click", openSettings));

  const controls = {
    clock: document.getElementById("setting-clock"),
    temp: document.getElementById("setting-temp"),
    engine: document.getElementById("setting-engine"),
    intensity: document.getElementById("setting-intensity"),
    weather: document.getElementById("setting-weather"),
    scratchpad: document.getElementById("setting-scratchpad")
  };
  function syncSettings() {
    controls.clock.checked = preferences.is24Hour;
    controls.temp.checked = preferences.isCelsius;
    controls.engine.value = preferences.searchEngine;
    controls.intensity.value = preferences.intensity;
    controls.weather.checked = preferences.showWeather;
    controls.scratchpad.checked = preferences.showScratchpad;
    document.body.dataset.intensity = preferences.intensity;
  }
  Object.values(controls).forEach(control => control.addEventListener("change", () => {
    preferences.is24Hour = controls.clock.checked;
    preferences.isCelsius = controls.temp.checked;
    preferences.searchEngine = controls.engine.value;
    preferences.intensity = controls.intensity.value;
    preferences.showWeather = controls.weather.checked;
    preferences.showScratchpad = controls.scratchpad.checked;
    savePreferences();
    Aura.widgets.updateClock();
    Aura.widgets.renderWeather();
    Aura.widgets.applyVisibility();
  }));

  document.getElementById("clock-toggle").addEventListener("click", () => Aura.widgets.toggleClock());
  document.getElementById("weather").addEventListener("click", () => Aura.widgets.toggleTemperature());
  document.getElementById("deep-work").addEventListener("click", event => {
    document.body.classList.toggle("deep-work-active");
    event.currentTarget.textContent = document.body.classList.contains("deep-work-active") ? "End Session" : "Deep Work";
  });
  document.getElementById("reset-data").addEventListener("click", () => {
    if (confirm("Reset Aura notes and preferences?")) {
      Aura.storage.clear();
      location.reload();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && dialog.open) dialog.close();
    if (event.key === "/" && document.activeElement.tagName !== "TEXTAREA") {
      event.preventDefault();
      document.getElementById("search-input").focus();
    }
  });

  function startAtmosphere() {
    const canvas = document.getElementById("atmosphere");
    const gl = canvas.getContext("webgl");
    if (!gl) return;
    const resize = () => {
      const scale = Math.min(devicePixelRatio, 2);
      canvas.width = innerWidth * scale;
      canvas.height = innerHeight * scale;
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
        float t=time*.15;
        vec2 cloudPosition=vec2(cos(t*2.),sin(t*2.))*.6;
        float cloud=smoothstep(1.,0.,length(uv-cloudPosition));
        vec3 accent=mix(vec3(0.,1.,.8),vec3(.8,0.,1.),sin(t)*.5+.5);
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
    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    const intensity = gl.getUniformLocation(program, "intensity");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = frameTime => {
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, frameTime / 1000);
      gl.uniform1f(intensity, { low: .5, medium: .9, high: 1 }[preferences.intensity]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduceMotion) requestAnimationFrame(draw);
    };
    draw(0);
  }

  syncSettings();
  Aura.search.init(preferences);
  Aura.widgets.init(preferences, savePreferences);
  startAtmosphere();
})();
