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
- Buy/equip weapons: `1` to `9` (see Armory table in HUD)
- Aim: move mouse cursor
- Fire equipped weapon: hold `Space`
- Pause/Resume: `Esc`
- Restart after game over: `R`

## Gameplay additions

- **Credits**: gain `+1` per red dot dodged, plus bonus credits for kills.
- **Weapons**: expanded armory with 9 weapon options, readable stats table, and boss-tier unlocks.
- **Levels**: continuous progression with increasing difficulty over time.
- **Bosses**: every 3rd level is a boss battle; bosses are 10x tougher and gain exponentially more shield layers (1, 2, 4, ...).
- **Leaderboard**: shows only best time this session and best overall time.
- **Enemy evolution**: reds shoot faster and more frequently as tiers increase.
- **Health system**: health persists across levels; random green health drops can restore HP if collected in time.


## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that deploys the static game site to GitHub Pages.

### One-time setup
1. Push this repository to GitHub.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Ensure your default branch is `main` (or update the workflow branch trigger if needed).

### Deploy
- Automatic deploy runs on every push to `main`.
- You can also run it manually from **Actions → Deploy static site to GitHub Pages → Run workflow**.

### Public URL
After first successful run, your game is available at:
- `https://<your-username>.github.io/<repo-name>/`

