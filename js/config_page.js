/**
 * 人物话语管理
 * 负责男生/女生话语的数据库读写、界面渲染与增删操作
 */

let boyDbQuotes = [];
let girlDbQuotes = [];
let currentQuoteTab = "boy";
let myGender = "boy";
let _isAddingQuote = false;

async function loadCharacterQuotes() {
    const { data: { user } } = await window.sb.auth.getUser();
    const me = (user?.email || "").toLowerCase();
    const girlEmail = (window.CONFIG.girlEmail || "").toLowerCase();
    myGender = me && me === girlEmail ? "girl" : "boy";
    currentQuoteTab = myGender;

    const tabWrap = document.getElementById("quoteTabWrap");
    if (tabWrap) tabWrap.classList.add("hidden");
    const titleEl = document.getElementById("quoteConfigTitle");
    if (titleEl) titleEl.textContent = (myGender === "girl" ? window.CONFIG.girlName : window.CONFIG.boyName) + "（你）的互动话语";

    try {
        const { data, error } = await window.sb.from("character_quotes").select("id,character,text,created_at").order("id", { ascending: true });
        if (error) { console.warn("加载话语失败:", error.message); renderQuoteList(); return; }
        boyDbQuotes = (data || []).filter(q => q.character === "boy").map(q => q.text);
        girlDbQuotes = (data || []).filter(q => q.character === "girl").map(q => q.text);
        window.boyDbQuotes = boyDbQuotes;
        window.girlDbQuotes = girlDbQuotes;
        renderQuoteList();
    } catch (e) { console.warn("加载话语异常:", e); renderQuoteList(); }
}

function switchQuoteTab(tab) {
    currentQuoteTab = tab;
    const isBoy = tab === "boy";
    document.getElementById("quoteTabBoy").className = "flex-1 py-2 rounded-lg font-semibold transition " + (isBoy ? "bg-love text-white" : "bg-rose-100 text-love");
    document.getElementById("quoteTabGirl").className = "flex-1 py-2 rounded-lg font-semibold transition " + (!isBoy ? "bg-love text-white" : "bg-rose-100 text-love");
    renderQuoteList();
}

function renderQuoteList() {
    const list = document.getElementById("quoteList");
    const pool = currentQuoteTab === "boy" ? boyDbQuotes : girlDbQuotes;
    if (!pool.length) {
        list.innerHTML = '<div class="text-center text-gray-400 py-6">暂无自定义话语，将使用默认话语</div>';
        return;
    }
    list.innerHTML = pool.map((text, i) => `
        <div class="flex items-center justify-between bg-rose-50 rounded-lg px-3 py-2">
            <span class="text-sm text-gray-700 flex-1 truncate">${text.replace(/</g, "&lt;")}</span>
            <button onclick="deleteQuote(${i})" class="del-btn ml-2" style="background:#ef4444;color:#fff;" title="删除">
                <i class="fa fa-trash-o" style="font-size:11px;"></i>
            </button>
        </div>
    `).join("");
}

async function addQuote() {
    if (_isAddingQuote) return;
    const input = document.getElementById("quoteInput");
    const text = input.value.trim();
    if (!text) return;
    _isAddingQuote = true;
    try {
        const { error } = await window.sb.from("character_quotes").insert({ character: currentQuoteTab, text });
        if (error) { alert("添加失败：" + error.message); return; }
        if (typeof window.sendNotification === "function") {
            window.sendNotification("quote", "💬 添加了互动话语：" + (text.length > 20 ? text.slice(0,20) + "..." : text));
        }
        input.value = "";
        await loadCharacterQuotes();
    } catch (e) { alert("添加异常：" + e.message); }
    finally { _isAddingQuote = false; }
}

async function deleteQuote(index) {
    const pool = currentQuoteTab === "boy" ? boyDbQuotes : girlDbQuotes;
    const text = pool[index];
    if (!text) return;
    if (!confirm(`删除"${text}"？`)) return;
    try {
        const { error } = await window.sb.from("character_quotes").delete().eq("character", currentQuoteTab).eq("text", text);
        if (error) { alert("删除失败：" + error.message); return; }
        await loadCharacterQuotes();
    } catch (e) { alert("删除异常：" + e.message); }
}

window.boyDbQuotes = boyDbQuotes;
window.girlDbQuotes = girlDbQuotes;
window.currentQuoteTab = currentQuoteTab;
window.myGender = myGender;
window.loadCharacterQuotes = loadCharacterQuotes;
window.switchQuoteTab = switchQuoteTab;
window.renderQuoteList = renderQuoteList;
window.addQuote = addQuote;
window.deleteQuote = deleteQuote;

// =====================================================
// OpenList / 百度网盘配置
// =====================================================

const OPENLIST_CONFIG_KEYS = [
    { key: 'openlist_base_url',   var: '_openlistBaseUrl' },
    { key: 'openlist_username',   var: '_openlistUsername' },
    { key: 'openlist_password',   var: '_openlistPassword' },
    { key: 'openlist_mount_path', var: '_openlistMountPath' },
    { key: 'openlist_as_task',    var: '_openlistAsTask' }
];

async function saveOpenListConfig() {
    const baseUrl = document.getElementById('openlistBaseUrlInput').value.trim();
    const username = document.getElementById('openlistUserInput').value.trim();
    const password = document.getElementById('openlistPassInput').value;
    const mountPath = document.getElementById('openlistMountPathInput').value.trim();
    const asTask = document.getElementById('openlistAsTaskInput').checked;

    if (!baseUrl || !username) {
        alert('请至少填写 OpenList 服务地址和用户名');
        return;
    }

    const configs = [
        { key: 'openlist_base_url',   value: baseUrl },
        { key: 'openlist_username',   value: username },
        { key: 'openlist_password',   value: password },
        { key: 'openlist_mount_path', value: mountPath },
        { key: 'openlist_as_task',    value: asTask ? '1' : '0' }
    ];

    try {
        for (const c of configs) {
            const { error } = await window.sb.from('app_config')
                .upsert({ config_key: c.key, config_value: c.value }, { onConflict: 'config_key' });
            if (error) throw new Error(`保存 ${c.key} 失败：${error.message}`);
        }

        // 更新全局变量
        window._openlistBaseUrl = baseUrl;
        window._openlistUsername = username;
        window._openlistPassword = password;
        window._openlistMountPath = mountPath;
        window._openlistAsTask = asTask;

        alert('✅ OpenList 配置已保存');
    } catch (e) {
        alert('保存失败：' + e.message);
    }
}

async function loadOpenListConfigForm() {
    try {
        const keys = OPENLIST_CONFIG_KEYS.map(k => k.key);
        const { data, error } = await window.sb.from('app_config')
            .select('config_key, config_value')
            .in('config_key', keys);
        if (error) throw error;

        const map = {};
        (data || []).forEach(r => map[r.config_key] = r.config_value);

        // 设置全局变量
        window._openlistBaseUrl = map.openlist_base_url || '';
        window._openlistUsername = map.openlist_username || '';
        window._openlistPassword = map.openlist_password || '';
        window._openlistMountPath = map.openlist_mount_path || '';
        window._openlistAsTask = map.openlist_as_task === '1';

        // 填充表单
        if (document.getElementById('openlistBaseUrlInput'))
            document.getElementById('openlistBaseUrlInput').value = window._openlistBaseUrl;
        if (document.getElementById('openlistUserInput'))
            document.getElementById('openlistUserInput').value = window._openlistUsername;
        if (document.getElementById('openlistPassInput'))
            document.getElementById('openlistPassInput').value = window._openlistPassword;
        if (document.getElementById('openlistMountPathInput'))
            document.getElementById('openlistMountPathInput').value = window._openlistMountPath;
        if (document.getElementById('openlistAsTaskInput'))
            document.getElementById('openlistAsTaskInput').checked = window._openlistAsTask;
    } catch (e) {
        console.warn('[Config] 加载 OpenList 配置失败:', e);
    }
}

async function testOpenListConnection() {
    const resultEl = document.getElementById('openlistTestResult');
    resultEl.className = 'text-xs text-center mt-2 py-2 rounded-lg';
    resultEl.classList.remove('hidden');
    resultEl.style.background = '#f3f4f6';
    resultEl.style.color = '#6b7280';
    resultEl.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 正在测试连接...';

    const baseUrl = document.getElementById('openlistBaseUrlInput').value.trim().replace(/\/$/, '');
    const username = document.getElementById('openlistUserInput').value.trim();
    const password = document.getElementById('openlistPassInput').value;
    const mountPath = document.getElementById('openlistMountPathInput').value.trim() || '/';

    if (!baseUrl || !username) {
        resultEl.style.background = '#fef2f2';
        resultEl.style.color = '#dc2626';
        resultEl.innerHTML = '❌ 请先填写服务地址和用户名';
        return;
    }

    try {
        // 1. 测试登录
        const loginResp = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const loginData = await loginResp.json();
        if (loginData.code !== 200 || !loginData.data || !loginData.data.token) {
            throw new Error(loginData.message || '登录失败');
        }
        const token = loginData.data.token;

        // 2. 测试列出挂载路径
        const testPath = mountPath.startsWith('/') ? mountPath : '/' + mountPath;
        const listResp = await fetch(`${baseUrl}/api/fs/list?path=${encodeURIComponent(testPath)}`, {
            headers: { 'Authorization': token }
        });
        const listData = await listResp.json();
        if (listData.code !== 200) {
            throw new Error('访问挂载路径失败：' + (listData.message || '路径不存在或无权限'));
        }

        resultEl.style.background = '#ecfdf5';
        resultEl.style.color = '#059669';
        const count = (listData.data && listData.data.content) ? listData.data.content.length : 0;
        resultEl.innerHTML = `✅ 连接成功！目录下共 ${count} 个文件/文件夹`;
    } catch (e) {
        console.warn('[Config] OpenList 连接测试失败:', e);
        resultEl.style.background = '#fef2f2';
        resultEl.style.color = '#dc2626';
        resultEl.innerHTML = '❌ 连接失败：' + (e.message || e) +
            '<br><span class="text-[10px]">提示：请确认 OpenList 已启动，并且 CORS 已配置允许当前域名</span>';
    }
}

window.saveOpenListConfig = saveOpenListConfig;
window.loadOpenListConfigForm = loadOpenListConfigForm;
window.testOpenListConnection = testOpenListConnection;
