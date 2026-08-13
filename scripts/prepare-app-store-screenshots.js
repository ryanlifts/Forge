#!/usr/bin/env node
"use strict";

/*
 * Seeds an iOS Simulator installation with fictional App Store screenshot data.
 * This never targets a physical device and never changes BlackPyre shipping code.
 */

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const udid = process.argv[2];
if (!/^[A-F0-9-]{36}$/.test(String(udid || ""))) {
  throw new Error("Pass an iOS Simulator UDID.");
}

function run(command, args) {
  return childProcess.execFileSync(command, args, { encoding: "utf8" }).trim();
}

const container = run("xcrun", [
  "simctl", "get_app_container", udid, "com.blackpyre.app", "data"
]);

if (!container.includes("/CoreSimulator/Devices/") || !fs.existsSync(container)) {
  throw new Error("Refusing to seed anything except an installed Simulator app.");
}

run("xcrun", ["simctl", "terminate", udid, "com.blackpyre.app"]);

function findFile(dir, filename) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const candidate = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFile(candidate, filename);
      if (nested) return nested;
    } else if (entry.name === filename) {
      return candidate;
    }
  }
  return null;
}

const database = findFile(path.join(container, "Library", "WebKit"), "localstorage.sqlite3");
if (!database) throw new Error("BlackPyre Simulator local storage was not found.");

function localDay(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

const today = localDay(0);
const day1 = localDay(-1);
const day2 = localDay(-2);
const day3 = localDay(-3);
const day5 = localDay(-5);
const day7 = localDay(-7);
const day14 = localDay(-14);
const now = new Date().toISOString();

const cfg = {
  schemaVersion: 3,
  setupDone: true,
  disclaimerAccepted: today,
  startWt: 210,
  goalWt: 180,
  lastTargetWt: 199.6,
  calTarget: 2200,
  proTarget: 170,
  carbGoal: 240,
  fatGoal: 70,
  calSchedMode: "same",
  calSchedDays: null,
  unitSystem: "imperial",
  accent: "gold",
  calcInputs: { sex: "m", age: 34, ft: 5, inches: 10, act: 1.55, goal: -500 },
  splitState: { mode: "rec", p: 31, c: 44, f: 25 },
  measureOn: true,
  waterOn: true,
  healthOn: true,
  healthWorkoutWriteOn: true,
  foodHandoffOn: true,
  autoProgressionOn: true,
  foodSuggestionsOn: false,
  foodSuggestionsWeightLoss: true,
  foodSuggestionsAvoid: "",
  restSec: 90,
  customRests: []
};

const foodToday = [
  { name: "Greek yogurt", cal: 220, pro: 25, carb: 24, fat: 3, meal: "breakfast" },
  { name: "Oatmeal & berries", cal: 310, pro: 10, carb: 52, fat: 7, meal: "breakfast" },
  { name: "Chicken rice bowl", cal: 560, pro: 52, carb: 58, fat: 14, meal: "lunch" },
  { name: "Protein shake", cal: 180, pro: 30, carb: 8, fat: 3, meal: "snack" },
  { name: "Salmon & vegetables", cal: 510, pro: 45, carb: 28, fat: 22, meal: "dinner" }
];

const priorFood = [
  { name: "Eggs and toast", cal: 410, pro: 28, carb: 35, fat: 18, meal: "breakfast" },
  { name: "Turkey wrap", cal: 520, pro: 42, carb: 48, fat: 17, meal: "lunch" },
  { name: "Fruit and yogurt", cal: 260, pro: 20, carb: 38, fat: 4, meal: "snack" },
  { name: "Beef stir-fry", cal: 650, pro: 50, carb: 62, fat: 20, meal: "dinner" }
];

const data = {
  food: {
    [today]: foodToday,
    [day1]: priorFood,
    [day2]: priorFood.map(item => Object.assign({}, item, { cal: item.cal - 15 })),
    [day3]: priorFood.map(item => Object.assign({}, item, { cal: item.cal + 20 }))
  },
  workouts: [
    {
      id: "screenshot-workout-1",
      date: day5,
      day: "D1",
      title: "Full Body A",
      sets: {
        "Back Squat": [{ w: 175, r: 5 }, { w: 175, r: 5 }, { w: 175, r: 5 }],
        "Bench Press": [{ w: 135, r: 5 }, { w: 135, r: 5 }, { w: 135, r: 5 }],
        "Seated Cable Row": [{ w: 110, r: 10 }, { w: 110, r: 10 }, { w: 110, r: 10 }],
        "Plank": { t: "timedHold", holds: 3, holdSecs: 45, recSecs: 30 }
      },
      notes: "Strong, controlled session."
    },
    {
      id: "screenshot-workout-2",
      date: day2,
      day: "D2",
      title: "Full Body B",
      sets: {
        "Romanian Deadlift": [{ w: 155, r: 8 }, { w: 155, r: 8 }, { w: 155, r: 8 }],
        "Overhead Press": [{ w: 80, r: 8 }, { w: 80, r: 8 }, { w: 80, r: 8 }],
        "Lat Pulldown": [{ w: 105, r: 10 }, { w: 105, r: 10 }, { w: 105, r: 10 }]
      },
      notes: ""
    }
  ],
  weights: [
    { date: day14, time: "07:10", lbs: 205.2 },
    { date: day7, time: "07:15", lbs: 202.4 },
    { date: day3, time: "07:05", lbs: 200.8 },
    { date: today, time: "07:12", lbs: 199.6 }
  ],
  measure: [
    { date: day14, waist: 37.5, chest: 43, arm: 15.2 },
    { date: today, waist: 36.8, chest: 43.2, arm: 15.4 }
  ],
  water: { [day3]: 7, [day2]: 8, [day1]: 7, [today]: 6 },
  recents: foodToday.slice().reverse(),
  myFoods: {
    "fictional-protein-bar": {
      name: "Forge Protein Bar",
      brand: "Fictional Foods",
      cal100: 360,
      pro100: 30,
      carb100: 36,
      fat100: 12,
      servingG: 50,
      servingLabel: "1 bar (50 g)"
    }
  },
  meals: [],
  finished: { [day5]: true, [day2]: true },
  foodCounts: {},
  mealCounts: {},
  activeWorkoutDraft: null,
  myExercises: {},
  meta: { lastBackup: now, logsSince: 0 }
};

const program = {
  name: "Forge Foundations",
  author: "BlackPyre sample program",
  days: [
    { id: "D1", title: "Full Body A", exercises: [
      { name: "Back Squat", scheme: "3×5" },
      { name: "Bench Press", scheme: "3×5" },
      { name: "Seated Cable Row", scheme: "3×10" },
      { name: "Plank", scheme: "3×45s" }
    ] },
    { id: "D2", title: "Full Body B", exercises: [
      { name: "Romanian Deadlift", scheme: "3×8" },
      { name: "Overhead Press", scheme: "3×8" },
      { name: "Lat Pulldown", scheme: "3×10" },
      { name: "Biceps Curl", scheme: "3×12" }
    ] },
    { id: "D3", title: "Conditioning", exercises: [
      { name: "Walking", scheme: "20 min" },
      { name: "Farmer's Carry", scheme: "4×40 yd" }
    ] }
  ]
};

function utf16Hex(value) {
  return Buffer.from(String(value), "utf16le").toString("hex");
}

function sqlUpsert(key, value) {
  const safeKey = key.replaceAll("'", "''");
  return `INSERT OR REPLACE INTO ItemTable(key,value) VALUES('${safeKey}',X'${utf16Hex(value)}');`;
}

const sql = [
  "BEGIN IMMEDIATE;",
  sqlUpsert("forge:cfg", JSON.stringify(cfg)),
  sqlUpsert("forge:data", JSON.stringify(data)),
  sqlUpsert("forge:program", JSON.stringify(program)),
  sqlUpsert("blackpyre:phase4-screenshot-mode", "1"),
  "COMMIT;"
].join("\n");

run("sqlite3", [database, sql]);

const healthCache = {
  healthFormatVersion: 1,
  cacheKey: "blackpyre:health-cache",
  updatedAt: now,
  permissions: {
    bodyWeight: "available",
    activeEnergy: "available",
    steps: "available",
    sleep: "available",
    restingHeartRate: "available",
    heartRateVariability: "available",
    workoutHeartRate: "available",
    workoutWrite: "written"
  },
  daily: {
    [today]: {
      bodyWeightKg: {
        value: 90.54,
        observedAt: `${today}T12:12:00.000Z`,
        sourceName: "Fictional Health Source"
      },
      activeEnergyKcal: 612,
      steps: 8431,
      sleepMinutes: 438,
      restingHeartRateBpm: 57,
      heartRateVariabilityMs: 44
    }
  },
  workoutHeartRate: {
    "fictional-health-workout": {
      startAt: `${day2}T22:00:00.000Z`,
      endAt: `${day2}T22:42:00.000Z`,
      durationSeconds: 2520,
      averageBpm: 142,
      maximumBpm: 166,
      sourceName: "Fictional Health Source"
    }
  },
  writeBack: {
    "screenshot-workout-2": {
      status: "written",
      attemptedAt: now,
      healthWorkoutId: "fictional-health-workout"
    }
  }
};

fs.writeFileSync(
  path.join(container, "Library", "blackpyre-health-cache.json"),
  JSON.stringify(healthCache),
  { encoding: "utf8", mode: 0o600 }
);

console.log(`Seeded fictional App Store screenshot data for ${today}.`);
