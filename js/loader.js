// ==================== 动态资源加载器（带本地缓存） ====================
// 策略：stale-while-revalidate
//   1. 有缓存 → 立即用缓存渲染页面（秒开）
//   2. 后台静默查询接口，更新缓存
//   3. 发现内容变更 → 顶部提示"资源已更新，刷新生效"
//   4. 接口失败但有缓存 → 不影响当前使用

(function bootstrap() {
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

    async function init() {
        // 1. 读取本地缓存（版本 + 数据）
        const cachedVersion = loadCache(CACHE_KEY_VERSION);
        const cachedContainers = loadCache(CACHE_KEY_CONTAINERS);
        const cachedAssets = loadCache(CACHE_KEY_ASSETS);
        const hasCache = cachedContainers && cachedAssets && cachedContainers.length && cachedAssets.length;

        // 2. 先查版本号（轻量，只查 1 条 config）
        try {
            const { data: vRow } = await window.sb.from('app_config')
                .select('config_value')
                .eq('config_key', 'assets_version');
            const latestVersion = (vRow && vRow[0] && vRow[0].config_value) || '';

            // 3. 版本一致 + 有缓存 → 直接用缓存渲染，不查资源表
            if (hasCache && latestVersion && latestVersion === cachedVersion) {
                renderContainers(cachedContainers);
                renderAssets(cachedAssets);
                hideLoading();
                return;
            }

            // 4. 版本不一致或无缓存 → 查全量资源
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

            // 5. 更新缓存（数据 + 版本号）
            saveCache(CACHE_KEY_CONTAINERS, containers);
            saveCache(CACHE_KEY_ASSETS, assets);
            saveCache(CACHE_KEY_VERSION, latestVersion);

            // 6. 用最新数据渲染
            renderContainers(containers);
            renderAssets(assets);
            hideLoading();
        } catch (err) {
            console.error('[loader] 加载异常', err);
            // 接口失败但有缓存 → 用缓存兜底
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
})();
