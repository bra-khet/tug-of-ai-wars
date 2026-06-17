/**
 * TUG OF AI WARS — Retro 8-bit tug-of-war castle battle
 * Vanilla JS + HTML5 Canvas. No dependencies.
 *
 * Development phases (marked in code):
 *   PHASE 1: Foundation — canvas, screens, resources
 *   PHASE 2: Movement & combat — walk, attack, death, refund
 *   PHASE 3: Player unit specials (Glaze heal/gen, Nightshade castle dmg)
 *   PHASE 4: Enemy units + AI spawner
 *   PHASE 5: Full symmetry (either side playable)
 *   PHASE 6: Polish — visuals, HUD, win/lose
 */

'use strict';

// =============================================================================
// TUNABLE CONSTANTS — tweak balance here
// =============================================================================
const CONFIG = {
  canvas: { width: 960, height: 540 },

  castle: {
    maxHp: 2000,
    width: 72,
    height: 100,
    leftX: 24,
    rightX: 864, // 960 - 24 - 72
    groundY: 400,
  },

  lane: { y: 430 },

  resources: {
    startAmount: 60,
    passivePerSecond: 9,
    deathRefundPercent: 0.5,
    glazeBonusPerSecond: 4, // when actively healing/buffing
    dataMinerSteal: 6,
  },

  ai: {
    thinkInterval: 2.8, // seconds between spawn decisions
    waveChance: 0.22,   // chance to save up and spawn multiple cheap units
  },

  agi: {
    remoteCastleDps: 4, // damage per second to enemy castle while alive
  },

  colors: {
    human: {
      primary: '#4caf50',
      secondary: '#ff8f00',
      accent: '#8d6e63',
      castle: '#5d4037',
      castleTop: '#7cb342',
      ui: '#3d5c2e',
      uiBorder: '#7cb342',
    },
    robot: {
      primary: '#00bcd4',
      secondary: '#9c27b0',
      accent: '#607d8b',
      castle: '#37474f',
      castleTop: '#00acc1',
      ui: '#1a3a4a',
      uiBorder: '#00bcd4',
    },
    ground: '#3e5f2f',
    sky: '#87ceeb',
    hpGreen: '#4caf50',
    hpRed: '#f44336',
    hpYellow: '#ffeb3b',
    text: '#ffffff',
  },
};

// Unit definitions per side — symmetric structure, asymmetric stats
const UNIT_CATALOG = {
  human: {
    resourceName: 'Creativity',
    units: {
      orc_warrior: {
        name: 'Orc Warrior',
        short: 'Tank melee — cheap meat shield',
        cost: 25,
        hp: 130,
        damage: 9,
        castleDamage: 6,
        range: 38,
        speed: 48,
        attackCooldown: 1.0,
        role: 'melee',
      },
      pencil_thrower: {
        name: 'Pencil Thrower',
        short: 'Ranged DPS — medium cost',
        cost: 35,
        hp: 58,
        damage: 15,
        castleDamage: 8,
        range: 130,
        speed: 52,
        attackCooldown: 1.1,
        role: 'ranged',
      },
      glaze_support: {
        name: 'Glaze Support',
        short: 'Heals allies + bonus Creativity',
        cost: 55,
        hp: 72,
        damage: 5,
        castleDamage: 4,
        range: 85,
        speed: 42,
        attackCooldown: 2.0,
        role: 'support',
        healAmount: 10,
        healInterval: 2.0,
        healRadius: 90,
        damageReduction: 0.15, // buff on healed allies for 3s
      },
      nightshade_assassin: {
        name: 'Nightshade Assassin',
        short: 'Glass cannon — wrecks castles',
        cost: 75,
        hp: 42,
        damage: 11,
        castleDamage: 52,
        range: 42,
        speed: 62,
        attackCooldown: 0.85,
        role: 'assassin',
      },
    },
  },
  robot: {
    resourceName: 'Compute',
    units: {
      agent_swarmer: {
        name: 'Agent Swarmer',
        short: 'Fast cheap harasser',
        cost: 14,
        hp: 32,
        damage: 7,
        castleDamage: 4,
        range: 32,
        speed: 78,
        attackCooldown: 0.65,
        role: 'swarm',
      },
      armored_brute: {
        name: 'Armored Brute',
        short: 'Slow tank — resists ranged',
        cost: 38,
        hp: 165,
        damage: 11,
        castleDamage: 7,
        range: 36,
        speed: 28,
        attackCooldown: 1.25,
        role: 'tank',
        rangedResist: 0.45, // takes 45% less from ranged
      },
      data_miner: {
        name: 'Data Miner',
        short: 'Debuffs healing, steals Compute',
        cost: 42,
        hp: 52,
        damage: 8,
        castleDamage: 5,
        range: 52,
        speed: 56,
        attackCooldown: 1.4,
        role: 'debuffer',
        debuffDuration: 4,
        healingReduction: 0.5,
      },
      agi: {
        name: 'AGI',
        short: 'Ultimate — shields base, remote siege',
        cost: 175,
        hp: 100,
        damage: 0,
        castleDamage: 0,
        range: 0,
        speed: 0,
        attackCooldown: 999,
        role: 'agi',
        isStationary: true,
        shieldHp: 100,
      },
    },
  },
};

// Map side keys
const SIDE = { LEFT: 'left', RIGHT: 'right' };
const FACTION = { human: 'human', robot: 'robot' };

// =============================================================================
// DOM & CANVAS SETUP — PHASE 1
// =============================================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const overlay = document.getElementById('overlay');
const titleScreen = document.getElementById('title-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const spawnPanel = document.getElementById('spawn-panel');
const hud = document.getElementById('hud');
const spawnButtonsEl = document.getElementById('spawn-buttons');
const resourceLabelEl = document.getElementById('resource-label');
const resourceValueEl = document.getElementById('resource-value');
const resourceRateEl = document.getElementById('resource-rate');
const hudEnemyCastle = document.getElementById('hud-enemy-castle');
const hudAgi = document.getElementById('hud-agi');

// =============================================================================
// GAME STATE
// =============================================================================
let gameState = 'title'; // title | playing | gameover
let playerSide = SIDE.LEFT;
let lastTimestamp = 0;
let unitIdCounter = 0;
let floatingTexts = [];

const state = {
  castles: {
    left: { hp: CONFIG.castle.maxHp, maxHp: CONFIG.castle.maxHp, agiShield: 0 },
    right: { hp: CONFIG.castle.maxHp, maxHp: CONFIG.castle.maxHp, agiShield: 0 },
  },
  resources: { left: CONFIG.resources.startAmount, right: CONFIG.resources.startAmount },
  units: [],
  aiTimer: 0,
  playerFaction: FACTION.human,
  enemyFaction: FACTION.robot,
};

// =============================================================================
// HELPERS
// =============================================================================
function factionForSide(side) {
  return side === SIDE.LEFT ? FACTION.human : FACTION.robot;
}

function enemySide(side) {
  return side === SIDE.LEFT ? SIDE.RIGHT : SIDE.LEFT;
}

function isPlayerSide(side) {
  return side === playerSide;
}

function getCatalog(faction) {
  return UNIT_CATALOG[faction];
}

function spawnXForSide(side) {
  const c = CONFIG.castle;
  return side === SIDE.LEFT ? c.leftX + c.width + 8 : c.rightX - 8;
}

function directionForSide(side) {
  return side === SIDE.LEFT ? 1 : -1;
}

function resetGame() {
  state.castles.left = { hp: CONFIG.castle.maxHp, maxHp: CONFIG.castle.maxHp, agiShield: 0 };
  state.castles.right = { hp: CONFIG.castle.maxHp, maxHp: CONFIG.castle.maxHp, agiShield: 0 };
  state.resources.left = CONFIG.resources.startAmount;
  state.resources.right = CONFIG.resources.startAmount;
  state.units = [];
  state.aiTimer = 0;
  floatingTexts = [];
  unitIdCounter = 0;
}

function startGame(chosenSide) {
  playerSide = chosenSide;
  state.playerFaction = factionForSide(playerSide);
  state.enemyFaction = factionForSide(enemySide(playerSide));
  resetGame();
  gameState = 'playing';
  overlay.classList.remove('visible');
  titleScreen.classList.remove('active');
  gameoverScreen.classList.remove('active');
  spawnPanel.classList.remove('hidden');
  hud.classList.remove('hidden');
  buildSpawnUI();
  console.log('[PHASE 1] Game started — player:', playerSide, state.playerFaction);
}

function endGame(winnerSide) {
  gameState = 'gameover';
  const playerWon = winnerSide === playerSide;
  document.getElementById('gameover-title').textContent = playerWon ? 'VICTORY!' : 'DEFEAT!';
  document.getElementById('gameover-msg').textContent = playerWon
    ? 'The enemy castle has fallen!'
    : 'Your castle was destroyed...';
  overlay.classList.add('visible');
  titleScreen.classList.remove('active');
  gameoverScreen.classList.add('active');
  spawnPanel.classList.add('hidden');
  hud.classList.add('hidden');
}

// =============================================================================
// UNIT FACTORY — PHASE 2
// =============================================================================
function createUnit(side, typeKey) {
  const faction = factionForSide(side);
  const def = getCatalog(faction).units[typeKey];
  if (!def) return null;

  const id = ++unitIdCounter;
  const unit = {
    id,
    side,
    faction,
    typeKey,
    def: { ...def },
    x: spawnXForSide(side),
    y: CONFIG.lane.y + (id % 3) * 2 - 2, // tiny visual stagger
    hp: def.hp,
    maxHp: def.hp,
    cost: def.cost,
    damage: def.damage,
    castleDamage: def.castleDamage ?? def.damage,
    range: def.range,
    speed: def.speed,
    attackCooldown: def.attackCooldown,
    attackTimer: 0,
    healTimer: 0,
    supportActive: false,
    buffs: [], // { type, until, value }
    debuffs: [],
    alive: true,
    targetId: null,
    width: 20,
    height: 24,
    isAgi: def.role === 'agi',
    agiShield: def.shieldHp || 0,
  };

  if (unit.isAgi) {
    unit.x = side === SIDE.LEFT ? CONFIG.castle.leftX + 20 : CONFIG.castle.rightX + 40;
    // AGI shield overlays castle
    state.castles[side].agiShield = unit.agiShield;
  }

  return unit;
}

function spendResources(side, amount) {
  if (state.resources[side] < amount) return false;
  state.resources[side] -= amount;
  return true;
}

function refundOnDeath(unit) {
  const refund = Math.floor(unit.cost * CONFIG.resources.deathRefundPercent);
  state.resources[unit.side] += refund;
  addFloatingText(unit.x, unit.y - 20, `+${refund}`, '#ffeb3b');
}

function spawnUnit(side, typeKey, isPlayerAction = false) {
  const faction = factionForSide(side);
  const def = getCatalog(faction).units[typeKey];
  if (!def) return false;

  // Only one AGI per side
  if (def.role === 'agi') {
    const existing = state.units.find(u => u.alive && u.side === side && u.isAgi);
    if (existing) return false;
  }

  if (!spendResources(side, def.cost)) return false;

  const unit = createUnit(side, typeKey);
  state.units.push(unit);

  if (isPlayerAction) {
    addFloatingText(unit.x, unit.y - 30, def.name, '#fff');
  }
  return true;
}

// =============================================================================
// COMBAT & BUFFS — PHASE 2 & 3
// =============================================================================
function getEffectiveDamage(attacker, target, baseDmg) {
  let dmg = baseDmg;

  // Nightshade bonus vs castle handled at call site
  if (target.def.role === 'tank' && attacker.def.role === 'ranged' && target.def.rangedResist) {
    dmg *= 1 - target.def.rangedResist;
  }

  const drBuff = target.buffs.find(b => b.type === 'damageReduction' && b.until > performance.now());
  if (drBuff) dmg *= 1 - drBuff.value;

  return Math.max(1, Math.round(dmg));
}

function applyDebuff(target, type, duration, value) {
  const now = performance.now();
  target.debuffs = target.debuffs.filter(d => d.type !== type);
  target.debuffs.push({ type, until: now + duration * 1000, value });
}

function healUnit(unit, amount, healer) {
  const now = performance.now();
  const healDebuff = unit.debuffs.find(d => d.type === 'healingReduction' && d.until > now);
  let heal = amount;
  if (healDebuff) heal *= 1 - healDebuff.value;

  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + heal);
  if (unit.hp > before) {
    healer.supportActive = true;
    addFloatingText(unit.x, unit.y - 16, `+${Math.round(unit.hp - before)}`, '#81c784');
    // Apply damage reduction buff
    unit.buffs = unit.buffs.filter(b => b.type !== 'damageReduction');
    unit.buffs.push({
      type: 'damageReduction',
      until: now + 3000,
      value: healer.def.damageReduction || 0.15,
    });
  }
}

function findTarget(unit) {
  const dir = directionForSide(unit.side);
  const foes = state.units.filter(u => u.alive && u.side !== unit.side && !u.isAgi);

  let closest = null;
  let closestDist = Infinity;

  for (const foe of foes) {
    const dist = Math.abs(foe.x - unit.x);
    const inFront = dir > 0 ? foe.x > unit.x - 10 : foe.x < unit.x + 10;
    if (inFront && dist <= unit.range && dist < closestDist) {
      closest = foe;
      closestDist = dist;
    }
  }
  return closest;
}

function canReachEnemyCastle(unit) {
  const c = CONFIG.castle;
  const enemy = enemySide(unit.side);
  const castleX = enemy === SIDE.LEFT ? c.leftX + c.width / 2 : c.rightX + c.width / 2;
  return Math.abs(unit.x - castleX) <= unit.range + c.width / 2;
}

function attackCastle(unit, dt) {
  const enemy = enemySide(unit.side);
  const castle = state.castles[enemy];
  let dmg = unit.castleDamage * dt / unit.attackCooldown;

  // Nightshade-style: assassins chunk castles
  if (unit.def.role === 'assassin') {
    dmg = unit.castleDamage * dt / unit.attackCooldown;
  }

  // AGI shield absorbs first
  if (castle.agiShield > 0) {
    const agiUnit = state.units.find(u => u.alive && u.side === enemy && u.isAgi);
    const shieldDmg = Math.min(castle.agiShield, dmg);
    castle.agiShield -= shieldDmg;
    if (agiUnit) agiUnit.agiShield = castle.agiShield;
    dmg -= shieldDmg;
    if (castle.agiShield <= 0 && agiUnit) {
      killUnit(agiUnit, null);
      addFloatingText(agiUnit.x, agiUnit.y - 20, 'AGI DOWN!', '#ff5252');
    }
  }

  if (dmg > 0) {
    castle.hp = Math.max(0, castle.hp - dmg);
  }
}

function killUnit(unit, killer) {
  if (!unit.alive) return;
  unit.alive = false;
  refundOnDeath(unit);

  if (unit.isAgi) {
    state.castles[unit.side].agiShield = 0;
  }
}

function attackUnit(attacker, target, dt) {
  attacker.attackTimer -= dt;
  if (attacker.attackTimer > 0) return;

  attacker.attackTimer = attacker.attackCooldown;
  let dmg = attacker.damage;

  // Assassins are weaker vs units (use base damage, not castleDamage)
  dmg = getEffectiveDamage(attacker, target, dmg);
  target.hp -= dmg;
  addFloatingText(target.x, target.y - 12, `-${dmg}`, '#ef5350');

  // Data Miner special
  if (attacker.def.role === 'debuffer') {
    applyDebuff(target, 'healingReduction', attacker.def.debuffDuration, attacker.def.healingReduction);
    state.resources[attacker.side] += CONFIG.resources.dataMinerSteal;
    addFloatingText(attacker.x, attacker.y - 24, `+${CONFIG.resources.dataMinerSteal}`, '#ce93d8');
  }

  if (target.hp <= 0) {
    killUnit(target, attacker);
  }
}

function updateUnit(unit, dt) {
  if (!unit.alive) return;

  // AGI remote siege + stationary
  if (unit.isAgi) {
    const enemy = enemySide(unit.side);
    const castle = state.castles[enemy];
    const dps = CONFIG.agi.remoteCastleDps * dt;
    if (castle.agiShield > 0) {
      castle.agiShield = Math.max(0, castle.agiShield - dps);
      unit.agiShield = castle.agiShield;
      if (castle.agiShield <= 0) killUnit(unit, null);
    } else {
      castle.hp = Math.max(0, castle.hp - dps);
    }
    return;
  }

  unit.supportActive = false;

  // Glaze support heal
  if (unit.def.role === 'support') {
    unit.healTimer -= dt;
    if (unit.healTimer <= 0) {
      unit.healTimer = unit.def.healInterval;
      const allies = state.units.filter(
        u => u.alive && u.side === unit.side && !u.isAgi && u.id !== unit.id
      );
      for (const ally of allies) {
        const dist = Math.abs(ally.x - unit.x);
        if (dist <= unit.def.healRadius && ally.hp < ally.maxHp) {
          healUnit(ally, unit.def.healAmount, unit);
        }
      }
    }
  }

  const target = findTarget(unit);

  if (target) {
    unit.targetId = target.id;
    attackUnit(unit, target, dt);
    return; // stop to fight
  }

  unit.targetId = null;

  // Move toward enemy castle
  const dir = directionForSide(unit.side);
  const enemy = enemySide(unit.side);
  const castleEdge = enemy === SIDE.LEFT
    ? CONFIG.castle.leftX + CONFIG.castle.width
    : CONFIG.castle.rightX;

  const stopDist = unit.range;
  const distToCastle = Math.abs(unit.x - castleEdge);

  if (distToCastle > stopDist) {
    unit.x += dir * unit.speed * dt;
  } else if (canReachEnemyCastle(unit)) {
    attackCastle(unit, dt);
  }
}

// =============================================================================
// RESOURCE TICK — PHASE 1
// =============================================================================
function getResourceRate(side) {
  let rate = CONFIG.resources.passivePerSecond;
  for (const u of state.units) {
    if (u.alive && u.side === side && u.def.role === 'support' && u.supportActive) {
      rate += CONFIG.resources.glazeBonusPerSecond;
    }
  }
  return rate;
}

function tickResources(dt) {
  state.resources.left += getResourceRate(SIDE.LEFT) * dt;
  state.resources.right += getResourceRate(SIDE.RIGHT) * dt;
}

// =============================================================================
// AI SPAWNER — PHASE 4 (works for either faction)
// =============================================================================
function countUnitsByType(side, typeKey) {
  return state.units.filter(u => u.alive && u.side === side && u.typeKey === typeKey).length;
}

function countPlayerUnitsOnField() {
  return state.units.filter(u => u.alive && u.side === playerSide).length;
}

function aiChooseSpawn(aiSide) {
  const faction = factionForSide(aiSide);
  const catalog = getCatalog(faction);
  const res = state.resources[aiSide];
  const keys = Object.keys(catalog.units);

  // Priority weights — readable tuning block
  const weights = {};
  const playerUnitCount = countPlayerUnitsOnField();
  const playerUnits = state.units.filter(u => u.alive && u.side === playerSide);
  const playerSupports = playerUnits.filter(u => u.def.role === 'support').length;
  const playerAssassins = playerUnits.filter(u => u.def.role === 'assassin').length;
  const playerTanks = playerUnits.filter(u => u.def.role === 'melee' || u.def.role === 'tank').length;
  const playerSwarm = playerUnits.filter(u => u.def.role === 'swarm').length;
  const playerRanged = playerUnits.filter(u => u.def.role === 'ranged').length;

  for (const key of keys) {
    const def = catalog.units[key];
    if (res < def.cost) {
      weights[key] = 0;
      continue;
    }
    weights[key] = 1;

    // PHASE 5: symmetric counter-weights — same logic regardless of which faction AI plays
    if (def.role === 'swarm') weights[key] += playerSupports * 2 + playerRanged + (playerUnitCount > 8 ? 2 : 0);
    if (def.role === 'tank' || def.role === 'melee') weights[key] += playerAssassins * 2 + playerSwarm;
    if (def.role === 'ranged') weights[key] += playerTanks + playerSwarm * 0.5;
    if (def.role === 'debuffer') weights[key] += playerSupports * 1.5;
    if (def.role === 'support') weights[key] += playerTanks > 2 ? 2 : 0.8;
    if (def.role === 'assassin') weights[key] += playerTanks > 2 ? 2 : countUnitsByType(aiSide, key) < 1 ? 1.2 : 0.3;
    if (def.role === 'agi') {
      weights[key] = res >= def.cost * 1.1 ? 8 : 0;
      const hasAgi = state.units.some(u => u.alive && u.side === aiSide && u.isAgi);
      if (hasAgi) weights[key] = 0;
    }
  }

  // Wave: spam cheap units
  if (Math.random() < CONFIG.ai.waveChance) {
    const cheap = keys.find(k => catalog.units[k].cost <= 20 && res >= catalog.units[k].cost);
    if (cheap) return cheap;
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const key of keys) {
    roll -= weights[key];
    if (roll <= 0) return key;
  }
  return keys[0];
}

function updateAI(dt) {
  const aiSide = enemySide(playerSide);
  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;
  state.aiTimer = CONFIG.ai.thinkInterval + Math.random() * 1.2;

  const choice = aiChooseSpawn(aiSide);
  if (choice) {
    spawnUnit(aiSide, choice, false);
    console.log('[PHASE 4] AI spawned', choice, 'for', aiSide);
  }
}

// =============================================================================
// UI — PHASE 5 & 6
// =============================================================================
function buildSpawnUI() {
  const catalog = getCatalog(state.playerFaction);
  resourceLabelEl.textContent = catalog.resourceName;
  spawnButtonsEl.innerHTML = '';
  const colors = state.playerFaction === FACTION.human ? CONFIG.colors.human : CONFIG.colors.robot;

  for (const [key, def] of Object.entries(catalog.units)) {
    const btn = document.createElement('button');
    btn.className = 'spawn-btn';
    btn.dataset.type = key;
    btn.style.background = colors.ui;
    btn.style.borderColor = colors.uiBorder;
    btn.style.color = '#fff';
    btn.innerHTML = `<span class="name">${def.name}</span><span class="cost">${def.cost} ${catalog.resourceName}</span><span>${def.short}</span>`;
    btn.addEventListener('click', () => {
      if (gameState === 'playing') spawnUnit(playerSide, key, true);
    });
    spawnButtonsEl.appendChild(btn);
  }
}

function updateSpawnUI() {
  const catalog = getCatalog(state.playerFaction);
  const res = Math.floor(state.resources[playerSide]);
  resourceValueEl.textContent = res;
  resourceRateEl.textContent = `(+${getResourceRate(playerSide).toFixed(1)}/s)`;

  const buttons = spawnButtonsEl.querySelectorAll('.spawn-btn');
  buttons.forEach(btn => {
    const def = catalog.units[btn.dataset.type];
    btn.disabled = res < def.cost;
  });

  const enemy = enemySide(playerSide);
  const enemyCastle = state.castles[enemy];
  hudEnemyCastle.textContent = `Enemy Castle: ${Math.ceil(enemyCastle.hp)} / ${enemyCastle.maxHp}`;

  const enemyAgi = state.units.find(u => u.alive && u.side === enemy && u.isAgi);
  if (enemyAgi && enemyCastle.agiShield > 0) {
    hudAgi.classList.remove('hidden');
    hudAgi.textContent = `AGI Shield: ${Math.ceil(enemyCastle.agiShield)}`;
  } else {
    hudAgi.classList.add('hidden');
  }
}

function addFloatingText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
}

function updateFloatingTexts(dt) {
  floatingTexts = floatingTexts.filter(ft => {
    ft.life -= dt;
    ft.y -= 30 * dt;
    return ft.life > 0;
  });
}

// =============================================================================
// RENDERING — PHASE 6
// =============================================================================
function drawHealthBar(x, y, w, hp, maxHp) {
  const ratio = hp / maxHp;
  ctx.fillStyle = '#222';
  ctx.fillRect(x - w / 2, y, w, 5);
  ctx.fillStyle = ratio > 0.5 ? CONFIG.colors.hpGreen : ratio > 0.25 ? CONFIG.colors.hpYellow : CONFIG.colors.hpRed;
  ctx.fillRect(x - w / 2, y, w * ratio, 5);
}

function drawCastle(side) {
  const c = CONFIG.castle;
  const x = side === SIDE.LEFT ? c.leftX : c.rightX;
  const faction = factionForSide(side);
  const palette = faction === FACTION.human ? CONFIG.colors.human : CONFIG.colors.robot;
  const castle = state.castles[side];

  // Base blocks
  ctx.fillStyle = palette.castle;
  ctx.fillRect(x, c.groundY - c.height, c.width, c.height);
  // Battlements
  ctx.fillStyle = palette.castleTop;
  for (let i = 0; i < 5; i++) {
    const bx = x + i * 15;
    ctx.fillRect(bx, c.groundY - c.height - 12, 12, 12);
  }
  // Door
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + c.width / 2 - 10, c.groundY - 30, 20, 30);

  // AGI shield glow
  if (castle.agiShield > 0) {
    ctx.strokeStyle = '#e040fb';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 6, c.groundY - c.height - 18, c.width + 12, c.height + 24);
  }

  drawHealthBar(x + c.width / 2, c.groundY - c.height - 22, c.width, castle.hp, castle.maxHp);
}

function drawGround() {
  const { width, height } = CONFIG.canvas;
  ctx.fillStyle = CONFIG.colors.sky;
  ctx.fillRect(0, 0, width, CONFIG.castle.groundY - 40);
  // Simple pixel clouds
  ctx.fillStyle = '#fff';
  ctx.fillRect(120, 60, 48, 12);
  ctx.fillRect(140, 52, 32, 12);
  ctx.fillRect(600, 80, 56, 12);
  ctx.fillRect(620, 72, 40, 12);

  ctx.fillStyle = CONFIG.colors.ground;
  ctx.fillRect(0, CONFIG.castle.groundY, width, height - CONFIG.castle.groundY);
  // Lane line
  ctx.fillStyle = '#2e4d24';
  ctx.fillRect(0, CONFIG.lane.y + 14, width, 4);
}

function drawUnit(unit) {
  if (!unit.alive) return;
  const faction = unit.faction;
  const palette = faction === FACTION.human ? CONFIG.colors.human : CONFIG.colors.robot;
  const x = Math.round(unit.x) - unit.width / 2;
  const y = Math.round(unit.y) - unit.height;

  ctx.save();
  if (unit.side === SIDE.RIGHT) {
    // flip visual by drawing mirrored offsets — keep simple: same shapes, different colors
  }

  // Body
  ctx.fillStyle = palette.primary;
  ctx.fillRect(x, y + 8, unit.width, unit.height - 8);

  // Role-specific pixel details
  const role = unit.def.role;
  if (role === 'melee' || role === 'tank') {
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(x + 14, y, 4, 14); // sword / armor spike
    ctx.fillRect(x + 2, y + 10, 16, 4);
  } else if (role === 'ranged') {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + 2, y + 4, 16, 3);
    ctx.fillRect(x + 16, y + 2, 3, 10); // pencil/bow
  } else if (role === 'support') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 6, y + 2, 8, 8);
    ctx.fillStyle = '#e91e63';
    ctx.fillRect(x + 8, y + 4, 4, 6); // cross
    ctx.fillRect(x + 6, y + 6, 8, 2);
  } else if (role === 'assassin') {
    ctx.fillStyle = '#4a148c';
    ctx.fillRect(x + 4, y, 12, 10);
    ctx.fillStyle = '#76ff03';
    ctx.fillRect(x + 7, y + 3, 2, 2);
    ctx.fillRect(x + 11, y + 3, 2, 2); // skull eyes
  } else if (role === 'swarm') {
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(x + 4, y + 4, 12, 6);
  } else if (role === 'debuffer') {
    ctx.fillStyle = '#7b1fa2';
    ctx.fillRect(x + 6, y + 2, 8, 10); // flask
    ctx.fillRect(x + 8, y, 4, 4);
  } else if (role === 'agi') {
    ctx.fillStyle = '#e040fb';
    ctx.fillRect(x, y, unit.width, unit.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 4, y + 6, 12, 4);
    ctx.fillRect(x + 6, y + 4, 8, 8); // robot face
  }

  drawHealthBar(unit.x, y - 6, unit.width, unit.hp, unit.maxHp);

  // Debuff indicator
  const now = performance.now();
  if (unit.debuffs.some(d => d.until > now)) {
    ctx.fillStyle = '#9c27b0';
    ctx.fillRect(x, y - 12, 6, 6);
  }

  ctx.restore();
}

function render() {
  drawGround();
  drawCastle(SIDE.LEFT);
  drawCastle(SIDE.RIGHT);

  // Sort by y for slight depth
  const sorted = [...state.units].filter(u => u.alive).sort((a, b) => a.y - b.y);
  for (const unit of sorted) drawUnit(unit);

  for (const ft of floatingTexts) {
    ctx.globalAlpha = ft.life / ft.maxLife;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1;
  }

  // Center line marker
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(CONFIG.canvas.width / 2 - 1, CONFIG.castle.groundY, 2, CONFIG.canvas.height - CONFIG.castle.groundY);
}

// =============================================================================
// MAIN LOOP
// =============================================================================
function update(dt) {
  if (gameState !== 'playing') return;

  tickResources(dt);
  updateAI(dt);

  for (const unit of state.units) {
    updateUnit(unit, dt);
  }

  // Cull dead units (keep array small for 60 FPS with 50+ units)
  if (state.units.some(u => !u.alive)) {
    state.units = state.units.filter(u => u.alive);
  }

  updateFloatingTexts(dt);
  updateSpawnUI();

  // Win check
  if (state.castles.left.hp <= 0) endGame(SIDE.RIGHT);
  else if (state.castles.right.hp <= 0) endGame(SIDE.LEFT);
}

function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// =============================================================================
// INPUT / SCREEN FLOW — PHASE 5
// =============================================================================
document.getElementById('btn-side-left').addEventListener('click', () => startGame(SIDE.LEFT));
document.getElementById('btn-side-right').addEventListener('click', () => startGame(SIDE.RIGHT));
document.getElementById('btn-play-again').addEventListener('click', () => {
  gameState = 'title';
  overlay.classList.add('visible');
  gameoverScreen.classList.remove('active');
  titleScreen.classList.add('active');
  spawnPanel.classList.add('hidden');
  hud.classList.add('hidden');
});

// Boot
console.log('[PHASE 1] Tug of AI Wars loaded — pick a side to begin.');
requestAnimationFrame(gameLoop);