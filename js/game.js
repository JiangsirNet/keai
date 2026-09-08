/**
 * 游戏模块（跳一跳 + 飞机大战）
 * 跳一跳：iframe 加载 Jump-master，postMessage 收分数入库 game_scores(game='jump')，展示情侣排行榜。
 * 飞机大战：直接跳转到 plane-master 独立页面，分数由该页面自行入库 game_scores(game='plane')；本页仅负责展示情侣排行榜。
 * 同时负责初始化骗子酒馆（game_liar.js 的 lbInit 依赖 window.myRpsEmail）。
 */

(function() {
const sb = window.sb;
const CONFIG = window.CONFIG;

let myUserId = "";
let myEmail = "";
let myNickname = "我";
let _currentBoard = "jump"; // 当前排行榜 Tab

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
        loadBoard("jump");
    });
}

function onJumpMessage(e) {
    const d = e.data;
    if (!d) return;
    if (d.type === "jump_score") {
        const score = parseInt(d.score, 10) || 0;
        if (score > 0) saveJumpScore(score);
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
        loadBoard("jump");
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

// ===== 全屏兼容：Safari 需 webkit 前缀；iPhone 无 Fullscreen API 用 CSS 伪全屏回退 =====
function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.webkitFullScreenElement || null;
}
function fsRequest(el) {
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    if (el.webkitRequestFullScreen) return el.webkitRequestFullScreen();
    return null; // 无 Fullscreen API（如 iPhone Safari）
}
function fsExit() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.webkitCancelFullScreen) return document.webkitCancelFullScreen();
    return null;
}
// 伪全屏状态以 class 为准（每个游戏区域独立）
function _isFakeFs(area) { return area.classList.contains("jump-fake-fullscreen"); }
function _setFsBtn(btnId, expanded) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.innerHTML = expanded ? '<i class="fa fa-compress"></i>' : '<i class="fa fa-expand"></i>';
    btn.title = expanded ? "退出全屏" : "全屏";
}
function _enterFakeFullscreen(area, btnId, exitId, toggleFn) {
    area.classList.add("jump-fake-fullscreen");
    // 伪全屏时父工具栏被遮挡，提供浮动退出按钮
    let exit = document.getElementById(exitId);
    if (!exit) {
        exit = document.createElement("button");
        exit.id = exitId;
        exit.className = "jump-fake-fs-exit";
        exit.innerHTML = '<i class="fa fa-compress"></i>';
        exit.addEventListener("click", toggleFn);
        document.body.appendChild(exit);
    }
    exit.style.display = "flex";
    _setFsBtn(btnId, true);
}
function _exitFakeFullscreen(area, btnId, exitId) {
    area.classList.remove("jump-fake-fullscreen");
    const exit = document.getElementById(exitId);
    if (exit) exit.style.display = "none";
    _setFsBtn(btnId, false);
}

// 跳一跳全屏切换
function jumpToggleFullscreen() {
    const area = document.getElementById("jumpPlayArea");
    const frame = document.getElementById("jumpFrame");
    const btn = document.getElementById("jumpFullscreenBtn");
    if (!area || !frame || !btn) return;
    const inNative = !!fsElement();
    const inFake = _isFakeFs(area);
    if (!inNative && !inFake) {
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
        const p = fsRequest(area);
        if (p && p.then) {
            p.then(() => _setFsBtn("jumpFullscreenBtn", true)).catch(() => {
                // 原生全屏被拒（iframe 权限等）→ 伪全屏回退
                _enterFakeFullscreen(area, "jumpFullscreenBtn", "jumpFakeFsExit", jumpToggleFullscreen);
            });
        } else {
            // 无 Fullscreen API（iPhone Safari）→ 伪全屏
            _enterFakeFullscreen(area, "jumpFullscreenBtn", "jumpFakeFsExit", jumpToggleFullscreen);
        }
    } else {
        // 退出全屏
        if (inFake) {
            _exitFakeFullscreen(area, "jumpFullscreenBtn", "jumpFakeFsExit");
        } else if (inNative) {
            const p = fsExit();
            if (p && p.then) p.catch(() => {});
        }
        frame.style.height = "";
        area.classList.remove("jump-fullscreen");
        _setFsBtn("jumpFullscreenBtn", false);
    }
}

// 监听全屏退出（ESC 键等），兼容 webkit 前缀事件；两个游戏区域统一复位
function _onFsChange() {
    if (fsElement()) return;
    [["jumpPlayArea", "jumpFrame", "jumpFullscreenBtn"]].forEach(([aId, fId, bId]) => {
        const area = document.getElementById(aId);
        const frame = document.getElementById(fId);
        if (area && !_isFakeFs(area)) {
            _setFsBtn(bId, false);
            if (frame) frame.style.height = "";
            area.classList.remove("jump-fullscreen");
        }
    });
}
document.addEventListener("fullscreenchange", _onFsChange);
document.addEventListener("webkitfullscreenchange", _onFsChange);

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

// 通用排行榜加载
async function loadBoard(game) {
    const boardEl = document.getElementById("boardList");
    if (!boardEl) return;
    try {
        const { data, error } = await sb.from("game_scores")
            .select("user_id, nickname, score, created_at")
            .eq("game", game)
            .order("score", { ascending: false })
            .limit(100);
        if (error) throw error;

        const best = new Map();
        (data || []).forEach(r => {
            if (r.user_id && !best.has(r.user_id)) best.set(r.user_id, r);
        });
        const rows = Array.from(best.values());

        const mine = rows.find(r => r.user_id === myUserId);
        const mineEl = document.getElementById("boardMyBest");
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
        console.warn(`[${game}] 排行榜加载失败:`, e);
        boardEl.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">排行榜加载失败</div>';
    }
}

// 排行榜 Tab 切换
function switchBoardTab(game) {
    _currentBoard = game;
    document.querySelectorAll(".board-tab").forEach(btn => {
        const isActive = btn.dataset.game === game;
        btn.classList.toggle("active", isActive);
        if (isActive) {
            btn.style.background = "linear-gradient(135deg, #f43f5e, #ec4899)";
            btn.style.color = "#fff";
        } else {
            btn.style.background = "#f3f4f6";
            btn.style.color = "#6b7280";
        }
    });
    loadBoard(game);
}

function refreshCurrentBoard() {
    loadBoard(_currentBoard);
}

// 游戏 Tab 切换（跳一跳 / 飞机大战）
function switchGameTab(game) {
    document.querySelectorAll(".game-tab").forEach(btn => {
        const isActive = btn.dataset.game === game;
        btn.classList.toggle("active", isActive);
        if (isActive) {
            btn.style.background = "linear-gradient(135deg, #f43f5e, #ec4899)";
            btn.style.color = "#fff";
        } else {
            btn.style.background = "#f3f4f6";
            btn.style.color = "#6b7280";
        }
    });
    const jumpPanel = document.getElementById("jumpGamePanel");
    const planePanel = document.getElementById("planeGamePanel");
    if (jumpPanel) jumpPanel.classList.toggle("hidden", game !== "jump");
    if (planePanel) planePanel.classList.toggle("hidden", game !== "plane");
}

// 骗子酒馆折叠
function toggleLiarPanel() {
    const panel = document.getElementById("liarPanel");
    const arrow = document.getElementById("liarArrow");
    if (!panel) return;
    const isHidden = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    if (arrow) arrow.style.transform = isHidden ? "rotate(180deg)" : "";
}

async function loadJumpLeaderboard() { return loadBoard("jump"); }
async function loadPlaneLeaderboard() { return loadBoard("plane"); }

// 飞机大战已改为直接跳转 plane-master 独立页面，
// 分数入库 + 通知逻辑移至 plane-master/js/score.js；本页仅保留排行榜展示。

window.initJumpGame = initJumpGame;
window.jumpTogglePlay = jumpTogglePlay;
window.jumpToggleFullscreen = jumpToggleFullscreen;
window.loadJumpLeaderboard = loadJumpLeaderboard;
window.loadPlaneLeaderboard = loadPlaneLeaderboard;
window.switchBoardTab = switchBoardTab;
window.refreshCurrentBoard = refreshCurrentBoard;
window.switchGameTab = switchGameTab;
window.toggleLiarPanel = toggleLiarPanel;

// 初始化 Tab 样式
switchBoardTab("jump");

})();
