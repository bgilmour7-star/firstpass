// Every library drill named or drawn on a public page (decision 0038). Public pages use live drills
// only, the same as the app. Live status is in the database, not the repo's JSON, so check it with
// `npm run drills -- public` before merging a change to a public page, and when a drill is archived.
// A test checks that each id here is in content/drills.

export const PUBLIC_DRILLS: Record<string, string[]> = {
  '/': ['ski-racer', 'rotation-puck-party', 'snake-in-the-forest', 'cops-and-robbers'],
  '/u7/first-practice': ['warmup-skill-doctor-tag', 'rotation-puck-party', 'game-steal-the-treasure', 'cops-and-robbers'],
  '/u7/stations-half-ice': ['warmup-merry-go-round', 'rotation-edges-and-pucks', 'keep-away-circle', 'cops-and-robbers'],
  '/u7/keep-kids-listening': ['warmup-skill-doctor-tag', 'rotation-puck-party', 'hot-potato-partners', 'game-steal-the-treasure', 'cops-and-robbers'],
};

export const allPublicDrillIds = () => [...new Set(Object.values(PUBLIC_DRILLS).flat())].sort();
