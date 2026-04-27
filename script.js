const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const overlay = document.getElementById('overlay');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

// ─── YouTube Player ───────────────────────────────────────────────────────────
let ytPlayer = null;
let ytReady = false;

window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('yt-player', {
    videoId: 'DzYp5uqixz0',
    playerVars: {
      autoplay: 0,
      loop: 1,
      playlist: 'DzYp5uqixz0',
      controls: 0,
      disablekb: 1,
    },
    events: {
      onReady: () => { ytReady = true; },
    },
  });
};

function playMusic() {
  if (ytReady && ytPlayer && ytPlayer.playVideo) {
    ytPlayer.setVolume(60);
    ytPlayer.playVideo();
  }
}

function stopMusic() {
  if (ytReady && ytPlayer && ytPlayer.pauseVideo) {
    ytPlayer.pauseVideo();
  }
}

// ─── Background nebulae (static positions, animated via time) ────────────────
const BG_ORBS = Array.from({ length: 14 }, (_, i) => ({
  x: Math.random(),
  y: Math.random(),
  r: 60 + Math.random() * 120,
  hue: [160, 190, 280, 320, 140][i % 5],
  speed: 0.0003 + Math.random() * 0.0004,
  phase: Math.random() * Math.PI * 2,
}));

// Moving microbe-like blobs in background
const BG_CELLS = Array.from({ length: 22 }, () => ({
  x: Math.random() * 900,
  y: Math.random() * 600,
  r: 8 + Math.random() * 18,
  vx: (Math.random() - 0.5) * 0.25,
  vy: (Math.random() - 0.5) * 0.25,
  hue: [160, 190, 280, 120][Math.floor(Math.random() * 4)],
  alpha: 0.04 + Math.random() * 0.07,
  pulse: Math.random() * Math.PI * 2,
}));

// ─── Game State ───────────────────────────────────────────────────────────────
const state = {
  score: 0,
  lives: 3,
  running: false,
  entities: [],
  trails: [],
  particles: [],
  shakeAmount: 0,
  bottleHitFlash: 0,
  lastSpawn: 0,
  spawnInterval: 1000,
  pointer: { x: 0, y: 0, active: false },
  time: 0,
};

const germColors = ['#39ff6e','#00f5ff','#ff2d78','#b44fff','#f7ff00','#ff8c00','#40e0ff','#7fff00'];
const dettolColor = '#9fd2b7';
const chocolateColor = '#6b4c3a';

function rand(min, max) { return Math.random() * (max - min) + min; }

// ─── Particles ────────────────────────────────────────────────────────────────
function createParticles(x, y, type, color) {
  const count = type === 'germ' ? 10 : 5;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.4, 0.4);
    const speed = type === 'germ' ? rand(3, 6) : rand(2, 4);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: rand(3, 9),
      alpha: 1,
      color: type === 'germ' ? color : '#ff6b6b',
      life: 0.7,
      maxLife: 0.7,
    });
  }
}

// ─── Entity creation ──────────────────────────────────────────────────────────
function createEntity() {
  const chocolateChance = Math.random() < 0.005; // Reduced from 0.01 to 0.005 (0.5%)
  const isDettol = !chocolateChance && Math.random() < 0.24;
  const radius = isDettol ? rand(24, 34) : chocolateChance ? rand(18, 26) : rand(20, 32);
  const x = rand(radius, canvas.width - radius);
  let type = 'germ', color = germColors[Math.floor(rand(0, germColors.length))];
  if (isDettol) { type = 'dettol'; color = dettolColor; }
  else if (chocolateChance) { type = 'chocolate'; color = chocolateColor; }

  return {
    x, y: canvas.height + radius,
    vx: rand(-0.9, 0.9),
    vy: rand(-12.5, -15.5), // Increased speed: was -11.5 to -14.0
    radius, type,
    rotation: rand(0, Math.PI * 2),
    angularVelocity: rand(-0.04, 0.04),
    color, sliced: false,
    glowPhase: Math.random() * Math.PI * 2,
  };
}

// ─── Pop sound ────────────────────────────────────────────────────────────────
function playPop(freq = 460) {
  try {
    const pop = new (window.AudioContext || window.webkitAudioContext)();
    const osc = pop.createOscillator();
    const gain = pop.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, pop.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, pop.currentTime + 0.1);
    osc.connect(gain).connect(pop.destination);
    osc.start();
    osc.stop(pop.currentTime + 0.12);
    setTimeout(() => pop.close(), 200);
  } catch (e) {}
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function startGame() {
  state.score = 0; state.lives = 3;
  state.entities = []; state.trails = []; state.particles = [];
  state.shakeAmount = 0; state.bottleHitFlash = 0;
  state.lastSpawn = 0; state.spawnInterval = 1500;
  state.running = true; state.time = 0;
  overlay.style.display = 'none';
  scoreEl.textContent = 0;
  livesEl.textContent = 3;
  playMusic();
  requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  stopMusic();
  overlay.style.display = 'grid';
  overlay.querySelector('h1').textContent = 'Game Over';
  overlay.querySelector('p').textContent = `You scored ${state.score} points!`;
  startButton.textContent = '▶ Play Again';
}

function winGame() {
  state.running = false;
  stopMusic();
  overlay.style.display = 'grid';
  overlay.querySelector('h1').textContent = '🎉 You Win!';
  overlay.querySelector('p').textContent = `You reached ${state.score} points!`;
  startButton.textContent = '▶ Play Again';
  
  // Celebration confetti
  for (let i = 0; i < 50; i++) {
    state.particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      vx: (Math.random() - 0.5) * 8,
      vy: -(Math.random() * 6 + 4),
      radius: Math.random() * 6 + 2,
      alpha: 1,
      color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b'][Math.floor(Math.random() * 6)],
      type: 'confetti',
      life: 3,
      maxLife: 3,
    });
  }
}

function addTrail(x, y) {
  state.trails.push({ x, y, alpha: 0.9, radius: 16 });
  if (state.trails.length > 24) state.trails.shift();
}

function sliceEntity(entity) {
  entity.sliced = true;
  if (entity.type === 'germ') {
    state.score += 1;
    createParticles(entity.x, entity.y, 'germ', entity.color);
    playPop(400 + Math.random() * 200);
  } else if (entity.type === 'chocolate') {
    state.score += 5;
    state.lives += 1;
    createParticles(entity.x, entity.y, 'chocolate', '#d4a574');
    playPop(600);
  } else {
    state.lives -= 1;
    state.shakeAmount = 10;
    state.bottleHitFlash = 0.7;
    createParticles(entity.x, entity.y, 'bottle', '#ff2d78');
    if (state.lives <= 0) { endGame(); return; }
  }
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  
  if (state.score >= 10) {
    winGame();
  }
}

function handleInteraction(x, y) {
  addTrail(x, y);
  state.entities.forEach(e => {
    if (e.sliced) return;
    if (Math.hypot(e.x - x, e.y - y) < e.radius + 18) sliceEntity(e);
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(delta) {
  if (!state.running) return;
  state.time += delta * 0.001;

  // Update background cells
  BG_CELLS.forEach(c => {
    c.x += c.vx;
    c.y += c.vy;
    c.pulse += 0.02;
    if (c.x < -50) c.x = canvas.width + 50;
    if (c.x > canvas.width + 50) c.x = -50;
    if (c.y < -50) c.y = canvas.height + 50;
    if (c.y > canvas.height + 50) c.y = -50;
  });

  state.lastSpawn += delta;
  if (state.lastSpawn > state.spawnInterval) {
    state.entities.push(createEntity());
    state.lastSpawn = 0;
    state.spawnInterval = Math.max(700, state.spawnInterval - 4);
  }

  state.entities.forEach(e => {
    e.vy += 0.18;
    e.x += e.vx;
    e.y += e.vy;
    e.rotation += e.angularVelocity;
    e.glowPhase += 0.05;
    if (e.x < e.radius || e.x > canvas.width - e.radius) e.vx *= -0.9;
  });

  state.entities = state.entities.filter(e => {
    if (e.sliced) return false;
    if (e.y - e.radius > canvas.height) {
      if (e.type === 'germ') {
        state.lives -= 1;
        livesEl.textContent = state.lives;
        if (state.lives <= 0) endGame();
      }
      return false;
    }
    return true;
  });

  state.trails.forEach(t => { t.alpha -= 0.04; t.radius += 0.5; });
  state.trails = state.trails.filter(t => t.alpha > 0);

  state.particles.forEach(p => {
    if (p.type === 'confetti') {
      p.vy += 0.08; // Slower gravity for confetti
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.008; // Slower fade
    } else {
      p.vy += 0.15; p.x += p.vx; p.y += p.vy;
      p.life -= 0.016;
    }
    p.alpha = Math.max(0, p.life / p.maxLife);
  });
  state.particles = state.particles.filter(p => p.life > 0);

  state.shakeAmount *= 0.9;
  state.bottleHitFlash = Math.max(0, state.bottleHitFlash - 0.04);
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  const sx = (Math.random() - 0.5) * state.shakeAmount;
  const sy = (Math.random() - 0.5) * state.shakeAmount;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.clearRect(-sx, -sy, canvas.width, canvas.height);

  // ── Deep space base ──
  ctx.fillStyle = '#050d1a';
  ctx.fillRect(-sx, -sy, canvas.width, canvas.height);

  // ── Animated radial nebulae ──
  BG_ORBS.forEach(orb => {
    const pulse = Math.sin(state.time * orb.speed * 6283 + orb.phase) * 0.3 + 0.7;
    const grd = ctx.createRadialGradient(
      orb.x * canvas.width, orb.y * canvas.height, 0,
      orb.x * canvas.width, orb.y * canvas.height, orb.r * pulse
    );
    grd.addColorStop(0, `hsla(${orb.hue}, 100%, 60%, 0.12)`);
    grd.addColorStop(1, `hsla(${orb.hue}, 100%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(orb.x * canvas.width, orb.y * canvas.height, orb.r * pulse, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Floating microbe blobs (background) ──
  BG_CELLS.forEach(c => {
    const pr = c.r * (1 + 0.15 * Math.sin(c.pulse));
    const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, pr);
    grd.addColorStop(0, `hsla(${c.hue}, 100%, 65%, ${c.alpha * 1.5})`);
    grd.addColorStop(1, `hsla(${c.hue}, 100%, 50%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(c.x, c.y, pr, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Grid lines (petri dish feel) ──
  ctx.strokeStyle = 'rgba(0,245,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // ── Danger tint when low lives ──
  if (state.lives <= 2) {
    ctx.fillStyle = `rgba(255, 45, 120, ${0.12 * (3 - state.lives)})`;
    ctx.fillRect(-sx, -sy, canvas.width, canvas.height);
  }

  // ── Slice trails ──
  state.trails.forEach(t => {
    const grd = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.radius);
    grd.addColorStop(0, `rgba(0,245,255,${t.alpha * 0.8})`);
    grd.addColorStop(1, `rgba(57,255,110,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Entities ──
  state.entities.forEach(entity => {
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity.rotation);

    const glow = 6 + 4 * Math.sin(entity.glowPhase);

    if (entity.type === 'dettol') {
      const bh = entity.radius * 1.5, bw = entity.radius * 0.95;
      // Glow halo
      ctx.shadowColor = 'rgba(255,45,120,0.7)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = entity.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-bw/2, -bh/2, bw, bh, entity.radius * 0.18);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f8fbfc';
      ctx.fillRect(-bw/2+3, -bh/2+4, bw-6, bh*0.3);
      ctx.fillStyle = '#2a524a';
      ctx.font = `bold ${Math.max(10, entity.radius * 0.35)}px Nunito`;
      ctx.textAlign = 'center';
      ctx.fillText('Dettol', 0, -bh*0.04);
      ctx.fillStyle = '#ddeee8';
      ctx.fillRect(-bw/6, bh*0.2, bw/3, bh*0.14);

    } else if (entity.type === 'chocolate') {
      const bw = entity.radius * 1.4, bh = entity.radius * 0.9;
      ctx.shadowColor = 'rgba(255,180,80,0.5)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = entity.color;
      ctx.fillRect(-bw/2, -bh/2, bw, bh);
      ctx.strokeStyle = '#3a200f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-bw/2, -bh/2, bw, bh);
      ctx.shadowBlur = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const px = -bw/2 + (bw/4)*c + bw/8;
          const py = -bh/2 + (bh/3)*r + bh/6;
          ctx.fillStyle = '#8b6a47';
          ctx.fillRect(px - bw/12, py - bh/10, bw/6, bh/5);
        }
      }

    } else {
      // Germ – glowing neon circle with spikes
      ctx.shadowColor = entity.color;
      ctx.shadowBlur = glow + 8;
      ctx.fillStyle = entity.color;
      ctx.beginPath();
      ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Spiky protrusions
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const pr = entity.radius + 9 + 3 * Math.sin(entity.glowPhase + i);
        const px = Math.cos(angle) * pr;
        const py = Math.sin(angle) * pr;
        ctx.fillStyle = entity.color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(px, py, entity.radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Eyes
      const ed = entity.radius * 0.35, es = entity.radius * 0.24;
      ctx.fillStyle = '#001a06';
      ctx.beginPath(); ctx.arc(-ed, -entity.radius*0.2, es, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ed, -entity.radius*0.2, es, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-ed-es*0.3, -entity.radius*0.26, es*0.38, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ed-es*0.3, -entity.radius*0.26, es*0.38, 0, Math.PI*2); ctx.fill();

      // Mouth
      ctx.fillStyle = '#c0003a';
      ctx.beginPath();
      ctx.moveTo(-entity.radius*0.38, entity.radius*0.15);
      ctx.lineTo(entity.radius*0.38, entity.radius*0.15);
      ctx.lineTo(entity.radius*0.32, entity.radius*0.35);
      ctx.lineTo(entity.radius*0.14, entity.radius*0.35);
      ctx.lineTo(0, entity.radius*0.27);
      ctx.lineTo(-entity.radius*0.14, entity.radius*0.35);
      ctx.lineTo(-entity.radius*0.32, entity.radius*0.35);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  });

  // ── Particles ──
  state.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // ── Hit flash ──
  if (state.bottleHitFlash > 0) {
    ctx.fillStyle = `rgba(255, 45, 120, ${0.35 * state.bottleHitFlash})`;
    ctx.fillRect(-sx, -sy, canvas.width, canvas.height);
  }

  ctx.restore();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(timestamp) {
  if (!state.running) return;
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

// ─── Input ────────────────────────────────────────────────────────────────────
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// Prevent browser navigation and scrolling
document.addEventListener('touchstart', e => {
  if (e.target === canvas || canvas.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchmove', e => {
  if (e.target === canvas || canvas.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', e => {
  if (e.target === canvas || canvas.contains(e.target)) {
    e.preventDefault();
  }
}, { passive: false });

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  state.pointer.active = true;
  const coords = getCanvasCoords(e);
  handleInteraction(coords.x, coords.y);
});
canvas.addEventListener('pointermove', e => {
  e.preventDefault();
  if (!state.pointer.active) return;
  const coords = getCanvasCoords(e);
  handleInteraction(coords.x, coords.y);
});
canvas.addEventListener('pointerup', e => {
  e.preventDefault();
  state.pointer.active = false;
});

// Touch events for better mobile support
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  state.pointer.active = true;
  const touch = e.touches[0];
  const coords = getCanvasCoords(touch);
  handleInteraction(coords.x, coords.y);
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!state.pointer.active) return;
  const touch = e.touches[0];
  const coords = getCanvasCoords(touch);
  handleInteraction(coords.x, coords.y);
});
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  state.pointer.active = false;
});

startButton.addEventListener('click', startGame);
