(function() {
    'use strict';

    var sb = window.sb;
    var CONFIG = window.CONFIG;
    var IMGBB_KEY = window.IMGBB_KEY;
    var EMAILJS_SERVICE_ID = window.EMAILJS_SERVICE_ID;
    var EMAILJS_TEMPLATE_ID = window.EMAILJS_TEMPLATE_ID;
    var EMAILJS_PUBLIC_KEY = window.EMAILJS_PUBLIC_KEY;

    // 页面初始化，检测登录状态
    (async function initCheckAuth() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            document.getElementById("loginPanel").classList.add("hidden");
            await loadConfig();
            initPage();
        } else {
            document.getElementById("loginPanel").classList.remove("hidden");
        }
    })();

    // 登录
    async function login() {
        const email = document.getElementById("loginEmail").value.trim();
        const pwd = document.getElementById("loginPwd").value.trim();
        if (!email || !pwd) return alert("请填写邮箱和密码");
        const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
        if (error) {
            alert("登录失败：" + error.message);
            return;
        }
        document.getElementById("loginPanel").classList.add("hidden");
        await loadConfig();
        initPage();
    }

    // 退出登录
    async function logout() {
        await sb.auth.signOut();
        IMGBB_KEY = ""; window.IMGBB_KEY = "";
        EMAILJS_SERVICE_ID = ""; window.EMAILJS_SERVICE_ID = "";
        EMAILJS_TEMPLATE_ID = ""; window.EMAILJS_TEMPLATE_ID = "";
        EMAILJS_PUBLIC_KEY = ""; window.EMAILJS_PUBLIC_KEY = "";
        if (window.hugState) window.releaseHug();
        document.getElementById("mainPage").classList.add("hidden");
        document.getElementById("loginPanel").classList.remove("hidden");
        document.getElementById("musicToggle").classList.add("hidden");
        document.getElementById("musicPanel").classList.add("hidden-panel");
        document.getElementById("musicAudio").pause();
        // 停止 BGM
        if (window.bgmPlaying) window.toggleBgm();
        document.getElementById("weatherWidget").classList.add("hidden");
        document.getElementById("bellToggle").classList.add("hidden");
        document.getElementById("bellPanel").classList.add("hidden");
        if (window.notificationChannel) { sb.removeChannel(window.notificationChannel); window.notificationChannel = null; }
        window.notifications = []; window.unreadCount = 0;
        document.getElementById("huskyPet").classList.add("hidden");
        if (window.huskyWalkingTimer) clearInterval(window.huskyWalkingTimer);
        document.getElementById("catPet").classList.add("hidden");
        if (window.catWalkingTimer) clearInterval(window.catWalkingTimer);
        document.getElementById("boyPet").classList.add("hidden");
        document.getElementById("girlPet").classList.add("hidden");
    }

    // 从数据库 app_config 表读取所有配置
    async function loadConfig() {
        const { data, error } = await sb.from("app_config").select("config_key, config_value");
        if (error) {
            console.warn("读取配置失败：", error.message);
            return false;
        }
        if (!data || data.length === 0) return true;
        const map = {};
        data.forEach(item => { map[item.config_key] = item.config_value; });
        if (map.boy_name) CONFIG.boyName = map.boy_name;
        if (map.girl_name) CONFIG.girlName = map.girl_name;
        if (map.boy_email) CONFIG.boyEmail = map.boy_email;
        if (map.girl_email) CONFIG.girlEmail = map.girl_email;
        if (map.love_start) CONFIG.loveStart = new Date(map.love_start);
        if (map.imgbb_api_key) { IMGBB_KEY = map.imgbb_api_key; window.IMGBB_KEY = map.imgbb_api_key; }
        if (map.emailjs_service_id) { EMAILJS_SERVICE_ID = map.emailjs_service_id; window.EMAILJS_SERVICE_ID = map.emailjs_service_id; }
        if (map.emailjs_template_id) { EMAILJS_TEMPLATE_ID = map.emailjs_template_id; window.EMAILJS_TEMPLATE_ID = map.emailjs_template_id; }
        if (map.emailjs_public_key) { EMAILJS_PUBLIC_KEY = map.emailjs_public_key; window.EMAILJS_PUBLIC_KEY = map.emailjs_public_key; }
        // 初始化 EmailJS
        if (EMAILJS_PUBLIC_KEY && window.emailjs) {
            try { emailjs.init(EMAILJS_PUBLIC_KEY); } catch (e) { console.warn("EmailJS初始化失败:", e); }
        }
        return true;
    }

    //大图预览
    function openPreview(imgSrc) {
        document.getElementById("previewImg").src = imgSrc;
        document.getElementById("previewModal").classList.remove("hidden");
    }
    function closePreview() {
        document.getElementById("previewModal").classList.add("hidden");
    }
    //下载大图预览中的图片
    async function downloadPreviewImage() {
        const img = document.getElementById("previewImg");
        const url = img.src;
        if (!url) return;
        const btn = document.getElementById("previewDownload");
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 下载中';
        btn.disabled = true;
        try {
            const res = await fetch(url, { mode: "cors" });
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const ext = blob.type.split("/")[1] || "jpg";
            a.download = `photo_${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            // 跨域无法 fetch 时退化为新窗口打开
            window.open(url, "_blank");
        } finally {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }

    //页面业务初始化
    function initPage() {
        document.getElementById('boy').innerText = CONFIG.boyName;
        document.getElementById('girl').innerText = CONFIG.girlName;
        document.getElementById("mainPage").classList.remove("hidden");
        calcLoveDay();
        setInterval(calcLoveDay, 60000);
        createHeartLoop();
        window.loadGallery();
        window.loadMessages();
        window.loadJournal();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById("journalDate").value = today;
        window.initCalendar();
        document.getElementById("fileInput").onchange = window.uploadImageToImgBB;
        document.getElementById("musicToggle").classList.remove("hidden");
        document.getElementById("weatherWidget").classList.remove("hidden");
        document.getElementById("bellToggle").classList.remove("hidden");
        window.loadMusicList();
        window.initHusky();
        window.initCat();
        window.initBoy();
        window.initGirl();
        window.initRpsGame();
        window.loadCharacterQuotes();
        window.initWeather();
        window.initNotifications();
        applyDisplaySettings();
    }

    // ==================== 显示设置（localStorage 记忆）====================
    const displayMap = {
        boy: { id: 'boyPet', toggleId: 'toggleBoy' },
        girl: { id: 'girlPet', toggleId: 'toggleGirl' },
        husky: { id: 'huskyPet', toggleId: 'toggleHusky' },
        cat: { id: 'catPet', toggleId: 'toggleCat' }
    };

    function isDisplayOn(key) {
        const val = localStorage.getItem('show_' + key);
        return val === null ? true : val === '1';
    }

    function applyDisplaySettings() {
        Object.keys(displayMap).forEach(key => {
            const on = isDisplayOn(key);
            const el = document.getElementById(displayMap[key].id);
            const toggle = document.getElementById(displayMap[key].toggleId);
            if (on) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
            if (toggle) {
                toggle.classList.toggle('on', on);
            }
        });
    }

    function toggleDisplay(key) {
        const on = !isDisplayOn(key);
        localStorage.setItem('show_' + key, on ? '1' : '0');
        // 如果隐藏的元素正在抱抱，先释放
        if (!on && window.hugState) {
            const idMap = { boy: 'boyPet', girl: 'girlPet', husky: 'huskyPet', cat: 'catPet' };
            if (window.hugState.petId === idMap[key] || window.hugState.characterId === idMap[key]) {
                window.releaseHug();
            }
        }
        applyDisplaySettings();
    }

    // 切换页面
    function showPage(name) {
        ["home", "journal", "game", "config"].forEach(p => {
            document.getElementById("page-" + p).classList.toggle("hidden", p !== name);
        });
        document.querySelectorAll(".nav-btn").forEach((btn, i) => {
            btn.classList.toggle("active", ["home", "journal", "game", "config"][i] === name);
        });
        if (name === "game") window.syncLbBgmBtn();
        if (name === "journal") window.refreshCalendar();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    //相恋天数
    function calcLoveDay() {
        const now = new Date();
        const diff = now - CONFIG.loveStart;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        document.getElementById('dayCount').innerText = `已经相爱 ${days} 天`;
    }

    //爱心飘落
    function createHeart() {
        const heart = document.createElement('div');
        heart.className = 'heart fa fa-heart';
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.fontSize = (Math.random() * 16 + 8) + 'px';
        const duration = Math.random() * 6 + 4;
        heart.style.animationDuration = duration + 's';
        document.getElementById("heartBox").appendChild(heart);
        setTimeout(() => heart.remove(), duration * 1000);
    }
    function createHeartLoop() {
        setInterval(createHeart, 600);
    }

    // 压缩图片：按最大边长缩放 + JPEG 质量压缩
    function compressImage(file, maxDim, quality) {
        return new Promise((resolve) => {
            // 小于 500KB 直接返回原文件
            if (file.size < 500 * 1024) { resolve(file); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        if (width >= height) {
                            height = Math.round(height * maxDim / width);
                            width = maxDim;
                        } else {
                            width = Math.round(width * maxDim / height);
                            height = maxDim;
                        }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        const out = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
                        console.log(`压缩: ${(file.size/1024/1024).toFixed(2)}MB → ${(out.size/1024/1024).toFixed(2)}MB`);
                        resolve(out);
                    }, "image/jpeg", quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    window.login = login;
    window.logout = logout;
    window.loadConfig = loadConfig;
    window.openPreview = openPreview;
    window.closePreview = closePreview;
    window.downloadPreviewImage = downloadPreviewImage;
    window.initPage = initPage;
    window.showPage = showPage;
    window.calcLoveDay = calcLoveDay;
    window.createHeart = createHeart;
    window.createHeartLoop = createHeartLoop;
    window.compressImage = compressImage;
    window.toggleDisplay = toggleDisplay;

})();