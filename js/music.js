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

    musicList.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "mp-item" + (idx === currentMusicIndex ? " active" : "");
        const coverHtml = item.cover_url
            ? `<div class="mp-item-cover" style="background-image:url('${item.cover_url}')"></div>`
            : `<div class="mp-item-cover">${escapeHtml((item.title || '?').charAt(0))}</div>`;
        div.innerHTML = `
            ${coverHtml}
            <span class="mp-item-title">${escapeHtml(item.title || "未知歌曲")}</span>
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
    const { data, error } = await window.sb.storage.from("music").upload(fileName, file);
    if (error) {
        alert("上传失败：" + error.message);
        return;
    }
    const url = window.sb.storage.from("music").getPublicUrl(data.path).data.publicUrl;
    await window.sb.from("music").insert({ title, url });
    window.sendNotification("music", "🎵 上传了歌曲：" + title);
    e.target.value = "";
    loadMusicList();
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
    audio.src = item.url;
    audio.play();

    document.getElementById("mpTitle").innerText = item.title || "未知歌曲";
    document.getElementById("mpPlayBtn").innerHTML = '<i class="fa fa-pause"></i>';

    updateCover(item);
    parseLyrics(item.lyrics);
    loadMusicList();
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
    document.getElementById("mpLyrics").classList.toggle("hidden-lyrics", !lyricsVisible);
    document.getElementById("mpLyricsBtn").classList.toggle("active", lyricsVisible);
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
window.togglePlaylist = togglePlaylist;
window.toggleLyricsView = toggleLyricsView;
