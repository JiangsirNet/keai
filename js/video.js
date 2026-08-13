(function() {
    const PER_PAGE = 6;
    const SIGN_EXPIRE = 1800; // 签名有效期 30 分钟
    let currentPage = 1;
    let totalCount = 0;
    let cosInstance = null;
    let cosSdkLoading = null;

    // ============ 视频缓存（IndexedDB）============
    const DB_NAME = 'couple_video_cache';
    const DB_VERSION = 1;
    const STORE_NAME = 'videos';
    const CACHE_MAX_SIZE = 500 * 1024 * 1024; // 500MB 上限
    let dbPromise = null;

    function openVideoCacheDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    // 读取缓存
    async function getCachedVideo(key) {
        try {
            const db = await openVideoCacheDb();
            return await new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) { return null; }
    }

    // 更新访问时间（LRU touch）
    async function touchCachedVideo(key) {
        try {
            const db = await openVideoCacheDb();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => {
                const item = req.result;
                if (item) { item.ts = Date.now(); store.put(item); }
            };
        } catch (e) {}
    }

    // 淘汰旧缓存直到能容纳 neededSize
    async function evictCacheIfNeeded(neededSize) {
        try {
            const db = await openVideoCacheDb();
            const all = await new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
            let totalSize = all.reduce((s, item) => s + (item.size || 0), 0);
            if (totalSize + neededSize <= CACHE_MAX_SIZE) return;
            all.sort((a, b) => (a.ts || 0) - (b.ts || 0));
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const item of all) {
                if (totalSize + neededSize <= CACHE_MAX_SIZE) break;
                store.delete(item.key);
                totalSize -= (item.size || 0);
            }
            await new Promise((resolve) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (e) {}
    }

    // 写入缓存
    async function setCachedVideo(key, blob, title) {
        try {
            await evictCacheIfNeeded(blob.size);
            const db = await openVideoCacheDb();
            await new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put({
                    key: key, blob: blob, size: blob.size,
                    title: title || '', ts: Date.now()
                });
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
        } catch (e) { console.warn('缓存写入失败:', e); }
    }

    // 后台下载视频并缓存
    async function fetchAndCacheVideo(key, signedUrl, title) {
        try {
            const resp = await fetch(signedUrl);
            if (!resp.ok) throw new Error('下载失败');
            const blob = await resp.blob();
            await setCachedVideo(key, blob, title);
            return blob;
        } catch (e) { console.warn('缓存下载失败:', e); return null; }
    }

    // 删除单个缓存
    async function removeCachedVideo(key) {
        try {
            const db = await openVideoCacheDb();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
        } catch (e) {}
    }

    // 清空所有视频缓存
    async function clearVideoCache() {
        try {
            const db = await openVideoCacheDb();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            await new Promise((resolve) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
            return true;
        } catch (e) { return false; }
    }

    // 缓存状态指示器
    let cacheIndicatorEl = null;
    function showCacheIndicator(text) {
        const modal = document.getElementById('videoPreviewModal');
        if (!modal) return;
        if (!cacheIndicatorEl) {
            cacheIndicatorEl = document.createElement('div');
            cacheIndicatorEl.id = 'videoCacheIndicator';
            cacheIndicatorEl.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;z-index:10;pointer-events:none;';
        }
        cacheIndicatorEl.textContent = text;
        if (!cacheIndicatorEl.parentNode) modal.appendChild(cacheIndicatorEl);
    }
    function hideCacheIndicator() {
        if (cacheIndicatorEl && cacheIndicatorEl.parentNode) {
            cacheIndicatorEl.parentNode.removeChild(cacheIndicatorEl);
        }
    }

    // 动态加载 COS SDK
    function loadCosSdk() {
        if (window.COS) return Promise.resolve();
        if (cosSdkLoading) return cosSdkLoading;
        cosSdkLoading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/cos-js-sdk-v5/dist/cos-js-sdk-v5.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('COS SDK 加载失败'));
            document.head.appendChild(script);
        });
        return cosSdkLoading;
    }

    // 获取 COS 实例
    function getCos() {
        if (cosInstance) return cosInstance;
        if (!window._cosSecretId || !window._cosSecretKey || !window._cosBucket || !window._cosRegion) {
            return null;
        }
        cosInstance = new COS({
            SecretId: window._cosSecretId,
            SecretKey: window._cosSecretKey
        });
        return cosInstance;
    }

    // 从完整 COS URL 提取 Key
    function extractCosKey(url) {
        if (!url) return null;
        // 支持两种格式:
        // 1. https://bucket.cos.region.myqcloud.com/videos/xxx.mp4
        // 2. cos://videos/xxx.mp4
        if (url.startsWith('cos://')) {
            return url.slice(6);
        }
        const match = url.match(/myqcloud\.com\/(.+?)(?:\?|$)/);
        return match ? match[1] : null;
    }

    // 生成临时签名 URL
    async function getSignedUrl(key) {
        if (!key) return null;
        try {
            await loadCosSdk();
            const cos = getCos();
            if (!cos) return null;
            return new Promise((resolve) => {
                cos.getObjectUrl({
                    Bucket: window._cosBucket,
                    Region: window._cosRegion,
                    Key: key,
                    Expires: SIGN_EXPIRE,
                    Sign: true
                }, function(err, data) {
                    if (err || !data) resolve(null);
                    else resolve(data.Url || data.url || null);
                });
            });
        } catch (e) {
            console.warn('签名失败:', e);
            return null;
        }
    }

    // 加载视频列表
    async function loadVideoList(page) {
        currentPage = page || 1;
        const gridEl = document.getElementById('videoGrid');
        if (!gridEl) return;

        const from = (currentPage - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        const { data, error, count } = await window.sb
            .from('videos')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error || !data || data.length === 0) {
            gridEl.innerHTML = '<div class="text-center text-gray-400 py-8 col-span-full">暂无视频 🎬</div>';
            renderPager(0);
            return;
        }

        totalCount = count || 0;

        // 为每个 URL 生成签名
        // 优先使用 thumbnail_key（新数据），其次 thumbnail_url 中提取（老数据存cos://或url），再次判断是否dataURL直接用
        const signedUrls = {}; // key: 视频id → {thumbUrl, videoKey, videoUrl}
        try {
            await loadCosSdk();
        } catch (e) {}
        const cos = getCos();

        for (const v of data) {
            const entry = {};

            // 1) 视频播放 key
            entry.videoKey = extractCosKey(v.url) || (v.url || '');

            // 2) 缩略图：优先 thumbnail_key，其次从 thumbnail_url 提取，再次判断是否 dataURL
            if (v.thumbnail_key) {
                entry.thumbKey = v.thumbnail_key;
                entry.thumbIsData = false;
            } else if (v.thumbnail_url) {
                if (v.thumbnail_url.startsWith('data:image')) {
                    entry.thumbIsData = true;
                    entry.thumbUrl = v.thumbnail_url;
                } else {
                    entry.thumbKey = extractCosKey(v.thumbnail_url) || v.thumbnail_url;
                    entry.thumbIsData = false;
                }
            } else {
                entry.thumbIsData = false;
                entry.thumbKey = null;
            }

            // 如果可以签，同步生成签名；否则先占位后用 placeholder/key 直连兜底
            if (cos && !entry.thumbIsData) {
                if (entry.thumbKey) entry.thumbUrl = (await getSignedUrl(entry.thumbKey)) || null;
                if (entry.videoKey) entry.videoSignedUrl = (await getSignedUrl(entry.videoKey)) || null;
            }

            signedUrls[v.id] = entry;
        }

        gridEl.innerHTML = data.map(v => {
            const isOwner = window.myRpsEmail && v.uploader_email && v.uploader_email.toLowerCase() === window.myRpsEmail.toLowerCase();
            const entry = signedUrls[v.id] || {};
            const thumb = entry.thumbUrl || '';
            const dur = v.duration ? formatDuration(v.duration) : '';
            // 播放时用 playVideoByKey，传 URL/Key/title
            const playArg = JSON.stringify({ url: v.url || '', key: entry.videoKey || '', title: v.title || '' }).replace(/"/g, '&quot;');
            return `
                <div class="video-card" onclick='window.playVideoByKey(${playArg})'>
                    <div class="video-thumb-wrap">
                        ${thumb ? `<img src="${thumb}" class="video-thumb" loading="lazy">` : `<div class="video-thumb-placeholder"><i class="fa fa-video-camera"></i></div>`}
                        <div class="video-play-overlay"><i class="fa fa-play-circle"></i></div>
                        ${dur ? `<span class="video-duration">${dur}</span>` : ''}
                    </div>
                    <div class="video-info">
                        <div class="video-title">${escapeHtml(v.title)}</div>
                        <div class="video-meta">
                            <span>${formatDate(v.created_at)}</span>
                            ${isOwner ? `<i class="fa fa-trash video-del-icon" onclick="event.stopPropagation(); window.deleteVideo(${v.id}, '${(v.url||'').replace(/'/g, "\\'")}', '${(entry.thumbKey||'').replace(/'/g, "\\'")}')"></i>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        renderPager(totalCount);
    }

    function renderPager(total) {
        const pagerEl = document.getElementById('videoPager');
        if (!pagerEl) return;
        const totalPages = Math.ceil(total / PER_PAGE);
        if (totalPages <= 1) { pagerEl.innerHTML = ''; return; }
        pagerEl.innerHTML = `
            <button onclick="window.loadVideoList(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} class="pager-btn">上一页</button>
            <span class="text-sm text-gray-600">${currentPage} / ${totalPages}</span>
            <button onclick="window.loadVideoList(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} class="pager-btn">下一页</button>
        `;
    }

    // 上传视频
    async function uploadVideo(input) {
        const file = input.files[0];
        if (!file) return;
        input.value = '';

        // 检查 COS 配置
        if (!window._cosSecretId || !window._cosSecretKey || !window._cosBucket || !window._cosRegion) {
            alert('请先在设置页配置腾讯 COS');
            return;
        }

        // 文件大小限制 500MB
        if (file.size > 500 * 1024 * 1024) {
            alert('视频不能超过 500MB');
            return;
        }

        try {
            await loadCosSdk();
            const cos = getCos();
            if (!cos) { alert('COS 初始化失败'); return; }

            // 显示进度条
            const progressWrap = document.getElementById('videoUploadProgress');
            const progressBar = document.getElementById('videoProgressBar');
            const progressText = document.getElementById('videoProgressText');
            progressWrap.classList.remove('hidden');

            // 生成文件名
            const now = new Date();
            const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
            const rand = Math.random().toString(36).slice(2, 8);
            const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
            const videoKey = `videos/${ts}_${rand}.${ext}`;
            const thumbKey = `videos_thumbs/${ts}_${rand}.jpg`;

            // 上传视频到 COS
            progressText.innerText = '上传视频中... 0%';
            await new Promise((resolve, reject) => {
                cos.putObject({
                    Bucket: window._cosBucket,
                    Region: window._cosRegion,
                    Key: videoKey,
                    Body: file,
                    onProgress: function(info) {
                        const percent = Math.round(info.percent * 100);
                        progressBar.style.width = percent + '%';
                        progressText.innerText = `上传视频中... ${percent}%`;
                    }
                }, function(err, data) {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            // 生成缩略图（Blob + duration）
            let duration = null;
            let thumbnailKey = null;
            progressText.innerText = '处理缩略图...';
            try {
                const result = await generateThumbnail(file);
                duration = result.duration;
                if (result.blob) {
                    // 上传缩略图到 COS
                    await new Promise((resolve, reject) => {
                        cos.putObject({
                            Bucket: window._cosBucket,
                            Region: window._cosRegion,
                            Key: thumbKey,
                            Body: result.blob
                        }, function(err, data) {
                            if (err) reject(err);
                            else resolve(data);
                        });
                    });
                    thumbnailKey = thumbKey;
                }
            } catch (e) {
                console.warn('缩略图处理失败:', e);
            }

            // 存入数据库（私有桶：url 字段存 key，thumbnail_key 存缩略图 key）
            const title = file.name.replace(/\.[^/.]+$/, '');
            const urlStore = `cos://${videoKey}`;

            const insertData = {
                title: title,
                url: urlStore,
                thumbnail_key: thumbnailKey,
                thumbnail_url: null, // 新方案不存 base64
                file_size: file.size,
                duration: duration,
                uploader_email: window.myRpsEmail || null
            };

            const { error: insertErr } = await window.sb.from('videos').insert(insertData);
            if (insertErr) {
                // 兼容没有 thumbnail_key 字段的旧表
                delete insertData.thumbnail_key;
                insertData.thumbnail_url = thumbnailKey ? `cos://${thumbnailKey}` : null;
                const { error: insertErr2 } = await window.sb.from('videos').insert(insertData);
                if (insertErr2) {
                    alert('保存记录失败：' + insertErr2.message);
                    return;
                }
            }

            progressWrap.classList.add('hidden');
            progressBar.style.width = '0%';
            window.sendNotification('video', '🎬 视频上传成功！');
            loadVideoList(1);
        } catch (err) {
            console.error('上传失败:', err);
            alert('上传失败：' + (err.message || err));
            document.getElementById('videoUploadProgress').classList.add('hidden');
        }
    }

    // 生成视频缩略图 Blob（截取第一帧）+ 获取时长
    function generateThumbnail(file) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.src = URL.createObjectURL(file);

            video.onloadedmetadata = () => {
                video.currentTime = Math.min(1, video.duration / 2);
            };

            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 240;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    URL.revokeObjectURL(video.src);
                    if (blob) {
                        resolve({ blob, duration: video.duration });
                    } else {
                        resolve({ blob: null, duration: video.duration });
                    }
                }, 'image/jpeg', 0.7);
            };

            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error('视频解码失败'));
            };
        });
    }

    // 通过 key 生成签名后播放视频（带缓存）
    async function playVideoByKey(info) {
        let finalUrl = '';
        let fromCache = false;
        const key = info.key || extractCosKey(info.url);

        // 1. 优先查缓存
        if (key) {
            const cached = await getCachedVideo(key);
            if (cached && cached.blob) {
                finalUrl = URL.createObjectURL(cached.blob);
                fromCache = true;
                touchCachedVideo(key); // 更新访问时间（LRU）
            }
        }

        // 2. 缓存未命中 → 获取签名 URL
        if (!finalUrl) {
            if (key) {
                const signed = await getSignedUrl(key);
                if (signed) finalUrl = signed;
            }
            // 兜底
            if (!finalUrl && info.url && !info.url.startsWith('cos://')) {
                finalUrl = info.url;
            }
        }

        if (!finalUrl) {
            alert('视频加载失败');
            return;
        }

        const modal = document.getElementById('videoPreviewModal');
        const player = document.getElementById('videoPreviewPlayer');
        player.src = finalUrl;
        modal.classList.remove('hidden');

        // 3. 命中缓存时显示提示
        if (fromCache) {
            showCacheIndicator('📱 已离线缓存');
            setTimeout(hideCacheIndicator, 2000);
        }

        // 4. 未命中缓存 → 仅在用户「看完」后才下载缓存，避免不必要流量
        //    （没看完就不缓存；播放器自身的流式下载是播放必需的，不重复下载）
        if (key && !fromCache && !finalUrl.startsWith('blob:')) {
            showCacheIndicator('▶️ 看完将自动缓存');
            setTimeout(hideCacheIndicator, 2500);
            // 用 onended 覆盖赋值，避免反复播放累积监听器
            player.onended = () => {
                showCacheIndicator('⬇️ 缓存中...');
                fetchAndCacheVideo(key, finalUrl, info.title).then((blob) => {
                    if (blob) {
                        showCacheIndicator('✅ 已缓存，下次离线播放');
                        setTimeout(hideCacheIndicator, 2000);
                    } else {
                        hideCacheIndicator();
                    }
                });
            };
        } else {
            // 命中缓存或无 key，清掉可能残留的 onended
            player.onended = null;
        }
    }

    // 关闭视频预览
    function closeVideoPreview(e) {
        if (e && e.target.tagName === 'VIDEO') return;
        const modal = document.getElementById('videoPreviewModal');
        const player = document.getElementById('videoPreviewPlayer');
        // 释放 blob URL，避免内存泄漏
        const src = player.src;
        if (src && src.startsWith('blob:')) URL.revokeObjectURL(src);
        player.pause();
        player.onended = null; // 清理缓存触发器，避免关闭后下载
        player.src = '';
        modal.classList.add('hidden');
        hideCacheIndicator();
    }

    // 删除视频（同时删 COS 文件 + 缩略图 + 本地缓存）
    async function deleteVideo(id, url, thumbKey) {
        if (!confirm('确定删除这个视频吗？')) return;

        try {
            const { error: dbErr } = await window.sb.from('videos').delete().eq('id', id);
            if (dbErr) { alert('删除失败：' + dbErr.message); return; }

            // 同步删除本地缓存
            const videoKey = extractCosKey(url);
            if (videoKey) removeCachedVideo(videoKey);

            if (window._cosBucket && window._cosRegion) {
                try {
                    await loadCosSdk();
                    const cos = getCos();
                    if (cos) {
                        const videoKey = extractCosKey(url);
                        const keysToDelete = [];
                        if (videoKey) keysToDelete.push(videoKey);
                        if (thumbKey) keysToDelete.push(thumbKey);

                        for (const k of keysToDelete) {
                            try {
                                await new Promise((resolve) => {
                                    cos.deleteObject({
                                        Bucket: window._cosBucket,
                                        Region: window._cosRegion,
                                        Key: k
                                    }, function(err) {
                                        if (err) console.warn(`COS 删除失败 [${k}]:`, err);
                                        resolve();
                                    });
                                });
                            } catch (e) { console.warn(`COS 删除失败 [${k}]:`, e); }
                        }
                    }
                } catch (e) { console.warn('COS 删除失败:', e); }
            }

            window.sendNotification('video', '🗑️ 视频已删除');
            loadVideoList(currentPage);
        } catch (err) {
            alert('删除失败：' + err.message);
        }
    }

    // 保存 COS 配置
    async function saveCosConfig() {
        const secretId = document.getElementById('cosSecretIdInput').value.trim();
        const secretKey = document.getElementById('cosSecretKeyInput').value.trim();
        const bucket = document.getElementById('cosBucketInput').value.trim();
        const region = document.getElementById('cosRegionInput').value.trim();

        if (!secretId || !secretKey || !bucket || !region) {
            alert('请填写所有字段');
            return;
        }

        const configs = [
            { key: 'cos_secret_id', value: secretId },
            { key: 'cos_secret_key', value: secretKey },
            { key: 'cos_bucket', value: bucket },
            { key: 'cos_region', value: region }
        ];

        for (const c of configs) {
            const { error } = await window.sb.from('app_config')
                .upsert({ config_key: c.key, config_value: c.value }, { onConflict: 'config_key' });
            if (error) { alert('保存失败：' + error.message); return; }
        }

        window._cosSecretId = secretId;
        window._cosSecretKey = secretKey;
        window._cosBucket = bucket;
        window._cosRegion = region;
        cosInstance = null; // 重置 COS 实例

        alert('✅ COS 配置已保存');
    }

    // 加载 COS 配置到表单
    function loadCosConfigForm() {
        if (window._cosSecretId) document.getElementById('cosSecretIdInput').value = window._cosSecretId;
        if (window._cosBucket) document.getElementById('cosBucketInput').value = window._cosBucket;
        if (window._cosRegion) document.getElementById('cosRegionInput').value = window._cosRegion;
    }

    function formatDuration(sec) {
        if (!sec) return '';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2,'0')}`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    // 页面初始化时加载 COS 配置到表单
    function initVideoPage() {
        loadCosConfigForm();
        loadVideoList(1);
    }

    window.uploadVideo = uploadVideo;
    window.playVideoByKey = playVideoByKey;
    window.closeVideoPreview = closeVideoPreview;
    window.deleteVideo = deleteVideo;
    window.loadVideoList = loadVideoList;
    window.saveCosConfig = saveCosConfig;
    window.clearVideoCache = clearVideoCache;
    window.initVideoPage = initVideoPage;
})();
