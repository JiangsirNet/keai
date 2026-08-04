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