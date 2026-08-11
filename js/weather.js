/**
 * 天气组件
 * 调用免费天气 API 获取实时天气并渲染到首页
 */

let weatherData = null;
let weatherLatLon = null;
const WEATHER_CACHE_KEY = 'weather_cache';
const WEATHER_CACHE_TTL = 60 * 60 * 1000;

function getWeatherCache() {
    try {
        const raw = localStorage.getItem(WEATHER_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (Date.now() - obj.timestamp > WEATHER_CACHE_TTL) return null;
        return obj;
    } catch (e) { return null; }
}

function setWeatherCache(data, lat, lon, cityName) {
    try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
            data, lat, lon, cityName, timestamp: Date.now()
        }));
    } catch (e) {}
}

function wmoToIcon(code) {
    const map = {
        0: ["☀️", "晴"], 1: ["🌤️", "主要晴"], 2: ["⛅", "局部多云"], 3: ["☁️", "阴"],
        45: ["🌫️", "雾"], 48: ["🌫️", "冻雾"],
        51: ["🌦️", "小毛毛雨"], 53: ["🌦️", "毛毛雨"], 55: ["🌧️", "大毛毛雨"],
        56: ["🌧️", "冻毛毛雨"], 57: ["🌧️", "大冻毛毛雨"],
        61: ["🌧️", "小雨"], 63: ["🌧️", "中雨"], 65: ["🌧️", "大雨"],
        66: ["🌧️", "冻雨"], 67: ["🌧️", "大冻雨"],
        71: ["🌨️", "小雪"], 73: ["❄️", "中雪"], 75: ["❄️", "大雪"], 77: ["🌨️", "米雪"],
        80: ["🌦️", "小阵雨"], 81: ["🌧️", "中阵雨"], 82: ["⛈️", "大阵雨"],
        85: ["🌨️", "阵雪"], 86: ["❄️", "大阵雪"],
        95: ["⛈️", "雷暴"], 96: ["⛈️", "雷暴伴冰雹"], 99: ["⛈️", "大雷暴伴冰雹"]
    };
    return map[code] || ["❓", "未知"];
}

async function initWeather() {
    const cache = getWeatherCache();
    if (cache) {
        weatherData = cache.data;
        weatherLatLon = { lat: cache.lat, lon: cache.lon, cityName: cache.cityName };
        applyWeatherUI(cache.data, cache.cityName);
        return;
    }
    if (!navigator.geolocation) {
        fallbackWeather("不支持定位");
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => loadWeather(pos.coords.latitude, pos.coords.longitude),
        (err) => {
            console.warn("定位失败:", err.message);
            fetch("https://ipapi.co/json/").then(r => r.json()).then(d => {
                if (d.latitude && d.longitude) loadWeather(d.latitude, d.longitude, d.city);
                else fallbackWeather("定位失败");
            }).catch(() => fallbackWeather("定位失败"));
        },
        { timeout: 8000, enableHighAccuracy: false }
    );
}

async function refreshWeather() {
    if (!weatherLatLon) { alert("无法获取定位信息"); return; }
    const btn = document.getElementById('weatherRefreshBtn');
    if (btn) { btn.textContent = '刷新中...'; btn.disabled = true; }
    await loadWeather(weatherLatLon.lat, weatherLatLon.lon, weatherLatLon.cityName, true);
    if (btn) { btn.textContent = '🔄 刷新'; btn.disabled = false; }
    const modal = document.getElementById('weatherModal');
    if (modal) { modal.remove(); showWeatherDetail(); }
}

function applyWeatherUI(data, cityName) {
    const code = data.current.weather_code;
    const [icon, desc] = wmoToIcon(code);
    document.getElementById("wIcon").textContent = icon;
    document.getElementById("wTemp").textContent = Math.round(data.current.temperature_2m) + "°";
    document.getElementById("wCity").textContent = cityName || desc;
}

function fallbackWeather(msg) {
    document.getElementById("wIcon").textContent = "📍";
    document.getElementById("wTemp").textContent = "--";
    document.getElementById("wCity").textContent = msg;
}

async function loadWeather(lat, lon, cityName, force) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m` +
            `&hourly=temperature_2m,weather_code,precipitation_probability` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
            `&timezone=auto&forecast_days=7`;
        const res = await fetch(url);
        const data = await res.json();
        weatherData = data;
        weatherLatLon = { lat, lon, cityName: cityName || "" };

        if (!cityName) {
            try {
                const geo = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`);
                const geoData = await geo.json();
                cityName = geoData.city || geoData.locality || geoData.principalSubdivision || "未知";
                weatherLatLon.cityName = cityName;
            } catch (e) { cityName = ""; }
        }

        applyWeatherUI(data, cityName);
        setWeatherCache(data, lat, lon, cityName || "");
    } catch (e) {
        console.warn("天气加载失败:", e);
        fallbackWeather("加载失败");
    }
}

function showWeatherDetail() {
    if (!weatherData) { alert("天气数据加载中，请稍后..."); return; }
    const cur = weatherData.current;
    const [icon, desc] = wmoToIcon(cur.weather_code);
    const hourly = weatherData.hourly;
    const daily = weatherData.daily;
    const now = new Date();
    const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

    const todayHours = hourly.time.slice(0, 24);
    const hoursHtml = todayHours.map((t, i) => {
        const h = new Date(t);
        const hour = h.getHours();
        const [hIcon, hDesc] = wmoToIcon(hourly.weather_code[i]);
        const temp = Math.round(hourly.temperature_2m[i]);
        const pop = hourly.precipitation_probability[i] || 0;
        const isNow = hour === now.getHours();
        return `<div class="weather-hour-item" style="${isNow ? 'background:#fff0f4;border-radius:8px;' : ''}">
            <span style="width:50px;color:#888;font-size:12px;">${isNow ? '现在' : hour + ':00'}</span>
            <span style="font-size:20px;">${hIcon}</span>
            <span style="flex:1;text-align:center;color:#666;font-size:11px;">${hDesc}</span>
            <span style="color:#999;font-size:11px;width:36px;text-align:right;">💧${pop}%</span>
            <span style="color:#ff6b8b;font-weight:700;width:40px;text-align:right;">${temp}°</span>
        </div>`;
    }).join("");

    const dailyHtml = daily.time.map((t, i) => {
        const d = new Date(t);
        const [dIcon, dDesc] = wmoToIcon(daily.weather_code[i]);
        const tMax = Math.round(daily.temperature_2m_max[i]);
        const tMin = Math.round(daily.temperature_2m_min[i]);
        const pop = daily.precipitation_probability_max[i] || 0;
        const isToday = i === 0;
        const label = isToday ? "今天" : (i === 1 ? "明天" : (i === 2 ? "后天" : weekDays[d.getDay()]));
        return `<div class="weather-hour-item">
            <span style="width:54px;color:${isToday ? '#ff6b8b' : '#888'};font-size:12px;font-weight:${isToday ? '700' : '400'};">${label}</span>
            <span style="font-size:22px;">${dIcon}</span>
            <span style="flex:1;text-align:center;color:#666;font-size:11px;">${dDesc}</span>
            <span style="color:#999;font-size:11px;width:36px;text-align:right;">💧${pop}%</span>
            <span style="width:70px;text-align:right;font-size:12px;">
                <span style="color:#999;">${tMin}°</span>
                <span style="color:#ddd;margin:0 2px;">/</span>
                <span style="color:#ff6b8b;font-weight:700;">${tMax}°</span>
            </span>
        </div>`;
    }).join("");

    const modal = document.createElement("div");
    modal.className = "weather-modal";
    modal.id = "weatherModal";
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
        <div class="weather-modal-inner">
            <div class="flex items-center justify-between mb-4">
                <h3 style="font-size:18px;font-weight:700;color:#ff6b8b;">${icon} 今日天气</h3>
                <div class="flex items-center" style="gap:8px;">
                    <button id="weatherRefreshBtn" onclick="refreshWeather()" style="background:#fff0f4;border:1px solid #ffd0dc;border-radius:8px;font-size:12px;color:#ff6b8b;cursor:pointer;padding:4px 10px;">🔄 刷新</button>
                    <button onclick="document.getElementById('weatherModal').remove()" style="background:none;border:none;font-size:22px;color:#999;cursor:pointer;">×</button>
                </div>
            </div>
            <div style="text-align:center;padding:12px 0 16px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:48px;">${icon}</div>
                <div style="font-size:32px;font-weight:700;color:#ff6b8b;margin:4px 0;">${Math.round(cur.temperature_2m)}°C</div>
                <div style="color:#666;font-size:14px;">${desc}</div>
                <div style="color:#999;font-size:12px;margin-top:6px;">
                    💧 ${cur.relative_humidity_2m}%　🌬️ ${Math.round(cur.wind_speed_10m)} km/h
                </div>
            </div>
            <div style="margin-top:14px;">
                <div style="font-size:13px;color:#888;margin-bottom:8px;">📅 7天预报</div>
                ${dailyHtml}
            </div>
            <div style="margin-top:14px;">
                <div style="font-size:13px;color:#888;margin-bottom:8px;">🕐 今日逐小时</div>
                ${hoursHtml}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.weatherData = weatherData;
window.weatherLatLon = weatherLatLon;
window.initWeather = initWeather;
window.refreshWeather = refreshWeather;
window.applyWeatherUI = applyWeatherUI;
window.fallbackWeather = fallbackWeather;
window.loadWeather = loadWeather;
window.showWeatherDetail = showWeatherDetail;