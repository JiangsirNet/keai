/**
 * BGM 与音效
 * 管理 Web Audio 背景音乐播放与交互音效（sfxPlay/sfxWaterHit 等）
 */

let audioCtx = null;
let bgmPlaying = false;
let bgmTimer = null;
let bgmGain = null;
let bgmNoteIndex = 0;
let bgmBassIndex = 0;
let bgmNextNoteTime = 0;
let bgmNextBassTime = 0;

function syncLbBgmBtn() {
    const btn = document.getElementById("lbSfxToggle");
    if (!btn) return;
    const icon = btn.querySelector("i");
    if (bgmPlaying) {
        icon.className = "fa fa-volume-up";
        btn.classList.add("text-love");
        btn.classList.remove("text-gray-400");
    } else {
        icon.className = "fa fa-volume-off";
        btn.classList.remove("text-love");
        btn.classList.add("text-gray-400");
    }
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        bgmGain = audioCtx.createGain();
        bgmGain.gain.value = 0.12;
        bgmGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
}

const bgmMelody = [
    [523.25, 0.4], [659.25, 0.4], [783.99, 0.4], [1046.5, 0.6],
    [783.99, 0.4], [659.25, 0.4], [587.33, 0.4], [659.25, 0.6],
    [523.25, 0.4], [587.33, 0.4], [659.25, 0.4], [880.0, 0.6],
    [783.99, 0.4], [659.25, 0.4], [587.33, 0.4], [523.25, 0.8],
];
const bgmBass = [
    [130.81, 1.6], [196.0, 1.6], [174.61, 1.6], [130.81, 1.6],
];

function playBgmNote(freq, time, duration, gainNode, type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.3, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.connect(gain);
    gain.connect(gainNode);
    osc.start(time);
    osc.stop(time + duration);
}

function scheduleBgm() {
    if (!bgmPlaying) return;
    const now = audioCtx.currentTime;
    while (bgmNextNoteTime < now + 0.5) {
        const [freq, dur] = bgmMelody[bgmNoteIndex % bgmMelody.length];
        playBgmNote(freq, bgmNextNoteTime, dur, bgmGain, "triangle");
        bgmNextNoteTime += dur;
        bgmNoteIndex++;
    }
    while (bgmNextBassTime < now + 0.5) {
        const [freq, dur] = bgmBass[bgmBassIndex % bgmBass.length];
        playBgmNote(freq, bgmNextBassTime, dur, bgmGain, "sine");
        bgmNextBassTime += dur;
        bgmBassIndex++;
    }
    bgmTimer = setTimeout(scheduleBgm, 100);
}

function toggleBgm() {
    initAudio();
    const btn = document.getElementById("lbSfxToggle");
    if (!btn) return;
    const icon = btn.querySelector("i");
    if (!bgmPlaying) {
        bgmPlaying = true;
        window.bgmPlaying = true;
        bgmNoteIndex = 0;
        bgmBassIndex = 0;
        bgmNextNoteTime = audioCtx.currentTime + 0.1;
        bgmNextBassTime = audioCtx.currentTime + 0.1;
        scheduleBgm();
        icon.className = "fa fa-volume-up";
        btn.classList.add("text-love");
        btn.classList.remove("text-gray-400");
    } else {
        bgmPlaying = false;
        window.bgmPlaying = false;
        clearTimeout(bgmTimer);
        icon.className = "fa fa-volume-off";
        btn.classList.remove("text-love");
        btn.classList.add("text-gray-400");
    }
}

function sfxWaterHit() {
    initAudio();
    const now = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 0.3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start(now);
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
    oscGain.gain.setValueAtTime(0.25, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

function sfxEmptyClick() {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
}

function sfxPlay() {
    initAudio();
    const now = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 0.12;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(now);
}

window.syncLbBgmBtn = syncLbBgmBtn;
window.initAudio = initAudio;
window.playBgmNote = playBgmNote;
window.scheduleBgm = scheduleBgm;
window.toggleBgm = toggleBgm;
window.sfxWaterHit = sfxWaterHit;
window.sfxEmptyClick = sfxEmptyClick;
window.sfxPlay = sfxPlay;
window.bgmMelody = bgmMelody;
window.bgmBass = bgmBass;
window.audioCtx = audioCtx;
window.bgmPlaying = bgmPlaying;