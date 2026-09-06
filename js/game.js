/**
 * 游戏模块（跳一跳 + 飞机大战）
 * 跳一跳：iframe 加载 Jump-master，postMessage 收分数入库 game_scores(game='jump')，展示情侣排行榜。
 * 飞机大战：iframe 加载 plane-master，postMessage 收分数入库 game_scores(game='plane')，展示情侣排行榜。
 * 同时负责初始化骗子酒馆（game_liar.js 的 lbInit 依赖 window.myRpsEmail）。
 */

(function() {
const sb = window.sb;
const CONFIG = window.CONFIG;

let myUserId = "";
let myEmail = "";
let myNickname = "我";

function initJumpGame() {
    // 监听 iframe 内跳一跳上报的分数
    window.addEventListener("message", onJumpMessage);

    sb.auth.getUser().then(({ data: { user } }) => {
        myUserId = user?.id || "";
        myEmail = (user?.email || "").toLowerCase();
        window.myRpsEmail = myEmail; // 骗子酒馆依赖
        const isGirl = myEmail === (CONFIG.girlEmail || "").toLowerCase();
        myNickname = isGirl ? CONFIG.girlName : CONFIG.boyName;
        window.lbInit();
        loadJumpLeaderboard();
        loadPlaneLeaderboard();
    });
}

function onJumpMessage(e) {
    const d = e.data;
    if (!d) return;
    if (d.type === "jump_score") {
        const score = parseInt(d.score, 10) || 0;
        if (score > 0) saveJumpScore(score);
    } else if (d.type === "plane_score") {
        const score = parseInt(d.score, 10) || 0;
        if (score > 0) savePlaneScore(score);
    }
}

async function saveJumpScore(score) {
    if (!myUserId) return;
    try {
        // 查询双方最高分，判断是否超越对方的最高纪录
        const { data: rows, error: qErr } = await sb.from("game_scores")
            .select("user_id, score")
            .eq("game", "jump")
            .order("score", { ascending: false })
            .limit(100);
        if (qErr) throw qErr;
        let partnerBest = 0;
        (rows || []).forEach(r => {
            if (r.user_id !== myUserId && r.score > partnerBest) partnerBest = r.score;
        });
        const beatPartner = partnerBest > 0 && score > partnerBest;

        const { error } = await sb.from("game_scores")
            .insert({ game: "jump", user_id: myUserId, nickname: myNickname, score: score });
        if (error) throw error;
        // 站内铃铛每局都发；超越对方最高纪录时才发邮件（且受设置页邮件开关控制）
        if (window.sendNotification) {
            const content = beatPartner
                ? `🐸 跳一跳：${score} 分，超越 TA 的最高纪录 ${partnerBest}！`
                : `🐸 跳一跳得分：${score}`;
            window.sendNotification("game", content, beatPartner);
        }
        loadJumpLeaderboard();
    } catch (e) {
        console.warn("[Jump] 分数保存失败:", e);
    }
}

function jumpTogglePlay() {
    const area = document.getElementById("jumpPlayArea");
    const frame = document.getElementById("jumpFrame");
    const btn = document.getElementById("jumpStartBtn");
    if (!area || !frame || !btn) return;
    const isOpen = !area.classList.contains("hidden");
    if (isOpen) {
        area.classList.add("hidden");
        frame.src = "about:blank"; // 收起时卸载游戏，停掉渲染和音乐
        btn.innerHTML = '<i class="fa fa-play mr-1"></i>开始游戏';
    } else {
        frame.src = "Jump-master/index.html";
        area.classList.remove("hidden");
        btn.innerHTML = '<i class="fa fa-stop mr-1"></i>收起游戏';
        area.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

// 跳一跳全屏切换
function jumpToggleFullscreen() {
    const area = document.getElementById("jumpPlayArea");
    const frame = document.getElementById("jumpFrame");
    const btn = document.getElementById("jumpFullscreenBtn");
    if (!area || !frame || !btn) return;
    if (!document.fullscreenElement) {
        // 进入全屏：先确保游戏已打开
        if (area.classList.contains("hidden")) {
            frame.src = "Jump-master/index.html";
            area.classList.remove("hidden");
            const startBtn = document.getElementById("jumpStartBtn");
            if (startBtn) startBtn.innerHTML = '<i class="fa fa-stop mr-1"></i>收起游戏';
        }
        // 全屏样式：占满屏幕，去掉圆角/边框/外边距
        area.classList.add("jump-fullscreen");
        frame.style.height = "100%";
        area.requestFullscreen().then(() => {
            btn.innerHTML = '<i class="fa fa-compress"></i>';
            btn.title = "退出全屏";
        }).catch(() => {
            // 全屏失败（如 iframe 权限限制），回退为放大 iframe 高度
            frame.style.height = "85vh";
            btn.innerHTML = '<i class="fa fa-compress"></i>';
            btn.title = "还原高度";
        });
    } else {
        document.exitFullscreen().then(() => {
            btn.innerHTML = '<i class="fa fa-expand"></i>';
            btn.title = "全屏";
            frame.style.height = "";
            area.classList.remove("jump-fullscreen");
        });
    }
}

// 监听全屏退出（ESC 键等）
document.addEventListener("fullscreenchange", () => {
    const btn = document.getElementById("jumpFullscreenBtn");
    const area = document.getElementById("jumpPlayArea");
    const frame = document.getElementById("jumpFrame");
    if (btn && !document.fullscreenElement) {
        btn.innerHTML = '<i class="fa fa-expand"></i>';
        btn.title = "全屏";
        if (frame) frame.style.height = "";
        if (area) area.classList.remove("jump-fullscreen");
    }
});

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatJumpDate(s) {
    if (!s) return "";
    const d = new Date(s);
    const p = n => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}-${p(d.getDate())}`;
}

async function loadJumpLeaderboard() {
    const boardEl = document.getElementById("jumpBoard");
    if (!boardEl) return;
    try {
        const { data, error } = await sb.from("game_scores")
            .select("user_id, nickname, score, created_at")
            .eq("game", "jump")
            .order("score", { ascending: false })
            .limit(100);
        if (error) throw error;

        // 每人取最高分（数据已按分数降序，首次出现即最高）
        const best = new Map();
        (data || []).forEach(r => {
            if (r.user_id && !best.has(r.user_id)) best.set(r.user_id, r);
        });
        const rows = Array.from(best.values());

        // 标题栏显示我的最高分
        const mine = rows.find(r => r.user_id === myUserId);
        const mineEl = document.getElementById("jumpMyBest");
        if (mineEl) mineEl.textContent = mine ? `最高分 ${mine.score}` : "最高分 —";

        if (!rows.length) {
            boardEl.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">还没有记录，玩一局吧！</div>';
            return;
        }
        const medals = ["🥇", "🥈", "🥉"];
        boardEl.innerHTML = rows.map((r, i) => `
            <div class="flex items-center justify-between rounded-xl px-4 py-2.5 ${r.user_id === myUserId ? "bg-rose-50 border border-rose-200" : "bg-white/60 border border-gray-100"}">
                <div class="flex items-center gap-3">
                    <span class="text-lg w-7 text-center">${medals[i] || `<span class="text-gray-400 text-sm">${i + 1}</span>`}</span>
                    <span class="font-medium text-gray-700 text-sm">${escapeHtml(r.nickname || "神秘玩家")}</span>
                </div>
                <div class="text-right">
                    <span class="font-bold text-love">${r.score}</span>
                    <span class="text-[10px] text-gray-400 ml-2">${formatJumpDate(r.created_at)}</span>
                </div>
            </div>
        `).join("");
    } catch (e) {
        console.warn("[Jump] 排行榜加载失败:", e);
        boardEl.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">排行榜加载失败，请确认已创建 game_scores 表</div>';
    }
}

// 飞机大战：展开/收起
function planeTogglePlay() {
    const area = document.getElementById("planePlayArea");
    const frame = document.getElementById("planeFrame");
    const btn = document.getElementById("planeStartBtn");
    if (!area || !frame || !btn) return;
    const isOpen = !area.classList.contains("hidden");
    if (isOpen) {
        area.classList.add("hidden");
        frame.src = "about:blank";
        btn.innerHTML = '<i class="fa fa-play mr-1"></i>开始游戏';
    } else {
        frame.src = "plane-master/index.html";
        area.classList.remove("hidden");
        btn.innerHTML = '<i class="fa fa-stop mr-1"></i>收起游戏';
        area.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

// 飞机大战：全屏切换
function planeToggleFullscreen() {
    const area = document.getElementById("planePlayArea");
    const frame = document.getElementById("planeFrame");
    const btn = document.getElementById("planeFullscreenBtn");
    if (!area || !frame || !btn) return;
    if (!document.fullscreenElement) {
        if (area.classList.contains("hidden")) {
            frame.src = "plane-master/index.html";
            area.classList.remove("hidden");
            const startBtn = document.getElementById("planeStartBtn");
            if (startBtn) startBtn.innerHTML = '<i class="fa fa-stop mr-1"></i>收起游戏';
        }
        area.classList.add("jump-fullscreen");
        frame.style.height = "100%";
        area.requestFullscreen().then(() => {
            btn.innerHTML = '<i class="fa fa-compress"></i>';
            btn.title = "退出全屏";
        }).catch(() => {
            frame.style.height = "85vh";
            btn.innerHTML = '<i class="fa fa-compress"></i>';
            btn.title = "还原高度";
        });
    } else {
        document.exitFullscreen().then(() => {
            btn.innerHTML = '<i class="fa fa-expand"></i>';
            btn.title = "全屏";
            frame.style.height = "";
            area.classList.remove("jump-fullscreen");
        });
    }
}

// 飞机大战：保存分数
async function savePlaneScore(score) {
    if (!myUserId) return;
    try {
        const { data: rows, error: qErr } = await sb.from("game_scores")
            .select("user_id, score")
            .eq("game", "plane")
            .order("score", { ascending: false })
            .limit(100);
        if (qErr) throw qErr;
        let partnerBest = 0;
        (rows || []).forEach(r => {
            if (r.user_id !== myUserId && r.score > partnerBest) partnerBest = r.score;
        });
        const beatPartner = partnerBest > 0 && score > partnerBest;

        const { error } = await sb.from("game_scores")
            .insert({ game: "plane", user_id: myUserId, nickname: myNickname, score: score });
        if (error) throw error;
        if (window.sendNotification) {
            const content = beatPartner
                ? `✈️ 飞机大战：${score} 分，超越 TA 的最高纪录 ${partnerBest}！`
                : `✈️ 飞机大战得分：${score}`;
            window.sendNotification("game", content, beatPartner);
        }
        loadPlaneLeaderboard();
    } catch (e) {
        console.warn("[Plane] 分数保存失败:", e);
    }
}

// 飞机大战：加载排行榜
async function loadPlaneLeaderboard() {
    const boardEl = document.getElementById("planeBoard");
    if (!boardEl) return;
    try {
        const { data, error } = await sb.from("game_scores")
            .select("user_id, nickname, score, created_at")
            .eq("game", "plane")
            .order("score", { ascending: false })
            .limit(100);
        if (error) throw error;

        const best = new Map();
        (data || []).forEach(r => {
            if (r.user_id && !best.has(r.user_id)) best.set(r.user_id, r);
        });
        const rows = Array.from(best.values());

        const mine = rows.find(r => r.user_id === myUserId);
        const mineEl = document.getElementById("planeMyBest");
        if (mineEl) mineEl.textContent = mine ? `最高分 ${mine.score}` : "最高分 —";

        if (!rows.length) {
            boardEl.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">还没有记录，玩一局吧！</div>';
            return;
        }
        const medals = ["🥇", "🥈", "🥉"];
        boardEl.innerHTML = rows.map((r, i) => `
            <div class="flex items-center justify-between rounded-xl px-4 py-2.5 ${r.user_id === myUserId ? "bg-rose-50 border border-rose-200" : "bg-white/60 border border-gray-100"}">
                <div class="flex items-center gap-3">
                    <span class="text-lg w-7 text-center">${medals[i] || `<span class="text-gray-400 text-sm">${i + 1}</span>`}</span>
                    <span class="font-medium text-gray-700 text-sm">${escapeHtml(r.nickname || "神秘玩家")}</span>
                </div>
                <div class="text-right">
                    <span class="font-bold text-love">${r.score}</span>
                    <span class="text-[10px] text-gray-400 ml-2">${formatJumpDate(r.created_at)}</span>
                </div>
            </div>
        `).join("");
    } catch (e) {
        console.warn("[Plane] 排行榜加载失败:", e);
        boardEl.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">排行榜加载失败</div>';
    }
}

window.initJumpGame = initJumpGame;
window.jumpTogglePlay = jumpTogglePlay;
window.jumpToggleFullscreen = jumpToggleFullscreen;
window.loadJumpLeaderboard = loadJumpLeaderboard;
window.planeTogglePlay = planeTogglePlay;
window.planeToggleFullscreen = planeToggleFullscreen;
window.loadPlaneLeaderboard = loadPlaneLeaderboard;

})();
