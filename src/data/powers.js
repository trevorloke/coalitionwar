// The eight powers. Ratings run 1–5: industry (production & CP), manpower
// (build efficiency), sea (naval dice caps), intelligence (visibility & ops hand).
// Signature doctrines are hard-coded engine rules keyed by `signature`.

export const POWERS = {
  uk: {
    id: 'uk', name: 'United Kingdom & Commonwealth', short: 'UK', side: 'allied',
    color: '#1e6091', atWar: true,
    ratings: { industry: 3, manpower: 2, sea: 5, intel: 5 },
    signature: 'ultra',
    signatureText: 'Ultra: once per round, before the reveal, read one opponent’s written orders for a single theatre.',
    objective: {
      text: 'Keep the Atlantic and Suez open every round. Hold the home islands.',
      checks: ['atlantic_open', 'suez_open', 'hold_britain'],
    },
    capital: 'britain',
  },
  china: {
    id: 'china', name: 'China', short: 'China', side: 'allied',
    color: '#b56576', atWar: true,
    ratings: { industry: 1, manpower: 5, sea: 1, intel: 2 },
    signature: 'protracted_war',
    signatureText: 'Protracted war: cannot be eliminated while holding any interior territory. Territories Japan takes from China generate partisan attrition against Japan each round.',
    objective: {
      text: 'Survive holding Chongqing. Tie down 8 or more Japanese strength from 1942 onward.',
      checks: ['hold_chongqing', 'tie_down_japan'],
    },
    capital: 'chongqing',
  },
  ussr: {
    id: 'ussr', name: 'Soviet Union', short: 'USSR', side: 'allied',
    color: '#a4161a', atWar: false, pressureStart: 3,
    ratings: { industry: 4, manpower: 5, sea: 1, intel: 3 },
    signature: 'deep_battle',
    signatureText: 'Deep battle: an offensive may draw strength from two adjacent territories for the cost of one. Losses convert to fresh strength next round while industrial cities are held.',
    objective: {
      text: 'Hold Moscow and Baku through 1942. Reach the Vistula before the war ends.',
      checks: ['hold_moscow_baku_1942', 'reach_vistula'],
    },
    capital: 'moscow',
  },
  usa: {
    id: 'usa', name: 'United States', short: 'USA', side: 'allied',
    color: '#2d6a4f', atWar: false, pressureStart: 1,
    ratings: { industry: 5, manpower: 3, sea: 4, intel: 3 },
    signature: 'arsenal',
    signatureText: 'Arsenal: lend-lease costs no command points and may reach any ally along an open sea lane, including while neutral. Production rises every round from 1942.',
    objective: {
      text: 'Land in Europe and reach the Rhine. Take two Pacific island chains.',
      checks: ['reach_rhine', 'two_island_chains'],
    },
    capital: 'united_states',
  },
  germany: {
    id: 'germany', name: 'Germany', short: 'Germany', side: 'axis',
    color: '#5c6658', atWar: true,
    ratings: { industry: 4, manpower: 4, sea: 2, intel: 3 },
    signature: 'interior_lines',
    signatureText: 'Interior lines: shift strength between the Western and Eastern fronts at half cost. A successful offensive permits one free advance into the vacated territory.',
    objective: {
      text: 'Paris, Moscow, and the Caucasus oil. Keep the Ruhr out of bombing range.',
      checks: ['take_paris', 'take_moscow', 'take_baku', 'protect_ruhr'],
    },
    capital: 'berlin',
  },
  japan: {
    id: 'japan', name: 'Japan', short: 'Japan', side: 'axis',
    color: '#c2622e', atWar: true, // vs China; global war on Pacific initiation
    ratings: { industry: 3, manpower: 3, sea: 5, intel: 2 },
    signature: 'carrier_doctrine',
    signatureText: 'Carrier doctrine: in a naval offensive, roll and apply hits before the defender rolls. Once per game, declare a Decisive Battle and double your dice for one sea zone.',
    objective: {
      text: 'Hold the oil, rubber and tin of the southern resource zone. Have a closed perimeter by the end of 1943.',
      checks: ['southern_resources', 'closed_perimeter_1943'],
    },
    capital: 'japan',
  },
  italy: {
    id: 'italy', name: 'Italy', short: 'Italy', side: 'axis',
    color: '#6a994e', atWar: false, entersRound: 2, // or earlier by choice
    ratings: { industry: 2, manpower: 2, sea: 3, intel: 1 },
    signature: 'mare_nostrum',
    signatureText: 'Mare nostrum: contest any Mediterranean sea zone for free. If the Home Front reaches zero, Italy flips: the board splits into a co-belligerent north and south and the seat changes sides.',
    objective: {
      text: 'Hold Malta, Suez and the North African coast at the same time for two consecutive rounds.',
      checks: ['mare_nostrum_hold'],
    },
    capital: 's_italy',
  },
  indies: {
    id: 'indies', name: 'The Independent States', short: 'Indies', side: 'axis',
    color: '#7f5539', atWar: true, // per nation, in practice
    ratings: { industry: 2, manpower: 3, sea: 1, intel: 2 },
    signature: 'client_sovereignty',
    signatureText: 'Client sovereignty: play six or seven small nations with separate war aims. Sell a nation’s commitment for command points; defect it to the Allies when its Pressure track breaks.',
    objective: {
      text: 'End the war holding your own capitals. Score for each nation still sovereign in 1945, whichever side it finished on.',
      checks: ['sovereign_nations'],
    },
    capital: null, // per nation
  },
};

export const NATIONS = {
  hungary: { name: 'Hungary', home: 'hungary', joins: 1, pressureStart: 1 },
  romania: { name: 'Romania', home: 'romania', joins: 1, pressureStart: 1 },
  croatia: { name: 'Croatia', home: 'croatia', joins: 1, pressureStart: 0 },
  finland: { name: 'Finland', home: 'finland', joins: 1, pressureStart: 2 },
  slovakia: { name: 'Slovakia', home: 'slovakia', joins: 1, pressureStart: 0 },
  bulgaria: { name: 'Bulgaria', home: 'bulgaria', joins: 1, pressureStart: 1 },
  thailand: { name: 'Thailand', home: 'thailand', joins: 6, pressureStart: 0 }, // from 1942
};

export const SIDES = { allied: ['uk', 'china', 'ussr', 'usa'], axis: ['germany', 'japan', 'italy', 'indies'] };

// Round n (1..12) ↔ calendar half-year.
export const CALENDAR = [
  null,
  { year: 1939, half: 2, label: 'Autumn 1939' },
  { year: 1940, half: 1, label: 'Spring 1940' },
  { year: 1940, half: 2, label: 'Autumn 1940' },
  { year: 1941, half: 1, label: 'Spring 1941' },
  { year: 1941, half: 2, label: 'Autumn 1941' },
  { year: 1942, half: 1, label: 'Spring 1942' },
  { year: 1942, half: 2, label: 'Autumn 1942' },
  { year: 1943, half: 1, label: 'Spring 1943' },
  { year: 1943, half: 2, label: 'Autumn 1943' },
  { year: 1944, half: 1, label: 'Spring 1944' },
  { year: 1944, half: 2, label: 'Autumn 1944' },
  { year: 1945, half: 1, label: 'Summer 1945' },
];
