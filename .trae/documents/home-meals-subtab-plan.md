# 首页新增子标签「一日三餐」实现计划

## Context

用户希望在首页（home 页）新增一个子标签页「一日三餐」，核心用途是**拍照记录今天吃了什么**，两人共用同一个空间互相看对方今天的三餐。

已确认的需求（用户已选择）：
- **上传规则**：不限张数，每张自己选餐次（早餐 / 午餐 / 晚餐 / 加餐）
- **记录字段**：照片 + 可选备注 + 好吃评分（1-5 星）
- **展示方式**：按日期分组、倒序（今天在最上），配上一页 / 下一页分页（分页单位 = 天，每页 7 天）

项目现状（已读代码确认）：首页子 Tab 机制已非常成熟，新增子 Tab **不需要改 `app_containers` 容器表、也不需要改 `index.html`**，只要改 `partials/home.html`（按钮 + 面板）+ 新增一个 JS 模块，并在 `auth.js` 的 `switchSubTab` 里加一个懒加载分支即可。子 Tab 栏已有 `overflow-x: auto`，再加第 9 个按钮会自动横向滚动，无需改布局。

---

## 一、数据库：新增 `meals` 表

在 `upload.html` 的「建表 SQL」Tab 内容和 Supabase SQL Editor（或「SQL 执行」Tab）中追加：

```sql
-- 7. 一日三餐表
CREATE TABLE IF NOT EXISTS meals (
    id              BIGSERIAL PRIMARY KEY,
    meal_date       DATE NOT NULL DEFAULT CURRENT_DATE,  -- 归属日期（可补传昨天）
    meal_type       TEXT NOT NULL DEFAULT '午餐',          -- 早餐 / 午餐 / 晚餐 / 加餐
    img_url         TEXT NOT NULL,                        -- ImgBB 图片地址
    delete_url      TEXT,                                -- ImgBB 远程删除地址
    note            TEXT,                                -- 备注（可选）
    rating          SMALLINT,                            -- 好吃评分 1-5（可选）
    uploader_email  TEXT,                                -- 上传者邮箱
    created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_meals" ON meals FOR SELECT USING (true);
CREATE POLICY "allow_write_meals" ON meals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals (meal_date DESC, created_at DESC);
```

字段命名刻意与现有 `gallery` 表保持一致（`img_url` / `delete_url`），策略命名沿用项目习惯（`allow_read_xxx` / `allow_write_xxx`）。

---

## 二、改动文件清单

| 文件 | 改动 |
|---|---|
| `partials/home.html` | 子 Tab 按钮 + `#subTab-meals` 面板 |
| `js/meals.js` | **新建**，全部三餐逻辑 |
| `js/auth.js` | `switchSubTab` 增加 `meals` 懒加载分支（约 4 行） |
| `styles_layout.css` | 追加 `.meal-*` 少量样式 |
| `styles_mobile.css` | 移动端星星尺寸微调 |
| `js/loader.js` | `LOCAL_FILES` 登记 `js/meals.js` 并顺延 order |
| `upload.html` | `FILES` 数组登记 + `CREATE_SQL` 追加 meals 建表语句 |
| `ARCHITECTURE.md` | 文件结构 + 新增「一日三餐」章节 |

### 1. `partials/home.html`

**(a) 子 Tab 按钮**：在「相册」按钮之后插入（[home.html](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/partials/home.html#L17-L19) 附近），沿用现有 `class="sub-tab"` + `data-sub` 写法：

```html
<button onclick="switchSubTab('meals')" class="sub-tab" data-sub="meals">
    <i class="fa fa-cutlery"></i> 一日三餐
</button>
```

**(b) 面板**：紧跟在 `#subTab-gallery` 之后插入 `#subTab-meals`（`class="sub-tab-content hidden"`），结构仿照相册面板外层的 `bg-white/80 backdrop-blur rounded-3xl p-6 card-shadow`：

- 餐次选择：`#mealTypeChips`，4 个 `<button class="meal-chip" data-meal="早餐|午餐|晚餐|加餐">`
- 日期：`<input type="date" id="mealDate">`（默认今天，可改成昨天补传）
- 备注：`<input id="mealNote" placeholder="这顿吃了啥？（可选）">`
- 评分：`#mealStars` 内 5 个 `<i class="fa fa-star-o" data-star="1..5">`，默认 0 星
- 上传：`<input type="file" id="mealFileInput" accept="image/*" class="hidden" onchange="window.uploadMeal(this)">` + 按钮触发 `click()`
  - **不写 `capture="environment"`**：让手机浏览器弹出「拍照 / 从相册选择」二选一，比强制开相机更实用
- 列表：`#mealList`（日期分组容器）+ `#mealPager`

### 2. `js/meals.js`（新建）

严格按项目规范：**IIFE 包裹**，顶层不写 `const sb`，用 `window.sb`；初始化不需要 `DOMContentLoaded`；需要被 `onclick` 调用的函数挂到 `window`。

复用现有能力（不重复造轮子）：
- `window.compressImage(file, 1920, 0.8)`（[auth.js](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/js/auth.js#L441-L474)）
- 上传 ImgBB 的 fetch 写法、校验逻辑（32MB / jpg-png-webp）与按钮文案切换，**照抄** [home.js](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/js/home.js#L13-L68)
- `window.openPreview(url)` 看大图
- `window.sendNotification('photo', '🍚 上传了「午餐」照片')`
- `.img-card` / `.del-btn` 样式类（[styles.css](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/styles.css#L183-L199)、[styles_layout.css](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/styles_layout.css#L572-L578)）

关键函数：
- `initMealsPage()`：`#mealDate` 默认今天；按当前时间自动选中餐次（<10 早 / <15 午 / <20 晚 / 其余加餐）；绑定星星点击；调 `loadMeals()`
- `uploadMeal(e)`：校验 → 压缩 → ImgBB → `sb.from('meals').insert({ meal_date, meal_type, img_url, delete_url, note, rating, uploader_email: window.myRpsEmail })` → 通知 → `loadMeals()`
- `loadMeals()`：`sb.from('meals').select('*').order('meal_date', {ascending:false}).order('created_at', {ascending:false})` → 在 JS 里按 `meal_date` 分组
- `renderMeals()`：`MEALS_DAYS_PER_PAGE = 7` 天/页；组标题「今天 / 昨天 / 8月18日 · 2 张」；组内卡片栅格（复用相册卡片 DOM 结构 + 餐次 badge + 备注 + 星星 + 删除按钮）；底部渲染 `上一页 1/3 下一页` 分页器
- `deleteMeal(id, delete_url)`：confirm → best-effort `fetch(delete_url)` → 删库记录 → `loadMeals()`；删除导致某天分组消失时自动修正页码
- `window.pickMealStar(n)`：设置评分并重绘星星
- 导出：`uploadMeal / loadMeals / renderMeals / deleteMeal / pickMealStar / initMealsPage / mealPrevPage / mealNextPage`

### 3. `js/auth.js`

在 [switchSubTab](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/js/auth.js#L356-L415) 末尾追加（照抄 `cloud` 那段的「函数存在才标记」防御写法）：

```js
if (sub === 'meals' && !_subTabInited.meals) {
    if (window.initMealsPage) {
        _subTabInited.meals = true;
        window.initMealsPage();
    }
}
```

`initHomePage` **不需要**改（三餐不是默认 Tab，走懒加载）。

### 4. CSS

`styles_layout.css` 追加：

```css
/* ============ 一日三餐 ============ */
.meal-chip { padding: 6px 16px; border-radius: 999px; border: 1px solid #f3c6ce; background: #fff; color: #9a7c81; font-size: 14px; cursor: pointer; }
.meal-chip.active { background: #ff6b8b; border-color: #ff6b8b; color: #fff; }
.meal-group-title { color: #ff6b8b; font-weight: 600; font-size: 15px; }
.meal-badge { background: #fff1f3; color: #e04c6e; border-radius: 999px; padding: 2px 10px; font-size: 12px; }
.meal-star { color: #f0b429; font-size: 22px; cursor: pointer; }
```

`styles_mobile.css` 移动端把 `.meal-star` 放大到 `28px`、`.meal-chip` 稍增内边距，保证触控命中区（`.del-btn` 已有全局缩小规则，无需新增）。

### 5. `js/loader.js` + `upload.html` 登记

- [loader.js](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/js/loader.js#L15-L45) 的 `LOCAL_FILES`：插入 `{ path: 'js/meals.js', type: 'js', container: null, order: 28 }`，并把 `js/pull_refresh.js` 28→29、`js/auth.js` 29→30（保持 order 唯一、auth 最后）
- [upload.html](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/upload.html#L793-L824) 的 `FILES`：做完全相同的三处改动
- [upload.html](file:///c:/Users/Administrator/Desktop/情侣空间/github-v/keai/upload.html#L695-L788) 的 `CREATE_SQL`：追加第一节的 meals 建表语句

> 注意：`js/loader.js`、`js/config.js`、`index.html` 是**本地文件**，不进数据库。改 `LOCAL_FILES` 只影响本地开发；线上加载顺序由 `app_assets.load_order` 决定，执行「本地上传」时会按新的 `FILES` 自动 upsert（含 order）。

### 6. `ARCHITECTURE.md`

- 文件结构补 `js/meals.js`；`partials/home.html` 注释里的子 Tab 列表加「一日三餐」
- 新增章节「十五点十、一日三餐」：功能、表结构、建表 SQL、函数清单、分组分页规则
- 更新受影响的加载顺序数字（`pull_refresh.js` 29、`auth.js` 30）

---

## 三、部署步骤

1. `upload.html` →「SQL 执行」Tab 执行 meals 建表 SQL（需已登录，`exec_ddl` 仅 authenticated 可用）
2. `upload.html` →「本地上传」→「全部上传」（会自动 `bumpAssetsVersion()` 刷新版本号）
3. 刷新页面，本地缓存版本号不一致 → 自动重新拉取资源

---

## 四、验证方式

**本地**：项目根目录起静态服务器（`python -m http.server 8000`，或直接 `file://` 打开 `index.html`），登录后逐项验证：

1. 首页子 Tab 栏出现「一日三餐」，切过去 → 默认日期 = 今天、餐次按当前时间自动高亮
2. 选一张图点击上传 → 按钮文案走「压缩中… / 上传中…」→ 列表出现新卡片并归入「今天」分组
3. 填备注 + 点 3 颗星再传一张 → 去 Supabase 表编辑器核对 `meal_date / meal_type / note / rating / uploader_email` 字段正确
4. 造 4 天以上的数据 → 翻页正常，首末页按钮禁用状态正确
5. 删掉某天最后一张 → 该天分组消失、页码不越界
6. 刷新页面 → 停留/恢复到「一日三餐」Tab（`_lastSubTab`）
7. 浏览器缩到手机宽度：子 Tab 栏可横向滑动、卡片栅格与星星触控命中区正常
8. 回归检查：相册 / 视频 / 网盘 子 Tab 切换与懒加载初始化未受影响
