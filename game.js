const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const leaderboardRows = document.getElementById("leaderboardRows");
const uiTime = document.getElementById("uiTime");
const uiLevel = document.getElementById("uiLevel");
const uiCredits = document.getElementById("uiCredits");
const uiWeapon = document.getElementById("uiWeapon");
const uiHint = document.getElementById("uiHint");

const keysDown = Object.create(null);

const playerStart = { x: 0, y: 0 };
const player = { x: 0, y: 0, radius: 12, speed: 270, credits: 0 };

const reds = [];
const projectiles = [];

let gameOver = false;
let paused = false;
let hasRecordedGameOver = false;
let pauseStartedAt = 0;
let totalPausedMs = 0;
let startTime = performance.now();
let scoreSeconds = 0;
let lastTime = performance.now();

let level = 1;
let inLevelTransition = false;
let transitionTimer = 0;
let spawnTimer = 0;
let spawnedThisLevel = 0;

let weaponsUnlocked = false;
const weapons = {
  pulse: { key: "1", name: "Pulse", cost: 4, damage: 1, speed: 460, cooldownMs: 340, color: "#6ce4ff" },
  burst: { key: "2", name: "Burst", cost: 10, damage: 2, speed: 540, cooldownMs: 250, color: "#ffe66c" },
  rail: { key: "3", name: "Rail", cost: 18, damage: 4, speed: 680, cooldownMs: 180, color: "#ff9cf7" },
};
const purchasedWeapons = new Set();
let equippedWeaponKey = null;
let fireCooldownMs = 0;

const leaderboardKey = "blue-dot-survival-best-overall";
const leaderboardLimit = 8;
const sessionBestTimes = [];
let overallBestTimes = loadOverallBestTimes();

function isBossLevel(currentLevel) {
  return currentLevel % 5 === 0;
}

function levelConfig(currentLevel) {
  if (isBossLevel(currentLevel)) {
    const tier = currentLevel / 5;
    return {
      spawnIntervalMs: Math.max(180, 700 - tier * 35),
      spawnCount: 1,
      speedMin: 68 + tier * 8,
      speedMax: 85 + tier * 10,
      radiusMin: Math.min(55, 34 + tier * 3),
      radiusMax: Math.min(55, 34 + tier * 3),
      hpMin: 35 + tier * 14,
      hpMax: 35 + tier * 14,
      isBossLevel: true,
      dodgeLifetime: 99999,
    };
  }

  return {
    spawnIntervalMs: Math.max(120, 880 - currentLevel * 24),
    spawnCount: 8 + currentLevel * 4,
    speedMin: 45 + currentLevel * 3,
    speedMax: 68 + currentLevel * 5,
    radiusMin: 9,
    radiusMax: Math.min(22, 13 + currentLevel * 0.5),
    hpMin: 1,
    hpMax: 1 + Math.floor(currentLevel / 6),
    isBossLevel: false,
    dodgeLifetime: Math.max(1.4, 4.6 - currentLevel * 0.08),
  };
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (!playerStart.x && !playerStart.y) resetPlayerToCenter();
  clampPlayer();
}

function clearScreen() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#151925");
  gradient.addColorStop(1, "#090c14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function resetPlayerToCenter() {
  playerStart.x = canvas.width / 2;
  playerStart.y = canvas.height / 2;
  player.x = playerStart.x;
  player.y = playerStart.y;
}

function drawPlayer() {
  const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, player.radius + 10);
  glow.addColorStop(0, "#8ec5ff");
  glow.addColorStop(1, "rgba(45,125,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#2d7dff";
  ctx.fill();
}

function drawRed(red) {
  ctx.beginPath();
  ctx.arc(red.x, red.y, red.radius, 0, Math.PI * 2);
  ctx.fillStyle = red.isBoss ? "#8b0b0b" : "#ff4b4b";
  ctx.fill();

  if (red.hp > 1) {
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${red.hp}`, red.x, red.y + 4);
  }
}

function drawProjectile(projectile) {
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fillStyle = projectile.color;
  ctx.fill();
}

function clampPlayer() {
  player.x = Math.min(canvas.width - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(canvas.height - player.radius, Math.max(player.radius, player.y));
}

function updatePlayer(deltaSeconds) {
  if (gameOver || paused) return;

  let moveX = 0;
  let moveY = 0;
  if (keysDown.ArrowLeft || keysDown.a) moveX -= 1;
  if (keysDown.ArrowRight || keysDown.d) moveX += 1;
  if (keysDown.ArrowUp || keysDown.w) moveY -= 1;
  if (keysDown.ArrowDown || keysDown.s) moveY += 1;

  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    moveX /= len;
    moveY /= len;
  }

  player.x += moveX * player.speed * deltaSeconds;
  player.y += moveY * player.speed * deltaSeconds;
  clampPlayer();
}

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function spawnRed() {
  const config = levelConfig(level);
  const radius = config.radiusMin + Math.random() * (config.radiusMax - config.radiusMin);
  const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
  const hp = Math.floor(config.hpMin + Math.random() * (config.hpMax - config.hpMin + 1));
  const minDistance = config.isBossLevel ? 260 : 180;
  const minDistanceSq = minDistance * minDistance;

  let x = 0;
  let y = 0;
  let attempts = 0;
  do {
    x = radius + Math.random() * (canvas.width - radius * 2);
    y = radius + Math.random() * (canvas.height - radius * 2);
    attempts += 1;
  } while (attempts < 30 && distanceSquared(x, y, player.x, player.y) < minDistanceSq);

  reds.push({ x, y, radius, speed, hp, ageSeconds: 0, isBoss: config.isBossLevel });
}

function updateReds(deltaSeconds) {
  if (gameOver || paused) return;

  const config = levelConfig(level);
  for (let i = reds.length - 1; i >= 0; i -= 1) {
    const red = reds[i];
    red.ageSeconds += deltaSeconds;

    const toPlayerX = player.x - red.x;
    const toPlayerY = player.y - red.y;
    const len = Math.hypot(toPlayerX, toPlayerY) || 1;
    red.x += (toPlayerX / len) * red.speed * deltaSeconds;
    red.y += (toPlayerY / len) * red.speed * deltaSeconds;

    if (!red.isBoss && red.ageSeconds >= config.dodgeLifetime) {
      reds.splice(i, 1);
      player.credits += 1;
    }
  }
}

function fireAtNearestEnemy() {
  if (gameOver || paused || !equippedWeaponKey || reds.length === 0) return;
  const weapon = weapons[equippedWeaponKey];
  if (!weapon || fireCooldownMs > 0) return;
  if (!keysDown[" "] && !keysDown.Space && !keysDown.space) return;

  let nearest = null;
  let nearestDistSq = Infinity;
  for (const red of reds) {
    const d2 = distanceSquared(player.x, player.y, red.x, red.y);
    if (d2 < nearestDistSq) {
      nearestDistSq = d2;
      nearest = red;
    }
  }
  if (!nearest) return;

  const dx = nearest.x - player.x;
  const dy = nearest.y - player.y;
  const len = Math.hypot(dx, dy) || 1;

  projectiles.push({
    x: player.x,
    y: player.y,
    vx: (dx / len) * weapon.speed,
    vy: (dy / len) * weapon.speed,
    damage: weapon.damage,
    radius: 4,
    color: weapon.color,
    ttl: 1.6,
  });

  fireCooldownMs = weapon.cooldownMs;
}

function updateProjectiles(deltaSeconds) {
  if (paused) return;

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    projectile.ttl -= deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;

    if (
      projectile.ttl <= 0 ||
      projectile.x < -20 ||
      projectile.y < -20 ||
      projectile.x > canvas.width + 20 ||
      projectile.y > canvas.height + 20
    ) {
      projectiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (let r = reds.length - 1; r >= 0; r -= 1) {
      const red = reds[r];
      const sumR = red.radius + projectile.radius;
      if (distanceSquared(projectile.x, projectile.y, red.x, red.y) < sumR * sumR) {
        red.hp -= projectile.damage;
        hit = true;
        if (red.hp <= 0) {
          reds.splice(r, 1);
          player.credits += red.isBoss ? 20 + Math.floor(level / 5) * 5 : 2;
        }
        break;
      }
    }

    if (hit) projectiles.splice(i, 1);
  }
}

function checkCollisions() {
  if (gameOver || paused) return;
  for (const red of reds) {
    const sumR = red.radius + player.radius;
    if (distanceSquared(red.x, red.y, player.x, player.y) < sumR * sumR) {
      gameOver = true;
      break;
    }
  }
}

function tryUnlockWeapons() {
  if (!weaponsUnlocked && scoreSeconds >= 5) weaponsUnlocked = true;
}

function tryBuyOrEquipWeapon(key) {
  if (!weaponsUnlocked || gameOver) return;

  const weaponEntry = Object.entries(weapons).find(([, weapon]) => weapon.key === key);
  if (!weaponEntry) return;

  const [weaponId, weapon] = weaponEntry;
  if (!purchasedWeapons.has(weaponId)) {
    if (player.credits < weapon.cost) return;
    player.credits -= weapon.cost;
    purchasedWeapons.add(weaponId);
  }

  equippedWeaponKey = weaponId;
}

function updateLevelFlow(deltaMs) {
  if (gameOver || paused) return;

  if (inLevelTransition) {
    transitionTimer -= deltaMs;
    if (transitionTimer <= 0) {
      inLevelTransition = false;
      spawnTimer = 0;
      spawnedThisLevel = 0;
    }
    return;
  }

  const config = levelConfig(level);
  if (spawnedThisLevel < config.spawnCount) {
    spawnTimer += deltaMs;
    while (spawnTimer >= config.spawnIntervalMs && spawnedThisLevel < config.spawnCount) {
      spawnTimer -= config.spawnIntervalMs;
      spawnRed();
      spawnedThisLevel += 1;
    }
  }

  if (spawnedThisLevel >= config.spawnCount && reds.length === 0) {
    level += 1;
    inLevelTransition = true;
    transitionTimer = isBossLevel(level) ? 2400 : 1300;
    spawnTimer = 0;
    spawnedThisLevel = 0;
  }
}

function updateUiText() {
  uiTime.textContent = `${scoreSeconds.toFixed(1)}s`;
  uiLevel.textContent = `${level}${isBossLevel(level) ? " (Boss)" : ""}`;
  uiCredits.textContent = `${player.credits}`;
  uiWeapon.textContent = weaponsUnlocked
    ? equippedWeaponKey
      ? `${weapons[equippedWeaponKey].name}`
      : "None equipped"
    : "Locked";

  if (paused) {
    uiHint.textContent = "Paused — press Esc to resume.";
  } else if (!weaponsUnlocked) {
    uiHint.textContent = "Survive 5s to unlock weapon purchases.";
  } else {
    uiHint.textContent = "Buy/equip: 1 Pulse(4), 2 Burst(10), 3 Rail(18). Hold Space to fire.";
  }
}

function drawOverlayMessage() {
  if (paused || gameOver || inLevelTransition) {
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (inLevelTransition && !paused && !gameOver) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Arial";
    ctx.fillText(
      isBossLevel(level) ? `BOSS LEVEL ${level}` : `Level ${level}`,
      canvas.width / 2,
      canvas.height / 2,
    );
  }

  if (paused && !gameOver) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 46px Arial";
    ctx.fillText("Paused", canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "24px Arial";
    ctx.fillText("Press Esc to Resume", canvas.width / 2, canvas.height / 2 + 30);
  }

  if (gameOver) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 46px Arial";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = "24px Arial";
    ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 28);
  }
}

function restartGame() {
  reds.length = 0;
  projectiles.length = 0;
  gameOver = false;
  paused = false;
  hasRecordedGameOver = false;
  pauseStartedAt = 0;
  totalPausedMs = 0;
  scoreSeconds = 0;
  startTime = performance.now();
  level = 1;
  inLevelTransition = false;
  transitionTimer = 0;
  spawnTimer = 0;
  spawnedThisLevel = 0;
  player.credits = 0;
  weaponsUnlocked = false;
  purchasedWeapons.clear();
  equippedWeaponKey = null;
  fireCooldownMs = 0;
  resetPlayerToCenter();
}

function sortBestTimes(times) {
  return [...times].sort((a, b) => b - a).slice(0, leaderboardLimit);
}

function saveOverallBestTimes() {
  try {
    localStorage.setItem(leaderboardKey, JSON.stringify(overallBestTimes));
  } catch (_error) {
    // Ignore storage write failures.
  }
}

function loadOverallBestTimes() {
  try {
    const raw = localStorage.getItem(leaderboardKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortBestTimes(parsed.filter((value) => Number.isFinite(value) && value > 0));
  } catch (_error) {
    return [];
  }
}

function formatScore(timeSeconds) {
  if (typeof timeSeconds !== "number") return "-";
  return `${timeSeconds.toFixed(1)}s`;
}

function renderLeaderboard() {
  leaderboardRows.innerHTML = "";
  for (let i = 0; i < leaderboardLimit; i += 1) {
    const row = document.createElement("tr");
    const sessionCell = document.createElement("td");
    const overallCell = document.createElement("td");
    sessionCell.textContent = formatScore(sessionBestTimes[i]);
    overallCell.textContent = formatScore(overallBestTimes[i]);
    row.appendChild(sessionCell);
    row.appendChild(overallCell);
    leaderboardRows.appendChild(row);
  }
}

function recordCompletedRun() {
  const finalScore = Number(scoreSeconds.toFixed(1));
  if (!Number.isFinite(finalScore) || finalScore <= 0) return;

  sessionBestTimes.push(finalScore);
  const sortedSession = sortBestTimes(sessionBestTimes);
  sessionBestTimes.length = 0;
  sessionBestTimes.push(...sortedSession);

  overallBestTimes = sortBestTimes([...overallBestTimes, finalScore]);
  saveOverallBestTimes();
  renderLeaderboard();
}

function togglePause(now) {
  if (gameOver) return;

  paused = !paused;
  if (paused) {
    pauseStartedAt = now;
  } else {
    totalPausedMs += now - pauseStartedAt;
    lastTime = now;
  }
}

function loop(now) {
  const deltaMs = Math.min(48, now - lastTime);
  const deltaSeconds = deltaMs / 1000;
  lastTime = now;

  if (!gameOver && !paused) {
    scoreSeconds = (now - startTime - totalPausedMs) / 1000;
  }

  if (!paused) {
    fireCooldownMs = Math.max(0, fireCooldownMs - deltaMs);
    updatePlayer(deltaSeconds);
    tryUnlockWeapons();
    updateLevelFlow(deltaMs);
    fireAtNearestEnemy();
    updateProjectiles(deltaSeconds);
    updateReds(deltaSeconds);
    checkCollisions();
  }

  if (gameOver && !hasRecordedGameOver) {
    hasRecordedGameOver = true;
    recordCompletedRun();
  }

  clearScreen();
  drawPlayer();
  reds.forEach(drawRed);
  projectiles.forEach(drawProjectile);
  updateUiText();
  drawOverlayMessage();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keysDown[key] = true;

  if (event.key === "Escape") {
    event.preventDefault();
    togglePause(performance.now());
  }

  if (key === "1" || key === "2" || key === "3") {
    tryBuyOrEquipWeapon(key);
  }

  if ((key === "r" || key === "R") && gameOver) {
    restartGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  delete keysDown[key];
});

window.addEventListener("resize", resize);

renderLeaderboard();
resize();
updateUiText();
requestAnimationFrame((time) => {
  lastTime = time;
  startTime = time;
  requestAnimationFrame(loop);
});
