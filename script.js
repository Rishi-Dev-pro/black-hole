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
    voiceLang: 'en-IN',          // voice recognition & synthesis language
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
   9. ORACLE — VOICE ASSISTANT (Web Speech API + Knowledge Base)
------------------------------------------------------------ */

// --- 9a. DOM Elements ---
const micBtn = document.getElementById('mic-btn');
const voicePanel = document.getElementById('voice-panel');
const voiceStatus = document.getElementById('voice-status');
const transcriptEl = document.getElementById('voice-transcript');
const answerEl = document.getElementById('voice-answer');
const exampleChips = document.querySelectorAll('.example-chip');
const voiceContainer = document.querySelector('.voice-container');

// Prevent double-clicking the voice controls from resetting the 3D scene camera
if (voiceContainer) {
    voiceContainer.addEventListener('dblclick', (e) => e.stopPropagation());
}

// --- 9b. Local Curated Knowledge Base ---
const KNOWLEDGE_BASE = [
    // === MATH: Core Formulas & Theorems ===
    {
        keywords: ['pythagoras', 'pythagorean', 'pythagorean theorem'],
        answer: "The Pythagoras theorem states that in a right-angled triangle: a² + b² = c², where c is the hypotenuse and a and b are the other two sides."
    },
    {
        keywords: ['area of circle', 'circle area', 'area circle'],
        answer: "The area of a circle is A = πr², where π is approximately 3.14159 and r is the radius of the circle."
    },
    {
        keywords: ['circumference', 'perimeter of circle', 'circle circumference'],
        answer: "The circumference of a circle is C = 2πr, or equivalently π times the diameter."
    },
    {
        keywords: ['area of triangle', 'triangle area'],
        answer: "The area of a triangle is A = ½ × base × height. For equilateral triangles, it is (√3 / 4) × side²."
    },
    {
        keywords: ['quadratic formula', 'quadratic equation formula', 'roots of quadratic'],
        answer: "The quadratic formula to solve ax² + bx + c = 0 is: x = (-b ± √(b² - 4ac)) / (2a)."
    },
    {
        keywords: ['volume of sphere', 'sphere volume'],
        answer: "The volume of a sphere is V = (4/3)πr³, where r is the radius."
    },
    {
        keywords: ['volume of cylinder', 'cylinder volume'],
        answer: "The volume of a cylinder is V = πr²h, where r is the base radius and h is the height."
    },
    {
        keywords: ['volume of cone', 'cone volume'],
        answer: "The volume of a cone is V = (1/3)πr²h, which is exactly one-third the volume of a cylinder with identical dimensions."
    },
    {
        keywords: ['area of rectangle', 'rectangle area', 'perimeter of rectangle'],
        answer: "For a rectangle, Area = length × width, and Perimeter = 2 × (length + width)."
    },
    {
        keywords: ['area of square', 'square area', 'perimeter of square'],
        answer: "For a square with side length s, Area = s², and Perimeter = 4 × s."
    },
    {
        keywords: ['simple interest', 'si formula'],
        answer: "Simple Interest formula is: SI = (P × R × T) / 100, where P is the Principal, R is the annual Rate of interest, and T is Time in years."
    },
    {
        keywords: ['compound interest', 'ci formula'],
        answer: "The compound interest amount formula is: A = P(1 + r/n)^(nt), where P is principal, r is rate, n is compounding frequency per year, and t is years."
    },
    {
        keywords: ['speed', 'speed formula', 'velocity formula'],
        answer: "Speed = Distance / Time. Therefore, Distance = Speed × Time, and Time = Distance / Speed."
    },
    {
        keywords: ['pi value', 'value of pi', 'what is pi'],
        answer: "Pi (π) is the ratio of a circle's circumference to its diameter. It is an irrational number approximately equal to 3.14159, or 22/7 as a fraction."
    },
    {
        keywords: ['trigonometry', 'sin cos tan', 'sine cosine tangent'],
        answer: "In a right-angled triangle: sin(θ) = Opposite / Hypotenuse, cos(θ) = Adjacent / Hypotenuse, and tan(θ) = Opposite / Adjacent."
    },
    {
        keywords: ['heron', 'herons formula'],
        answer: "Heron's formula calculates triangle area from sides a, b, c: Area = √(s(s - a)(s - b)(s - c)), where s = (a + b + c) / 2 is the semi-perimeter."
    },
    {
        keywords: ['distance formula'],
        answer: "The 2D distance between (x₁, y₁) and (x₂, y₂) is d = √((x₂ - x₁)² + (y₂ - y₁)²)."
    },
    {
        keywords: ['slope', 'slope formula'],
        answer: "The slope (m) of a line through (x₁, y₁) and (x₂, y₂) is m = (y₂ - y₁) / (x₂ - x₁)."
    },
    {
        keywords: ['average formula', 'mean formula'],
        answer: "The arithmetic mean or average is the sum of all observations divided by the total number of observations."
    },

    // === INDIA POLITICS & CIVICS ===
    {
        keywords: ['prime minister of india', 'india prime minister', 'pm of india', 'indian prime minister', 'prime minister'],
        answer: "The Prime Minister of India is Narendra Modi, who has served as the head of government since May 2014, leading the National Democratic Alliance."
    },
    {
        keywords: ['president of india', 'india president', 'indian president', 'president'],
        answer: "The President of India is Droupadi Murmu, the ceremonial head of state and Supreme Commander of the Indian Armed Forces, in office since July 2022."
    },
    {
        keywords: ['first prime minister of india', 'first pm of india'],
        answer: "The first Prime Minister of independent India was Pandit Jawaharlal Nehru, who served from August 15, 1947 until May 1964."
    },
    {
        keywords: ['first president of india'],
        answer: "The first President of India was Dr. Rajendra Prasad, serving from 1950 to 1962."
    },
    {
        keywords: ['father of indian constitution', 'father of constitution', 'br ambedkar', 'ambedkar'],
        answer: "Dr. Bhimrao Ramji Ambedkar is recognized as the chief architect and Father of the Constitution of India, chairing its Drafting Committee."
    },
    {
        keywords: ['independence day india', 'independence year', 'when did india get independence'],
        answer: "India gained independence from British rule on August 15, 1947."
    },
    {
        keywords: ['republic day', 'constitution of india', 'when constitution adopted'],
        answer: "The Constitution of India was adopted by the Constituent Assembly on November 26, 1949 and came into full legal effect on January 26, 1950, celebrated as Republic Day."
    },
    {
        keywords: ['how many states in india', 'states of india', 'number of states'],
        answer: "India has 28 states and 8 Union Territories, functioning under a federal parliamentary constitutional republic."
    },
    {
        keywords: ['lok sabha', 'lower house', 'lok sabha seats'],
        answer: "The Lok Sabha (House of the People) is the lower house of the Indian Parliament, with 543 directly elected parliamentary constituencies."
    },
    {
        keywords: ['rajya sabha', 'upper house', 'rajya sabha seats'],
        answer: "The Rajya Sabha (Council of States) is the upper house of Parliament, comprising up to 250 members, representing states and union territories."
    },
    {
        keywords: ['voting age in india', 'voting age'],
        answer: "The legal voting age in India is 18 years, established by the 61st Constitutional Amendment Act of 1988."
    },
    {
        keywords: ['article 370', 'jammu and kashmir'],
        answer: "Article 370 of the Indian Constitution granted special autonomous status to Jammu and Kashmir; its key provisions were abrogated by the Indian Parliament in August 2019."
    },
    {
        keywords: ['preamble of india', 'preamble'],
        answer: "The Preamble to the Indian Constitution declares India to be a Sovereign, Socialist, Secular, Democratic Republic, securing justice, liberty, equality, and fraternity for all citizens."
    },
    {
        keywords: ['capital of india'],
        answer: "The capital of India is New Delhi."
    },

    // === WORLD POLITICS & MAJOR COUNTRIES ===
    {
        keywords: ['president of usa', 'us president', 'usa president', 'president of united states', 'american president'],
        answer: "The President of the United States serves as the head of state and head of government. Donald Trump was elected as the 47th President following the 2024 elections."
    },
    {
        keywords: ['prime minister of uk', 'uk prime minister', 'british prime minister', 'pm of uk', 'britain prime minister'],
        answer: "The Prime Minister of the United Kingdom is Keir Starmer, leader of the Labour Party, who assumed office in July 2024."
    },
    {
        keywords: ['president of russia', 'russia president', 'russian president', 'putin'],
        answer: "The President of the Russian Federation is Vladimir Putin, who has served as head of state continuously since 2012, and previously from 2000 to 2008."
    },
    {
        keywords: ['president of china', 'china president', 'chinese president', 'xi jinping'],
        answer: "The President of the People's Republic of China and General Secretary of the Chinese Communist Party is Xi Jinping, serving since 2013."
    },
    {
        keywords: ['president of france', 'france president', 'french president', 'macron'],
        answer: "The President of France is Emmanuel Macron, serving as head of state of the French Republic since May 2017."
    },
    {
        keywords: ['chancellor of germany', 'germany chancellor', 'german chancellor'],
        answer: "The Chancellor of Germany is the head of the federal government, directing policy from the Federal Chancellery in Berlin."
    },
    {
        keywords: ['prime minister of japan', 'japan prime minister', 'japanese prime minister'],
        answer: "The Prime Minister of Japan is the head of government and leader of the Cabinet, working within Japan's constitutional monarchy."
    },
    {
        keywords: ['un secretary general', 'united nations head', 'secretary general of un'],
        answer: "The Secretary-General of the United Nations is António Guterres of Portugal, serving as the UN's chief administrative officer since January 2017."
    },
    {
        keywords: ['un headquarters', 'united nations headquarters'],
        answer: "The official headquarters of the United Nations is situated in New York City, USA, on international territory."
    },
    {
        keywords: ['nato headquarters', 'headquarters of nato'],
        answer: "The political and military headquarters of the North Atlantic Treaty Organization (NATO) is located in Brussels, Belgium."
    },

    // === ASTRONOMY & BLACK HOLES (THEME-SPECIFIC) ===
    {
        keywords: ['black hole', 'what is a black hole'],
        answer: "A black hole is a region of spacetime where gravity is so intense that nothing, not even light, can escape once past the event horizon."
    },
    {
        keywords: ['event horizon', 'what is event horizon'],
        answer: "The event horizon is the theoretical threshold around a black hole beyond which the escape velocity exceeds the speed of light."
    },
    {
        keywords: ['schwarzschild radius', 'radius formula'],
        answer: "The Schwarzschild radius defines the size of an event horizon: r_s = 2GM / c², where G is the gravitational constant, M is mass, and c is the speed of light."
    },
    {
        keywords: ['gargantua'],
        answer: "Gargantua is the supermassive black hole featured in Christopher Nolan's film Interstellar, scientifically modeled with physicist Kip Thorne."
    },

    // === GREETINGS & INTENTS ===
    {
        keywords: ['hello', 'hi', 'hey', 'greetings'],
        answer: "Greetings, traveler of the cosmos. I am ORACLE. Ask me about mathematics, formulas, Indian civics, or world politics."
    },
    {
        keywords: ['who are you', 'your name', 'what are you'],
        answer: "I am ORACLE, your artificial guide anchored to the Gargantua black hole simulation. I can answer questions on mathematics, physics, and world politics."
    },
    {
        keywords: ['what can you do', 'help', 'capabilities'],
        answer: "I can answer questions on mathematical formulas (like Pythagoras theorem, circle areas, quadratic equations) and political facts about India and major nations."
    },
    {
        keywords: ['thank you', 'thanks'],
        answer: "You are welcome. May the laws of gravity keep you grounded."
    }
];

const FALLBACK_ANSWER = "That lies beyond my event horizon. I specialize in mathematical formulas and the politics of India and major world powers. Try asking about Pythagoras theorem, circle area, or the Prime Minister of India.";

// --- 9c. Text Matching & Scoring Algorithm ---
function normalizeText(text) {
    return ' ' + text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

function findAnswer(rawQuestion) {
    const q = normalizeText(rawQuestion);
    let bestMatch = null;
    let bestScore = 0;

    for (const entry of KNOWLEDGE_BASE) {
        let entryScore = 0;
        for (const kw of entry.keywords) {
            const normalizedKw = normalizeText(kw);
            const kwWords = kw.trim().toLowerCase().split(/\s+/);

            // Exact phrase match receives higher weighting
            if (q.includes(normalizedKw)) {
                entryScore += kwWords.length * 3;
            } else if (kwWords.every(w => q.includes(' ' + w + ' '))) {
                // All individual words present receives partial weighting
                entryScore += kwWords.length;
            }
        }

        if (entryScore > bestScore) {
            bestScore = entryScore;
            bestMatch = entry;
        }
    }

    return bestScore > 0 ? bestMatch.answer : FALLBACK_ANSWER;
}

// --- 9d. Speech Synthesis (Audio Output) ---
function speakAnswer(text) {
    if (!('speechSynthesis' in window)) {
        setStatus('idle');
        return;
    }

    window.speechSynthesis.cancel(); // Cancel any lingering audio

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 0.90;

    // Pick an appropriate English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Male')));
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    utterance.onerror = () => setStatus('idle');

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

// --- 9f. Core Question Handler ---
function askOracle(question) {
    if (!question || !question.trim()) return;

    // Reveal conversation panel
    if (voicePanel) {
        voicePanel.classList.remove('hidden');
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

    setStatus('thinking');
    if (answerEl) {
        answerEl.textContent = 'Consulting knowledge archives...';
    }

    // Brief realistic delay for "thinking" perception
    setTimeout(() => {
        const answer = findAnswer(question);
        if (answerEl) {
            answerEl.textContent = answer;
        }
        speakAnswer(answer);
    }, 550);
}

// --- 9g. Speech Recognition Setup ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = CONFIG.voiceLang || 'en-IN';
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

        if (voicePanel) voicePanel.classList.remove('hidden');

        if (event.error === 'not-allowed') {
            if (transcriptEl) transcriptEl.textContent = 'Microphone permission blocked.';
            if (answerEl) answerEl.textContent = 'Please enable microphone access in your browser address bar to speak with ORACLE.';
        } else if (event.error === 'no-speech') {
            if (answerEl) answerEl.textContent = 'No voice detected. Click the microphone and try again.';
        }
    };
} else {
    setStatus('offline');
}

// --- 9h. Mic Button Interaction ---
if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (voicePanel) voicePanel.classList.remove('hidden');

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

// --- 9i. Interactive Example Question Chips ---
if (exampleChips && exampleChips.length > 0) {
    exampleChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const query = chip.textContent.replace(/[""']/g, '').trim();
            askOracle(query);
        });
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