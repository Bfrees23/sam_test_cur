// Ultra-detailed pixel art — heroes, monsters, NPCs
// '.' = transparent

export const OUTLINE = '#0e0c18';

// ===== PALETTES =====
export const RACE_PALETTE = {
  human:     { skin: ['#ffe8d0', '#f0c8a0', '#c89868', '#a07048'], hair: ['#8a6840', '#6a5030', '#4a3020', '#2a1808'] },
  elf:       { skin: ['#fff8f0', '#f0e0d0', '#d8c0a0', '#b89878'], hair: ['#ffe878', '#e8c050', '#c89830', '#987020'] },
  dark_elf:  { skin: ['#f0d8e8', '#d0b0c8', '#a88898', '#886878'], hair: ['#ffffff', '#e8e8ff', '#c0c0e0', '#9090b8'] },
  orc:       { skin: ['#98c878', '#78a858', '#588838', '#386820'], hair: ['#4a5a30', '#3a4a20', '#2a3a10', '#1a2808'] },
  dwarf:     { skin: ['#f8d8a8', '#e0b880', '#c09060', '#987048'], hair: ['#cc8844', '#aa6633', '#884422', '#663311'] },
};

export const CLASS_PALETTE = {
  warrior:   { armor: ['#b8c8d8', '#8899aa', '#556677', '#334455'], trim: '#ffd700', cape: '#2a3a4a', accent: '#e8f0ff', glow: '#88bbff' },
  gladiator: { armor: ['#dd9955', '#bb6622', '#883311', '#662200'], trim: '#ffaa44', cape: '#661810', accent: '#ffcc88', glow: '#ff8844' },
  mystic:    { armor: ['#aa88dd', '#7755bb', '#443388', '#221166'], trim: '#cc99ff', cape: '#1a0844', accent: '#ddbbff', glow: '#bb66ff' },
  cleric:    { armor: ['#ffffff', '#e8e8ff', '#c8c8dd', '#a0a0bb'], trim: '#ffd700', cape: '#8888aa', accent: '#ffffcc', glow: '#ffff88' },
  rogue:     { armor: ['#666680', '#44445a', '#2a2a3a', '#1a1a28'], trim: '#aaaacc', cape: '#12121e', accent: '#ccddee', glow: '#6688aa' },
  archer:    { armor: ['#88aa66', '#668844', '#446633', '#2a4422'], trim: '#ccdd88', cape: '#1a3318', accent: '#aadd66', glow: '#88cc44' },
};

// ===== GRID UTILS =====
function grid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill('.'));
}

function rowsToStrings(rows) {
  return rows.map(r => (Array.isArray(r) ? r.join('') : r));
}

function stamp(target, overlay, ox = 0, oy = 0) {
  for (let y = 0; y < overlay.length; y++) {
    for (let x = 0; x < overlay[y].length; x++) {
      const ch = overlay[y][x];
      if (ch === '.' || ch === ' ') continue;
      const ty = oy + y, tx = ox + x;
      if (ty >= 0 && ty < target.length && tx >= 0 && tx < target[0].length) {
        target[ty][tx] = ch;
      }
    }
  }
}

function parseLines(lines) {
  return lines.map(l => l.split(''));
}

function flipLegs(rows, frame) {
  const g = rows.map(r => [...r]);
  const legY = g.length - 6;
  if (frame === 1) {
    for (let y = legY; y < g.length; y++) {
      const line = g[y].join('');
      if (line.includes('B') || line.includes('t')) {
        g[y] = line
          .replace('kBB....BBk', 'kBB..BBk..')
          .replace('kBB..BBk', 'kBBB..BBk')
          .split('');
      }
    }
  }
  return g;
}

// ===== HERO BUILDER =====
const PW = 32, PH = 40;

function buildHeroPalette(raceId, classId) {
  const race = RACE_PALETTE[raceId] || RACE_PALETTE.human;
  const cls = CLASS_PALETTE[classId] || CLASS_PALETTE.warrior;
  const [s1, s2, s3, s4] = race.skin;
  const [h1, h2, h3, h4] = race.hair;
  const [a1, a2, a3, a4] = cls.armor;

  const pal = {
    K: OUTLINE,
    H: h1, h: h2, i: h3, u: h4,
    S: s1, s: s2, j: s3, n: s4,
    A: a1, a: a2, b: a3, v: a4,
    T: cls.trim, C: cls.cape, c: cls.cape,
    G: cls.accent, g: cls.glow,
    W: '#eef8ff', w: '#aaccee', l: '#ffffff',
    M: '#aa8866', m: '#886644',
    D: '#ddddee', d: '#9999aa',
    B: '#553311', t: '#442200', f: '#332200',
    P: cls.glow, p: cls.accent,
    R: '#ff5544', r: '#cc2211', e: '#ffcc22',
    E: raceId === 'dark_elf' ? '#ff2244' : '#2266cc',
    O: raceId === 'orc' ? s1 : '#ffdd44',
    o: raceId === 'orc' ? s2 : '#ccaa22',
    X: '#ff6600', x: '#cc4400',
    Q: '#44ffaa', q: '#22cc88',
    Y: '#ffffaa',
  };

  if (raceId === 'orc') pal.T = '#eeeecc';
  return pal;
}

function drawHeroHead(g, raceId) {
  const head = parseLines([
    '..........kkkkkkkkkkkk..........',
    '........kkHHHHHHHHHHHHkk........',
    '.......kHHiiiiiiiiiiiiHHk.......',
    '......kHHiSSSSSSSSSSSSiHHk......',
    '.....kHHiSsEESSSSSSEEsSiHHk.....',
    '.....kHHiSsSSSSSSSSSSsSiHHk.....',
    '......kHiSSSSSSSSSSSSSSiHk......',
    '.......kHHiiiiiiiiiiiiHHk.......',
    '........kkHHHHHHHHHHHHkk........',
    '..........kkkkkkkkkkkk..........',
  ]);

  if (raceId === 'elf') {
    stamp(head, parseLines([
      '....k......................k....',
      '...kHk....................kHk...',
      '..kHHk...................kHHk..',
      '..kHk.....................kHk..',
    ]));
  } else if (raceId === 'dark_elf') {
    stamp(head, parseLines([
      '.......kHHHHHHHHHHHHHHHHk.......',
      '......kHHiiiiiiiiiiiiiiHHk......',
    ]));
  } else if (raceId === 'orc') {
    const orcHead = parseLines([
      '..........kkkkkkkkkkkk..........',
      '........kkOOOOOOOOOOOkk........',
      '.......kOOiiiiiiiiiiiOOk.......',
      '......kOOiSSSSSSSSSSSiOOk......',
      '.....kOOiSsEESSSSSSEEsSiOOk.....',
      '.....kOOiSsTTSSSSSSTTsSiOOk.....',
      '......kOOiSSSSSSSSSSSiOOk......',
      '.......kOOiiiiiiiiiiiOOk.......',
      '........kkOOOOOOOOOOOkk........',
      '..........kkkkkkkkkkkk..........',
    ]);
    stamp(g, orcHead, 0, 0);
    return;
  } else if (raceId === 'dwarf') {
    stamp(head, parseLines([
      '......kHHHHHHHHHHHHHHHHk......',
      '.....kHHiSSSSSSSSSSSSiHHk.....',
      '.....kHHiSSBBBBBBBBSSiHHk.....',
      '.....kHHiSBBBBBBBBBBSSiHHk.....',
      '.....kHHiSBBBBBBBBBBSSiHHk.....',
      '.....kHHiSSBBBBBBBBSSiHHk.....',
    ]), 0, 2);
  }

  stamp(g, head, 0, 0);
}

function drawHeroTorso(g, classId) {
  const torsos = {
    warrior: [
      '.....kCCCCCCCCCCCCCCCCk.....',
      '....kCAAAAAAATTAAAAAAACk....',
      '...kCAAAAAAATTAAAAAAAACk...',
      '...kCAaAAAAAAAAAAAAAaACk...',
      '...kCAaAAvvvvvvvvvvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '..kCCAaAAvAAAAAAAAvAAaACCk..',
      '..kCCAaAAvAAAAAAAAvAAaACCk..',
      '..kBBaAAvAAAAAAAAvAAaABBk..',
      '..kBBaAAvAAAAAAAAvAAaABBk..',
      '...kBBaAAvAAAAAAAAvAAaBBk...',
    ],
    gladiator: [
      '.....kCCCCCCCCCCCCCCCCk.....',
      '....kCSSSSSSSSTTSSSSSSCk....',
      '...kCSSSSSSSSTTSSSSSSSCk...',
      '...kCSsAAAAAAAAAAAAAAaSCk...',
      '...kCSsAAvvvvvvvvvvAAaSCk...',
      '...kCSsAAAAAAAAAAAAAAaSCk...',
      '...kCSsAAAAAAAAAAAAAAaSCk...',
      '..kCCSsAAAAAAAAAAAAAASSCCk..',
      '..kCCSsAAAAAAAAAAAAAASSCCk..',
      '..kBBsAAAAAAAAAAAAAAaSBBk..',
      '..kBBsAAAAAAAAAAAAAAaSBBk..',
      '...kBBsAAAAAAAAAAAAAAaBBk...',
    ],
    mystic: [
      '.....kPPPPPPPPPPPPPPPPk.....',
      '....kCppppppppppppppppCk....',
      '...kCpppCCCCCCCCCCCCppCk...',
      '...kCppCCbbbbbbbbbbCCppCk...',
      '...kCppCCbbPPPPPPbbCCppCk...',
      '...kCppCCbbPPPPPPbbCCppCk...',
      '...kCppCCbbbbbbbbbbCCppCk...',
      '...kCppCCbbbbbbbbbbCCppCk...',
      '...kCppCCbbbbbbbbbbCCppCk...',
      '..kCCppCCbbbbbbbbbbCCppCCk..',
      '..kCCppCCbbbbbbbbbbCCppCCk..',
      '...kCCppCCCCCCCCCCCCppCCk...',
    ],
    cleric: [
      '.....kYYYYYYYYYYYYYYYYk.....',
      '....kCAAAAAAAAAATTAAAACk....',
      '...kCAAAAAAAAAATTAAAAACk...',
      '...kCAaAAAAAAAAAAAAAAaACk...',
      '...kCAaAAvvvvvvvvvvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '..kCCAaAAvAAAAAAAAvAAaACCk..',
      '..kCCAaAAvAAAAAAAAvAAaACCk..',
      '...kCCAAAAAAAAAAAAAAAACCk...',
    ],
    rogue: [
      '.....kcccccccccccccccck.....',
      '....kcbbbbbbbbbbbbbbbbck....',
      '...kcbbvvvvvvvvvvvvvvbbck...',
      '...kcbbvbbbbbbbbbbbbvbbck...',
      '...kcbbvbbbbbbbbbbbbvbbck...',
      '...kcbbvbbbbbbbbbbbbvbbck...',
      '...kcbbvbbbbbbbbbbbbvbbck...',
      '...kcbbvbbbbbbbbbbbbvbbck...',
      '...kcbbvbbbbbbbbbbbbvbbck...',
      '..kccbbvbbbbbbbbbbbbvbbcck..',
      '..kccbbvbbbbbbbbbbbbvbbcck..',
      '...kccbbbbbbbbbbbbbbbbcck...',
    ],
    archer: [
      '.....kCCCCCCCCCCCCCCCCk.....',
      '....kCAAAAAAAAAATTAAAACk....',
      '...kCAAAAAAAAAATTAAAAACk...',
      '...kCAaAAAAAAAAAAAAAAaACk...',
      '...kCAaAAvvvvvvvvvvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '...kCAaAAvAAAAAAAAvAAaACk...',
      '..kCCAaAAvAAAAAAAAvAAaACCk..',
      '..kCCAaAAvAAAAAAAAvAAaACCk..',
      '...kCCAAAAAAAAAAAAAAAACCk...',
    ],
  };
  stamp(g, parseLines(torsos[classId] || torsos.warrior), 0, 10);
}

function drawHeroLegs(g, frame) {
  const legs = frame === 0
    ? parseLines([
      '..........kBB....BBk..........',
      '..........kBB....BBk..........',
      '..........kBB....BBk..........',
      '...........kBB..BBk...........',
      '...........kBB..BBk...........',
      '...........ktt..ttk...........',
      '............kk..kk............',
      '.............kkkk.............',
    ])
    : parseLines([
      '..........kBB....BBk..........',
      '..........kBB....BBk..........',
      '...........kBB..BBk...........',
      '...........kBB..BBk...........',
      '............kBBBBk............',
      '...........ktt..ttk...........',
      '............kk..kk............',
      '.............kkkk.............',
    ]);
  stamp(g, legs, 0, PH - legs.length);
}

function drawHeroWeapon(g, classId, frame) {
  const weapons = {
    warrior: [
      '................Ww................',
      '................Ww................',
      '................Ww................',
      '................Ww................',
      '................Ww................',
      '...............lWwl...............',
      '..............kWwwWk..............',
      '.............kWwwwwWk.............',
      '............kWwwwwwwWk............',
      '...........kWwwwwwwwWk...........',
      '..........kWwwwwwwwwwWk..........',
      '.........kWwwwwwwwwwwwWk.........',
      '........kWwwwwwwwwwwwwwWk........',
      '.......kWwwwwwwwwwwwwwwwWk.......',
      '......kWwwwwwwwwwwwwwwwwwWk......',
      '.....kDllllllllllllllllllDk.....',
      '....kDDDDDDDDDDDDDDDDDDDDDDk....',
    ],
    gladiator: [
      '..............kWwwwwWk..............',
      '.............kWwwwwwwwWk.............',
      '............kWwwwwwwwwwWk............',
      '...........kWwwwwwwwwwwwWk...........',
      '..........kWwwwwwwwwwwwwwWk..........',
      '.........kWwwwwwwwwwwwwwwwWk.........',
      '........kWwwwwwwwwwwwwwwwwwWk........',
      '.......kWwwwwwwwwwwwwwwwwwwwWk.......',
      '......kWwwwwwwwwwwwwwwwwwwwwwWk......',
      '.....kWwwwwwwwwwwwwwwwwwwwwwwwWk.....',
      '....kWwwwwwwwwwwwwwwwwwwwwwwwwwWk....',
      '...kWwwwwwwwwwwwwwwwwwwwwwwwwwwwWk...',
      '..kWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWk..',
      '.kWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWk.',
      'kWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWk',
      'kDlllllllllllllllllllllllllllllllllDk',
      'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
    ],
    mystic: [
      '..............kPPk..............',
      '.............kPPPPk.............',
      '............kPPggPPk............',
      '...........kPPggggPPk...........',
      '..........kPPggPPggPPk..........',
      '.........kPPggPPPPggPPk.........',
      '........kPPggPPPPPPggPPk........',
      '.......kPPggPPPPPPPPggPPk.......',
      '......kPPggPPPPPPPPPPggPPk......',
      '.....kPPggPPPPPPPPPPPPggPPk.....',
      '....kPPggPPPPPPPPPPPPPPggPPk....',
      '...kPPggPPPPPPPPPPPPPPPPggPPk...',
      '..kPPggPPPPPPPPPPPPPPPPPPggPPk..',
      '.kPPggPPPPPPPPPPPPPPPPPPPPggPPk.',
      'kPPggPPPPPPPPPPPPPPPPPPPPPPggPPk',
      'kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk',
      'kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk',
    ],
    cleric: [
      '..............kPPk..............',
      '.............kPPPPk.............',
      '............kPPYYPPk............',
      '...........kPPYYYYPPk...........',
      '..........kPPYYYYYYPPk..........',
      '.........kPPYYYYYYYYPPk.........',
      '........kPPYYYYYYYYYYPPk........',
      '.......kPPYYYYYYYYYYYYPPk.......',
      '......kPPYYYYYYYYYYYYYYPPk......',
      '.....kPPYYYYYYYYYYYYYYYYPPk.....',
      '....kPPYYYYYYYYYYYYYYYYYYPPk....',
      '...kPPYYYYYYYYYYYYYYYYYYYYPPk...',
      '..kPPYYYYYYYYYYYYYYYYYYYYYYPPk..',
      '.kPPYYYYYYYYYYYYYYYYYYYYYYYYPPk.',
      'kPPYYYYYYYYYYYYYYYYYYYYYYYYYYPPk',
      'kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk',
      'kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk',
    ],
    rogue: [
      '................dd................',
      '................dd................',
      '...............lddl...............',
      '..............kdddk..............',
      '.............kdddddWk.............',
      '............kddddddWWk............',
      '...........kdddddddWWWk...........',
      '..........kddddddddWWWWk..........',
      '.........kdddddddddWWWWWk.........',
      '........kddddddddddWWWWWWk........',
      '.......kdddddddddddWWWWWWWk.......',
      '......kddddddddddddWWWWWWWWk......',
      '.....kdddddddddddddWWWWWWWWWk.....',
      '....kddddddddddddddWWWWWWWWWWk....',
      '...kdddddddddddddddWWWWWWWWWWWk...',
      '..kddddddddddddddddWWWWWWWWWWWWk..',
      '.kdddddddddddddddddWWWWWWWWWWWWWk.',
    ],
    archer: [
      '....m........................m....',
      '...mMm......................mMm...',
      '..mMMm....................mMMm..',
      '.mMMMm...................mMMMm.',
      'mMMMMm.................mMMMMm',
      '.mMMMm.................mMMMm.',
      '..mMMm.................mMMm..',
      '...mMm.................mMm...',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
      '....m...................m....',
    ],
  };

  const layer = parseLines(weapons[classId] || weapons.warrior);
  if (classId === 'cleric') {
    stamp(g, parseLines([
      '..............kDDk..............',
      '.............kDDDDk.............',
      '............kDDDDDDk............',
      '...........kDDDDDDDDk...........',
      '..........kDDDDDDDDDDk..........',
      '.........kDDDDDDDDDDDDk.........',
      '........kDDDDDDDDDDDDk........',
    ]), 0, 18);
  }
  stamp(g, layer, 0, 0);
}

function buildPlayerFrames(raceId, classId) {
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const g = grid(PW, PH);
    drawHeroHead(g, raceId);
    drawHeroTorso(g, classId);
    drawHeroLegs(g, f);
    drawHeroWeapon(g, classId, f);
    if (raceId === 'dwarf') {
      // Shorter legs — stamp boots higher
      stamp(g, parseLines([
        '..........kBB....BBk..........',
        '..........kBB....BBk..........',
        '...........kBB..BBk...........',
        '...........kff..ffk...........',
        '............kk..kk............',
      ]), 0, PH - 5);
    }
    frames.push(rowsToStrings(g));
  }

  return {
    palette: buildHeroPalette(raceId, classId),
    frames,
    w: PW,
    h: PH,
    scale: 3.0,
    glow: CLASS_PALETTE[classId]?.glow || '#ffffff',
  };
}

export function getPlayerSprite(raceId, classId) {
  const key = `${raceId}_${classId}`;
  if (!getPlayerSprite.cache) getPlayerSprite.cache = {};
  if (!getPlayerSprite.cache[key]) {
    getPlayerSprite.cache[key] = buildPlayerFrames(raceId, classId);
  }
  return getPlayerSprite.cache[key];
}

// ===== MONSTER SPRITES =====
function mkSprite(w, h, scale, palette, frameLines) {
  const frames = frameLines.map(lines => {
    const maxW = Math.max(w, ...lines.map(l => l.length));
    return lines.map(l => l.padEnd(maxW, '.').split(''));
  }).map(rowsToStrings);
  return { w, h, scale, palette, frames };
}

export const MONSTER_SPRITES = {
  gremlin: mkSprite(26, 28, 2.8, {
    K: OUTLINE, G: '#7acc7a', g: '#4aaa5a', d: '#2a7a3a', l: '#9aee9a',
    E: '#ffee22', e: '#ccaa00', p: '#ff4444', B: '#664422', b: '#442211',
    Y: '#aadd66',
  }, [
    [
      '...........kkkkkkkk...........',
      '.........kkGGGGGGGGkk.........',
      '.......kkGGggggggggGGkk.......',
      '......kGGgEEEEEEEEggGGk......',
      '.....kGGgEEppEEppEEggGGk.....',
      '....kGGggEEEEEEEEEEggGGk....',
      '....kGGggGGGGGGGGGGggGGk....',
      '...kGGggGG......GGggGGk...',
      '...kYYggGG......GGggYYk...',
      '..kGGggGG......GGggGGk..',
      '..kGGggGG......GGggGGk..',
      '..kBBggGG......GGggBBk..',
      '..kBBggGG......GGggBBk..',
      '...kBBggGG....GGggBBk...',
      '...kBBggGG....GGggBBk...',
      '....kBBggGG..GGggBBk....',
      '.....kBBggGGGGggBBk.....',
      '......kBBggggggBBk......',
      '.......kBBggggBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
      '...........kk...........',
    ],
    [
      '...........kkkkkkkk...........',
      '.........kkGGGGGGGGkk.........',
      '.......kkGGggggggggGGkk.......',
      '......kGGgEEEEEEEEggGGk......',
      '.....kGGgEEppEEppEEggGGk.....',
      '....kGGggEEEEEEEEEEggGGk....',
      '....kGGggGGGGGGGGGGggGGk....',
      '...kGGggGG......GGggGGk...',
      '...kYYggGG......GGggYYk...',
      '..kGGggGG......GGggGGk..',
      '..kBBggGG......GGggBBk..',
      '...kBBggGG....GGggBBk...',
      '....kBBggGG..GGggBBk....',
      '.....kBBggGGGGggBBk.....',
      '......kBBggggggBBk......',
      '.......kBBggggBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
      '...........kk...........',
    ],
  ]),

  keltir: mkSprite(36, 24, 2.5, {
    K: OUTLINE, Y: '#ddbb44', y: '#bb9922', d: '#997711', l: '#ffee88',
    E: '#111111', W: '#ffffff', B: '#553311', b: '#442200', M: '#ccaa55',
  }, [
    [
      '.............kkkkkkkkkkkk.............',
      '...........kkYYYYYYYYYYkk...........',
      '.........kkYYYYMMMMMMMMYYkk.........',
      '.......kkYYYYYYWWWWYYYYYYkk.......',
      '......kYYYYYYEYYYYYYEYYYYYk......',
      '.....kYYYYYYYYYYYYYYYYYYYYYk.....',
      '....kYYYYYYYYYYYYYYYYYYYYYYk....',
      '...kYYk................kYYk...',
      '...kYYk................kYYk...',
      '..kBBk..................kBBk..',
      '..kBBk..................kBBk..',
      '.kBBk....................kBBk.',
      'kBBk......................kBBk',
      'kBBk......................kBBk',
    ],
    [
      '.............kkkkkkkkkkkk.............',
      '...........kkYYYYYYYYYYkk...........',
      '.........kkYYYYMMMMMMMMYYkk.........',
      '.......kkYYYYYYWWWWYYYYYYkk.......',
      '......kYYYYYYEYYYYYYEYYYYYk......',
      '.....kYYYYYYYYYYYYYYYYYYYYYk.....',
      '....kYYYYYYYYYYYYYYYYYYYYYYk....',
      '...kYYk................kYYk...',
      '.kBBk....................kBBk.',
      'kBBk......................kBBk',
      'kBBk......................kBBk',
      '..kBBk..................kBBk..',
      '...kBBk................kBBk...',
    ],
  ]),

  wolf: mkSprite(38, 26, 2.4, {
    K: OUTLINE, W: '#bbbbbb', w: '#888888', d: '#555555', l: '#dddddd',
    E: '#ffcc22', e: '#111111', N: '#eeeeee', B: '#444444', R: '#aa4444',
  }, [
    [
      '..............kkkkkkkkkkkk..............',
      '............kkWWWWWWWWWWkk............',
      '..........kkWWwwwwwwwwWWkk..........',
      '........kkWWwwNNNNNNwwWWkk........',
      '......kkWWwwNEWWWWWNwwWWkk......',
      '.....kWWwwWWWWWWWWWWWWwwWk.....',
      '....kWWwwWWWWWWWWWWWWWWwwWk....',
      '...kWWk................kWWk...',
      '...kWWk................kWWk...',
      '..kBBk..................kBBk..',
      '..kBBk..................kBBk..',
      '.kBBk....................kBBk.',
      'kBBk......................kBBk',
      'kBBk......................kBBk',
      '.kRk......................kRk.',
    ],
    [
      '..............kkkkkkkkkkkk..............',
      '............kkWWWWWWWWWWkk............',
      '..........kkWWwwwwwwwwWWkk..........',
      '........kkWWwwNNNNNNwwWWkk........',
      '......kkWWwwNEWWWWWNwwWWkk......',
      '.....kWWwwWWWWWWWWWWWWwwWk.....',
      '....kWWwwWWWWWWWWWWWWWWwwWk....',
      '...kWWk................kWWk...',
      '.kBBk....................kBBk.',
      'kBBk......................kBBk',
      'kBBk......................kBBk',
      '..kBBk..................kBBk..',
      '...kBBk................kBBk...',
      '....kRk..................kRk....',
    ],
  ]),

  orc: mkSprite(28, 36, 2.7, {
    K: OUTLINE, O: '#78aa58', o: '#589838', d: '#386820', l: '#98cc78',
    E: '#ffee00', T: '#eeeecc', W: '#bbbbbb', w: '#777777', L: '#dddddd',
    B: '#553311', b: '#442200', R: '#aa6644', A: '#666655',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkOOOOOOOOOOOkk........',
      '.......kOOllllllllllOOk.......',
      '......kOOlEEEEEEEElOOk......',
      '.....kOOlETTTTTTTTlOOk.....',
      '.....kOOlOTTTTTTTTlOOk.....',
      '....kOOllOOOOOOOOllOOk....',
      '....kOOooOOOOOOOOooOOk....',
      '...kOOooOOOOOOOOooOOk...',
      '...kOOooOA....AOooOOk...',
      '...kOOooOA....AOooOOk...',
      '..kOOooOA..WW..AOooOOk..',
      '..kOOooOA..WW..AOooOOk..',
      '..kBBooOA......AOooBBk..',
      '..kBBooOA......AOooBBk..',
      '...kBBooOA....AOooBBk...',
      '...kBBooOA....AOooBBk...',
      '....kBBooOA..AOooBBk....',
      '.....kBBooOAOooBBk.....',
      '......kBBooooBBk......',
      '.......kBBooBBk.......',
      '........kBBBBk........',
      '.........kBBk.........',
      '..........kk..........',
    ],
    [
      '..........kkkkkkkkkkkk..........',
      '........kkOOOOOOOOOOOkk........',
      '.......kOOllllllllllOOk.......',
      '......kOOlEEEEEEEElOOk......',
      '.....kOOlETTTTTTTTlOOk.....',
      '.....kOOlOTTTTTTTTlOOk.....',
      '....kOOllOOOOOOOOllOOk....',
      '....kOOooOOOOOOOOooOOk....',
      '...kOOooOA....AOooOOk...',
      '..kOOooOA..WW..AOooOOk..',
      '..kBBooOA......AOooBBk..',
      '...kBBooOA....AOooBBk...',
      '....kBBooOAOooBBk....',
      '.....kBBooooBBk.....',
      '......kBBooBBk......',
      '.......kBBBBk.......',
      '........kBBk........',
      '.........kk.........',
    ],
  ]),

  orc_archer: mkSprite(28, 36, 2.7, {
    K: OUTLINE, O: '#68a048', o: '#488028', d: '#286010', l: '#88c068',
    E: '#ffee00', T: '#eeeecc', W: '#aa8866', w: '#886644', B: '#553311',
    R: '#aa6644', M: '#664422',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkOOOOOOOOOOOkk........',
      '.......kOOllllllllllOOk.......',
      '......kOOlEEEEEEEElOOk......',
      '.....kOOlETTTTTTTTlOOk.....',
      '....kOOllOOOOOOOOllOOk....',
      '...kOOooOOOOOOOOooOOk...',
      '..kOOooOA....AOooOOk..',
      '..kOOooOA....AOooOOk..',
      '.kOOooOA..M..AOooOOk.',
      'kOOooOA..MMM..AOooOOk',
      '.kM................M.',
      '..kM..............Mk..',
      '...kM............Mk...',
      '....kM..........Mk....',
      '.....kM........Mk.....',
      '......kM......Mk......',
      '.......kM....Mk.......',
      '........kM..Mk........',
      '.........kMMk.........',
      '..........kk..........',
      '...kBB..........BBk...',
      '...kBB..........BBk...',
      '....kBB........BBk....',
      '.....kBB......BBk.....',
      '......kBB....BBk......',
      '.......kBBBBBBk.......',
    ],
    [
      '..........kkkkkkkkkkkk..........',
      '........kkOOOOOOOOOOOkk........',
      '.......kOOllllllllllOOk.......',
      '......kOOlEEEEEEEElOOk......',
      '.....kOOlETTTTTTTTlOOk.....',
      '....kOOllOOOOOOOOllOOk....',
      '...kOOooOA....AOooOOk...',
      '.kOOooOA..M..AOooOOk.',
      'kOOooOA..MMM..AOooOOk',
      '.kM................M.',
      '..kM..............Mk..',
      '....kM..........Mk....',
      '......kM......Mk......',
      '........kM..Mk........',
      '.........kMMk.........',
      '....kBB........BBk....',
      '.....kBB......BBk.....',
      '......kBBBBBBk......',
      '.......kBBk.......',
    ],
  ]),

  orc_shaman: mkSprite(30, 40, 2.7, {
    K: OUTLINE, O: '#68a048', o: '#488028', d: '#286010', P: '#cc66ff', p: '#9933cc',
    E: '#ffee00', T: '#eeeecc', R: '#886644', B: '#553311', M: '#664422',
    G: '#44ff88', g: '#22cc66',
  }, [
    [
      '...........kPPPPPPk...........',
      '..........kPPggggPPk..........',
      '.........kPPggGGggPPk.........',
      '........kPPggGGGGggPPk........',
      '.........kkkkkkkkkkkk.........',
      '........kkOOOOOOOOOkk........',
      '.......kOOllllllllOOk.......',
      '......kOOlEEEEEEEElOOk......',
      '.....kOOlETTTTTTTTlOOk.....',
      '....kOOllOOOOOOOOllOOk....',
      '....kOOooORRRRRRooOOk....',
      '...kOOooORPmMMPRooOOk...',
      '...kOOooORPmMMPRooOOk...',
      '..kOOooOA......AOooOOk..',
      '..kBBooOA......AOooBBk..',
      '...kBBooOA....AOooBBk...',
      '....kBBooOA..AOooBBk....',
      '.....kBBooooBBk.....',
      '......kBBooBBk......',
      '.......kBBBBk.......',
      '........kBBk........',
      '.........kk.........',
    ],
    [
      '...........kPPPPPPk...........',
      '..........kPPggggPPk..........',
      '.........kPPggGGggPPk.........',
      '........kPPggGGGGggPPk........',
      '.........kkkkkkkkkkkk.........',
      '........kkOOOOOOOOOkk........',
      '.......kOOllllllllOOk.......',
      '......kOOlEEEEEEEElOOk......',
      '....kOOllOOOOOOOOllOOk....',
      '...kOOooORPmMMPRooOOk...',
      '..kOOooOA......AOooOOk..',
      '...kBBooOA....AOooBBk...',
      '....kBBooOAOooBBk....',
      '.....kBBooBBk.....',
      '......kBBBBk......',
      '.......kBBk.......',
      '........kk........',
    ],
  ]),

  skeleton: mkSprite(26, 36, 2.7, {
    K: OUTLINE, S: '#f8f8ff', s: '#d8d8ee', d: '#a8a8c8', l: '#ffffff',
    E: '#44ffaa', e: '#111111', B: '#ccccdd', b: '#9999aa', G: '#88ffcc',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkSSSSSSSSSSkk........',
      '.......kSSllllllllSSk.......',
      '......kSSlEEEEEEEElSSk......',
      '.....kSSlEGGGGGGGElSSk.....',
      '.....kSSlSSSSSSSSSlSSk.....',
      '....kSSllSSSSSSSSllSSk....',
      '....kSSssSS....SSssSSk....',
      '...kSSssSS....SSssSSk...',
      '...kBSssSS....SSssSBk...',
      '...kBSssSS....SSssSBk...',
      '..kBSssSS......SSssSBk..',
      '..kBSssSS......SSssSBk..',
      '..kBBssSS......SSssBBk..',
      '...kBBssSS....SSssBBk...',
      '...kBBssSS....SSssBBk...',
      '....kBBssSS..SSssBBk....',
      '.....kBBssSSSSssBBk.....',
      '......kBBssssssBBk......',
      '.......kBBssssBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
      '...........kk...........',
    ],
    [
      '..........kkkkkkkkkkkk..........',
      '........kkSSSSSSSSSSkk........',
      '.......kSSllllllllSSk.......',
      '......kSSlEEEEEEEElSSk......',
      '....kSSllSSSSSSSSllSSk....',
      '...kBSssSS....SSssSBk...',
      '..kBSssSS......SSssSBk..',
      '...kBBssSS....SSssBBk...',
      '....kBBssSS..SSssBBk....',
      '.....kBBssSSSSssBBk.....',
      '......kBBssssssBBk......',
      '.......kBBBBBBk.......',
      '........kBBk........',
      '.........kk.........',
    ],
  ]),

  zombie: mkSprite(28, 38, 2.7, {
    K: OUTLINE, Z: '#7aaa6a', z: '#5a8a4a', d: '#3a6a2a', l: '#9acc8a',
    E: '#ff0000', X: '#6a5a4a', B: '#553311', R: '#884444', Y: '#aaaa44',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkZZZZZZZZZZkk........',
      '.......kZZllllllllZZk.......',
      '......kZZlEEEEEEEElZZk......',
      '.....kZZlEXXXXXXXElZZk.....',
      '.....kZZlZZZZZZZZZlZZk.....',
      '....kZZllZZZZZZZZllZZk....',
      '....kZZzzZZ....ZZzzZZk....',
      '...kZZzzZZ....ZZzzZZk...',
      '...kZZzzZZ....ZZzzZZk...',
      '...kRzzZZ......ZZzzRk...',
      '...kRzzZZ......ZZzzRk...',
      '..kRzzZZ........ZZzzRk..',
      '..kBBzzZZ......ZZzzBBk..',
      '...kBBzzZZ....ZZzzBBk...',
      '...kBBzzZZ....ZZzzBBk...',
      '....kBBzzZZ..ZZzzBBk....',
      '.....kBBzzZZZZzzBBk.....',
      '......kBBzzzzzzBBk......',
      '.......kBBzzzzBBk.......',
      '........kBBBBBBk........',
      '.........kYYYYk.........',
      '..........kYYk..........',
      '...........kk...........',
    ],
    [
      '..........kkkkkkkkkkkk..........',
      '........kkZZZZZZZZZZkk........',
      '.......kZZllllllllZZk.......',
      '......kZZlEEEEEEEElZZk......',
      '....kZZllZZZZZZZZllZZk....',
      '...kRzzZZ......ZZzzRk...',
      '..kBBzzZZ....ZZzzBBk..',
      '...kBBzzZZ..ZZzzBBk...',
      '....kBBzzZZZZzzBBk....',
      '.....kBBzzzzzzBBk.....',
      '......kBBBBBBk......',
      '.......kYYk.......',
      '........kk........',
    ],
  ]),

  spider: mkSprite(34, 30, 2.5, {
    K: OUTLINE, P: '#9922aa', p: '#771188', d: '#550866', l: '#cc44dd',
    E: '#ff2222', e: '#cc0000', B: '#aa33bb', W: '#ffffff',
  }, [
    [
      '............kkkkkkkkkkkk............',
      '..........kkPPPPPPPPPPkk..........',
      '........kkPPllllllllPPkk........',
      '.......kPPllEEEEEEEllPPk.......',
      '......kPPllEWWWWWWElPPk......',
      '......kPPllPPPPPPPllPPk......',
      '.....kPPllPPPPPPPPllPPk.....',
      '....kKk................kKk....',
      '..kKk....................kKk..',
      '.kKk......................kKk.',
      'kKk........................kKk',
      'kKk........................kKk',
      '.kKk......................kKk.',
      '..kKk....................kKk..',
      '....kKk................kKk....',
    ],
    [
      '............kkkkkkkkkkkk............',
      '..........kkPPPPPPPPPPkk..........',
      '........kkPPllllllllPPkk........',
      '.......kPPllEEEEEEEllPPk.......',
      '......kPPllEWWWWWWElPPk......',
      '.....kPPllPPPPPPPPllPPk.....',
      '..kKk....................kKk..',
      '.kKk......................kKk.',
      'kKk........................kKk',
      'kKk........................kKk',
      '.kKk......................kKk.',
      '..kKk....................kKk..',
      '....kKk................kKk....',
      '......kKk............kKk......',
    ],
  ]),

  troll: mkSprite(32, 44, 2.6, {
    K: OUTLINE, T: '#9a7a58', t: '#7a5a38', d: '#5a4028', l: '#ba9a78',
    E: '#ff6666', N: '#6a5040', W: '#775533', w: '#553311', B: '#442200',
    R: '#aa6644', A: '#666655',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkTTTTTTTTTTkk........',
      '.......kTTllllllllTTk.......',
      '......kTTlEEEEEEEElTTk......',
      '.....kTTlENNNNNNNElTTk.....',
      '.....kTTlTTTTTTTTTlTTk.....',
      '....kTTllTTTTTTTTllTTk....',
      '....kTTttTT....TTttTTk....',
      '...kTTttTT....TTttTTk...',
      '...kTTttTT....TTttTTk...',
      '...kTTttTT....TTttTTk...',
      '...kTTttTT....TTttTTk...',
      '...kWWWWWWWWWWWWWWWWk...',
      '...kWWWWWWWWWWWWWWWWk...',
      '...kWW..........WWk...',
      '...kWW..........WWk...',
      '...kBB..........BBk...',
      '...kBB..........BBk...',
      '...kBB..........BBk...',
      '...kBB..........BBk...',
      '....kBB........BBk....',
      '.....kBB......BBk.....',
      '......kBB....BBk......',
      '.......kBB..BBk.......',
      '........kBBBBk........',
      '.........kBBk.........',
      '..........kk..........',
    ],
    [
      '..........kkkkkkkkkkkk..........',
      '........kkTTTTTTTTTTkk........',
      '.......kTTllllllllTTk.......',
      '......kTTlEEEEEEEElTTk......',
      '....kTTllTTTTTTTTllTTk....',
      '...kTTttTT....TTttTTk...',
      '...kWWWWWWWWWWWWWWWWk...',
      '...kBB..........BBk...',
      '....kBB........BBk....',
      '.....kBB......BBk.....',
      '......kBB....BBk......',
      '.......kBBBBk.......',
      '........kBBk........',
      '.........kk.........',
    ],
  ]),

  harpy: mkSprite(42, 32, 2.4, {
    K: OUTLINE, H: '#bb9977', h: '#997755', d: '#775533', l: '#ddbb99',
    W: '#ddccaa', w: '#bbaa88', E: '#ffcc44', B: '#cccccc', F: '#aa8866',
  }, [
    [
      'kWWk............................kWWk',
      'kWWWWk........................kWWWWk',
      'kWWWWWWk....................kWWWWWWk',
      'kWWWWWWWWk..................kWWWWWWWWk',
      '..kHHHHHHHHHHHHHHHHHHHHHHHHHHHHk..',
      '...kHHllEEEEEEEEEEEEEEllHHk...',
      '....kHHHHHHHHHHHHHHHHHHHHk....',
      '.....kHHFFFFFFFFFFFFHHk.....',
      '......kHHHHHHHHHHHHk......',
      '.......kHHHHHHHHk.......',
      '..kBBk............kBBk..',
      '..kBBk............kBBk..',
      '...kBBk..........kBBk...',
      '....kBBk........kBBk....',
    ],
    [
      '..kWWk......................kWWk..',
      'kWWWWWWk..................kWWWWWWk',
      'kWWWWWWWWkkkkkkkkkkkkkkkWWWWWWWWk',
      '..kHHHHHHHHHHHHHHHHHHHHHHHHHHk..',
      '...kHHllEEEEEEEEEEEEEEllHHk...',
      '....kHHHHHHHHHHHHHHHHHHHHk....',
      '.....kHHFFFFFFFFFFFFHHk.....',
      '......kHHHHHHHHHHHHk......',
      '..kBBk............kBBk..',
      '..kBBk............kBBk..',
      '...kBBk..........kBBk...',
    ],
  ]),

  wyrm: mkSprite(52, 44, 2.6, {
    K: OUTLINE, D: '#dd3333', d: '#aa1111', x: '#770000', l: '#ff5555',
    E: '#ffaa00', e: '#ff6600', W: '#bb2222', w: '#880000', H: '#444444',
    B: '#ffdd00', G: '#ff4400', g: '#ff8800',
  }, [
    [
      '................kkkkkkkkkkkkkkkk................',
      '..............kkDDDDDDDDDDDDkk..............',
      '............kkDDllllllllllDDkk............',
      '..........kkDDllEEEEEEEllDDkk..........',
      '........kkDDllEGGGGGGGEllDDkk........',
      '......kkDDDDDDDDDDDDDDDDDDkk......',
      '....kkWWWWWWk........kWWWWWWkk....',
      '...kWWWWWWWWk........kWWWWWWWWk...',
      '..kDDDDDDDDDDDDDDDDDDDDDDDDDDk..',
      '..kDDDDDDDDDDDDDDDDDDDDDDDDDDk..',
      '...kxxDDDDDDDDDDDDDDDDDDDDxxk...',
      '....kxxDDDDDDDDDDDDDDDDDDxxk....',
      '.....kxxDDDDDDDDDDDDDDxxk.....',
      '......kxxDDDDDDDDDDxxk......',
      '.......kxxDDDDDDxxk.......',
      '........kxxDDxxk........',
      '.........kxxk.........',
    ],
    [
      '................kkkkkkkkkkkkkkkk................',
      '..............kkDDDDDDDDDDDDkk..............',
      '............kkDDllllllllllDDkk............',
      '..........kkDDllEEEEEEEllDDkk..........',
      '........kkDDDDDDDDDDDDDDDDDDkk........',
      '......kkWWWWWWWWk..kWWWWWWWWkk......',
      '....kkWWWWWWWWWWk..kWWWWWWWWWWkk....',
      '..kDDDDDDDDDDDDDDDDDDDDDDDDDDk..',
      '...kxxDDDDDDDDDDDDDDDDDDDDxxk...',
      '....kxxDDDDDDDDDDDDDDDDDDxxk....',
      '.....kxxDDDDDDDDDDDDDDxxk.....',
      '......kxxDDDDDDDDDDxxk......',
      '.......kxxDDDDDDxxk.......',
      '........kxxDDxxk........',
    ],
  ]),
};

MONSTER_SPRITES.orc_fighter = MONSTER_SPRITES.orc;

// ===== NPC SPRITES =====
export const NPC_SPRITES = {
  guide: mkSprite(28, 40, 2.8, {
    K: OUTLINE, R: '#6688cc', r: '#4466aa', d: '#224488', l: '#88aaee',
    S: '#ffe8d0', s: '#f0c8a0', T: '#ffdd44', Q: '#ffee66', H: '#334466',
    B: '#553311', G: '#66ffaa', P: '#aa88ff', W: '#ffffff',
  }, [
    [
      '...........kHHHHHHk...........',
      '..........kHHHHHHHHk..........',
      '.........kHHHHHHHHHHk.........',
      '........kkRRRRRRRRkk........',
      '.......kRRllllllllRRk.......',
      '......kRRlSSSSSSSSlRRk......',
      '.....kRRlSsEESSSEEsSlRRk.....',
      '.....kRRlSSSSSSSSSlRRk.....',
      '....kRRllRRRRRRRRllRRk....',
      '....kRRrrRR....RRrrRRk....',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR..GG..RRrrRRk...',
      '...kRRrrRR..GG..RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kCCrrRR....RRrrCCk...',
      '....kBBrrRR..RRrrBBk....',
      '.....kBBrrRRRRrrBBk.....',
      '......kBBrrrrrrBBk......',
      '.......kBBrrrrBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
    ],
  ]),

  shop: mkSprite(28, 38, 2.8, {
    K: OUTLINE, R: '#aa7744', r: '#885522', d: '#663311', l: '#cc9955',
    S: '#ffe8d0', s: '#f0c8a0', T: '#ffcc44', Q: '#ffee00', O: '#ffaa22',
    B: '#553311', A: '#cccccc', a: '#999999',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkRRRRRRRRRRkk........',
      '.......kRRllllllllRRk.......',
      '......kRRlSSSSSSSSlRRk......',
      '.....kRRlSsEESSSEEsSlRRk.....',
      '.....kRRlSSSSSSSSSlRRk.....',
      '....kRRllRRRRRRRRllRRk....',
      '....kRRrrRR....RRrrRRk....',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR..QQ..RRrrRRk...',
      '...kRRrrRR..QQ..RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kAArrRR....RRrrAAk...',
      '...kAArrRR....RRrrAAk...',
      '....kBBrrRR..RRrrBBk....',
      '.....kBBrrRRRRrrBBk.....',
      '......kBBrrrrrrBBk......',
      '.......kBBrrrrBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
    ],
  ]),

  teleport: mkSprite(28, 40, 2.8, {
    K: OUTLINE, R: '#7755bb', r: '#553399', d: '#331177', l: '#9977dd',
    S: '#ffe8d0', s: '#f0c8a0', T: '#cc99ff', P: '#aa66ff', p: '#8844cc',
    B: '#553311', W: '#ffffff', G: '#66ccff',
  }, [
    [
      '...........kPPPPPPk...........',
      '..........kPPGGGGPPk..........',
      '.........kPPGGGGGGPPk.........',
      '........kkRRRRRRRRkk........',
      '.......kRRllllllllRRk.......',
      '......kRRlSSSSSSSSlRRk......',
      '.....kRRlSsEESSSEEsSlRRk.....',
      '.....kRRlSSSSSSSSSlRRk.....',
      '....kRRllRRRRRRRRllRRk....',
      '....kRRrrRR....RRrrRRk....',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kCCrrRR....RRrrCCk...',
      '....kBBrrRR..RRrrBBk....',
      '.....kBBrrRRRRrrBBk.....',
      '......kBBrrrrrrBBk......',
      '.......kBBrrrrBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
    ],
  ]),

  blacksmith: mkSprite(30, 40, 2.8, {
    K: OUTLINE, R: '#554433', r: '#443322', d: '#332211', l: '#776655',
    S: '#f0c890', s: '#d0a870', T: '#ff8844', A: '#aaaaaa', a: '#777777',
    B: '#553311', O: '#ff6600', W: '#cccccc',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkRRRRRRRRRRkk........',
      '.......kRRllllllllRRk.......',
      '......kRRlSSSSSSSSlRRk......',
      '.....kRRlSsEESSSEEsSlRRk.....',
      '.....kRRlSSSSSSSSSlRRk.....',
      '....kRRllRRRRRRRRllRRk....',
      '....kRRrrRR....RRrrRRk....',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kAArrRR....RRrrAAk...',
      '...kAArrRR..WW..RRrrAAk...',
      '...kAArrRR..WW..RRrrAAk...',
      '...kOORRrrRR....RRrrRROOk...',
      '...kOORRrrRR....RRrrRROOk...',
      '....kBBrrRR..RRrrBBk....',
      '.....kBBrrRRRRrrBBk.....',
      '......kBBrrrrrrBBk......',
      '.......kBBrrrrBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
    ],
  ]),

  default: mkSprite(28, 38, 2.8, {
    K: OUTLINE, R: '#7788cc', r: '#5566aa', d: '#334488', l: '#99aadd',
    S: '#ffe8d0', s: '#f0c8a0', T: '#e8c860', Q: '#ffee44', B: '#553311',
  }, [
    [
      '..........kkkkkkkkkkkk..........',
      '........kkRRRRRRRRRRkk........',
      '.......kRRllllllllRRk.......',
      '......kRRlSSSSSSSSlRRk......',
      '.....kRRlSsEESSSEEsSlRRk.....',
      '.....kRRlSSSSSSSSSlRRk.....',
      '....kRRllRRRRRRRRllRRk....',
      '....kRRrrRR....RRrrRRk....',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kRRrrRR....RRrrRRk...',
      '...kCCrrRR....RRrrCCk...',
      '....kBBrrRR..RRrrBBk....',
      '.....kBBrrRRRRrrBBk.....',
      '......kBBrrrrrrBBk......',
      '.......kBBrrrrBBk.......',
      '........kBBBBBBk........',
      '.........kBBBBk.........',
      '..........kBBk..........',
    ],
  ]),
};

export function getMonsterSprite(id) {
  return MONSTER_SPRITES[id] || MONSTER_SPRITES.gremlin;
}

export function getNpcSprite(npc) {
  if (!npc) return NPC_SPRITES.default;
  if (npc.type === 'guide') return NPC_SPRITES.guide;
  if (npc.type === 'shop') return NPC_SPRITES.shop;
  if (npc.type === 'teleport') return NPC_SPRITES.teleport;
  if (npc.id === 'blacksmith' || npc.shopType === 'mixed') return NPC_SPRITES.blacksmith;
  return NPC_SPRITES.default;
}
