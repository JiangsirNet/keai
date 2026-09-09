//音效管理器（Web Audio API 程序化生成）
class SoundManager {
	constructor() {
		this.ctx = null;
		this.chargeOsc = null;
		this.chargeGain = null;
		this.chargeFreq = 200;
	}
	_ensure() {
		if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
		if (this.ctx.state === 'suspended') this.ctx.resume();
		return this.ctx;
	}
	//蓄力音效：持续音调升高
	playCharge() {
		const ctx = this._ensure();
		if (this.chargeOsc) return;
		this.chargeOsc = ctx.createOscillator();
		this.chargeGain = ctx.createGain();
		this.chargeOsc.type = 'sine';
		this.chargeFreq = 200;
		this.chargeOsc.frequency.value = 200;
		this.chargeGain.gain.value = 0.3;
		this.chargeOsc.connect(this.chargeGain);
		this.chargeGain.connect(ctx.destination);
		this.chargeOsc.start();
	}
	updateChargePitch(ratio) {
		if (!this.chargeOsc) return;
		this.chargeFreq = Math.min(200 + ratio * 600, 800);
		this.chargeOsc.frequency.value = this.chargeFreq;
	}
	stopCharge() {
		if (this.chargeOsc) {
			try { this.chargeOsc.stop(); } catch(e) {}
			this.chargeOsc = null;
			this.chargeGain = null;
		}
	}
	//起跳弹出
	playJump() {
		const ctx = this._ensure();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(300, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
		gain.gain.setValueAtTime(0.4, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
		osc.connect(gain); gain.connect(ctx.destination);
		osc.start(); osc.stop(ctx.currentTime + 0.15);
	}
	//普通落地得分
	playScore() {
		const ctx = this._ensure();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'triangle';
		osc.frequency.value = 520;
		gain.gain.setValueAtTime(0.35, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
		osc.connect(gain); gain.connect(ctx.destination);
		osc.start(); osc.stop(ctx.currentTime + 0.2);
	}
	//完美落地加分
	playPerfect() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		[523, 659, 784].forEach((f, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.value = f;
			gain.gain.setValueAtTime(0, t + i * 0.06);
			gain.gain.linearRampToValueAtTime(0.4, t + i * 0.06 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25);
			osc.connect(gain); gain.connect(ctx.destination);
			osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.25);
		});
	}
	//连续连击音效
	playCombo(count) {
		const ctx = this._ensure();
		const baseFreq = 400 + Math.min(count, 10) * 50;
		const t = ctx.currentTime;
		[0, 0.06, 0.12].forEach((delay, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'square';
			osc.frequency.value = baseFreq * (1 + i * 0.25);
			gain.gain.setValueAtTime(0.3, t + delay);
			gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);
			osc.connect(gain); gain.connect(ctx.destination);
			osc.start(t + delay); osc.stop(t + delay + 0.1);
		});
	}
	//掉落失败
	playFail() {
		const ctx = this._ensure();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(400, ctx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.5);
		gain.gain.setValueAtTime(0.35, ctx.currentTime);
		gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
		osc.connect(gain); gain.connect(ctx.destination);
		osc.start(); osc.stop(ctx.currentTime + 0.5);
	}
	//游戏开始
	playGameStart() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		[262, 330, 392, 523].forEach((f, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.value = f;
			gain.gain.setValueAtTime(0.35, t + i * 0.1);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2);
			osc.connect(gain); gain.connect(ctx.destination);
			osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.2);
		});
	}
	//道具拾取（清脆上行双音）
	playPickup() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		[660, 990].forEach((f, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'triangle';
			osc.frequency.value = f;
			gain.gain.setValueAtTime(0.0001, t + i * 0.07);
			gain.gain.linearRampToValueAtTime(0.35, t + i * 0.07 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.2);
			osc.connect(gain); gain.connect(ctx.destination);
			osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.2);
		});
	}
	//护盾救场（碎裂下滑音）
	playShieldBreak() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(880, t);
		osc.frequency.exponentialRampToValueAtTime(220, t + 0.3);
		gain.gain.setValueAtTime(0.3, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
		osc.connect(gain); gain.connect(ctx.destination);
		osc.start(t); osc.stop(t + 0.35);
	}
	//生命复活（温暖上行三音，区别于护盾碎裂）
	playRevive() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		[392, 523, 659].forEach((f, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.value = f;
			gain.gain.setValueAtTime(0.0001, t + i * 0.08);
			gain.gain.linearRampToValueAtTime(0.35, t + i * 0.08 + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.28);
			osc.connect(gain); gain.connect(ctx.destination);
			osc.start(t + i * 0.08); osc.stop(t + i * 0.08 + 0.28);
		});
	}
	//火圈灼烧（高频快速下滑）
	playBurn() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(1200, t);
		osc.frequency.exponentialRampToValueAtTime(120, t + 0.28);
		gain.gain.setValueAtTime(0.32, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		osc.connect(gain); gain.connect(ctx.destination);
		osc.start(t); osc.stop(t + 0.3);
	}
	//碎裂/冰块触发（低频短促 rumble）
	playCrumble() {
		const ctx = this._ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(160, t);
		osc.frequency.exponentialRampToValueAtTime(60, t + 0.22);
		gain.gain.setValueAtTime(0.28, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
		osc.connect(gain); gain.connect(ctx.destination);
		osc.start(t); osc.stop(t + 0.24);
	}
}
class Game {
	constructor() {
		//基础信息 属性
		this.config = {
			background: 0x4a6741, //苔藓绿背景（自然柔和，绿色明显）
			ground: -1, //地面负一	 
			cubeColor: 0xbebebe,
			cubeWidth: 4, //宽	 
			cubeHeight: 2, //高	  
			cubeDeep: 4, //深度	  
			jumperColor: 0x232323, //跳块颜色
			jumperWidth: 1, //宽	  
			jumperHeight: 2, //高
			jumperDeep: 1, //深度	  
		};
		this.score = 0; //分数初始化	
		this.scene = new THREE.Scene(); //场景	
		this.camera = new THREE.OrthographicCamera(window.innerWidth / -50, window.innerWidth / 50, window
			.innerHeight / 50, window.innerHeight / -50, 0, 5000);
		//正交相机 （宽高 近距离远距离）
		this.cameraPros = {
			current: new THREE.Vector3(0, 0, 0), //当前位置	  
			next: new THREE.Vector3(0, 0, 0), //落下位置
		};
		// 移动端优化：根据设备能力关闭抗锯齿并限制 DPR，避免低端 GPU 卡顿
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
		this.renderer = new THREE.WebGLRenderer({
			antialias: !isMobile, // 手机端默认关闭抗锯齿（GPU 性能有限）
			powerPreference: "high-performance",
			alpha: true // 透明画布，露出 CSS 背景图
		});
		// 限制设备像素比：电脑端 2x、手机端 1.5x，防止高分屏渲染过载
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
		this.size = {
			width: window.innerWidth,
			height: window.innerHeight
		}; //记录页面
		this.cubes = []; //方块
		this.cubeStat = { //方块方向
			nextDir: "",
		};
		this.jumperStat = {
			//鼠标按下速度
			ready: false,
			xSpeed: 0,
			ySpeed: 0
		};
		this.falledStat = {
			location: -1, //落在哪里 当前块块上
			distance: 0, //距离是否倒下
		};
		this.fallingStat = {
			//有没有落到点
			end: false,
			speed: 0.2
		}
		this.galleryTextures = []; //相册照片纹理缓存（从 localStorage 读取）
		this.model = null; //哈士奇3D模型
		this.sound = new SoundManager(); //音效管理器
		this.combo = 0; //连续成功计数
		this.maxLives = 3; //初始生命数（三条命）
		this.lives = this.maxLives; //当前剩余生命：失败时消耗一条并原地复活，耗尽才结算
		// ===== 道具系统状态 =====
		this.jumpCount = 0; //成功落地次数（驱动难度，与含道具加分的 score 解耦）
		this.shield = false; //护盾：抵挡一次掉落并原地复活
		this.doubleJumps = 0; //加倍卡剩余生效跳跃次数
		this.autoPlaying = false; //骰子/火箭自动前进中，锁定手动输入
		this._autoRemaining = 0; //自动前进剩余格数
		this._pendingAuto = 0; //待触发的自动前进格数（避免重入）
		this._itemTime = 0; //道具浮动动画计时
		this._toastTimer = null; //toast 计时器
		//道具定义（图标 + 稀有度权重 + 底色）
		this.itemTypes = [
			{ type: 'dice', icon: '🎲', weight: 35, bg: '#f59e0b' },
			{ type: 'double', icon: '×2', weight: 30, bg: '#ec4899' },
			{ type: 'shield', icon: '🛡️', weight: 20, bg: '#3b82f6' },
			{ type: 'rocket', icon: '🚀', weight: 15, bg: '#ef4444' }
		];
		// ===== 陷阱系统状态 =====
		this._inFlight = false; //飞行中标记（捕获本跳的风/火圈）
		this._activeWind = null; //本跳生效的侧风
		this._activeRing = null; //本跳穿越的火圈
		this._windDrift = 0; //本跳侧风造成的横向位移（用于越界判定）
		this._trapTime = 0; //陷阱动画计时
	}

	init() {
		this._setCamera(); //设置相机位置
		this._setRenderer();
		this._setLight(); //设置灯光
		this._loadGalleryTextures(); //预加载相册照片纹理
		this._createCube(); //块
		this._createCube();
		this._createJumper();
		this._createHusky(); //绘制哈士奇
		this.sound.playGameStart(); //游戏开始音效
		this._updateCamera(); //改变相机
		this._handleWindowResize();
		this._updateItemHUD(); //初始显示生命值 HUD
		window.addEventListener("resize", () => {
			this._handleWindowResize(); //绑定窗口大小
		});
		let canvas = document.querySelector("canvas");
		canvas.style.touchAction = "none"; // 阻止触摸时的页面滚动/缩放
		canvas.addEventListener("mousedown", () => {
			//鼠标按下状态
			this._handleMouseDown();
		});
		canvas.addEventListener("mouseup", () => {
			//鼠标松开状态
			this._handleMouseUp()
		});
		//手机触摸支持：按下蓄力、松开起跳
		canvas.addEventListener("touchstart", (e) => {
			e.preventDefault(); // 阻止合成鼠标事件，避免重复蓄力
			this._handleMouseDown();
		}, { passive: false });
		canvas.addEventListener("touchend", (e) => {
			e.preventDefault();
			this._handleMouseUp();
		}, { passive: false });
	};

	_addSuccessFn(fn) {
		this.successCallback = fn
	};

	_addFailedFn(fn) {
		this.failedCallback = fn;
	}
	//绑定窗口大小改变
	_handleWindowResize() {
		this._setSize(); //从新计算
		//从新计算相机位置
		this.camera.left = this.size.width / -80;
		this.camera.right = this.size.width / 80;
		this.camera.top = this.size.height / 80;
		this.camera.bottom = this.size.height / -80;
		this.camera.updateProjectionMatrix(); //从新更新相机位置发生的改变
		this.renderer.setSize(this.size.width, this.size.height);
		this._render();
	};
	//鼠标按下状态（基于时间蓄力，统一手机/电脑帧率差异）
	_handleMouseDown() {
		if (this.autoPlaying) return; //自动前进（骰子/火箭）期间锁定手动蓄力
		// 最大蓄力限制：xSpeed 上限 0.65（约 1.3 秒），防止蓄力过久跳太远
		if (!this.jumperStat.ready && this.jumper.scale.y > 0.02 && this.jumperStat.xSpeed < 0.65) {
			//首次进入蓄力，开始蓄力音效
			if (this.jumperStat.xSpeed === 0) {
				this.sound.playCharge();
			}
			const now = performance.now();
			const delta = this._lastChargeTime ? Math.min((now - this._lastChargeTime) / 1000, 0.1) : 1 / 60;
			this._lastChargeTime = now;
			this.jumper.scale.y -= 0.02 * (delta * 60); //压缩速度与帧率无关
			this.jumperStat.xSpeed += 0.5 * delta; //每秒蓄力 0.5（跳 4~7 需 0.45~0.6 秒）
			this.jumperStat.ySpeed += 0.5 * delta; //每秒蓄力 0.5
			this._updateHuskyAnim(); //跳跃姿势动画
			this.sound.updateChargePitch(this.jumperStat.xSpeed / 0.65); //更新蓄力音调
			this._render();
			requestAnimationFrame(() => {
				this._handleMouseDown()
			})
		}
	};
	//鼠标松开谈起状态（基于时间跳跃，统一手机/电脑帧率差异）
	_handleMouseUp() {
		if (this.autoPlaying) return; //自动前进期间锁定手动起跳
		this.jumperStat.ready = true;
		if (this.jumper.position.y >= 1) {
			if (!this._inFlight) {
				//起飞首帧：捕获本跳要穿越的火圈与侧风
				this._inFlight = true;
				this._windDrift = 0;
				const tgt = this.cubes[this.cubes.length - 1];
				this._activeRing = tgt && tgt.userData.ring ? tgt.userData.ring : null;
				this._activeWind = tgt && tgt.userData.wind ? tgt.userData.wind : null;
			}
			this.sound.stopCharge(); //停止蓄力音效
			if (this.jumper.scale.y >= 1 && this.jumperStat.ySpeed > 0) {
				this.sound.playJump(); //起跳弹出
			}
			const now = performance.now();
			const delta = this._lastJumpTime ? Math.min((now - this._lastJumpTime) / 1000, 0.1) : 1 / 60;
			this._lastJumpTime = now;
			if (this.jumper.scale.y < 1) {
				this.jumper.scale.y += 0.1;//压缩状态小于1就+
			}
			if (this.cubeStat.nextDir == "left") {
				//挑起盒子落在哪里
				this.jumper.position.x -= this.jumperStat.xSpeed * delta * 60;
			} else {
				this.jumper.position.z -= this.jumperStat.xSpeed * delta * 60;
			}
			this.jumper.position.y += this.jumperStat.ySpeed * delta * 60;
			this.jumperStat.ySpeed -= 0.025 * delta * 60;//重力 1.5/秒，跳跃动画更舒缓
			this._applyWind(delta); //侧风横向漂移
			if (!this.autoPlaying && this._checkRingBurn()) { //火圈灼烧：终止飞行递归
				this._trapFail('ring');
				return;
			}
			this._updateHuskyAnim(); //跳跃姿势动画
			this._render();
			requestAnimationFrame(() => {
				//循环执行
				this._handleMouseUp();
			})
		} else {
			//落下状态
			this._inFlight = false;
			this._activeWind = null;
			this._activeRing = null;
			this.jumperStat.ready = false;
			this.jumperStat.xSpeed = 0;
			this.jumperStat.ySpeed = 0;
			this._lastChargeTime = null;
			this._lastJumpTime = null;
			this.jumper.position.y = 1;
			this.jumper.scale.y = 1;
			this.sound.stopCharge(); //确保停止蓄力音效
			// 落地后重置身体姿势
			this._updateHuskyAnim();
			this._checkInCube();//检测落在哪里
			if (this.falledStat.location == 1) {
				//成功落在下一个块上
				const isPerfect = this.falledStat.distance < this.config.jumperWidth;
				this._onLandSuccess(isPerfect, false);
				//道具（骰子/火箭）排队的自动前进，在落地状态稳定后触发
				if (this._pendingAuto > 0 && !this.autoPlaying) {
					const n = this._pendingAuto;
					this._pendingAuto = 0;
					this._autoAdvance(n);
				}
			} else if (this.shield) {
				//护盾救场：抵挡本次掉落，原地复活
				this.shield = false;
				this.sound.playShieldBreak();
				this._applyShieldSave();
			} else if (this.lives > 0) {
				//消耗一条命：原地复活，保留当前分数
				this._useLife();
			} else {
				this._falling()
			}
		}
	};
	//检测落在哪里
	//-1   -10从当前盒子掉落
	//1 下一个盒子上 10从下一个盒子上掉落
	//0没有落在盒子上
	_checkInCube() {
		let distanceCur, distanceNext;
		//当前盒子距离    下一个盒子距离
		let curCube = this.cubes[this.cubes.length - 2];
		let nextCube = this.cubes[this.cubes.length - 1];
		//跳跃方向上的实际尺寸（宽或深）
		let curSize = this.cubeStat.nextDir == "left" ? curCube.userData.width : curCube.userData.deep;
		let nextSize = this.cubeStat.nextDir == "left" ? nextCube.userData.width : nextCube.userData.deep;
		let should = (this.config.jumperWidth + Math.max(curSize, nextSize)) / 2;
		//
		if (this.cubeStat.nextDir == "left") {
			//往左走了
			distanceCur = Math.abs(this.jumper.position.x - curCube.position.x);
			distanceNext = Math.abs(this.jumper.position.x - nextCube.position.x);
		} else {
			//往右走了
			distanceCur = Math.abs(this.jumper.position.z - curCube.position.z);
			distanceNext = Math.abs(this.jumper.position.z - nextCube.position.z);
		}
		if (distanceCur < should) {
			//落在当前块
			this.falledStat.distance = distanceCur;
			this.falledStat.location = distanceCur < curSize / 2 ? -1 : -10;
		} else if (distanceNext < should) {
			//落在下一个块上
			this.falledStat.distance = distanceNext;
			this.falledStat.location = distanceNext < nextSize / 2 ? 1 : 10;
		} else {
			//落在中间
			this.falledStat.location = 0;
		}
		//侧风漂移越界判定：只统计风造成的横向位移，无风时 _windDrift=0 不影响正常落地
		if (this.falledStat.location == 1 || this.falledStat.location == 10) {
			const perpAxis = this.cubeStat.nextDir == "left" ? 'z' : 'x';
			const perpHalf = (this.cubeStat.nextDir == "left" ? nextCube.userData.deep : nextCube.userData.width) / 2;
			if (Math.abs(this._windDrift) > perpHalf + this.config.jumperWidth * 0.6) {
				this.falledStat.location = 0; //被侧风吹出块外，判为落空
			}
		}
	};
	//下落过程
	_falling() {
		if (this.falledStat.location == 10) {
			//从下一个盒子落下
			if (this.cubeStat.nextDir == "left") {
				//判断左方向
				if (this.jumper.position.x > this.cubes[this.cubes.length - 1].position.x) {
					this._fallingRotate("leftBottom")
				} else {
					this._fallingRotate("leftTop")
				}
			} else {
				//判断右方向
				if (this.jumper.position.z > this.cubes[this.cubes.length - 1].position.z) {
					this._fallingRotate("rightBottom")
				} else {
					this._fallingRotate("rightTop")
				}
			}
		} else if (this.falledStat.location == -10) {
			//从当前盒子落下
			if (this.cubeStat.nextDir == "left") {
				this._fallingRotate("leftTop")
			} else {
				this._fallingRotate("rightTop")
			}
		} else if (this.falledStat.location == 0) {
			this._fallingRotate("none")
		}
	};
	//落下旋转
	_fallingRotate(dir) {
		//根据落点位置获取对应方块的实际尺寸（10/1=下一个块，-10/-1=当前块）
		let cube = (this.falledStat.location == 10 || this.falledStat.location == 1)
			? this.cubes[this.cubes.length - 1]
			: this.cubes[this.cubes.length - 2];
		let cubeSize = this.cubeStat.nextDir == "left" ? cube.userData.width : cube.userData.deep;
		let offset = this.falledStat.distance - cubeSize / 2;//中间
		let rotateAxis = dir.includes("left") ? 'z' : "x";//以什么轴转
		let rotateAdd = this.jumper.rotation[rotateAxis] + 0.1;
		let rotateTo = this.jumper.rotation[rotateAxis] < Math.PI / 2;
		let fallingTo = this.config.ground + this.config.jumperWidth / 2 + offset;
		if (dir === 'rightTop') {
			rotateAdd = this.jumper.rotation[rotateAxis] - 0.1;
			rotateTo = this.jumper.rotation[rotateAxis] > -Math.PI / 2;
		} else if (dir === 'rightBottom') {
			rotateAdd = this.jumper.rotation[rotateAxis] + 0.1;
			rotateTo = this.jumper.rotation[rotateAxis] < Math.PI / 2;
		} else if (dir === 'leftBottom') {
			rotateAdd = this.jumper.rotation[rotateAxis] - 0.1;
			rotateTo = this.jumper.rotation[rotateAxis] > -Math.PI / 2;
		} else if (dir === 'leftTop') {
			rotateAdd = this.jumper.rotation[rotateAxis] + 0.1;
			rotateTo = this.jumper.rotation[rotateAxis] < Math.PI / 2;
		} else if (dir === 'none') {
			rotateTo = false;
			fallingTo = this.config.ground;
		} else {
			throw Error('Arguments Error')
		}
		if (!this.fallingStat.end) {
			if (rotateTo) {
				this.jumper.rotation[rotateAxis] = rotateAdd
			} else if (this.jumper.position.y > fallingTo) {
				this.jumper.position.y -= 0.2;
			} else {
				this.fallingStat.end = true;
			}
			this._render();
			requestAnimationFrame(() => {
				this._falling()
			})
		} else {
			if (this.failedCallback) {
				this.sound.playFail(); //掉落失败音效
				this.failedCallback()
			}
		}
	};
	//设置相机位置
	_setCamera() {
		this.camera.position.set(100, 100, 100);
		this.camera.lookAt(this.cameraPros.current); //镜头对准位置
	};
	//设置render
	_setRenderer() {
		this.renderer.setSize(this.size.width, this.size.height); //画布宽高
		this.renderer.setClearColor(0x000000, 0); // 透明清屏，露出 CSS 背景图
		document.body.appendChild(this.renderer.domElement); //渲染的画布放到body里面
	};
	//设置灯光
	_setLight() {
		let directionalLight = new THREE.DirectionalLight(0xffffff, 1.1); //平行光  （颜色，强度)
		directionalLight.position.set(2, 10, 5); //平行光位置
		this.scene.add(directionalLight); //在场景中加入平行光
		let light = new THREE.AmbientLight(0xffffff, 0.3); //光的材质
		this.scene.add(light) //把光添加到场景
	};
	//从 localStorage 读取相册照片缓存并预加载为纹理（canvas contain 自适应，不拉伸）
	_loadGalleryTextures() {
		try {
			const raw = localStorage.getItem("ls_gallery_cache");
			if (!raw) return;
			const cache = JSON.parse(raw);
			const urls = cache.urls || [];
			if (!urls.length) return;
			urls.forEach(url => {
				const img = new Image();
				img.crossOrigin = "anonymous";
				img.onload = () => {
					// 性能优化：先把原图缩到 512 以内，避免手机大图（4000x3000）占满内存和 GPU 带宽
					const maxSrc = 512;
					let srcW = img.width, srcH = img.height;
					let drawImg = img;
					if (srcW > maxSrc || srcH > maxSrc) {
						const s = Math.min(maxSrc / srcW, maxSrc / srcH);
						const tmp = document.createElement("canvas");
						tmp.width = Math.round(srcW * s);
						tmp.height = Math.round(srcH * s);
						const tctx = tmp.getContext("2d");
						tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
						drawImg = tmp;
						srcW = tmp.width;
						srcH = tmp.height;
					}
					// 用 canvas 按 contain 方式绘制：保持原始比例居中，四周填充浅色，不拉伸
					const size = 256;
					const canvas = document.createElement("canvas");
					canvas.width = size;
					canvas.height = size;
					const ctx = canvas.getContext("2d");
					ctx.fillStyle = "#f0e6e8"; // 浅粉底色
					ctx.fillRect(0, 0, size, size);
					// 不旋转，保持照片原始方向（contain 自适应，不拉伸）
					const scale = Math.min(size / srcW, size / srcH);
					const w = srcW * scale;
					const h = srcH * scale;
					const x = (size - w) / 2;
					const y = (size - h) / 2;
					ctx.drawImage(drawImg, x, y, w, h);
					const tex = new THREE.CanvasTexture(canvas);
					tex.minFilter = THREE.LinearFilter;
					// 性能优化：手机端生成 mipmap 关闭，并关闭各向异性过滤，减少 GPU 开销
					tex.generateMipmaps = false;
					tex.needsUpdate = true;
					this.galleryTextures.push(tex);
				};
				img.onerror = () => {
					// 单张照片加载失败忽略，继续用其他照片/颜色
				};
				img.src = url;
			});
		} catch (e) {
			console.warn("[Jump] 读取相册缓存失败:", e);
		}
	}
	//创建块
	_createCube() {
		// 动态难度系统：根据分数逐步增加难度
		let diff = this._getDifficulty();
		let cubeW = Math.round(Math.random() * (diff.maxSize - diff.minSize) + diff.minSize);
		let cubeD = Math.round(Math.random() * (diff.maxSize - diff.minSize) + diff.minSize);
		let geometry = new THREE.CubeGeometry(cubeW, this.config.cubeHeight, cubeD);
		//创建一个几何体对象 （宽，高，深度）
		// 先确定方向（材质正面需要）
		if (this.cubes.length) {
			this.cubeStat.nextDir = Math.random() > 0.5 ? "left" : "right"; //要不左边要不右边
			this._updateModelDirection(); //哈士奇朝向跳跃方向
		}
		// 只有 4x4 正方形方块才有 70% 概率使用照片纹理，2x2 / 3x3 不显示图片
		let usePhoto = this.galleryTextures.length > 0 && cubeW === cubeD && cubeW === 4 && Math.random() < 0.7;
		let material;
		if (usePhoto) {
			const tex = this.galleryTextures[Math.floor(Math.random() * this.galleryTextures.length)];
			// 其他面用随机浅色
			const faceColor = new THREE.Color(`hsl(${Math.round(Math.random() * 360)}, 60%, 75%)`);
			const sideMat = new THREE.MeshLambertMaterial({ color: faceColor });
			const photoMat = new THREE.MeshLambertMaterial({ map: tex });
			// CubeGeometry 材质数组顺序: +x, -x, +y, -y, +z, -z
			// 照片贴在最上面（+y 顶面），俯视视角清晰可见
			material = [sideMat, sideMat, photoMat, sideMat, sideMat, sideMat];
		} else {
			// 随机浅亮色（HSL 色相 0~360，饱和度 60~80%，亮度 65~85%）
			let hue = Math.round(Math.random() * 360);
			let sat = Math.round(Math.random() * 20 + 60); // 60~80
			let light = Math.round(Math.random() * 20 + 65); // 65~85
			material = new THREE.MeshLambertMaterial({
				color: new THREE.Color(`hsl(${hue}, ${sat}%, ${light}%)`)
			});
		}
		//材质,对象包含了颜色、透明度等属性，
		let cube = new THREE.Mesh(geometry, material); //合并在一起
		cube.userData = { width: cubeW, deep: cubeD }; //记录实际尺寸（落点判断用）
		if (this.cubes.length) {
			//从第二块开始随机左右方向出现
			let prevCube = this.cubes[this.cubes.length - 1];
			cube.position.x = prevCube.position.x;
			cube.position.y = prevCube.position.y;
			cube.position.z = prevCube.position.z;
			// 动态间距：前块半宽 + 本块半宽 + 间隙(1~4)，保证不重叠且最小间隙 1
			let prevSize = this.cubeStat.nextDir == "left" ? prevCube.userData.width : prevCube.userData.deep;
			let curSize = this.cubeStat.nextDir == "left" ? cubeW : cubeD;
			let gap = Math.round(Math.random() * (diff.maxGap - diff.minGap) + diff.minGap);
			let distance = prevSize / 2 + curSize / 2 + gap;
			if (this.cubeStat.nextDir == "left") {
				//左边改变x轴否则y轴
				cube.position.x = cube.position.x - distance;
			} else {
				cube.position.z = cube.position.z - distance;
			}
		}
		this.cubes.push(cube); //统一添加块
		if (this.cubes.length > 5) {
			//页面最多看到5个块
			const old = this.cubes.shift();
			if (old.userData.item) { this._disposeItem(old.userData.item); old.userData.item = null; } //移除旧块上的道具
			this.scene.remove(old); //超过就移除
			this._disposeCube(old); //释放 GPU 资源，防累积
		}
		this.scene.add(cube); //添加到场景中
		this._maybeSpawnItem(cube); //按概率在新块上方生成道具
		this._maybeSpawnTrap(cube); //按 jumpCount 分段在新块/间隙生成陷阱
		if (this.cubes.length > 1) {
			//更新镜头位置
			this._updateCameraPros();
		}
	};
	//绘制3D哈士奇（用基础几何体拼出）
	_createHusky() {
		const husky = new THREE.Group();
		const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
		const gray = mat(0x777777);    //灰色身体
		const dark = mat(0x444444);    //深色
		const white = mat(0xdddddd);   //白色
		const blue = mat(0x5599dd);    //蓝色眼睛
		const black = mat(0x111111);   //黑色

		// 压缩组：身体+肚皮+后腿+尾巴（蓄力时整体下沉）
		const compressGroup = new THREE.Group();
		husky.add(compressGroup);

		//身体
		const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.2), gray);
		body.position.set(0, 0.62, 0);
		compressGroup.add(body);

		//白色肚皮
		const belly = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.9), white);
		belly.position.set(0, 0.37, 0);
		compressGroup.add(belly);

		// 静态部分：头+五官+耳朵+前腿（保持不动，抵消父级scale压缩）
		const staticParts = [];
		//头
		const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.5), dark);
		head.position.set(0, 1.05, 0.45);
		husky.add(head);

		//口鼻（浅色突出）
		const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), white);
		snout.position.set(0, 0.95, 0.72);
		husky.add(snout);

		//鼻子
		const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), black);
		nose.position.set(0, 1.0, 0.84);
		husky.add(nose);

		//眼白
		[-1, 1].forEach(s => {
			const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), white);
			eyeW.position.set(s * 0.15, 1.12, 0.68);
			husky.add(eyeW);
			staticParts.push(eyeW);
			//蓝色瞳孔
			const eyeB = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), blue);
			eyeB.position.set(s * 0.15, 1.12, 0.73);
			husky.add(eyeB);
			staticParts.push(eyeB);
		});

		//尖耳朵
		[-1, 1].forEach(s => {
			const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), dark);
			ear.position.set(s * 0.18, 1.4, 0.4);
			husky.add(ear);
			staticParts.push(ear);
		});

		staticParts.push(head, snout, nose);

		//前腿（深色，保持不动）
		const legGeo = new THREE.BoxGeometry(0.14, 0.35, 0.14);
		[[-0.22, 0.175, 0.38], [0.22, 0.175, 0.38]].forEach(p => {
			const leg = new THREE.Mesh(legGeo, dark);
			leg.position.set(p[0], p[1], p[2]);
			husky.add(leg);
			staticParts.push(leg);
		});

		//后腿（深色，随压缩组下沉）
		[[-0.22, 0.175, -0.38], [0.22, 0.175, -0.38]].forEach(p => {
			const leg = new THREE.Mesh(legGeo, dark);
			leg.position.set(p[0], p[1], p[2]);
			compressGroup.add(leg);
		});

		//尾巴（向上翘起，随压缩组下沉）
		const tailPivot = new THREE.Group();
		tailPivot.position.set(0, 0.82, -0.6);
		tailPivot.rotation.x = Math.PI / 4;
		const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.45), white);
		tail.position.set(0, 0.1, -0.2);
		tailPivot.add(tail);
		compressGroup.add(tailPivot);

		husky.userData.compressGroup = compressGroup; //保存压缩组引用
		husky.userData.staticParts = staticParts; //保存静态部件引用（抵消scale压缩）

		//清理旧模型并添加新的
		this._disposeHusky();
		while (this.jumper.children.length) this.jumper.remove(this.jumper.children[0]);
		this.jumper.add(husky);
		this.model = husky;
		//保存初始偏移（底部在y=0），蓄力补偿用
		husky.userData.offsetY = 0;
		this._updateModelDirection();
		this._render();
	}
	//释放方块的几何体与材质（防 GPU 内存随局数累积）
	_disposeCube(cube) {
		if (!cube) return;
		if (cube.userData && cube.userData.ring) this._disposeRing(cube.userData.ring); //释放间隙火圈
		if (cube.geometry) cube.geometry.dispose();
		if (cube.material) {
			if (Array.isArray(cube.material)) cube.material.forEach(m => m.dispose());
			else cube.material.dispose();
		}
	};
	//清理旧哈士奇的几何体和材质（防内存泄漏）
	_disposeHusky() {
		if (!this.model) return;
		this.model.traverse((child) => {
			if (child.geometry) child.geometry.dispose();
			if (child.material) {
				if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
				else child.material.dispose();
			}
		});
		this.model = null;
	}
	//哈士奇头部朝向跳跃方向（头默认朝+z，根据 nextDir 旋转）
	_updateModelDirection() {
		if (!this.model) return;
		if (this.cubeStat.nextDir === 'left') {
			this.model.rotation.y = -Math.PI / 2;  //朝向 -x
		} else {
			this.model.rotation.y = Math.PI;        //朝向 -z
		}
	}
	//哈士奇跳跃姿势动画：前腿+头部不动，身体+后腿+尾巴整体下沉
	_updateHuskyAnim() {
		if (!this.model) return;
		const sy = this.jumper.scale.y;
		// 压缩组下沉（身体+后腿+尾巴）
		if (this.model.userData.compressGroup) {
			const cg = this.model.userData.compressGroup;
			cg.position.y = sy < 1 ? -(1 - sy) * 0.5 : 0;
		}
		// 静态部件（头+五官+耳朵+前腿）抵消父级scale，保持原比例
		if (this.model.userData.staticParts) {
			const invSy = 1 / sy;
			this.model.userData.staticParts.forEach(p => {
				p.scale.y = invSy;
			});
		}
	}
	//跳块
	_createJumper() {
		let geometry = new THREE.CubeGeometry(this.config.jumperWidth, this.config.jumperHeight, this.config
			.jumperDeep);// （宽，高，深度）
		let material = new THREE.MeshLambertMaterial({
			color: this.config.jumperColor,
			transparent: true,
			opacity: 0.01 // 近乎透明，模型加载后几乎不可见
		});//材质
		this.jumper = new THREE.Mesh(geometry, material);//合并在一起
		this.jumper.position.y = 1;//显示跳块
		geometry.translate(0, 1, 0);//平移
		this.scene.add(this.jumper);//添加到场景中
	}
	//改变相机的镜头（单例 rAF 循环：全生命周期只启动一次，
	//避免每次跳跃/重开都叠加一个无限循环导致越玩越卡）
	_updateCamera() {
		if (this._cameraLoopRunning) return;
		this._cameraLoopRunning = true;
		let last = performance.now();
		const step = () => {
			const now = performance.now();
			const dt = Math.min((now - last) / 1000, 0.1); //帧间隔，限幅防切后台突变
			last = now;
			this._stepCamera(dt);
			this._updateItems(dt); //道具浮动/呼吸动画
			this._updateTraps(dt); //陷阱动画（移动/火圈/碎裂/冰块）
			this._render();
			requestAnimationFrame(step);
		};
		step();
	};
	//相机向目标点插值一步（帧率无关的平滑逼近，约0.25秒收敛95%，比固定0.1/帧更快）
	_stepCamera(dt) {
		const cur = this.cameraPros.current;
		const next = this.cameraPros.next;
		const k = 1 - Math.pow(0.05, dt / 0.25); //每帧逼近剩余距离的比例
		cur.x += (next.x - cur.x) * k;
		cur.z += (next.z - cur.z) * k;
		if (Math.abs(cur.x - next.x) < 0.05) cur.x = next.x;
		if (Math.abs(cur.z - next.z) < 0.05) cur.z = next.z;
		this.camera.lookAt(cur.x, 0, cur.z);//镜头的点
	};
	//更新镜头位置
	_updateCameraPros() {
		let lastIndex = this.cubes.length - 1;
		let pointA = {
			//当前块
			x: this.cubes[lastIndex].position.x,
			z: this.cubes[lastIndex].position.z,
		};
		let pointB = {
			//下一个块
			x: this.cubes[lastIndex - 1].position.x,
			z: this.cubes[lastIndex - 1].position.z,
		};
		this.cameraPros.next = new THREE.Vector3((pointA.x + pointB.x) / 2, 0, (pointA.z + pointB.z) / 2);
		//当前块跟下一个块除以2得出中间位置
	};
	//设置size
	_setSize() {
		this.size.width = window.innerWidth;
		this.size.height = window.innerHeight;
	};
	//渲染render
	_render() {
		this.renderer.render(this.scene, this.camera);
		//把当前场景相机放进来
	};

	//动态难度：根据当前分数返回方块尺寸和间隙范围
	_getDifficulty() {
		const score = this.jumpCount; //用成功跳跃次数驱动难度（加分道具不虚高难度）
		if (score < 10) return { minSize: 4, maxSize: 4, minGap: 1, maxGap: 1 };
		if (score < 20) return { minSize: 4, maxSize: 4, minGap: 2, maxGap: 2 };
		if (score < 30) return { minSize: 4, maxSize: 4, minGap: 3, maxGap: 3 };
		if (score < 40) return { minSize: 3, maxSize: 4, minGap: 1, maxGap: 2 };
		if (score < 50) return { minSize: 3, maxSize: 4, minGap: 1, maxGap: 3 };
		if (score < 60) return { minSize: 3, maxSize: 4, minGap: 1, maxGap: 4 };
		if (score < 70) return { minSize: 2, maxSize: 4, minGap: 1, maxGap: 4 };
		return { minSize: 2, maxSize: 4, minGap: 1, maxGap: 4 };
	};

	// ===== 道具系统 =====
	//成功落地统一处理（手动跳跃与骰子/火箭自动前进共用）
	_onLandSuccess(isPerfect, isAuto) {
		const gain = this.doubleJumps > 0 ? 2 : 1; //加倍卡生效时得分翻倍
		this.score += gain;
		if (this.doubleJumps > 0) this.doubleJumps--;
		this.jumpCount++;
		this.combo++;
		if (!isAuto) {
			if (isPerfect) { this.sound.playPerfect(); } else { this.sound.playScore(); }
			if (this.combo >= 3 && this.combo % 3 === 0) { this.sound.playCombo(this.combo); }
		}
		//拾取落点方块上的道具（自动前进途中 isAuto 不拾取，避免连锁触发；一轮前进的最终落点由 _autoHop 结束时拾取）
		const landed = this.cubes[this.cubes.length - 1];
		if (landed && landed.userData.item && !isAuto) this._collectItem(landed);
		if (landed) {
			//侧风跳：把跳块垂直轴吸附回落点块心，消除横向累积偏移
			if (!isAuto && this._windDrift !== 0) {
				const perp = this.cubeStat.nextDir == "left" ? 'z' : 'x';
				this.jumper.position[perp] = landed.position[perp];
			}
			//落点块陷阱：移动块冻结，碎裂/冰块启动计时（自动前进豁免）
			if (landed.userData.trap) {
				if (isAuto || this.autoPlaying) {
					if (landed.userData.trap.type === 'moving') landed.userData.trap.frozen = true;
				} else {
					this._activateLandedTrap(landed);
				}
			}
		}
		this._createCube();
		this._updateCamera();
		this._updateItemHUD();
		if (this.successCallback) this.successCallback(this.score);
	}
	//按概率在新方块上方生成道具
	_maybeSpawnItem(cube) {
		if (this.cubes.length <= 2) return; //起始前两块不刷
		const prev = this.cubes[this.cubes.length - 2];
		if (prev && prev.userData.item) return; //相邻块不连续刷
		if (Math.random() > 0.28) return; //基础刷新率 28%
		const pool = this.itemTypes.filter(t => !(t.type === 'shield' && this.shield));
		const total = pool.reduce((s, t) => s + t.weight, 0);
		let r = Math.random() * total;
		let chosen = pool[0];
		for (let i = 0; i < pool.length; i++) {
			if (r < pool[i].weight) { chosen = pool[i]; break; }
			r -= pool[i].weight;
		}
		this._spawnItem(cube, chosen);
	}
	//创建道具精灵并挂到方块上
	_spawnItem(cube, def) {
		const tex = this._makeIconTexture(def.icon, def.bg);
		const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
		const sprite = new THREE.Sprite(mat);
		const s = 2.2;
		sprite.scale.set(s, s, s);
		const baseY = cube.position.y + this.config.cubeHeight / 2 + 2.2;
		sprite.position.set(cube.position.x, baseY, cube.position.z);
		sprite.userData.baseY = baseY;
		sprite.userData.baseScale = s;
		cube.userData.item = { sprite: sprite, type: def.type, icon: def.icon };
		this.scene.add(sprite);
	}
	//用 canvas 画 emoji/文字图标生成纹理（圆形底色 + 居中图标）
	_makeIconTexture(icon, bg) {
		const size = 128;
		const canvas = document.createElement('canvas');
		canvas.width = size; canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
		ctx.fillStyle = bg || '#ffffff';
		ctx.fill();
		ctx.lineWidth = 7;
		ctx.strokeStyle = 'rgba(255,255,255,0.9)';
		ctx.stroke();
		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = 'bold ' + Math.round(size * 0.5) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
		ctx.fillText(icon, size / 2, size / 2 + 2);
		const tex = new THREE.CanvasTexture(canvas);
		tex.minFilter = THREE.LinearFilter;
		tex.generateMipmaps = false;
		tex.needsUpdate = true;
		return tex;
	}
	//拾取道具：触发效果 + 音效 + 提示，并移除道具
	_collectItem(cube) {
		const item = cube.userData.item;
		if (!item) return;
		const type = item.type;
		this._disposeItem(item);
		cube.userData.item = null;
		this.sound.playPickup();
		if (type === 'dice') {
			const n = 1 + Math.floor(Math.random() * 6); //摇 1~6 点
			this._pendingAuto += n;
			this._showToast('🎲 ' + n + ' 点');
		} else if (type === 'rocket') {
			this._pendingAuto += 10; //直接飞过 10 格
			this._showToast('🚀 飞行 10 格');
		} else if (type === 'shield') {
			this.shield = true; //抵挡一次掉落
			this._showToast('🛡️ 护盾');
		} else if (type === 'double') {
			this.doubleJumps += 1; //下一跳得分翻倍（可叠加）
			this._showToast('×2 双倍');
		}
		this._updateItemHUD();
	}
	//释放道具精灵的纹理与材质
	_disposeItem(item) {
		if (!item || !item.sprite) return;
		this.scene.remove(item.sprite);
		if (item.sprite.material) {
			if (item.sprite.material.map) item.sprite.material.map.dispose();
			item.sprite.material.dispose();
		}
	}
	//道具浮动 + 呼吸动画（挂在常驻渲染循环里）
	_updateItems(dt) {
		this._itemTime += dt;
		for (let i = 0; i < this.cubes.length; i++) {
			const item = this.cubes[i].userData && this.cubes[i].userData.item;
			if (item && item.sprite) {
				const sp = item.sprite;
				sp.position.y = sp.userData.baseY + Math.sin(this._itemTime * 2.5) * 0.35;
				const k = sp.userData.baseScale * (1 + Math.sin(this._itemTime * 3.5) * 0.08);
				sp.scale.set(k, k, k);
			}
		}
	}
	//骰子/火箭：自动前进 n 格（锁定手动输入，逐格动画跳跃）
	_autoAdvance(n) {
		if (n <= 0) return;
		if (this.autoPlaying) { this._pendingAuto += n; return; }
		this.autoPlaying = true;
		this._autoRemaining = n;
		this._updateItemHUD();
		this._autoHop();
	}
	_autoHop() {
		if (this._autoRemaining <= 0) {
			if (this._pendingAuto > 0) {
				this._autoRemaining = this._pendingAuto;
				this._pendingAuto = 0;
			} else {
				//一轮自动前进结束：玩家停在最终落点（末块是刚生成的下一目标，落脚块是倒数第二块）
				this.autoPlaying = false;
				this._updateItemHUD();
				const landed = this.cubes[this.cubes.length - 2];
				if (landed && landed.userData.item) {
					this._collectItem(landed); //仅最终落点的道具可触发
					if (this._pendingAuto > 0) { //最终落点又是骰子/火箭则开启新一轮前进
						const n = this._pendingAuto;
						this._pendingAuto = 0;
						this._autoAdvance(n);
					}
				}
				return;
			}
		}
		const cur = this.cubes[this.cubes.length - 2];
		const next = this.cubes[this.cubes.length - 1];
		if (!cur || !next) { this.autoPlaying = false; return; }
		this._animateHop(next, () => {
			this._onLandSuccess(true, true); //自动跳跃按完美落地计分
			this._autoRemaining--;
			this._autoHop();
		});
	}
	//单格跳跃弧线动画：从当前位置飞到目标方块顶面
	_animateHop(toCube, cb) {
		const startX = this.jumper.position.x;
		const startZ = this.jumper.position.z;
		const endX = toCube.position.x;
		const endZ = toCube.position.z;
		const peak = 4.5;
		const dur = 320;
		const t0 = performance.now();
		this.sound.playJump();
		const step = () => {
			const p = Math.min((performance.now() - t0) / dur, 1);
			this.jumper.position.x = startX + (endX - startX) * p;
			this.jumper.position.z = startZ + (endZ - startZ) * p;
			this.jumper.position.y = 1 + peak * Math.sin(Math.PI * p);
			this._render();
			if (p < 1) {
				requestAnimationFrame(step);
			} else {
				this.jumper.position.y = 1;
				this.jumper.scale.y = 1;
				this._updateHuskyAnim();
				this._render();
				cb();
			}
		};
		requestAnimationFrame(step);
	}
	//原地复活：把跳块复位到起跳方块顶面，玩家重跳（护盾救场 / 生命复活共用）
	_applyShieldSave(toastText) {
		const cur = this.cubes[this.cubes.length - 2];
		if (cur) {
			this.jumper.position.x = cur.position.x;
			this.jumper.position.z = cur.position.z;
		}
		this.jumper.position.y = 1;
		this.jumper.rotation.set(0, 0, 0);
		this.jumper.scale.y = 1;
		this.fallingStat.end = false;
		this.jumperStat.ready = false;
		this.jumperStat.xSpeed = 0;
		this.jumperStat.ySpeed = 0;
		this._lastChargeTime = null;
		this._lastJumpTime = null;
		this._updateHuskyAnim();
		this._updateItemHUD();
		this._showToast(toastText || '🛡️ 护盾救场!');
		this._render();
	}
	//消耗一条命原地复活（掉落/陷阱失败且无护盾时触发，保留当前分数）
	_useLife() {
		this.lives--;
		this.sound.playRevive();
		const txt = this.lives > 0 ? ('❤️ 复活! 剩余 ' + this.lives + ' 命') : '💔 没有退路了!';
		this._applyShieldSave(txt);
	}
	// ===== 陷阱系统 =====
	//按 jumpCount 分段返回可用陷阱类型与概率
	_getTrapConfig() {
		const j = this.jumpCount;
		if (j < 100) return null;
		if (j < 130) return { cube: ['crumble'], gap: [], pCube: 0.18, pGap: 0 };
		if (j < 160) return { cube: ['crumble', 'ice'], gap: [], pCube: 0.24, pGap: 0 };
		if (j < 200) return { cube: ['crumble', 'ice', 'moving'], gap: ['ring'], pCube: 0.28, pGap: 0.14 };
		if (j < 250) return { cube: ['crumble', 'ice', 'moving'], gap: ['ring', 'wind'], pCube: 0.30, pGap: 0.20 };
		return { cube: ['crumble', 'ice', 'moving'], gap: ['ring', 'wind'], pCube: 0.32, pGap: 0.26 };
	}
	//按概率在新块或其间隙生成陷阱（与道具互斥，相邻致命块去重）
	_maybeSpawnTrap(cube) {
		const cfg = this._getTrapConfig();
		if (!cfg) return;
		if (this.cubes.length <= 3) return; //起始块不刷
		if (cube.userData.item) return; //道具块不叠陷阱
		const prev = this.cubes[this.cubes.length - 2];
		const prevDeadly = prev && prev.userData.trap && (prev.userData.trap.type === 'crumble' || prev.userData.trap.type === 'ice');
		const roll = Math.random();
		if (roll < cfg.pCube) {
			let pool = cfg.cube;
			if (prevDeadly) pool = pool.filter(t => t !== 'crumble' && t !== 'ice'); //相邻致命块去重
			if (pool.length) {
				this._applyCubeTrap(cube, pool[Math.floor(Math.random() * pool.length)]);
				return;
			}
		}
		if (cfg.gap.length && roll < cfg.pCube + cfg.pGap) {
			this._applyGapTrap(cube, cfg.gap[Math.floor(Math.random() * cfg.gap.length)]);
		}
	}
	//块陷阱：碎裂/冰块/移动
	_applyCubeTrap(cube, type) {
		const trap = { type: type, timer: 0, active: false, slide: false, frozen: false, basePos: 0, phase: Math.random() * Math.PI * 2, axis: 'x', slideAxis: 'x', slideDir: -1 };
		if (type === 'crumble') {
			this._setCubeColor(cube, 0x8a7f6a, 0.9); //灰褐、微透明，跳前可辨识
		} else if (type === 'ice') {
			this._setCubeColor(cube, 0x9fd8ff, 0.72); //浅蓝半透明冰面
		} else if (type === 'moving') {
			trap.axis = this.cubeStat.nextDir == "left" ? 'x' : 'z'; //沿跳跃轴振荡
			trap.basePos = cube.position[trap.axis];
		}
		cube.userData.trap = trap;
	}
	//改方块颜色/透明度（兼容照片块的材质数组）
	_setCubeColor(cube, color, opacity) {
		const apply = (m) => {
			if (!m) return;
			m.color = new THREE.Color(color);
			m.transparent = true;
			m.opacity = opacity;
			m.needsUpdate = true;
		};
		if (Array.isArray(cube.material)) cube.material.forEach(apply);
		else apply(cube.material);
	}
	//间隙飞行陷阱：火圈/侧风
	_applyGapTrap(cube, type) {
		if (type === 'ring') {
			this._makeFireRing(cube);
		} else if (type === 'wind') {
			const perpAxis = this.cubeStat.nextDir == "left" ? 'z' : 'x'; //垂直于跳跃轴
			const force = (Math.random() > 0.5 ? 1 : -1) * (0.02 + Math.random() * 0.025);
			cube.userData.wind = { axis: perpAxis, force: force };
			this._updateItemHUD(); //刷新侧风警示徽标
		}
	}
	//在 prev 与本块间隙中点建一个上下振荡的火焰圆环
	_makeFireRing(cube) {
		const prev = this.cubes[this.cubes.length - 2];
		if (!prev) return;
		const axis = this.cubeStat.nextDir == "left" ? 'x' : 'z'; //跳跃轴
		const midX = (prev.position.x + cube.position.x) / 2;
		const midZ = (prev.position.z + cube.position.z) / 2;
		const geo = new THREE.TorusGeometry(1.5, 0.34, 10, 26);
		const mat = new THREE.MeshBasicMaterial({ color: 0xff5a1f });
		const mesh = new THREE.Mesh(geo, mat);
		mesh.rotation.x = Math.PI / 2; //水平放置（环面平行地面）
		mesh.position.set(midX, 3.5, midZ);
		this.scene.add(mesh);
		cube.userData.ring = {
			mesh: mesh,
			axis: axis,
			mid: axis === 'x' ? midX : midZ,
			yMin: 0.8, yMax: 7.0, speed: 2.2,
			phase: Math.random() * Math.PI * 2
		};
	}
	//释放火圈资源
	_disposeRing(ringData) {
		if (!ringData || !ringData.mesh) return;
		this.scene.remove(ringData.mesh);
		if (ringData.mesh.geometry) ringData.mesh.geometry.dispose();
		if (ringData.mesh.material) ringData.mesh.material.dispose();
	}
	//陷阱逐帧动画（挂在常驻渲染循环）
	_updateTraps(dt) {
		this._trapTime += dt;
		if (this.cubes.length < 2) return;
		const target = this.cubes[this.cubes.length - 1];
		const current = this.cubes[this.cubes.length - 2];
		//移动方块：仅目标块沿跳跃轴振荡，落地冻结或自动前进时停止
		if (target && target.userData.trap && target.userData.trap.type === 'moving' && !target.userData.trap.frozen && !this.autoPlaying) {
			const tr = target.userData.trap;
			target.position[tr.axis] = tr.basePos + Math.sin(this._trapTime * 2.2 + tr.phase) * 1.4;
		}
		//火圈：上下振荡 + 火焰脉动
		if (target && target.userData.ring && target.userData.ring.mesh) {
			const r = target.userData.ring;
			const midY = (r.yMin + r.yMax) / 2;
			const amp = (r.yMax - r.yMin) / 2;
			r.mesh.position.y = midY + Math.sin(this._trapTime * r.speed + r.phase) * amp;
			const s = 1 + Math.sin(this._trapTime * 8) * 0.06;
			r.mesh.scale.set(s, s, s);
		}
		//自动前进（骰子/火箭）豁免落地型陷阱
		if (this.autoPlaying) return;
		const onCube = this.jumper.position.y <= 1.01; //跳块是否仍贴在方块顶面（轻点腾空仅暂停，落回继续）
		//碎裂方块：抖动 + 下沉 + 计时，倒计时结束且仍站立则坠落
		if (current && current.userData.trap && current.userData.trap.type === 'crumble' && current.userData.trap.active) {
			const tr = current.userData.trap;
			if (tr.timer > 0) {
				tr.timer -= dt;
				current.position.x += (Math.random() - 0.5) * 0.1;
				current.position.z += (Math.random() - 0.5) * 0.1;
				current.position.y -= dt * 0.6;
				const op = Math.max(0.25, tr.timer);
				if (Array.isArray(current.material)) current.material.forEach(m => { m.transparent = true; m.opacity = op; });
				else { current.material.transparent = true; current.material.opacity = op; }
			} else if (onCube) {
				tr.active = false;
				this._trapFail('crumble');
			}
		}
		//冰块：站立时沿前进方向缓慢漂移，滑出块外则坠落
		if (current && current.userData.trap && current.userData.trap.type === 'ice' && current.userData.trap.slide) {
			const tr = current.userData.trap;
			if (onCube) {
				this.jumper.position[tr.slideAxis] += tr.slideDir * 0.9 * dt;
				const half = (tr.slideAxis === 'x' ? current.userData.width : current.userData.deep) / 2;
				const off = Math.abs(this.jumper.position[tr.slideAxis] - current.position[tr.slideAxis]);
				if (off > half) { tr.slide = false; this._trapFail('ice'); }
			}
		}
	}
	//火圈碰撞：飞行途中穿过环平面且高度接近环面则灼烧
	_checkRingBurn() {
		const r = this._activeRing;
		if (!r || !r.mesh) return false;
		if (Math.abs(this.jumper.position[r.axis] - r.mid) > 0.7) return false; //未到/已越过环平面
		return Math.abs(this.jumper.position.y - r.mesh.position.y) < 1.0;
	}
	//侧风：飞行途中沿垂直轴施加横向漂移
	_applyWind(delta) {
		if (!this._activeWind || this.autoPlaying) return;
		const d = this._activeWind.force * delta * 60;
		this.jumper.position[this._activeWind.axis] += d;
		this._windDrift += d;
	}
	//落地陷阱激活：移动块冻结，碎裂/冰块启动计时
	_activateLandedTrap(cube) {
		const trap = cube.userData.trap;
		if (!trap) return;
		if (trap.type === 'moving') {
			trap.frozen = true;
		} else if (trap.type === 'crumble') {
			trap.timer = 1.0;
			trap.active = true;
			this.sound.playCrumble();
			this._showToast('💔 碎裂! 快跳!');
		} else if (trap.type === 'ice') {
			trap.slide = true;
			trap.slideAxis = this.cubeStat.nextDir == "left" ? 'x' : 'z';
			trap.slideDir = -1; //前进方向（left→-x，right→-z）
			this._showToast('🧊 冰面! 快跳!');
		}
	}
	//陷阱导致的失败：护盾可救，否则坠落结算
	_trapFail(reason) {
		this._inFlight = false;
		this._activeWind = null;
		this._activeRing = null;
		if (reason === 'ring') this.sound.playBurn();
		else this.sound.playCrumble();
		const toastMap = { ring: '🔥 火圈!', crumble: '💔 碎裂!', ice: '🧊 滑落了!', wind: '🌬️ 被吹落!' };
		this._showToast(toastMap[reason] || '陷阱!');
		if (this.shield || this.lives > 0) {
			//护盾或生命：清除致命陷阱后原地复活
			const cur = this.cubes[this.cubes.length - 2];
			if (cur && cur.userData.trap && (reason === 'crumble' || reason === 'ice')) {
				cur.userData.trap.active = false; //碎裂/冰块：清除该块陷阱，平台复位
				cur.userData.trap.slide = false;
				cur.userData.trap.timer = 0;
			}
			if (this.shield) {
				this.shield = false;
				this.sound.playShieldBreak();
				this._applyShieldSave();
			} else {
				this._useLife();
			}
		} else {
			this.falledStat.location = 0;
			this._falling();
		}
	}
	//更新顶部道具状态栏
	_updateItemHUD() {
		const hud = document.getElementById('itemHud');
		if (!hud) return;
		const parts = [];
		parts.push('<span class="buff lives">❤️ <b>' + this.lives + '</b></span>'); //生命值常驻显示
		if (this.shield) parts.push('<span class="buff">🛡️</span>');
		if (this.doubleJumps > 0) parts.push('<span class="buff">×2 <b>' + this.doubleJumps + '</b></span>');
		if (this.autoPlaying) parts.push('<span class="buff">🚀 前进中</span>');
		//侧风警示：显示下一段间隙的风向
		const tgt = this.cubes[this.cubes.length - 1];
		const wind = tgt && tgt.userData.wind;
		if (wind && !this.autoPlaying) parts.push('<span class="buff warn">🌬️ 侧风 ' + (wind.force > 0 ? '→' : '←') + '</span>');
		hud.innerHTML = parts.join('');
	}
	//拾取/触发提示浮层（约 0.9s 淡出）
	_showToast(text) {
		const el = document.getElementById('itemToast');
		if (!el) return;
		el.textContent = text;
		el.classList.add('show');
		if (this._toastTimer) clearTimeout(this._toastTimer);
		this._toastTimer = setTimeout(() => { el.classList.remove('show'); }, 900);
	}

	_restart() {
		this.cameraPros = {
			current: new THREE.Vector3(0, 0, 0),
			next: new THREE.Vector3()
		};
		this.fallingStat = {
			end: false,
			speed: 0.2
		};
		let length = this.cubes.length;
		const oldJumper = this.jumper;
		this.scene.remove(oldJumper);
		if (oldJumper) {
			oldJumper.geometry.dispose();
			oldJumper.material.dispose();
		}
		for (let i = 0; i < length; i++) {
			const old = this.cubes.shift();
			if (old.userData.item) { this._disposeItem(old.userData.item); old.userData.item = null; }
			this.scene.remove(old);
			this._disposeCube(old);
		}
		this.score = 0;
		this.combo = 0; //重置连击
		this.lives = this.maxLives; //重置生命值
		//重置道具系统状态
		this.jumpCount = 0;
		this.shield = false;
		this.doubleJumps = 0;
		this.autoPlaying = false;
		this._autoRemaining = 0;
		this._pendingAuto = 0;
		//重置陷阱系统状态
		this._inFlight = false;
		this._activeWind = null;
		this._activeRing = null;
		this._windDrift = 0;
		this._trapTime = 0;
		this._updateItemHUD();
		this.successCallback(this.score);
		this._createCube();
		this._createCube();
		this._createJumper();
		this._createHusky(); //重新绘制哈士奇
		this.sound.playGameStart(); //游戏开始音效
		this._updateCamera();
	};
}
