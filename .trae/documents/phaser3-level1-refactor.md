# Phaser 3 重构第 1 关 · 实施计划

## Context
现有游戏为原生 DOM 渲染（engine.js 用 div+offsetLeft 移动实体，setInterval 20ms 主循环），性能与可维护性受限。目标：用 Phaser 3 重构第 1 关（星夜初航），新建页面与 DOM 版并存验证，玩法机制、数值、难度与原版完全一致。已与用户确认：
- 新建 `level1-phaser.html`，**不改动**现有引擎
- 暂不包含新玩法技能系统（悬停/拉升/氮气/导弹/激光/背包），补给拾取**直接生效**
- Phaser 库下载到本地 `lib/phaser.min.js`（离线可玩）
- 画布逻辑尺寸 450×800（9:16），`Phaser.Scale.FIT + CENTER_BOTH`，与主站 9:16 舞台决策一致

## 新增文件（仅 3 个）
1. `plane-master/lib/phaser.min.js` — `curl -L -o lib/phaser.min.js https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js`
2. `plane-master/level1-phaser.html` — DOM：`contentdiv > maindiv > #game 容器`（canvas 铺满）+ 复用的 HUD（levelBanner / scorediv / suspenddiv / enddiv / levelClearBox / gradingBox）+ `<audio music/bg.mp3 loop autoplay>`；头部照抄 level1.html 的 supabase/emailjs CDN；script 顺序：`lib/phaser.min.js` → `js/score.js?v=27` → `js/levels/level1.js`（复用 LEVEL_CONFIG）→ `js/phaser/level1-scene.js`
3. `plane-master/js/phaser/level1-scene.js` — 全部游戏逻辑（单 GameScene，Arcade 物理）

**不改动**：level1.html、engine.js、js/levels/*.js、score.js、css/main.css、image/、music/、index.html

## 架构
- 单场景 GameScene：`preload` 加载资源 → `create` 建 HUD 同步/刷怪时间表/碰撞注册 → `update` 驱动背景滚动/指针跟随/非物理轨迹（e3 抛物线、e5 圆弧、追踪弹）
- 物理：Arcade（保持默认 `fixedStep: true` 固定 60Hz 步长），仅 AABB。4 个 Group：`myBullets / enemyBullets / enemys / supplys`，玩家独立 sprite；overlap 注册：我弹×敌机、敌弹×玩家、敌机×玩家、补给×玩家
- e3/e5 与追踪弹不走物理体，update 手动改 x/y；其他实体 setVelocity
- HUD 全部复用 DOM+CSS：canvas 只管战斗渲染，分数/生命/横幅/结算写 DOM；`endGame/next/end/nextLevel/retryLevel` 挂 window 供按钮 onclick

## 帧率公平性与性能（跨设备一致）
- **禁用帧计数**：所有运动/节奏基于毫秒与秒速，不依赖 rAF 次数
- **物理定步长**：Arcade 默认 `fixedStep: true`（60Hz 固定步长积分），子弹运动与碰撞判定在 60/120/144Hz 屏幕下逐步一致
- **手动轨迹用 delta**：update(time, delta) 中 e3/e5 轨迹、追踪弹水平收敛、背景滚动均 `x += v * delta/1000`
- **计时器全毫秒制**：刷怪表/开火/Boss 三段节奏/无敌时间均 `this.time.addEvent` 或时间戳比较
- **delta 钳制**：单步 delta 上限 50ms（切后台返回防瞬移、防穿透）
- **性能**：血条/受击显示用 `Rectangle` 缩放（仅数值变化时更新，不做每帧 Graphics 重绘）；实体规模 <100，4 Group overlap 无压力；纹理音频 preload 一次加载

## 数值换算（原 20ms/帧：px/帧 ×50 = px/s；帧间隔 ×20 = ms）
| 项目 | 原值 | Phaser 值 |
|---|---|---|
| 背景滚动 2px/帧 | 3 层 960px 图循环 | 双 Image(450×960) 向下 100px/s，top>0 时回移 960（照抄原逻辑） |
| 我方子弹 20px/帧 | 上移 | velocityY = -1000 |
| 敌弹 speedY×1.5px/帧 | 直射5/导弹6/boss1 3/boss3 10 | 375 / 450 / 225 / 750 px/s |
| e1/e2/e5 直下 speed 2/1/4 | 100 / 50 / 200 px/s | |
| 我方开火 default 10帧 | 200ms（fire 280 / laser 160 / shotgun 240 / 双发 200） | |
| 敌机开火 mark%freq | e1 3000ms / e2 1400 / e3 2000 / e5 2400 | 全局节拍同步：`floor(t/20)%freq==0` |
| Boss 出场 bossAt=1700 | 34s 延时 | |
| Boss 弹幕循环 122/172/216帧 | 2440/3440/4320ms 三个独立 timer | |

## 实体规格（level1 波次仅 e1/e2/e3/e5，hpScale=1）
- **玩家**：3HP、60×60（plane1.png）、pointermove 跟随（`pointer.worldX/worldY`，FIT 缩放由 Phaser 自动逆变换）、Clamp 画布内；中弹 -1HP + 3s 无敌闪烁（alpha 0.4 交替）；被敌机相撞 HP=0；生命条写 DOM `#life` 宽 = hp×20px
- **武器**：default(bullet.png 15×37 atk2) / twobullets(bullet2.png 30×37 atk3) / fire(fire.png 35×72 atk4 crit.1) / laser(laser.png 12×40 atk2 crit.3) / shotgun(shotgun.png 3发 atk1 水平 ±150px/s)；伤害公式 `dmg=(atk+atkExtra)×(1+isCrit×critDmg)`；射速补给每级 -20ms（5 级上限，下限 40ms）
- **敌机**：e1 hp4 50×34 分10 直下3s开火 / e2 hp26 70×60 分30 直下1.4s开火+**死后掉落** / e3 hp20 84×54 分40 抛物线(left+=100px/s, top=0.008×left²) 追踪弹 / e5 hp4 45×37 分10 圆弧轨迹 200px/s；越界（下>800/左右容差）计 missed；受击双帧图 320ms + 头顶血条
- **敌弹**：直射 e-bullet1.png 14×14 / 追踪 particle.png 35×32（直下+每帧水平收敛向玩家 `v=(弹x-玩家x)/40×50`）/ Boss 扇形 b1.png 20×19 6发 speedX -3..2 / Boss 导弹 b2.png 15×49 3发 旋转追踪 / Boss 大弹 b3.png 35×124 2发
- **Boss**：hp150、150×132（boss_l1.png 双帧）、34s 时从 (-50,50) 入场向中心 x=225 50px/s；三 timer 循环：2440ms 左右移动+6发扇形 / 3440ms 3 导弹（机左/中/右）/ 4320ms 回中+2 大弹；头顶血条宽 150 按比例；死亡 → 爆炸 1s → 2s 后 levelClearBox
- **补给**：e2 爆炸结束（600ms）时 randomInt(0,7) 掉 8 种之一，100px/s 下落，30×30 彩色 Graphics 底 + 图标（bulletspeed/twobullets/life/fire/laser/crit/bullet(攻击)/shotgun.png），拾取播 supply.mp3 **立即生效**（换武器/+1命/+0.2暴击/+1攻击/射速）
- **爆炸**：boom.png + tween（scale×2 + fade 600ms，Boss 1000ms）+ Explode01/02.ogg（boom.gif 不可用于 canvas）
- **双帧图加载**：`load.spritesheet('e1','image/e1.png',{frameWidth:宽/2,frameHeight:高})`（e1/e2/e3/e5/boss 均为横向双帧：正常+受击姿态，实现时核对实际图宽）；受击 setFrame(1) 320ms 后回 setFrame(0)
- **音频**：BGM 沿用 DOM audio 标签（首个 pointerdown 补 play() 解锁）；音效用 `this.sound.play`，首个 pointer 事件 `sound.resumeAll()`

## 流程（照抄原版）
- onload 自动 begin()：重置状态 → 关卡横幅 → 启动
- 刷怪：`LEVEL_CONFIG.waves` 每项 `time.addEvent({delay: t×20, once:true})` 生成对应敌机
- 过关：Boss 死 → 2s → levelClearBox（当前总分）→「进入下一关」`location.href='level2.html'` /「回到主页」index.html
- 失败：endGame('Failed') → 玩家爆炸+音效 → enddiv 显示 SCORE → `window.savePlaneScore(scores)` → 停止；「下一步」next() → gradingBox，评级按 destroyed 计数：>28 SSS / 24-28 AAA / 19-23 BBB / 14-18 CCC / ≤13 DDD → localStorage highScore/highgrade；「重新挑战」reload
- 暂停：suspenddiv 继续/重新开始 → `scene.pause()/resume()` / reload

## 实施步骤
1. 建 `lib/`，curl 下载 phaser 3.80.1 min 版
2. 写 `level1-phaser.html`（复制 level1.html 骨架改 script 区，删剧情层/技能 HUD 无关 DOM）
3. 写 `js/phaser/level1-scene.js`：preload（图/音/精灵图核对帧宽）→ create（tileSprite 背景改双图、玩家、4 Group、waves 时间表、overlap×4、Boss 34s 延时、HUD 引用）→ update（背景滚、指针跟随、e3/e5 轨迹、追踪弹、无敌闪烁、越界回收）→ 分块实现武器/敌机/Boss/补给/结算
4. 逐块联调

## 验证
`python -m http.server 8899` → 浏览器 `http://127.0.0.1:8899/plane-master/level1-phaser.html`：
- [ ] canvas 居中 9:16，窗口缩放自适应（FIT）
- [ ] 背景无缝滚动；波次出怪时刻与原版一致
- [ ] e3 抛物线、e5 圆弧、追踪弹弯向玩家
- [ ] e2 死后掉补给，拾取立即生效（换武器/加命/暴击/攻击/射速）
- [ ] 34s Boss 入场，三段弹幕节奏与原版一致，血条正确
- [ ] 中弹 3s 无敌闪烁、敌机相撞即死、生命条同步
- [ ] 拖动/鼠标跟手（FIT 缩放下坐标准确）
- [ ] 失败 → enddiv → 评级（localhost 不入库）；通关 → 下一关跳 level2.html
