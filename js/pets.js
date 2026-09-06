/**
 * 宠物动画
 * 猫猫与狗狗的 GIF 渲染、拖拽、抱抱交互
 * 2分钟无互动进入睡眠
 */

window.boyHugging = false;
window.girlHugging = false;

const SLEEP_DELAY = 2 * 60 * 1000; // 2分钟

// 宠物 CSS 定位基准位置（清除 transform 后的 left/top）
var petBaseX = {};
var petBaseY = {};
// 宠物行走目标位置（用于连续行走不跳位）
var petTargetX = {};

// ============ 猫猫 ============
const maoGreetPhrases = ["你好呀~", "喵！打招呼", "好久不见！", "来摸摸我", "喵呜~"];
let maoWalkingTimer = null;
let maoWalkEndTimer = null;
let maoDragging = false;
let maoGreetingTimer = null;
let maoGreetingActive = false;
let maoLastInteraction = 0;
let maoSleepTimeout = null;
let maoIsSleeping = false;

const MAO_IDLE = "images/猫-待机.gif";
const MAO_WALK = "images/猫-行走.gif";
const MAO_GREET = "images/猫-打招呼.gif";
const MAO_SLEEP = "images/猫-睡觉.gif";

function initMao() {
    var el = document.getElementById("maoPet");
    el.classList.remove("hidden");
    // 移除 onclick，由拖拽函数内部处理 tap
    el.removeAttribute('onclick');
    bindPetDrag(el, 'maoPet');
    resetInteractionTimer('maoPet');
    [MAO_IDLE, MAO_WALK, MAO_GREET, MAO_SLEEP].forEach(url => { const im = new Image(); im.src = url; });
    startMaoWalking();
}

function maoSetImg(url) {
    const img = document.getElementById("maoImg");
    if (!img || img.dataset.src === url) return;
    img.dataset.src = url;
    img.src = url;
}

function maoSetWalking(walking) {
    if (maoGreetingActive) return;
    maoSetImg(walking ? MAO_WALK : MAO_IDLE);
}

function maoPlayGreeting(duration) {
    if (maoGreetingTimer) clearTimeout(maoGreetingTimer);
    if (maoWalkEndTimer) { clearTimeout(maoWalkEndTimer); maoWalkEndTimer = null; }
    maoGreetingActive = true;
    maoSetImg(MAO_GREET);
    maoGreetingTimer = setTimeout(() => {
        maoGreetingActive = false;
        maoSetWalking(false);
    }, duration || 2000);
}

// ============ 行走调度：待机为主，偶尔触发 ============
var WALK_STEP_MS = 8000; // 每步 8 秒

function doOneWalkStep(petId) {
    var pet = document.getElementById(petId);
    if (petTargetX[petId] === undefined) {
        petTargetX[petId] = pet.getBoundingClientRect().left;
    }
    var curX = petTargetX[petId];
    pet.style.transform = '';
    pet.style.left = curX + 'px';
    pet.style.top = pet.getBoundingClientRect().top + 'px';
    pet.style.right = 'auto';
    pet.style.bottom = 'auto';
    var petW = pet.offsetWidth || 130;
    var move = Math.random() > 0.5 ? 80 : -80;
    var newLeft = Math.max(10, Math.min(window.innerWidth - petW - 10, curX + move));
    petTargetX[petId] = newLeft;
    pet.style.transition = 'left ' + WALK_STEP_MS + 'ms linear';
    pet.style.left = newLeft + 'px';
    pet.style.transform = 'scaleX(' + (newLeft < curX ? -1 : 1) + ')';
    if (petId === 'maoPet') maoSetWalking(true);
    else dogSetWalking(true);
}

function scheduleNextWalk(petId) {
    var delay = 15000 + Math.random() * 25000; // 15~40秒后触发
    var timerId = setTimeout(function() { startWalkSession(petId); }, delay);
    if (petId === 'maoPet') maoWalkingTimer = timerId;
    else dogWalkingTimer = timerId;
}

function startWalkSession(petId) {
    var isMao = petId === 'maoPet';
    if (isMao ? maoIsSleeping : dogIsSleeping) return;
    if (isMao ? maoDragging : dogDragging) { scheduleNextWalk(petId); return; }
    if (isMao ? maoGreetingActive : dogGreetingActive) { scheduleNextWalk(petId); return; }
    var steps = 2 + Math.floor(Math.random() * 3); // 2~4步
    var done = 0;
    function step() {
        if (isMao ? maoDragging : dogDragging) { done = steps; stopWalking(petId); return; }
        if (isMao ? maoGreetingActive : dogGreetingActive) { done = steps; stopWalking(petId); return; }
        doOneWalkStep(petId);
        done++;
        if (done < steps) {
            var tid = setTimeout(step, WALK_STEP_MS);
            if (isMao) maoWalkEndTimer = tid; else dogWalkEndTimer = tid;
        } else {
            stopWalking(petId);
        }
    }
    step();
}

function stopWalking(petId) {
    if (petId === 'maoPet') maoSetWalking(false);
    else dogSetWalking(false);
    var pet = document.getElementById(petId);
    pet.style.transition = '';
    scheduleNextWalk(petId);
}

function startMaoWalking() {
    if (maoWalkingTimer) clearTimeout(maoWalkingTimer);
    if (maoWalkEndTimer) { clearTimeout(maoWalkEndTimer); maoWalkEndTimer = null; }
    if (maoIsSleeping) return;
    maoSetWalking(false);
    scheduleNextWalk('maoPet');
}

function petMao() {
    if (maoDragging) return;
    resetInteractionTimer('maoPet');
    if (maoIsSleeping) wakeUp('maoPet');
    const pet = document.getElementById("maoPet");
    pet.classList.add("happy");
    setTimeout(() => pet.classList.remove("happy"), 500);
    maoPlayGreeting(2000);
    const bubble = document.getElementById("maoBubble");
    bubble.innerText = maoGreetPhrases[Math.floor(Math.random() * maoGreetPhrases.length)];
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), 2000);
    for (let i = 0; i < 3; i++) setTimeout(() => spawnMaoHeart(), i * 150);
}

function spawnMaoHeart() {
    const pet = document.getElementById("maoPet");
    const heart = document.createElement("i");
    heart.className = "fa fa-heart husky-heart";
    heart.style.color = "#ff9ec4";
    heart.style.left = (40 + Math.random() * 20) + "px";
    heart.style.top = "20px";
    heart.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    heart.style.animation = "heart-float 1.2s ease-out forwards";
    pet.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
}

// ============ 通用宠物拖拽 ============
// 绑定拖拽到宠物元素
function bindPetDrag(el, petId) {
    var startX, startY, offsetX, offsetY;
    var isDragging = false, hasMoved = false;

    function onStart(e) {
        var pet = el;
        var rect = pet.getBoundingClientRect();
        var pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        offsetX = pt.clientX - rect.left;
        offsetY = pt.clientY - rect.top;
        isDragging = true;
        hasMoved = false;

        // 唤醒 & 清计时器
        if (petId === 'maoPet') {
            if (maoIsSleeping) wakeUp('maoPet');
            if (maoGreetingTimer) { clearTimeout(maoGreetingTimer); maoGreetingTimer = null; }
            if (maoWalkEndTimer) { clearTimeout(maoWalkEndTimer); maoWalkEndTimer = null; }
            maoGreetingActive = false;
        } else {
            if (dogIsSleeping) wakeUp('dogPet');
            if (dogGreetingTimer) { clearTimeout(dogGreetingTimer); dogGreetingTimer = null; }
            if (dogWalkEndTimer) { clearTimeout(dogWalkEndTimer); dogWalkEndTimer = null; }
            dogGreetingActive = false;
        }
        resetInteractionTimer(petId);

        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        if (e.cancelable) e.preventDefault();
    }

    function onMove(e) {
        if (!isDragging) return;
        var pt = e.touches ? e.touches[0] : e;
        var dx = pt.clientX - startX;
        var dy = pt.clientY - startY;

        // 超过阈值才算真正开始拖
        if (!hasMoved && Math.abs(dx) + Math.abs(dy) > 6) {
            hasMoved = true;
            if (petId === 'maoPet') { maoDragging = true; window.maoDragging = true; }
            else { dogDragging = true; window.dogDragging = true; }
            // 处理拥抱拖拽
            if (hugState && hugState.petId === petId) {
                hugDragging = true;
                clearTimeout(hugState.timer);
            }
        }
        if (!hasMoved) return;
        if (e.cancelable) e.preventDefault();

        var pet = el;
        var newX = Math.max(0, Math.min(window.innerWidth - pet.offsetWidth, pt.clientX - offsetX));
        var newY = Math.max(0, Math.min(window.innerHeight - pet.offsetHeight, pt.clientY - offsetY));
        pet.style.left = newX + 'px';
        pet.style.top = newY + 'px';
        pet.style.right = 'auto';
        pet.style.bottom = 'auto';
        pet.style.transform = '';
        pet.style.transition = ''; // 拖拽时清除过渡

        if (hugDragging && hugState) moveCharacterWithPet(hugState.characterId, pet);
    }

    function onEnd(e) {
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);

        if (petId === 'maoPet') { maoDragging = false; window.maoDragging = false; }
        else { dogDragging = false; window.dogDragging = false; }
        hugDragging = false;

        if (!hasMoved) {
            // 没拖动 → 当作点击
            if (petId === 'maoPet') petMao();
            else petDog();
        } else {
            // 拖动结束 → 检查拥抱 / 恢复行走
            if (hugState) {
                clearTimeout(hugState.timer);
                cancelAnimationFrame(hugState.rafId);
                if (hugState.characterId === 'boyPet') window.boyHugging = false;
                if (hugState.characterId === 'girlPet') window.girlHugging = false;
                hugState = null;
            }
            checkHugOnDrop(el);
            // 拖拽结束，同步目标位置
            var endRect = el.getBoundingClientRect();
            petTargetX[petId] = endRect.left;
            if (!hugState) resumePetWalking(petId);
        }
        isDragging = false;
        hasMoved = false;
    }

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('mousedown', onStart);
}

// ============ 狗狗 ============
const dogPhrases = ["汪！", "陪我玩吧", "摸摸头", "好开心！", "汪汪~", "爱你", "今天也很高兴！", "主人最棒"];
let dogWalkingTimer = null;
let dogDragging = false;
let dogLastInteraction = 0;
let dogSleepTimeout = null;
let dogIsSleeping = false;
let dogWalkEndTimer = null;
let dogGreetingTimer = null;
let dogGreetingActive = false;

const DOG_IDLE = "images/狗待机.gif";
const DOG_WALK = "images/狗-行走.gif";
const DOG_GREET = "images/狗-打招呼.gif";
const DOG_SLEEP = "images/狗-睡觉.gif";

function initDog() {
    var el = document.getElementById("dogPet");
    el.classList.remove("hidden");
    // 移除 onclick，由拖拽函数内部处理 tap
    el.removeAttribute('onclick');
    bindPetDrag(el, 'dogPet');
    resetInteractionTimer('dogPet');
    [DOG_IDLE, DOG_WALK, DOG_GREET, DOG_SLEEP].forEach(url => { const im = new Image(); im.src = url; });
    startDogWalking();
}

function dogSetImg(url) {
    const img = document.getElementById("dogImg");
    if (!img || img.dataset.src === url) return;
    img.dataset.src = url;
    img.src = url;
}

function dogSetWalking(walking) {
    if (dogGreetingActive) return;
    dogSetImg(walking ? DOG_WALK : DOG_IDLE);
}

function dogPlayGreeting(duration) {
    if (dogGreetingTimer) clearTimeout(dogGreetingTimer);
    if (dogWalkEndTimer) { clearTimeout(dogWalkEndTimer); dogWalkEndTimer = null; }
    dogGreetingActive = true;
    dogSetImg(DOG_GREET);
    dogGreetingTimer = setTimeout(() => {
        dogGreetingActive = false;
        dogSetWalking(false);
    }, duration || 2000);
}

function startDogWalking() {
    if (dogWalkingTimer) clearTimeout(dogWalkingTimer);
    if (dogWalkEndTimer) { clearTimeout(dogWalkEndTimer); dogWalkEndTimer = null; }
    if (dogIsSleeping) return;
    dogSetWalking(false);
    scheduleNextWalk('dogPet');
}

function petDog() {
    if (dogDragging) return;
    resetInteractionTimer('dogPet');
    if (dogIsSleeping) wakeUp('dogPet');
    const pet = document.getElementById("dogPet");
    pet.classList.add("happy");
    setTimeout(() => pet.classList.remove("happy"), 500);
    dogPlayGreeting(2000);
    const bubble = document.getElementById("dogBubble");
    bubble.innerText = dogPhrases[Math.floor(Math.random() * dogPhrases.length)];
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), 2000);
    const tongue = document.getElementById("dogTongue");
    tongue.style.display = "block";
    setTimeout(() => tongue.style.display = "none", 1500);
    for (let i = 0; i < 3; i++) setTimeout(() => spawnDogHeart(), i * 150);
}

function spawnDogHeart() {
    const pet = document.getElementById("dogPet");
    const heart = document.createElement("i");
    heart.className = "fa fa-heart husky-heart";
    heart.style.color = "#8bc34a";
    heart.style.left = (40 + Math.random() * 20) + "px";
    heart.style.top = "20px";
    heart.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    heart.style.animation = "heart-float 1.2s ease-out forwards";
    pet.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
}



// ============ 睡眠/唤醒通用逻辑 ============
function resetInteractionTimer(petId) {
    const now = Date.now();
    if (petId === 'maoPet') {
        maoLastInteraction = now;
        scheduleSleep('maoPet');
    } else if (petId === 'dogPet') {
        dogLastInteraction = now;
        scheduleSleep('dogPet');
    }
}

function scheduleSleep(petId) {
    clearSleepTimeout(petId);
    const timeoutId = setTimeout(() => goToSleep(petId), SLEEP_DELAY);
    if (petId === 'maoPet') maoSleepTimeout = timeoutId;
    else if (petId === 'dogPet') dogSleepTimeout = timeoutId;
}

function clearSleepTimeout(petId) {
    if (petId === 'maoPet' && maoSleepTimeout !== null) { clearTimeout(maoSleepTimeout); maoSleepTimeout = null; }
    else if (petId === 'dogPet' && dogSleepTimeout !== null) { clearTimeout(dogSleepTimeout); dogSleepTimeout = null; }
}

function goToSleep(petId) {
    if (petId === 'maoPet') {
        if (maoWalkingTimer) clearTimeout(maoWalkingTimer);
        if (maoWalkEndTimer) { clearTimeout(maoWalkEndTimer); maoWalkEndTimer = null; }
        if (maoGreetingTimer) { clearTimeout(maoGreetingTimer); maoGreetingTimer = null; }
        maoGreetingActive = false;
        maoIsSleeping = true;
        maoSetImg(MAO_SLEEP);
    } else if (petId === 'dogPet') {
        if (dogWalkingTimer) clearTimeout(dogWalkingTimer);
        if (dogWalkEndTimer) { clearTimeout(dogWalkEndTimer); dogWalkEndTimer = null; }
        if (dogGreetingTimer) { clearTimeout(dogGreetingTimer); dogGreetingTimer = null; }
        dogGreetingActive = false;
        dogIsSleeping = true;
        dogSetImg(DOG_SLEEP);
    }
}

function wakeUp(petId) {
    if (petId === 'maoPet') { maoIsSleeping = false; maoSetImg(MAO_IDLE); startMaoWalking(); }
    else if (petId === 'dogPet') { dogIsSleeping = false; dogSetImg(DOG_IDLE); startDogWalking(); }
}

// ============ 拥抱/检测等通用函数 ============
let hugState = null;
let hugDragging = false;

function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function triggerHug(petId, characterId) {
    const pet = document.getElementById(petId);
    const character = document.getElementById(characterId);
    if (petId === 'maoPet' && maoWalkingTimer) clearTimeout(maoWalkingTimer);
    if (petId === 'dogPet' && dogWalkingTimer) clearTimeout(dogWalkingTimer);
    if (characterId === 'boyPet') window.boyHugging = true;
    if (characterId === 'girlPet') window.girlHugging = true;
    hugState = { petId, characterId };
    syncHugPet();
    showHugHeart(character);
    hugState.timer = setTimeout(releaseHug, 5000);
}

function syncHugPet() {
    if (!hugState || hugDragging) return;
    const pet = document.getElementById(hugState.petId);
    const character = document.getElementById(hugState.characterId);
    const charRect = character.getBoundingClientRect();
    const x = charRect.left + charRect.width / 2 - pet.offsetWidth / 2;
    const y = charRect.top + charRect.height * 0.55 - pet.offsetHeight / 2;
    pet.style.left = x + "px";
    pet.style.top = y + "px";
    pet.style.right = "auto";
    pet.style.bottom = "auto";
    pet.style.transform = "none";
    pet.style.transition = "none";
    petTargetX[hugState.petId] = x;
    hugState.rafId = requestAnimationFrame(syncHugPet);
}

function releaseHug() {
    if (!hugState) return;
    clearTimeout(hugState.timer);
    cancelAnimationFrame(hugState.rafId);
    const petId = hugState.petId;
    const characterId = hugState.characterId;
    hugState = null;
    if (characterId === 'boyPet') window.boyHugging = false;
    if (characterId === 'girlPet') window.girlHugging = false;
    const character = document.getElementById(characterId);
    const charRect = character.getBoundingClientRect();
    const pet = document.getElementById(petId);
    const petX = charRect.left + charRect.width / 2 - pet.offsetWidth / 2;
    const petBottom = window.innerHeight - charRect.bottom;
    pet.style.left = Math.max(10, Math.min(window.innerWidth - pet.offsetWidth - 10, petX)) + "px";
    pet.style.top = "auto";
    pet.style.bottom = Math.max(20, petBottom) + "px";
    pet.style.right = "auto";
    pet.style.transform = "";
    petTargetX[petId] = parseFloat(pet.style.left);
    resumePetWalking(petId);
}

function showHugHeart(character) {
    const heart = document.createElement('div');
    heart.textContent = '❤️';
    heart.style.cssText = 'position:fixed;font-size:28px;z-index:200;pointer-events:none;transition:all 1.5s ease-out;opacity:1;';
    const rect = character.getBoundingClientRect();
    heart.style.left = (rect.left + rect.width / 2 - 14) + 'px';
    heart.style.top = (rect.top - 10) + 'px';
    document.body.appendChild(heart);
    requestAnimationFrame(() => {
        heart.style.top = (rect.top - 70) + 'px';
        heart.style.opacity = '0';
        heart.style.transform = 'scale(1.5)';
    });
    setTimeout(() => heart.remove(), 1500);
}

function checkHugOnDrop(petEl) {
    if (hugState) return;
    const petRect = petEl.getBoundingClientRect();
    const boyEl = document.getElementById("boyPet");
    const girlEl = document.getElementById("girlPet");
    // 检查人物中心点是否在宠物矩形范围内
    function centerInRect(charRect, rect) {
        var cx = charRect.left + charRect.width / 2;
        var cy = charRect.top + charRect.height / 2;
        return cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
    }
    if (!boyEl.classList.contains("hidden") && centerInRect(boyEl.getBoundingClientRect(), petRect)) triggerHug(petEl.id, "boyPet");
    else if (!girlEl.classList.contains("hidden") && centerInRect(girlEl.getBoundingClientRect(), petRect)) triggerHug(petEl.id, "girlPet");
}

function resumePetWalking(petId) {
    if (petId === 'maoPet') startMaoWalking();
    else if (petId === 'dogPet') startDogWalking();
}

function moveCharacterWithPet(characterId, pet) {
    const character = document.getElementById(characterId);
    const petX = parseFloat(pet.style.left) || 0;
    const petY = parseFloat(pet.style.top) || 0;
    const charW = character.offsetWidth;
    const charH = character.offsetHeight;
    let charX = petX + pet.offsetWidth / 2 - charW / 2;
    let charY = petY + pet.offsetHeight / 2 - charH * 0.55;
    charX = Math.max(0, Math.min(window.innerWidth - charW, charX));
    charY = Math.max(0, Math.min(window.innerHeight - charH, charY));
    character.style.left = charX + "px";
    character.style.top = charY + "px";
    character.style.right = "auto";
    character.style.bottom = "auto";
    character.style.transition = "none";
}

// ============ 导出 ============
window.initMao = initMao;
window.startMaoWalking = startMaoWalking;
window.petMao = petMao;
window.spawnMaoHeart = spawnMaoHeart;
window.initDog = initDog;
window.startDogWalking = startDogWalking;
window.petDog = petDog;
window.spawnDogHeart = spawnDogHeart;
window.bindPetDrag = bindPetDrag;
window.rectsOverlap = rectsOverlap;
window.triggerHug = triggerHug;
window.syncHugPet = syncHugPet;
window.releaseHug = releaseHug;
window.showHugHeart = showHugHeart;
window.checkHugOnDrop = checkHugOnDrop;
window.resumePetWalking = resumePetWalking;
window.moveCharacterWithPet = moveCharacterWithPet;
