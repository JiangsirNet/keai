    //获得主界面
    var mainDiv = document.getElementById("maindiv");
    //获得开始界面
    var startdiv = document.getElementById("startdiv");
    //获得游戏中分数显示界面
    var scorediv = document.getElementById("scorediv");
    //获得分数界面
    var scorelabel = document.getElementById("score");
    //获得历史最高分界面
    var highscorelabel = document.getElementById("highscore");
    //获得历史最高评分
    var highgradeLabel = document.getElementById("highgrade");
    //获得暂停界面
    var suspenddiv = document.getElementById("suspenddiv");
    //获得游戏结束界面
    var enddiv = document.getElementById("enddiv");
    //获得游戏结束后分数统计界面
    var planscore = document.getElementById("planscore");
    //任务成功或失败标志
    var missionstatusLabel = document.getElementById("missionstatus");
    //初始化分数
    var scores = 0;
    //评分等级
    var grade = 0;
    // 我军飞机生命值
    var life = document.getElementById("life");
    // 我军发射子弹速度值
    var bulletSpeed = 4;
    // 我军发射子弹速度加成
    var bulletSpeedExtra = 0;
    // 我军发射子弹暴击率加成
    var bulletCritExtra = 0;
    // 我军发射子攻击力加成
    var bulletAttackExtra = 0;

    var gardetxt = ['DDD','CCC', 'BBB', 'AAA', 'SSS'];
    var bodyWidth = document.documentElement.clientWidth
    var bodyheight = document.documentElement.clientHeight
    // 小屏适配：以 480px 逻辑宽度为基准，屏幕更窄时飞机/敌机/子弹/补给等比缩小（只缩不放），保证各尺寸手机难度一致
    // --ps 供 CSS 使用：让贴图跟随缩放后的节点尺寸
    var SIZE_SCALE = Math.min(1, bodyWidth / 480);
    function SS(v){ return Math.round(v * SIZE_SCALE); }
    document.documentElement.style.setProperty('--ps', SIZE_SCALE);
    // 桌面端提示已移除，直接打开时支持鼠标操作
    var highscore = window.localStorage.getItem('highScore')
    var highgrade = window.localStorage.getItem('highgrade')
    if(highscore){
      highscorelabel.innerHTML = highscore  
    }
    if(highgrade){
        highgradeLabel.innerHTML = gardetxt[highgrade]
    }
    
    /*
     创建飞机类
     */
    function plan(hp, X, Y, sizeX, sizeY, score, dietime, speed, boomimage, imgClass, soundSrc, trailName, hasfire, bulletType, bulletFrequency) {
        sizeX = SS(sizeX);   // 小屏等比缩放
        sizeY = SS(sizeY);
        this.planeX = X;
        this.planeY = Y;
        this.imagenode = null;
        this.boomSound = null;
        // 当前生命值
        this.planehp = hp;
        // 总生命值
        this.hpbartotal = null;
        this.planscore = score;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.planboomimage = boomimage;
        // 是否被标记死亡
        this.planeisdie = false;
        
        this.planedietimes = 0;
        this.planedietime = dietime;
        this.speed = speed;
        this.soundSrc = soundSrc;
        // 运动轨迹名称
        this.trailName = trailName;
        // 是否具有开火属性
        this.hasfire = hasfire;
        // 子弹类型
        this.bulletType = bulletType;
        // 发射子弹默认频率
        this.bulletFrequency = bulletFrequency
        // 是否正在遭受攻击
        this.underattack = false;
        // 是否遭受暴击
        this.issuffercrit = false;
        this.showattacktime = 0;
        //行为
        /*
        移动行为
             */
        this.planmove = function (x1,x2,y1,y2) {
            switch (this.trailName){
                // 抛物线方程
                case 'curve':
                    this.imagenode.style.left = this.imagenode.offsetLeft + 2 + 'px';
                    this.imagenode.style.top = 0.008*Math.pow(this.imagenode.offsetLeft,2) + 'px';
                    break;
                // 圆的方程
                case 'circle-left-top':
                    this.imagenode.style.left = this.imagenode.offsetLeft + this.speed + 'px';
                    this.imagenode.style.top = Math.sqrt(Math.pow(2 * bodyWidth/3,2) - Math.pow(this.imagenode.offsetLeft,2)) + 'px';
                    break;
                case 'left-right1':
                    this.imagenode.style.left = this.imagenode.offsetLeft + this.speed + 'px';
                    break;
                case 'right-left1':
                    this.imagenode.style.left = this.imagenode.offsetLeft - this.speed + 'px';
                    break;
                case 'left-right2':
                    if(this.imagenode.offsetLeft< bodyWidth/5){
                        this.imagenode.style.left = this.imagenode.offsetLeft + this.speed + 'px';
                    };
                    var q = getLocation(x1,x2,y1,y2);
                    var a =  q.angle;
                    this.imagenode.style.transform = 'rotate('+ a + 'deg)'
                    break;
                case 'right-left2':
                    if(this.imagenode.offsetLeft>3*bodyWidth/5){
                        this.imagenode.style.left = this.imagenode.offsetLeft - this.speed + 'px';
                    }
                    var q = getLocation(x1,x2,y1,y2);
                    var a =  q.angle;
                    this.imagenode.style.transform = 'rotate('+ a + 'deg)'
                    break;
                case 'boss-middle':
                    if(this.imagenode.offsetLeft>bodyWidth/2 - this.planX/2){
                        this.imagenode.style.left = this.imagenode.offsetLeft - this.speed + 'px';
                    }
                    if(this.imagenode.offsetLeft<bodyWidth/2 - this.planX/2){
                        this.imagenode.style.left = this.imagenode.offsetLeft + this.speed + 'px';
                    }
                    var q = getLocation(x1,x2,y1,y2);
                    var a =  q.angle;
                    this.imagenode.style.transform = 'rotate('+ a + 'deg)'
                    break;
                case 'boss-left':
                    if(this.imagenode.offsetLeft>0){
                        this.imagenode.style.left = this.imagenode.offsetLeft - this.speed + 'px';
                    }
                    var q = getLocation(x1,x2,y1,y2);
                    var a =  q.angle;
                    this.imagenode.style.transform = 'rotate('+ a + 'deg)'
                    break;
                case 'boss-right':
                    if(this.imagenode.offsetLeft< bodyWidth - SS(150)){
                        this.imagenode.style.left = this.imagenode.offsetLeft + this.speed + 'px';
                    }
                    var q = getLocation(x1,x2,y1,y2);
                    var a =  q.angle;
                    this.imagenode.style.transform = 'rotate('+ a + 'deg)'
                    break;
                // 圆的方程
                case 'circle-right-top':
                    this.imagenode.style.left = this.imagenode.offsetLeft - this.speed + 'px';
                    this.imagenode.style.top = Math.sqrt(2 * bodyWidth/3 * this.imagenode.offsetLeft) + 'px';
                    break;
                default:
                    this.imagenode.style.top = this.imagenode.offsetTop + this.speed + 'px';
                
            }
        }
        this.init = function () {
            this.imagenode = document.createElement("div");
            this.boomimage = document.createElement("img");
            this.hpbartotal = document.createElement("div");
            this.boomSound = document.createElement("audio");
            this.hpbar = document.createElement('span');
            this.hpbartotal.className = 'hptotal';
            this.hpbartotal.style.width = this.sizeX + 'px';
            this.hpbar.style.width = this.sizeX + 'px';
            this.hpbartotal.setAttribute('hp',this.planehp);
            this.hpbar.className = 'hpbar';
            this.boomimage.src = this.planboomimage;
            this.boomSound.autoplay = '';
            this.boomSound.src = soundSrc;
            this.boomimage.style.width = sizeX + 'px';
            this.boomimage.style.height = sizeY + 'px';
            this.boomimage.style.display = 'none';
            this.imagenode.style.width = sizeX + 'px';
            this.imagenode.style.height = sizeY + 'px';
            this.imagenode.style.left = this.planeX + "px";
            this.imagenode.style.top = this.planeY + "px";
            this.imagenode.className = imgClass;
            this.hpbartotal.appendChild(this.hpbar);
            this.imagenode.appendChild(this.hpbartotal);
            this.imagenode.appendChild(this.boomimage);
            this.imagenode.appendChild(this.boomSound);
            mainDiv.appendChild(this.imagenode);
        }
        this.init();
    }

    /*
    创建子弹类
     */
    function bullet(X, Y, sizeX, sizeY, imgClass, bulletattck, soundSrc, belong, critRate, critDamage, speedX, speedY, type) {
        sizeX = SS(sizeX);   // 小屏等比缩放
        sizeY = SS(sizeY);
        this.bulletX = X;
        this.bulletY = Y;
        this.imagenode = null;
        this.bulletSound = null;
        this.bulletattck = bulletattck;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.soundSrc = soundSrc;
        this.belong = belong;
        this.critRate = critRate;
        this.critDamage  = critDamage;
        this.speedX = speedX;
        this.speedY = speedY;
        this.type = type;
        /*
         移动行为
         */
        this.bulletmove = function (x1,x2,y1,y2) {
            // 我方追踪导弹（特殊武器，type='homing'）
            if (belong === 'friend' && this.type === 'homing') {
                var tx, ty;
                if(this.mtarget && !this.mtarget.planeisdie && this.mtarget.imagenode.parentNode){
                    tx = this.mtarget.imagenode.offsetLeft + this.mtarget.sizeX/2;
                    ty = this.mtarget.imagenode.offsetTop + this.mtarget.sizeY/2;
                }else{
                    this.mtarget = nearestEnemy(this.imagenode.offsetLeft, this.imagenode.offsetTop);
                    if(this.mtarget){
                        tx = this.mtarget.imagenode.offsetLeft + this.mtarget.sizeX/2;
                        ty = this.mtarget.imagenode.offsetTop + this.mtarget.sizeY/2;
                    }else{
                        tx = this.imagenode.offsetLeft;
                        ty = this.imagenode.offsetTop - 100;
                    }
                }
                var mdx = tx - this.imagenode.offsetLeft - this.sizeX/2;
                var mdy = ty - this.imagenode.offsetTop - this.sizeY/2;
                var md = Math.sqrt(mdx*mdx + mdy*mdy) || 1;
                var msp = 9;
                this.imagenode.style.left = this.imagenode.offsetLeft + mdx/md*msp + 'px';
                this.imagenode.style.top = this.imagenode.offsetTop + mdy/md*msp + 'px';
                var mang = Math.atan2(mdx, -mdy) * 180 / Math.PI;
                this.imagenode.style.transform = 'rotate(' + mang.toFixed(1) + 'deg)';
                return;
            }
            if (belong === 'friend') {
                this.imagenode.style.top = this.imagenode.offsetTop - 20 + "px";
                this.imagenode.style.left = this.imagenode.offsetLeft + 1.5*this.speedX + "px";
            }
            if (belong === 'enemy') {
                this.imagenode.style.top = this.imagenode.offsetTop + 1.5*this.speedY + "px";
                this.imagenode.style.left = this.imagenode.offsetLeft + 1.5*this.speedX + "px";
                // 自动追踪
                if(type === 'autotrack'){
                    var q = getLocation(x1,x2,y1,y2)
                    this.imagenode.style.left = parseInt(this.imagenode.style.left) - q.v + 'px'
                }
                // 导弹追踪(旋转方向)
                if(type === 'missile'){
                    var q = getLocation(x1,x2,y1,y2)
                    var a =  q.angle
                    // if(a>-60){
                        this.imagenode.style.transform = 'rotate('+ a + 'deg)'
                    // }
                    this.imagenode.style.left = parseInt(this.imagenode.style.left) - q.v + 'px'
                }
                
            }

        }
        this.init = function () {
            this.imagenode = document.createElement("div");
            this.bulletSound = document.createElement("audio");
            this.imagenode.style.width = sizeX + 'px';
            this.imagenode.style.height = sizeY + 'px';
            this.imagenode.style.left = this.bulletX + "px";
            this.imagenode.style.top = this.bulletY + "px";
            this.imagenode.className = imgClass;
            this.bulletSound.autoplay = '';
            this.bulletSound.src = soundSrc;
            this.imagenode.appendChild(this.bulletSound);
            mainDiv.appendChild(this.imagenode);
            this.bulletSound.play()
        }
        this.init();
    }

    // 创建补给包类
    function supplybag(X,Y,imgClass,dietime,type){
        this.supplybagX = X;
        this.supplybagY = Y;
        this.sizeX = SS(30);
        this.sizeY = SS(30);
        this.imagenode = null;
        this.supplybagSound = null;
        this.dietimes = 0;
        this.dietime = dietime;
        this.type = type;
        this.istaken = false;
        // 补给包的移动
        this.move = function() {
            this.imagenode.style.top = this.imagenode.offsetTop + 2 + "px";
            
        };
        // 初始化
        this.init = function() {
            this.imagenode = document.createElement("div");
            this.supplybagSound = document.createElement("audio");
            this.imagenode.style.width = this.sizeX + 'px';
            this.imagenode.style.height = this.sizeY + 'px';
            this.imagenode.style.left = this.supplybagX + "px";
            this.imagenode.style.top = this.supplybagY + "px";
            this.imagenode.className = imgClass;
            this.supplybagSound.autoplay = '';
            this.supplybagSound.src = 'music/supply.mp3';
            this.imagenode.appendChild(this.supplybagSound);
            mainDiv.appendChild(this.imagenode);
        }
        this.init();
    }

    // 创建明细补给包类

    //双发子弹
    function supplytwobullets(X, Y){
        supplybag.call(this, X, Y, 'supply supplytwobullets',1000,'twobullets')
    }
    //子弹速度+1
    function supplybulletspeed(X, Y){
        supplybag.call(this, X, Y, 'supply supplybulletspeed',1000,'bulletspeed')
    }
    //生命+1
    function supplyextralife(X, Y){
        supplybag.call(this, X, Y, 'supply supplyextralife',1000,'extralife')
    }
    //火枪子弹补给包
    function supplyfirebullets(X, Y){
        supplybag.call(this, X, Y, 'supply supplyfirebullets',1000,'firebullets')
    }
    //激光枪补给包
    function supplylaserbullets(X, Y){
        supplybag.call(this, X, Y, 'supply supplylaserbullets',1000,'laserbullets')
    }
    //暴击率+0.2（全武器属性）
    function supplycritRate(X, Y){
        supplybag.call(this, X, Y, 'supply supplycritRate',1000,'critRate')
    }
    //攻击力+1（全武器属性）
    function supplyattack(X, Y){
        supplybag.call(this, X, Y, 'supply supplyattack',1000,'attack')
    }
    //散弹补给包
    function supplyshotgun(X, Y){
        supplybag.call(this, X, Y, 'supply supplyshotgun',1000,'shotgun')
    }

    /*
     创建我方子弹类
     */
    function defaultbullet(X, Y) {
        bullet.call(this, X, Y, 15, 37, "bullet bullet1", 2, 'music/bullet/shot.mp3', 'friend', 0, 1, 0, 5, 'default');
    }
    function doublebullet(X, Y) {
        bullet.call(this, X, Y, 30, 37, "bullet bullet2", 3, 'music/bullet/shot.mp3', 'friend', 0, 2, 0, 5, 'default');
    }
    function firebullet(X, Y) {
        bullet.call(this, X, Y, 35, 72, "bullet firebullet", 4, 'music/bullet/firegun.mp3', 'friend', 0.1, 1, 0, 1, 'default');
    }
    function laserbullet(X, Y) {
        bullet.call(this, X, Y, 12, 40, "bullet laserbullet", 2, 'music/bullet/lasergun2.mp3', 'friend', 0.3, 2, 0, 7, 'default');
    }
    function shotgun(X, Y, speedX) {
        bullet.call(this, X, Y, 20, 39, "bullet shotgun", 1, 'music/bullet/shotgun.mp3', 'friend', 0, 1, speedX, 3, 'default');
    }

    /*创建敌军子弹*/
    function enemybullet1(X, Y) {
        bullet.call(this, X, Y, 14, 14, "bullet e-bullet1", 1, 'music/bullet/assaultgun.mp3', 'enemy', 0, 1.2, 0, 5, 'default');
    }
    function enemybullet2(X, Y) {
        bullet.call(this, X, Y, 35, 32, "bullet e-particle", 1, 'music/bullet/assaultgun.mp3', 'enemy', 0, 1.2, 0, 5, 'autotrack');
    }
    function enemybullet3(X, Y) {
        bullet.call(this, X, Y, 12, 38, "bullet e-missile", 1, 'music/bullet/lasergun2.mp3', 'enemy', 0, 1.2, 0, 8, 'missile');
    }
    function bossbullet1(X, Y, sppedX) {
        bullet.call(this, X, Y, 20, 19, "bullet e-b1", 1, 'music/bullet/lasergun2.mp3', 'enemy', 0, 1.2, sppedX, 3, 'default');
    }
    function bossbullet2(X, Y, sppedX) {
        bullet.call(this, X, Y, 15, 49, "bullet e-b2", 1, 'music/bullet/lasergun1.mp3', 'enemy', 0, 1.2, sppedX, 6, 'missile');
    }
    function bossbullet3(X, Y, sppedX) {
        bullet.call(this, X, Y, 35, 124, "bullet e-b3", 1, 'music/bullet/firegun.mp3', 'enemy', 0, 1.2, sppedX, 10, 'default');
    }

    /*
    创建敌机类
     */
    function enemy1(a, b, trailName, bulletType) {
        plan.call(this, 4, a, b, 50, 34, 10, 600, 2, "image/boom.gif", "enemys1 plane", 'music/explode/Explode02.ogg', trailName, true, bulletType,150);
    }
    function enemy2(a, b, trailName, bulletType) {
        plan.call(this, 26, a, b, 70, 60, 30, 600, 1, "image/boom.gif", "enemys2 plane", 'music/explode/Explode01.ogg', trailName, true, bulletType,70);
    }
    function enemy3(a, b, trailName, bulletType) {
        plan.call(this, 20, a, b, 84, 54, 40, 600, random(1,3), "image/boom.gif", "enemys3 plane", 'music/explode/Explode01.ogg', trailName, true, bulletType,100);
    }
    function enemy4(a, b, trailName, bulletType) {
        plan.call(this, 24, a, b, 100, 65, 50, 600, random(1,2), "image/boom.gif", "enemys4 plane", 'music/explode/Explode01.ogg', trailName, true, bulletType,100);
    }
    function enemy5(a, b, trailName, bulletType) {
        plan.call(this, 4, a, b, 45, 37, 10, 600, 4, "image/boom.gif", "enemys5 plane", 'music/explode/Explode02.ogg', trailName, true, bulletType,120);
    }
    function enemy6(a, b, trailName, bulletType) {
        plan.call(this, 28, a, b, 90, 78, 80, 600, 1, "image/boom.gif", "enemys6 plane", 'music/explode/Explode02.ogg', trailName, true, bulletType,100);
    }
    function enemys7(a, b, trailName, bulletType) {
        this.extraimage = null;
        plan.call(this, 40, a, b, 100, 100, 120, 600, 4, "image/boom.gif", "enemys7 plane", 'music/explode/Explode03.ogg', trailName, true, bulletType,50);
        this.extraimages = function(){
            this.extraimage = document.createElement('div');
            this.extraimage.className = 'propeller circle';
            this.imagenode.appendChild(this.extraimage)
        };
        this.extraimages()
    }
    function boss1(a, b, trailName, bulletType) {
        this.extraimage = null;
        plan.call(this, 250, a, b, 150, 132, 500, 1000, 1, "image/boom.gif", "boss1 plane", 'music/explode/Explode03.ogg', trailName, true, bulletType,40);
        
    }
    

    /*
    创建本方飞机类
     */
    function ourplan(X, Y, imgClass, soundSrc, bulletType) {
        plan.call(this, 3, X, Y, 60, 60, 0, 660, 0, "image/boom.gif", imgClass, soundSrc, 'defualt', false, bulletType, 15);
        this.imagenode.setAttribute('id', 'ourplan');
    }

    /*
     创建本方飞机
     */
    var selfplane = new ourplan(120, 485, 'plane1 plane', 'music/explode/Explode01.ogg', 'default');

    //移动事件
    var ourPlan = document.getElementById('ourplan');
    var yidong = function (ev) {
        if(isHUDTarget(ev)) return;   // 触摸落在 HUD（技能/背包）上时不移动飞机
        // var oevent=window.event||arguments[0];
        // var chufa=oevent.srcElement||oevent.target;
        var oevent = ev.touches[0]
        var selfplaneX = oevent.clientX;
        var selfplaneY = oevent.clientY;
        ourPlan.style.left = Math.max(0, Math.min(bodyWidth - selfplane.sizeX, selfplaneX - selfplane.sizeX / 2)) + "px";
        ourPlan.style.top = Math.max(0, Math.min(bodyheight - selfplane.sizeY, selfplaneY - selfplane.sizeY / 2)) + "px";
    }
    /*
    暂停事件
     */
    var number = 0;
    var pause = function () {
        if (number == 0) {
            suspenddiv.style.display = "block";
            if (document.removeEventListener) {
                mainDiv.removeEventListener("touchmove", yidong, true);
                bodyobj.removeEventListener("touchmove", bianjie, true);
            }
            clearInterval(set);
            number = 1;
        } else {
            suspenddiv.style.display = "none";
            if (document.addEventListener) {
                mainDiv.addEventListener("touchmove", yidong, true);
                bodyobj.addEventListener("touchmove", bianjie, true);
            }
            set = setInterval(start, 20);
            number = 0;
        }
    }
    //判断本方飞机是否移出边界,如果移出边界,则取消mousemove事件,反之加上mousemove事件
    var bianjie = function () {
        var oevent = window.event || arguments[0];
        var bodyobjX = oevent.clientX;
        var bodyobjY = oevent.clientY;
        if (bodyobjX < 0 || bodyobjX > bodyWidth || bodyobjY < 0 || bodyobjY > bodyheight) {
            if (document.removeEventListener) {
                mainDiv.removeEventListener("touchstart", yidong, true);
            }
        } else {
            if (document.addEventListener) {
                mainDiv.addEventListener("touchstart", yidong, true);
            }
        }
    }
    //暂停界面重新开始事件
    function restart() {
        location.reload(true);
        startdiv.style.display = "none";
        maindiv.style.display = "block";
    }
    var bodyobj = document.querySelector("body");
    if (document.addEventListener) {
        //为本方飞机添加移动和暂停
        mainDiv.addEventListener("touchmove", yidong, true);
        //为本方飞机添加暂停事件
        selfplane.imagenode.addEventListener("click", pause, true);
        //为body添加判断本方飞机移出边界事件
        bodyobj.addEventListener("touchmove", bianjie, true);
        //为暂停界面的继续按钮添加暂停事件
        suspenddiv.getElementsByTagName("button")[0].addEventListener("click", pause, true);
        suspenddiv.getElementsByTagName("button")[1].addEventListener("click", restart, true);
        //为暂停界面的返回主页按钮添加事件
        suspenddiv.getElementsByTagName("button")[2].addEventListener("click", end, true);
    }
    // 鼠标事件支持（iframe 内嵌桌面端）
    if (document.addEventListener) {
        mainDiv.addEventListener("mousemove", function(ev) {
            if(isHUDTarget(ev)) return;   // 鼠标落在 HUD 上时不移动飞机
            var selfplaneX = ev.clientX;
            var selfplaneY = ev.clientY;
            ourPlan.style.left = Math.max(0, Math.min(bodyWidth - selfplane.sizeX, selfplaneX - selfplane.sizeX / 2)) + "px";
            ourPlan.style.top = Math.max(0, Math.min(bodyheight - selfplane.sizeY, selfplaneY - selfplane.sizeY / 2)) + "px";
        }, true);
        bodyobj.addEventListener("mousemove", function(ev) {
            if (ev.clientX < 0 || ev.clientX > bodyWidth || ev.clientY < 0 || ev.clientY > bodyheight) {
                mainDiv.removeEventListener("mousemove", arguments.callee, true);
            }
        }, true);
        selfplane.imagenode.addEventListener("click", pause, true);
        suspenddiv.getElementsByTagName("button")[0].addEventListener("click", pause, true);
    }
    //初始化隐藏本方飞机
    selfplane.imagenode.style.display = "none";

    /*敌机对象数组*/
    var enemys = [];

    /*子弹对象数组*/
    var bullets = [];
    var enemybullets = [];

    // 补给包数组
    var supplybags = [];

    //进程标志位
    var mark = 1;

    // 子进程标志位
    var mark1 = 1;

    //=========== 10 关配置 ===========
    // waves: [t, 机型, 轨迹(可省), 子弹(可省)]  帧时刻(20ms/帧)，t 到达时刷出
    /* 关卡配置由各关独立的 js/levels/levelN.js 注入：
       window.LEVEL_CONFIG  —— 当前关卡配置对象（name/bg/hpScale/freqScale/bossAt/bossHp/bossSkin/waves）
       window.LEVEL_INDEX   —— 当前关序号（0 起）
       window.LEVEL_TOTAL   —— 总关卡数
       window.LEVEL_HAS_STORY —— 是否播放第 1 关剧情 */
    var currentLevelIndex = window.LEVEL_INDEX || 0;
    var LEVEL_TOTAL = window.LEVEL_TOTAL || 10;
    var LEVEL_HAS_STORY = !!window.LEVEL_HAS_STORY;
    var currentLevel = window.LEVEL_CONFIG;
    var clearingLevel = false;   // 防止重复触发过关

    function getDefaultTrail(t){ return {e1:'left-right1',e2:'default',e3:'curve',e4:'default',e5:'circle-left-top',e6:'default',e7:'left-right2'}[t]; }
    function getDefaultBullet(t){ return {e1:'default',e2:'default',e3:'autotrack',e4:'missile',e5:'default',e6:'missile',e7:'missile'}[t]; }

    // 按配置生成敌机（带关卡血量/射速缩放）
    function spawnEnemy(type, trail, bullet){
        trail = trail || getDefaultTrail(type);
        bullet = bullet || getDefaultBullet(type);
        var e = null;
        switch(type){
            case 'e1':
                e = (trail==='left-right1') ? new enemy1(-50,150,trail,bullet) : new enemy1(random(0,bodyWidth-50),-100,trail,bullet);
                break;
            case 'e2': e = new enemy2(random(0,220),-100,trail,bullet); break;
            case 'e3': e = new enemy3(0,-100,trail,bullet); break;
            case 'e4': e = new enemy4(random(0,bodyWidth-100),-100,trail,bullet); break;
            case 'e5':
                e = (trail==='circle-right-top') ? new enemy5(bodyWidth,bodyheight/2,trail,bullet) : new enemy5(0,bodyheight/2,trail,bullet);
                break;
            case 'e6': e = new enemy6(random(0,bodyWidth-300),-100,trail,bullet); break;
            case 'e7':
                e = (trail==='right-left2') ? new enemys7(bodyWidth,80,trail,bullet) : new enemys7(-50,80,trail,bullet);
                break;
        }
        if(e){
            var s = currentLevel.hpScale;
            e.planehp = Math.max(1, Math.round(e.planehp * s));
            e.hpbartotal.setAttribute('hp', e.planehp);
            e.bulletFrequency = Math.max(12, Math.round(e.bulletFrequency / currentLevel.freqScale));
        }
        return e;
    }

    // 清空场上的敌人/子弹/补给
    function clearObjects(){
        [enemys, bullets, enemybullets, supplybags].forEach(function(arr){
            for(var i=0;i<arr.length;i++){
                if(arr[i].imagenode && arr[i].imagenode.parentNode) mainDiv.removeChild(arr[i].imagenode);
            }
            arr.length = 0;
        });
        destroyedEnemys.length = 0;
        missedEnemys.length = 0;
    }

    // 显示关卡横幅
    function showLevelBanner(){
        var b = document.getElementById('levelBanner');
        b.innerHTML = '第 ' + (currentLevelIndex+1) + ' 关 · ' + currentLevel.name;
        b.style.opacity = '1';
        b.style.display = 'block';
        setTimeout(function(){ b.style.opacity = '0'; }, 1600);
        setTimeout(function(){ b.style.display = 'none'; b.style.opacity = '1'; }, 2500);
    }

    // 开始第 n 关（n 从 0 起）—— 单页单关模式下仅初始化当前页面对应关卡
    function startLevel(n){
        currentLevelIndex = n;
        mark = 0;
        mark1 = 1;
        clearingLevel = false;
        clearObjects();
        newboss1 = null;
        setLevelBg(currentLevel.bg);
        // 隐藏过场/结算界面
        document.getElementById('levelClearBox').style.display = 'none';
        enddiv.style.display = 'none';
        document.getElementById('gradingBox').style.display = 'none';
        // 生命低于 3 时回到 3
        if(selfplane.planehp < 3){
            selfplane.planehp = 3;
            life.style.width = (selfplane.planehp*20) + 'px';
        }
        showLevelBanner();
    }

    // 过关
    function levelClear(){
        if(clearingLevel) return;
        clearingLevel = true;
        setTimeout(function(){
            clearInterval(set);
            if(currentLevelIndex >= LEVEL_TOTAL - 1){
                endGame('Success');   // 全部通关
            }else if(LEVEL_HAS_STORY && currentLevelIndex === 0 && !storyEndingPlayed){
                storyEndingPlayed = true;
                playLevelEnding();    // 第1关通关剧情
            }else{
                document.getElementById('clearTitle').innerHTML = '第 ' + (currentLevelIndex+1) + ' 关 通过';
                document.getElementById('clearScore').innerHTML = scores;
                document.getElementById('levelClearBox').style.display = 'block';
            }
        }, 2000);
    }

    // 下一关：跳转到下一关的独立页面
    function nextLevel(){
        window.location.href = 'level' + (currentLevelIndex + 2) + '.html';
    }

    // 失败后重试本关：重新加载当前关卡页面
    function retryLevel(){
        window.location.reload();
    }

    // 三层背景图无缝滚动（每层960px铺满，滚出屏幕的层移到底部继续，永不重置位置）
    var bgLayers = [document.getElementById('bgLayer0'), document.getElementById('bgLayer1'), document.getElementById('bgLayer2')];
    var BG_H = 960;
    function setLevelBg(bg){
        for(var i=0;i<bgLayers.length;i++){
            bgLayers[i].style.backgroundImage = "url(" + bg + ")";
            bgLayers[i].style.top = ((i-1)*BG_H) + 'px';
        }
    }
    function scrollBg(){
        var bgSp = nitroActive ? 4 : 2;   // 氮气冲刺时滚动加倍，模拟高速飞行
        for(var i=0;i<bgLayers.length;i++){
            bgLayers[i].style.top = (parseInt(bgLayers[i].style.top) + bgSp) + 'px';
        }
        if(parseInt(bgLayers[0].style.top) > 0){
            for(var i=0;i<bgLayers.length;i++){
                bgLayers[i].style.top = (parseInt(bgLayers[i].style.top) - BG_H) + 'px';
            }
        }
    }

    var newboss1 = null;

    // 摧毁的敌军飞机集合
    var destroyedEnemys = [];

    // 未击中的敌军飞机集合
    var missedEnemys = [];

    // ================= 第1关剧情系统 =================
    var storyState = null;      // null|recall|teach|incident|reality|battle|ending
    var introTriggered = false; // 防止等待 story.json 加载期间重复触发开场独白
    /* ============ 剧情配置（多组、模块化；可由 story-config.html 编辑） ============
       全剧由若干「模块」组成：{ id, name, trigger, mode, lines }，lines 每句 { speaker, text, L?, R? }
         speaker='旁白' 时以屏幕中上方字幕样式播放，否则以对话框播放
         L/R：undefined=保持上一句 / ''=隐藏 / 'xxx.png'=切换立绘（立绘直接在台词里设置）
       trigger 挂载标识（引擎自动挂载，无需手动确认）：
         flow:intro / flow:recall / flow:incident / flow:reality / flow:ending —— 主线固定挂载位
         time:N / kill:N / hp:N / boss —— 战斗事件（开战后N秒 / 击落第N架 / 血量降至N / Boss登场）
         其他自定义标识 —— 由关卡页面代码调用 fireStoryMount('标识') 主动挂载
       mode：pause=暂停式过场（冻结战斗，点击推进，播完恢复）/ bubble=不暂停气泡（自动推进）
       未添加的主线模块=该段跳过（仅保留必要转场） */
    function L(speaker, text, L, R){
        var ln = { speaker: speaker, text: text };
        if(L) ln.L = L;
        if(R) ln.R = R;
        return ln;
    }
    function M(id, name, trigger, lines){ return { id: id, name: name, trigger: trigger, mode: 'pause', lines: lines }; }
    var STORY_CONFIG_DEFAULT = { modules: [
        M('intro', '开场独白', 'flow:intro', [
            L('小爱', '自那次事件以后，寻找阿伟的多少天，还是毫无进展。', '小爱-担心焦虑.png')
        ]),
        M('recall', '回忆·并肩巡航', 'flow:recall', [
            L('小爱', '阿伟，你看，我们的航线和星星一样整齐。', '小爱-开心.png', '阿伟-温柔微笑.png'),
            L('阿伟', '放轻松，小爱。飞行不用时刻紧绷，试着感受风，它会托住你的战机。'),
            L('阿伟', '记住，轻轻拉动摇杆就能转向，按下发射键可以击碎漂浮的气流碎片。我们一起练习。')
        ]),
        M('incident', '变故', 'flow:incident', [
            L('旁白', '教学刚刚完成，夜空深处突然亮起诡异的紫色光团……', '小爱-开心.png', '阿伟-温柔微笑.png'),
            L('旁白', '一艘陌生的外星飞行器无声从云层里浮现，光束锁定了阿伟的战机。'),
            L('阿伟', '小爱！快躲开！我不知道这是什么东西！', null, '阿伟-担心牵挂.png'),
            L('小爱', '阿伟！！'),
            L('旁白', '小爱拼命推动操纵杆想要冲过去，可一股能量屏障挡住了她。只能眼睁睁看着阿伟的战机被拖走……', '小爱-担心焦虑.png'),
            L('旁白', '通讯频道里，阿伟的声音断断续续，最后彻底沉寂……'),
            L('阿伟', '小爱……不要放弃……找到我……'),
            L('旁白', '小爱：把阿伟还给我——！'),
            L('小爱', '啊——！好烫……阿伟……我一定会……找到你的……')
        ]),
        M('reality', '现实启程', 'flow:reality', [
            L('小爱', '刚才的一切，是多年前的训练空域。阿伟在这里被带走，信号就此消失。', '小爱-坚定认真.png'),
            L('小爱', '这片空域残留着外星派出的巡逻残影敌机，我必须冲破它们，顺着残留的能量痕迹，出发去找他。')
        ]),
        M('ending', '通关剧情', 'flow:ending', [
            L('小爱', '最后一架敌机残影被击毁。雷达捕捉到一丝微弱、遥远的能量信号——指向沙漠方向……', '小爱-坚定认真.png'),
            L('小爱', '我找到一点线索了。阿伟，等着我，我一定会跨越所有天空，找到你。')
        ])
    ]};

    // 旧数据迁移：v1 固定 dialogs 槽位 / v2 的 cutscene+subtitles+sprites → 统一 lines
    function migrateStoryGroup(g){
        var d = g.dialogs, cut = g.cutscene || d || {}, sub = g.subtitles || {}, sp = g.sprites || {};
        g.lines = g.lines || {};
        // v1：四段固定对白槽位 → 数组
        if(d){
            if(!g.lines.intro && d.intro) g.lines.intro = [d.intro];
            if(!g.lines.recall){
                var rc = [d.recall_start, d.recall_step1, d.recall_step2].filter(Boolean);
                if(rc.length) g.lines.recall = rc;
            }
            if(!g.lines.reality){
                var rv = [d.reality_explain, d.reality_vow].filter(Boolean);
                if(rv.length) g.lines.reality = rv;
            }
            if(!g.lines.ending){
                var eh = [d.ending_signal, d.ending_hope].filter(Boolean);
                if(eh.length) g.lines.ending = eh;
            }
        }
        // 变故对白 + 旁白字幕 → incident 连续 9 句（仅当存在旧版数据时迁移，空白组保持空数组=跳过）
        var hasLegacyIncident = sub.incident_glow || sub.incident_alien || sub.incident_shield || sub.incident_silence
            || sub.shipfight_roar || cut.incident_warning || cut.incident_cry || cut.incident_lastword || cut.crash_pain
            || sp.incident_start || sp.recall_start;
        if(hasLegacyIncident && (!Array.isArray(g.lines.incident) || !g.lines.incident.length)){
            var startSP = sp.incident_start || sp.recall_start || {};
            function spImg(key, side){ return sp[key] && sp[key][side] ? sp[key][side].img : null; }
            function cutLine(key){
                var c = cut[key];
                return c ? L(c.speaker || '', c.text || '') : null;
            }
            function subLine(text, lImg, rImg){ return text ? L('旁白', text, lImg, rImg) : null; }
            g.lines.incident = [
                subLine(sub.incident_glow, startSP.L && startSP.L.img, startSP.R && startSP.R.img),
                subLine(sub.incident_alien),
                (function(){ var ln = cutLine('incident_warning'); if(ln){ ln.R = spImg('incident_warning','R') || undefined; } return ln; })(),
                cutLine('incident_cry'),
                subLine(sub.incident_shield, spImg('incident_cry','L')),
                subLine(sub.incident_silence),
                cutLine('incident_lastword'),
                subLine(sub.shipfight_roar),
                cutLine('crash_pain')
            ].filter(Boolean);
        }
        // 各段初始立绘（旧 sprites 配置）烘焙到首句台词
        var phaseSprites = { intro: sp.intro, recall: sp.recall || sp.recall_start, reality: sp.reality, ending: sp.ending };
        Object.keys(phaseSprites).forEach(function(ph){
            var ps = phaseSprites[ph], first = g.lines[ph] && g.lines[ph][0];
            if(!ps || !first) return;
            ['L','R'].forEach(function(side){
                if(first[side] === undefined && ps[side] && ps[side].img) first[side] = ps[side].img;
            });
        });
        // 统一转换为模块列表（v3 格式）：主线模块缺失 = 该段跳过
        if(Array.isArray(g.modules)){
            g.modules.forEach(function(m, i){
                m.id = m.id || ('m' + (i + 1) + '_' + Math.floor(Math.random() * 1e4));
                m.name = m.name || '未命名模块';
                m.trigger = m.trigger || 'time:5';
                m.mode = m.mode === 'bubble' ? 'bubble' : 'pause';
                if(!Array.isArray(m.lines)) m.lines = [];
            });
        }else{
            var linesObj = g.lines || {};
            g.modules = [];
            [['intro','开场独白'],['recall','回忆·并肩巡航'],['incident','变故'],['reality','现实启程'],['ending','通关剧情']].forEach(function(p){
                if(Array.isArray(linesObj[p[0]])) g.modules.push({ id: p[0], name: p[1], trigger: 'flow:' + p[0], mode: 'pause', lines: linesObj[p[0]] });
            });
        }
        delete g.lines;
        delete g.dialogs; delete g.cutscene; delete g.subtitles; delete g.sprites;
    }

    // 合并指定剧情组（多组存储：plane_story_groups；单组旧键 plane_story_config 兼容）
    // 触发优先级：URL ?story=组名  >  window.LEVEL_STORY_GROUP（关卡JS设定）  >  localStorage 激活组  >  默认
    function getStoryGroupName(){
        var m = /[?&]story=([^&]+)/.exec(location.search);
        if(m){ try { return decodeURIComponent(m[1]); } catch(e){} }
        if(window.LEVEL_STORY_GROUP) return window.LEVEL_STORY_GROUP;
        return localStorage.getItem('plane_story_active') || '默认';
    }
    function mergeStoryGroup(base, group){
        if(Array.isArray(group.modules)) base.modules = group.modules;   // 组内模块整体替换（主线模块缺失=跳过该段）
    }
    function loadStoryConfig(){
        var base = JSON.parse(JSON.stringify(STORY_CONFIG_DEFAULT));
        var groupName = getStoryGroupName();
        try{
            var group = null;
            var groupsRaw = localStorage.getItem('plane_story_groups');
            if(groupsRaw){
                var groups = JSON.parse(groupsRaw);
                if(groups && groups[groupName]) group = groups[groupName];
            }
            // 兼容旧版单配置（视为一个无名自定义组）
            if(!group){
                var raw = localStorage.getItem('plane_story_config');
                if(raw) group = JSON.parse(raw);
            }
            if(group){
                migrateStoryGroup(group);
                mergeStoryGroup(base, group);
            }
        }catch(e){ console.warn('[story-config] 读取剧情组「' + groupName + '」失败，使用默认值', e); }
        return base;
    }
    var STORY_CONFIG = loadStoryConfig();

    /* ===== Supabase 剧情读取（表 plane_story：id=1 单行，data={active, groups}） =====
       组名优先级：URL ?story=组名 > window.LEVEL_STORY_GROUP > data.active > localStorage > 默认
       表未建/网络失败时，保留上方 localStorage 兜底结果 */
    function applyStoryData(data){
        if(!data || !data.groups) return;
        var name = '默认';
        var m = /[?&]story=([^&]+)/.exec(location.search);
        if(m){ try { name = decodeURIComponent(m[1]); } catch(e){} }
        else if(window.LEVEL_STORY_GROUP) name = window.LEVEL_STORY_GROUP;
        else if(data.active && data.groups[data.active]) name = data.active;
        var g = data.groups[name];
        if(!g) return;                            // 数据里无此组 → 保留 localStorage 兜底
        var base = JSON.parse(JSON.stringify(STORY_CONFIG_DEFAULT));
        migrateStoryGroup(g);
        mergeStoryGroup(base, g);
        STORY_CONFIG = base;
    }
    var storyConfigReady = Promise.resolve();
    (function(){
        var SB_URL = "https://fccsjbvkfllapyoozuvf.supabase.co";
        var SB_KEY = "sb_publishable_A3W8wYMbB-6pABB0-e0vkA_E-VMsJ4n";   // 与 js/config.js、score.js 一致（公开读）
        try{
            storyConfigReady = fetch(SB_URL + '/rest/v1/plane_story?select=data&id=eq.1', {
                headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
            })
                .then(function(r){ return r.ok ? r.json() : null; })
                .then(function(rows){
                    var d = rows && rows[0] && rows[0].data;
                    if(d) applyStoryData(d);
                })
                .catch(function(){ /* 表未建或网络失败：走 localStorage 兜底 */ });
        }catch(e){}
    })();

    // 立绘槽位重置/切换（位置默认，图像完全由台词 L/R 驱动）
    function resetCharSlots(){
        [['L','storyCharL'],['R','storyCharR']].forEach(function(pair){
            var side = pair[0], el = storyEl(pair[1]);
            el.style.transition = 'all .6s ease';
            el.style.opacity = '1';
            el.style.height = '';
            el.style.bottom = '9%';
            if(side === 'L'){ el.style.left = '6%'; el.style.right = 'auto'; }
            else { el.style.right = '6%'; el.style.left = 'auto'; }
            el.style.display = 'none';
        });
    }
    function applyLineSprites(ln){
        ['L','R'].forEach(function(side){
            var v = ln[side];
            if(v === undefined || v === null) return;     // 未指定：保持当前
            var el = storyEl(side === 'L' ? 'storyCharL' : 'storyCharR');
            if(v === ''){ el.style.display = 'none'; }    // 显式隐藏
            else { el.src = 'image/role/' + v; el.style.display = 'block'; }
        });
    }
    function renderLine(ln){
        applyLineSprites(ln);
        if((ln.speaker || '') === '旁白') showStorySubtitle(ln.text || '');
        else showStoryDialog(ln.speaker || '', ln.text || '');
    }

    /* ===== 连续台词播放器（主线模块点击推进；战斗过场模块同样复用） ===== */
    var lineCtx = { mod: null, flow: null, idx: 0 };
    function startModule(mod, flow){
        lineCtx.mod = mod;
        lineCtx.flow = flow || null;    // null = 战斗过场模块（播完恢复战斗）
        lineCtx.idx = 0;
        showCurrentLine();
    }
    function showCurrentLine(){
        var arr = lineCtx.mod ? (lineCtx.mod.lines || []) : [];
        var ln = arr[lineCtx.idx];
        if(!ln){ finishLinePhase(); return; }
        renderLine(ln);
    }
    function advanceLine(){
        lineCtx.idx++;
        var arr = lineCtx.mod ? (lineCtx.mod.lines || []) : [];
        if(lineCtx.idx >= arr.length) finishLinePhase();
        else showCurrentLine();
    }
    function finishLinePhase(){
        var flow = lineCtx.flow;
        if(!flow){ endBattleModule(); return; }
        lineCtx.mod = null; lineCtx.flow = null;
        switch(flow){
            case 'intro':   startFadeToRecall(); break;
            case 'recall':  startTeach(); break;
            case 'reality': startBattle(); break;
            case 'ending':  showLevelClearBox(); break;
        }
    }
    function flowMod(key){
        var list = STORY_CONFIG.modules || [];
        for(var i = 0; i < list.length; i++){
            if(list[i].trigger === 'flow:' + key) return list[i];
        }
        return null;
    }

    /* ===== 战斗事件挂载模块（自动挂载：time/kill/hp/boss；页面可 fireStoryMount('标识') 主动挂载） =====
       pause=暂停式过场（冻结战斗，点击推进，播完恢复）；bubble=不暂停气泡（自动推进，不拦截操作） */
    var storyFrozen = false;        // true 时 start() 冻结战斗（暂停式过场播放中）
    var battleKillCount = 0;
    var battleModsFired = {};       // 本场战斗已挂载的模块 id
    var pendingPauseMods = [];      // 等待播放的模块队列（过场/气泡互斥时排队）
    var bubbleCtx = { mod: null, idx: 0, timer: null };

    function armBattleModules(){
        battleKillCount = 0;
        battleModsFired = {};
        pendingPauseMods = [];
        (STORY_CONFIG.modules || []).forEach(function(m){
            var t = m.trigger || '';
            if(t.indexOf('time:') === 0){
                var sec = parseFloat(t.slice(5));
                if(sec > 0) storyTimer.push(setTimeout(function(){ fireBattleModule(m); }, sec * 1000));
            }
        });
    }
    function checkBattleModules(type, value){
        if(storyState !== 'battle') return;
        (STORY_CONFIG.modules || []).forEach(function(m){
            if(battleModsFired[m.id]) return;
            var t = m.trigger || '';
            if(type === 'boss' ? t === 'boss' : t === type + ':' + value) fireBattleModule(m);
        });
    }
    function fireBattleModule(m){
        if(storyState !== 'battle' || battleModsFired[m.id]) return;
        battleModsFired[m.id] = true;
        if(lineCtx.mod || bubbleCtx.mod){ pendingPauseMods.push(m); return; }   // 有模块播放中：排队
        if(m.mode === 'bubble') startBubbleModule(m);
        else startPausedModule(m);
    }
    function tryNextPending(){
        if(storyState !== 'battle' || lineCtx.mod || bubbleCtx.mod || !pendingPauseMods.length) return;
        var m = pendingPauseMods.shift();
        if(m.mode === 'bubble') startBubbleModule(m);
        else startPausedModule(m);
    }
    // 暂停式过场：冻结战斗，全屏对话点击推进
    function startPausedModule(m){
        storyFrozen = true;
        var ov = storyEl('storyOverlay');
        ov.classList.remove('transparent-bg');
        ov.style.zIndex = '40';
        ov.style.display = 'block';
        storyEl('storyTip').style.display = 'none';
        storyEl('storySkipBtn').style.display = 'none';
        resetCharSlots();
        startModule(m, null);
    }
    function endBattleModule(){
        lineCtx.mod = null; lineCtx.flow = null;
        storyEl('storyDialog').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        var ov = storyEl('storyOverlay');
        ov.style.display = 'none';
        if(storyState === 'battle'){
            ov.classList.add('transparent-bg');
            ov.style.zIndex = '5';
            storyFrozen = false;
            tryNextPending();
        }
    }
    // 不暂停气泡：底部自动推进，不拦截游戏输入
    function startBubbleModule(m){
        bubbleCtx.mod = m; bubbleCtx.idx = 0;
        var ov = storyEl('storyOverlay');
        ov.classList.add('transparent-bg');
        ov.style.zIndex = '5';
        ov.style.display = 'block';
        showBubbleLine();
    }
    function showBubbleLine(){
        if(!bubbleCtx.mod) return;
        var ln = (bubbleCtx.mod.lines || [])[bubbleCtx.idx];
        if(!ln){ endBubbleModule(); return; }
        renderLine(ln);
        storyEl('storyDialog').style.pointerEvents = 'none';
        storyEl('storySubtitle').style.pointerEvents = 'none';
        bubbleCtx.timer = setTimeout(function(){ bubbleCtx.idx++; showBubbleLine(); }, 3200);
    }
    function endBubbleModule(){
        clearTimeout(bubbleCtx.timer);
        bubbleCtx.mod = null; bubbleCtx.idx = 0;
        storyEl('storyDialog').style.pointerEvents = '';
        storyEl('storySubtitle').style.pointerEvents = '';
        storyEl('storyDialog').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        if(storyState === 'battle'){
            storyEl('storyOverlay').style.display = 'none';
            tryNextPending();
        }
    }
    // 页面主动挂载自定义标识（如 level2.js 里 fireStoryMount('level2:hidden')）
    window.fireStoryMount = function(tag){
        (STORY_CONFIG.modules || []).forEach(function(m){
            if(m.trigger === tag) fireBattleModule(m);
        });
    };

    /* ===== 变故段（incident）：前 7 句点击推进，画面节拍与句子一一对应 ===== */
    var INCIDENT_PRE_FIGHT = 7;   // 前 7 句为过场；第 8 句开战怒吼（自动）；第 9 句坠机（点击）
    var incidentBeats = [
        function(){ // 0 紫光出现
            var g = storyEl('storyGlow');
            g.style.display = 'block'; g.style.right = '12%'; g.style.top = '14%';
        },
        function(){ // 1 外星飞船浮现
            var a = storyEl('storyAlien');
            a.style.display = 'block'; a.style.right = '8%'; a.style.top = '6%';
        },
        function(){ // 2 警告（立绘由该句 R 切换）
        },
        function(){ // 3 光束 + 阿伟战机被拖走
            var bm = storyEl('storyBeam');
            bm.style.display = 'block'; bm.style.left = '60%'; bm.style.top = '12%'; bm.style.height = '52%';
            var c = storyEl('storyCharR');
            c.style.opacity = '0.85';
            storyTimer.push(setTimeout(function(){
                c.style.transition = 'all 2.2s ease';
                c.style.right = '0%'; c.style.bottom = '42%'; c.style.opacity = '0';
                var p = storyEl('storyPlane2');
                p.style.transition = 'all 2.2s ease';
                p.style.right = '2%'; p.style.bottom = '58%'; p.style.opacity = '0';
            }, 350));
        },
        function(){ // 4 能量屏障（小爱因句 L 切换立绘）
            var sh = storyEl('storyShield');
            sh.style.display = 'block'; sh.style.left = '26%'; sh.style.top = '36%';
        },
        function(){ // 5 沉寂
        },
        function(){ // 6 阿伟消失，遗言从远处传来
            var c = storyEl('storyCharR');
            c.style.display = 'none';
            c.style.opacity = '1'; c.style.right = '6%'; c.style.bottom = '9%';
        }
    ];
    var incidentCtx = { mod: null, idx: 0 };
    function startIncidentLines(mod){
        incidentCtx = { mod: mod, idx: 0 };
        showIncidentLine();
    }
    function showIncidentLine(){
        var arr = incidentCtx.mod ? (incidentCtx.mod.lines || []) : [];
        var ln = arr[incidentCtx.idx];
        if(ln) renderLine(ln);
        var beat = incidentBeats[incidentCtx.idx];
        if(beat) beat();
    }
    function advanceIncident(){
        incidentCtx.idx++;
        if(incidentCtx.idx >= INCIDENT_PRE_FIGHT){ startShipFight(); return; }
        showIncidentLine();
    }

    var storyStep = 0;
    var storyTimer = [];
    var teaching = {move:false, shoot:false, kill:0};
    var teachStartX = 0, teachStartY = 0, teachKillBase = 0;
    var storyEndingPlayed = false;
    var introFlyBaseX = 0, introFlyBaseY = 0;   // 开场独飞基准位置
    var shipHp = 50000;          // 外星飞船血量（剧情杀，不可战胜）
    var fightStartMark = 0;      // 飞船战斗开始帧

    function storyEl(id){ return document.getElementById(id); }
    function clearStoryTimer(){ storyTimer.forEach(function(t){ clearTimeout(t); }); storyTimer = []; }

    function showStoryChar(side, img, opts){
        var el = storyEl(side==='L' ? 'storyCharL' : 'storyCharR');
        el.src = 'image/role/' + img;
        el.style.display = 'block';
        el.style.opacity = '1';
        el.style.transition = 'all .6s ease';
        if(opts && opts.left) el.style.left = opts.left;
        if(opts && opts.right) el.style.right = opts.right;
        if(opts && opts.bottom) el.style.bottom = opts.bottom;
        return el;
    }
    function showStoryDialog(speaker, text){
        storyEl('storyName').innerHTML = speaker;
        storyEl('storyText').innerHTML = text;
        storyEl('storyDialog').style.display = 'block';
        storyEl('storySubtitle').style.display = 'none';
    }
    function hideStoryDialog(){ storyEl('storyDialog').style.display = 'none'; }
    function showStorySubtitle(text){
        storyEl('storySubtitle').innerHTML = text;
        storyEl('storySubtitle').style.display = 'block';
        storyEl('storyDialog').style.display = 'none';
    }

    // 点击对话/旁白推进
    function storyNext(){
        if(lineCtx.mod){ advanceLine(); return; }       // 主线模块或战斗过场模块
        if(storyState === 'incident') advanceIncident();
        else if(storyState === 'shipcrash') startReality();
    }

    // 开始第1关剧情：开场独飞 → 独白 → 变灰变黑「回忆中」→ 双机回忆 → 原有回忆对话
    function startStory(){
        storyState = 'fly';
        introTriggered = false;
        storyStep = 0;
        clearStoryTimer();
        storyEl('storyOverlay').style.display = 'none';
        storyEl('storyTip').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        storyEl('storyDialog').style.display = 'none';
        ['storyGlow','storyAlien','storyBeam','storyShield','storyRecallTitle'].forEach(function(id){ storyEl(id).style.display = 'none'; });
        var m = document.getElementById('maindiv');
        m.style.filter = '';
        // 小爱战机在夜空中独飞（自动演示飞行）
        selfplane.imagenode.style.display = 'block';
        introFlyBaseX = bodyWidth/2 - selfplane.sizeX/2;
        introFlyBaseY = bodyheight - 170;
        selfplane.imagenode.style.left = introFlyBaseX + 'px';
        selfplane.imagenode.style.top = introFlyBaseY + 'px';
        // 独飞 1.5 秒（75帧）后由 start() 帧驱动触发独白
    }

    // 开场独白（连续台词序列）
    function showIntroDialog(){
        var im = flowMod('intro');
        if(!im){ startFadeToRecall(); return; }   // 未添加开场模块：跳过独白直接过渡回忆
        storyState = 'intro';
        storyEl('storyOverlay').style.display = 'block';   // 关键：父层必须显示
        storyEl('storyPlane').style.display = 'none';
        storyEl('storyPlane2').style.display = 'none';
        selfplane.imagenode.style.display = 'none';
        resetCharSlots();   // 立绘由首句台词的 L/R 决定
        startModule(im, 'intro');
    }

    // 点击独白后：画面变灰 → 变黑 → 「回忆中」→ 恢复 → 双机回忆飞行
    function startFadeToRecall(){
        storyState = 'fade';
        clearStoryTimer();
        hideStoryDialog();
        storyEl('storyCharL').style.display = 'none';   // 进入回忆前小爱立绘消失
        var m = document.getElementById('maindiv');
        m.style.transition = 'filter 1.2s ease';
        m.style.filter = 'grayscale(1)';                 // 先变灰
        storyTimer.push(setTimeout(function(){
            m.style.filter = 'grayscale(1) brightness(0)';  // 再变黑
            storyEl('storyOverlay').style.display = 'block';
            storyEl('storyRecallTitle').style.display = 'block';  // 回忆中
        }, 1500));
        storyTimer.push(setTimeout(function(){
            m.style.filter = 'grayscale(0) brightness(1)';  // 恢复正常
            storyEl('storyRecallTitle').style.display = 'none';
            startRecallFly();
        }, 4400));
    }

    // 回忆：两架战机并肩飞行几秒
    function startRecallFly(){
        storyState = 'recallfly';
        storyEl('storyOverlay').style.display = 'block';
        storyEl('storySubtitle').style.display = 'none';
        storyEl('storyDialog').style.display = 'none';
        selfplane.imagenode.style.display = 'none';      // 隐藏玩家战机
        storyEl('storyPlane').style.display = 'block';
        storyEl('storyPlane').style.left = '16%';
        storyEl('storyPlane').style.bottom = '6%';
        storyEl('storyPlane').style.width = '90px';
        storyEl('storyPlane2').style.display = 'block';
        storyEl('storyPlane2').style.right = '16%';
        storyEl('storyPlane2').style.bottom = '6%';
        storyEl('storyPlane2').style.width = '90px';
        storyTimer.push(setTimeout(function(){ startRecall(); }, 3800));
    }

    // 回忆对话（立绘 + 双机 + 连续台词，点完进入教学）
    function startRecall(){
        var rm = flowMod('recall');
        if(!rm){ startTeach(); return; }   // 未添加回忆模块：跳过直接教学
        storyState = 'recall';
        storyStep = 0;
        storyEl('storySubtitle').style.display = 'none';
        resetCharSlots();   // 立绘由首句台词的 L/R 决定
        storyEl('storyPlane').style.display = 'block';
        storyEl('storyPlane').style.left = '16%';
        storyEl('storyPlane').style.bottom = '6%';
        storyEl('storyPlane').style.width = '90px';
        storyEl('storyPlane2').style.display = 'block';
        storyEl('storyPlane2').style.right = '16%';
        storyEl('storyPlane2').style.bottom = '6%';
        storyEl('storyPlane2').style.width = '90px';
        startModule(rm, 'recall');
    }

    // 新手教学
    function startTeach(){
        storyState = 'teach';
        storyEl('storyDialog').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        // 阿伟伴飞（侧后方小图）
        storyEl('storyCharL').style.display = 'none';
        storyEl('storyPlane').style.display = 'none';
        var teachR = storyEl('storyCharR');
        if(teachR.style.display === 'none') teachR.src = 'image/role/阿伟-温柔微笑.png';
        teachR.style.display = 'block';
        teachR.style.transition = 'all .6s ease';
        teachR.style.right = '4%'; teachR.style.bottom = '20%';
        teachR.style.height = '24%'; teachR.style.opacity = '0.9';
        storyEl('storyPlane2').style.display = 'block';
        storyEl('storyPlane2').style.right = '8%';
        storyEl('storyPlane2').style.bottom = '2%';
        storyEl('storyPlane2').style.width = '54px';
        // 玩家飞机
        selfplane.imagenode.style.display = 'block';
        selfplane.imagenode.style.left = (bodyWidth/2 - selfplane.sizeX/2) + 'px';
        selfplane.imagenode.style.top = (bodyheight - 120) + 'px';
        teaching = {move:false, shoot:false, kill:0};
        teachStartX = parseInt(selfplane.imagenode.style.left);
        teachStartY = parseInt(selfplane.imagenode.style.top);
        teachKillBase = destroyedEnemys.length;
        storyEl('storyTip').style.display = 'block';
        updateTeachTip();
    }

    function updateTeachTip(){
        var s = '【新手教学】　';
        s += teaching.move ? '✔ 移动战机　' : '□ 移动战机　';
        s += teaching.shoot ? '✔ 发射子弹　' : '□ 发射子弹　';
        s += teaching.kill >= 2 ? '✔ 击碎碎片' : '□ 击碎碎片 (' + teaching.kill + '/2)';
        storyEl('storyTip').innerHTML = s;
    }

    // start() 中每帧检测教学进度
    function checkTeach(){
        var px = parseInt(selfplane.imagenode.style.left);
        var py = parseInt(selfplane.imagenode.style.top);
        if(!teaching.move && (Math.abs(px - teachStartX) > 40 || Math.abs(py - teachStartY) > 40)){
            teaching.move = true;
        }
        if(!teaching.shoot && bullets.length > 0){
            teaching.shoot = true;
        }
        teaching.kill = Math.max(teaching.kill, destroyedEnemys.length - teachKillBase);
        updateTeachTip();
        if(teaching.move && teaching.shoot && teaching.kill >= 2){
            startIncident();
        }
    }

    // 突发变故：前 7 句台词点击推进，画面节拍与句子一一对应
    function startIncident(){
        var im = flowMod('incident');
        storyState = 'incident';
        clearStoryTimer();
        clearObjects();
        storyEl('storyOverlay').style.display = 'block';
        storyEl('storyTip').style.display = 'none';
        storyEl('storyDialog').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        // 未添加「变故」模块：跳过整段变故，直接进入剧情杀战斗
        if(!im || !(im.lines || []).length){
            startShipFight();
            return;
        }
        resetCharSlots();   // 立绘由首句台词的 L/R 决定（小爱左、阿伟右）
        storyEl('storyPlane').style.display = 'block';
        storyEl('storyPlane').style.left = '30%';
        storyEl('storyPlane').style.bottom = '6%';
        storyEl('storyPlane').style.width = '90px';
        storyEl('storyPlane2').style.display = 'block';
        storyEl('storyPlane2').style.right = '26%';
        storyEl('storyPlane2').style.bottom = '6%';
        storyEl('storyPlane2').style.width = '90px';
        ['storyGlow','storyAlien','storyBeam','storyShield'].forEach(function(id){ storyEl(id).style.display = 'none'; });
        startIncidentLines(im);
    }

    // 剧情战斗：小爱 vs 外星飞船（血厚不可战胜，剧情杀）
    function startShipFight(){
        storyState = 'shipfight';
        clearStoryTimer();
        clearObjects();
        var ov = storyEl('storyOverlay');
        ov.classList.add('transparent-bg');     // 战斗时背景透明，露出游戏画面
        ov.style.zIndex = '5';
        selfplane.imagenode.style.zIndex = '30';
        ['storyGlow','storyBeam','storyShield','storyCharL','storyCharR','storyPlane','storyPlane2'].forEach(function(id){ storyEl(id).style.display = 'none'; });
        storyEl('storySubtitle').style.display = 'none';
        storyEl('storyDialog').style.display = 'none';
        // 玩家战机满血出战
        selfplane.planehp = 3;
        life.style.width = '60px';
        selfplane.hpbar.style.width = selfplane.sizeX + 'px';
        selfplane.imagenode.style.display = 'block';
        selfplane.imagenode.style.left = (bodyWidth/2 - selfplane.sizeX/2) + 'px';
        selfplane.imagenode.style.top = (bodyheight - 150) + 'px';
        // 外星飞船登场（中上方，放大）
        var a = storyEl('storyAlien');
        a.style.display = 'block';
        a.style.left = (bodyWidth*0.3) + 'px';
        a.style.top = '6%';
        a.style.right = 'auto';
        a.style.width = '200px';
        // 巨型血条（剧情杀，几乎不掉）
        shipHp = 50000;
        storyEl('shipHpWrap').style.display = 'block';
        storyEl('shipHpFill').style.width = '100%';
        fightStartMark = mark;
        // 第 8 句台词：开战怒吼（旁白字幕，自动播放 2.5 秒）
        var incM = flowMod('incident');
        var roar = incM ? (incM.lines || [])[INCIDENT_PRE_FIGHT] : null;
        if(roar && roar.text){
            showStorySubtitle(roar.text);
            storyTimer.push(setTimeout(function(){ storyEl('storySubtitle').style.display = 'none'; }, 2500));
        }
    }

    // 剧情杀：小爱战机血量耗尽 → 飞机着火 → 第 9 句台词（坠机痛苦）→ 点击转场现实
    function shipCrash(){
        if(storyState !== 'shipfight') return;
        storyState = 'shipcrash';
        clearObjects();                          // 清空弹幕
        storyEl('storyAlien').style.display = 'none';
        storyEl('shipHpWrap').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        // 飞机着火
        if(selfplane.imagenode.className.indexOf('plane-onfire') < 0){
            selfplane.imagenode.className += ' plane-onfire';
        }
        var f = storyEl('storyFire');
        f.style.display = 'block';
        f.style.left = (parseInt(selfplane.imagenode.style.left) - 12) + 'px';
        f.style.top = (parseInt(selfplane.imagenode.style.top) - 28) + 'px';
        // 第 9 句台词：有则点击继续，无则 1.5 秒后自动转场
        var incM2 = flowMod('incident');
        var pain = incM2 ? (incM2.lines || [])[INCIDENT_PRE_FIGHT + 1] : null;
        if(pain && pain.text){
            if((pain.speaker || '') === '旁白') showStorySubtitle(pain.text);
            else showStoryDialog(pain.speaker || '', pain.text);
        }else{
            storyTimer.push(setTimeout(function(){ startReality(); }, 1500));
        }
    }

    // 现实启程：先隐藏立绘/对话框 → 画面模糊 → 闪白 → 变清晰 → 现实
    function startReality(){
        storyEl('storyCharL').style.display = 'none';
        storyEl('storyCharR').style.display = 'none';
        hideStoryDialog();
        storyEl('storyPlane').style.display = 'none';
        storyEl('storyPlane2').style.display = 'none';
        storyEl('shipHpWrap').style.display = 'none';
        storyEl('storyFire').style.display = 'none';
        selfplane.imagenode.className = selfplane.imagenode.className.replace(/\s*plane-onfire/g, '');
        var m = document.getElementById('maindiv');
        m.style.transition = 'filter 1.1s ease';
        m.style.filter = 'blur(14px)';                  // 画面变模糊
        storyTimer.push(setTimeout(function(){
            // 闪白
            var fl = storyEl('storyFlash');
            fl.style.display = 'block';
            fl.style.transition = 'opacity .22s ease';
            fl.style.opacity = '1';
            storyTimer.push(setTimeout(function(){
                fl.style.opacity = '0';
                storyTimer.push(setTimeout(function(){
                    fl.style.display = 'none';
                    m.style.filter = '';                // 变清晰
                    m.style.transition = '';
                    var ov = storyEl('storyOverlay');
                    ov.classList.remove('transparent-bg');
                    ov.style.zIndex = '90';
                    selfplane.imagenode.style.zIndex = '';
                    storyState = 'reality';
                    storyStep = 100;
                    ['storyGlow','storyAlien','storyBeam','storyShield'].forEach(function(id){ storyEl(id).style.display = 'none'; });
                    storyEl('storyPlane2').style.display = 'none';
                    storyEl('storyPlane').style.display = 'block';
                    storyEl('storyPlane').style.left = '44%';
                    storyEl('storyPlane').style.bottom = '4%';
                    storyEl('storyPlane').style.width = '90px';
                    resetCharSlots();   // 立绘由现实段首句 L 决定
                    var rm2 = flowMod('reality');
                    if(rm2) startModule(rm2, 'reality');
                    else startBattle();   // 未添加现实模块：转场后直接开战
                }, 300));
            }, 320));
        }, 1000));
    }

    // 正式开战
    function startBattle(){
        storyState = 'battle';
        clearStoryTimer();
        storyEl('storyOverlay').style.display = 'none';
        storyEl('storyTip').style.display = 'none';
        document.getElementById('maindiv').style.filter = '';
        storyEl('storyRecallTitle').style.display = 'none';
        storyEl('storyFire').style.display = 'none';
        selfplane.imagenode.className = selfplane.imagenode.className.replace(/\s*plane-onfire/g, '');
        // 开战满血
        selfplane.planehp = 3;
        life.style.width = '60px';
        selfplane.hpbar.style.width = selfplane.sizeX + 'px';
        selfplane.imagenode.style.display = 'block';
        showLevelBanner();
        armBattleModules();   // 自动挂载战斗事件模块（time/kill/hp/boss）
    }

    // 跳过剧情
    function skipStory(){
        if(lineCtx.mod && !lineCtx.flow){ endBattleModule(); return; }   // 战斗过场：跳过本模块恢复战斗
        clearStoryTimer();
        storyEl('storyOverlay').style.display = 'none';
        storyEl('storyTip').style.display = 'none';
        document.getElementById('maindiv').style.filter = '';
        storyEl('storyRecallTitle').style.display = 'none';
        if(storyState === 'ending'){
            showLevelClearBox();
        }else{
            startBattle();
        }
    }

    // 第1关通关剧情（连续台词）
    function playLevelEnding(){
        var em = flowMod('ending');
        if(!em){ showLevelClearBox(); return; }   // 未添加通关模块：直接过关框
        storyState = 'ending';
        storyStep = 200;
        storyEl('storyOverlay').style.display = 'block';
        storyEl('storyTip').style.display = 'none';
        storyEl('storySubtitle').style.display = 'none';
        ['storyGlow','storyAlien','storyBeam','storyShield'].forEach(function(id){ storyEl(id).style.display = 'none'; });
        storyEl('storyPlane2').style.display = 'none';
        storyEl('storyPlane').style.display = 'block';
        storyEl('storyPlane').style.left = '44%';
        storyEl('storyPlane').style.bottom = '4%';
        storyEl('storyPlane').style.width = '90px';
        resetCharSlots();   // 立绘由通关段首句 L 决定
        startModule(em, 'ending');
    }

    // 显示过关框（剧情结束后）
    function showLevelClearBox(){
        storyState = 'battle';
        storyEl('storyOverlay').style.display = 'none';
        document.getElementById('clearTitle').innerHTML = '第 1 关 通过';
        document.getElementById('clearScore').innerHTML = scores;
        document.getElementById('levelClearBox').style.display = 'block';
    }

    // 剧情交互事件（对话框与旁白字幕均可点击推进）
    storyEl('storyDialog').addEventListener('click', storyNext);
    storyEl('storySubtitle').addEventListener('click', storyNext);
    storyEl('storySubtitle').style.cursor = 'pointer';
    storyEl('storySkipBtn').addEventListener('click', function(e){ e.stopPropagation(); skipStory(); });

    /*
    开始函数
     */
    function start() {
        if(storyFrozen || bpOpen) return;   // 剧情过场播放中/背包面板打开：冻结战斗
        if(!hoverOn) scrollBg();            // 悬停时画面停止向前滚动
        // 总进程标志位++
        mark++;
        mark1++;
        frameNewSkills();   // 新玩法每帧驱动（拉升/氮气/能量/激光/HUD）
        /*
        创建敌方飞机和补给包（本关刷怪表驱动）
         */
        // 开场独飞：小爱战机自动巡航摆动 1.5 秒（75帧）后触发独白
        if(storyState === 'fly'){
            var fx = introFlyBaseX + Math.sin(mark/28) * 110;
            var fy = introFlyBaseY + Math.cos(mark/22) * 30;
            selfplane.imagenode.style.left = fx + 'px';
            selfplane.imagenode.style.top = fy + 'px';
            if(mark >= 75 && !introTriggered){
                introTriggered = true;
                // 等 story.json 加载完成后再进开场独白（加载通常远快于 1.5 秒巡航）
                storyConfigReady.then(function(){ if(storyState === 'fly') showIntroDialog(); });
            }
        }
        // 剧情战斗：小爱 vs 外星飞船（血厚不可战胜，剧情杀）
        if(storyState === 'shipfight'){
            var sa = storyEl('storyAlien');
            var sbx = sa.offsetLeft + sa.offsetWidth/2;
            var sby = sa.offsetTop + sa.offsetHeight - 6;
            if(mark % 45 === 0){
                enemybullets.push(new enemybullet2(sbx - 17, sby));          // 追踪弹
                enemybullets.push(new enemybullet1(sbx - 60, sby));
                enemybullets.push(new enemybullet1(sbx + 40, sby));
            }
            // 战斗上限约 20 秒（1000帧），若玩家仍存活则强制剧情杀
            if(mark - fightStartMark > 1000){
                selfplane.planehp = 0;
            }
        }
        // 着火阶段：火焰跟随飞机
        if(storyState === 'shipcrash'){
            var f1 = storyEl('storyFire');
            f1.style.left = (parseInt(selfplane.imagenode.style.left) - 12) + 'px';
            f1.style.top = (parseInt(selfplane.imagenode.style.top) - 28) + 'px';
        }
        if(storyState === 'teach'){
            // 教学碎片：缓慢气流碎片，不发射子弹
            if(mark % 130 === 0 && mark < 1700 && !hoverOn){
                var frag = spawnEnemy('e1', 'left-right1', 'default');
                frag.hasfire = false;
                frag.planehp = 2;
                frag.hpbartotal.setAttribute('hp', 2);
                enemys.push(frag);
            }
            checkTeach();
        }else if(storyState === 'battle' || storyState === null){
            var wl = currentLevel.waves;
            for (var wi = 0; wi < wl.length; wi++) {
                // 悬停期间新敌潮暂缓（按时刻排队），解除悬停后继续刷出
                if (mark >= wl[wi][0] && !wl[wi]._fired && !hoverOn) {
                    wl[wi]._fired = true;
                    enemys.push(spawnEnemy(wl[wi][1], wl[wi][2], wl[wi][3]));
                }
            }
        }
        // 本关 Boss 出场
        if (currentLevel && (storyState === 'battle' || storyState === null) && mark === currentLevel.bossAt && !newboss1) {
            mark1 = 1;
            newboss1 = new boss1(-50, 50, 'boss-middle', 'bossbullet1');
            newboss1.planehp = currentLevel.bossHp;
            newboss1.hpbartotal.setAttribute('hp', newboss1.planehp);
            newboss1.hpbar.style.width = newboss1.sizeX + 'px';
            newboss1.imagenode.style.zIndex = '2';
            enemys.push(newboss1);   // Boss 加入敌机数组：才能被子弹/激光伤害并触发过关
        }
        if(newboss1 && mark1 % 122 === 0 ){
            if(newboss1 && newboss1.imagenode.offsetLeft>0){
                newboss1.trailName = 'boss-left'
            }else{
                newboss1.trailName = 'boss-right'
            }
            newboss1.bulletType = 'bossbullet1'
        }
        if(newboss1 && mark1 % 172 === 0){
            if(newboss1.imagenode.offsetLeft>0){
                newboss1.trailName = 'boss-left'
            }else{
                newboss1.trailName = 'boss-right'
            }
            newboss1.bulletType = 'bossbullet2'
        }
        if(newboss1 && mark1 % 216 === 0){
            newboss1.trailName = 'boss-middle' 
            newboss1.bulletType = 'bossbullet3'
        }
        if(newboss1 && newboss1.planehp<=0){
            levelClear();
        }
        /*
        移动敌方飞机
         */
        for (var i = 0; i < enemys.length; i++) {
            /*如果敌机超出边界,删除敌机*/
            if (enemys[i].imagenode.offsetTop > bodyheight || enemys[i].imagenode.offsetLeft > bodyWidth +100 || enemys[i].imagenode.offsetTop < -100 ||enemys[i].imagenode.offsetLeft < -60) {
                missedEnemys.push(enemys[i]);
                mainDiv.removeChild(enemys[i].imagenode);
                enemys.splice(i, 1);
            } else {
                if (!enemys[i].planeisdie) {
                    enemys[i].planmove(parseInt(enemys[i].imagenode.style.left),parseInt(selfplane.imagenode.style.left)+selfplane.sizeX/2,enemys[i].imagenode.offsetTop+enemys[i].sizeY/2,selfplane.imagenode.offsetTop+selfplane.sizeY/2);
                    if (enemys[i].hasfire && mark % (enemys[i].bulletFrequency) == 0) {
                        // 创建敌军子弹
                        switch (enemys[i].bulletType){
                            case 'default':
                                enemybullets.push(new enemybullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -7, parseInt(enemys[i].imagenode.style.top) + 40));
                                break;
                            case 'autotrack':
                                enemybullets.push(new enemybullet2(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -17, parseInt(enemys[i].imagenode.style.top) + 40));
                                break;
                            case 'missile':
                                enemybullets.push(new enemybullet3(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40));
                                break;
                            case 'bossbullet1':
                                enemybullets.push(new bossbullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40,-3));
                                enemybullets.push(new bossbullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40,-2));
                                enemybullets.push(new bossbullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40,-1));
                                enemybullets.push(new bossbullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40,0));
                                enemybullets.push(new bossbullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40,1));
                                enemybullets.push(new bossbullet1(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2 -6, parseInt(enemys[i].imagenode.style.top) + 40,2));
                                break;
                            case 'bossbullet2':
                                enemybullets.push(new bossbullet2(parseInt(enemys[i].imagenode.style.left), parseInt(enemys[i].imagenode.style.top) + 20,0));
                                enemybullets.push(new bossbullet2(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX/2, parseInt(enemys[i].imagenode.style.top) + 20,0));
                                enemybullets.push(new bossbullet2(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX, parseInt(enemys[i].imagenode.style.top) + 10,0));
                                break;
                            case 'bossbullet3':
                                enemybullets.push(new bossbullet3(parseInt(enemys[i].imagenode.style.left), parseInt(enemys[i].imagenode.style.top) + 20,0));
                                enemybullets.push(new bossbullet3(parseInt(enemys[i].imagenode.style.left) + enemys[i].sizeX, parseInt(enemys[i].imagenode.style.top) + 20,0));
                                break;
                        }
                    }
                    if(enemys[i].underattack){
                        enemys[i].showattacktime += 20;
                        if(enemys[i].showattacktime == 320){
                            removeClass(enemys[i].imagenode, 'underattack')
                            enemys[i].underattack = false;
                            enemys[i].showattacktime = 0;
                            enemys[i].hpbar.innerHTML = ''
                        }
                        if (enemys[i].issuffercrit && enemys[i].showattacktime == 300) {
                            enemys[i].issuffercrit == false;
                            removeClass(enemys[i].imagenode, 'critdamage')
                            enemys[i].hpbar.innerHTML = ''
                        }
                    }
                    
                } else {
                    enemys[i].planedietimes += 20;
                    if (enemys[i].planedietimes == enemys[i].planedietime) {
                        if(hasClass(enemys[i].imagenode,'enemys2')|| hasClass(enemys[i].imagenode,'enemys7')){
                            var a =  randomInt(0,7)
                            switch(a){
                            case 0:
                                supplybags.push(new supplybulletspeed(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 1:
                                supplybags.push(new supplyextralife(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 2:
                                supplybags.push(new supplyfirebullets(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 3:
                                supplybags.push(new supplytwobullets(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 4:
                                supplybags.push(new supplylaserbullets(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 5:
                                supplybags.push(new supplyattack(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 6:
                                supplybags.push(new supplycritRate(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            case 7:
                                supplybags.push(new supplyshotgun(parseInt(enemys[i].imagenode.style.left),enemys[i].imagenode.offsetTop));
                                break;
                            }
                        }
                        destroyedEnemys.push(enemys[i]);
                        mainDiv.removeChild(enemys[i].imagenode);
                        enemys.splice(i, 1);
                    }
                }
            }
        }

        /*创建我军子弹*/
        if (!pullUp && (storyState === 'teach' || storyState === 'battle' || storyState === 'shipfight' || storyState === null)) {
        // 氮气冲刺时大幅提升射速
        var fireFreq = selfplane.bulletFrequency-bulletSpeed-bulletSpeedExtra-(nitroActive ? 6 : 0);
        if(fireFreq < 2) fireFreq = 2;
        if (mark % fireFreq == 0) {
            if(storyState === 'teach') teaching.shoot = true;
            switch(selfplane.bulletType){
                case 'default':
                    bullets.push(new defaultbullet(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2) - 7, parseInt(selfplane.imagenode.style.top) - 12));
                    break;
                case 'twobullets':
                    bullets.push(new doublebullet(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2) - 15, parseInt(selfplane.imagenode.style.top) - 12));
                    break;
                case 'firebullets':
                    bullets.push(new firebullet(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2) - 17.5, parseInt(selfplane.imagenode.style.top) - 12));
                    break;
                case 'laserbullets':
                    bullets.push(new laserbullet(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2) - 6, parseInt(selfplane.imagenode.style.top) - 12));
                    break;
                case 'shotgun':
                    bullets.push(new shotgun(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2) -20, parseInt(selfplane.imagenode.style.top) - 12,-2));
                    bullets.push(new shotgun(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2) - 10, parseInt(selfplane.imagenode.style.top) - 12,0));
                    bullets.push(new shotgun(parseInt(selfplane.imagenode.style.left) + (selfplane.sizeX/2), parseInt(selfplane.imagenode.style.top) - 12,2));
                    break;
            }
        }
        }

        /*移动我方子弹*/
        for (var i = 0; i < bullets.length; i++) {
            //当前子弹的速度
            bulletSpeed = bullets[i].speedY
            bullets[i].bulletmove();
            /*如果子弹超出边界,删除子弹（追踪导弹额外判断左右越界）*/
            if (bullets[i].imagenode.offsetTop < -40 || bullets[i].imagenode.offsetLeft < -60 || bullets[i].imagenode.offsetLeft > bodyWidth + 60) {
                mainDiv.removeChild(bullets[i].imagenode);
                bullets.splice(i, 1);
            }
        }

        /*移动敌军子弹*/
        for (var i = 0; i < enemybullets.length; i++) {
            enemybullets[i].bulletmove(parseInt(enemybullets[i].imagenode.style.left),parseInt(selfplane.imagenode.style.left)+selfplane.sizeX/2,enemybullets[i].imagenode.offsetTop+enemybullets[i].sizeY/2,selfplane.imagenode.offsetTop+selfplane.sizeY/2);
            /*如果子弹超出边界,删除子弹*/
            if (enemybullets[i].imagenode.offsetTop > bodyheight) {
                mainDiv.removeChild(enemybullets[i].imagenode);
                enemybullets.splice(i, 1);
            }
        }
        /*移动补给包*/
        for (var i = 0; i < supplybags.length; i++) {
            supplybags[i].move();
            /*如果补给包超出边界,删除补给包*/
            if (supplybags[i].imagenode.offsetTop > bodyheight) {
                mainDiv.removeChild(supplybags[i].imagenode);
                supplybags.splice(i, 1);
            }
            //当补给包被拾取，经过一段时间后清除补给包
            if (supplybags[i] && supplybags[i].istaken === true) {
                supplybags[i].dietimes += 20;
                if (supplybags[i].dietimes == supplybags[i].dietime) {
                    mainDiv.removeChild(supplybags[i].imagenode);
                    supplybags.splice(i, 1);
                }
            }
        }

        /*碰撞判断*/

        for (var i = 0; i < bullets.length; i++) {
            for (var j = 0; j < enemys.length; j++) {
                //判断敌军飞机碰撞我方飞机
                if (enemys[j].planeisdie == false) {
                    if (isCollide(enemys, 'selfplane', i, j) && storyState !== 'teach' && !pullUp && !nitroActive) {
                        selfplane.planehp = 0
                        life.style.width = selfplane.planehp*20 + 'px';
                        checkBattleModules('hp', selfplane.planehp);   // 自动挂载「血量降至N」模块
                    }
                    //判断我方子弹与敌机碰撞
                    if (isCollide(bullets, enemys, i, j)) {
                        enemys[j].showattacktime = 0;
                        enemys[j].underattack = true;
                        if(!hasClass(enemys[j].imagenode,'underattack')){
                            addClass(enemys[j].imagenode, ' underattack')
                        }
                        //敌军生命 = 敌机血量 - 子弹攻击力 - （子弹暴击率*子弹暴击伤害*子弹攻击力）
                        var isCrit = getRandom(bullets[i].critRate + bulletCritExtra)
                        // var attack = bullets[i].bulletattck + bulletAttackExtra + isCrit * bullets[i].critDamage * (bullets[i].bulletattck + bulletAttackExtra)
                        var attack = (bullets[i].bulletattck + bulletAttackExtra) * (1 + isCrit * bullets[i].critDamage)
                        enemys[j].hpbar.innerHTML = '-' + attack
                        // 暴击效果
                        if(isCrit){
                            enemys[j].issuffercrit = true
                            removeClass(enemys[j].imagenode, 'underattack')
                            addClass(enemys[j].imagenode, 'critdamage')
                        }
                        enemys[j].planehp = enemys[j].planehp - attack;
                        enemys[j].hpbar.style.width = parseInt(enemys[j].hpbartotal.style.width)/parseInt(enemys[j].hpbartotal.getAttribute('hp')) * enemys[j].planehp + 'px';
                        //敌机血量为0，敌机图片换为爆炸图片，死亡标记为true，计分
                        if (enemys[j].planehp <= 0) {
                            killEnemyCommon(enemys[j]);   // 爆炸计分 + 氮气/能量充能
                        }
                        //删除子弹
                        mainDiv.removeChild(bullets[i].imagenode);
                        bullets.splice(i, 1);
                        break;
                    }
                }
            }
        }
        // 判断敌方子弹与我方飞机碰撞
        for (var i = 0; i < enemybullets.length; i++) {
            if (isCollide(enemybullets, 'selfplane', null, i) && storyState !== 'teach' && !pullUp && !nitroActive) {
                if (!this.hasClass(selfplane.imagenode, 'breathe')) selfplane.planehp--;
                addClass(selfplane.imagenode, 'breathe')
                // 3秒无敌状态
                setTimeout(function () {
                    removeClass(selfplane.imagenode, 'breathe')
                }, 3000)
                life.style.width = selfplane.planehp*20 + 'px';
                if(selfplane.planehp<3){
                    selfplane.hpbar.style.width = selfplane.sizeX / 3 * selfplane.planehp + 'px';
                }
                checkBattleModules('hp', selfplane.planehp);   // 自动挂载「血量降至N」模块
                //删除子弹
                mainDiv.removeChild(enemybullets[i].imagenode);
                enemybullets.splice(i, 1);
            }
        }
        // 判断是否拾取补给包（道具统一收入背包，打开背包手动使用）
        for (var i = 0; i < supplybags.length; i++) {
            if (isCollide(supplybags, 'selfplane', null, i)) {
                addToBag(supplybags[i].type);
                supplybags[i].supplybagSound.play();
                supplybags[i].imagenode.style.display = 'none';
                supplybags[i].istaken = true
            }
        }
        
        if (selfplane.planehp <= 0) {
            if(storyState === 'shipfight'){
                shipCrash();        // 剧情杀：着火 + 喊叫 + 转场
            }else if(storyState === null || storyState === 'battle'){
                endGame('Failed');  // 仅正常战斗阶段才失败结算
            }
            // 其他剧情阶段不触发失败
        }
    }

    // 碰撞检测条件(array1宽高比array2小)
    function isCollide(array1, array2, i, j) {
        //array1最右边大于array2最左边，array1最左边小于array2最右边
        var leftside = false
        var topside = false
        if (array2 === 'selfplane') {
            leftside = (array1[j].imagenode.offsetLeft + array1[j].sizeX > selfplane.imagenode.offsetLeft) && (array1[j].imagenode.offsetLeft < selfplane.imagenode.offsetLeft + selfplane.sizeX)
            topside = (array1[j].imagenode.offsetTop <= selfplane.imagenode.offsetTop + selfplane.sizeY) && (array1[j].imagenode.offsetTop + array1[j].sizeY >= selfplane.imagenode.offsetTop)
        } else {
            leftside = (array1[i].imagenode.offsetLeft + array1[i].sizeX > array2[j].imagenode.offsetLeft) && (array1[i].imagenode.offsetLeft < array2[j].imagenode.offsetLeft + array2[j].sizeX)
            //array1最下面边大于array2最上边，array1最上边小于array2最下边
            topside = (array1[i].imagenode.offsetTop <= array2[j].imagenode.offsetTop + array2[j].sizeY) && (array1[i].imagenode.offsetTop + array1[i].sizeY >= array2[j].imagenode.offsetTop)
        }

        if (leftside && topside) {
            return true
        } else {
            return false
        }
    }
    /*
    开始游戏按钮点击事件
     */
    var set;

    function begin() {
        if(startdiv) startdiv.style.display = "none";
        mainDiv.style.display = "block";
        selfplane.imagenode.style.display = "block";
        scorediv.style.display = "block";
        // 新一局：重置武器加成、生命、武器与分数
        bulletSpeedExtra = 0;
        bulletCritExtra = 0;
        bulletAttackExtra = 0;
        selfplane.bulletType = 'default';
        selfplane.planehp = 3;
        selfplane.hpbartotal.setAttribute('hp', 3);
        selfplane.hpbar.style.width = selfplane.sizeX + 'px';
        life.style.width = '60px';
        scores = 0;
        scorelabel.innerHTML = 0;
        resetNewSkills();   // 重置新玩法状态（悬停/拉升/氮气/能量/激光）
        startLevel(currentLevelIndex);
        /*调用开始函数*/
        set = setInterval(start, 20);
        // 仅第 1 关播放剧情；其余关卡直接开战
        if(LEVEL_HAS_STORY){
            storyEndingPlayed = false;
            startStory();
        }else{
            storyState = 'battle';
            showLevelBanner();
            armBattleModules();   // 非剧情关同样自动挂载战斗事件模块（time/kill/hp/boss/自定义标识）
        }
    }
    function endGame(missionstatus){
        missionstatusLabel.innerHTML = missionstatus;
        //游戏结束，统计分数
        if(missionstatus == 'Failed'){
           selfplane.boomimage.style.display = 'block';
            selfplane.boomSound.play(); 
        }
        enddiv.style.display = "block";
        planscore.innerHTML = scores;
        var _skillHUD = document.getElementById('skillHUD');
        if(_skillHUD) _skillHUD.style.display = 'none';   // 结算时隐藏技能 HUD
        // 直接跳转模式：本页面自行将分数写入数据库（情侣排行榜）
        try { if (window.savePlaneScore) window.savePlaneScore(scores); } catch(e) {}
        if (document.removeEventListener) {
            mainDiv.removeEventListener("touchmove", yidong, true);
            bodyobj.removeEventListener("touchmove", bianjie, true);
        }
        clearInterval(set);
    }
    //游戏结束后点击下一步按钮事件
    function next() {
        enddiv.style.display = "none";
        document.getElementById('gradingBox').style.display = 'block';
        document.getElementById('destroyedEnemys').innerHTML = destroyedEnemys.length;
        document.getElementById('missedEnemys').innerHTML = missedEnemys.length;

        if(destroyedEnemys.length>28){
            document.getElementById('grading').innerHTML = 'SSS';
            grade = 4;
        }
        if(destroyedEnemys.length <= 28 && destroyedEnemys.length > 23){
            document.getElementById('grading').innerHTML = 'AAA';
            grade = 3;
        }
        if(destroyedEnemys.length <= 23 && destroyedEnemys.length > 18){
            document.getElementById('grading').innerHTML = 'BBB';
            grade = 2;
        }
        if(destroyedEnemys.length <= 18 && destroyedEnemys.length > 13){
            document.getElementById('grading').innerHTML = 'CCC';
            grade = 1;
        }
        if(destroyedEnemys.length <= 13){
            document.getElementById('grading').innerHTML = 'DDD';
            grade = 0;
        }
        if (!window.localStorage) {
            console.log("浏览器不支持localstorage");
            return false;
        } else {
            var oldScore = window.localStorage.getItem("highScore")
            if (!oldScore || oldScore < scores) {
                window.localStorage.setItem("highScore", scores);
            }
            var oldGrade = window.localStorage.getItem("highgrade")
            if (!oldGrade || oldGrade < grade) {
                window.localStorage.setItem("highgrade", grade);
            }
        }
    }
    //游戏结束 / 回到主页：返回关卡选择页
    function end() {
        window.location.href = './index.html';
    }


    // 判断是否有存在某个class
    function hasClass(ele, cls) {
        return ele.className.match(new RegExp("(\\s|^)" + cls + "(\\s|$)"));
    }
    //为指定的dom元素添加样式
    function addClass(ele, cls) {
        if (!this.hasClass(ele, cls)) ele.className += " " + cls;
    }
    //删除指定dom元素的样式
    function removeClass(ele, cls) {
        if (hasClass(ele, cls)) {
            var reg = new RegExp("(\\s|^)" + cls + "(\\s|$)");
            ele.className = ele.className.replace(reg, "");
        }
    }
    //产生min到max之间的随机数
    function random(min, max) {
        return Math.floor(min + Math.random() * (max - min));
    }
    //产生min到max之间的随机整数
    function randomInt(min, max) {
        return parseInt(Math.random()*(max-min+1)+min,10)
    }
    // 暴击率触发可能性
    function getRandom(probability){  
        var probability = probability*100;  
        var odds = Math.floor(Math.random()*100);  
       
        if(probability === 1){return 1};
        if(odds < probability){  
            return 1;  
        }else{  
            return 0;  
        }  
    };  
    /* =====================================================================
       新玩法系统：悬停 / 拉升 / 背包 / 氮气 / 能量（导弹·激光）
       HUD 由引擎动态注入（所有关卡通用），样式见 css/main.css
       键位：Q 悬停 | E 拉升 | 空格 氮气 | 1 导弹 | 2 激光 | B 背包
       ===================================================================== */
    // ---- 状态 ----
    var hoverOn = false;          // 悬停：画面停止滚动，新敌潮暂缓
    var pullUp = false;           // 拉升进行中（规避碰撞，不能开火）
    var pullUpLeft = 0;           // 拉升剩余帧
    var pullUpCdLeft = 0;         // 拉升冷却剩余帧
    var PULL_UP_FRAMES = 90;      // 拉升持续 1.8s
    var PULL_UP_CD = 250;         // 拉升冷却 5s
    var nitro = 0;                // 氮气值 0-100（击杀敌机充能）
    var nitroActive = false;      // 氮气冲刺中：无敌 + 背景提速 + 射速提升
    var energy = 50;              // 能量值 0-100（击杀/自然回复）
    var MISSILE_COST = 30;        // 导弹齐射耗能
    var LASER_COST = 50;          // 激光炮耗能
    var LASER_FRAMES = 100;       // 激光持续 2s
    var laserLeft = 0, laserTick = 0, laserBeamEl = null;
    var bpOpen = false;           // 背包面板打开（暂停战斗）
    var backpack = {};            // 背包 {道具type: 数量}（localStorage 持久化，跨关携带）
    try { backpack = JSON.parse(localStorage.getItem('plane_backpack') || '{}') || {}; } catch(e) { backpack = {}; }

    // ---- 道具图鉴 ----
    var ITEM_META = {
        twobullets:  { name: '双发弹',   cls: 'supplytwobullets',  desc: '主炮换装双发子弹' },
        bulletspeed: { name: '射速强化', cls: 'supplybulletspeed', desc: '射击间隔缩短（上限5）' },
        extralife:   { name: '备用机体', cls: 'supplyextralife',   desc: '生命值 +1' },
        firebullets: { name: '火焰弹',   cls: 'supplyfirebullets', desc: '主炮换装火焰弹' },
        laserbullets:{ name: '激光弹',   cls: 'supplylaserbullets',desc: '主炮换装激光弹' },
        critRate:    { name: '暴击芯片', cls: 'supplycritRate',    desc: '暴击率 +20%' },
        attack:      { name: '攻击强化', cls: 'supplyattack',      desc: '子弹攻击力 +1' },
        shotgun:     { name: '散弹枪',   cls: 'supplyshotgun',     desc: '主炮换装三向散弹' }
    };

    // 战斗阶段才允许使用技能
    function skillReady(){
        return !bpOpen && (storyState === 'battle' || storyState === null || storyState === 'teach' || storyState === 'shipfight');
    }

    // ---- HUD 注入 ----
    (function buildSkillHUD(){
        var hud = document.createElement('div');
        hud.id = 'skillHUD';
        hud.innerHTML =
            '<div class="skcol skcol-l">' +
                '<button id="skHover" class="skillbtn">悬停<i class="skey">Q</i></button>' +
                '<button id="skPull" class="skillbtn">拉升<i class="skey">E</i></button>' +
                '<button id="skBag" class="skillbtn">背包<i class="skey">B</i><em id="bagBadge">0</em></button>' +
            '</div>' +
            '<div class="skcol skcol-r">' +
                '<button id="skNitro" class="skillbtn">氮气<i class="skey">空格</i></button>' +
                '<button id="skMissile" class="skillbtn">导弹<i class="skey">1</i></button>' +
                '<button id="skLaser" class="skillbtn">激光<i class="skey">2</i></button>' +
            '</div>' +
            '<div id="powerBars">' +
                '<div class="prow"><span>氮气</span><div class="ptrack"><div id="nitroFill"></div></div></div>' +
                '<div class="prow"><span>能量</span><div class="ptrack"><div id="energyFill"></div></div></div>' +
            '</div>' +
            '<div id="gameToast"></div>' +
            '<div id="bagPanel">' +
                '<div class="bag-head">背包<button id="bagClose">×</button></div>' +
                '<div id="bagList"></div>' +
                '<div class="bag-tip">拾取的补给自动收入背包，点击「使用」立即生效</div>' +
            '</div>';
        mainDiv.appendChild(hud);
    })();
    var skHover = document.getElementById('skHover');
    var skPull = document.getElementById('skPull');
    var skBag = document.getElementById('skBag');
    var skNitro = document.getElementById('skNitro');
    var skMissile = document.getElementById('skMissile');
    var skLaser = document.getElementById('skLaser');
    var bagBadge = document.getElementById('bagBadge');
    var bagPanel = document.getElementById('bagPanel');
    var bagList = document.getElementById('bagList');
    var nitroFillEl = document.getElementById('nitroFill');
    var energyFillEl = document.getElementById('energyFill');
    var toastEl = document.getElementById('gameToast');

    // ---- 通用 ----
    var toastTimer = null;
    function toast(msg){
        toastEl.innerHTML = msg;
        toastEl.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function(){ toastEl.style.display = 'none'; }, 1300);
    }
    function refreshBars(){
        nitroFillEl.style.width = nitro + '%';
        energyFillEl.style.width = energy + '%';
        skNitro.classList.toggle('ready', nitro >= 100 && !nitroActive);
    }
    function saveBag(){ try{ localStorage.setItem('plane_backpack', JSON.stringify(backpack)); }catch(e){} }
    function updateBagBadge(){
        var n = 0;
        for(var k in backpack) n += backpack[k] || 0;
        bagBadge.style.display = n > 0 ? 'block' : 'none';
        bagBadge.innerHTML = n;
    }

    // ---- 背包 ----
    function addToBag(type){
        if(!ITEM_META[type]) return;
        backpack[type] = (backpack[type] || 0) + 1;
        saveBag(); updateBagBadge();
        toast('已收入背包：' + ITEM_META[type].name);
    }
    function renderBag(){
        var html = '', any = false;
        for(var t in ITEM_META){
            var c = backpack[t] || 0;
            if(c <= 0) continue;
            any = true;
            html += '<div class="bag-item">' +
                '<i class="supply ' + ITEM_META[t].cls + '"></i>' +
                '<div class="bag-item-info"><b>' + ITEM_META[t].name + '</b><span>' + ITEM_META[t].desc + '</span></div>' +
                '<i class="bag-cnt">×' + c + '</i>' +
                '<button data-type="' + t + '">使用</button></div>';
        }
        bagList.innerHTML = any ? html : '<div class="bag-empty">背包空空如也，击落敌机拾取补给吧</div>';
    }
    function useBagItem(t){
        if(!backpack[t] || backpack[t] <= 0) return;
        var used = true;
        switch(t){
            case 'bulletspeed':
                if(bulletSpeedExtra < 5){ bulletSpeedExtra++; } else { used = false; toast('射速已达到上限'); }
                break;
            case 'twobullets':   selfplane.bulletType = 'twobullets'; break;
            case 'firebullets':  selfplane.bulletType = 'firebullets'; break;
            case 'laserbullets': selfplane.bulletType = 'laserbullets'; break;
            case 'shotgun':      selfplane.bulletType = 'shotgun'; break;
            case 'critRate':     bulletCritExtra += 0.2; break;
            case 'attack':       bulletAttackExtra++; break;
            case 'extralife':
                selfplane.planehp++;
                life.style.width = selfplane.planehp*20 + 'px';
                selfplane.hpbartotal.setAttribute('hp', parseInt(selfplane.hpbartotal.getAttribute('hp')) + 1);
                if(selfplane.planehp <= 3){
                    selfplane.hpbar.style.width = selfplane.sizeX / 3 * selfplane.planehp + 'px';
                }
                break;
            default: used = false;
        }
        if(used){
            backpack[t]--;
            if(backpack[t] <= 0) delete backpack[t];
            saveBag(); renderBag(); updateBagBadge();
            toast('已使用：' + (ITEM_META[t] ? ITEM_META[t].name : t));
        }
    }
    function toggleBag(force){
        var want = (force === undefined) ? !bpOpen : !!force;
        if(want === bpOpen) return;
        bpOpen = want;
        bagPanel.style.display = bpOpen ? 'block' : 'none';
        skBag.classList.toggle('active', bpOpen);
        if(bpOpen) renderBag();
    }
    bagList.addEventListener('click', function(e){
        var btn = e.target;
        if(btn && btn.tagName === 'BUTTON' && btn.getAttribute('data-type')){
            useBagItem(btn.getAttribute('data-type'));
        }
    });
    document.getElementById('bagClose').addEventListener('click', function(e){ e.stopPropagation(); toggleBag(false); });

    // ---- 悬停 ----
    function toggleHover(){
        if(!skillReady()) return;
        hoverOn = !hoverOn;
        if(hoverOn) addClass(selfplane.imagenode, 'hovering');
        else removeClass(selfplane.imagenode, 'hovering');
        skHover.classList.toggle('active', hoverOn);
        toast(hoverOn ? '悬停：停止前进，敌潮暂缓' : '解除悬停，恢复前进');
    }

    // ---- 拉升 ----
    function doPullUp(){
        if(!skillReady() || pullUp || pullUpLeft > 0 || pullUpCdLeft > 0) return;
        pullUp = true;
        pullUpLeft = PULL_UP_FRAMES;
        addClass(selfplane.imagenode, 'pullup');
        skPull.classList.add('active');
        toast('拉升！短时间规避碰撞，无法开火');
    }

    // ---- 氮气 ----
    function gainNitro(n){
        if(nitroActive) return;
        var before = nitro;
        nitro = Math.min(100, nitro + n);
        if(before < 100 && nitro >= 100) toast('氮气已充满！按「空格」极速冲刺');
        refreshBars();
    }
    function doNitro(){
        if(!skillReady() || nitroActive) return;
        if(nitro < 100){ toast('氮气不足：击落敌机充能'); return; }
        nitroActive = true;
        addClass(selfplane.imagenode, 'nitrofly');
        skNitro.classList.remove('ready');
        skNitro.classList.add('active');
        toast('氮气冲刺！无敌 + 提速');
    }

    // ---- 能量与特殊武器 ----
    function gainEnergy(n){
        energy = Math.min(100, energy + n);
        refreshBars();
    }
    function nearestEnemy(x, y){
        var best = null, bd = 1e9;
        for(var i = 0; i < enemys.length; i++){
            var e = enemys[i];
            if(e.planeisdie || !e.imagenode.parentNode) continue;
            var dx = e.imagenode.offsetLeft + e.sizeX/2 - x;
            var dy = e.imagenode.offsetTop + e.sizeY/2 - y;
            var d = dx*dx + dy*dy;
            if(d < bd){ bd = d; best = e; }
        }
        return best;
    }
    function fireMissiles(){
        if(!skillReady()) return;
        if(energy < MISSILE_COST){ toast('能量不足（导弹需 ' + MISSILE_COST + '）'); return; }
        energy -= MISSILE_COST; refreshBars();
        var px = parseInt(selfplane.imagenode.style.left);
        var py = parseInt(selfplane.imagenode.style.top);
        bullets.push(new pmissile(px + 2, py + 6));
        bullets.push(new pmissile(px + selfplane.sizeX - 20, py + 6));
        bullets.push(new pmissile(px + selfplane.sizeX/2 - 9, py - 16));
        bullets.push(new pmissile(px + selfplane.sizeX/2 - 9, py + 12));
        toast('导弹齐射！');
    }
    function fireLaser(){
        if(!skillReady() || laserLeft > 0) return;
        if(energy < LASER_COST){ toast('能量不足（激光需 ' + LASER_COST + '）'); return; }
        energy -= LASER_COST; refreshBars();
        laserLeft = LASER_FRAMES; laserTick = 0;
        if(!laserBeamEl){
            laserBeamEl = document.createElement('div');
            laserBeamEl.id = 'laserBeam';
            mainDiv.appendChild(laserBeamEl);
        }
        laserBeamEl.style.display = 'block';
        // 发射瞬间立即定位（下一帧起由 frameNewSkills 跟随飞机）
        var bx0 = parseInt(selfplane.imagenode.style.left) + selfplane.sizeX/2;
        var bt0 = parseInt(selfplane.imagenode.style.top);
        laserBeamEl.style.left = (bx0 - 13) + 'px';
        laserBeamEl.style.height = Math.max(0, bt0) + 'px';
        try { new Audio('music/bullet/lasergun1.mp3').play(); } catch(e){}
        toast('激光炮发射！');
    }
    // 我方追踪导弹（复用 bullet 基类，type='homing'）
    function pmissile(X, Y){
        bullet.call(this, X, Y, 18, 34, 'bullet pmissile', 8, 'music/bullet/machinegun.mp3', 'friend', 0, 1, 0, 5, 'homing');
        this.mtarget = nearestEnemy(X, Y);
    }

    // ---- 每帧驱动（start() 调用）----
    function frameNewSkills(){
        // 拉升计时
        if(pullUpLeft > 0){
            pullUpLeft--;
            if(pullUpLeft <= 0){
                pullUp = false;
                removeClass(selfplane.imagenode, 'pullup');
                skPull.classList.remove('active');
                pullUpCdLeft = PULL_UP_CD;
                skPull.classList.add('cooling');
                toast('拉升结束，冷却中…');
            }
        }else if(pullUpCdLeft > 0){
            pullUpCdLeft--;
            if(pullUpCdLeft <= 0) skPull.classList.remove('cooling');
        }
        // 氮气消耗（约 4 秒）
        if(nitroActive){
            nitro -= 0.5;
            if(nitro <= 0){
                nitro = 0; nitroActive = false;
                removeClass(selfplane.imagenode, 'nitrofly');
                skNitro.classList.remove('active');
                toast('氮气耗尽');
            }
            refreshBars();
        }
        // 能量自然回复（约 0.8s +1）
        if(energy < 100 && mark % 40 === 0){ energy++; refreshBars(); }
        // 激光持续：跟随飞机 + 周期伤害 + 清弹
        if(laserLeft > 0){
            laserLeft--;
            var bx = parseInt(selfplane.imagenode.style.left) + selfplane.sizeX/2;
            var bt = parseInt(selfplane.imagenode.style.top);
            laserBeamEl.style.left = (bx - 13) + 'px';
            laserBeamEl.style.height = Math.max(0, bt) + 'px';
            laserTick++;
            if(laserTick % 10 === 0){
                var bl = bx - 21, br = bx + 21;
                for(var li = 0; li < enemys.length; li++){
                    var e = enemys[li];
                    if(e.planeisdie) continue;
                    var exl = e.imagenode.offsetLeft, exr = exl + e.sizeX;
                    if(exr > bl && exl < br){
                        e.showattacktime = 0;
                        e.underattack = true;
                        if(!hasClass(e.imagenode, 'underattack')) addClass(e.imagenode, ' underattack');
                        e.hpbar.innerHTML = '-3';
                        e.planehp -= 3;
                        e.hpbar.style.width = parseInt(e.hpbartotal.style.width) / parseInt(e.hpbartotal.getAttribute('hp')) * e.planehp + 'px';
                        if(e.planehp <= 0) killEnemyCommon(e);
                    }
                }
                // 光柱清除途经的敌方子弹
                for(var bi = enemybullets.length - 1; bi >= 0; bi--){
                    var bcx = enemybullets[bi].imagenode.offsetLeft + enemybullets[bi].sizeX/2;
                    if(bcx > bl && bcx < br){
                        mainDiv.removeChild(enemybullets[bi].imagenode);
                        enemybullets.splice(bi, 1);
                    }
                }
            }
            if(laserLeft <= 0) laserBeamEl.style.display = 'none';
        }
    }

    // ---- 击杀公共逻辑（普通子弹 / 激光共用）----
    function killEnemyCommon(e){
        e.hpbar.style.width = 0;
        e.boomSound.play();
        scores = scores + e.planscore;
        scorelabel.innerHTML = scores;
        e.boomimage.style.display = 'block';
        e.planeisdie = true;
        battleKillCount++;
        gainNitro(12);      // 击杀充能氮气
        gainEnergy(3);      // 击杀充能能量
        checkBattleModules('kill', battleKillCount);   // 自动挂载「击落第N架」模块
    }

    // ---- 重置（begin 时调用）----
    function resetNewSkills(){
        hoverOn = false;
        pullUp = false; pullUpLeft = 0; pullUpCdLeft = 0;
        nitro = 0; nitroActive = false;
        energy = 50;
        laserLeft = 0;
        removeClass(selfplane.imagenode, 'hovering');
        removeClass(selfplane.imagenode, 'pullup');
        removeClass(selfplane.imagenode, 'nitrofly');
        skHover.classList.remove('active');
        skPull.classList.remove('active'); skPull.classList.remove('cooling');
        skNitro.classList.remove('active'); skNitro.classList.remove('ready');
        if(laserBeamEl) laserBeamEl.style.display = 'none';
        updateBagBadge();
        refreshBars();
    }

    // ---- 事件绑定 ----
    function bindSkill(el, fn){
        el.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
        el.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
    }
    bindSkill(skHover, toggleHover);
    bindSkill(skPull, doPullUp);
    bindSkill(skBag, function(){ toggleBag(); });
    bindSkill(skNitro, doNitro);
    bindSkill(skMissile, fireMissiles);
    bindSkill(skLaser, fireLaser);
    // 鼠标/触摸是否落在 HUD 区域
    function isHUDTarget(ev){
        var t = ev.target;
        return !!(t && t.closest && t.closest('#skillHUD'));
    }
    document.addEventListener('keydown', function(e){
        if(e.repeat) return;
        var k = (e.key || '').toLowerCase();
        if(k === 'q'){ toggleHover(); }
        else if(k === 'e'){ doPullUp(); }
        else if(k === ' '){ e.preventDefault(); doNitro(); }
        else if(k === '1'){ fireMissiles(); }
        else if(k === '2'){ fireLaser(); }
        else if(k === 'b'){ toggleBag(); }
    });
    updateBagBadge();
    refreshBars();

    // 求子弹追踪我方飞机需要的水平方向速度（自动追踪功能，40表示40*20=800毫秒，子弹从顶部飞到最低需要的时间）
    function getLocation(x1,x2,y1,y2) {
        var angle = -(90-Math.atan2(y2-y1,x2-x1)*180/Math.PI).toFixed(0);
        return {
            v: (x1-x2)/40,
            angle
        } 
    }