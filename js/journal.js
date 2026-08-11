/**
 * 日志逻辑
 * 日志的增删改查（分页）、照片上传、评论与点赞
 */

// ===== 依赖 =====
(function() {
const sb = window.sb;
const CONFIG = window.CONFIG;

// ===== 日志 =====
let journalPhotos = [];
window.journalPhotos = journalPhotos;

// 脚本由 loader.js 动态加载，DOM 已就绪，无需 DOMContentLoaded
(function setupJournalEvents() {
    document.getElementById("journalFileInput").onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(f => journalPhotos.push(f));
        renderJournalPreview();
        e.target.value = "";
    };
    const lbSfxBtn = document.getElementById("lbSfxToggle");
    if (lbSfxBtn) lbSfxBtn.addEventListener("click", window.toggleBgm);
})();

function renderJournalPreview() {
    const wrap = document.getElementById("journalPhotoPreview");
    wrap.innerHTML = journalPhotos.map((f, i) => `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden">
            <img src="${URL.createObjectURL(f)}" class="w-full h-full object-cover">
            <button onclick="journalPhotos.splice(${i},1);renderJournalPreview()"
                class="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-bl-lg">&times;</button>
        </div>`).join("");
}

async function addJournal() {
    const title = document.getElementById("journalTitle").value.trim();
    const content = document.getElementById("journalContent").value.trim();
    const day = document.getElementById("journalDate").value;
    if (!content) return alert("请写下日志内容");
    if (!day) return alert("请选择日期");
    const btn = event.target;
    btn.innerText = "发布中...";
    btn.disabled = true;
    try {
        const { data: { user } } = await sb.auth.getUser();
        const username = user?.email || "匿名";

        let photoUrls = [];
        if (journalPhotos.length > 0) {
            for (const file of journalPhotos) {
                const compressed = await window.compressImage(file, 1920, 0.8);
                const fileName = `journal_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
                const { data, error } = await sb.storage.from("music").upload(fileName, compressed);
                if (!error) photoUrls.push(sb.storage.from("music").getPublicUrl(data.path).data.publicUrl);
            }
        }

        await sb.from("journal").insert({ title, content, day, username, photos: photoUrls.length ? JSON.stringify(photoUrls) : null });
        window.sendNotification("journal", "📔 发布了日志：" + (title || "无标题"));
        document.getElementById("journalTitle").value = "";
        document.getElementById("journalContent").value = "";
        journalPhotos = [];
        window.journalPhotos = journalPhotos;
        renderJournalPreview();
        loadJournal();
    } catch (err) {
        alert("发布失败：" + err.message);
    } finally {
        btn.innerHTML = '<i class="fa fa-pencil mr-1"></i>写下这一篇';
        btn.disabled = false;
    }
}

let journalData = [];
let journalCommentsMap = {};
let journalLikesMap = {};
let journalPage = 1;
const JOURNAL_PAGE_SIZE = 5;

async function loadJournal() {
    const wrap = document.getElementById("journalList");
    wrap.innerHTML = `<div class="text-center text-gray-400 py-4 loading">加载日志...</div>`;
    const { data } = await sb.from("journal").select("*").order("created_at", { ascending: false });
    if (!data || data.length === 0) {
        journalData = [];
        wrap.innerHTML = `<div class="text-center text-gray-400 py-4">还没有日志，记录你们的第一篇故事吧💫</div>`;
        return;
    }
    const journalIds = data.map(d => d.id);
    journalCommentsMap = {};
    journalLikesMap = {};
    try {
        const [cRes, lRes] = await Promise.all([
            sb.from("journal_comments").select("id,journal_id,username,content,created_at").in("journal_id", journalIds).order("created_at", { ascending: true }),
            sb.from("journal_likes").select("journal_id,username").in("journal_id", journalIds)
        ]);
        (cRes.data || []).forEach(c => {
            if (!journalCommentsMap[c.journal_id]) journalCommentsMap[c.journal_id] = [];
            journalCommentsMap[c.journal_id].push(c);
        });
        (lRes.data || []).forEach(l => {
            if (!journalLikesMap[l.journal_id]) journalLikesMap[l.journal_id] = [];
            journalLikesMap[l.journal_id].push(l.username);
        });
    } catch (e) { console.warn("加载评论点赞失败:", e); }

    journalData = data;
    journalPage = 1;
    renderJournalList();
}

function renderJournalList() {
    const wrap = document.getElementById("journalList");
    wrap.innerHTML = "";
    if (journalData.length === 0) {
        wrap.innerHTML = `<div class="text-center text-gray-400 py-4">还没有日志，记录你们的第一篇故事吧💫</div>`;
        return;
    }
    const totalPages = Math.ceil(journalData.length / JOURNAL_PAGE_SIZE);
    if (journalPage > totalPages) journalPage = totalPages;
    if (journalPage < 1) journalPage = 1;
    const items = journalData.slice((journalPage - 1) * JOURNAL_PAGE_SIZE, journalPage * JOURNAL_PAGE_SIZE);
    const me = (window.myRpsEmail || "").toLowerCase();
    items.forEach(item => {
        const email = item.username || "";
        let name = email || "匿名";
        if (email === CONFIG.boyEmail) name = CONFIG.boyName;
        else if (email === CONFIG.girlEmail) name = CONFIG.girlName;
        const title = item.title || "无标题";
        let photos = [];
        try { photos = item.photos ? JSON.parse(item.photos) : []; } catch(e) { photos = []; }
        const photoHtml = photos.length
            ? `<div class="flex gap-2 flex-wrap mt-2">${photos.map(url => `<img src="${url}" class="w-20 h-20 object-cover rounded-lg cursor-pointer" onclick="openPreview('${url}')">`).join("")}</div>`
            : "";
        const jid = String(item.id);
        const likes = journalLikesMap[jid] || [];
        const comments = journalCommentsMap[jid] || [];
        const liked = likes.some(u => (u || "").toLowerCase() === me);
        const likerNames = likes.map(u => {
            if (u === CONFIG.boyEmail) return CONFIG.boyName;
            if (u === CONFIG.girlEmail) return CONFIG.girlName;
            return u || "匿名";
        });
        const likerTip = likerNames.length ? likerNames.join("、") + " 点赞了" : "";
        const commentsHtml = comments.map(c => {
            let cn = c.username || "匿名";
            if (c.username === CONFIG.boyEmail) cn = CONFIG.boyName;
            else if (c.username === CONFIG.girlEmail) cn = CONFIG.girlName;
            return `<div class="flex items-start gap-2 py-1.5 text-sm">
                <span class="text-love font-semibold flex-shrink-0">${cn}：</span>
                <span class="text-gray-600 flex-1 break-all">${(c.content || "").replace(/</g, "&lt;")}</span>
            </div>`;
        }).join("");
        wrap.innerHTML += `
        <div class="journal-item bg-rose-50 p-4 rounded-xl border-l-4 border-love">
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="font-bold text-love">${name}</span>
                    <span class="text-xs text-gray-400 ml-2">${item.day}</span>
                </div>
                <button onclick="deleteJournal('${item.id}')" class="text-gray-400 hover:text-red-500 text-sm">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
            <h3 class="font-semibold text-gray-800 mb-1">${title}</h3>
            <p class="text-gray-600 whitespace-pre-wrap text-sm">${item.content}</p>
            ${photoHtml}
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-rose-100">
                <button onclick="toggleLike('${jid}')" title="${likerTip}" class="flex items-center gap-1 text-sm transition ${liked ? 'text-love' : 'text-gray-400 hover:text-love'}">
                    <i class="fa ${liked ? 'fa-heart' : 'fa-heart-o'}"></i>
                    <span>${likes.length}</span>
                </button>
                <button onclick="toggleComments('${jid}')" class="flex items-center gap-1 text-sm text-gray-400 hover:text-love transition">
                    <i class="fa fa-comment-o"></i>
                    <span>${comments.length}</span>
                </button>
            </div>
            ${likerNames.length ? `<div class="mt-2 text-xs text-gray-400"><i class="fa fa-heart text-love mr-1"></i>${likerNames.join("、")} 点赞了</div>` : ""}
            <div id="comments-${jid}" class="hidden mt-3 pt-3 border-t border-rose-100">
                <div class="mb-2">${commentsHtml || '<div class="text-center text-gray-400 text-xs py-2">还没有评论</div>'}</div>
                <div class="flex gap-2">
                    <input id="commentInput-${jid}" placeholder="写评论..." maxlength="100" class="flex-1 border border-rose-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-love">
                    <button onclick="addComment('${jid}')" class="bg-love text-white px-3 py-1.5 rounded-lg text-sm">发送</button>
                </div>
            </div>
        </div>`;
    });
    if (totalPages > 1) {
        wrap.innerHTML += `<div class="text-center py-3 flex items-center justify-center gap-4">
            <button onclick="window.journalPrevPage()" ${journalPage <= 1 ? 'disabled class="text-gray-300 text-sm cursor-not-allowed"' : 'class="text-love text-sm hover:underline"'}>上一页</button>
            <span class="text-sm text-gray-500">${journalPage} / ${totalPages}</span>
            <button onclick="window.journalNextPage()" ${journalPage >= totalPages ? 'disabled class="text-gray-300 text-sm cursor-not-allowed"' : 'class="text-love text-sm hover:underline"'}>下一页</button>
        </div>`;
    }
}

async function deleteJournal(id) {
    if (!confirm("确定删除这篇日志？")) return;
    await sb.from("journal").delete().eq("id", id);
    loadJournal();
}

let _togglingLike = false;
async function toggleLike(jid) {
    const me = window.myRpsEmail || "";
    if (!me) { alert("请先登录"); return; }
    if (_togglingLike) return;
    _togglingLike = true;
    try {
        const { data } = await sb.from("journal_likes").select("id").eq("journal_id", jid).eq("username", me);
        if (data && data.length > 0) {
            await sb.from("journal_likes").delete().eq("journal_id", jid).eq("username", me);
        } else {
            await sb.from("journal_likes").insert({ journal_id: parseInt(jid), username: me });
            window.sendNotification("like", "❤️ 点赞了你的日志");
        }
        loadJournal();
    } finally {
        _togglingLike = false;
    }
}

function toggleComments(jid) {
    const el = document.getElementById("comments-" + jid);
    el.classList.toggle("hidden");
}

let _isAddingComment = false;
async function addComment(jid) {
    if (_isAddingComment) return;
    const input = document.getElementById("commentInput-" + jid);
    const content = input.value.trim();
    if (!content) return;
    const me = window.myRpsEmail || "";
    if (!me) { alert("请先登录"); return; }
    _isAddingComment = true;
    try {
        const { error } = await sb.from("journal_comments").insert({ journal_id: parseInt(jid), username: me, content });
        if (error) { alert("评论失败：" + error.message); return; }
        window.sendNotification("comment", "💭 评论了日志：" + (content.length > 20 ? content.slice(0,20) + "..." : content));
        input.value = "";
        loadJournal();
    } finally {
        _isAddingComment = false;
    }
}

// ===== 导出公共 API =====
window.renderJournalPreview = renderJournalPreview;
window.addJournal = addJournal;
window.loadJournal = loadJournal;
window.renderJournalList = renderJournalList;
window.journalPrevPage = () => { journalPage--; renderJournalList(); };
window.journalNextPage = () => { journalPage++; renderJournalList(); };
window.deleteJournal = deleteJournal;
window.toggleLike = toggleLike;
window.toggleComments = toggleComments;
window.addComment = addComment;

})();
