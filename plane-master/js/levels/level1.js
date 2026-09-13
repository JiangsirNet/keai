/* 第 1 关 · 星夜初航（含剧情） */
// 如需硬绑定某组剧情，取消下一行注释并改为对应剧情组名（优先级低于 URL ?story=）
// window.LEVEL_STORY_GROUP = '默认';
window.LEVEL_INDEX = 0;
window.LEVEL_TOTAL = 10;
window.LEVEL_HAS_STORY = false;   // 剧情暂时关闭（新玩法测试期），改回 true 可恢复
window.LEVEL_CONFIG = {
    name: '星夜初航',
    bg: 'image/bg1.jpg',
    hpScale: 1.0,
    freqScale: 1.0,
    bossAt: 1700,
    bossHp: 150,
    bossSkin: 'image/boss_l1.png',
    waves: [
        [60,'e1'],[150,'e1'],[240,'e1'],[330,'e1'],[420,'e1'],[510,'e1'],[600,'e1'],
        [260,'e2'],[520,'e2'],[820,'e2'],[1400,'e2'],
        [300,'e5'],[500,'e5'],[700,'e5'],[900,'e5'],
        [700,'e3'],[950,'e3'],[1200,'e3'],
        [1350,'e1'],[1450,'e5'],[1550,'e1'],[1600,'e5']
    ]
};
