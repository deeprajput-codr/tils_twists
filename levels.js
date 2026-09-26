/**
 * Tils & Twists — Level Definitions
 * 100 levels with progressive difficulty scaling
 *
 * Level Structure:
 *   { id, grid, shuffleMoves, name }
 *   grid: 3 = 3x3 (8-tile), 4 = 4x4 (15-tile), 5 = 5x5 (24-tile)
 *   shuffleMoves: how many random moves to shuffle from solved state
 */

const LEVEL_DATA = (() => {
  const levels = [];

  /**
   * Difficulty bands:
   *  L1–10   → 3×3, ~10–25 shuffles   (Baby steps)
   *  L11–25  → 3×3, ~30–80 shuffles   (Getting warm)
   *  L26–45  → 4×4, ~20–60 shuffles   (Rising heat)
   *  L46–70  → 4×4, ~65–140 shuffles  (Hot stuff)
   *  L71–85  → 5×5, ~30–80 shuffles   (Expert)
   *  L86–100 → 5×5, ~90–200 shuffles  (Master)
   */

  const ZONES = [
    { from: 1,  to: 10,  grid: 3, minS: 10,  maxS: 25  },
    { from: 11, to: 25,  grid: 3, minS: 30,  maxS: 80  },
    { from: 26, to: 45,  grid: 4, minS: 20,  maxS: 60  },
    { from: 46, to: 70,  grid: 4, minS: 65,  maxS: 140 },
    { from: 71, to: 85,  grid: 5, minS: 30,  maxS: 80  },
    { from: 86, to: 100, grid: 5, minS: 90,  maxS: 200 },
  ];

  const ZONE_NAMES = [
    'Baby Steps', 'Getting Warm', 'Rising Heat',
    'Hot Stuff', 'Expert Zone', 'Master Class'
  ];

  const LEVEL_NICKNAMES_3 = [
    'The Warm-Up', 'Easy Slide', 'First Step', 'Simple Start', 'Gentle Push',
    'Baby Twist', 'Light Touch', 'Soft Slide', 'Tiny Tangle', 'Mini Maze',
    'Quick Think', 'Sharp Turn', 'Brief Blur', 'Fast Flip', 'Snappy Swap',
    'Tricky Row', 'Cute Chaos', 'Mild Mix', 'Zigzag Lite', 'Loop Around',
    'Short Circuit', 'Near Miss', 'Almost There', 'So Close', 'Last 3×3',
  ];

  const LEVEL_NICKNAMES_4 = [
    'Four by Four', 'Grid Unlock', 'Space Maze', 'Big Board', 'Fifteen Fun',
    'Cool Shuffle', 'Tile Storm', 'Grid Rush', 'Slide Frenzy', 'Deep Dive',
    'Mid Boss', 'Turn It Up', 'Brain Burn', 'Hectic Grid', 'Full Board',
    'Hard Swap', 'Chaos Grid', 'No Easy Path', 'Dense Pack', 'Mixed Up',
    'Tangle Web', 'Spiral In', 'Cluster Buster', 'Hard Lock', 'Power Play',
    'Pro Move', 'Sharp Grid', 'Expert Slide', 'Master Swap', 'Blazing Path',
    'Intense Slide', 'No Mercy', 'Fierce Grid', 'Storm Mode', 'Final 4×4',
    'Last Stand', 'Near Chaos', 'Fury Board', 'Wild Grid', 'Maximum 4',
    'Chaos Finale', 'Ultimate 4', 'Madness', 'Beyond Grid', 'The Last 15',
  ];

  const LEVEL_NICKNAMES_5 = [
    'Five Stars', 'Giant Board', 'Twenty-Four', 'Big Challenge', 'Huge Maze',
    'Expert Entry', 'Wide Grid', 'Master Entry', 'Sprawling', 'Monster Board',
    'Expert Push', 'Deep Tangle', 'Max Grid', 'Endless Slide', 'Titan Puzzle',
    'Pro Chaos', 'Master Maze', 'Final Boss', 'Legendary', 'The Legend',
    'Beyond Expert', 'Pinnacle', 'The Summit', 'Peak Performance', 'Absolute Max',
    'Unreal', 'Insanity', 'Pure Chaos', 'Nightmare', 'Final Challenge',
  ];

  let nick3Idx = 0, nick4Idx = 0, nick5Idx = 0;

  for (const zone of ZONES) {
    const zoneIdx = ZONES.indexOf(zone);
    const count = zone.to - zone.from + 1;

    for (let i = 0; i < count; i++) {
      const lvlNum = zone.from + i;
      // linearly interpolate shuffle moves inside the zone
      const t = count === 1 ? 0 : i / (count - 1);
      const shuffleMoves = Math.round(zone.minS + t * (zone.maxS - zone.minS));

      let name;
      if (zone.grid === 3) {
        name = LEVEL_NICKNAMES_3[nick3Idx++ % LEVEL_NICKNAMES_3.length];
      } else if (zone.grid === 4) {
        name = LEVEL_NICKNAMES_4[nick4Idx++ % LEVEL_NICKNAMES_4.length];
      } else {
        name = LEVEL_NICKNAMES_5[nick5Idx++ % LEVEL_NICKNAMES_5.length];
      }

      levels.push({
        id: lvlNum,
        grid: zone.grid,
        shuffleMoves,
        zoneName: ZONE_NAMES[zoneIdx],
        name,
      });
    }
  }

  return levels;
})();

/**
 * Returns the star rating threshold (par moves) for a level.
 * Based on grid size and shuffle count — gives a rough "optimal path" estimate.
 */
function getLevelPar(level) {
  const base = level.shuffleMoves;
  return {
    threeStars: Math.ceil(base * 1.2),
    twoStars:   Math.ceil(base * 1.8),
    oneStar:    Math.ceil(base * 3.0),
  };
}
