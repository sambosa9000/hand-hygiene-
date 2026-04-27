// ─── DOM Elements ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('startButton');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

// ─── Game State ───────────────────────────────────────────────────────────────
let state = {
  score: 0,
  lives: 3,
  entities: [],
  particles: [],
  running: false,
  time: 0,
  lastSpawn: 0,
  spawnInterval: 1000,
};

// ─── Colors and Constants ─────────────────────────────────────────────────────
const germColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'];
const dettolColor = '#9fd2b7';
const chocolateColor = '#6b4c3a';

// ─── Utility Functions ────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }

// ─── Particles ────────────────────────────────────────────────────────────────
function createParticles(x, y, type, color) {
  if (state.particles.length > 80) return;

  const count = type === 'germ' ? 6 : 3;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.4, 0.4);
    const speed = type === 'germ' ? rand(2, 4) : rand(1.5, 3);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: rand(2, 6),
      alpha: 1,
      color: type === 'germ' ? color : '#ff6b6b',
      life: 0.5,
      maxLife: 0.5,
    });
  }
}

// ─── Entity creation ──────────────────────────────────────────────────────────
function createEntity() {
  const chocolateChance = Math.random() < 0.005;
  const isDettol = !chocolateChance && Math.random() < 0.24;
  const radius = isDettol ? rand(24, 34) : chocolateChance ? rand(18, 26) : rand(20, 32);
  const x = rand(radius, canvas.width - radius);
  let type = 'germ', color = germColors[Math.floor(rand(0, germColors.length))];
  if (isDettol) { type = 'dettol'; color = dettolColor; }
  else if (chocolateChance) { type = 'chocolate'; color = chocolateColor; }

  return {
    x, y: canvas.height + radius, // Spawn from below the screen
    vx: rand(-0.9, 0.9),
    vy: rand(-11.5, -14.0), // Original speed (before 25% increase)
    radius, type,
    rotation: rand(0, Math.PI * 2),
    angularVelocity: rand(-0.04, 0.04),
    color, sliced: false,
    glowPhase: Math.random() * Math.PI * 2,
  };
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
function startGame() {
  state.score = 0; state.lives = 3;
  state.entities = []; state.particles = [];
  state.running = true; state.time = 0;
  state.lastSpawn = 0; state.spawnInterval = 1000;
  overlay.style.display = 'none';
  scoreEl.textContent = 0;
  livesEl.textContent = 3;
  requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  overlay.style.display = 'grid';
  overlay.querySelector('h1').textContent = 'Game Over';
  overlay.querySelector('p').textContent = `You scored ${state.score} points!`;
  startButton.textContent = '▶ Play Again';
}

function winGame() {
  state.running = false;
  overlay.style.display = 'grid';
  overlay.querySelector('h1').textContent = '🎉 You Win!';
  overlay.querySelector('p').textContent = `You reached ${state.score} points!`;
  startButton.textContent = '▶ Play Again';
}

function sliceEntity(entity) {
  entity.sliced = true;
  if (entity.type === 'germ') {
    state.score += 1;
    createParticles(entity.x, entity.y, 'germ', entity.color);
  } else if (entity.type === 'chocolate') {
    state.score += 5;
    state.lives += 1;
    createParticles(entity.x, entity.y, 'chocolate', '#d4a574');
  } else {
    state.lives -= 1;
    createParticles(entity.x, entity.y, 'bottle', '#ff2d78');
    if (state.lives <= 0) { endGame(); return; }
  }
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;

  if (state.score >= 10) { // Reverted target back to 10
    winGame();
  }
}

function update(delta) {
  if (!state.running) return;
  state.time += delta * 0.001;

  state.lastSpawn += delta;
  if (state.lastSpawn > state.spawnInterval) {
    state.entities.push(createEntity());
    state.lastSpawn = 0;
    state.spawnInterval = Math.max(700, state.spawnInterval - 4);
  }

  state.entities.forEach(e => {
    e.vy += 0.18; // Gravity - eventually makes them fall back down
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

  state.particles.forEach(p => {
    p.vy += 0.15; p.x += p.vx; p.y += p.vy;
    p.life -= 0.025;
    p.alpha = Math.max(0, p.life / p.maxLife);
  });
  state.particles = state.particles.filter(p => p.life > 0);
}

// ─── Rendering ───────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = '#050d1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = 'rgba(0,245,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 90) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Entities
  state.entities.forEach(entity => {
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity.rotation);

    if (entity.type === 'dettol') {
      const bh = entity.radius * 1.5, bw = entity.radius * 0.95;
      ctx.fillStyle = entity.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-bw/2, -bh/2, bw, bh, entity.radius * 0.18);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f8fbfc';
      ctx.fillRect(-bw/2+3, -bh/2+4, bw-6, bh*0.3);
      ctx.fillStyle = '#2a524a';
      ctx.font = `bold ${Math.max(10, entity.radius * 0.35)}px Nunito`;
      ctx.textAlign = 'center';
      ctx.fillText('Dettol', 0, -bh*0.04);
    } else if (entity.type === 'chocolate') {
      const bw = entity.radius * 1.4, bh = entity.radius * 0.9;
      ctx.fillStyle = entity.color;
      ctx.fillRect(-bw/2, -bh/2, bw, bh);
      ctx.strokeStyle = '#3a200f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-bw/2, -bh/2, bw, bh);
    } else {
      // Germ
      ctx.shadowColor = entity.color;
      ctx.shadowBlur = 8;
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

  // Particles
  state.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 4;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── Game Loop ───────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(timestamp) {
  if (!state.running) return;
  const delta = Math.min(timestamp - lastTime, 33);
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

// ─── Input Handling ──────────────────────────────────────────────────────────
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function handleInteraction(x, y) {
  for (let i = state.entities.length - 1; i >= 0; i--) {
    const entity = state.entities[i];
    if (entity.sliced) continue;

    const dx = x - entity.x;
    const dy = y - entity.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < entity.radius) {
      sliceEntity(entity);
      return;
    }
  }
}

// Event listeners
startButton.addEventListener('click', startGame);

canvas.addEventListener('mousedown', e => {
  if (!state.running) return;
  const coords = getCanvasCoords(e);
  handleInteraction(coords.x, coords.y);
});

canvas.addEventListener('pointerdown', e => {
  if (!state.running) return;
  e.preventDefault();
  const coords = getCanvasCoords(e);
  handleInteraction(coords.x, coords.y);
});

// Prevent browser navigation
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