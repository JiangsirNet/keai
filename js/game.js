/**
 * 猜拳对战
 * 石头剪刀布实时对战（Supabase Realtime）、分数记录
 */

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
        window.lbInit();
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

})();
