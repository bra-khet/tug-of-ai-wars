# Tug of AI Wars

A retro 8-bit tug-of-war castle battle built with vanilla HTML5 Canvas and JavaScript. No build tools, no dependencies — open `index.html` and play.

## How to Play

1. Open `index.html` in any modern browser (double-click or drag into a tab).
2. Choose **Human Resistance** (left) or **Robot Legion** (right).
3. Spend **Creativity** or **Compute** to spawn units from the bottom panel.
4. Destroy the enemy castle before yours falls.

### Human Resistance (Left)

| Unit | Role |
|------|------|
| Orc Warrior | Cheap tank — soak damage |
| Pencil Thrower | Ranged DPS |
| Glaze Support | Heals allies, generates bonus resources while healing |
| Nightshade Assassin | Fragile but devastating vs enemy castle |

### Robot Legion (Right)

| Unit | Role |
|------|------|
| Agent Swarmer | Fast, cheap harasser |
| Armored Brute | Tank — resists ranged damage |
| Data Miner | Reduces enemy healing, steals resources on hit |
| AGI | Ultimate — shields your castle and sieges the enemy remotely |

### Core Rules

- Resources passively regenerate every second.
- Units refund **50%** of their cost when they die.
- Units walk toward the enemy, stop to fight, then push to the enemy castle.
- The AI opponent spawns units on a timer with simple counter-priority logic.

## Run Locally

```bash
# Option 1: open directly
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux

# Option 2: simple static server (optional)
npx serve .
# or
python -m http.server 8080
```

Then visit `http://localhost:8080` (if using a server).

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to `Deploy from a branch`.
4. Choose `main` (or `master`) and `/ (root)`.
5. Save. Your game will be live at `https://<username>.github.io/<repo>/`.

Because everything is static, GitHub Pages serves `index.html` automatically.

## Tuning Balance

Edit the `CONFIG` and `UNIT_CATALOG` objects at the top of `script.js`:

- Resource rates and death refund %
- Castle HP
- Unit costs, damage, HP, speed
- AI think interval and spawn weights (`aiChooseSpawn`)

## File Structure

```
index.html   — Canvas, overlays, spawn UI
style.css    — Retro chunky UI styling
script.js    — Game logic, rendering, AI
README.md    — This file
```

## License

MIT — hack freely.