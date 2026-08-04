// ==================== 动态资源加载器 ====================
// 从 Supabase app_assets 表加载 HTML 片段和 JS 脚本
// 本地仅保留 config.js（Supabase 连接）和 loader.js（本文件）

(function bootstrap() {
    if (!window.sb) {
        console.error('loader: window.sb 未初始化，请确保 config.js 已加载');
        return;
    }

    window.sb.from('app_assets')
        .select('file_path, type, container_id, content, load_order')
        .eq('is_active', true)
        .order('load_order', { ascending: true })
        .then(({ data: assets, error }) => {
            if (error) {
                console.error('loader: 查询资源失败', error.message);
                alert('加载页面资源失败：' + error.message + '\n\n请先运行 upload.html 上传资源到数据库。');
                return;
            }
            if (!assets || assets.length === 0) {
                console.warn('loader: 数据库中无资源');
                alert('数据库中暂无资源，请先运行 upload.html 上传文件。');
                return;
            }

            // 1. 注入 HTML 片段（按 load_order 顺序）
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

            // 2. 执行 JS 脚本（按 load_order 顺序，保持依赖关系）
            assets.filter(a => a.type === 'js').forEach(a => {
                try {
                    const script = document.createElement('script');
                    script.textContent = a.content;
                    document.body.appendChild(script);
                } catch (e) {
                    console.error(`loader: 执行 ${a.file_path} 失败`, e);
                }
            });
        })
        .catch(err => {
            console.error('loader: 加载异常', err);
            alert('页面初始化异常：' + err.message);
        });
})();
