// ===== 依赖 =====
(function() {
const sb = window.sb;
const CONFIG = window.CONFIG;

// ===== 照片上传 =====

async function uploadImageToImgBB(e) {
    const file = e.target.files[0];
    const uploadBtn = document.getElementById("uploadBtn");
    if (!file || !window.IMGBB_KEY) {
        alert("缺少ImgBB密钥，请重新登录");
        e.target.value = "";
        return;
    }

    const maxSize = 32 * 1024 * 1024;
    if (file.size > maxSize) {
        alert("图片不能超过32MB");
        e.target.value = "";
        return;
    }
    const allowType = ["image/jpeg", "image/png", "image/webp"];
    if (!allowType.includes(file.type)) {
        alert("仅支持jpg/png/webp");
        e.target.value = "";
        return;
    }

    uploadBtn.innerText = "压缩中...";
    uploadBtn.disabled = true;

    try {
        const compressedFile = await window.compressImage(file, 1920, 0.8);

        uploadBtn.innerText = "上传中...";

        const formData = new FormData();
        formData.append('image', compressedFile);
        formData.append('key', window.IMGBB_KEY);

        const res = await fetch(`https://api.imgbb.com/1/upload`, {
            method: "POST",
            body: formData
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error?.message || "上传失败");

        const imgUrl = result.data.url;
        const deleteUrl = result.data.delete_url;

        await sb.from("gallery").insert({ img_url: imgUrl, delete_url: deleteUrl });
        window.sendNotification("photo", "📷 上传了一张照片");
        loadGallery();
    } catch (err) {
        console.error(err);
        alert("图片上传失败：" + err.message);
    } finally {
        uploadBtn.innerHTML = '<i class="fa fa-upload mr-1"></i>上传合照';
        uploadBtn.disabled = false;
        e.target.value = "";
    }
}

async function deletePhoto(id, deleteLink) {
    if (!confirm("确定删除照片？无法恢复！")) return;
    try {
        await fetch(deleteLink);
    } catch (e) {
        console.log("远程图片删除失败，仅清理数据库记录");
    }
    await sb.from("gallery").delete().eq("id", id);
    loadGallery();
}

// ===== 相册 =====
let galleryData = [];
let galleryShowCount = 10;
const GALLERY_PAGE_SIZE = 10;

async function loadGallery() {
    const { data } = await sb.from("gallery").select("*").order("create_at", { ascending: false });
    galleryData = data || [];
    galleryShowCount = GALLERY_PAGE_SIZE;
    renderGallery();
}

function renderGallery() {
    const wrap = document.getElementById("galleryWrap");
    wrap.innerHTML = "";
    if (galleryData.length === 0) {
        wrap.innerHTML = `<div class="col-span-2 text-center text-gray-400 py-10">暂无照片，上传第一张合照吧💖</div>`;
        return;
    }
    const items = galleryData.slice(0, galleryShowCount);
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "img-card relative group";
        div.innerHTML = `
            <div class="img-loading absolute inset-0 z-10" id="loading-${item.id}"><div class="spinner"></div></div>
            <img src="${item.img_url}" class="loading aspect-square rounded-xl object-cover w-full cursor-pointer hover:opacity-90"
                onclick="openPreview('${item.img_url}')"
                onload="onImgLoaded(this,'${item.id}')"
                onerror="onImgError(this,'${item.id}','${item.img_url}')">
            <div class="img-error-tip hidden" id="err-${item.id}" onclick="retryImg('${item.id}','${item.img_url}')">
                <i class="fa fa-refresh"></i><span>点击重试</span>
            </div>
            <button onclick="deletePhoto('${item.id}','${item.delete_url}')" class="del-btn absolute top-2 right-2 bg-red-500 text-white text-sm shadow-lg opacity-80 hover:opacity-100 z-20">
                <i class="fa fa-trash"></i>
            </button>
        `;
        wrap.appendChild(div);
        checkImgTimeout(item.id);
    });
    if (galleryData.length > galleryShowCount) {
        const pager = document.createElement("div");
        pager.className = "col-span-2 text-center py-4";
        pager.innerHTML = `<button onclick="galleryShowCount+=${GALLERY_PAGE_SIZE};renderGallery()" class="text-love text-sm hover:underline">加载更多（${galleryData.length - galleryShowCount} 张）</button>`;
        wrap.appendChild(pager);
    }
}

function onImgLoaded(img, id) {
    img.classList.replace('loading', 'loaded');
    const loader = document.getElementById('loading-' + id);
    if (loader) loader.style.display = 'none';
    const errTip = document.getElementById('err-' + id);
    if (errTip) errTip.classList.add('hidden');
}

function onImgError(img, id, url) {
    img.classList.remove('loading');
    img.classList.add('error');
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23fde8ee'/%3E%3Ctext x='100' y='105' font-size='14' fill='%23ff6b8b' text-anchor='middle'%3E加载失败%3C/text%3E%3C/svg%3E";
    const loader = document.getElementById('loading-' + id);
    if (loader) loader.style.display = 'none';
    const errTip = document.getElementById('err-' + id);
    if (errTip) errTip.classList.remove('hidden');
}

function retryImg(id, url) {
    const loader = document.getElementById('loading-' + id);
    if (loader) loader.style.display = 'flex';
    const errTip = document.getElementById('err-' + id);
    if (errTip) errTip.classList.add('hidden');
    const img = loader.parentElement.querySelector('img');
    img.classList.remove('error');
    img.classList.add('loading');
    img.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
}

function checkImgTimeout(id) {
    setTimeout(() => {
        const loader = document.getElementById('loading-' + id);
        const img = loader ? loader.parentElement.querySelector('img') : null;
        if (loader && img && img.classList.contains('loading') && !img.complete) {
            onImgError(img, id, img.src);
        }
    }, 60000);
}

// ===== 语音留言 =====
let mediaRecorder = null;
let voiceChunks = [];
let recordTimer = null;
let recordSeconds = 0;

function pickVoiceMime() {
    const types = ["audio/mp4", "audio/mpeg", "audio/webm"];
    for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
}

async function toggleVoiceRecord() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const voiceMime = pickVoiceMime();
        mediaRecorder = voiceMime ? new MediaRecorder(stream, { mimeType: voiceMime }) : new MediaRecorder(stream);
        const actualMime = mediaRecorder.mimeType || "audio/webm";
        const ext = actualMime.includes("mp4") ? "m4a" : actualMime.includes("mpeg") ? "mp3" : "webm";
        voiceChunks = [];
        mediaRecorder.ondataavailable = (e) => voiceChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            clearInterval(recordTimer);
            const btn = document.getElementById("voiceBtn");
            btn.classList.remove("recording");
            document.getElementById("voiceBtnText").textContent = "上传中...";
            document.getElementById("recordTimer").classList.add("hidden");

            const blob = new Blob(voiceChunks, { type: actualMime });
            if (blob.size < 1000) { alert("录音太短"); document.getElementById("voiceBtnText").textContent = "语音留言"; return; }

            try {
                const fileName = `voice_${Date.now()}.${ext}`;
                const { data, error } = await sb.storage.from("music").upload(fileName, blob);
                if (error) throw error;
                const url = sb.storage.from("music").getPublicUrl(data.path).data.publicUrl;
                const { data: { user } } = await sb.auth.getUser();
                const username = user?.email || "匿名";
                await sb.from("messages").insert({ content: "🎤 语音留言", voice_url: url, username });
                window.sendNotification("voice", "🎤 发送了一条语音留言");
                loadMessages();
            } catch (err) {
                alert("语音上传失败：" + err.message);
            } finally {
                document.getElementById("voiceBtnText").textContent = "语音留言";
            }
        };
        mediaRecorder.start();
        const btn = document.getElementById("voiceBtn");
        btn.classList.add("recording");
        document.getElementById("voiceBtnText").textContent = "停止录音";
        document.getElementById("recordTimer").classList.remove("hidden");
        recordSeconds = 0;
        recordTimer = setInterval(() => {
            recordSeconds++;
            const m = String(Math.floor(recordSeconds / 60)).padStart(2, "0");
            const s = String(recordSeconds % 60).padStart(2, "0");
            document.getElementById("recordTimer").textContent = `${m}:${s}`;
            if (recordSeconds >= 120) mediaRecorder.stop();
        }, 1000);
    } catch (err) {
        alert("无法访问麦克风：" + err.message);
    }
}

// ===== 文字留言 =====
let _isSendingMessage = false;
async function sendMessage() {
    if (_isSendingMessage) return;
    const text = document.getElementById("msgInput").value.trim();
    if (!text) return alert("请输入留言");
    _isSendingMessage = true;
    try {
        const { data: { user } } = await sb.auth.getUser();
        const username = user?.email || "匿名";
        await sb.from("messages").insert({ content: text, username });
        window.sendNotification("message", "💬 发送了一条留言：" + (text.length > 20 ? text.slice(0,20) + "..." : text));
        document.getElementById("msgInput").value = "";
        loadMessages();
    } finally {
        _isSendingMessage = false;
    }
}

let msgData = [];
let msgShowCount = 10;
const MSG_PAGE_SIZE = 10;

async function loadMessages() {
    const { data } = await sb.from("messages").select("*").order("create_at", { ascending: false });
    msgData = data || [];
    msgShowCount = MSG_PAGE_SIZE;
    renderMessages();
}

function renderMessages() {
    const wrap = document.getElementById("msgList");
    wrap.innerHTML = "";
    if (msgData.length === 0) {
        wrap.innerHTML = `<div class="text-center text-gray-400 py-4">还没有留言，写下第一句话吧</div>`;
        return;
    }
    const items = msgData.slice(0, msgShowCount);
    items.forEach(item => {
        const time = new Date(item.create_at).toLocaleString();
        const email = item.username || "";
        let name = email || "匿名";
        if (email === CONFIG.boyEmail) name = CONFIG.boyName;
        else if (email === CONFIG.girlEmail) name = CONFIG.girlName;
        const voiceHtml = item.voice_url
            ? `<audio controls class="w-full mt-2" src="${item.voice_url}"></audio>`
            : `<p class="text-gray-700 mt-1">${item.content}</p>`;
        wrap.innerHTML += `
            <div class="bg-rose-50 p-4 rounded-xl relative">
                <span class="font-bold text-love text-sm">${name}</span>
                ${voiceHtml}
                <span class="text-xs text-gray-400">${time}</span>
                <button onclick="deleteMessage('${item.id}')" class="del-btn absolute top-2 right-2 bg-red-500 text-white text-xs hover:bg-red-600 transition shadow-md z-10">
                    <i class="fa fa-trash"></i>
                </button>
            </div>`;
    });
    if (msgData.length > msgShowCount) {
        wrap.innerHTML += `<div class="text-center py-3"><button onclick="msgShowCount+=${MSG_PAGE_SIZE};renderMessages()" class="text-love text-sm hover:underline">加载更多（${msgData.length - msgShowCount} 条）</button></div>`;
    }
}

async function deleteMessage(id) {
    if (!confirm("确定删除这条留言？")) return;
    try {
        await sb.from("messages").delete().eq("id", id);
        loadMessages();
    } catch (err) {
        alert("删除失败：" + err.message);
    }
}

// ===== 导出公共 API =====
window.uploadImageToImgBB = uploadImageToImgBB;
window.deletePhoto = deletePhoto;
window.loadGallery = loadGallery;
window.renderGallery = renderGallery;
window.onImgLoaded = onImgLoaded;
window.onImgError = onImgError;
window.retryImg = retryImg;
window.checkImgTimeout = checkImgTimeout;
window.pickVoiceMime = pickVoiceMime;
window.toggleVoiceRecord = toggleVoiceRecord;
window.sendMessage = sendMessage;
window.loadMessages = loadMessages;
window.renderMessages = renderMessages;
window.deleteMessage = deleteMessage;

})();