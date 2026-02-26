const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const leaderboardRows = document.getElementById("leaderboardRows");

const keysDown = Object.create(null);

const playerStart = { x: 0, y: 0 };
const player = {
  x: 0,
  y: 0,
  radius: 12,
  speed: 270,
  credits: 0,
};

const reds = [];
const projectiles = [];

let gameOver = false;
let hasRecordedGameOver = false;
let startTime = performance.now();
let scoreSeconds = 0;
let lastTime = performance.now();

const totalLevels = 5;
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

function levelConfig(currentLevel) {
  if (currentLevel === 5) {
    return {
      spawnIntervalMs: 700,
      spawnCount: 1,
      speedMin: 55,
      speedMax: 85,
      radiusMin: 40,
      radiusMax: 40,
      hpMin: 35,
      hpMax: 35,
      isBossLevel: true,
      dodgeLifetime: 99999,
    };
  }

  return {
    spawnIntervalMs: Math.max(220, 900 - currentLevel * 110),
    spawnCount: 8 + currentLevel * 5,
    speedMin: 42 + currentLevel * 10,
    speedMax: 70 + currentLevel * 15,
    radiusMin: 9,
    radiusMax: 14 + currentLevel,
    hpMin: 1,
    hpMax: 1 + Math.floor(currentLevel / 3),
    isBossLevel: false,
    dodgeLifetime: Math.max(3.4, 5.2 - currentLevel * 0.35),
  };
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (!playerStart.x && !playerStart.y) {
    resetPlayerToCenter();
  } else {
    clampPlayer();
  }
}

function clearScreen() {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function resetPlayerToCenter() {
  playerStart.x = canvas.width / 2;
  playerStart.y = canvas.height / 2;
  player.x = playerStart.x;
  player.y = playerStart.y;
}

function drawPlayer() {
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#2d7dff";
  ctx.fill();
}

function drawRed(red) {
  ctx.beginPath();
  ctx.arc(red.x, red.y, red.radius, 0, Math.PI * 2);
  ctx.fillStyle = red.isBoss ? "#b60000" : "#ff4b4b";
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
  if (gameOver) return;

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
  const minDistance = level === 5 ? 260 : 180;
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
  if (gameOver) return;

  const config = levelConfig(level);

  for (let i = reds.length - 1; i >= 0; i -= 1) {
    const red = reds[i];
    red.ageSeconds += deltaSeconds;

    const toPlayerX = player.x - red.x;
    const toPlayerY = player.y - red.y;
    const len = Math.hypot(toPlayerX, toPlayerY) || 1;
    const dirX = toPlayerX / len;
    const dirY = toPlayerY / len;

    red.x += dirX * red.speed * deltaSeconds;
    red.y += dirY * red.speed * deltaSeconds;

    if (!red.isBoss && red.ageSeconds >= config.dodgeLifetime) {
      reds.splice(i, 1);
      player.credits += 1;
    }
  }
}

function fireAtNearestEnemy() {
  if (!equippedWeaponKey || reds.length === 0) return;
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
          player.credits += red.isBoss ? 12 : 2;
        }
        break;
      }
    }

    if (hit) {
      projectiles.splice(i, 1);
    }
  }
}

function checkCollisions() {
  if (gameOver) return;

  for (const red of reds) {
    const sumR = red.radius + player.radius;
    if (distanceSquared(red.x, red.y, player.x, player.y) < sumR * sumR) {
      gameOver = true;
      break;
    }
  }
}

function tryUnlockWeapons() {
  if (!weaponsUnlocked && scoreSeconds >= 5) {
    weaponsUnlocked = true;
  }
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
  if (gameOver) return;

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
    if (level >= totalLevels) {
      gameOver = true;
      return;
    }

    level += 1;
    inLevelTransition = true;
    transitionTimer = 1800;
    spawnTimer = 0;
    spawnedThisLevel = 0;
  }
}

function drawHud() {
  ctx.fillStyle = "#f0f0f0";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Time: ${scoreSeconds.toFixed(1)}s`, 18, 34);

  ctx.font = "16px Arial";
  ctx.fillStyle = "#cfcfcf";
  ctx.fillText(`Level: ${level}/${totalLevels}`, 18, 58);
  ctx.fillText(`Credits: ${player.credits}`, 18, 80);
  ctx.fillText("Move: Arrow Keys / WASD", 18, 102);

  if (!weaponsUnlocked) {
    ctx.fillStyle = "#ffd36c";
    ctx.fillText("Weapons unlock at 5s survival", 18, 124);
  } else {
    const equippedName = equippedWeaponKey ? weapons[equippedWeaponKey].name : "None";
    ctx.fillStyle = "#9cd0ff";
    ctx.fillText(`Equipped: ${equippedName} (Hold Space to fire)`, 18, 124);
    ctx.fillStyle = "#f6f6f6";
    ctx.fillText("Buy/Equip: 1 Pulse(4)  2 Burst(10)  3 Rail(18)", 18, 146);
  }

  if (inLevelTransition) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 38px Arial";
    ctx.fillText(`Level ${level}`, canvas.width / 2, 84);
  }
}

function drawGameOverOverlay() {
  if (!gameOver) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  const title = level >= totalLevels && reds.length === 0 ? "You Win!" : "Game Over";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 16);
  ctx.font = "24px Arial";
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 28);
}

function restartGame() {
  reds.length = 0;
  projectiles.length = 0;
  gameOver = false;
  hasRecordedGameOver = false;
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

function loop(now) {
  const deltaMs = Math.min(48, now - lastTime);
  const deltaSeconds = deltaMs / 1000;
  lastTime = now;

  if (!gameOver) {
    scoreSeconds = (now - startTime) / 1000;
  }

  fireCooldownMs = Math.max(0, fireCooldownMs - deltaMs);

  updatePlayer(deltaSeconds);
  tryUnlockWeapons();
  updateLevelFlow(deltaMs);
  fireAtNearestEnemy();
  updateProjectiles(deltaSeconds);
  updateReds(deltaSeconds);
  checkCollisions();

  if (gameOver && !hasRecordedGameOver) {
    hasRecordedGameOver = true;
    recordCompletedRun();
  }

  clearScreen();
  drawPlayer();
  reds.forEach(drawRed);
  projectiles.forEach(drawProjectile);
  drawHud();
  drawGameOverOverlay();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keysDown[key] = true;

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
requestAnimationFrame((time) => {
  lastTime = time;
  startTime = time;
  requestAnimationFrame(loop);
});
