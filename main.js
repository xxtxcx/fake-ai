import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const canvas = document.querySelector("#scene");
const statusText = document.querySelector("#statusText");
const micButton = document.querySelector("#micButton");
const thinkingDots = document.querySelector("#thinkingDots");
const roleSelect = document.querySelector("#roleSelect");
const serverUrlInput = document.querySelector("#serverUrlInput");
const channelInput = document.querySelector("#channelInput");
const connectButton = document.querySelector("#connectButton");

const VOICE_STATE = {
  IDLE: "idle",
  LISTENING: "listening",
  THINKING: "thinking",
  SPEAKING: "speaking",
};
let currentState = VOICE_STATE.IDLE;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6.2);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x8cb6ff, 0x080611, 0.55);
scene.add(hemi);

const point = new THREE.PointLight(0x5fa3ff, 2.1, 30, 2.2);
point.position.set(2.2, 2.4, 3.8);
scene.add(point);

const uniforms = {
  uTime: { value: 0 },
  uAudioLevel: { value: 0 },
  uBass: { value: 0 },
  uMid: { value: 0 },
  uTreble: { value: 0 },
  uStateMix: { value: 0 },
  uHaloPulse: { value: 0 },
  uColorA: { value: new THREE.Color("#3aa3ff") },
  uColorB: { value: new THREE.Color("#8a4dff") },
};

const geometry = new THREE.SphereGeometry(1.42, 220, 220);

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime;
    uniform float uAudioLevel;
    uniform float uBass;
    uniform float uMid;
    uniform float uTreble;
    uniform float uStateMix;
    varying float vWave;
    varying vec3 vNormal;

    float waveNoise(vec3 p, float t) {
      float a = sin((p.x * 3.6 + p.y * 2.4 + p.z * 3.9) + t * 1.4);
      float b = sin((p.x * 7.8 - p.y * 6.3 + p.z * 8.6) - t * 2.1);
      float c = sin((p.x * 14.0 + p.y * 11.0 - p.z * 9.0) + t * 3.1);
      return a * 0.55 + b * 0.3 + c * 0.15;
    }

    void main() {
      vNormal = normal;
      vec3 p = position;
      vec3 n = normalize(normal);

      float t = uTime * 0.9;
      float n1 = waveNoise(p, t);
      float n2 = sin((p.x + p.y + p.z) * 13.0 - uTime * 2.3);
      float dirBass = smoothstep(0.2, 1.0, abs(n.y));
      float dirMid = smoothstep(0.2, 1.0, abs(n.x));
      float dirTreble = smoothstep(0.2, 1.0, abs(n.z));
      float ringMask = smoothstep(0.15, 0.95, abs(sin(atan(n.y, n.x) * 6.0)));

      float bassWobble = sin((p.y * 6.0) + t * 1.2) * uBass * dirBass * 0.75;
      float midWobble = sin((p.x * 11.0 - p.z * 5.0) - t * 1.6) * uMid * dirMid * 0.55;
      float trebleSpike = max(0.0, n2) * uTreble * dirTreble * 1.25;
      float thinkingRipple = sin(length(p.xy) * 16.0 - uTime * 2.8) * ringMask * uStateMix * 0.09;

      float spike = max(0.0, n2) * (0.18 + uAudioLevel * 1.6);
      float displacement = n1 * (0.12 + uAudioLevel * 0.42) + spike * uAudioLevel * 0.55 + bassWobble + midWobble + trebleSpike + thinkingRipple;

      p += normal * displacement;
      vWave = displacement;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uAudioLevel;
    uniform float uStateMix;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying float vWave;
    varying vec3 vNormal;

    void main() {
      float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + vWave * 8.0 + uAudioLevel * 7.0);
      pulse = mix(pulse, 0.5 + 0.5 * sin(uTime * 1.6), uStateMix);
      vec3 baseColor = mix(uColorA, uColorB, pulse);

      float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.6);
      float glow = 0.22 + fresnel * (0.95 + uAudioLevel * 1.5);

      vec3 finalColor = baseColor * (0.58 + glow);
      gl_FragColor = vec4(finalColor, 0.93);
    }
  `,
});

const orb = new THREE.Mesh(geometry, material);
scene.add(orb);

const coreGeometry = new THREE.IcosahedronGeometry(1.12, 32);
const coreMaterial = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime;
    uniform float uAudioLevel;
    uniform float uBass;
    varying float vGlow;

    void main() {
      vec3 p = position;
      float wobble = sin((p.x + p.y + p.z) * 8.0 - uTime * 2.2) * (0.06 + uBass * 0.22);
      p += normal * wobble;
      vGlow = wobble + uAudioLevel;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying float vGlow;

    void main() {
      float t = 0.5 + 0.5 * sin(uTime * 2.4 + vGlow * 10.0);
      vec3 c = mix(uColorA, uColorB, t);
      float alpha = 0.35 + abs(vGlow) * 0.7;
      gl_FragColor = vec4(c, alpha);
    }
  `,
});
const coreOrb = new THREE.Mesh(coreGeometry, coreMaterial);
scene.add(coreOrb);

const haloGeometry = new THREE.RingGeometry(1.86, 2.24, 260);
const haloMaterial = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  vertexShader: `
    uniform float uTime;
    uniform float uAudioLevel;
    uniform float uTreble;
    varying float vBand;

    void main() {
      vec3 p = position;
      float angular = atan(p.y, p.x);
      float ripple = sin(angular * 18.0 + uTime * 2.2) * (0.03 + uTreble * 0.07);
      float radialPush = (0.03 + uAudioLevel * 0.12) * (0.5 + 0.5 * sin(angular * 9.0 - uTime * 1.4));
      p.xy *= (1.0 + radialPush + ripple);
      vBand = radialPush + ripple;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uHaloPulse;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    varying float vBand;

    void main() {
      float pulse = 0.5 + 0.5 * sin(uTime * 2.7 + vBand * 20.0);
      vec3 c = mix(uColorA, uColorB, pulse);
      float alpha = (0.22 + abs(vBand) * 1.2) * (0.55 + uHaloPulse * 0.65);
      gl_FragColor = vec4(c, alpha);
    }
  `,
});
const haloRing = new THREE.Mesh(haloGeometry, haloMaterial);
haloRing.position.z = -0.2;
scene.add(haloRing);

const clock = new THREE.Clock();

let audioCtx = null;
let analyser = null;
let freqData = null;
let micStream = null;
let smoothedLevel = 0;
let smoothedBass = 0;
let smoothedMid = 0;
let smoothedTreble = 0;
let silenceTime = 0;
let smoothedNoiseFloor = 0.02;
let voiceActive = false;
let cooldownTimer = 0;
let remoteFeed = { level: 0, bass: 0, mid: 0, treble: 0 };
let remoteEventSource = null;
let publishTimer = null;
let viewerPollTimer = null;
let transportReady = false;
let remoteVersion = 0;

const NOISE_FLOOR_LERP = 0.025;
const VOICE_OPEN_OFFSET = 0.11;
const VOICE_CLOSE_OFFSET = 0.075;
const CALM_DOWN_DURATION = 0.8;

function updateStatus(text) {
  statusText.textContent = text;
}

function getTransportConfig() {
  return {
    baseUrl: serverUrlInput.value.trim().replace(/\/$/, ""),
    channel: (channelInput.value.trim() || "demo-room").toLowerCase(),
  };
}

function resetRemoteConnection() {
  if (remoteEventSource) {
    remoteEventSource.close();
    remoteEventSource = null;
  }
  if (viewerPollTimer) {
    clearInterval(viewerPollTimer);
    viewerPollTimer = null;
  }
  transportReady = false;
  remoteVersion = 0;
}

function resolveApiBase(baseUrl) {
  if (!baseUrl) return window.location.origin;
  return baseUrl;
}

async function pullSyncState() {
  const { baseUrl, channel } = getTransportConfig();
  const apiBase = resolveApiBase(baseUrl);
  const response = await fetch(`${apiBase}/api/orb-sync?channel=${encodeURIComponent(channel)}&since=${remoteVersion}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.version && data.version > remoteVersion) {
    remoteVersion = data.version;
    remoteFeed = {
      level: data.level || 0,
      bass: data.bass || 0,
      mid: data.mid || 0,
      treble: data.treble || 0,
    };
  }
}

function startViewerStream() {
  resetRemoteConnection();
  const { baseUrl, channel } = getTransportConfig();
  const apiBase = resolveApiBase(baseUrl);
  const isVercelMode = apiBase === window.location.origin || apiBase.includes("vercel.app");

  if (isVercelMode) {
    viewerPollTimer = setInterval(async () => {
      try {
        await pullSyncState();
        transportReady = true;
      } catch (_error) {
        transportReady = false;
      }
    }, 120);
    updateStatus(`Viewer підключено до каналу ${channel}`);
    return;
  }

  const eventsUrl = `${apiBase}/events?channel=${encodeURIComponent(channel)}`;
  remoteEventSource = new EventSource(eventsUrl);
  remoteEventSource.onopen = () => {
    transportReady = true;
    updateStatus("Viewer підключено. Очікую голос ведучого...");
  };
  remoteEventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      remoteFeed = {
        level: data.level || 0,
        bass: data.bass || 0,
        mid: data.mid || 0,
        treble: data.treble || 0,
      };
    } catch (err) {
      console.error("Bad event payload", err);
    }
  };
  remoteEventSource.onerror = () => {
    transportReady = false;
    updateStatus("Немає з'єднання з сервером трансляції");
  };
}

function stopPublishing() {
  if (publishTimer) {
    clearInterval(publishTimer);
    publishTimer = null;
  }
}

function startPublishing() {
  stopPublishing();
  const { baseUrl, channel } = getTransportConfig();
  const apiBase = resolveApiBase(baseUrl);
  const isVercelMode = apiBase === window.location.origin || apiBase.includes("vercel.app");
  publishTimer = setInterval(async () => {
    if (!analyser) return;
    try {
      const endpoint = isVercelMode ? `${apiBase}/api/orb-sync` : `${apiBase}/ingest`;
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          level: smoothedLevel,
          bass: smoothedBass,
          mid: smoothedMid,
          treble: smoothedTreble,
          ts: Date.now(),
        }),
      });
      transportReady = true;
    } catch (_error) {
      transportReady = false;
    }
  }, 90);
}

function setVoiceState(state) {
  if (currentState === state) return;
  currentState = state;
  document.body.dataset.voiceState = state;
  thinkingDots.style.opacity = state === VOICE_STATE.THINKING ? "1" : "0.2";
  if (state === VOICE_STATE.SPEAKING) updateStatus("Відповідаю голосом...");
  if (state === VOICE_STATE.THINKING) updateStatus("Думаю...");
  if (state === VOICE_STATE.LISTENING) updateStatus("Слухаю... говоріть");
  if (state === VOICE_STATE.IDLE) updateStatus("Очікує мікрофон");
}

async function startMicrophone() {
  if (roleSelect.value !== "source") {
    updateStatus("Для мікрофона оберіть режим source");
    return;
  }
  if (analyser) return;

  try {
    setVoiceState(VOICE_STATE.IDLE);
    updateStatus("Запит доступу до мікрофона...");
    micButton.disabled = true;
    micButton.textContent = "Запит доступу...";
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    micStream = stream;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.86;
    source.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    micButton.textContent = "Вимкнути мікрофон";
    micButton.disabled = false;
    setVoiceState(VOICE_STATE.LISTENING);
    startPublishing();
  } catch (error) {
    console.error(error);
    micButton.disabled = false;
    micButton.textContent = "Увімкнути мікрофон";
    updateStatus("Не вдалося отримати доступ до мікрофона");
  }
}

async function stopMicrophone() {
  if (micStream) {
    for (const track of micStream.getTracks()) {
      track.stop();
    }
    micStream = null;
  }

  if (audioCtx) {
    await audioCtx.close();
  }

  audioCtx = null;
  analyser = null;
  freqData = null;
  stopPublishing();
  voiceActive = false;
  silenceTime = 0;
  cooldownTimer = CALM_DOWN_DURATION;

  micButton.disabled = false;
  micButton.textContent = "Увімкнути мікрофон";
  setVoiceState(VOICE_STATE.LISTENING);
  updateStatus("Завершую...");
}

function getAudioLevel() {
  if (roleSelect.value === "viewer") return remoteFeed.level;
  if (!analyser || !freqData) return 0;

  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  for (let i = 0; i < freqData.length; i += 1) {
    const normalized = freqData[i] / 255;
    sum += normalized * normalized;
  }
  const rms = Math.sqrt(sum / freqData.length);
  return Math.min(1, rms * 2.8);
}

function getSpectrumLevels() {
  if (roleSelect.value === "viewer") {
    return {
      bass: remoteFeed.bass,
      mid: remoteFeed.mid,
      treble: remoteFeed.treble,
    };
  }
  if (!analyser || !freqData) return { bass: 0, mid: 0, treble: 0 };

  const nyquist = (audioCtx?.sampleRate || 44100) / 2;
  const binHz = nyquist / freqData.length;

  const bassMax = Math.floor(180 / binHz);
  const midMax = Math.floor(1600 / binHz);
  const trebleMax = Math.floor(6500 / binHz);

  let bassSum = 0;
  let bassCount = 0;
  let midSum = 0;
  let midCount = 0;
  let trebleSum = 0;
  let trebleCount = 0;

  for (let i = 0; i < freqData.length; i += 1) {
    const v = freqData[i] / 255;
    if (i <= bassMax) {
      bassSum += v;
      bassCount += 1;
    } else if (i <= midMax) {
      midSum += v;
      midCount += 1;
    } else if (i <= trebleMax) {
      trebleSum += v;
      trebleCount += 1;
    }
  }

  return {
    bass: Math.min(1, (bassCount ? bassSum / bassCount : 0) * 2.9),
    mid: Math.min(1, (midCount ? midSum / midCount : 0) * 2.6),
    treble: Math.min(1, (trebleCount ? trebleSum / trebleCount : 0) * 3.1),
  };
}

function animate() {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  const audioLevel = getAudioLevel();
  const spectrum = getSpectrumLevels();

  smoothedLevel = THREE.MathUtils.lerp(smoothedLevel, audioLevel, 0.13);
  smoothedBass = THREE.MathUtils.lerp(smoothedBass, spectrum.bass, 0.2);
  smoothedMid = THREE.MathUtils.lerp(smoothedMid, spectrum.mid, 0.18);
  smoothedTreble = THREE.MathUtils.lerp(smoothedTreble, spectrum.treble, 0.16);
  if (!voiceActive) {
    smoothedNoiseFloor = THREE.MathUtils.lerp(smoothedNoiseFloor, smoothedLevel, NOISE_FLOOR_LERP);
  }
  uniforms.uTime.value = elapsed;
  uniforms.uAudioLevel.value = smoothedLevel;
  uniforms.uBass.value = smoothedBass;
  uniforms.uMid.value = smoothedMid;
  uniforms.uTreble.value = smoothedTreble;
  uniforms.uStateMix.value = currentState === VOICE_STATE.THINKING ? 1 : 0;
  uniforms.uHaloPulse.value = THREE.MathUtils.lerp(
    uniforms.uHaloPulse.value,
    Math.max(smoothedLevel, smoothedTreble * 0.9),
    0.14,
  );

  orb.rotation.y += 0.002 + smoothedMid * 0.014;
  orb.rotation.x = Math.sin(elapsed * 0.24) * 0.16;
  coreOrb.rotation.y -= 0.0015 + smoothedTreble * 0.01;
  coreOrb.rotation.z = Math.sin(elapsed * 0.2) * 0.09;
  haloRing.rotation.z += 0.0015 + smoothedTreble * 0.01;
  haloRing.lookAt(camera.position);

  if (roleSelect.value === "source" && analyser) {
    const openGate = Math.min(0.36, smoothedNoiseFloor + VOICE_OPEN_OFFSET);
    const closeGate = Math.min(0.3, smoothedNoiseFloor + VOICE_CLOSE_OFFSET);
    if (!voiceActive && smoothedLevel > openGate) {
      voiceActive = true;
    } else if (voiceActive && smoothedLevel < closeGate) {
      voiceActive = false;
    }

    if (voiceActive) {
      silenceTime = 0;
      setVoiceState(VOICE_STATE.SPEAKING);
    } else {
      silenceTime += delta;
      if (silenceTime > 1.4) {
        setVoiceState(VOICE_STATE.THINKING);
      } else {
        setVoiceState(VOICE_STATE.LISTENING);
      }
    }
  }

  if (roleSelect.value === "viewer") {
    const hasSignal = smoothedLevel > 0.04;
    setVoiceState(hasSignal ? VOICE_STATE.SPEAKING : VOICE_STATE.THINKING);
    if (!transportReady) updateStatus("Viewer: підключення...");
  }

  if (!analyser && cooldownTimer > 0) {
    cooldownTimer = Math.max(0, cooldownTimer - delta);
    if (cooldownTimer === 0) {
      smoothedNoiseFloor = 0.02;
      setVoiceState(VOICE_STATE.IDLE);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

micButton.addEventListener("click", async () => {
  if (analyser) {
    await stopMicrophone();
    return;
  }
  await startMicrophone();
});
connectButton.addEventListener("click", async () => {
  if (roleSelect.value === "viewer") {
    await stopMicrophone();
    startViewerStream();
    micButton.disabled = true;
    micButton.textContent = "Мікрофон вимкнено (viewer)";
  } else {
    resetRemoteConnection();
    micButton.disabled = false;
    micButton.textContent = analyser ? "Вимкнути мікрофон" : "Увімкнути мікрофон";
    updateStatus("Source режим. Увімкніть мікрофон");
  }
});
setVoiceState(VOICE_STATE.IDLE);

animate();
