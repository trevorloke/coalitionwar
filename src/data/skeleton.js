// Coalition 1939 — canonical map skeleton.
// The fixed structure of the 96-territory board: identities, theatres, victory
// cities, capitals, industry, and every cross-theatre edge. Generated content
// (terrain, supply, intra-theatre adjacency, coords, setup) is layered on top
// and validated against this file. See docs/CONTRACT.md.

export const THEATRES = {
  eastern: { name: 'The Eastern Front', box: { x: [720, 1090], y: [130, 450] } },
  med: { name: 'Mediterranean & North Africa', box: { x: [270, 770], y: [560, 790] } },
  china_manchuria: { name: 'China & Manchuria', box: { x: [1100, 1390], y: [200, 490] } },
  west: { name: 'Western Europe & the Atlantic Wall', box: { x: [370, 650], y: [130, 390] } },
  pacific: { name: 'The Pacific', box: { x: [1400, 1580], y: [60, 840] } },
  balkans: { name: 'Balkans & the Independent States', box: { x: [570, 830], y: [400, 545] } },
  atlantic: { name: 'The Atlantic & home waters', box: { x: [40, 360], y: [40, 430] } },
  seasia: { name: 'Southeast Asia & the Indian Ocean', box: { x: [990, 1330], y: [560, 800] } },
  scandinavia: { name: 'Scandinavia & the Baltic', box: { x: [550, 830], y: [20, 125] } },
};

// [id, name, theatre, type, vcName, vcWeight, capitalOf, industrial, interior]
const T = [
  // ——— The Eastern Front (18) ———
  ['e_poland', 'Eastern Poland', 'eastern', 'land', null, 0, null, false, false],
  ['baltic_states', 'Baltic States', 'eastern', 'land', null, 0, null, false, false],
  ['belorussia', 'Belorussia', 'eastern', 'land', null, 0, null, false, false],
  ['w_ukraine', 'Western Ukraine', 'eastern', 'land', null, 0, null, false, false],
  ['kiev', 'Kiev', 'eastern', 'land', 'Kiev', 2, null, false, false],
  ['odessa', 'Odessa', 'eastern', 'land', null, 0, null, false, false],
  ['crimea', 'Crimea', 'eastern', 'land', null, 0, null, false, false],
  ['smolensk', 'Smolensk', 'eastern', 'land', null, 0, null, false, false],
  ['leningrad', 'Leningrad', 'eastern', 'land', 'Leningrad', 2, null, true, false],
  ['moscow', 'Moscow', 'eastern', 'land', 'Moscow', 3, 'ussr', true, false],
  ['orel', 'Orel', 'eastern', 'land', null, 0, null, false, false],
  ['kharkov', 'Kharkov', 'eastern', 'land', null, 0, null, false, false],
  ['rostov', 'Rostov', 'eastern', 'land', null, 0, null, false, false],
  ['stalingrad', 'Stalingrad', 'eastern', 'land', 'Stalingrad', 2, null, true, false],
  ['kuban', 'Kuban', 'eastern', 'land', null, 0, null, false, false],
  ['baku', 'Baku', 'eastern', 'land', 'Baku', 2, null, false, false],
  ['urals', 'Urals', 'eastern', 'land', null, 0, null, true, false],
  ['siberia', 'Siberia', 'eastern', 'land', null, 0, null, false, false],
  // ——— Western Europe & the Atlantic Wall (11) ———
  ['britain', 'Britain', 'west', 'land', null, 0, 'uk', true, false],
  ['normandy', 'Normandy', 'west', 'land', null, 0, null, false, false],
  ['paris', 'Paris', 'west', 'land', 'Paris', 3, 'france', true, false],
  ['s_france', 'Southern France', 'west', 'land', null, 0, null, false, false],
  ['low_countries', 'Low Countries', 'west', 'land', null, 0, null, false, false],
  ['rhineland', 'Rhineland', 'west', 'land', null, 0, null, false, false],
  ['ruhr', 'The Ruhr', 'west', 'land', 'The Ruhr', 2, null, true, false],
  ['s_germany', 'Southern Germany', 'west', 'land', null, 0, null, false, false],
  ['bohemia', 'Bohemia-Moravia', 'west', 'land', null, 0, null, true, false],
  ['berlin', 'Berlin', 'west', 'land', 'Berlin', 3, 'germany', true, false],
  ['w_poland', 'Western Poland', 'west', 'land', null, 0, null, false, false],
  // ——— Scandinavia & the Baltic (7) ———
  ['norway', 'Norway', 'scandinavia', 'land', 'Oslo', 1, null, false, false],
  ['n_norway', 'Northern Norway', 'scandinavia', 'land', null, 0, null, false, false],
  ['denmark', 'Denmark', 'scandinavia', 'land', null, 0, null, false, false],
  ['sweden', 'Sweden', 'scandinavia', 'land', null, 0, null, false, false],
  ['finland', 'Finland', 'scandinavia', 'land', 'Helsinki', 1, 'finland', false, false],
  ['karelia', 'Karelia', 'scandinavia', 'land', null, 0, null, false, false],
  ['murmansk', 'Murmansk', 'scandinavia', 'land', 'Murmansk', 1, null, false, false],
  // ——— Balkans & the Independent States (9) ———
  ['austria', 'Austria', 'balkans', 'land', null, 0, null, false, false],
  ['hungary', 'Hungary', 'balkans', 'land', 'Budapest', 1, 'hungary', false, false],
  ['slovakia', 'Slovakia', 'balkans', 'land', null, 0, 'slovakia', false, false],
  ['croatia', 'Croatia', 'balkans', 'land', null, 0, 'croatia', false, false],
  ['serbia', 'Serbia', 'balkans', 'land', 'Belgrade', 1, null, false, false],
  ['romania', 'Romania', 'balkans', 'land', 'Ploiești', 2, 'romania', false, false],
  ['bulgaria', 'Bulgaria', 'balkans', 'land', null, 0, 'bulgaria', false, false],
  ['greece', 'Greece', 'balkans', 'land', null, 0, null, false, false],
  ['albania', 'Albania', 'balkans', 'land', null, 0, null, false, false],
  // ——— Mediterranean & North Africa (13) ———
  ['gibraltar', 'Gibraltar', 'med', 'land', 'Gibraltar', 1, null, false, false],
  ['west_med', 'Western Mediterranean', 'med', 'sea', null, 0, null, false, false],
  ['central_med', 'Central Mediterranean', 'med', 'sea', null, 0, null, false, false],
  ['east_med', 'Eastern Mediterranean', 'med', 'sea', null, 0, null, false, false],
  ['fr_n_africa', 'French North Africa', 'med', 'land', null, 0, null, false, false],
  ['tunisia', 'Tunisia', 'med', 'land', 'Tunis', 1, null, false, false],
  ['tripolitania', 'Tripolitania', 'med', 'land', null, 0, null, false, false],
  ['cyrenaica', 'Cyrenaica', 'med', 'land', null, 0, null, false, false],
  ['egypt', 'Egypt', 'med', 'land', 'Cairo', 2, null, false, false],
  ['malta', 'Malta', 'med', 'land', 'Malta', 1, null, false, false],
  ['sicily', 'Sicily', 'med', 'land', null, 0, null, false, false],
  ['s_italy', 'Southern Italy', 'med', 'land', null, 0, 'italy', false, false],
  ['n_italy', 'Northern Italy', 'med', 'land', null, 0, null, true, false],
  // ——— The Atlantic & home waters (8, all sea) ———
  ['north_atlantic', 'North Atlantic', 'atlantic', 'sea', null, 0, null, false, false],
  ['mid_atlantic', 'Mid-Atlantic', 'atlantic', 'sea', null, 0, null, false, false],
  ['western_approaches', 'Western Approaches', 'atlantic', 'sea', null, 0, null, false, false],
  ['north_sea', 'North Sea', 'atlantic', 'sea', null, 0, null, false, false],
  ['norwegian_sea', 'Norwegian Sea', 'atlantic', 'sea', null, 0, null, false, false],
  ['baltic_sea', 'Baltic Sea', 'atlantic', 'sea', null, 0, null, false, false],
  ['biscay', 'Bay of Biscay', 'atlantic', 'sea', null, 0, null, false, false],
  ['eastern_seaboard', 'Eastern Seaboard', 'atlantic', 'sea', null, 0, null, false, false],
  // ——— China & Manchuria (12) ———
  ['manchuria', 'Manchuria', 'china_manchuria', 'land', 'Mukden', 1, null, true, false],
  ['korea', 'Korea', 'china_manchuria', 'land', null, 0, null, false, false],
  ['inner_mongolia', 'Inner Mongolia', 'china_manchuria', 'land', null, 0, null, false, false],
  ['n_china', 'Northern China', 'china_manchuria', 'land', null, 0, null, false, false],
  ['shantung', 'Shantung', 'china_manchuria', 'land', null, 0, null, false, false],
  ['c_china', 'Central China', 'china_manchuria', 'land', null, 0, null, false, false],
  ['shanghai', 'Shanghai', 'china_manchuria', 'land', 'Shanghai', 2, null, false, false],
  ['s_china', 'Southern China', 'china_manchuria', 'land', null, 0, null, false, false],
  ['chongqing', 'Chongqing', 'china_manchuria', 'land', 'Chongqing', 2, 'china', false, true],
  ['yunnan', 'Yunnan', 'china_manchuria', 'land', null, 0, null, false, true],
  ['shensi', 'Shensi', 'china_manchuria', 'land', null, 0, null, false, true],
  ['sinkiang', 'Sinkiang', 'china_manchuria', 'land', null, 0, null, false, true],
  // ——— Southeast Asia & the Indian Ocean (8) ———
  ['burma', 'Burma', 'seasia', 'land', 'Rangoon', 1, null, false, false],
  ['malaya', 'Malaya', 'seasia', 'land', 'Singapore', 2, null, false, false],
  ['dei', 'Dutch East Indies', 'seasia', 'land', 'Batavia', 2, null, false, false],
  ['indochina', 'French Indochina', 'seasia', 'land', null, 0, null, false, false],
  ['thailand', 'Thailand', 'seasia', 'land', null, 0, 'thailand', false, false],
  ['india', 'India', 'seasia', 'land', null, 0, null, false, false],
  ['bay_of_bengal', 'Bay of Bengal', 'seasia', 'sea', null, 0, null, false, false],
  ['indian_ocean', 'Indian Ocean', 'seasia', 'sea', null, 0, null, false, false],
  // ——— The Pacific (10) ———
  ['united_states', 'United States', 'pacific', 'land', null, 0, 'usa', true, false],
  ['hawaii', 'Hawaii', 'pacific', 'land', null, 0, null, false, false],
  ['midway', 'Midway', 'pacific', 'land', 'Midway', 1, null, false, false],
  ['central_pacific', 'Central Pacific', 'pacific', 'sea', null, 0, null, false, false],
  ['south_pacific', 'South Pacific', 'pacific', 'sea', null, 0, null, false, false],
  ['solomons', 'Solomon Islands', 'pacific', 'land', null, 0, null, false, false],
  ['new_guinea', 'New Guinea', 'pacific', 'land', null, 0, null, false, false],
  ['philippines', 'Philippines', 'pacific', 'land', 'Manila', 2, null, false, false],
  ['marianas', 'Marianas', 'pacific', 'land', null, 0, null, false, false],
  ['japan', 'Japan', 'pacific', 'land', 'Tokyo', 3, 'japan', true, false],
];

export const SKELETON = T.map(([id, name, theatre, type, vc, vcWeight, capitalOf, industrial, interior]) => ({
  id, name, theatre, type,
  victoryCity: vc ? { name: vc, weight: vcWeight } : null,
  capitalOf, industrial, interior,
}));

// Every edge that crosses a theatre boundary (or is otherwise fixed by design).
// These are merged into the generated intra-theatre adjacency; content agents
// must NOT duplicate or contradict them.
export const CROSS_EDGES = [
  // west ↔ eastern / balkans / scandinavia / med / atlantic
  ['w_poland', 'e_poland'], ['w_poland', 'baltic_states'], ['w_poland', 'slovakia'],
  ['s_germany', 'austria'], ['bohemia', 'austria'], ['bohemia', 'slovakia'],
  ['s_france', 'n_italy'], ['s_france', 'west_med'],
  ['denmark', 'berlin'],
  ['britain', 'north_sea'], ['britain', 'western_approaches'], ['britain', 'north_atlantic'],
  ['low_countries', 'north_sea'], ['normandy', 'biscay'],
  ['berlin', 'baltic_sea'], ['w_poland', 'baltic_sea'],
  // scandinavia ↔ atlantic / eastern
  ['norway', 'north_sea'], ['norway', 'norwegian_sea'], ['n_norway', 'norwegian_sea'],
  ['denmark', 'north_sea'], ['denmark', 'baltic_sea'], ['sweden', 'baltic_sea'],
  ['finland', 'baltic_sea'], ['murmansk', 'norwegian_sea'],
  ['karelia', 'leningrad'], ['finland', 'leningrad'],
  // eastern ↔ atlantic / balkans / asia
  ['baltic_states', 'baltic_sea'], ['leningrad', 'baltic_sea'],
  ['romania', 'odessa'], ['romania', 'w_ukraine'], ['hungary', 'w_ukraine'],
  ['slovakia', 'e_poland'],
  ['siberia', 'manchuria'], ['siberia', 'sinkiang'],
  // med ↔ atlantic / balkans / seasia
  ['gibraltar', 'mid_atlantic'], ['egypt', 'indian_ocean'],
  ['greece', 'east_med'], ['albania', 'central_med'],
  ['n_italy', 'austria'], ['n_italy', 'croatia'],
  // asia ↔ pacific / seasia
  ['japan', 'korea'], ['japan', 'shanghai'],
  ['philippines', 's_china'], ['philippines', 'indochina'],
  ['dei', 'new_guinea'], ['dei', 'philippines'],
  ['yunnan', 'burma'], ['s_china', 'indochina'],
  // atlantic ↔ pacific (the two-ocean USA)
  ['united_states', 'eastern_seaboard'],
];

export const CORRIDORS = {
  arctic_convoy: {
    name: 'Arctic convoy', powers: ['uk', 'ussr'],
    edges: [['norwegian_sea', 'murmansk']],
  },
  gib_suez: {
    name: 'Gibraltar & Suez', powers: ['uk', 'usa'],
    edges: [['gibraltar', 'west_med'], ['east_med', 'egypt']],
  },
  burma_road: {
    name: 'Burma Road', powers: ['uk', 'usa', 'china'], // (uk OR usa) + china
    edges: [['burma', 'yunnan']],
  },
};

// Autumn 1939 starting-force budgets, per theatre, per owner. Content agents
// distribute these exact totals across their theatre's territories.
export const SETUP_BUDGETS = {
  eastern: { ussr: 18 },
  west: { germany: 14, uk: 4, france: 6, neutral: 2 },
  scandinavia: { neutral: 5, finland: 2, ussr: 2 },
  balkans: { germany: 1, italy: 1, hungary: 2, slovakia: 1, croatia: 1, romania: 3, bulgaria: 2, neutral: 4 },
  med: { italy: 10, uk: 6, france: 3 },
  atlantic: { uk: 6, germany: 2 },
  china_manchuria: { japan: 10, china: 13 },
  seasia: { uk: 6, thailand: 1, france: 1, neutral: 2 },
  pacific: { usa: 9, japan: 5 },
};
