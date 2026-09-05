/**
 * 宠物动画
 * 哈士奇与暹罗猫的 Canvas 渲染、拖拽、抱抱交互
 */

window.boyHugging = false;
window.girlHugging = false;

const huskyPhrases = ["汪汪！", "陪我玩嘛~", "摸摸我！", "好开心！", "汪~", "爱你哟", "今天也元气满满！", "主人最好了"];
let huskyWalkingTimer = null;
let huskyDragging = false;

function initHusky() {
    document.getElementById("huskyPet").classList.remove("hidden");
    startHuskyWalking();
}

function startHuskyWalking() {
    if (huskyWalkingTimer) clearInterval(huskyWalkingTimer);
    huskyWalkingTimer = setInterval(() => {
        if (huskyDragging) return;
        const pet = document.getElementById("huskyPet");
        const curLeft = parseInt(pet.style.left) || 20;
        const move = Math.random() > 0.5 ? 30 : -30;
        let newLeft = curLeft + move;
        newLeft = Math.max(10, Math.min(window.innerWidth - 110, newLeft));
        pet.style.left = newLeft + "px";
        pet.classList.add("walking");
        pet.style.transform = move < 0 ? "scaleX(-1)" : "scaleX(1)";
        setTimeout(() => pet.classList.remove("walking"), 2000);
    }, 8000);
}

function petHusky() {
    if (huskyDragging) return;
    const pet = document.getElementById("huskyPet");
    pet.classList.add("happy");
    setTimeout(() => pet.classList.remove("happy"), 500);

    const bubble = document.getElementById("huskyBubble");
    bubble.innerText = huskyPhrases[Math.floor(Math.random() * huskyPhrases.length)];
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), 2000);

    const tongue = document.getElementById("huskyTongue");
    tongue.style.display = "block";
    setTimeout(() => tongue.style.display = "none", 1500);

    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnHuskyHeart(), i * 150);
    }
}

function spawnHuskyHeart() {
    const pet = document.getElementById("huskyPet");
    const heart = document.createElement("i");
    heart.className = "fa fa-heart husky-heart";
    heart.style.left = (40 + Math.random() * 20) + "px";
    heart.style.top = "20px";
    heart.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    heart.style.animation = "heart-float 1.2s ease-out forwards";
    pet.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
}

function startDragHusky(e) {
    const pet = document.getElementById("huskyPet");
    const rect = pet.getBoundingClientRect();
    const isTouch = !!e.touches;
    const point = isTouch ? e.touches[0] : e;
    const startX = point.clientX;
    const startY = point.clientY;
    const offsetX = point.clientX - rect.left;
    const offsetY = point.clientY - rect.top;
    let hasMoved = false;
    const wasHugging = !!(hugState && hugState.petId === 'huskyPet');
    pet.style.transition = "none";

    function onMove(ev) {
        const pt = ev.touches ? ev.touches[0] : ev;
        if (ev.touches) ev.preventDefault();
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        if (!hasMoved && Math.abs(dx) + Math.abs(dy) > 5) {
            hasMoved = true;
            huskyDragging = true;
            if (wasHugging && hugState) {
                hugDragging = true;
                clearTimeout(hugState.timer);
            }
        }
        if (!hasMoved) return;
        let x = pt.clientX - offsetX;
        let y = pt.clientY - offsetY;
        x = Math.max(0, Math.min(window.innerWidth - pet.offsetWidth, x));
        y = Math.max(0, Math.min(window.innerHeight - pet.offsetHeight, y));
        pet.style.left = x + "px";
        pet.style.top = y + "px";
        pet.style.bottom = "auto";
        pet.style.transform = "scaleX(1)";
        if (hugDragging && hugState) {
            moveCharacterWithPet(hugState.characterId, pet);
        }
    }
    function onUp() {
        huskyDragging = false;
        hugDragging = false;
        pet.style.transition = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        if (!hasMoved) {
            petHusky();
        } else {
            if (hugState) {
                clearTimeout(hugState.timer);
                cancelAnimationFrame(hugState.rafId);
                if (hugState.characterId === 'boyPet') window.boyHugging = false;
                if (hugState.characterId === 'girlPet') window.girlHugging = false;
                hugState = null;
            }
            checkHugOnDrop(pet);
            if (!hugState) resumePetWalking("huskyPet");
        }
    }
    if (isTouch) e.preventDefault();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
}

const catPhrases = ["喵~", "呼噜呼噜", "别摸我！", "喵喵喵！", "本喵饿了", "喜欢你", "蹭蹭你", "喵呜~"];
let catWalkingTimer = null;
let catDragging = false;

function initCat() {
    document.getElementById("catPet").classList.remove("hidden");
    startCatWalking();
}

function startCatWalking() {
    if (catWalkingTimer) clearInterval(catWalkingTimer);
    catWalkingTimer = setInterval(() => {
        if (catDragging) return;
        const pet = document.getElementById("catPet");
        const curRight = window.innerWidth - (parseInt(pet.style.right) || 20) - 100;
        const move = Math.random() > 0.5 ? 30 : -30;
        let newRight = (parseInt(pet.style.right) || 20) - move;
        newRight = Math.max(10, Math.min(window.innerWidth - 110, newRight));
        pet.style.right = newRight + "px";
        pet.classList.add("walking");
        pet.style.transform = move > 0 ? "scaleX(-1)" : "scaleX(1)";
        setTimeout(() => pet.classList.remove("walking"), 2000);
    }, 9000);
}

function petCat() {
    if (catDragging) return;
    const pet = document.getElementById("catPet");
    pet.classList.add("happy");
    setTimeout(() => pet.classList.remove("happy"), 500);

    const bubble = document.getElementById("catBubble");
    bubble.innerText = catPhrases[Math.floor(Math.random() * catPhrases.length)];
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), 2000);

    const tongue = document.getElementById("catTongue");
    tongue.style.display = "block";
    setTimeout(() => tongue.style.display = "none", 1500);

    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnCatHeart(), i * 150);
    }
}

function spawnCatHeart() {
    const pet = document.getElementById("catPet");
    const heart = document.createElement("i");
    heart.className = "fa fa-heart husky-heart";
    heart.style.color = "#a78bfa";
    heart.style.left = (40 + Math.random() * 20) + "px";
    heart.style.top = "20px";
    heart.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    heart.style.animation = "heart-float 1.2s ease-out forwards";
    pet.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
}

function startDragCat(e) {
    const pet = document.getElementById("catPet");
    const rect = pet.getBoundingClientRect();
    const isTouch = !!e.touches;
    const point = isTouch ? e.touches[0] : e;
    const startX = point.clientX;
    const startY = point.clientY;
    const offsetX = point.clientX - rect.left;
    const offsetY = point.clientY - rect.top;
    let hasMoved = false;
    const wasHugging = !!(hugState && hugState.petId === 'catPet');
    pet.style.transition = "none";

    function onMove(ev) {
        const pt = ev.touches ? ev.touches[0] : ev;
        if (ev.touches) ev.preventDefault();
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        if (!hasMoved && Math.abs(dx) + Math.abs(dy) > 5) {
            hasMoved = true;
            catDragging = true;
            if (wasHugging && hugState) {
                hugDragging = true;
                clearTimeout(hugState.timer);
            }
        }
        if (!hasMoved) return;
        let x = pt.clientX - offsetX;
        let y = pt.clientY - offsetY;
        x = Math.max(0, Math.min(window.innerWidth - pet.offsetWidth, x));
        y = Math.max(0, Math.min(window.innerHeight - pet.offsetHeight, y));
        pet.style.left = x + "px";
        pet.style.top = y + "px";
        pet.style.right = "auto";
        pet.style.bottom = "auto";
        pet.style.transform = "scaleX(1)";
        if (hugDragging && hugState) {
            moveCharacterWithPet(hugState.characterId, pet);
        }
    }
    function onUp() {
        catDragging = false;
        hugDragging = false;
        pet.style.transition = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        if (!hasMoved) {
            petCat();
        } else {
            if (hugState) {
                clearTimeout(hugState.timer);
                cancelAnimationFrame(hugState.rafId);
                if (hugState.characterId === 'boyPet') window.boyHugging = false;
                if (hugState.characterId === 'girlPet') window.girlHugging = false;
                hugState = null;
            }
            checkHugOnDrop(pet);
            if (!hugState) resumePetWalking("catPet");
        }
    }
    if (isTouch) e.preventDefault();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
}

const maoGreetPhrases = ["你好呀~", "喵！打招呼", "好久不见！", "来摸摸我", "喵呜~"];
let maoWalkingTimer = null;
let maoDragging = false;
let maoGreetingTimer = null;
let maoGreetingActive = false;

function initMao() {
    document.getElementById("maoPet").classList.remove("hidden");
    startMaoWalking();
}

function maoSetWalking(walking) {
    if (maoGreetingActive) return;
    const img = document.getElementById("maoImg");
    if (!img) return;
    img.src = walking
        ? "images/猫-行走.gif?t=" + Date.now()
        : "images/猫-待机.gif?t=" + Date.now();
}

function maoPlayGreeting(duration) {
    if (maoGreetingTimer) clearTimeout(maoGreetingTimer);
    maoGreetingActive = true;
    const img = document.getElementById("maoImg");
    if (img) img.src = "images/猫-打招呼.gif?t=" + Date.now();
    maoGreetingTimer = setTimeout(() => {
        maoGreetingActive = false;
        maoSetWalking(false);
    }, duration || 2000);
}

function startMaoWalking() {
    if (maoWalkingTimer) clearInterval(maoWalkingTimer);
    maoWalkingTimer = setInterval(() => {
        if (maoDragging) return;
        const pet = document.getElementById("maoPet");
        const curLeft = parseInt(pet.style.left) || 130;
        const move = Math.random() > 0.5 ? 30 : -30;
        let newLeft = curLeft + move;
        newLeft = Math.max(10, Math.min(window.innerWidth - 110, newLeft));
        pet.style.left = newLeft + "px";
        pet.style.right = "auto";
        pet.style.transform = move < 0 ? "scaleX(-1)" : "scaleX(1)";
        maoSetWalking(true);
        setTimeout(() => maoSetWalking(false), 2000);
    }, 9000);
}

function petMao() {
    if (maoDragging) return;
    const pet = document.getElementById("maoPet");
    pet.classList.add("happy");
    setTimeout(() => pet.classList.remove("happy"), 500);

    // 打招呼动画 2 秒后恢复待机
    maoPlayGreeting(2000);

    const bubble = document.getElementById("maoBubble");
    bubble.innerText = maoGreetPhrases[Math.floor(Math.random() * maoGreetPhrases.length)];
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), 2000);

    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnMaoHeart(), i * 150);
    }
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

function startDragMao(e) {
    if (maoGreetingTimer) { clearTimeout(maoGreetingTimer); maoGreetingTimer = null; }
    maoGreetingActive = false;
    const pet = document.getElementById("maoPet");
    const rect = pet.getBoundingClientRect();
    const isTouch = !!e.touches;
    const point = isTouch ? e.touches[0] : e;
    const startX = point.clientX;
    const startY = point.clientY;
    const offsetX = point.clientX - rect.left;
    const offsetY = point.clientY - rect.top;
    let hasMoved = false;
    const wasHugging = !!(hugState && hugState.petId === 'maoPet');
    pet.style.transition = "none";

    function onMove(ev) {
        const pt = ev.touches ? ev.touches[0] : ev;
        if (ev.touches) ev.preventDefault();
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        if (!hasMoved && Math.abs(dx) + Math.abs(dy) > 5) {
            hasMoved = true;
            maoDragging = true;
            if (wasHugging && hugState) {
                hugDragging = true;
                clearTimeout(hugState.timer);
            }
        }
        if (!hasMoved) return;
        let x = pt.clientX - offsetX;
        let y = pt.clientY - offsetY;
        x = Math.max(0, Math.min(window.innerWidth - pet.offsetWidth, x));
        y = Math.max(0, Math.min(window.innerHeight - pet.offsetHeight, y));
        pet.style.left = x + "px";
        pet.style.top = y + "px";
        pet.style.right = "auto";
        pet.style.bottom = "auto";
        pet.style.transform = "scaleX(1)";
        if (hugDragging && hugState) {
            moveCharacterWithPet(hugState.characterId, pet);
        }
    }
    function onUp() {
        maoDragging = false;
        hugDragging = false;
        pet.style.transition = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        if (!hasMoved) {
            petMao();
        } else {
            if (hugState) {
                clearTimeout(hugState.timer);
                cancelAnimationFrame(hugState.rafId);
                if (hugState.characterId === 'boyPet') window.boyHugging = false;
                if (hugState.characterId === 'girlPet') window.girlHugging = false;
                hugState = null;
            }
            checkHugOnDrop(pet);
            if (!hugState) resumePetWalking("maoPet");
        }
    }
    if (isTouch) e.preventDefault();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
}

let hugState = null;
let hugDragging = false;

function rectsOverlap(a, b) {
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function triggerHug(petId, characterId) {
    const pet = document.getElementById(petId);
    const character = document.getElementById(characterId);

    if (petId === 'huskyPet' && huskyWalkingTimer) clearInterval(huskyWalkingTimer);
    if (petId === 'catPet' && catWalkingTimer) clearInterval(catWalkingTimer);
    if (petId === 'maoPet' && maoWalkingTimer) clearInterval(maoWalkingTimer);

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
    pet.style.transition = "none";
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
    if (!boyEl.classList.contains("hidden") && rectsOverlap(petRect, boyEl.getBoundingClientRect())) {
        triggerHug(petEl.id, "boyPet");
    } else if (!girlEl.classList.contains("hidden") && rectsOverlap(petRect, girlEl.getBoundingClientRect())) {
        triggerHug(petEl.id, "girlPet");
    }
}

function resumePetWalking(petId) {
    const pet = document.getElementById(petId);
    if (petId === 'huskyPet') {
        startHuskyWalking();
    } else if (petId === 'catPet') {
        const curLeft = parseInt(pet.style.left) || 0;
        pet.style.right = Math.max(10, window.innerWidth - curLeft - pet.offsetWidth) + "px";
        pet.style.left = "auto";
        startCatWalking();
    } else if (petId === 'maoPet') {
        startMaoWalking();
    }
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

window.initHusky = initHusky;
window.startHuskyWalking = startHuskyWalking;
window.petHusky = petHusky;
window.spawnHuskyHeart = spawnHuskyHeart;
window.startDragHusky = startDragHusky;
window.initCat = initCat;
window.startCatWalking = startCatWalking;
window.petCat = petCat;
window.spawnCatHeart = spawnCatHeart;
window.startDragCat = startDragCat;
window.initMao = initMao;
window.startMaoWalking = startMaoWalking;
window.petMao = petMao;
window.spawnMaoHeart = spawnMaoHeart;
window.startDragMao = startDragMao;
window.rectsOverlap = rectsOverlap;
window.triggerHug = triggerHug;
window.syncHugPet = syncHugPet;
window.releaseHug = releaseHug;
window.showHugHeart = showHugHeart;
window.checkHugOnDrop = checkHugOnDrop;
window.resumePetWalking = resumePetWalking;
window.moveCharacterWithPet = moveCharacterWithPet;