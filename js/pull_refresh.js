// 下拉刷新（橡皮条）
(function () {
    function initPullToRefresh() {
        const indicator = document.getElementById('pullRefreshIndicator');
        const icon = document.getElementById('pullRefreshIcon');
        const text = document.getElementById('pullRefreshText');
        if (!indicator || !icon || !text) return;
        const THRESHOLD = 70;
        let startY = 0, pulling = false, refreshing = false;

        document.addEventListener('touchstart', (e) => {
            if (refreshing || window.scrollY > 0) return;
            if (e.target.closest('.boy-pet, .girl-pet, .husky-pet, .cat-pet')) return;
            startY = e.touches[0].clientY;
            pulling = true;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!pulling || refreshing) return;
            const dist = e.touches[0].clientY - startY;
            if (dist <= 0) { indicator.style.top = '-60px'; return; }
            const offset = Math.min(dist * 0.5, THRESHOLD + 20);
            indicator.style.top = (offset - 50) + 'px';
            if (dist >= THRESHOLD) {
                indicator.classList.add('ready');
                text.textContent = '松开刷新';
            } else {
                indicator.classList.remove('ready');
                text.textContent = '下拉刷新';
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (!pulling || refreshing) return;
            pulling = false;
            const dist = parseInt(indicator.style.top || '-60') + 50;
            if (dist >= THRESHOLD) {
                refreshing = true;
                indicator.style.top = '10px';
                indicator.classList.remove('ready');
                indicator.classList.add('refreshing');
                icon.className = 'fa fa-refresh';
                text.textContent = '刷新中...';
                setTimeout(() => location.reload(), 600);
            } else {
                indicator.style.top = '-60px';
                indicator.classList.remove('ready');
            }
        }, { passive: true });
    }

    initPullToRefresh();
})();
