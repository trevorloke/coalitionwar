// GENERATED CONTENT — produced by the content workflow, validated by sim/validate-data.js.
// Regenerate rather than hand-editing structure; tuning numbers by hand is fine.
export const GEN_TERRITORIES = {
 "e_poland": {
  "id": "e_poland",
  "terrain": "forest",
  "supply": 0,
  "adjacent": [
   "baltic_states",
   "belorussia",
   "w_ukraine"
  ],
  "coords": {
   "x": 735,
   "y": 250
  },
  "setup": {
   "owner": "ussr",
   "strength": 2,
   "fort": 0
  }
 },
 "baltic_states": {
  "id": "baltic_states",
  "terrain": "forest",
  "supply": 0,
  "adjacent": [
   "e_poland",
   "belorussia",
   "leningrad"
  ],
  "coords": {
   "x": 745,
   "y": 195
  },
  "setup": {
   "owner": "ussr",
   "strength": 2,
   "fort": 0
  }
 },
 "belorussia": {
  "id": "belorussia",
  "terrain": "forest",
  "supply": 0,
  "adjacent": [
   "e_poland",
   "baltic_states",
   "w_ukraine",
   "smolensk",
   "kiev"
  ],
  "coords": {
   "x": 800,
   "y": 250
  },
  "setup": {
   "owner": "ussr",
   "strength": 2,
   "fort": 0
  }
 },
 "w_ukraine": {
  "id": "w_ukraine",
  "terrain": "steppe",
  "supply": 0,
  "adjacent": [
   "e_poland",
   "belorussia",
   "kiev",
   "odessa"
  ],
  "coords": {
   "x": 760,
   "y": 320
  },
  "setup": {
   "owner": "ussr",
   "strength": 2,
   "fort": 0
  }
 },
 "kiev": {
  "id": "kiev",
  "terrain": "clear",
  "supply": 2,
  "adjacent": [
   "w_ukraine",
   "belorussia",
   "odessa",
   "orel",
   "kharkov"
  ],
  "coords": {
   "x": 830,
   "y": 315
  },
  "setup": {
   "owner": "ussr",
   "strength": 2,
   "fort": 0
  }
 },
 "odessa": {
  "id": "odessa",
  "terrain": "steppe",
  "supply": 1,
  "adjacent": [
   "w_ukraine",
   "kiev",
   "crimea"
  ],
  "coords": {
   "x": 790,
   "y": 385
  },
  "setup": {
   "owner": "ussr",
   "strength": 1,
   "fort": 0
  }
 },
 "crimea": {
  "id": "crimea",
  "terrain": "steppe",
  "supply": 0,
  "adjacent": [
   "odessa",
   "kuban"
  ],
  "coords": {
   "x": 855,
   "y": 420
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "smolensk": {
  "id": "smolensk",
  "terrain": "forest",
  "supply": 1,
  "adjacent": [
   "belorussia",
   "leningrad",
   "moscow",
   "orel"
  ],
  "coords": {
   "x": 865,
   "y": 235
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "leningrad": {
  "id": "leningrad",
  "terrain": "forest",
  "supply": 2,
  "adjacent": [
   "baltic_states",
   "smolensk",
   "moscow"
  ],
  "coords": {
   "x": 835,
   "y": 145
  },
  "setup": {
   "owner": "ussr",
   "strength": 2,
   "fort": 0
  }
 },
 "moscow": {
  "id": "moscow",
  "terrain": "forest",
  "supply": 3,
  "adjacent": [
   "leningrad",
   "smolensk",
   "orel",
   "urals"
  ],
  "coords": {
   "x": 930,
   "y": 200
  },
  "setup": {
   "owner": "ussr",
   "strength": 3,
   "fort": 1
  }
 },
 "orel": {
  "id": "orel",
  "terrain": "clear",
  "supply": 0,
  "adjacent": [
   "smolensk",
   "moscow",
   "kiev",
   "kharkov"
  ],
  "coords": {
   "x": 920,
   "y": 270
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "kharkov": {
  "id": "kharkov",
  "terrain": "steppe",
  "supply": 1,
  "adjacent": [
   "kiev",
   "orel",
   "rostov",
   "stalingrad"
  ],
  "coords": {
   "x": 900,
   "y": 330
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "rostov": {
  "id": "rostov",
  "terrain": "steppe",
  "supply": 1,
  "adjacent": [
   "kharkov",
   "stalingrad",
   "kuban"
  ],
  "coords": {
   "x": 940,
   "y": 385
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "stalingrad": {
  "id": "stalingrad",
  "terrain": "clear",
  "supply": 2,
  "adjacent": [
   "kharkov",
   "rostov",
   "urals"
  ],
  "coords": {
   "x": 990,
   "y": 330
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "kuban": {
  "id": "kuban",
  "terrain": "mountain",
  "supply": 0,
  "adjacent": [
   "crimea",
   "rostov",
   "baku"
  ],
  "coords": {
   "x": 920,
   "y": 435
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "baku": {
  "id": "baku",
  "terrain": "mountain",
  "supply": 4,
  "adjacent": [
   "kuban"
  ],
  "coords": {
   "x": 1000,
   "y": 440
  },
  "setup": {
   "owner": "ussr",
   "strength": 0,
   "fort": 0
  }
 },
 "urals": {
  "id": "urals",
  "terrain": "mountain",
  "supply": 3,
  "adjacent": [
   "moscow",
   "stalingrad",
   "siberia"
  ],
  "coords": {
   "x": 1040,
   "y": 215
  },
  "setup": {
   "owner": "ussr",
   "strength": 1,
   "fort": 0
  }
 },
 "siberia": {
  "id": "siberia",
  "terrain": "forest",
  "supply": 0,
  "adjacent": [
   "urals"
  ],
  "coords": {
   "x": 1075,
   "y": 150
  },
  "setup": {
   "owner": "ussr",
   "strength": 1,
   "fort": 0
  }
 },
 "britain": {
  "id": "britain",
  "terrain": "clear",
  "supply": 4,
  "adjacent": [],
  "coords": {
   "x": 395,
   "y": 160
  },
  "setup": {
   "owner": "uk",
   "strength": 4,
   "fort": 0
  }
 },
 "normandy": {
  "id": "normandy",
  "terrain": "clear",
  "supply": 0,
  "adjacent": [
   "paris",
   "s_france",
   "low_countries"
  ],
  "coords": {
   "x": 410,
   "y": 250
  },
  "setup": {
   "owner": "france",
   "strength": 2,
   "fort": 0
  }
 },
 "paris": {
  "id": "paris",
  "terrain": "clear",
  "supply": 3,
  "adjacent": [
   "normandy",
   "s_france",
   "low_countries",
   "rhineland"
  ],
  "coords": {
   "x": 455,
   "y": 285
  },
  "setup": {
   "owner": "france",
   "strength": 3,
   "fort": 0
  }
 },
 "s_france": {
  "id": "s_france",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "paris",
   "normandy"
  ],
  "coords": {
   "x": 425,
   "y": 350
  },
  "setup": {
   "owner": "france",
   "strength": 1,
   "fort": 0
  }
 },
 "low_countries": {
  "id": "low_countries",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "normandy",
   "paris",
   "rhineland",
   "ruhr"
  ],
  "coords": {
   "x": 470,
   "y": 205
  },
  "setup": {
   "owner": "neutral",
   "strength": 2,
   "fort": 0
  }
 },
 "rhineland": {
  "id": "rhineland",
  "terrain": "forest",
  "supply": 2,
  "adjacent": [
   "low_countries",
   "paris",
   "ruhr",
   "s_germany"
  ],
  "coords": {
   "x": 505,
   "y": 250
  },
  "setup": {
   "owner": "germany",
   "strength": 3,
   "fort": 1
  }
 },
 "ruhr": {
  "id": "ruhr",
  "terrain": "urban",
  "supply": 4,
  "adjacent": [
   "low_countries",
   "rhineland",
   "berlin"
  ],
  "coords": {
   "x": 515,
   "y": 180
  },
  "setup": {
   "owner": "germany",
   "strength": 2,
   "fort": 0
  }
 },
 "s_germany": {
  "id": "s_germany",
  "terrain": "forest",
  "supply": 2,
  "adjacent": [
   "rhineland",
   "berlin",
   "bohemia"
  ],
  "coords": {
   "x": 540,
   "y": 315
  },
  "setup": {
   "owner": "germany",
   "strength": 2,
   "fort": 0
  }
 },
 "bohemia": {
  "id": "bohemia",
  "terrain": "forest",
  "supply": 2,
  "adjacent": [
   "s_germany",
   "berlin",
   "w_poland"
  ],
  "coords": {
   "x": 590,
   "y": 300
  },
  "setup": {
   "owner": "germany",
   "strength": 1,
   "fort": 0
  }
 },
 "berlin": {
  "id": "berlin",
  "terrain": "clear",
  "supply": 3,
  "adjacent": [
   "ruhr",
   "s_germany",
   "bohemia",
   "w_poland"
  ],
  "coords": {
   "x": 585,
   "y": 175
  },
  "setup": {
   "owner": "germany",
   "strength": 3,
   "fort": 0
  }
 },
 "w_poland": {
  "id": "w_poland",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "berlin",
   "bohemia"
  ],
  "coords": {
   "x": 635,
   "y": 220
  },
  "setup": {
   "owner": "germany",
   "strength": 3,
   "fort": 0
  }
 },
 "norway": {
  "id": "norway",
  "terrain": "mountain",
  "supply": 1,
  "adjacent": [
   "n_norway",
   "sweden",
   "denmark"
  ],
  "coords": {
   "x": 585,
   "y": 75
  },
  "setup": {
   "owner": "neutral",
   "strength": 1,
   "fort": 0
  }
 },
 "n_norway": {
  "id": "n_norway",
  "terrain": "mountain",
  "supply": 0,
  "adjacent": [
   "norway",
   "murmansk"
  ],
  "coords": {
   "x": 630,
   "y": 30
  },
  "setup": {
   "owner": "neutral",
   "strength": 1,
   "fort": 0
  }
 },
 "denmark": {
  "id": "denmark",
  "terrain": "forest",
  "supply": 1,
  "adjacent": [
   "norway"
  ],
  "coords": {
   "x": 570,
   "y": 115
  },
  "setup": {
   "owner": "neutral",
   "strength": 1,
   "fort": 0
  }
 },
 "sweden": {
  "id": "sweden",
  "terrain": "forest",
  "supply": 2,
  "adjacent": [
   "norway",
   "finland"
  ],
  "coords": {
   "x": 640,
   "y": 90
  },
  "setup": {
   "owner": "neutral",
   "strength": 2,
   "fort": 0
  }
 },
 "finland": {
  "id": "finland",
  "terrain": "forest",
  "supply": 1,
  "adjacent": [
   "sweden",
   "karelia"
  ],
  "coords": {
   "x": 700,
   "y": 70
  },
  "setup": {
   "owner": "finland",
   "strength": 2,
   "fort": 0
  }
 },
 "karelia": {
  "id": "karelia",
  "terrain": "forest",
  "supply": 0,
  "adjacent": [
   "finland",
   "murmansk"
  ],
  "coords": {
   "x": 760,
   "y": 85
  },
  "setup": {
   "owner": "ussr",
   "strength": 1,
   "fort": 0
  }
 },
 "murmansk": {
  "id": "murmansk",
  "terrain": "forest",
  "supply": 0,
  "adjacent": [
   "n_norway",
   "karelia"
  ],
  "coords": {
   "x": 800,
   "y": 35
  },
  "setup": {
   "owner": "ussr",
   "strength": 1,
   "fort": 0
  }
 },
 "austria": {
  "id": "austria",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "hungary",
   "slovakia"
  ],
  "coords": {
   "x": 600,
   "y": 415
  },
  "setup": {
   "owner": "germany",
   "strength": 1,
   "fort": 0
  }
 },
 "slovakia": {
  "id": "slovakia",
  "terrain": "clear",
  "supply": 0,
  "adjacent": [
   "austria",
   "hungary"
  ],
  "coords": {
   "x": 665,
   "y": 408
  },
  "setup": {
   "owner": "slovakia",
   "strength": 1,
   "fort": 0
  }
 },
 "hungary": {
  "id": "hungary",
  "terrain": "clear",
  "supply": 2,
  "adjacent": [
   "austria",
   "slovakia",
   "romania",
   "croatia"
  ],
  "coords": {
   "x": 655,
   "y": 440
  },
  "setup": {
   "owner": "hungary",
   "strength": 2,
   "fort": 0
  }
 },
 "croatia": {
  "id": "croatia",
  "terrain": "mountain",
  "supply": 0,
  "adjacent": [
   "hungary",
   "serbia"
  ],
  "coords": {
   "x": 600,
   "y": 460
  },
  "setup": {
   "owner": "croatia",
   "strength": 1,
   "fort": 0
  }
 },
 "romania": {
  "id": "romania",
  "terrain": "clear",
  "supply": 3,
  "adjacent": [
   "hungary",
   "serbia",
   "bulgaria"
  ],
  "coords": {
   "x": 760,
   "y": 435
  },
  "setup": {
   "owner": "romania",
   "strength": 3,
   "fort": 0
  }
 },
 "serbia": {
  "id": "serbia",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "croatia",
   "romania",
   "bulgaria",
   "albania"
  ],
  "coords": {
   "x": 665,
   "y": 480
  },
  "setup": {
   "owner": "neutral",
   "strength": 2,
   "fort": 0
  }
 },
 "bulgaria": {
  "id": "bulgaria",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "serbia",
   "romania",
   "greece"
  ],
  "coords": {
   "x": 750,
   "y": 490
  },
  "setup": {
   "owner": "bulgaria",
   "strength": 2,
   "fort": 0
  }
 },
 "albania": {
  "id": "albania",
  "terrain": "mountain",
  "supply": 0,
  "adjacent": [
   "serbia",
   "greece"
  ],
  "coords": {
   "x": 630,
   "y": 515
  },
  "setup": {
   "owner": "italy",
   "strength": 1,
   "fort": 0
  }
 },
 "greece": {
  "id": "greece",
  "terrain": "mountain",
  "supply": 1,
  "adjacent": [
   "albania",
   "bulgaria"
  ],
  "coords": {
   "x": 700,
   "y": 535
  },
  "setup": {
   "owner": "neutral",
   "strength": 2,
   "fort": 0
  }
 },
 "gibraltar": {
  "id": "gibraltar",
  "terrain": "mountain",
  "supply": 1,
  "adjacent": [
   "west_med"
  ],
  "coords": {
   "x": 290,
   "y": 620
  },
  "setup": {
   "owner": "uk",
   "strength": 2,
   "fort": 0
  }
 },
 "west_med": {
  "id": "west_med",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "gibraltar",
   "fr_n_africa",
   "tunisia",
   "n_italy",
   "sicily",
   "central_med"
  ],
  "coords": {
   "x": 430,
   "y": 630
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "central_med": {
  "id": "central_med",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "west_med",
   "east_med",
   "tunisia",
   "tripolitania",
   "cyrenaica",
   "sicily",
   "s_italy",
   "malta"
  ],
  "coords": {
   "x": 575,
   "y": 715
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "east_med": {
  "id": "east_med",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "central_med",
   "cyrenaica",
   "egypt"
  ],
  "coords": {
   "x": 725,
   "y": 700
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "fr_n_africa": {
  "id": "fr_n_africa",
  "terrain": "desert",
  "supply": 1,
  "adjacent": [
   "tunisia",
   "west_med"
  ],
  "coords": {
   "x": 330,
   "y": 700
  },
  "setup": {
   "owner": "france",
   "strength": 1,
   "fort": 0
  }
 },
 "tunisia": {
  "id": "tunisia",
  "terrain": "desert",
  "supply": 1,
  "adjacent": [
   "fr_n_africa",
   "tripolitania",
   "west_med",
   "central_med"
  ],
  "coords": {
   "x": 465,
   "y": 705
  },
  "setup": {
   "owner": "france",
   "strength": 2,
   "fort": 0
  }
 },
 "tripolitania": {
  "id": "tripolitania",
  "terrain": "desert",
  "supply": 0,
  "adjacent": [
   "tunisia",
   "cyrenaica",
   "central_med"
  ],
  "coords": {
   "x": 520,
   "y": 760
  },
  "setup": {
   "owner": "italy",
   "strength": 2,
   "fort": 0
  }
 },
 "cyrenaica": {
  "id": "cyrenaica",
  "terrain": "desert",
  "supply": 0,
  "adjacent": [
   "tripolitania",
   "egypt",
   "central_med",
   "east_med"
  ],
  "coords": {
   "x": 610,
   "y": 765
  },
  "setup": {
   "owner": "italy",
   "strength": 2,
   "fort": 0
  }
 },
 "egypt": {
  "id": "egypt",
  "terrain": "desert",
  "supply": 2,
  "adjacent": [
   "cyrenaica",
   "east_med"
  ],
  "coords": {
   "x": 720,
   "y": 760
  },
  "setup": {
   "owner": "uk",
   "strength": 3,
   "fort": 0
  }
 },
 "malta": {
  "id": "malta",
  "terrain": "island",
  "supply": 0,
  "adjacent": [
   "central_med"
  ],
  "coords": {
   "x": 655,
   "y": 690
  },
  "setup": {
   "owner": "uk",
   "strength": 1,
   "fort": 1
  }
 },
 "sicily": {
  "id": "sicily",
  "terrain": "island",
  "supply": 1,
  "adjacent": [
   "s_italy",
   "west_med",
   "central_med"
  ],
  "coords": {
   "x": 600,
   "y": 655
  },
  "setup": {
   "owner": "italy",
   "strength": 1,
   "fort": 0
  }
 },
 "s_italy": {
  "id": "s_italy",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "n_italy",
   "sicily",
   "central_med"
  ],
  "coords": {
   "x": 645,
   "y": 615
  },
  "setup": {
   "owner": "italy",
   "strength": 2,
   "fort": 0
  }
 },
 "n_italy": {
  "id": "n_italy",
  "terrain": "clear",
  "supply": 3,
  "adjacent": [
   "s_italy",
   "west_med"
  ],
  "coords": {
   "x": 600,
   "y": 570
  },
  "setup": {
   "owner": "italy",
   "strength": 3,
   "fort": 0
  }
 },
 "north_atlantic": {
  "id": "north_atlantic",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "mid_atlantic",
   "western_approaches",
   "norwegian_sea",
   "eastern_seaboard"
  ],
  "coords": {
   "x": 160,
   "y": 120
  },
  "setup": {
   "owner": "uk",
   "strength": 1,
   "fort": 0
  }
 },
 "mid_atlantic": {
  "id": "mid_atlantic",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "north_atlantic",
   "eastern_seaboard",
   "biscay",
   "western_approaches"
  ],
  "coords": {
   "x": 150,
   "y": 300
  },
  "setup": {
   "owner": "uk",
   "strength": 1,
   "fort": 0
  }
 },
 "western_approaches": {
  "id": "western_approaches",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "north_atlantic",
   "mid_atlantic",
   "north_sea",
   "biscay"
  ],
  "coords": {
   "x": 240,
   "y": 230
  },
  "setup": {
   "owner": "uk",
   "strength": 2,
   "fort": 0
  }
 },
 "north_sea": {
  "id": "north_sea",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "western_approaches",
   "norwegian_sea",
   "baltic_sea"
  ],
  "coords": {
   "x": 300,
   "y": 150
  },
  "setup": {
   "owner": "uk",
   "strength": 2,
   "fort": 0
  }
 },
 "norwegian_sea": {
  "id": "norwegian_sea",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "north_atlantic",
   "north_sea"
  ],
  "coords": {
   "x": 280,
   "y": 60
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "baltic_sea": {
  "id": "baltic_sea",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "north_sea"
  ],
  "coords": {
   "x": 350,
   "y": 120
  },
  "setup": {
   "owner": "germany",
   "strength": 1,
   "fort": 0
  }
 },
 "biscay": {
  "id": "biscay",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "mid_atlantic",
   "western_approaches"
  ],
  "coords": {
   "x": 250,
   "y": 350
  },
  "setup": {
   "owner": "germany",
   "strength": 1,
   "fort": 0
  }
 },
 "eastern_seaboard": {
  "id": "eastern_seaboard",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "north_atlantic",
   "mid_atlantic"
  ],
  "coords": {
   "x": 60,
   "y": 230
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "manchuria": {
  "id": "manchuria",
  "terrain": "clear",
  "supply": 3,
  "adjacent": [
   "korea",
   "inner_mongolia",
   "n_china"
  ],
  "coords": {
   "x": 1300,
   "y": 215
  },
  "setup": {
   "owner": "japan",
   "strength": 3,
   "fort": 0
  }
 },
 "korea": {
  "id": "korea",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "manchuria"
  ],
  "coords": {
   "x": 1370,
   "y": 250
  },
  "setup": {
   "owner": "japan",
   "strength": 2,
   "fort": 0
  }
 },
 "inner_mongolia": {
  "id": "inner_mongolia",
  "terrain": "steppe",
  "supply": 0,
  "adjacent": [
   "manchuria",
   "n_china",
   "shensi",
   "sinkiang"
  ],
  "coords": {
   "x": 1200,
   "y": 235
  },
  "setup": {
   "owner": "china",
   "strength": 1,
   "fort": 0
  }
 },
 "n_china": {
  "id": "n_china",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "manchuria",
   "inner_mongolia",
   "shantung",
   "shensi",
   "c_china"
  ],
  "coords": {
   "x": 1270,
   "y": 290
  },
  "setup": {
   "owner": "japan",
   "strength": 2,
   "fort": 0
  }
 },
 "shantung": {
  "id": "shantung",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "n_china",
   "c_china"
  ],
  "coords": {
   "x": 1340,
   "y": 310
  },
  "setup": {
   "owner": "japan",
   "strength": 1,
   "fort": 0
  }
 },
 "c_china": {
  "id": "c_china",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "n_china",
   "shantung",
   "shanghai",
   "shensi",
   "chongqing",
   "s_china"
  ],
  "coords": {
   "x": 1280,
   "y": 365
  },
  "setup": {
   "owner": "china",
   "strength": 3,
   "fort": 0
  }
 },
 "shanghai": {
  "id": "shanghai",
  "terrain": "urban",
  "supply": 2,
  "adjacent": [
   "c_china",
   "s_china"
  ],
  "coords": {
   "x": 1360,
   "y": 380
  },
  "setup": {
   "owner": "japan",
   "strength": 2,
   "fort": 0
  }
 },
 "s_china": {
  "id": "s_china",
  "terrain": "clear",
  "supply": 1,
  "adjacent": [
   "c_china",
   "shanghai",
   "yunnan"
  ],
  "coords": {
   "x": 1310,
   "y": 440
  },
  "setup": {
   "owner": "china",
   "strength": 2,
   "fort": 0
  }
 },
 "chongqing": {
  "id": "chongqing",
  "terrain": "mountain",
  "supply": 2,
  "adjacent": [
   "c_china",
   "shensi",
   "yunnan"
  ],
  "coords": {
   "x": 1210,
   "y": 390
  },
  "setup": {
   "owner": "china",
   "strength": 3,
   "fort": 0
  }
 },
 "yunnan": {
  "id": "yunnan",
  "terrain": "mountain",
  "supply": 0,
  "adjacent": [
   "s_china",
   "chongqing"
  ],
  "coords": {
   "x": 1220,
   "y": 460
  },
  "setup": {
   "owner": "china",
   "strength": 1,
   "fort": 0
  }
 },
 "shensi": {
  "id": "shensi",
  "terrain": "mountain",
  "supply": 0,
  "adjacent": [
   "inner_mongolia",
   "n_china",
   "c_china",
   "chongqing"
  ],
  "coords": {
   "x": 1195,
   "y": 320
  },
  "setup": {
   "owner": "china",
   "strength": 2,
   "fort": 0
  }
 },
 "sinkiang": {
  "id": "sinkiang",
  "terrain": "steppe",
  "supply": 0,
  "adjacent": [
   "inner_mongolia"
  ],
  "coords": {
   "x": 1115,
   "y": 260
  },
  "setup": {
   "owner": "china",
   "strength": 1,
   "fort": 0
  }
 },
 "india": {
  "id": "india",
  "terrain": "clear",
  "supply": 3,
  "adjacent": [
   "burma",
   "bay_of_bengal",
   "indian_ocean"
  ],
  "coords": {
   "x": 1020,
   "y": 590
  },
  "setup": {
   "owner": "uk",
   "strength": 3,
   "fort": 0
  }
 },
 "burma": {
  "id": "burma",
  "terrain": "jungle",
  "supply": 1,
  "adjacent": [
   "india",
   "thailand",
   "bay_of_bengal"
  ],
  "coords": {
   "x": 1140,
   "y": 590
  },
  "setup": {
   "owner": "uk",
   "strength": 1,
   "fort": 0
  }
 },
 "thailand": {
  "id": "thailand",
  "terrain": "jungle",
  "supply": 0,
  "adjacent": [
   "burma",
   "indochina",
   "malaya"
  ],
  "coords": {
   "x": 1200,
   "y": 640
  },
  "setup": {
   "owner": "thailand",
   "strength": 1,
   "fort": 0
  }
 },
 "indochina": {
  "id": "indochina",
  "terrain": "jungle",
  "supply": 1,
  "adjacent": [
   "thailand"
  ],
  "coords": {
   "x": 1280,
   "y": 620
  },
  "setup": {
   "owner": "france",
   "strength": 1,
   "fort": 0
  }
 },
 "malaya": {
  "id": "malaya",
  "terrain": "jungle",
  "supply": 2,
  "adjacent": [
   "thailand",
   "dei",
   "bay_of_bengal",
   "indian_ocean"
  ],
  "coords": {
   "x": 1210,
   "y": 720
  },
  "setup": {
   "owner": "uk",
   "strength": 2,
   "fort": 1
  }
 },
 "dei": {
  "id": "dei",
  "terrain": "jungle",
  "supply": 3,
  "adjacent": [
   "malaya",
   "indian_ocean"
  ],
  "coords": {
   "x": 1300,
   "y": 780
  },
  "setup": {
   "owner": "neutral",
   "strength": 2,
   "fort": 0
  }
 },
 "bay_of_bengal": {
  "id": "bay_of_bengal",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "india",
   "burma",
   "malaya",
   "indian_ocean"
  ],
  "coords": {
   "x": 1120,
   "y": 670
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "indian_ocean": {
  "id": "indian_ocean",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "india",
   "dei",
   "malaya",
   "bay_of_bengal"
  ],
  "coords": {
   "x": 1040,
   "y": 760
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "united_states": {
  "id": "united_states",
  "terrain": "clear",
  "supply": 4,
  "adjacent": [
   "hawaii"
  ],
  "coords": {
   "x": 1565,
   "y": 200
  },
  "setup": {
   "owner": "usa",
   "strength": 4,
   "fort": 0
  }
 },
 "hawaii": {
  "id": "hawaii",
  "terrain": "island",
  "supply": 1,
  "adjacent": [
   "united_states",
   "midway",
   "central_pacific",
   "south_pacific"
  ],
  "coords": {
   "x": 1520,
   "y": 300
  },
  "setup": {
   "owner": "usa",
   "strength": 2,
   "fort": 0
  }
 },
 "midway": {
  "id": "midway",
  "terrain": "island",
  "supply": 0,
  "adjacent": [
   "hawaii",
   "central_pacific"
  ],
  "coords": {
   "x": 1500,
   "y": 150
  },
  "setup": {
   "owner": "usa",
   "strength": 1,
   "fort": 0
  }
 },
 "central_pacific": {
  "id": "central_pacific",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "japan",
   "marianas",
   "midway",
   "hawaii",
   "philippines",
   "south_pacific"
  ],
  "coords": {
   "x": 1470,
   "y": 400
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "south_pacific": {
  "id": "south_pacific",
  "terrain": "sea",
  "supply": 0,
  "adjacent": [
   "central_pacific",
   "hawaii",
   "philippines",
   "new_guinea",
   "solomons"
  ],
  "coords": {
   "x": 1480,
   "y": 570
  },
  "setup": {
   "owner": "none",
   "strength": 0,
   "fort": 0
  }
 },
 "solomons": {
  "id": "solomons",
  "terrain": "island",
  "supply": 0,
  "adjacent": [
   "south_pacific"
  ],
  "coords": {
   "x": 1540,
   "y": 660
  },
  "setup": {
   "owner": "uk",
   "strength": 0,
   "fort": 0
  }
 },
 "new_guinea": {
  "id": "new_guinea",
  "terrain": "island",
  "supply": 0,
  "adjacent": [
   "south_pacific"
  ],
  "coords": {
   "x": 1420,
   "y": 640
  },
  "setup": {
   "owner": "uk",
   "strength": 0,
   "fort": 0
  }
 },
 "philippines": {
  "id": "philippines",
  "terrain": "island",
  "supply": 1,
  "adjacent": [
   "central_pacific",
   "south_pacific"
  ],
  "coords": {
   "x": 1405,
   "y": 470
  },
  "setup": {
   "owner": "usa",
   "strength": 2,
   "fort": 0
  }
 },
 "marianas": {
  "id": "marianas",
  "terrain": "island",
  "supply": 0,
  "adjacent": [
   "japan",
   "central_pacific"
  ],
  "coords": {
   "x": 1430,
   "y": 250
  },
  "setup": {
   "owner": "japan",
   "strength": 1,
   "fort": 0
  }
 },
 "japan": {
  "id": "japan",
  "terrain": "island",
  "supply": 3,
  "adjacent": [
   "marianas",
   "central_pacific"
  ],
  "coords": {
   "x": 1410,
   "y": 100
  },
  "setup": {
   "owner": "japan",
   "strength": 4,
   "fort": 0
  }
 }
};
