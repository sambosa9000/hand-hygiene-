// ─── Canvas: fills full viewport ─────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

function resizeCanvas() {
  const vp = window.visualViewport;
  canvas.width  = vp ? vp.width  : window.innerWidth;
  canvas.height = vp ? vp.height : window.innerHeight;
}
resizeCanvas();
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
} else {
  window.addEventListener('resize', resizeCanvas);
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const overlay     = document.getElementById('overlay');
const winOverlay  = document.getElementById('winOverlay');
const loseOverlay = document.getElementById('loseOverlay');
const scoreEl     = document.getElementById('score');
const livesEl     = document.getElementById('lives');
const progressFill  = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');

const WIN_TARGET = 10;

function updateProgress() {
  const pct = Math.min(state.score / WIN_TARGET * 100, 100);
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `${Math.min(state.score, WIN_TARGET)} / ${WIN_TARGET}`;
}

// ─── Chill ambient music ──────────────────────────────────────────────────────
let musicCtx = null;

function startMusic() {
  if (musicCtx) { musicCtx.resume(); return; }
  try {
    musicCtx = new (window.AudioContext || window.webkitAudioContext)();
    const master = musicCtx.createGain();
    master.gain.setValueAtTime(0, musicCtx.currentTime);
    master.gain.linearRampToValueAtTime(0.16, musicCtx.currentTime + 3);
    master.connect(musicCtx.destination);

    // Reverb
    const conv = musicCtx.createConvolver();
    const len = musicCtx.sampleRate * 2.5;
    const buf = musicCtx.createBuffer(2, len, musicCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2.4);
    }
    conv.buffer = buf;
    const revGain = musicCtx.createGain();
    revGain.gain.value = 0.35;
    conv.connect(revGain); revGain.connect(master);

    // Pad chords (Cm pentatonic: C3 Eb3 G3 Bb3 C4)
    [130.81, 155.56, 196.00, 233.08, 261.63].forEach((freq, i) => {
      const osc = musicCtx.createOscillator();
      const g   = musicCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * 4;
      g.gain.value = 0.055;
      osc.connect(g); g.connect(master); g.connect(conv);
      osc.start();
    });

    // Slow LFO vibrato
    const lfo = musicCtx.createOscillator();
    const lfoG = musicCtx.createGain();
    lfo.frequency.value = 0.14; lfoG.gain.value = 3;
    lfo.connect(lfoG); lfo.start();

    // Bass drone C2
    const bass = musicCtx.createOscillator();
    const bassG = musicCtx.createGain();
    bass.type = 'triangle'; bass.frequency.value = 65.41;
    bassG.gain.value = 0.08;
    bass.connect(bassG); bassG.connect(master); bass.start();

    // Arp melody
    const arpNotes = [261.63, 311.13, 392.00, 466.16, 523.25, 392.00, 311.13, 261.63];
    let idx = 0;
    function arp() {
      if (!musicCtx) return;
      const t = musicCtx.currentTime;
      const o = musicCtx.createOscillator();
      const e = musicCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = arpNotes[idx++ % arpNotes.length];
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(0.05, t + 0.04);
      e.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      o.connect(e); e.connect(master); e.connect(conv);
      o.start(t); o.stop(t + 0.6);
    }
    arp();
    setInterval(arp, 620);
  } catch(e) { console.warn('Audio error', e); }
}

function stopMusic() {
  if (musicCtx) musicCtx.suspend();
}

function playPop(freq) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = freq || 440;
    g.gain.setValueAtTime(0.09, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.14);
    setTimeout(() => ac.close(), 300);
  } catch(e) {}
}

function playFreezeSound() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain(); master.gain.value = 0.12; master.connect(ac.destination);
    [600, 800, 1000].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, ac.currentTime + i*0.06);
      g.gain.linearRampToValueAtTime(0.08, ac.currentTime + i*0.06 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i*0.06 + 0.4);
      o.connect(g).connect(master);
      o.start(ac.currentTime + i*0.06);
      o.stop(ac.currentTime + i*0.06 + 0.45);
    });
    setTimeout(() => ac.close(), 800);
  } catch(e) {}
}

// ─── Background decorations ───────────────────────────────────────────────────
const BG_ORBS = Array.from({ length: 10 }, (_, i) => ({
  x: Math.random(), y: Math.random(),
  rFrac: 0.08 + Math.random() * 0.13,
  hue: [160,190,280,320,140][i % 5],
  speed: 0.0003 + Math.random() * 0.0004,
  phase: Math.random() * Math.PI * 2,
}));

const BG_CELLS = Array.from({ length: 14 }, () => ({
  xFrac: Math.random(), yFrac: Math.random(),
  rFrac: 0.007 + Math.random() * 0.016,
  vxFrac: (Math.random()-0.5)*0.00014,
  vyFrac: (Math.random()-0.5)*0.00014,
  hue: [160,190,280,120][Math.floor(Math.random()*4)],
  alpha: 0.05 + Math.random()*0.07,
  pulse: Math.random()*Math.PI*2,
}));

// ─── Game state ───────────────────────────────────────────────────────────────
const state = {
  score: 0, lives: 3,
  running: false,
  entities: [], trails: [], particles: [], confetti: [],
  shakeAmount: 0, bottleHitFlash: 0,
  lastSpawn: 0, spawnInterval: 1500,
  lastBubbleSpawn: 0,          // soap bubble timer
  frozenTimer: 0,              // >0 = all germs frozen
  freezeFlash: 0,              // brief cyan screen flash on freeze
  freezeLabel: 0,              // show "❄ FREEZE!" label
  pointer: { active: false },
  time: 0,
};

const germColors = ['#39ff6e','#00f5ff','#ff2d78','#b44fff','#f7ff00','#ff8c00','#40e0ff','#7fff00'];
const CONFETTI_COLS = ['#ff2d78','#39ff6e','#00f5ff','#f7ff00','#b44fff','#ff8c00','#ffffff'];

function rand(a, b) { return Math.random()*(b-a)+a; }
function W() { return canvas.width; }
function H() { return canvas.height; }

// ─── Entity creation ──────────────────────────────────────────────────────────
function createEntity() {
  const choc   = Math.random() < 0.01;
  const dettol = !choc && Math.random() < 0.22;
  const baseR  = Math.min(W(), H()) * 0.038;
  const radius = dettol ? baseR*1.1 : choc ? baseR*0.85 : baseR * rand(0.75, 1.25);
  const x = rand(radius, W()-radius);
  const ss = Math.min(W(), H()) / 600; // speed scale

  // ↑ Speed increased ~15% from previous build
  const vy = rand(-7.0, -9.0) * ss;

  let type = 'germ', color = germColors[Math.floor(rand(0, germColors.length))];
  if (dettol)      { type = 'dettol';    color = '#9fd2b7'; }
  else if (choc)   { type = 'chocolate'; color = '#6b4c3a'; }

  return { x, y: H()+radius, vx: rand(-1,1)*ss, vy, radius, type, color,
           rotation: rand(0, Math.PI*2), angularVelocity: rand(-0.04,0.04),
           sliced: false, glowPhase: Math.random()*Math.PI*2,
           frozenVx: 0, frozenVy: 0 };
}

// ─── Soap bubble ──────────────────────────────────────────────────────────────
function createBubble() {
  const ss = Math.min(W(),H())/600;
  const radius = Math.min(W(),H()) * 0.048;
  const x = rand(radius, W()-radius);
  return {
    x, y: H()+radius,
    vx: rand(-0.4, 0.4)*ss,
    vy: rand(-4.5, -6.0)*ss,   // floats up gently
    radius, type: 'bubble',
    rotation: 0, angularVelocity: 0.008,
    sliced: false, glowPhase: Math.random()*Math.PI*2,
    hueShift: 0,
  };
}

// ─── Particles / confetti ─────────────────────────────────────────────────────
function createParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI*2*i)/8 + rand(-0.3,0.3);
    const spd = rand(3,7);
    state.particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      r: rand(3,8), alpha:1, color, life:0.7, maxLife:0.7 });
  }
}

function createFreezeParticles() {
  for (let i = 0; i < 30; i++) {
    const x = rand(0, W()), y = rand(0, H());
    const a = rand(0, Math.PI*2), spd = rand(2,5);
    state.particles.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      r: rand(4,9), alpha:1, color: '#a0eeff', life:0.9, maxLife:0.9 });
  }
}

function spawnConfetti() {
  for (let i = 0; i < 120; i++) {
    state.confetti.push({
      x: rand(0,W()), y: rand(-H()*0.3, 0),
      vx: rand(-2,2), vy: rand(2,7),
      r: rand(4,9), rot: rand(0,Math.PI*2), rotV: rand(-0.15,0.15),
      color: CONFETTI_COLS[Math.floor(rand(0,CONFETTI_COLS.length))],
      alpha:1, life:1, maxLife:1,
      shape: Math.random()>0.5?'rect':'circle',
    });
  }
}

// ─── Game flow ────────────────────────────────────────────────────────────────
function startGame() {
  state.score = 0; state.lives = 3;
  state.entities = []; state.trails = []; state.particles = []; state.confetti = [];
  state.shakeAmount = 0; state.bottleHitFlash = 0;
  state.lastSpawn = 0; state.spawnInterval = 1500;
  state.lastBubbleSpawn = 0;
  state.frozenTimer = 0; state.freezeFlash = 0; state.freezeLabel = 0;
  state.running = true; state.time = 0;
  overlay.style.display     = 'none';
  winOverlay.style.display  = 'none';
  loseOverlay.style.display = 'none';
  scoreEl.textContent = 0; livesEl.textContent = 3;
  updateProgress();
  startMusic();
  lastTime = 0;
  requestAnimationFrame(loop);
}

function triggerWin() {
  state.running = false;
  stopMusic();
  spawnConfetti();
  document.getElementById('winScore').textContent = state.score;
  setTimeout(() => { winOverlay.style.display = 'grid'; }, 1600);
  lastTime = 0;
  requestAnimationFrame(celebLoop);
}

function triggerLose() {
  state.running = false;
  stopMusic();
  document.getElementById('loseScore').textContent = state.score;
  loseOverlay.style.display = 'grid';
}

// ─── Slice logic ──────────────────────────────────────────────────────────────
function sliceEntity(e) {
  e.sliced = true;

  if (e.type === 'bubble') {
    // FREEZE all remaining germs for 2.5 s
    state.frozenTimer = 2500;
    state.freezeFlash = 1.0;
    state.freezeLabel = 2500;
    // store current velocity so we can restore feel after freeze
    state.entities.forEach(en => {
      if (!en.sliced) { en.frozenVx = en.vx; en.frozenVy = en.vy; }
    });
    createFreezeParticles();
    playFreezeSound();
    return;
  }

  if (e.type === 'germ') {
    state.score++;
    createParticles(e.x, e.y, e.color);
    playPop(380 + Math.random()*220);
    scoreEl.textContent = state.score;
    updateProgress();
    if (state.score >= WIN_TARGET) { triggerWin(); return; }

  } else if (e.type === 'chocolate') {
    state.score += 5; state.lives = Math.min(state.lives+1, 5);
    createParticles(e.x, e.y, '#d4a574');
    playPop(600);
    scoreEl.textContent = state.score; livesEl.textContent = state.lives;
    updateProgress();
    if (state.score >= WIN_TARGET) { triggerWin(); return; }

  } else { // dettol
    state.lives--;
    state.shakeAmount = 10; state.bottleHitFlash = 0.8;
    createParticles(e.x, e.y, '#ff2d78');
    livesEl.textContent = state.lives;
    if (state.lives <= 0) { triggerLose(); return; }
  }
}

function addTrail(x, y) {
  state.trails.push({ x, y, alpha: 0.85, radius: Math.min(W(),H())*0.025 });
  if (state.trails.length > 22) state.trails.shift();
}

function handleInteraction(x, y) {
  if (!state.running) return;
  addTrail(x, y);
  state.entities.forEach(e => {
    if (e.sliced) return;
    if (Math.hypot(e.x-x, e.y-y) < e.radius+20) sliceEntity(e);
  });
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  state.time += dt * 0.001;

  // Background cells drift
  BG_CELLS.forEach(c => {
    c.xFrac += c.vxFrac; c.yFrac += c.vyFrac; c.pulse += 0.018;
    if (c.xFrac < 0) c.xFrac = 1; if (c.xFrac > 1) c.xFrac = 0;
    if (c.yFrac < 0) c.yFrac = 1; if (c.yFrac > 1) c.yFrac = 0;
  });

  // Tick freeze timer
  if (state.frozenTimer > 0) {
    state.frozenTimer  = Math.max(0, state.frozenTimer  - dt);
    state.freezeLabel  = Math.max(0, state.freezeLabel  - dt);
    state.freezeFlash  = Math.max(0, state.freezeFlash  - dt*1.8);
  }

  const frozen = state.frozenTimer > 0;

  // Spawn germs
  state.lastSpawn += dt;
  if (state.lastSpawn > state.spawnInterval) {
    state.entities.push(createEntity());
    state.lastSpawn = 0;
    state.spawnInterval = Math.max(650, state.spawnInterval - 4);
  }

  // Spawn soap bubble every ~7 s
  state.lastBubbleSpawn += dt;
  if (state.lastBubbleSpawn > 7000) {
    state.entities.push(createBubble());
    state.lastBubbleSpawn = 0;
  }

  const g = 0.07 * (H()/600);

  state.entities.forEach(e => {
    e.glowPhase += 0.05;
    if (e.type === 'bubble') {
      e.hueShift = (e.hueShift + 1.5) % 360;
      if (!frozen) {
        // Bubbles still float up even during freeze (more dramatic)
        e.vy += g * 0.25; // very weak gravity — floats
        e.x  += e.vx;
        e.y  += e.vy;
        e.rotation += e.angularVelocity;
        if (e.x < e.radius || e.x > W()-e.radius) e.vx *= -0.9;
      }
      return;
    }

    if (frozen) return; // germs/dettol are paused

    e.vy += g;
    e.x  += e.vx;
    e.y  += e.vy;
    e.rotation += e.angularVelocity;
    if (e.x < e.radius || e.x > W()-e.radius) e.vx *= -0.9;
  });

  // Filter out-of-bounds / sliced
  state.entities = state.entities.filter(e => {
    if (e.sliced) return false;
    if (e.y - e.radius > H()) {
      if (e.type === 'germ') {
        state.lives--;
        livesEl.textContent = state.lives;
        if (state.lives <= 0) triggerLose();
      }
      return false;
    }
    return true;
  });

  // Trails
  state.trails.forEach(t => { t.alpha -= 0.04; t.radius += 0.4; });
  state.trails = state.trails.filter(t => t.alpha > 0);

  // Particles
  state.particles.forEach(p => { p.vy+=0.15; p.x+=p.vx; p.y+=p.vy; p.life-=0.02; p.alpha=Math.max(0,p.life/p.maxLife); });
  state.particles = state.particles.filter(p => p.life > 0);

  state.shakeAmount    *= 0.88;
  state.bottleHitFlash  = Math.max(0, state.bottleHitFlash - 0.04);
}

function updateConfetti(dt) {
  state.confetti.forEach(c => { c.x+=c.vx; c.vy+=0.12; c.y+=c.vy; c.rot+=c.rotV; c.life-=0.005; c.alpha=Math.max(0,c.life/c.maxLife); });
  state.confetti = state.confetti.filter(c => c.life>0 && c.y<H()*1.2);
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  const frozen = state.frozenTimer > 0;
  const sx = (Math.random()-0.5)*state.shakeAmount;
  const sy = (Math.random()-0.5)*state.shakeAmount;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.clearRect(-sx, -sy, W(), H());

  // Deep space base
  ctx.fillStyle = '#050d1a';
  ctx.fillRect(-sx, -sy, W(), H());

  // Nebula orbs
  BG_ORBS.forEach(o => {
    const pulse = Math.sin(state.time*o.speed*6283+o.phase)*0.3+0.7;
    const r = Math.min(W(),H())*o.rFrac*pulse;
    const grd = ctx.createRadialGradient(o.x*W(),o.y*H(),0,o.x*W(),o.y*H(),r);
    grd.addColorStop(0, `hsla(${o.hue},100%,60%,0.11)`);
    grd.addColorStop(1, `hsla(${o.hue},100%,40%,0)`);
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(o.x*W(),o.y*H(),r,0,Math.PI*2); ctx.fill();
  });

  // Floating microbes
  BG_CELLS.forEach(c => {
    const x=c.xFrac*W(), y=c.yFrac*H();
    const r=Math.min(W(),H())*c.rFrac*(1+0.15*Math.sin(c.pulse));
    const grd=ctx.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0, `hsla(${c.hue},100%,65%,${c.alpha*1.4})`);
    grd.addColorStop(1, `hsla(${c.hue},100%,50%,0)`);
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  });

  // Grid
  ctx.strokeStyle='rgba(0,245,255,0.035)'; ctx.lineWidth=1;
  const gs=Math.min(W(),H())*0.1;
  for (let x=-sx; x<W(); x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H());ctx.stroke();}
  for (let y=-sy; y<H(); y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W(),y);ctx.stroke();}

  // Danger tint
  if (state.lives<=2) { ctx.fillStyle=`rgba(255,45,120,${0.1*(3-state.lives)})`; ctx.fillRect(-sx,-sy,W(),H()); }

  // Freeze tint + freeze label
  if (frozen) {
    ctx.fillStyle = `rgba(0,200,255,${0.12 + 0.08*Math.sin(state.time*8)})`;
    ctx.fillRect(-sx,-sy,W(),H());
  }
  if (state.freezeFlash>0) {
    ctx.fillStyle = `rgba(150,240,255,${0.35*state.freezeFlash})`;
    ctx.fillRect(-sx,-sy,W(),H());
  }
  if (state.freezeLabel > 0) {
    const alpha = Math.min(1, state.freezeLabel/400);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.min(W(),H())*0.072}px Boogaloo, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a0eeff';
    ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 20;
    ctx.fillText('❄ FREEZE!', W()/2, H()/2 - Math.min(W(),H())*0.06);
    ctx.restore();
  }

  // Trails
  state.trails.forEach(t => {
    const grd=ctx.createRadialGradient(t.x,t.y,0,t.x,t.y,t.radius);
    grd.addColorStop(0,`rgba(0,245,255,${t.alpha*0.75})`);
    grd.addColorStop(1,'rgba(57,255,110,0)');
    ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(t.x,t.y,t.radius,0,Math.PI*2); ctx.fill();
  });

  // Entities
  state.entities.forEach(e => {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rotation);
    const glow = 6+4*Math.sin(e.glowPhase);

    // Frozen shimmer on germs/dettol
    if (frozen && e.type !== 'bubble') {
      ctx.shadowColor = '#a0eeff'; ctx.shadowBlur = 14;
    }

    if (e.type === 'bubble') {
      // Iridescent soap bubble
      const r = e.radius;
      const hue = e.hueShift;
      ctx.shadowColor = `hsla(${hue},100%,70%,0.8)`; ctx.shadowBlur = 18;
      const grd = ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.05,-r*0.3,-r*0.3,r*1.4);
      grd.addColorStop(0,   `hsla(${hue},   100%,95%,0.55)`);
      grd.addColorStop(0.3, `hsla(${(hue+60)%360},100%,75%,0.18)`);
      grd.addColorStop(0.7, `hsla(${(hue+150)%360},100%,70%,0.12)`);
      grd.addColorStop(1,   `hsla(${(hue+240)%360},100%,80%,0.04)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
      // Rim highlight
      ctx.strokeStyle = `hsla(${(hue+30)%360},100%,90%,0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
      // Glare dot
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.arc(-r*0.3,-r*0.32,r*0.16,0,Math.PI*2); ctx.fill();
      // Small ❄ inside
      ctx.shadowBlur = 0;
      ctx.font = `${r*0.7}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💧', 0, r*0.06);

    } else if (e.type === 'dettol') {
      const bh=e.radius*1.5, bw=e.radius*0.95;
      if (!frozen) { ctx.shadowColor='rgba(255,45,120,0.7)'; ctx.shadowBlur=18; }
      ctx.fillStyle=e.color; ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.roundRect(-bw/2,-bh/2,bw,bh,e.radius*0.18); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0;
      ctx.fillStyle='#f8fbfc'; ctx.fillRect(-bw/2+3,-bh/2+4,bw-6,bh*0.3);
      ctx.fillStyle='#2a524a'; ctx.font=`bold ${Math.max(8,e.radius*0.32)}px Nunito`;
      ctx.textAlign='center'; ctx.fillText('Dettol',0,-bh*0.04);
      ctx.fillStyle='#ddeee8'; ctx.fillRect(-bw/6,bh*0.2,bw/3,bh*0.14);

    } else if (e.type === 'chocolate') {
      const bw=e.radius*1.4, bh=e.radius*0.9;
      if (!frozen) { ctx.shadowColor='rgba(255,180,80,0.4)'; ctx.shadowBlur=12; }
      ctx.fillStyle=e.color; ctx.fillRect(-bw/2,-bh/2,bw,bh);
      ctx.strokeStyle='#3a200f'; ctx.lineWidth=2; ctx.strokeRect(-bw/2,-bh/2,bw,bh);
      ctx.shadowBlur=0;
      for(let rr=0;rr<3;rr++) for(let cc=0;cc<4;cc++){
        const px=-bw/2+(bw/4)*cc+bw/8, py=-bh/2+(bh/3)*rr+bh/6;
        ctx.fillStyle='#8b6a47'; ctx.fillRect(px-bw/12,py-bh/10,bw/6,bh/5);
      }

    } else {
      // Germ
      if (!frozen) { ctx.shadowColor=e.color; ctx.shadowBlur=glow+8; }
      ctx.fillStyle = frozen ? `hsl(200,80%,${parseInt(e.color.replace('#',''),16)%50+50}%)` : e.color;
      ctx.beginPath(); ctx.arc(0,0,e.radius,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      for(let i=0;i<12;i++){
        const a=(Math.PI*2*i)/12;
        const pr=e.radius+8+3*Math.sin(e.glowPhase+i);
        ctx.fillStyle= frozen ? 'rgba(160,220,255,0.5)' : e.color;
        ctx.globalAlpha=0.8;
        ctx.beginPath(); ctx.arc(Math.cos(a)*pr,Math.sin(a)*pr,e.radius*0.27,0,Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha=1;
      const ed=e.radius*0.35, es=e.radius*0.24;
      ctx.fillStyle='#001a06';
      ctx.beginPath(); ctx.arc(-ed,-e.radius*0.2,es,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ed,-e.radius*0.2,es,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.arc(-ed-es*0.3,-e.radius*0.26,es*0.38,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ed-es*0.3,-e.radius*0.26,es*0.38,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#c0003a';
      ctx.beginPath();
      ctx.moveTo(-e.radius*0.38,e.radius*0.15); ctx.lineTo(e.radius*0.38,e.radius*0.15);
      ctx.lineTo(e.radius*0.32,e.radius*0.35); ctx.lineTo(e.radius*0.14,e.radius*0.35);
      ctx.lineTo(0,e.radius*0.27); ctx.lineTo(-e.radius*0.14,e.radius*0.35);
      ctx.lineTo(-e.radius*0.32,e.radius*0.35); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  });

  // Particles
  state.particles.forEach(p=>{
    ctx.save(); ctx.globalAlpha=p.alpha;
    ctx.shadowColor=p.color; ctx.shadowBlur=6;
    ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // Confetti
  state.confetti.forEach(c=>{
    ctx.save(); ctx.globalAlpha=c.alpha;
    ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    ctx.fillStyle=c.color;
    if(c.shape==='rect') ctx.fillRect(-c.r/2,-c.r*0.4,c.r,c.r*0.8);
    else { ctx.beginPath(); ctx.arc(0,0,c.r/2,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  });

  // Bottle hit flash
  if(state.bottleHitFlash>0){
    ctx.fillStyle=`rgba(255,45,120,${0.3*state.bottleHitFlash})`;
    ctx.fillRect(-sx,-sy,W(),H());
  }

  ctx.restore();
}

// ─── Loops ────────────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  if (!state.running) return;
  const dt = Math.min(ts-(lastTime||ts), 33);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function celebLoop(ts) {
  const dt = Math.min(ts-(lastTime||ts), 33);
  lastTime = ts;
  updateConfetti(dt);
  draw();
  if (state.confetti.length > 0) requestAnimationFrame(celebLoop);
}

// ─── Input ────────────────────────────────────────────────────────────────────
function getCoords(e) {
  const r = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  // Scale from display coords to canvas coords
  const scaleX = canvas.width  / r.width;
  const scaleY = canvas.height / r.height;
  return { x: (src.clientX-r.left)*scaleX, y: (src.clientY-r.top)*scaleY };
}

canvas.addEventListener('pointerdown', e => {
  state.pointer.active = true;
  const c = getCoords(e); handleInteraction(c.x, c.y);
}, { passive: true });

canvas.addEventListener('pointermove', e => {
  if (!state.pointer.active) return;
  const c = getCoords(e); handleInteraction(c.x, c.y);
}, { passive: true });

canvas.addEventListener('pointerup', () => { state.pointer.active = false; });

// ─── Buttons ──────────────────────────────────────────────────────────────────
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('winPlayAgain').addEventListener('click', startGame);
document.getElementById('losePlayAgain').addEventListener('click', startGame);
