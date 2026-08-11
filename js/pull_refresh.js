/**
 * 下拉刷新（微信风格 - 拉出空白区域）
 * 移动端页面顶部下拉，整个页面跟随手指下移，松手超过阈值触发刷新
 * 排除人物/宠物拖拽区域
 */

(function () {
    function initPullToRefresh() {
        const indicator = document.getElementById('pullRefreshIndicator');
        const icon = document.getElementById('pullRefreshIcon');
        if (!indicator || !icon) return;

        const THRESHOLD = 70;
        const MAX_PULL = 120;
        let startY = 0, pulling = false, refreshing = false;
        let currentDist = 0;

        // 找到要移动的主容器
        function getMoveTarget() {
            return document.getElementById('mainPage') || document.body;
        }

        document.addEventListener('touchstart', (e) => {
            if (refreshing || window.scrollY > 0) return;
            if (e.target.closest('.boy-pet, .girl-pet, .husky-pet, .cat-pet')) return;
            startY = e.touches[0].clientY;
            pulling = true;
            currentDist = 0;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!pulling || refreshing) return;
            const dist = e.touches[0].clientY - startY;
            if (dist <= 0) {
                currentDist = 0;
                getMoveTarget().style.transform = '';
                indicator.style.opacity = '0';
                return;
            }
            // 阻尼效果：越拉越费劲
            currentDist = Math.min(dist * 0.5, MAX_PULL);
            // 移动整个页面
            getMoveTarget().style.transform = 'translateY(' + currentDist + 'px)';
            getMoveTarget().style.transition = 'none';
            // 显示指示器，跟随下拉距离调整透明度和旋转
            const progress = Math.min(currentDist / THRESHOLD, 1);
            indicator.style.opacity = progress;
            indicator.style.top = (currentDist - 50) + 'px';
            icon.style.transform = 'rotate(' + (progress * 360) + 'deg)';
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!pulling || refreshing) return;
            pulling = false;
            const target = getMoveTarget();
            target.style.transition = 'transform 0.3s ease';

            if (currentDist >= THRESHOLD) {
                // 触发刷新：页面回弹到指示器高度，转圈刷新
                refreshing = true;
                target.style.transform = 'translateY(50px)';
                indicator.style.transition = 'top 0.3s ease, opacity 0.3s ease';
                indicator.style.top = '5px';
                indicator.style.opacity = '1';
                icon.style.transform = '';
                indicator.classList.add('refreshing');
                setTimeout(() => location.reload(), 800);
            } else {
                // 回弹隐藏
                target.style.transform = '';
                indicator.style.transition = 'top 0.3s ease, opacity 0.3s ease';
                indicator.style.opacity = '0';
                indicator.style.top = '-50px';
                icon.style.transform = '';
            }
        }, { passive: true });
    }

    initPullToRefresh();
})();
