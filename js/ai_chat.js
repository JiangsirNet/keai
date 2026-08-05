// AI 聊天助手（智谱 AI）
(function () {
    const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    const DEFAULT_MODEL = "glm-4.7-flash";
    const DEFAULT_SYSTEM_PROMPT = "你是我们的恋爱小助手，温柔、贴心、偶尔幽默。请用中文简短回复，像朋友一样。";

    let apiKey = "";
    let model = DEFAULT_MODEL;
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let isSending = false;

    // 聊天记录持久化（localStorage）
    const HISTORY_KEY = "ai_chat_history_settings";
    function loadHistory() {
        try {
            const saved = localStorage.getItem(HISTORY_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    }
    function saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(conversationHistory));
        } catch (e) { console.warn("保存聊天记录失败:", e); }
    }
    let conversationHistory = loadHistory();

    const QUICK_TOPICS = [
        "帮我们想一个浪漫的约会",
        "吵架了怎么哄对方",
        "推荐一部适合情侣看的电影",
        "写一段情话",
        "给我们的关系一些建议"
    ];

    // 从 window（auth.js loadConfig 预加载）或数据库加载配置
    async function loadAiConfig() {
        try {
            // 优先使用 loadConfig 预加载到 window 的值
            if (window._aiApiKey) apiKey = window._aiApiKey;
            if (window._aiModel) model = window._aiModel;
            if (window._aiSystemPrompt) systemPrompt = window._aiSystemPrompt;

            // 若缺失则从数据库读取
            if (!apiKey || !model || !systemPrompt) {
                const { data, error } = await window.sb
                    .from("app_config")
                    .select("config_key, config_value")
                    .in("config_key", ["zhipu_api_key", "zhipu_model", "zhipu_system_prompt"]);
                if (error) { console.warn("读取 AI 配置失败:", error.message); return; }
                const map = {};
                (data || []).forEach(item => map[item.config_key] = item.config_value);
                if (!apiKey && map.zhipu_api_key) apiKey = map.zhipu_api_key;
                if (!model && map.zhipu_model) model = map.zhipu_model;
                if (!systemPrompt && map.zhipu_system_prompt) systemPrompt = map.zhipu_system_prompt;
            }

            if (!model) model = DEFAULT_MODEL;
            if (!systemPrompt) systemPrompt = DEFAULT_SYSTEM_PROMPT;

            // 填充表单
            const keyInput = document.getElementById("aiApiKey");
            const modelSelect = document.getElementById("aiModel");
            const promptInput = document.getElementById("aiSystemPrompt");
            if (keyInput) keyInput.value = apiKey ? "●●●●●●" + apiKey.slice(-4) : "";
            if (modelSelect) modelSelect.value = model;
            if (promptInput) promptInput.value = systemPrompt;

            window._aiApiKey = apiKey;
            window._aiModel = model;
            window._aiSystemPrompt = systemPrompt;
        } catch (e) { console.warn("加载 AI 配置异常:", e); }
    }

    function toggleAiSettings() {
        const panel = document.getElementById("aiSettings");
        panel.classList.toggle("hidden");
    }

    function showAiStatus(text, cls = "text-gray-400") {
        const el = document.getElementById("aiStatus");
        if (!el) return;
        el.textContent = text;
        el.className = "text-xs " + cls;
    }

    // 渲染消息
    function appendMessage(role, content) {
        const box = document.getElementById("aiChatBox");
        if (!box) return;
        // 清除占位文字
        const placeholder = box.querySelector(".text-center.text-gray-400");
        if (placeholder) box.innerHTML = "";

        const wrap = document.createElement("div");
        wrap.className = "flex " + (role === "user" ? "justify-end" : "justify-start");

        const bubble = document.createElement("div");
        bubble.className = "max-w-[85%] px-3 py-2 rounded-2xl whitespace-pre-wrap break-words " +
            (role === "user"
                ? "bg-love text-white rounded-br-sm"
                : "bg-white text-gray-700 rounded-bl-sm border border-rose-100");
        bubble.textContent = content;

        wrap.appendChild(bubble);
        box.appendChild(wrap);
        box.scrollTop = box.scrollHeight;
    }

    function renderQuickTopics() {
        const wrap = document.getElementById("aiQuickTopics");
        if (!wrap) return;
        wrap.innerHTML = QUICK_TOPICS.map(t =>
            `<button onclick="window._aiSendTopic('${t}')" class="text-xs px-3 py-1 rounded-full bg-rose-100 text-love hover:bg-love hover:text-white transition">${t}</button>`
        ).join("");
    }

    async function sendAiMessage() {
        const input = document.getElementById("aiChatInput");
        const text = input.value.trim();
        if (!text) return;
        await doSend(text);
    }

    async function doSend(text) {
        if (isSending) return;
        if (!apiKey) {
            alert("请先在 AI 设置中配置 API Key");
            toggleAiSettings();
            return;
        }
        isSending = true;
        const sendBtn = document.getElementById("aiSendBtn");
        if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.6"; }

        appendMessage("user", text);
        const input = document.getElementById("aiChatInput");
        if (input) input.value = "";

        // 加入历史
        conversationHistory.push({ role: "user", content: text });
        saveHistory();
        // 发给 API 的历史限制为最近 20 条，避免上下文过长导致首字延迟
        const MAX_API_HISTORY = 20;
        const recent = conversationHistory.length > MAX_API_HISTORY
            ? conversationHistory.slice(-MAX_API_HISTORY)
            : conversationHistory;
        const messages = [
            { role: "system", content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
            ...recent
        ];

        // 添加 loading 气泡
        const box = document.getElementById("aiChatBox");
        const loadingWrap = document.createElement("div");
        loadingWrap.className = "flex justify-start";
        loadingWrap.innerHTML = `<div class="max-w-[85%] px-3 py-2 rounded-2xl bg-white text-gray-500 text-xs border border-rose-100"><i class="fa fa-spinner fa-spin"></i> 思考中...</div>`;
        box.appendChild(loadingWrap);
        box.scrollTop = box.scrollHeight;

        showAiStatus("AI 正在回复...");

        try {
            const res = await fetch(ZHIPU_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + apiKey
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.8,
                    stream: true
                })
            });

            if (!res.ok) {
                loadingWrap.remove();
                let errMsg = "HTTP " + res.status;
                try { const d = await res.json(); errMsg = d.error?.message || errMsg; } catch (_) {}
                throw new Error(errMsg);
            }

            // 流式读取
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let reply = "";
            let buffer = "";

            // 替换 loading 为流式气泡
            loadingWrap.remove();
            const streamWrap = document.createElement("div");
            streamWrap.className = "flex justify-start";
            const streamBubble = document.createElement("div");
            streamBubble.className = "max-w-[85%] px-3 py-2 rounded-2xl bg-white text-gray-700 rounded-bl-sm border border-rose-100 whitespace-pre-wrap break-words";
            streamBubble.textContent = "";
            streamWrap.appendChild(streamBubble);
            box.appendChild(streamWrap);
            box.scrollTop = box.scrollHeight;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith("data:")) continue;
                    const data = trimmed.slice(5).trim();
                    if (data === "[DONE]") continue;

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content || "";
                        if (delta) {
                            reply += delta;
                            streamBubble.textContent = reply;
                            box.scrollTop = box.scrollHeight;
                        }
                    } catch (e) { /* 忽略解析错误 */ }
                }
            }

            if (!reply) reply = "抱歉，我没听懂，能再说一次吗？";
            conversationHistory.push({ role: "assistant", content: reply });
            saveHistory();
            showAiStatus("");
        } catch (err) {
            loadingWrap.remove();
            appendMessage("assistant", "⚠️ 出错了：" + err.message);
            showAiStatus("发送失败", "text-red-500");
            conversationHistory.pop(); // 回滚 user 消息
        } finally {
            isSending = false;
            if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ""; }
        }
    }

    function clearAiChat() {
        if (!confirm("确定清空对话记录吗？")) return;
        conversationHistory = [];
        try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
        const box = document.getElementById("aiChatBox");
        if (box) {
            box.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">对话已清空，重新开始吧～</div>';
        }
        showAiStatus("");
    }

    // 把 localStorage 里的历史记录渲染回聊天框
    function renderHistory() {
        const box = document.getElementById("aiChatBox");
        if (!box) return;
        if (!conversationHistory || conversationHistory.length === 0) return;
        // 清掉占位文字
        box.innerHTML = "";
        conversationHistory.forEach(msg => {
            appendMessage(msg.role, msg.content);
        });
        box.scrollTop = box.scrollHeight;
    }

    // 初始化：等待配置页 DOM 注入后调用
    function initAiChat() {
        if (!document.getElementById("aiChatBox")) {
            // 重试
            setTimeout(initAiChat, 200);
            return;
        }
        loadAiConfig();
        renderQuickTopics();
        renderHistory();

        // 绑定保存按钮
        const saveBtn = document.getElementById("aiSaveBtn");
        if (saveBtn) saveBtn.addEventListener("click", saveAiAllOptions);
    }

    // 手动保存所有 AI 配置（API Key + 模型 + 系统提示）
    async function saveAiAllOptions() {
        const keyInput = document.getElementById("aiApiKey");
        const modelSelect = document.getElementById("aiModel");
        const promptInput = document.getElementById("aiSystemPrompt");
        const saveBtn = document.getElementById("aiSaveBtn");

        const rawKey = keyInput.value.trim();
        if (!rawKey || rawKey.startsWith("●")) {
            alert("请先输入 API Key（完整值）");
            return;
        }

        const newModel = modelSelect.value;
        const newPrompt = promptInput.value.trim() || DEFAULT_SYSTEM_PROMPT;

        saveBtn.disabled = true;
        const oldHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 保存中';

        try {
            const { error } = await window.sb.from("app_config").upsert([
                { config_key: "zhipu_api_key", config_value: rawKey },
                { config_key: "zhipu_model", config_value: newModel },
                { config_key: "zhipu_system_prompt", config_value: newPrompt }
            ], { onConflict: "config_key" });

            if (error) throw error;

            apiKey = rawKey;
            model = newModel;
            systemPrompt = newPrompt;
            window._aiApiKey = apiKey;
            window._aiModel = model;
            window._aiSystemPrompt = systemPrompt;

            keyInput.value = "●●●●●●" + apiKey.slice(-4);
            showAiStatus("✅ 所有设置已保存", "text-green-500");
            setTimeout(() => showAiStatus(""), 2500);
        } catch (e) {
            alert("保存失败：" + e.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = oldHtml;
        }
    }

    // 暴露到 window
    window.toggleAiSettings = toggleAiSettings;
    window.saveAiApiKey = saveAiAllOptions; // 兼容旧调用
    window.saveAiAllOptions = saveAiAllOptions;
    window.sendAiMessage = sendAiMessage;
    window.clearAiChat = clearAiChat;
    window._aiSendTopic = function (text) { doSend(text); };
    window.initAiChat = initAiChat;
    window._aiConversationHistory = conversationHistory;

    // DOM 就绪即初始化（loader.js 动态注入，DOMContentLoaded 可能已触发）
    (function startWhenReady() {
        if (document.getElementById("aiChatBox")) {
            initAiChat();
        } else {
            setTimeout(startWhenReady, 200);
        }
    })();
})();
