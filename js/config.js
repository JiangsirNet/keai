// =====================【修改这里】=====================
// 以下配置（除 SUPABASE_URL 和 SUPABASE_ANON_KEY 外）均从数据库 app_config 表读取
const CONFIG = {
    SUPABASE_URL: "https://fccsjbvkfllapyoozuvf.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_A3W8wYMbB-6pABB0-e0vkA_E-VMsJ4n",
    boyName: "他",
    girlName: "她",
    boyEmail: "",
    girlEmail: "",
    loveStart: new Date(2026, 5, 30)
};
// =====================================================

const { createClient } = window.supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
let IMGBB_KEY = ""; // 运行登录后从数据库读取
let EMAILJS_SERVICE_ID = "";
let EMAILJS_TEMPLATE_ID = "";
let EMAILJS_PUBLIC_KEY = "";

// 导出到 window 供其他模块使用
window.CONFIG = CONFIG;
window.sb = sb;
window.IMGBB_KEY = IMGBB_KEY;
window.EMAILJS_SERVICE_ID = EMAILJS_SERVICE_ID;
window.EMAILJS_TEMPLATE_ID = EMAILJS_TEMPLATE_ID;
window.EMAILJS_PUBLIC_KEY = EMAILJS_PUBLIC_KEY;