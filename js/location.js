/**
 * 定位共享（高德地图）
 * 登录后自动上报自己的位置（watchPosition），定位页展示对方实时位置与最后更新位置
 * load_order=24（在 auth.js 之前）
 */

(function () {
    'use strict';

    const sb = window.sb;

    const WRITE_MIN_INTERVAL = 20000;    // 同位置至少 20s 才重复上报
    const WRITE_MIN_DISTANCE = 50;       // 或移动超过 50m 才上报
    const ONLINE_WINDOW = 2 * 60 * 1000; // 2 分钟内更新视为实时
    const POLL_INTERVAL = 60000;         // Realtime 不可用时的兜底轮询
    const TRIP_MIN_DISTANCE = 1000;      // 历史行程：移动超过 1km 记录一次
    const TRIP_MIN_INTERVAL = 60 * 60 * 1000; // 或每 1 小时记录一次

    let map = null;
    let geocoder = null;
    let partnerMarker = null;
    let selfMarker = null;
    let amapLoading = null;
    let mapFitted = false;

    let watchId = null;
    let writing = false;
    let lastWriteAt = 0;
    let lastPos = null;             // { lat, lng }
    let shareState = 'idle';        // idle | requesting | on | off | error
    let watchError = '';

    let selfRow = null;
    let partnerRow = null;

    let locChannel = null;
    let pollTimer = null;
    let pageInited = false;

    let lastTripPoint = null;           // { lat, lng, at } 最近一条历史行程
    let tripSeedPromise = null;
    let tripHistoryAvailable = true;
    let tripRecording = false;
    let tripBackfilling = false;
    let partnerGeocodeBusy = false;
    let partnerGeocodeKey = '';

    // ===== 小工具 =====
    function lower(s) { return String(s || '').toLowerCase(); }
    function isSelf(email) { return lower(email) === lower(window.myRpsEmail); }

    function partnerEmail() {
        const me = lower(window.myRpsEmail);
        const cfg = window.CONFIG || {};
        const boy = lower(cfg.boyEmail);
        const girl = lower(cfg.girlEmail);
        if (!me) return '';
        if (boy && me === boy) return girl;
        if (girl && me === girl) return boy;
        return boy || girl || '';
    }
    function isPartner(email) {
        const p = partnerEmail();
        return !!p && lower(email) === p;
    }

    function hasKey() { return !!String(window._amapKey || '').trim(); }

    function pad2(n) { return String(n).padStart(2, '0'); }
    function validDate(ts) { const d = new Date(ts); return isNaN(d.getTime()) ? null : d; }

    function fmtTime(ts) {
        const d = validDate(ts);
        if (!d) return '';
        const now = new Date();
        const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        return d.toDateString() === now.toDateString() ? hm : `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
    }

    function agoText(ts) {
        const d = validDate(ts);
        if (!d) return '';
        const diff = Date.now() - d.getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
        return Math.floor(diff / 86400000) + ' 天前';
    }

    function isOnline(row) {
        const d = row && validDate(row.updated_at);
        return !!d && Date.now() - d.getTime() < ONLINE_WINDOW;
    }

    function coordsText(row) {
        return `经度 ${Number(row.lng).toFixed(5)}，纬度 ${Number(row.lat).toFixed(5)}`;
    }

    function distanceMeters(a, b) {
        if (!a || !b) return 0;
        const R = 6371000;
        const rad = x => x * Math.PI / 180;
        const dLat = rad(b.lat - a.lat);
        const dLng = rad(b.lng - a.lng);
        const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    }

    function fmtDistance(m) {
        if (!m) return '';
        return m < 1000 ? Math.round(m) + ' 米' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' 公里';
    }

    function setStatus(text, online) {
        const box = document.getElementById('locStatus');
        const t = document.getElementById('locStatusText');
        if (t) t.textContent = text;
        if (box) box.classList.toggle('online', !!online);
    }

    function setHint(text) {
        const el = document.getElementById('locHint');
        if (el) el.textContent = text;
    }

    // ===== 高德地图 =====
    function loadAmap() {
        if (window.AMap) return Promise.resolve(window.AMap);
        if (amapLoading) return amapLoading;
        const key = String(window._amapKey || '').trim();
        if (!key) return Promise.reject(new Error('missing-amap-key'));
        const sec = String(window._amapSecurityCode || '').trim();
        if (sec) window._AMapSecurityConfig = { securityJsCode: sec };
        amapLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://webapi.amap.com/maps?v=2.0&key=' + encodeURIComponent(key) + '&plugin=AMap.Geocoder';
            s.async = true;
            s.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('amap-unavailable'));
            s.onerror = () => reject(new Error('amap-load-failed'));
            document.head.appendChild(s);
        });
        return amapLoading;
    }

    function mapEmptyHtml(icon, title, tip) {
        return `<div class="loc-map-empty"><i class="fa ${icon}"></i><span>${title}</span>${tip ? `<span class="loc-map-empty-tip">${tip}</span>` : ''}</div>`;
    }

    async function initMap() {
        const el = document.getElementById('locMap');
        if (!el) return;
        if (!hasKey()) {
            el.innerHTML = mapEmptyHtml('fa-map-o', '未配置高德 Key', '设置页 → 定位设置中填入 Web端(JS API) Key 后刷新');
            return;
        }
        try {
            await loadAmap();
        } catch (e) {
            el.innerHTML = mapEmptyHtml('fa-exclamation-circle', '高德地图加载失败', '请检查 Key、安全密钥与域名白名单');
            return;
        }
        if (!geocoder && window.AMap.Geocoder) {
            geocoder = new window.AMap.Geocoder({ radius: 500 });
            geocodePartnerAddress();
            // 历史行程 Tab 可见时，地图加载完后再补一次缺失地址
            const histPanel = document.getElementById('tripTab-history');
            if (histPanel && !histPanel.classList.contains('hidden')) loadTripHistory();
        }
        if (map) return;
        el.innerHTML = '';
        map = new window.AMap.Map(el, { zoom: 14, resizeEnable: true, viewMode: '2D' });
        updateMarkers();
        // 已有坐标但没地址时，补一次逆地理编码
        if (selfRow && !selfRow.address) {
            saveLocation(selfRow.lat, selfRow.lng, selfRow.accuracy);
        }
    }

    function markerContent(type) {
        const icon = type === 'partner' ? 'fa-heart' : 'fa-location-arrow';
        return `<div class="loc-pin loc-pin-${type}"><i class="fa ${icon}"></i></div>`;
    }

    function updateMarkers() {
        if (!map || !window.AMap) return;

        if (partnerRow) {
            const ll = [Number(partnerRow.lng), Number(partnerRow.lat)];
            if (!partnerMarker) {
                partnerMarker = new window.AMap.Marker({
                    position: ll, content: markerContent('partner'),
                    anchor: 'center', zIndex: 110, title: 'TA 的位置'
                });
                partnerMarker.setMap(map);
            } else {
                partnerMarker.setPosition(ll);
            }
        } else if (partnerMarker) {
            partnerMarker.setMap(null);
            partnerMarker = null;
        }

        if (selfRow) {
            const ll = [Number(selfRow.lng), Number(selfRow.lat)];
            if (!selfMarker) {
                selfMarker = new window.AMap.Marker({
                    position: ll, content: markerContent('self'),
                    anchor: 'center', zIndex: 100, title: '我的位置'
                });
                selfMarker.setMap(map);
            } else {
                selfMarker.setPosition(ll);
            }
        } else if (selfMarker) {
            selfMarker.setMap(null);
            selfMarker = null;
        }

        if (!mapFitted && selfRow && partnerRow) {
            const overlays = [partnerMarker, selfMarker].filter(Boolean);
            if (overlays.length) {
                mapFitted = true;
                map.setFitView(overlays, false, [50, 50, 50, 50], 16);
            }
        }
    }

    function reverseGeocode(lat, lng) {
        return new Promise(resolve => {
            if (!geocoder) return resolve('');
            geocoder.getAddress([lng, lat], (status, result) => {
                if (status === 'complete' && result && result.regeocode) {
                    resolve(result.regeocode.formattedAddress || '');
                } else {
                    resolve('');
                }
            });
        });
    }

    // 对方位置缺少地址时，用本机地图服务补一次逆地理编码并回写
    async function geocodePartnerAddress() {
        if (!partnerRow || !geocoder || partnerGeocodeBusy || partnerRow.address) return;
        const key = `${partnerRow.lng},${partnerRow.lat}`;
        if (partnerGeocodeKey === key) return;
        partnerGeocodeBusy = true;
        partnerGeocodeKey = key;
        try {
            const addr = await reverseGeocode(Number(partnerRow.lat), Number(partnerRow.lng));
            if (!addr) return;
            partnerRow.address = addr;
            render();
            if (partnerRow.user_email && sb) {
                const { error } = await sb.from('locations')
                    .update({ address: addr })
                    .eq('user_email', partnerRow.user_email);
                if (error) console.warn('[Location] 回写对方地址失败:', error.message);
            }
        } catch (e) {
            console.warn('[Location] 对方地址解析失败:', e && e.message);
        } finally {
            partnerGeocodeBusy = false;
        }
    }

    // ===== 历史行程（自动记录 + 列表） =====
    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function userLabel(email) {
        const cfg = window.CONFIG || {};
        if (lower(email) === lower(cfg.boyEmail)) return '男生';
        if (lower(email) === lower(cfg.girlEmail)) return '女生';
        return email || '未知';
    }

    function fmtHm(ts) {
        const d = validDate(ts);
        return d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : '';
    }

    function tripDateTitle(d) {
        const now = new Date();
        const base = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const diffDays = Math.round((today - base) / 86400000);
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
        return `${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
    }

    async function seedLastTripPoint() {
        const email = window.myRpsEmail;
        if (!email || !sb || !tripHistoryAvailable) return;
        try {
            const { data, error } = await sb.from('trip_history')
                .select('lat,lng,recorded_at')
                .eq('user_email', email)
                .order('recorded_at', { ascending: false })
                .limit(1);
            if (error) throw error;
            if (data && data[0]) {
                lastTripPoint = {
                    lat: Number(data[0].lat),
                    lng: Number(data[0].lng),
                    at: new Date(data[0].recorded_at).getTime() || Date.now()
                };
            }
        } catch (e) {
            tripHistoryAvailable = false;
            console.warn('[Trip] 历史行程表不可用，请先执行建表 SQL:', e && e.message);
        }
    }

    function ensureTripSeed() {
        if (!tripSeedPromise) tripSeedPromise = seedLastTripPoint();
        return tripSeedPromise;
    }

    async function recordTripPoint(lat, lng, accuracy, address) {
        const email = window.myRpsEmail;
        if (!email || !sb || !tripHistoryAvailable || tripRecording) return;
        tripRecording = true;
        try {
            await ensureTripSeed();
            if (!tripHistoryAvailable) return;
            const now = Date.now();
            if (lastTripPoint) {
                const moved = distanceMeters(lastTripPoint, { lat: lat, lng: lng });
                if (moved < TRIP_MIN_DISTANCE && now - lastTripPoint.at < TRIP_MIN_INTERVAL) return;
            }
            let addr = address;
            if (!addr && geocoder) addr = await reverseGeocode(lat, lng);
            const { error } = await sb.from('trip_history').insert({
                user_email: email,
                lat: lat,
                lng: lng,
                accuracy: accuracy || null,
                address: addr || null
            });
            if (error) throw error;
            lastTripPoint = { lat: lat, lng: lng, at: now };
            const panel = document.getElementById('tripTab-history');
            if (panel && !panel.classList.contains('hidden')) loadTripHistory();
        } catch (e) {
            console.warn('[Trip] 记录历史行程失败:', e && e.message);
        } finally {
            tripRecording = false;
        }
    }

    function renderTripHistory(rows) {
        const box = document.getElementById('tripHistoryList');
        if (!box) return;
        if (!rows.length) {
            box.innerHTML = '<div class="text-center text-gray-400 py-6 text-sm">暂无历史行程，移动后会自动记录</div>';
            return;
        }
        const groups = new Map();
        rows.forEach(r => {
            const d = validDate(r.recorded_at);
            if (!d) return;
            const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
            if (!groups.has(key)) groups.set(key, { date: d, items: [] });
            groups.get(key).items.push(r);
        });
        let html = '';
        groups.forEach(g => {
            html += `<div class="trip-day"><div class="trip-day-title"><i class="fa fa-calendar"></i>${escHtml(tripDateTitle(g.date))}</div>`;
            g.items.forEach(r => {
                const addr = r.address || `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}`;
                const label = userLabel(r.user_email);
                const cls = isSelf(r.user_email) ? 'self' : 'partner';
                const amapUrl = 'https://uri.amap.com/marker?position=' +
                    encodeURIComponent(`${r.lng},${r.lat}`) + '&name=' + encodeURIComponent(addr);
                html += '<div class="trip-item">' +
                    `<span class="trip-marker ${cls}"></span>` +
                    '<div class="trip-info">' +
                    `<a class="trip-addr" href="${amapUrl}" target="_blank" rel="noopener">${escHtml(addr)}</a>` +
                    `<div class="trip-meta"><span>${fmtHm(r.recorded_at)}</span>` +
                    `<span class="trip-user ${cls}">${escHtml(label)}</span></div>` +
                    '</div></div>';
            });
            html += '</div>';
        });
        box.innerHTML = html;
    }

    // 历史记录缺少地址时，用本机地图服务补全并回写数据库（每次最多补 10 条）
    async function backfillTripAddresses(rows) {
        if (!geocoder || !sb || tripBackfilling) return;
        const missing = rows.filter(r => !r.address && isFinite(Number(r.lat)) && isFinite(Number(r.lng))).slice(0, 10);
        if (!missing.length) return;
        tripBackfilling = true;
        let changed = false;
        try {
            for (const r of missing) {
                const addr = await reverseGeocode(Number(r.lat), Number(r.lng));
                if (!addr) continue;
                r.address = addr;
                changed = true;
                sb.from('trip_history').update({ address: addr }).eq('id', r.id)
                    .then(({ error }) => {
                        if (error) console.warn('[Trip] 回写历史地址失败:', error.message);
                    });
            }
        } finally {
            tripBackfilling = false;
        }
        if (changed) renderTripHistory(rows);
    }

    async function loadTripHistory() {
        const box = document.getElementById('tripHistoryList');
        if (!box || !sb) return;
        if (!tripHistoryAvailable) {
            box.innerHTML = '<div class="text-center text-gray-400 py-6 text-sm">请先执行 trip_history 建表 SQL</div>';
            return;
        }
        try {
            const { data, error } = await sb.from('trip_history')
                .select('id,user_email,lat,lng,accuracy,address,recorded_at')
                .order('recorded_at', { ascending: false })
                .limit(200);
            if (error) throw error;
            renderTripHistory(data || []);
            backfillTripAddresses(data || []);
        } catch (e) {
            tripHistoryAvailable = false;
            box.innerHTML = '<div class="text-center text-gray-400 py-6 text-sm">加载失败：请先执行 trip_history 建表 SQL</div>';
            console.warn('[Trip] 加载历史行程失败:', e && e.message);
        }
    }

    // ===== 位置上报 =====
    async function saveLocation(lat, lng, accuracy) {
        const email = window.myRpsEmail;
        if (!email || !sb || writing) return;
        writing = true;
        lastWriteAt = Date.now();
        try {
            let address = '';
            if (geocoder) address = await reverseGeocode(lat, lng);
            const payload = {
                user_email: email,
                lat: lat,
                lng: lng,
                accuracy: accuracy || null,
                address: address || (selfRow && selfRow.address) || null,
                updated_at: new Date().toISOString()
            };
            const { data, error } = await sb.from('locations')
                .upsert(payload, { onConflict: 'user_email' })
                .select();
            if (error) throw error;
            if (data && data[0]) selfRow = data[0];
            lastPos = { lat: lat, lng: lng };
            render();
            // 自动写入历史行程（按距离/时间阈值节流）
            recordTripPoint(lat, lng, accuracy, payload.address);
        } catch (e) {
            console.warn('[Location] 位置上报失败:', e && e.message);
            setHint('位置上报失败：' + ((e && e.message) || '未知错误') + '（请确认已执行 locations 建表 SQL）');
        } finally {
            writing = false;
        }
    }

    function onPosition(pos, force) {
        const c = pos.coords;
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        if (!isFinite(lat) || !isFinite(lng)) return;
        const accuracy = Number(c.accuracy) || null;

        selfRow = Object.assign({}, selfRow, {
            user_email: window.myRpsEmail,
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            updated_at: new Date().toISOString()
        });
        render();

        const moved = lastPos ? distanceMeters(lastPos, { lat: lat, lng: lng }) : Infinity;
        if (!force && Date.now() - lastWriteAt < WRITE_MIN_INTERVAL && moved < WRITE_MIN_DISTANCE) return;
        saveLocation(lat, lng, accuracy);
    }

    function geoErrorText(err) {
        const code = err && err.code;
        if (code === 1) return '已拒绝定位权限，请在浏览器设置中允许后重试';
        if (code === 2) return '暂时无法获取位置（定位信号不可用）';
        if (code === 3) return '定位超时，请点击「立即更新」重试';
        return (err && err.message) || '未知定位错误';
    }

    function startSharing() {
        if (watchId !== null) return;
        if (!navigator.geolocation) {
            shareState = 'error';
            watchError = '当前浏览器不支持定位';
            updateStatusLine();
            return;
        }
        if (window.isSecureContext === false) {
            shareState = 'error';
            watchError = '需要 HTTPS 环境才能定位';
            updateStatusLine();
            return;
        }
        shareState = 'requesting';
        updateStatusLine();
        updateShareBtn();
        watchId = navigator.geolocation.watchPosition(
            pos => {
                shareState = 'on';
                watchError = '';
                onPosition(pos, false);
                updateStatusLine();
                updateShareBtn();
            },
            err => {
                shareState = 'error';
                watchError = geoErrorText(err);
                if (watchId !== null && navigator.geolocation) {
                    navigator.geolocation.clearWatch(watchId);
                }
                watchId = null;
                updateStatusLine();
                updateShareBtn();
                setHint('定位未开启：' + watchError);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );
    }

    function stopSharing() {
        if (watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchId);
        }
        watchId = null;
        shareState = 'off';
        updateStatusLine();
        updateShareBtn();
    }

    function shareOnce() {
        if (!navigator.geolocation) {
            setHint('当前浏览器不支持定位');
            return;
        }
        setStatus('正在获取当前位置...', false);
        navigator.geolocation.getCurrentPosition(
            pos => {
                shareState = 'on';
                watchError = '';
                onPosition(pos, true);
                updateStatusLine();
                updateShareBtn();
            },
            err => {
                shareState = 'error';
                watchError = geoErrorText(err);
                updateStatusLine();
                setHint('定位失败：' + watchError);
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    }

    function toggleSharing() {
        if (watchId !== null) stopSharing();
        else startSharing();
    }

    function updateShareBtn() {
        const btn = document.getElementById('locShareBtn');
        if (!btn) return;
        const watching = watchId !== null;
        btn.innerHTML = watching
            ? '<i class="fa fa-pause"></i> 停止共享'
            : '<i class="fa fa-play"></i> 开始共享';
    }

    // ===== 读取与渲染 =====
    async function loadLocations() {
        const me = window.myRpsEmail;
        if (!me || !sb) return;
        const p = partnerEmail();
        const emails = p ? [me, p] : [me];
        const { data, error } = await sb.from('locations').select('*').in('user_email', emails);
        if (error) {
            console.warn('[Location] 读取位置失败:', error.message);
            if (/does not exist|relation/i.test(error.message)) {
                setHint('locations 表不存在，请先在 Supabase 执行建表 SQL。');
            }
            return;
        }
        const rows = data || [];
        selfRow = rows.find(r => isSelf(r.user_email)) || selfRow;
        partnerRow = p ? (rows.find(r => isPartner(r.user_email)) || null) : null;
        render();
    }

    function render() {
        const pAddr = document.getElementById('locPartnerAddr');
        const pMeta = document.getElementById('locPartnerMeta');
        const pBadge = document.getElementById('locPartnerBadge');
        const sAddr = document.getElementById('locSelfAddr');
        const sMeta = document.getElementById('locSelfMeta');
        const sBadge = document.getElementById('locSelfBadge');
        const nav = document.getElementById('locPartnerNav');

        // 对方
        if (partnerRow) {
            if (pAddr) pAddr.textContent = partnerRow.address || coordsText(partnerRow);
            const online = isOnline(partnerRow);
            if (pBadge) {
                pBadge.textContent = online ? '实时' : '离线';
                pBadge.className = 'loc-badge' + (online ? ' online' : '');
            }
            const dist = (selfRow && partnerRow) ? fmtDistance(distanceMeters(selfRow, partnerRow)) : '';
            if (pMeta) {
                pMeta.textContent = (online ? '实时共享中' : '最后更新') +
                    ` · ${fmtTime(partnerRow.updated_at)}（${agoText(partnerRow.updated_at)}）` +
                    (dist ? ` · 相距约 ${dist}` : '');
            }
            if (nav) {
                nav.href = 'https://uri.amap.com/marker?position=' +
                    `${partnerRow.lng},${partnerRow.lat}` +
                    '&name=' + encodeURIComponent('TA的位置') +
                    '&coordinate=gaode&callnative=0';
                nav.classList.remove('hidden');
            }
        } else {
            if (pAddr) {
                pAddr.textContent = partnerEmail()
                    ? '暂无共享位置，等 TA 打开页面后自动更新'
                    : '未配置双方邮箱，无法识别对方';
            }
            if (pMeta) pMeta.textContent = '';
            if (pBadge) {
                pBadge.textContent = partnerEmail() ? '暂无' : '未配置';
                pBadge.className = 'loc-badge';
            }
            if (nav) nav.classList.add('hidden');
        }

        // 自己
        if (selfRow) {
            if (sAddr) sAddr.textContent = selfRow.address || coordsText(selfRow);
            const online = isOnline(selfRow) && watchId !== null;
            if (sBadge) {
                sBadge.textContent = online ? '共享中' : '已停止';
                sBadge.className = 'loc-badge' + (online ? ' online' : '');
            }
            if (sMeta) {
                const acc = Number(selfRow.accuracy);
                sMeta.textContent = `更新于 ${fmtTime(selfRow.updated_at)}（${agoText(selfRow.updated_at)}）` +
                    (acc ? ` · 精度 ±${Math.round(acc)} 米` : '');
            }
        } else {
            if (sAddr) sAddr.textContent = '等待定位授权...';
            if (sMeta) sMeta.textContent = '';
            if (sBadge) {
                sBadge.textContent = '未开启';
                sBadge.className = 'loc-badge';
            }
        }

        updateStatusLine();
        updateShareBtn();
        updateMarkers();
        geocodePartnerAddress();
    }

    function updateStatusLine() {
        if (!partnerEmail()) {
            setStatus('未配置双方邮箱，无法识别对方的位置', false);
            return;
        }
        if (shareState === 'error') {
            setStatus('定位不可用：' + watchError, false);
            return;
        }
        if (shareState === 'on') {
            const online = isOnline(partnerRow);
            setStatus(online ? '正在共享位置 · 对方实时在线' : '正在共享位置 · 对方当前离线', online);
        } else if (shareState === 'requesting') {
            setStatus('正在请求定位权限...', false);
        } else {
            setStatus('位置共享已停止', false);
        }
    }

    // ===== 实时订阅 + 轮询兜底 =====
    function subscribeRealtime() {
        if (locChannel || !sb) return;
        locChannel = sb.channel('locations_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, payload => {
                const row = (payload.new && payload.new.user_email) ? payload.new : payload.old;
                if (!row || !row.user_email) return;
                if (isSelf(row.user_email)) {
                    selfRow = payload.eventType === 'DELETE' ? null : payload.new;
                } else if (isPartner(row.user_email)) {
                    partnerRow = payload.eventType === 'DELETE' ? null : payload.new;
                } else {
                    return;
                }
                render();
            })
            .subscribe();
    }

    function startPolling() {
        if (pollTimer) return;
        pollTimer = setInterval(() => {
            if (document.visibilityState === 'visible') loadLocations();
        }, POLL_INTERVAL);
    }

    // ===== 设置页 =====
    function loadLocationConfigForm() {
        const k = document.getElementById('amapKeyInput');
        const s = document.getElementById('amapSecInput');
        if (k) k.value = window._amapKey || '';
        if (s) s.value = window._amapSecurityCode || '';
    }

    async function saveLocationConfig() {
        const kEl = document.getElementById('amapKeyInput');
        const sEl = document.getElementById('amapSecInput');
        const status = document.getElementById('amapSaveStatus');
        const key = (kEl ? kEl.value : '').trim();
        const sec = (sEl ? sEl.value : '').trim();
        if (!sb) return;
        if (status) status.textContent = '保存中...';
        const { error } = await sb.from('app_config').upsert([
            { config_key: 'amap_key', config_value: key },
            { config_key: 'amap_security_code', config_value: sec }
        ], { onConflict: 'config_key' });
        if (error) {
            if (status) status.textContent = '保存失败：' + error.message;
            return;
        }
        window._amapKey = key;
        window._amapSecurityCode = sec;
        if (status) status.textContent = '已保存，刷新页面后生效';
    }

    // ===== 初始化 / 清理 =====
    function initLocationPage() {
        if (pageInited) return;
        pageInited = true;
        const ready = window.initStorageGlobals ? window.initStorageGlobals() : Promise.resolve();
        Promise.resolve(ready).then(() => {
            initMap();
            loadLocations();
        });
        subscribeRealtime();
        startPolling();
        render();
    }

    function resetLocation() {
        if (watchId !== null && navigator.geolocation) {
            try { navigator.geolocation.clearWatch(watchId); } catch (e) { /* ignore */ }
        }
        watchId = null;
        shareState = 'idle';
        watchError = '';
        writing = false;
        lastWriteAt = 0;
        lastPos = null;
        if (locChannel && sb) {
            try { sb.removeChannel(locChannel); } catch (e) { /* ignore */ }
        }
        locChannel = null;
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        if (partnerMarker) { partnerMarker.setMap(null); partnerMarker = null; }
        if (selfMarker) { selfMarker.setMap(null); selfMarker = null; }
        mapFitted = false;
        selfRow = null;
        partnerRow = null;
        pageInited = false;
        lastTripPoint = null;
        tripSeedPromise = null;
        tripHistoryAvailable = true;
        tripRecording = false;
        tripBackfilling = false;
        partnerGeocodeBusy = false;
        partnerGeocodeKey = '';
        render();
    }

    window.initLocationPage = initLocationPage;
    window.startLocationSharing = startSharing;
    window.stopLocationSharing = resetLocation;
    window.toggleLocationSharing = toggleSharing;
    window.shareMyLocationOnce = shareOnce;
    window.refreshLocations = function () {
        if (!pageInited) {
            initLocationPage();
            return;
        }
        if (map && map.resize) map.resize();
        loadLocations();
    };
    window.loadLocationConfigForm = loadLocationConfigForm;
    window.saveLocationConfig = saveLocationConfig;
    window.loadTripHistory = loadTripHistory;
})();
