# Blue Dot Survival Game

A tiny browser game prototype using a single full-screen canvas.

## Files

- `index.html`
- `style.css`
- `game.js`

## Run locally

### Option 1: VS Code + Live Server
1. Open this folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

### Option 2: Python HTTP server
From this folder:

```bash
python3 -m http.server 4173
```

Then open:

- `http://localhost:4173`

## Syntax check
From this same folder (the one that contains `game.js`):

```bash
node --check game.js
```

## Common error: `Cannot find module ... game.js`
If you see an error like this:

```
Error: Cannot find module 'C:\...\Game\game.js'
```

it means Node cannot find `game.js` in your current terminal directory.

Fix it by either:

1. **Changing into the project folder first**
   ```powershell
   cd "C:\path\to\your\project"
   node --check game.js
   ```
2. **Or using an absolute path**
   ```powershell
   node --check "C:\path\to\your\project\game.js"
   ```

Also make sure your terminal is not including literal `\n` characters at the end of the command.

## Controls

- Move: `WASD` or Arrow keys
- Unlock weapons after 5 seconds of survival
- Buy/equip weapons: `1`, `2`, `3`
- Fire equipped weapon: hold `Space`
- Restart after game over or win: `R`

## Gameplay additions

- **Credits**: gain `+1` per red dot dodged, extra credits for kills.
- **Weapons**: spend credits to buy stronger weapons.
- **Levels**: 5 total levels with increasing enemy difficulty.
- **Boss**: Level 5 spawns the boss enemy.
- **Leaderboard**: tracks best times this session and best times overall.
