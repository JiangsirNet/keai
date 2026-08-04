let musicList = [];
let musicSortBy = 'date_desc';
let currentMusicIndex = -1;

function toggleMusicPanel() {
    const panel = document.getElementById("musicPanel");
    panel.classList.toggle("hidden-panel");
}

async function loadMusicList() {
    let orderCol, ascending;
    switch (musicSortBy) {
        case 'date_asc': orderCol = 'created_at'; ascending = true; break;
        case 'title_asc': orderCol = 'title'; ascending = true; break;
        case 'title_desc': orderCol = 'title'; ascending = false; break;
        default: orderCol = 'created_at'; ascending = false; break;
    }
    const { data } = await window.sb.from("music").select("*").order(orderCol, { ascending });
    musicList = data || [];
    const listEl = document.getElementById("musicList");
    listEl.innerHTML = "";
    ['sortDateDesc','sortDateAsc','sortTitleAsc','sortTitleDesc'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            const val = id === 'sortDateDesc' ? 'date_desc' : id === 'sortDateAsc' ? 'date_asc' : id === 'sortTitleAsc' ? 'title_asc' : 'title_desc';
            btn.classList.toggle('active', val === musicSortBy);
        }
    });
    if (musicList.length === 0) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-2 text-xs">暂无歌曲，上传一首吧</div>`;
        return;
    }
    musicList.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "music-item" + (idx === currentMusicIndex ? " active" : "");
        div.innerHTML = `
            <span onclick="playMusic(${idx})">${item.title || "未知歌曲"}</span>
            <span class="del" onclick="deleteMusic('${item.id}')"><i class="fa fa-trash"></i></span>
        `;
        listEl.appendChild(div);
    });
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
    document.getElementById("musicTitle").innerText = item.title;
    document.getElementById("musicCover").classList.add("playing");
    document.getElementById("musicToggle").classList.add("playing");
    document.getElementById("musicPlayBtn").innerHTML = '<i class="fa fa-pause"></i>';
    loadMusicList();
}

function togglePlay() {
    const audio = document.getElementById("musicAudio");
    if (currentMusicIndex === -1) {
        if (musicList.length > 0) playMusic(0);
        return;
    }
    if (audio.paused) {
        audio.play();
        document.getElementById("musicCover").classList.add("playing");
        document.getElementById("musicToggle").classList.add("playing");
        document.getElementById("musicPlayBtn").innerHTML = '<i class="fa fa-pause"></i>';
    } else {
        audio.pause();
        document.getElementById("musicCover").classList.remove("playing");
        document.getElementById("musicToggle").classList.remove("playing");
        document.getElementById("musicPlayBtn").innerHTML = '<i class="fa fa-play"></i>';
    }
}

function prevMusic() {
    if (musicList.length === 0) return;
    const idx = currentMusicIndex <= 0 ? musicList.length - 1 : currentMusicIndex - 1;
    playMusic(idx);
}

function nextMusic() {
    if (musicList.length === 0) return;
    const idx = currentMusicIndex >= musicList.length - 1 ? 0 : currentMusicIndex + 1;
    playMusic(idx);
}

function updateProgress() {
    const audio = document.getElementById("musicAudio");
    if (!audio.duration) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    document.getElementById("musicProgressBar").style.width = percent + "%";
    document.getElementById("musicCurrent").innerText = formatTime(audio.currentTime);
    document.getElementById("musicDuration").innerText = formatTime(audio.duration);
}

function seekMusic(e) {
    const audio = document.getElementById("musicAudio");
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
}

function onMusicEnded() {
    nextMusic();
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

window.musicList = musicList;
window.musicSortBy = musicSortBy;
window.currentMusicIndex = currentMusicIndex;
window.toggleMusicPanel = toggleMusicPanel;
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