/**
 * 一日三餐
 * 拍照上传今天的饭菜（餐次 + 备注 + 好吃评分），按日期分组倒序展示 + 分页
 * load_order=28（在 auth.js 之前）
 */

(function() {
    const sb = window.sb;

    // 分页单位 = 天（每页显示 7 天）
    const MEALS_DAYS_PER_PAGE = 7;

    let mealData = [];    // 全部记录（按日期倒序）
    let mealGroups = [];  // 分组结果 [{ date, items }]
    let mealPage = 1;     // 当前第几页
    let mealType = '午餐'; // 当前选中的餐次
    let mealRating = 0;   // 当前选中的评分

    let pendingFile = null;     // 已选待上传的文件
    let pendingPreviewUrl = ''; // 预览用的 objectURL

    // ===== 小工具 =====
    function pad2(n) { return String(n).padStart(2, '0'); }
    function dateToStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
    function todayStr() { return dateToStr(new Date()); }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 分组标题：今天 / 昨天 / 8月18日
    function groupTitle(dateStr) {
        if (dateStr === todayStr()) return '今天';
        const y = new Date();
        y.setDate(y.getDate() - 1);
        if (dateStr === dateToStr(y)) return '昨天';
        const p = String(dateStr).split('-');
        return p.length === 3 ? `${Number(p[1])}月${Number(p[2])}日` : String(dateStr);
    }

    function starIcons(rating) {
        const r = Number(rating) || 0;
        let html = '';
        for (let i = 1; i <= 5; i++) html += `<i class="fa ${i <= r ? 'fa-star' : 'fa-star-o'}"></i>`;
        return html;
    }

    // ===== 上传表单 =====
    function renderFormStars() {
        const box = document.getElementById('mealStars');
        if (!box) return;
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<i class="fa ${i <= mealRating ? 'fa-star' : 'fa-star-o'}" data-star="${i}"></i>`;
        }
        box.innerHTML = html;
    }

    function bindFormStars() {
        const box = document.getElementById('mealStars');
        if (!box || box.dataset.bound) return;
        box.dataset.bound = '1';
        box.addEventListener('click', (e) => {
            const el = e.target.closest('i[data-star]');
            if (!el) return;
            const n = Number(el.dataset.star);
            mealRating = (mealRating === n) ? 0 : n;  // 再点同一颗星取消
            renderFormStars();
        });
    }

    function selectMealType(t) {
        mealType = t;
        document.querySelectorAll('#mealTypeChips .meal-chip').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.meal === t);
        });
    }

    function bindChips() {
        const box = document.getElementById('mealTypeChips');
        if (!box || box.dataset.bound) return;
        box.dataset.bound = '1';
        box.addEventListener('click', (e) => {
            const btn = e.target.closest('.meal-chip');
            if (btn && btn.dataset.meal) selectMealType(btn.dataset.meal);
        });
    }

    // 按当前时间自动选餐次
    function autoPickMealType() {
        const h = new Date().getHours();
        selectMealType(h < 10 ? '早餐' : (h < 15 ? '午餐' : (h < 20 ? '晚餐' : '加餐')));
    }

    // ===== 选图 → 预览弹窗 → 确认上传 =====
    function mealFileSelected(input) {
        const file = input.files[0];
        input.value = '';  // 立即清空，允许连续选同一张
        if (!file) return;

        if (!window.IMGBB_KEY) {
            alert('缺少ImgBB密钥，请重新登录');
            return;
        }
        if (file.size > 32 * 1024 * 1024) {
            alert('图片不能超过32MB');
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            alert('仅支持jpg/png/webp');
            return;
        }

        if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
        pendingFile = file;
        pendingPreviewUrl = URL.createObjectURL(file);

        resetMealForm();

        const img = document.getElementById('mealPreviewImg');
        if (img) img.src = pendingPreviewUrl;

        const modal = document.getElementById('mealModal');
        if (!modal) {
            // 页面里的旧版 home.html 还没有弹窗，避免静默无反应
            alert('页面资源版本过旧（缺少确认弹窗），请在 upload.html 里「全部上传」后强制刷新页面');
            return;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (modal.getBoundingClientRect().width === 0) {
            // 弹窗被挂在某个 display:none 的祖先（如其它子 Tab 面板）里时会静默不可见
            alert('确认弹窗不可见：它必须放在所有 .sub-tab-content 面板之外');
        }
    }

    // 每次打开弹窗恢复默认：日期=今天、按时间选餐次、0 星、备注清空
    function resetMealForm() {
        const dateEl = document.getElementById('mealDate');
        if (dateEl) dateEl.value = todayStr();
        const noteEl = document.getElementById('mealNote');
        if (noteEl) noteEl.value = '';
        mealRating = 0;
        autoPickMealType();
        renderFormStars();
    }

    function mealCloseModal(e) {
        if (e && e.target !== e.currentTarget) return;
        const modal = document.getElementById('mealModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        if (pendingPreviewUrl) {
            URL.revokeObjectURL(pendingPreviewUrl);
            pendingPreviewUrl = '';
        }
        pendingFile = null;
        const img = document.getElementById('mealPreviewImg');
        if (img) img.src = '';
    }

    function mealReselect() {
        const input = document.getElementById('mealFileInput');
        if (input) input.click();
    }

    async function mealConfirmUpload() {
        if (!pendingFile) {
            alert('请先选择照片');
            return;
        }
        const btn = document.getElementById('mealConfirmBtn');
        const type = mealType;
        const dateEl = document.getElementById('mealDate');
        const date = (dateEl && dateEl.value) || todayStr();
        const noteEl = document.getElementById('mealNote');
        const note = (noteEl && noteEl.value ? noteEl.value : '').trim();
        const rating = mealRating;

        const file = pendingFile;
        const oldText = btn.innerHTML;
        btn.innerText = '压缩中...';
        btn.disabled = true;

        try {
            const compressed = await window.compressImage(file, 1920, 0.8);
            btn.innerText = '上传中...';

            const formData = new FormData();
            formData.append('image', compressed);
            formData.append('key', window.IMGBB_KEY);

            const res = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (!result.success) throw new Error((result.error && result.error.message) || '上传失败');

            await sb.from('meals').insert({
                meal_date: date,
                meal_type: type,
                img_url: result.data.url,
                delete_url: result.data.delete_url,
                note: note || null,
                rating: rating || null,
                uploader_email: window.myRpsEmail || null
            });

            window.sendNotification('photo', `🍚 上传了「${type}」照片`);

            mealCloseModal();
            await loadMeals();
        } catch (err) {
            console.error(err);
            alert('照片上传失败：' + err.message);
        } finally {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }

    // ===== 列表 =====
    function groupByDate(list) {
        const map = new Map();
        (list || []).forEach(item => {
            const key = item.meal_date || '';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(item);
        });
        return Array.from(map, ([date, items]) => ({ date, items }));
    }

    async function loadMeals(keepPage) {
        const box = document.getElementById('mealList');
        if (box && !keepPage) box.innerHTML = '<div class="text-center text-gray-400 py-10">加载中...</div>';

        const { data, error } = await sb.from('meals')
            .select('*')
            .order('meal_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[meals] 加载失败', error);
            if (box) box.innerHTML = '<div class="text-center text-red-400 py-10">加载失败，请稍后重试</div>';
            return;
        }

        const page = keepPage ? mealPage : 1;
        mealData = data || [];
        mealGroups = groupByDate(mealData);
        mealPage = page;
        renderMeals();
    }

    function renderCard(item) {
        const stars = item.rating ? `<div class="meal-stars-sm">${starIcons(item.rating)}</div>` : '';
        const note = item.note ? `<div class="meal-note">${escapeHtml(item.note)}</div>` : '';
        return `
            <div class="relative">
                <img src="${item.img_url}" loading="lazy"
                    class="aspect-square rounded-xl object-cover w-full cursor-pointer hover:opacity-90"
                    onclick="openPreview('${item.img_url}')">
                <span class="meal-badge absolute top-2 left-2">${escapeHtml(item.meal_type || '')}</span>
                <button onclick="window.deleteMeal('${item.id}','${item.delete_url || ''}')"
                    class="del-btn absolute top-2 right-2 bg-red-500 text-white text-sm shadow-lg opacity-80 hover:opacity-100">
                    <i class="fa fa-trash"></i>
                </button>
                ${stars}
                ${note}
            </div>
        `;
    }

    function renderMeals() {
        const box = document.getElementById('mealList');
        const pager = document.getElementById('mealPager');
        if (!box) return;

        if (mealGroups.length === 0) {
            box.innerHTML = '<div class="text-center text-gray-400 py-10">还没有记录，拍一张今天的饭菜吧🍚</div>';
            if (pager) pager.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(mealGroups.length / MEALS_DAYS_PER_PAGE);
        if (mealPage > totalPages) mealPage = totalPages;
        if (mealPage < 1) mealPage = 1;

        const groups = mealGroups.slice((mealPage - 1) * MEALS_DAYS_PER_PAGE, mealPage * MEALS_DAYS_PER_PAGE);

        box.innerHTML = groups.map(g => `
            <div>
                <div class="meal-group-title">${groupTitle(g.date)}<span class="meal-badge">${g.items.length} 张</span></div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    ${g.items.map(renderCard).join('')}
                </div>
            </div>
        `).join('');

        if (pager) {
            pager.innerHTML = totalPages > 1 ? `
                <button class="pager-btn" onclick="window.mealPrevPage()" ${mealPage <= 1 ? 'disabled' : ''}>上一页</button>
                <span class="text-sm text-gray-500">${mealPage} / ${totalPages}</span>
                <button class="pager-btn" onclick="window.mealNextPage()" ${mealPage >= totalPages ? 'disabled' : ''}>下一页</button>
            ` : '';
        }
    }

    async function deleteMeal(id, deleteUrl) {
        if (!confirm('确定删除这张照片？无法恢复！')) return;
        if (deleteUrl) {
            try {
                await fetch(deleteUrl);
            } catch (e) {
                console.log('远程图片删除失败，仅清理数据库记录');
            }
        }
        await sb.from('meals').delete().eq('id', id);
        loadMeals(true);  // 保持当前页，renderMeals 内会自动修正越界页码
    }

    // ===== 初始化（首次切到该子 Tab 时由 auth.js 调用）=====
    async function initMealsPage() {
        bindChips();
        bindFormStars();
        resetMealForm();
        await loadMeals();
    }

    window.initMealsPage = initMealsPage;
    window.mealFileSelected = mealFileSelected;
    window.mealConfirmUpload = mealConfirmUpload;
    window.mealCloseModal = mealCloseModal;
    window.mealReselect = mealReselect;
    window.loadMeals = loadMeals;
    window.renderMeals = renderMeals;
    window.deleteMeal = deleteMeal;
    window.mealPrevPage = () => { mealPage--; renderMeals(); };
    window.mealNextPage = () => { mealPage++; renderMeals(); };

})();
