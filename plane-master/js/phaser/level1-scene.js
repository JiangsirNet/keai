/* =====================================================================
   第 1 关 · 星夜初航 · Phaser 3 重构版
   机制与数值对齐 DOM 版 engine.js（20ms/帧换算：px/帧 ×50 = px/s，帧间隔 ×20 = ms）
   帧率公平：物理 fixedStep 60Hz 定步长；手动轨迹用 delta；计时全毫秒制
   ===================================================================== */
(function () {
    var W = 450, H = 800;

    // 我方武器（cd = 原帧制 15-speedY 帧换算 ms）
    var WEAPONS = {
        default:      { tex: 'bullet',  snd: 'shot',     w: 15, h: 37, atk: 2, crit: 0,   cd: 200 },
        twobullets:   { tex: 'bullet2', snd: 'shot',     w: 30, h: 37, atk: 3, crit: 0,   cd: 200 },
        firebullets:  { tex: 'fire',    snd: 'firegun',  w: 35, h: 72, atk: 4, crit: 0.1, cd: 280 },
        laserbullets: { tex: 'laser',   snd: 'lasergun', w: 12, h: 40, atk: 2, crit: 0.3, cd: 160 },
        shotgun:      { tex: 'shotgun', snd: 'shotgunS', w: 20, h: 39, atk: 1, crit: 0,   cd: 240 }
    };
    // 敌机（level1 波次使用 e1/e2/e3/e5；hp 已含 hpScale=1）
    var ENEMIES = {
        e1: { hp: 4,  w: 50, h: 34, score: 10,  fireMs: 3000, snd: 'explode2', bullet: 'straight'  },
        e2: { hp: 26, w: 70, h: 60, score: 30,  fireMs: 1400, snd: 'explode1', bullet: 'straight'  },
        e3: { hp: 20, w: 84, h: 54, score: 40,  fireMs: 2000, snd: 'explode1', bullet: 'autotrack' },
        e5: { hp: 4,  w: 45, h: 37, score: 10,  fireMs: 2400, snd: 'explode2', bullet: 'straight'  }
    };
    // 8 种补给（e2 死亡随机掉落，拾取直接生效）
    var SUPPLY = {
        bulletspeed: { color: '#51fe28', icon: 'ic_bulletspeed', ox: 0, oy: 0 },
        twobullets:  { color: '#36ffd2', icon: 'ic_twobullets',  ox: 0, oy: 0 },
        extralife:   { color: '#f3df6f', icon: 'ic_life',        ox: 5, oy: 6 },
        firebullets: { color: '#ffd4d4', icon: 'ic_fire',        ox: 6, oy: 1 },
        laserbullets: { color: '#80c3f3', icon: 'ic_laser',      ox: 6, oy: 1 },
        critRate:    { color: '#5ad4e1', icon: 'ic_crit',        ox: 6, oy: 6 },
        attack:      { color: '#9d6fc8', icon: 'ic_attack',      ox: 6, oy: 6 },
        shotgun:     { color: '#4e4aff', icon: 'ic_shotgun',     ox: 0, oy: 0 }
    };
    var SUPPLY_KEYS = ['bulletspeed', 'extralife', 'firebullets', 'twobullets', 'laserbullets', 'attack', 'critRate', 'shotgun'];

    var G = null;   // 场景引用
    var started = false, over = false;
    var cfg = window.LEVEL_CONFIG;

    var GameScene = new Phaser.Class({
        Extends: Phaser.Scene,
        initialize: function GameScene() { Phaser.Scene.call(this, { key: 'game' }); },

        // ---------------- 资源加载 ----------------
        preload: function () {
            this.load.image('bg1', 'image/bg1.jpg');
            this.load.image('plane1', 'image/plane1.png');
            this.load.spritesheet('boom', 'image/boom.png', { frameWidth: 82, frameHeight: 68 });
            // 敌机/Boss 双帧图（第 1 帧=正常，第 2 帧=受击）
            this.load.spritesheet('e1', 'image/e1.png', { frameWidth: 50, frameHeight: 34 });
            this.load.spritesheet('e2', 'image/e2.png', { frameWidth: 70, frameHeight: 60 });
            this.load.spritesheet('e3', 'image/e3.png', { frameWidth: 88, frameHeight: 54 });
            this.load.spritesheet('e5', 'image/e5.png', { frameWidth: 45, frameHeight: 37 });
            this.load.spritesheet('boss', cfg.bossSkin, { frameWidth: 150, frameHeight: 132 });
            // 我方子弹
            this.load.image('bullet', 'image/bullet.png');
            this.load.image('bullet2', 'image/bullet2.png');
            this.load.image('fire', 'image/fire.png');
            this.load.image('laser', 'image/laser.png');
            this.load.image('shotgun', 'image/shotgun.png');
            // 敌方子弹
            this.load.image('ebullet1', 'image/e-bullet1.png');
            this.load.image('particle', 'image/particle.png');
            this.load.image('missile', 'image/missile.png');
            this.load.image('b1', 'image/b1.png');
            this.load.image('b2', 'image/b2.png');
            this.load.image('b3', 'image/b3.png');
            // 补给图标
            this.load.image('ic_bulletspeed', 'image/bulletspeed.png');
            this.load.image('ic_twobullets', 'image/twobullets.png');
            this.load.image('ic_life', 'image/life.png');
            this.load.image('ic_fire', 'image/fire.png');
            this.load.image('ic_laser', 'image/laser.png');
            this.load.image('ic_crit', 'image/crit.png');
            this.load.image('ic_attack', 'image/bullet.png');
            this.load.image('ic_shotgun', 'image/shot.png');
            // 音频
            this.load.audio('shot', 'music/bullet/shot.mp3');
            this.load.audio('firegun', 'music/bullet/firegun.mp3');
            this.load.audio('lasergun', 'music/bullet/lasergun2.mp3');
            this.load.audio('lasergun1', 'music/bullet/lasergun1.mp3');
            this.load.audio('shotgunS', 'music/bullet/shotgun.mp3');
            this.load.audio('assaultgun', 'music/bullet/assaultgun.mp3');
            this.load.audio('explode1', 'music/explode/Explode01.ogg');
            this.load.audio('explode2', 'music/explode/Explode02.ogg');
            this.load.audio('explode3', 'music/explode/Explode03.ogg');
            this.load.audio('supplyS', 'music/supply.mp3');
        },

        // ---------------- 场景创建 ----------------
        create: function () {
            G = this;
            started = false; over = false;

            // 背景：双图 450×960 无缝下滚（top>0 时整体回移一个周期）
            this.bgTops = [0, -960];
            this.bgImgs = [
                this.add.image(W / 2, 480, 'bg1').setDisplaySize(W, 960),
                this.add.image(W / 2, 480 - 960, 'bg1').setDisplaySize(W, 960)
            ];

            // 爆炸动画（boom.png 15 帧 82×68，20fps）
            if (!this.anims.exists('boomAnim')) {
                this.anims.create({
                    key: 'boomAnim',
                    frames: this.anims.generateFrameNumbers('boom', { start: 0, end: 14 }),
                    frameRate: 20,
                    hideOnComplete: true
                });
            }

            // 补给贴图：30×30 彩色底 + 图标
            Object.keys(SUPPLY).forEach(function (t) {
                var m = SUPPLY[t], key = 'sup_' + t;
                if (G.textures.exists(key)) return;
                var cv = G.textures.createCanvas(key, 30, 30);
                var ctx = cv.getContext();
                ctx.fillStyle = m.color;
                ctx.fillRect(0, 0, 30, 30);
                var img = G.textures.get(m.icon).getSourceImage();
                ctx.drawImage(img, m.ox, m.oy);
                cv.refresh();
            });

            // 实体组
            this.myBullets = this.physics.add.group();
            this.enemyBullets = this.physics.add.group();
            this.enemys = this.physics.add.group();
            this.supplys = this.physics.add.group();

            // 玩家（原 top-left 195,485 → 图 60×46 下移 10px → 中心偏移 +33）
            this.player = this.physics.add.sprite(195 + 30, 485 + 33, 'plane1').setDepth(10);
            this.player.body.setSize(60, 46);
            this.hp = 3; this.scores = 0;
            this.weapon = 'default'; this.atkExtra = 0; this.critExtra = 0; this.speedLv = 0;
            this.invulUntil = 0; this.fireAcc = 0;
            this.destroyed = 0; this.missed = 0;
            this.battleTime = 0;
            this.targetX = this.player.x; this.targetY = this.player.y - 3;

            // 碰撞注册
            this.physics.add.overlap(this.myBullets, this.enemys, this.hitEnemy, null, this);
            this.physics.add.overlap(this.enemyBullets, this.player, this.hitByBullet, null, this);
            this.physics.add.overlap(this.enemys, this.player, this.hitByEnemyBody, null, this);
            this.physics.add.overlap(this.supplys, this.player, this.pickSupply, null, this);

            // 指针控制：拖动/鼠标移动跟随（FIT 缩放由 Phaser 逆变换 worldX/worldY）
            this.input.on('pointermove', function (p) {
                if (p.worldX !== undefined) { G.targetX = p.worldX; G.targetY = p.worldY; }
            });
            // 点击战机 = 暂停（对齐原版：轻点不开火不移动时弹出暂停）
            this.tap = null;
            this.input.on('pointerdown', function (p) {
                G.tap = { x: p.worldX, y: p.worldY, t: G.time.now };
                G.sound.resumeAll();
                var bg = document.querySelector('audio');
                if (bg && bg.paused) { try { bg.play(); } catch (e) {} }
            });
            this.input.on('pointerup', function (p) {
                if (!G.tap || !started || over) return;
                var moved = Math.abs(p.worldX - G.tap.x) + Math.abs(p.worldY - G.tap.y);
                var dt = G.time.now - G.tap.t;
                var onPlane = Math.abs(p.worldX - G.player.x) < 40 && Math.abs(p.worldY - G.player.y) < 40;
                if (moved < 14 && dt < 260 && onPlane) pauseGame();
                G.tap = null;
            });

            // HUD（DOM）
            this.dom = {
                score: document.getElementById('score'),
                life: document.getElementById('life'),
                banner: document.getElementById('levelBanner'),
                suspend: document.getElementById('suspenddiv'),
                enddiv: document.getElementById('enddiv'),
                planscore: document.getElementById('planscore'),
                clearBox: document.getElementById('levelClearBox'),
                clearScore: document.getElementById('clearScore'),
                gradingBox: document.getElementById('gradingBox'),
                grading: document.getElementById('grading'),
                destroyedEl: document.getElementById('destroyedEnemys'),
                missedEl: document.getElementById('missedEnemys')
            };
            var hs = localStorage.getItem('highScore'), hg = localStorage.getItem('highgrade');
            if (hs) document.getElementById('highscore').innerHTML = hs;
            if (hg !== null) document.getElementById('highgrade').innerHTML = ['DDD', 'CCC', 'BBB', 'AAA', 'SSS'][hg] || 'DDD';
            this.dom.life.style.width = '60px';
            this.dom.suspend.getElementsByTagName('button')[0].addEventListener('click', function () {
                G.dom.suspend.style.display = 'none';
                G.scene.resume();
            });
            this.dom.suspend.getElementsByTagName('button')[1].addEventListener('click', function () {
                window.location.reload();
            });

            started = true;
            startBattle();
        },

        // ---------------- 主循环（毫秒/delta 驱动，禁帧计数） ----------------
        update: function (time, delta) {
            if (!started || over) return;
            var dt = Math.min(delta, 50) / 1000;   // delta 钳制 50ms
            this.battleTime += dt * 1000;

            // 背景下滚 100px/s（双图独立回卷，图高960 > 舞台800，无缝衔接）
            for (var i = 0; i < 2; i++) {
                this.bgTops[i] += 100 * dt;
                if (this.bgTops[i] >= 960) { this.bgTops[i] -= 1920; }
                this.bgImgs[i].y = this.bgTops[i] + 480;
            }

            // 玩家跟随指针（钳制在画布内，对齐原 top-left 钳制偏移）
            // 注意：直接写 x/y 只动显示对象，必须 body.reset 同步物理体，否则碰撞/拾取判定仍停在出生点
            this.player.x = Phaser.Math.Clamp(this.targetX, 30, W - 30);
            this.player.y = Phaser.Math.Clamp(this.targetY + 3, 33, H - 27);
            this.player.body.reset(this.player.x, this.player.y);
            // 无敌闪烁（3s）
            var invul = time < this.invulUntil;
            this.player.alpha = invul ? (time % 160 < 80 ? 0.4 : 1) : 1;

            this.autoFire(dt);
            this.updateEnemies(dt);
            this.updateBoss(dt);
            this.updateEnemyBullets(dt);
            this.updateSupplies(dt);
            // 越界我方子弹回收（防长期累积影响性能）
            var mbs = this.myBullets.getChildren();
            for (var j = mbs.length - 1; j >= 0; j--) if (mbs[j].y < -50) mbs[j].destroy();
        },

        // ---------------- 我方开火 ----------------
        autoFire: function (dt) {
            var w = WEAPONS[this.weapon];
            var cd = Math.max(40, w.cd - this.speedLv * 20);   // 射速强化每级 -20ms（上限5级）
            this.fireAcc += dt * 1000;
            if (this.fireAcc < cd) return;
            this.fireAcc = 0;
            var px = this.player.x, topY = this.player.y - 33;   // top-left 等效
            this.sound.play(w.snd, { volume: 0.5 });
            var cy = topY - 12 + w.h / 2;
            if (this.weapon === 'shotgun') {
                [-2, 0, 2].forEach(function (sx) { G.spawnMyBullet(w, px + sx * 10, cy, sx * 150); });
            } else {
                this.spawnMyBullet(w, px, cy, 0);
            }
        },
        spawnMyBullet: function (w, x, y, vx) {
            var b = this.myBullets.create(x, y, w.tex);
            b.body.setSize(w.w, w.h);
            b.setVelocity(vx, -1000);
            b.atk = w.atk; b.crit = w.crit; b.cdmg = 1;
            return b;
        },

        // ---------------- 敌机 ----------------
        spawnEnemy: function (type) {
            if (over) return;
            var d = ENEMIES[type];
            var e, spawn;
            if (type === 'e1') spawn = { x: -50, y: 150 };                        // 左侧横穿
            else if (type === 'e2') spawn = { x: Phaser.Math.Between(0, 220), y: -100 };
            else if (type === 'e3') spawn = { x: 0, y: 0 };                       // 抛物线入口
            else spawn = { x: 0, y: 300 };                                        // e5 圆弧
            e = this.enemys.create(spawn.x + d.w / 2, spawn.y + d.h / 2, type);
            e.type = type; e.d = d;
            e.maxhp = Math.max(1, Math.round(d.hp * cfg.hpScale));
            e.hp = e.maxhp;
            e.fireMs = Math.max(12 * 20, Math.round(d.fireMs / cfg.freqScale));
            e.nextFire = Math.ceil((this.battleTime + 1) / e.fireMs) * e.fireMs;  // 对齐全局节拍
            e.tlx = spawn.x;                                                      // 手动轨迹用 top-left x
            e.hitUntil = 0;
            e.body.setSize(d.w, d.h);
            if (type === 'e1') e.setVelocity(100, 0);
            if (type === 'e2') e.setVelocity(0, 50);
            // 头顶血条（Rectangle 缩放，仅受击时更新）
            e.hpbg = this.add.rectangle(e.x, e.y - d.h / 2 - 6, d.w, 3, 0x1c2430).setDepth(5);
            e.hpfill = this.add.rectangle(e.x, e.y - d.h / 2 - 6, d.w, 3, 0x35e06a).setDepth(6);
            return e;
        },
        updateEnemies: function (dt) {
            var list = this.enemys.getChildren();
            for (var i = list.length - 1; i >= 0; i--) {
                var e = list[i];
                if (e.dying) continue;
                // 手动轨迹：e3 抛物线 / e5 圆弧（delta 驱动）
                if (e.type === 'e3') {
                    e.tlx += 100 * dt;
                    e.x = e.tlx + e.d.w / 2;
                    e.y = 0.008 * e.tlx * e.tlx + e.d.h / 2;
                    e.body.reset(e.x, e.y);
                } else if (e.type === 'e5') {
                    e.tlx += 200 * dt;
                    e.x = e.tlx + e.d.w / 2;
                    var top = Math.sqrt(Math.max(0, 300 * 300 - e.tlx * e.tlx));
                    e.y = top + e.d.h / 2;
                    e.body.reset(e.x, e.y);
                }
                // 越界 → 计 miss（对齐原边界容差）
                if (e.y - e.d.h / 2 > H || e.x - e.d.w / 2 > W + 100 || e.y + e.d.h / 2 < -100 || e.x + e.d.w / 2 < -60) {
                    this.missed++;
                    e.hpbg.destroy(); e.hpfill.destroy();
                    e.destroy();
                    continue;
                }
                // 受击姿态还原（320ms）
                if (e.hitUntil && this.time.now >= e.hitUntil) {
                    e.setFrame(0); e.hitUntil = 0;
                }
                // 开火（对齐全局毫秒节拍）
                if (this.battleTime >= e.nextFire) {
                    e.nextFire += e.fireMs;
                    this.enemyFire(e);
                }
                // 血条跟随
                e.hpbg.setPosition(e.x, e.y - e.d.h / 2 - 6);
                e.hpfill.setPosition(e.x, e.y - e.d.h / 2 - 6);
            }
        },
        enemyFire: function (e) {
            if (over || e.isBoss) return;   // Boss 弹幕由 bossPattern 驱动
            var d = ENEMIES[e.type];
            var bx = e.x, by = e.y - d.h / 2 + 40;   // 对齐原版出生点（机顶 +40）
            if (e.d.bullet === 'straight') {
                var b = this.enemyBullets.create(bx, by + 7, 'ebullet1');
                b.body.setSize(14, 14);
                b.setVelocity(0, 375);
                this.sound.play('assaultgun', { volume: 0.35 });
            } else {   // autotrack：直下 + 每帧水平收敛向玩家
                var b2 = this.enemyBullets.create(bx, by + 16, 'particle');
                b2.body.setSize(35, 32);
                b2.setVelocity(0, 375);
                b2.track = 1.25;   // 水平收敛系数（原 (dx)/40 每帧 ×50）
                this.sound.play('assaultgun', { volume: 0.35 });
            }
        },

        // ---------------- 敌方子弹更新 ----------------
        updateEnemyBullets: function (dt) {
            var list = this.enemyBullets.getChildren();
            for (var i = list.length - 1; i >= 0; i--) {
                var b = list[i];
                if (b.track) {
                    // 水平收敛追踪（与原版一致：v=(弹x-玩家x)/40 每帧 → ×50 比例系数）
                    b.body.velocity.x = -(b.x - this.player.x) * b.track;
                    if (b.rotate) b.rotation = Math.atan2(b.body.velocity.x, b.body.velocity.y);
                }
                if (b.y > H + 60 || b.y < -80 || b.x < -80 || b.x > W + 80) b.destroy();
            }
        },
        updateSupplies: function (dt) {
            var list = this.supplys.getChildren();
            for (var i = list.length - 1; i >= 0; i--) {
                if (list[i].y > H + 40) list[i].destroy();
            }
        },

        // ---------------- 碰撞处理 ----------------
        hitEnemy: function (bullet, enemy) {
            if (over || enemy.dying) return;
            var isCrit = Math.random() < (bullet.crit + this.critExtra) ? 1 : 0;
            var dmg = (bullet.atk + this.atkExtra) * (1 + isCrit * bullet.cdmg);
            bullet.destroy();
            enemy.hp -= dmg;
            // 受击姿态 + 飘字
            enemy.setFrame(1); enemy.hitUntil = this.time.now + 320;
            this.floatText(enemy.x, enemy.y - enemy.d.h / 2 - 10, '-' + (Math.round(dmg * 10) / 10), isCrit ? '#ffd24a' : '#ff6a6a');
            enemy.hpfill.setSize(enemy.d.w * Math.max(0, enemy.hp) / enemy.maxhp, 3);
            if (enemy.hp <= 0) this.killEnemy(enemy);
        },
        hitByBullet: function (player, bullet) {
            // 注意：Phaser 的 group×sprite overlap 回调实参为 (单个对象, 组员)，与注册顺序相反
            if (over) return;
            bullet.destroy();
            var wasInvul = this.time.now < this.invulUntil;
            this.invulUntil = this.time.now + 3000;   // 重置 3s 无敌
            if (!wasInvul) {
                this.hp--;
                this.dom.life.style.width = Math.max(0, this.hp) * 20 + 'px';
                if (this.hp <= 0) this.fail();
            }
        },
        hitByEnemyBody: function (player, enemy) {
            if (over || enemy.dying) return;
            this.hp = 0;
            this.dom.life.style.width = '0px';
            this.fail();
        },
        pickSupply: function (player, supply) {
            if (over) return;
            this.applySupply(supply.type);
            this.sound.play('supplyS');
            supply.destroy();
        },
        applySupply: function (t) {
            switch (t) {
                case 'bulletspeed': if (this.speedLv < 5) this.speedLv++; break;
                case 'twobullets': case 'firebullets': case 'laserbullets': case 'shotgun':
                    this.weapon = t; this.fireAcc = 0; break;
                case 'critRate': this.critExtra += 0.2; break;
                case 'attack': this.atkExtra++; break;
                case 'extralife':
                    this.hp++;
                    this.dom.life.style.width = this.hp * 20 + 'px'; break;
            }
        },

        // ---------------- 击杀 / 掉落 / 爆炸 ----------------
        killEnemy: function (e) {
            e.dying = true;
            e.body.enable = false;
            e.hpbg.destroy(); e.hpfill.destroy();
            this.scores += e.d ? e.d.score : (e.isBoss ? 500 : 0);
            this.dom.score.innerHTML = this.scores;
            this.destroyed++;
            this.sound.play(e.isBoss ? 'explode3' : e.d.snd);
            var boom = this.add.sprite(e.x, e.y, 'boom').play('boomAnim').setDepth(9);
            if (e.isBoss) boom.setScale(1.6);
            var type = e.type, sx = e.x, sy = e.y;
            e.setVisible(false);
            e.destroy();
            if (type === 'e2') {
                // e2 死亡 → 600ms 后随机掉落 8 种补给之一（爆炸结束时）
                this.time.addEvent({ delay: 600, callback: function () { G.dropSupply(sx, sy); } });
            }
            if (e.isBoss) this.bossDown();
        },
        dropSupply: function (x, y) {
            if (over) return;
            var t = SUPPLY_KEYS[Phaser.Math.Between(0, 7)];
            var s = this.supplys.create(x, y, 'sup_' + t);
            s.body.setSize(30, 30);
            s.setVelocity(0, 100);
            s.type = t;
        },
        bossDown: function () {
            // 对齐原版：Boss 死后 2 秒弹过关框
            this.time.addEvent({ delay: 2000, callback: function () { G.levelClear(); } });
        },

        // ---------------- Boss ----------------
        spawnBoss: function () {
            if (over || this.boss) return;
            var b = this.enemys.create(25, 50 + 66, 'boss');   // 原 top-left(-50,50)
            b.isBoss = true; b.type = 'boss';
            b.d = { w: 150, h: 132, score: 500, snd: 'explode3' };
            b.maxhp = cfg.bossHp; b.hp = cfg.bossHp;
            b.body.setSize(150, 132);
            b.dying = false; b.hitUntil = 0;
            b.moveDir = 'middle'; b.state = 'enter';
            b.hpbg = this.add.rectangle(b.x, b.y - 72, 150, 4, 0x1c2430).setDepth(5);
            b.hpfill = this.add.rectangle(b.x, b.y - 72, 150, 4, 0xff5a5a).setDepth(6);
            this.boss = b;
            // 三段弹幕节奏（原 mark1 % 122/172/216 帧 → ×20ms），从 Boss 出场起算
            this.time.addEvent({ delay: 2440, loop: true, callback: function () { G.bossPattern(1); } });
            this.time.addEvent({ delay: 3440, loop: true, callback: function () { G.bossPattern(2); } });
            this.time.addEvent({ delay: 4320, loop: true, callback: function () { G.bossPattern(3); } });
        },
        bossPattern: function (n) {
            var b = this.boss;
            if (!b || b.dying || over || !started) return;
            if (n === 1) {
                // 左右移动切换 + 6 发扇形弹（speedX -3..2 ×75，vy 225）
                b.moveDir = (b.x - 75 > 2) ? 'left' : 'right';
                for (var sx = -3; sx <= 2; sx++) {
                    var b1 = this.enemyBullets.create(b.x, b.y - 16, 'b1');
                    b1.body.setSize(20, 19);
                    b1.setVelocity(sx * 75, 225);
                }
                this.sound.play('lasergun', { volume: 0.5 });
            } else if (n === 2) {
                // 3 发追踪导弹（左/中/右，vy 450 + 水平收敛 + 旋转）
                [-75, 0, 75].forEach(function (ox) {
                    var b2 = G.enemyBullets.create(b.x + ox, b.y - 21, 'b2');
                    b2.body.setSize(15, 49);
                    b2.setVelocity(0, 450);
                    b2.track = 1.25; b2.rotate = true;
                });
                this.sound.play('lasergun1', { volume: 0.5 });
            } else {
                // 回中 + 2 发大弹（vy 750）
                b.moveDir = 'middle';
                [-75, 75].forEach(function (ox) {
                    var b3 = G.enemyBullets.create(b.x + ox, b.y - 21, 'b3');
                    b3.body.setSize(35, 124);
                    b3.setVelocity(0, 750);
                });
                this.sound.play('firegun', { volume: 0.5 });
            }
        },
        updateBoss: function (dt) {
            var b = this.boss;
            if (!b || b.dying) return;
            if (b.state === 'enter') {
                b.x += 50 * dt;
                if (b.x >= 225) { b.x = 225; b.state = 'fight'; }
            } else {
                if (b.moveDir === 'left' && b.x > 75) b.x -= 50 * dt;
                else if (b.moveDir === 'right' && b.x < W - 75) b.x += 50 * dt;
                else if (b.moveDir === 'middle') {
                    if (b.x > 225) b.x = Math.max(225, b.x - 50 * dt);
                    else if (b.x < 225) b.x = Math.min(225, b.x + 50 * dt);
                }
            }
            b.body.reset(b.x, b.y);
            // 受击姿态还原 + 血条
            if (b.hitUntil && this.time.now >= b.hitUntil) { b.setFrame(0); b.hitUntil = 0; }
            b.hpbg.setPosition(b.x, b.y - 72);
            b.hpfill.setPosition(b.x, b.y - 72);
        },

        // ---------------- 通用 ----------------
        floatText: function (x, y, txt, color) {
            var t = this.add.text(x, y, txt, { font: 'bold 12px Microsoft Yahei', fill: color }).setOrigin(0.5).setDepth(20);
            this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 500, onComplete: function () { t.destroy(); } });
        },

        // ---------------- 流程 ----------------
        fail: function () {
            if (over) return;
            over = true;
            this.sound.play('explode1');
            this.add.sprite(this.player.x, this.player.y, 'boom').play('boomAnim').setScale(1.3).setDepth(11);
            this.dom.enddiv.style.display = 'block';
            this.dom.planscore.innerHTML = this.scores;
            if (window.savePlaneScore) { try { window.savePlaneScore(this.scores); } catch (e) {} }
            // 留 800ms 播完爆炸再冻结场景（DOM 结算仍可点）
            this.time.addEvent({ delay: 800, callback: function () { G.scene.pause(); } });
        },
        levelClear: function () {
            if (over) return;
            over = true;
            this.dom.clearScore.innerHTML = this.scores;
            this.dom.clearBox.style.display = 'block';
            this.time.addEvent({ delay: 100, callback: function () { G.scene.pause(); } });
        }
    });

    // ---------------- 全局流程函数（DOM 按钮 / onload 调用） ----------------
    function startBattle() {
        // 刷怪波次（原帧时刻 ×20ms，一次性定时器）
        cfg.waves.forEach(function (wv) {
            G.time.addEvent({ delay: wv[0] * 20, callback: function () { G.spawnEnemy(wv[1]); } });
        });
        // Boss 出场
        G.time.addEvent({ delay: cfg.bossAt * 20, callback: function () { G.spawnBoss(); } });
        // 关卡横幅
        var b = G.dom.banner;
        b.style.display = 'block'; b.style.opacity = '1';
        setTimeout(function () { b.style.opacity = '0'; }, 1600);
        setTimeout(function () { b.style.display = 'none'; b.style.opacity = '1'; }, 2500);
    }
    function pauseGame() {
        if (!started || over) return;
        G.scene.pause();
        G.dom.suspend.style.display = 'block';
    }
    window.begin = function () {
        document.getElementById('startdiv').style.display = 'none';
        document.getElementById('maindiv').style.display = 'block';
        document.getElementById('scorediv').style.display = 'block';
        // 场景 create 完成后 startBattle 已在 create 末尾执行（Phaser 预加载完才进 create）
    };
    window.next = function () {
        G.dom.enddiv.style.display = 'none';
        G.dom.gradingBox.style.display = 'block';
        G.dom.destroyedEl.innerHTML = G.destroyed;
        G.dom.missedEl.innerHTML = G.missed;
        var grade = 0;
        if (G.destroyed > 28) { G.dom.grading.innerHTML = 'SSS'; grade = 4; }
        else if (G.destroyed > 23) { G.dom.grading.innerHTML = 'AAA'; grade = 3; }
        else if (G.destroyed > 18) { G.dom.grading.innerHTML = 'BBB'; grade = 2; }
        else if (G.destroyed > 13) { G.dom.grading.innerHTML = 'CCC'; grade = 1; }
        else { G.dom.grading.innerHTML = 'DDD'; grade = 0; }
        try {
            var oldScore = localStorage.getItem('highScore');
            if (!oldScore || Number(oldScore) < G.scores) localStorage.setItem('highScore', G.scores);
            var oldGrade = localStorage.getItem('highgrade');
            if (!oldGrade || Number(oldGrade) < grade) localStorage.setItem('highgrade', grade);
        } catch (e) {}
    };
    window.nextLevel = function () { window.location.href = 'level2.html'; };
    window.retryLevel = function () { window.location.reload(); };
    window.end = function () { window.location.href = './index.html'; };

    // ---------------- 启动 ----------------
    var game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        width: W,
        height: H,
        backgroundColor: '#000',
        physics: { default: 'arcade', arcade: { fixedStep: true } },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: GameScene
    });
})();
