/**
 * 跳一跳游戏
 * iframe 加载 Jump-master（three.js），游戏结束时游戏内 postMessage 上报分数，
 * 分数写入 Supabase game_scores 表，游戏页展示情侣排行榜（每人取最高分）。
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
    });
}

function onJumpMessage(e) {
    const d = e.data;
    if (!d || d.type !== "jump_score") return;
    const score = parseInt(d.score, 10) || 0;
    if (score > 0) saveJumpScore(score);
}

async function saveJumpScore(score) {
    if (!myUserId) return;
    try {
        const { error } = await sb.from("game_scores")
            .insert({ game: "jump", user_id: myUserId, nickname: myNickname, score: score });
        if (error) throw error;
        if (window.sendNotification) window.sendNotification("game", `🐸 跳一跳得分：${score}`);
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

window.initJumpGame = initJumpGame;
window.jumpTogglePlay = jumpTogglePlay;
window.loadJumpLeaderboard = loadJumpLeaderboard;

})();
