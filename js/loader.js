// ==================== 动态资源加载器 ====================
// 从数据库 app_containers 表生成容器和导航
// 从 app_assets 表加载 HTML 片段和 JS 脚本
// 本地仅保留 config.js（Supabase 连接）和 loader.js（本文件）

(function bootstrap() {
    if (!window.sb) {
        console.error('loader: window.sb 未初始化，请确保 config.js 已加载');
        return;
    }

    async function init() {
        // ---- 第1步：查询容器配置，动态生成 DOM ----
        const { data: containers, error: cErr } = await window.sb
            .from('app_containers')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (cErr) {
            console.error('loader: 查询容器配置失败', cErr.message);
            alert('加载容器配置失败：' + cErr.message + '\n\n请先运行 upload.html 上传容器配置到数据库。');
            return;
        }

        const globalWrap = document.getElementById('globalContainers');
        const navBar = document.getElementById('navBar');
        const pageWrap = document.getElementById('pageContainers');
        let firstPage = '';

        (containers || []).forEach(c => {
            if (c.placement === 'global' && globalWrap) {
                const div = document.createElement('div');
                div.id = c.container_id;
                globalWrap.appendChild(div);
            } else if (c.placement === 'page') {
                // 创建导航按钮
                if (navBar && c.nav_label) {
                    const btn = document.createElement('button');
                    btn.className = 'nav-btn';
                    btn.dataset.page = c.page_name;
                    btn.onclick = () => window.showPage(c.page_name);
                    btn.innerHTML = `<span class="nav-icon">${c.nav_icon || '📄'}</span> ${c.nav_label}`;
                    if (!firstPage) {
                        btn.classList.add('active');
                        firstPage = c.page_name;
                    }
                    navBar.appendChild(btn);
                }
                // 创建页面容器
                if (pageWrap) {
                    const div = document.createElement('div');
                    div.id = c.container_id;
                    pageWrap.appendChild(div);
                }
            }
        });

        // 记录默认页面
        window._defaultPage = firstPage || 'home';

        // ---- 第2步：查询资源，注入 HTML + 执行 JS ----
        const { data: assets, error: aErr } = await window.sb
            .from('app_assets')
            .select('file_path, type, container_id, content, load_order')
            .eq('is_active', true)
            .order('load_order', { ascending: true });

        if (aErr) {
            console.error('loader: 查询资源失败', aErr.message);
            alert('加载页面资源失败：' + aErr.message);
            return;
        }
        if (!assets || assets.length === 0) {
            console.warn('loader: 数据库中无资源');
            return;
        }

        // 注入 HTML 片段
        assets.filter(a => a.type === 'html').forEach(a => {
            if (a.container_id) {
                const el = document.getElementById(a.container_id);
                if (el) {
                    el.innerHTML = a.content;
                } else {
                    console.warn(`loader: 容器 #${a.container_id} 不存在（${a.file_path}）`);
                }
            }
        });

        // 执行 JS 脚本
        assets.filter(a => a.type === 'js').forEach(a => {
            try {
                const script = document.createElement('script');
                script.textContent = a.content;
                document.body.appendChild(script);
            } catch (e) {
                console.error(`loader: 执行 ${a.file_path} 失败`, e);
            }
        });
    }

    init().catch(err => {
        console.error('loader: 加载异常', err);
        alert('页面初始化异常：' + err.message);
    });
})();
