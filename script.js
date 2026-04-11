const MODES = {
    pomodoro: { label: 'focus',       seconds: 25 * 60, bgClass: '' },
    short:    { label: 'short break', seconds:  5 * 60, bgClass: 'mode-short' },
    long:     { label: 'long break',  seconds: 15 * 60, bgClass: 'mode-long'  },
};

const MAX_SESSIONS = 4;

let currentMode    = 'pomodoro';
let totalSeconds   = MODES.pomodoro.seconds;
let remaining      = totalSeconds;
let running        = false;
let timerId        = null;
let startTime      = null;
let startRemaining = 0;
let sessionsTotal  = 0;
let volume         = 0.85;
let currentAudio = null;
let timerWorker  = null;


if (window.Worker) {
    timerWorker = new Worker('timerWorker.js');
    timerWorker.onmessage = function(e) {
        if (e.data === 'tick' && running) {
            tick();
        }
    };
}

const workplace         = document.getElementById('workplace');
const display           = document.getElementById('timerDisplay');
const label             = document.getElementById('timerLabel');
const fill              = document.getElementById('progressFill');
const btnStart          = document.getElementById('btnStart');
const btnReset          = document.getElementById('btnReset');
const dots              = document.getElementById('sessionDots');
const modeBtns          = document.querySelectorAll('.mode-btn');
const btnSettings       = document.getElementById('btnSettings');
const settingsPanel     = document.getElementById('settingsPanel');
const btnSettingsSave   = document.getElementById('btnSettingsSave');
const btnSettingsCancel = document.getElementById('btnSettingsCancel');
const inPomo            = document.getElementById('setPomo');
const inShort           = document.getElementById('setShort');
const inLong            = document.getElementById('setLong');
const inVolume          = document.getElementById('setVolume');
const volumeLabel       = document.getElementById('volumeLabel');


const btnDarkmode = document.getElementById('btnDarkmode');

function applyDarkMode(on) {
    document.body.classList.toggle('dark', on);
    localStorage.setItem('darkmode', on ? '1' : '0');
}

btnDarkmode.addEventListener('click', () => {
    applyDarkMode(!document.body.classList.contains('dark'));
});

applyDarkMode(localStorage.getItem('darkmode') === '1');

let audioUnlocked = false;

function unlockAudio() {
    if (audioUnlocked) return;

    const a = new Audio("sounds/sound1.mp3");
    a.volume = 0;

    a.play().then(() => {
        a.pause();
        a.currentTime = 0;
        audioUnlocked = true;
    }).catch(() => {});
}

document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);


inVolume.addEventListener('input', () => {
    volumeLabel.textContent = inVolume.value + '%';
});

function fmt(s) {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function updateDisplay() {
    display.textContent = fmt(remaining);
    fill.style.width = (remaining / totalSeconds * 100) + '%';
    document.title = fmt(remaining) + ' · Pomodori - Pomodoro Timer';
}

function updateDots() {
    dots.querySelectorAll('.dot').forEach((d, i) => {
        d.classList.toggle('done', i < sessionsTotal);
    });
}

function tick() {
    const now = performance.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    remaining = Math.max(startRemaining - elapsed, 0);
    updateDisplay();

    if (remaining <= 0) {
        stopTimer();
        handleComplete();
    }
}

function stopTimer() {
    if (timerWorker) {
        timerWorker.postMessage('stop');
    }
    if (timerId) { clearInterval(timerId); timerId = null; }
    running = false;
    btnStart.textContent = 'start';
    document.title = 'Pomodoro';
}

const sounds = [
    "sounds/sound6.mp3",
    "sounds/sound7.mp3",
    "sounds/sound8.mp3",
];

const audioObjects = sounds.map(src => {
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
});

function handleComplete() {
    const randomIndex = Math.floor(Math.random() * audioObjects.length);
    currentAudio = audioObjects[randomIndex];
    currentAudio.volume = volume;
    currentAudio.currentTime = 0;
    
    const playPromise = currentAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log("Wiedergabe im Hintergrund verzögert oder blockiert:", error);
        });
    }

    if (currentMode === 'pomodoro') {
        sessionsTotal = (sessionsTotal + 1) % (MAX_SESSIONS + 1);
        updateDots();
    }
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pomodoro', { body: MODES[currentMode].label + ' done!' });
    }
}

function setMode(mode) {
    stopTimer();
    currentMode  = mode;
    totalSeconds = MODES[mode].seconds;
    remaining    = totalSeconds;
    workplace.className = 'workplace ' + MODES[mode].bgClass;
    label.textContent   = MODES[mode].label;
    modeBtns.forEach(b  => b.classList.toggle('active', b.dataset.mode === mode));
    updateDisplay();
}

btnStart.addEventListener('click', () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    if (running) {
        stopTimer();
    } else {
        if (remaining === 0) remaining = totalSeconds;
        running        = true;
        startRemaining = remaining;
        startTime      = performance.now();
        btnStart.textContent = 'pause';
        if (timerWorker) {
            timerWorker.postMessage('start');
        } else {
            timerId = setInterval(tick, 1000);
        }
    }
});

btnReset.addEventListener('click', () => {
    stopTimer();
    remaining = totalSeconds;
    updateDisplay();
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
});

modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

btnSettings.addEventListener('click', () => {
    inPomo.value   = Math.round(MODES.pomodoro.seconds / 60);
    inShort.value  = Math.round(MODES.short.seconds / 60);
    inLong.value   = Math.round(MODES.long.seconds / 60);
    inVolume.value = Math.round(volume * 100);
    volumeLabel.textContent = inVolume.value + '%';
    settingsPanel.classList.add('open');
});

btnSettingsCancel.addEventListener('click', () => settingsPanel.classList.remove('open'));

btnSettingsSave.addEventListener('click', () => {
    const p = Math.min(99, Math.max(1, parseInt(inPomo.value)  || 25));
    const s = Math.min(99, Math.max(1, parseInt(inShort.value) || 5));
    const l = Math.min(99, Math.max(1, parseInt(inLong.value)  || 15));

    MODES.pomodoro.seconds = p * 60;
    MODES.short.seconds    = s * 60;
    MODES.long.seconds     = l * 60;
    volume = parseInt(inVolume.value) / 100;

    settingsPanel.classList.remove('open');
    setMode(currentMode);
});

updateDisplay();
updateDots();

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission(); 
}

const cursorDot  = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');

let mouseX = 0, mouseY = 0;
let ringX  = 0, ringY  = 0;
let velX   = 0, velY   = 0;

const STIFFNESS = 0.1;
const DAMPING   = 0.77;   

document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top  = mouseY + 'px';
});

document.addEventListener('mouseenter', () => document.body.classList.remove('cursor-out'));
document.addEventListener('mouseleave', () => document.body.classList.add('cursor-out'));

document.addEventListener('mousedown', () => {
    cursorDot.style.transform  = 'translate(-50%, -50%) scale(0.6)';
    cursorRing.style.transform = 'translate(-50%, -50%) scale(0.85)';
});
document.addEventListener('mouseup', () => {
    cursorDot.style.transform  = 'translate(-50%, -50%) scale(1)';
    cursorRing.style.transform = 'translate(-50%, -50%) scale(1)';
});

const hoverTargets = 'button, a, input, [role="button"]';
document.querySelectorAll(hoverTargets).forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

function springLoop() {
    const dx = mouseX - ringX;
    const dy = mouseY - ringY;

    velX = (velX + dx * STIFFNESS) * DAMPING;
    velY = (velY + dy * STIFFNESS) * DAMPING;

    ringX += velX;
    ringY += velY;

    cursorRing.style.left = ringX + 'px';
    cursorRing.style.top  = ringY + 'px';

    requestAnimationFrame(springLoop);
}
springLoop();


let wakeLock = null;
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (e) {
            console.log('[[!!]] : Wake Lock abgelehnt:', e);
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});
requestWakeLock();