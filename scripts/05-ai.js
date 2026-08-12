"use strict";
// ================== V23: WATER / QUOTES / ACCENTS / SWAPS ==================
// ---------- water tracking (optional) ----------
function renderWater(){
  const card = document.getElementById("waterCard");
  card.classList.toggle("hidden", !cfg.waterOn);
  if (!cfg.waterOn) return;

  if (!data.water) data.water = {};

  const todayCount =
    Number(data.water[todayStr()] || 0);

  document.getElementById(
    "waterCount"
  ).textContent = todayCount;

  const unitToday =
    document.getElementById(
      "waterUnitToday"
    );

  if (unitToday){
    unitToday.textContent =
      (todayCount===1 ? "GLASS" : "GLASSES")
      +" TODAY";
  }

  const history =
    document.getElementById(
      "waterHistory"
    );

  const dates =
    Object.keys(data.water)
      .filter(date=>{
        const value=Number(data.water[date]);

        return /^\d{4}-\d{2}-\d{2}$/.test(date)
          && Number.isFinite(value)
          && value>=0;
      })
      .sort((a,b)=>b.localeCompare(a))
      .slice(0,7);

  history.innerHTML =
    dates.length
      ? '<details><summary class="label" style="cursor:pointer; margin-bottom:0;">Recent water history</summary><div style="margin-top:8px;">'
        +dates.map(date=>{
          const value=Number(data.water[date]);

          return '<div class="list-item" style="justify-content:space-between; gap:20px;">'
            +'<span style="flex:1; color:var(--dim);">'+fmtDate(date)+'</span>'
            +'<span style="flex:0 0 auto; color:var(--dim); white-space:nowrap;">'
            +value+' '+(value===1 ? 'GLASS' : 'GLASSES')
            +'</span></div>';
        }).join("")
        +'</div></details>'
      : '<div class="note">Your dated water history will appear here.</div>';
}
document.getElementById("waterToggleBtn").addEventListener("click", ()=>{
  cfg.waterOn = !cfg.waterOn;
  saveCfg();
  document.getElementById("waterToggleBtn").textContent = cfg.waterOn ? "Disable water tracking" : "Enable water tracking";
  ackBtn("waterToggleBtn", cfg.waterOn ? "✓ Enabled" : "✓ Disabled");
  renderWater();
});
document.getElementById("waterPlus").addEventListener("click", ()=>{
  if (!data.water) data.water = {};
  data.water[todayStr()] = (data.water[todayStr()]||0) + 1;
  save(); renderWater();
});
document.getElementById("waterMinus").addEventListener("click", ()=>{
  if (!data.water) data.water = {};
  data.water[todayStr()] = Math.max(0, (data.water[todayStr()]||0) - 1);
  save(); renderWater();
});

// ---------- motivation page ----------
// ---------- accent colors ----------
const ACCENTS = {
  ember:   {name:"Ember",   c:"#FF7A3D", deep:"#E8571F", rgb:"255,122,61"},
  steel:   {name:"Steel",   c:"#4D9DE0", deep:"#2E6FB0", rgb:"77,157,224"},
  emerald: {name:"Emerald", c:"#34D399", deep:"#0E9F6E", rgb:"52,211,153"},
  crimson: {name:"Crimson", c:"#F43F5E", deep:"#BE123C", rgb:"244,63,94"},
  violet:  {name:"Violet",  c:"#A78BFA", deep:"#7C3AED", rgb:"167,139,250"},
  gold:    {name:"Gold",    c:"#FBBF24", deep:"#D97706", rgb:"251,191,36"},
  pink:    {name:"Pink",    c:"#F472B6", deep:"#DB2777", rgb:"244,114,182"},
};
function applyAccent(){
  const a = ACCENTS[cfg.accent] || ACCENTS.gold;
  const r = document.documentElement.style;
  r.setProperty("--ember", a.c);
  r.setProperty("--ember-deep", a.deep);
  r.setProperty("--ember-rgb", a.rgb);
}
function renderAccentRow(){
  const row = document.getElementById("accentRow");
  row.innerHTML = "";
  Object.keys(ACCENTS).forEach(key=>{
    const a = ACCENTS[key];
    const b = document.createElement("button");
    b.setAttribute("aria-label", a.name);
    b.title = a.name;
    b.style.cssText = "width:36px; height:36px; border-radius:50%; cursor:pointer; background:linear-gradient(135deg,"+a.c+","+a.deep+");"
      + "border:3px solid " + ((ACCENTS[cfg.accent] ? cfg.accent : "gold")===key ? "var(--text)" : "transparent") + ";";
    b.addEventListener("click", ()=>{
      cfg.accent = key;
      saveCfg();
      applyAccent();
      renderAccentRow();
      flashSave(a.name + " ✓");
    });
    row.appendChild(b);
  });
}

// ---------- session exercise swaps + form videos ----------
let sessionSwaps = {}; // original program name -> substituted name
function sessionList(){
  return currentDayExercises().concat(extraExercises).map(ex=>
    sessionSwaps[ex.name] ? {name:sessionSwaps[ex.name], scheme:ex.scheme, __orig:ex.name} : ex);
}
function openFormVideo(name){
  window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(name.replace("[Cardio] ","")+" proper form how to"), "_blank");
}
function applySessionExerciseReplacement(
  origName,
  currentShown,
  target
){
  const cleanTarget =
    String(target||"").trim();

  if (!cleanTarget){
    return {
      ok:false,
      reason:"Choose a replacement exercise."
    };
  }

  const targetEntry =
    exerciseModelEntryForName(cleanTarget);

  if (!targetEntry){
    return {
      ok:false,
      reason:"That replacement exercise is unavailable."
    };
  }

  const duplicate =
    sessionList().some(ex=>{
      const sourceName =
        ex.__orig || ex.name;

      return (
        sourceName!==origName
        && normalizeExerciseName(ex.name)
          ===normalizeExerciseName(
            targetEntry.name
          )
      );
    });

  if (duplicate){
    return {
      ok:false,
      reason:
        targetEntry.name
        +" is already in this session."
    };
  }

  const shownOld =
    sessionSwaps[origName] || origName;

  if (shownOld===targetEntry.name){
    return {
      ok:true,
      unchanged:true
    };
  }

  const oldState = sessionState[shownOld];

  if (
    oldState
    && hasUnsavedEntry(oldState)
    && !confirm(
      "Replace "
        +shownOld.replace("[Cardio] ","")
        +" and discard its unsaved entries?"
    )
  ){
    return {
      ok:false,
      cancelled:true
    };
  }

  delete sessionState[shownOld];

  if (targetEntry.name===origName){
    delete sessionSwaps[origName];
  } else {
    sessionSwaps[origName] =
      targetEntry.name;
  }

  initSessionStateFor(targetEntry.name);
  clearWorkoutError();
  renderSessionInputs();

  return {
    ok:true,
    name:targetEntry.name,
    shape:targetEntry.shape
  };
}

function offerSwap(origName,currentShown,container){
  const menu = document.createElement("div");

  menu.style.cssText =
    "margin:6px 0 10px;"
    +" display:flex;"
    +" flex-direction:column;"
    +" gap:6px;";

  const search = document.createElement("input");

  search.type = "search";
  search.placeholder = "Search replacement exercises";
  search.autocomplete = "off";
  search.dataset.replacementSearch = origName;

  search.setAttribute(
    "aria-label",
    "Search replacement exercises for "
      +currentShown.replace("[Cardio] ","")
  );

  const select = document.createElement("select");

  select.dataset.replacementSelect = origName;

  select.setAttribute(
    "aria-label",
    "Replacement exercise for "
      +currentShown.replace("[Cardio] ","")
  );

  const renderOptions = ()=>{
    populateUnifiedExercisePicker(
      select,
      {
        query:search.value,
        includeCustom:false
      }
    );

    if (
      !search.value.trim()
      && [...select.options]
        .some(
          option=>
            option.value===currentShown
        )
    ){
      select.value = currentShown;
    }
  };

  search.addEventListener(
    "input",
    renderOptions
  );

  renderOptions();

  const error = document.createElement("div");

  error.style.cssText =
    "font-size:12px;"
    +" line-height:1.45;"
    +" color:var(--warn);";

  const apply = document.createElement("button");

  apply.type = "button";
  apply.className = "xbtn";
  apply.textContent = "Use replacement";
  apply.dataset.replacementApply = origName;

  apply.addEventListener("click",()=>{
    const result =
      applySessionExerciseReplacement(
        origName,
        currentShown,
        select.value
      );

    if (!result.ok){
      if (!result.cancelled){
        error.textContent =
          result.reason
          || "The exercise could not be replaced.";

        showWorkoutError(
          error.textContent,
          null
        );
      }

      return;
    }
  });

  const cancel = document.createElement("button");

  cancel.type = "button";
  cancel.className = "xbtn";
  cancel.textContent = "Cancel";

  cancel.addEventListener(
    "click",
    ()=>menu.remove()
  );

  menu.appendChild(search);
  menu.appendChild(select);
  menu.appendChild(error);
  menu.appendChild(apply);
  menu.appendChild(cancel);

  container.appendChild(menu);
}
function initSessionStateFor(exName){
  const v = wDaySel.value;
  const last = (v!=="__FREE__" && v!=="__CARDIO__") ? lastSessionFor(v) : null;
  // prefill the swapped-in exercise from ITS OWN history anywhere, not just this day
  let lastVal = last && last.sets ? last.sets[exName.replace("[Cardio] ","")] : null;
  if (!lastVal){
    const hist = data.workouts.slice().reverse().find(w=>w.sets && w.sets[exName.replace("[Cardio] ","")]);
    if (hist) lastVal = hist.sets[exName.replace("[Cardio] ","")];
  }
  sessionState[exName] =
    makePlanSessionState(
      {
        name:exName,
        scheme:""
      },
      lastVal
    );
}

// ---------- recents search ----------
let recentsFilter = "";
document.getElementById("recentsSearch").addEventListener("input", ()=>{
  recentsFilter = document.getElementById("recentsSearch").value.trim().toLowerCase();
  renderRecents();
});

// ---------- warm journey messaging ----------
function renderJourneyMsg(){
  const el = document.getElementById("journeyMsg");
  el.classList.add("hidden");
  if (!cfg.goalWt || !cfg.startWt || cfg.goalWt===cfg.startWt) return;
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  if (!sorted.length) return;
  const cur = sorted[sorted.length-1].lbs;
  const cutting = cfg.goalWt < cfg.startWt;
  const spanDays = (new Date(sorted[sorted.length-1].date) - new Date(sorted[0].date))/86400000;
  const wrongDir = cutting ? cur > cfg.startWt : cur < cfg.startWt;
  const downOverall = cutting ? Math.round((cfg.startWt-cur)*10)/10 : Math.round((cur-cfg.startWt)*10)/10;
  // recent drift: last 7 days moving against the goal while still ahead overall
  const weekAgoIdx = sorted.findIndex(w=>(new Date(sorted[sorted.length-1].date)-new Date(w.date))/86400000 <= 7);
  const weekDelta = weekAgoIdx>=0 ? cur - sorted[weekAgoIdx].lbs : 0;
  const drifting = cutting ? weekDelta > 1 : weekDelta < -1;

  if (wrongDir && spanDays < 14){
    el.textContent = "You showed up and weighed in — that's the habit that wins. Early numbers bounce around; yours will settle. Keep stacking days.";
    el.classList.remove("hidden");
  } else if (wrongDir){
    el.textContent = "New starting line, same destination. Today's number is just where this stretch begins — every meal logged and every rep from here counts. You've got this.";
    el.classList.remove("hidden");
  } else if (drifting && downOverall > 1){
    el.textContent = "One rough stretch doesn't erase your work — you're still "+poundsToUnit(downOverall,currentUnitSystem(),1)+" "+unitWeightLabel()+" "+(cutting?"down":"up")+" overall. Champions have bad weeks; they don't have bad months. Tighten up and go.";
    el.classList.remove("hidden");
  }
}

// ================== USUAL MEAL PATTERN DETECTION ==================
const USUAL_FOOD_DESCRIPTORS = new Set([
  "plain","original","classic","traditional","natural","organic",
  "unsweetened","sweetened","light","lite","low","reduced",
  "nonfat","non","fat","free","zero","percent",
  "small","medium","large","xl",
  "vanilla","chocolate","strawberry","flavored","flavour","flavor",
  "grilled","baked","roasted"
]);
function legacyLoggedFoodBaseName(name){
  let value = String(name||"").trim();
  value = value.replace(/^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s+servings?\s*[·•-]\s*/i,"");
  value = value.replace(/^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*(?:g|oz|lb|ml|floz)\b\s*/i,"");
  value = value.replace(/^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s+(?:(?:extra\s+large|small|medium|large|xl)\s+)?(?:pieces?|slices?|cups?|tbsp|tablespoons?|tsp|teaspoons?|scoops?|packets?|cans?|bottles?|bars?|bowls?|plates?)\b\s*(?:[·•-]\s*)?/i,"");
  value = value.replace(/^(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s+(?=[a-z])/i,"");
  return value.trim();
}
function recurringFoodTokens(entry){
  if (!entry) return [];
  const sourceName = entry.sourceFood && entry.sourceFood.name
    ? entry.sourceFood.name
    : entry.name;
  const normalized = normalizedFoodIdentityPart(legacyLoggedFoodBaseName(sourceName));
  if (!normalized) return [];
  const tokens = normalized.split(" ").filter(token=>token && !USUAL_FOOD_DESCRIPTORS.has(token));
  return tokens.length ? tokens : normalized.split(" ").filter(Boolean);
}
function recurringFoodCategoryMatch(a,b){
  const aTokens = recurringFoodTokens(a);
  const bTokens = recurringFoodTokens(b);
  if (!aTokens.length || !bTokens.length) return false;

  const aKey = aTokens.join(" ");
  const bKey = bTokens.join(" ");
  if (aKey === bKey) return true;

  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  const shorter = aSet.size <= bSet.size ? aSet : bSet;
  const longer = shorter === aSet ? bSet : aSet;

  // Require at least two meaningful shared words. This permits product or
  // brand prefixes around a clear food type without merging vague one-word foods.
  return shorter.size >= 2 && Array.from(shorter).every(token=>longer.has(token));
}
function loggedFoodIdentity(entry){
  const tokens = recurringFoodTokens(entry);
  if (tokens.length) return "usual:"+tokens.join(" ");
  return entry && entry.foodKey ? String(entry.foodKey) : "";
}
function usualFor(meal){
  // Look back 14 days, excluding today. Similar product names may share one
  // recurring category, but the offered item is always the exact latest log.
  const groups = [];
  let mealDayCount = 0;

  for(let i=1;i<=14;i++){
    const d = new Date(); d.setDate(d.getDate()-i);
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const entries = (data.food[ds]||[]).filter(f=>(f.meal||"other")===meal);
    if (!entries.length) continue;

    mealDayCount++;
    const seenToday = new Set();

    entries.forEach(entry=>{
      let group = groups.find(g=>g.variants.some(v=>recurringFoodCategoryMatch(entry,v)));
      if (!group){
        group = {count:0, variants:[]};
        groups.push(group);
      }
      if (!group.variants.some(v=>loggedFoodIdentity(v)===loggedFoodIdentity(entry))){
        group.variants.push(entry);
      }
      seenToday.add(group);
    });

    seenToday.forEach(group=>{ group.count++; });
  }

  if (mealDayCount < 4) return null;

  const threshold = Math.max(3, Math.ceil(mealDayCount*0.5));
  const qualifying = groups.filter(group=>group.count>=threshold)
    .sort((a,b)=>b.count-a.count)
    .slice(0,6);

  if (!qualifying.length) return null;

  const items = [];
  qualifying.forEach(group=>{
    for(let i=0;i<=14;i++){
      const d = new Date(); d.setDate(d.getDate()-i);
      const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      const hit = (data.food[ds]||[]).slice().reverse().find(f=>
        (f.meal||"other")===meal
        && group.variants.some(v=>recurringFoodCategoryMatch(f,v))
      );
      if (hit){
        items.push(Object.assign({},hit,{meal:meal}));
        break;
      }
    }
  });

  return items.length ? items : null;
}
function usualFoodLoggedToday(item,meal){
  return (data.food[todayStr()]||[]).some(entry=>
    (entry.meal||"other")===meal
    && recurringFoodCategoryMatch(item,entry)
  );
}
function cloneUsualFoodForLog(item,meal){
  const copy = Object.assign({},item,{meal:meal});
  if (item && item.sourceFood) copy.sourceFood = Object.assign({},item.sourceFood);
  return copy;
}
function addUsualFood(item,meal){
  if (foodDateEl.value!==todayStr() || currentMeal!==meal) return false;
  if (usualFoodLoggedToday(item,meal)){
    renderUsual();
    flashSave("Already added — not logging it twice",true);
    return false;
  }

  const day = todayStr();
  const before = (data.food[day]||[]).length;
  addEntry(cloneUsualFoodForLog(item,meal));
  return (data.food[day]||[]).length===before+1;
}
function renderUsual(){
  const card = document.getElementById("usualCard");
  if (foodDateEl.value !== todayStr()){ card.classList.add("hidden"); return; }

  const meal = currentMeal;
  const items = usualFor(meal);
  if (!items){ card.classList.add("hidden"); return; }

  const states = items.map(item=>({
    item:item,
    added:usualFoodLoggedToday(item,meal)
  }));
  const remaining = states.filter(state=>!state.added);

  card.classList.remove("hidden");
  document.getElementById("usualMealName").textContent = meal;

  const itemsEl = document.getElementById("usualItems");
  itemsEl.innerHTML = "";

  states.forEach((state,index)=>{
    const item = state.item;
    const row = document.createElement("div");
    row.className = "usual-food-row";
    row.dataset.usualIndex = String(index);
    row.style.cssText = "display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);";

    const details = document.createElement("div");
    details.style.cssText = "flex:1; min-width:0;";

    const name = document.createElement("div");
    name.className = "usual-food-name";
    name.style.cssText = "font-weight:500; overflow:hidden; text-overflow:ellipsis;";
    name.textContent = item.name;

    const macros = document.createElement("div");
    macros.style.cssText = "color:var(--dim); font-size:11px; line-height:1.4;";
    macros.textContent = Math.round(Number(item.cal||0))+" kcal · "
      +Math.round(Number(item.pro||0))+"P / "
      +Math.round(Number(item.carb||0))+"C / "
      +Math.round(Number(item.fat||0))+"F";

    details.appendChild(name);
    details.appendChild(macros);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "xbtn usual-item-add";
    addBtn.dataset.usualIndex = String(index);
    addBtn.style.cssText = "flex:0 0 auto; min-width:62px;";
    addBtn.textContent = state.added ? "Added" : "Add";
    addBtn.disabled = state.added;
    addBtn.setAttribute(
      "aria-label",
      (state.added ? "Already added: " : "Add usual food: ")+item.name
    );
    addBtn.addEventListener("click",()=>{
      addBtn.disabled = true;
      if (addUsualFood(item,meal)){
        flashSave(item.name+" added ✓");
      } else {
        renderUsual();
      }
    });

    row.appendChild(details);
    row.appendChild(addBtn);
    itemsEl.appendChild(row);
  });

  const total = Math.round(items.reduce((sum,item)=>sum+Number(item.cal||0),0));
  const pro = Math.round(items.reduce((sum,item)=>sum+Number(item.pro||0),0));
  const summary = document.createElement("div");
  summary.className = "usual-meal-summary";
  summary.style.cssText = "color:var(--dim); font-size:11px; margin-top:7px;";
  summary.textContent = total+" kcal · "+pro+"g protein · your typical portions";
  itemsEl.appendChild(summary);

  const btn = document.getElementById("usualLogBtn");

  if (!remaining.length){
    btn.textContent = "All added";
    btn.disabled = true;
    btn.setAttribute("aria-label","All usual "+meal+" foods added");
    btn.onclick = null;
    return;
  }

  const itemWord = remaining.length===1 ? "item" : "items";
  btn.disabled = false;
  btn.textContent = remaining.length===items.length
    ? "Add all ("+remaining.length+" "+itemWord+")"
    : "Add all remaining ("+remaining.length+" "+itemWord+")";
  btn.setAttribute(
    "aria-label",
    remaining.length===items.length
      ? "Add all usual "+meal+" foods"
      : "Add all remaining usual "+meal+" foods"
  );
  btn.onclick = ()=>{
    const freshItems = usualFor(meal)||[];
    const toAdd = freshItems.filter(item=>!usualFoodLoggedToday(item,meal));
    let added = 0;
    toAdd.forEach(item=>{
      if (addUsualFood(item,meal)) added++;
    });
    if (added){
      flashSave("Usual "+meal+" logged ✓");
    } else {
      renderUsual();
    }
  };
}

// ================== CALORIE SCHEDULE UI ==================
function schedBudget(){ return cfg.calTarget*7; }
function schedReadInputs(){ return [0,1,2,3,4,5,6].map(i=>Number(document.getElementById("sSched"+i).value)||0); }
function schedTargetsOk(){ return Number.isFinite(cfg.calTarget) && cfg.calTarget>0; }
function schedNote(){
  const mode = document.getElementById("sCalSched").value;
  const note = document.getElementById("schedTotalNote");
  const budget = schedBudget();
  if (mode==="same"){ note.style.color=""; note.textContent = "Weekly budget: "+budget+" kcal ("+cfg.calTarget+" every day)."; return; }
  if (mode!=="custom"){
    const d = presetDays(mode);
    const hi = Math.max.apply(null,d), lo = Math.min.apply(null,d);
    if(!calorieScheduleSafety(d).ok){
      note.style.color="var(--warn)";
      note.textContent="This schedule would put a day below "+MIN_DAILY_CALORIE_LABEL+" kcal. Choose Same target every day or raise the base target.";
      return;
    }
    note.style.color="";
    note.textContent = "Higher days "+hi+" kcal · lower days "+lo+" kcal · weekly total unchanged at "+budget+" kcal.";
    return;
  }
  const total = schedReadInputs().reduce((a,x)=>a+x,0);
  const diff = budget - total;
  if(!calorieScheduleSafety(schedReadInputs()).ok){
    note.style.color="var(--warn)";
    note.textContent="Every scheduled day must be at least "+MIN_DAILY_CALORIE_LABEL+" kcal.";
    return;
  }
  if (diff > 0){
    note.style.color="";
    note.textContent = "Weekly budget "+budget+" · scheduled "+total+" · remaining "+diff+" kcal (≈"+Math.round(diff/7)+"/day if spread across the week).";
  } else if (diff < 0){
    note.style.color = "var(--warn)";
    note.textContent = "Over weekly budget by "+(-diff)+" calories. Lower one or more days or change your base calorie target.";
  } else {
    note.style.color="";
    note.textContent = "Weekly budget "+budget+" · scheduled "+total+" · balanced ✓";
  }
}
function renderSched(){
  const ok = schedTargetsOk();
  document.getElementById("sCalSched").disabled = !ok;
  document.getElementById("schedDisabledNote").classList.toggle("hidden", ok);
  if (!ok){ document.getElementById("schedCustom").classList.add("hidden"); document.getElementById("schedTotalNote").textContent=""; return; }
  const mode = cfg.calSchedMode || "same";
  document.getElementById("sCalSched").value = mode;
  document.getElementById("schedCustom").classList.toggle("hidden", mode!=="custom");
  if (mode==="custom"){
    const days = (Array.isArray(cfg.calSchedDays) && cfg.calSchedDays.length===7) ? cfg.calSchedDays : [0,1,2,3,4,5,6].map(()=>cfg.calTarget);
    [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = days[i]; });
  }
  schedNote();
}
document.getElementById("sCalSched").addEventListener("change", ()=>{
  const mode = document.getElementById("sCalSched").value;
  document.getElementById("schedCustom").classList.toggle("hidden", mode!=="custom");
  if (mode==="custom"){
    // prefill: every box starts at an exact daily target, never 0 — from the schedule you're leaving
    const seed = presetDays(cfg.calSchedMode) ||
      ((cfg.calSchedMode==="custom" && Array.isArray(cfg.calSchedDays) && cfg.calSchedDays.length===7) ? cfg.calSchedDays : [0,1,2,3,4,5,6].map(()=>cfg.calTarget));
    [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = seed[i]; });
  }
  schedNote();
});
[0,1,2,3,4,5,6].forEach(i=>{
  document.getElementById("sSched"+i).addEventListener("input", schedNote);
});
document.getElementById("schedAutoBtn").addEventListener("click", ()=>{
  // user-triggered: spread the gap evenly so the week lands exactly on budget
  const days = schedReadInputs();
  const diff = schedBudget() - days.reduce((a,x)=>a+x,0);
  const per = Math.floor(diff/7);
  const balanced = days.map(d=>d+per);
  balanced[6] += diff - per*7; // rounding remainder
  [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = balanced[i]; });
  schedNote();
});

// ================== POSITIVE FOOD FEEDBACK ==================
let kudosTimer = null;
function foodKudos(entry){
  const pro = Number(entry.pro)||0, cal = Number(entry.cal)||0;
  let msg = null;
  if (pro >= 20 && cal > 0 && cal/pro <= 12) msg = "✓ Efficient protein";
  else if (pro >= 20) msg = "✓ Strong protein source";
  else if (pro >= Math.max(15, Math.round(cfg.proTarget*0.15))) msg = "✓ Helps hit protein goal";
  if (!msg) return;
  const el = document.getElementById("foodKudos");
  el.textContent = msg;
  el.classList.remove("hidden");
  if (kudosTimer) clearTimeout(kudosTimer);
  kudosTimer = setTimeout(()=>el.classList.add("hidden"), 3500);
}

// ================== AI HANDOFF ==================
// Native BlackPyre never contacts an AI service. Users deliberately copy or
// share a prompt, then paste the reply back for local review.
function foodHandoffEnabled(){ return cfg.foodHandoffOn !== false; }

document.getElementById("foodHandoffToggleBtn").addEventListener("click", ()=>{
  cfg.foodHandoffOn = !foodHandoffEnabled();
  saveCfg();
  renderAIGates();
  flashSave(cfg.foodHandoffOn ? "AI food handoff enabled ✓" : "AI food handoff hidden");
});

function renderAIGates(){
  const foodHandoffOn = foodHandoffEnabled();
  const foodToggle = document.getElementById("foodHandoffToggleBtn");
  foodToggle.textContent = foodHandoffOn ? "Disable AI food handoff" : "Enable AI food handoff";
  foodToggle.setAttribute("aria-pressed", String(foodHandoffOn));
  document.getElementById("aiFoodCard").classList.toggle("hidden", !foodHandoffOn);
  document.getElementById("aiHandoffControls").classList.toggle("hidden", !foodHandoffOn);
}

// ================== PASTE PROGRAM FROM AI ==================
document.getElementById("pasteProgBtn").addEventListener("click", async ()=>{
  let text = "";

  try {
    if (
      navigator.clipboard
      && navigator.clipboard.readText
    ){
      text = await navigator.clipboard.readText();
    }
  } catch(e){
    // Clipboard permission denied; use manual paste fallback.
  }

  if (!text){
    text =
      prompt(
        "Paste the AI's reply or JSON training plan here:"
      )
      || "";
  }

  if (!text.trim()) return;

  const documentValue =
    extractTrainingPlanDocumentFromText(text);

  if (!documentValue){
    flashSave(
      "No BlackPyre training plan was found. "
      +"Use Create a plan with AI to make a new file.",
      true
    );
    return;
  }

  const opened =
    openTrainingPlanReview(
      documentValue,
      {
        source:"AI paste",
        successMessage:"Program loaded ✓",
        onImported:()=>{
          ackBtn(
            "pasteProgBtn",
            "✓ Loaded: "+(program.name||"program")
          );
        }
      }
    );

  if (!opened.ok){
    console.error(
      "Pasted training plan rejected:",
      opened.code || "",
      opened.message || ""
    );

    flashSave(
      blackpyreTrainingPlanRejectionMessage(),
      true
    );
  }
});

// ================== AI FOOD LOGGING (text + photo) ==================
const FOOD_AI_SYSTEM = 'You are a nutrition estimator. Given a meal description or photo, respond with ONLY a JSON object, no prose, no code fences: {"foods":[{"name":"...","cal":0,"pro":0,"carb":0,"fat":0}]} — one entry per distinct food, realistic portion estimates, calories as kcal, macros in grams. If you cannot identify any food, return {"foods":[]}.';
function parseFoodsReply(text){
  let t = String(text||"")
    // smart/curly quotes from iPhone & ChatGPT copying -> straight quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    // zero-width & BOM junk -> gone; non-breaking spaces -> normal spaces
    .replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  t = t.trim();
  const j = JSON.parse(t);
  if (!j || !Array.isArray(j.foods)) throw new Error("bad shape");
  // strict shape: name + numeric cal/pro/carb/fat on every kept entry
  return j.foods.filter(f=>f && typeof f.name==="string" && f.name.trim()
      && ["cal","pro","carb","fat"].every(k=>Number.isFinite(Number(f[k]))))
    .map(f=>({
      name:String(f.name).trim(), cal:Number(f.cal), pro:Number(f.pro), carb:Number(f.carb), fat:Number(f.fat),
    }));
}
function aiFoodStatus(msg, isErr){
  const el = document.getElementById("aiFoodStatus");
  if (!msg){ el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  el.textContent = msg;
  el.style.color = isErr ? "var(--warn)" : "var(--dim)";
}
function scrollAiFoodIntoView(el, block){
  if (!el || typeof el.scrollIntoView!=="function") return;
  requestAnimationFrame(()=>{
    try { el.scrollIntoView({behavior:"smooth", block:block||"start"}); } catch(e){}
  });
}
function showFoodConfirm(foods){
  const el = document.getElementById("aiFoodConfirm");
  el.classList.remove("hidden");
  el.innerHTML = "";
  if (!foods.length){
    el.innerHTML = '<div class="note">The AI could not identify any food there. Try describing it, or use manual entry.</div>';
    return;
  }
  const items = foods.slice();
  const list = document.createElement("div");
  const add = document.createElement("button");
  add.className = "btn ghost small mt10 ai-confirm-log";
  add.style.width = "100%";
  function redraw(){
    list.innerHTML = "";
    items.forEach((f,i)=>{
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = '<div style="flex:1; min-width:0;"><div style="font-weight:500;">'+esc(f.name)+'</div>'
        +'<div style="color:var(--dim); font-size:11px;">'+Math.round(f.cal)+' kcal · '+Math.round(f.pro)+'P / '+Math.round(f.carb)+'C / '+Math.round(f.fat)+'F (estimate)</div></div>';
      const x = document.createElement("button");
      x.className = "xbtn"; x.textContent = "Remove item"; x.setAttribute("aria-label","Remove this estimated food");
      x.style.flex = "0 0 auto";
      x.addEventListener("click", ()=>{ items.splice(i,1); redraw(); });
      row.appendChild(x);
      list.appendChild(row);
    });
    add.textContent = "✓ Log " + items.length + " item" + (items.length===1?"":"s") + " to " + currentMeal;
    add.disabled = items.length===0;
  }
  redraw();
  el.appendChild(list);
  const totals = document.createElement("div");
  totals.className = "note";
  totals.textContent = "Estimates — edit anything after logging with ✎.";
  el.appendChild(totals);
  add.addEventListener("click", ()=>{
    const loggedCount = items.length;
    items.forEach(f=>addEntry(
      Object.assign({}, f),
      {allowDuplicate:true}
    ));
    document.getElementById("aiPhotoCaption").value="";
    el.classList.add("hidden");
    hfCloseParseBox();
    aiFoodStatus("Logged "+loggedCount+" ✓ — ready for another.");
    scrollAiFoodIntoView(document.getElementById("aiFoodCard"), "start");
    flashSave("Logged "+loggedCount+" ✓");
  });
  el.appendChild(add);
  // Keep the first reviewed item comfortably inside the viewport instead of
  // pinning the confirmation container against the top edge on mobile.
  scrollAiFoodIntoView(list.firstElementChild || el, "center");
}
// The shared file input feeds only the explicit copy/share handoff.
document.getElementById("aiPhotoFile").addEventListener("change", ev=>{
  const file=ev.target.files && ev.target.files[0];
  ev.target.value="";
  if(file) hfSetPhoto(file);
});

// ================== AI FOOD HANDOFF MODE ==================
function handoffFoodPrompt(){
  const desc = document.getElementById("aiFoodText").value.trim();
  const cap = document.getElementById("aiPhotoCaption").value.trim();
  return "Act as a nutrition estimator. "
    + (desc ? "The meal: " + desc + ". " : "Identify the foods in the attached meal photo. ")
    + (cap ? "Context: " + cap + ". " : "")
    + "Estimate realistic portions using this JSON schema: "
    + '{"foods":[{"name":"...","cal":0,"pro":0,"carb":0,"fat":0}]} '
    + "— one entry per distinct food, calories in kcal, protein/carbs/fat in grams. "
    + "Return ONLY the JSON in a single code block. Do not include any explanation, commentary, or text before or after the JSON.";
}
document.getElementById("hfCopyFoodBtn").addEventListener("click", ()=>{
  const txt = handoffFoodPrompt();
  const done = ()=>{ ackBtn("hfCopyFoodBtn", "✓ Copied (text only)"); };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(()=>{ fallbackCopy(txt); done(); });
  } else { fallbackCopy(txt); done(); }
});
document.getElementById("hfShareBtn").addEventListener("click", ()=>{
  document.getElementById("aiPhotoFile").click();
});

// staged handoff photo: memory-only, never stored, explicitly cleared
let hfPhoto = null;
let hfPhotoUrl = null;
function hfSetPhoto(file){
  hfClearPhoto(true);
  hfPhoto = file;
  try { hfPhotoUrl = URL.createObjectURL(file); document.getElementById("hfPhotoThumb").src = hfPhotoUrl; } catch(e){}
  document.getElementById("hfPhotoStatus").textContent = "Photo selected — now share to your AI app or attach it manually.";
  document.getElementById("hfPhotoStage").classList.remove("hidden");
  aiFoodStatus(null);
}
function hfClearPhoto(silent){
  if (hfPhotoUrl){ try { URL.revokeObjectURL(hfPhotoUrl); } catch(e){} }
  hfPhoto = null; hfPhotoUrl = null;
  document.getElementById("hfPhotoThumb").removeAttribute("src");
  document.getElementById("hfPhotoStage").classList.add("hidden");
  document.getElementById("aiPhotoFile").value = "";
  if (!silent) aiFoodStatus(null);
}
async function hfCopyPromptOnly(ackId){
  const txt = handoffFoodPrompt();
  if (navigator.clipboard && navigator.clipboard.writeText){
    try { await navigator.clipboard.writeText(txt); } catch(e){ fallbackCopy(txt); }
  } else fallbackCopy(txt);
  if (ackId) ackBtn(ackId, "✓ Copied (text only)");
}
document.getElementById("hfCopy2Btn").addEventListener("click", async ()=>{
  await hfCopyPromptOnly("hfCopy2Btn");
  aiFoodStatus("Prompt copied (text only — the photo is NOT copied). Attach the photo in your AI app, then paste its reply back here.");
});
document.getElementById("hfClearBtn").addEventListener("click", ()=>{
  hfClearPhoto();
  aiFoodStatus("Photo cleared.");
});
document.getElementById("hfShareGoBtn").addEventListener("click", async ()=>{
  if (!hfPhoto) return;
  const promptTxt = handoffFoodPrompt();
  if (navigator.share && navigator.canShare && navigator.canShare({files:[hfPhoto]})){
    try {
      await navigator.share({ files:[hfPhoto], title:"BlackPyre food estimate", text: promptTxt });
      hfClearPhoto(true); // successful share: photo's job is done
      aiFoodStatus("Shared ✓ — when your AI replies, tap Paste reply.");
      return;
    } catch(e){
      if (e && e.name==="AbortError"){
        hfClearPhoto(true);
        aiFoodStatus("Share cancelled — photo cleared.");
        return;
      }
      // real failure: fall through to explicit fallback, keep the photo visible
    }
  }
  await hfCopyPromptOnly(null);
  aiFoodStatus("Prompt copied. Your AI app may not accept photos from this share sheet. Open it and attach the photo manually, then paste its reply back here.", true);
});
document.getElementById("hfPasteBtn").addEventListener("click", async ()=>{
  // always show the visible paste box — clipboard access is unreliable in home-screen apps
  const box = document.getElementById("hfPasteBox");
  const ta = document.getElementById("hfPasteText");
  box.classList.remove("hidden");
  document.getElementById("aiFoodConfirm").classList.add("hidden");
  let clip = "";
  try {
    if (navigator.clipboard && navigator.clipboard.readText) clip = await navigator.clipboard.readText();
  } catch(e){ /* permission denied — user pastes manually */ }
  if (clip && clip.trim()) ta.value = clip; // prefill for verification, still shown
  aiFoodStatus("Paste reply below, then tap Review estimate.");
  try { ta.focus(); } catch(e){}
});
function hfCloseParseBox(){
  document.getElementById("hfPasteText").value = ""; // raw response discarded — never stored
  document.getElementById("hfPasteBox").classList.add("hidden");
}
document.getElementById("hfPasteCancelBtn").addEventListener("click", ()=>{
  hfCloseParseBox();
  aiFoodStatus(null);
});
document.getElementById("hfReviewBtn").addEventListener("click", ()=>{
  const raw = document.getElementById("hfPasteText").value;
  if (!raw.trim()){
    aiFoodStatus("The box is empty — paste the AI reply into it first.", true);
    return;
  }
  try {
    const foods = parseFoodsReply(raw);
    hfCloseParseBox();
    aiFoodStatus("Estimate ready — review before logging.");
    showFoodConfirm(foods);
    document.getElementById("aiFoodText").value = "";
    hfClearPhoto(true); // result imported — the photo's flow is complete
  } catch(e){
    aiFoodStatus("Could not read that JSON. Copy the AI’s whole response and try again.", true);
  }
});


// ================== AI COACH REPORT ==================
const AI_TRAINING_RANGES = Object.freeze({
  "4w":  {label:"last 4 weeks", days:28},
  "3m":  {label:"last 3 months", days:90},
  "6m":  {label:"last 6 months", days:180},
  "1y":  {label:"last 1 year", days:365},
  "all": {label:"all history", days:null}
});

function aiTrainingRangeKey(){
  const el = document.getElementById("aiTrainingRange");
  return el && AI_TRAINING_RANGES[el.value] ? el.value : "4w";
}

function aiDateDaysAgoStr(days){
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate()-days);

  return d.getFullYear()
    +"-"+String(d.getMonth()+1).padStart(2,"0")
    +"-"+String(d.getDate()).padStart(2,"0");
}

function aiTrainingWorkouts(rangeKey){
  const key = AI_TRAINING_RANGES[rangeKey]
    ? rangeKey
    : aiTrainingRangeKey();

  const meta = AI_TRAINING_RANGES[key];

  const cutoff = meta.days==null
    ? null
    : aiDateDaysAgoStr(meta.days);

  return data.workouts
    .filter(w=>!cutoff || w.date>=cutoff)
    .slice()
    .sort((a,b)=>a.date.localeCompare(b.date));
}

function aiTrainingHistoryPoints(points,rangeKey){
  const key = AI_TRAINING_RANGES[rangeKey]
    ? rangeKey
    : aiTrainingRangeKey();

  const meta = AI_TRAINING_RANGES[key];

  if (meta.days==null) return points.slice();

  const cutoff = aiDateDaysAgoStr(meta.days);
  return points.filter(p=>p.date>=cutoff);
}

function aiSafeWorkoutValue(value){
  try {
    if (typeof formatSets==="function") return formatSets(value);
  } catch(e){}

  if (typeof value==="string") return value;

  try { return JSON.stringify(value); }
  catch(e){ return "stored value"; }
}

function aiExerciseSummaries(workouts){
  const byName = {};

  workouts.forEach(session=>{
    Object.keys(session.sets||{}).forEach(name=>{
      const value = session.sets[name];

      if (!byName[name]){
        byName[name] = {
          name:name,
          count:0,
          firstDate:session.date,
          firstValue:value,
          lastDate:session.date,
          lastValue:value,
          bestE1RM:null
        };
      }

      const rec=byName[name];
      rec.count++;

      if (session.date<rec.firstDate){
        rec.firstDate=session.date;
        rec.firstValue=value;
      }

      if (session.date>=rec.lastDate){
        rec.lastDate=session.date;
        rec.lastValue=value;
      }

      try {
        const best=parseBestSet(value);

        if (best && Number.isFinite(best.e1rm)){
          rec.bestE1RM = rec.bestE1RM==null
            ? best.e1rm
            : Math.max(rec.bestE1RM,best.e1rm);
        }
      } catch(e){}
    });
  });

  return Object.keys(byName)
    .map(name=>byName[name])
    .sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name));
}

function aiTrainingExport(rangeKey){
  const key = AI_TRAINING_RANGES[rangeKey]
    ? rangeKey
    : aiTrainingRangeKey();

  const meta=AI_TRAINING_RANGES[key];
  const workouts=aiTrainingWorkouts(key);

  return {
    type:"blackpyre-ai-training-export",
    formatVersion:1,
    exportedAt:new Date().toISOString(),
    range:key,
    rangeLabel:meta.label,
    workoutCount:workouts.length,
    workouts:cloneJSON(workouts),
    currentProgram:cloneJSON(program),
    liftGoals:cloneJSON(cfg.liftGoals||{})
  };
}

function aiReport(rangeKey){
  const key = AI_TRAINING_RANGES[rangeKey]
    ? rangeKey
    : aiTrainingRangeKey();

  const rangeMeta=AI_TRAINING_RANGES[key];
  const today=todayStr();

  const sorted=data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const cur=sorted.length ? sorted[sorted.length-1].lbs : cfg.startWt;
  const sl=weightSlope(28);
  const rate=sl ? Math.round(sl.slope*7*10)/10 : null;
  const tdee=(typeof computeTDEE==="function") ? computeTDEE() : null;

  // Nutrition deliberately remains a recent 14-day adherence snapshot.
  const days=[];

  for(let i=13;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);

    days.push(
      d.getFullYear()
      +"-"+String(d.getMonth()+1).padStart(2,"0")
      +"-"+String(d.getDate()).padStart(2,"0")
    );
  }

  const logged=days.filter(d=>(data.food[d]||[]).length>0);
  const fullDays=logged.map(d=>daySums(d)).filter(x=>x.cal>500);

  const avgCal=fullDays.length
    ? Math.round(fullDays.reduce((a,x)=>a+x.cal,0)/fullDays.length)
    : null;

  const avgPro=fullDays.length
    ? Math.round(fullDays.reduce((a,x)=>a+x.pro,0)/fullDays.length)
    : null;

  const proHit=logged.filter(
    d=>daySums(d).pro>=dayTargets(d).pro
  ).length;

  const training=aiTrainingWorkouts(key);
  const legacyCardio=training.filter(w=>w.day==="CARDIO").length;
  const programOrFreestyle=training.length-legacyCardio;

  const summaries=aiExerciseSummaries(training);
  const shownSummaries=summaries.slice(0,30);

  const liftLines=[];

  program.days.forEach(d=>d.exercises.forEach(ex=>{
    const name=ex.name.replace("[Cardio] ","");

    const hist=aiTrainingHistoryPoints(
      liftHistory(name),
      key
    );

    if (!hist.length) return;

    const last3=hist.slice(-3).map(
      p=>fmtDate(p.date)+": ~"+Math.round(p.y)
    );

    const goal=(cfg.liftGoals||{})[name];

    liftLines.push(
      "- **"+name+"** ("+(ex.scheme||"no scheme")
      +"): est-1RM trend "
      +last3.join(" → ")
      +(goal ? " · goal "+goal : "")
    );
  }));

  const recentSessions=training.slice(-10).reverse();
  const L=[];

  L.push("# BlackPyre Progress Report — "+fmtDate(today));
  L.push("");
  L.push("You are my fitness coach. Below is my real logged data from the BlackPyre app. Please:");
  L.push("1. Assess my rate of progress toward my goal — too fast, too slow, or on track.");
  L.push("2. Flag anything in my nutrition adherence that needs fixing.");
  L.push("3. Review my training progression over the selected history range and suggest specific adjustments.");
  L.push("4. If my program should change, return a COMPLETE updated program as a JSON code block in the exact format shown at the bottom (same structure, keep exercise names I'm progressing on unchanged so my history stays connected). I will load it directly into the app.");
  L.push("5. Be direct — no generic advice.");

  L.push("");
  L.push("## Goal & weight");
  L.push("- Start: "+formatBodyWeight(cfg.startWt,currentUnitSystem(),1)+" · Current: "+formatBodyWeight(cur,currentUnitSystem(),1)+" · Goal: "+formatBodyWeight(cfg.goalWt,currentUnitSystem(),1));

  L.push(
    rate!=null
      ? "- Weight trend (last 28 days): "+(rate>0?"+":"")+poundsToUnit(rate,currentUnitSystem(),2)+" "+unitWeightLabel()+"/week"
      : "- Weight trend: not enough weigh-ins yet ("+sorted.length+" recorded)"
  );

  if (tdee && tdee.tdee){
    L.push("- Measured TDEE from my actual logs: ~"+tdee.tdee+" kcal/day");
  }

  L.push("");
  L.push("## Nutrition (last 14 days)");

  L.push(
    "- Daily targets (exact): "+cfg.calTarget+" kcal"
    +(cfg.calSchedMode!=="same"
      ? " (scheduled by day; weekly total "+weeklyCalTotal()+")"
      : "")
    +" · protein "+cfg.proTarget+"g"
    +" · carbs "+cfg.carbGoal+"g"
    +" · fat "+cfg.fatGoal+"g"
  );

  L.push(
    logged.length
      ? "- Logged "+logged.length+" of 14 days · avg "
        +(avgCal!=null
          ? avgCal+" kcal, "+avgPro+"g protein"
          : "insufficient full days")
        +" · protein target hit "+proHit+"/"+logged.length+" days"
      : "- No food logged in the last 14 days"
  );

  L.push("");
  L.push("## Training ("+rangeMeta.label+")");

  if (!training.length){
    L.push("- No workout sessions logged in the selected range.");
  } else {
    const first=training[0];
    const last=training[training.length-1];

    L.push(
      "- "+training.length+" session"+(training.length===1?"":"s")
      +" in selected range · "
      +fmtDate(first.date)+" → "+fmtDate(last.date)
      +" · program: \""+(program.name||"unnamed")+"\""
    );

    if (legacyCardio){
      L.push(
        "- Session types: "+programOrFreestyle
        +" program/freestyle · "
        +legacyCardio+" legacy cardio"
      );
    }

    if (shownSummaries.length){
      L.push("- Exercise history summary:");

      shownSummaries.forEach(rec=>{
        let line =
          "  - **"+rec.name+"**: "
          +rec.count+" session"+(rec.count===1?"":"s")
          +" · first "+fmtDate(rec.firstDate)+": "
          +aiSafeWorkoutValue(rec.firstValue)
          +" · latest "+fmtDate(rec.lastDate)+": "
          +aiSafeWorkoutValue(rec.lastValue);

        if (rec.bestE1RM!=null){
          line += " · best est-1RM ~"+Math.round(rec.bestE1RM);
        }

        L.push(line);
      });

      if (summaries.length>30){
        const omitted=summaries.length-30;

        L.push(
          "  - "+omitted+" additional exercise"
          +(omitted===1?"":"s")
          +" omitted from this compact report; use Download training JSON for exact records."
        );
      }
    }

    if (liftLines.length){
      L.push("- Current-program lift progression in selected range:");
      liftLines.forEach(x=>L.push("  "+x));
    }

    if (recentSessions.length){
      L.push("- Most recent sessions in selected range (up to 10):");

      recentSessions.forEach(s=>{
        const dayObj=program.days.find(d=>d.id===s.day);
        const title=s.title || (dayObj?dayObj.title:s.day) || "Workout";

        const values=Object.keys(s.sets||{}).map(
          name=>name+" — "+aiSafeWorkoutValue(s.sets[name])
        ).join("; ");

        L.push(
          "  - "+fmtDate(s.date)+" · "+title
          +(values ? ": "+values : "")
          +(s.notes ? " · note: "+s.notes : "")
        );
      });
    }
  }

  L.push("");
  L.push("## My current program (edit this and return the full updated JSON)");
  L.push("```json");
  L.push(JSON.stringify(program,null,2));
  L.push("```");
  L.push("");

  L.push(
    'Program format rules: top level {name, days:[...]}; each day {id:"D1", title, exercises:[{name, scheme}]}; schemes like "4×5" or "3×8-12" power the app\'s prefill and auto-progression; cardio entries are named "[Cardio] Type" with a duration as the scheme.'
  );

  L.push("");

  L.push(
    "Exact raw workout records for the selected training range can be shared as a JSON file or copied directly from BlackPyre. Choosing All history includes every stored workout session without shortening the saved history."
  );

  return L.join("\n");
}

document.getElementById("aiDownloadBtn").addEventListener("click", ()=>{
  download("blackpyre-report-"+todayStr()+".md", aiReport());
  ackBtn("aiDownloadBtn", "✓ Downloaded");
});
function trainingJsonArtifact(rangeKey){
  const key =
    AI_TRAINING_RANGES[rangeKey]
      ? rangeKey
      : aiTrainingRangeKey();

  const payload =
    aiTrainingExport(key);

  return {
    key:key,
    payload:payload,
    filename:
      "blackpyre-training-"
      +key
      +"-"
      +todayStr()
      +".json",
    text:JSON.stringify(payload,null,2)
  };
}

function nativePlatformForTrainingJson(){
  const c =
    typeof window!=="undefined"
      ? window.Capacitor
      : null;

  try {
    return !!(
      c
      && typeof c.isNativePlatform==="function"
      && c.isNativePlatform()
    );
  } catch(e){
    return false;
  }
}

async function copyExactTrainingJsonText(text){
  if (
    navigator.clipboard
    && typeof navigator.clipboard.writeText==="function"
  ){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch(e){}
  }

  const ta =
    document.createElement("textarea");

  ta.value = text;
  ta.setAttribute("readonly","");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "0";
  ta.style.opacity = "0";

  document.body.appendChild(ta);
  ta.focus();
  ta.select();

  let copied = false;

  try {
    copied =
      document.execCommand("copy") !== false;
  } catch(e){
    copied = false;
  }

  document.body.removeChild(ta);

  return copied;
}

async function copyTrainingJson(rangeKey){
  const artifact =
    trainingJsonArtifact(rangeKey);

  const copied =
    await copyExactTrainingJsonText(
      artifact.text
    );

  if (!copied){
    flashSave(
      "Training JSON could not be copied",
      true
    );

    ackBtn(
      "aiTrainingJsonCopyBtn",
      "✕ Copy failed"
    );

    return false;
  }

  const count =
    artifact.payload.workoutCount;

  flashSave(
    count
    +" workout"
    +(count===1?"":"s")
    +" copied — paste into any AI"
  );

  ackBtn(
    "aiTrainingJsonCopyBtn",
    "✓ JSON copied"
  );

  return true;
}

async function shareTrainingJson(rangeKey){
  const artifact =
    trainingJsonArtifact(rangeKey);

  const capability =
    typeof nativeJsonExportCapability==="function"
      ? nativeJsonExportCapability()
      : {
          available:false,
          shareAvailable:false
        };

  if (nativePlatformForTrainingJson()){
    if (
      !capability.available
      || !capability.shareAvailable
      || typeof writeNativeJson!=="function"
      || typeof shareNativeJson!=="function"
    ){
      flashSave(
        "Native file sharing is unavailable — use Copy training JSON",
        true
      );

      ackBtn(
        "aiTrainingJsonShareBtn",
        "✕ Share unavailable"
      );

      return false;
    }

    try {
      const nativeFile =
        await writeNativeJson(
          capability,
          artifact.filename,
          artifact.text
        );

      await shareNativeJson(
        capability,
        nativeFile,
        "BlackPyre training history"
      );

      const count =
        artifact.payload.workoutCount;

      flashSave(
        count
        +" workout"
        +(count===1?"":"s")
        +" ready — choose where to save or share the file"
      );

      ackBtn(
        "aiTrainingJsonShareBtn",
        "✓ Share complete"
      );

      return true;
    } catch(error){
      const cancelled =
        typeof isNativeShareCancellation==="function"
          ? isNativeShareCancellation(error)
          : /cancel/i.test(
              error && error.message
                ? error.message
                : String(error||"")
            );

      console.error(
        "BlackPyre training JSON share did not complete:",
        error
      );

      if (cancelled){
        flashSave(
          "Share canceled — no external destination was selected"
        );

        ackBtn(
          "aiTrainingJsonShareBtn",
          "↩ Share canceled"
        );
      } else {
        flashSave(
          "Training JSON could not be shared",
          true
        );

        ackBtn(
          "aiTrainingJsonShareBtn",
          "✕ Share failed"
        );
      }

      return false;
    }
  }

  if (
    typeof File==="function"
    && navigator.share
    && typeof navigator.share==="function"
  ){
    try {
      const file =
        new File(
          [artifact.text],
          artifact.filename,
          {type:"application/json"}
        );

      const canShare =
        !navigator.canShare
        || typeof navigator.canShare!=="function"
        || navigator.canShare({files:[file]});

      if (canShare){
        await navigator.share({
          title:"BlackPyre training history",
          files:[file]
        });

        ackBtn(
          "aiTrainingJsonShareBtn",
          "✓ Share complete"
        );

        return true;
      }
    } catch(error){
      const cancelled =
        error
        && (
          error.name==="AbortError"
          || /cancel/i.test(
               error.message
                 ? error.message
                 : String(error)
             )
        );

      if (cancelled){
        ackBtn(
          "aiTrainingJsonShareBtn",
          "↩ Share canceled"
        );

        return false;
      }
    }
  }

  try {
    download(
      artifact.filename,
      artifact.text
    );

    ackBtn(
      "aiTrainingJsonShareBtn",
      "✓ Downloaded"
    );

    return true;
  } catch(error){
    console.error(
      "BlackPyre training JSON browser export failed:",
      error
    );

    flashSave(
      "Training JSON could not be exported",
      true
    );

    ackBtn(
      "aiTrainingJsonShareBtn",
      "✕ Export failed"
    );

    return false;
  }
}

document
  .getElementById("aiTrainingJsonShareBtn")
  .addEventListener(
    "click",
    ()=>shareTrainingJson()
  );

document
  .getElementById("aiTrainingJsonCopyBtn")
  .addEventListener(
    "click",
    ()=>copyTrainingJson()
  );
document.getElementById("aiCopyBtn").addEventListener("click", ()=>{
  const txt = aiReport();
  const done = ()=>ackBtn("aiCopyBtn", "✓ Copied — paste into any AI");
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done).catch(()=>{ fallbackCopy(txt); done(); });
  } else { fallbackCopy(txt); done(); }
});
function fallbackCopy(txt){
  const ta = document.createElement("textarea");
  ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch(e){}
  document.body.removeChild(ta);
}

// ================== ANALYTICS ==================
// --- generic line chart (dates -> values) with optional goal line ---
function lineChartSVG(pts, goal){
  const w=640, h=230, pad=40;
  if (!pts.length) return '<div class="note">Not enough data yet.</div>';
  const ys = pts.map(p=>p.y).concat(goal?[goal]:[]);
  const minY = Math.min.apply(null, ys)-10, maxY = Math.max.apply(null, ys)+10;
  const t0 = new Date(pts[0].date).getTime();
  const t1 = Math.max(new Date(pts[pts.length-1].date).getTime(), t0+1);
  const x = d => pad + ((new Date(d).getTime()-t0)/(t1-t0)) * (w-pad*2);
  const y = v => h-pad-((v-minY)/(maxY-minY))*(h-pad*2);
  let grid=""; for(let i=0;i<5;i++){const gy=pad+(i/4)*(h-pad*2); grid+='<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+gy+'" y2="'+gy+'" stroke="var(--border)" stroke-width="1"/>';}
  const line = pts.length>1 ? '<polyline points="'+pts.map(p=>x(p.date)+","+y(p.y)).join(" ")+'" fill="none" stroke="url(#lg2)" stroke-width="3" stroke-linecap="round"/>' : "";
  const dots = pts.map(p=>'<circle cx="'+x(p.date)+'" cy="'+y(p.y)+'" r="4.5" fill="var(--panel)" stroke="var(--ember)" stroke-width="2.5"/>'
    +'<text x="'+x(p.date)+'" y="'+(y(p.y)-11)+'" text-anchor="middle" font-size="10" fill="var(--text)" font-family="IBM Plex Mono">'+Math.round(p.y)+'</text>').join("");
  const goalLine = goal ? '<line x1="'+pad+'" x2="'+(w-pad)+'" y1="'+y(goal)+'" y2="'+y(goal)+'" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 5"/>'
    +'<text x="'+(w-pad)+'" y="'+(y(goal)-7)+'" text-anchor="end" font-size="11" fill="var(--ok)" font-family="IBM Plex Mono">GOAL '+goal+'</text>' : "";
  return '<svg viewBox="0 0 '+w+' '+h+'"><defs><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--ember-deep)"/><stop offset="100%" stop-color="var(--ember)"/></linearGradient></defs>'
    +grid+goalLine+line+dots+'</svg>';
}

// --- per-lift chart overlay ---
let liftOverlayEx = null;
function liftHistory(exName){
  const byDate = {};
  data.workouts.forEach(s=>{
    const v = s.sets[exName];
    if (!v) return;
    const b = parseBestSet(v);
    if (b && (!byDate[s.date] || b.e1rm>byDate[s.date])) byDate[s.date] = b.e1rm;
  });
  return Object.keys(byDate).sort().map(d=>({date:d, y:byDate[d]}));
}
function openLiftChart(exName){
  liftOverlayEx = exName;
  document.getElementById("liftTitle").textContent = exName;
  const goal = (cfg.liftGoals||{})[exName] || null;
  const pts = liftHistory(exName);
  const displayPts=pts.map(point=>({date:point.date,y:poundsToUnit(point.y,currentUnitSystem(),2)}));
  const displayGoal=goal?poundsToUnit(goal,currentUnitSystem(),2):null;
  document.getElementById("liftChart").innerHTML = lineChartSVG(displayPts, displayGoal);
  document.getElementById("liftGoalInput").value = displayGoal || "";
  const best = pts.length ? Math.max.apply(null, pts.map(p=>p.y)) : 0;
  const unit=unitWeightLabel(), metric=isMetricSystem();
  document.getElementById("liftGoalLabel").textContent="Goal for this lift ("+unit+", est. 1RM)";
  document.getElementById("liftGoalInput").setAttribute("aria-label","Estimated one rep max goal in "+(metric?"kilograms":"pounds"));
  document.getElementById("liftGoalInput").placeholder=metric?"e.g. 140":"e.g. 315";
  document.getElementById("liftGoalNote").textContent = goal
    ? "Current best: ~"+poundsToUnit(best,currentUnitSystem(),1)+" "+unit+" est. 1RM · "+poundsToUnit(Math.max(0, goal-best),currentUnitSystem(),1)+" "+unit+" to go"
    : "Set a goal to draw a target line on the chart.";
  if (document.getElementById("liftOverlay").classList.contains("hidden")){
    lockScroll();
    document.getElementById("liftOverlay").scrollTop = 0;
  }
  document.getElementById("liftOverlay").classList.remove("hidden");
}
document.getElementById("liftCloseBtn").addEventListener("click", ()=>{
  document.getElementById("liftOverlay").classList.add("hidden");
  unlockScroll();
});
document.getElementById("liftGoalSave").addEventListener("click", ()=>{
  const v = poundsFromUnit(document.getElementById("liftGoalInput").value,currentUnitSystem());
  if(!cfg.liftGoals) cfg.liftGoals = {};
  if (v>0) cfg.liftGoals[liftOverlayEx] = v; else delete cfg.liftGoals[liftOverlayEx];
  saveCfg();
  ackBtn("liftGoalSave", "✓ Goal set");
  openLiftChart(liftOverlayEx);
});

// --- weekly review ---
function renderWeek(){
  const card = document.getElementById("weekCard");
  const now = new Date();
  const days = [];
  for(let i=6;i>=0;i--){
    const d = new Date(now); d.setDate(d.getDate()-i);
    days.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"));
  }
  const logged = days.filter(d=>(data.food[d]||[]).length>0);
  const sessions = data.workouts.filter(w=>days.indexOf(w.date)>=0).length;
  const wIn = data.weights.filter(w=>days.indexOf(w.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));
  if (!logged.length && !sessions && wIn.length<2){ card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  const fullDays = logged.map(d=>daySums(d)).filter(x=>x.cal>500);
  const avgCal = fullDays.length ? Math.round(fullDays.reduce((s,x)=>s+x.cal,0)/fullDays.length) : null;
  const proDays = logged.filter(d=>daySums(d).pro>=dayTargets(d).pro).length;
  let html = "";
  if (avgCal!=null){
    const weekAvgT = Math.round(weeklyCalTotal()/7);
    const inBand = Math.abs(avgCal-weekAvgT) <= 100;
    html += 'Avg calories: <b style="color:'+(inBand?'var(--ok)':'var(--text)')+'">'+avgCal+'</b> <span style="color:var(--dim)">/ '+weekAvgT+'</span><br>';
  }
  if (logged.length) html += 'Protein target hit: <b>'+proDays+' of '+logged.length+'</b> logged days<br>';
  html += 'Sessions: <b>'+sessions+'</b> this week<br>';
  if (wIn.length>=2){
    const dw = Math.round((wIn[wIn.length-1].lbs - wIn[0].lbs)*10)/10;
    html += 'Weight: <b style="color:'+(dw<=0?'var(--ok)':'var(--text)')+'">'+(dw>0?'+':'')+poundsToUnit(dw,currentUnitSystem(),1)+' '+unitWeightLabel()+'</b> this week';
  }
  document.getElementById("weekBody").innerHTML = html;
}

// --- goal projection ---
function weightSlope(daysBack){
  const cutoff = new Date(Date.now() - daysBack*86400000);
  const cutStr = cutoff.getFullYear()+"-"+String(cutoff.getMonth()+1).padStart(2,"0")+"-"+String(cutoff.getDate()).padStart(2,"0");
  const wts = data.weights.filter(w=>w.date>=cutStr).sort((a,b)=>a.date.localeCompare(b.date));
  if (wts.length<4) return null;
  const span = (new Date(wts[wts.length-1].date) - new Date(wts[0].date))/86400000;
  if (span<10) return null;
  const t0 = new Date(wts[0].date).getTime();
  const pts = wts.map(w=>({x:(new Date(w.date).getTime()-t0)/86400000, y:w.lbs}));
  const n=pts.length, sx=pts.reduce((s,p)=>s+p.x,0), sy=pts.reduce((s,p)=>s+p.y,0);
  const sxx=pts.reduce((s,p)=>s+p.x*p.x,0), sxy=pts.reduce((s,p)=>s+p.x*p.y,0);
  const den = n*sxx-sx*sx;
  if (!den) return null;
  return { slope:(n*sxy-sx*sy)/den, current: wts[wts.length-1].lbs };
}
function renderProjection(){
  const el = document.getElementById("projLine");
  const r = weightSlope(35);
  if (!r){ el.classList.add("hidden"); return; }
  const rate = Math.round(r.slope*7*10)/10; // canonical lb/week
  const shownRate=poundsToUnit(rate,currentUnitSystem(),2), unit=unitWeightLabel();
  const toGo = cfg.goalWt - r.current;      // negative when cutting
  el.classList.remove("hidden");
  if (Math.abs(rate) < 0.15){
    el.textContent = "Trend: holding steady — not enough movement to project a goal date.";
    return;
  }
  if ((toGo<0 && rate>=0) || (toGo>0 && rate<=0)){
    el.textContent = "Trending "+(shownRate>0?"+":"")+shownRate+" "+unit+"/week right now — but you are here, logging, which is how every turnaround starts. Refocus this week; the trend follows the work.";
    return;
  }
  const weeks = toGo/rate;
  if (weeks > 104){
    el.textContent = "Trending "+(shownRate>0?"+":"")+shownRate+" "+unit+"/week — over ~2 years to goal at this rate.";
    return;
  }
  const eta = new Date(Date.now() + weeks*7*86400000);
  const fmt = eta.toLocaleDateString("en-US", {month:"short", day:"numeric", year:"numeric"});
  el.innerHTML = 'At your current rate (<b>'+(shownRate>0?'+':'')+shownRate+' '+unit+'/week</b>), you reach <b class="ember-text">'+formatBodyWeight(cfg.goalWt,currentUnitSystem(),1)+' around '+fmt+'</b>.';
}

// --- body measurements (optional) ---
function renderMeasureToggle(){
  document.getElementById("measureToggleBtn").textContent = cfg.measureOn ? "Disable body measurements" : "Enable body measurements";
  document.getElementById("measureCard").classList.toggle("hidden", !cfg.measureOn);
  const metric=isMetricSystem(), unit=unitMeasurementLabel();
  const label=document.getElementById("bodyMeasurementsLabel"); if(label) label.textContent="Body measurements ("+(metric?"centimeters":"inches")+")";
  [["mWaist","Waist"],["mChest","Chest"],["mArm","Arm"]].forEach(item=>{
    const el=document.getElementById(item[0]); if(!el) return;
    el.placeholder=unit;
    el.setAttribute("aria-label",item[1]+" measurement in "+(metric?"centimeters":"inches"));
  });
}
document.getElementById("measureToggleBtn").addEventListener("click", ()=>{
  cfg.measureOn = !cfg.measureOn;
  saveCfg();
  renderMeasureToggle();
  ackBtn("measureToggleBtn", cfg.measureOn ? "✓ Enabled" : "✓ Disabled");
  renderMeasure();
});
document.getElementById("mSaveBtn").addEventListener("click", ()=>{
  const convert=id=>{ const value=document.getElementById(id).value; return value===""?null:inchesFromUnit(value,currentUnitSystem()); };
  const waist = convert("mWaist");
  const chest = convert("mChest");
  const arm = convert("mArm");
  if (!waist && !chest && !arm){ flashSave("Enter at least one", true); return; }
  if (!data.measure) data.measure = [];
  const dt = todayStr();
  data.measure = data.measure.filter(m=>m.date!==dt);
  data.measure.push({date:dt, waist:waist, chest:chest, arm:arm});
  ["mWaist","mChest","mArm"].forEach(id=>document.getElementById(id).value="");
  save(); renderMeasure();
  ackBtn("mSaveBtn", "✓ Saved");
});
function renderMeasure(){
  if (!cfg.measureOn) return;
  const el = document.getElementById("mList");
  const list = (data.measure||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if (!list.length){ el.innerHTML = ""; return; }
  el.innerHTML = list.map((m,i)=>{
    const prev = list[i+1];
    const shown=value=>inchesToUnit(value,currentUnitSystem(),1);
    const delta = (cur, pre)=> (cur!=null && pre!=null) ? ' <span style="color:'+(cur<pre?'var(--ok)':'var(--dim)')+'; font-size:10px;">('+(cur-pre>0?'+':'')+shown(cur-pre)+')</span>' : '';
    return '<div class="list-item"><span style="flex:1; color:var(--dim);">'+fmtDate(m.date)+'</span>'
      +'<span style="flex:3; text-align:right; font-size:12px;">'
      +(m.waist!=null?('W '+shown(m.waist)+delta(m.waist, prev&&prev.waist)+'  '):'')
      +(m.chest!=null?('C '+shown(m.chest)+delta(m.chest, prev&&prev.chest)+'  '):'')
      +(m.arm!=null?('A '+shown(m.arm)+delta(m.arm, prev&&prev.arm)):'')
      +' '+unitMeasurementLabel()
      +'</span>'
      +'<button class="del mdel" data-d="'+m.date+'" aria-label="Delete">✕</button></div>';
  }).join("");
  el.querySelectorAll(".mdel").forEach(b=>b.addEventListener("click",()=>{
    const i = data.measure.findIndex(m=>m.date===b.dataset.d);
    if (i<0) return;
    const removed = data.measure[i];
    data.measure.splice(i,1);
    if (!save()){ data.measure.splice(i,0,removed); renderMeasure(); return; }
    renderMeasure();
    offerUndo("Deleted measurements from "+fmtDate(removed.date), ()=>{
      data.measure.splice(Math.min(i,data.measure.length),0,removed);
      save(); renderMeasure();
      flashSave("Measurements restored ✓");
    });
  }));
}
