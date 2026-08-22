"use strict";
// Canonical BlackPyre exercise library. DATA ONLY — shapes and behavior live in scripts/03-train.js.
const EXERCISE_LIBRARY = [
  {
    "id": "bp:ab-wheel",
    "name": "Ab Wheel",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "lats",
        "shoulders"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:agility-ladder",
    "name": "Agility Ladder",
    "shape": "timeDist",
    "tags": [
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:air-bike",
    "name": "Air Bike",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [
      "assault bike"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bike"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:american-football",
    "name": "American Football",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [
      "football"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:approach-jump",
    "name": "Approach Jump",
    "shape": "reps",
    "tags": [
      "power",
      "conditioning",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:arnold-press",
    "name": "Arnold Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "side-delts",
        "triceps"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:assisted-pull-up",
    "name": "Assisted Pull-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "biceps",
        "mid-back"
      ]
    },
    "equipment": [
      "machine",
      "bands",
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:back-extension",
    "name": "Back Extension",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lower-back",
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:back-squat",
    "name": "Back Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "lower"
    ],
    "aliases": [
      "squat",
      "barbell squat"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:backward-sled-drag",
    "name": "Backward Sled Drag",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "conditioning",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "calves"
      ]
    },
    "equipment": [
      "sled"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:bar-muscle-up",
    "name": "Bar Muscle-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back",
        "arms"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:barbell-floor-press",
    "name": "Barbell Floor Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:barbell-high-pull",
    "name": "Barbell High Pull",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "pull",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "traps"
      ],
      "secondary": [
        "glutes",
        "hamstrings",
        "shoulders"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:barbell-row",
    "name": "Barbell Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [
      "bent-over row",
      "bent over barbell row"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "mid-back"
      ],
      "secondary": [
        "biceps",
        "rear-delts"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:baseball-softball",
    "name": "Baseball / Softball",
    "shape": "text",
    "tags": [
      "sport"
    ],
    "aliases": [
      "baseball",
      "softball"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:basketball",
    "name": "Basketball",
    "shape": "text",
    "tags": [
      "sport",
      "cardio",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "shoulders",
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:battle-rope-intervals",
    "name": "Battle Rope Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "upper"
    ],
    "aliases": [
      "battle ropes"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "arms"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "battle-rope"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:battle-ropes",
    "name": "Battle Rope Conditioning",
    "shape": "timeDist",
    "tags": [
      "conditioning",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "arms"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "battle-rope"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:bear-crawl",
    "name": "Bear Crawl",
    "shape": "timeDist",
    "tags": [
      "conditioning",
      "bodyweight",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:belt-squat",
    "name": "Belt Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:bench-dip",
    "name": "Bench Dip",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": [
        "chest",
        "front-delts"
      ]
    },
    "equipment": [
      "bodyweight",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:bench-press",
    "name": "Bench Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [
      "barbell bench",
      "bp",
      "chest press"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:biceps-curl",
    "name": "Biceps Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:bike",
    "name": "Bike",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [
      "biking"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes",
        "calves"
      ]
    },
    "equipment": [
      "bike"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:bike-intervals",
    "name": "Bike Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [
      "cycling intervals"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes",
        "calves"
      ]
    },
    "equipment": [
      "bike"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:bird-dog",
    "name": "Bird Dog",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "glutes",
        "lower-back"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:bodyweight-squat",
    "name": "Bodyweight Squat",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:box-jump",
    "name": "Box Jump",
    "shape": "reps",
    "tags": [
      "power",
      "bodyweight",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "calves",
        "hamstrings"
      ]
    },
    "equipment": [
      "bodyweight",
      "box"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:box-squat",
    "name": "Box Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "rack",
      "box"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:boxing",
    "name": "Boxing",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:broad-jump",
    "name": "Broad Jump",
    "shape": "reps",
    "tags": [
      "power",
      "bodyweight",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads"
      ],
      "secondary": [
        "hamstrings",
        "calves"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:bulgarian-split-squat",
    "name": "Bulgarian Split Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "lunge",
      "lower"
    ],
    "aliases": [
      "bulgarian lunge",
      "bss"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:burpee",
    "name": "Burpee",
    "shape": "reps",
    "tags": [
      "conditioning",
      "bodyweight",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:burpee-box-jump",
    "name": "Burpee Box Jump",
    "shape": "reps",
    "tags": [
      "conditioning",
      "power",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "box"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:burpee-broad-jump",
    "name": "Burpee Broad Jump",
    "shape": "reps",
    "tags": [
      "conditioning",
      "power",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:burpee-intervals",
    "name": "Burpee Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "bodyweight",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs",
        "chest"
      ],
      "secondary": [
        "shoulders",
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:cable-crossover",
    "name": "Cable Crossover",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": []
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-crunch",
    "name": "Cable Crunch",
    "shape": "lift",
    "tags": [
      "strength",
      "core",
      "isolation"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": []
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-curl",
    "name": "Cable Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-glute-kickback",
    "name": "Cable Glute Kickback",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-lateral-raise",
    "name": "Cable Lateral Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "side-delts"
      ],
      "secondary": []
    },
    "equipment": [
      "cable"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-overhead-triceps-extension",
    "name": "Cable Overhead Triceps Extension",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-pull-through",
    "name": "Cable Pull-Through",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "hamstrings"
      ],
      "secondary": [
        "lower-back"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-pullover",
    "name": "Cable Pullover",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "chest"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cable-shrug",
    "name": "Cable Shrug",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "traps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:calf-raise",
    "name": "Calf Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "calves"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:chest-fly",
    "name": "Chest Fly",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": []
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:chest-supported-dumbbell-row",
    "name": "Chest-Supported Dumbbell Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps",
        "rear-delts"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:chest-supported-row",
    "name": "Chest-Supported Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back"
      ],
      "secondary": [
        "biceps"
      ]
    },
    "equipment": [
      "bench",
      "dumbbell",
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:chin-up",
    "name": "Chin-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull",
      "upper"
    ],
    "aliases": [
      "chinup",
      "chin up"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "biceps"
      ],
      "secondary": [
        "mid-back"
      ]
    },
    "equipment": [
      "bodyweight",
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:clean-and-jerk",
    "name": "Clean and Jerk",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes",
        "shoulders"
      ],
      "secondary": [
        "hamstrings",
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:close-grip-bench-press",
    "name": "Close-Grip Bench Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": [
        "chest",
        "front-delts"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:concentration-curl",
    "name": "Concentration Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:cone-drill",
    "name": "Cone Drill",
    "shape": "timeDist",
    "tags": [
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:copenhagen-plank",
    "name": "Copenhagen Plank",
    "shape": "timeDist",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "adductors",
        "obliques"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight",
      "bench"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:crab-walk",
    "name": "Crab Walk",
    "shape": "timeDist",
    "tags": [
      "conditioning",
      "bodyweight",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:cross-country-ski",
    "name": "Cross-Country Ski",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs",
        "lats"
      ],
      "secondary": [
        "shoulders",
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:custom-conditioning",
    "name": "Custom Conditioning",
    "shape": "text",
    "tags": [
      "conditioning"
    ],
    "aliases": [
      "hiit circuit"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dance",
    "name": "Dance",
    "shape": "text",
    "tags": [
      "sport",
      "cardio"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dead-bug",
    "name": "Dead Bug",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "hip-flexors"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:deadlift",
    "name": "Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "pull",
      "full-body"
    ],
    "aliases": [
      "conventional deadlift"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "hamstrings",
        "lower-back"
      ],
      "secondary": [
        "quads",
        "traps",
        "forearms"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:decline-bench-press",
    "name": "Decline Bench Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lower-chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:decline-push-up",
    "name": "Decline Push-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "upper-chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "bodyweight",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:depth-jump",
    "name": "Depth Jump",
    "shape": "reps",
    "tags": [
      "power",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "box"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:devil-press",
    "name": "Devil Press",
    "shape": "reps",
    "tags": [
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:diamond-push-up",
    "name": "Diamond Push-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": [
        "chest",
        "front-delts"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:dips",
    "name": "Dips",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [
      "dip"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps",
        "chest"
      ],
      "secondary": [
        "front-delts"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:donkey-calf-raise",
    "name": "Donkey Calf Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "calves"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-bench-press",
    "name": "Dumbbell Bench Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [
      "flat dumbbell press",
      "dumbbell chest press"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-clean-and-jerk",
    "name": "Dumbbell Clean and Jerk",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-curl",
    "name": "Dumbbell Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-floor-press",
    "name": "Dumbbell Floor Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-incline-press",
    "name": "Dumbbell Incline Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "upper-chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-pullover",
    "name": "Dumbbell Pullover",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "chest",
        "triceps"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-romanian-deadlift",
    "name": "Dumbbell Romanian Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings",
        "glutes"
      ],
      "secondary": [
        "lower-back",
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-row",
    "name": "Dumbbell Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [
      "one-arm dumbbell row",
      "single arm dumbbell row"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "mid-back"
      ],
      "secondary": [
        "biceps",
        "rear-delts"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-shoulder-press",
    "name": "Dumbbell Shoulder Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "triceps",
        "side-delts"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-shrug",
    "name": "Dumbbell Shrug",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "traps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-skullcrusher",
    "name": "Dumbbell Skullcrusher",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-snatch",
    "name": "Dumbbell Snatch",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:dumbbell-thruster",
    "name": "Dumbbell Thruster",
    "shape": "lift",
    "tags": [
      "strength",
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "shoulders"
      ],
      "secondary": [
        "glutes",
        "triceps"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:elliptical",
    "name": "Elliptical",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "recovery"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "elliptical"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:emom-conditioning",
    "name": "EMOM Conditioning",
    "shape": "rounds",
    "tags": [
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:face-pull",
    "name": "Face Pull",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "rear-delts",
        "upper-back"
      ],
      "secondary": [
        "rotator-cuff"
      ]
    },
    "equipment": [
      "cable",
      "bands"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:farmer-carry",
    "name": "Farmer Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [
      "farmer's walk",
      "farmers walk"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "forearms",
        "traps"
      ],
      "secondary": [
        "core",
        "legs"
      ]
    },
    "equipment": [
      "dumbbell",
      "kettlebell",
      "trap-bar"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:front-rack-carry",
    "name": "Front Rack Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "upper-back"
      ],
      "secondary": [
        "legs",
        "forearms"
      ]
    },
    "equipment": [
      "barbell",
      "kettlebell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:front-raise",
    "name": "Front Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": []
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:front-squat",
    "name": "Front Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:front-foot-elevated-split-squat",
    "name": "Front-Foot-Elevated Split Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "lunge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "dumbbell",
      "step"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:functional-fitness",
    "name": "Functional Fitness",
    "shape": "text",
    "tags": [
      "conditioning",
      "full-body"
    ],
    "aliases": [
      "mixed-modal conditioning"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:ghd-sit-up",
    "name": "GHD Sit-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "hip-flexors"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:glute-bridge",
    "name": "Glute Bridge",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:goblet-squat",
    "name": "Goblet Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "dumbbell",
      "kettlebell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:golf",
    "name": "Golf",
    "shape": "text",
    "tags": [
      "sport"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:good-morning",
    "name": "Good Morning",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings",
        "glutes"
      ],
      "secondary": [
        "lower-back",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hack-squat",
    "name": "Hack Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hammer-curl",
    "name": "Hammer Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "brachialis"
      ],
      "secondary": [
        "biceps",
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:handstand-push-up",
    "name": "Handstand Push-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:handstand-walk",
    "name": "Handstand Walk",
    "shape": "timeDist",
    "tags": [
      "bodyweight",
      "conditioning",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:hang-clean",
    "name": "Hang Clean",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hang-power-clean",
    "name": "Hang Power Clean",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "traps"
      ],
      "secondary": [
        "quads",
        "hamstrings",
        "shoulders"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hang-power-snatch",
    "name": "Hang Power Snatch",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "traps",
        "shoulders"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hanging-knee-raise",
    "name": "Hanging Knee Raise",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "hip-flexors"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "bodyweight",
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:hanging-leg-raise",
    "name": "Hanging Leg Raise",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "hip-flexors"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "bodyweight",
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:high-bar-back-squat",
    "name": "High-Bar Back Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hike",
    "name": "Hike",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "recovery"
    ],
    "aliases": [
      "hiking"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core",
        "calves"
      ]
    },
    "equipment": [
      "trail"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hill-sprints",
    "name": "Hill Sprints",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "power"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads"
      ],
      "secondary": [
        "calves",
        "core"
      ]
    },
    "equipment": [
      "road",
      "trail"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hip-abduction-machine",
    "name": "Hip Abduction Machine",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glute-med"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hip-adduction-machine",
    "name": "Hip Adduction Machine",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "adductors"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hip-thrust",
    "name": "Hip Thrust",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [
      "glute thrust"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hockey",
    "name": "Hockey",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:hollow-body-hold",
    "name": "Hollow Body Hold",
    "shape": "timeDist",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "hip-flexors"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:incline-bench-press",
    "name": "Incline Bench Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [
      "incline barbell press",
      "incline bench"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "upper-chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:incline-dumbbell-curl",
    "name": "Incline Dumbbell Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:incline-push-up",
    "name": "Incline Push-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "bodyweight",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:incline-walk",
    "name": "Incline Walk",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "calves"
      ],
      "secondary": [
        "quads",
        "hamstrings"
      ]
    },
    "equipment": [
      "treadmill"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:inverted-row",
    "name": "Inverted Row",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps"
      ]
    },
    "equipment": [
      "bodyweight",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:jog",
    "name": "Jog",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "recovery"
    ],
    "aliases": [
      "jogging"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "road",
      "track",
      "treadmill"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:jump-rope",
    "name": "Jump Rope",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "calves"
      ],
      "secondary": [
        "shoulders",
        "core"
      ]
    },
    "equipment": [
      "jump-rope"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:jump-rope-intervals",
    "name": "Jump Rope Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "calves"
      ],
      "secondary": [
        "shoulders",
        "core"
      ]
    },
    "equipment": [
      "jump-rope"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:jump-technique",
    "name": "Jump Technique",
    "shape": "reps",
    "tags": [
      "power",
      "conditioning",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:kayaking",
    "name": "Kayaking",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "shoulders"
      ],
      "secondary": [
        "core",
        "biceps"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:kettlebell-clean",
    "name": "Kettlebell Clean",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "kettlebell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:kettlebell-snatch",
    "name": "Kettlebell Snatch",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "kettlebell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:kettlebell-swing",
    "name": "Kettlebell Swing",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "hinge",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "hamstrings"
      ],
      "secondary": [
        "lower-back",
        "core"
      ]
    },
    "equipment": [
      "kettlebell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:kickboxing",
    "name": "Kickboxing",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:knees-to-elbows",
    "name": "Knees-to-Elbows",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "grip"
      ]
    },
    "equipment": [
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:l-sit",
    "name": "L-Sit",
    "shape": "timeDist",
    "tags": [
      "strength",
      "bodyweight",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "arms"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:lacrosse",
    "name": "Lacrosse",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:landmine-press",
    "name": "Landmine Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts",
        "chest"
      ],
      "secondary": [
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "landmine"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:lat-pulldown",
    "name": "Lat Pulldown",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [
      "pulldown"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "biceps",
        "mid-back"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:lateral-bound",
    "name": "Lateral Bound",
    "shape": "reps",
    "tags": [
      "power",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:lateral-raise",
    "name": "Lateral Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "side-delts"
      ],
      "secondary": []
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:leg-curl",
    "name": "Leg Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "lower"
    ],
    "aliases": [
      "hamstring curl"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:leg-extension",
    "name": "Leg Extension",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "lower"
    ],
    "aliases": [
      "quad extension"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:leg-press",
    "name": "Leg Press",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:low-bar-back-squat",
    "name": "Low-Bar Back Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads"
      ],
      "secondary": [
        "hamstrings",
        "lower-back",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:machine-chest-press",
    "name": "Machine Chest Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "machine",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:machine-lateral-raise",
    "name": "Machine Lateral Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "side-delts"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:machine-row",
    "name": "Machine Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "machine",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:machine-shoulder-press",
    "name": "Machine Shoulder Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "machine",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "side-delts",
        "triceps"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:martial-arts",
    "name": "Martial Arts",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:meadows-row",
    "name": "Meadows Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "mid-back"
      ],
      "secondary": [
        "biceps",
        "rear-delts"
      ]
    },
    "equipment": [
      "landmine"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:medicine-ball-slam",
    "name": "Medicine Ball Slam",
    "shape": "reps",
    "tags": [
      "power",
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "core"
      ],
      "secondary": [
        "shoulders",
        "triceps"
      ]
    },
    "equipment": [
      "medicine-ball"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:mobility-flow",
    "name": "Mobility Flow",
    "shape": "text",
    "tags": [
      "mobility",
      "recovery"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:mountain-biking",
    "name": "Mountain Biking",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "core",
        "calves"
      ]
    },
    "equipment": [
      "bike",
      "trail"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:movement-practice",
    "name": "Movement Practice",
    "shape": "text",
    "tags": [
      "conditioning",
      "recovery"
    ],
    "aliases": [
      "hardest mile movement practice"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:neutral-grip-lat-pulldown",
    "name": "Neutral-Grip Lat Pulldown",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "biceps",
        "mid-back"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:neutral-grip-pull-up",
    "name": "Neutral-Grip Pull-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "biceps",
        "mid-back"
      ]
    },
    "equipment": [
      "bodyweight",
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:nordic-hamstring-curl",
    "name": "Nordic Hamstring Curl",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings"
      ],
      "secondary": [
        "glutes"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:overhead-carry",
    "name": "Overhead Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "core"
      ],
      "secondary": [
        "triceps",
        "legs"
      ]
    },
    "equipment": [
      "dumbbell",
      "kettlebell"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:overhead-press",
    "name": "Overhead Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [
      "ohp",
      "military press"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "triceps",
        "side-delts",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:overhead-squat",
    "name": "Overhead Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "olympic",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "shoulders"
      ],
      "secondary": [
        "core",
        "glutes"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:overhead-triceps-extension",
    "name": "Overhead Triceps Extension",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:pallof-press",
    "name": "Pallof Press",
    "shape": "reps",
    "tags": [
      "strength",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "obliques"
      ]
    },
    "equipment": [
      "cable",
      "bands"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:pec-deck-fly",
    "name": "Pec Deck Fly",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:pendlay-row",
    "name": "Pendlay Row",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps",
        "rear-delts"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:pendulum-squat",
    "name": "Pendulum Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:physical-therapy",
    "name": "Physical Therapy",
    "shape": "text",
    "tags": [
      "rehab",
      "recovery"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:pike-push-up",
    "name": "Pike Push-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:plank",
    "name": "Plank",
    "shape": "timeDist",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "glutes",
        "shoulders"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:plate-pinch-carry",
    "name": "Plate Pinch Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": [
        "traps",
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:power-clean",
    "name": "Power Clean",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads",
        "traps"
      ],
      "secondary": [
        "hamstrings",
        "shoulders",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:power-snatch",
    "name": "Power Snatch",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "traps",
        "shoulders"
      ],
      "secondary": [
        "quads",
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:preacher-curl",
    "name": "Preacher Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "biceps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:prowler-push",
    "name": "Prowler Push",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "conditioning",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "calves",
        "core"
      ]
    },
    "equipment": [
      "sled"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:pull-up",
    "name": "Pull-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull",
      "upper"
    ],
    "aliases": [
      "pullup",
      "pull up"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "biceps",
        "mid-back"
      ]
    },
    "equipment": [
      "bodyweight",
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:push-jerk",
    "name": "Push Jerk",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "legs"
      ],
      "secondary": [
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:push-press",
    "name": "Push Press",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "push",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "triceps",
        "legs",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:push-up",
    "name": "Push-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push",
      "upper"
    ],
    "aliases": [
      "pushup",
      "push up"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts",
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:rack-pull",
    "name": "Rack Pull",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "pull",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "traps",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "lower-back",
        "forearms"
      ]
    },
    "equipment": [
      "barbell",
      "rack"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:rear-delt-fly",
    "name": "Rear Delt Fly",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "rear-delts"
      ],
      "secondary": [
        "upper-back"
      ]
    },
    "equipment": [
      "dumbbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:rear-foot-elevated-split-squat",
    "name": "Rear-Foot-Elevated Split Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "lunge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:recovery",
    "name": "Recovery",
    "shape": "text",
    "tags": [
      "recovery",
      "mobility"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:reverse-crunch",
    "name": "Reverse Crunch",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "hip-flexors"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:reverse-curl",
    "name": "Reverse Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": [
        "biceps"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:reverse-hyperextension",
    "name": "Reverse Hyperextension",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "lower-back"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:reverse-lunge",
    "name": "Reverse Lunge",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "lunge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "bodyweight",
      "dumbbell"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:reverse-pec-deck",
    "name": "Reverse Pec Deck",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "rear-delts"
      ],
      "secondary": [
        "upper-back"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:reverse-wrist-curl",
    "name": "Reverse Wrist Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": []
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:ring-dip",
    "name": "Ring Dip",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "push"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest",
        "triceps"
      ],
      "secondary": [
        "shoulders",
        "core"
      ]
    },
    "equipment": [
      "suspension"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:ring-muscle-up",
    "name": "Ring Muscle-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back",
        "arms"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "suspension"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:ring-row",
    "name": "Ring Row",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back"
      ],
      "secondary": [
        "biceps",
        "core"
      ]
    },
    "equipment": [
      "suspension"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:road-cycling",
    "name": "Road Cycling",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [
      "cycling",
      "bike ride"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes",
        "calves"
      ]
    },
    "equipment": [
      "bike",
      "road"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:rock-climbing",
    "name": "Rock Climbing",
    "shape": "text",
    "tags": [
      "sport",
      "strength"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back",
        "arms"
      ],
      "secondary": [
        "core",
        "grip"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:romanian-deadlift",
    "name": "Romanian Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [
      "rdl"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings",
        "glutes"
      ],
      "secondary": [
        "lower-back",
        "forearms"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:rope-climb",
    "name": "Rope Climb",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "pull"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back",
        "arms"
      ],
      "secondary": [
        "core",
        "grip"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:rope-triceps-pushdown",
    "name": "Rope Triceps Pushdown",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:row-intervals",
    "name": "Row Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs",
        "lats"
      ],
      "secondary": [
        "core",
        "biceps"
      ]
    },
    "equipment": [
      "rower"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:rowing",
    "name": "Rowing",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [
      "rower"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs",
        "lats"
      ],
      "secondary": [
        "core",
        "biceps"
      ]
    },
    "equipment": [
      "rower"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:ruck",
    "name": "Ruck",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "carry"
    ],
    "aliases": [
      "rucking"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs",
        "traps"
      ],
      "secondary": [
        "core",
        "lower-back"
      ]
    },
    "equipment": [
      "road",
      "trail",
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:run",
    "name": "Run",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [
      "running"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "road",
      "track",
      "treadmill"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:russian-twist",
    "name": "Russian Twist",
    "shape": "reps",
    "tags": [
      "strength",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "obliques"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "medicine-ball",
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sandbag-bear-hug-carry",
    "name": "Sandbag Bear-Hug Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "upper-back"
      ],
      "secondary": [
        "biceps",
        "legs"
      ]
    },
    "equipment": [
      "sandbag"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sandbag-shoulder-carry",
    "name": "Sandbag Shoulder Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "traps"
      ],
      "secondary": [
        "legs",
        "forearms"
      ]
    },
    "equipment": [
      "sandbag"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:seal-row",
    "name": "Seal Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps",
        "rear-delts"
      ]
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:seated-cable-row",
    "name": "Seated Cable Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:seated-calf-raise",
    "name": "Seated Calf Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "soleus"
      ],
      "secondary": [
        "calves"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:seated-leg-curl",
    "name": "Seated Leg Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:shrug",
    "name": "Shrug",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "traps"
      ],
      "secondary": [
        "forearms"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:shuttle-runs",
    "name": "Shuttle Runs",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "power"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "track"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:side-plank",
    "name": "Side Plank",
    "shape": "timeDist",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "obliques"
      ],
      "secondary": [
        "core",
        "glute-med"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:single-arm-cable-press",
    "name": "Single-Arm Cable Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts",
        "core"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:single-arm-cable-row",
    "name": "Single-Arm Cable Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats",
        "mid-back"
      ],
      "secondary": [
        "biceps"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:single-arm-lat-pulldown",
    "name": "Single-Arm Lat Pulldown",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "biceps"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:single-leg-calf-raise",
    "name": "Single-Leg Calf Raise",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "calves"
      ],
      "secondary": []
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:single-leg-glute-bridge",
    "name": "Single-Leg Glute Bridge",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:single-leg-romanian-deadlift",
    "name": "Single-Leg Romanian Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings",
        "glutes"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sissy-squat",
    "name": "Sissy Squat",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:sit-up",
    "name": "Sit-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "hip-flexors"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:ski-erg",
    "name": "SkiErg",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [
      "ski erg"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "back",
        "arms"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:skullcrusher",
    "name": "Skullcrusher",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "barbell",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sled-drag",
    "name": "Sled Drag",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "conditioning",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "calves"
      ]
    },
    "equipment": [
      "sled"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sled-push",
    "name": "Sled Push",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "conditioning",
      "lower"
    ],
    "aliases": [
      "sled push/pull"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "calves",
        "core"
      ]
    },
    "equipment": [
      "sled"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:smith-machine-bench-press",
    "name": "Smith Machine Bench Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "machine",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "chest"
      ],
      "secondary": [
        "triceps",
        "front-delts"
      ]
    },
    "equipment": [
      "machine",
      "bench"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:smith-machine-squat",
    "name": "Smith Machine Squat",
    "shape": "lift",
    "tags": [
      "strength",
      "squat",
      "machine",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings"
      ]
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:snatch-grip-high-pull",
    "name": "Snatch-Grip High Pull",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic",
      "pull"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "traps"
      ],
      "secondary": [
        "glutes",
        "hamstrings",
        "shoulders"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:soccer",
    "name": "Soccer",
    "shape": "text",
    "tags": [
      "sport",
      "cardio",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:spanish-squat-tke",
    "name": "Spanish Squat / TKE",
    "shape": "lift",
    "tags": [
      "strength",
      "rehab",
      "squat",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": []
    },
    "equipment": [
      "bands"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:split-jerk",
    "name": "Split Jerk",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "legs"
      ],
      "secondary": [
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sport-practice",
    "name": "Sport Practice",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sprint-intervals",
    "name": "Sprint Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "power"
    ],
    "aliases": [
      "sprints"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "track",
      "treadmill"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sprinting",
    "name": "Sprinting",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "power"
    ],
    "aliases": [
      "sprint"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "road",
      "track",
      "treadmill"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:squat-clean",
    "name": "Squat Clean",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:squat-snatch",
    "name": "Squat Snatch",
    "shape": "lift",
    "tags": [
      "strength",
      "power",
      "olympic"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:stair-climber",
    "name": "Stair Climber",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "lower"
    ],
    "aliases": [
      "stairmaster"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads"
      ],
      "secondary": [
        "calves"
      ]
    },
    "equipment": [
      "stair-machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:standing-calf-raise",
    "name": "Standing Calf Raise",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "calves"
      ],
      "secondary": []
    },
    "equipment": [
      "machine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:stationary-cycling",
    "name": "Stationary Cycling",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [
      "exercise bike",
      "spin bike"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads"
      ],
      "secondary": [
        "glutes",
        "calves"
      ]
    },
    "equipment": [
      "bike"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:step-up",
    "name": "Step-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "lunge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "bodyweight",
      "dumbbell",
      "step"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:stiff-leg-deadlift",
    "name": "Stiff-Leg Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "hamstrings"
      ],
      "secondary": [
        "glutes",
        "lower-back"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:straight-arm-pulldown",
    "name": "Straight-Arm Pulldown",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "lats"
      ],
      "secondary": [
        "triceps"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:suitcase-carry",
    "name": "Suitcase Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [
      "suitcase walk"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "obliques",
        "forearms"
      ],
      "secondary": [
        "traps",
        "legs"
      ]
    },
    "equipment": [
      "dumbbell",
      "kettlebell"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:sumo-deadlift",
    "name": "Sumo Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "pull",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "adductors"
      ],
      "secondary": [
        "quads",
        "hamstrings",
        "lower-back"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:swim-intervals",
    "name": "Swim Intervals",
    "shape": "rounds",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "lats"
      ],
      "secondary": [
        "core",
        "legs"
      ]
    },
    "equipment": [
      "pool"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:swimming",
    "name": "Swimming",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "full-body"
    ],
    "aliases": [
      "lap swimming"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "lats"
      ],
      "secondary": [
        "core",
        "legs"
      ]
    },
    "equipment": [
      "pool"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:t-bar-row",
    "name": "T-Bar Row",
    "shape": "lift",
    "tags": [
      "strength",
      "pull",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "mid-back"
      ],
      "secondary": [
        "lats",
        "biceps"
      ]
    },
    "equipment": [
      "landmine"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:tennis-pickleball",
    "name": "Tennis / Pickleball",
    "shape": "text",
    "tags": [
      "sport",
      "cardio",
      "conditioning"
    ],
    "aliases": [
      "tennis/pickleball"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs",
        "shoulders"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:thruster",
    "name": "Thruster",
    "shape": "lift",
    "tags": [
      "strength",
      "conditioning",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "shoulders"
      ],
      "secondary": [
        "glutes",
        "triceps"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:tibialis-raise",
    "name": "Tibialis Raise",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "tibialis"
      ],
      "secondary": []
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:toes-to-bar",
    "name": "Toes-to-Bar",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "grip"
      ]
    },
    "equipment": [
      "pull-up-bar"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:trail-run",
    "name": "Trail Run",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core",
        "calves"
      ]
    },
    "equipment": [
      "trail"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:trap-bar-deadlift",
    "name": "Trap Bar Deadlift",
    "shape": "lift",
    "tags": [
      "strength",
      "hinge",
      "full-body"
    ],
    "aliases": [
      "hex bar deadlift"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "glutes",
        "quads"
      ],
      "secondary": [
        "hamstrings",
        "traps",
        "forearms"
      ]
    },
    "equipment": [
      "trap-bar"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:triceps-kickback",
    "name": "Triceps Kickback",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "dumbbell"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:triceps-pushdown",
    "name": "Triceps Pushdown",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "push",
      "upper"
    ],
    "aliases": [
      "cable pushdown"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "triceps"
      ],
      "secondary": []
    },
    "equipment": [
      "cable"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:tuck-jump",
    "name": "Tuck Jump",
    "shape": "reps",
    "tags": [
      "power",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:turkish-get-up",
    "name": "Turkish Get-Up",
    "shape": "lift",
    "tags": [
      "strength",
      "mobility",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "kettlebell",
      "dumbbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:v-up",
    "name": "V-Up",
    "shape": "reps",
    "tags": [
      "strength",
      "core",
      "bodyweight"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core"
      ],
      "secondary": [
        "hip-flexors"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:vertical-jump",
    "name": "Vertical Jump",
    "shape": "reps",
    "tags": [
      "power",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:volleyball",
    "name": "Volleyball",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:waiter-carry",
    "name": "Waiter Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "core"
      ],
      "secondary": [
        "triceps",
        "forearms"
      ]
    },
    "equipment": [
      "dumbbell",
      "kettlebell"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:walk",
    "name": "Walk",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "recovery"
    ],
    "aliases": [
      "walking"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "legs"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "road",
      "treadmill"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:walking-lunge",
    "name": "Walking Lunge",
    "shape": "reps",
    "tags": [
      "strength",
      "bodyweight",
      "lunge",
      "lower"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "glutes"
      ],
      "secondary": [
        "hamstrings",
        "core"
      ]
    },
    "equipment": [
      "bodyweight",
      "dumbbell"
    ],
    "unilateral": true,
    "bodyweight": true,
    "deprecated": false
  },
  {
    "id": "bp:wall-ball-shot",
    "name": "Wall Ball Shot",
    "shape": "reps",
    "tags": [
      "conditioning",
      "full-body"
    ],
    "aliases": [
      "wall balls"
    ],
    "formerNames": [],
    "muscles": {
      "primary": [
        "quads",
        "shoulders"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "medicine-ball"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:wheelchair-cardio",
    "name": "Wheelchair Cardio",
    "shape": "timeDist",
    "tags": [
      "cardio",
      "conditioning",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "shoulders",
        "triceps"
      ],
      "secondary": [
        "chest",
        "core"
      ]
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:wood-chop",
    "name": "Wood Chop",
    "shape": "lift",
    "tags": [
      "strength",
      "core"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "obliques"
      ],
      "secondary": [
        "core",
        "shoulders"
      ]
    },
    "equipment": [
      "cable"
    ],
    "unilateral": true,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:wrestling",
    "name": "Wrestling",
    "shape": "text",
    "tags": [
      "sport",
      "conditioning"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": []
    },
    "equipment": [
      "other"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:wrist-curl",
    "name": "Wrist Curl",
    "shape": "lift",
    "tags": [
      "strength",
      "isolation",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "forearms"
      ],
      "secondary": []
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:yoga",
    "name": "Yoga",
    "shape": "text",
    "tags": [
      "mobility",
      "recovery"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "full-body"
      ],
      "secondary": [
        "core"
      ]
    },
    "equipment": [
      "bodyweight"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:yoke-walk",
    "name": "Yoke Walk",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "legs"
      ],
      "secondary": [
        "traps",
        "glutes"
      ]
    },
    "equipment": [
      "yoke"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:z-press",
    "name": "Z Press",
    "shape": "lift",
    "tags": [
      "strength",
      "push",
      "upper"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "front-delts"
      ],
      "secondary": [
        "triceps",
        "core"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  },
  {
    "id": "bp:zercher-carry",
    "name": "Zercher Carry",
    "shape": "carry",
    "tags": [
      "strength",
      "carry",
      "strongman",
      "full-body"
    ],
    "aliases": [],
    "formerNames": [],
    "muscles": {
      "primary": [
        "core",
        "upper-back"
      ],
      "secondary": [
        "biceps",
        "legs"
      ]
    },
    "equipment": [
      "barbell"
    ],
    "unilateral": false,
    "bodyweight": false,
    "deprecated": false
  }
];
