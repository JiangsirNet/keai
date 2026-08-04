(function() {
const sb = window.sb;
const CONFIG = window.CONFIG;
const sfxPlay = window.sfxPlay || function(){};
const sfxWaterHit = window.sfxWaterHit || function(){};
const sfxEmptyClick = window.sfxEmptyClick || function(){};
const toggleBgm = window.toggleBgm || function(){};

// ==================== 石头剪刀布对战 ====================
let rpsChannel = null;
let myRpsPick = null;
let partnerRpsPick = null;
let myRpsScore = 0;
let partnerRpsScore = 0;
const rpsEmoji = { rock: "✊", paper: "✋", scissors: "✌️" };
const rpsBeats = { rock: "scissors", paper: "rock", scissors: "paper" };

let myRpsEmail = "";

function initRpsGame() {
    sb.auth.getUser().then(({ data: { user } }) => {
        myRpsEmail = (user?.email || "").toLowerCase();
        window.myRpsEmail = myRpsEmail;
        const boyEmail = (CONFIG.boyEmail || "").toLowerCase();
        const girlEmail = (CONFIG.girlEmail || "").toLowerCase();
        const isBoy = myRpsEmail && myRpsEmail === boyEmail;
        const isGirl = myRpsEmail && myRpsEmail === girlEmail;
        const myName = isGirl ? CONFIG.girlName : CONFIG.boyName;
        const partnerName = isGirl ? CONFIG.boyName : CONFIG.girlName;
        document.getElementById("myNameLabel").textContent = myName;
        document.getElementById("partnerNameLabel").textContent = partnerName;

        const saved = JSON.parse(localStorage.getItem("rpsScore") || "{}");
        myRpsScore = saved.my || 0;
        partnerRpsScore = saved.partner || 0;
        updateRpsScore();

        rpsChannel = sb.channel("rps-game");

        rpsChannel
            .on("broadcast", { event: "pick" }, ({ payload }) => {
                partnerRpsPick = payload.pick;
                checkRpsResult();
            })
            .on("broadcast", { event: "reset" }, () => {
                myRpsScore = 0; partnerRpsScore = 0;
                saveRpsScore(); updateRpsScore();
                document.getElementById("gameStatus").textContent = "比分已重置！";
            })
            .on("presence", { event: "sync" }, () => {
                const state = rpsChannel.presenceState();
                const el = document.getElementById("partnerOnline");
                const partnerOnline = Object.values(state).some(
                    arr => arr.some(p => p.user && p.user.toLowerCase() !== myRpsEmail)
                );
                if (partnerOnline) {
                    el.textContent = "对方在线";
                    el.className = "ml-auto text-sm font-normal text-green-500";
                } else {
                    el.textContent = "对方离线";
                    el.className = "ml-auto text-sm font-normal text-gray-400";
                }
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await rpsChannel.track({ user: myRpsEmail });
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    console.error("RPS频道连接失败:", status);
                }
            });
        lbInit();
    });
}

function rpsPick(pick) {
    if (myRpsPick) return;
    myRpsPick = pick;
    document.getElementById("myChoice").textContent = rpsEmoji[pick];
    document.getElementById("myChoice").classList.remove("opacity-30");
    document.getElementById("gameStatus").textContent = "已出招，等待对方...";
    rpsChannel.send({ type: "broadcast", event: "pick", payload: { pick } });
    checkRpsResult();
}

function checkRpsResult() {
    if (!myRpsPick || !partnerRpsPick) return;
    document.getElementById("partnerChoice").textContent = rpsEmoji[partnerRpsPick];
    document.getElementById("partnerChoice").classList.remove("opacity-30");

    let result;
    if (myRpsPick === partnerRpsPick) {
        result = "平局！";
    } else if (rpsBeats[myRpsPick] === partnerRpsPick) {
        result = "你赢了！🎉";
        myRpsScore++;
    } else {
        result = "你输了 💔";
        partnerRpsScore++;
    }
    saveRpsScore();
    updateRpsScore();
    document.getElementById("gameStatus").textContent = result;

    setTimeout(() => {
        myRpsPick = null;
        partnerRpsPick = null;
        document.getElementById("myChoice").textContent = "✊";
        document.getElementById("myChoice").classList.add("opacity-30");
        document.getElementById("partnerChoice").textContent = "❓";
        document.getElementById("partnerChoice").classList.add("opacity-30");
        document.getElementById("gameStatus").textContent = "继续出招！";
    }, 2500);
}

function updateRpsScore() {
    document.getElementById("myScore").textContent = myRpsScore;
    document.getElementById("partnerScore").textContent = partnerRpsScore;
}

function saveRpsScore() {
    localStorage.setItem("rpsScore", JSON.stringify({ my: myRpsScore, partner: partnerRpsScore }));
}

function rpsReset() {
    myRpsScore = 0; partnerRpsScore = 0;
    saveRpsScore(); updateRpsScore();
    if (rpsChannel) rpsChannel.send({ type: "broadcast", event: "reset", payload: {} });
    document.getElementById("gameStatus").textContent = "比分已重置！";
}

// ==================== 骗子酒馆 ====================
let lbChannel = null;
let lbPhase = "idle";
let lbMyHP = 1, lbPartnerHP = 1;
let lbBulletPos = 0;
let lbChamber = 1;
let lbMyCards = [];
let lbTargetRank = "";
let lbSelected = [];
let lbPartnerPlayedCards = [];
let lbMyPlayedCards = [];
let lbMyTurn = false;
let lbIsInitiator = false;
let lbSessionId = Date.now() + "-" + Math.random().toString(36).substr(2, 9);
let partnerLbSession = null;
const lbRanks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const lbSuits = ["♠","♥","♦","♣"];
const lbRedSuits = ["♥","♦"];

function lbInit() {
    const isGirl = myRpsEmail === (CONFIG.girlEmail || "").toLowerCase();
    document.getElementById("lbMyName").textContent = isGirl ? CONFIG.girlName : CONFIG.boyName;
    document.getElementById("lbPartnerName").textContent = isGirl ? CONFIG.boyName : CONFIG.girlName;

    lbChannel = sb.channel("liar-bar", { config: { broadcast: { self: false } } });
    lbChannel
        .on("broadcast", { event: "invite" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            if (payload.sid) partnerLbSession = payload.sid;
            document.getElementById("lbMessage").textContent = "收到对方邀请！";
            const a = document.getElementById("lbActions");
            a.innerHTML = "";
            const btn = lbEnsureStartBtn();
            btn.textContent = "接受邀请";
            btn.onclick = lbAccept;
            btn.classList.remove("hidden");
            btn.disabled = false;
            a.appendChild(btn);
            lbIsInitiator = false;
        })
        .on("broadcast", { event: "accept" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbBeginGame(true);
        })
        .on("broadcast", { event: "play" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbPartnerPlayedCards = payload.cards;
            lbRenderPartnerPlayed(false);
            document.getElementById("lbMessage").textContent = `对方出了${payload.cards.length}张牌，声称都是「${lbTargetRank}」`;
            lbShowRespondButtons();
        })
        .on("broadcast", { event: "call" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbDoReveal("partner");
        })
        .on("broadcast", { event: "believe" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbPartnerPlayedCards = [];
            lbRenderPartnerPlayed(false);
            lbMyTurn = false;
            document.getElementById("lbMessage").textContent = "对方相信了，等待对方出牌...";
            lbShowWaitButtons();
        })
        .on("broadcast", { event: "newRound" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbTargetRank = payload.rank;
            lbMyTurn = !payload.first;
            lbPartnerPlayedCards = [];
            lbSelected = [];
            lbMyCards = lbDealCardsWithTarget(5, lbTargetRank);
            lbUpdateTargetRank();
            lbRenderHand();
            lbRenderPartnerPlayed(false);
            if (lbMyTurn) {
                document.getElementById("lbMessage").textContent = `新一轮！目标：${lbTargetRank}，轮到你出牌`;
                lbShowPlayButtons();
            } else {
                document.getElementById("lbMessage").textContent = `新一轮！目标：${lbTargetRank}，等待对方出牌...`;
                lbShowWaitButtons();
            }
        })
        .on("broadcast", { event: "gameOver" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbPhase = "gameOver";
            document.getElementById("lbMessage").textContent = "你赢了！🎉";
            const a = document.getElementById("lbActions");
            a.innerHTML = "";
            const btn = lbEnsureStartBtn();
            btn.textContent = "再来一局";
            btn.onclick = lbStart;
            btn.classList.remove("hidden");
            btn.disabled = false;
            a.appendChild(btn);
        })
        .on("broadcast", { event: "trigger" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbChamber = payload.chamber + 1;
            const isMe = payload.emptyWin ? true : false;
            lbShowTriggerAnim(payload.hit, isMe);
        })
        .on("broadcast", { event: "revolver" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            lbBulletPos = payload.bullet;
            lbChamber = 1;
        })
        .on("presence", { event: "sync" }, () => {
            const state = lbChannel.presenceState();
            let partnerOnline = false;
            let latestPartnerSid = null;
            Object.values(state).forEach(arr => {
                arr.forEach(p => {
                    if (p.user && p.user.toLowerCase() !== myRpsEmail) {
                        partnerOnline = true;
                        if (p.sid) latestPartnerSid = p.sid;
                    }
                });
            });
            if (latestPartnerSid) partnerLbSession = latestPartnerSid;
            if (!partnerOnline && lbPhase !== "idle") {
                const wasPlaying = lbPhase === "playing";
                lbResetToIdle(wasPlaying ? "对方已掉线，游戏终止" : "对方已掉线");
            }
        })
        .on("broadcast", { event: "quit" }, ({ payload }) => {
            if (payload.from === myRpsEmail) return;
            if (partnerLbSession && payload.sid !== partnerLbSession) return;
            if (lbPhase !== "idle") {
                const wasPlaying = lbPhase === "playing";
                lbResetToIdle(wasPlaying ? "对方已离开，游戏终止" : "对方已离开");
            }
        })
        .subscribe(async (status) => {
            if (status === "SUBSCRIBED") await lbChannel.track({ user: myRpsEmail, sid: lbSessionId });
        });

    window.addEventListener("beforeunload", () => {
        if (lbChannel && lbPhase !== "idle") {
            try {
                lbChannel.send({ type: "broadcast", event: "quit", payload: { from: myRpsEmail, sid: lbSessionId } });
            } catch (e) {}
        }
    });
}

function lbStart() {
    lbChannel.send({ type: "broadcast", event: "invite", payload: { from: myRpsEmail, sid: lbSessionId } });
    document.getElementById("lbMessage").textContent = "已发送邀请，等待对方接受...";
    document.getElementById("lbStartBtn").textContent = "等待中...";
    document.getElementById("lbStartBtn").disabled = true;
    lbIsInitiator = true;
    lbPhase = "inviting";
}

function lbAccept() {
    lbChannel.send({ type: "broadcast", event: "accept", payload: { from: myRpsEmail } });
    lbBeginGame(false);
}

function lbBeginGame(iStart) {
    lbPhase = "playing";
    lbMyHP = 1; lbPartnerHP = 1;
    lbBulletPos = Math.floor(Math.random() * 3) + 1;
    lbChamber = 1;
    lbChannel.send({ type: "broadcast", event: "revolver", payload: { bullet: lbBulletPos, from: myRpsEmail } });
    lbTargetRank = lbRanks[Math.floor(Math.random() * lbRanks.length)];
    lbMyCards = lbDealCardsWithTarget(5, lbTargetRank);
    lbMyTurn = iStart;
    lbSelected = [];
    lbPartnerPlayedCards = [];
    document.getElementById("lbStartBtn").classList.add("hidden");
    lbUpdateHP();
    lbUpdateTargetRank();
    lbRenderHand();
    lbRenderPartnerPlayed(false);
    if (lbMyTurn) {
        document.getElementById("lbMessage").textContent = `游戏开始！目标：${lbTargetRank}，你先出牌`;
        lbShowPlayButtons();
    } else {
        document.getElementById("lbMessage").textContent = `游戏开始！目标：${lbTargetRank}，等待对方出牌...`;
        lbShowWaitButtons();
    }
    if (iStart) {
        lbChannel.send({ type: "broadcast", event: "newRound", payload: { rank: lbTargetRank, first: true, from: myRpsEmail } });
    }
}

function lbDealCards(n) {
    const cards = [];
    for (let i = 0; i < n; i++) {
        cards.push({
            rank: lbRanks[Math.floor(Math.random() * lbRanks.length)],
            suit: lbSuits[Math.floor(Math.random() * 4)]
        });
    }
    return cards;
}

function lbDealCardsWithTarget(n, targetRank) {
    const cards = lbDealCards(n);
    cards.forEach(c => {
        if (Math.random() < 0.3) {
            c.rank = targetRank;
            c.suit = lbSuits[Math.floor(Math.random() * 4)];
        }
    });
    let targetCount = cards.filter(c => c.rank === targetRank).length;
    while (targetCount > 4) {
        const idx = cards.findIndex(c => c.rank === targetRank);
        cards[idx].rank = lbRanks[Math.floor(Math.random() * lbRanks.length)];
        cards[idx].suit = lbSuits[Math.floor(Math.random() * 4)];
        if (cards[idx].rank === targetRank) cards[idx].rank = lbRanks[0];
        targetCount = cards.filter(c => c.rank === targetRank).length;
    }
    const hasTarget = cards.some(c => c.rank === targetRank);
    if (!hasTarget) {
        const idx = Math.floor(Math.random() * n);
        cards[idx].rank = targetRank;
        cards[idx].suit = lbSuits[Math.floor(Math.random() * 4)];
    }
    return cards;
}

function lbRenderHand() {
    const wrap = document.getElementById("lbMyHand");
    wrap.innerHTML = "";
    lbMyCards.forEach((c, i) => {
        const div = document.createElement("div");
        const isRed = lbRedSuits.includes(c.suit);
        div.className = `lb-card face-up ${isRed ? "red" : ""} ${lbSelected.includes(i) ? "selected" : ""}`;
        div.innerHTML = `<span>${c.suit}</span><span>${c.rank}</span>`;
        div.onclick = () => {
            if (!lbMyTurn || lbPhase !== "playing") return;
            const idx = lbSelected.indexOf(i);
            if (idx >= 0) lbSelected.splice(idx, 1);
            else if (lbSelected.length < 3) lbSelected.push(i);
            lbRenderHand();
        };
        wrap.appendChild(div);
    });
}

function lbRenderPartnerPlayed(reveal) {
    const wrap = document.getElementById("lbPartnerPlayed");
    wrap.innerHTML = "";
    if (lbPartnerPlayedCards.length === 0) return;
    lbPartnerPlayedCards.forEach(c => {
        const div = document.createElement("div");
        if (reveal) {
            const isRed = lbRedSuits.includes(c.suit);
            div.className = `lb-card face-up played ${isRed ? "red" : ""}`;
            div.innerHTML = `<span>${c.suit}</span><span>${c.rank}</span>`;
        } else {
            div.className = "lb-card face-down played";
        }
        wrap.appendChild(div);
    });
}

function lbPlay() {
    if (lbSelected.length === 0) return alert("请选择1-3张牌");
    sfxPlay();
    const played = lbSelected.map(i => lbMyCards[i]);
    lbMyPlayedCards = played;
    lbChannel.send({ type: "broadcast", event: "play", payload: { cards: played, from: myRpsEmail } });
    lbSelected.sort((a, b) => b - a).forEach(i => lbMyCards.splice(i, 1));
    lbSelected = [];
    lbRenderHand();
    if (lbMyCards.length === 0) {
        lbMyTurn = false;
        document.getElementById("lbMessage").textContent = "你打完所有牌！对方接受水枪惩罚 🔫";
        lbShowWaitButtons();
        setTimeout(() => {
            const hit = lbChamber === lbBulletPos;
            lbChannel.send({ type: "broadcast", event: "trigger", payload: { from: myRpsEmail, chamber: lbChamber, hit, emptyWin: true } });
            lbShowTriggerAnim(hit, false);
        }, 1200);
        return;
    }
    lbMyTurn = false;
    document.getElementById("lbMessage").textContent = "已出牌，等待对方回应...";
    lbShowWaitButtons();
}

function lbCall() {
    lbChannel.send({ type: "broadcast", event: "call", payload: { from: myRpsEmail } });
    lbDoReveal("me");
}

function lbBelieve() {
    lbChannel.send({ type: "broadcast", event: "believe", payload: { from: myRpsEmail } });
    lbPartnerPlayedCards = [];
    lbRenderPartnerPlayed(false);
    lbMyTurn = true;
    document.getElementById("lbMessage").textContent = "你相信了，现在轮到你出牌！";
    lbShowPlayButtons();
}

function lbDoReveal(caller) {
    let allMatch, loserIsMe, iStartNext;
    if (caller === "me") {
        lbRenderPartnerPlayed(true);
        allMatch = lbPartnerPlayedCards.every(c => c.rank === lbTargetRank);
        loserIsMe = allMatch;
        iStartNext = !allMatch;
        document.getElementById("lbMessage").textContent = allMatch
            ? "对方说真话！你被水枪瞄准..." : "对方在骗人！TA被水枪瞄准...";
    } else {
        lbShowMyPlayedRevealed();
        allMatch = lbMyPlayedCards.every(c => c.rank === lbTargetRank);
        loserIsMe = !allMatch;
        iStartNext = allMatch;
        document.getElementById("lbMessage").textContent = allMatch
            ? "我说了真话！对方被水枪瞄准..." : "我撒谎了！我被水枪瞄准...";
    }
    lbMyPlayedCards = [];
    document.getElementById("lbActions").innerHTML = `<span class="text-gray-400 text-sm py-2">🔫 等待扣扳机...</span>`;

    if (loserIsMe) {
        setTimeout(() => {
            const hit = lbChamber === lbBulletPos;
            lbChannel.send({ type: "broadcast", event: "trigger", payload: { from: myRpsEmail, chamber: lbChamber, hit } });
            lbShowTriggerAnim(hit, true);
        }, 1200);
    }
}

function lbShowTriggerAnim(hit, isMe) {
    const msg = document.getElementById("lbMessage");
    const actions = document.getElementById("lbActions");
    if (hit) {
        if (isMe) { lbMyHP--; } else { lbPartnerHP--; }
        lbUpdateHP();
        msg.innerHTML = `💥 <span class="text-blue-500 font-bold">滋！被水枪射中了！</span> 掉1血`;
        actions.innerHTML = `<span class="text-4xl">🔫💦</span>`;
        sfxWaterHit();
        lbBulletPos = Math.floor(Math.random() * 3) + 1;
        lbChamber = 1;
        lbChannel.send({ type: "broadcast", event: "revolver", payload: { bullet: lbBulletPos, from: myRpsEmail } });
    } else {
        lbChamber++;
        msg.innerHTML = `😤 <span class="text-gray-500">咔！空弹，逃过一劫~</span>`;
        actions.innerHTML = `<span class="text-4xl">🔫</span>`;
        sfxEmptyClick();
    }
    if (lbMyHP <= 0 || lbPartnerHP <= 0) {
        setTimeout(() => {
            const iWon = lbPartnerHP <= 0;
            lbChannel.send({ type: "broadcast", event: "gameOver", payload: { from: myRpsEmail } });
            lbPhase = "gameOver";
            document.getElementById("lbMessage").textContent = iWon ? "你赢了！🎉" : "你输了 💔";
            const a = document.getElementById("lbActions");
            a.innerHTML = "";
            const btn = lbEnsureStartBtn();
            btn.textContent = "再来一局";
            btn.onclick = lbStart;
            btn.classList.remove("hidden");
            btn.disabled = false;
            a.appendChild(btn);
        }, 1500);
    } else {
        const iStartNext = isMe ? true : false;
        if (isMe) {
            setTimeout(() => lbNewRound(iStartNext), 2500);
        }
    }
}

function lbShowMyPlayedRevealed() {
    const wrap = document.getElementById("lbPartnerPlayed");
    wrap.innerHTML = '<span class="text-xs text-gray-400 mr-2">我的牌:</span>';
    lbMyPlayedCards.forEach(c => {
        const div = document.createElement("div");
        const isRed = lbRedSuits.includes(c.suit);
        div.className = `lb-card face-up played ${isRed ? "red" : ""}`;
        div.innerHTML = `<span>${c.suit}</span><span>${c.rank}</span>`;
        wrap.appendChild(div);
    });
}

function lbNewRound(iStart) {
    lbTargetRank = lbRanks[Math.floor(Math.random() * lbRanks.length)];
    lbMyTurn = iStart;
    lbPartnerPlayedCards = [];
    lbSelected = [];
    lbMyCards = lbDealCardsWithTarget(5, lbTargetRank);
    lbUpdateTargetRank();
    lbRenderHand();
    lbRenderPartnerPlayed(false);
    lbChannel.send({ type: "broadcast", event: "newRound", payload: { rank: lbTargetRank, first: iStart, from: myRpsEmail } });
    if (iStart) {
        document.getElementById("lbMessage").textContent = `新一轮！目标：${lbTargetRank}，轮到你出牌`;
        lbShowPlayButtons();
    } else {
        document.getElementById("lbMessage").textContent = `新一轮！目标：${lbTargetRank}，等待对方出牌...`;
        lbShowWaitButtons();
    }
}

function lbUpdateHP() {
    document.getElementById("lbMyHP").textContent = lbMyHP > 0 ? "💧" : "🫧";
    document.getElementById("lbPartnerHP").textContent = lbPartnerHP > 0 ? "💧" : "🫧";
}

function lbEnsureStartBtn() {
    let btn = document.getElementById("lbStartBtn");
    if (!btn) {
        btn = document.createElement("button");
        btn.id = "lbStartBtn";
        btn.className = "bg-love hover:bg-loveDark text-white px-6 py-2 rounded-full transition-all";
    }
    return btn;
}

function lbResetToIdle(msg) {
    lbPhase = "idle";
    lbMyCards = [];
    lbSelected = [];
    lbPartnerPlayedCards = [];
    lbMyPlayedCards = [];
    lbMyTurn = false;
    lbTargetRank = "";
    document.getElementById("lbMessage").textContent = msg || "游戏已终止";
    document.getElementById("lbMyHand").innerHTML = "";
    document.getElementById("lbPartnerPlayed").innerHTML = "";
    const a = document.getElementById("lbActions");
    a.innerHTML = "";
    const btn = lbEnsureStartBtn();
    btn.textContent = "邀请对方开始";
    btn.onclick = lbStart;
    btn.classList.remove("hidden");
    btn.disabled = false;
    a.appendChild(btn);
    document.getElementById("lbTargetRank").textContent = "?";
    document.getElementById("lbTargetRank").className = "text-3xl font-bold text-gray-300";
}

function lbUpdateTargetRank() {
    const el = document.getElementById("lbTargetRank");
    el.textContent = lbTargetRank;
    el.className = "text-3xl font-bold " + (lbPhase === "playing" ? "text-love" : "text-gray-300");
}

function lbShowPlayButtons() {
    const a = document.getElementById("lbActions");
    a.innerHTML = `<button onclick="lbPlay()" class="bg-love hover:bg-loveDark text-white px-6 py-2 rounded-full transition">出牌</button>`;
}
function lbShowRespondButtons() {
    const a = document.getElementById("lbActions");
    a.innerHTML = `
        <button onclick="lbCall()" class="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-full transition">揭穿！</button>
        <button onclick="lbBelieve()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-full transition">相信</button>`;
}
function lbShowWaitButtons() {
    document.getElementById("lbActions").innerHTML = `<span class="text-gray-400 text-sm py-2">等待对方...</span>`;
}

window.myRpsEmail = myRpsEmail;

window.rpsChannel = rpsChannel;
window.myRpsPick = myRpsPick;
window.partnerRpsPick = partnerRpsPick;
window.myRpsScore = myRpsScore;
window.partnerRpsScore = partnerRpsScore;
window.rpsEmoji = rpsEmoji;
window.rpsBeats = rpsBeats;

window.initRpsGame = initRpsGame;
window.rpsPick = rpsPick;
window.checkRpsResult = checkRpsResult;
window.updateRpsScore = updateRpsScore;
window.saveRpsScore = saveRpsScore;
window.rpsReset = rpsReset;

window.lbChannel = lbChannel;
window.lbPhase = lbPhase;
window.lbMyHP = lbMyHP;
window.lbPartnerHP = lbPartnerHP;
window.lbBulletPos = lbBulletPos;
window.lbChamber = lbChamber;
window.lbMyCards = lbMyCards;
window.lbTargetRank = lbTargetRank;
window.lbSelected = lbSelected;
window.lbPartnerPlayedCards = lbPartnerPlayedCards;
window.lbMyPlayedCards = lbMyPlayedCards;
window.lbMyTurn = lbMyTurn;
window.lbIsInitiator = lbIsInitiator;
window.lbSessionId = lbSessionId;
window.partnerLbSession = partnerLbSession;
window.lbRanks = lbRanks;
window.lbSuits = lbSuits;
window.lbRedSuits = lbRedSuits;

window.lbInit = lbInit;
window.lbStart = lbStart;
window.lbAccept = lbAccept;
window.lbBeginGame = lbBeginGame;
window.lbDealCards = lbDealCards;
window.lbDealCardsWithTarget = lbDealCardsWithTarget;
window.lbRenderHand = lbRenderHand;
window.lbRenderPartnerPlayed = lbRenderPartnerPlayed;
window.lbPlay = lbPlay;
window.lbCall = lbCall;
window.lbBelieve = lbBelieve;
window.lbDoReveal = lbDoReveal;
window.lbShowTriggerAnim = lbShowTriggerAnim;
window.lbShowMyPlayedRevealed = lbShowMyPlayedRevealed;
window.lbNewRound = lbNewRound;
window.lbUpdateHP = lbUpdateHP;
window.lbEnsureStartBtn = lbEnsureStartBtn;
window.lbResetToIdle = lbResetToIdle;
window.lbUpdateTargetRank = lbUpdateTargetRank;
window.lbShowPlayButtons = lbShowPlayButtons;
window.lbShowRespondButtons = lbShowRespondButtons;
window.lbShowWaitButtons = lbShowWaitButtons;

})();