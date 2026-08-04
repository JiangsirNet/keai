let notificationChannel = null;
let notifications = [];
let unreadCount = 0;

const NOTIF_ICONS = {
    message: '💬', journal: '📔', photo: '📷', music: '🎵',
    quote: '💬', comment: '💭', like: '❤️', voice: '🎤'
};

const _sentNotifications = new Map();
const NOTIFICATION_DEDUP_MS = 500;

async function initNotifications() {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;
    const myEmail = user.email.toLowerCase();

    await loadNotifications();

    notificationChannel = window.sb.channel("notifications_channel")
        .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `to_email=eq.${myEmail}`
        }, (payload) => {
            notifications.unshift(payload.new);
            unreadCount++;
            updateBellBadge();
            renderBellList();
            const bell = document.getElementById("bellToggle");
            bell.style.animation = "bell-shake 0.5s ease 3";
            setTimeout(() => { bell.style.animation = ""; }, 1500);
        })
        .subscribe();
}

async function loadNotifications() {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;
    const myEmail = user.email.toLowerCase();
    const { data, error } = await window.sb.from("notifications")
        .select("*")
        .eq("to_email", myEmail)
        .order("created_at", { ascending: false })
        .limit(50);
    if (error) { console.warn("加载通知失败:", error.message); return; }
    notifications = data || [];
    unreadCount = notifications.filter(n => !n.is_read).length;
    updateBellBadge();
    renderBellList();
}

async function sendNotification(type, content) {
    try {
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) return;
        const fromEmail = (user.email || "").toLowerCase().trim();
        const boyEmail = (window.CONFIG.boyEmail || "").toLowerCase().trim();
        const girlEmail = (window.CONFIG.girlEmail || "").toLowerCase().trim();
        let toEmail = "";
        let fromName = window.CONFIG.boyName;
        if (fromEmail && fromEmail === boyEmail) {
            toEmail = girlEmail;
            fromName = window.CONFIG.boyName;
        } else if (fromEmail && fromEmail === girlEmail) {
            toEmail = boyEmail;
            fromName = window.CONFIG.girlName;
        } else {
            console.warn("[通知] 当前登录邮箱未匹配到男女配置，跳过发送：", fromEmail);
            return;
        }
        if (!toEmail) {
            console.warn("[通知] 收件人邮箱为空，跳过发送");
            return;
        }

        const dedupKey = `${type}|${fromEmail}|${toEmail}|${content}`;
        const now = Date.now();
        const lastSent = _sentNotifications.get(dedupKey);
        if (lastSent && (now - lastSent) < NOTIFICATION_DEDUP_MS) {
            console.warn("[通知] 去重跳过:", type);
            return;
        }
        _sentNotifications.set(dedupKey, now);

        console.log("[通知] 发送:", fromName, fromEmail, "→", toEmail, "类型:", type);
        const fullContent = fromName + " " + content;
        await window.sb.from("notifications").insert({
            type, content: fullContent, from_email: fromEmail, to_email: toEmail, is_read: false
        });
        if (window.EMAILJS_SERVICE_ID && window.EMAILJS_TEMPLATE_ID && window.emailjs) {
            try {
                await window.emailjs.send(window.EMAILJS_SERVICE_ID, window.EMAILJS_TEMPLATE_ID, {
                    to_email: toEmail,
                    from_name: fromName,
                    message: content,
                    notification_type: type,
                    app_title: "情侣空间"
                });
                console.log("[通知] 邮件已发送至:", toEmail);
            } catch (emailErr) { console.warn("邮件发送失败:", emailErr); }
        }
    } catch (e) { console.warn("发送通知失败:", e); }
}

function updateBellBadge() {
    const badge = document.getElementById("bellBadge");
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function renderBellList() {
    const listEl = document.getElementById("bellList");
    if (notifications.length === 0) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-4 text-xs">暂无通知</div>`;
        return;
    }
    listEl.innerHTML = notifications.map(n => {
        const icon = NOTIF_ICONS[n.type] || '🔔';
        const time = formatNotifTime(n.created_at);
        return `<div class="bell-item ${n.is_read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
            <span class="bell-icon">${icon}</span>
            <div class="bell-content">
                <div>${escapeHtml(n.content || '')}</div>
                <div class="bell-time">${time}</div>
            </div>
        </div>`;
    }).join("");
}

function formatNotifTime(t) {
    if (!t) return '';
    const d = new Date(t);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + '天前';
    return d.toLocaleDateString();
}

function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function markNotifRead(id) {
    const n = notifications.find(x => String(x.id) === String(id));
    if (!n || n.is_read) return;
    n.is_read = true;
    unreadCount = Math.max(0, unreadCount - 1);
    updateBellBadge();
    renderBellList();
    await window.sb.from("notifications").update({ is_read: true }).eq("id", id);
}

function toggleBellPanel() {
    const panel = document.getElementById("bellPanel");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
        markAllRead();
    }
}

async function markAllRead() {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    unread.forEach(n => n.is_read = true);
    unreadCount = 0;
    updateBellBadge();
    renderBellList();
    for (const n of unread) {
        await window.sb.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
}

async function clearAllNotifications() {
    if (!confirm("确定清空所有通知？")) return;
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) return;
    const myEmail = user.email.toLowerCase();
    await window.sb.from("notifications").delete().eq("to_email", myEmail);
    notifications = [];
    unreadCount = 0;
    updateBellBadge();
    renderBellList();
}

window.notificationChannel = notificationChannel;
window.notifications = notifications;
window.unreadCount = unreadCount;
window.NOTIF_ICONS = NOTIF_ICONS;
window.initNotifications = initNotifications;
window.loadNotifications = loadNotifications;
window.sendNotification = sendNotification;
window.updateBellBadge = updateBellBadge;
window.renderBellList = renderBellList;
window.markNotifRead = markNotifRead;
window.toggleBellPanel = toggleBellPanel;
window.markAllRead = markAllRead;
window.clearAllNotifications = clearAllNotifications;