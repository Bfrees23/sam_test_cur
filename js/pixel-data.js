// Pixel art sprite definitions — Lineage II: Reborn
// '.' = transparent, other chars = palette keys

export const OUTLINE = '#14101f';

export const RACE_PALETTE = {
  human:     { skin: ['#fce4c4', '#e8c4a0', '#c49a6c'], hair: ['#6a5030', '#4a3020', '#2a1808'] },
  elf:       { skin: ['#fff0e0', '#f0dcc8', '#d4b898'], hair: ['#f0d060', '#d4a843', '#a07820'] },
  dark_elf:  { skin: ['#e8c8d8', '#c8a8b8', '#987888'], hair: ['#ffffff', '#e0e0f0', '#a0a0c0'] },
  orc:       { skin: ['#8aaa5a', '#6a8a4a', '#4a6a2a'], hair: ['#3a4a2a', '#2a3a1a', '#1a2a0a'] },
  dwarf:     { skin: ['#f0c890', '#d4a878', '#a88050'], hair: ['#aa7744', '#886644', '#664422'] },
};

export const CLASS_PALETTE = {
  warrior:   { armor: ['#99aabb', '#667788', '#445566'], trim: '#e8c860', cape: '#334455', accent: '#ccddee' },
  gladiator: { armor: ['#bb7744', '#884422', '#662211'], trim: '#ff8844', cape: '#551811', accent: '#ddaa66' },
  mystic:    { armor: ['#8866bb', '#554488', '#332266'], trim: '#bb88ff', cape: '#221144', accent: '#aa66ff' },
  cleric:    { armor: ['#eeeeff', '#ccccdd', '#aaaacc'], trim: '#ffd700', cape: '#8888aa', accent: '#ffffff' },
  rogue:     { armor: ['#555566', '#333344', '#222233'], trim: '#888899', cape: '#1a1a28', accent: '#aaaacc' },
  archer:    { armor: ['#668855', '#446633', '#334422'], trim: '#aacc66', cape: '#223311', accent: '#88bb55' },
};

// Shared humanoid base — 20x24 grid, 2 walk frames
function buildPlayerFrames(raceId, classId) {
  const race = RACE_PALETTE[raceId] || RACE_PALETTE.human;
  const cls = CLASS_PALETTE[classId] || CLASS_PALETTE.warrior;
  const [s1, s2, s3] = race.skin;
  const [h1, h2, h3] = race.hair;
  const [a1, a2, a3] = cls.armor;

  const pal = {
    K: OUTLINE,
    H: h1, h: h2, i: h3,
    S: s1, s: s2, j: s3,
    A: a1, a: a2, b: a3,
    T: cls.trim, C: cls.cape, G: cls.accent,
    W: '#ddeeff', w: '#99aacc', m: '#886644',
    D: '#cccccc', d: '#888888',
    B: '#553311', t: '#442200',
    P: cls.accent, p: cls.trim,
    R: '#ff6644', r: '#cc3322',
    E: '#44ff88',
  };

  const weapon = {
    warrior: 'sword', gladiator: 'gsword', mystic: 'staff',
    cleric: 'mace', rogue: 'dagger', archer: 'bow',
  }[classId] || 'sword';

  const f0 = buildHumanoidFrame(weapon, 0, classId === 'cleric');
  const f1 = buildHumanoidFrame(weapon, 1, classId === 'cleric');
  return { palette: pal, frames: [f0, f1], w: 20, h: 24, scale: 2.8 };
}

function buildHumanoidFrame(weapon, frame, hasShield) {
  const rows = [
    '......kkkk......',
    '.....kHHHHk.....',
    '....kHSSSSHk....',
    '....kSsRRsSk....',
    '....kSSSSSSk....',
    '....kAssSSAk....',
    '...kAAAAAAAk....',
    '...kAaAAAaAk....',
    '...kAaAAaAAk....',
    '..kCaA..AaACk...',
    '..kCaA..AaACk...',
    '..kBaA..AaBBk...',
    '..kBaA..AaBBk...',
    '..kBB....BBk....',
    frame === 0 ? '..kBB....BBk....' : '..kBB..BBk......',
    '..kBB....BBk....',
    '..kBB....BBk....',
    '...kBB..BBk.....',
    '...ktt..ttk.....',
    '....kk..kk......',
  ];

  if (weapon === 'sword') {
    rows[9]  = hasShield ? '..DCaAWwAaACk...' : '..kCaAWwAaACk...';
    rows[10] = hasShield ? '..DCaAWwAaACk...' : '..kCaAWwAaACk...';
  } else if (weapon === 'gsword') {
    rows[6]  = '..kAWWWWWWAAk....';
    rows[7]  = '..kAWWWWWWAAk....';
    rows[8]  = '..kCaAWWWAAk.....';
    rows[9]  = '..kCaAWWWAAk.....';
    rows[10] = '..kCaAWWWAAk.....';
  } else if (weapon === 'staff') {
    rows[0]  = '......kPPk......';
    rows[1]  = '.....kPPPPk.....';
    rows[2]  = '.....kAssSk.....';
    rows[3]  = '....kAssPPSAk....';
    rows[4]  = '....kAssPPSAk....';
    rows[5]  = '....kAssPPSAk....';
    rows[6]  = '...kAAmPPAAk.....';
    rows[7]  = '...kAAmPPAAk.....';
    rows[8]  = '...kAAmPPAAk.....';
    rows[9]  = '..kCaAmPPAaACk...';
    rows[10] = '..kCaAmPPAaACk...';
  } else if (weapon === 'mace') {
    rows[8]  = '..kCaAPPPAaACk...';
    rows[9]  = hasShield ? '..DCaAmPPAaACk...' : '..kCaAmPPAaACk...';
    rows[10] = hasShield ? '..DCaAmPPAaACk...' : '..kCaAmPPAaACk...';
  } else if (weapon === 'dagger') {
    rows[9]  = '..kCaADdAaACk....';
    rows[10] = '..kCaA..DdACk....';
  } else if (weapon === 'bow') {
    rows[8]  = '..kCaAmmAaACk....';
    rows[9]  = '..kCaAmmAaACk....';
    rows[10] = '..kCaAmmAaACk....';
  }

  return rows;
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
export const MONSTER_SPRITES = {
  gremlin: {
    w: 18, h: 20, scale: 2.6,
    palette: {
      K: OUTLINE, G: '#6aad6a', g: '#4a8c59', d: '#2a6a3a',
      E: '#ff4444', e: '#cc2222', B: '#553311', b: '#442200',
    },
    frames: [
      [
        '......kkkk......',
        '.....kGGGGk.....',
        '....kGEEEEGk....',
        '...kGEGEGEGk...',
        '...kGGGGGGGk...',
        '..kGG....GGk..',
        '..kGG....GGk..',
        '..kBB....BBk..',
        '..kBB....BBk..',
        '...kBB..BBk...',
      ],
      [
        '......kkkk......',
        '.....kGGGGk.....',
        '....kGEEEEGk....',
        '...kGEGEGEGk...',
        '...kGGGGGGGk...',
        '..kGG....GGk..',
        '..kGG....GGk..',
        '..kBB..BBk....',
        '....kBB..BBk..',
        '...kBB..BBk...',
      ],
    ],
  },

  keltir: {
    w: 28, h: 18, scale: 2.4,
    palette: {
      K: OUTLINE, Y: '#ccaa44', y: '#aa8822', d: '#886600',
      E: '#111111', B: '#553311', b: '#442200',
    },
    frames: [
      [
        '...........kkkkkk...........',
        '.........kYYYYYYk.........',
        '......kYYYYYYYYYYk......',
        '....kYYYYEYYYEYYYYk....',
        '...kYYYYYYYYYYYYYYk...',
        '..kYYk........kYYk..',
        '..kBBk........kBBk..',
        '.kBBk..........kBBk.',
        'kBBk............kBBk',
      ],
      [
        '...........kkkkkk...........',
        '.........kYYYYYYk.........',
        '......kYYYYYYYYYYk......',
        '....kYYYYEYYYEYYYYk....',
        '...kYYYYYYYYYYYYYYk...',
        '..kYYk........kYYk..',
        '.kBBk..........kBBk.',
        'kBBk............kBBk',
        '..kBBk........kBBk..',
      ],
    ],
  },

  wolf: {
    w: 30, h: 20, scale: 2.4,
    palette: {
      K: OUTLINE, W: '#aaaaaa', w: '#777777', d: '#555555',
      E: '#ffcc44', e: '#111111', N: '#cccccc', B: '#444444',
    },
    frames: [
      [
        '...........kkkk...........',
        '.........kWWWWk.........',
        '......kWWWWWWWWk......',
        '....kWWWEWNNWWEWk....',
        '...kWWWWWWWWWWWWk...',
        '..kWWk........kWWk..',
        '..kBBk........kBBk..',
        '.kBBk..........kBBk.',
        'kBBk............kBBk',
      ],
      [
        '...........kkkk...........',
        '.........kWWWWk.........',
        '......kWWWWWWWWk......',
        '....kWWWEWNNWWEWk....',
        '...kWWWWWWWWWWWWk...',
        '..kWWk........kWWk..',
        '.kBBk..........kBBk.',
        'kBBk............kBBk',
        '..kBBk........kBBk..',
      ],
    ],
  },

  orc: {
    w: 20, h: 24, scale: 2.6,
    palette: {
      K: OUTLINE, O: '#6a9a4a', o: '#4a7a2a', d: '#2a5a1a',
      E: '#ffdd00', T: '#eeeeee', W: '#aaaaaa', w: '#666666',
      B: '#553311', b: '#442200', R: '#886644',
    },
    frames: [
      [
        '......kkkk......',
        '.....kOOOOk.....',
        '....kOEEEEOk....',
        '....kOTTTTOk....',
        '....kOOOOOOk....',
        '...kOOOOOOOk...',
        '...kOoOOOOOk...',
        '...kOoOOOOkWk...',
        '..kOoO..OoWk..',
        '..kBB....BBk..',
        '..kBB....BBk..',
        '...kBB..BBk...',
      ],
      [
        '......kkkk......',
        '.....kOOOOk.....',
        '....kOEEEEOk....',
        '....kOTTTTOk....',
        '....kOOOOOOk....',
        '...kOOOOOOOk...',
        '...kOoOOOOOk...',
        '...kOoOOOOkWk...',
        '..kOoO..OoWk..',
        '..kBB..BBk....',
        '....kBB..BBk..',
        '...kBB..BBk...',
      ],
    ],
  },

  orc_shaman: {
    w: 20, h: 26, scale: 2.6,
    palette: {
      K: OUTLINE, O: '#5a8a3a', o: '#3a6a2a', d: '#2a4a1a',
      E: '#ffdd00', P: '#cc66ff', p: '#9933cc', R: '#886644',
      B: '#553311', b: '#442200', M: '#664422',
    },
    frames: [
      [
        '......kPPk......',
        '.....kPPPPk.....',
        '......kkkk......',
        '.....kOOOOk.....',
        '....kOEEEEOk....',
        '....kOTTTTOk....',
        '....kOOOOOOk....',
        '...kOOOOOOOk...',
        '...kOoPmMPoOk...',
        '..kOoO..OoOk..',
        '..kBB....BBk..',
        '..kBB....BBk..',
        '...kBB..BBk...',
      ],
      [
        '......kPPk......',
        '.....kPPPPk.....',
        '......kkkk......',
        '.....kOOOOk.....',
        '....kOEEEEOk....',
        '....kOTTTTOk....',
        '....kOOOOOOk....',
        '...kOOOOOOOk...',
        '...kOoPmMPoOk...',
        '..kOoO..OoOk..',
        '..kBB..BBk....',
        '....kBB..BBk..',
        '...kBB..BBk...',
      ],
    ],
  },

  skeleton: {
    w: 18, h: 24, scale: 2.6,
    palette: {
      K: OUTLINE, S: '#eeeeee', s: '#cccccc', d: '#999999',
      E: '#111111', B: '#aaaaaa', b: '#888888',
    },
    frames: [
      [
        '......kkkk......',
        '.....kSSSSk.....',
        '....kSEEEESk....',
        '....kSSSSSSk....',
        '....kSssssSk....',
        '...kSs....sSk...',
        '...kSs....sSk...',
        '...kBs....sBk...',
        '...kBs....sBk...',
        '..kBB....BBk..',
        '..kBB....BBk..',
        '...kBB..BBk...',
      ],
      [
        '......kkkk......',
        '.....kSSSSk.....',
        '....kSEEEESk....',
        '....kSSSSSSk....',
        '....kSssssSk....',
        '...kBs....sSk...',
        '...kBs....sSk...',
        '...kBs....sBk...',
        '...kBs....sBk...',
        '..kBB..BBk....',
        '....kBB..BBk..',
        '...kBB..BBk...',
      ],
    ],
  },

  zombie: {
    w: 20, h: 24, scale: 2.6,
    palette: {
      K: OUTLINE, Z: '#6a8a5a', z: '#4a6a3a', d: '#3a5a2a',
      E: '#ff0000', X: '#5a4a3a', B: '#553311', b: '#442200',
    },
    frames: [
      [
        '......kkkk......',
        '.....kZZZZk.....',
        '....kZEEEEZk....',
        '....kZZZZZZk....',
        '....kXXXXXXk....',
        '...kZZZZZZZk...',
        '...kZzZZZzZk...',
        '...kZz....zZk...',
        '..kZz......zZk..',
        '..kBB....BBk..',
        '..kBB....BBk..',
        '...kBB..BBk...',
      ],
      [
        '......kkkk......',
        '.....kZZZZk.....',
        '....kZEEEEZk....',
        '....kZZZZZZk....',
        '....kXXXXXXk....',
        '...kZZZZZZZk...',
        '...kZzZZZzZk...',
        '..kZz......zZk..',
        '...kZz....zZk...',
        '..kBB..BBk....',
        '....kBB..BBk..',
        '...kBB..BBk...',
      ],
    ],
  },

  spider: {
    w: 26, h: 22, scale: 2.4,
    palette: {
      K: OUTLINE, P: '#7a2288', p: '#5a1068', d: '#3a0848',
      E: '#ff2222', e: '#cc0000', B: '#9922aa',
    },
    frames: [
      [
        '..........kkkkkk..........',
        '........kPPPPPPk........',
        '.......kPEEEEEPk.......',
        '.......kPPPPPPk.......',
        '....kKk........kKk....',
        '..kKk............kKk..',
        '.kKk..............kKk.',
        'kKk................kKk',
      ],
      [
        '..........kkkkkk..........',
        '........kPPPPPPk........',
        '.......kPEEEEEPk.......',
        '.......kPPPPPPk.......',
        '..kKk............kKk..',
        '.kKk..............kKk.',
        'kKk................kKk',
        '....kKk........kKk....',
      ],
    ],
  },

  troll: {
    w: 24, h: 28, scale: 2.5,
    palette: {
      K: OUTLINE, T: '#8a6a50', t: '#6a5038', d: '#4a3828',
      E: '#ff6666', N: '#5a4030', W: '#664422', w: '#553311',
      B: '#442200', b: '#331100',
    },
    frames: [
      [
        '........kkkkkk........',
        '.......kTTTTTTk.......',
        '......kTEEEEETk......',
        '......kTNNNNNTk......',
        '.....kTTTTTTTTk.....',
        '.....kTTTTTTTTk.....',
        '....kTTt....tTTk....',
        '....kTTt....tTTk....',
        '....kWWWWWWWWk....',
        '....kWW....WWk....',
        '...kBB....BBk...',
        '...kBB....BBk...',
        '...kBB....BBk...',
        '....kBB..BBk....',
      ],
      [
        '........kkkkkk........',
        '.......kTTTTTTk.......',
        '......kTEEEEETk......',
        '......kTNNNNNTk......',
        '.....kTTTTTTTTk.....',
        '.....kTTTTTTTTk.....',
        '....kTTt....tTTk....',
        '....kTTt....tTTk....',
        '....kWWWWWWWWk....',
        '....kWW....WWk....',
        '...kBB....BBk...',
        '..kBB....BBk....',
        '....kBB....BBk....',
        '...kBB..BBk...',
      ],
    ],
  },

  harpy: {
    w: 32, h: 24, scale: 2.3,
    palette: {
      K: OUTLINE, H: '#aa8866', h: '#886644', d: '#664422',
      W: '#ccaa88', w: '#aa8866', E: '#ffcc44', B: '#cccccc',
    },
    frames: [
      [
        'kWWk................kWWk',
        'kWWWWk............kWWWWk',
        'kWWWWWWk........kWWWWWWk',
        '..kHHHHHHHHHHHHHHHHk..',
        '...kHEEEEHEEEEHk...',
        '....kHHHHHHHHHHk....',
        '.....kHHHHHHk.....',
        '..kBBk......kBBk..',
        '..kBBk......kBBk..',
      ],
      [
        '..kWWk..........kWWk..',
        'kWWWWWWk......kWWWWWWk',
        'kWWWWWWWWkkkWWWWWWWWk',
        '..kHHHHHHHHHHHHHHHHk..',
        '...kHEEEEHEEEEHk...',
        '....kHHHHHHHHHHk....',
        '.....kHHHHHHk.....',
        '..kBBk......kBBk..',
        '..kBBk......kBBk..',
      ],
    ],
  },

  wyrm: {
    w: 40, h: 32, scale: 2.2,
    palette: {
      K: OUTLINE, D: '#cc2222', d: '#991111', x: '#660000',
      E: '#ff8800', e: '#ff4400', W: '#aa1111', w: '#880000',
      H: '#333333', B: '#ffcc00',
    },
    frames: [
      [
        '..............kkkkkkkk..............',
        '............kDDDDDDDDk............',
        '..........kDDEEEEEDDDk..........',
        '........kDDDDDDDDDDDDk........',
        '......kWWWWk......kWWWWk......',
        '....kWWWWWWk......kWWWWWWk....',
        '...kDDDDDDDDDDDDDDDDDDDDk...',
        '...kDDDDDDDDDDDDDDDDDDDDk...',
        '....kxxDDDDDDDDDDDDDDxxk....',
        '.....kxxDDDDDDDDDDxxk.....',
        '......kxxDDDDDDDDxxk......',
        '.......kxxDDDDxxk.......',
      ],
      [
        '..............kkkkkkkk..............',
        '............kDDDDDDDDk............',
        '..........kDDEEEEEDDDk..........',
        '........kDDDDDDDDDDDDk........',
        '......kWWWWWWk..kWWWWWWk......',
        '....kWWWWWWWWk..kWWWWWWWWk....',
        '...kDDDDDDDDDDDDDDDDDDDDk...',
        '...kDDDDDDDDDDDDDDDDDDDDk...',
        '....kxxDDDDDDDDDDDDDDxxk....',
        '.....kxxDDDDDDDDDDxxk.....',
        '......kxxDDDDDDDDxxk......',
        '.......kxxDDDDxxk.......',
      ],
    ],
  },

  npc: {
    w: 20, h: 26, scale: 2.6,
    palette: {
      K: OUTLINE, R: '#7788cc', r: '#5566aa', d: '#334488',
      S: '#fce4c4', s: '#e8c4a0', T: '#e8c860', Q: '#ffcc00',
      B: '#553311', b: '#442200',
    },
    frames: [
      [
        '......kQQk......',
        '.....kQQQQk.....',
        '......kkkk......',
        '.....kRRRRk.....',
        '....kRSSSSRk....',
        '....kRRRRRRk....',
        '....kRRRRRRk....',
        '...kRRRRRRRk...',
        '...kRrRRRrRk...',
        '...kRr....rRk...',
        '..kBB....BBk..',
        '..kBB....BBk..',
        '...kBB..BBk...',
      ],
    ],
  },
};

// orc_archer uses orc sprite
MONSTER_SPRITES.orc_archer = MONSTER_SPRITES.orc;
MONSTER_SPRITES.orc_fighter = MONSTER_SPRITES.orc;

export function getMonsterSprite(id) {
  return MONSTER_SPRITES[id] || MONSTER_SPRITES.gremlin;
}
