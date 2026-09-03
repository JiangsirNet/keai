/**
 * 音乐播放器（现代风格）
 * 支持封面展示、LRC 歌词同步、播放模式切换（顺序/循环/随机）、折叠列表
 * 数据库可选字段：cover_url（封面）、lyrics（LRC 或纯文本歌词）
 */

let musicList = [];
let musicSortBy = 'date_desc';
let currentMusicIndex = -1;
let playMode = 'list'; // 'list'（列表循环）| 'single'（单曲循环）| 'random'（随机）
let lyricsData = [];      // [{time:秒, text:'歌词行'}]
let currentLyricIndex = -1;
let playlistExpanded = false;
let lyricsVisible = true;

const PLAY_MODE_LABELS = {
    list: '列表循环',
    single: '单曲循环',
    random: '随机播放'
};

async function loadMusicList() {
    let orderCol, ascending;
    switch (musicSortBy) {
        case 'date_asc':   orderCol = 'created_at'; ascending = true;  break;
        case 'title_asc':  orderCol = 'title';      ascending = true;  break;
        case 'title_desc': orderCol = 'title';      ascending = false; break;
        default:           orderCol = 'created_at'; ascending = false; break;
    }
    const { data } = await window.sb.from("music").select("*").order(orderCol, { ascending });
    musicList = data || [];

    const listEl = document.getElementById("mpList");
    if (!listEl) return;
    listEl.innerHTML = "";

    // 排序按钮高亮
    ['sortDateDesc', 'sortDateAsc', 'sortTitleAsc', 'sortTitleDesc'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const val = id === 'sortDateDesc' ? 'date_desc'
                  : id === 'sortDateAsc'  ? 'date_asc'
                  : id === 'sortTitleAsc' ? 'title_asc' : 'title_desc';
        btn.classList.toggle('active', val === musicSortBy);
    });

    // 列表数量
    const countEl = document.getElementById("mpListCount");
    if (countEl) countEl.innerText = `(${musicList.length})`;

    if (musicList.length === 0) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-3 text-xs">暂无歌曲，上传一首吧</div>`;
        return;
    }

    // 默认载入第一首歌（不自动播放），方便用户直接点播放键
    if (currentMusicIndex === -1 && musicList.length > 0) {
        const audioEl = document.getElementById("musicAudio");
        // 仅在未播放时载入，避免中断正在播放的歌曲
        if (!audioEl || audioEl.paused) {
            currentMusicIndex = 0;
            const firstItem = musicList[0];
            if (audioEl) audioEl.src = firstItem.url;
            document.getElementById("mpTitle").innerText = firstItem.title || "未知歌曲";
            updateCover(firstItem);
            // 载入但不播放，移除封面旋转动画
            const coverEl = document.getElementById("mpCover");
            if (coverEl) coverEl.classList.remove("playing");
            parseLyrics(firstItem.lyrics);
        }
    }

    musicList.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "mp-item" + (idx === currentMusicIndex ? " active" : "");
        const coverHtml = item.cover_url
            ? `<div class="mp-item-cover" style="background-image:url('${item.cover_url}')"></div>`
            : `<div class="mp-item-cover">${escapeHtml((item.title || '?').charAt(0))}</div>`;
        const lyricsIcon = item.lyrics ? 'fa fa-align-left' : 'fa fa-align-left mp-item-lyrics-empty';
        div.innerHTML = `
            ${coverHtml}
            <span class="mp-item-title">${escapeHtml(item.title || "未知歌曲")}</span>
            <span class="mp-item-lyrics" onclick="event.stopPropagation(); editLyrics('${item.id}')" title="${item.lyrics ? '编辑歌词' : '添加歌词'}"><i class="${lyricsIcon}"></i></span>
            <span class="mp-item-del" onclick="event.stopPropagation(); deleteMusic('${item.id}')"><i class="fa fa-trash"></i></span>
        `;
        div.onclick = () => playMusic(idx);
        listEl.appendChild(div);
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function changeMusicSort(sort) {
    musicSortBy = sort;
    currentMusicIndex = -1;
    loadMusicList();
}

async function uploadMusic(e) {
    const file = e.target.files[0];
    if (!file) return;
    const title = file.name.replace(/\.[^/.]+$/, "");
    const ext = file.name.match(/\.[^/.]+$/)?.[0] || "";
    const safeName = file.name.replace(/\.[^/.]+$/, "").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_") || "music";
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const fileName = `${ts}_${safeName}${ext}`;

    // 先重新打开选择弹窗（chooseUploadDirect 可能已关闭），进度条在弹窗里显示
    const modal = document.getElementById("mpUploadChoiceModal");
    if (modal) modal.classList.remove("hidden");

    // 显示进度条
    const progBox = document.getElementById("mpUploadProgress");
    const progFill = document.getElementById("mpUploadProgressFill");
    const progPct = document.getElementById("mpUploadProgressPct");
    const progName = document.getElementById("mpUploadProgressName");
    const progStatus = document.getElementById("mpUploadProgressStatus");
    const choiceBtn = document.getElementById("mpUploadChoiceBtn");
    if (progBox) progBox.classList.remove("hidden");
    if (progName) progName.textContent = title;
    if (progStatus) progStatus.textContent = "上传中…";
    if (progFill) progFill.style.width = "0%";
    if (progPct) progPct.textContent = "0%";
    if (choiceBtn) choiceBtn.disabled = true;

    // 带进度回调的上传
    const { data, error } = await window.sb.storage.from("music").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        progress: function(p) {
            // p.loaded / p.total 已上传字节数 / 总字节数
            const pct = p.total ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0;
            if (progFill) progFill.style.width = pct + "%";
            if (progPct) progPct.textContent = pct + "%";
        }
    });
    if (error) {
        if (progStatus) progStatus.textContent = "上传失败";
        if (progFill) progFill.style.background = "#ef4444";
        alert("上传失败：" + error.message);
        if (choiceBtn) choiceBtn.disabled = false;
        return;
    }
    // 上传完成，进入保存记录阶段
    if (progPct) progPct.textContent = "100%";
    if (progFill) progFill.style.width = "100%";
    if (progStatus) progStatus.textContent = "保存记录中…";

    const url = window.sb.storage.from("music").getPublicUrl(data.path).data.publicUrl;
    const payload = { title, url };
    const email = window.myRpsEmail || null;
    if (email) payload.uploader_email = email;
    let res = await window.sb.from("music").insert(payload).select();
    // 如果因 uploader_email 列不存在而失败，降级为不写该字段
    if (res.error && /uploader_email/.test(res.error.message || "")) {
        delete payload.uploader_email;
        res = await window.sb.from("music").insert(payload).select();
    }
    if (res.error) {
        if (progStatus) progStatus.textContent = "保存失败";
        alert("保存歌曲记录失败：" + res.error.message);
        if (choiceBtn) choiceBtn.disabled = false;
        return;
    }
    if (progStatus) progStatus.textContent = "上传成功 ✓";
    window.sendNotification("music", "🎵 上传了歌曲：" + title);
    e.target.value = "";
    loadMusicList();
    // 1.2 秒后关闭弹窗
    setTimeout(() => {
        if (progBox) progBox.classList.add("hidden");
        closeUploadChoice();
        if (choiceBtn) choiceBtn.disabled = false;
        // 重置进度条样式
        if (progFill) { progFill.style.width = "0%"; progFill.style.background = ""; }
        if (progPct) progPct.textContent = "0%";
    }, 1200);
}

// 右上角上传按钮 → 弹出选择（去网站下载 / 立即上传）
function toggleUploadArea() {
    const modal = document.getElementById("mpUploadChoiceModal");
    if (modal) modal.classList.remove("hidden");
    // 打开时清空输入框并重置链接
    const input = document.getElementById("mpDownloadSongInput");
    if (input) input.value = "";
    updateDownloadLinks();
}

// 关闭上传选择弹窗
function closeUploadChoice() {
    const modal = document.getElementById("mpUploadChoiceModal");
    if (modal) modal.classList.add("hidden");
}

// 根据输入的歌曲名动态更新两个下载网站的链接
function updateDownloadLinks() {
    const input = document.getElementById("mpDownloadSongInput");
    const q = (input && input.value || "").trim();
    const link1 = document.getElementById("mpDlLink1");
    const link2 = document.getElementById("mpDlLink2");
    if (link1) {
        link1.href = q
            ? `https://myfreemp3ku.com/search.php?q=${encodeURIComponent(q)}`
            : "https://myfreemp3ku.com/";
    }
    if (link2) {
        link2.href = q
            ? `https://www.kkwpss.com/so/?wd=${encodeURIComponent(q)}`
            : "https://www.kkwpss.com/";
    }
}

// 用户选择"立即上传" → 关闭弹窗并直接触发文件选择对话框
function chooseUploadDirect() {
    closeUploadChoice();
    const input = document.getElementById("musicUpload");
    if (input) input.click();
}

// 打开歌词编辑弹窗
let _editingLyricsId = null;
function editLyrics(id) {
    const item = musicList.find(m => String(m.id) === String(id));
    if (!item) return;
    _editingLyricsId = id;
    const modal = document.getElementById("mpLyricsModal");
    const titleEl = document.getElementById("mpLyricsModalTitle");
    const textarea = document.getElementById("mpLyricsTextarea");
    const linkEl = document.getElementById("lrclibSearchLink");
    if (titleEl) titleEl.innerText = item.title || "未知歌曲";
    if (textarea) textarea.value = item.lyrics || "";
    // 动态拼接 LRCLIB 搜索链接：https://lrclib.net/search/{歌名URL编码}
    if (linkEl) {
        const q = (item.title || "").trim();
        linkEl.href = q
            ? `https://lrclib.net/search/${encodeURIComponent(q)}`
            : "https://lrclib.net/";
    }
    if (modal) modal.classList.remove("hidden");
}

function closeLyricsEditor() {
    const modal = document.getElementById("mpLyricsModal");
    if (modal) modal.classList.add("hidden");
    _editingLyricsId = null;
}

async function saveLyrics() {
    if (_editingLyricsId === null) return;
    const textarea = document.getElementById("mpLyricsTextarea");
    const lyrics = textarea ? textarea.value.trim() : "";
    try {
        const updatePayload = { lyrics: lyrics || null };
        const { data, error, count } = await window.sb.from("music")
            .update(updatePayload, { count: 'exact' })
            .eq("id", _editingLyricsId);
        console.log('[saveLyrics] 请求 id=', _editingLyricsId, 'payload=', updatePayload);
        console.log('[saveLyrics] 响应 data=', data, 'error=', error, 'count=', count);
        if (error) throw error;
        // RLS 拒绝时通常 data 为空数组且无 error，用 count 判断
        if (count === 0 || (Array.isArray(data) && data.length === 0)) {
            throw new Error("更新了 0 行（可能没有权限或记录不存在）");
        }
        // 更新内存
        const item = musicList.find(m => String(m.id) === String(_editingLyricsId));
        if (item) item.lyrics = lyrics || null;
        // 如果正在播放这首歌，刷新歌词显示
        if (currentMusicIndex >= 0 && musicList[currentMusicIndex]
            && String(musicList[currentMusicIndex].id) === String(_editingLyricsId)) {
            parseLyrics(item.lyrics);
        }
        closeLyricsEditor();
    } catch (err) {
        console.error('[saveLyrics] 失败:', err);
        alert("保存歌词失败：" + err.message);
    }
}

async function deleteMusic(id) {
    if (!confirm("确定删除这首歌？")) return;
    const item = musicList.find(m => String(m.id) === String(id));
    if (item && item.url) {
        try {
            const path = decodeURIComponent(item.url.split('/music/')[1] || '');
            if (path) await window.sb.storage.from("music").remove([path]);
        } catch (e) { console.warn("删除文件失败:", e); }
    }
    await window.sb.from("music").delete().eq("id", id);
    if (currentMusicIndex >= 0) currentMusicIndex = -1;
    loadMusicList();
}

function playMusic(index) {
    if (index < 0 || index >= musicList.length) return;
    currentMusicIndex = index;
    const item = musicList[index];
    const audio = document.getElementById("musicAudio");
    // 暂停 K 歌所有音频，确保同时只有一个音频在播放
    if (window.pauseKaraokeAudios) window.pauseKaraokeAudios();
    audio.src = item.url;
    audio.play();

    document.getElementById("mpTitle").innerText = item.title || "未知歌曲";
    document.getElementById("mpPlayBtn").innerHTML = '<i class="fa fa-pause"></i>';

    updateCover(item);
    parseLyrics(item.lyrics);
    loadMusicList();
}

// 暂停音乐播放器（供 K 歌模块调用）
function pauseMusicAudio() {
    const audio = document.getElementById("musicAudio");
    if (!audio || audio.paused) return;
    audio.pause();
    const coverEl = document.getElementById("mpCover");
    const btnEl = document.getElementById("mpPlayBtn");
    if (coverEl) coverEl.classList.remove("playing");
    if (btnEl) btnEl.innerHTML = '<i class="fa fa-play"></i>';
}

function updateCover(item) {
    const coverEl = document.getElementById("mpCover");
    if (!coverEl) return;
    coverEl.classList.add("playing");
    if (item.cover_url) {
        coverEl.innerHTML = `<img src="${item.cover_url}" alt="cover" onerror="this.parentNode.innerHTML='<span class=\\'mp-cover-text\\'">${escapeHtml((item.title || '?').charAt(0))}</span>'">`;
    } else {
        coverEl.innerHTML = `<span class="mp-cover-text">${escapeHtml((item.title || '?').charAt(0))}</span>`;
    }
}

/** 解析 LRC 歌词；无时间戳则按纯文本展示 */
function parseLyrics(lyricsText) {
    lyricsData = [];
    currentLyricIndex = -1;
    const lyricsEl = document.getElementById("mpLyrics");
    if (!lyricsEl) return;

    if (!lyricsText || !lyricsText.trim()) {
        lyricsEl.innerHTML = `<div class="mp-lyrics-empty">暂无歌词</div>`;
        return;
    }

    const lines = lyricsText.split('\n');
    const re = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
    lines.forEach(line => {
        const matches = [...line.matchAll(re)];
        const text = line.replace(re, '').trim();
        if (text === '' || matches.length === 0) return;
        matches.forEach(m => {
            const min = parseInt(m[1]);
            const sec = parseInt(m[2]);
            const ms = m[3] ? parseInt(m[3].padEnd(3, '0').substring(0, 3)) : 0;
            lyricsData.push({ time: min * 60 + sec + ms / 1000, text });
        });
    });

    // 纯文本歌词（无时间戳）：每行作为一项
    if (lyricsData.length === 0) {
        lines.forEach(line => {
            const t = line.trim();
            if (t) lyricsData.push({ time: -1, text: t });
        });
    }

    lyricsData.sort((a, b) => a.time - b.time);
    lyricsEl.innerHTML = lyricsData.map((l, i) =>
        `<div class="mp-lyric-line" data-idx="${i}">${escapeHtml(l.text)}</div>`
    ).join('');
}

function updateLyrics() {
    if (lyricsData.length === 0) return;
    const audio = document.getElementById("musicAudio");
    const currentTime = audio.currentTime;

    // 二分法查找当前歌词行
    let newIdx = -1;
    let lo = 0, hi = lyricsData.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lyricsData[mid].time < 0) { lo = mid + 1; continue; } // 纯文本跳过
        if (lyricsData[mid].time <= currentTime) { newIdx = mid; lo = mid + 1; }
        else { hi = mid - 1; }
    }

    if (newIdx !== currentLyricIndex) {
        currentLyricIndex = newIdx;
        const lines = document.querySelectorAll('.mp-lyric-line');
        lines.forEach((el, i) => el.classList.toggle('active', i === newIdx));
        if (newIdx >= 0 && lines[newIdx]) {
            // 仅通过相对位置（getBoundingClientRect）计算容器内偏移，
            // 避免 offsetParent 不是容器导致的 offsetTop 失真问题
            const container = document.getElementById("mpLyrics");
            const rect = container.getBoundingClientRect();
            const lineRect = lines[newIdx].getBoundingClientRect();
            const delta = lineRect.top - rect.top - rect.height / 2 + lineRect.height / 2;
            container.scrollTop += delta;
        }
    }
}

function togglePlay() {
    const audio = document.getElementById("musicAudio");
    if (currentMusicIndex === -1) {
        if (musicList.length > 0) playMusic(0);
        return;
    }
    if (audio.paused) {
        // 暂停 K 歌所有音频，确保同时只有一个音频在播放
        if (window.pauseKaraokeAudios) window.pauseKaraokeAudios();
        audio.play();
        document.getElementById("mpCover").classList.add("playing");
        document.getElementById("mpPlayBtn").innerHTML = '<i class="fa fa-pause"></i>';
    } else {
        audio.pause();
        document.getElementById("mpCover").classList.remove("playing");
        document.getElementById("mpPlayBtn").innerHTML = '<i class="fa fa-play"></i>';
    }
}

function prevMusic() {
    if (musicList.length === 0) return;
    const idx = currentMusicIndex <= 0 ? musicList.length - 1 : currentMusicIndex - 1;
    playMusic(idx);
}

function nextMusic() {
    if (musicList.length === 0) return;
    if (playMode === 'random') {
        let idx;
        do {
            idx = Math.floor(Math.random() * musicList.length);
        } while (idx === currentMusicIndex && musicList.length > 1);
        playMusic(idx);
    } else {
        const idx = currentMusicIndex >= musicList.length - 1 ? 0 : currentMusicIndex + 1;
        playMusic(idx);
    }
}

/** 切换播放模式：list → single → random → list */
function togglePlayMode() {
    const modes = ['list', 'single', 'random'];
    playMode = modes[(modes.indexOf(playMode) + 1) % modes.length];
    updatePlayModeBtn();
}

function updatePlayModeBtn() {
    const btn = document.getElementById("mpModeBtn");
    if (!btn) return;
    let iconHtml = '';
    if (playMode === 'list') {
        iconHtml = '<i class="fa fa-repeat"></i>';
    } else if (playMode === 'single') {
        // FontAwesome 4 没有_repeat-1，用文字 1 叠加
        iconHtml = '<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;"><i class="fa fa-repeat"></i><span style="position:absolute;font-size:9px;font-weight:700;background:#fff;color:#ff6b8b;border-radius:50%;width:11px;height:11px;display:flex;align-items:center;justify-content:center;top:-3px;right:-5px;">1</span></span>';
    } else {
        iconHtml = '<i class="fa fa-random"></i>';
    }
    btn.innerHTML = iconHtml;
    btn.classList.toggle('active', playMode !== 'list');
    btn.title = PLAY_MODE_LABELS[playMode];
}

function togglePlaylist() {
    playlistExpanded = !playlistExpanded;
    document.getElementById("mpPlaylist").classList.toggle("hidden", !playlistExpanded);
    document.getElementById("mpPlaylistToggle").classList.toggle("expanded", playlistExpanded);
}

function toggleLyricsView() {
    lyricsVisible = !lyricsVisible;
    const player = document.querySelector('.modern-player');
    document.getElementById("mpLyrics").classList.toggle("hidden-lyrics", !lyricsVisible);
    document.getElementById("mpLyricsBtn").classList.toggle("active", lyricsVisible);
    // 展示歌词时隐藏专辑封面，扩大歌词区以显示更多歌词
    if (player) player.classList.toggle("lyrics-mode", lyricsVisible);
}

function updateProgress() {
    const audio = document.getElementById("musicAudio");
    if (!audio.duration) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    document.getElementById("mpProgressBar").style.width = percent + "%";
    const thumb = document.getElementById("mpProgressThumb");
    if (thumb) thumb.style.left = percent + "%";
    document.getElementById("mpCurrent").innerText = formatTime(audio.currentTime);
    document.getElementById("mpDuration").innerText = formatTime(audio.duration);
    updateLyrics();
}

function seekMusic(e) {
    const audio = document.getElementById("musicAudio");
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(1, percent)) * audio.duration;
}

function onMusicEnded() {
    if (playMode === 'single') {
        const audio = document.getElementById("musicAudio");
        audio.currentTime = 0;
        // 单曲循环续播时也确保 K 歌未占用
        if (window.pauseKaraokeAudios) window.pauseKaraokeAudios();
        audio.play();
    } else {
        nextMusic();
    }
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

// 初始化播放模式按钮（DOM 可能尚未就绪，做防御）
(function initPlayModeBtn() {
    if (document.getElementById("mpModeBtn")) {
        updatePlayModeBtn();
    } else {
        document.addEventListener("DOMContentLoaded", updatePlayModeBtn);
    }
})();

window.musicList = musicList;
window.musicSortBy = musicSortBy;
window.currentMusicIndex = currentMusicIndex;
window.loadMusicList = loadMusicList;
window.changeMusicSort = changeMusicSort;
window.uploadMusic = uploadMusic;
window.deleteMusic = deleteMusic;
window.playMusic = playMusic;
window.togglePlay = togglePlay;
window.prevMusic = prevMusic;
window.nextMusic = nextMusic;
window.updateProgress = updateProgress;
window.seekMusic = seekMusic;
window.onMusicEnded = onMusicEnded;
window.formatTime = formatTime;
window.togglePlayMode = togglePlayMode;
window.toggleUploadArea = toggleUploadArea;
window.editLyrics = editLyrics;
window.closeLyricsEditor = closeLyricsEditor;
window.saveLyrics = saveLyrics;
window.togglePlaylist = togglePlaylist;
window.toggleLyricsView = toggleLyricsView;
window.pauseMusicAudio = pauseMusicAudio;
window.closeUploadChoice = closeUploadChoice;
window.chooseUploadDirect = chooseUploadDirect;
window.updateDownloadLinks = updateDownloadLinks;

/* ================== 在线搜索（第三方音源）==================
 * 思路与洛雪音乐一致：通过第三方音源搜索、获取播放链接和歌词
 * 音源聚合：Meting API（支持网易云 / QQ 音乐 / 酷狗）+ 公共 CORS 代理兜底
 * 搜索 → 展示结果 → 在线试听（临时 audio，不进播放列表）→ 保存到我的音乐（写入 music 表）
 */

let _osSource = 'netease';            // 当前音源
let _osResults = [];                  // 搜索结果缓存
let _osPreviewAudio = null;           // 临时试听 audio
let _osPreviewingIdx = -1;            // 当前试听到的结果下标

// Meting API 公共实例（开源音乐聚合，由社区提供，有 CORS）
const METING_BASES = [
    'https://api.injahow.cn/meting',
    'https://meting.qjqq.cn'
];
// CORS 代理列表（Meting 公共实例不支持 CORS，必须走代理）
const CORS_PROXIES = [
    (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    (u) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
    (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u)
];

// 判断本地环境（localhost / 127.0.0.1 / file:）— 本地不走 CORS 代理，直连
const _isLocalEnv = location.protocol === 'file:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '';

async function _metingFetch(queryParams) {
    // 走 CORS 代理（本地和线上统一）
    // 先解码 queryParams，避免 encodeURIComponent 双重编码（%E5 → %25E5）
    let rawParams;
    try { rawParams = decodeURIComponent(queryParams); } catch (_) { rawParams = queryParams; }
    for (const proxy of CORS_PROXIES) {
        for (const base of METING_BASES) {
            try {
                const targetUrl = `${base}/?${rawParams}`;
                const resp = await fetch(proxy(targetUrl), { signal: AbortSignal.timeout(12000) });
                if (!resp.ok) continue;
                const text = await resp.text();
                if (!text || text.length < 2) continue;
                try { return JSON.parse(text); } catch (_) { return text; }
            } catch (_) { /* 尝试下一个 */ }
        }
    }
    return null;
}

function switchOnlineSrc(src) {
    _osSource = src;
    document.querySelectorAll('.mp-os-src-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.src === src);
    });
}

function openOnlineSearch() {
    // 在线搜歌功能已隐藏（如需恢复请取消下方注释并恢复 home.html 中的弹窗 DOM）
    return;
    /* —— 原逻辑（已隐藏）——
    const modal = document.getElementById("mpOnlineSearchModal");
    if (modal) modal.classList.remove("hidden");
    const input = document.getElementById("mpOnlineSearchInput");
    if (input) { input.value = ""; input.focus(); }
    */
}

function closeOnlineSearch() {
    stopOnlinePreview();
    const modal = document.getElementById("mpOnlineSearchModal");
    if (modal) modal.classList.add("hidden");
}

function stopOnlinePreview() {
    if (_osPreviewAudio) {
        try { _osPreviewAudio.pause(); } catch (_) {}
        try { _osPreviewAudio.src = ""; } catch (_) {}
        _osPreviewAudio = null;
    }
    _osPreviewingIdx = -1;
    const np = document.getElementById("mpOnlineNowPlaying");
    if (np) np.classList.add("hidden");
    // 结果项试听图标恢复
    document.querySelectorAll('.mp-os-item-playing').forEach(el => el.classList.remove('mp-os-item-playing'));
}

async function searchOnline() {
    const input = document.getElementById("mpOnlineSearchInput");
    const listEl = document.getElementById("mpOnlineSearchResults");
    const keyword = (input ? input.value : "").trim();
    if (!keyword) { alert("请输入搜索关键字"); return; }

    if (listEl) {
        listEl.innerHTML = `
            <div class="mp-os-loading">
                <i class="fa fa-spinner fa-spin"></i>
                <span>正在搜索 ${_osSourceName(_osSource)} …</span>
            </div>`;
    }

    let data = null;
    if (isCustomSource(_osSource)) {
        try {
            data = await customSourceSearch(_osSource, keyword);
        } catch (e) {
            console.error(e);
            alert("搜索失败：" + (e.message || e));
        }
    } else {
        const params = new URLSearchParams({
            server: _osSource,
            type: 'search',
            s: keyword
        }).toString();
        data = await _metingFetch(params);
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
        if (listEl) {
            listEl.innerHTML = `
                <div class="mp-os-empty">
                    <i class="fa fa-search"></i>
                    <span>未找到相关歌曲，试试换关键字或其他音源</span>
                </div>`;
        }
        return;
    }

    _osResults = data;
    _renderOnlineResults();
}

function _osSourceName(s) {
    if (BUILTIN_SOURCES && Array.isArray(BUILTIN_SOURCES)) {
        const b = BUILTIN_SOURCES.find(x => x.id === s);
        if (b) return b.name;
    }
    if (_customSources && _customSources[s]) return _customSources[s].name || s;
    return { netease: '网易云', tencent: 'QQ 音乐', kugou: '酷狗' }[s] || s;
}

function _renderOnlineResults() {
    const listEl = document.getElementById("mpOnlineSearchResults");
    if (!listEl) return;
    if (_osResults.length === 0) {
        listEl.innerHTML = `<div class="mp-os-empty"><i class="fa fa-search"></i><span>无结果</span></div>`;
        return;
    }
    listEl.innerHTML = _osResults.map((item, idx) => {
        const name = item.name || item.title || '未知歌曲';
        const artist = (item.artist && Array.isArray(item.artist) ? item.artist.join(' / ') : (item.artist || item.author || '未知歌手'));
        const pic = item.pic || item.picurl || item.cover || '';
        const safeName = escapeHtml(name);
        const safeArt = escapeHtml(artist);
        const coverHtml = pic
            ? `<div class="mp-os-item-pic" style="background-image:url('${pic}')"></div>`
            : `<div class="mp-os-item-pic">${escapeHtml(name.charAt(0))}</div>`;
        return `
            <div class="mp-os-item ${_osPreviewingIdx === idx ? 'mp-os-item-playing' : ''}" data-idx="${idx}">
                ${coverHtml}
                <div class="mp-os-item-meta">
                    <div class="mp-os-item-title">${safeName}</div>
                    <div class="mp-os-item-artist">${safeArt} · <span class="mp-os-item-src">${_osSourceName(_osSource)}</span></div>
                </div>
                <div class="mp-os-item-actions">
                    <button class="mp-os-btn-play" onclick="previewOnlineSong(${idx})" title="在线试听">
                        <i class="fa ${_osPreviewingIdx === idx ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <button class="mp-os-btn-save" onclick="saveOnlineSong(${idx})" title="保存到我的音乐">
                        <i class="fa fa-plus"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

async function previewOnlineSong(idx) {
    const item = _osResults[idx];
    if (!item) return;

    // 已在试听这首歌 → 停止
    if (_osPreviewingIdx === idx && _osPreviewAudio && !_osPreviewAudio.paused) {
        stopOnlinePreview();
        return;
    }

    // 先停掉原来的试听和主播放器
    stopOnlinePreview();
    pauseMusicAudio();
    // 停 K 歌
    if (window.pauseKaraokeAudios) window.pauseKaraokeAudios();

    // 获取播放 URL（Meting type=song 或 url，或自定义音源 getUrl）
    let playUrl = item.url || null;
    if (!playUrl) {
        if (isCustomSource(_osSource)) {
            try {
                playUrl = await customSourceGetUrl(_osSource, item);
            } catch (e) {
                console.error(e);
                alert("获取播放链接失败：" + (e.message || e));
                return;
            }
        } else {
            // 某些搜索结果不包含 URL，单独调一次 url 接口
            const qp = new URLSearchParams({
                server: _osSource,
                type: 'url',
                id: item.url_id || item.id
            }).toString();
            const urlData = await _metingFetch(qp);
            // url 接口可能返回 {url:"xxx"} 或直接返回字符串
            if (typeof urlData === 'string') playUrl = urlData;
            else if (urlData && urlData.url) playUrl = urlData.url;
        }
    }
    if (!playUrl) { alert("未获取到播放链接"); return; }

    _osPreviewAudio = new Audio(playUrl);
    _osPreviewAudio.crossOrigin = "anonymous";
    _osPreviewingIdx = idx;

    // 显示试听状态
    const np = document.getElementById("mpOnlineNowPlaying");
    const npTitle = document.getElementById("mpOnlineNowTitle");
    if (np) np.classList.remove("hidden");
    if (npTitle) {
        const name = item.name || item.title || '未知歌曲';
        const artist = (item.artist && Array.isArray(item.artist) ? item.artist.join(' / ') : (item.artist || item.author || ''));
        npTitle.textContent = `试听中：${name}${artist ? ' - ' + artist : ''}`;
    }
    _renderOnlineResults();

    try {
        await _osPreviewAudio.play();
    } catch (e) {
        alert("试听失败：" + (e.message || e));
        stopOnlinePreview();
    }
    _osPreviewAudio.addEventListener('ended', stopOnlinePreview, { once: true });
}

async function saveOnlineSong(idx) {
    const item = _osResults[idx];
    if (!item) return;
    const name = item.name || item.title || '未知歌曲';
    const artist = (item.artist && Array.isArray(item.artist) ? item.artist.join(' / ') : (item.artist || item.author || ''));
    const title = artist ? `${artist} - ${name}` : name;
    const cover = item.pic || item.picurl || item.cover || null;

    // 先获取播放 URL
    let playUrl = item.url || null;
    if (!playUrl) {
        if (isCustomSource(_osSource)) {
            try {
                playUrl = await customSourceGetUrl(_osSource, item);
            } catch (e) {
                alert("获取播放链接失败：" + (e.message || e));
                return;
            }
        } else {
            const qp = new URLSearchParams({
                server: _osSource,
                type: 'url',
                id: item.url_id || item.id
            }).toString();
            const urlData = await _metingFetch(qp);
            if (typeof urlData === 'string') playUrl = urlData;
            else if (urlData && urlData.url) playUrl = urlData.url;
        }
    }
    if (!playUrl) { alert("未获取到播放链接，无法保存"); return; }

    // 并行抓歌词
    let lyrics = null;
    try {
        if (isCustomSource(_osSource)) {
            lyrics = await customSourceGetLyric(_osSource, item);
        } else {
            const qpLrc = new URLSearchParams({
                server: _osSource,
                type: 'lyric',
                id: item.lyric_id || item.id
            }).toString();
            const lrcData = await _metingFetch(qpLrc);
            if (lrcData && typeof lrcData === 'object' && lrcData.lrc) {
                lyrics = lrcData.lrc;
            } else if (typeof lrcData === 'string' && lrcData.includes('[')) {
                lyrics = lrcData;
            }
        }
    } catch (_) {}

    // 写 music 表
    const payload = { title, url: playUrl };
    if (cover) payload.cover_url = cover;
    if (lyrics) payload.lyrics = lyrics;
    if (window.myRpsEmail) payload.uploader_email = window.myRpsEmail;
    let res = await window.sb.from("music").insert(payload).select();
    if (res.error && /uploader_email/.test(res.error.message || "")) {
        delete payload.uploader_email;
        res = await window.sb.from("music").insert(payload).select();
    }
    if (res.error) {
        alert("保存失败：" + res.error.message);
        return;
    }
    alert("已保存到「我的音乐」：" + title);
    loadMusicList();
}

window.openOnlineSearch = openOnlineSearch;
window.closeOnlineSearch = closeOnlineSearch;
window.switchOnlineSrc = switchOnlineSrc;
window.searchOnline = searchOnline;
window.previewOnlineSong = previewOnlineSong;
window.stopOnlinePreview = stopOnlinePreview;
window.saveOnlineSong = saveOnlineSong;

/* ================== 自定义音源（JS 文件）子系统 ==================
 * 音源接口规范（与洛雪音乐兼容）：
 *   module.exports = {
 *     id: 唯一ID,
 *     name: 显示名,
 *     async search(keyword) { return [{id, name, artist, pic, url?}] }
 *     async getUrl(item)   { return 播放链接字符串 }
 *     async getLyric(item) { return LRC 字符串（可为空） }
 *   }
 * 存储：localStorage.customMusicSources = { [id]: {id,name,code} }
 */

const BUILTIN_SOURCES = [
    { id: 'netease', name: '网易云', builtin: true },
    { id: 'tencent', name: 'QQ音乐', builtin: true },
    { id: 'kugou',   name: '酷狗',   builtin: true }
];
let _customSources = {};   // {id: {id,name,mod:{search,getUrl,getLyric}}}
let _editingSrcId = null; // 当前正在编辑的音源（null=新建）

function loadCustomSources() {
    try {
        const raw = localStorage.getItem('customMusicSources');
        const saved = raw ? JSON.parse(raw) : {};
        const map = {};
        for (const id of Object.keys(saved)) {
            const entry = saved[id];
            try {
                const mod = compileSourceScript(entry.code, id, entry.name);
                map[id] = { id, name: entry.name, mod, code: entry.code };
            } catch (e) {
                console.warn('音源编译失败', id, e);
            }
        }
        _customSources = map;
    } catch (e) {
        _customSources = {};
    }
    renderSourceButtons();
}

function saveCustomSourcesToStorage() {
    const out = {};
    for (const id of Object.keys(_customSources)) {
        out[id] = { id, name: _customSources[id].name, code: _customSources[id].code };
    }
    localStorage.setItem('customMusicSources', JSON.stringify(out));
}

/**
 * 沙箱编译音源脚本：
 * - 自动识别洛雪音源（globalThis.lx）脚本并走 wrapLxScript 适配器
 * - 标准 module.exports 脚本走原生沙箱
 * - 注入全局 fetch/URL/AbortSignal/console
 * - 阻止危险 API 访问（document/window/location/localStorage/navigator）
 */
function compileSourceScript(code, forcedId, forcedName) {
    // 洛雪音源（globalThis.lx）脚本走适配器
    if (isLxScript(code)) {
        return wrapLxScript(code, forcedId, forcedName);
    }
    const module = { exports: {} };
    const exports = module.exports;
    const sandboxFetch = (url, opts) => fetch(url, opts);
    const sandboxConsole = {
        log:   (...a) => console.log(`[音源${forcedId||'?'}]`, ...a),
        warn:  (...a) => console.warn(`[音源${forcedId||'?'}]`, ...a),
        error: (...a) => console.error(`[音源${forcedId||'?'}]`, ...a),
        info:  (...a) => console.info(`[音源${forcedId||'?'}]`, ...a)
    };
    const fn = new Function(
        'module', 'exports',
        'fetch', 'console', 'URL', 'URLSearchParams', 'AbortController', 'AbortSignal',
        '"use strict";\n' + code
    );
    fn(
        module, exports,
        sandboxFetch, sandboxConsole,
        URL, URLSearchParams, AbortController, AbortSignal
    );
    const raw = module.exports;
    const mod = typeof raw === 'function' ? raw() : raw;
    if (!mod || typeof mod !== 'object' || typeof mod.search !== 'function') {
        throw new Error('音源脚本必须导出对象，且包含 async search(keyword)');
    }
    if (typeof mod.getUrl !== 'function') {
        throw new Error('音源脚本必须导出 async getUrl(item)');
    }
    if (!mod.id && forcedId) mod.id = forcedId;
    if (!mod.name && forcedName) mod.name = forcedName;
    return mod;
}

// ========= 所有音源聚合：内置 + 自定义 =========
function getAllSources() {
    const builtins = BUILTIN_SOURCES.map(s => ({ ...s }));
    const customs = Object.values(_customSources).map(s => ({
        id: s.id, name: s.name || s.id, builtin: false
    }));
    return [...builtins, ...customs];
}

function isCustomSource(id) {
    return !!_customSources[id];
}

// 动态渲染音源按钮
function renderSourceButtons() {
    const box = document.getElementById('mpOsSources');
    if (!box) return;
    const sources = getAllSources();
    // 保留最后一个"+自定义"按钮
    const addBtn = box.querySelector('.mp-os-src-add');
    box.innerHTML = '';
    sources.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'mp-os-src-btn' + (_osSource === s.id ? ' active' : '');
        btn.dataset.src = s.id;
        btn.setAttribute('onclick', `switchOnlineSrc('${s.id}')`);
        btn.textContent = s.name;
        if (!s.builtin) {
            const del = document.createElement('span');
            del.className = 'mp-os-src-del';
            del.innerHTML = '<i class="fa fa-times"></i>';
            del.title = '删除该音源';
            del.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`删除自定义音源「${s.name}」？`)) {
                    deleteCustomSource(s.id);
                }
            };
            btn.appendChild(del);
        }
        box.appendChild(btn);
    });
    if (addBtn) box.appendChild(addBtn);
}

function deleteCustomSource(id) {
    if (!_customSources[id]) return;
    delete _customSources[id];
    saveCustomSourcesToStorage();
    if (_osSource === id) switchOnlineSrc('netease');
    renderSourceButtons();
}

// ========= 音源选择弹窗 =========
function openSourceEditor(editId) {
    loadCustomSources();
    renderSourceList();
    if (editId && _customSources[editId]) {
        _editingSrcId = editId;
        document.getElementById('mpSrcId').value = _customSources[editId].id;
        document.getElementById('mpSrcName').value = _customSources[editId].name;
        document.getElementById('mpSrcCode').value = _customSources[editId].code;
        document.getElementById('mpSrcId').disabled = true;
    } else {
        _editingSrcId = null;
        document.getElementById('mpSrcId').value = '';
        document.getElementById('mpSrcName').value = '';
        document.getElementById('mpSrcCode').value = '';
        document.getElementById('mpSrcId').disabled = false;
    }
    document.getElementById('mpSourceEditorModal').classList.remove('hidden');
}

function closeSourceEditor() {
    document.getElementById('mpSourceEditorModal').classList.add('hidden');
}

function renderSourceList() {
    const list = document.getElementById('mpSrcList');
    if (!list) return;
    const customs = Object.values(_customSources);
    if (customs.length === 0) {
        list.innerHTML = `<div class="mp-src-list-empty">暂无自定义音源，直接在下方编写即可</div>`;
        return;
    }
    list.innerHTML = customs.map(s => `
        <div class="mp-src-list-item ${_editingSrcId === s.id ? 'active' : ''}" onclick="editCustomSource('${s.id}')">
            <div class="mp-src-list-item-badge">U</div>
            <div class="mp-src-list-item-meta">
                <div class="mp-src-list-item-name">${escapeHtml(s.name || s.id)}</div>
                <div class="mp-src-list-item-id">${escapeHtml(s.id)}</div>
            </div>
            <button class="mp-src-list-item-del" onclick="event.stopPropagation(); if(confirm('删除「${escapeHtml(s.name || s.id)}」?'))deleteCustomSource('${s.id}'); renderSourceList();" title="删除">
                <i class="fa fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function editCustomSource(id) { openSourceEditor(id); }

function _collectSourceForm() {
    const id = document.getElementById('mpSrcId').value.trim();
    const name = document.getElementById('mpSrcName').value.trim();
    const code = document.getElementById('mpSrcCode').value;
    if (!id) { alert('请填写音源 ID'); return null; }
    if (!name) { alert('请填写音源显示名称'); return null; }
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]{0,31}$/.test(id)) { alert('音源 ID 格式错误：字母开头，长度 1-32，仅含字母数字下划线连字符'); return null; }
    if (BUILTIN_SOURCES.some(b => b.id === id)) { alert('音源 ID 与内置音源冲突，请换一个'); return null; }
    if (!code.trim()) { alert('请填写音源 JS 源码'); return null; }
    return { id, name, code };
}

function testSourceScript() {
    const info = _collectSourceForm();
    if (!info) return;
    try {
        const mod = compileSourceScript(info.code, info.id, info.name);
        const isLx = isLxScript(info.code);
        if (isLx) {
            const hasH = mod.lxRuntime && mod.lxRuntime._hasHandler();
            alert(`✓ 洛雪音源编译通过\n音源：${mod.name || info.name}\nrequest handler：${hasH ? '已注册 ✓' : '未注册 ✗'}\n可用接口：search(getUrl)${typeof mod.getLyric === 'function' ? ' getLyric' : ''}`);
        } else {
            if (typeof mod.search !== 'function') throw new Error('缺少 search(keyword)');
            if (typeof mod.getUrl !== 'function') throw new Error('缺少 getUrl(item)');
            alert(`✓ 脚本编译通过\n音源：${mod.name || info.name}\n可用接口：${typeof mod.search === 'function' ? 'search ' : ''}${typeof mod.getUrl === 'function' ? 'getUrl ' : ''}${typeof mod.getLyric === 'function' ? 'getLyric' : ''}`);
        }
    } catch (e) {
        alert('✗ 脚本错误：' + (e.message || e));
    }
}

function saveSourceScript() {
    const info = _collectSourceForm();
    if (!info) return;
    // 如果是新建且 ID 已存在，提示
    if (!_editingSrcId && _customSources[info.id]) {
        if (!confirm(`音源 ID「${info.id}」已存在，覆盖？`)) return;
    }
    try {
        const mod = compileSourceScript(info.code, info.id, info.name);
        _customSources[info.id] = {
            id: info.id,
            name: mod.name || info.name,
            mod,
            code: info.code
        };
        saveCustomSourcesToStorage();
        renderSourceButtons();
        alert('已保存音源：' + (mod.name || info.name));
        closeSourceEditor();
    } catch (e) {
        alert('保存失败，脚本错误：' + (e.message || e));
    }
}

// 覆盖原来的 switchOnlineSrc，添加按钮渲染
(function wrapSwitchOnlineSrc() {
    const orig = window.switchOnlineSrc;
    window.switchOnlineSrc = function (src) {
        orig(src);
        renderSourceButtons();
    };
})();

// ========= 自定义音源的 search / getUrl / getLyric 入口（供现有 searchOnline/previewOnlineSong/saveOnlineSong 调用）=========
async function customSourceSearch(srcId, keyword) {
    const s = _customSources[srcId];
    if (!s) return null;
    const res = await s.mod.search(keyword);
    return Array.isArray(res) ? res : null;
}

async function customSourceGetUrl(srcId, item) {
    const s = _customSources[srcId];
    if (!s) return null;
    return await s.mod.getUrl(item) || null;
}

async function customSourceGetLyric(srcId, item) {
    const s = _customSources[srcId];
    if (!s) return null;
    if (typeof s.mod.getLyric !== 'function') return null;
    return await s.mod.getLyric(item) || null;
}

// loadCustomSources() 移至文件末尾执行（需等 _lxBuffer/_lxMd5 等常量定义完毕）

window.openSourceEditor = openSourceEditor;
window.closeSourceEditor = closeSourceEditor;
window.editCustomSource = editCustomSource;
window.deleteCustomSource = deleteCustomSource;
window.saveSourceScript = saveSourceScript;
window.testSourceScript = testSourceScript;
window.importSourceFile = importSourceFile;

/* ================== 洛雪音源（globalThis.lx）适配器 ==================
 * 兼容洛雪音乐自定义源脚本规范：
 *   const { EVENT_NAMES, request, on, send, env, version, currentScriptInfo, utils } = globalThis.lx
 *   on(EVENT_NAMES.request, ({ source, action, info: { musicInfo, type } }) => Promise<result>)
 * 我们模拟这个运行时，并把脚本包装成统一的 search/getUrl/getLyric 接口。
 */

// ---------- MD5 实现（洛雪音源常用，如 utils.crypto.md5）----------
function _lxMd5(string) {
    function rotateLeft(x, n) { return (x << n) | (x >>> (32 - n)); }
    function addUnsigned(x, y) {
        const x4 = (x & 0x40000000) + (y & 0x40000000);
        const lsw = (x & 0x3FFFFFFF) + (y & 0x3FFFFFFF);
        if (x4 & 0x40000000) return (lsw ^ 0x80000000 ^ x4);
        if (lsw & 0x40000000) return (lsw ^ 0xC0000000 ^ x4);
        return (lsw ^ x4);
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function GG(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function HH(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function II(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
    function convertToWordArray(string) {
        let lWordCount;
        const lMessageLength = string.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = Array(lNumberOfWords - 1);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function wordToHex(lValue) {
        let WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    }
    function utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        let utftext = "";
        for (let n = 0; n < string.length; n++) {
            const c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    }
    const x = [];
    let k, AA, BB, CC, DD, a, b, c, d;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    string = utf8Encode(string);
    x = convertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        b = FF(b, a, c, d, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, a, b, d, x[k + 2], S13, 0x242070DB);
        d = FF(d, a, b, c, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        b = FF(b, a, c, d, x[k + 5], S12, 0x4787C62A);
        c = FF(c, a, b, d, x[k + 6], S13, 0xA8304613);
        d = FF(d, a, b, c, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
        b = FF(b, a, c, d, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, a, b, d, x[k + 10], S13, 0xFFFF5BB1);
        d = FF(d, a, b, c, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
        b = FF(b, a, c, d, x[k + 13], S12, 0xFD987193);
        c = FF(c, a, b, d, x[k + 14], S13, 0xA679438E);
        d = FF(d, a, b, c, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        b = GG(b, a, c, d, x[k + 6], S22, 0xC040B340);
        c = GG(c, a, b, d, x[k + 11], S23, 0x265E5A51);
        d = GG(d, a, b, c, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        b = GG(b, a, c, d, x[k + 10], S22, 0x2441453);
        c = GG(c, a, b, d, x[k + 15], S23, 0xD8A1E681);
        d = GG(d, a, b, c, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        b = GG(b, a, c, d, x[k + 14], S22, 0xC33707D6);
        c = GG(c, a, b, d, x[k + 3], S23, 0xF4D50D87);
        d = GG(d, a, b, c, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        b = GG(b, a, c, d, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, a, b, d, x[k + 7], S23, 0x676F02D9);
        d = GG(d, a, b, c, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        b = HH(b, a, c, d, x[k + 8], S32, 0x8771F681);
        c = HH(c, a, b, d, x[k + 11], S33, 0x6D9D6122);
        d = HH(d, a, b, c, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        b = HH(b, a, c, d, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, a, b, d, x[k + 7], S33, 0xF6BB4B60);
        d = HH(d, a, b, c, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        b = HH(b, a, c, d, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, a, b, d, x[k + 3], S33, 0xD4EF3085);
        d = HH(d, a, b, c, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        b = HH(b, a, c, d, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, a, b, d, x[k + 15], S33, 0x1FA27CF8);
        d = HH(d, a, b, c, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
        b = II(b, a, c, d, x[k + 7], S42, 0x432AFF97);
        c = II(c, a, b, d, x[k + 14], S43, 0xAB9423A7);
        d = II(d, a, b, c, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        b = II(b, a, c, d, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, a, b, d, x[k + 10], S43, 0xFFEFF47D);
        d = II(d, a, b, c, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        b = II(b, a, c, d, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, a, b, d, x[k + 6], S43, 0xA3014314);
        d = II(d, a, b, c, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        b = II(b, a, c, d, x[k + 11], S42, 0xBD3AF235);
        c = II(c, a, b, d, x[k + 2], S43, 0x2AD7D2BB);
        d = II(d, a, b, c, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// ---------- Buffer 模拟（洛雪 utils.buffer.from / bufToString）----------
const _lxBuffer = {
    from(data, encoding) {
        if (typeof data === 'string') {
            if (encoding === 'hex') {
                const bytes = new Uint8Array(data.length / 2);
                for (let i = 0; i < data.length; i += 2) bytes[i / 2] = parseInt(data.substr(i, 2), 16);
                return bytes;
            }
            if (encoding === 'base64') {
                const binary = atob(data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return bytes;
            }
            return new TextEncoder().encode(data);
        }
        if (data instanceof ArrayBuffer) return new Uint8Array(data);
        if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        return new Uint8Array(0);
    },
    bufToString(buf, encoding) {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        if (encoding === 'hex') {
            return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        if (encoding === 'base64') {
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            return btoa(binary);
        }
        return new TextDecoder(encoding || 'utf-8').decode(bytes);
    }
};

// ---------- 检测是否为洛雪音源脚本 ----------
function isLxScript(code) {
    // 明文形式：globalThis['lx'] / globalThis.lx
    if (/globalThis\s*\[\s*['"]lx['"]\s*\]/.test(code)) return true;
    if (/globalThis\.lx\b/.test(code)) return true;
    // 混淆形式：globalThis['\x6c\x78']（十六进制转义的 'lx'）
    if (/globalThis\s*\[\s*['"]\\x6c\\x78['"]\s*\]/.test(code)) return true;
    // 兜底：globalThis 后跟任意十六进制转义字符串属性访问，且含洛雪特征字（lx-music / rawScript）
    if (/globalThis\s*\[\s*['"]\\x[0-9a-fA-F]+['"]\s*\]/.test(code) &&
        /lx-music|rawScript|currentScriptInfo|EVENT_NAMES/i.test(code)) return true;
    return false;
}

// ---------- 创建洛雪 lx 运行时 ----------
function createLxRuntime(scriptInfo) {
    const EVENT_NAMES = {
        request: 'request',
        inited: 'inited',
        updateAlert: 'updateAlert'
    };
    let requestHandler = null;

    const request = (url, options, callback) => {
        // HTTPS 页面不允许 HTTP 请求（Mixed Content），自动升级
        const safeUrl = url.replace(/^http:\/\//i, 'https://');
        const opts = {
            method: (options && options.method) || 'GET',
            headers: (options && options.headers) || {}
        };
        if (options && options.body) opts.body = options.body;
        if (options && options.timeout) {
            try { opts.signal = AbortSignal.timeout(options.timeout); } catch (_) {}
        }
        const doFetch = (targetUrl) => fetch(targetUrl, opts).then(async (resp) => {
            const text = await resp.text();
            return { statusCode: resp.status, body: text, headers: Object.fromEntries(resp.headers.entries()) };
        });

        // 先直连，CORS 失败则依次走多个 CORS 代理（本地和线上统一）
        const proxies = [
            (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
            (u) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
            (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u)
        ];

        doFetch(safeUrl).then((result) => callback(null, result)).catch(() => {
            // 依次尝试 CORS 代理
            let idx = 0;
            const tryProxy = () => {
                if (idx >= proxies.length) { callback(new Error('所有 CORS 代理均失败'), null); return; }
                const proxied = proxies[idx](safeUrl);
                idx++;
                doFetch(proxied).then((result) => callback(null, result)).catch(() => tryProxy());
            };
            tryProxy();
        });
    };

    const on = (eventName, handler) => {
        if (eventName === EVENT_NAMES.request) {
            requestHandler = handler;
        }
    };
    const send = (eventName, data) => {
        // 忽略 updateAlert 等通知事件，仅记日志
        console.log(`[lx:${scriptInfo.name}] send ${eventName}`, data);
    };

    const utils = {
        buffer: _lxBuffer,
        crypto: {
            md5: _lxMd5,
            md5Base64: (s) => btoa(_lxMd5(s).match(/\w{2}/g).map(a => String.fromCharCode(parseInt(a, 16))).join('')),
            randomBytes: (n) => {
                const arr = new Uint8Array(n);
                crypto.getRandomValues(arr);
                return arr;
            },
            rsaEncrypt: () => { throw new Error('rsaEncrypt 暂不支持'); },
            aesEncrypt: () => { throw new Error('aesEncrypt 暂不支持'); }
        },
        url: {
            encode: encodeURIComponent,
            decode: decodeURIComponent
        }
    };

    const currentScriptInfo = {
        name: scriptInfo.name,
        version: scriptInfo.version || '1.0.0',
        rawScript: scriptInfo.code,
        // 洛雪音源里 currentScriptInfo.version 用于 source-ver header
    };

    return {
        EVENT_NAMES,
        request,
        on,
        send,
        env: 'web',
        version: '2.0.0',
        currentScriptInfo,
        utils,
        _hasHandler: () => typeof requestHandler === 'function',
        _callRequest: async (req) => {
            if (typeof requestHandler !== 'function') throw new Error('音源未注册 request handler');
            return await requestHandler(req);
        }
    };
}

// ---------- 包装洛雪脚本为标准接口 ----------
// 洛雪 source -> Meting server 映射
const LX_SOURCE_TO_METING = {
    tx: 'tencent', wy: 'netease', kw: 'kugou', kg: 'kugou', mg: 'netease'
};
const METING_TO_LX_SOURCE = {
    netease: 'wy', tencent: 'tx', kugou: 'kw'
};
// 音质映射：洛雪 type -> 我们默认 128k
function _lxQuality(metingQuality) {
    return metingQuality === '320k' ? '320k' : '128k';
}

async function _lxMetingSearch(server, keyword) {
    const params = new URLSearchParams({ server, type: 'search', s: keyword }).toString();
    const data = await _metingFetch(params);
    if (!Array.isArray(data)) return [];
    // 标注 source，供 getUrl 时使用
    return data.map(item => ({
        ...item,
        source: METING_TO_LX_SOURCE[server] || 'wy',
        _metingServer: server
    }));
}

async function _lxMetingLyric(server, item) {
    const params = new URLSearchParams({
        server, type: 'lyric',
        id: item.lyric_id || item.id
    }).toString();
    const lrcData = await _metingFetch(params);
    if (lrcData && typeof lrcData === 'object' && lrcData.lrc) return lrcData.lrc;
    if (typeof lrcData === 'string' && lrcData.includes('[')) return lrcData;
    return null;
}

function wrapLxScript(code, forcedId, forcedName) {
    const scriptInfo = { name: forcedName || forcedId, version: '1.0.0', code };
    // 从 @version 注释提取版本
    const vMatch = code.match(/@version\s+([0-9.]+)/);
    if (vMatch) scriptInfo.version = vMatch[1];
    const nMatch = code.match(/@name\s+(.+)/);
    if (nMatch) scriptInfo.name = nMatch[1].trim();

    const lx = createLxRuntime(scriptInfo);

    // 直接把脚本里所有 globalThis['lx'] / globalThis['\x6c\x78'] / globalThis.lx
    // 替换成参数 __lxRuntime，完全绕过 globalThis 访问问题
    let patchedCode = code
        .replace(/globalThis\s*\[\s*['"]lx['"]\s*\]/g, '__lxRuntime')
        .replace(/globalThis\s*\[\s*['"]\\x6c\\x78['"]\s*\]/g, '__lxRuntime')
        .replace(/globalThis\.lx\b/g, '__lxRuntime');

    const fn = new Function(
        '__lxRuntime',
        '"use strict";\n' + patchedCode
    );
    fn(lx);

    if (!lx._hasHandler()) {
        throw new Error('洛雪音源未注册 request handler（缺少 on(EVENT_NAMES.request, ...)）');
    }

    // 标准接口包装
    // 用户当前选择的内置音源作为搜索后端，避免洛雪脚本不实现 search
    let _searchServer = 'netease';

    const mod = {
        id: forcedId,
        name: scriptInfo.name,
        lxRuntime: lx,
        setSearchServer(server) { _searchServer = server; },

        async search(keyword) {
            // 洛雪音源大多只实现 musicUrl，搜索走 Meting 兜底
            try {
                return await _lxMetingSearch(_searchServer, keyword);
            } catch (e) {
                console.warn('lx search fallback failed', e);
                return [];
            }
        },

        async getUrl(item) {
            // 构造洛雪 musicInfo
            const musicInfo = {
                songmid: item.songmid || item.id,
                hash: item.hash || item.id,
                songId: item.songId || item.id,
                albummid: item.albummid || '',
                albumName: item.albumName || '',
                songmid_id: item.id,
                name: item.name || item.title,
                singer: (item.artist && Array.isArray(item.artist)) ? item.artist.join(' / ') : (item.artist || item.author || ''),
                source: item.source || METING_TO_LX_SOURCE[_searchServer] || 'wy',
                interval: item.interval || 0,
                img: item.pic || item.picurl || item.cover || null,
                meta: {},
                ...item
            };
            const type = _lxQuality('128k');
            const result = await lx._callRequest({
                source: musicInfo.source,
                action: 'musicUrl',
                info: { musicInfo, type }
            });
            // result 通常是 URL 字符串
            if (typeof result === 'string') return result;
            if (result && result.url) return result.url;
            if (result && result.body) return result.body;
            return null;
        },

        async getLyric(item) {
            // 先试洛雪脚本的 lyric action
            try {
                const musicInfo = {
                    songmid: item.songmid || item.id,
                    hash: item.hash || item.id,
                    songId: item.songId || item.id,
                    name: item.name || item.title,
                    singer: (item.artist && Array.isArray(item.artist)) ? item.artist.join(' / ') : (item.artist || item.author || ''),
                    source: item.source || METING_TO_LX_SOURCE[_searchServer] || 'wy',
                    ...item
                };
                const result = await lx._callRequest({
                    source: musicInfo.source,
                    action: 'lyric',
                    info: { musicInfo, type: '128k' }
                });
                if (typeof result === 'string' && result.includes('[')) return result;
                if (result && result.lyric) return result.lyric;
            } catch (e) {
                // 脚本不支持 lyric，走 Meting 兜底
            }
            // Meting 兜底
            try {
                const server = item._metingServer || _searchServer;
                return await _lxMetingLyric(server, item);
            } catch (_) {
                return null;
            }
        }
    };

    return mod;
}

// ---------- 导入 .js 文件 ----------
function importSourceFile() {
    // 音源导入功能已隐藏（如需恢复请取消下方注释并恢复 home.html 中的音源编辑弹窗）
    return;
    /* —— 原逻辑（已隐藏）——
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js,text/javascript';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const code = ev.target.result;
            // 从 @name 提取名称
            let name = file.name.replace(/\.js$/i, '');
            const nMatch = code.match(/@name\s+(.+)/);
            if (nMatch) name = nMatch[1].trim();
            // 生成 id：用文件名清洗
            let id = file.name.replace(/\.js$/i, '')
                .replace(/[^\x00-\x7F]/g, '')
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .replace(/^[0-9]+/, m => 's' + m)
                .slice(0, 32);
            if (!id) id = 'lx_' + Date.now().toString(36);

            document.getElementById('mpSrcId').value = id;
            document.getElementById('mpSrcName').value = name;
            document.getElementById('mpSrcCode').value = code;
            document.getElementById('mpSrcId').disabled = false;
            _editingSrcId = null;

            const type = isLxScript(code) ? '洛雪音源' : '标准音源';
            alert(`已导入「${name}」\n类型：${type}\n\n请点击「测试脚本」验证后保存。`);
        };
        reader.readAsText(file);
    };
    input.click();
    */
}

// 所有 const 定义完毕后，加载自定义音源（含洛雪音源编译）
// loadCustomSources(); // 在线搜歌功能已隐藏，无需加载/编译自定义音源
