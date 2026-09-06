/**
 * 认证 + 页面初始化
 * 登录/注册/登出、配置加载（loadConfig）、页面切换（showPage）、initPage 调用所有模块初始化
 * 必须最后加载（load_order=26）
 */
 
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
        // 清除页面记忆，避免下次登录跳到旧页面
        localStorage.removeItem('_lastPage');
        localStorage.removeItem('_lastSubTab');
        window.myRpsEmail = "";
        window.currentUser = null;
        IMGBB_KEY = ""; window.IMGBB_KEY = "";
        EMAILJS_SERVICE_ID = ""; window.EMAILJS_SERVICE_ID = "";
        EMAILJS_TEMPLATE_ID = ""; window.EMAILJS_TEMPLATE_ID = "";
        EMAILJS_PUBLIC_KEY = ""; window.EMAILJS_PUBLIC_KEY = "";
        if (window.hugState) window.releaseHug();
        document.getElementById("mainPage").classList.add("hidden");
        document.getElementById("loginPanel").classList.remove("hidden");
        document.getElementById("musicAudio").pause();
        document.getElementById("musicAudio").src = "";
        // 停止 BGM
        if (window.bgmPlaying) window.toggleBgm();
        document.getElementById("weatherWidget").classList.add("hidden");
        document.getElementById("bellToggle").classList.add("hidden");
        document.getElementById("bellPanel").classList.add("hidden");
        if (window.notificationChannel) { sb.removeChannel(window.notificationChannel); window.notificationChannel = null; }
        window.notifications = []; window.unreadCount = 0;
        // 新增：只隐藏 mao 和 dog 宠物（不再隐藏 husky/cat，因为它们不使用 GIF 动画）
        document.getElementById("maoPet").classList.add("hidden");
        if (window.maoWalkingTimer) clearInterval(window.maoWalkingTimer);
        document.getElementById("dogPet").classList.add("hidden");
        if (window.dogWalkingTimer) clearInterval(window.dogWalkingTimer);
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
        // 邮件通知开关（localStorage 本地记忆，无记录默认开启）
        window._notifyEmailEnabled = localStorage.getItem('notify_email_enabled') !== '0';
        // AI 聊天配置（供 ai_chat.js 使用）
        if (map.zhipu_api_key) window._aiApiKey = map.zhipu_api_key;
        if (map.zhipu_model) window._aiModel = map.zhipu_model;
        if (map.zhipu_system_prompt) window._aiSystemPrompt = map.zhipu_system_prompt;
        if (map.zhipu_web_search) window._aiWebSearch = map.zhipu_web_search === "true";
        // 腾讯 COS 配置（供 video.js 使用）
        if (map.cos_secret_id) window._cosSecretId = map.cos_secret_id;
        if (map.cos_secret_key) window._cosSecretKey = map.cos_secret_key;
        if (map.cos_bucket) window._cosBucket = map.cos_bucket;
        if (map.cos_region) window._cosRegion = map.cos_region;
        // 设置当前用户邮箱（供 calendar/game/journal 等模块使用）
        const { data: { session } } = await sb.auth.getSession();
        if (session?.user?.email) {
            window.myRpsEmail = session.user.email;
            window.currentUser = { email: session.user.email };
        }
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
    const _pageInited = {};
    function initPage() {
        document.getElementById('boy').innerText = CONFIG.boyName;
        document.getElementById('girl').innerText = CONFIG.girlName;
        document.getElementById("mainPage").classList.remove("hidden");
        calcLoveDay();
        setInterval(calcLoveDay, 60000);
        createHeartLoop();
        document.getElementById("fileInput").onchange = window.uploadImageToImgBB;
        document.getElementById("weatherWidget").classList.remove("hidden");
        document.getElementById("bellToggle").classList.remove("hidden");
        // 首页默认子 Tab 初始化
        initHomePage();
        // 恢复上次打开的页面（下拉刷新后保持页面位置）
        const lastPage = localStorage.getItem('_lastPage');
        if (lastPage && lastPage !== 'home') {
            showPage(lastPage);
        } else {
            showPage('home');
            const lastSub = localStorage.getItem('_lastSubTab');
            if (lastSub) switchSubTab(lastSub);
        }
    }

    // 首页初始化（天气 + 通知 + 人物 + 宠物，相册/留言/AI/音乐 走子Tab懒加载）
    function initHomePage() {
        if (_pageInited.home) return;
        _pageInited.home = true;
        // 新增：只初始化 mao（猫猫 GIF）和 dog（狗狗 GIF），不再初始化 husky/cat（不使用 GIF 动画）
        window.initMao();
        window.initDog();
        window.initBoy();
        window.initGirl();
        window.initWeather();
        window.initNotifications();
        // 应用显示设置（必须在所有 init 函数之后，因为 init 函数会强制显示元素）
        applyDisplaySettings();
        // 默认子 Tab 是相册，立即加载
        _subTabInited.gallery = true;
        window.loadGallery();
        _subTabInited.message = true;
        window.loadMessages();
    }

    // 日历页初始化
    function initJournalPage() {
        if (_pageInited.journal) return;
        _pageInited.journal = true;
        if (window.initCalendar) window.initCalendar();
        window.refreshCalendar();
    }

    // 游戏页初始化
    function initGamePage() {
        if (_pageInited.game) return;
        _pageInited.game = true;
        window.initJumpGame();
        window.syncLbBgmBtn();
    }

    // ======================================================
    // 全局存储配置加载（COS + OpenList）
    // —— 直接从 app_config 表读取并赋值到 window.*，
    //    保证网盘/视频等使用方无需经过设置页即可拿到最新值
    // ======================================================
    let _storageGlobalsLoaded = false;
    async function initStorageGlobals({ force = false } = {}) {
        if (_storageGlobalsLoaded && !force) return;
        try {
            const keys = [
                // 腾讯 COS（4 key）
                'cos_secret_id', 'cos_secret_key', 'cos_bucket', 'cos_region',
                // OpenList 百度网盘（6 key）
                'openlist_base_url', 'openlist_username', 'openlist_password',
                'openlist_mount_path', 'openlist_mount_paths', 'openlist_as_task'
            ];
            if (!window.sb) { console.warn('[Storage] sb 未就绪，跳过加载'); return; }
            const { data, error } = await window.sb
                .from('app_config').select('config_key, config_value').in('config_key', keys);
            if (error) throw error;
            const map = {};
            (data || []).forEach(r => map[r.config_key] = r.config_value);

            // 赋值到 window 全局变量（与 cloud.js / video.js 使用的变量名一致）
            window._cosSecretId    = map.cos_secret_id    || '';
            window._cosSecretKey   = map.cos_secret_key   || '';
            window._cosBucket      = map.cos_bucket       || '';
            window._cosRegion      = map.cos_region       || '';
            window._openlistBaseUrl  = map.openlist_base_url  || '';
            window._openlistUsername = map.openlist_username || '';
            window._openlistPassword = map.openlist_password || '';
            window._openlistMountPath= map.openlist_mount_path|| '';
            window._openlistMountPaths = map.openlist_mount_paths || map.openlist_mount_path || '';
            window._openlistAsTask   = map.openlist_as_task === '1';
            _storageGlobalsLoaded = true;
        } catch (e) {
            console.warn('[Storage] 加载全局配置失败:', e);
        }
    }
    window.initStorageGlobals = initStorageGlobals;

    // 设置页初始化
    function initConfigPage() {
        if (_pageInited.config) return;
        _pageInited.config = true;
        window.loadCharacterQuotes();
        // 加载邮件通知开关状态
        if (window.loadNotifyEmailSetting) window.loadNotifyEmailSetting();
        // 先拿最新的全局值（确保即使设置页无表单也能填到 window.*）
        initStorageGlobals({ force: true }).then(() => {
            // 再让旧 loader 把值填到表单里（如果表单存在）
            if (window.loadCosConfigForm) window.loadCosConfigForm();
            if (window.loadOpenListConfigForm) window.loadOpenListConfigForm();
        });
    }

    // ==================== 显示设置（localStorage 记忆）====================
    const displayMap = {
        boy: { id: 'boyPet', toggleId: 'toggleBoy' },
        girl: { id: 'girlPet', toggleId: 'toggleGirl' },
        mao: { id: 'maoPet', toggleId: 'toggleMao' }, // 猫猫 GIF 宠物
        dog: { id: 'dogPet', toggleId: 'toggleDog' } // 狗狗 GIF 宠物
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
            const idMap = { mao: 'maoPet', dog: 'dogPet' }; // 新增dog映射
            if (window.hugState.petId === idMap[key] || window.hugState.characterId === idMap[key]) {
                window.releaseHug();
            }
        }
        applyDisplaySettings();
    }

    // 切换页面
    function showPage(name) {
        // 防御：空/非法页面名直接返回
        if (!name) return;

        // 网盘已并入首页子Tab：cloud 入口 → 跳首页 + 切网盘子Tab
        if (name === "cloud") {
            showPage('home');
            setTimeout(() => switchSubTab('cloud'), 50);
            return;
        }

        // ========== 主 Tab 显隐切换 ==========
        // 用户说得对：只要K歌/网盘的DOM在#page-home里，父级 .hidden { display:none !important }
        // 就会把所有子元素（包括 fixed 弹窗）一起隐藏，不需要任何兜底 workaround
        document.querySelectorAll('.page-content').forEach(el => {
            el.classList.toggle('hidden', el.id !== 'page-' + name);
        });

        // 主 Tab 按钮高亮
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === name);
        });

        // 如果切回首页 → 恢复上次停留的子 Tab
        if (name === "home") {
            const lastSub = localStorage.getItem('_lastSubTab') || 'gallery';
            if (window.switchSubTab) switchSubTab(lastSub);
        }

        // 各页面初始化
        if (name === "home") initHomePage();
        if (name === "journal") initJournalPage();
        if (name === "game") initGamePage();
        if (name === "config") initConfigPage();

        // 记住当前页面，刷新后恢复
        localStorage.setItem('_lastPage', name);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // 首页内子 Tab 切换
    const _subTabInited = {};
    function switchSubTab(sub) {
        // 防御：空子 tab 名直接返回，避免清空所有内容
        if (!sub) return;

        // 切换按钮高亮
        document.querySelectorAll('.sub-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sub === sub);
        });

        // 切换内容：除了当前 sub，其它都隐藏
        const targetId = 'subTab-' + sub;
        document.querySelectorAll('.sub-tab-content').forEach(el => {
            el.classList.toggle('hidden', el.id !== targetId);
        });

        // 记住当前子 Tab，刷新后恢复
        localStorage.setItem('_lastSubTab', sub);
        // 懒加载：首次切换时初始化
        if (sub === 'gallery' && !_subTabInited.gallery) {
            _subTabInited.gallery = true;
            window.loadGallery();
        }
        if (sub === 'message' && !_subTabInited.message) {
            _subTabInited.message = true;
            window.loadMessages();
        }
        if (sub === 'journal' && !_subTabInited.journal) {
            _subTabInited.journal = true;
            const today = new Date().toISOString().split('T')[0];
            const jd = document.getElementById("journalDate");
            if (jd) jd.value = today;
            if (window.loadJournal) window.loadJournal();
        }
        if (sub === 'ai' && !_subTabInited.ai) {
            _subTabInited.ai = true;
            if (window.initAiChat) window.initAiChat();
        }
        if (sub === 'music' && !_subTabInited.music) {
            _subTabInited.music = true;
            if (window.loadMusicList) window.loadMusicList();
        }
        if (sub === 'karaoke' && !_subTabInited.karaoke) {
            _subTabInited.karaoke = true;
            if (window.initKaraoke) window.initKaraoke();
        }
        if (sub === 'video' && !_subTabInited.video) {
            _subTabInited.video = true;
            if (window.initVideoPage) window.initVideoPage();
            else if (window.loadVideoList) window.loadVideoList();
        }
        if (sub === 'cloud' && !_subTabInited.cloud) {
            // 仅在初始化函数存在时才标记，避免 cloud.js 未加载时永久跳过
            if (window.initCloudPage) {
                _subTabInited.cloud = true;
                window.initCloudPage();
            }
        }
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
    window.switchSubTab = switchSubTab;
    window.calcLoveDay = calcLoveDay;
    window.createHeart = createHeart;
    window.createHeartLoop = createHeartLoop;
    window.compressImage = compressImage;
    window.toggleDisplay = toggleDisplay;

})();
