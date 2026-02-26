const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const leaderboardRows = document.getElementById("leaderboardRows");
const weaponRows = document.getElementById("weaponRows");
const uiTime = document.getElementById("uiTime");
const uiLevel = document.getElementById("uiLevel");
const uiCredits = document.getElementById("uiCredits");
const uiWeapon = document.getElementById("uiWeapon");
const uiHint = document.getElementById("uiHint");
const uiHealthText = document.getElementById("uiHealthText");
const uiHealthFill = document.getElementById("uiHealthFill");
const topStrip = document.querySelector(".top-strip");
const weaponsPanel = document.querySelector(".weapons-panel");

const keysDown = Object.create(null);

const playerStart = { x: 0, y: 0 };
const player = {
  x: 0,
  y: 0,
  radius: 12,
  speed: 270,
  credits: 0,
  maxHealth: 100,
  health: 100,
};

const reds = [];
const projectiles = [];
const enemyProjectiles = [];
const shotEffects = [];
const hitEffects = [];
const healthDrops = [];
const playArea = { top: 0, bottom: 0 };
const aim = { x: 0, y: 0, active: false };
let mouseFiring = false;

let gameOver = false;
let paused = false;
let hasRecordedGameOver = false;
let pauseStartedAt = 0;
let totalPausedMs = 0;
let startTime = performance.now();
let scoreSeconds = 0;
let lastTime = performance.now();

let level = 1;
let bossesDefeated = 0;
let inLevelTransition = false;
let transitionTimer = 0;
let spawnTimer = 0;
let spawnedThisLevel = 0;
let healthDropTimer = 0;

let weaponsUnlocked = false;
const weapons = [
  { id: "pulse", key: "1", name: "Pulse Carbine", cost: 4, damage: 1, speed: 460, cooldownMs: 340, color: "#6ce4ff", unlockTier: 0 },
  { id: "burst", key: "2", name: "Burst Rifle", cost: 10, damage: 2, speed: 540, cooldownMs: 250, color: "#ffe66c", unlockTier: 0 },
  { id: "rail", key: "3", name: "Rail Shot", cost: 18, damage: 4, speed: 680, cooldownMs: 180, color: "#ff9cf7", unlockTier: 0 },
  { id: "flare", key: "4", name: "Flare Cannon", cost: 26, damage: 6, speed: 520, cooldownMs: 260, color: "#ff9f7a", unlockTier: 1 },
  { id: "ion", key: "5", name: "Ion Needle", cost: 34, damage: 7, speed: 750, cooldownMs: 150, color: "#8bffea", unlockTier: 1 },
  { id: "arc", key: "6", name: "Arc Blaster", cost: 42, damage: 9, speed: 620, cooldownMs: 175, color: "#9db5ff", unlockTier: 2 },
  { id: "nova", key: "7", name: "Nova Driver", cost: 54, damage: 12, speed: 700, cooldownMs: 160, color: "#f7a3ff", unlockTier: 2 },
  { id: "void", key: "8", name: "Void Lance", cost: 70, damage: 16, speed: 780, cooldownMs: 145, color: "#d8ff7c", unlockTier: 3 },
  { id: "omega", key: "9", name: "Omega Repeater", cost: 88, damage: 20, speed: 840, cooldownMs: 130, color: "#ffffff", unlockTier: 4 },
];

const purchasedWeapons = new Set();
let equippedWeaponId = null;
let fireCooldownMs = 0;

const leaderboardKey = "blue-dot-survival-best-overall";
const leaderboardLimit = 8;
const sessionBestTimes = [];
let overallBestTimes = loadOverallBestTimes();
let sessionBestTime = null;
let overallBestTime = overallBestTimes[0] ?? null;

function isBossLevel(currentLevel) {
  return currentLevel % 3 === 0;
}

function currentBossTier() {
  return Math.floor((level - 1) / 3);
}

function levelConfig(currentLevel) {
  const tier = Math.floor((currentLevel - 1) / 3);

  if (isBossLevel(currentLevel)) {
    const bossNumber = Math.floor(currentLevel / 3);
    const shieldLayers = Math.min(64, 2 ** (bossNumber - 1));
    const shieldHpPerLayer = 16 + tier * 10;
    const totalShieldHp = shieldLayers * shieldHpPerLayer;

    return {
      spawnIntervalMs: Math.max(110, 600 - tier * 26),
      spawnCount: 1,
      speedMin: 72 + tier * 9,
      speedMax: 95 + tier * 11,
      radiusMin: Math.min(62, 35 + tier * 3),
      radiusMax: Math.min(62, 35 + tier * 3),
      hpMin: (42 + tier * 18) * 10,
      hpMax: (42 + tier * 18) * 10,
      armor: Math.min(30, (2 + tier) * 3),
      isBossLevel: true,
      dodgeLifetime: 99999,
      shooterChance: 0.95,
      enemyShotCooldownMinMs: 260,
      enemyShotCooldownMaxMs: 520,
      enemyShotSpeed: 280 + tier * 16,
      enemyContactDamage: 42 + tier * 6,
      enemyShotDamage: 18 + tier * 3,
      bossArmorLayer: 55 + tier * 26,
      shieldLayers,
      shieldHpPerLayer,
      totalShieldHp,
    };
  }

  return {
    spawnIntervalMs: Math.max(90, 830 - currentLevel * 22),
    spawnCount: 9 + currentLevel * 4,
    speedMin: 50 + currentLevel * 3,
    speedMax: 76 + currentLevel * 4.5,
    radiusMin: 9,
    radiusMax: Math.min(24, 13 + currentLevel * 0.4),
    hpMin: 1 + Math.floor(tier * 0.9),
    hpMax: 2 + Math.floor(currentLevel / 6) + tier,
    armor: Math.min(10, tier),
    isBossLevel: false,
    dodgeLifetime: Math.max(1.2, 4.6 - currentLevel * 0.07),
    shooterChance: Math.min(0.85, 0.2 + tier * 0.16),
    enemyShotCooldownMinMs: Math.max(360, 900 - tier * 110),
    enemyShotCooldownMaxMs: Math.max(560, 1320 - tier * 120),
    enemyShotSpeed: 235 + tier * 12,
    enemyContactDamage: 12 + tier * 2,
    enemyShotDamage: 5 + tier,
    bossArmorLayer: 0,
    shieldLayers: 0,
    shieldHpPerLayer: 0,
    totalShieldHp: 0,
  };
}

function maxHealthForLevel(currentLevel) {
  const tier = Math.floor((currentLevel - 1) / 3);
  return 100 + tier * 18;
}

function updatePlayArea() {
  const topRect = topStrip ? topStrip.getBoundingClientRect() : { bottom: 0 };
  const armoryRect = weaponsPanel
    ? weaponsPanel.getBoundingClientRect()
    : { top: canvas.height, height: 0 };

  const topInset = Math.max(0, Math.ceil(topRect.bottom + 10));
  const bottomInset = Math.max(0, Math.ceil(canvas.height - armoryRect.top + 10));
  const minimumGap = 180;

  if (canvas.height - topInset - bottomInset < minimumGap) {
    playArea.top = Math.max(0, topInset - 20);
    playArea.bottom = Math.max(0, bottomInset - 20);
  } else {
    playArea.top = topInset;
    playArea.bottom = bottomInset;
  }
}

function playableMinY(radius) {
  return Math.max(radius, playArea.top + radius);
}

function playableMaxY(radius) {
  return Math.min(canvas.height - radius, canvas.height - playArea.bottom - radius);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  updatePlayArea();
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
  playerStart.y = Math.max(canvas.height / 2, playableMinY(player.radius));
  player.x = playerStart.x;
  player.y = playerStart.y;
}

function drawPlayer() {
  const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, player.radius + 11);
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

  if (red.isBoss && red.shieldLayers > 0) {
    const shieldPct = red.currentShieldLayerHp / Math.max(1, red.shieldHpPerLayer);
    ctx.strokeStyle = "#72d7ff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(red.x, red.y, red.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * shieldPct);
    ctx.stroke();
  }

  if (red.isBoss && red.bossArmor > 0) {
    const armorPct = red.bossArmor / Math.max(1, red.bossArmorMax);
    ctx.strokeStyle = "#9fe7ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(red.x, red.y, red.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * armorPct);
    ctx.stroke();
  }

  if (red.hp > 1 || (red.isBoss && red.bossArmor > 0)) {
    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    let hpText = `${Math.ceil(red.hp)}`;
    if (red.isBoss && red.shieldLayers > 0) hpText = `S:${red.shieldLayers}`;
    else if (red.isBoss && red.bossArmor > 0) hpText = `A:${Math.ceil(red.bossArmor)}`;
    ctx.fillText(hpText, red.x, red.y + 4);
  }
}

function drawProjectile(projectile) {
  const weapon = getWeaponById(projectile.weaponId);
  const pulse = Math.sin(performance.now() * 0.02 + (projectile.phase || 0)) * 0.8;
  const sizeBoost = weapon ? Math.max(0, weapon.damage * 0.08) : 0;

  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius + sizeBoost + pulse, 0, Math.PI * 2);
  ctx.fillStyle = projectile.color;
  ctx.fill();

  if (weapon) {
    if (["pulse", "ion", "omega"].includes(weapon.id)) {
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(projectile.x - projectile.vx * 0.014, projectile.y - projectile.vy * 0.014, projectile.radius + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = weapon.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (["rail", "void"].includes(weapon.id)) {
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(projectile.x, projectile.y);
      ctx.lineTo(projectile.x - projectile.vx * 0.02, projectile.y - projectile.vy * 0.02);
      ctx.stroke();
    } else {
      ctx.strokeStyle = weapon.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.radius + 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawEnemyProjectile(projectile) {
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#ff9e5e";
  ctx.fill();
}

function clampPlayer() {
  player.x = Math.min(canvas.width - player.radius, Math.max(player.radius, player.x));
  const minY = playableMinY(player.radius);
  const maxY = playableMaxY(player.radius);
  player.y = Math.min(maxY, Math.max(minY, player.y));
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

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}



function isOutsidePlayableY(y, radius = 0) {
  return y < playableMinY(radius) - 2 || y > playableMaxY(radius) + 2;
}

function spawnHealthDrop() {
  const radius = 9;
  const minY = playableMinY(radius);
  const maxY = playableMaxY(radius);
  const x = radius + Math.random() * (canvas.width - radius * 2);
  const y = minY + Math.random() * Math.max(1, maxY - minY);
  const healAmount = 12 + Math.floor(Math.random() * 10);

  healthDrops.push({ x, y, radius, healAmount, ttl: 7.5, phase: Math.random() * Math.PI * 2 });
}

function updateHealthDrops(deltaSeconds) {
  if (paused || gameOver) return;

  for (let i = healthDrops.length - 1; i >= 0; i -= 1) {
    const drop = healthDrops[i];
    drop.ttl -= deltaSeconds;

    if (isOutsidePlayableY(drop.y, drop.radius)) {
      healthDrops.splice(i, 1);
      continue;
    }

    if (drop.ttl <= 0) {
      healthDrops.splice(i, 1);
      continue;
    }

    const sumR = drop.radius + player.radius;
    if (distanceSquared(drop.x, drop.y, player.x, player.y) < sumR * sumR) {
      player.health = Math.min(player.maxHealth, player.health + drop.healAmount);
      addHitEffect(drop.x, drop.y, "#7dffb4", "heal");
      healthDrops.splice(i, 1);
    }
  }
}

function drawHealthDrop(drop) {
  const pulse = Math.sin(performance.now() * 0.01 + drop.phase) * 1.2;
  ctx.beginPath();
  ctx.arc(drop.x, drop.y, drop.radius + pulse, 0, Math.PI * 2);
  ctx.fillStyle = "#6cff9b";
  ctx.fill();

  ctx.strokeStyle = "#e8fff2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(drop.x - 4, drop.y);
  ctx.lineTo(drop.x + 4, drop.y);
  ctx.moveTo(drop.x, drop.y - 4);
  ctx.lineTo(drop.x, drop.y + 4);
  ctx.stroke();
}

function spawnRed() {
  const config = levelConfig(level);
  const isAnyBoss = config.isBossLevel;
  const radius = randomBetween(config.radiusMin, config.radiusMax);
  const speed = randomBetween(config.speedMin, config.speedMax);
  const hp = Math.floor(randomBetween(config.hpMin, config.hpMax + 1));
  const minDistance = isAnyBoss ? 250 : 180;
  const minDistanceSq = minDistance * minDistance;

  let x = 0;
  let y = 0;
  let attempts = 0;
  do {
    x = radius + Math.random() * (canvas.width - radius * 2);
    const minY = playableMinY(radius);
    const maxY = playableMaxY(radius);
    y = minY + Math.random() * Math.max(1, maxY - minY);
    attempts += 1;
  } while (attempts < 30 && distanceSquared(x, y, player.x, player.y) < minDistanceSq);

  const canShoot = Math.random() < config.shooterChance;
  const bossArmorMax = config.bossArmorLayer || 0;

  reds.push({
    x,
    y,
    radius,
    speed,
    hp,
    armor: config.armor,
    bossArmor: bossArmorMax,
    bossArmorMax,
    ageSeconds: 0,
    isBoss: isAnyBoss,
    isMainBoss: config.isBossLevel,
    shieldLayers: config.shieldLayers || 0,
    shieldHpPerLayer: config.shieldHpPerLayer || 0,
    currentShieldLayerHp: config.shieldHpPerLayer || 0,
    canShoot,
    shotCooldownMs: randomBetween(config.enemyShotCooldownMinMs, config.enemyShotCooldownMaxMs),
  });
}

function damagePlayer(amount) {
  player.health = Math.max(0, player.health - amount);
  if (player.health <= 0) {
    gameOver = true;
  }
}

function updateReds(deltaSeconds, deltaMs) {
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

    red.x = Math.min(canvas.width - red.radius, Math.max(red.radius, red.x));
    red.y = Math.min(playableMaxY(red.radius), Math.max(playableMinY(red.radius), red.y));

    if (red.canShoot) {
      red.shotCooldownMs -= deltaMs;
      if (red.shotCooldownMs <= 0) {
        fireEnemyProjectile(red, config);
        red.shotCooldownMs = randomBetween(config.enemyShotCooldownMinMs, config.enemyShotCooldownMaxMs);
      }
    }

    if (!red.isBoss && red.ageSeconds >= config.dodgeLifetime) {
      reds.splice(i, 1);
      player.credits += 1;
    }
  }
}

function fireEnemyProjectile(red, config) {
  const dx = player.x - red.x;
  const dy = player.y - red.y;
  const len = Math.hypot(dx, dy) || 1;

  enemyProjectiles.push({
    x: red.x,
    y: red.y,
    vx: (dx / len) * config.enemyShotSpeed,
    vy: (dy / len) * config.enemyShotSpeed,
    radius: red.isBoss ? 5 : 4,
    damage: config.enemyShotDamage,
    ttl: 3,
  });
}

function getWeaponById(id) {
  return weapons.find((weapon) => weapon.id === id) || null;
}

function getWeaponByKey(key) {
  return weapons.find((weapon) => weapon.key === key) || null;
}

function getAimDirection() {
  const targetX = aim.active ? aim.x : player.x + 1;
  const targetY = aim.active ? aim.y : player.y;
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function addShotEffect(x, y, color, weaponId) {
  shotEffects.push({ x, y, color, weaponId, life: 0.12, ttl: 0.12 });
}

function addHitEffect(x, y, color, weaponId) {
  hitEffects.push({ x, y, color, weaponId, life: 0.22, ttl: 0.22 });
}

function fireAtNearestEnemy() {
  if (gameOver || paused || !equippedWeaponId) return;
  const weapon = getWeaponById(equippedWeaponId);
  if (!weapon || fireCooldownMs > 0) return;
  if (!mouseFiring && !keysDown[" "] && !keysDown.Space && !keysDown.space) return;

  const dir = getAimDirection();

  projectiles.push({
    x: player.x,
    y: player.y,
    vx: dir.x * weapon.speed,
    vy: dir.y * weapon.speed,
    damage: weapon.damage,
    radius: 4 + weapon.damage * 0.04,
    color: weapon.color,
    ttl: 1.8,
    weaponId: weapon.id,
    phase: Math.random() * Math.PI * 2,
  });

  addShotEffect(player.x + dir.x * 12, player.y + dir.y * 12, weapon.color, weapon.id);
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
      projectile.y > canvas.height + 20 ||
      isOutsidePlayableY(projectile.y, projectile.radius)
    ) {
      projectiles.splice(i, 1);
      continue;
    }

    let hit = false;
    for (let r = reds.length - 1; r >= 0; r -= 1) {
      const red = reds[r];
      const sumR = red.radius + projectile.radius;
      if (distanceSquared(projectile.x, projectile.y, red.x, red.y) < sumR * sumR) {
        const effectiveDamage = Math.max(0.5, projectile.damage - red.armor * 0.3);

        if (red.isBoss && red.shieldLayers > 0) {
          red.currentShieldLayerHp -= effectiveDamage;
          if (red.currentShieldLayerHp <= 0) {
            red.shieldLayers -= 1;
            red.currentShieldLayerHp = red.shieldLayers > 0 ? red.shieldHpPerLayer : 0;
          }
          addHitEffect(projectile.x, projectile.y, "#6ed2ff", projectile.weaponId);
        } else if (red.isBoss && red.bossArmor > 0) {
          red.bossArmor = Math.max(0, red.bossArmor - effectiveDamage);
          addHitEffect(projectile.x, projectile.y, "#9fe7ff", projectile.weaponId);
        } else {
          red.hp -= effectiveDamage;
          addHitEffect(projectile.x, projectile.y, projectile.color, projectile.weaponId);
        }

        hit = true;

        if (red.hp <= 0) {
          reds.splice(r, 1);
          player.credits += red.isBoss ? 22 + currentBossTier() * 6 : 2;
        }
        break;
      }
    }

    if (hit) projectiles.splice(i, 1);
  }
}

function updateEnemyProjectiles(deltaSeconds) {
  if (paused || gameOver) return;

  for (let i = enemyProjectiles.length - 1; i >= 0; i -= 1) {
    const projectile = enemyProjectiles[i];
    projectile.ttl -= deltaSeconds;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.y += projectile.vy * deltaSeconds;

    if (
      projectile.ttl <= 0 ||
      projectile.x < -20 ||
      projectile.y < -20 ||
      projectile.x > canvas.width + 20 ||
      projectile.y > canvas.height + 20 ||
      isOutsidePlayableY(projectile.y, projectile.radius)
    ) {
      enemyProjectiles.splice(i, 1);
      continue;
    }

    const sumR = projectile.radius + player.radius;
    if (distanceSquared(projectile.x, projectile.y, player.x, player.y) < sumR * sumR) {
      damagePlayer(projectile.damage);
      enemyProjectiles.splice(i, 1);
    }
  }
}

function checkCollisions() {
  if (gameOver || paused) return;

  const config = levelConfig(level);
  for (let i = reds.length - 1; i >= 0; i -= 1) {
    const red = reds[i];
    const sumR = red.radius + player.radius;
    if (distanceSquared(red.x, red.y, player.x, player.y) < sumR * sumR) {
      damagePlayer(config.enemyContactDamage);
      if (!red.isBoss) {
        reds.splice(i, 1);
      }
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
  const weapon = getWeaponByKey(key);
  if (!weapon) return;

  if (bossesDefeated < weapon.unlockTier) return;

  if (!purchasedWeapons.has(weapon.id)) {
    if (player.credits < weapon.cost) return;
    player.credits -= weapon.cost;
    purchasedWeapons.add(weapon.id);
  }

  equippedWeaponId = weapon.id;
}

function resetHealthForLevel() {
  player.maxHealth = maxHealthForLevel(level);
  player.health = player.maxHealth;
}

function updateLevelFlow(deltaMs) {
  if (gameOver || paused) return;

  if (inLevelTransition) {
    transitionTimer -= deltaMs;
    if (transitionTimer <= 0) {
      inLevelTransition = false;
      spawnTimer = 0;
      spawnedThisLevel = 0;
  healthDropTimer = 0;
    }
    return;
  }

  const config = levelConfig(level);

  healthDropTimer += deltaMs;
  const nextDropMs = 3800 + Math.random() * 2300;
  if (healthDropTimer >= nextDropMs) {
    healthDropTimer = 0;
    if (healthDrops.length < 2) {
      spawnHealthDrop();
    }
  }

  if (spawnedThisLevel < config.spawnCount) {
    spawnTimer += deltaMs;
    while (spawnTimer >= config.spawnIntervalMs && spawnedThisLevel < config.spawnCount) {
      spawnTimer -= config.spawnIntervalMs;
      spawnRed();
      spawnedThisLevel += 1;
    }
  }

  if (spawnedThisLevel >= config.spawnCount && reds.length === 0) {
    if (isBossLevel(level)) {
      bossesDefeated += 1;
    }

    level += 1;
    inLevelTransition = true;
    transitionTimer = isBossLevel(level) ? 2500 : 1400;
    spawnTimer = 0;
    spawnedThisLevel = 0;
    projectiles.length = 0;
    enemyProjectiles.length = 0;
    healthDrops.length = 0;
    healthDropTimer = 0;
  shotEffects.length = 0;
  hitEffects.length = 0;
  }
}

function updateWeaponPanel() {
  weaponRows.innerHTML = "";

  for (const weapon of weapons) {
    const row = document.createElement("tr");

    const statusCell = document.createElement("td");
    statusCell.textContent = "";

    let statusText = "Locked";
    let statusClass = "weapon-locked";

    if (!weaponsUnlocked) {
      statusText = "Unlock at 5s";
    } else if (bossesDefeated < weapon.unlockTier) {
      statusText = `Unlock after Boss ${weapon.unlockTier}`;
    } else if (purchasedWeapons.has(weapon.id)) {
      statusText = equippedWeaponId === weapon.id ? "Equipped" : "Owned";
      statusClass = equippedWeaponId === weapon.id ? "weapon-equipped" : "weapon-available";
    } else if (player.credits >= weapon.cost) {
      statusText = "Affordable";
      statusClass = "weapon-available";
    } else {
      statusText = "Need credits";
    }

    const cells = [
      weapon.key,
      weapon.name,
      `${weapon.cost}`,
      `${weapon.damage}`,
      `${(1000 / weapon.cooldownMs).toFixed(1)}/s`,
    ];

    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      row.appendChild(td);
    }

    statusCell.textContent = statusText;
    statusCell.className = statusClass;
    row.appendChild(statusCell);
    weaponRows.appendChild(row);
  }
}

function updateUiText() {
  uiTime.textContent = `${scoreSeconds.toFixed(1)}s`;
  uiLevel.textContent = `${level}${isBossLevel(level) ? " (Boss)" : ""}`;
  uiCredits.textContent = `${player.credits}`;

  const weapon = getWeaponById(equippedWeaponId);
  uiWeapon.textContent = weaponsUnlocked ? (weapon ? weapon.name : "None equipped") : "Locked";

  uiHealthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
  const pct = Math.max(0, Math.min(100, (player.health / player.maxHealth) * 100));
  uiHealthFill.style.width = `${pct}%`;

  if (paused) {
    uiHint.textContent = "Paused — press Esc to resume.";
  } else if (!weaponsUnlocked) {
    uiHint.textContent = "Survive 5s to unlock weapon purchases.";
  } else {
    uiHint.textContent = "Press 1-9 to buy/equip weapons. Aim with mouse, hold Space to fire, and collect green health drops.";
  }

  updateWeaponPanel();
}


function updateEffects(deltaSeconds) {
  for (let i = shotEffects.length - 1; i >= 0; i -= 1) {
    shotEffects[i].ttl -= deltaSeconds;
    if (shotEffects[i].ttl <= 0) shotEffects.splice(i, 1);
  }

  for (let i = hitEffects.length - 1; i >= 0; i -= 1) {
    hitEffects[i].ttl -= deltaSeconds;
    if (hitEffects[i].ttl <= 0) hitEffects.splice(i, 1);
  }
}

function drawShotEffect(effect) {
  const t = effect.ttl / effect.life;
  const radius = 8 + (1 - t) * 18;
  ctx.globalAlpha = Math.max(0, t);
  ctx.beginPath();
  ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = effect.color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHitEffect(effect) {
  const t = effect.ttl / effect.life;
  const spikesByWeapon = { pulse: 6, burst: 7, rail: 10, flare: 8, ion: 9, arc: 11, nova: 12, void: 13, omega: 14 };
  const spikes = spikesByWeapon[effect.weaponId] || 8;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  ctx.rotate((1 - t) * 0.8);
  ctx.strokeStyle = effect.color;
  ctx.globalAlpha = Math.max(0, t);
  ctx.lineWidth = 2;
  for (let i = 0; i < spikes; i += 1) {
    const a = (Math.PI * 2 * i) / spikes;
    const r1 = 4 + (1 - t) * 6;
    const r2 = 10 + (1 - t) * 22;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
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
    const transitionLabel = isBossLevel(level) ? `BOSS LEVEL ${level}` : `Level ${level}`;
    ctx.fillText(transitionLabel, canvas.width / 2, canvas.height / 2);
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
  enemyProjectiles.length = 0;
  shotEffects.length = 0;
  hitEffects.length = 0;
  healthDrops.length = 0;

  gameOver = false;
  paused = false;
  hasRecordedGameOver = false;
  pauseStartedAt = 0;
  totalPausedMs = 0;

  scoreSeconds = 0;
  startTime = performance.now();

  level = 1;
  bossesDefeated = 0;
  inLevelTransition = false;
  transitionTimer = 0;
  spawnTimer = 0;
  spawnedThisLevel = 0;

  player.credits = 0;
  weaponsUnlocked = false;
  purchasedWeapons.clear();
  equippedWeaponId = null;
  fireCooldownMs = 0;

  resetPlayerToCenter();
  resetHealthForLevel();
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

  const row = document.createElement("tr");
  const sessionCell = document.createElement("td");
  const overallCell = document.createElement("td");

  sessionCell.textContent = formatScore(sessionBestTime);
  overallCell.textContent = formatScore(overallBestTime);

  row.appendChild(sessionCell);
  row.appendChild(overallCell);
  leaderboardRows.appendChild(row);
}

function recordCompletedRun() {
  const finalScore = Number(scoreSeconds.toFixed(1));
  if (!Number.isFinite(finalScore) || finalScore <= 0) return;

  sessionBestTimes.push(finalScore);
  const sortedSession = sortBestTimes(sessionBestTimes);
  sessionBestTimes.length = 0;
  sessionBestTimes.push(...sortedSession);
  sessionBestTime = sessionBestTimes[0] ?? null;

  overallBestTimes = sortBestTimes([...overallBestTimes, finalScore]);
  overallBestTime = overallBestTimes[0] ?? null;
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
    updateEnemyProjectiles(deltaSeconds);
    updateReds(deltaSeconds, deltaMs);
    updateHealthDrops(deltaSeconds);
    updateEffects(deltaSeconds);
    checkCollisions();
  }

  if (gameOver && !hasRecordedGameOver) {
    hasRecordedGameOver = true;
    recordCompletedRun();
  }

  clearScreen();
  drawPlayer();
  reds.forEach(drawRed);
  healthDrops.forEach(drawHealthDrop);
  projectiles.forEach(drawProjectile);
  enemyProjectiles.forEach(drawEnemyProjectile);
  shotEffects.forEach(drawShotEffect);
  hitEffects.forEach(drawHitEffect);

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

  if (/^[1-9]$/.test(key)) {
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


canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0) {
    mouseFiring = true;
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    mouseFiring = false;
  }
});

window.addEventListener("blur", () => {
  mouseFiring = false;
});

window.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  aim.x = event.clientX - rect.left;
  aim.y = event.clientY - rect.top;
  aim.active = true;
});

window.addEventListener("resize", resize);

renderLeaderboard();
resize();
updatePlayArea();
resetHealthForLevel();
updateUiText();
requestAnimationFrame((time) => {
  lastTime = time;
  startTime = time;
  requestAnimationFrame(loop);
});
