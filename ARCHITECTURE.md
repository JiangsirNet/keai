# 情侣空间 - 项目架构文档

> 本文档供 AI 助手阅读，帮助理解项目架构、资源加载机制和开发规范。

## 一、项目概述

情侣空间是一个双人互动 Web 应用，功能包括：相册、留言、日志、日历打卡、猜拳游戏、骗子酒馆、Live2D 风格人物形象、宠物动画、音乐播放器、天气组件、背景图自定义等。

## 二、文件结构

```
index.html              — 入口文件（本地，仅3个占位容器，内容全动态生成）
styles.css              — 所有 CSS 样式（本地，不存数据库）
upload.html             — 资源管理工具（本地，5个Tab：上传/编辑/SQL/文档/容器配置）
js/config.js            — Supabase 连接配置（本地，不存数据库）
js/loader.js            — 动态资源加载器（本地，不存数据库）
ARCHITECTURE.md         — 本架构文档，通过 upload.html 上传到数据库动态渲染
partials/               — HTML 片段（本地开发用，通过 upload.html 上传到数据库）
├── login.html          — 登录面板
├── preview.html        — 大图预览弹窗
├── home.html           — 首页（相册/留言）
├── journal.html        — 日志 + 日历打卡 + 纪念日
├── game.html           — 游戏页
└── config.html         — 设置页
js/                     — JS 模块（本地开发用，通过 upload.html 上传到数据库）
├── config_page.js      — 人物话语管理
├── notifications.js    — 通知系统（sendNotification）
├── weather.js          — 天气组件
├── audio.js            — BGM / 音效
├── music.js            — 音乐播放器
├── pets.js             — 宠物动画
├── characters.js       — 人物互动形象
├── home.js             — 首页逻辑
├── journal.js          — 日志逻辑
├── calendar.js         — 日历/打卡/纪念日
├── game.js             — 猜拳/骗子酒馆
├── background.js       — 背景图设置
└── auth.js             — 认证 + 页面初始化（必须最后加载）
```

## 三、资源加载机制

### 本地文件（仅 5 个，不存数据库）

| 文件 | 作用 |
|---|---|
| `index.html` | 入口，仅包含全局元素 + 3 个占位容器，加载 config.js 和 loader.js |
| `styles.css` | 所有 CSS |
| `js/config.js` | Supabase 连接配置，导出 `window.sb`、`window.CONFIG` 等 |
| `js/loader.js` | 从 `app_containers` 生成容器导航，从 `app_assets` 加载 HTML/JS |
| `upload.html` | 资源管理工具（上传/在线编辑/SQL/文档/容器配置） |

### 数据库表：`app_containers`（容器配置表）

存储所有页面容器和导航按钮配置。**新增/修改页面不需要改 index.html，只需改这个表。**

| 字段 | 说明 |
|---|---|
| `container_id` | 容器 DOM id，唯一键（如 `pageHomeContainer`） |
| `page_name` | 页面标识，`showPage(page_name)` 用（全局容器留空） |
| `nav_label` | 导航按钮文字（如 "首页"），全局容器留空 |
| `nav_icon` | 导航按钮 emoji 图标（如 "🏠"） |
| `sort_order` | 排序，数字小的导航按钮排前面、容器先生成 |
| `placement` | `page` = 导航栏中的页面（有按钮）；`global` = 全局容器（登录面板、弹窗等） |
| `is_active` | 是否启用 |

初始默认数据：
```
(placement=global) loginPanelContainer, previewModalContainer
(placement=page)   pageHomeContainer🏠 → pageJournalContainer📖 → pageGameContainer🎮 → pageConfigContainer⚙️
```

### 数据库表：`app_assets`（资源表）

| 字段 | 说明 |
|---|---|
| `file_path` | 文件路径，唯一键（如 `partials/home.html`、`js/auth.js`、`ARCHITECTURE.md`） |
| `type` | `html` / `js` / `md` |
| `container_id` | HTML 专用，注入到哪个 DOM 容器（与 app_containers.container_id 对应） |
| `content` | 文件内容（纯文本） |
| `load_order` | 加载顺序，数字小的先加载 |
| `is_active` | 是否启用 |

> `type=md` 仅供 upload.html 的"架构文档"Tab 渲染用，不参与页面加载。

### loader.js 工作流程

```javascript
// 第1步：查询 app_containers，按 sort_order 排序
//    placement=global → 在 <div id="globalContainers"> 里创建容器
//    placement=page   → 在 <nav id="navBar"> 里创建导航按钮，在 <div id="pageContainers"> 里创建容器

// 第2步：查询 app_assets（is_active=true），按 load_order 排序
//    type=html → 找到 container_id 对应的 DOM，innerHTML = content
//    type=js   → 创建 <script> 标签插入 body 执行
```

### JS 加载顺序（依赖关系）

```
config_page.js (10) → notifications.js (11) → weather.js (12) → audio.js (13)
→ music.js (14) → pets.js (15) → characters.js (16) → home.js (17)
→ journal.js (18) → calendar.js (19) → game.js (20) → background.js (21)
→ auth.js (22)
```

> **关键**：`auth.js` 必须最后加载，因为它的 `initPage()` 会调用所有模块的初始化函数。

## 四、如何新增页面

**不需要改 index.html！** 所有操作通过 upload.html 完成。

### 完整步骤（以新增"收藏"页为例）

**1. 配置容器（upload.html → 容器配置 Tab）**

点击"新增容器" → 在模态框表单中填写：
- container_id: `pageFavoriteContainer`
- page_name: `favorite`
- 位置: `page`
- 导航文字: `收藏`
- 图标: `⭐`
- 排序: `5`（在设置页之前或之后）
- 启用: ✅

→ 保存后，导航栏会多出 ⭐收藏 按钮

**2. 创建 HTML 片段** `partials/favorite.html`

```html
<div id="page-favorite" class="page-content hidden">
    <!-- 页面内容。外层 div 的 id 必须是 "page-" + page_name -->
</div>
```

**3. 创建 JS 逻辑** `js/favorite.js`

```javascript
(function() {
    // 使用 IIFE 隔离作用域，避免 const 变量冲突
    // 通过 window.xxx 暴露需要全局调用的函数

    async function loadData() {
        const { data, error } = await window.sb.from('表名').select('*');
        // ...
    }

    // 初始化（loader 动态加载时 DOM 已就绪，不需要 DOMContentLoaded）
    loadData();

    window.someFunction = someFunction;
})();
```

**4. 上传到数据库**（upload.html 有两种方式）

- 方式A（本地开发）：在 `upload.html` 的 `FILES` 数组中加两条记录，然后"本地上传" → "全部上传"
```javascript
{ path: 'partials/favorite.html', type: 'html', container: 'pageFavoriteContainer', order: 6 },
{ path: 'js/favorite.js',         type: 'js',   container: null,                  order: 22 },
```

- 方式B（发布后）：upload.html → "在线管理" Tab → 点"新增"，分别创建 HTML 和 JS 记录

**5. 如需新数据表，在 Supabase 执行建表 SQL**

```sql
CREATE TABLE IF NOT EXISTS favorites (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_public_read_xxx" ON favorites FOR SELECT USING (true);
CREATE POLICY "allow_auth_write_xxx" ON favorites FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## 五、如何修改现有页面

### 方式一：在线编辑（推荐，发布后也可用）

1. 打开 `upload.html` → "在线管理" Tab
2. 左侧列表点击要编辑的资源（如 `partials/config.html`）
3. 右侧文本框修改内容
4. 点"保存" → 刷新页面生效

### 方式二：本地修改后重新上传

1. 编辑本地 `partials/` 或 `js/` 目录下的文件
2. 打开 `upload.html` → "本地上传" → "全部上传"

## 六、如何往已有页面追加内容

**问题**：两个 HTML 文件设同一个 `container_id`，后加载的会覆盖前者。

**正确做法**：使用子容器。

1. 编辑父页面 HTML（如 `partials/config.html`），在末尾添加子容器：
```html
<div id="customConfigContainer"></div>
```

2. 新建 HTML 文件，`container_id` 设为 `customConfigContainer`，`load_order` 设为比父页面大的值（确保父页面先加载，子容器先存在于 DOM 中）

## 七、如何修改容器/导航配置

打开 `upload.html` → "容器配置" Tab：
- **新增**：点"新增容器" → 模态框表单填写
- **编辑**：点铅笔图标 → 模态框表单修改（container_id 不可编辑，其他都可改）
- **删除**：点垃圾桶图标 → 自定义确认框
- **禁用/启用**：编辑时切换"启用"复选框

> 模态框表单字段：container_id、page_name、位置（page/global）、导航文字、图标、排序、启用。全部通过表单输入，无原生 prompt/confirm/alert。

## 八、如何新增 JS 模块

1. 创建 `js/xxx.js`，用 IIFE 包裹：
```javascript
(function() {
    // 读取全局变量
    const sb = window.sb;
    const user = window.currentUser;

    // 初始化逻辑
    // ...

    // 暴露全局函数
    window.myFunction = myFunction;
})();
```

2. 上传到数据库，设置 `load_order`（功能模块 10-21 之间，`auth.js` 必须 22 最后）

> **注意**：不要在顶层用 `const sb` 或 `const CONFIG`，会与 `config.js` 冲突。用 IIFE 或 `window.sb` 访问。

## 九、upload.html 功能

5 个 Tab，全部不使用原生弹窗（prompt/confirm/alert 除错误外）：

| Tab | 功能 |
|---|---|
| 本地上传 | 读取本地 FILES 数组列出的文件，批量 fetch + upsert 到 app_assets 表 |
| 在线管理 | 左侧列表 app_assets 记录 → 右侧文本框实时编辑、保存、删除、新增（type/container_id/load_order 都可改） |
| 建表 SQL | 包含三张表的建表 SQL + RLS 策略 + app_containers 初始数据。一键复制 |
| 架构文档 | 从数据库读取 `ARCHITECTURE.md` 记录 → 用 marked.js 实时渲染 Markdown → 可在线编辑并保存回数据库 |
| 容器配置 | 管理 app_containers 表：新增/编辑/删除容器，控制导航栏和页面布局。使用模态框表单，不用 prompt |

## 十、数据库结构

### 主要表

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `app_containers` | **容器配置（导航+容器动态生成）** | `container_id`, `page_name`, `nav_label`, `nav_icon`, `sort_order`, `placement`, `is_active` |
| `app_assets` | HTML 片段、JS 模块、Markdown 文档 | `file_path`, `type`, `container_id`, `content`, `load_order`, `is_active` |
| `app_config` | 全局配置（人物名、API Key、背景图等） | `config_key`, `config_value` |
| `profiles` | 用户信息 | `email`, `boy_name`, `girl_name` 等 |
| `messages` | 留言 | `content`, `author_email`, `likes` |
| `gallery` | 相册 | `image_url`, `uploader_email` |
| `journals` | 日志 | `title`, `content`, `author_email` |
| `calendar_checkins` | 日历打卡 | `check_date`, `user_email` |
| `anniversaries` | 纪念日 | `date`, `title` |
| `music` | 音乐 | `title`, `url`, `uploader_email` |
| `rps_games` | 猜拳游戏记录 | `player_email`, `choice` |

### RLS 策略规则

- **公开读**：`app_containers`、`app_assets`、`app_config`、`messages`、`gallery`、`journals`、`music` 等允许匿名 SELECT
- **认证写**：所有表允许 `authenticated` 用户 INSERT/UPDATE/DELETE
- 新建表时务必添加这两条策略

## 十一、全局变量参考

以下变量在 `config.js` 中定义并导出到 `window`，所有模块可通过 `window.xxx` 访问：

| 变量 | 类型 | 说明 |
|---|---|---|
| `window.sb` | SupabaseClient | Supabase 客户端实例 |
| `window.CONFIG` | Object | Supabase URL 和 anon key |
| `window.IMGBB_KEY` | string | ImgBB 图片上传 API Key |
| `window.EMAILJS_SERVICE_ID` | string | EmailJS 服务 ID |
| `window.EMAILJS_TEMPLATE_ID` | string | EmailJS 模板 ID |
| `window.EMAILJS_PUBLIC_KEY` | string | EmailJS 公钥 |
| `window.currentUser` | Object | 当前登录用户信息 |
| `window.myRpsEmail` | string | 当前用户邮箱（小写） |
| `window.boyHugging` | boolean | 男生是否在拥抱状态 |
| `window.girlHugging` | boolean | 女生是否在拥抱状态 |
| `window.bgmPlaying` | boolean | BGM 是否在播放 |
| `window.audioCtx` | AudioContext | Web Audio 上下文 |
| `window.boyDbQuotes` | Array | 男生话语列表（数据库） |
| `window.girlDbQuotes` | Array | 女生话语列表（数据库） |
| `window._defaultPage` | string | 默认页面名（容器表第1个 page 类容器的 page_name） |

### 全局函数参考

| 函数 | 来源文件 | 说明 |
|---|---|---|
| `window.sendNotification(type, msg)` | notifications.js | 发送通知（有 500ms 去重） |
| `window.showPage(pageName)` | auth.js | 切换页面 tab（通过 .page-content 类和 data-page 属性动态匹配） |
| `window.compressImage(file, maxW, quality)` | auth.js | 压缩图片 |
| `window.loadGallery()` | home.js | 加载相册 |
| `window.clearBackground()` | background.js | 清除背景图 |

## 十二、开发规范

1. **JS 模块必须用 IIFE 包裹**，避免全局变量冲突
2. **不要用 `const sb` / `const CONFIG` 顶层声明**，用 `window.sb` / `window.CONFIG`
3. **需要被 onclick 调用的函数必须挂到 `window`**：`window.myFunc = myFunc`
4. **初始化不需要 `DOMContentLoaded`**，loader 动态加载 JS 时 DOM 已就绪
5. **`auth.js` 必须最后加载**（`load_order` 最大）
6. **新表必须添加 RLS 策略**：公开读 + 认证写
7. **图片上传统一用 ImgBB**，通过 `window.compressImage` 压缩后上传
8. **发送通知用 `window.sendNotification`**，自带去重机制
9. **新增页面不用改 index.html**，用 upload.html 的"容器配置"Tab 加一条记录即可
10. **Modal/模态框替代原生弹窗**：upload.html 中使用自定义模态框表单（containerModal）和自定义确认框（confirmModal），不使用 prompt/confirm
