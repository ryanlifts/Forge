"use strict";
// ================== V23: WATER / QUOTES / ACCENTS / SWAPS ==================
// ---------- water tracking (optional) ----------
function renderWater(){
  const card = document.getElementById("waterCard");
  card.classList.toggle("hidden", !cfg.waterOn);
  if (!cfg.waterOn) return;
  if (!data.water) data.water = {};
  document.getElementById("waterCount").textContent = data.water[todayStr()] || 0;
  const history=document.getElementById("waterHistory");
  const dates=Object.keys(data.water)
    .filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(data.water[date])) && Number(data.water[date])>=0)
    .sort((a,b)=>b.localeCompare(a))
    .slice(0,7);
  history.innerHTML=dates.length
    ? '<details><summary class="label" style="cursor:pointer; margin-bottom:0;">Recent water history</summary><div style="margin-top:8px;">'+dates.map(date=>
        '<div class="list-item" style="justify-content:space-between; gap:20px;"><span style="flex:1; color:var(--dim);">'+fmtDate(date)+'</span><span class="water-history-value" style="flex:0 0 auto; color:var(--dim); white-space:nowrap;">'+Number(data.water[date])+' '+(Number(data.water[date])===1?'GLASS':'GLASSES')+'</span></div>'
      ).join("")+'</div></details>'
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
function openFormVideo(name){
  window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(displayExerciseName(name)+" proper form how to"), "_blank");
}
function swapOptionsForExercise(origName,currentShown){
  const current=exerciseDescriptor(currentShown,null);
  const original=exerciseDescriptor(origName,null);

  if(!current || current.legacy || current.shape==="unknown")return [];

  const currentTags=new Set(current.tags||[]);
  const currentEquipment=new Set(current.equipment||[]);

  return allExerciseEntries(false)
    .filter(entry=>
      entry.id!==current.id
      && entry.id!==original.id
      && entry.shape===current.shape
      && !sessionContainsExerciseIdentity(entry,origName)
    )
    .map(entry=>{
      let score=0;
      (entry.tags||[]).forEach(tag=>{ if(currentTags.has(tag)) score+=5; });
      (entry.equipment||[]).forEach(eq=>{ if(currentEquipment.has(eq)) score+=3; });
      if(entry.bodyweight===current.bodyweight) score+=2;
      if(entry.unilateral===current.unilateral) score+=1;
      return {entry:entry,score:score};
    })
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0,8)
    .map(item=>item.entry.name)
    .filter(name=>normalizeExerciseName(name)!==normalizeExerciseName(currentShown));
}
function latestExerciseHistoryHit(entry){
  for(let i=data.workouts.length-1;i>=0;i--){
    const hit=findHistoryValue(data.workouts[i].sets,entry);
    if(hit) return hit;
  }
  return null;
}
function offerSwap(origName,currentShown,container){
  const base=origName;
  const opts=swapOptionsForExercise(base,currentShown);
  const menu=document.createElement("div");
  menu.className="swapmenu";
  if(normalizeExerciseName(currentShown)!==normalizeExerciseName(base)){
    const original=document.createElement("button");
    original.className="xbtn";
    original.textContent="⇄ "+displayExerciseName(base)+" (original)";
    original.addEventListener("click",()=>applySwap(base,currentShown,base));
    menu.appendChild(original);
  }
  opts.forEach(target=>{
    const button=document.createElement("button");
    button.className="xbtn";
    button.textContent="⇄ "+target;
    button.addEventListener("click",()=>applySwap(base,currentShown,target));
    menu.appendChild(button);
  });
  if(!opts.length && normalizeExerciseName(currentShown)===normalizeExerciseName(base)){
    const note=document.createElement("div");note.className="note";note.textContent="No close alternatives found for this tracking shape.";menu.appendChild(note);
  }
  const cancel=document.createElement("button");cancel.className="xbtn";cancel.textContent="Cancel";cancel.addEventListener("click",()=>menu.remove());menu.appendChild(cancel);
  container.appendChild(menu);
}
function applySwap(base,currentShown,target){
  const currentEntry=exerciseDescriptor(currentShown,null);
  const targetEntry=exerciseDescriptor(target,null);

  if(
    exerciseIdentityKey(currentEntry)
    ===exerciseIdentityKey(targetEntry)
  ){
    return true;
  }

  if(currentEntry.shape!==targetEntry.shape){
    showWorkoutError(
      "Exercise swaps must use the same tracking shape.",
      null
    );
    return false;
  }

  if(sessionContainsExerciseIdentity(targetEntry,base)){
    showWorkoutError(
      targetEntry.name+" is already in this session.",
      null
    );
    return false;
  }

  const currentKey=Object.keys(sessionState||{}).find(key=>
    exerciseIdentityKey(key)===exerciseIdentityKey(currentEntry)
  );
  const currentState=currentKey
    ? sessionState[currentKey]
    : null;

  if(
    currentState
    && stateHasInput(currentState)
    && !confirm(
      "Discard the entered result for "
      +displayExerciseName(currentEntry.name)
      +" and swap to "
      +displayExerciseName(targetEntry.name)
      +"?"
    )
  ){
    return false;
  }

  const previousDraft=data.activeWorkoutDraft
    ? cloneJSON(data.activeWorkoutDraft)
    : null;
  const previousSwaps=cloneExerciseNameMap(sessionSwaps);
  const previousState=cloneExerciseNameMap(sessionState);

  if(currentKey)delete sessionState[currentKey];

  if(
    exerciseIdentityKey(targetEntry)
    ===exerciseIdentityKey(base)
  ){
    delete sessionSwaps[base];
  }else{
    sessionSwaps[base]=targetEntry.name;
  }

  initSessionStateFor(targetEntry.name);

  if(workoutDraftLoaded){
    data.activeWorkoutDraft=buildWorkoutDraft();

    if(!save()){
      data.activeWorkoutDraft=previousDraft;
      sessionSwaps=previousSwaps;
      sessionState=previousState;
      renderSessionInputs();
      renderWorkoutDraftCard();
      showWorkoutError(
        "The swap could not be saved. Your completed result was kept.",
        null
      );
      return false;
    }
  }

  clearWorkoutError();
  renderSessionInputs();
  renderWorkoutDraftCard();
  return true;
}
function sessionReplacementEntry(target){
  if(target && typeof target==="object"){
    return target;
  }

  const value=String(target||"").trim();

  if(!value)return null;

  return (
    exerciseById(value)
    ||exerciseDescriptor(value,null)
  );
}

function sessionContainsReplacementIdentity(
  entryOrName,
  exceptBaseName
){
  const wanted=
    exerciseIdentityKey(entryOrName);

  const except=exceptBaseName==null
    ? null
    : normalizeExerciseName(
        displayExerciseName(exceptBaseName)
      );

  return sessionList().some(entry=>{
    const activeBase=
      normalizeExerciseName(
        displayExerciseName(
          entry.__orig||entry.name
        )
      );

    if(
      except!==null
      && activeBase===except
    ){
      return false;
    }

    return exerciseIdentityKey(entry)
      ===wanted;
  });
}

function sessionReplacementOptions(
  base,
  currentShown,
  query
){
  const currentEntry=
    exerciseDescriptor(currentShown,null);

  const source=String(query||"").trim()
    ? searchExercises(query,1000)
    : allExerciseEntries(false)
        .slice()
        .sort(
          (a,b)=>
            shapeGroupLabel(a.shape)
              .localeCompare(
                shapeGroupLabel(b.shape)
              )
            ||a.name.localeCompare(b.name)
        );

  return source.filter(entry=>
    entry
    && !entry.legacy
    && entry.shape!=="unknown"
    && exerciseIdentityKey(entry)
      !==exerciseIdentityKey(currentEntry)
  );
}

function populateSessionReplacementSelect(
  select,
  base,
  currentShown,
  query
){
  const options=sessionReplacementOptions(
    base,
    currentShown,
    query
  );

  const originalEntry=
    exerciseDescriptor(base,null);

  select.innerHTML="";

  const grouped={};

  options.forEach(entry=>{
    const shape=entry.shape||"text";

    if(!grouped[shape]){
      grouped[shape]=[];
    }

    grouped[shape].push(entry);
  });

  EXERCISE_SHAPES.forEach(shape=>{
    const entries=(grouped[shape]||[])
      .slice()
      .sort(
        (a,b)=>a.name.localeCompare(b.name)
      );

    if(!entries.length)return;

    const group=document.createElement(
      "optgroup"
    );

    group.label=shapeGroupLabel(shape);

    entries.forEach(entry=>{
      const option=document.createElement(
        "option"
      );

      const alreadyInSession=
        sessionContainsReplacementIdentity(
          entry,
          base
        );

      option.value=entry.id;
      option.disabled=alreadyInSession;
      option.dataset.blocked=
        alreadyInSession
          ? "true"
          : "false";

      option.textContent=
        entry.name
        +(
          alreadyInSession
            ? " — already in this session"
            : exerciseIdentityKey(entry)
                ===exerciseIdentityKey(
                  originalEntry
                )
              ? " (original)"
              : ""
        );

      group.appendChild(option);
    });

    select.appendChild(group);
  });

  if(!options.length){
    const empty=document.createElement(
      "option"
    );

    empty.value="";
    empty.textContent=
      "No matching exercises";

    select.appendChild(empty);
  }else{
    const choose=document.createElement(
      "option"
    );

    choose.value="";
    choose.textContent=
      "Choose a replacement";
    choose.selected=true;

    select.insertBefore(
      choose,
      select.firstChild
    );
  }

  select.value="";
  return options;
}

function offerSessionReplacement(
  base,
  currentShown,
  container
){
  const menu=document.createElement("div");
  menu.className="session-replace-menu";

  const title=document.createElement("div");
  title.className="session-replace-title";
  title.textContent=
    "Replace "
    +displayExerciseName(currentShown)
    +" for this session";

  const note=document.createElement("div");
  note.className="session-replace-note";
  note.textContent=
    "This changes only the open workout. Your saved program stays unchanged.";

  const search=document.createElement("input");
  search.type="search";
  search.className="sessionReplacementSearch";
  search.placeholder=
    "Search name, alias, former name, tag, muscle, or equipment";
  search.setAttribute(
    "aria-label",
    "Search replacements for "
    +displayExerciseName(currentShown)
  );

  const select=document.createElement("select");
  select.className="sessionReplacementSelect";
  select.setAttribute(
    "aria-label",
    "Replacement for "
    +displayExerciseName(currentShown)
  );

  const actions=document.createElement("div");
  actions.className=
    "session-replace-actions";

  const use=document.createElement("button");
  use.type="button";
  use.className=
    "xbtn sessionReplacementUseButton";
  use.textContent="Use replacement";
  use.disabled=true;

  const cancel=document.createElement("button");
  cancel.type="button";
  cancel.className="xbtn";
  cancel.textContent="Cancel";

  const refresh=()=>{
    populateSessionReplacementSelect(
      select,
      base,
      currentShown,
      search.value
    );

    use.disabled=true;
  };

  search.addEventListener("input",refresh);

  select.addEventListener("change",()=>{
    const selected=select.selectedOptions[0];

    use.disabled=
      !select.value
      ||!!(
        selected
        && selected.disabled
      );
  });

  use.addEventListener("click",()=>{
    if(!select.value)return;

    const applied=applySessionReplacement(
      base,
      currentShown,
      select.value
    );

    if(applied){
      menu.remove();
    }
  });

  cancel.addEventListener(
    "click",
    ()=>menu.remove()
  );

  actions.appendChild(use);
  actions.appendChild(cancel);

  menu.appendChild(title);
  menu.appendChild(note);
  menu.appendChild(search);
  menu.appendChild(select);
  menu.appendChild(actions);

  container.appendChild(menu);
  refresh();

  return menu;
}

function applySessionReplacement(
  base,
  currentShown,
  target
){
  const currentEntry=
    exerciseDescriptor(currentShown,null);

  const targetEntry=
    sessionReplacementEntry(target);

  if(
    !targetEntry
    || targetEntry.legacy
    || targetEntry.shape==="unknown"
  ){
    showWorkoutError(
      "Choose a BlackPyre exercise.",
      null
    );

    return false;
  }

  if(
    exerciseIdentityKey(currentEntry)
    ===exerciseIdentityKey(targetEntry)
  ){
    return true;
  }

  if(
    sessionContainsReplacementIdentity(
      targetEntry,
      base
    )
  ){
    showWorkoutError(
      targetEntry.name
      +" is already in this session.",
      null
    );

    return false;
  }

  if(typeof syncVisibleSessionInputs==="function"){
    syncVisibleSessionInputs(currentShown);
  }

  const currentKey=Object.keys(
    sessionState||{}
  ).find(key=>
    exerciseIdentityKey(key)
      ===exerciseIdentityKey(currentEntry)
    ||normalizeExerciseName(key)
      ===normalizeExerciseName(currentShown)
  );

  const currentState=currentKey
    ? sessionState[currentKey]
    : null;

  if(
    currentState
    && hasUnsavedEntry(currentState)
    && !confirm(
      "Discard the entered result for "
      +displayExerciseName(currentEntry.name)
      +" and replace it with "
      +displayExerciseName(targetEntry.name)
      +"?"
    )
  ){
    return false;
  }

  const runtime=openSessionRuntimeSnapshot();

  if(currentKey){
    delete sessionState[currentKey];
  }

  if(
    exerciseIdentityKey(targetEntry)
    ===exerciseIdentityKey(base)
  ){
    delete sessionSwaps[base];
  }else{
    sessionSwaps[base]=targetEntry.name;
  }

  initSessionStateFor(targetEntry.name);

  if(workoutDraftLoaded){
    data.activeWorkoutDraft=
      buildWorkoutDraft();

    if(!save()){
      restoreOpenSessionRuntime(runtime);
      renderSessionInputs();
      renderWorkoutDraftCard();

      showWorkoutError(
        "The replacement could not be saved. Your completed result was kept.",
        null
      );

      return false;
    }
  }

  clearWorkoutError();
  renderSessionInputs();
  renderWorkoutDraftCard();

  return true;
}

function initSessionStateFor(exName){
  const entry=exerciseDescriptor(exName,null);
  const hit=latestExerciseHistoryHit(entry);
  sessionState[entry.name]=newStateForExercise(entry,hit);
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
function usualItemAlreadyAdded(item, meal){
  return (data.food[todayStr()]||[]).some(todayEntry=>
    (todayEntry.meal||"other")===meal
    && recurringFoodCategoryMatch(item,todayEntry)
  );
}
function addUsualItem(item, meal){
  if (!item || usualItemAlreadyAdded(item,meal)) return false;
  const copy = cloneJSON(item);
  copy.meal = meal;
  addEntry(copy);
  return true;
}
function renderUsual(){
  const card = document.getElementById("usualCard");
  if (foodDateEl.value !== todayStr()){ card.classList.add("hidden"); return; }

  const meal = currentMeal;
  const items = usualFor(meal);
  if (!items){ card.classList.add("hidden"); return; }

  card.classList.remove("hidden");
  document.getElementById("usualMealName").textContent = meal;

  const itemBox = document.getElementById("usualItems");
  itemBox.innerHTML = items.map((item,index)=>{
    const added = usualItemAlreadyAdded(item,meal);
    return '<div class="usualItemRow" style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="color:var(--text);font-weight:600;">'+esc(item.name)+'</div>'
      +'<div style="color:var(--dim);font-size:11px;margin-top:2px;">'
      +Math.round(Number(item.cal)||0)+' kcal · '
      +Math.round(Number(item.pro)||0)+'g protein'
      +(Number(item.grams)>0 ? ' · '+Math.round(Number(item.grams))+'g' : '')
      +'</div></div>'
      +'<button type="button" class="btn ghost small usualAddBtn" data-index="'+index+'"'
      +' aria-label="'+(added ? 'Already added ' : 'Add ')+esc(item.name)+'"'
      +(added ? ' disabled' : '')+' style="flex:0 0 auto;">'
      +(added ? 'Added' : 'Add')+'</button>'
      +'</div>';
  }).join("");

  const total = Math.round(items.reduce((sum,item)=>sum+Number(item.cal||0),0));
  const protein = Math.round(items.reduce((sum,item)=>sum+Number(item.pro||0),0));
  const remainingCount = items.filter(item=>!usualItemAlreadyAdded(item,meal)).length;

  itemBox.insertAdjacentHTML(
    "beforeend",
    '<div style="color:var(--dim);font-size:11px;margin-top:8px;">'
      +total+' kcal · '+protein+'g protein · your typical portions'
      +(remainingCount ? ' · '+remainingCount+' remaining' : ' · all added')
      +'</div>'
  );

  itemBox.querySelectorAll(".usualAddBtn").forEach(button=>{
    button.addEventListener("click",()=>{
      const item = items[Number(button.dataset.index)];
      if (addUsualItem(item,meal)){
        flashSave(item.name+" added ✓");
      }
      renderUsual();
    });
  });

  const addAll = document.getElementById("usualLogBtn");
  addAll.disabled = remainingCount===0;
  addAll.textContent = remainingCount
    ? "Add all ("+remainingCount+" item"+(remainingCount===1?"":"s")+")"
    : "All added";

  addAll.onclick = ()=>{
    let added = 0;
    items.forEach(item=>{
      if (addUsualItem(item,meal)) added++;
    });
    if (added) flashSave(added+" usual "+meal+" item"+(added===1?"":"s")+" added ✓");
    renderUsual();
  };
}

// ================== CALORIE SCHEDULE UI ==================
function schedBaseTarget(){
  const input=document.getElementById("sCalTarget");
  return finiteNutritionNumber(input ? input.value : cfg.calTarget);
}
function schedBudget(){
  const base=schedBaseTarget();
  return base===null ? 0 : base*7;
}
function schedReadInputs(){ return [0,1,2,3,4,5,6].map(i=>Number(document.getElementById("sSched"+i).value)); }
function schedTargetsOk(){ return validateDailyCalories(schedBaseTarget()).ok; }
function schedPresetDays(mode){ return caloriePresetDaysFor(schedBaseTarget(),mode); }
function schedNote(){
  const mode = document.getElementById("sCalSched").value;
  const note = document.getElementById("schedTotalNote");
  const base = schedBaseTarget();
  const baseCheck=validateDailyCalories(base,"Daily calorie target","calTarget");
  if(!baseCheck.ok){ note.style.color="var(--warn)"; note.textContent=baseCheck.message; return; }
  const budget = schedBudget();
  if (mode==="same"){ note.style.color=""; note.textContent = "Weekly budget: "+budget+" kcal ("+base+" every day)."; return; }
  if (mode!=="custom"){
    const d = schedPresetDays(mode);
    const checked=validateCalorieSchedule(base,mode,null);
    const hi = Math.max.apply(null,d), lo = Math.min.apply(null,d);
    note.style.color=checked.ok?"":"var(--warn)";
    note.textContent = checked.ok ? "Higher days "+hi+" kcal · lower days "+lo+" kcal · weekly total unchanged at "+budget+" kcal." : checked.message;
    return;
  }
  const days=schedReadInputs();
  const total = days.reduce((a,x)=>a+(Number.isFinite(x)?x:0),0);
  const diff = budget - total;
  const checked=validateCalorieSchedule(base,"custom",days);
  if(!checked.ok){
    note.style.color="var(--warn)";
    note.textContent=checked.message;
  } else if (diff > 0){
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
function refreshSchedDraft(){
  const ok=schedTargetsOk();
  const select=document.getElementById("sCalSched");
  select.disabled=!ok;
  document.getElementById("schedDisabledNote").classList.toggle("hidden",ok);
  document.getElementById("schedCustom").classList.toggle("hidden",!ok||select.value!=="custom");
  if(ok) schedNote();
  else {
    const note=document.getElementById("schedTotalNote");
    note.style.color="var(--warn)";
    note.textContent=validateDailyCalories(schedBaseTarget(),"Daily calorie target","calTarget").message;
  }
}
function renderSched(){
  const mode = cfg.calSchedMode || "same";
  document.getElementById("sCalSched").value = mode;
  if (mode==="custom"){
    const days = (Array.isArray(cfg.calSchedDays) && cfg.calSchedDays.length===7) ? cfg.calSchedDays : [0,1,2,3,4,5,6].map(()=>cfg.calTarget);
    [0,1,2,3,4,5,6].forEach(i=>{ document.getElementById("sSched"+i).value = days[i]; });
  }
  refreshSchedDraft();
}
document.getElementById("sCalTarget").addEventListener("input",refreshSchedDraft);
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
  // Balance against the calorie target currently displayed in Settings.
  const days = schedReadInputs();
  if(days.some(value=>!Number.isFinite(value))) { schedNote(); return; }
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
// BlackPyre never contacts an AI service. Users deliberately copy or share a
// prompt, then paste the reply back for local review.
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
    if (navigator.clipboard && navigator.clipboard.readText){
      text = await navigator.clipboard.readText();
    }
  } catch(e){
    // Clipboard permission denied; use manual paste fallback.
  }

  if (!text){
    text = prompt("Paste the AI's reply or JSON training plan here:") || "";
  }
  if (!text.trim()) return;

  const documentValue = extractTrainingPlanDocumentFromText(text);
  if (!documentValue){
    flashSave("No BlackPyre training plan was found. Use Create a plan with AI to make a new file.",true);
    return;
  }

  const opened = openTrainingPlanReview(documentValue,{
    source:"AI paste",
    successMessage:"Program loaded ✓",
    onImported:()=>ackBtn("pasteProgBtn","✓ Loaded: "+(program.name||"program"))
  });
  if (!opened.ok){
    console.error("Pasted training plan rejected:",opened.code||"",opened.message||"");
    flashSave(blackpyreTrainingPlanRejectionMessage(),true);
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
  const container=document.getElementById("aiFoodConfirm");
  container.classList.remove("hidden");
  container.innerHTML="";

  if(!foods.length){
    container.innerHTML=
      '<div class="note">The AI could not identify any food there. Try describing it, or use manual entry.</div>';
    return;
  }

  const items=foods.slice().map(food=>({
    name:String(food.name==null?"":food.name),
    cal:food.cal,
    pro:food.pro,
    carb:food.carb,
    fat:food.fat
  }));

  const list=document.createElement("div");
  const error=document.createElement("div");
  const add=document.createElement("button");

  error.className="err hidden ai-food-review-error";
  error.setAttribute("role","alert");
  error.setAttribute("aria-live","assertive");

  add.className="btn ghost small mt10 ai-confirm-log";
  add.style.width="100%";

  function clearError(){
    error.textContent="";
    error.classList.add("hidden");
  }

  function makeField(label,key,item,index){
    const wrapper=document.createElement("div");
    const heading=document.createElement("div");
    const input=document.createElement("input");

    wrapper.style.flex="1";
    heading.className="label";
    heading.textContent=label;

    input.className="ai-food-"+key;
    input.setAttribute(
      "aria-label",
      "AI reviewed "+label.toLowerCase()+
      " for item "+(index+1)
    );

    if(key==="name"){
      input.type="text";
    } else {
      input.type="number";
      input.step="any";
      input.inputMode="decimal";
    }

    input.value=item[key];

    input.addEventListener("input",()=>{
      item[key]=input.value;
      input.removeAttribute("aria-invalid");
      clearError();
    });

    wrapper.appendChild(heading);
    wrapper.appendChild(input);

    return wrapper;
  }

  function redraw(){
    list.innerHTML="";
    clearError();

    items.forEach((item,index)=>{
      const row=document.createElement("div");
      row.className="list-item ai-food-review-item";
      row.style.display="block";

      row.appendChild(
        makeField("Food name","name",item,index)
      );

      const first=document.createElement("div");
      first.className="row";
      first.style.marginTop="10px";
      first.appendChild(
        makeField("Calories","cal",item,index)
      );
      first.appendChild(
        makeField("Protein g","pro",item,index)
      );
      row.appendChild(first);

      const second=document.createElement("div");
      second.className="row";
      second.style.marginTop="10px";
      second.appendChild(
        makeField("Carbs g","carb",item,index)
      );
      second.appendChild(
        makeField("Fat g","fat",item,index)
      );
      row.appendChild(second);

      const remove=document.createElement("button");
      remove.className="btn ghost small ai-food-remove";
      remove.textContent="Remove item";
      remove.setAttribute("aria-label","Remove this estimated food");
      remove.style.marginTop="10px";
      remove.style.width="100%";
      remove.style.color="var(--warn)";

      remove.addEventListener("click",()=>{
        items.splice(index,1);
        redraw();
      });

      row.appendChild(remove);
      list.appendChild(row);
    });

    add.textContent=
      "Add to log — "+
      items.length+
      " item"+
      (items.length===1?"":"s");

    add.disabled=items.length===0;
  }

  add.addEventListener("click",()=>{
    clearError();

    const reviewed=[];

    for(let index=0;index<items.length;index++){
      const checked=validateFoodNutritionDraft(items[index]);

      if(!checked.ok){
        error.textContent=
          "Item "+(index+1)+": "+checked.message;
        error.classList.remove("hidden");

        const target=list.children[index].querySelector(
          ".ai-food-"+checked.field
        );

        if(target){
          target.setAttribute("aria-invalid","true");
          target.focus();
        }

        return;
      }

      reviewed.push(Object.assign({},checked.value,{
        source:"AI-reviewed estimate"
      }));
    }

    reviewed.forEach(food=>{
      addEntry(
        Object.assign({},food),
        {allowDuplicate:true}
      );
    });

    document.getElementById("aiPhotoCaption").value="";

    const loggedCount=reviewed.length;
    container.classList.add("hidden");

    hfCloseParseBox();
    aiFoodStatus(
      "Logged "+loggedCount+" ✓ — ready for another."
    );
    scrollAiFoodIntoView(
      document.getElementById("aiFoodCard"),
      "start"
    );

    flashSave("Logged "+loggedCount+" ✓");
  });

  redraw();
  container.appendChild(list);

  const note=document.createElement("div");
  note.className="note";
  note.textContent=
    "Review and edit every estimate. Nothing is logged until Add to log.";

  container.appendChild(note);
  container.appendChild(error);
  container.appendChild(add);

  scrollAiFoodIntoView(
    list.firstElementChild||container,
    "center"
  );
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


// ================== EXERCISE SHAPE DERIVATIONS / PR ENGINE ==================
const EXERCISE_DISTANCE_METERS = {mi:1609.344,km:1000,m:1,ft:0.3048};
function distanceToMeters(distance,unit){
  const factor=EXERCISE_DISTANCE_METERS[unit];
  return factor ? Number(distance)*factor : null;
}
function distanceBucket(distance,unit){
  const n=Number(distance);
  if(!(n>0)||!EXERCISE_DISTANCE_UNITS.includes(unit)) return null;
  return String(Math.round(n*1000000)/1000000)+" "+unit;
}
function bestEpleyRows(value){
  let best=null;
  const consider=(w,r)=>{
    w=Number(w);r=Number(r);
    if(!(w>0)||!(r>0)||r>30)return;
    const e1rm=w*(1+r/30);
    if(!best||e1rm>best.e1rm)best={kind:"e1rm",w:w,r:r,e1rm:e1rm};
  };
  if(Array.isArray(value)) value.forEach(row=>consider(row&&row.w,row&&row.r));
  else {
    const re=/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)/g;let match;
    while((match=re.exec(String(value||"")))!==null)consider(match[1],match[2]);
  }
  return best;
}
function deriveLiftValue(value){ return bestEpleyRows(value); }
function deriveRepsValue(value){
  if(!Array.isArray(value))return null;
  const hasWeighted=value.some(row=>Number(row&&row.w)>0);
  if(hasWeighted)return bestEpleyRows(value);
  let maxReps=0;
  value.forEach(row=>{const reps=Number(row&&row.r);if(reps>maxReps)maxReps=reps;});
  return maxReps>0?{kind:"maxReps",reps:maxReps}:null;
}
function deriveTimeDistValue(value){
  if(!isPlainObject(value)||value.t!=="timeDist"||!(Number(value.secs)>0))return null;
  const result={kind:"timeDist",secs:Number(value.secs)};
  if(Number(value.dist)>0&&EXERCISE_DISTANCE_UNITS.includes(value.distUnit)){
    result.dist=Number(value.dist);result.distUnit=value.distUnit;
    result.bucket=distanceBucket(result.dist,result.distUnit);
    result.meters=distanceToMeters(result.dist,result.distUnit);
    result.pace=result.secs/result.dist;
  }
  return result;
}
function deriveCarryValue(value){
  if(!isPlainObject(value)||value.t!=="carry"||!(Number(value.lbs)>0)||!(Number(value.dist)>0)||!EXERCISE_DISTANCE_UNITS.includes(value.distUnit))return null;
  return {kind:"carry",lbs:Number(value.lbs),dist:Number(value.dist),distUnit:value.distUnit,meters:distanceToMeters(value.dist,value.distUnit)};
}
function deriveRoundsValue(){ return null; }
function deriveTextValue(){ return null; }
const SHAPE_DERIVERS={lift:deriveLiftValue,reps:deriveRepsValue,timeDist:deriveTimeDistValue,carry:deriveCarryValue,rounds:deriveRoundsValue,text:deriveTextValue};
function deriveExerciseValue(entryOrName,value){
  const entry=typeof entryOrName==="string"?exerciseDescriptor(entryOrName,value):entryOrName;
  if(!entry)return null;
  const shape=Array.isArray(value)&&entry.shape!=="reps"?"lift":typeof value==="string"&&entry.legacy?"lift":entry.shape;
  return (SHAPE_DERIVERS[shape]||(()=>null))(value);
}
// Backward-compatible public helper retained for existing charts and tests.
function parseBestSet(value){ return bestEpleyRows(value); }
function exerciseHistoryRecords(entryOrName,excludeIdx){
  const entry=typeof entryOrName==="string"?exerciseDescriptor(entryOrName,null):entryOrName;
  const records=[];
  data.workouts.forEach((session,index)=>{
    if(index===excludeIdx)return;
    const hit=findHistoryValue(session.sets,entry);
    if(hit)records.push({date:session.date,value:hit.value,key:hit.key,index:index});
  });
  return records;
}
function aggregateExerciseMetrics(entry,records){
  const out={e1rm:null,maxReps:0,longestDistance:null,longestSecs:0,paces:{},carryHeaviest:0,carryAtWeight:{},latestDate:null};
  records.forEach(record=>{
    const metric=deriveExerciseValue(entry,record.value);
    if(!metric)return;
    if(!out.latestDate||record.date>out.latestDate)out.latestDate=record.date;
    if(metric.kind==="e1rm"&&(!out.e1rm||metric.e1rm>out.e1rm.e1rm))out.e1rm=Object.assign({date:record.date},metric);
    if(metric.kind==="maxReps")out.maxReps=Math.max(out.maxReps,metric.reps);
    if(metric.kind==="timeDist"){
      if(metric.meters!=null&&(!out.longestDistance||metric.meters>out.longestDistance.meters))out.longestDistance=Object.assign({date:record.date},metric);
      if(metric.meters==null)out.longestSecs=Math.max(out.longestSecs,metric.secs);
      if(metric.bucket&&(!out.paces[metric.bucket]||metric.pace<out.paces[metric.bucket].pace))out.paces[metric.bucket]=Object.assign({date:record.date},metric);
    }
    if(metric.kind==="carry"){
      out.carryHeaviest=Math.max(out.carryHeaviest,metric.lbs);
      const key=String(metric.lbs);
      if(!out.carryAtWeight[key]||metric.meters>out.carryAtWeight[key].meters)out.carryAtWeight[key]=Object.assign({date:record.date},metric);
    }
  });
  return out;
}
function bestHistorical(exName,excludeIdx){
  const entry=exerciseDescriptor(exName,null),agg=aggregateExerciseMetrics(entry,exerciseHistoryRecords(entry,excludeIdx));
  return agg.e1rm;
}
function exercisePrLine(name,value,excludeIdx){
  const entry=exerciseDescriptor(name,value),metric=deriveExerciseValue(entry,value);
  if(!metric)return null;
  const prior=aggregateExerciseMetrics(entry,exerciseHistoryRecords(entry,excludeIdx));
  if(metric.kind==="e1rm"&&(!prior.e1rm||metric.e1rm>prior.e1rm.e1rm))return entry.name+" ~"+poundsToUnit(metric.e1rm,currentUnitSystem(),1)+" "+unitWeightLabel()+" est. 1RM";
  if(metric.kind==="maxReps"&&metric.reps>prior.maxReps)return entry.name+" "+metric.reps+" reps";
  if(metric.kind==="timeDist"){
    const lines=[];
    if(metric.meters!=null){
      if(!prior.longestDistance||metric.meters>prior.longestDistance.meters)lines.push("longest "+metric.dist+" "+metric.distUnit);
      const old=prior.paces[metric.bucket];if(!old||metric.pace<old.pace)lines.push("best pace for "+metric.bucket);
    }else if(metric.secs>prior.longestSecs)lines.push("longest time "+formatDuration(metric.secs));
    return lines.length?entry.name+" · "+lines.join(" · "):null;
  }
  if(metric.kind==="carry"){
    const priorAtWeight=prior.carryAtWeight[String(metric.lbs)];
    if(metric.lbs>prior.carryHeaviest)return entry.name+" · heaviest "+formatBodyWeight(metric.lbs,currentUnitSystem(),1);
    if(metric.lbs===prior.carryHeaviest&&(!priorAtWeight||metric.meters>priorAtWeight.meters))return entry.name+" · longest at "+formatBodyWeight(metric.lbs,currentUnitSystem(),1)+": "+metric.dist+" "+metric.distUnit;
  }
  return null;
}
function allPRs(){
  const groups={};
  data.workouts.forEach((session,index)=>Object.keys(session.sets||{}).forEach(key=>{
    const entry=exerciseDescriptor(key,session.sets[key]);
    const groupKey=entry.id&&entry.id.indexOf("legacy:")!==0?entry.id:"legacy:"+normalizeExerciseName(key);
    if(!groups[groupKey])groups[groupKey]={entry:entry,records:[]};
    groups[groupKey].records.push({date:session.date,value:session.sets[key],key:key,index:index});
  }));
  const map={};
  Object.keys(groups).forEach(groupKey=>{
    const group=groups[groupKey],agg=aggregateExerciseMetrics(group.entry,group.records),item={name:group.entry.name,date:agg.latestDate,chart:false};
    if(agg.e1rm){item.kind="e1rm";item.display=poundsToUnit(agg.e1rm.w,currentUnitSystem(),1)+"×"+agg.e1rm.r;item.value="~"+formatBodyWeight(agg.e1rm.e1rm,currentUnitSystem(),1);item.chart=true;}
    else if(agg.maxReps>0){item.kind="maxReps";item.display="Best set";item.value=agg.maxReps+" reps";}
    else if(agg.longestDistance){item.kind="timeDist";item.display="Longest";item.value=agg.longestDistance.dist+" "+agg.longestDistance.distUnit;}
    else if(agg.longestSecs>0){item.kind="timeDist";item.display="Longest";item.value=formatDuration(agg.longestSecs);}
    else if(agg.carryHeaviest>0){const best=agg.carryAtWeight[String(agg.carryHeaviest)];item.kind="carry";item.display="Heaviest";item.value=formatBodyWeight(agg.carryHeaviest,currentUnitSystem(),1)+(best?" · "+best.dist+" "+best.distUnit:"");}
    else return;
    map[groupKey]=item;
  });
  return map;
}
function renderPRs(){
  const map=allPRs(),items=Object.keys(map).map(key=>map[key]).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||a.name.localeCompare(b.name));
  const card=document.getElementById("prCard"),list=document.getElementById("prList");
  if(!items.length){card.classList.add("hidden");list.innerHTML="";return;}
  card.classList.remove("hidden");list.innerHTML="";
  items.slice(0,10).forEach(item=>{
    const row=document.createElement("div");row.className="list-item";if(item.chart){row.style.cursor="pointer";row.addEventListener("click",()=>openLiftChart(item.name));}
    const name=document.createElement("span");name.style.flex="2";name.textContent=item.name;row.appendChild(name);
    const detail=document.createElement("span");detail.style.cssText="flex:1.4;text-align:right;color:var(--dim);";detail.textContent=item.display;row.appendChild(detail);
    const value=document.createElement("span");value.style.cssText="flex:1.2;text-align:right;font-weight:600;color:var(--ember);";value.textContent=item.value;row.appendChild(value);list.appendChild(row);
  });
}
function liftGoalMatch(entryOrName){
  const entry=typeof entryOrName==="string"?exerciseDescriptor(entryOrName,null):entryOrName,goals=cfg.liftGoals||{};
  const current=normalizeExerciseName(entry.name),former=new Set(entry.formerNames||[]);
  const exact=Object.keys(goals).find(key=>normalizeExerciseName(key)===current);
  if(exact)return{key:exact,value:goals[exact]};
  const old=Object.keys(goals).filter(key=>former.has(normalizeExerciseName(key)));
  return old.length===1?{key:old[0],value:goals[old[0]]}:null;
}
function setLiftGoalForExercise(entryOrName,value){
  const entry=typeof entryOrName==="string"?exerciseDescriptor(entryOrName,null):entryOrName;
  if(!isPlainObject(cfg.liftGoals)){
    cfg.liftGoals=newExerciseNameMap();
  }
  const names=new Set([normalizeExerciseName(entry.name)].concat(entry.formerNames||[]));
  Object.keys(cfg.liftGoals).forEach(key=>{if(names.has(normalizeExerciseName(key)))delete cfg.liftGoals[key];});
  if(Number(value)>0){
    setExerciseNameValue(
      cfg.liftGoals,
      entry.name,
      Number(value)
    );
  }
}

// ================== AI COACH REPORT ==================
function aiReport(){
  const today = todayStr();
  const sorted = data.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  const cur = sorted.length ? sorted[sorted.length-1].lbs : cfg.startWt;
  const sl = weightSlope(28);
  const rate = sl ? Math.round(sl.slope*7*10)/10 : null;
  const tdee = (typeof computeTDEE==="function") ? computeTDEE() : null;

  // nutrition adherence: last 14 days
  const days = [];
  for(let i=13;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    days.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"));
  }
  const logged = days.filter(d=>(data.food[d]||[]).length>0);
  const fullDays = logged.map(d=>daySums(d)).filter(x=>x.cal>500);
  const avgCal = fullDays.length ? Math.round(fullDays.reduce((a,x)=>a+x.cal,0)/fullDays.length) : null;
  const avgPro = fullDays.length ? Math.round(fullDays.reduce((a,x)=>a+x.pro,0)/fullDays.length) : null;
  const proHit = logged.filter(d=>daySums(d).pro>=dayTargets(d).pro).length;

  // training: last 28 days
  const cut28 = new Date(Date.now()-28*86400000);
  const cutStr = cut28.getFullYear()+"-"+String(cut28.getMonth()+1).padStart(2,"0")+"-"+String(cut28.getDate()).padStart(2,"0");
  const recent = data.workouts.filter(w=>w.date>=cutStr);
  const strengthS = recent.filter(w=>w.day!=="CARDIO").length;
  const cardioS = recent.filter(w=>w.day==="CARDIO").length;

  // per-lift progression: every program exercise with history
  const liftLines = [];
  program.days.forEach(d=>d.exercises.forEach(ex=>{
    const entry=exerciseDescriptor(ex.name,null);
    if(!["lift","reps"].includes(entry.shape))return;
    const name=entry.name,hist=liftHistory(name);
    if (!hist.length) return;
    const last3 = hist.slice(-3).map(p=>fmtDate(p.date)+": ~"+Math.round(p.y));
    const goalMatch=liftGoalMatch(entry),goal=goalMatch?goalMatch.value:null;
    liftLines.push("- **"+name+"** ("+(ex.scheme||"no scheme")+"): est-1RM trend "+last3.join(" → ")
      +(goal ? " · goal "+goal : ""));
  }));

  const L = [];
  L.push("# BlackPyre Progress Report — "+fmtDate(today));
  L.push("");
  L.push("You are my fitness coach. Below is my real logged data from the BlackPyre app. Please:");
  L.push("1. Assess my rate of progress toward my goal — too fast, too slow, or on track.");
  L.push("2. Flag anything in my nutrition adherence that needs fixing.");
  L.push("3. Review my lift progression and suggest specific training adjustments.");
  L.push("4. If my program should change, return the COMPLETE BlackPyre public training-plan JSON shown at the bottom. Keep exercise names I am progressing on unchanged so my history stays connected. I will review it before importing.");
  L.push("5. Be direct — no generic advice.");
  L.push("");
  L.push("## Goal & weight");
  L.push("- Start: "+formatBodyWeight(cfg.startWt,currentUnitSystem(),1)+" · Current: "+formatBodyWeight(cur,currentUnitSystem(),1)+" · Goal: "+formatBodyWeight(cfg.goalWt,currentUnitSystem(),1));
  L.push(rate!=null ? "- Trend (last 28 days): "+(rate>0?"+":"")+poundsToUnit(rate,currentUnitSystem(),2)+" "+unitWeightLabel()+"/week" : "- Trend: not enough weigh-ins yet ("+sorted.length+" recorded)");
  if (tdee && tdee.tdee) L.push("- Estimated TDEE from my food and weight logs: ~"+tdee.tdee+" kcal/day (a trend estimate, not a measurement or prescription)");
  L.push("");
  L.push("## Nutrition (last 14 days)");
  L.push("- Daily targets (exact): "+cfg.calTarget+" kcal"+(cfg.calSchedMode!=="same"?" (scheduled by day; weekly total "+weeklyCalTotal()+")":"")+" · protein "+cfg.proTarget+"g · carbs "+cfg.carbGoal+"g · fat "+cfg.fatGoal+"g");
  L.push(logged.length ? "- Logged "+logged.length+" of 14 days · avg "+ (avgCal!=null ? avgCal+" kcal, "+avgPro+"g protein" : "insufficient full days") + " · protein target hit "+proHit+"/"+logged.length+" days" : "- No food logged in the last 14 days");
  L.push("");
  L.push("## Training (last 28 days)");
  L.push("- "+strengthS+" strength sessions, "+cardioS+" cardio sessions · program: \""+(program.name||"unnamed")+"\" ("+program.days.length+" days/rotation)");
  if (liftLines.length){ L.push("- Lift progression (best estimated 1RM per session):"); liftLines.forEach(x=>L.push("  "+x)); }
  else L.push("- No strength sessions logged against the current program yet.");
  L.push("");
  L.push("## My current program (edit this and return the full updated JSON)");
  L.push("```json");
  const handoffPlan=trainingPlanInterchangeFromProgram(program);
  handoffPlan.program.days.forEach(day=>day.exercises.forEach(exercise=>{
    delete exercise.exerciseId;
    delete exercise.trackingShape;
  }));
  L.push(JSON.stringify(handoffPlan,null,2));
  L.push("```");
  L.push("");
  L.push("Program format rules: top level {format:\"blackpyre-training-plan\", version:1, program:{name, days:[...]}}. Each exercise uses its name and structured prescription. Do not invent exercise IDs or choose tracking types. BlackPyre verifies every exercise and chooses its tracking type during review.");
  return L.join("\n");
}
document.getElementById("aiDownloadBtn").addEventListener("click", ()=>{
  download("blackpyre-report-"+todayStr()+".md", aiReport());
  ackBtn("aiDownloadBtn", "✓ Downloaded");
});
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
  const entry=exerciseDescriptor(exName,null),byDate={};
  exerciseHistoryRecords(entry,-1).forEach(record=>{
    const metric=deriveExerciseValue(entry,record.value);
    if(metric&&metric.kind==="e1rm"&&(!byDate[record.date]||metric.e1rm>byDate[record.date]))byDate[record.date]=metric.e1rm;
  });
  return Object.keys(byDate).sort().map(date=>({date:date,y:byDate[date]}));
}
function openLiftChart(exName){
  liftOverlayEx = exName;
  document.getElementById("liftTitle").textContent = exName;
  const goalMatch=liftGoalMatch(exName);
  const goal=goalMatch?Number(goalMatch.value):null;
  const pts = liftHistory(exName);
  const displayPts=pts.map(point=>({date:point.date,y:poundsToUnit(point.y,currentUnitSystem(),2)}));
  const displayGoal=goal?poundsToUnit(goal,currentUnitSystem(),2):null;
  document.getElementById("liftChart").innerHTML = lineChartSVG(displayPts, displayGoal);
  document.getElementById("liftGoalInput").value = displayGoal || "";
  const unit=unitWeightLabel(), metric=isMetricSystem();
  const label=document.getElementById("liftGoalLabel");if(label)label.textContent="Goal for this lift ("+unit+", est. 1RM)";
  document.getElementById("liftGoalInput").setAttribute("aria-label","Estimated one rep max goal in "+(metric?"kilograms":"pounds"));
  document.getElementById("liftGoalInput").placeholder=metric?"e.g. 140":"e.g. 315";
  const best = pts.length ? Math.round(Math.max.apply(null, pts.map(p=>p.y))) : 0;
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
  setLiftGoalForExercise(liftOverlayEx,v);
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
  const metric=isMetricSystem(), unit=unitMeasurementLabel();
  const label=document.getElementById("bodyMeasurementsLabel"); if(label) label.textContent="Body measurements ("+(metric?"centimeters":"inches")+")";
  [["mWaist","Waist"],["mChest","Chest"],["mArm","Arm"]].forEach(item=>{const el=document.getElementById(item[0]);if(!el)return;el.placeholder=unit;el.setAttribute("aria-label",item[1]+" measurement in "+(metric?"centimeters":"inches"));});
  document.getElementById("measureToggleBtn").textContent = cfg.measureOn ? "Disable body measurements" : "Enable body measurements";
  document.getElementById("measureCard").classList.toggle("hidden", !cfg.measureOn);
}
document.getElementById("measureToggleBtn").addEventListener("click", ()=>{
  cfg.measureOn = !cfg.measureOn;
  saveCfg();
  renderMeasureToggle();
  ackBtn("measureToggleBtn", cfg.measureOn ? "✓ Enabled" : "✓ Disabled");
  renderMeasure();
});
document.getElementById("mSaveBtn").addEventListener("click", ()=>{
  const convert=id=>{const value=document.getElementById(id).value;return value===""?null:inchesFromUnit(value,currentUnitSystem());};
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
      +(m.arm!=null?('A '+shown(m.arm)+delta(m.arm, prev&&prev.arm)):'')+' '+unitMeasurementLabel()
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
