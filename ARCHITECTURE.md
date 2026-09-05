# 情侣空间 - 项目架构文档

> 本文档供 AI 助手阅读，帮助理解项目架构、资源加载机制和开发规范。

## 一、项目概述

情侣空间是一个双人互动 Web 应用，功能包括：相册、视频（腾讯 COS 私有桶）、网盘（OpenList 接入百度网盘等，支持多挂载路径切换，浏览/上传任意文件（可多选）/删除）、留言、日志、日历打卡、跳一跳游戏（iframe 内嵌 + 分数入库 + 情侣排行榜）、骗子酒馆、Live2D 风格人物形象、宠物动画、现代音乐播放器（封面/歌词/播放模式）、K 歌房（录音+混音+作品库）、天气组件、背景图自定义、AI 标签页（嵌入豆包网页版）、下拉刷新、资源本地缓存等。

## 二、文件结构

### 本地文件（仅 3 个，不存数据库）

```
index.html              — 入口文件（本地，仅包含 loading 指示器 + 占位容器 + 最小初始样式）
js/config.js            — Supabase 连接配置（本地）
js/loader.js            — 动态资源加载器（本地）
upload.html             — 资源管理工具（本地开发用，6个Tab）
```

### 数据库文件（通过 upload.html 上传到 app_assets 表）

```
styles.css              — 基础样式 + 相册 + 留言 + 音乐 + 天气 + 下拉刷新（type=css, order=0）
styles_layout.css       — 日历 + BGM + 显示设置 + 骗子酒馆 + 语音 + 宠物 + 视频卡片 + K歌播放器 + 删除按钮（type=css, order=0）
styles_mobile.css       — 导航栏 + Live2D 人物 + 手机端适配（type=css, order=0）
partials/               — HTML 片段
├── login.html          — 登录面板
├── preview.html        — 大图预览弹窗 + 视频预览弹窗
├── home.html           — 首页（相册/视频/留言/日志/AI/音乐/K歌）
├── journal.html        — 日志 + 日历打卡 + 纪念日
├── game.html           — 游戏页
└── config.html         — 设置页（含腾讯 COS 配置）
js/                     — JS 模块
├── config_page.js      — 人物话语管理 + 通知邮件开关
├── notifications.js    — 通知系统（sendNotification）
├── weather.js          — 天气组件
├── audio.js            — BGM / 音效
├── music.js            — 音乐播放器
├── pets.js             — 宠物动画（哈士奇 SVG / 暹罗猫 SVG / 猫猫 GIF 动图，含拖拽、点击互动、抱抱系统）
├── characters.js       — 男生 Live2D 人物形象
├── characters_girl.js  — 女生 Live2D 人物形象
├── home.js             — 首页逻辑（相册/留言）
├── video.js            — 视频 Tab（腾讯 COS 私有桶上传/签名播放/缩略图/删除）
├── cloud.js            — 网盘 Tab（OpenList 多挂载浏览/上传任意文件（多选）/视频图片音频预览/删除）
├── karaoke.js          — K 歌房（选歌/歌词/录音/混音/作品库独立播放器；录音用 AudioWorklet 独立线程采集+软限幅，老浏览器回退 ScriptProcessor）
├── journal.js          — 日志逻辑
├── calendar.js         — 日历/打卡/纪念日
├── game.js             — 跳一跳（iframe 加载 Jump-master，postMessage 收分数入库 + 情侣排行榜）
├── game_liar.js        — 骗子酒馆
├── background.js       — 背景图设置
├── ai_chat.js          — ⚠️ 已废弃（智谱 AI 聊天，不再被 loader.js 加载，文件保留备用）
├── pull_refresh.js     — 下拉刷新（橡皮条）
└── auth.js             — 认证 + 页面初始化（必须最后加载）
ARCHITECTURE.md         — 本架构文档（type=md, 供 upload.html 渲染用）
```

## 三、资源加载机制

### loader.js 工作流程

```javascript
// 第1步：读取 localStorage 缓存（容器 + 资源 + 版本号）
//    有缓存 → 立即渲染页面（秒开）

// 第2步：查 app_config 表的 assets_version（仅1条，轻量）
//    版本一致 + 有缓存 → 直接 return，不查资源表
//    版本不一致/无缓存 → 查全量资源表，更新缓存

// 第3步：查询 app_containers，按 sort_order 排序
//    placement=global → 在 <div id="globalContainers"> 里创建容器
//    placement=page   → 在 <nav id="navBar"> 里创建导航按钮，在 <div id="pageContainers"> 里创建容器

// 第4步：查询 app_assets（is_active=true），按 load_order + type + file_path 排序
//    type=css   → 创建 <style> 标签插入 <head>
//    type=html  → 找到 container_id 对应的 DOM，innerHTML = content
//    type=js    → 创建 <script> 标签插入 body 执行

// 第5步：隐藏 loading 指示器，更新 localStorage 缓存 + 版本号
```

### 资源缓存机制（版本号对比 + stale-while-revalidate）

| 场景 | 行为 |
|---|---|
| 首次加载（无缓存） | 查全量资源 → 渲染 → 存 localStorage |
| 有缓存 + 版本一致 | **直接用缓存渲染，不查资源表**（秒开） |
| 有缓存 + 版本不一致 | 查全量资源 → 渲染 → 更新缓存 |
| 接口失败 + 有缓存 | 用缓存兜底，不影响使用 |

- **版本号**：`app_config` 表中 `config_key='assets_version'`，值为 ISO 时间戳
- **更新时机**：upload.html 保存/删除资源、保存容器、本地上传时自动调用 `bumpAssetsVersion()` 更新版本号
- **缓存key**：`ls_containers_v2`（容器）、`ls_assets_v2`（资源）、`ls_assets_version`（版本号）

### 加载顺序

```
CSS (0) → HTML (1-6) → JS (10-26)
```

| 类型 | load_order 范围 | 说明 |
|---|---|---|
| `css` | 0 | 所有样式最先加载（按 file_path 排序），确保页面渲染时样式已就绪 |
| `html` | 1-6 | 全局容器(1-2) → 各页面容器(3-6) |
| `js` | 10-26 | 功能模块(10-25) → auth.js(26) |
| `md` | 99 | 仅供 upload.html 渲染，不参与页面加载 |

### JS 加载顺序（依赖关系）

```
config_page.js (10) → notifications.js (11) → weather.js (12) → audio.js (13)
→ music.js (14) → pets.js (15) → characters.js (16) → characters_girl.js (17)
→ home.js (18) → journal.js (19) → calendar.js (20) → game.js (21) → game_liar.js (22)
→ background.js (23) → video.js (24) → karaoke.js (25) → pull_refresh.js (?) → auth.js (26)
```

> **关键**：`auth.js` 必须最后加载，因为它的 `initPage()` 会调用所有模块的初始化函数。
> **注**：`ai_chat.js` 已废弃，loader.js 不再加载（AI 标签页改为 iframe 嵌入豆包网页版）。
> **注**：`video.js` 和 `karaoke.js` 共享 home.html 页面，懒加载初始化（首次切到对应子 Tab 才 init）。

## 四、数据库表结构

### `app_containers`（容器配置表）

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

### `app_assets`（资源表）

| 字段 | 说明 |
|---|---|
| `file_path` | 文件路径，唯一键（如 `styles.css`、`partials/home.html`、`js/auth.js`、`ARCHITECTURE.md`） |
| `type` | `css` / `html` / `js` / `md` |
| `container_id` | HTML 专用，注入到哪个 DOM 容器（与 app_containers.container_id 对应） |
| `content` | 文件内容（纯文本） |
| `load_order` | 加载顺序，数字小的先加载 |
| `is_active` | 是否启用 |

> `type=md` 仅供 upload.html 的"架构文档"Tab 渲染用，不参与页面加载。

### `asset_backups`（版本备份表）

| 字段 | 说明 |
|---|---|
| `id` | 自增主键 |
| `file_path` | 文件路径（与 app_assets.file_path 对应） |
| `content` | 备份的文件内容 |
| `type` | 文件类型（css/html/js/md） |
| `container_id` | 容器ID（HTML 专用） |
| `load_order` | 加载顺序 |
| `is_active` | 是否启用 |
| `version` | 版本号（自动递增） |
| `created_at` | 备份时间 |

> **自动备份机制**：在 upload.html「在线管理」Tab 保存文件时，系统自动备份当前版本到 asset_backups 表。每个文件最多保留 10 个版本，超过自动清理最早版本（通过 prune_backups RPC 函数实现）。

> **还原功能**：点击编辑器下方「历史版本」按钮可查看所有备份版本，支持预览、还原、删除操作。

### 业务表

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `app_config` | 全局配置（人物名、API Key、背景图、AI配置、COS配置等） | `config_key`, `config_value` |
| `profiles` | 用户信息 | `email`, `boy_name`, `girl_name` 等 |
| `messages` | 留言 | `content`, `author_email`, `likes` |
| `gallery` | 相册 | `image_url`, `uploader_email` |
| `videos` | 视频（腾讯 COS 私有桶） | `title`, `url`(存 `cos://key`), `thumbnail_key`, `thumbnail_url`(兼容), `duration`, `uploader_email` |
| `journals` | 日志 | `title`, `content`, `author_email` |
| `calendar_checkins` | 日历打卡 | `check_date`, `user_email` |
| `anniversaries` | 纪念日 | `date`, `title` |
| `music` | 音乐 | `title`, `url`, `uploader_email`, `cover_url`(可选), `lyrics`(可选) |
| `karaoke_recordings` | K 歌录音作品 | `title`, `url`, `singer_name`, `song_title`, `uploader_email` |
| `rps_games` | 猜拳游戏记录（已弃用，情侣对战已移除，表可保留） | `player_email`, `choice` |
| `game_scores` | 小游戏分数（通用，game 字段区分游戏） | `game`('jump'), `user_id`, `nickname`, `score` |

**game_scores 建表 SQL（跳一跳排行榜用，需在 Supabase SQL Editor 执行）**：

```sql
create table if not exists game_scores (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'jump',
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '',
  score int not null default 0,
  created_at timestamptz not null default now()
);
alter table game_scores enable row level security;
create policy "game_scores 公开读" on game_scores for select using (true);
create policy "game_scores 认证写" on game_scores for insert to authenticated with check (auth.uid() = user_id);
create index if not exists idx_game_scores_board on game_scores (game, score desc);
```

### RLS 策略规则

- **公开读**：`app_containers`、`app_assets`、`app_config`、`messages`、`gallery`、`journals`、`music` 等允许匿名 SELECT
- **认证写**：所有表允许 `authenticated` 用户 INSERT/UPDATE/DELETE
- 新建表时务必添加这两条策略

## 五、如何新增页面

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

可以使用 upload.html 的"SQL 执行"Tab，通过 `exec_ddl` RPC 函数执行：

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

## 六、如何修改现有页面

### 方式一：在线编辑（推荐，发布后也可用）

1. 打开 `upload.html` → "在线管理" Tab
2. 左侧列表点击要编辑的资源（如 `partials/config.html`）
3. 右侧文本框修改内容
4. 点"保存" → 刷新页面生效

### 方式二：本地修改后重新上传

1. 编辑本地 `partials/` 或 `js/` 目录下的文件
2. 打开 `upload.html` → "本地上传" → "全部上传"

## 七、如何往已有页面追加内容

**问题**：两个 HTML 文件设同一个 `container_id`，后加载的会覆盖前者。

**正确做法**：使用子容器。

1. 编辑父页面 HTML（如 `partials/config.html`），在末尾添加子容器：
```html
<div id="customConfigContainer"></div>
```

2. 新建 HTML 文件，`container_id` 设为 `customConfigContainer`，`load_order` 设为比父页面大的值（确保父页面先加载，子容器先存在于 DOM 中）

## 八、如何修改容器/导航配置

打开 `upload.html` → "容器配置" Tab：
- **新增**：点"新增容器" → 模态框表单填写
- **编辑**：点铅笔图标 → 模态框表单修改（container_id 不可编辑，其他都可改）
- **删除**：点垃圾桶图标 → 自定义确认框
- **禁用/启用**：编辑时切换"启用"复选框

> 模态框表单字段：container_id、page_name、位置（page/global）、导航文字、图标、排序、启用。全部通过表单输入，无原生 prompt/confirm/alert。

## 九、如何新增 CSS 样式

1. 编辑本地 `styles.css` 文件
2. 或通过 upload.html → "在线管理" → 找到 `styles.css` → 编辑保存

> CSS 文件的 `load_order` 应为 0（最先加载），确保所有 HTML/JS 渲染前样式已就绪。

## 十、如何新增 JS 模块

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

## 十一、upload.html 功能

6 个 Tab，全部不使用原生弹窗（prompt/confirm/alert 除错误外）：

| Tab | 功能 |
|---|---|
| 本地上传 | 读取本地 FILES 数组列出的文件（含 styles.css），批量 fetch + upsert 到 app_assets 表，自动更新版本号 |
| 在线管理 | 三栏布局：资源列表 + Monaco 编辑器 + AI 代码助手。支持编辑/保存/删除/新增、历史版本备份与还原、复制/下载、全部下载（ZIP）。AI 助手自动引用 md 文档、手动引用代码文件、流式输出、发送后自动清空引用 |
| 建表 SQL | 包含所有表的建表 SQL + RLS 策略 + app_containers 初始数据。支持复制/下载 |
| 架构文档 | 从数据库读取 `ARCHITECTURE.md` 记录 → 用 marked.js 实时渲染 Markdown → 可在线编辑并保存回数据库。支持复制/下载 |
| 容器配置 | 管理 app_containers 表：新增/编辑/删除容器，控制导航栏和页面布局。使用模态框表单，不用 prompt |
| SQL 执行 | 通过 `exec_ddl` RPC 函数执行 DDL 语句（建表/删表/改表/加策略）。支持预设模板、复制、执行结果展示 |

## 十二、SQL 执行器

### 安装 exec_ddl 函数

首次使用前，需在 Supabase Dashboard → SQL Editor 执行：

```sql
CREATE OR REPLACE FUNCTION exec_ddl(sql_text TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE sql_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION exec_ddl(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION exec_ddl(TEXT) TO authenticated;
```

### 使用

打开 upload.html → "SQL 执行" Tab：
- 输入 SQL 语句（支持多条分号分隔）
- 或点击预设模板（建表/RLS策略/删表/加字段）
- 点"执行" → 查看结果

> **安全**：`exec_ddl` 仅允许 `authenticated` 角色调用，匿名用户无权执行。

## 十三、全局变量参考

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
| `window._aiApiKey` | string | 智谱 AI API Key |
| `window._aiModel` | string | 智谱 AI 模型名 |
| `window._aiSystemPrompt` | string | 智谱 AI 系统提示词 |
| `window._assetsVersion` | string | 资源版本号（用于缓存对比） |
| `window._cosSecretId` | string | 腾讯 COS SecretId（视频上传用） |
| `window._cosSecretKey` | string | 腾讯 COS SecretKey（视频上传用） |
| `window._cosBucket` | string | 腾讯 COS 存储桶名（如 `xxx-1300000000`） |
| `window._cosRegion` | string | 腾讯 COS 地域（如 `ap-guangzhou`） |
| `window._openlistBaseUrl` | string | OpenList 服务地址（网盘用） |
| `window._openlistUsername` | string | OpenList 登录账号 |
| `window._openlistPassword` | string | OpenList 登录密码 |
| `window._openlistMountPath` | string | 默认网盘挂载路径（第一个挂载） |
| `window._openlistMountPaths` | string | 网盘挂载路径列表（换行/逗号分隔，如 `/baidu\n/quark`） |
| `window._openlistAsTask` | boolean | 网盘上传是否用异步任务模式 |
| `window._notifyEmailEnabled` | boolean | 发送通知时是否同时发邮件（localStorage 键 `notify_email_enabled`，仅本机生效，无记录默认 true） |

### 全局函数参考

| 函数 | 来源文件 | 说明 |
|---|---|---|
| `window.sendNotification(type, msg)` | notifications.js | 发送通知（有 500ms 去重；受设置页「通知同时发送邮件」开关控制是否发邮件） |
| `window.showPage(pageName)` | auth.js | 切换页面 tab（通过 .page-content 类和 data-page 属性动态匹配） |
| `window.compressImage(file, maxW, quality)` | auth.js | 压缩图片 |
| `window.loadGallery()` | home.js | 加载相册 |
| `window.clearBackground()` | background.js | 清除背景图 |
| `window.togglePlayMode()` | music.js | 切换播放模式（列表循环/单曲循环/随机） |
| `window.togglePlaylist()` | music.js | 折叠/展开播放列表 |
| `window.toggleLyricsView()` | music.js | 显示/隐藏歌词区 |
| `window.uploadVideo(input)` | video.js | 上传视频到腾讯 COS 私有桶（自动生成缩略图） |
| `window.playVideoByKey(info)` | video.js | 通过 Key 生成签名 URL 后播放视频 |
| `window.deleteVideo(id, url, thumbKey)` | video.js | 删除视频（同时删 COS 视频文件 + 缩略图） |
| `window.loadVideoList(page)` | video.js | 加载视频列表（分页，每页6个，自动签名） |
| `window.saveCosConfig()` | video.js | 保存腾讯 COS 配置到 app_config 表 |
| `window.initVideoPage()` | video.js | 视频子 Tab 首次进入时初始化（加载 COS 配置 + 视频列表） |
| `window.karaokeTogglePlay()` | karaoke.js | 伴奏播放/暂停 |
| `window.karaokeToggleRecord()` | karaoke.js | 开始/停止录音 |
| `window.mixAndExport()` | karaoke.js | 合成伴奏+人声导出 MP3 |
| `window.previewMix()` | karaoke.js | 试听混音效果（Web Audio API 实时播放） |
| `window.saveToMusicLibrary()` | karaoke.js | 保存录音作品到 Supabase Storage + karaoke_recordings 表 |
| `window.toggleRecPlay(id)` | karaoke.js | 播放/暂停某条录音作品（独立 Audio 实例） |
| `window.seekRecProgress(e, id)` | karaoke.js | 点击录音作品进度条 seek |
| `window.deleteKaraokeRecording(id, url)` | karaoke.js | 删除录音作品 |
| `window.karaokePbTogglePlay()` | karaoke.js | 顶部回放播放器（人声/合成）播放/暂停 |
| `window.karaokePbSeek(e)` | karaoke.js | 顶部回放播放器进度条 seek |
| `window.initCloudPage()` | cloud.js | 网盘子 Tab 首次进入时初始化（强制拉取配置 + 登录 + 浏览） |
| `window.cloudLogin()` | cloud.js | 登录 OpenList 并更新状态徽章 |
| `window.cloudRefresh()` | cloud.js | 刷新当前网盘目录 |
| `window.cloudToggleUpload()` | cloud.js | 展开/收起网盘上传区 |
| `window.cloudEnterDir(path)` | cloud.js | 进入网盘目录 |
| `window.cloudSwitchMount(mountPath)` | cloud.js | 切换当前浏览的网盘挂载路径 |
| `window.cloudGoHome()` | cloud.js | 返回当前挂载根目录 |
| `window.cloudPlayVideo(name, path)` | cloud.js | 获取直链并弹窗播放网盘视频 |
| `window.cloudPreviewImage(name, path)` | cloud.js | 获取直链并弹窗预览网盘图片 |
| `window.cloudPlayAudio(name, path)` | cloud.js | 获取直链并弹窗播放网盘音频 |
| `window.cloudOpenFile(name, path)` | cloud.js | 获取直链并新窗口打开/下载非视频文件 |
| `window.cloudDeleteFile(name, path)` | cloud.js | 删除网盘视频文件（confirm 确认） |
| `window.cloudCloseVideo(e)` | cloud.js | 关闭网盘视频播放弹窗 |

> ⚠️ 表中 `window.toggleAiSettings` / `sendAiMessage` / `clearAiChat` / `saveAiAllOptions` 已废弃（ai_chat.js 不再加载）。

## 十四、AI 标签页（嵌入豆包网页版）

### 功能概述

首页「AI」子 Tab 通过 iframe 直接嵌入豆包网页版（`https://www.doubao.com/chat/`），用户无需配置 API Key 即可使用。

### 实现方式

- **HTML**：`partials/home.html` 的 `#subTab-ai` 内放 `<iframe>` 加载豆包
- **JS**：无需专属 JS 模块（原 `js/ai_chat.js` 已废弃，loader.js 不再加载）
- **降级方案**：右上角"新窗口打开"按钮（紫蓝渐变）跳转豆包官网；iframe 加载中显示 loading 动画；底部小字提示用户空白时改用新窗口

### iframe 参数

```html
<iframe src="https://www.doubao.com/chat/"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="microphone; camera; clipboard-write"
        referrerpolicy="no-referrer"></iframe>
```

### 已知限制

- 豆包官网可能设置 `X-Frame-Options: SAMEORIGIN` 或 CSP `frame-ancestors`，导致 iframe 被拦截
- 被拦截时浏览器显示空白或"拒绝连接"，用户需点击"新窗口打开"使用完整功能
- 跨域无法共享登录态，用户首次需在新窗口登录豆包

### ⚠️ 废弃说明：智谱 AI 聊天

原「智谱 AI 聊天助手」已从设置页移除，相关代码保留但停用：

| 资源 | 状态 |
|---|---|
| `js/ai_chat.js` | ⚠️ 保留但 loader.js 不加载（load_order=24 已移除）|
| `partials/home.html` 中的 AI 设置面板/聊天框 | ❌ 已删除，替换为 iframe |
| `app_config` 表 `zhipu_api_key` / `zhipu_model` / `zhipu_system_prompt` | 保留但暂未使用 |
| `window._aiApiKey` / `window._aiModel` / `window._aiSystemPrompt` | 仍由 auth.js loadConfig() 读取，供未来恢复使用 |
| `window.toggleAiSettings` / `sendAiMessage` / `clearAiChat` / `saveAiAllOptions` | ❌ 不再存在 |

> 如需恢复智谱 AI 接入：在 loader.js 的 LOCAL_FILES 中恢复 `ai_chat.js` 条目（order=24），并在 home.html 中恢复原 AI 聊天 UI。
> 智谱 GLM-4 系列支持 `web_search` 工具实现联网搜索（详见 [官方文档](https://docs.bigmodel.cn/cn/guide/tools/web-search)），每次搜索约增加 1000 tokens 消耗。

## 十五、现代音乐播放器

### 功能特性

- **旋转大封面**：180px 圆形封面 + 外圈虚线环，播放时旋转；无封面时显示歌名首字
- **歌词同步**：支持 LRC 时间戳格式（自动高亮+滚动）和纯文本格式（仅展示）
- **播放模式**：列表循环 / 单曲循环（带"1"角标）/ 随机播放，3 种模式循环切换
- **折叠列表**：默认收起，点击展开，每项含小封面+标题+删除按钮
- **歌词开关**：右下角按钮可隐藏/显示歌词区
- **进度条**：渐变色 + hover 显示拖拽圆点
- **mask-image 渐变遮罩**：歌词上下边缘自然淡出

### 文件结构

| 文件 | 作用 |
|---|---|
| `partials/home.html` `#subTab-music` | 播放器 HTML 结构（.modern-player 容器） |
| `styles.css` `.modern-player` / `.mp-*` | 播放器样式（行 225-542） |
| `styles_mobile.css` | 移动端适配（封面/按钮缩小） |
| `js/music.js` | 播放逻辑、歌词解析、播放模式、列表折叠 |

### 数据库字段（music 表）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | bigserial | ✅ | 主键 |
| `title` | text | ✅ | 歌曲名 |
| `url` | text | ✅ | 音频文件 URL（Storage music 桶） |
| `cover_url` | text | ❌ | 封面图 URL（缺省显示歌名首字） |
| `lyrics` | text | ❌ | 歌词文本（LRC 或纯文本） |
| `created_at` | timestamptz | ✅ | 创建时间 |

> 启用封面/歌词功能需在 Supabase 执行：
> ```sql
> ALTER TABLE music ADD COLUMN IF NOT EXISTS cover_url text;
> ALTER TABLE music ADD COLUMN IF NOT EXISTS lyrics text;
> ```

### 歌词格式

**LRC 格式（推荐，可同步高亮+滚动）**：
```
[00:12.50]月亮代表我的心
[00:18.30]你问我爱你有多深
```

**纯文本格式（不滚动，仅展示）**：
```
月亮代表我的心
你问我爱你有多深
```

### 关键实现细节

- **歌词滚动**：用 `getBoundingClientRect()` 计算行在容器内的相对偏移（避免 `offsetTop` 因 offsetParent 不是容器导致失真），二分法查找当前行
- **CSS 遮罩**：`mask-image: linear-gradient(...)` 让歌词上下缘淡出，禁止在 JS 里再做 opacity 逻辑
- **当前行高亮**：用 `margin: 6px 0` 撑开行间距代替 `transform: scale(1.02)`（后者会被 `overflow: hidden` 裁切）
- **播放模式按钮**：`mpModeBtn`，3 种模式循环切换；单曲循环用 `<i class="fa fa-repeat">` + "1" 角标叠加（FontAwesome 4 无 `fa-repeat-1`）
- **删除原浮动按钮**：旧版 `.music-toggle` / `.music-panel` 浮动按钮样式已从 styles.css 和 styles_mobile.css 中移除（musicToggle/musicPanel 元素已不存在）

## 十五点五、视频 Tab（腾讯 COS 私有桶）

### 功能特性

- **上传视频**：选择视频文件 → 上传到腾讯 COS 私有桶 → 自动截取第一帧生成缩略图上传到 `videos_thumbs/` → 写入 `videos` 表
- **签名访问**：私有桶模式下，所有视频和缩略图访问都通过 COS SDK `getObjectUrl` 生成 30 分钟有效的临时签名 URL
- **分页浏览**：每页 6 个，支持上一页/下一页
- **播放预览**：点击视频卡片 → 弹窗播放（带签名 URL）
- **删除同步**：删除数据库记录 + 同时删除 COS 视频文件和缩略图文件
- **懒加载**：首次切到视频子 Tab 才初始化（`initVideoPage()`）

### 文件结构

| 文件 | 作用 |
|---|---|
| `partials/home.html` `#subTab-video` | 视频 Tab UI（上传按钮 + 进度条 + 视频网格 + 分页器） |
| `partials/config.html` | 腾讯 COS 配置表单（SecretId/SecretKey/Bucket/Region） |
| `partials/preview.html` `#videoPreviewModal` | 视频播放弹窗 |
| `styles_layout.css` `.video-card` / `.video-thumb` 等 | 视频卡片样式（蓝色播放遮罩、时长标签、删除图标） |
| `js/video.js` | 上传/签名/播放/删除/配置保存逻辑 |

### 数据库字段（videos 表）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | bigserial | ✅ | 主键 |
| `title` | text | ✅ | 视频标题（取文件名去扩展名） |
| `url` | text | ✅ | 存储 `cos://videos/xxx.mp4`（仅 Key，不存完整 URL） |
| `thumbnail_url` | text | ❌ | 兼容字段：老数据存 base64 或 `cos://...` |
| `thumbnail_key` | text | ❌ | 新字段：缩略图 COS Key（如 `videos_thumbs/xxx.jpg`） |
| `file_size` | bigint | ❌ | 文件大小（字节） |
| `duration` | real | ❌ | 视频时长（秒） |
| `uploader_email` | text | ❌ | 上传者邮箱（用于判断删除权限） |
| `created_at` | timestamptz | ✅ | 创建时间 |

> **增量升级 SQL**（已有数据库执行）：
> ```sql
> DO $$ BEGIN ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_key TEXT; EXCEPTION WHEN OTHERS THEN END $$;
> ```

### COS 私有桶配置

在设置页（`partials/config.html`）填写腾讯 COS 配置并保存到 `app_config` 表：

| config_key | 说明 |
|---|---|
| `cos_secret_id` | 腾讯云 API SecretId |
| `cos_secret_key` | 腾讯云 API SecretKey |
| `cos_bucket` | 存储桶名（如 `xxx-1300000000`） |
| `cos_region` | 地域（如 `ap-guangzhou`） |

`auth.js` 登录后读取这些配置到 `window._cosSecretId` 等全局变量。

### 关键实现细节

- **动态加载 COS SDK**：`loadCosSdk()` 通过 script 标签注入 `cos-js-sdk-v5.min.js`，避免增加初始包体积
- **签名 URL 生成**：`getSignedUrl(key)` 调用 `cos.getObjectUrl({Sign: true, Expires: 1800})`，30 分钟有效期
- **URL 格式约定**：数据库 `url` 字段存 `cos://videos/xxx.mp4`，`extractCosKey()` 解析为 `videos/xxx.mp4`；兼容老的完整 URL 格式
- **缩略图生成**：用 `<video>` 元素加载文件 → `onseeked` 时用 canvas 截图 → `toBlob` 转 JPEG → 上传到 COS
- **上传进度**：`cos.putObject` 的 `onProgress` 回调更新进度条
- **CORS 要求**：腾讯 COS 控制台需配置跨域规则（Methods: GET/PUT/POST/DELETE/HEAD/OPTIONS）

## 十五点六、K 歌房

### 功能特性

- **选歌**：从 `music` 表读取歌曲列表，点击选歌后加载歌词
- **歌词同步**：支持 LRC 时间戳格式，自动高亮当前行 + 滚动
- **录音**：优先 **AudioWorklet**（独立音频线程采集 PCM + tanh 软限幅防削波），不支持时回退 ScriptProcessorNode（缓冲 16384）；统一开启 AEC/降噪/AGC
- **实时音量条**：录音时显示音量电平（AnalyserNode）
- **人声回放**：录音停止后编码 MP3（LameJS）或 WAV，显示在顶部回放面板（🟣 紫色主题）
- **混音合成**：伴奏 + 人声离线合成（Web Audio API 渲染），导出 MP3（🟣 粉色主题）
- **试听混音**：实时播放伴奏+人声，可调整伴奏/人声音量和偏移
- **录音作品库**：保存到 Supabase Storage + `karaoke_recordings` 表，每条作品独立播放器（🔵 蓝色主题）

### 文件结构

| 文件 | 作用 |
|---|---|
| `partials/home.html` `#subTab-karaoke` | K 歌房 UI（选歌/歌词/伴奏控制/录音/混音面板/作品列表） |
| `styles_layout.css` `.karaoke-*` | K 歌房所有样式（按钮/进度条/歌词/混音滑块/录音作品卡片） |
| `js/karaoke.js` | 完整 K 歌逻辑（选歌/录音/混音/作品库播放） |

### 数据库字段（karaoke_recordings 表）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | bigserial | ✅ | 主键 |
| `title` | text | ✅ | 作品标题 |
| `url` | text | ✅ | 音频 URL（Supabase Storage music 桶） |
| `singer_name` | text | ❌ | 演唱者昵称（从 profiles 表读取） |
| `song_title` | text | ❌ | 原歌曲名 |
| `uploader_email` | text | ❌ | 上传者邮箱 |
| `created_at` | timestamptz | ✅ | 创建时间 |

### 播放器架构（三种模式区分）

| 播放来源 | 播放器位置 | 主题色 | Audio 实例 |
|---|---|---|---|
| 纯人声（刚录完） | 顶部回放面板 `karaokePlayback` | 🟣 紫色 | 共用 `karaokePlaybackAudio` |
| 合成作品（伴奏+人声） | 顶部回放面板 `karaokePlayback` | 🟣 粉色 | 共用 `karaokePlaybackAudio` |
| 录音作品列表 | **每条作品独立卡片** | 🔵 蓝色 | **独立 Audio**（`recordAudioMap` 缓存） |

- 顶部回放面板：`setPlaybackMode(mode, title)` 切换 `vocal`/`mix` 主题类，自定义进度条 + 播放按钮
- 录音作品列表：每条渲染为单一卡片（播放按钮 + 标题/歌手/日期 + 删除 + 进度条 + 时间），互斥播放（播一条自动停其它）

### 关键实现细节

- **录音数据**：`recordedSamples` 存 Float32Array 数组，录音完成复制到 `vocalSamples` 供混音用
- **录音采集**：`createAudioWorkletRecorder()` 内联 Worklet 代码为 Blob URL 加载（无需部署额外文件），逐样本 `tanh` 软限幅（0.9 内原样通过，超出平滑压到 1.0）；块内累积 4096 采样回传主线程；老浏览器回退 ScriptProcessorNode（bufferSize=16384）
- **麦克风约束**：`echoCancellation + noiseSuppression + autoGainControl` 全平台开启（防近讲削波、压环境噪、外放消伴奏回授）
- **MP3 编码**：`loadLameJS()` 动态加载 lamejs 库，`encodePcmToMp3` 编码 128kbps mono；失败回退 WAV
- **混音**：`mixAndExport()` 用 OfflineAudioContext 离线渲染伴奏+人声，支持手动偏移（`karaokeMixOffset` 滑块，-500ms~+500ms）
- **试听**：`previewMix()` 用实时 AudioContext 播放，伴奏截取前后各 3 秒
- **互斥播放**：录音作品 `play` 事件触发时遍历 `recordAudioMap` 暂停其它所有 Audio
- **删除清理**：`deleteKaraokeRecording` 先停对应 Audio 并从 Map 移除，再删数据库 + Storage

## 十五点七、网盘 Tab（OpenList 多挂载）

### 功能特性

- **多挂载支持**：支持配置多个网盘挂载路径（如 `/baidu`、`/quark`、`/115`），网盘页顶部以按钮组切换，点击即加载对应挂载根目录
- **浏览**：通过 OpenList API 浏览网盘目录（面包屑导航 + 挂载根快捷返回），显示全部文件（文件夹在前）；视频弹窗播放，图片弹窗预览，音频弹窗播放（卡片直接显示缩略图/封面），其它文件点击新窗口打开/下载
- **上传**：支持任意类型文件且可多选，统一填写一个名称（扩展名自动保留原文件的；多选自动加 `名称_YYYYMMDD_序号`），上传区提供「上传到挂载」下拉框切换目标挂载；当前浏览目录位于所选挂载下时传到当前目录，否则传到该挂载根目录（XHR PUT 带进度条，可选异步任务模式）
- **播放**：点击视频 → `/fs/get` 获取直链（raw_url）→ 弹窗播放
- **删除**：视频卡片红色垃圾桶按钮 → confirm 确认 → 删除网盘文件（401 时自动重登录并重试一次）
- **连接状态**：右上角状态徽章（未连接/未配置/连接中/失败/错误/用户名），配置缺失时显示黄色提示条
- **懒加载**：首次切到网盘子 Tab 才初始化（`initCloudPage()`），并强制从 app_config 重新拉取最新配置

### 文件结构

| 文件 | 作用 |
|---|---|
| `partials/home.html` `#subTab-cloud` | 网盘 Tab UI（挂载切换按钮组/状态徽章/面包屑/文件网格/上传区+挂载下拉/视频弹窗） |
| `js/cloud.js` | 网盘逻辑（登录/多挂载切换/浏览/任意文件多选上传/播放/打开/删除），load_order=27 |
| `styles.css` `.cloud-file-card` / `.cloud-del-icon` | 文件卡片与删除按钮样式 |

### 配置（app_config 表）

| config_key | 说明 |
|---|---|
| `openlist_base_url` | OpenList 服务地址（如 `https://xxx:5244`） |
| `openlist_username` | 登录账号 |
| `openlist_password` | 登录密码（必填，缺失则网盘页显示"未配置"） |
| `openlist_mount_paths` | 挂载路径列表，换行或逗号分隔（如 `/baidu\n/quark`），第一个为默认挂载 |
| `openlist_mount_path` | 兼容旧版单挂载配置（= 第一个挂载） |
| `openlist_as_task` | `'1'` 启用异步任务上传 |

> 配置入口：upload.html「存储」Tab（挂载路径为多行文本框，每行一个，或逗号分隔）。
> `auth.js` 的 `initStorageGlobals()` 登录后/进入网盘 Tab 时把配置读到 `window._openlist*` 全局变量。

### 关键实现细节

- **挂载解析**：`parseMountPaths()` 按 `\n\r,，;；` 分隔 → trim → 过滤空 → 统一以 `/` 开头 → 去重；兼容旧 `openlist_mount_path`
- **挂载切换**：`cloudSwitchMount(m)` 渲染按钮组（`#cloudMountChips`，当前挂载高亮）+ 重置浏览路径到挂载根
- **上传目标**：上传区下拉 `#cloudUploadMountSelect`；`underSelected` 判断当前浏览目录是否在所选挂载下（根挂载 `''` 除外），在则传 `currentPath`，否则传挂载根
- **登录**：`POST /api/auth/login` 获取 JWT，后续请求 `Authorization` 头直接带裸 token（无 Bearer 前缀）
- **列目录**：`GET /api/fs/list?path=绝对路径`，过滤只留文件夹+视频，文件夹在前
- **上传**：XHR `PUT /api/fs/put`，Header `File-Path`（encodeURIComponent 编码的远端路径）+ `As-Task: true`（可选）；成功后**延迟 3 秒**刷新列表（等待异步任务落盘）
- **删除**：`POST /api/fs/remove`，body `{ dir: 父目录, names: [文件名] }`
- **直链播放**：`GET /api/fs/get?path=` 取 `raw_url` 给 `<video>`
- **初始化防跳过**：auth.js 的 `switchSubTab('cloud')` 仅在 `window.initCloudPage` 存在时才标记已初始化，避免 cloud.js 未加载时永久卡在"未连接"
- **HTTPS 要求**：主应用若为 HTTPS，OpenList 必须配置受信 CA 证书（自签名会被浏览器 `ERR_CERT_AUTHORITY_INVALID` 拦截，fetch 无法绕过）

## 十五点八、宠物系统

### 宠物列表

| 宠物 | 实现方式 | 素材 | 互动 |
|---|---|---|---|
| 哈士奇 | SVG 绘制 + CSS 弹跳 | 无外部图 | 点击打招呼、拖拽、抱抱 |
| 暹罗猫 | SVG 绘制 + CSS 呼吸 | 无外部图 | 点击打招呼、拖拽、抱抱 |
| 猫猫 | GIF 动图切换 | `images/猫-待机.gif` / `猫-行走.gif` / `猫-打招呼.gif` | 点击打招呼动画、随机行走、拖拽、抱抱 |

### 猫猫 GIF 宠物（maoPet）

- **状态机**：待机 → 行走（每 9 秒随机 ±80px，4 秒线性过渡）→ 待机；点击 → 打招呼（2 秒）→ 待机
- **GIF 切换**：`initMao()` 用 `new Image()` 预加载三张 GIF 到浏览器缓存；`maoSetImg(url)` 直接赋缓存 URL（`data-src` 去重），**不清空 src**（避免大 GIF 重新解码期间空白）
- **定时器管理**：`maoWalkEndTimer`（行走→待机）、`maoGreetingTimer`（打招呼→待机）在开始行走/打招呼/拖拽时统一清理，杜绝旧定时器乱入导致行走时显示待机图
- **方向**：通过 `transform: scaleX(-1)` 镜像，左走朝左、右走朝右
- **抱抱系统**：拖拽到人物身上触发抱抱（跟随人物移动），5 秒自动放回底部继续行走
- **尺寸**：桌面端 130px；手机端 100px（超小屏 80px）

### 文件结构

| 文件 | 作用 |
|---|---|
| `index.html` | 宠物容器（`#huskyPet` / `#catPet` / `#maoPet`） |
| `js/pets.js` | 三只宠物的动画、拖拽、点击、抱抱逻辑 |
| `styles_layout.css` `.husky-pet` / `.cat-pet` / `.mao-pet` | 宠物样式与动画 |
| `styles_mobile.css` | 移动端宠物尺寸适配 |
| `images/猫-*.gif` | 猫猫宠物三张动图素材（静态文件，不进数据库） |

> 显示开关在设置页「显示设置」，存 `profiles.show_husky` / `show_cat` / `show_mao`。

## 十五点九、跳一跳游戏

### 功能

- **游戏嵌入**：`partials/game.html` 以 `<iframe src="Jump-master/index.html">` 加载跳一跳游戏（静态文件，部署在网站根目录 `Jump-master/`）
- **分数上报**：游戏结束时 `Jump-master/js/main.js` 通过 `postMessage({type:'jump_score', score})` 通知父页面
- **入库**：`js/game.js` 监听消息 → 写入 `game_scores` 表（`game='jump'`，带 `user_id`/`nickname`/`score`）
- **通知**：
  - 破对方记录：站内铃铛 + 邮件（受设置页"通知同时发送邮件"开关控制）
  - 未破记录：仅站内铃铛，不发邮件
  - 对方无成绩时不发邮件
- **排行榜**：游戏页显示情侣两人最高分排行（奖牌排序、自己行高亮），按 `score desc` 取前 100 条去重每人最高分

### 部署

1. Supabase SQL Editor 执行 `game_scores` 建表 SQL（见第三章）
2. upload.html 上传 `js/game.js`、`js/auth.js`、`partials/game.html`
3. 把整个 `Jump-master/` 文件夹原样传到网站托管根目录（与 index.html 同级，静态文件不进数据库）

### 移动端适配（Jump-master）

- `index.html` 加 `viewport` 禁止缩放
- `js/game.js` canvas 加 `touchstart`/`touchend`（按住蓄力、松手起跳）+ `touch-action:none`
- 结算弹窗 `max-width:90vw / max-height:90vh`

## 十六、下拉刷新（橡皮条）

- **文件**：`js/pull_refresh.js`（load_order=25）
- **HTML**：`index.html` 中的 `#pullRefreshIndicator` 元素
- **CSS**：`styles.css` 中的 `.pull-refresh-indicator` 样式
- **触发条件**：页面在顶部（`scrollY === 0`）时手指下拉超过 70px
- **排除元素**：拖拽人物/宠物（`.boy-pet, .girl-pet, .husky-pet, .cat-pet, .mao-pet`）时不触发
- **流程**：下拉显示指示器 → 超过阈值显示"松开刷新" → 松手刷新页面

## 十七、分页功能

相册、留言、日志均使用上一页/下一页分页（非"加载更多"）：

| 模块 | 文件 | 每页数量 | 分页器 ID |
|---|---|---|---|
| 相册 | `js/home.js` | 6 张 | `galleryPager` |
| 视频 | `js/video.js` | 6 个 | `videoPager` |
| 留言 | `js/home.js` | 5 条 | `messagePager` |
| 日志 | `js/journal.js` | 5 条 | `journalPager` |

- 分页器样式：`[上一页] 1 / 3 [下一页]`，首尾页禁用对应按钮
- 删除当前页最后一项时自动修正页码
- 分页函数通过 `window.xxxPrevPage` / `window.xxxNextPage` 暴露给 onclick

## 十八、upload.html AI 代码助手

### 功能

在「在线管理」Tab 右侧面板，集成智谱 AI 代码助手：
- **自动引用**：切到 Tab 时预加载所有 md 文件作为上下文
- **手动引用**：资源列表中点 📎 按钮引用代码文件
- **流式输出**：与设置页 AI 助手相同的流式读取机制
- **代码应用**：AI 回复中的代码块有「应用到编辑器」按钮
- **发送后清空**：每轮对话发送后自动清空所有引用文件

### 引用机制

| 引用类型 | 标识 | 行为 |
|---|---|---|
| 自动引用（md） | 🔵 蓝底 `[自动]` | 切 Tab 时预加载，可点 × 取消 |
| 手动引用（代码） | 🩷 粉底 | 点 📎 按钮添加，可点 × 取消 |

> 发送对话后，所有引用（自动 + 手动）全部清空。下次切 Tab 时重新预加载 md 文件。

## 十九、upload.html 资源版本备份

### 自动备份

- 在「在线管理」Tab 保存文件时，系统自动备份当前版本到 `asset_backups` 表
- 每个文件最多保留 10 个版本，超过自动清理最早版本（通过 `prune_backups` RPC 函数）
- **还原后保存不创建新备份**：通过 `_skipBackup` 标志控制，还原操作后保存直接更新文件不备份

### 全部下载（ZIP）

- 点击「全部下载（ZIP）」按钮，将所有资源打包为 ZIP 下载
- ZIP 结构：`styles.css`、`styles_layout.css`、`styles_mobile.css`、`ARCHITECTURE.md`、`app_containers.json`、`partials/`、`js/`
- JSZip 动态加载（多 CDN 备用），加载前禁用 AMD 避免与 Monaco 冲突

## 二十、开发规范

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
11. **CSS 文件 type=css, load_order=0**，确保最先加载（多个 CSS 文件按 file_path 排序）
12. **HTML 文件必须指定 container_id**，对应 app_containers 表中的 container_id
13. **JS 文件 load_order 必须在 10-26 之间**，auth.js(26) 必须最后
14. **新增文件后需更新两处**：upload.html 的 FILES 数组（本地上传用）和本文档的文件结构
15. **upload.html 保存资源后必须调用 `bumpAssetsVersion()`** 更新版本号，否则用户缓存不会刷新
16. **文件字符数限制 20000**：超过的文件必须拆分（如 styles.css 拆成 3 个、characters.js 拆成 2 个、game.js 拆成 2 个）
