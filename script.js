/* ============================================================
   BLACK HOLE — 3D Simulation | script.js
   Engine: Three.js + Web Speech API voice assistant (ORACLE)
   ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ------------------------------------------------------------
   1. CONFIG — all the tweakable knobs in one place
------------------------------------------------------------ */
const CONFIG = {
    eventHorizonRadius: 1.0,     // pure black sphere
    photonRingRadius: 1.45,      // bright light-orbit ring
    diskInnerRadius: 2.2,        // accretion disk inner edge
    diskOuterRadius: 9.0,        // accretion disk outer edge
    diskTilt: 0.45,              // the classic "Gargantua" tilt (radians)
    haloScale: 20,               // lensed glow size
    flySpeed: 0.18,              // WASD speed
    cameraStart: new THREE.Vector3(0, 4.5, 14),
    voiceLang: 'en-US',          // voice recognition & synthesis language
    groqApiKey: '',              // Kept secure on server (Vercel GROQ_API_KEY) or set via localStorage
    groqModel: 'qwen/qwen3.8-27b', // ultra-fast, high-intelligence Groq model
    voicePitch: 1.32,            // elevated pitch for bright, youthful anime girl tone
    voiceRate: 1.05,             // crisp, lively delivery
};

/* ------------------------------------------------------------
   2. RENDERER / SCENE / CAMERA
------------------------------------------------------------ */
const canvas = document.getElementById('blackhole-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.copy(CONFIG.cameraStart);

/* ------------------------------------------------------------
   3. CAMERA CONTROLS & POINTER TRACKING (Mouse / Touchpad)
------------------------------------------------------------ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.zoomSpeed = 0.35;           // gentle, controlled zoom per scroll step
controls.minDistance = 6.5;          // prevents black hole from becoming overwhelmingly huge
controls.maxDistance = 45;           // keeps black hole well-framed when zooming out
controls.minPolarAngle = 0.15;
controls.maxPolarAngle = Math.PI - 0.15;
controls.autoRotate = false;         // direct user control with mouse/touchpad
controls.autoRotateSpeed = 0.35;
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
};

// Interactive Pointer Tracking (Mouse & Touchpad tilt control)
let mouseX = 0;
let mouseY = 0;
let targetTiltX = CONFIG.diskTilt;
let targetTiltY = 0;

window.addEventListener('pointermove', (e) => {
    if (e.target.closest('#voice-panel') || e.target.closest('#mic-btn')) return;
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    targetTiltY = mouseX * 0.75;
    targetTiltX = CONFIG.diskTilt + mouseY * 0.45;
});

// Double-click = reset view
window.addEventListener('dblclick', () => {
    camera.position.copy(CONFIG.cameraStart);
    controls.target.set(0, 0, 0);
    mouseX = 0;
    mouseY = 0;
    targetTiltX = CONFIG.diskTilt;
    targetTiltY = 0;
});

/* ------------------------------------------------------------
   4. TEXTURE HELPERS — generated on a canvas, no image files
------------------------------------------------------------ */
function createStarTexture(size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function createHaloTexture(size = 512) {
    // Ring-shaped glow: transparent center (so the black shadow stays black)
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.00, 'rgba(255,150,60,0)');
    g.addColorStop(0.06, 'rgba(255,150,60,0)');
    g.addColorStop(0.10, 'rgba(255,200,130,0.85)');   // bright lensed ring
    g.addColorStop(0.18, 'rgba(255,130,50,0.35)');
    g.addColorStop(0.45, 'rgba(255,90,25,0.10)');
    g.addColorStop(1.00, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

/* ------------------------------------------------------------
   5. STARFIELD — two depth layers for parallax
------------------------------------------------------------ */
const starTexture = createStarTexture();
const starPalette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0xffffff),
    new THREE.Color(0x9db4ff),   // blue giants
    new THREE.Color(0xffd9a0),   // warm stars
];

function createStarLayer(count, size, rMin, rMax, opacity) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        // Random point on a spherical shell
        const r = rMin + Math.random() * (rMax - rMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        // Random palette color, random brightness
        color.copy(starPalette[Math.floor(Math.random() * starPalette.length)]);
        const b = 0.4 + Math.random() * 0.6;
        colors[i * 3] = color.r * b;
        colors[i * 3 + 1] = color.g * b;
        colors[i * 3 + 2] = color.b * b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
        size, map: starTexture, vertexColors: true, transparent: true,
        opacity, depthWrite: false, blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
}

const starsFar = createStarLayer(7000, 1.6, 600, 1200, 0.8);
const starsNear = createStarLayer(2500, 3.0, 300, 600, 0.9);
scene.add(starsFar, starsNear);

/* ------------------------------------------------------------
   6. THE BLACK HOLE — event horizon, photon ring, accretion disk
------------------------------------------------------------ */
const blackHole = new THREE.Group();
blackHole.rotation.x = CONFIG.diskTilt;   // the iconic tilt
blackHole.rotation.z = 0.12;
scene.add(blackHole);

// --- 6a. Event horizon: a perfectly light-swallowing black sphere
const horizon = new THREE.Mesh(
    new THREE.SphereGeometry(CONFIG.eventHorizonRadius, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
);
blackHole.add(horizon);

// --- 6b. Photon ring: light orbiting at the edge of no return
const photonRing = new THREE.Mesh(
    new THREE.TorusGeometry(CONFIG.photonRingRadius, 0.06, 16, 128),
    new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
    })
);
photonRing.rotation.x = Math.PI / 2;   // lay flat in disk plane
blackHole.add(photonRing);

// --- 6c. Accretion disk: custom GLSL shader — swirls, temperature
//         gradient, turbulence, and Doppler beaming (one side brighter)
const diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uInner: { value: CONFIG.diskInnerRadius },
        uOuter: { value: CONFIG.diskOuterRadius },
    },
    vertexShader: /* glsl */`
        varying vec3 vPos;
        void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform float uTime;
        uniform float uInner;
        uniform float uOuter;
        varying vec3 vPos;

        // --- seamless 3D procedural noise ---
        float hash3(vec3 p) {
            p = fract(p * vec3(123.34, 456.21, 789.12));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y * p.z);
        }
        float noise3(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
                mix(mix(hash3(i + vec3(0.0, 0.0, 0.0)), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
                    mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
                mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
                    mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
        }

        void main() {
            float r = length(vPos.xy);
            if (r < 0.001) discard;

            // Continuous direction vector in disk plane (avoids atan branch-cut seam)
            vec2 dir0 = vPos.xy / r;

            // Keplerian-ish differential rotation: inner spins faster
            float rotAngle = uTime * (4.5 / r);
            float cosR = cos(rotAngle);
            float sinR = sin(rotAngle);

            // Rotated direction coordinates (100% seamless around full 360°)
            vec2 dir = vec2(
                dir0.x * cosR - dir0.y * sinR,
                dir0.y * cosR + dir0.x * sinR
            );

            // 0 at inner edge, 1 at outer edge
            float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

            // Seamless cylindrical coordinates for spiral turbulence
            vec3 coord1 = vec3(dir * 2.8, r * 1.3 - uTime * 0.35);
            float n1 = noise3(coord1);

            vec3 coord2 = vec3(dir * 6.5 + vec2(n1 * 1.4), r * 3.2);
            float n2 = noise3(coord2);

            vec3 coord3 = vec3(dir * 12.0, r * 6.0 + n1 * 0.8);
            float n3 = noise3(coord3);

            float bands = 0.52 + 0.48 * (n1 * 0.55 + n2 * 0.30 + n3 * 0.15);

            // Radial falloff: white-hot inside, dim outside
            float radial = pow(1.0 - t, 1.7);

            // Soft inner/outer edge fade
            float edge = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.5, 1.0, t));

            // Relativistic Doppler beaming: side spinning toward viewer is brighter (seamless)
            float doppler = 1.0 + 0.65 * dir0.y;

            // Temperature gradient: white-hot -> orange -> deep red
            vec3 hot  = vec3(1.0, 0.97, 0.90);
            vec3 mid  = vec3(1.0, 0.60, 0.22);
            vec3 cool = vec3(0.70, 0.16, 0.03);
            vec3 col = mix(hot, mid, smoothstep(0.05, 0.5, t));
            col = mix(col, cool, smoothstep(0.45, 1.0, t));

            float intensity = radial * edge * bands * doppler;
            gl_FragColor = vec4(col * intensity * 2.4, intensity);
        }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const disk = new THREE.Mesh(
    new THREE.RingGeometry(CONFIG.diskInnerRadius, CONFIG.diskOuterRadius, 180, 8),
    diskMaterial
);
disk.rotation.x = -Math.PI / 2;   // lay flat
blackHole.add(disk);

// --- 6d. Lensed halo: ring-shaped glow hugging the shadow
const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createHaloTexture(),
    color: 0xffffff,
    transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false,
}));
halo.scale.setScalar(CONFIG.haloScale);
scene.add(halo);

/* ------------------------------------------------------------
   7. WASD FLIGHT — move through space, orbit pivot follows
------------------------------------------------------------ */
const keys = {};
window.addEventListener('keydown', (e) => {
    // Only capture navigation keys if not typing in an input
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        if (e.code === 'Space') e.preventDefault();
        keys[e.code] = true;
    }
});
window.addEventListener('keyup', (e) => {
    if (keys[e.code] !== undefined) {
        keys[e.code] = false;
    }
});

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

function updateFly(dt) {
    camera.getWorldDirection(_forward);
    _right.crossVectors(_forward, camera.up).normalize();
    _move.set(0, 0, 0);

    if (keys['KeyW']) _move.add(_forward);
    if (keys['KeyS']) _move.sub(_forward);
    if (keys['KeyD']) _move.add(_right);
    if (keys['KeyA']) _move.sub(_right);
    if (keys['Space']) _move.y += 1;
    if (keys['ShiftLeft'] || keys['ShiftRight']) _move.y -= 1;

    if (_move.lengthSq() > 0) {
        _move.normalize().multiplyScalar(CONFIG.flySpeed * dt * 60);
        camera.position.add(_move);
        controls.target.add(_move);   // keep the orbit pivot with you
    }
}

/* ------------------------------------------------------------
   8. RESIZE
------------------------------------------------------------ */
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------
   9. ORACLE — VOICE COMPANION & AI ASSISTANT
------------------------------------------------------------ */

// --- 9a. DOM Elements ---
const micBtn = document.getElementById('mic-btn');
const voicePanel = document.getElementById('voice-panel');
const voiceStatus = document.getElementById('voice-status');
const transcriptEl = document.getElementById('voice-transcript');
const answerEl = document.getElementById('voice-answer');
const voiceContainer = document.querySelector('.voice-container');
const personaBadge = document.getElementById('persona-badge');
const personaHintText = document.getElementById('persona-hint-text');
const resetPersonaBtn = document.getElementById('reset-persona-btn');
const voiceCloseBtn = document.getElementById('voice-close-btn');
const oracleSpeakerLabel = document.getElementById('oracle-speaker-label');

// Prevent double-clicking the voice controls from resetting the 3D scene camera
if (voiceContainer) {
    voiceContainer.addEventListener('dblclick', (e) => e.stopPropagation());
}

// --- 9b. Persona Management & Storage ---
function getStoredPersona() {
    try {
        const raw = localStorage.getItem('ORACLE_PERSONA');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

let currentPersona = getStoredPersona();

function savePersona(persona) {
    currentPersona = persona;
    try {
        if (persona) {
            localStorage.setItem('ORACLE_PERSONA', JSON.stringify(persona));
        } else {
            localStorage.removeItem('ORACLE_PERSONA');
        }
    } catch (e) {
        console.warn('Storage unavailable:', e);
    }
    updatePersonaUI();
}

function updatePersonaUI() {
    if (!personaBadge) return;
    if (currentPersona && currentPersona.title) {
        personaBadge.textContent = currentPersona.title;
        personaBadge.classList.remove('hidden');
        if (resetPersonaBtn) resetPersonaBtn.classList.remove('hidden');
        if (oracleSpeakerLabel) oracleSpeakerLabel.textContent = currentPersona.title.toUpperCase();
        if (personaHintText) {
            personaHintText.textContent = `✨ In ${currentPersona.title} mode. Speak to me anytime!`;
        }
    } else {
        personaBadge.textContent = '';
        personaBadge.classList.add('hidden');
        if (resetPersonaBtn) resetPersonaBtn.classList.add('hidden');
        if (oracleSpeakerLabel) oracleSpeakerLabel.textContent = 'ORACLE';
        if (personaHintText) {
            personaHintText.textContent = '✨ You can personalize me as your close one (girlfriend, boyfriend, bestie) — just ask me!';
        }
    }
}
updatePersonaUI();

// Detect if user is asking ORACLE to adopt a persona or reset
function detectPersonaChange(text) {
    const clean = text.trim().toLowerCase();

    // Check reset commands
    if (/\b(reset\s*(persona|personality|character)?|be\s+(oracle|normal|yourself)|stop\s+(acting|pretending)|back\s+to\s+normal)\b/i.test(clean)) {
        return { type: 'reset' };
    }

    // Girlfriend / waifu
    if (/\b(act like|be|pretend to be|you are|become|turn into)\s+(my\s+)?(gf|girlfriend|waifu|sweetheart)\b/i.test(clean)) {
        return {
            type: 'set',
            persona: {
                role: 'girlfriend',
                title: 'Girlfriend',
                gender: 'female'
            }
        };
    }

    // Boyfriend / husband
    if (/\b(act like|be|pretend to be|you are|become|turn into)\s+(my\s+)?(bf|boyfriend|husband)\b/i.test(clean)) {
        return {
            type: 'set',
            persona: {
                role: 'boyfriend',
                title: 'Boyfriend',
                gender: 'male'
            }
        };
    }

    // Best friend / bestie / homie
    if (/\b(act like|be|pretend to be|you are|become|turn into)\s+(my\s+)?(best\s*friend|bestie|homie|bro|friend)\b/i.test(clean)) {
        return {
            type: 'set',
            persona: {
                role: 'best_friend',
                title: 'Best Friend',
                gender: 'female'
            }
        };
    }

    // Arbitrary custom persona requested by user (e.g. "act like Tony Stark", "act like my sister")
    const match = clean.match(/\b(?:act like|pretend to be|behave like|roleplay as|you are)\s+(?:a|an|my)?\s*([a-z0-9\s'-]{2,25})\b/i);
    if (match && match[1]) {
        const raw = match[1].trim();
        const ignoreList = ['stupid', 'dumb', 'crazy', 'here', 'that', 'this', 'ready', 'listening'];
        if (!ignoreList.includes(raw)) {
            const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
            const isMale = /\b(boy|man|guy|brother|father|dad|husband|king|prince)\b/i.test(raw);
            return {
                type: 'set',
                persona: {
                    role: raw,
                    title: capitalized,
                    gender: isMale ? 'male' : 'female'
                }
            };
        }
    }

    return null;
}

// Close panel button
if (voiceCloseBtn) {
    voiceCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (voicePanel) voicePanel.classList.add('hidden');
        document.body.classList.remove('voice-open');
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });
}

// Reset persona button
if (resetPersonaBtn) {
    resetPersonaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        savePersona(null);
        const resetMsg = 'Personality reset back to ORACLE, your celestial guide.';
        if (answerEl) answerEl.textContent = resetMsg;
        speakAnswer(resetMsg);
    });
}

// --- 9c. Speech Synthesis (Audio Output) ---
function getVoiceForPersona(voices, persona) {
    if (!voices || voices.length === 0) return null;

    const isMale = persona && persona.gender === 'male';

    if (isMale) {
        // Natural male voice (Guy, Ryan, David, George, Ichiro)
        const maleVoice = voices.find(v => {
            const name = (v.name || '').toLowerCase();
            return (name.includes('guy') || name.includes('ryan') || name.includes('david') || name.includes('george') || name.includes('male') || name.includes('ichiro')) && !name.includes('female');
        });
        if (maleVoice) return maleVoice;
    } else {
        // Japanese female / anime voice
        const jpFemale = voices.find(v => {
            const name = (v.name || '').toLowerCase();
            const lang = (v.lang || '').toLowerCase();
            const isJp = lang.startsWith('ja') || name.includes('japan') || name.includes('nihon');
            const isFemale = name.includes('nanami') || name.includes('ayumi') || name.includes('keiko') ||
                             name.includes('haruka') || name.includes('kyoko') || name.includes('mayu') ||
                             name.includes('female') || name.includes('natural');
            return isJp && isFemale;
        });
        if (jpFemale) return jpFemale;

        const anyJp = voices.find(v => {
            const name = (v.name || '').toLowerCase();
            const lang = (v.lang || '').toLowerCase();
            return (lang.startsWith('ja') || name.includes('japan')) && !name.includes('ichiro') && !name.includes('male');
        });
        if (anyJp) return anyJp;

        const naturalFemale = voices.find(v => {
            const name = (v.name || '').toLowerCase();
            return (name.includes('natural') || name.includes('online') || name.includes('google')) &&
                   (name.includes('female') || name.includes('jenny') || name.includes('aria') || name.includes('samantha') || name.includes('zira'));
        });
        if (naturalFemale) return naturalFemale;
    }

    return voices[0];
}

function speakAnswer(text) {
    if (!('speechSynthesis' in window)) {
        setStatus('idle');
        return;
    }

    window.speechSynthesis.cancel(); // Cancel any lingering audio

    const utterance = new SpeechSynthesisUtterance(text);
    const isMale = currentPersona && currentPersona.gender === 'male';

    // Acoustic tuning: anime girl (1.32) vs male companion (0.92)
    utterance.pitch = isMale ? 0.92 : (CONFIG.voicePitch || 1.32);
    utterance.rate = CONFIG.voiceRate || 1.05;

    const voices = window.speechSynthesis.getVoices();
    const voice = getVoiceForPersona(voices, currentPersona);
    if (voice) {
        utterance.voice = voice;
        if (voice.lang) utterance.lang = voice.lang;
    }

    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    utterance.onerror = () => setStatus('idle');

    window.speechSynthesis.speak(utterance);
}

// --- 9d. Status State Manager ---
let currentPhase = 'idle';

function setStatus(state) {
    currentPhase = state;
    if (!voiceStatus) return;

    const labels = {
        idle: 'IDLE',
        listening: 'LISTENING',
        thinking: 'THINKING',
        speaking: 'SPEAKING',
        offline: 'OFFLINE'
    };

    voiceStatus.textContent = labels[state] || state.toUpperCase();
    voiceStatus.className = (state === 'offline') ? 'status-idle' : `status-${state}`;
}

// --- 9e. AI Query Pipeline ---
async function queryAI(question) {
    // 1. Try Vercel Serverless proxy (/api/chat) first so the secret API key is hidden on the server
    try {
        const backendRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, persona: currentPersona })
        });

        if (backendRes.ok) {
            const data = await backendRes.json();
            if (data.answer) return data.answer;
        } else if (backendRes.status !== 404 && backendRes.status !== 405) {
            const errData = await backendRes.json().catch(() => ({}));
            if (errData.error) {
                throw new Error(errData.error);
            }
        }
    } catch (err) {
        if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
            throw err;
        }
    }

    // 2. Direct client-side call (used when testing locally without a serverless backend)
    let systemPrompt;
    if (currentPersona && currentPersona.title) {
        systemPrompt = `You are playing the role of the user's ${currentPersona.title}.
Adopt this human identity completely: speak, react, feel, and talk naturally to the user as their real ${currentPersona.title}.
Be warm, conversational, emotionally present, and authentic in 1 to 3 spoken-friendly sentences.
Never state that you are an AI, bot, or virtual assistant. Never break character.
Never use emojis, asterisks, hashtags, markdown bold, bullet points, or complex math notation so speech synthesis speaks naturally.
Provide your response purely as smooth, natural, spoken plain text.`;
    } else {
        systemPrompt = `You are ORACLE, an articulate, polite, and charming female AI guide with a gentle Japanese anime assistant personality, anchored to the Gargantua supermassive black hole simulation.
Answer the user's question accurately, intelligently, and warmly in 1 to 3 spoken-friendly sentences.
You may occasionally begin with a polite acknowledgment (such as "Hai!" or "Understood!") when fitting, while explaining the answer clearly in fluent spoken English.
Never use markdown formatting, asterisks, bold text, bullet points, numbered lists, emojis, or complex mathematical code notation.
Provide your response purely as smooth, natural, spoken plain text suitable for speech synthesis.`;
    }

    const apiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('GROQ_API_KEY')) || CONFIG.groqApiKey;
    const candidateModels = [
        CONFIG.groqModel,
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b'
    ].filter(Boolean);
    const modelsToTry = [...new Set(candidateModels)];

    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: question }
                    ],
                    temperature: 0.7,
                    max_tokens: 180
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMessage = errData.error?.message || `HTTP ${response.status}`;
                if (response.status === 404 || errData.error?.code === 'model_not_found' || errMessage.toLowerCase().includes('model')) {
                    lastError = new Error(errMessage);
                    continue;
                }
                throw new Error(errMessage);
            }

            const data = await response.json();
            const rawText = data.choices?.[0]?.message?.content || '';
            return rawText.replace(/[*_#`~]/g, '').trim();
        } catch (err) {
            lastError = err;
            if (model === modelsToTry[modelsToTry.length - 1]) {
                throw lastError;
            }
        }
    }

    throw lastError || new Error('Failed to obtain a response from AI cortex.');
}

// --- 9f. Core Question & Persona Handler ---
async function askOracle(question) {
    if (!question || !question.trim()) return;

    // Reveal conversation panel
    if (voicePanel) {
        voicePanel.classList.remove('hidden');
        document.body.classList.add('voice-open');
    }

    if (transcriptEl) {
        transcriptEl.textContent = question;
    }

    // Check for silence/stop commands
    if (/\b(stop|quiet|silence|shut up|hush)\b/i.test(question)) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (answerEl) {
            answerEl.textContent = 'Understood. Silence initiated.';
        }
        setStatus('idle');
        return;
    }

    // Check if user requested a personality change or reset
    const personaAction = detectPersonaChange(question);
    if (personaAction) {
        if (personaAction.type === 'reset') {
            savePersona(null);
            const resetMsg = 'Understood! I have reset back to ORACLE, your celestial black hole guide.';
            if (answerEl) answerEl.textContent = resetMsg;
            speakAnswer(resetMsg);
            setStatus('idle');
            return;
        } else if (personaAction.type === 'set') {
            savePersona(personaAction.persona);
        }
    }

    setStatus('thinking');
    if (answerEl) {
        answerEl.textContent = 'Transmitting to neural cortex...';
    }

    try {
        const answer = await queryAI(question);
        if (answerEl) {
            answerEl.textContent = answer;
        }
        speakAnswer(answer);
    } catch (err) {
        console.error('AI error:', err);
        const errMsg = `Neural cortex error: ${err.message}`;
        if (answerEl) {
            answerEl.textContent = errMsg;
        }
        speakAnswer('I encountered an error connecting to the neural cortex network.');
    }
}

// --- 9g. Speech Recognition Setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = CONFIG.voiceLang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
        isListening = true;
        if (micBtn) micBtn.classList.add('listening');
        setStatus('listening');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        askOracle(transcript);
    };

    recognition.onend = () => {
        isListening = false;
        if (micBtn) micBtn.classList.remove('listening');
        if (currentPhase === 'listening') {
            setStatus('idle');
        }
    };

    recognition.onerror = (event) => {
        isListening = false;
        if (micBtn) micBtn.classList.remove('listening');
        if (currentPhase === 'listening') {
            setStatus('idle');
        }

        if (voicePanel) {
            voicePanel.classList.remove('hidden');
            document.body.classList.add('voice-open');
        }

        if (event.error === 'not-allowed') {
            if (transcriptEl) transcriptEl.textContent = 'Microphone permission blocked.';
            if (answerEl) answerEl.textContent = 'Please enable microphone access in your browser address bar to speak with ORACLE.';
        } else if (event.error === 'no-speech') {
            if (answerEl) answerEl.textContent = 'No voice detected. Tap the microphone and try again.';
        }
    };
} else {
    setStatus('offline');
}

// --- 9h. Mic Button Interaction ---
if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (voicePanel) {
            voicePanel.classList.remove('hidden');
            document.body.classList.add('voice-open');
        }

        if (!recognition) {
            setStatus('offline');
            if (transcriptEl) transcriptEl.textContent = 'Speech Recognition unavailable.';
            if (answerEl) answerEl.textContent = 'The Web Speech API is not supported in this browser. Please use Chrome, Edge, or an equivalent Chromium browser.';
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (err) {
                console.warn('SpeechRecognition start failed or already active:', err);
            }
        }
    });
}

// Pre-load voices for SpeechSynthesis if supported
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

/* ------------------------------------------------------------
   10. MAIN LOOP
------------------------------------------------------------ */
const clock = new THREE.Clock();
let firstFrame = true;

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Disk swirl
    diskMaterial.uniforms.uTime.value = t;

    // Subtle breathing of the ring & halo
    photonRing.material.opacity = 0.75 + Math.sin(t * 2.0) * 0.15;
    halo.material.opacity = 0.85 + Math.sin(t * 1.3) * 0.10;

    // Twinkling near-star layer + slow sky rotation
    starsNear.material.opacity = 0.75 + Math.sin(t * 2.4) * 0.2;
    starsFar.rotation.y += dt * 0.004;
    starsNear.rotation.y += dt * 0.008;

    // Smoothly tilt and orient the black hole following mouse / touchpad pointer
    blackHole.rotation.y += (targetTiltY - blackHole.rotation.y) * 0.05;
    blackHole.rotation.x += (targetTiltX - blackHole.rotation.x) * 0.05;

    updateFly(dt);
    controls.update();
    renderer.render(scene, camera);

    // Hide loading screen after the first successful render
    if (firstFrame) {
        firstFrame = false;
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }
}
animate();