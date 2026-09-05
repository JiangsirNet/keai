(function () {
    'use strict';

    // ========== 状态 ==========
    const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts'];
    const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'heif', 'avif'];
    const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'oga', 'wma', 'opus', 'ape'];
    let cloudToken = null;          // JWT token
    let cloudBaseUrl = '';          // OpenList 服务地址，如 http://localhost:5244
    let cloudMounts = [];           // 所有挂载路径，如 ['/baidu', '/quark']
    let cloudMountPath = '';        // 当前挂载路径，如 /baidu
    let currentPath = '';           // 当前浏览路径（绝对路径，含 mountPath）
    let pathStack = [];             // 路径历史，用于面包屑导航 {name, path}
    let currentFileList = [];       // 当前目录文件列表

    // ========== 工具函数 ==========
    function isVideoFile(name) {
        const ext = (name.split('.').pop() || '').toLowerCase();
        return VIDEO_EXTS.includes(ext);
    }

    function isImageFile(name) {
        const ext = (name.split('.').pop() || '').toLowerCase();
        return IMAGE_EXTS.includes(ext);
    }

    function isAudioFile(name) {
        const ext = (name.split('.').pop() || '').toLowerCase();
        return AUDIO_EXTS.includes(ext);
    }

    function formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDate(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const now = new Date();
        const diff = (now - d) / 1000;
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 86400 * 7) return Math.floor(diff / 86400) + '天前';
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function getFileIcon(name, isDir) {
        if (isDir) return '📁';
        const ext = (name.split('.').pop() || '').toLowerCase();
        if (VIDEO_EXTS.includes(ext)) return '🎬';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return '🖼️';
        if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return '🎵';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return '📄';
        return '📦';
    }

    // ========== 配置加载 ==========
    // 解析挂载路径列表：支持换行 / 逗号 / 分号分隔，去重，统一以 / 开头（根挂载统一为 ''）
    function parseMountPaths(raw) {
        return String(raw || '')
            .split(/[\n\r,，;；]+/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => s.startsWith('/') ? s : '/' + s)
            .map(s => s === '/' ? '' : s)
            .filter((v, i, arr) => arr.indexOf(v) === i);
    }

    function loadCloudConfig() {
        cloudBaseUrl = (window._openlistBaseUrl || '').trim().replace(/\/$/, '');
        // 多挂载：优先读 openlist_mount_paths，兼容旧的单挂载 openlist_mount_path
        cloudMounts = parseMountPaths(window._openlistMountPaths);
        parseMountPaths(window._openlistMountPath).forEach(p => {
            if (!cloudMounts.includes(p)) cloudMounts.push(p);
        });
        // 当前挂载：已选中的仍有效则保留，否则取第一个
        if (!cloudMounts.includes(cloudMountPath)) {
            cloudMountPath = cloudMounts[0] || '';
        }
    }

    function hasCloudConfig() {
        return !!(cloudBaseUrl && window._openlistUsername && window._openlistPassword);
    }

    // ========== 请求封装 ==========
    async function apiRequest(method, path, options = {}) {
        const url = `${cloudBaseUrl}/api${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (cloudToken) headers['Authorization'] = `${cloudToken}`;

        const fetchOptions = {
            method: method,
            headers: headers,
            ...options.fetchOptions || {}
        };

        if (options.body !== undefined) {
            fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }

        try {
            const resp = await fetch(url, fetchOptions);
            const text = await resp.text();
            let data;
            try { data = JSON.parse(text); } catch (e) { data = { code: resp.status, message: text }; }
            return data;
        } catch (e) {
            console.error('[Cloud] 请求失败:', url, e);
            return { code: -1, message: '网络请求失败: ' + (e.message || e) };
        }
    }

    // ========== 登录 ==========
    async function cloudLogin() {
        loadCloudConfig();
        if (!hasCloudConfig()) {
            updateLoginStatus(false, '未配置');
            document.getElementById('cloudConfigHint').classList.remove('hidden');
            return false;
        }
        document.getElementById('cloudConfigHint').classList.add('hidden');

        updateLoginStatus(false, '连接中...');

        // 先尝试 hash 登录（密码需加 -https://github.com/alist-org/alist 后缀再 sha256）
        try {
            const rawPwd = window._openlistPassword || '';
            // 尝试普通登录
            const resp = await apiRequest('POST', '/auth/login', {
                body: {
                    username: window._openlistUsername,
                    password: rawPwd
                }
            });

            if (resp.code === 200 && resp.data && resp.data.token) {
                cloudToken = resp.data.token;
                // 如果 token 不带 Bearer 前缀，兼容加上（OpenList通常返回裸token，但header需要Bearer）
                if (!cloudToken.toLowerCase().startsWith('bearer ')) {
                    // OpenList 实际是直接 Authorization: token_value，不需要 Bearer
                    // 但有些版本需要，先存原样，请求时再决定
                }
                updateLoginStatus(true, window._openlistUsername);
                document.getElementById('cloudUserInfo').textContent = ` @ ${cloudBaseUrl.replace(/^https?:\/\//, '')}`;
                return true;
            } else {
                updateLoginStatus(false, '失败');
                console.warn('[Cloud] 登录失败:', resp);
                alert('连接 OpenList 失败：' + (resp.message || '未知错误'));
                return false;
            }
        } catch (e) {
            updateLoginStatus(false, '错误');
            console.error('[Cloud] 登录异常:', e);
            alert('连接 OpenList 异常：' + (e.message || e));
            return false;
        }
    }

    function updateLoginStatus(ok, text) {
        const el = document.getElementById('cloudLoginStatus');
        if (!el) return;
        el.className = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs ' +
            (ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500');
        el.innerHTML = `<span class="w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-400'}"></span> ${text || ''}`;
    }

    // ========== 多挂载切换 ==========
    function renderMountChips() {
        const el = document.getElementById('cloudMountChips');
        if (!el) return;
        el.innerHTML = cloudMounts.map(m => {
            const val = m || '';
            const active = val === (cloudMountPath || '');
            return `<button onclick="cloudSwitchMount('${val.replace(/'/g, "\\'")}')" class="px-3 py-1 rounded-full text-xs transition ${active ? 'bg-love text-white font-semibold shadow' : 'bg-rose-50 text-gray-600 border border-rose-100 hover:bg-rose-100'}">☁️ ${escapeHtml(val || '/')}</button>`;
        }).join('');
    }

    function syncUploadMountSelect() {
        const sel = document.getElementById('cloudUploadMountSelect');
        if (!sel) return;
        const list = cloudMounts.length ? cloudMounts : [''];
        sel.innerHTML = list.map(m =>
            `<option value="${escapeHtml(m || '')}">${escapeHtml(m || '/')}</option>`).join('');
        sel.value = cloudMountPath || '';
    }

    async function cloudSwitchMount(m) {
        cloudMountPath = m || '';
        renderMountChips();
        syncUploadMountSelect();
        cloudListDir(cloudMountPath || '/');
    }

    // ========== 浏览文件 ==========
    async function cloudListDir(absPath) {
        const loading = document.getElementById('cloudListLoading');
        const listEl = document.getElementById('cloudFileList');
        const emptyEl = document.getElementById('cloudEmptyTip');
        loading.classList.remove('hidden');
        listEl.innerHTML = '';
        emptyEl.classList.add('hidden');

        // 路径以挂载路径开头
        let targetPath = absPath || cloudMountPath || '/';
        if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

        const resp = await apiRequest('GET', `/fs/list?path=${encodeURIComponent(targetPath)}`);
        loading.classList.add('hidden');

        if (resp.code !== 200) {
            // token 失效，尝试重新登录
            if (resp.code === 401) {
                const ok = await cloudLogin();
                if (ok) return cloudListDir(absPath);
            }
            listEl.innerHTML = `<div class="col-span-full text-center text-red-400 py-6">加载失败：${escapeHtml(resp.message || '未知错误')}</div>`;
            return;
        }

        currentPath = targetPath;
        const content = (resp.data && resp.data.content) ? resp.data.content : [];
        currentFileList = content;

        // 更新面包屑
        renderBreadcrumb(targetPath);

        // 排序：文件夹在前，按名称
        content.sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return (a.name || '').localeCompare(b.name || '');
        });

        // 展示全部文件（文件夹已在前面排序）
        const filtered = content;

        if (filtered.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }

        listEl.innerHTML = filtered.map(f => renderFileCard(f, targetPath)).join('');
    }

    function renderFileCard(f, parentPath) {
        const fullPath = parentPath === '/' ? `/${f.name}` : `${parentPath}/${f.name}`;
        const thumb = f.thumbnail || '';
        const isVid = !f.is_dir && isVideoFile(f.name);
        const isImg = !f.is_dir && isImageFile(f.name);
        const isAud = !f.is_dir && isAudioFile(f.name);
        const ext = (f.name.split('.').pop() || '').toUpperCase().slice(0, 5);
        const meta = f.is_dir
            ? `${(f.content && f.content.length) ? f.content.length : '—'} 项`
            : formatSize(f.size);
        const date = formatDate(f.modified);
        const escName = escapeHtml(f.name);
        const escPath = fullPath.replace(/'/g, "\\'");
        const onClick = f.is_dir
            ? `cloudEnterDir('${escPath}')`
            : (isVid
                    ? `cloudPlayVideo('${escName}', '${escPath}', '${thumb ? escapeHtml(thumb) : ''}')`
                : (isImg
                    ? `cloudPreviewImage('${escName}', '${escPath}')`
                    : (isAud
                        ? `cloudPlayAudio('${escName}', '${escPath}')`
                        : `cloudOpenFile('${escName}', '${escPath}')`)));
        const delBtn = !f.is_dir
            ? `<i class="fa fa-trash cloud-del-icon" title="删除" onclick="event.stopPropagation(); window.cloudDeleteFile('${f.name.replace(/'/g, "\\'")}', '${escPath}')"></i>`
            : '';

        return `
            <div class="cloud-file-card rounded-xl overflow-hidden bg-gradient-to-br from-rose-50 to-white border border-rose-100 hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer"
                 onclick="${onClick}">
                <div class="aspect-video bg-rose-100/60 flex items-center justify-center relative overflow-hidden">
                    ${thumb && (f.type === 3 || f.type === 2) ? `<img src="${thumb}" class="w-full h-full object-cover" loading="lazy">` :
                `<span class="text-5xl">${getFileIcon(f.name, f.is_dir)}</span>`}
                    ${(isVid || isAud) ? `<div class="absolute inset-0 bg-black/0 hover:bg-black/10 transition flex items-center justify-center">
                        <i class="fa fa-play-circle text-white text-4xl opacity-0 hover:opacity-90 transition drop-shadow-lg"></i>
                    </div>` : ''}
                    ${!f.is_dir ? `<span class="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">${escapeHtml(ext)}</span>` : ''}
                </div>
                <div class="p-2">
                    <div class="text-xs text-gray-800 truncate font-medium" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                    <div class="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                        <span>${meta}</span>
                        <span class="flex items-center gap-1.5">${date}${delBtn}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderBreadcrumb(absPath) {
        const el = document.getElementById('cloudBreadcrumb');
        if (!el) return;

        // 拆分路径，保留挂载路径名
        const mount = cloudMountPath || '/';
        let parts;
        if (absPath === '/') parts = [];
        else parts = absPath.split('/').filter(Boolean);

        // 找到挂载路径在 parts 中的位置
        const mountParts = mount.split('/').filter(Boolean);
        // 面包屑：[返回根(网盘)] [挂载名] [子目录1] [子目录2]
        let html = '<span class="text-gray-400">路径：</span>';
        html += `<button onclick="cloudGoHome()" class="px-2 py-0.5 rounded hover:bg-rose-100 text-love text-xs transition">☁️ 网盘根</button>`;
        html += `<span class="text-gray-300 text-xs">/</span>`;

        let builtPath = '';
        parts.forEach((p, idx) => {
            builtPath += '/' + p;
            const isLast = idx === parts.length - 1;
            if (isLast) {
                html += `<span class="px-2 py-0.5 bg-love text-white rounded text-xs font-semibold">${escapeHtml(p)}</span>`;
            } else {
                html += `<button onclick="cloudEnterDir('${builtPath}')" class="px-2 py-0.5 rounded hover:bg-rose-100 text-gray-700 text-xs transition">${escapeHtml(p)}</button>`;
                html += `<span class="text-gray-300 text-xs">/</span>`;
            }
        });

        el.innerHTML = html;
    }

    function cloudEnterDir(path) {
        cloudListDir(path);
    }

    function cloudGoHome() {
        cloudListDir(cloudMountPath || '/');
    }

    function cloudRefresh() {
        if (cloudToken) {
            cloudListDir(currentPath || cloudMountPath || '/');
        } else {
            initCloudPage();
        }
    }

    // ========== 上传 ==========
    function cloudToggleUpload() {
        const area = document.getElementById('cloudUploadArea');
        area.classList.toggle('hidden');
        if (!area.classList.contains('hidden')) syncUploadMountSelect();
    }

    // 从文件名中剥离扩展名，返回 [主名, 扩展名]（ext 不含点，可能为空字符串）
    function splitFileName(name) {
        const idx = name.lastIndexOf('.');
        if (idx <= 0) return [name, ''];
        return [name.slice(0, idx), name.slice(idx + 1)];
    }

    // 日期戳，如 20260905
    function dateStamp() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    }

    async function cloudHandleFileSelect(input) {
        const files = Array.from(input.files || []);
        input.value = '';
        if (!files.length) return;

        if (!cloudToken) {
            const ok = await cloudLogin();
            if (!ok) return;
        }

        // 统一填写一个名称，扩展名自动保留原文件的
        const defaultName = files.length === 1 ? files[0].name : splitFileName(files[0].name)[0];
        const baseInput = prompt(
            files.length > 1 ? '请输入文件名称（自动加日期和序号，不改扩展名）:' : '请输入文件名（不改扩展名）:',
            defaultName
        );
        if (!baseInput) return;
        const base = splitFileName(baseInput.trim())[0] || 'file';

        let okCount = 0;
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const ext = splitFileName(f.name)[1];
            let name;
            if (files.length === 1) {
                name = ext ? `${base}.${ext}` : base;
            } else {
                name = ext ? `${base}_${dateStamp()}_${i + 1}.${ext}` : `${base}_${dateStamp()}_${i + 1}`;
            }
            const ok = await cloudUploadFile(f, name, files.length, i + 1);
            if (ok) okCount++;
        }

        if (okCount > 0 && window.sendNotification) {
            window.sendNotification('cloud', `☁️ 已上传 ${okCount}/${files.length} 个文件到网盘`);
        }
    }

    async function cloudUploadFile(file, fileName, total, index) {
        const uploadName = fileName || file.name;
        const progressWrap = document.getElementById('cloudUploadProgress');
        const progressBar = document.getElementById('cloudUploadProgressBar');
        const progressText = document.getElementById('cloudUploadProgressText');
        const fileNameEl = document.getElementById('cloudUploadFileName');

        progressWrap.classList.remove('hidden');
        fileNameEl.textContent = total > 1 ? `上传（${index}/${total}）：${uploadName}` : `上传：${uploadName}`;
        progressBar.style.width = '0%';
        progressText.textContent = '0%';

        // 目标路径：优先用上传区选中的挂载；当前浏览目录位于所选挂载下则传到当前目录，否则传到挂载根目录
        let targetMount = cloudMountPath || '';
        const sel = document.getElementById('cloudUploadMountSelect');
        if (sel && sel.options.length > 0) targetMount = sel.value;
        const underSelected = !!currentPath &&
            (targetMount === '' || currentPath === targetMount || currentPath.startsWith(targetMount + '/'));
        const targetDir = underSelected ? currentPath : (targetMount || '/');
        const remotePath = targetDir === '/' ? `/${uploadName}` : `${targetDir}/${uploadName}`;

        try {
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', `${cloudBaseUrl}/api/fs/put`);
                xhr.setRequestHeader('Authorization', cloudToken);
                xhr.setRequestHeader('File-Path', encodeURIComponent(remotePath));
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                if (window._openlistAsTask) {
                    xhr.setRequestHeader('As-Task', 'true');
                }

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        progressBar.style.width = pct + '%';
                        progressText.textContent = pct + '%';
                    }
                };

                xhr.onload = () => {
                    let resp;
                    try { resp = JSON.parse(xhr.responseText); }
                    catch (e) { resp = { code: xhr.status, message: xhr.responseText }; }

                    if (xhr.status >= 200 && xhr.status < 300 && resp.code === 200) {
                        resolve(resp);
                    } else {
                        reject(new Error(resp.message || `HTTP ${xhr.status}`));
                    }
                };

                xhr.onerror = () => reject(new Error('网络错误'));
                xhr.onabort = () => reject(new Error('已取消'));
                xhr.send(file);
            });

            progressText.textContent = '✅ 完成';
            // 延迟刷新网盘列表：异步任务模式下 OpenList 需要时间把文件落到网盘
            setTimeout(() => {
                progressWrap.classList.add('hidden');
                cloudListDir(currentPath);
            }, 3000);
            return true;
        } catch (e) {
            console.error('[Cloud] 上传失败:', e);
            alert(`上传失败（${uploadName}）：` + (e.message || e));
            progressWrap.classList.add('hidden');
            return false;
        }
    }

    // ========== 播放视频 ==========
    async function cloudPlayVideo(name, absPath, thumb) {
        const modal = document.getElementById('cloudVideoModal');
        const player = document.getElementById('cloudVideoPlayer');
        const titleEl = document.getElementById('cloudVideoTitle');

        titleEl.textContent = name;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        // 用列表缩略图作封面，起播前有画面、感知更快
        player.poster = thumb || '';
        player.src = '';
        player.load();

        // 获取直链
        try {
            const resp = await apiRequest('GET', `/fs/get?path=${encodeURIComponent(absPath)}`);
            if (resp.code === 200 && resp.data) {
                const url = resp.data.raw_url || resp.data.url;
                if (url) {
                    player.src = url;
                    player.play().catch(e => console.warn('自动播放被拦截，需手动播放'));
                    return;
                }
            }
            throw new Error(resp.message || '无法获取视频链接');
        } catch (e) {
            alert('视频加载失败：' + (e.message || e));
            cloudCloseVideo();
        }
    }

    // ========== 图片预览 ==========
    async function cloudPreviewImage(name, absPath) {
        const modal = document.getElementById('cloudImageModal');
        const img = document.getElementById('cloudImagePreview');
        const titleEl = document.getElementById('cloudImageTitle');

        titleEl.textContent = name;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        img.src = '';

        try {
            const resp = await apiRequest('GET', `/fs/get?path=${encodeURIComponent(absPath)}`);
            if (resp.code === 200 && resp.data) {
                const url = resp.data.raw_url || resp.data.url;
                if (url) { img.src = url; return; }
            }
            throw new Error(resp.message || '无法获取图片链接');
        } catch (e) {
            alert('图片加载失败：' + (e.message || e));
            cloudCloseImage();
        }
    }

    function cloudCloseImage(e) {
        if (e && e.target && e.target.tagName === 'IMG') return;
        const modal = document.getElementById('cloudImageModal');
        document.getElementById('cloudImagePreview').src = '';
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // ========== 播放音频 ==========
    async function cloudPlayAudio(name, absPath) {
        const modal = document.getElementById('cloudAudioModal');
        const player = document.getElementById('cloudAudioPlayer');
        const titleEl = document.getElementById('cloudAudioTitle');

        titleEl.textContent = name;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        player.src = '';
        player.load();

        try {
            const resp = await apiRequest('GET', `/fs/get?path=${encodeURIComponent(absPath)}`);
            if (resp.code === 200 && resp.data) {
                const url = resp.data.raw_url || resp.data.url;
                if (url) {
                    player.src = url;
                    player.play().catch(() => console.warn('自动播放被拦截，需手动播放'));
                    return;
                }
            }
            throw new Error(resp.message || '无法获取音频链接');
        } catch (e) {
            alert('音频加载失败：' + (e.message || e));
            cloudCloseAudio();
        }
    }

    function cloudCloseAudio(e) {
        if (e && e.target && e.target.tagName === 'AUDIO') return;
        const modal = document.getElementById('cloudAudioModal');
        const player = document.getElementById('cloudAudioPlayer');
        player.pause();
        player.src = '';
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // ========== 打开非视频文件 ==========
    // 获取直链后新窗口打开（浏览器自行决定预览或下载）
    async function cloudOpenFile(name, absPath) {
        try {
            const resp = await apiRequest('GET', `/fs/get?path=${encodeURIComponent(absPath)}`);
            if (resp.code === 200 && resp.data) {
                const url = resp.data.raw_url || resp.data.url;
                if (url) { window.open(url, '_blank'); return; }
            }
            throw new Error(resp.message || '无法获取文件链接');
        } catch (e) {
            alert('打开文件失败：' + (e.message || e));
        }
    }

    // ========== 删除 ==========
    async function cloudDeleteFile(name, absPath) {
        if (!confirm(`确定删除「${name}」吗？\n该文件将从网盘中删除，不可恢复！`)) return;
        if (!cloudToken) {
            const ok = await cloudLogin();
            if (!ok) return;
        }
        // 父目录 = 去掉末尾文件名
        const dir = absPath.substring(0, absPath.lastIndexOf('/')) || '/';
        const resp = await apiRequest('POST', '/fs/remove', {
            body: { dir: dir, names: [name] }
        });
        if (resp.code === 200) {
            if (window.sendNotification) window.sendNotification('cloud', `🗑️ 已从网盘删除：${name}`);
            cloudListDir(currentPath);
        } else if (resp.code === 401) {
            // token 过期，重新登录后重试一次
            const ok = await cloudLogin();
            if (ok) return cloudDeleteFile(name, absPath);
            alert('登录已过期，请重试');
        } else {
            alert('删除失败：' + (resp.message || '未知错误'));
        }
    }

    function cloudCloseVideo(e) {
        if (e && e.target && e.target.tagName === 'VIDEO') return;
        const modal = document.getElementById('cloudVideoModal');
        const player = document.getElementById('cloudVideoPlayer');
        player.pause();
        player.src = '';
        player.poster = '';
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // ========== 初始化 ==========
    async function initCloudPage() {
        // 文件选择事件
        const fileInput = document.getElementById('cloudFileInput');
        if (fileInput && !fileInput._bound) {
            fileInput.addEventListener('change', (e) => cloudHandleFileSelect(e.target));
            fileInput._bound = true;
        }

        // 🔴 核心修复：每次进入网盘 Tab 强制从 app_config 加载最新配置到 window.*
        //    （用户可能在 upload.html 里刚改完配置，必须先拿最新值，否则
        //     loadCloudConfig 读到的 window._openlistBaseUrl 就是空字符串，显示"未配置"）
        if (window.initStorageGlobals) {
            await window.initStorageGlobals({ force: true });
        }

        loadCloudConfig();

        // 检查配置
        if (!hasCloudConfig()) {
            document.getElementById('cloudConfigHint').classList.remove('hidden');
            updateLoginStatus(false, '未配置');
            document.getElementById('cloudListLoading').classList.add('hidden');
            document.getElementById('cloudEmptyTip').classList.remove('hidden');
            document.getElementById('cloudEmptyTip').querySelector('p').textContent = '请先在「上传」→「存储」页面配置 OpenList';
            return;
        }

        document.getElementById('cloudConfigHint').classList.add('hidden');

        // 登录并加载
        cloudLogin().then(ok => {
            if (ok) {
                renderMountChips();
                syncUploadMountSelect();
                cloudListDir(cloudMountPath || '/');
            } else {
                document.getElementById('cloudListLoading').classList.add('hidden');
            }
        });
    }

    // ========== 导出到 window ==========
    window.initCloudPage = initCloudPage;
    window.cloudLogin = cloudLogin;
    window.cloudRefresh = cloudRefresh;
    window.cloudToggleUpload = cloudToggleUpload;
    window.cloudEnterDir = cloudEnterDir;
    window.cloudSwitchMount = cloudSwitchMount;
    window.cloudGoHome = cloudGoHome;
    window.cloudPlayVideo = cloudPlayVideo;
    window.cloudPreviewImage = cloudPreviewImage;
    window.cloudCloseImage = cloudCloseImage;
    window.cloudPlayAudio = cloudPlayAudio;
    window.cloudCloseAudio = cloudCloseAudio;
    window.cloudOpenFile = cloudOpenFile;
    window.cloudDeleteFile = cloudDeleteFile;
    window.cloudCloseVideo = cloudCloseVideo;
    window._cloudGetToken = () => cloudToken;
})();
