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
		this.chargeGain.gain.value = 0.08;
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
		gain.gain.setValueAtTime(0.15, ctx.currentTime);
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
		gain.gain.setValueAtTime(0.12, ctx.currentTime);
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
			gain.gain.linearRampToValueAtTime(0.15, t + i * 0.06 + 0.02);
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
			gain.gain.setValueAtTime(0.08, t + delay);
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
		gain.gain.setValueAtTime(0.12, ctx.currentTime);
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
			gain.gain.setValueAtTime(0.12, t + i * 0.1);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2);
			osc.connect(gain); gain.connect(ctx.destination);
			osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.2);
		});
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
			powerPreference: "high-performance"
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
		this.jumperStat.ready = true;
		if (this.jumper.position.y >= 1) {
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
			this._updateHuskyAnim(); //跳跃姿势动画
			this._render();
			requestAnimationFrame(() => {
				//循环执行
				this._handleMouseUp();
			})
		} else {
			//落下状态
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
				this.score++;
				this.combo++;
				//检测完美落地（接近中心）
				const isPerfect = this.falledStat.distance < this.config.jumperWidth;
				if (isPerfect) {
					this.sound.playPerfect();
				} else {
					this.sound.playScore();
				}
				//连击音效（每3连击触发）
				if (this.combo >= 3 && this.combo % 3 === 0) {
					this.sound.playCombo(this.combo);
				}
				this._createCube();
				this._updateCamera();
				if (this.successCallback) {
					//否则失败
					this.successCallback(this.score);
				}
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
		this.renderer.setClearColor(this.config.background);
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
		// 随机方块尺寸：宽 2~4，深 2~4，高 2
		let cubeW = Math.round(Math.random() * 2 + 2); // 2~4
		let cubeD = Math.round(Math.random() * 2 + 2); // 2~4
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
			let gap = Math.round(Math.random() * 3 + 1); // 间隙 1~4
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
			this.scene.remove(this.cubes.shift()); //超过就移除
		}
		this.scene.add(cube); //添加到场景中
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
	//改变相机的镜头
	_updateCamera() {
		let cur = {
			//当前位置
			x: this.cameraPros.current.x,
			y: this.cameraPros.current.y,
			z: this.cameraPros.current.z,
		};
		let next = {
			//下一个位置
			x: this.cameraPros.next.x,
			y: this.cameraPros.next.y,
			z: this.cameraPros.next.z,
		};
		if (cur.x > next.x || cur.z > next.z) {
		//满足改变
			this.cameraPros.current.x -= 0.1;
			this.cameraPros.current.z -= 0.1;
			if (this.cameraPros.current.x - this.cameraPros.next.x < 0.05) {
				this.cameraPros.current.x = this.cameraPros.next.x;
			} else if (this.cameraPros.current.z - this.cameraPros.next.z < 0.05) {
				this.cameraPros.current.z = this.cameraPros.next.z;
			}
		};
		this.camera.lookAt(new THREE.Vector3(cur.x, 0, cur.z));//镜头的点
		this._render();
		requestAnimationFrame(() => {
			//不断执行
			this._updateCamera();
		})
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
		this.scene.remove(this.jumper);
		for (let i = 0; i < length; i++) {
			this.scene.remove(this.cubes.shift());
		}
		this.score = 0;
		this.combo = 0; //重置连击
		this.successCallback(this.score);
		this._createCube();
		this._createCube();
		this._createJumper();
		this._createHusky(); //重新绘制哈士奇
		this.sound.playGameStart(); //游戏开始音效
		this._updateCamera();
	};
}
