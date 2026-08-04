// ==================== 日历 / 打卡 / 代办 / 纪念日 ====================
let calCurrent = new Date();
let calSelectedDate = null;
let calCheckins = [];
let calTodos = [];
let calMemos = [];

const CAL_MONTHS = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];

function fmtCalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function initCalendar() {
    calSelectedDate = fmtCalDate(new Date());
    document.getElementById("calSelectedDate").innerText = calSelectedDate;
    refreshCalendar();
}

async function refreshCalendar() {
    if (!calSelectedDate) calSelectedDate = fmtCalDate(new Date());
    document.getElementById("calTitle").innerText =
        `${calCurrent.getFullYear()}年 ${CAL_MONTHS[calCurrent.getMonth()]}`;

    const y = calCurrent.getFullYear();
    const m = calCurrent.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    try {
        const [cRes, tRes, mRes] = await Promise.all([
            window.sb.from("checkins").select("date,username").gte("date", start).lte("date", end),
            window.sb.from("todos").select("id,date,content,done,username").gte("date", start).lte("date", end),
            window.sb.from("memorial_day").select("*")
        ]);
        calCheckins = cRes.data || [];
        calTodos = tRes.data || [];
        calMemos = mRes.data || [];
    } catch (e) {
        console.warn("加载日历数据失败:", e);
        calCheckins = []; calTodos = []; calMemos = [];
    }

    const checkinMap = {};
    const checkinNamesMap = {};
    calCheckins.forEach(c => {
        const u = (c.username || "").toLowerCase();
        if (!checkinMap[c.date]) checkinMap[c.date] = new Set();
        checkinMap[c.date].add(u);
        let name = "匿名";
        if (u === (window.CONFIG.boyEmail || "").toLowerCase()) name = window.CONFIG.boyName;
        else if (u === (window.CONFIG.girlEmail || "").toLowerCase()) name = window.CONFIG.girlName;
        if (!checkinNamesMap[c.date]) checkinNamesMap[c.date] = [];
        if (!checkinNamesMap[c.date].includes(name)) checkinNamesMap[c.date].push(name);
    });
    const todoMap = {};
    const todoTitlesMap = {};
    calTodos.forEach(t => {
        todoMap[t.date] = true;
        if (!todoTitlesMap[t.date]) todoTitlesMap[t.date] = [];
        todoTitlesMap[t.date].push(t.content);
    });
    const memoMap = {};
    calMemos.forEach(mo => {
        const day = mo.day || "";
        const parts = day.split("-");
        if (parts.length < 3) return;
        const mm = parseInt(parts[1]);
        const dd = parseInt(parts[2]);
        const isLunar = mo.is_lunar === true || mo.is_lunar === 'true' || mo.is_lunar === 1 || mo.is_lunar === '1' || mo.is_lunar === 't';
        if (isLunar && window.Lunar) {
            try {
                const lunar = window.Lunar.fromYmd(y, mm, dd);
                const solar = lunar.getSolar();
                if (solar.getYear() === y && (solar.getMonth() - 1) === m) {
                    const solarMd = `${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
                    if (!memoMap[solarMd]) memoMap[solarMd] = [];
                    memoMap[solarMd].push(mo.title + "(农历)");
                }
            } catch (e) {
                console.warn("农历转换失败:", mo, e);
            }
        } else {
            const md = day.length >= 10 ? day.slice(5) : day;
            if (!memoMap[md]) memoMap[md] = [];
            memoMap[md].push(mo.title);
        }
    });
    const start2 = window.CONFIG.loveStart;
    const startStr = fmtCalDate(start2);
    const startMd = startStr.slice(5);
    if (!memoMap[startMd]) memoMap[startMd] = [];
    memoMap[startMd].push("相恋起始日");

    const grid = document.getElementById("calGrid");
    grid.innerHTML = "";
    const todayStr = fmtCalDate(new Date());
    for (let i = firstDay - 1; i >= 0; i--) {
        grid.innerHTML += `<div class="cal-cell muted">${prevDays - i}</div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const classes = ["cal-cell"];
        if (dateStr === todayStr) classes.push("today");
        if (dateStr === calSelectedDate) classes.push("selected");

        let dots = "";
        const set = checkinMap[dateStr];
        const checkinNames = checkinNamesMap[dateStr] || [];
        if (set) {
            if (set.has((window.CONFIG.boyEmail || "").toLowerCase())) dots += `<i class="cal-dot boy"></i>`;
            if (set.has((window.CONFIG.girlEmail || "").toLowerCase())) dots += `<i class="cal-dot girl"></i>`;
            set.forEach(u => {
                if (u && u !== (window.CONFIG.boyEmail || "").toLowerCase() && u !== (window.CONFIG.girlEmail || "").toLowerCase()) {
                    dots += `<i class="cal-dot"></i>`;
                }
            });
        }
        if (todoMap[dateStr]) dots += `<i class="cal-dot todo"></i>`;
        const dateMd = dateStr.slice(5);
        if (memoMap[dateMd]) dots += `<i class="cal-dot memo"></i>`;
        const dotsHtml = dots ? `<div class="cal-dots">${dots}</div>` : "";

        const memoTitles = memoMap[dateMd] || [];
        const todoTitles = todoTitlesMap[dateStr] || [];
        let labelHtml = "";
        memoTitles.forEach(t => {
            labelHtml += `<div class="cal-label memo-label">${t}</div>`;
        });
        if (checkinNames.length) {
            labelHtml += `<div class="cal-label checkin-label">${checkinNames.join("·")}打卡</div>`;
        }
        todoTitles.forEach(t => {
            labelHtml += `<div class="cal-label todo-label">${t}</div>`;
        });

        const titleParts = [];
        if (memoTitles.length) titleParts.push("纪念日：" + memoTitles.join("、"));
        if (checkinNames.length) titleParts.push("打卡：" + checkinNames.join("、"));
        if (todoTitles.length) titleParts.push("代办(" + todoTitles.length + ")：" + todoTitles.join("、"));
        const titleAttr = titleParts.length ? ` title="${titleParts.join('&#10;')}"` : "";

        grid.innerHTML += `<div class="${classes.join(" ")}" onclick="selectCalDate('${dateStr}')"${titleAttr}><span>${d}</span>${labelHtml}${dotsHtml}</div>`;
    }
    const totalCells = firstDay + daysInMonth;
    const tail = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= tail; i++) {
        grid.innerHTML += `<div class="cal-cell muted">${i}</div>`;
    }

    updateCheckinBtn();
    renderTodos();
}

function calPrevMonth() {
    calCurrent = new Date(calCurrent.getFullYear(), calCurrent.getMonth() - 1, 1);
    refreshCalendar();
}
function calNextMonth() {
    calCurrent = new Date(calCurrent.getFullYear(), calCurrent.getMonth() + 1, 1);
    refreshCalendar();
}
function selectCalDate(dateStr) {
    calSelectedDate = dateStr;
    const [yy, mm] = dateStr.split("-").map(Number);
    if (calCurrent.getFullYear() !== yy || calCurrent.getMonth() !== mm - 1) {
        calCurrent = new Date(yy, mm - 1, 1);
    }
    refreshCalendar();
}

async function toggleCheckin() {
    const me = window.myRpsEmail || "";
    if (!me) { alert("请先登录"); return; }
    if (!calSelectedDate) return;
    const todayStr = fmtCalDate(new Date());
    if (calSelectedDate !== todayStr) {
        alert("只能在当天打卡哦~\n已选日期：" + calSelectedDate + "\n今天：" + todayStr);
        return;
    }
    const btn = document.getElementById("checkinBtn");
    btn.disabled = true;
    try {
        const { data } = await window.sb.from("checkins")
            .select("id").eq("date", calSelectedDate).eq("username", me);
        if (data && data.length > 0) {
            if (!confirm("取消今日打卡？")) { btn.disabled = false; return; }
            await window.sb.from("checkins").delete()
                .eq("date", calSelectedDate).eq("username", me);
        } else {
            await window.sb.from("checkins").insert({ date: calSelectedDate, username: me });
        }
        refreshCalendar();
    } catch (e) {
        alert("打卡失败：" + (e.message || "请稍后重试\n提示：需先在Supabase创建 checkins 表"));
    } finally {
        btn.disabled = false;
    }
}

function updateCheckinBtn() {
    const me = (window.myRpsEmail || "").toLowerCase();
    const todaySet = calCheckins.filter(c => c.date === calSelectedDate)
        .map(c => (c.username || "").toLowerCase());
    const checked = todaySet.includes(me);
    const btnText = document.getElementById("checkinBtnText");
    const btn = document.getElementById("checkinBtn");
    const todayStr = fmtCalDate(new Date());
    const isToday = calSelectedDate === todayStr;
    btn.disabled = !isToday;
    btn.style.opacity = isToday ? "1" : "0.5";
    btn.style.cursor = isToday ? "pointer" : "not-allowed";
    if (!isToday) {
        btnText.innerText = "仅当天可打卡";
        btn.classList.remove("bg-loveDark");
        btn.querySelector("i").className = "fa fa-ban";
    } else if (checked) {
        btnText.innerText = "已打卡";
        btn.classList.add("bg-loveDark");
        btn.querySelector("i").className = "fa fa-check";
    } else {
        btnText.innerText = "打卡";
        btn.classList.remove("bg-loveDark");
        btn.querySelector("i").className = "fa fa-check-circle";
    }
    const names = todaySet.map(u => {
        if (u === (window.CONFIG.boyEmail || "").toLowerCase()) return window.CONFIG.boyName;
        if (u === (window.CONFIG.girlEmail || "").toLowerCase()) return window.CONFIG.girlName;
        return u || "匿名";
    });
    document.getElementById("calSelectedDate").innerText =
        calSelectedDate + (names.length ? `  (${names.join("、")} 已打卡)` : "");
}

async function addTodo() {
    const input = document.getElementById("todoInput");
    const content = input.value.trim();
    if (!content) return;
    const me = window.myRpsEmail || "";
    if (!me) { alert("请先登录"); return; }
    if (!calSelectedDate) return alert("请先选择日期");
    try {
        const { error } = await window.sb.from("todos").insert({
            date: calSelectedDate, content, username: me, done: false
        });
        if (error) throw error;
        input.value = "";
        refreshCalendar();
    } catch (e) {
        alert("添加失败：" + (e.message || "请稍后重试\n提示：需先在Supabase创建 todos 表"));
    }
}

async function toggleTodo(id, done) {
    try {
        await window.sb.from("todos").update({ done: !done }).eq("id", id);
        refreshCalendar();
    } catch (e) {
        alert("更新失败：" + (e.message || ""));
    }
}

async function deleteTodo(id) {
    if (!confirm("删除该代办事项？")) return;
    try {
        await window.sb.from("todos").delete().eq("id", id);
        refreshCalendar();
    } catch (e) {
        alert("删除失败：" + (e.message || ""));
    }
}

function renderTodos() {
    const wrap = document.getElementById("todoList");
    const list = calTodos.filter(t => t.date === calSelectedDate);
    if (!list.length) {
        wrap.innerHTML = `<div class="text-center text-gray-400 text-sm py-2">该日期暂无代办</div>`;
        return;
    }
    wrap.innerHTML = list.map(t => {
        let who = t.username || "匿名";
        if ((t.username || "").toLowerCase() === (window.CONFIG.boyEmail || "").toLowerCase()) who = window.CONFIG.boyName;
        else if ((t.username || "").toLowerCase() === (window.CONFIG.girlEmail || "").toLowerCase()) who = window.CONFIG.girlName;
        return `<div class="todo-item ${t.done ? "done" : ""}">
            <div class="todo-checkbox ${t.done ? "checked" : ""}" onclick="toggleTodo(${t.id}, ${t.done})">
                ${t.done ? '<i class="fa fa-check"></i>' : ''}
            </div>
            <span class="todo-text flex-1 break-all">${(t.content || "").replace(/</g, "&lt;")}</span>
            <span class="text-xs text-gray-400">${who}</span>
            <i class="fa fa-trash todo-del" onclick="deleteTodo(${t.id})"></i>
        </div>`;
    }).join("");
}

// ============ 重要纪念日弹窗 ============
function openAnnivModal() {
    document.getElementById("annivModal").classList.remove("hidden");
    loadAnnivList();
}
function closeAnnivModal() {
    document.getElementById("annivModal").classList.add("hidden");
}
function onAnnivLunarChange() {
    const checked = document.getElementById("annivLunar").checked;
    document.getElementById("annivLunarHint").classList.toggle("hidden", !checked);
}

async function loadAnnivList() {
    const wrap = document.getElementById("annivList");
    wrap.innerHTML = `<div class="text-center text-gray-400 py-4">加载中...</div>`;
    try {
        const { data } = await window.sb.from("memorial_day").select("*");
        const list = data || [];
        const startStr = fmtCalDate(window.CONFIG.loveStart);
        const all = [{ title: "相恋起始日", day: startStr, is_lunar: false, _builtin: true }, ...list];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        all.sort((a, b) => daysUntil(a.day, today, a.is_lunar) - daysUntil(b.day, today, b.is_lunar));
        if (!all.length) {
            wrap.innerHTML = `<div class="text-center text-gray-400 py-4">还没有纪念日</div>`;
            return;
        }
        wrap.innerHTML = all.map(item => {
            const isLunar = item.is_lunar === true || item.is_lunar === 'true' || item.is_lunar === 1 || item.is_lunar === '1' || item.is_lunar === 't';
            const days = daysUntil(item.day, today, isLunar);
            const text = days === 0 ? "今天" : (days > 0 ? `还有 ${days} 天` : `已过 ${-days} 天`);
            const color = days === 0 ? "text-love" : (days > 0 ? "text-gray-500" : "text-gray-400");
            const delBtn = item._builtin ? "" :
                `<i class="fa fa-trash text-gray-400 hover:text-red-500 cursor-pointer ml-2" onclick="delAnniv('${item.id}')"></i>`;
            let dateDisplay = item.day;
            let badge = "";
            if (isLunar) {
                const cn = lunarToChinese(item.day);
                const solarThisYear = lunarToSolarThisYear(item.day, today.getFullYear());
                dateDisplay = `农历 ${cn}` + (solarThisYear ? `（今年 ${solarThisYear}）` : "");
                badge = `<span class="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded ml-1">农历</span>`;
            } else {
                badge = `<span class="text-xs bg-rose-100 text-love px-1.5 py-0.5 rounded ml-1">公历</span>`;
            }
            return `<div class="anniv-item">
                <div>
                    <p class="font-semibold text-gray-800">${item.title}${badge}</p>
                    <p class="text-xs text-gray-400">${dateDisplay}</p>
                </div>
                <div class="flex items-center">
                    <span class="anniv-days ${color}">${text}</span>
                    ${delBtn}
                </div>
            </div>`;
        }).join("");
    } catch (e) {
        wrap.innerHTML = `<div class="text-center text-gray-400 py-4">加载失败</div>`;
    }
}

function daysUntil(dayStr, today, isLunar) {
    if (isLunar && window.Lunar) {
        const parts = dayStr.split("-");
        const mm = parseInt(parts[parts.length - 2]);
        const dd = parseInt(parts[parts.length - 1]);
        const tryYears = [today.getFullYear(), today.getFullYear() + 1, today.getFullYear() - 1];
        for (const ty of tryYears) {
            try {
                const lunar = window.Lunar.fromYmd(ty, mm, dd);
                const solar = lunar.getSolar();
                const solarDate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
                if (solarDate >= today) {
                    return Math.round((solarDate - today) / (1000 * 60 * 60 * 24));
                }
            } catch (e) {}
        }
        return 0;
    }
    const [y, m, d] = dayStr.split("-").map(Number);
    let thisYear = new Date(today.getFullYear(), m - 1, d);
    if (thisYear < today) thisYear = new Date(today.getFullYear() + 1, m - 1, d);
    const diff = Math.round((thisYear - today) / (1000 * 60 * 60 * 24));
    return diff;
}

function lunarToChinese(dayStr) {
    if (!window.Lunar) return dayStr;
    try {
        const parts = dayStr.split("-");
        const mm = parseInt(parts[parts.length - 2]);
        const dd = parseInt(parts[parts.length - 1]);
        const lunar = window.Lunar.fromYmd(2000, mm, dd);
        return lunar.getMonthInChinese() + "月" + lunar.getDayInChinese();
    } catch (e) {
        return dayStr;
    }
}

function lunarToSolarThisYear(dayStr, year) {
    if (!window.Lunar) return null;
    try {
        const parts = dayStr.split("-");
        const mm = parseInt(parts[parts.length - 2]);
        const dd = parseInt(parts[parts.length - 1]);
        const lunar = window.Lunar.fromYmd(year, mm, dd);
        const solar = lunar.getSolar();
        return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
    } catch (e) {
        return null;
    }
}

async function addAnniv() {
    const title = document.getElementById("annivTitle").value.trim();
    const day = document.getElementById("annivDate").value;
    const isLunar = document.getElementById("annivLunar").checked;
    if (!title || !day) return alert("请填写完整");
    try {
        const { data, error } = await window.sb.from("memorial_day").insert({ title, day, is_lunar: isLunar }).select();
        if (error) throw error;
        if (isLunar && (!data || !data[0] || data[0].is_lunar === undefined || data[0].is_lunar === null)) {
            alert("⚠️ 农历标识未保存成功！\n\n请在 Supabase SQL Editor 执行：\nalter table memorial_day add column if not exists is_lunar boolean default false;\n\n然后重新添加该纪念日。");
            return;
        }
        console.log("[添加纪念日] 写入结果:", data);
        document.getElementById("annivTitle").value = "";
        document.getElementById("annivDate").value = "";
        document.getElementById("annivLunar").checked = false;
        document.getElementById("annivLunarHint").classList.add("hidden");
        loadAnnivList();
        refreshCalendar();
    } catch (e) {
        alert("保存失败：" + (e.message || "请稍后重试\n提示：需先在Supabase创建 memorial_day 表，并添加 is_lunar 字段"));
    }
}

async function delAnniv(id) {
    if (!confirm("删除该纪念日？")) return;
    try {
        await window.sb.from("memorial_day").delete().eq("id", id);
        loadAnnivList();
        refreshCalendar();
    } catch (e) {
        alert("删除失败：" + (e.message || ""));
    }
}

// ====== 导出公共 API ======
window.calCurrent = calCurrent;
window.calSelectedDate = calSelectedDate;
window.calCheckins = calCheckins;
window.calTodos = calTodos;
window.calMemos = calMemos;
window.CAL_MONTHS = CAL_MONTHS;
window.fmtCalDate = fmtCalDate;
window.initCalendar = initCalendar;
window.refreshCalendar = refreshCalendar;
window.calPrevMonth = calPrevMonth;
window.calNextMonth = calNextMonth;
window.selectCalDate = selectCalDate;
window.toggleCheckin = toggleCheckin;
window.updateCheckinBtn = updateCheckinBtn;
window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.renderTodos = renderTodos;
window.openAnnivModal = openAnnivModal;
window.closeAnnivModal = closeAnnivModal;
window.onAnnivLunarChange = onAnnivLunarChange;
window.loadAnnivList = loadAnnivList;
window.daysUntil = daysUntil;
window.lunarToChinese = lunarToChinese;
window.lunarToSolarThisYear = lunarToSolarThisYear;
window.addAnniv = addAnniv;
window.delAnniv = delAnniv;