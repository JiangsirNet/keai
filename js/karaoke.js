/**
 * 情侣 K 歌房
 * 功能：选歌 → 歌词同步 → 麦克风录音（伴奏+人声合并）→ 回放/下载/保存
 * 依赖：music.js 的 musicList（共享数据库音乐列表）
 */

(function () {
    let karaokeSongs = [];
    let selectedSong = null;
    let lyricsData = [];
    let currentLyricIndex = -1;
    let audio = null;
    let mediaStream = null;
    let recordedSamples = [];  // 录音中的原始 PCM 浮点数据
    let vocalSamples = [];      // 录音完成后保留的副本（供混音用）
    let vocalSampleRate = 0;    // 人声采样率
    let recordStartTime = 0;    // 录音开始时伴奏的播放位置（秒）
    let processor = null;       // ScriptProcessorNode
    let isRecording = false;
    let isPlaying = false;
    let animFrame = null;

    // 音频上下文（持久化）
    let mixAudioCtx = null;
    let micSource = null;
    let analyser = null;

    // 试听相关
    let previewCtx = null;
    let previewAccSrc = null;
    let previewVocalSrc = null;
    let previewAccBuffer = null;  // 缓存伴奏 AudioBuffer
    let isPreviewing = false;

    // 回放播放器模式（vocal | mix | record）
    let playbackMode = 'vocal';
    let playbackAudioEl = null;
    // 录音作品独立 Audio 缓存（id → Audio），避免重复创建
    const recordAudioMap = new Map();

    function initKaraoke() {
        audio = document.getElementById("karaokeAudio") || createAudioElement();
        audio.crossOrigin = "anonymous";
        playbackAudioEl = document.getElementById("karaokePlaybackAudio");
        setupPlaybackEvents();
        loadSongList();
        loadRecordings();
        setupAudioEvents();
        setupMixSliders();
    }

    // ===== 回放播放器：模式切换 + 自定义进度条 =====
    function setupPlaybackEvents() {
        if (!playbackAudioEl) return;
        playbackAudioEl.addEventListener('timeupdate', updatePbProgress);
        playbackAudioEl.addEventListener('loadedmetadata', updatePbDuration);
        playbackAudioEl.addEventListener('play', () => updatePbPlayBtn(true));
        playbackAudioEl.addEventListener('pause', () => updatePbPlayBtn(false));
        playbackAudioEl.addEventListener('ended', () => updatePbPlayBtn(false));
    }

    // 设置回放模式并更新 UI 主题
    // mode: 'vocal' | 'mix' | 'record'
    function setPlaybackMode(mode, title) {
        playbackMode = mode;
        const player = document.getElementById('karaokePbPlayer');
        const badge = document.getElementById('karaokePlaybackBadge');
        const label = document.getElementById('karaokePlaybackLabel');
        const titleEl = document.getElementById('karaokePbTitle');

        // 清除所有模式类，添加当前模式类
        if (player) {
            player.classList.remove('karaoke-pb-mode-vocal', 'karaoke-pb-mode-mix', 'karaoke-pb-mode-record');
            player.classList.add('karaoke-pb-mode-' + mode);
        }

        const meta = {
            vocal:  { badge: '🎤 人声',  label: '人声回放' },
            mix:    { badge: '🎵 合成',  label: '合成作品' },
            record: { badge: '🎧 录音',  label: '录音作品' }
        }[mode] || { badge: '', label: '' };

        if (badge) {
            badge.className = 'karaoke-pb-badge karaoke-pb-badge-' + mode;
            badge.innerText = meta.badge;
        }
        if (label) label.innerText = meta.label;
        if (titleEl && title) titleEl.innerText = title;
    }

    function updatePbProgress() {
        if (!playbackAudioEl) return;
        const cur = playbackAudioEl.currentTime || 0;
        const dur = playbackAudioEl.duration || 0;
        const percent = dur > 0 ? (cur / dur) * 100 : 0;
        const bar = document.getElementById('karaokePbProgressBar');
        const thumb = document.getElementById('karaokePbProgressThumb');
        if (bar) bar.style.width = percent + '%';
        if (thumb) thumb.style.left = percent + '%';
        const curEl = document.getElementById('karaokePbCurrent');
        if (curEl) curEl.innerText = formatTime(cur);
    }

    function updatePbDuration() {
        if (!playbackAudioEl) return;
        const durEl = document.getElementById('karaokePbDuration');
        if (durEl) durEl.innerText = formatTime(playbackAudioEl.duration || 0);
    }

    function updatePbPlayBtn(isPlaying) {
        const btn = document.getElementById('karaokePbPlayBtn');
        if (btn) btn.innerHTML = isPlaying ? '<i class="fa fa-pause"></i>' : '<i class="fa fa-play"></i>';
    }

    function karaokePbTogglePlay() {
        if (!playbackAudioEl || !playbackAudioEl.src) return;
        if (playbackAudioEl.paused) playbackAudioEl.play();
        else playbackAudioEl.pause();
    }

    function karaokePbSeek(e) {
        if (!playbackAudioEl || !playbackAudioEl.duration) return;
        const wrap = document.getElementById('karaokePbProgressWrap');
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        playbackAudioEl.currentTime = percent * playbackAudioEl.duration;
        updatePbProgress();
    }

    function setupMixSliders() {
        const accSlider = document.getElementById("karaokeMixAccVol");
        const vocalSlider = document.getElementById("karaokeMixVocalVol");
        const offsetSlider = document.getElementById("karaokeMixOffset");
        if (accSlider) accSlider.oninput = function() {
            document.getElementById("karaokeMixAccNum").innerText = this.value + "%";
        };
        if (vocalSlider) vocalSlider.oninput = function() {
            document.getElementById("karaokeMixVocalNum").innerText = this.value + "%";
        };
        if (offsetSlider) offsetSlider.oninput = function() {
            const v = parseInt(this.value);
            document.getElementById("karaokeMixOffsetNum").innerText = (v >= 0 ? "+" : "") + v + "ms";
        };
    }

    function createAudioElement() {
        audio = document.createElement("audio");
        audio.id = "karaokeAudio";
        audio.className = "hidden";
        audio.crossOrigin = "anonymous";
        document.body.appendChild(audio);
        return audio;
    }

    function setupAudioEvents() {
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("timeupdate", updateProgress);
        audio.addEventListener("loadedmetadata", () => {
            const durEl = document.getElementById("karaokeDuration");
            if (durEl) durEl.innerText = formatTime(audio.duration);
        });
    }

    async function loadSongList() {
        const { data } = await window.sb.from("music").select("*").order("created_at", { ascending: false });
        karaokeSongs = data || [];

        const listEl = document.getElementById("karaokeSongList");
        if (!listEl) return;

        if (karaokeSongs.length === 0) {
            listEl.innerHTML = '<div class="text-gray-400 text-sm">暂无歌曲，请先到音乐 Tab 上传 🎵</div>';
            document.getElementById("karaokeEmpty").classList.remove("hidden");
            document.getElementById("karaokeStage").classList.add("hidden");
            return;
        }

        document.getElementById("karaokeEmpty").classList.add("hidden");
        listEl.innerHTML = "";
        karaokeSongs.forEach((song, idx) => {
            const btn = document.createElement("button");
            btn.className = "karaoke-song-chip" + (selectedSong && selectedSong.id === song.id ? " active" : "");
            const title = escapeHtml(song.title || "未知歌曲");
            const label = song.cover_url
                ? `<div class="karaoke-chip-cover" style="background-image:url('${song.cover_url}')"></div>`
                : `<div class="karaoke-chip-cover">${title.charAt(0)}</div>`;
            btn.innerHTML = `${label}<span>${title}</span>`;
            btn.onclick = () => selectSong(idx);
            listEl.appendChild(btn);
        });
    }

    function selectSong(idx) {
        if (isPlaying || isRecording) {
            alert("请先停止当前操作再换歌");
            return;
        }
        if (isPreviewing) stopPreview();
        previewAccBuffer = null;  // 清除缓存的伴奏
        selectedSong = karaokeSongs[idx];
        audio.src = selectedSong.url;
        document.getElementById("karaokeSongTitle").innerText = selectedSong.title || "未知歌曲";
        document.getElementById("karaokeStage").classList.remove("hidden");
        document.getElementById("karaokeEmpty").classList.add("hidden");

        parseLyrics(selectedSong.lyrics);
        loadSongList();
        resetProgress();
    }

    function parseLyrics(lyricsText) {
        lyricsData = [];
        currentLyricIndex = -1;
        const lyricsEl = document.getElementById("karaokeLyrics");
        if (!lyricsEl) return;

        if (!lyricsText || !lyricsText.trim()) {
            lyricsEl.innerHTML = `<div class="karaoke-lyrics-empty">暂无歌词，尽情自由演唱吧 🎤</div>`;
            return;
        }

        const lines = lyricsText.split('\n');
        const re = /\[(\d+):(\d+)(?:[.:](\d+))?\]/g;
        lines.forEach(line => {
            const matches = [...line.matchAll(re)];
            const text = line.replace(re, '').trim();
            if (text === '' || matches.length === 0) return;
            matches.forEach(m => {
                const min = parseInt(m[1]);
                const sec = parseInt(m[2]);
                const ms = m[3] ? parseInt(m[3].padEnd(3, '0').substring(0, 3)) : 0;
                lyricsData.push({ time: min * 60 + sec + ms / 1000, text });
            });
        });

        if (lyricsData.length === 0) {
            lines.forEach(line => {
                const t = line.trim();
                if (t) lyricsData.push({ time: -1, text: t });
            });
        }

        lyricsData.sort((a, b) => a.time - b.time);
        lyricsEl.innerHTML = lyricsData.map((l, i) =>
            `<div class="karaoke-lyric-line" data-idx="${i}">${escapeHtml(l.text)}</div>`
        ).join('');
    }

    function updateLyrics() {
        if (lyricsData.length === 0) return;
        const currentTime = audio.currentTime;
        let newIdx = -1;
        let lo = 0, hi = lyricsData.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (lyricsData[mid].time < 0) { lo = mid + 1; continue; }
            if (lyricsData[mid].time <= currentTime) { newIdx = mid; lo = mid + 1; }
            else { hi = mid - 1; }
        }

        if (newIdx !== currentLyricIndex) {
            currentLyricIndex = newIdx;
            const lines = document.querySelectorAll('#karaokeLyrics .karaoke-lyric-line');
            lines.forEach((el, i) => el.classList.toggle('active', i === newIdx));
            if (newIdx >= 0 && lines[newIdx]) {
                const container = document.getElementById("karaokeLyrics");
                const rect = container.getBoundingClientRect();
                const lineRect = lines[newIdx].getBoundingClientRect();
                const delta = lineRect.top - rect.top - rect.height / 2 + lineRect.height / 2;
                container.scrollTop += delta;
            }
        }
    }

    function updateProgress() {
        if (!audio.duration) return;
        const percent = (audio.currentTime / audio.duration) * 100;
        const bar = document.getElementById("karaokeProgress");
        if (bar) bar.style.width = percent + "%";
        const curEl = document.getElementById("karaokeCurrent");
        if (curEl) curEl.innerText = formatTime(audio.currentTime);
        updateLyrics();
    }

    function resetProgress() {
        const bar = document.getElementById("karaokeProgress");
        if (bar) bar.style.width = "0%";
        document.getElementById("karaokeCurrent").innerText = "0:00";
        document.getElementById("karaokeDuration").innerText = formatTime(audio.duration || 0);
        const lyricsEl = document.getElementById("karaokeLyrics");
        if (lyricsEl) {
            const lines = lyricsEl.querySelectorAll('.karaoke-lyric-line');
            lines.forEach(el => el.classList.remove('active'));
            lyricsEl.scrollTop = 0;
        }
    }

    function karaokeTogglePlay() {
        if (!selectedSong) {
            alert("请先选择一首歌");
            return;
        }
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
        }
    }

    function karaokeSeek(e) {
        if (!selectedSong || !audio.duration) return;
        const wrap = document.getElementById("karaokeProgressWrap");
        const rect = wrap.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = percent * audio.duration;
        updateProgress();
    }

    function onPlay() {
        isPlaying = true;
        const btn = document.getElementById("karaokePlayBtn");
        btn.innerHTML = '<i class="fa fa-pause"></i> 暂停伴奏';
        updateStatus("🎵 伴奏播放中");
    }

    function onPause() {
        isPlaying = false;
        const btn = document.getElementById("karaokePlayBtn");
        btn.innerHTML = '<i class="fa fa-play"></i> 播放伴奏';
        updateStatus("已暂停");
    }

    function onEnded() {
        isPlaying = false;
        const btn = document.getElementById("karaokePlayBtn");
        btn.innerHTML = '<i class="fa fa-play"></i> 播放伴奏';
        resetProgress();
        updateStatus("🎵 播放结束");
    }

    async function karaokeToggleRecord() {
        if (!selectedSong) {
            alert("请先选择一首歌");
            return;
        }
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }

    async function startRecording() {
        try {
            // 关闭浏览器音频处理（降噪/自动增益/回声消除），保留人声原始细节
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: 1
                }
            });

            if (!mixAudioCtx) {
                mixAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (mixAudioCtx.state === 'suspended') {
                await mixAudioCtx.resume();
            }

            micSource = mixAudioCtx.createMediaStreamSource(mediaStream);
            analyser = mixAudioCtx.createAnalyser();
            analyser.fftSize = 256;

            // ScriptProcessorNode 捕获原始 PCM 数据
            const bufferSize = 4096;
            processor = mixAudioCtx.createScriptProcessor(bufferSize, 1, 1);
            recordedSamples = [];

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                recordedSamples.push(new Float32Array(input));
            };

            // 连接：麦克风 → analyser（音量指示）+ processor（录音）
            micSource.connect(analyser);
            micSource.connect(processor);
            // processor 需要连接 destination 才能触发 onaudioprocess，用静音 gain 避免用户听到自己
            const silentGain = mixAudioCtx.createGain();
            silentGain.gain.value = 0;
            processor.connect(silentGain);
            silentGain.connect(mixAudioCtx.destination);

            isRecording = true;

            // 记录录音开始时伴奏的播放位置
            recordStartTime = audio.currentTime || 0;

            document.getElementById("karaokeMixPanel").classList.add("hidden");

            if (audio.paused) {
                audio.play();
            }

            document.getElementById("karaokeStopBtn").classList.remove("hidden");
            updateStatus("🎤 正在录音中...");
            showVolumeMeter();
            updateRecordBtn();

            window.sendNotification("karaoke", "🎤 开始 K 歌啦！");
        } catch (err) {
            console.error("麦克风访问失败:", err);
            alert("无法访问麦克风：" + err.message + "\n\n请确保使用 HTTPS 或 localhost 访问，并允许浏览器麦克风权限。");
        }
    }

    // 动态加载 lamejs（MP3 编码器）
    let lamejsLoaded = false;
    async function loadLameJS() {
        if (lamejsLoaded || window.lamejs) {
            lamejsLoaded = true;
            return;
        }
        const cdns = [
            'https://cdn.jsdelivr.net/npm/@breezystack/lamejs@1.2.7/lame.min.js',
            'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
            'https://unpkg.com/lamejs@1.2.1/lame.min.js'
        ];
        for (const url of cdns) {
            try {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = url;
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
                if (window.lamejs) {
                    lamejsLoaded = true;
                    return;
                }
            } catch (e) { /* 尝试下一个 CDN */ }
        }
        throw new Error('无法加载 MP3 编码器，请检查网络');
    }

    // 将 AudioBuffer 编码为 MP3
    function encodeMp3(audioBuffer, kbps) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, kbps);
        const blockSize = 1152;
        const mp3Data = [];

        // 取各通道数据并转为 int16
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            const float32 = audioBuffer.getChannelData(ch);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            channels.push(int16);
        }

        const totalSamples = channels[0].length;
        for (let i = 0; i < totalSamples; i += blockSize) {
            const blocks = [];
            for (let ch = 0; ch < numChannels; ch++) {
                blocks.push(channels[ch].subarray(i, i + blockSize));
            }
            let mp3buf;
            if (numChannels === 1) {
                mp3buf = encoder.encodeBuffer(blocks[0]);
            } else {
                mp3buf = encoder.encodeBuffer(blocks[0], blocks[1]);
            }
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }
        const end = encoder.flush();
        if (end.length > 0) mp3Data.push(end);

        return new Blob(mp3Data, { type: 'audio/mp3' });
    }

    // 将 PCM 浮点片段编码为 MP3（用于人声录音）
    function encodePcmToMp3(samples, sampleRate, kbps) {
        // 合并所有片段
        let totalLength = 0;
        for (const s of samples) totalLength += s.length;
        const int16 = new Int16Array(totalLength);
        let off = 0;
        for (const chunk of samples) {
            for (let i = 0; i < chunk.length; i++) {
                const s = Math.max(-1, Math.min(1, chunk[i]));
                int16[off++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
        }

        const encoder = new lamejs.Mp3Encoder(1, sampleRate, kbps);
        const blockSize = 1152;
        const mp3Data = [];

        for (let i = 0; i < int16.length; i += blockSize) {
            const block = int16.subarray(i, i + blockSize);
            const mp3buf = encoder.encodeBuffer(block);
            if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }
        const end = encoder.flush();
        if (end.length > 0) mp3Data.push(end);

        return new Blob(mp3Data, { type: 'audio/mp3' });
    }

    async function stopRecording() {
        if (!isRecording) return;
        isRecording = false;

        if (!audio.paused) audio.pause();

        // 保存人声副本供混音用
        vocalSamples = recordedSamples.slice();
        vocalSampleRate = mixAudioCtx.sampleRate;

        updateStatus("🔄 正在编码 MP3...");

        try {
            await loadLameJS();
            // 编码人声 MP3（128kbps mono）
            const blob = encodePcmToMp3(vocalSamples, vocalSampleRate, 128);
            const url = URL.createObjectURL(blob);

            const audioEl = document.getElementById("karaokePlaybackAudio");
            audioEl.src = url;
            document.getElementById("karaokePlayback").classList.remove("hidden");
            document.getElementById("karaokeStopBtn").classList.add("hidden");
            document.getElementById("karaokeMixPanel").classList.remove("hidden");
            setPlaybackMode('vocal', '人声录音');

            cleanupStream();
            updateStatus("✅ 录音完成（MP3）！可回放或合成伴奏 🎧");
            updateRecordBtn();
        } catch (err) {
            // MP3 编码失败，回退 WAV
            console.warn("MP3 编码失败，回退 WAV:", err);
            const blob = encodeWav(vocalSamples, vocalSampleRate);
            const url = URL.createObjectURL(blob);

            const audioEl = document.getElementById("karaokePlaybackAudio");
            audioEl.src = url;
            document.getElementById("karaokePlayback").classList.remove("hidden");
            document.getElementById("karaokeStopBtn").classList.add("hidden");
            document.getElementById("karaokeMixPanel").classList.remove("hidden");
            setPlaybackMode('vocal', '人声录音');

            cleanupStream();
            updateStatus("✅ 录音完成（WAV）！可回放或合成伴奏 🎧");
            updateRecordBtn();
        }
    }

    function cleanupStream() {
        if (animFrame) {
            cancelAnimationFrame(animFrame);
            animFrame = null;
        }
        if (processor) {
            try { processor.disconnect(); } catch(e) {}
            try { micSource.disconnect(processor); } catch(e) {}
            processor = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            mediaStream = null;
        }
        try { if (micSource) micSource.disconnect(); } catch(e) {}
        try { if (analyser) analyser.disconnect(); } catch(e) {}
        micSource = null;
        analyser = null;
        recordedSamples = [];
    }

    // 获取手动偏移（秒）
    function getManualOffset() {
        const slider = document.getElementById("karaokeMixOffset");
        return slider ? parseInt(slider.value) / 1000 : 0;
    }

    // 试听混音效果（实时播放，可反复调整偏移后重新试听）
    async function previewMix() {
        if (isPreviewing) {
            stopPreview();
            return;
        }
        if (vocalSamples.length === 0 || !selectedSong) {
            alert("请先录音");
            return;
        }

        const btn = document.getElementById("karaokePreviewBtn");
        btn.innerHTML = '<i class="fa fa-stop"></i> 停止';
        isPreviewing = true;
        updateStatus("🎧 试听中...可调整偏移后再次试听");

        try {
            // 缓存伴奏 AudioBuffer（首次试听时下载）
            if (!previewAccBuffer) {
                updateStatus("🔄 加载伴奏中...");
                const resp = await fetch(selectedSong.url);
                const arrayBuffer = await resp.arrayBuffer();
                const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
                previewAccBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
                tmpCtx.close();
            }

            stopPreview(false);

            previewCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (previewCtx.state === 'suspended') await previewCtx.resume();

            const accVol = parseInt(document.getElementById("karaokeMixAccVol").value) / 100;
            const vocalVol = parseInt(document.getElementById("karaokeMixVocalVol").value) / 100;
            const manualOffset = getManualOffset();

            // 人声时长
            let totalVocalLength = 0;
            for (const s of vocalSamples) totalVocalLength += s.length;
            const vocalDuration = totalVocalLength / vocalSampleRate;

            // 伴奏截取（前后各 3 秒）
            const padSec = 3;
            const accOffset = Math.max(0, recordStartTime - padSec + manualOffset);
            const accEnd = Math.min(previewAccBuffer.duration, recordStartTime + vocalDuration + padSec + manualOffset);
            const accSliceDuration = accEnd - accOffset;
            const vocalStartInOutput = (recordStartTime - accOffset) + manualOffset;

            // 伴奏
            previewAccSrc = previewCtx.createBufferSource();
            previewAccSrc.buffer = previewAccBuffer;
            const accGain = previewCtx.createGain();
            accGain.gain.value = accVol;
            previewAccSrc.connect(accGain);
            accGain.connect(previewCtx.destination);
            previewAccSrc.start(0, accOffset, accSliceDuration);

            // 人声
            const vocalBuf = previewCtx.createBuffer(1, totalVocalLength, vocalSampleRate);
            const vocalChannel = vocalBuf.getChannelData(0);
            let off = 0;
            for (const chunk of vocalSamples) {
                vocalChannel.set(chunk, off);
                off += chunk.length;
            }
            previewVocalSrc = previewCtx.createBufferSource();
            previewVocalSrc.buffer = vocalBuf;
            const vGain = previewCtx.createGain();
            vGain.gain.value = vocalVol;
            previewVocalSrc.connect(vGain);
            vGain.connect(previewCtx.destination);
            const startAt = Math.max(0, vocalStartInOutput);
            previewVocalSrc.start(startAt);

            previewAccSrc.onended = () => {
                if (isPreviewing) stopPreview();
            };
        } catch (err) {
            console.error("试听失败:", err);
            alert("试听失败：" + err.message);
            stopPreview();
        }
    }

    function stopPreview(resetBtn) {
        try { if (previewAccSrc) previewAccSrc.stop(); } catch(e) {}
        try { if (previewVocalSrc) previewVocalSrc.stop(); } catch(e) {}
        try { if (previewAccSrc) previewAccSrc.disconnect(); } catch(e) {}
        try { if (previewVocalSrc) previewVocalSrc.disconnect(); } catch(e) {}
        previewAccSrc = null;
        previewVocalSrc = null;
        if (previewCtx) {
            previewCtx.close();
            previewCtx = null;
        }
        isPreviewing = false;
        if (resetBtn !== false) {
            const btn = document.getElementById("karaokePreviewBtn");
            if (btn) btn.innerHTML = '<i class="fa fa-play-circle"></i> 试听';
            updateStatus("试听结束");
        }
    }

    // 高质量离线混音：人声 + 伴奏 → WAV
    async function mixAndExport() {
        if (vocalSamples.length === 0 || !selectedSong) {
            alert("请先录音");
            return;
        }

        const accVol = parseInt(document.getElementById("karaokeMixAccVol").value) / 100;
        const vocalVol = parseInt(document.getElementById("karaokeMixVocalVol").value) / 100;
        const manualOffset = getManualOffset();

        // 停止试听
        if (isPreviewing) stopPreview();

        updateStatus("🔄 正在合成伴奏+人声...");

        try {
            // 1. 下载伴奏并解码为 AudioBuffer（复用缓存）
            let accBuffer = previewAccBuffer;
            if (!accBuffer) {
                const resp = await fetch(selectedSong.url);
                const arrayBuffer = await resp.arrayBuffer();
                const tmpCtx = new (window.AudioContext || window.webkitAudioContext)();
                accBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
                tmpCtx.close();
                previewAccBuffer = accBuffer;
            }

            // 2. 合并人声片段为一个 AudioBuffer
            let totalVocalLength = 0;
            for (const s of vocalSamples) totalVocalLength += s.length;
            const vocalDuration = totalVocalLength / vocalSampleRate;

            // 截取伴奏片段：前后各多取 3 秒 + 手动偏移
            const padSec = 3;
            const accOffset = Math.max(0, recordStartTime - padSec + manualOffset);
            const accEnd = Math.min(accBuffer.duration, recordStartTime + vocalDuration + padSec + manualOffset);
            const accSliceDuration = accEnd - accOffset;
            // 人声在输出中的起始位置
            const vocalStartInOutput = Math.max(0, (recordStartTime - accOffset) + manualOffset);

            // 用人声采样率作为输出采样率，避免人声 buffer 跨采样率渲染丢失
            const outSampleRate = vocalSampleRate;
            const offCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
                2,
                Math.ceil(accSliceDuration * outSampleRate),
                outSampleRate
            );

            // 创建人声 AudioBuffer（与人声采样率一致，无需重采样）
            const vocalBuf = offCtx.createBuffer(1, totalVocalLength, outSampleRate);
            const vocalChannel = vocalBuf.getChannelData(0);
            let off = 0;
            for (const chunk of vocalSamples) {
                vocalChannel.set(chunk, off);
                off += chunk.length;
            }

            // 3. 在 OfflineAudioContext 中混音
            // 伴奏：从 accOffset 处截取 accSliceDuration 秒
            const accSrc = offCtx.createBufferSource();
            accSrc.buffer = accBuffer;
            const accGain = offCtx.createGain();
            accGain.gain.value = accVol;
            accSrc.connect(accGain);
            accGain.connect(offCtx.destination);
            accSrc.start(0, accOffset, accSliceDuration);

            // 人声：在伴奏前奏后切入
            const vocalSrc = offCtx.createBufferSource();
            vocalSrc.buffer = vocalBuf;
            const vGain = offCtx.createGain();
            vGain.gain.value = vocalVol;
            vocalSrc.connect(vGain);
            vGain.connect(offCtx.destination);
            vocalSrc.start(vocalStartInOutput);

            // 4. 离线渲染
            const rendered = await offCtx.startRendering();

            // 5. 编码 MP3（192kbps 立体声）
            await loadLameJS();
            let blob;
            try {
                blob = encodeMp3(rendered, 192);
            } catch (mp3Err) {
                // MP3 编码失败，回退 WAV
                console.warn("MP3 编码失败，回退 WAV:", mp3Err);
                const samples = [];
                for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
                    samples.push(rendered.getChannelData(ch));
                }
                blob = encodeWavStereo(samples, rendered.sampleRate);
            }
            const url = URL.createObjectURL(blob);

            // 6. 替换回放为混音版本
            const audioEl = document.getElementById("karaokePlaybackAudio");
            const songTitle = selectedSong ? selectedSong.title : '合成作品';
            audioEl.src = url;
            setPlaybackMode('mix', songTitle + '（合成）');
            audioEl.play();

            updateStatus("✅ 混音完成！伴奏+人声已合成（MP3）");
            window.sendNotification("karaoke", "🎵 混音合成完成！");
        } catch (err) {
            console.error("混音失败:", err);
            alert("混音失败：" + err.message);
            updateStatus("❌ 混音失败");
        }
    }

    // 将多通道 PCM 编码为 16-bit WAV（支持立体声）
    function encodeWavStereo(channels, sampleRate) {
        const numChannels = channels.length;
        const totalLength = channels[0].length;
        const buffer = new ArrayBuffer(44 + totalLength * numChannels * 2);
        const view = new DataView(buffer);

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + totalLength * numChannels * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, totalLength * numChannels * 2, true);

        let offset = 44;
        for (let i = 0; i < totalLength; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const s = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }
        return new Blob([buffer], { type: 'audio/wav' });
    }

    // 将单通道 PCM 编码为 16-bit WAV
    function encodeWav(samples, sampleRate) {
        // 合并所有片段
        let totalLength = 0;
        for (const s of samples) totalLength += s.length;

        const buffer = new ArrayBuffer(44 + totalLength * 2);
        const view = new DataView(buffer);

        // WAV 文件头
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + totalLength * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);          // fmt chunk size
        view.setUint16(20, 1, true);           // PCM format
        view.setUint16(22, 1, true);           // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate
        view.setUint16(32, 2, true);           // block align
        view.setUint16(34, 16, true);          // bits per sample
        writeString(view, 36, 'data');
        view.setUint32(40, totalLength * 2, true);

        // 写入 PCM 数据（float32 → int16）
        let offset = 44;
        for (const chunk of samples) {
            for (let i = 0; i < chunk.length; i++) {
                const s = Math.max(-1, Math.min(1, chunk[i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }

    function showVolumeMeter() {
        const volumeEl = document.getElementById("karaokeVolume");
        const bar = document.getElementById("karaokeVolumeBar");
        volumeEl.classList.remove("hidden");

        if (!analyser) {
            volumeEl.classList.add("hidden");
            return;
        }
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function draw() {
            if (!isRecording || !analyser) {
                volumeEl.classList.add("hidden");
                return;
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            let avg = sum / dataArray.length;
            let level = Math.min(100, (avg / 128) * 100);
            bar.style.width = level + "%";
            animFrame = requestAnimationFrame(draw);
        }
        draw();
    }

    function updateRecordBtn() {
        const btn = document.getElementById("karaokeRecordBtn");
        if (!btn) return;
        if (isRecording) {
            btn.innerHTML = '<i class="fa fa-stop"></i> 停止录音';
            btn.classList.add("recording");
        } else {
            btn.innerHTML = '<i class="fa fa-circle"></i> 开始录音';
            btn.classList.remove("recording");
        }
    }

    function karaokeStopAll() {
        if (isRecording) stopRecording();
        if (isPlaying) audio.pause();
        document.getElementById("karaokeStopBtn").classList.add("hidden");
    }

    function karaokeDownload() {
        const audioEl = document.getElementById("karaokePlaybackAudio");
        if (!audioEl || !audioEl.src) return;
        const a = document.createElement("a");
        a.href = audioEl.src;
        a.download = `karaoke_${Date.now()}.mp3`;
        a.click();
    }

    async function saveToMusicLibrary() {
        const audioEl = document.getElementById("karaokePlaybackAudio");
        if (!audioEl || !audioEl.src) {
            alert("请先录音");
            return;
        }

        try {
            const resp = await fetch(audioEl.src);
            const blob = await resp.blob();

            const songTitle = selectedSong ? selectedSong.title : "未知歌曲";
            const now = new Date();
            const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
            const safeName = songTitle.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_") || "karaoke";
            const fileName = `${ts}_karaoke_${safeName}.mp3`;

            updateStatus("🔄 正在保存到录音库...");

            const { data, error } = await window.sb.storage.from("music").upload(fileName, blob);
            if (error) {
                alert("上传失败：" + error.message);
                updateStatus("❌ 上传失败");
                return;
            }

            const url = window.sb.storage.from("music").getPublicUrl(data.path).data.publicUrl;

            // 获取用户昵称（boy_name / girl_name）
            let singerName = window.myRpsEmail || "匿名";
            try {
                const { data: profile } = await window.sb.from("profiles")
                    .select("boy_name, girl_name, email")
                    .or(`email.eq.${window.myRpsEmail}`)
                    .maybeSingle();
                if (profile) {
                    if (profile.email && profile.email.toLowerCase() === (window.myRpsEmail || "").toLowerCase()) {
                        const boyName = profile.boy_name ? profile.boy_name.trim() : "";
                        const girlName = profile.girl_name ? profile.girl_name.trim() : "";
                        if (boyName || girlName) {
                            singerName = (boyName || girlName);
                        }
                    }
                }
            } catch (e) { /* 忽略查询错误，用邮箱代替 */ }

            const title = `🎤K歌 - ${songTitle}`;
            const { error: insertErr } = await window.sb.from("karaoke_recordings").insert({
                title,
                song_title: songTitle,
                url,
                lyrics: selectedSong ? selectedSong.lyrics : null,
                uploader_email: window.myRpsEmail || null,
                singer_name: singerName
            });

            if (insertErr) {
                alert("保存记录失败：" + insertErr.message);
                updateStatus("❌ 保存失败");
                return;
            }

            updateStatus(`✅ 已保存到录音库：${title}（${singerName}）`);
            window.sendNotification("karaoke", `🎤 ${singerName} 的 K歌作品已保存！`);
            loadRecordings();
        } catch (err) {
            console.error("保存失败:", err);
            alert("保存失败：" + err.message);
            updateStatus("❌ 保存失败");
        }
    }

    async function loadRecordings() {
        const listEl = document.getElementById("karaokeRecordList");
        if (!listEl) return;

        const { data, error } = await window.sb.from("karaoke_recordings")
            .select("*").order("created_at", { ascending: false });

        // 先停掉所有正在播放的录音并清理缓存
        for (const [id, a] of recordAudioMap.entries()) {
            try { a.pause(); a.src = ''; } catch (e) {}
        }
        recordAudioMap.clear();

        if (error || !data || data.length === 0) {
            listEl.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">暂无录音作品 🎤</div>';
            return;
        }

        const isOwner = (email) => !!(window.myRpsEmail && email && email.toLowerCase() === window.myRpsEmail.toLowerCase());

        listEl.innerHTML = data.map(r => {
            const rTitle = escapeHtml(r.title);
            const rUrl = r.url.replace(/'/g, "\\'");
            return `
            <div class="karaoke-rec-item" data-rec-id="${r.id}">
                <audio class="karaoke-rec-audio" data-rec-audio-id="${r.id}" src="${r.url}" preload="metadata"></audio>
                <div class="karaoke-rec-row1">
                    <button class="karaoke-rec-play-btn" data-rec-play-id="${r.id}" onclick="window.toggleRecPlay(${r.id})">
                        <i class="fa fa-play"></i>
                    </button>
                    <div class="karaoke-rec-info">
                        <div class="karaoke-rec-title">${rTitle}</div>
                        <div class="karaoke-rec-meta">
                            ${r.singer_name ? `<span>🎤 ${escapeHtml(r.singer_name)}</span>` : ''}
                            ${r.song_title ? `<span>🎵 ${escapeHtml(r.song_title)}</span>` : ''}
                            <span>${formatDate(r.created_at)}</span>
                        </div>
                    </div>
                    ${isOwner(r.uploader_email) ? `<i class="fa fa-trash karaoke-rec-del" onclick="window.deleteKaraokeRecording(${r.id}, '${rUrl}')" title="删除"></i>` : ''}
                </div>
                <div class="karaoke-rec-row2">
                    <span class="karaoke-rec-time" data-rec-cur="${r.id}">0:00</span>
                    <div class="karaoke-rec-progress-wrap" data-rec-progress-wrap="${r.id}" onclick="window.seekRecProgress(event, ${r.id})">
                        <div class="karaoke-rec-progress-bar" data-rec-progress-bar="${r.id}"></div>
                        <div class="karaoke-rec-progress-thumb" data-rec-progress-thumb="${r.id}"></div>
                    </div>
                    <span class="karaoke-rec-time" data-rec-dur="${r.id}">0:00</span>
                </div>
            </div>
        `;
        }).join('');

        // 为每条录音绑定独立事件（loadedmetadata + timeupdate + play + pause + ended）
        for (const r of data) {
            const recAudio = listEl.querySelector(`audio[data-rec-audio-id="${r.id}"]`);
            if (!recAudio) continue;
            recordAudioMap.set(r.id, recAudio);
            bindRecAudioEvents(recAudio, r.id);
        }
    }

    // 为每条录音绑定独立音频事件
    function bindRecAudioEvents(a, id) {
        const btn = document.querySelector(`[data-rec-play-id="${id}"]`);
        const cur = document.querySelector(`[data-rec-cur="${id}"]`);
        const dur = document.querySelector(`[data-rec-dur="${id}"]`);
        const bar = document.querySelector(`[data-rec-progress-bar="${id}"]`);
        const thumb = document.querySelector(`[data-rec-progress-thumb="${id}"]`);

        const updateProgress = () => {
            if (!a.duration) return;
            const percent = (a.currentTime / a.duration) * 100;
            if (bar) bar.style.width = percent + '%';
            if (thumb) thumb.style.left = percent + '%';
            if (cur) cur.innerText = formatTime(a.currentTime);
        };

        a.addEventListener('loadedmetadata', () => {
            if (dur) dur.innerText = formatTime(a.duration);
            if (cur) cur.innerText = '0:00';
            updateProgress();
        });
        a.addEventListener('timeupdate', updateProgress);
        a.addEventListener('play', () => {
            // 暂停其它所有正在播放的录音（只允许一个在播）
            for (const [oid, oa] of recordAudioMap.entries()) {
                if (Number(oid) !== id && !oa.paused) {
                    oa.pause();
                }
            }
            if (btn) btn.innerHTML = '<i class="fa fa-pause"></i>';
        });
        a.addEventListener('pause', () => {
            if (btn && !a.ended) btn.innerHTML = '<i class="fa fa-play"></i>';
        });
        a.addEventListener('ended', () => {
            if (btn) btn.innerHTML = '<i class="fa fa-play"></i>';
            if (bar) bar.style.width = '100%';
            if (thumb) thumb.style.left = '100%';
        });
    }

    // 切换某条录音播放/暂停
    function toggleRecPlay(id) {
        const a = recordAudioMap.get(id);
        if (!a) return;
        if (a.paused) {
            a.play().catch(err => console.warn('录音播放失败:', err));
        } else {
            a.pause();
        }
    }

    // 点击某条录音进度条跳转
    function seekRecProgress(e, id) {
        const a = recordAudioMap.get(id);
        if (!a || !a.duration) return;
        const wrap = document.querySelector(`[data-rec-progress-wrap="${id}"]`);
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        a.currentTime = percent * a.duration;
        // 立即刷新当前条进度
        const bar = document.querySelector(`[data-rec-progress-bar="${id}"]`);
        const thumb = document.querySelector(`[data-rec-progress-thumb="${id}"]`);
        const cur = document.querySelector(`[data-rec-cur="${id}"]`);
        const p = percent * 100;
        if (bar) bar.style.width = p + '%';
        if (thumb) thumb.style.left = p + '%';
        if (cur) cur.innerText = formatTime(a.currentTime);
    }

    // 兼容：老 playKaraokeRecord（点击列表空白处播放的 fallback）
    function playKaraokeRecord(url, title) {
        // 什么都不做，现在列表本身就有播放控件
        updateStatus("🎧 点击录音条的按钮播放即可");
    }

    async function deleteKaraokeRecording(id, url) {
        if (!confirm("确定删除这个录音作品吗？")) return;

        try {
            updateStatus("🔄 正在删除...");

            // 先停止并清理该录音对应的 Audio
            const recAudio = recordAudioMap.get(id);
            if (recAudio) {
                try { recAudio.pause(); recAudio.src = ''; } catch (e) {}
                recordAudioMap.delete(id);
            }

            // 从存储桶中提取路径
            const match = url.match(/\/music\/(.+?)(?:\?|$)/);
            const storagePath = match ? match[1] : null;

            // 删除数据库记录
            const { error: dbErr } = await window.sb.from("karaoke_recordings").delete().eq("id", id);
            if (dbErr) {
                alert("删除记录失败：" + dbErr.message);
                updateStatus("❌ 删除失败");
                return;
            }

            // 删除 Storage 文件（如果有权限）
            if (storagePath) {
                try {
                    await window.sb.storage.from("music").remove([storagePath]);
                } catch (e) {
                    console.warn("Storage 文件删除失败（可能是其他用户上传）:", e);
                }
            }

            // 如果正在播放的是这个文件，清除 playback
            const audioEl = document.getElementById("karaokePlaybackAudio");
            if (audioEl && audioEl.src === url) {
                audioEl.pause();
                audioEl.src = "";
                document.getElementById("karaokePlayback").classList.add("hidden");
            }

            window.sendNotification("karaoke", "🗑️ 录音作品已删除");
            updateStatus("✅ 已删除");
            loadRecordings();
        } catch (err) {
            console.error("删除失败:", err);
            alert("删除失败：" + err.message);
            updateStatus("❌ 删除失败");
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function karaokeDeleteRecording() {
        const audioEl = document.getElementById("karaokePlaybackAudio");
        if (audioEl && audioEl.src) {
            URL.revokeObjectURL(audioEl.src);
            audioEl.pause();
            audioEl.src = "";
        }
        // 重置自定义播放器 UI
        const bar = document.getElementById('karaokePbProgressBar');
        const thumb = document.getElementById('karaokePbProgressThumb');
        const curEl = document.getElementById('karaokePbCurrent');
        const durEl = document.getElementById('karaokePbDuration');
        const titleEl = document.getElementById('karaokePbTitle');
        if (bar) bar.style.width = '0%';
        if (thumb) thumb.style.left = '0%';
        if (curEl) curEl.innerText = '0:00';
        if (durEl) durEl.innerText = '0:00';
        if (titleEl) titleEl.innerText = '未加载';
        updatePbPlayBtn(false);
        document.getElementById("karaokePlayback").classList.add("hidden");
        updateStatus("录音已删除");
    }

    function updateStatus(msg) {
        const el = document.getElementById("karaokeStatus");
        if (el) el.innerText = msg;
    }

    function formatTime(s) {
        if (!s || isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    window.karaokeTogglePlay = karaokeTogglePlay;
    window.karaokeSeek = karaokeSeek;
    window.karaokeToggleRecord = karaokeToggleRecord;
    window.karaokeStopAll = karaokeStopAll;
    window.karaokeDownload = karaokeDownload;
    window.karaokeDeleteRecording = karaokeDeleteRecording;
    window.mixAndExport = mixAndExport;
    window.previewMix = previewMix;
    window.saveToMusicLibrary = saveToMusicLibrary;
    window.playKaraokeRecord = playKaraokeRecord;
    window.deleteKaraokeRecording = deleteKaraokeRecording;
    window.loadKaraokeRecordings = loadRecordings;
    window.initKaraoke = initKaraoke;
    window.karaokePbTogglePlay = karaokePbTogglePlay;
    window.karaokePbSeek = karaokePbSeek;
    window.toggleRecPlay = toggleRecPlay;
    window.seekRecProgress = seekRecProgress;

})();
