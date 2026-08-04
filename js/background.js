(function() {
    // 应用背景图
    function applyBackground(url) {
        if (url) {
            document.body.style.backgroundImage = `url("${url}")`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundPosition = 'center';
        } else {
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundAttachment = '';
            document.body.style.backgroundPosition = '';
        }
    }

    function showPreview(url) {
        const el = document.getElementById('bgPreview');
        if (el) el.innerHTML = url
            ? `<img src="${url}" class="w-full max-h-32 object-cover rounded-lg">`
            : '';
    }

    // 从数据库加载背景
    async function loadBackground() {
        if (!window.sb) return;
        const { data, error } = await window.sb.from('app_config')
            .select('config_value').eq('config_key', 'bg_image');
        if (!error && data && data.length > 0 && data[0].config_value) {
            applyBackground(data[0].config_value);
            showPreview(data[0].config_value);
        }
    }

    // 上传背景图到 ImgBB 并保存 URL
    async function uploadBackground(file) {
        if (!file) return;
        const status = document.getElementById('bgStatus');
        if (status) status.textContent = '上传中...';

        try {
            // 压缩图片
            let blob = file;
            if (window.compressImage) {
                blob = await window.compressImage(file, 1920, 0.85);
            }
            const formData = new FormData();
            formData.append('image', blob);

            const res = await fetch(`https://api.imgbb.com/1/upload?key=${window.IMGBB_KEY}`, {
                method: 'POST',
                body: formData
            });
            const json = await res.json();
            if (!json.success) throw new Error('图片上传失败');

            const url = json.data.url;

            // 保存到 app_config 表
            const { error } = await window.sb.from('app_config')
                .upsert({ config_key: 'bg_image', config_value: url }, { onConflict: 'config_key' });
            if (error) throw error;

            applyBackground(url);
            showPreview(url);
            if (status) status.textContent = '✅ 设置成功';
            if (window.sendNotification) {
                window.sendNotification('system', '🖼️ 更新了网页背景');
            }
        } catch (e) {
            if (status) status.textContent = '❌ ' + e.message;
        }
    }

    // 清除背景
    async function clearBackground() {
        const status = document.getElementById('bgStatus');
        const { error } = await window.sb.from('app_config')
            .delete().eq('config_key', 'bg_image');
        if (error) {
            if (status) status.textContent = '❌ ' + error.message;
            return;
        }
        applyBackground(null);
        showPreview(null);
        if (status) status.textContent = '已恢复默认背景';
    }

    // 初始化（loader 动态加载时 DOM 已就绪）
    const input = document.getElementById('bgFileInput');
    if (input) {
        input.onchange = (e) => {
            if (e.target.files[0]) uploadBackground(e.target.files[0]);
            e.target.value = '';
        };
    }
    loadBackground();

    window.clearBackground = clearBackground;
})();
