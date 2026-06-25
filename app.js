// ─── RADIO XERO PLAYER ───────────────────────────────────────────────────
const STREAM_URL = 'https://stream.zeno.fm/n7fm3s6537zuv';

const audio = document.getElementById('rxAudio');
const statusEl = document.getElementById('rxStatus');
const playIcon = document.getElementById('playIcon');
const vuL = document.getElementById('vuL');
const vuR = document.getElementById('vuR');
const barsL = [];
const barsR = [];
const SEGMENT_COUNT = 15;

// Detección de Dispositivos y Navegadores
const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isEdgeAndroid = /EdgA/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

function createSegments(container, array) {
    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const seg = document.createElement('div');
        seg.className = 'rx-vu-segment';

        // Assign color class based on position
        const percent = (i / SEGMENT_COUNT) * 100;
        if (percent < 50) seg.classList.add('low');
        else if (percent < 80) seg.classList.add('mid');
        else seg.classList.add('high');

        container.appendChild(seg);
        array.push(seg);
    }
}

createSegments(vuL, barsL);
createSegments(vuR, barsR);

let isPlaying = false;
let animId = null;
let audioCtx = null;
let srcNode = null;
let dataArr = null;
let simL = 0;
let simR = 0;
let analyser = null;
let lastPauseTime = 0;
let systemPauseAutoResume = false;

// Variables de Visualización
let currentVizMode = 'led';
let canvas = document.getElementById('rxCanvas');
let ctx = canvas ? canvas.getContext('2d') : null;

// Volumen
function rxSetVol(v) {
    audio.volume = v / 100;
    const slider = document.getElementById('volSlider');
    const volValue = document.getElementById('volValue');
    slider.style.background = `linear-gradient(to right, var(--primary) ${v}%, var(--primary-glow) ${v}%)`;
    volValue.textContent = v + '%';

    if (v > 0 && audio.muted) {
        rxToggleMute();
    }
}
rxSetVol(80);

// Mute / Unmute
let isMuted = false;
let volumeBeforeMute = 80;

function rxToggleMute() {
    const muteBtn = document.getElementById('muteBtn');
    const muteIcon = document.getElementById('muteIcon');

    isMuted = !isMuted;
    audio.muted = isMuted;

    if (isMuted) {
        volumeBeforeMute = parseInt(document.getElementById('volSlider').value);
        muteIcon.innerHTML = '<g><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/><line x1="2.5" y1="21.5" x2="21.5" y2="2.5"/></g>';
        muteBtn.style.opacity = '0.65';
    } else {
        muteIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
        muteBtn.style.opacity = '1';
    }
}

function setIcon(state) {
    const btn = document.getElementById('playBtn');
    if (state === 'loading') {
        btn.innerHTML = '<div class="rx-loader"></div>';
        btn.classList.add('loading');
        btn.disabled = true;
        return;
    }

    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                ${state === 'playing'
            ? '<rect x="6" y="4" width="4" height="16" rx="1.5" fill="#fff"/><rect x="14" y="4" width="4" height="16" rx="1.5" fill="#fff"/>'
            : '<polygon points="6,4 20,12 6,20" fill="#fff"/>'}
            </svg>`;
}

function setStatus(msg, type) {
    statusEl.innerHTML = msg;
    statusEl.className = 'rx-status' + (type ? ' ' + type : '');
}

function idleAnim() {
    let t = 0;
    function frame() {
        if (isPlaying) return;
        animId = requestAnimationFrame(frame);
        t += 0.05;

        if (currentVizMode === 'led') {
            const valL = Math.abs(Math.sin(t)) * 0.35;
            const valR = Math.abs(Math.cos(t)) * 0.35;
            const activeL = Math.round(valL * SEGMENT_COUNT);
            const activeR = Math.round(valR * SEGMENT_COUNT);

            barsL.forEach((seg, i) => {
                if (i < activeL) seg.classList.add('active');
                else seg.classList.remove('active');
            });
            barsR.forEach((seg, i) => {
                if (i < activeR) seg.classList.add('active');
                else seg.classList.remove('active');
            });
        } else {
            // Animación sutil para Canvas en pausa
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (currentVizMode === 'bars') {
                const count = 32;
                const barWidth = (canvas.width / window.devicePixelRatio / count) * 0.8;
                for (let i = 0; i < count; i++) {
                    const h = 5 + Math.abs(Math.sin(t + i * 0.2)) * 10;
                    const x = i * barWidth * 1.25;
                    const y = (canvas.height / window.devicePixelRatio) - h;
                    ctx.fillStyle = document.body.classList.contains('dark-theme') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
                    ctx.fillRect(x, y, barWidth, h);
                }
            } else if (currentVizMode === 'wave') {
                ctx.lineWidth = 2;
                ctx.strokeStyle = document.body.classList.contains('dark-theme') ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                const w = canvas.width / window.devicePixelRatio;
                const h = canvas.height / window.devicePixelRatio;
                ctx.moveTo(0, h / 2);
                for (let x = 0; x < w; x += 5) {
                    const y = h / 2 + Math.sin(x * 0.02 + t) * 5;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        }
    }
    frame();
}
idleAnim();

// Manejo de redimensionado para el Canvas
window.addEventListener('resize', () => {
    if (currentVizMode !== 'led') {
        const canvasEl = document.getElementById('rxCanvas');
        canvas.width = canvasEl.offsetWidth * window.devicePixelRatio;
        canvas.height = canvasEl.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    checkTrackOverflow();
});

function setVizMode(mode) {
    currentVizMode = mode;

    // UI Update
    document.querySelectorAll('.viz-mode-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btn-' + mode);
    if (btn) btn.classList.add('active');

    const container = document.getElementById('rxVizContainer');
    const canvasEl = document.getElementById('rxCanvas');

    if (mode === 'led') {
        container.style.display = 'flex';
        canvasEl.style.display = 'none';
    } else {
        container.style.display = 'none';
        canvasEl.style.display = 'block';
        // Resize canvas to its display size
        canvas.width = canvasEl.offsetWidth * window.devicePixelRatio;
        canvas.height = canvasEl.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
}

function startAnalyser() {
    if (!audioCtx || audioCtx.state === 'closed') {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256; // Mayor resolución para Bars/Wave
            analyser.smoothingTimeConstant = 0.75;
            srcNode = audioCtx.createMediaElementSource(audio);
            srcNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            dataArr = new Uint8Array(analyser.frequencyBinCount);
        } catch (e) {
            console.error("AudioContext error", e);
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    function draw() {
        if (!isPlaying) return;
        animId = requestAnimationFrame(draw);

        if (currentVizMode === 'led') {
            drawLed();
        } else if (currentVizMode === 'bars') {
            drawBars();
        } else if (currentVizMode === 'wave') {
            drawWave();
        }

        // Calcular promedio de bajas frecuencias para el brillo neón
        if (dataArr) {
            let sum = 0;
            const count = Math.min(12, dataArr.length);
            for (let i = 0; i < count; i++) {
                sum += dataArr[i];
            }
            const avg = sum / count;
            updateNeonGlow(avg);
        }
    }

    function simulateFrequencyData() {
        const now = Date.now() / 180;
        for (let i = 0; i < dataArr.length; i++) {
            // Simular caída natural de frecuencias (bajos a agudos)
            const freqScale = Math.pow(1 - (i / dataArr.length), 1.5);
            const wave1 = Math.sin(now + i * 0.15) * 40;
            const wave2 = Math.sin(now * 0.7 - i * 0.05) * 30;
            const noise = Math.random() * 40;

            dataArr[i] = Math.max(20, (110 + wave1 + wave2 + noise) * freqScale * 1.2);
        }
    }

    function drawLed() {
        let activeValL = 0;
        let activeValR = 0;

        if (isIosDevice || isEdgeAndroid || !analyser) {
            const baseL = 0.5 + Math.random() * 0.2;
            simL += (Math.min(1.2, baseL + (Math.random() * 0.1)) - simL) * 0.25;
            activeValL = Math.round(Math.pow(simL, 1.5) * SEGMENT_COUNT * 1.3);
            activeValR = Math.round(Math.min(SEGMENT_COUNT, activeValL + (Math.random() - 0.5) * 4));
        } else {
            analyser.getByteFrequencyData(dataArr);
            let avgL = 0;
            let avgR = 0;
            // Promedios simples para L/R simulado desde mono stream
            for (let i = 0; i < 10; i++) avgL += dataArr[i];
            for (let i = 10; i < 20; i++) avgR += dataArr[i];

            activeValL = Math.round((avgL / 10 / 255) * SEGMENT_COUNT * 1.05);
            activeValR = Math.round((avgR / 10 / 255) * SEGMENT_COUNT * 1.05);
        }

        activeValL = Math.min(SEGMENT_COUNT, activeValL);
        activeValR = Math.min(SEGMENT_COUNT, activeValR);

        barsL.forEach((seg, i) => {
            if (i < activeValL) seg.classList.add('active');
            else seg.classList.remove('active');
        });
        barsR.forEach((seg, i) => {
            if (i < activeValR) seg.classList.add('active');
            else seg.classList.remove('active');
        });
    }

    function drawBars() {
        if (isIosDevice || isEdgeAndroid || !analyser) {
            simulateFrequencyData();
        } else {
            analyser.getByteFrequencyData(dataArr);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barCount = 32;
        const canvasW = canvas.width / window.devicePixelRatio;
        const canvasH = canvas.height / window.devicePixelRatio;
        const barWidth = (canvasW / barCount) * 0.8;
        const gap = (canvasW / barCount) * 0.2;

        const brickHeight = 4; // Altura de cada bloque
        const brickGap = 1.5;   // Espacio entre bloques
        const totalBricks = Math.floor(canvasH / (brickHeight + brickGap));

        let x = gap / 2;
        const step = Math.floor(dataArr.length / 2 / barCount);

        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) sum += dataArr[i * step + j];
            let avg = sum / step;

            // Escala inteligente: atenuar bajos (izq) y potenciar medios/altos (der)
            const factor = i < 8 ? 0.95 : (i < 16 ? 1.2 : 1.4);
            const activeHeight = (avg / 255) * canvasH * factor;
            const activeBricks = Math.ceil(activeHeight / (brickHeight + brickGap));

            for (let b = 0; b < totalBricks; b++) {
                const y = canvasH - (b * (brickHeight + brickGap)) - brickHeight;

                // Determinar color del ladrillo
                const percent = (b / totalBricks) * 100;
                if (b < activeBricks) {
                    if (percent < 50) ctx.fillStyle = '#22c55e'; // Verde
                    else if (percent < 80) ctx.fillStyle = '#f97316'; // Naranja
                    else ctx.fillStyle = '#ef4444'; // Rojo

                    ctx.shadowBlur = 4;
                    ctx.shadowColor = ctx.fillStyle;
                } else {
                    // Ladrillos inactivos (fondo sutil)
                    ctx.fillStyle = document.body.classList.contains('dark-theme') ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
                    ctx.shadowBlur = 0;
                }

                ctx.fillRect(x, y, barWidth, brickHeight);
            }

            x += barWidth + gap;
        }
    }

    function drawWave() {
        if (isIosDevice || isEdgeAndroid || !analyser) {
            simulateFrequencyData();
        } else {
            analyser.getByteFrequencyData(dataArr);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const canvasW = canvas.width / window.devicePixelRatio;
        const canvasH = canvas.height / window.devicePixelRatio;

        // Degradado tricolor para la onda
        const gradient = ctx.createLinearGradient(0, canvasH, 0, 0);
        gradient.addColorStop(0, '#22c55e');   // Verde abajo
        gradient.addColorStop(0.5, '#f97316'); // Naranja medio
        gradient.addColorStop(0.9, '#ef4444'); // Rojo arriba (picos)

        ctx.beginPath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = gradient;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(237, 28, 36, 0.3)';

        const sliceWidth = canvasW / (dataArr.length / 2);
        let x = 0;

        for (let i = 0; i < dataArr.length / 2; i++) {
            // Gradiente de sensibilidad de izquierda a derecha
            const factor = i < 15 ? (0.8 + (i / 15) * 0.5) : 1.4;
            const v = (dataArr[i] / 255) * canvasH * factor;
            const y = canvasH - v;

            if (i === 0) ctx.moveTo(x, y);
            else {
                // Suavizado leve con factor compensado
                const prevFactor = (i - 1) < 15 ? (0.8 + ((i - 1) / 15) * 0.5) : 1.4;
                const prevY = canvasH - (dataArr[i - 1] / 255 * canvasH * prevFactor);
                ctx.quadraticCurveTo(x - sliceWidth / 2, prevY, x, y);
            }
            x += sliceWidth;
        }

        ctx.stroke();

        // Relleno degradado fluido
        ctx.lineTo(canvasW, canvasH);
        ctx.lineTo(0, canvasH);
        const fillGradient = ctx.createLinearGradient(0, canvasH, 0, 0);
        fillGradient.addColorStop(0, 'rgba(34, 197, 94, 0.1)');
        fillGradient.addColorStop(0.5, 'rgba(249, 115, 22, 0.1)');
        fillGradient.addColorStop(1, 'rgba(239, 68, 68, 0.1)');
        ctx.fillStyle = fillGradient;
        ctx.fill();
    }

    draw();
}

function rxToggle() {
    if (!isPlaying) {
        setStatus('Conectando con Radio Xero...');
        setIcon('loading');

        // Si NO es iPhone o Edge móvil, activamos CORS para el visualizador real
        if (!isIosDevice && !isEdgeAndroid) {
            audio.crossOrigin = "anonymous";
        } else {
            audio.removeAttribute('crossorigin');
        }

        const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now();
        audio.src = STREAM_URL + cacheBuster;

        audio.load();

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                isPlaying = true;
                setIcon('playing');
                const artPulse = document.getElementById('artPulse');
                if (artPulse) artPulse.style.animationPlayState = 'running';
                setStatus('<span class="rx-dot"></span>&nbsp;Transmitiendo en vivo', 'playing');
                if (animId) cancelAnimationFrame(animId);
                startAnalyser();
                syncLogoState();
            }).catch(error => {
                console.error("Error de reproducción:", error);
                setStatus('Presiona PLAY para escuchar.', 'playing');
                isPlaying = false;
                setIcon('paused');
                syncLogoState();
            });
        }
    } else {
        audio.pause();
        audio.src = '';
        isPlaying = false;
        setIcon('paused');
        const artPulse = document.getElementById('artPulse');
        if (artPulse) artPulse.style.animationPlayState = 'paused';
        setStatus('Pausado');
        if (animId) cancelAnimationFrame(animId);
        idleAnim();
        syncLogoState();
    }
}

audio.addEventListener('error', () => {
    if (isPlaying) {
        console.log("Error de audio detectado, intentando reconectar...");
        const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now();
        audio.src = STREAM_URL + cacheBuster;
        audio.load();
        audio.play().catch(() => {
            isPlaying = false;
            setIcon(false);
            setStatus('Error de conexión. Reintenta.', 'error');
            if (animId) cancelAnimationFrame(animId);
            idleAnim();
        });
    } else {
        isPlaying = false;
        setIcon(false);
        setStatus('Error de conexión. Reintenta.', 'error');
        if (animId) cancelAnimationFrame(animId);
        idleAnim();
    }
});

audio.addEventListener('waiting', () => {
    if (isPlaying) setStatus('Buffering...', 'playing');
});

// Sincronización con controles nativos del OS y llamadas telefónicas
audio.addEventListener('pause', () => {
    if (isPlaying) {
        lastPauseTime = Date.now();
        systemPauseAutoResume = true;
        isPlaying = false;
        setIcon('paused');
        const artPulse = document.getElementById('artPulse');
        if (artPulse) artPulse.style.animationPlayState = 'paused';
        setStatus('Pausado por sistema');
        if (animId) cancelAnimationFrame(animId);
        idleAnim();
        syncLogoState();
    } else {
        // Si el usuario pausó manualmente, no auto-reanudamos tras llamadas largas
        systemPauseAutoResume = false;
    }
});

audio.addEventListener('play', () => {
    const pauseDuration = (Date.now() - lastPauseTime) / 1000;

    // Si la pausa fue muy larga (> 30s) y era una pausa de sistema,
    // refrescamos la fuente para evitar timeouts de streaming.
    if (systemPauseAutoResume && pauseDuration > 30) {
        console.log(`Reconexión automática tras pausa larga: ${pauseDuration.toFixed(1)}s`);
        systemPauseAutoResume = false;
        const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now();
        audio.src = STREAM_URL + cacheBuster;
        audio.load();
        audio.play();
        return;
    }

    // Resetear bandera de auto-reanudación al reproducir
    systemPauseAutoResume = false;

    if (!isPlaying) {
        isPlaying = true;
        setIcon('playing');
        const artPulse = document.getElementById('artPulse');
        if (artPulse) artPulse.style.animationPlayState = 'running';
        setStatus('<span class="rx-dot"></span>&nbsp;Transmitiendo en vivo', 'playing');
        if (animId) cancelAnimationFrame(animId);
        startAnalyser();
        syncLogoState();
    }
});

// Manejo de errores y estancamientos (stalled) para auto-reconexión
audio.addEventListener('stalled', () => {
    if (isPlaying) {
        console.log("Stream estancado, intentando reconectar...");
        setStatus('Recuperando conexión...', 'playing');
        const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now();
        audio.src = STREAM_URL + cacheBuster;
        audio.load();
        audio.play();
    }
});

// Refuerzo cuando el usuario vuelve a la pestaña
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Si el audio debería estar sonando o fue pausado por el sistema, intentamos reanudar
        if ((isPlaying || systemPauseAutoResume) && audio.paused) {
            audio.play().catch(() => {
                // Si falla el auto-play (bloqueo navegador), refrescamos fuente
                const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now();
                audio.src = STREAM_URL + cacheBuster;
                audio.load();
                audio.play();
            });
        }
    }
});

audio.addEventListener('playing', () => {
    if (isPlaying) setStatus('<span class="rx-dot"></span>&nbsp;Transmitiendo en vivo', 'playing');
});

const sse = new EventSource('https://api.zeno.fm/mounts/metadata/subscribe/n7fm3s6537zuv');
const trackTextEl = document.getElementById('trackText');

function checkTrackOverflow() {
    const scroller = document.querySelector('.rx-track-scroller');
    const content = document.querySelector('.rx-track-content');
    const fullText = trackTextEl.textContent;
    if (!scroller || !content) return;

    // Reset inicial para medir correctamente
    scroller.classList.remove('is-scrolling');
    content.innerHTML = `<span>${fullText}</span>`;

    setTimeout(() => {
        // Si el texto es más ancho que el contenedor
        if (content.offsetWidth > scroller.offsetWidth) {
            // Creamos el efecto rueda clonando el texto
            const separator = "&nbsp;".repeat(12); // Espacio entre copias
            content.innerHTML = `<span>${fullText}${separator}</span><span>${fullText}${separator}</span>`;
            scroller.classList.add('is-scrolling');
        }
    }, 50);
}

sse.onmessage = function (e) {
    try {
        const data = JSON.parse(e.data);
        trackTextEl.textContent = data.streamTitle || 'Radio Xero | Al Aire';
        checkTrackOverflow();
    } catch (err) {
        console.error('Error parsing metadata', err);
    }
};

// Recalcular si se cambia el tamaño de la ventana (responsive)
window.addEventListener('resize', checkTrackOverflow);


function rxCopyLink(e, btn) {
    e.preventDefault();
    const url = 'https://jf2021070309.github.io/radio-xero/';
    navigator.clipboard.writeText(url).then(() => {
        const icon = btn.querySelector('i');
        const oldClass = icon.className;

        // Efecto visual
        btn.classList.add('success');
        icon.className = 'fas fa-check';

        // Toast flotante
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.innerText = '¡Copiado!';
        btn.appendChild(toast);

        setTimeout(() => {
            btn.classList.remove('success');
            icon.className = oldClass;
            toast.remove();
        }, 1500);
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('SW OK'))
            .catch(e => console.log('SW Error', e));
    });
}

function updateShareLinks() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let msgBody;

    if (isMobile) {
        // Versión con EMOJIS para celulares (donde funcionan bien)
        msgBody =
            "\u{1F4FB} *Radio Xero* \u{1F525}\n" +
            "\u{1F534} *EN VIVO*\n\n" +
            "\u{1F3A7} Música sin parar 24/7\n" +
            "\u26A1 Dale play y súbele al volumen\n\n" +
            "\u{1F449} ";
    } else {
        // Versión LIMPIA para PC (sin emojis para evitar errores visuales)
        msgBody =
            "*Radio Xero*\n" +
            "*EN VIVO*\n\n" +
            "Musica sin parar 24/7\n" +
            "Dale play y subele al volumen\n\n" +
            "Escuchanos aqui: ";
    }

    const shareUrl = "https://jf2021070309.github.io/radio-xero/";
    const fullMsg = encodeURIComponent(msgBody + shareUrl);

    // Botón de WhatsApp
    document.getElementById('rx-wa-btn').href = `https://wa.me/?text=${fullMsg}`;

    // Botón de Facebook
    document.getElementById('rx-fb-btn').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

    // Botón de Twitter/X
    const twText = encodeURIComponent(msgBody);
    document.getElementById('rx-tw-btn').href = `https://twitter.com/intent/tweet?text=${twText}&url=${encodeURIComponent(shareUrl)}`;
}

// --- THEME MANAGEMENT ---
function updateThemeIconsAndMeta(isDark) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    
    if (isDark) {
        icon.className = 'fas fa-moon';
        if (metaTheme) metaTheme.setAttribute('content', '#020617');
    } else {
        icon.className = 'fas fa-sun';
        if (metaTheme) metaTheme.setAttribute('content', '#f1f5f9');
    }
}

function rxToggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem('rx-theme', isDark ? 'dark' : 'light');
    updateThemeIconsAndMeta(isDark);
}

function initTheme() {
    const savedTheme = localStorage.getItem('rx-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    if (isDark) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    updateThemeIconsAndMeta(isDark);
}

window.addEventListener('load', () => {
    initTheme();
    rxSetVol(50);
    updateShareLinks();
    if (!isIosDevice) {
        setTimeout(() => { rxToggle(); }, 500);
    }
});
// --- BOTTOM NAV ACTIONS ---
function handleNav(action) {
    if (action === 'music') {
        const playerCard = document.querySelector('.player-card');
        playerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const playBtn = document.getElementById('playBtn');
        playBtn.style.transform = 'scale(1.15)';
        setTimeout(() => { playBtn.style.transform = ''; }, 300);
    } else if (action === 'follow') {
        showToast('🔥 ¡Síguenos en TikTok para no perderte nada! @radioxero');
    } else if (action === 'gift') {
        showToast('🎁 ¡Envía tus regalos durante la transmisión de TikTok Live! ❤');
    } else if (action === 'more') {
        const infoGrid = document.querySelector('.info-grid');
        infoGrid.classList.toggle('show-grid');
    }
}

function showToast(message) {
    const existing = document.querySelectorAll('.nav-toast');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'nav-toast';
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 50);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// ─── PLAYLIST DE VIDEOS DE AVATAR (ALEATORIO NO REPETITIVO) ───
const avatarVideos = [
    'avatar/video1.mp4',
    'avatar/video2.mp4',
    'avatar/video3.mp4',
    'avatar/video4.mp4'
];
let videoQueue = [];

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

let currentActiveVideo = 1;

function playNextAvatarVideo() {
    const video1 = document.getElementById('avatarVideo1');
    const video2 = document.getElementById('avatarVideo2');
    if (!video1 || !video2) return;

    const activeVideo = currentActiveVideo === 1 ? video1 : video2;
    const nextVideoEl = currentActiveVideo === 1 ? video2 : video1;

    if (videoQueue.length === 0) {
        videoQueue = shuffleArray(avatarVideos);
        const currentSrc = activeVideo.getAttribute('src');
        if (currentSrc && videoQueue[0] === currentSrc && videoQueue.length > 1) {
            [videoQueue[0], videoQueue[1]] = [videoQueue[1], videoQueue[0]];
        }
    }

    const nextSrc = videoQueue.shift();
    nextVideoEl.src = nextSrc;
    nextVideoEl.load();

    nextVideoEl.oncanplay = () => {
        nextVideoEl.oncanplay = null;
        nextVideoEl.play().then(() => {
            activeVideo.classList.remove('active');
            nextVideoEl.classList.add('active');
            currentActiveVideo = currentActiveVideo === 1 ? 2 : 1;

            setTimeout(() => {
                activeVideo.pause();
            }, 550);
        }).catch(err => {
            console.log("Fallo al reproducir video en segundo plano:", err);
            activeVideo.classList.remove('active');
            nextVideoEl.classList.add('active');
            currentActiveVideo = currentActiveVideo === 1 ? 2 : 1;
        });
    };
}

const v1 = document.getElementById('avatarVideo1');
const v2 = document.getElementById('avatarVideo2');
if (v1 && v2) {
    v1.addEventListener('ended', playNextAvatarVideo);
    v2.addEventListener('ended', playNextAvatarVideo);
    
    if (videoQueue.length === 0) {
        videoQueue = shuffleArray(avatarVideos);
    }
    const firstSrc = videoQueue.shift();
    v1.src = firstSrc;
    v1.load();
    v1.play().catch(err => {
        console.log("Auto-play de primer video bloqueado:", err);
    });
}

// ─── EFECTOS DE LUCES NEÓN 80s REACTIVAS A LA MÚSICA ───
function updateNeonGlow(value) {
    const logo = document.querySelector('.rx-small-logo');
    if (!logo || !isPlaying) return;

    const glowVal = (value / 255) * 16;
    const glowWideVal = (value / 255) * 35;

    logo.style.setProperty('--audio-glow', `${glowVal}px`);
    logo.style.setProperty('--audio-glow-wide', `${glowWideVal}px`);
}

function syncLogoState() {
    const logo = document.querySelector('.rx-small-logo');
    if (logo) {
        if (isPlaying) {
            logo.classList.remove('is-paused');
        } else {
            logo.classList.add('is-paused');
            logo.style.setProperty('--audio-glow', '0px');
            logo.style.setProperty('--audio-glow-wide', '0px');
        }
    }
}

// Sincronizar estado inicial
syncLogoState();

// Inicialización final
setVizMode(currentVizMode);

// ─── INTEGRACIÓN DE ALERTAS DE REGALOS EN VIVO CON TIKTOK ───
let GIFT_VIDEO_MAP = {};

async function loadAlertsConfig() {
    try {
        const res = await fetch('/api/alerts-config');
        if (!res.ok) throw new Error('No se pudo obtener la configuración del servidor');
        const configData = await res.json();
        
        GIFT_VIDEO_MAP = {};
        
        configData.forEach(item => {
            const name = item.giftName.toLowerCase().trim();
            GIFT_VIDEO_MAP[name] = item.videoUrl;
        });
        console.log('✅ Configuración de alertas cargada dinámicamente:', GIFT_VIDEO_MAP);
    } catch (e) {
        console.warn('Usando configuración de alertas por defecto:', e);
        // Configuración por defecto
        GIFT_VIDEO_MAP = {
            'rose': 'gifts/videos/rosa.mp4',
            'ice cream cone': 'gifts/videos/helado.mp4',
            'tiktok': 'gifts/videos/tiktok.mp4',
            'wink wink': 'gifts/videos/wink wink.mp4',
            'glow stick': 'gifts/videos/glow stick.mp4',
            'pop': 'gifts/videos/pop.mp4',
            'oldies': 'gifts/videos/oldies.mp4',
            'love you so much': 'gifts/videos/Love you so much.mp4'
        };
    }
}

// Cargar configuración inicialmente
loadAlertsConfig();

const giftQueue = [];
let isProcessingGift = false;

const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

function queueGiftAlert(username, giftName, profilePictureUrl, repeatCount) {
    const cleanName = giftName.toLowerCase().trim();
    const videoUrl = GIFT_VIDEO_MAP[cleanName];
    
    // Si no está mapeado a un video, lo ignoramos para no interrumpir
    if (!videoUrl) {
        console.log(`Regalo ignorado (sin video configurado): ${giftName}`);
        return;
    }

    giftQueue.push({ username, giftName, videoUrl, profilePictureUrl, repeatCount });
    processNextGift();
}

function processNextGift() {
    if (isProcessingGift || giftQueue.length === 0) return;

    isProcessingGift = true;
    const alert = giftQueue.shift();

    const overlayEl = document.getElementById('liveAlertOverlay');
    const videoEl = document.getElementById('alertOverlayVideo');
    const textEl = document.getElementById('alertOverlayText');
    const avatarEl = document.getElementById('alertOverlayAvatar');
    const userEl = document.getElementById('alertOverlayUser');
    const msgEl = document.getElementById('alertOverlayMsg');

    if (!overlayEl || !videoEl) {
        isProcessingGift = false;
        processNextGift();
        return;
    }

    // Configurar video
    videoEl.src = alert.videoUrl;
    videoEl.muted = true; // Garantizar Autoplay
    
    // Configurar foto de perfil
    if (avatarEl) {
        avatarEl.src = alert.profilePictureUrl || defaultAvatar;
        // Si la imagen falla en cargar, poner el default avatar
        avatarEl.onerror = () => {
            avatarEl.src = defaultAvatar;
            avatarEl.onerror = null;
        };
    }
    
    // Configurar nombre de usuario
    if (userEl) {
        userEl.textContent = `@${alert.username}`;
    }
    
    // Configurar mensaje de agradecimiento interactivo
    if (msgEl) {
        const count = alert.repeatCount || 1;
        const normalizedGiftName = alert.giftName.charAt(0).toUpperCase() + alert.giftName.slice(1);
        msgEl.innerHTML = `¡Muchas gracias por el regalo!<br><span>${count}x ${normalizedGiftName}</span>`;
    }
    
    // Texto de respaldo clásico
    if (textEl) {
        const displayGift = alert.giftName.toUpperCase();
        textEl.innerHTML = `@${alert.username} <span>TE ENVIÓ UN REGALO: ${displayGift}!</span>`;
    }

    // Activar overlay (animación de entrada por CSS)
    overlayEl.classList.add('active');

    // Cargar y reproducir
    videoEl.load();
    videoEl.play().catch(e => {
        console.warn('Fallo al reproducir video en el overlay:', e);
        setTimeout(() => finishAlert(overlayEl, videoEl, textEl), 2000);
    });

    // Finalizar cuando acabe el video
    videoEl.onended = () => {
        finishAlert(overlayEl, videoEl, textEl);
    };

    // Tiempo de seguridad
    videoEl._safetyTimeout = setTimeout(() => {
        if (isProcessingGift && overlayEl.classList.contains('active')) {
            finishAlert(overlayEl, videoEl, textEl);
        }
    }, 11000); // Límite de 11 segundos
}

function finishAlert(overlayEl, videoEl, textEl) {
    if (videoEl._safetyTimeout) {
        clearTimeout(videoEl._safetyTimeout);
        videoEl._safetyTimeout = null;
    }

    // Quitar clase activa para la animación de salida
    overlayEl.classList.remove('active');
    
    // Esperar a que termine la animación (400ms) para limpiar contenidos y seguir con la cola
    setTimeout(() => {
        videoEl.src = '';
        textEl.innerHTML = '';
        isProcessingGift = false;
        processNextGift();
    }, 450);
}

// Conectar con el servidor Socket.io local
if (typeof io !== 'undefined') {
    const socket = io('http://localhost:3000');

    socket.on('connect', () => {
        console.log('✅ Conectado al servidor local de alertas de TikTok');
        showToast('🔗 Alertas de TikTok activas');
    });

    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor local de alertas');
    });

    socket.on('gift', (data) => {
        queueGiftAlert(data.username, data.giftName, data.profilePictureUrl, data.repeatCount);
        
        // Actualizar ticker de último regalo
        const tickerGiftUser = document.getElementById('tickerGiftUser');
        if (tickerGiftUser) {
            tickerGiftUser.innerHTML = `<span class="text-pink">@${data.username}</span> (${data.repeatCount}x ${data.giftName})`;
        }
        
        // Calcular y actualizar Top Donante dinámico
        const cleanGift = data.giftName.toLowerCase().trim();
        const coins = (GIFT_COIN_VALUES[cleanGift] || 1) * (data.repeatCount || 1);
        if (!donorTotals[data.username]) donorTotals[data.username] = 0;
        donorTotals[data.username] += coins;
        
        if (donorTotals[data.username] > topDonorCoins) {
            topDonorCoins = donorTotals[data.username];
            topDonorUser = data.username;
            const tickerTopUser = document.getElementById('tickerTopUser');
            if (tickerTopUser) {
                tickerTopUser.innerHTML = `<span class="text-yellow">@${topDonorUser}</span> (${topDonorCoins} 🪙)`;
            }
        }
    });

    socket.on('follow', (data) => {
        const tickerFollowUser = document.getElementById('tickerFollowUser');
        if (tickerFollowUser) {
            tickerFollowUser.innerHTML = `<span class="text-cyan">@${data.username}</span>`;
        }
        showToast(`👤 @${data.username} te empezó a seguir!`);
    });

    socket.on('chat', (data) => {
        handleChatCommand(data.username, data.comment);
    });

    socket.on('config_updated', () => {
        console.log('🔄 Actualización de configuración recibida del servidor...');
        loadAlertsConfig();
    });

    socket.on('server_status', (data) => {
        console.log('Conectado a TikTok para:', data.tiktokUsername);
    });
}

// ─── LÓGICA DE CONTROL POR CHAT Y TICKER EN VIVO ───

// Cambiar color de luces principal del tema
function changeThemePrimaryColor(hexColor, colorName) {
    document.documentElement.style.setProperty('--primary', hexColor);
    
    // Calcular color de brillo translúcido
    let r = 237, g = 28, b = 36;
    if (hexColor.startsWith('#')) {
        const hex = hexColor.slice(1);
        if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        }
    }
    document.documentElement.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.2)`);
    
    // Actualizar fondo del slider si estuviera visible
    const slider = document.getElementById('volSlider');
    if (slider) {
        const v = slider.value;
        slider.style.background = `linear-gradient(to right, var(--primary) ${v}%, var(--primary-glow) ${v}%)`;
    }
}

// Manejar comandos del chat de TikTok
function handleChatCommand(username, comment) {
    if (!comment) return;
    
    const text = comment.trim();
    if (!text.startsWith('!')) return; // Solo procesar comandos
    
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').toLowerCase().trim();
    
    console.log(`🤖 Comando recibido de @${username}: ${command} ${arg}`);
    
    if (command === '!visualizador' || command === '!viz') {
        if (['led', 'bars', 'wave'].includes(arg)) {
            setVizMode(arg);
            showToast(`🎮 @${username} cambió el visualizador a: ${arg.toUpperCase()}`);
        }
    } 
    else if (command === '!color') {
        const colorMap = {
            'rojo': '#ef4444',
            'red': '#ef4444',
            'azul': '#3b82f6',
            'blue': '#3b82f6',
            'verde': '#22c55e',
            'green': '#22c55e',
            'rosa': '#ff0050',
            'pink': '#ff0050',
            'morado': '#8b5cf6',
            'purple': '#8b5cf6',
            'amarillo': '#eab308',
            'yellow': '#eab308',
            'celeste': '#06b6d4',
            'cyan': '#00f0ff',
            'neon': '#00f0ff'
        };
        
        const targetColor = colorMap[arg];
        if (targetColor) {
            changeThemePrimaryColor(targetColor, arg);
            showToast(`🌈 @${username} cambió el color de luces a: ${arg.toUpperCase()}`);
        }
    }
    else if (command === '!tema') {
        if (arg === 'oscuro' || arg === 'dark') {
            document.body.classList.add('dark-theme');
            localStorage.setItem('rx-theme', 'dark');
            updateThemeIconsAndMeta(true);
            showToast(`🌓 @${username} activó el Tema Oscuro`);
        } else if (arg === 'claro' || arg === 'light') {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('rx-theme', 'light');
            updateThemeIconsAndMeta(false);
            showToast(`🌓 @${username} activó el Tema Claro`);
        }
    }
}

// Rotación del ticker cada 4 segundos
let currentTickerIndex = 0;
function rotateTicker() {
    const items = document.querySelectorAll('.rx-ticker-item');
    if (items.length === 0) return;
    
    items.forEach((item, index) => {
        if (index === currentTickerIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    currentTickerIndex = (currentTickerIndex + 1) % items.length;
}
setInterval(rotateTicker, 4000);

// Cálculo del Top Donador dinámico
let topDonorUser = '';
let topDonorCoins = 0;
const GIFT_COIN_VALUES = {
    'rose': 1,
    'ice cream cone': 1,
    'tiktok': 1,
    'wink wink': 5,
    'glow stick': 5,
    'pop': 5,
    'oldies': 5,
    'love you so much': 10
};
const donorTotals = {};

