const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keysDown = Object.create(null);

const playerStart = { x: 0, y: 0 };
const player = {
  x: 0,
  y: 0,
  radius: 12,
  speed: 260,
};

const reds = [];

let gameOver = false;
let startTime = performance.now();
let scoreSeconds = 0;
let lastTime = performance.now();
let spawnTimer = 0;

const initialSpawnInterval = 900;
const minSpawnInterval = 260;
const difficultyRampPerSecond = 12;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (!playerStart.x && !playerStart.y) {
    resetPlayerToCenter();
  } else {
    player.x = Math.min(canvas.width - player.radius, Math.max(player.radius, player.x));
    player.y = Math.min(canvas.height - player.radius, Math.max(player.radius, player.y));
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
  ctx.fillStyle = "#ff4b4b";
  ctx.fill();
}

function clampPlayer() {
  player.x = Math.min(canvas.width - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(canvas.height - player.radius, Math.max(player.radius, player.y));
}

function updatePlayer(deltaSeconds) {
  if (gameOver) {
    return;
  }

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

function currentSpawnIntervalMs() {
  const elapsedSeconds = (performance.now() - startTime) / 1000;
  const reduced = initialSpawnInterval - elapsedSeconds * difficultyRampPerSecond;
  return Math.max(minSpawnInterval, reduced);
}

function spawnRed() {
  const radius = 10 + Math.random() * 6;
  const speed = 45 + Math.random() * 35;
  const minDistance = 180;
  const minDistanceSq = minDistance * minDistance;

  let x = 0;
  let y = 0;
  let attempts = 0;

  do {
    x = radius + Math.random() * (canvas.width - radius * 2);
    y = radius + Math.random() * (canvas.height - radius * 2);
    attempts += 1;
  } while (attempts < 30 && distanceSquared(x, y, player.x, player.y) < minDistanceSq);

  reds.push({ x, y, radius, speed });
}

function updateReds(deltaSeconds) {
  if (gameOver) {
    return;
  }

  for (const red of reds) {
    const toPlayerX = player.x - red.x;
    const toPlayerY = player.y - red.y;
    const len = Math.hypot(toPlayerX, toPlayerY) || 1;
    const dirX = toPlayerX / len;
    const dirY = toPlayerY / len;

    red.x += dirX * red.speed * deltaSeconds;
    red.y += dirY * red.speed * deltaSeconds;
  }
}

function checkCollisions() {
  if (gameOver) {
    return;
  }

  for (const red of reds) {
    const sumR = red.radius + player.radius;
    if (distanceSquared(red.x, red.y, player.x, player.y) < sumR * sumR) {
      gameOver = true;
      break;
    }
  }
}

function drawHud() {
  ctx.fillStyle = "#f0f0f0";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Time: ${scoreSeconds.toFixed(1)}s`, 18, 34);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#cfcfcf";
  ctx.fillText("Move: Arrow Keys / WASD", 18, 58);
}

function drawGameOverOverlay() {
  if (!gameOver) {
    return;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 16);
  ctx.font = "24px Arial";
  ctx.fillText("Press R to Restart", canvas.width / 2, canvas.height / 2 + 28);
}

function restartGame() {
  reds.length = 0;
  gameOver = false;
  scoreSeconds = 0;
  startTime = performance.now();
  spawnTimer = 0;
  resetPlayerToCenter();
}

function updateSpawning(deltaMs) {
  if (gameOver) {
    return;
  }

  spawnTimer += deltaMs;
  const interval = currentSpawnIntervalMs();

  while (spawnTimer >= interval) {
    spawnTimer -= interval;
    spawnRed();
  }
}

function loop(now) {
  const deltaMs = Math.min(48, now - lastTime);
  const deltaSeconds = deltaMs / 1000;
  lastTime = now;

  if (!gameOver) {
    scoreSeconds = (now - startTime) / 1000;
  }

  updatePlayer(deltaSeconds);
  updateSpawning(deltaMs);
  updateReds(deltaSeconds);
  checkCollisions();

  clearScreen();
  drawPlayer();
  reds.forEach(drawRed);
  drawHud();
  drawGameOverOverlay();

  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keysDown[key] = true;

  if ((key === "r" || key === "R") && gameOver) {
    restartGame();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  delete keysDown[key];
});

window.addEventListener("resize", resize);

resize();
requestAnimationFrame((time) => {
  lastTime = time;
  startTime = time;
  requestAnimationFrame(loop);
});
