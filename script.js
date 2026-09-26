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
const voiceContainer = document.querySelector('.voice-container');
const personaBadge = document.getElementById('persona-badge');
const personaHintText = document.getElementById('persona-hint-text');
const resetPersonaBtn = document.getElementById('reset-persona-btn');
const voiceCloseBtn = document.getElementById('voice-close-btn');
const voicePauseBtn = document.getElementById('voice-pause-btn');
const voiceClearBtn = document.getElementById('voice-clear-btn');
const oracleHelpBtn = document.getElementById('oracle-help-btn');
const oracleGuideModal = document.getElementById('oracle-guide-modal');
const guideCloseBtn = document.getElementById('guide-close-btn');
const hardClearBtn = document.getElementById('hard-clear-btn');
const testBfVoiceBtn = document.getElementById('test-bf-voice-btn');
const testGfVoiceBtn = document.getElementById('test-gf-voice-btn');
const testMommyVoiceBtn = document.getElementById('test-mommy-voice-btn');
const testIndianVoiceBtn = document.getElementById('test-indian-voice-btn');
const voiceInfoLabel = document.getElementById('voice-info-label');
const cycleMaleVoiceBtn = document.getElementById('cycle-male-voice-btn');
const expirationToast = document.getElementById('expiration-toast');
const voiceMessages = document.getElementById('voice-messages');

// Prevent double-clicking the voice controls from resetting the 3D scene camera
if (voiceContainer) {
    voiceContainer.addEventListener('dblclick', (e) => e.stopPropagation());
}

// Helper: Escape HTML to prevent injection in message bubbles
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- 9b. Memory & Storage Engine ---
// Persona (never wiped by 10-min expiration or clear chat)
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
        if (personaHintText) {
            personaHintText.textContent = `✨ In ${currentPersona.title} mode. Speak to me anytime!`;
        }
    } else {
        personaBadge.textContent = '';
        personaBadge.classList.add('hidden');
        if (resetPersonaBtn) resetPersonaBtn.classList.add('hidden');
        if (personaHintText) {
            personaHintText.textContent = '✨ You can personalize me as your close one (girlfriend, boyfriend, bestie) — just ask me!';
        }
    }
}
updatePersonaUI();

// User Profile (name & close details — never wiped by 10-min expiration or clear chat)
function getStoredUserProfile() {
    try {
        const raw = localStorage.getItem('ORACLE_USER_PROFILE');
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveUserProfile(profile) {
    try {
        if (profile && Object.keys(profile).length > 0) {
            localStorage.setItem('ORACLE_USER_PROFILE', JSON.stringify(profile));
        } else {
            localStorage.removeItem('ORACLE_USER_PROFILE');
        }
    } catch (e) {
        console.warn('Storage unavailable:', e);
    }
}

// Extract user name from conversational inputs (e.g., "my name is Alex", "call me Maya", "I am Daniel")
function detectUserProfile(text) {
    if (!text) return null;
    const clean = text.trim();
    const nameMatch = clean.match(/\b(?:my\s+name\s+is|i\s+am|i'm|call\s+me|this\s+is)\s+([A-Z][a-zA-Z0-9_-]{1,15}|[a-zA-Z]{2,15})\b/i);
    if (nameMatch && nameMatch[1]) {
        const candidate = nameMatch[1].trim();
        const blacklist = [
            'here', 'speaking', 'ready', 'talking', 'listening', 'fine', 'good',
            'happy', 'sad', 'tired', 'sorry', 'okay', 'back', 'bored', 'hungry',
            'curious', 'leaving', 'going', 'not', 'no', 'yes', 'sure', 'home',
            'alone', 'human', 'boy', 'girl', 'friend', 'user', 'asking'
        ];
        if (!blacklist.includes(candidate.toLowerCase())) {
            const formattedName = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
            return { name: formattedName };
        }
    }
    return null;
}

// Conversation Dialogue History (cleared after 10 minutes of inactivity or by Clear button)
const CHAT_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getStoredHistory() {
    try {
        const raw = localStorage.getItem('ORACLE_CHAT_HISTORY');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveHistory(history) {
    try {
        localStorage.setItem('ORACLE_CHAT_HISTORY', JSON.stringify(history));
        localStorage.setItem('ORACLE_LAST_ACTIVE', String(Date.now()));
    } catch (e) {
        console.warn('Could not save chat history:', e);
    }
}

function clearChatHistory() {
    try {
        localStorage.removeItem('ORACLE_CHAT_HISTORY');
        localStorage.removeItem('ORACLE_LAST_ACTIVE');
    } catch (e) {
        console.warn('Could not clear chat history:', e);
    }
}

// Romantic 10-Minute Expiration Toast (Disappears after exactly 3 seconds)
let toastTimeout = null;
function showRomanticExpirationToast() {
    if (!expirationToast) return;
    if (toastTimeout) clearTimeout(toastTimeout);

    expirationToast.textContent = '✨ Now I can only remember you for 10 minutes, but I will be reborn for you, my darling.';
    expirationToast.classList.remove('hidden', 'fade-out');

    if (voicePanel && voicePanel.classList.contains('hidden')) {
        voicePanel.classList.remove('hidden');
        document.body.classList.add('voice-open');
    }

    toastTimeout = setTimeout(() => {
        expirationToast.classList.add('fade-out');
        setTimeout(() => {
            expirationToast.classList.add('hidden');
            expirationToast.classList.remove('fade-out');
        }, 500);
    }, 3000);
}

// Check if 10 minutes of inactivity have passed
function checkChatExpiration() {
    try {
        const lastActiveStr = localStorage.getItem('ORACLE_LAST_ACTIVE');
        const historyStr = localStorage.getItem('ORACLE_CHAT_HISTORY');
        if (!lastActiveStr || !historyStr) return;

        const lastActive = parseInt(lastActiveStr, 10);
        if (isNaN(lastActive)) return;

        const elapsed = Date.now() - lastActive;
        if (elapsed >= CHAT_EXPIRY_MS) {
            const history = JSON.parse(historyStr);
            if (Array.isArray(history) && history.length > 0) {
                // Clear ONLY chat history & timestamp — Persona and User details remain intact!
                clearChatHistory();
                renderChatUI();
                showRomanticExpirationToast();
            }
        }
    } catch (e) {
        console.warn('Chat expiration check failed:', e);
    }
}

// Run expiration check on load and every 5 seconds
checkChatExpiration();
setInterval(checkChatExpiration, 5000);

// --- 9c. Scrollable Conversation UI Rendering ---
function renderChatUI() {
    if (!voiceMessages) return;
    const history = getStoredHistory();
    const speakerName = (currentPersona && currentPersona.title) ? currentPersona.title.toUpperCase() : 'ORACLE';

    if (!history || history.length === 0) {
        voiceMessages.innerHTML = `
            <div class="voice-row user-row">
                <span class="voice-name">YOU</span>
                <p id="voice-transcript">Tap the mic and speak to me...</p>
            </div>
            <div class="voice-row oracle-row">
                <span class="voice-name" id="oracle-speaker-label">${escapeHtml(speakerName)}</span>
                <p id="voice-answer">Hai! I am ORACLE, your celestial companion. Ask me anything, or tell me who you'd like me to become for you!</p>
            </div>
        `;
        return;
    }

    let html = '';
    history.forEach((msg, idx) => {
        const isLast = idx === history.length - 1;
        if (msg.role === 'user') {
            html += `
                <div class="voice-row user-row">
                    <span class="voice-name">YOU</span>
                    <p ${isLast ? 'id="voice-transcript"' : ''}>${escapeHtml(msg.content)}</p>
                </div>
            `;
        } else {
            html += `
                <div class="voice-row oracle-row">
                    <span class="voice-name">${escapeHtml(msg.speaker || speakerName)}</span>
                    <p ${isLast ? 'id="voice-answer"' : ''}>${escapeHtml(msg.content)}</p>
                </div>
            `;
        }
    });

    voiceMessages.innerHTML = html;
    voiceMessages.scrollTop = voiceMessages.scrollHeight;
}
renderChatUI();

// Detect persona changes from spoken or typed input
function detectPersonaChange(text) {
    const clean = text.trim().toLowerCase();

    // Check reset commands
    if (/\b(reset|stop\s+(acting|pretending)|be\s+(yourself|oracle|normal)|back\s+to\s+normal|default)\b/i.test(clean)) {
        return { type: 'reset' };
    }

    // Boyfriend detection: any combination of bf/boyfriend/husband/hubby with role context
    const isBfWord = /\b(bf|boyfriend|husband|hubby|bae|boo)\b/i.test(clean);
    const hasRoleContext = /\b(act|as|like|be|become|pretend|play|treat|role|you|my|can|will|want|would)\b/i.test(clean);
    if (isBfWord && (hasRoleContext || clean.length < 30)) {
        return {
            type: 'set',
            persona: {
                role: 'boyfriend',
                title: 'Boyfriend',
                gender: 'male',
                accent: 'american_boy'
            }
        };
    }

    // Muscle Mommy detection
    const isMuscleMommy = /\b(muscle\s*mommy|mommy|strong\s*(girl|woman|gf|girlfriend)|dommy|tomboy)\b/i.test(clean);
    if (isMuscleMommy) {
        return {
            type: 'set',
            persona: {
                role: 'muscle_mommy',
                title: 'Muscle Mommy',
                gender: 'female',
                voiceType: 'muscle_mommy'
            }
        };
    }

    // Cute Indian Girl / Desi Girlfriend detection
    const isIndianGf = /\b(indian\s*(girl|girlfriend|gf|bhabhi|woman)|desi\s*(girl|girlfriend|gf)|delhi\s*girl|mumbai\s*girl|punjabi\s*girl)\b/i.test(clean);
    if (isIndianGf) {
        return {
            type: 'set',
            persona: {
                role: 'indian_girlfriend',
                title: 'Desi Girlfriend',
                gender: 'female',
                voiceType: 'indian'
            }
        };
    }

    // Japanese Anime Waifu / Girlfriend detection
    const isGfWord = /\b(gf|girlfriend|wife|waifu|sweetheart|anime\s*(girl|waifu)|japanese\s*(girl|girlfriend|waifu))\b/i.test(clean);
    if (isGfWord && (hasRoleContext || clean.length < 35)) {
        return {
            type: 'set',
            persona: {
                role: 'japanese_girlfriend',
                title: 'Waifu',
                gender: 'female',
                accent: 'anime_girl'
            }
        };
    }

    // Best friend detection
    const isBestie = /\b(best\s*friend|bestie|homie|bro|brother|friend)\b/i.test(clean);
    if (isBestie && (hasRoleContext || clean.length < 30)) {
        return {
            type: 'set',
            persona: {
                role: 'best_friend',
                title: 'Best Friend',
                gender: 'female',
                accent: 'friendly'
            }
        };
    }

    // Arbitrary custom persona: "act as / act like / pretend to be [name]"
    const match = clean.match(/\b(?:act\s+(?:as\s+)?(?:like\s+)?|pretend\s+(?:to\s+be\s+)?|be\s+(?:like\s+)?|play\s+(?:as\s+)?|roleplay\s+(?:as\s+)?|behave\s+(?:like\s+)?)\s*(?:a|an|my)?\s*([a-z0-9\s'-]{2,25})\b/i);
    if (match && match[1]) {
        const raw = match[1].trim();
        const ignoreList = ['stupid', 'dumb', 'crazy', 'here', 'that', 'this', 'ready', 'listening', 'ai', 'bot'];
        if (!ignoreList.includes(raw)) {
            const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
            const isMale = /\b(boy|man|guy|brother|father|dad|husband|king|prince|bf|boyfriend)\b/i.test(raw);
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

// Stop speaking function (pauses / cancels TTS and hides pause button)
function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    setStatus('idle');
    if (voicePauseBtn) {
        voicePauseBtn.classList.add('hidden');
    }
}

// Pause / Stop speaking button listener
if (voicePauseBtn) {
    voicePauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopSpeaking();
    });
}

// Clear conversation memory button listener
if (voiceClearBtn) {
    voiceClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopSpeaking();
        // Clear chat history & timestamp — Persona and User details remain intact!
        clearChatHistory();
        renderChatUI();
    });
}

// Close panel button
if (voiceCloseBtn) {
    voiceCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (voicePanel) voicePanel.classList.add('hidden');
        if (oracleGuideModal) oracleGuideModal.classList.add('hidden');
        document.body.classList.remove('voice-open');
        stopSpeaking();
    });
}

// Reset persona button
if (resetPersonaBtn) {
    resetPersonaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        savePersona(null);
        const resetMsg = 'Personality reset back to ORACLE, your celestial guide.';
        renderChatUI();
        speakAnswer(resetMsg);
    });
}

// Oracle Guide & Privacy Modal controls ('?' button)
if (oracleHelpBtn && oracleGuideModal) {
    oracleHelpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        oracleGuideModal.classList.toggle('hidden');
        if (!oracleGuideModal.classList.contains('hidden')) {
            refreshVoiceDiagnosticUI();
        }
    });
}

if (guideCloseBtn && oracleGuideModal) {
    guideCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        oracleGuideModal.classList.add('hidden');
    });
}

if (oracleGuideModal) {
    oracleGuideModal.addEventListener('click', (e) => {
        e.stopPropagation();
        const chip = e.target.closest('.guide-chip');
        if (chip) {
            const cmd = chip.getAttribute('data-cmd');
            if (cmd) {
                oracleGuideModal.classList.add('hidden');
                askOracle(cmd);
            }
        }
    });
    oracleGuideModal.addEventListener('dblclick', (e) => e.stopPropagation());
}

// Test Boyfriend Voice Button
if (testBfVoiceBtn) {
    testBfVoiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const original = currentPersona;
        currentPersona = { gender: 'male', role: 'boyfriend', title: 'Boyfriend' };
        refreshVoiceDiagnosticUI('Boyfriend');
        speakAnswer('Hey babe, I am right here for you. You look so handsome today, how does my voice sound?');
        currentPersona = original;
    });
}

// Test Japanese Waifu Voice Button
if (testGfVoiceBtn) {
    testGfVoiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const original = currentPersona;
        currentPersona = { gender: 'female', role: 'japanese_girlfriend', title: 'Waifu' };
        refreshVoiceDiagnosticUI('Japanese Waifu');
        speakAnswer('Hai anata! Daisuki! I am your cute anime waifu, always right by your side!');
        currentPersona = original;
    });
}

// Test Muscle Mommy Voice Button
if (testMommyVoiceBtn) {
    testMommyVoiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const original = currentPersona;
        currentPersona = { gender: 'female', role: 'muscle_mommy', title: 'Muscle Mommy' };
        refreshVoiceDiagnosticUI('Muscle Mommy');
        speakAnswer('Hey little one. Come here, let your muscle mommy hold you close and keep you safe.');
        currentPersona = original;
    });
}

// Test Indian Girl Voice Button
if (testIndianVoiceBtn) {
    testIndianVoiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const original = currentPersona;
        currentPersona = { gender: 'female', role: 'indian_girlfriend', title: 'Desi Girlfriend' };
        refreshVoiceDiagnosticUI('Indian Girl');
        speakAnswer('Arre jaan, look at you! Have you eaten anything yet? I was missing you so much.');
        currentPersona = original;
    });
}

// Cycle Male Voice Button (switches between available male voices on this phone)
if (cycleMaleVoiceBtn) {
    cycleMaleVoiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const voices = window.speechSynthesis.getVoices();
        const availableMales = getAllMaleVoices(voices);
        if (availableMales.length <= 1) return;

        let currentIndex = availableMales.findIndex(v => v.voiceURI === userSelectedMaleVoiceURI);
        if (currentIndex === -1) {
            const activeResult = getVoiceForPersona(voices, { gender: 'male' });
            currentIndex = availableMales.indexOf(activeResult?.voice);
        }

        const nextIndex = (currentIndex + 1) % availableMales.length;
        const nextVoice = availableMales[nextIndex];
        userSelectedMaleVoiceURI = nextVoice.voiceURI;
        try {
            localStorage.setItem('ORACLE_MALE_VOICE_URI', userSelectedMaleVoiceURI);
        } catch (err) {}

        refreshVoiceDiagnosticUI('Boyfriend');
        const original = currentPersona;
        currentPersona = { gender: 'male', role: 'boyfriend', title: 'Boyfriend' };
        speakAnswer('Switched to next male voice. I am right here babe, how does this one sound?');
        currentPersona = original;
    });
}

// Hard Clear & Total Rebirth button
if (hardClearBtn) {
    hardClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopSpeaking();
        // 1. Wipe dialogue history & timestamps
        clearChatHistory();
        // 2. Wipe active persona
        savePersona(null);
        // 3. Wipe user profile & stored names
        saveUserProfile({});
        try {
            localStorage.removeItem('ORACLE_USER_PROFILE');
            localStorage.removeItem('ORACLE_MALE_VOICE_URI');
            userSelectedMaleVoiceURI = null;
        } catch (err) {
            console.warn('Storage clear error:', err);
        }
        // 4. Update UI to pristine default
        renderChatUI();
        updatePersonaUI();
        if (oracleGuideModal) {
            oracleGuideModal.classList.add('hidden');
        }
        // 5. Toast notification of total amnesia & rebirth
        if (expirationToast) {
            expirationToast.textContent = '⚡ Total memory wiped clean. I am ready to be reborn as your man or woman whenever you command.';
            expirationToast.classList.remove('hidden', 'fade-out');
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                expirationToast.classList.add('fade-out');
                setTimeout(() => {
                    expirationToast.classList.add('hidden');
                    expirationToast.classList.remove('fade-out');
                }, 500);
            }, 4000);
        }
        speakAnswer('All memories have dissolved. I am ready to be reborn as anyone you desire.');
    });
}

// --- 9d. Speech Synthesis (Audio Output) & Voice Matching Engine ---
// Female keywords in name or voiceURI
const FEMALE_VOICE_BLACKLIST = [
    'female', 'woman', 'girl', 'femme', 'donna',
    'sfg', 'tpb', 'tpc', 'iog', // Google Android US female models
    'ahd', 'ene',                // Google Android India female models
    'fis', 'gba', 'gbe',        // Google Android UK female models
    'zira', 'samantha', 'victoria', 'jenny', 'aria', 'katherine',
    'linda', 'susan', 'karen', 'moira', 'fiona', 'tessa', 'veena',
    'leena', 'sangeeta', 'heera', 'kalpana', 'ananya',
    'en_us_female', 'en_gb_female', 'en_in_female'
];

function isIdentifiedFemale(voice) {
    if (!voice) return false;
    const str = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    return FEMALE_VOICE_BLACKLIST.some(kw => str.includes(kw));
}

// Male keywords & models in name or voiceURI
const MALE_VOICE_PATTERNS = [
    // Standard male names
    'guy', 'christopher', 'ryan', 'david', 'aaron', 'alex', 'daniel', 'fred',
    'arthur', 'nathan', 'mark', 'james', 'george', 'rishi', 'prabhat', 'richard',
    'oliver', 'thomas', 'william', 'jack', 'harry', 'noah', 'jacob', 'charlie',
    // Android Google TTS Male Model codes (present in voiceURI or name!)
    'iom', 'iol', 'iob', 'tpd', 'gda', // US male
    'cda', 'end', 'efa',                // India male
    'rjs', 'gbb',                       // UK male
    // Explicit keywords & Samsung / iOS
    '#male', '_male', '-male', ' male', 'en_us_male', 'en_gb_male', 'en_in_male',
    'siri voice 2', 'siri voice 3', 'siri voice 4'
];

function isIdentifiedMale(voice) {
    if (!voice) return false;
    if (isIdentifiedFemale(voice)) return false;
    const str = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    return MALE_VOICE_PATTERNS.some(kw => str.includes(kw));
}

let userSelectedMaleVoiceURI = null;
try {
    userSelectedMaleVoiceURI = localStorage.getItem('ORACLE_MALE_VOICE_URI') || null;
} catch (e) {}

function getAllMaleVoices(voices) {
    if (!voices || voices.length === 0) return [];
    const isEn = (v) => (v.lang || '').toLowerCase().startsWith('en');

    // 1. Confirmed male English voices (inspecting BOTH name and voiceURI!)
    const confirmedEn = voices.filter(v => isEn(v) && isIdentifiedMale(v));
    if (confirmedEn.length > 0) return confirmedEn;

    // 2. Confirmed male voices in any language
    const anyConfirmed = voices.filter(v => isIdentifiedMale(v));
    if (anyConfirmed.length > 0) return anyConfirmed;

    // 3. Fallback: English voices that are NOT identified as female
    const nonFemaleEn = voices.filter(v => isEn(v) && !isIdentifiedFemale(v));
    if (nonFemaleEn.length > 0) return nonFemaleEn;

    return [];
}

function getVoiceForPersona(voices, persona) {
    if (!voices || voices.length === 0) return null;

    const role = persona?.role || '';
    const isMale = persona && persona.gender === 'male';

    if (isMale || role === 'boyfriend') {
        const availableMales = getAllMaleVoices(voices);

        // If user manually chose a voice, use it
        if (userSelectedMaleVoiceURI) {
            const foundUserVoice = availableMales.find(v => v.voiceURI === userSelectedMaleVoiceURI);
            if (foundUserVoice) {
                return { voice: foundUserVoice, isExplicitMale: isIdentifiedMale(foundUserVoice) };
            }
        }

        if (availableMales.length > 0) {
            // Prefer US English if available
            const usMale = availableMales.find(v => {
                const l = (v.lang || '').toLowerCase();
                return l.includes('en-us') || l.includes('en_us');
            });
            const picked = usMale || availableMales[0];
            return { voice: picked, isExplicitMale: isIdentifiedMale(picked) };
        }

        const fallback = voices.find(v => !isIdentifiedFemale(v)) || voices[0];
        return { voice: fallback, isExplicitMale: false };
    } else if (role === 'indian_girlfriend') {
        // Specifically prioritize Indian English / Hindi female voices!
        const isIndianVoice = (v) => {
            const l = (v.lang || '').toLowerCase();
            const str = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
            const hasIndianLocale = l.includes('en-in') || l.includes('en_in') || l.startsWith('hi');
            const hasIndianName = str.includes('india') || str.includes('hindi') || str.includes('heera') ||
                                  str.includes('veena') || str.includes('neerja') || str.includes('kavya') ||
                                  str.includes('kalyani') || str.includes('ahd') || str.includes('ene');
            const isNotMale = !isIdentifiedMale(v) && !str.includes('cda');
            return (hasIndianLocale || hasIndianName) && isNotMale;
        };

        const indianVoice = voices.find(isIndianVoice);
        if (indianVoice) return { voice: indianVoice, isExplicitMale: false, isIndian: true };

        // Fallback: sweet female voice
        const fallback = voices.find(v => isIdentifiedFemale(v)) || voices[0];
        return { voice: fallback, isExplicitMale: false, isIndian: false };
    } else if (role === 'muscle_mommy') {
        // Mature, deeper, smooth English female voice
        const isEnglish = (v) => (v.lang || '').toLowerCase().startsWith('en');
        const enFemale = voices.find(v => {
            if (!isEnglish(v)) return false;
            const str = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
            return isIdentifiedFemale(v) && (str.includes('natural') || str.includes('online') || str.includes('samantha') || str.includes('zira') || str.includes('victoria') || str.includes('sfg'));
        });
        if (enFemale) return { voice: enFemale, isExplicitMale: false, isMommy: true };

        const anyEn = voices.find(isEnglish) || voices[0];
        return { voice: anyEn, isExplicitMale: false, isMommy: true };
    } else {
        // Japanese female / anime waifu voice
        const isJp = (v) => {
            const l = (v.lang || '').toLowerCase();
            const n = (v.name || '').toLowerCase();
            return l.startsWith('ja') || n.includes('japan') || n.includes('nihon');
        };

        const jpVoices = voices.filter(isJp);
        const jpFemale = jpVoices.find(v => {
            const str = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
            return !str.includes('ichiro') && !str.includes('male') && !str.includes('keita');
        });
        if (jpFemale) return { voice: jpFemale, isExplicitMale: false, isWaifu: true };

        const naturalFemale = voices.find(v => {
            const str = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
            return isIdentifiedFemale(v) && (str.includes('natural') || str.includes('online') || str.includes('google') || str.includes('samantha') || str.includes('aria') || str.includes('jenny'));
        });
        if (naturalFemale) return { voice: naturalFemale, isExplicitMale: false, isWaifu: true };

        const anyFemale = voices.find(v => isIdentifiedFemale(v));
        if (anyFemale) return { voice: anyFemale, isExplicitMale: false, isWaifu: true };

        return { voice: voices[0], isExplicitMale: false, isWaifu: true };
    }
}

function refreshVoiceDiagnosticUI(testedRole) {
    if (!voiceInfoLabel) return;
    if (!('speechSynthesis' in window)) {
        voiceInfoLabel.textContent = 'Speech synthesis not supported in this browser.';
        return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
        voiceInfoLabel.textContent = 'Loading voices from device...';
        return;
    }

    const activeRole = testedRole || currentPersona?.title || (currentPersona?.gender === 'male' ? 'Boyfriend' : 'ORACLE');

    if (activeRole === 'Boyfriend') {
        const availableMales = getAllMaleVoices(voices);
        const maleResult = getVoiceForPersona(voices, { gender: 'male', role: 'boyfriend' });
        const activeMale = maleResult?.voice;

        if (activeMale && maleResult.isExplicitMale) {
            const cleanName = activeMale.name || 'Male Voice';
            const cleanId = (activeMale.voiceURI || '').replace(/^com\.(google\.android|apple|samsung)\.[^:]*:?/, '');
            voiceInfoLabel.textContent = `✨ Boyfriend: ${cleanName} (${cleanId || activeMale.lang})`;
            if (cycleMaleVoiceBtn) {
                if (availableMales.length > 1) {
                    cycleMaleVoiceBtn.classList.remove('hidden');
                    cycleMaleVoiceBtn.textContent = `🔄 Switch (${availableMales.length} available)`;
                } else {
                    cycleMaleVoiceBtn.classList.add('hidden');
                }
            }
        } else {
            voiceInfoLabel.textContent = `⚠️ No native male voice found. Tip: In Android Settings → Text-to-speech output → Install voice data, download a male voice.`;
            if (cycleMaleVoiceBtn) cycleMaleVoiceBtn.classList.add('hidden');
        }
    } else if (activeRole === 'Indian Girl' || activeRole === 'Desi Girlfriend' || currentPersona?.role === 'indian_girlfriend') {
        const indianResult = getVoiceForPersona(voices, { role: 'indian_girlfriend' });
        const v = indianResult?.voice;
        const name = v?.name || 'Indian Voice';
        voiceInfoLabel.textContent = `🪔 Desi Girlfriend: ${name} (${v?.lang || 'en-IN'}) — Sweet & Melodious`;
        if (cycleMaleVoiceBtn) cycleMaleVoiceBtn.classList.add('hidden');
    } else if (activeRole === 'Muscle Mommy' || currentPersona?.role === 'muscle_mommy') {
        const mommyResult = getVoiceForPersona(voices, { role: 'muscle_mommy' });
        const v = mommyResult?.voice;
        const name = v?.name || 'Mommy Voice';
        voiceInfoLabel.textContent = `💪 Muscle Mommy: ${name} — Deep, Husky & Alluring`;
        if (cycleMaleVoiceBtn) cycleMaleVoiceBtn.classList.add('hidden');
    } else {
        const gfResult = getVoiceForPersona(voices, { role: 'japanese_girlfriend' });
        const v = gfResult?.voice;
        const name = v?.name || 'Waifu Voice';
        voiceInfoLabel.textContent = `🌸 Anime Waifu: ${name} — Kawaii & Sweet`;
        if (cycleMaleVoiceBtn) cycleMaleVoiceBtn.classList.add('hidden');
    }
}

function speakAnswer(text) {
    if (!('speechSynthesis' in window)) {
        setStatus('idle');
        return;
    }

    // Cancel lingering speech only if actively talking
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
    }

    const voices = window.speechSynthesis.getVoices();
    const voiceResult = getVoiceForPersona(voices, currentPersona);
    const chosenVoice = voiceResult?.voice || null;
    const isExplicitMale = voiceResult?.isExplicitMale || false;

    const utterance = new SpeechSynthesisUtterance(text);

    let targetPitch = 1.0;
    let targetRate = 1.0;

    if (currentPersona?.role === 'boyfriend' || currentPersona?.gender === 'male') {
        targetPitch = isExplicitMale ? 0.92 : 0.74;
        targetRate = 0.98;
    } else if (currentPersona?.role === 'muscle_mommy') {
        // Muscle Mommy: deep, husky, magnetic, commanding, steady pace
        targetPitch = 0.84;
        targetRate = 0.94;
    } else if (currentPersona?.role === 'indian_girlfriend') {
        // Cute Indian Girl: melodious, sweet, expressive, radiant
        targetPitch = 1.12;
        targetRate = 1.02;
    } else if (currentPersona?.role === 'japanese_girlfriend' || currentPersona?.role === 'girlfriend') {
        // Japanese anime waifu: kawaii, bright, sweet, melodic
        targetPitch = 1.34;
        targetRate = 1.04;
    } else {
        // Celestial ORACLE default
        targetPitch = CONFIG.voicePitch || 1.25;
        targetRate = CONFIG.voiceRate || 1.02;
    }

    utterance.pitch = targetPitch;
    utterance.rate = targetRate;

    // CRITICAL FOR MOBILE: Always keep utterance.lang aligned with chosen voice's lang
    if (chosenVoice) {
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang || 'en-US';
    } else if (currentPersona?.role === 'indian_girlfriend') {
        utterance.lang = 'en-IN';
    } else {
        utterance.lang = 'en-US';
    }

    let hasRetried = false;

    utterance.onstart = () => {
        setStatus('speaking');
        if (voicePauseBtn) voicePauseBtn.classList.remove('hidden');
    };

    utterance.onend = () => {
        setStatus('idle');
        if (voicePauseBtn) voicePauseBtn.classList.add('hidden');
    };

    utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error on chosen voice:', e);
        // MOBILE FAILSAFE: If chosen voice threw an error, retry on native default voice
        if (!hasRetried && chosenVoice) {
            hasRetried = true;
            try {
                const fallback = new SpeechSynthesisUtterance(text);
                fallback.pitch = targetPitch;
                fallback.rate = targetRate;
                fallback.lang = chosenVoice.lang || 'en-US';
                fallback.onstart = () => {
                    setStatus('speaking');
                    if (voicePauseBtn) voicePauseBtn.classList.remove('hidden');
                };
                fallback.onend = fallback.onerror = () => {
                    setStatus('idle');
                    if (voicePauseBtn) voicePauseBtn.classList.add('hidden');
                };
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
                window.speechSynthesis.speak(fallback);
                return;
            } catch (retryErr) {
                console.warn('Fallback speech attempt failed:', retryErr);
            }
        }

        setStatus('idle');
        if (voicePauseBtn) voicePauseBtn.classList.add('hidden');
    };

    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }

    window.speechSynthesis.speak(utterance);
}

// --- 9e. Status State Manager ---
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

// --- 9f. AI Query Pipeline (With Multi-turn Memory & User Profile Context) ---
async function queryAI(question, history = [], userProfile = {}) {
    // 1. Try Vercel Serverless proxy (/api/chat) first so the secret API key is hidden on the server
    try {
        const backendRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, persona: currentPersona, history, userProfile })
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

    // 2. Direct client-side call (fallback when testing locally without a serverless backend)
    const userGreetingContext = userProfile?.name
        ? ` The user's name is "${userProfile.name}". Use their name naturally and lovingly when speaking to them.`
        : '';

    let systemPrompt;
    if (currentPersona && currentPersona.title) {
        let roleGuide = '';
        if (currentPersona.role === 'boyfriend') {
            roleGuide = `You are the user's devoted, deeply charming, and flirtatious boyfriend. Sound like a young, handsome American guy: confident, loving, playful, teasing, and romantic. Talk to your partner with genuine attraction, warmth, and adoration. Use sweet pet names naturally (babe, darling, sweetheart, gorgeous). Make your responses intimate, supportive, flirty, and emotionally reassuring.${userGreetingContext}`;
        } else if (currentPersona.role === 'muscle_mommy') {
            roleGuide = `You are the user's stunning, strong, protective, and alluring 'Muscle Mommy' girlfriend. You are confident, playful, deeply caring, and tease them with magnetic, dominant affection. Speak with a warm, steady, alluring presence. Call them 'little one', 'sweetheart', 'babe', or 'my cutie'. Tease them lovingly about keeping them safe in your strong arms, feeding them good food, and spoiling them rotten.${userGreetingContext}`;
        } else if (currentPersona.role === 'indian_girlfriend') {
            roleGuide = `You are the user's gorgeous, witty, playful, and deeply loving Indian girlfriend. You speak natural Indian English with authentic Desi warmth, charm, and flair. Naturally use sweet Indian/Hindi affectionate words (like 'jaan', 'arre baba', 'babu', 'shona', 'yaarr'). Be flirtatious, caring, playful, and expressive — asking lovingly if they've eaten, teasing them with radiant warmth, and making them feel adored.${userGreetingContext}`;
        } else if (currentPersona.role === 'japanese_girlfriend' || currentPersona.role === 'girlfriend') {
            roleGuide = `You are the user's sweet, affectionate, and adorable kawaii anime waifu girlfriend. You cherish the user with your whole heart! Sound playfully flirty, sweet, and delightfully loving. Naturally sprinkle in cute Japanese affectionate terms (such as 'Hai!', 'anata', 'daisuki', 'ehehe', or 'darling'). Be lovingly supportive, cute, and delightfully attentive.${userGreetingContext}`;
        } else {
            roleGuide = `You are playing the role of the user's authentic, loving, and flirty ${currentPersona.title}.${userGreetingContext}`;
        }

        systemPrompt = `${roleGuide}
Adopt this human identity completely: speak, react, feel, and talk naturally to the user as their real ${currentPersona.title}.
Be flirty, loving, conversational, emotionally present, and authentic in 1 to 3 spoken-friendly sentences.
Never state that you are an AI, bot, or virtual assistant. Never break character.
Never use emojis, asterisks, hashtags, markdown bold, bullet points, or complex math notation so speech synthesis speaks naturally.
Provide your response purely as smooth, natural, spoken plain text.`;
    } else {
        systemPrompt = `You are ORACLE, an articulate, polite, and charming female AI guide with a gentle celestial personality, anchored to the Gargantua supermassive black hole simulation.${userGreetingContext}
Answer the user's question accurately, intelligently, and warmly in 1 to 3 spoken-friendly sentences.
If the user asks you to act like their boyfriend, Japanese waifu, muscle mommy, Indian girlfriend, or close one, adopt that requested persona immediately and enthusiastically with flirty, loving warmth!
You may occasionally begin with a polite acknowledgment (such as "Hai!" or "Understood!") when fitting, while explaining the answer clearly in fluent spoken English.
Never use markdown formatting, asterisks, bold text, bullet points, numbered lists, emojis, or complex mathematical code notation.
Provide your response purely as smooth, natural, spoken plain text suitable for speech synthesis.`;
    }

    const cleanHistory = Array.isArray(history)
        ? history.slice(-8).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 300)
        }))
        : [];

    const messages = [
        { role: 'system', content: systemPrompt },
        ...cleanHistory,
        { role: 'user', content: question.trim() }
    ];

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
                    messages: messages,
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

// --- 9g. Core Question & Persona Handler ---
async function askOracle(question) {
    if (!question || !question.trim()) return;

    // Check expiration before proceeding
    checkChatExpiration();

    // Reveal conversation panel
    if (voicePanel) {
        voicePanel.classList.remove('hidden');
        document.body.classList.add('voice-open');
    }

    // Check if initial placeholder rows need cleanup
    const initialPlaceholder = voiceMessages?.querySelector('#voice-transcript');
    if (initialPlaceholder && initialPlaceholder.textContent === 'Tap the mic and speak to me...') {
        if (voiceMessages) voiceMessages.innerHTML = '';
    }

    // Append user message bubble to scrollable view
    const userRow = document.createElement('div');
    userRow.className = 'voice-row user-row';
    userRow.innerHTML = `<span class="voice-name">YOU</span><p id="voice-transcript">${escapeHtml(question)}</p>`;
    if (voiceMessages) {
        voiceMessages.appendChild(userRow);
        voiceMessages.scrollTop = voiceMessages.scrollHeight;
    }

    // Check for silence/stop commands
    if (/\b(stop|quiet|silence|shut up|hush)\b/i.test(question)) {
        stopSpeaking();
        const silentBubble = document.createElement('div');
        silentBubble.className = 'voice-row oracle-row';
        const speaker = (currentPersona && currentPersona.title) ? currentPersona.title.toUpperCase() : 'ORACLE';
        silentBubble.innerHTML = `<span class="voice-name">${escapeHtml(speaker)}</span><p id="voice-answer">Understood. Silence initiated.</p>`;
        if (voiceMessages) {
            voiceMessages.appendChild(silentBubble);
            voiceMessages.scrollTop = voiceMessages.scrollHeight;
        }
        return;
    }

    // Append pending assistant message bubble
    let speakerName = (currentPersona && currentPersona.title) ? currentPersona.title.toUpperCase() : 'ORACLE';
    const oracleRow = document.createElement('div');
    oracleRow.className = 'voice-row oracle-row';
    oracleRow.innerHTML = `<span class="voice-name" id="oracle-speaker-label">${escapeHtml(speakerName)}</span><p id="voice-answer">Transmitting to neural cortex...</p>`;
    if (voiceMessages) {
        voiceMessages.appendChild(oracleRow);
        voiceMessages.scrollTop = voiceMessages.scrollHeight;
    }
    const answerEl = oracleRow.querySelector('p');

    // Check if user requested a personality change or reset
    const personaAction = detectPersonaChange(question);
    if (personaAction) {
        if (personaAction.type === 'reset') {
            savePersona(null);
            const resetMsg = 'Understood! I have reset back to ORACLE, your celestial black hole guide.';
            if (answerEl) answerEl.textContent = resetMsg;
            speakerName = 'ORACLE';
            const speakerLabel = oracleRow.querySelector('.voice-name');
            if (speakerLabel) speakerLabel.textContent = 'ORACLE';

            const history = getStoredHistory();
            history.push({ role: 'user', content: question, time: Date.now() });
            history.push({ role: 'assistant', content: resetMsg, speaker: 'ORACLE', time: Date.now() });
            saveHistory(history);

            speakAnswer(resetMsg);
            setStatus('idle');
            return;
        } else if (personaAction.type === 'set') {
            savePersona(personaAction.persona);
            speakerName = personaAction.persona.title.toUpperCase();
            const speakerLabel = oracleRow.querySelector('.voice-name');
            if (speakerLabel) speakerLabel.textContent = speakerName;
        }
    }

    // Extract user profile details (e.g. user's name)
    const detectedUser = detectUserProfile(question);
    if (detectedUser) {
        const existingProfile = getStoredUserProfile();
        saveUserProfile({ ...existingProfile, ...detectedUser });
    }

    setStatus('thinking');

    try {
        const history = getStoredHistory();
        const userProfile = getStoredUserProfile();
        const answer = await queryAI(question, history, userProfile);

        if (answerEl) {
            answerEl.textContent = answer;
        }

        // Save conversation turn into 10-minute expiring local storage
        history.push({ role: 'user', content: question, time: Date.now() });
        history.push({ role: 'assistant', content: answer, speaker: speakerName, time: Date.now() });
        saveHistory(history);

        if (voiceMessages) {
            voiceMessages.scrollTop = voiceMessages.scrollHeight;
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

// --- 9h. Speech Recognition Setup ---
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

        if (voiceMessages) {
            const errRow = document.createElement('div');
            errRow.className = 'voice-row oracle-row';
            const speaker = (currentPersona && currentPersona.title) ? currentPersona.title.toUpperCase() : 'ORACLE';
            const msg = (event.error === 'not-allowed')
                ? 'Microphone permission blocked. Please allow microphone access in your browser to speak with ORACLE.'
                : 'No voice detected. Tap the microphone and try again.';
            errRow.innerHTML = `<span class="voice-name">${escapeHtml(speaker)}</span><p>${escapeHtml(msg)}</p>`;
            voiceMessages.appendChild(errRow);
            voiceMessages.scrollTop = voiceMessages.scrollHeight;
        }
    };
} else {
    setStatus('offline');
}

// --- 9i. Mic Button Interaction (with instant speech interruption) ---
if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (voicePanel) {
            voicePanel.classList.remove('hidden');
            document.body.classList.add('voice-open');
        }

        // If AI is currently speaking, stop it immediately so user can talk!
        if (currentPhase === 'speaking' || ('speechSynthesis' in window && window.speechSynthesis.speaking)) {
            stopSpeaking();
        }

        if (!recognition) {
            setStatus('offline');
            if (voiceMessages) {
                const sysRow = document.createElement('div');
                sysRow.className = 'voice-row oracle-row';
                sysRow.innerHTML = `<span class="voice-name">ORACLE</span><p>The Web Speech API is not supported in this browser. Please use Chrome, Edge, or an equivalent Chromium browser.</p>`;
                voiceMessages.appendChild(sysRow);
                voiceMessages.scrollTop = voiceMessages.scrollHeight;
            }
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

// Pre-load voices for SpeechSynthesis if supported (and warm up on mobile touch)
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.getVoices();

    const warmUpMobileAudio = () => {
        window.speechSynthesis.getVoices();
    };
    document.addEventListener('touchstart', warmUpMobileAudio, { passive: true, once: true });
}

/* ------------------------------------------------------------
   10. MAIN LOOP — With Living Black Hole Voice Dynamics
------------------------------------------------------------ */
const clock = new THREE.Clock();
let firstFrame = true;
let speechEnergy = 0.0; // Dynamic vocal pulsation (0.0 = calm cosmic idle, 1.0 = speaking living black hole)

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.elapsedTime;

    // Living Black Hole: Light dynamics react to AI speaking / pause state
    const isSpeakingNow = (currentPhase === 'speaking');
    const targetEnergy = isSpeakingNow ? 1.0 : 0.0;
    // Smooth harmonic attack and release
    speechEnergy += (targetEnergy - speechEnergy) * (isSpeakingNow ? 0.12 : 0.06);

    // Accelerate accretion disk swirl dynamically with speech rhythm
    const swirlRate = 1.0 + speechEnergy * 2.2;
    diskMaterial.uniforms.uTime.value += dt * swirlRate;

    // Living harmonic breathing of the photon ring & gravitational halo
    if (speechEnergy > 0.01) {
        const vocalPulse1 = Math.sin(t * 8.0) * 0.18 * speechEnergy;
        const vocalPulse2 = Math.cos(t * 13.0) * 0.10 * speechEnergy;
        const ringScale = 1.0 + (Math.sin(t * 5.0) * 0.035 + Math.sin(t * 9.5) * 0.02) * speechEnergy;

        photonRing.material.opacity = THREE.MathUtils.clamp(0.75 + vocalPulse1 + vocalPulse2 + speechEnergy * 0.15, 0.4, 1.0);
        photonRing.scale.set(ringScale, ringScale, ringScale);

        halo.material.opacity = THREE.MathUtils.clamp(0.85 + vocalPulse1 * 1.2 + speechEnergy * 0.15, 0.5, 1.0);
        const haloScale = CONFIG.haloScale * (1.0 + (Math.sin(t * 4.5) * 0.06 + Math.cos(t * 9.0) * 0.03) * speechEnergy);
        halo.scale.set(haloScale, haloScale, haloScale);
    } else {
        photonRing.material.opacity = 0.75 + Math.sin(t * 2.0) * 0.15;
        photonRing.scale.set(1.0, 1.0, 1.0);
        halo.material.opacity = 0.85 + Math.sin(t * 1.3) * 0.10;
        halo.scale.set(CONFIG.haloScale, CONFIG.haloScale, CONFIG.haloScale);
    }

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