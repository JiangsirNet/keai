/**
 * 动态资源加载器
 * - 本地环境（localhost / 127.0.0.1 / file:）：直接从本地文件加载
 * - 线上环境：从 Supabase 加载，支持版本号对比 + localStorage 缓存
 */

(function bootstrap() {
    // ---- 判断是否本地环境 ----
    const isLocal = location.protocol === 'file:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1' ||
        location.hostname === '';

    // ---- 本地文件清单 ----
    const LOCAL_FILES = [
        { path: 'styles.css',           type: 'css',  container: null, order: 0 },
        { path: 'styles_layout.css',    type: 'css',  container: null, order: 0 },
        { path: 'styles_mobile.css',    type: 'css',  container: null, order: 0 },
        { path: 'partials/login.html',   type: 'html', container: 'loginPanelContainer',   order: 1 },
        { path: 'partials/preview.html', type: 'html', container: 'previewModalContainer', order: 2 },
        { path: 'partials/home.html',    type: 'html', container: 'pageHomeContainer',     order: 3 },
        { path: 'partials/journal.html', type: 'html', container: 'pageJournalContainer',  order: 4 },
        { path: 'partials/game.html',    type: 'html', container: 'pageGameContainer',     order: 5 },
        { path: 'partials/config.html',  type: 'html', container: 'pageConfigContainer',   order: 6 },
        { path: 'js/config_page.js',     type: 'js', container: null, order: 10 },
        { path: 'js/notifications.js',   type: 'js', container: null, order: 11 },
        { path: 'js/weather.js',         type: 'js', container: null, order: 12 },
        { path: 'js/audio.js',           type: 'js', container: null, order: 13 },
        { path: 'js/music.js',           type: 'js', container: null, order: 14 },
        { path: 'js/pets.js',            type: 'js', container: null, order: 15 },
        { path: 'js/characters.js',      type: 'js', container: null, order: 16 },
        { path: 'js/characters_girl.js', type: 'js', container: null, order: 17 },
        { path: 'js/home.js',            type: 'js', container: null, order: 18 },
        { path: 'js/journal.js',         type: 'js', container: null, order: 19 },
        { path: 'js/calendar.js',        type: 'js', container: null, order: 20 },
        { path: 'js/game.js',            type: 'js', container: null, order: 21 },
        { path: 'js/game_liar.js',       type: 'js', container: null, order: 22 },
        { path: 'js/background.js',      type: 'js', container: null, order: 23 },
        { path: 'js/ai_chat.js',         type: 'js', container: null, order: 24 },
        { path: 'js/karaoke.js',         type: 'js', container: null, order: 25 },
        { path: 'js/video.js',           type: 'js', container: null, order: 26 },
        { path: 'js/pull_refresh.js',    type: 'js', container: null, order: 27 },
        { path: 'js/auth.js',            type: 'js', container: null, order: 28 },
    ];

    // ---- 本地容器配置 ----
    const LOCAL_CONTAINERS = [
        { container_id: 'loginPanelContainer', page_name: '', nav_label: '', nav_icon: '', sort_order: 1, placement: 'global', is_active: true },
        { container_id: 'previewModalContainer', page_name: '', nav_label: '', nav_icon: '', sort_order: 2, placement: 'global', is_active: true },
        { container_id: 'pageHomeContainer', page_name: 'home', nav_label: '首页', nav_icon: '🏠', sort_order: 3, placement: 'page', is_active: true },
        { container_id: 'pageJournalContainer', page_name: 'journal', nav_label: '日历', nav_icon: '📅', sort_order: 4, placement: 'page', is_active: true },
        { container_id: 'pageGameContainer', page_name: 'game', nav_label: '游戏', nav_icon: '🎮', sort_order: 5, placement: 'page', is_active: true },
        { container_id: 'pageConfigContainer', page_name: 'config', nav_label: '设置', nav_icon: '⚙️', sort_order: 6, placement: 'page', is_active: true },
    ];

    // ---- 渲染容器配置 ----
    function renderContainers(containers) {
        const globalWrap = document.getElementById('globalContainers');
        const navBar = document.getElementById('navBar');
        const pageWrap = document.getElementById('pageContainers');
        if (globalWrap) globalWrap.innerHTML = '';
        if (navBar) navBar.innerHTML = '';
        if (pageWrap) pageWrap.innerHTML = '';

        let firstPage = '';
        (containers || []).forEach(c => {
            if (c.placement === 'global' && globalWrap) {
                const div = document.createElement('div');
                div.id = c.container_id;
                globalWrap.appendChild(div);
            } else if (c.placement === 'page') {
                if (navBar && c.nav_label) {
                    const btn = document.createElement('button');
                    btn.className = 'nav-btn';
                    btn.dataset.page = c.page_name;
                    btn.onclick = () => window.showPage(c.page_name);
                    btn.innerHTML = `<span class="nav-icon">${c.nav_icon || '📄'}</span> ${c.nav_label}`;
                    if (!firstPage) { btn.classList.add('active'); firstPage = c.page_name; }
                    navBar.appendChild(btn);
                }
                if (pageWrap) {
                    const div = document.createElement('div');
                    div.id = c.container_id;
                    pageWrap.appendChild(div);
                }
            }
        });
        window._defaultPage = firstPage || 'home';
    }

    // ---- 渲染资源（CSS / HTML / JS）----
    function renderAssets(assets) {
        // CSS 样式
        (assets || []).filter(a => a.type === 'css').forEach(a => {
            try {
                const style = document.createElement('style');
                style.textContent = a.content;
                document.head.appendChild(style);
            } catch (e) {
                console.error(`loader: 加载 CSS ${a.file_path} 失败`, e);
            }
        });
        // HTML 片段
        (assets || []).filter(a => a.type === 'html').forEach(a => {
            if (a.container_id) {
                const el = document.getElementById(a.container_id);
                if (el) {
                    el.innerHTML = a.content;
                } else {
                    console.warn(`loader: 容器 #${a.container_id} 不存在（${a.file_path}）`);
                }
            }
        });
        // JS 脚本
        (assets || []).filter(a => a.type === 'js').forEach(a => {
            try {
                const script = document.createElement('script');
                script.textContent = a.content;
                document.body.appendChild(script);
            } catch (e) {
                console.error(`loader: 执行 ${a.file_path} 失败`, e);
            }
        });
    }

    function hideLoading() {
        const loading = document.getElementById('appLoading');
        if (loading) loading.style.display = 'none';
    }

    // ---- 本地加载模式 ----
    async function initLocal() {
        try {
            // 1. 渲染容器
            renderContainers(LOCAL_CONTAINERS);

            // 2. 按顺序 fetch 本地文件
            const sorted = [...LOCAL_FILES].sort((a, b) => a.order - b.order);
            const assets = [];
            for (const f of sorted) {
                try {
                    const res = await fetch(f.path);
                    if (!res.ok) {
                        console.warn(`loader: 本地文件 ${f.path} 加载失败 (${res.status})`);
                        continue;
                    }
                    const content = await res.text();
                    assets.push({
                        file_path: f.path,
                        type: f.type,
                        container_id: f.container,
                        content: content,
                        load_order: f.order
                    });
                } catch (e) {
                    console.warn(`loader: 本地文件 ${f.path} fetch 失败`, e);
                }
            }

            // 3. 渲染资源
            renderAssets(assets);
            hideLoading();
        } catch (err) {
            console.error('[loader] 本地加载异常', err);
            hideLoading();
        }
    }

    // ---- 线上加载模式（数据库 + 缓存）----
    function initOnline() {
        if (!window.sb) {
            console.error('loader: window.sb 未初始化，请确保 config.js 已加载');
            return;
        }

        const CACHE_KEY_CONTAINERS = 'loader_cache_containers_v1';
        const CACHE_KEY_ASSETS = 'loader_cache_assets_v1';
        const CACHE_KEY_VERSION = 'loader_cache_version_v1';

        function loadCache(key) {
            try {
                const s = localStorage.getItem(key);
                return s ? JSON.parse(s) : null;
            } catch (e) { return null; }
        }
        function saveCache(key, data) {
            try { localStorage.setItem(key, JSON.stringify(data)); }
            catch (e) { console.warn('loader: 缓存写入失败', e); }
        }

        async function init() {
            const cachedVersion = loadCache(CACHE_KEY_VERSION);
            const cachedContainers = loadCache(CACHE_KEY_CONTAINERS);
            const cachedAssets = loadCache(CACHE_KEY_ASSETS);
            const hasCache = cachedContainers && cachedAssets && cachedContainers.length && cachedAssets.length;

            try {
                const { data: vRow } = await window.sb.from('app_config')
                    .select('config_value')
                    .eq('config_key', 'assets_version');
                const latestVersion = (vRow && vRow[0] && vRow[0].config_value) || '';

                if (hasCache && latestVersion && latestVersion === cachedVersion) {
                    renderContainers(cachedContainers);
                    renderAssets(cachedAssets);
                    hideLoading();
                    return;
                }

                const [cRes, aRes] = await Promise.all([
                    window.sb.from('app_containers')
                        .select('*')
                        .eq('is_active', true)
                        .order('sort_order', { ascending: true }),
                    window.sb.from('app_assets')
                        .select('file_path, type, container_id, content, load_order')
                        .eq('is_active', true)
                        .order('load_order', { ascending: true })
                        .order('type', { ascending: true })
                        .order('file_path', { ascending: true })
                ]);

                if (cRes.error) throw new Error('容器配置: ' + cRes.error.message);
                if (aRes.error) throw new Error('资源: ' + aRes.error.message);

                const containers = cRes.data || [];
                const assets = aRes.data || [];

                saveCache(CACHE_KEY_CONTAINERS, containers);
                saveCache(CACHE_KEY_ASSETS, assets);
                saveCache(CACHE_KEY_VERSION, latestVersion);

                renderContainers(containers);
                renderAssets(assets);
                hideLoading();
            } catch (err) {
                console.error('[loader] 加载异常', err);
                if (hasCache) {
                    renderContainers(cachedContainers);
                    renderAssets(cachedAssets);
                    hideLoading();
                } else {
                    alert('页面初始化失败：' + err.message + '\n\n请检查网络或运行 upload.html 上传资源。');
                }
            }
        }

        init();
    }

    // ---- 根据环境选择加载模式 ----
    if (isLocal) {
        initLocal();
    } else {
        initOnline();
    }
})();
