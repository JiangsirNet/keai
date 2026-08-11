/**
 * 女生 Live2D 风格人物形象
 * Canvas 渲染、表情切换、拖拽、抚摸、拥抱交互
 */

const girlPhrases = ["哼哼~", "干嘛呀", "抱抱", "亲亲", "讨厌啦", "喜欢你", "呜呜呜", "嘻嘻"];
let girlDragging = false;
let girlCanvas, girlCtx, girlImg = null, girlImgLoaded = false;
let girlEyeX = 0, girlEyeY = 0, girlTargetEyeX = 0, girlTargetEyeY = 0;
let girlBlinkTimer = 0, girlHappy = false, girlBreathPhase = 0;
window.girlHugging = false;
let girlLastClickTime = 0;

function initGirl() {
    document.getElementById("girlPet").classList.remove("hidden");
    girlCanvas = document.getElementById("girlCanvas");
    girlCtx = girlCanvas.getContext("2d");
    startGirlRenderLoop();
    addGirlEyeTracking();
}

function loadGirlImage() {
}

function addGirlEyeTracking() {
    const canvas = girlCanvas;
    const updateEyeTarget = (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2.5;
        const pt = e.touches ? e.touches[0] : e;
        const dx = (pt.clientX - cx) / rect.width;
        const dy = (pt.clientY - cy) / rect.height;
        girlTargetEyeX = Math.max(-1, Math.min(1, dx * 2));
        girlTargetEyeY = Math.max(-1, Math.min(1, dy * 2));
    };
    canvas.addEventListener("mousemove", updateEyeTarget);
    canvas.addEventListener("touchmove", updateEyeTarget, { passive: true });
    canvas.addEventListener("mouseleave", () => { girlTargetEyeX = 0; girlTargetEyeY = 0; });
}

function startGirlRenderLoop() {
    const render = () => {
        drawGirl();
        requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
}

function drawGirl() {
    const ctx = girlCtx;
    const W = girlCanvas.width;
    const H = girlCanvas.height;
    ctx.clearRect(0, 0, W, H);

    girlBreathPhase += 0.03;
    const breathScale = 1 + Math.sin(girlBreathPhase) * 0.015;

    girlBlinkTimer++;
    let blinking = false;
    const blinkCycle = 180;
    const blinkDuration = 8;
    const phase = girlBlinkTimer % blinkCycle;
    if (phase < blinkDuration) blinking = true;
    else if (phase > blinkCycle - blinkDuration) blinking = true;

    girlEyeX += (girlTargetEyeX - girlEyeX) * 0.1;
    girlEyeY += (girlTargetEyeY - girlEyeY) * 0.1;

    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 20, 55, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(breathScale, breathScale);
    ctx.translate(-W / 2, -H / 2);

    if (girlImgLoaded && girlImg) {
        const imgAspect = girlImg.width / girlImg.height;
        const canvasAspect = W / H;
        let drawW, drawH, offsetX, offsetY;
        if (imgAspect > canvasAspect) {
            drawW = W;
            drawH = W / imgAspect;
            offsetX = 0;
            offsetY = (H - drawH) / 2;
        } else {
            drawH = H;
            drawW = H * imgAspect;
            offsetX = (W - drawW) / 2;
            offsetY = 0;
        }
        ctx.drawImage(girlImg, offsetX, offsetY, drawW, drawH);
        drawGirlOverlay(ctx, W, H, blinking);
    } else {
        drawGirlFallback(ctx, W, H, blinking);
    }
    ctx.restore();
}

function drawGirlOverlay(ctx, W, H, blinking) {
    if (girlHappy) {
        ctx.fillStyle = "rgba(252,165,195,0.6)";
        ctx.beginPath();
        ctx.arc(W * 0.35, H * 0.55, 12, 0, Math.PI * 2);
        ctx.arc(W * 0.65, H * 0.55, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(190,24,93,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.62, 14, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
    }
}

function drawGirlFallback(ctx, W, H, blinking) {
    const cx = W / 2;
    const headR = 56;
    const headCY = H * 0.38;

    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.beginPath();
    ctx.ellipse(cx, H - 12, 45, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#3b2415";
    ctx.beginPath();
    ctx.moveTo(cx - headR - 4, headCY - 10);
    ctx.quadraticCurveTo(cx - headR - 14, headCY + 40, cx - headR + 6, H - 60);
    ctx.quadraticCurveTo(cx - headR + 14, H - 55, cx - headR + 20, H - 70);
    ctx.quadraticCurveTo(cx - headR + 10, headCY + 50, cx - headR + 2, headCY - 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + headR + 4, headCY - 10);
    ctx.quadraticCurveTo(cx + headR + 14, headCY + 40, cx + headR - 6, H - 60);
    ctx.quadraticCurveTo(cx + headR - 14, H - 55, cx + headR - 20, H - 70);
    ctx.quadraticCurveTo(cx + headR - 10, headCY + 50, cx + headR - 2, headCY - 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.roundRect(cx - 20, H - 50, 15, 38, 6);
    ctx.roundRect(cx + 5, H - 50, 15, 38, 6);
    ctx.fill();
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.ellipse(cx - 12, H - 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 13, H - 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyTop = headCY + headR - 8;
    const bodyBottom = H - 50;
    const grad = ctx.createLinearGradient(0, bodyTop, 0, bodyBottom);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#fef3f8");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#fbcfe8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 36, bodyTop + 8);
    ctx.quadraticCurveTo(cx - 40, bodyTop, cx - 28, bodyTop);
    ctx.lineTo(cx + 28, bodyTop);
    ctx.quadraticCurveTo(cx + 40, bodyTop, cx + 36, bodyTop + 8);
    ctx.lineTo(cx + 40, bodyBottom - 5);
    ctx.quadraticCurveTo(cx + 40, bodyBottom, cx + 35, bodyBottom);
    ctx.lineTo(cx - 35, bodyBottom);
    ctx.quadraticCurveTo(cx - 40, bodyBottom, cx - 40, bodyBottom - 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(cx - 9, bodyTop + 2);
    ctx.lineTo(cx, bodyTop + 12);
    ctx.lineTo(cx + 9, bodyTop + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#be185d";
    ctx.beginPath();
    ctx.arc(cx, bodyTop + 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(cx, bodyTop + 38);
    ctx.bezierCurveTo(cx - 9, bodyTop + 30, cx - 16, bodyTop + 38, cx, bodyTop + 50);
    ctx.bezierCurveTo(cx + 16, bodyTop + 38, cx + 9, bodyTop + 30, cx, bodyTop + 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(cx - 4, bodyTop + 38, 2.5, 1.5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fce0bd";
    ctx.fillRect(cx - 9, headCY + headR - 12, 18, 14);

    const headGrad = ctx.createRadialGradient(cx - 15, headCY - 15, 8, cx, headCY, headR);
    headGrad.addColorStop(0, "#fff0db");
    headGrad.addColorStop(1, "#ffd9a8");
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, headCY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#3b2415";
    ctx.beginPath();
    ctx.moveTo(cx - headR + 4, headCY - 8);
    ctx.arc(cx, headCY, headR + 3, Math.PI * 0.82, Math.PI * 1.0, false);
    ctx.arc(cx, headCY, headR + 3, Math.PI * 1.0, Math.PI * 0.18, false);
    ctx.quadraticCurveTo(cx + headR - 2, headCY - 14, cx + headR - 6, headCY - 8);
    ctx.quadraticCurveTo(cx + 24, headCY - headR + 24, cx + 8, headCY - headR + 18);
    ctx.quadraticCurveTo(cx, headCY - headR + 28, cx - 10, headCY - headR + 20);
    ctx.quadraticCurveTo(cx - 24, headCY - headR + 16, cx - headR + 8, headCY - 6);
    ctx.quadraticCurveTo(cx - headR + 4, headCY - 4, cx - headR + 4, headCY - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(120,80,50,0.6)";
    ctx.beginPath();
    ctx.ellipse(cx - 16, headCY - headR + 6, 9, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(cx - headR + 8, headCY - headR + 8);
    ctx.lineTo(cx - headR - 2, headCY - headR + 2);
    ctx.lineTo(cx - headR - 2, headCY - headR + 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - headR + 8, headCY - headR + 8);
    ctx.lineTo(cx - headR + 18, headCY - headR + 2);
    ctx.lineTo(cx - headR + 18, headCY - headR + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#be185d";
    ctx.beginPath();
    ctx.arc(cx - headR + 8, headCY - headR + 10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd9a8";
    ctx.beginPath();
    ctx.ellipse(cx - headR + 2, headCY + 8, 5, 8, -0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + headR - 2, headCY + 8, 5, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    const eyeLx = cx - 18, eyeRx = cx + 18, eyeY = headCY + 4;
    if (!blinking) {
        ctx.fillStyle = "#1a1a2e";
        const pLx = eyeLx + girlEyeX * 5;
        const pLy = eyeY + girlEyeY * 5;
        const pRx = eyeRx + girlEyeX * 5;
        const pRy = eyeY + girlEyeY * 5;
        ctx.beginPath();
        ctx.ellipse(pLx, pLy, 8, 10, 0, 0, Math.PI * 2);
        ctx.ellipse(pRx, pRy, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5b3a1a";
        ctx.beginPath();
        ctx.ellipse(pLx, pLy + 1, 6, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(pRx, pRy + 1, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(pLx - 2, pLy - 3, 3.5, 0, Math.PI * 2);
        ctx.arc(pRx - 2, pRy - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pLx + 2, pLy + 4, 1.5, 0, Math.PI * 2);
        ctx.arc(pRx + 2, pRy + 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pLx - 8, pLy - 6); ctx.lineTo(pLx - 10, pLy - 10);
        ctx.moveTo(pLx + 8, pLy - 6); ctx.lineTo(pLx + 11, pLy - 9);
        ctx.moveTo(pRx - 8, pRy - 6); ctx.lineTo(pRx - 11, pRy - 9);
        ctx.moveTo(pRx + 8, pRy - 6); ctx.lineTo(pRx + 10, pRy - 10);
        ctx.stroke();
    } else {
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(eyeLx - 8, eyeY);
        ctx.quadraticCurveTo(eyeLx, eyeY + 3, eyeLx + 8, eyeY);
        ctx.moveTo(eyeRx - 8, eyeY);
        ctx.quadraticCurveTo(eyeRx, eyeY + 3, eyeRx + 8, eyeY);
        ctx.stroke();
    }

    ctx.strokeStyle = "#3b2415";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(eyeLx - 8, eyeY - 16);
    ctx.quadraticCurveTo(eyeLx, eyeY - 19, eyeLx + 8, eyeY - 16);
    ctx.moveTo(eyeRx - 8, eyeY - 16);
    ctx.quadraticCurveTo(eyeRx, eyeY - 19, eyeRx + 8, eyeY - 16);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.arc(cx, eyeY + 13, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#be185d";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (girlHappy || window.girlHugging) {
        ctx.arc(cx, eyeY + 22, 9, 0.05 * Math.PI, 0.95 * Math.PI);
    } else {
        ctx.moveTo(cx - 6, eyeY + 22);
        ctx.quadraticCurveTo(cx, eyeY + 27, cx + 6, eyeY + 22);
    }
    ctx.stroke();
    if (!girlHappy) {
        ctx.fillStyle = "rgba(251,113,133,0.4)";
        ctx.beginPath();
        ctx.ellipse(cx, eyeY + 24, 4, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = "rgba(251,113,133,0.4)";
    ctx.beginPath();
    ctx.ellipse(eyeLx - 7, eyeY + 14, 10, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeRx + 7, eyeY + 14, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    if (window.girlHugging) {
        ctx.beginPath();
        ctx.moveTo(cx - 36, bodyTop + 14);
        ctx.quadraticCurveTo(cx - 28, bodyTop + 38, cx - 12, bodyTop + 42);
        ctx.stroke();
        ctx.strokeStyle = "#fbcfe8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(cx + 36, bodyTop + 14);
        ctx.quadraticCurveTo(cx + 28, bodyTop + 38, cx + 12, bodyTop + 42);
        ctx.stroke();
        ctx.strokeStyle = "#fbcfe8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#fce0bd";
        ctx.beginPath();
        ctx.arc(cx - 12, bodyTop + 42, 8, 0, Math.PI * 2);
        ctx.arc(cx + 12, bodyTop + 42, 8, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(cx - 36, bodyTop + 14);
        ctx.quadraticCurveTo(cx - 58, bodyTop + 40, cx - 50, bodyBottom - 8);
        ctx.stroke();
        ctx.strokeStyle = "#fbcfe8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(cx + 36, bodyTop + 14);
        ctx.quadraticCurveTo(cx + 58, bodyTop + 40, cx + 50, bodyBottom - 8);
        ctx.stroke();
        ctx.strokeStyle = "#fbcfe8";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#fce0bd";
        ctx.beginPath();
        ctx.arc(cx - 50, bodyBottom - 8, 8, 0, Math.PI * 2);
        ctx.arc(cx + 50, bodyBottom - 8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(cx + 43, bodyBottom - 22, 14, 3);
    }
}

function petGirl() {
    if (girlDragging) return;
    const now = Date.now();
    if (now - girlLastClickTime < 200) return;
    girlLastClickTime = now;

    const pet = document.getElementById("girlPet");
    pet.classList.add("happy");
    girlHappy = true;
    setTimeout(() => { pet.classList.remove("happy"); girlHappy = false; }, 800);

    const bubble = document.getElementById("girlBubble");
    const _pool = (window.girlDbQuotes || []).length ? window.girlDbQuotes : girlPhrases;
    bubble.innerText = _pool[Math.floor(Math.random() * _pool.length)];
    bubble.classList.add("show");
    setTimeout(() => bubble.classList.remove("show"), 2000);

    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnGirlHeart(), i * 150);
    }
}

function spawnGirlHeart() {
    const pet = document.getElementById("girlPet");
    const heart = document.createElement("i");
    heart.className = "fa fa-heart girl-heart";
    heart.style.left = (40 + Math.random() * 40) + "px";
    heart.style.top = "40px";
    heart.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
    heart.style.animation = "heart-float 1.2s ease-out forwards";
    pet.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
}

function startDragGirl(e) {
    const pet = document.getElementById("girlPet");
    const rect = pet.getBoundingClientRect();
    const isTouch = !!e.touches;
    const point = isTouch ? e.touches[0] : e;
    const startX = point.clientX;
    const startY = point.clientY;
    const offsetX = point.clientX - rect.left;
    const offsetY = point.clientY - rect.top;
    let hasMoved = false;
    pet.style.transition = "none";

    function onMove(ev) {
        const pt = ev.touches ? ev.touches[0] : ev;
        if (ev.touches) ev.preventDefault();
        const dx = pt.clientX - startX;
        const dy = pt.clientY - startY;
        if (!hasMoved && Math.abs(dx) + Math.abs(dy) > 5) {
            hasMoved = true;
            girlDragging = true;
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
    }
    function onUp() {
        girlDragging = false;
        pet.style.transition = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
        if (!hasMoved) petGirl();
    }
    if (isTouch) e.preventDefault();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
}

// ===== 导出女生 API =====
window.initGirl = initGirl;
window.petGirl = petGirl;
window.startDragGirl = startDragGirl;
window.loadGirlImage = loadGirlImage;
