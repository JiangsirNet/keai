/**
 * 飞机大战 · 独立页面分数入库
 *
 * 从情侣空间「游戏」页直接跳转到 plane-master/index.html 后，本页面已脱离主应用，
 * 无法再通过 postMessage 把分数交给父页面处理。因此这里自建 Supabase 客户端，
 * 在游戏结束时把分数写入 game_scores(game='plane')，并同步情侣排行榜所需的站内通知，
 * 完整复刻原先由主应用 game.js（savePlaneScore）+ notifications.js（sendNotification）承担的逻辑。
 *
 * 依赖：index.html 中先行加载 @supabase/supabase-js（必需）与 emailjs-com（可选，用于超越纪录时发邮件）。
 * 暴露：window.savePlaneScore(score) —— 由 js/main.js 的 endGame() 调用。
 * 鉴权：与主应用同源，Supabase 登录态存于 localStorage，跳转后自动沿用，无需重新登录。
 */
(function () {
    // 与主应用 js/config.js 保持一致的连接信息（publishable 公钥，可安全暴露于前端）
    var SUPABASE_URL = "https://fccsjbvkfllapyoozuvf.supabase.co";
    var SUPABASE_ANON_KEY = "sb_publishable_A3W8wYMbB-6pABB0-e0vkA_E-VMsJ4n";

    if (!window.supabase || !window.supabase.createClient) {
        console.warn("[plane-score] 未检测到 supabase-js，分数将无法入库");
        return;
    }
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    var _saving = false; // 防止同一局重复入库

    // 从 app_config 读取情侣昵称/邮箱及邮件配置（与主应用 auth.js loadConfig 同源）
    async function loadConfig() {
        var cfg = {
            boyName: "他", girlName: "她", boyEmail: "", girlEmail: "",
            emailServiceId: "", emailTemplateId: "", emailPublicKey: ""
        };
        try {
            var res = await sb.from("app_config").select("config_key, config_value");
            var map = {};
            (res.data || []).forEach(function (i) { map[i.config_key] = i.config_value; });
            if (map.boy_name) cfg.boyName = map.boy_name;
            if (map.girl_name) cfg.girlName = map.girl_name;
            if (map.boy_email) cfg.boyEmail = map.boy_email;
            if (map.girl_email) cfg.girlEmail = map.girl_email;
            if (map.emailjs_service_id) cfg.emailServiceId = map.emailjs_service_id;
            if (map.emailjs_template_id) cfg.emailTemplateId = map.emailjs_template_id;
            if (map.emailjs_public_key) cfg.emailPublicKey = map.emailjs_public_key;
        } catch (e) {
            console.warn("[plane-score] 读取配置失败:", e);
        }
        return cfg;
    }

    window.savePlaneScore = async function (score) {
        score = parseInt(score, 10) || 0;
        if (score <= 0 || _saving) return;
        _saving = true;
        try {
            var userRes = await sb.auth.getUser();
            var user = userRes && userRes.data && userRes.data.user;
            if (!user) { console.warn("[plane-score] 未登录，跳过入库"); return; }

            var myUserId = user.id;
            var myEmail = (user.email || "").toLowerCase().trim();
            var cfg = await loadConfig();
            var isGirl = !!myEmail && myEmail === (cfg.girlEmail || "").toLowerCase().trim();
            var myNickname = isGirl ? cfg.girlName : cfg.boyName;

            // 查询双方最高分，判断是否超越对方的最高纪录
            var bestRes = await sb.from("game_scores")
                .select("user_id, score")
                .eq("game", "plane")
                .order("score", { ascending: false })
                .limit(100);
            var partnerBest = 0;
            (bestRes.data || []).forEach(function (r) {
                if (r.user_id !== myUserId && r.score > partnerBest) partnerBest = r.score;
            });
            var beatPartner = partnerBest > 0 && score > partnerBest;

            // 分数入库
            var insRes = await sb.from("game_scores")
                .insert({ game: "plane", user_id: myUserId, nickname: myNickname, score: score });
            if (insRes.error) throw insRes.error;

            // 站内通知：每局都写入 notifications 表（对方铃铛实时收到）
            var body = beatPartner
                ? ("✈️ 飞机大战：" + score + " 分，超越 TA 的最高纪录 " + partnerBest + "！")
                : ("✈️ 飞机大战得分：" + score);
            var boyEmail = (cfg.boyEmail || "").toLowerCase().trim();
            var girlEmail = (cfg.girlEmail || "").toLowerCase().trim();
            var toEmail = "", fromName = cfg.boyName;
            if (myEmail && myEmail === boyEmail) { toEmail = girlEmail; fromName = cfg.boyName; }
            else if (myEmail && myEmail === girlEmail) { toEmail = boyEmail; fromName = cfg.girlName; }

            if (toEmail) {
                try {
                    await sb.from("notifications").insert({
                        type: "game",
                        content: fromName + " " + body,
                        from_email: myEmail,
                        to_email: toEmail,
                        is_read: false
                    });
                } catch (e) { console.warn("[plane-score] 站内通知写入失败:", e); }

                // 邮件仅在「超越对方纪录」且用户在设置页开启邮件通知时发送
                var emailEnabled = localStorage.getItem("notify_email_enabled") !== "0";
                if (beatPartner && emailEnabled &&
                    cfg.emailServiceId && cfg.emailTemplateId && cfg.emailPublicKey && window.emailjs) {
                    try {
                        window.emailjs.init(cfg.emailPublicKey);
                        await window.emailjs.send(cfg.emailServiceId, cfg.emailTemplateId, {
                            to_email: toEmail,
                            from_name: fromName,
                            message: body,
                            notification_type: "game",
                            app_title: "情侣空间"
                        });
                    } catch (e) { console.warn("[plane-score] 邮件发送失败:", e); }
                }
            }
            console.log("[plane-score] 分数已入库:", score, beatPartner ? "(超越对方纪录)" : "");
        } catch (e) {
            console.warn("[plane-score] 分数保存失败:", e);
        } finally {
            _saving = false;
        }
    };
})();
