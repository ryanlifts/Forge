"use strict";
// ================== TRAIN ==================
const wDaySel = document.getElementById("wDay");
document.getElementById("wDate").value = todayStr();

const EXERCISE_SHAPE_LABELS = {
  lift:"Weight × reps", reps:"Reps (weight optional)", timeDist:"Time / distance",
  carry:"Weight + distance", rounds:"Rounds / intervals", text:"Free text"
};

function newExerciseNameMap(){
  return Object.create(null);
}

function setExerciseNameValue(map,name,value){
  Object.defineProperty(
    map,
    String(name),
    {
      value:value,
      enumerable:true,
      configurable:true,
      writable:true
    }
  );

  return value;
}

function cloneExerciseNameMap(map){
  const copy=newExerciseNameMap();

  Object.keys(map||{}).forEach(name=>{
    setExerciseNameValue(
      copy,
      name,
      cloneJSON(map[name])
    );
  });

  return copy;
}

function userExerciseNameReservation(name){
  const clean=String(name||"").trim();

  if(/^\[Cardio\]/i.test(clean)){
    return "The [Cardio] prefix is reserved for legacy workout history.";
  }

  if(normalizeExerciseName(clean)==="other"){
    return '"Other" is reserved for legacy Cardio history.';
  }

  return null;
}

function storedValueUsesUnknownShape(value){
  return isPlainObject(value)
    && typeof value.t==="string"
    && !!value.t
    && !EXERCISE_SHAPES.includes(value.t);
}

function userExerciseEntries(){ return Object.values((data&&data.myExercises)||{}); }
function exerciseEntryIsNameSelectable(entry){
  const owner=resolveExerciseByName(entry.name);
  return !owner || owner.id===entry.id;
}
function allExerciseEntries(includeDeprecated){
  return EXERCISE_LIBRARY
    .concat(userExerciseEntries())
    .filter(entry=>includeDeprecated || !entry.deprecated)
    .filter(exerciseEntryIsNameSelectable);
}
function exerciseById(id){
  if (!id) return null;
  const user=(data.myExercises||{})[id];
  if (user) return user;
  return EXERCISE_LIBRARY.find(entry=>entry.id===id)||null;
}
function exerciseNameOwner(normalized, ignoreId){
  const key=normalizeExerciseName(normalized);
  if (!key) return null;
  const users=userExerciseEntries();
  const builtins=EXERCISE_LIBRARY;
  // Future built-in collisions are resolved in favor of the user entry.
  for (const entry of users){
    if (entry.id!==ignoreId && exerciseEntryNames(entry).includes(key)) return entry;
  }
  for (const entry of builtins){
    if (entry.id!==ignoreId && exerciseEntryNames(entry).includes(key)) return entry;
  }
  return null;
}
function resolveExerciseByName(name){
  const key=normalizeExerciseName(String(name||"").replace(/^\[Cardio\]\s*/i,""));
  if (!key) return null;
  const users=userExerciseEntries(), builtins=EXERCISE_LIBRARY;
  const exactUsers=users.filter(entry=>normalizeExerciseName(entry.name)===key);
  const formerUsers=users.filter(entry=>(entry.formerNames||[]).includes(key));
  const userMatches=exactUsers.concat(formerUsers.filter(entry=>!exactUsers.includes(entry)));
  // B7 future-library tiebreak: a user entry wins this name even when a later
  // built-in claims it as a current or former name.
  if (userMatches.length===1) return userMatches[0];
  if (userMatches.length>1) return null;
  const exactBuiltins=builtins.filter(entry=>normalizeExerciseName(entry.name)===key);
  if (exactBuiltins.length===1) return exactBuiltins[0];
  if (exactBuiltins.length>1) return null;
  const formerBuiltins=builtins.filter(entry=>(entry.formerNames||[]).includes(key));
  return formerBuiltins.length===1 ? formerBuiltins[0] : null;
}
function displayExerciseName(name){ return String(name||"").replace(/^\[Cardio\]\s*/i,""); }
function legacyShapeFromValue(value){
  if (typeof value==="string") return "text";
  if (Array.isArray(value)) return "lift";
  if (isPlainObject(value) && EXERCISE_SHAPES.includes(value.t)) return value.t;
  if (isPlainObject(value) && value.t) return "unknown";
  return "lift";
}
function exerciseDescriptor(name,value){
  const entry=resolveExerciseByName(name);
  if (entry) return entry;
  return {
    id:"legacy:"+normalizeExerciseName(displayExerciseName(name)),
    name:displayExerciseName(name),
    shape:String(name||"").indexOf("[Cardio] ")===0 ? "text" : legacyShapeFromValue(value),
    tags:[], aliases:[], formerNames:[], muscles:{primary:[],secondary:[]}, equipment:[],
    unilateral:false, bodyweight:false, deprecated:false, legacy:true
  };
}
function exerciseDescriptorForProgram(ex){
  const entry=exerciseDescriptor(ex.name,null);
  return Object.assign({},entry,{scheme:ex.scheme||"",programName:ex.name});
}
function exerciseIdentityKey(entryOrName){
  const entry=typeof entryOrName==="string"
    ? exerciseDescriptor(entryOrName,null)
    : entryOrName;

  if(entry && entry.id && !entry.legacy){
    return "id:"+entry.id;
  }

  const name=entry && entry.name
    ? entry.name
    : entryOrName;

  return "name:"+normalizeExerciseName(
    displayExerciseName(name)
  );
}
function historyExerciseKey(name){ return displayExerciseName(name); }
function findHistoryValue(sets,entryOrName){
  if (!sets || typeof sets!=="object") return null;
  const entry=typeof entryOrName==="string" ? resolveExerciseByName(entryOrName) : entryOrName;
  const current=entry ? normalizeExerciseName(entry.name) : normalizeExerciseName(displayExerciseName(entryOrName));
  const former=entry ? (entry.formerNames||[]) : [];
  const matches=[];
  Object.keys(sets).forEach(key=>{
    const normalized=normalizeExerciseName(displayExerciseName(key));
    if (normalized===current || former.includes(normalized)) matches.push({key:key,value:sets[key]});
  });
  if (matches.length===1) return matches[0];
  const exact=Object.keys(sets).find(key=>normalizeExerciseName(displayExerciseName(key))===current);
  return exact ? {key:exact,value:sets[exact]} : null;
}
function exerciseSearchScore(entry,query){
  const q=normalizeExerciseName(query);
  if (!q) return 1;
  const tokens=q.split(" ").filter(Boolean);
  const name=normalizeExerciseName(entry.name);
  let score=0;
  if (name===q) score+=160;
  if (name.startsWith(q)) score+=90;
  if (name.includes(q)) score+=55;
  (entry.aliases||[]).forEach(alias=>{
    const a=normalizeExerciseName(alias);
    if (a===q) score+=120;
    else if (a.startsWith(q)) score+=70;
    else if (a.includes(q)) score+=40;
  });
  (entry.formerNames||[]).forEach(formerName=>{
    const old=normalizeExerciseName(formerName);
    if (old===q) score+=135;
    else if (old.startsWith(q)) score+=78;
    else if (old.includes(q)) score+=46;
  });
  tokens.forEach(token=>{
    if (name.includes(token)) score+=24;
    if ((entry.aliases||[]).some(alias=>normalizeExerciseName(alias).includes(token))) score+=18;
    if ((entry.tags||[]).some(tag=>normalizeExerciseName(tag).includes(token))) score+=12;
    if ((entry.equipment||[]).some(eq=>normalizeExerciseName(eq).includes(token))) score+=8;
    if ((entry.muscles.primary||[]).concat(entry.muscles.secondary||[]).some(m=>normalizeExerciseName(m).includes(token))) score+=7;
  });
  return score;
}
function searchExercises(query,limit){
  return allExerciseEntries(false)
    .map(entry=>({entry:entry,score:exerciseSearchScore(entry,query)}))
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0,limit||80).map(item=>item.entry);
}
function makeUserExerciseId(){
  if (typeof crypto!=="undefined" && typeof crypto.randomUUID==="function") return "u:"+crypto.randomUUID();
  return "u:"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
}
function genericUserExercise(name,shape){
  const bodyweight=shape==="reps";
  const tags=shape==="timeDist" ? ["cardio"] : shape==="carry" ? ["strength","carry"] : shape==="rounds" ? ["conditioning"] : shape==="text" ? [] : ["strength"];
  return {id:makeUserExerciseId(),name:name,shape:shape,tags:tags,aliases:[],formerNames:[],muscles:{primary:["full-body"],secondary:[]},equipment:[bodyweight?"bodyweight":"other"],unilateral:false,bodyweight:bodyweight,deprecated:false};
}
function createUserExercise(name,shape){
  const clean=String(name||"").trim().replace(/\s+/g," ");
  if (!clean) return {ok:false,reason:"Type an exercise name."};

  const reservation=userExerciseNameReservation(clean);
  if(reservation)return {ok:false,reason:reservation};

  if (!EXERCISE_SHAPES.includes(shape)) return {ok:false,reason:"Choose a valid tracking shape."};
  const owner=exerciseNameOwner(clean,null);
  if (owner) return {ok:false,reason:'"'+clean+'" conflicts with '+owner.name+'.'};
  const entry=genericUserExercise(clean,shape);
  try { validateExerciseEntryObject(entry,"u:"); }
  catch(e){ return {ok:false,reason:e.message}; }
  data.myExercises[entry.id]=entry;
  if (!save()){ delete data.myExercises[entry.id]; return {ok:false,reason:"The exercise could not be saved."}; }
  return {ok:true,entry:entry};
}
function exerciseNameReferenceLocation(name){
  const key=normalizeExerciseName(displayExerciseName(name));
  if(!key)return null;

  const matches=value=>
    normalizeExerciseName(displayExerciseName(value))===key;

  for(let workoutIndex=0;workoutIndex<(data.workouts||[]).length;workoutIndex++){
    const workout=data.workouts[workoutIndex];
    const hit=Object.keys(workout.sets||{}).find(matches);
    if(hit)return {kind:"workout history",name:hit,index:workoutIndex};
  }

  if(data.activeWorkoutDraft){
    const hit=Object.keys(data.activeWorkoutDraft.sets||{}).find(matches);
    if(hit)return {kind:"saved workout draft",name:hit};
  }

  const goal=Object.keys(cfg.liftGoals||{}).find(matches);
  if(goal)return {kind:"training goal",name:goal};

  for(const day of (program&&program.days)||[]){
    const hit=(day.exercises||[]).find(ex=>matches(ex.name));
    if(hit)return {kind:"active program",name:hit.name,day:day.id};
  }

  if(
    typeof builderProg!=="undefined"
    && builderProg
    && Array.isArray(builderProg.days)
  ){
    for(const day of builderProg.days){
      const hit=(day.exercises||[]).find(ex=>matches(ex.name));
      if(hit)return {kind:"open program builder",name:hit.name,day:day.id};
    }
  }

  if(typeof sessionRawExercises==="function"){
    const rawHit=sessionRawExercises().find(ex=>matches(ex.name));
    if(rawHit)return {kind:"open workout",name:rawHit.name};
  }

  const swapBase=Object.keys(sessionSwaps||{}).find(matches);
  if(swapBase)return {kind:"open workout swap",name:swapBase};

  const swapTarget=Object.keys(sessionSwaps||{}).find(
    base=>matches(sessionSwaps[base])
  );
  if(swapTarget){
    return {
      kind:"open workout swap",
      name:sessionSwaps[swapTarget]
    };
  }

  const stateKey=Object.keys(sessionState||{}).find(matches);
  if(stateKey)return {kind:"open workout result",name:stateKey};

  const historyState=Object.keys(sessionState||{}).find(keyName=>{
    const state=sessionState[keyName];
    return state&&state.historyKey&&matches(state.historyKey);
  });
  if(historyState){
    return {
      kind:"open workout result",
      name:sessionState[historyState].historyKey
    };
  }

  return null;
}
function renameUserExercise(id,nextName){
  const entry=(data.myExercises||{})[id];
  if (!entry) return {ok:false,reason:"Exercise not found."};

  const clean=String(nextName||"").trim().replace(/\s+/g," ");
  if (!clean) return {ok:false,reason:"Type a new name."};

  const reservation=userExerciseNameReservation(clean);
  if(
    reservation
    && normalizeExerciseName(clean)
      !==normalizeExerciseName(entry.name)
  ){
    return {ok:false,reason:reservation};
  }

  const owner=exerciseNameOwner(clean,id);
  if (owner) return {ok:false,reason:'"'+clean+'" conflicts with '+owner.name+'.'};

  const previousNormalized=normalizeExerciseName(entry.name);
  const nextNormalized=normalizeExerciseName(clean);

  if(previousNormalized!==nextNormalized){
    const reference=exerciseNameReferenceLocation(clean);

    if(reference){
      return {
        ok:false,
        reason:'"'+clean+'" is already used by '
          +reference.kind+'. Choose a different name.'
      };
    }
  }

  const oldEntry=cloneJSON(entry);
  const oldDraft=data.activeWorkoutDraft
    ? cloneJSON(data.activeWorkoutDraft)
    : null;

  const previousName=entry.name;
  const previous=normalizeExerciseName(previousName);
  const next=normalizeExerciseName(clean);

  if (
    previous!==next
    && !(entry.formerNames||[]).includes(previous)
  ){
    entry.formerNames.push(previous);
  }

  entry.name=clean;

  if (
    previous!==next
    && data.activeWorkoutDraft
    && isPlainObject(data.activeWorkoutDraft.sets)
  ){
    const keys=Object.keys(data.activeWorkoutDraft.sets);
    const oldKeys=keys.filter(
      key=>
        normalizeExerciseName(displayExerciseName(key))
        === previous
    );
    const nextExists=keys.some(
      key=>
        normalizeExerciseName(displayExerciseName(key))
        === next
        && !oldKeys.includes(key)
    );

    if(oldKeys.length===1 && !nextExists){
      const oldKey=oldKeys[0];
      setExerciseNameValue(
        data.activeWorkoutDraft.sets,
        clean,
        data.activeWorkoutDraft.sets[oldKey]
      );

      if(oldKey!==clean){
        delete data.activeWorkoutDraft.sets[oldKey];
      }

      data.activeWorkoutDraft.updatedAt=
        new Date().toISOString();
    }
  }

  try {
    validateExerciseEntryObject(entry,"u:");
  } catch(e){
    data.myExercises[id]=oldEntry;
    data.activeWorkoutDraft=oldDraft;
    return {ok:false,reason:e.message};
  }

  if (!save()){
    data.myExercises[id]=oldEntry;
    data.activeWorkoutDraft=oldDraft;
    return {
      ok:false,
      reason:"The rename could not be saved."
    };
  }

  return {
    ok:true,
    entry:entry,
    previousName:previousName
  };
}

function rekeyOpenSessionExercise(previousName,entry){
  if(!entry)return;

  const previous=normalizeExerciseName(previousName);
  const current=entry.name;

  const oldStateKey=Object.keys(sessionState||{}).find(
    key=>
      normalizeExerciseName(displayExerciseName(key))
      === previous
  );

  if(
    oldStateKey
    && oldStateKey!==current
    && !hasOwn(sessionState,current)
  ){
    sessionState[current]=sessionState[oldStateKey];
    delete sessionState[oldStateKey];

    if(editingWorkoutIdx==null){
      sessionState[current].historyKey=current;
    }
  }

  const renamedExtraSwapBases=[];

  extraExercises.forEach(ex=>{
    if(
      ex.id===entry.id
      || normalizeExerciseName(ex.name)===previous
    ){
      if(hasOwn(sessionSwaps,ex.name)){
        renamedExtraSwapBases.push(ex.name);
      }

      ex.id=entry.id;
      ex.name=current;
      ex.shape=entry.shape;
    }
  });

  renamedExtraSwapBases.forEach(oldBase=>{
    if(oldBase===current)return;

    sessionSwaps[current]=sessionSwaps[oldBase];
    delete sessionSwaps[oldBase];
  });

  Object.keys(sessionSwaps||{}).forEach(base=>{
    if(
      normalizeExerciseName(sessionSwaps[base])
      === previous
    ){
      sessionSwaps[base]=current;
    }
  });

  if(
    typeof builderProg!=="undefined"
    && builderProg
    && Array.isArray(builderProg.days)
  ){
    builderProg.days.forEach(day=>{
      (day.exercises||[]).forEach(ex=>{
        const resolved=resolveExerciseByName(ex.name);

        if(
          (resolved && resolved.id===entry.id)
          || normalizeExerciseName(
            displayExerciseName(ex.name)
          )===previous
        ){
          ex.name=current;
        }
      });
    });
  }
}

function removeDeletedUserExerciseFromOpenSession(entry){
  if(!entry)return;

  const names=new Set(
    [normalizeExerciseName(entry.name)]
      .concat(entry.formerNames||[])
  );

  const matches=name=>
    names.has(
      normalizeExerciseName(displayExerciseName(name))
    );

  const removedExtraBases=new Set();

  extraExercises=extraExercises.filter(ex=>{
    const remove=
      ex.id===entry.id
      || matches(ex.name);

    if(remove){
      removedExtraBases.add(
        normalizeExerciseName(ex.name)
      );
    }

    return !remove;
  });

  Object.keys(sessionSwaps||{}).forEach(base=>{
    if(
      removedExtraBases.has(
        normalizeExerciseName(base)
      )
      || matches(base)
      || matches(sessionSwaps[base])
    ){
      delete sessionSwaps[base];
    }
  });

  const liveNames=new Set(
    sessionList().map(ex=>
      normalizeExerciseName(ex.name)
    )
  );

  Object.keys(sessionState||{}).forEach(key=>{
    const normalized=
      normalizeExerciseName(
        displayExerciseName(key)
      );

    if(
      matches(key)
      || !liveNames.has(normalized)
    ){
      delete sessionState[key];
    }
  });
}

function userExerciseReferenceCount(entry){
  const names=new Set(
    [normalizeExerciseName(entry.name)]
      .concat(entry.formerNames||[])
  );
  let count=0;
  const matches=name=>names.has(
    normalizeExerciseName(displayExerciseName(name))
  );

  data.workouts.forEach(workout=>
    Object.keys(workout.sets||{}).forEach(name=>{
      if(matches(name))count++;
    })
  );

  if(data.activeWorkoutDraft){
    Object.keys(data.activeWorkoutDraft.sets||{}).forEach(name=>{
      if(matches(name))count++;
    });
  }

  Object.keys(cfg.liftGoals||{}).forEach(name=>{
    if(matches(name))count++;
  });

  program.days.forEach(day=>(day.exercises||[]).forEach(ex=>{
    if(matches(ex.name))count++;
  }));

  if(
    typeof builderProg!=="undefined"
    && builderProg
    && Array.isArray(builderProg.days)
  ){
    builderProg.days.forEach(day=>(day.exercises||[]).forEach(ex=>{
      if(matches(ex.name))count++;
    }));
  }

  return count;
}
function openSessionRuntimeSnapshot(){
  return {
    extraExercises:cloneJSON(extraExercises),
    sessionSwaps:cloneExerciseNameMap(sessionSwaps),
    sessionState:cloneExerciseNameMap(sessionState),
    activeWorkoutDraft:data.activeWorkoutDraft
      ? cloneJSON(data.activeWorkoutDraft)
      : null
  };
}
function restoreOpenSessionRuntime(snapshot){
  extraExercises=snapshot.extraExercises;
  sessionSwaps=snapshot.sessionSwaps;
  sessionState=snapshot.sessionState;
  data.activeWorkoutDraft=snapshot.activeWorkoutDraft;
}
function archiveOrDeleteUserExercise(id){
  const entry=(data.myExercises||{})[id];

  if(!entry){
    return {ok:false,reason:"Exercise not found."};
  }

  const oldEntry=cloneJSON(entry);
  const refs=userExerciseReferenceCount(entry);

  if(refs>0){
    entry.deprecated=true;

    if(!save()){
      data.myExercises[id]=oldEntry;
      return {
        ok:false,
        reason:"The exercise could not be archived."
      };
    }

    return {
      ok:true,
      archived:true,
      references:refs
    };
  }

  const runtime=openSessionRuntimeSnapshot();

  delete data.myExercises[id];
  removeDeletedUserExerciseFromOpenSession(oldEntry);

  if(workoutDraftLoaded){
    data.activeWorkoutDraft=buildWorkoutDraft();
  }

  if(!save()){
    data.myExercises[id]=oldEntry;
    restoreOpenSessionRuntime(runtime);

    return {
      ok:false,
      reason:"The exercise could not be deleted."
    };
  }

  renderWorkoutDraftCard();

  return {
    ok:true,
    deleted:true,
    references:0
  };
}
function restoreUserExercise(id){
  const entry=(data.myExercises||{})[id];
  if (!entry) return {ok:false,reason:"Exercise not found."};
  if (!entry.deprecated) return {ok:true,restored:false,entry:entry};
  const old=cloneJSON(entry);
  entry.deprecated=false;
  if (!save()){
    data.myExercises[id]=old;
    return {ok:false,reason:"The exercise could not be restored."};
  }
  return {ok:true,restored:true,entry:entry};
}

function renderDayOptions(){
  wDaySel.innerHTML = "";
  program.days.forEach(p=>{
    const o=document.createElement("option"); o.value=p.id; o.textContent=(p.id?p.id+" · ":"")+p.title;
    wDaySel.appendChild(o);
  });
  const c=document.createElement("option"); c.value="__CARDIO__"; c.textContent="Cardio / Conditioning";
  wDaySel.appendChild(c);
  const f=document.createElement("option"); f.value="__FREE__"; f.textContent="Freestyle (build from library)";
  wDaySel.appendChild(f);
}
function renderCardioOptions(){
  const sel=document.getElementById("cardioType");
  sel.innerHTML="";

  searchExercises("cardio",100)
    .filter(entry=>["timeDist","rounds","text"].includes(entry.shape))
    .sort((a,b)=>a.name.localeCompare(b.name))
    .forEach(entry=>{
      const o=document.createElement("option");
      o.value=entry.name;
      o.textContent=entry.name;
      sel.appendChild(o);
    });

  const other=document.createElement("option");
  other.value="Other";
  other.textContent="Other";
  sel.appendChild(other);
}
function selectHistoricalCardioType(type){
  const sel=document.getElementById("cardioType");
  renderCardioOptions();

  let option=[...sel.options].find(item=>item.value===type);

  if(!option){
    option=document.createElement("option");
    option.value=type;
    option.textContent=displayExerciseName(type)+" · history";
    option.dataset.historyOnly="true";

    const other=[...sel.options].find(item=>item.value==="Other");
    sel.insertBefore(option,other||null);
  }

  sel.value=type;
  return option;
}
function shapeGroupLabel(shape){ return EXERCISE_SHAPE_LABELS[shape]||shape; }
function populateExerciseSelect(select,query,includeCustom){
  select.innerHTML="";

  const q=normalizeExerciseName(query);
  const resultLimit=q
    ? 120
    : allExerciseEntries(false).length;
  const results=searchExercises(query,resultLimit);
  const shapeOrder=EXERCISE_SHAPES.slice();

  // The complete library keeps its stable shape sections with A-Z entries.
  // During search, groups and entries follow match relevance so exact results
  // such as Pull-Up and Chin-Up surface before weaker matches.
  if(q){
    const firstRank={};
    results.forEach((entry,index)=>{
      if(firstRank[entry.shape]===undefined){
        firstRank[entry.shape]=index;
      }
    });

    shapeOrder.sort((a,b)=>{
      const ar=firstRank[a]===undefined
        ? Number.MAX_SAFE_INTEGER
        : firstRank[a];
      const br=firstRank[b]===undefined
        ? Number.MAX_SAFE_INTEGER
        : firstRank[b];

      return ar-br
        || EXERCISE_SHAPES.indexOf(a)-EXERCISE_SHAPES.indexOf(b);
    });
  }

  shapeOrder.forEach(shape=>{
    const entries=results.filter(entry=>entry.shape===shape);

    if(!q){
      entries.sort((a,b)=>a.name.localeCompare(b.name));
    }

    if(!entries.length) return;

    const group=document.createElement("optgroup");
    group.label=shapeGroupLabel(shape);

    entries.forEach(entry=>{
      const option=document.createElement("option");
      option.value=entry.id;
      option.textContent=
        entry.name
        +(entry.id.startsWith("u:")?" · mine":"");
      group.appendChild(option);
    });

    select.appendChild(group);
  });

  if(includeCustom){
    const group=document.createElement("optgroup");
    group.label="My library";

    const option=document.createElement("option");
    option.value="__CUSTOM__";
    option.textContent="Create a new exercise…";

    group.appendChild(option);
    select.appendChild(group);
  }

  if(!select.options.length){
    const option=document.createElement("option");
    option.value="";
    option.textContent="No matching exercises";
    select.appendChild(option);
  }
}
function renderLibraryOptions(){
  populateExerciseSelect(document.getElementById("addExSel"),document.getElementById("exerciseSearch").value,true);
  renderMyExercisesManager();
}

let activeSessionType = null;
let sessionState = newExerciseNameMap();
let workoutDraftLoaded = false;
let sessionSwaps = newExerciseNameMap();
function currentDayExercises(){
  const v=wDaySel.value;
  if (v==="__CARDIO__" || v==="__FREE__") return [];
  const day=program.days.find(p=>p.id===v);
  return day ? day.exercises : [];
}
function sessionRawExercises(){
  return currentDayExercises().concat(extraExercises);
}
function sessionList(){
  return sessionRawExercises().map(raw=>{
    const base=raw.name;
    const shown=sessionSwaps[base]||base;
    const desc=exerciseDescriptorForProgram({
      name:shown,
      scheme:raw.scheme||""
    });

    if(shown!==base)desc.__orig=base;
    return desc;
  });
}
function sessionContainsExerciseIdentity(entryOrName,exceptBaseName){
  const wanted=exerciseIdentityKey(entryOrName);
  const except=exceptBaseName==null
    ? null
    : normalizeExerciseName(displayExerciseName(exceptBaseName));

  return sessionRawExercises().some(raw=>{
    if(
      except!==null
      && normalizeExerciseName(
        displayExerciseName(raw.name)
      )===except
    ){
      return false;
    }

    const shown=sessionSwaps[raw.name]||raw.name;

    return exerciseIdentityKey(raw.name)===wanted
      || exerciseIdentityKey(shown)===wanted;
  });
}
function programExerciseIdentityIssue(candidate){
  for(const day of candidate.days||[]){
    const seen=new Map();

    for(const ex of day.exercises||[]){
      const key=exerciseIdentityKey(ex.name);

      if(seen.has(key)){
        return {
          day:day,
          first:seen.get(key),
          duplicate:ex
        };
      }

      seen.set(key,ex);
    }
  }

  return null;
}
function validateProgramExerciseIdentities(candidate){
  const issue=programExerciseIdentityIssue(candidate);

  if(issue){
    throw new Error(
      '"'+displayExerciseName(issue.duplicate.name)
      +'" duplicates another exercise in '
      +'"'+(issue.day.title||issue.day.id||"this day")+'".'
    );
  }

  return candidate;
}
function dayContainsExerciseIdentity(day,entryOrName){
  const wanted=exerciseIdentityKey(entryOrName);

  return (day.exercises||[]).some(
    ex=>exerciseIdentityKey(ex.name)===wanted
  );
}
function renderProgramIdentity(){
  const name=document.getElementById("programName"), dayLine=document.getElementById("programDayName");
  if (name) name.textContent=program.name||"Unnamed program";
  if (!dayLine) return;
  const v=wDaySel.value;
  if (v==="__CARDIO__") dayLine.textContent="Selected session: Cardio / Conditioning";
  else if (v==="__FREE__") dayLine.textContent="Selected session: Freestyle";
  else { const day=program.days.find(p=>p.id===v); dayLine.textContent=day?"Selected session: "+day.title:"Select a session below"; }
}
function setProgramManagerOpen(open){
  const panel=document.getElementById("programToolsCard"),button=document.getElementById("programManageBtn");
  if(!panel||!button)return; panel.classList.toggle("hidden",!open); button.setAttribute("aria-expanded",open?"true":"false"); button.textContent=open?"Close":"Manage";
}
document.getElementById("programManageBtn").addEventListener("click",()=>setProgramManagerOpen(document.getElementById("programToolsCard").classList.contains("hidden")));
document.getElementById("programManageCloseBtn").addEventListener("click",()=>setProgramManagerOpen(false));
function replaceActiveProgram(candidate){
  let next;

  try{
    next=validateProgramExerciseIdentities(
      validateProgram(cloneJSON(candidate))
    );
  }catch(e){
    return {ok:false,reason:e.message};
  }

  const currentName=(program&&program.name)||"Unnamed program",nextName=next.name||"Unnamed program";
  const draftNote=data.activeWorkoutDraft?"\n\nYour saved workout draft will remain available.":"";
  if(!confirm('Replace current program "'+currentName+'" with "'+nextName+'"?\n\nWorkout history will stay intact.'+draftNote))return{ok:false,cancelled:true};
  const previous=program; program=next;
  if(!saveProgram()){program=previous;return{ok:false,reason:"The new program could not be saved."};}
  extraExercises=[]; initSessionState(); renderDayOptions(); renderSessionInputs(); renderWork(); renderDash(); if(typeof renderNextWorkout==="function")renderNextWorkout();
  return{ok:true,program:next};
}

function toRows(val){
  if(Array.isArray(val))return val.map(s=>({w:hasOwn(s,"w")?s.w:"",r:s.r,done:false,touched:false}));
  if(typeof val==="string"){
    const rows=[],re=/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)/g; let m;
    while((m=re.exec(val))!==null)rows.push({w:parseFloat(m[1]),r:parseInt(m[2],10),done:false,touched:false});
    return rows;
  }
  return[];
}
function formatDuration(total){
  const secs=Math.max(0,Math.round(Number(total)||0)),h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
  return (h?h+"h ":"")+(m?m+"m ":"")+(s||(!h&&!m)?s+"s":"");
}
function formatSets(val){
  if(Array.isArray(val))return val.map(row=>(Number(row.w)>0?Number(row.w)+"×":"")+Number(row.r)+(Number(row.w)>0?"":" reps")).join(", ");
  if(typeof val==="string")return val;
  if(isPlainObject(val)&&val.t==="timeDist")return formatDuration(val.secs)+(Number(val.dist)>0?" · "+val.dist+" "+val.distUnit:"");
  if(isPlainObject(val)&&val.t==="carry")return val.lbs+" lb · "+val.dist+" "+val.distUnit;
  if(isPlainObject(val)&&val.t==="rounds")return val.rounds+" rounds · "+val.workSecs+"s work / "+val.recSecs+"s recovery"+(val.note?" · "+val.note:"");
  if(isPlainObject(val)&&val.t)return "Newer version · "+JSON.stringify(val);
  return String(val==null?"":val);
}
function parseScheme(scheme){
  if(!scheme)return null; const m=String(scheme).match(/(\d+)\s*[x×]\s*(\d+)(?:\s*[-–—]\s*(\d+))?/); if(!m)return null;
  const reps=parseInt(m[2],10),topReps=m[3]?Math.max(reps,parseInt(m[3],10)):reps;
  return{sets:parseInt(m[1],10),reps:reps,topReps:topReps};
}
function autoProgressionEnabled(){return cfg.autoProgressionOn!==false;}
function isAssistedExercise(name){return /\bassist(?:ed|ance)\b/i.test(String(name||""));}
function progressionDeltaFor(ex){return isAssistedExercise(ex&&ex.name)?-5:5;}
function prefillRows(ex,lastVal){
  const sch=parseScheme(ex.scheme);
  if(Array.isArray(lastVal)){
    const rows=toRows(lastVal);
    if(rows.length){
      let auto=false,autoDelta=0;
      if(autoProgressionEnabled()&&sch&&rows.length>=sch.sets&&rows.every(r=>r.r>=sch.topReps)){
        const w0=Number(rows[0].w),delta=progressionDeltaFor(ex),nextWeight=w0+delta;
        if(rows.every(r=>Number(r.w)===w0)&&w0>0&&nextWeight>0){rows.forEach(r=>{r.w=nextWeight;r.r=sch.reps;});auto=true;autoDelta=delta;}
      }
      return{rows:rows,auto:auto,autoDelta:autoDelta};
    }
  }
  const n=sch?sch.sets:3,rows=[]; for(let i=0;i<n;i++)rows.push({w:"",r:sch?sch.reps:"",done:false,touched:false});
  return{rows:rows,auto:false,autoDelta:0};
}
function blankShapeState(ex){
  const shape=EXERCISE_SHAPES.includes(ex.shape)?ex.shape:"lift";
  const base={shape:shape,rows:[],text:"",textTouched:false,touched:false,fields:{},auto:false,autoDelta:0,saved:null,status:"plan",historyKey:null,readOnly:false};
  if(shape==="lift"||shape==="reps"){const pf=prefillRows(ex,null);base.rows=pf.rows;}
  if(shape==="timeDist")base.fields={hours:"",mins:"",secs:"",dist:"",distUnit:"mi"};
  if(shape==="carry")base.fields={lbs:"",dist:"",distUnit:"ft"};
  if(shape==="rounds")base.fields={rounds:"",workSecs:"",recSecs:"",note:""};
  return base;
}
function stateFromStoredValue(ex,value,status,historyKey,touched){
  const st=blankShapeState(ex); st.status=status||"saved"; st.saved=cloneJSON(value); st.historyKey=historyKey||null;
  if(typeof value==="string"){st.shape="text";st.text=value;st.textTouched=!!touched;return st;}
  if(Array.isArray(value)){
    st.shape=ex.shape==="reps"?"reps":"lift";
    st.rows=value.map(row=>({w:hasOwn(row,"w")?row.w:"",r:row.r,done:false,touched:!!touched})); return st;
  }
  if(isPlainObject(value)&&value.t==="timeDist"){
    st.shape="timeDist";const total=Number(value.secs)||0;st.fields={hours:Math.floor(total/3600),mins:Math.floor((total%3600)/60),secs:total%60,dist:hasOwn(value,"dist")?value.dist:"",distUnit:value.distUnit||"mi"};st.touched=!!touched;return st;
  }
  if(isPlainObject(value)&&value.t==="carry"){st.shape="carry";st.fields={lbs:value.lbs,dist:value.dist,distUnit:value.distUnit};st.touched=!!touched;return st;}
  if(isPlainObject(value)&&value.t==="rounds"){st.shape="rounds";st.fields={rounds:value.rounds,workSecs:value.workSecs,recSecs:value.recSecs,note:value.note||""};st.touched=!!touched;return st;}
  if(isPlainObject(value)&&value.t){st.shape="unknown";st.readOnly=true;return st;}
  return st;
}
function newStateForExercise(ex,lastHit){
  const st=blankShapeState(ex);
  if((ex.shape==="lift"||ex.shape==="reps")&&lastHit&&Array.isArray(lastHit.value)){
    const pf=prefillRows(ex,lastHit.value);st.rows=pf.rows;st.auto=pf.auto;st.autoDelta=pf.autoDelta;
  }
  return st;
}
function initSessionState(){
  workoutDraftLoaded=false;
  sessionState=newExerciseNameMap();
  sessionSwaps=newExerciseNameMap();
  activeSessionType=wDaySel.value;
  if(wDaySel.value==="__CARDIO__")return;
  const last=wDaySel.value!=="__FREE__"?lastSessionFor(wDaySel.value):null;
  sessionList().forEach(ex=>{const hit=last?findHistoryValue(last.sets,ex):null;sessionState[ex.name]=newStateForExercise(ex,hit);});
}
function enteredRows(st){return st.rows.map((r,i)=>({r:r,i:i})).filter(x=>x.r.touched&&(x.r.w!==""||x.r.r!==""));}
function validateLiftShape(st){
  const entered=enteredRows(st); if(!entered.length)return{ok:true,value:null}; const rows=[];
  for(const x of entered){if(!(Number(x.r.w)>0)||!(Number(x.r.r)>0))return{ok:false,rowIndex:x.i,message:"Enter both weight and reps — Set "+(x.i+1)+"."};rows.push({w:Number(x.r.w),r:Number(x.r.r)});}return{ok:true,value:rows};
}
function validateRepsShape(st){
  const entered=enteredRows(st); if(!entered.length)return{ok:true,value:null}; const rows=[];
  for(const x of entered){if(!(Number(x.r.r)>0))return{ok:false,rowIndex:x.i,message:"Enter reps for set "+(x.i+1)+"."};const row={r:Number(x.r.r)};if(Number(x.r.w)>0)row.w=Number(x.r.w);rows.push(row);}return{ok:true,value:rows};
}
function shapeSeconds(fields){return Math.round((Number(fields.hours)||0)*3600+(Number(fields.mins)||0)*60+(Number(fields.secs)||0));}
function validateTimeDistShape(st){
  if(!st.touched)return{ok:true,value:null};const secs=shapeSeconds(st.fields);if(!(secs>0))return{ok:false,message:"Enter a time greater than zero."};
  const out={t:"timeDist",secs:secs};if(st.fields.dist!==""&&st.fields.dist!=null){if(!(Number(st.fields.dist)>0)||!EXERCISE_DISTANCE_UNITS.includes(st.fields.distUnit))return{ok:false,message:"Enter a valid distance and unit."};out.dist=Number(st.fields.dist);out.distUnit=st.fields.distUnit;}return{ok:true,value:out};
}
function validateCarryShape(st){
  if(!st.touched)return{ok:true,value:null};if(!(Number(st.fields.lbs)>0))return{ok:false,message:"Enter the carried weight."};if(!(Number(st.fields.dist)>0)||!EXERCISE_DISTANCE_UNITS.includes(st.fields.distUnit))return{ok:false,message:"Enter a valid carry distance and unit."};
  return{ok:true,value:{t:"carry",lbs:Number(st.fields.lbs),dist:Number(st.fields.dist),distUnit:st.fields.distUnit}};
}
function validateRoundsShape(st){
  if(!st.touched)return{ok:true,value:null};const rounds=Number(st.fields.rounds),work=Number(st.fields.workSecs),rec=Number(st.fields.recSecs);
  if(!Number.isInteger(rounds)||rounds<=0)return{ok:false,message:"Enter a whole number of rounds."};if(!Number.isInteger(work)||work<=0)return{ok:false,message:"Enter work seconds greater than zero."};if(!Number.isInteger(rec)||rec<0)return{ok:false,message:"Recovery seconds cannot be negative."};
  const out={t:"rounds",rounds:rounds,workSecs:work,recSecs:rec};const note=String(st.fields.note||"").trim();if(note)out.note=note;return{ok:true,value:out};
}
function validateTextShape(st){const value=st.textTouched&&st.text.trim()?st.text.trim():null;return{ok:true,value:value};}
function validateUnknownShape(st){return{ok:false,message:"This entry was created by a newer BlackPyre version and is read-only."};}
const SHAPE_VALIDATORS={lift:validateLiftShape,reps:validateRepsShape,timeDist:validateTimeDistShape,carry:validateCarryShape,rounds:validateRoundsShape,text:validateTextShape,unknown:validateUnknownShape};
function validateExerciseEntry(st){
  // Keep the v51 public helper contract used by cumulative tests and legacy callers.
  // New session state uses shape; old callers used mode:"rows" / mode:"text".
  const shape=st.shape || (st.mode==="rows" ? "lift" : st.mode==="text" ? "text" : "unknown");
  return(SHAPE_VALIDATORS[shape]||validateUnknownShape)(st);
}
function stateHasInput(st){
  if(st.saved!=null)return true;if(st.shape==="text")return!!st.textTouched&&!!st.text.trim();if(st.shape==="lift"||st.shape==="reps")return st.rows.some(r=>r.touched&&(r.w!==""||r.r!==""));return!!st.touched;
}
function hasUnsavedEntry(st){return st.status!=="saved"&&stateHasInput(st);}
function sessionDraftHasMeaningfulWork(){
  if(typeof editingWorkoutIdx!=="undefined"&&editingWorkoutIdx!=null)return true;if(document.getElementById("wNotes").value.trim())return true;
  if(document.getElementById("cardioMin").value||document.getElementById("cardioDetail").value.trim())return true;if(extraExercises.length||Object.keys(sessionSwaps).length)return true;
  return Object.keys(sessionState).some(name=>stateHasInput(sessionState[name]));
}
function clearSessionDraftFields(){document.getElementById("wNotes").value="";document.getElementById("cardioMin").value="";document.getElementById("cardioDetail").value="";}
wDaySel.addEventListener("change",()=>{
  const nextType=wDaySel.value;if(activeSessionType!==null&&nextType!==activeSessionType&&sessionDraftHasMeaningfulWork()){
    if(!confirm("Discard this in-progress session and switch session type?")){wDaySel.value=activeSessionType;return;}
    if(workoutDraftLoaded&&!discardWorkoutDraft(false,false)){wDaySel.value=activeSessionType;return;}clearSessionDraftFields();
  }
  if(typeof editingWorkoutIdx!=="undefined"&&editingWorkoutIdx!=null)endWorkoutEdit(true);extraExercises=[];initSessionState();clearWorkoutError();renderSessionInputs();
});
function saveExercise(exName){
  const st=sessionState[exName];if(!st)return{ok:false};const result=validateExerciseEntry(st);
  if(!result.ok){const badField=st.shape==="reps"?"reps":"weight";showWorkoutError(displayExerciseName(exName)+" — "+result.message,result.rowIndex!=null?findSessionSetInput(exName,result.rowIndex,badField):null);return{ok:false};}
  if(result.value===null){showWorkoutError(displayExerciseName(exName)+" — enter a result before saving this exercise.",null);return{ok:false};}
  const previousSaved=st.saved==null?null:cloneJSON(st.saved),previousStatus=st.status,previousHistoryKey=st.historyKey;
  st.saved=cloneJSON(result.value);st.status="saved";st.historyKey=historyExerciseKey(exName);
  const persisted=persistWorkoutDraft();if(!persisted.ok){st.saved=previousSaved;st.status=previousStatus;st.historyKey=previousHistoryKey;renderSessionInputs();showWorkoutError(persisted.cancelled?"The existing saved workout draft was kept. Resume or discard it before starting a different session.":"This exercise could not be saved to the workout draft.",null);return{ok:false};}
  clearWorkoutError();renderSessionInputs();flashSave(displayExerciseName(exName)+" saved ✓");return{ok:true,value:st.saved};
}
function unsavedExerciseNames(){return Object.keys(sessionState).filter(name=>hasUnsavedEntry(sessionState[name]));}
function collectSavedSessionSets(state){
  const sets=newExerciseNameMap();
  let completedRows=0;

  for(const exName of Object.keys(state)){
    const st=state[exName];

    // Final workout logging is strict: only exercises explicitly in the
    // saved state may enter workout history.
    if(st.status!=="saved"||st.saved==null)continue;

    const key=st.historyKey||historyExerciseKey(exName);

    setExerciseNameValue(
      sets,
      key,
      cloneJSON(st.saved)
    );

    if(Array.isArray(st.saved)){
      completedRows+=st.saved.length;
    }
  }

  return {
    ok:true,
    sets:sets,
    completedRows:completedRows,
    error:null
  };
}

function collectDraftSessionSets(state){
  const sets=newExerciseNameMap();
  let completedRows=0;

  for(const exName of Object.keys(state)){
    const st=state[exName];

    // Draft persistence is deliberately different from final logging.
    // While a completed exercise is being edited, st.saved protects the last
    // completed value until the replacement itself is successfully saved.
    if(st.saved==null)continue;

    const key=st.historyKey||historyExerciseKey(exName);

    setExerciseNameValue(
      sets,
      key,
      cloneJSON(st.saved)
    );

    if(Array.isArray(st.saved)){
      completedRows+=st.saved.length;
    }
  }

  return {
    ok:true,
    sets:sets,
    completedRows:completedRows,
    error:null
  };
}
function draftTitleFor(dayId){
  if(dayId==="__FREE__") return "Freestyle";
  const day=program.days.find(p=>p.id===dayId);
  return day ? day.title : "Saved workout";
}
function buildWorkoutDraft(){
  const collected=collectDraftSessionSets(sessionState);
  if(!Object.keys(collected.sets).length)return null;

  const loadedIdentity=
    workoutDraftLoaded&&data.activeWorkoutDraft
      ? data.activeWorkoutDraft
      : null;

  return {
    date:document.getElementById("wDate").value||todayStr(),
    day:loadedIdentity
      ? loadedIdentity.day
      : wDaySel.value,
    title:loadedIdentity
      ? loadedIdentity.title
      : draftTitleFor(wDaySel.value),
    programName:loadedIdentity
      ? loadedIdentity.programName
      : program.name||"Unnamed program",
    sets:cloneJSON(collected.sets),
    notes:document.getElementById("wNotes").value.trim(),
    updatedAt:new Date().toISOString()
  };
}
function draftReplacementNeedsConfirmation(previous){
  return !!previous&&!workoutDraftLoaded;
}

function persistWorkoutDraft(){
  if(editingWorkoutIdx!=null){
    return {ok:true,skipped:true};
  }

  const next=buildWorkoutDraft();
  if(!next)return {ok:true,empty:true};

  const previous=data.activeWorkoutDraft
    ? cloneJSON(data.activeWorkoutDraft)
    : null;

  // An existing draft that is not loaded is never silently replaced—even when
  // its date and day id happen to match the newly opened screen.
  if(draftReplacementNeedsConfirmation(previous)){
    if(!confirm(
      'A saved workout draft already exists for "'
      +(previous.title||"another session")
      +'".\n\nDiscard that draft and save this exercise as a new draft?'
    )){
      return {ok:false,cancelled:true};
    }
  }

  data.activeWorkoutDraft=next;

  if(!save()){
    data.activeWorkoutDraft=previous;
    return {ok:false};
  }

  workoutDraftLoaded=true;
  renderWorkoutDraftCard();

  return {ok:true,draft:next};
}
function renderWorkoutDraftCard(){
  const card=document.getElementById("workoutDraftCard"),text=document.getElementById("workoutDraftText"),d=data.activeWorkoutDraft;
  if(!d||workoutDraftLoaded){card.classList.add("hidden");text.textContent="";return;}const count=Object.keys(d.sets||{}).length;text.textContent=(d.title||"Workout")+" · "+fmtDate(d.date)+" · "+count+" saved exercise"+(count===1?"":"s")+". Resume it or deliberately discard it.";card.classList.remove("hidden");
}
function draftMatchesCurrentProgramDay(draft){
  const day=program.days.find(item=>item.id===draft.day);
  if(!day)return null;

  const draftProgram=normalizeExerciseName(
    draft.programName||""
  );
  const currentProgram=normalizeExerciseName(
    program.name||""
  );

  if(
    draftProgram
    && currentProgram
    && draftProgram!==currentProgram
  ){
    return null;
  }

  const draftTitle=normalizeExerciseName(
    draft.title||""
  );
  const currentTitle=normalizeExerciseName(
    day.title||day.id||""
  );

  if(
    draftTitle
    && currentTitle
    && draftTitle!==currentTitle
  ){
    return null;
  }

  return day;
}

function resumeWorkoutDraft(){
  const draft=data.activeWorkoutDraft;
  if(!draft)return false;

  if(
    sessionDraftHasMeaningfulWork()
    && !confirm(
      "Discard the current in-progress fields and resume the saved workout draft?"
    )
  ){
    return false;
  }

  if(
    typeof editingWorkoutIdx!=="undefined"
    && editingWorkoutIdx!=null
  ){
    endWorkoutEdit(true);
  }

  const dayObj=draftMatchesCurrentProgramDay(draft);
  wDaySel.value=dayObj?draft.day:"__FREE__";

  const planned=dayObj
    ? dayObj.exercises.map(ex=>
        normalizeExerciseName(
          exerciseDescriptor(ex.name,null).name
        )
      )
    : [];

  extraExercises=Object.keys(draft.sets||{})
    .filter(name=>
      !planned.includes(
        normalizeExerciseName(
          exerciseDescriptor(
            name,
            draft.sets[name]
          ).name
        )
      )
    )
    .map(name=>{
      const entry=exerciseDescriptor(
        name,
        draft.sets[name]
      );

      return {
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        scheme:""
      };
    });

  sessionState=newExerciseNameMap();

  const rawList=(dayObj
    ? dayObj.exercises.map(ex=>
        exerciseDescriptorForProgram(ex)
      )
    : []
  ).concat(
    extraExercises.map(ex=>
      exerciseDescriptorForProgram(ex)
    )
  );

  rawList.forEach(ex=>{
    const hit=findHistoryValue(
      draft.sets,
      ex
    );

    if(hit){
      setExerciseNameValue(
        sessionState,
        ex.name,
        stateFromStoredValue(
          ex,
          hit.value,
          "saved",
          hit.key,
          false
        )
      );
    }else{
      setExerciseNameValue(
        sessionState,
        ex.name,
        blankShapeState(ex)
      );
    }
  });

  workoutDraftLoaded=true;
  activeSessionType=wDaySel.value;
  document.getElementById("wDate").value=
    draft.date||todayStr();
  document.getElementById("wNotes").value=
    draft.notes||"";

  clearWorkoutError();
  renderSessionInputs();
  renderWorkoutDraftCard();
  activateView(
    "work",
    "trainingSessionCard",
    false
  );
  flashSave("Workout draft resumed ✓");

  return true;
}
function discardWorkoutDraft(ask,resetSession){
  const d=data.activeWorkoutDraft;if(!d)return true;if(ask!==false&&!confirm('Discard the saved workout draft for "'+(d.title||"this session")+'"?'))return false;const previous=d;data.activeWorkoutDraft=null;if(!save()){data.activeWorkoutDraft=previous;return false;}
  const wasLoaded=workoutDraftLoaded;workoutDraftLoaded=false;if(resetSession!==false&&wasLoaded){extraExercises=[];clearSessionDraftFields();document.getElementById("wDate").value=todayStr();initSessionState();renderSessionInputs();}renderWorkoutDraftCard();flashSave("Workout draft discarded");return true;
}
document.getElementById("resumeWorkoutDraftBtn").addEventListener("click",resumeWorkoutDraft);
document.getElementById("discardWorkoutDraftBtn").addEventListener("click",()=>discardWorkoutDraft(true,true));
function clearWorkoutError(){const err=document.getElementById("workoutErr");err.textContent="";err.classList.add("hidden");document.querySelectorAll("#exerciseInputs .field-invalid").forEach(el=>el.classList.remove("field-invalid"));}
function showWorkoutError(message,target){const err=document.getElementById("workoutErr");err.textContent=message;err.classList.remove("hidden");if(target&&target.classList){target.classList.add("field-invalid");if(target.focus)target.focus();}}
function findSessionSetInput(exercise,rowIndex,field){return[...document.querySelectorAll("#exerciseInputs .snum")].find(el=>el.dataset.exercise===exercise&&Number(el.dataset.row)===rowIndex&&el.dataset.field===field)||null;}
function markUnsavedChip(exDiv){const chip=exDiv.querySelector(".unsavedChip");if(chip)chip.style.display="inline-flex";}
function touchState(st,div){st.touched=true;st.status="unsaved";markUnsavedChip(div);clearWorkoutError();}
function makeNumberInput(label,value,placeholder,onInput){const input=document.createElement("input");input.type="number";input.inputMode="decimal";input.setAttribute("aria-label",label);input.placeholder=placeholder;input.value=value;input.addEventListener("input",()=>onInput(input.value));return input;}
function renderSetRows(div,ex,st,weightRequired){
  st.rows.forEach((row,ri)=>{
    const rdiv=document.createElement("div");rdiv.className="srow";rdiv.innerHTML='<span class="slabel">Set '+(ri+1)+'</span>';
    const mkStep=(txt,label,fn)=>{const b=document.createElement("button");b.className="step";b.textContent=txt;b.setAttribute("aria-label",label);b.addEventListener("click",fn);return b;};
    const wIn=makeNumberInput(ex.name+" set "+(ri+1)+(weightRequired?" weight in pounds":" optional added weight in pounds"),row.w,"lb",value=>{row.w=value===""?"":Number(value);row.touched=true;touchState(st,div);});wIn.className="snum";wIn.dataset.exercise=ex.name;wIn.dataset.row=String(ri);wIn.dataset.field="weight";
    const rIn=makeNumberInput(ex.name+" set "+(ri+1)+" repetitions",row.r,"reps",value=>{row.r=value===""?"":Number(value);row.touched=true;touchState(st,div);});rIn.className="snum";rIn.inputMode="numeric";rIn.dataset.exercise=ex.name;rIn.dataset.row=String(ri);rIn.dataset.field="reps";
    rdiv.appendChild(mkStep("−5","Decrease "+ex.name+" set "+(ri+1)+" weight by 5 pounds",()=>{row.w=Math.max(0,(Number(row.w)||0)-5);row.touched=true;touchState(st,div);wIn.value=row.w;}));rdiv.appendChild(wIn);
    rdiv.appendChild(mkStep("+5","Increase "+ex.name+" set "+(ri+1)+" weight by 5 pounds",()=>{row.w=(Number(row.w)||0)+5;row.touched=true;touchState(st,div);wIn.value=row.w;}));
    const x=document.createElement("span");x.className="sx";x.textContent="×";rdiv.appendChild(x);
    rdiv.appendChild(mkStep("−1","Decrease "+ex.name+" set "+(ri+1)+" repetitions by 1",()=>{row.r=Math.max(0,(Number(row.r)||0)-1);row.touched=true;touchState(st,div);rIn.value=row.r;}));rdiv.appendChild(rIn);
    rdiv.appendChild(mkStep("+1","Increase "+ex.name+" set "+(ri+1)+" repetitions by 1",()=>{row.r=(Number(row.r)||0)+1;row.touched=true;touchState(st,div);rIn.value=row.r;}));div.appendChild(rdiv);
  });
  const add=document.createElement("button");add.className="xbtn";add.textContent="+ Add set";add.style.marginTop="2px";add.addEventListener("click",()=>{const prev=st.rows.slice().reverse().find(r=>Number(r.r)>0)||st.rows[st.rows.length-1];st.rows.push(prev?{w:prev.w,r:prev.r,done:false,touched:true}:{w:"",r:"",done:false,touched:true});st.status="unsaved";renderSessionInputs();});div.appendChild(add);
}
function labeledField(label,control){const wrap=document.createElement("div");const l=document.createElement("div");l.className="label";l.textContent=label;wrap.appendChild(l);wrap.appendChild(control);return wrap;}
function renderLiftShape(div,ex,st){renderSetRows(div,ex,st,true);}
function renderRepsShape(div,ex,st){const note=document.createElement("div");note.className="note shape-note";note.textContent="Weight is optional. Leave it blank for bodyweight reps.";div.appendChild(note);renderSetRows(div,ex,st,false);}
function renderTimeDistShape(div,ex,st){
  const row=document.createElement("div");row.className="shape-grid time-grid";[["Hours","hours"],["Minutes","mins"],["Seconds","secs"]].forEach(([label,key])=>{const input=makeNumberInput(ex.name+" "+label.toLowerCase(),st.fields[key],key==="hours"?"0":key==="mins"?"min":"sec",v=>{st.fields[key]=v===""?"":Number(v);touchState(st,div);});row.appendChild(labeledField(label,input));});div.appendChild(row);
  const drow=document.createElement("div");drow.className="shape-grid distance-grid";const dist=makeNumberInput(ex.name+" optional distance",st.fields.dist,"optional",v=>{st.fields.dist=v===""?"":Number(v);touchState(st,div);});const unit=document.createElement("select");unit.setAttribute("aria-label",ex.name+" distance unit");EXERCISE_DISTANCE_UNITS.forEach(u=>{const o=document.createElement("option");o.value=u;o.textContent=u;unit.appendChild(o);});unit.value=st.fields.distUnit;unit.addEventListener("change",()=>{st.fields.distUnit=unit.value;touchState(st,div);});drow.appendChild(labeledField("Distance (optional)",dist));drow.appendChild(labeledField("Unit",unit));div.appendChild(drow);
}
function renderCarryShape(div,ex,st){
  const row=document.createElement("div");row.className="shape-grid carry-grid";const lbs=makeNumberInput(ex.name+" carried weight in pounds",st.fields.lbs,"lb",v=>{st.fields.lbs=v===""?"":Number(v);touchState(st,div);});const dist=makeNumberInput(ex.name+" carry distance",st.fields.dist,"distance",v=>{st.fields.dist=v===""?"":Number(v);touchState(st,div);});const unit=document.createElement("select");unit.setAttribute("aria-label",ex.name+" carry distance unit");EXERCISE_DISTANCE_UNITS.forEach(u=>{const o=document.createElement("option");o.value=u;o.textContent=u;unit.appendChild(o);});unit.value=st.fields.distUnit;unit.addEventListener("change",()=>{st.fields.distUnit=unit.value;touchState(st,div);});row.appendChild(labeledField("Weight",lbs));row.appendChild(labeledField("Distance",dist));row.appendChild(labeledField("Unit",unit));div.appendChild(row);
}
function renderRoundsShape(div,ex,st){
  const row=document.createElement("div");row.className="shape-grid rounds-grid";[["Rounds","rounds"],["Work seconds","workSecs"],["Recovery seconds","recSecs"]].forEach(([label,key])=>{const input=makeNumberInput(ex.name+" "+label.toLowerCase(),st.fields[key],key==="rounds"?"rounds":"sec",v=>{st.fields[key]=v===""?"":Number(v);touchState(st,div);});row.appendChild(labeledField(label,input));});div.appendChild(row);
  const note=document.createElement("input");note.setAttribute("aria-label",ex.name+" interval note");note.placeholder="Optional note";note.value=st.fields.note;note.addEventListener("input",()=>{st.fields.note=note.value;touchState(st,div);});div.appendChild(labeledField("Note (optional)",note));
}
function renderTextShape(div,ex,st){const input=document.createElement("input");input.setAttribute("aria-label",ex.name+" details");input.placeholder="Enter anything you want to remember";input.value=st.text;input.addEventListener("input",()=>{st.text=input.value;st.textTouched=true;st.status="unsaved";markUnsavedChip(div);clearWorkoutError();});div.appendChild(input);}
function renderUnknownShape(div,ex,st){const notice=document.createElement("div");notice.className="newer-shape-notice";notice.textContent="Created by a newer BlackPyre version. This value is read-only and will be preserved: "+JSON.stringify(st.saved);div.appendChild(notice);}
const SHAPE_RENDERERS={lift:renderLiftShape,reps:renderRepsShape,timeDist:renderTimeDistShape,carry:renderCarryShape,rounds:renderRoundsShape,text:renderTextShape,unknown:renderUnknownShape};
function renderSessionInputs(){
  renderProgramIdentity();const v=wDaySel.value,strengthBlock=document.getElementById("strengthBlock"),cardioBlock=document.getElementById("cardioBlock");
  if(v==="__CARDIO__"){strengthBlock.classList.add("hidden");cardioBlock.classList.remove("hidden");return;}
  strengthBlock.classList.remove("hidden");cardioBlock.classList.add("hidden");const last=v!=="__FREE__"?lastSessionFor(v):null,list=sessionList(),container=document.getElementById("exerciseInputs");container.innerHTML="";
  if(!list.length){container.innerHTML='<div class="note" style="margin-bottom:14px;">No exercises yet — add from the library below.</div>';return;}
  list.forEach(ex=>{
    const hit=last?findHistoryValue(last.sets,ex):null;if(!sessionState[ex.name])sessionState[ex.name]=newStateForExercise(ex,hit);const st=sessionState[ex.name];const prev=hit&&hit.value;
    const div=document.createElement("div");div.className="exercise";div.dataset.shape=st.shape;
    const head=document.createElement("div");head.className="x-head";head.innerHTML='<span><b>'+esc(ex.name)+'</b> <span class="shapeChip">'+esc(shapeGroupLabel(st.shape))+'</span>'+(ex.scheme?' <span class="scheme">· '+esc(ex.scheme)+'</span>':'')+(st.auto?' <span class="autoUp">'+(st.autoDelta<0?'−5 assist':'+5 auto')+'</span>':'')+'</span>';
    const tools=document.createElement("div");tools.className="x-tools";
    if(
      st.status!=="saved"
      && prev
      && !storedValueUsesUnknownShape(prev)
    ){
      const same=document.createElement("button");same.className="xbtn";same.textContent="= last";same.addEventListener("click",()=>{sessionState[ex.name]=stateFromStoredValue(ex,prev,"unsaved",null,true);sessionState[ex.name].saved=null;renderSessionInputs();});tools.appendChild(same);}
    const video=document.createElement("button");video.className="xbtn";video.textContent="Video";video.addEventListener("click",()=>openFormVideo(ex.name));tools.appendChild(video);
    const orig=ex.__orig||ex.programName||ex.name;if(typeof offerSwap==="function"&&(typeof swapOptionsForExercise!=="function"||swapOptionsForExercise(orig,ex.name).length)){const swap=document.createElement("button");swap.className="xbtn";swap.textContent="⇄";swap.title="Swap for an alternative";swap.addEventListener("click",()=>{const existing=div.querySelector(".swapmenu");if(existing){existing.remove();return;}const holder=document.createElement("div");holder.className="swapmenu";div.insertBefore(holder,div.children[1]||null);offerSwap(orig,ex.name,holder);});tools.appendChild(swap);}
    head.appendChild(tools);div.appendChild(head);
    if(prev){const line=document.createElement("div");line.className="lastLine";line.textContent="last: "+formatSets(prev);div.appendChild(line);}
    if(st.status==="saved"&&st.saved!=null){
      if(st.readOnly){renderUnknownShape(div,ex,st);container.appendChild(div);return;}
      const line=document.createElement("div");line.className="savedLine";line.innerHTML='<span class="savedChip">✓ Completed</span> <span>'+esc(formatSets(st.saved))+'</span>';
      const edit=document.createElement("button");edit.className="xbtn";edit.textContent="Edit";edit.addEventListener("click",()=>{sessionState[ex.name]=stateFromStoredValue(ex,st.saved,"unsaved",st.historyKey,true);sessionState[ex.name].saved=cloneJSON(st.saved);renderSessionInputs();});line.appendChild(edit);div.appendChild(line);container.appendChild(div);return;}
    (SHAPE_RENDERERS[st.shape]||renderUnknownShape)(div,ex,st);
    if(!st.readOnly){const foot=document.createElement("div");foot.className="exFoot";const saveBtn=document.createElement("button");saveBtn.className="xbtn saveExBtn";saveBtn.textContent="Save Exercise";saveBtn.dataset.exercise=ex.name;saveBtn.addEventListener("click",()=>saveExercise(ex.name));foot.appendChild(saveBtn);const chip=document.createElement("span");chip.className="unsavedChip";chip.textContent="Unsaved";if(!hasUnsavedEntry(st))chip.style.display="none";foot.appendChild(chip);div.appendChild(foot);}container.appendChild(div);
  });
}

document.getElementById("exerciseSearch").addEventListener("input",renderLibraryOptions);
document.getElementById("addExSel").addEventListener("change",()=>document.getElementById("customExerciseFields").classList.toggle("hidden",document.getElementById("addExSel").value!=="__CUSTOM__"));
document.getElementById("addExBtn").addEventListener("click",()=>{
  const sel=document.getElementById("addExSel");
  let entry;

  if(sel.value==="__CUSTOM__"){
    const customInput=document.getElementById("addExCustom");
    const pendingName=customInput.value;

    if(sessionContainsExerciseIdentity(pendingName,null)){
      showWorkoutError(
        String(pendingName||"Exercise").trim()
          +" is already in this session.",
        customInput
      );
      return;
    }

    const created=createUserExercise(
      pendingName,
      document.getElementById("addExShape").value
    );

    if(!created.ok){
      showWorkoutError(created.reason,customInput);
      return;
    }

    entry=created.entry;
    customInput.value="";
    document.getElementById("customExerciseFields")
      .classList.add("hidden");
    renderLibraryOptions();
  }else{
    entry=exerciseById(sel.value);
  }

  if(!entry)return;

  if(sessionContainsExerciseIdentity(entry,null)){
    showWorkoutError(
      entry.name+" is already in this session.",
      sel
    );
    return;
  }

  extraExercises.push({
    id:entry.id,
    name:entry.name,
    shape:entry.shape,
    scheme:""
  });
  sessionState[entry.name]=blankShapeState(entry);
  clearWorkoutError();
  renderSessionInputs();
});
function renderMyExercisesManager(){
  const list=document.getElementById("myExercisesList");
  if(!list)return;

  const entries=userExerciseEntries().sort((a,b)=>a.name.localeCompare(b.name));

  if(!entries.length){
    list.innerHTML='<div class="note">No user-created exercises yet.</div>';
    return;
  }

  list.innerHTML="";

  entries.forEach(entry=>{
    const refs=userExerciseReferenceCount(entry);

    const row=document.createElement("div");
    row.className="my-exercise-row";

    const copy=document.createElement("div");
    copy.style.flex="1";
    copy.innerHTML=
      '<b>'+esc(entry.name)+'</b>'
      +'<div class="note">'
      +esc(shapeGroupLabel(entry.shape))
      +(entry.deprecated?' · archived':'')
      +'</div>';
    row.appendChild(copy);

    const rename=document.createElement("button");
    rename.className="xbtn";
    rename.textContent="Rename";
    rename.addEventListener("click",()=>{
      const previousName=entry.name;
      const next=prompt("Rename exercise:",previousName);
      if(next==null)return;

      const result=renameUserExercise(entry.id,next);

      if(!result.ok){
        flashSave(result.reason,true);
        return;
      }

      rekeyOpenSessionExercise(
        result.previousName||previousName,
        result.entry
      );

      renderLibraryOptions();
      renderSessionInputs();
      if(builderProg)renderBuilder();
      flashSave("Exercise renamed ✓");
    });
    row.appendChild(rename);

    if(entry.deprecated){
      const restore=document.createElement("button");
      restore.className="xbtn";
      restore.textContent="Restore";
      restore.addEventListener("click",()=>{
        const result=restoreUserExercise(entry.id);

        if(!result.ok){
          flashSave(result.reason,true);
          return;
        }

        renderLibraryOptions();
        renderSessionInputs();
        if(builderProg)renderBuilder();
        flashSave("Exercise restored ✓");
      });
      row.appendChild(restore);

      if(refs>0){
        const protectedControl=document.createElement("button");
        protectedControl.className="xbtn";
        protectedControl.textContent="Protected by history";
        protectedControl.disabled=true;
        protectedControl.title=
          "Restore it for new sessions, or keep it archived. "
          +"Workout history remains readable.";
        row.appendChild(protectedControl);
      }else{
        const remove=document.createElement("button");
        remove.className="xbtn";
        remove.textContent="Delete";
        remove.addEventListener("click",()=>{
          const result=archiveOrDeleteUserExercise(entry.id);

          if(!result.ok){
            flashSave(result.reason,true);
            return;
          }


          renderLibraryOptions();
          renderSessionInputs();
          if(builderProg)renderBuilder();
          flashSave("Unused exercise deleted ✓");
        });
        row.appendChild(remove);
      }

      list.appendChild(row);
      return;
    }

    const remove=document.createElement("button");
    remove.className="xbtn";
    remove.textContent=refs>0?"Archive":"Delete";
    remove.addEventListener("click",()=>{
      const result=archiveOrDeleteUserExercise(entry.id);

      if(!result.ok){
        flashSave(result.reason,true);
        return;
      }


      renderLibraryOptions();
      renderSessionInputs();
      if(builderProg)renderBuilder();

      flashSave(
        result.archived
          ?"Referenced exercise archived ✓"
          :"Unused exercise deleted ✓"
      );
    });

    row.appendChild(remove);
    list.appendChild(row);
  });
}

document.getElementById("myExercisesManageBtn").addEventListener("click",()=>{const card=document.getElementById("myExercisesCard");card.classList.toggle("hidden");renderMyExercisesManager();});
document.getElementById("myExercisesCloseBtn").addEventListener("click",()=>document.getElementById("myExercisesCard").classList.add("hidden"));

document.getElementById("logWorkoutBtn").addEventListener("click",()=>{
  const date=document.getElementById("wDate").value,notes=document.getElementById("wNotes").value.trim(),v=wDaySel.value;if(!date)return;
  if(v==="__CARDIO__"){
    const type=document.getElementById("cardioType").value;
    const min=Number(document.getElementById("cardioMin").value);
    const detail=document.getElementById("cardioDetail").value.trim();

    if(!min||min<=0){
      showWorkoutError(
        "Enter cardio minutes greater than zero.",
        document.getElementById("cardioMin")
      );
      return;
    }

    const sets=newExerciseNameMap();
    setExerciseNameValue(
      sets,
      type,
      min+" min"+(detail?" · "+detail:"")
    );

    const obj={
      date:date,
      day:"CARDIO",
      title:"Cardio",
      sets:sets,
      notes:notes
    };
    const wasEdit=editingWorkoutIdx!=null;
    const before=cloneJSON(data);

    if(wasEdit){
      data.workouts[editingWorkoutIdx]=obj;
    }else{
      data.workouts.push(obj);
      bumpLog();
    }

    if(!save()){
      data=before;
      showWorkoutError(
        "The session could not be saved. Your entered cardio details were kept.",
        null
      );
      return;
    }

    document.getElementById("cardioMin").value="";
    document.getElementById("cardioDetail").value="";
    renderWork();
    renderDash();
    renderBackup();

    if(wasEdit){
      endWorkoutEdit();
      flashSave("Session updated ✓");
    }else{
      showCelebration(
        "Cardio Banked",
        null,
        type+" · "+min+" min"
      );
    }
    return;
  }
  const unsaved=unsavedExerciseNames();if(unsaved.length){const pretty=unsaved.map(displayExerciseName).join(", "),ok=confirm("Unsaved exercise"+(unsaved.length>1?"s":"")+": "+pretty+"\n\nOK — Save valid exercises & log session\nCancel — Review exercises");if(!ok){showWorkoutError("Review the unsaved exercises, tap Save Exercise on each, then log the session.",document.getElementById("exerciseInputs"));return;}for(const name of unsaved)if(!saveExercise(name).ok)return;}
  const sets=collectSavedSessionSets(sessionState).sets;if(!Object.keys(sets).length){showWorkoutError("Nothing saved yet — tap Save Exercise on at least one exercise before logging this session.",document.getElementById("exerciseInputs"));return;}
  const prLines=[];Object.keys(sets).forEach(name=>{if(typeof exercisePrLine==="function"){const line=exercisePrLine(name,sets[name],editingWorkoutIdx!=null?editingWorkoutIdx:-1);if(line)prLines.push(line);}});
  const day=program.days.find(p=>p.id===v);
  const wasEdit=editingWorkoutIdx!=null;
  const before=cloneJSON(data);

  if(wasEdit){
    const orig=data.workouts[editingWorkoutIdx];

    data.workouts[editingWorkoutIdx]={
      date:date,
      day:orig.day,
      title:orig.title,
      sets:sets,
      notes:notes
    };
  }else{
    const loadedIdentity=
      workoutDraftLoaded&&data.activeWorkoutDraft
        ? data.activeWorkoutDraft
        : null;

    data.workouts.push({
      date:date,
      day:loadedIdentity
        ? loadedIdentity.day
        : v,
      title:loadedIdentity
        ? loadedIdentity.title
        : v==="__FREE__"
          ?"Freestyle"
          :day
            ?day.title
            :v,
      sets:sets,
      notes:notes
    });

    data.activeWorkoutDraft=null;
    bumpLog();
  }
  if(!save()){data=before;showWorkoutError("The session could not be saved. Your workout draft is still available.",null);renderWorkoutDraftCard();return;}workoutDraftLoaded=false;extraExercises=[];initSessionState();renderSessionInputs();document.getElementById("wNotes").value="";renderWork();renderDash();renderNextWorkout();renderBackup();if(wasEdit){endWorkoutEdit();flashSave("Session updated ✓"+(prLines.length?" · PR!":""));return;}const streak=computeStreak();showCelebration(prLines.length?"PR FORGED":"Session Forged",prLines,Object.keys(sets).length+" exercises logged"+(streak>1?" · 🔥 "+streak+"-day streak":""));
});
function renderWork(){
  renderWorkoutDraftCard();renderPRs();renderProgramIdentity();const el=document.getElementById("workHistory");if(!data.workouts.length){el.innerHTML='<div style="padding:18px; font-size:13px; color:var(--dim);">No sessions yet.</div>';return;}
  const sorted=data.workouts.map((s,idx)=>Object.assign({},s,{idx:idx})).sort((a,b)=>b.date.localeCompare(a.date)),months=["January","February","March","April","May","June","July","August","September","October","November","December"],groups={},order=[];
  sorted.forEach(s=>{const key=s.date.slice(0,7);if(!groups[key]){groups[key]=[];order.push(key);}groups[key].push(s);});const cur=todayStr().slice(0,7);
  el.innerHTML=order.map(key=>{const list=groups[key],label=months[Number(key.slice(5,7))-1]+" "+key.slice(0,4),open=key===cur?" open":"";const body=list.map(s=>{const dayObj=program.days.find(p=>p.id===s.day),title=s.title||(dayObj?dayObj.title:s.day);const setsHTML=Object.keys(s.sets).map(name=>{const value=s.sets[name],unknown=isPlainObject(value)&&value.t&&!EXERCISE_SHAPES.includes(value.t);return'<div>'+esc(name)+': <span style="color:var(--text)">'+esc(formatSets(value))+'</span>'+(unknown?'<div class="newer-inline">Newer-version value preserved read-only.</div>':'')+'</div>';}).join("");return'<div style="padding:14px 16px; border-bottom:1px solid var(--border); font-size:12px;"><div style="display:flex; justify-content:space-between;"><span style="font-weight:600; color:var(--ember);">'+fmtDate(s.date)+' — '+esc(title)+'</span><button class="del edtWork" data-i="'+s.idx+'" aria-label="Edit" style="color:var(--dim); margin-right:2px;">✎</button><button class="del delWork" data-i="'+s.idx+'" aria-label="Delete">✕</button></div><div style="color:var(--dim); margin-top:6px; line-height:1.7;">'+setsHTML+(s.notes?'<div style="color:var(--ember); margin-top:3px;">Note: '+esc(s.notes)+'</div>':'')+'</div></div>';}).join("");return'<details'+open+' style="border-bottom:1px solid var(--border);"><summary style="padding:12px 16px; cursor:pointer; font-family:\'Oswald\',sans-serif; font-weight:600; font-size:13px; letter-spacing:.05em; text-transform:uppercase; color:var(--text); list-style:none; display:flex; justify-content:space-between;"><span>'+label+'</span><span style="color:var(--dim); font-size:11px;">'+list.length+' session'+(list.length===1?'':'s')+'</span></summary>'+body+'</details>';}).join("");
  el.querySelectorAll(".delWork").forEach(button=>button.addEventListener("click",()=>{const i=Number(button.dataset.i),removed=data.workouts[i];if(!removed)return;data.workouts.splice(i,1);if(!save()){data.workouts.splice(i,0,removed);renderWork();return;}renderWork();renderDash();offerUndo('Deleted workout "'+(removed.title||removed.day||"session")+'"',()=>{data.workouts.splice(Math.min(i,data.workouts.length),0,removed);save();renderWork();renderDash();flashSave("Workout restored ✓");});}));
  el.querySelectorAll(".edtWork").forEach(button=>button.addEventListener("click",()=>startEditWorkout(Number(button.dataset.i))));
}
let editingWorkoutIdx=null;
function endWorkoutEdit(skipRender){
  editingWorkoutIdx=null;
  document.getElementById("logWorkoutBtn").textContent="Log session";
  document.getElementById("cancelEditWorkBtn").classList.add("hidden");
  renderCardioOptions();

  if(!skipRender){
    extraExercises=[];
    initSessionState();
    renderSessionInputs();
  }
}
function startEditWorkout(i){
  const sess=data.workouts[i];
  if(!sess)return;

  editingWorkoutIdx=i;
  document.getElementById("wDate").value=sess.date;
  document.getElementById("wNotes").value=sess.notes||"";

  if(sess.day==="CARDIO"){
    wDaySel.value="__CARDIO__";
    renderSessionInputs();

    const type=Object.keys(sess.sets)[0];
    const val=String(sess.sets[type]||"");
    const match=val.match(
      /(\d+(?:\.\d+)?)\s*min(?:\s*·\s*(.*))?/
    );

    selectHistoricalCardioType(type);
    document.getElementById("cardioMin").value=match?match[1]:"";
    document.getElementById("cardioDetail").value=
      match&&match[2]?match[2]:"";
  }else{
    const dayObj=program.days.find(d=>d.id===sess.day);
    wDaySel.value=dayObj?sess.day:"__FREE__";

    const planned=dayObj
      ? dayObj.exercises.map(ex=>
          normalizeExerciseName(
            exerciseDescriptor(ex.name,null).name
          )
        )
      : [];

    extraExercises=Object.keys(sess.sets)
      .filter(key=>
        !planned.includes(
          normalizeExerciseName(
            exerciseDescriptor(key,sess.sets[key]).name
          )
        )
      )
      .map(key=>{
        const entry=exerciseDescriptor(key,sess.sets[key]);
        return {
          id:entry.id,
          name:entry.name,
          shape:entry.shape,
          scheme:""
        };
      });

    sessionState=newExerciseNameMap();

    const descriptors=(dayObj
      ? dayObj.exercises.map(ex=>exerciseDescriptorForProgram(ex))
      : []
    ).concat(
      extraExercises.map(ex=>exerciseDescriptorForProgram(ex))
    );

    descriptors.forEach(ex=>{
      const hit=findHistoryValue(sess.sets,ex);
      sessionState[ex.name]=hit
        ? stateFromStoredValue(
            ex,
            hit.value,
            "saved",
            hit.key,
            false
          )
        : blankShapeState(ex);
    });

    renderSessionInputs();
  }

  activeSessionType=wDaySel.value;
  clearWorkoutError();
  document.getElementById("logWorkoutBtn").textContent="Update session";
  document.getElementById("cancelEditWorkBtn").classList.remove("hidden");
  activateView("work","trainingSessionCard",false);
}
document.getElementById("cancelEditWorkBtn").addEventListener("click",()=>{
  clearSessionDraftFields();
  document.getElementById("wDate").value=todayStr();
  endWorkoutEdit();
});


// ---------- My Foods ----------
let mfEditKey = null;
function mfResetForm(){
  mfEditKey = null;
  ["mfName","mfServG","mfCal","mfPro","mfCarb","mfFat","mfBarcode"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("mfFormLabel").textContent = "Create a food";
  document.getElementById("mfSaveBtn").textContent = "Save food";
  document.getElementById("mfCancelBtn").classList.add("hidden");
}
function openMyFoods(){
  renderMyFoods(); renderMFMeals();
  lockScroll();
  document.getElementById("myFoodsOverlay").classList.remove("hidden");
  document.getElementById("myFoodsOverlay").scrollTop = 0;
}
function closeMyFoods(){
  document.getElementById("myFoodsOverlay").classList.add("hidden");
  unlockScroll();
}
document.getElementById("myFoodsOpenBtn").addEventListener("click", openMyFoods);
document.getElementById("myFoodsCloseBtn").addEventListener("click", ()=>{ mfResetForm(); closeMyFoods(); });
document.getElementById("mfCancelBtn").addEventListener("click", mfResetForm);
document.getElementById("mfSaveBtn").addEventListener("click", ()=>{
  const name = document.getElementById("mfName").value.trim();
  const servG = Number(document.getElementById("mfServG").value);
  const cal = Number(document.getElementById("mfCal").value);
  if(!name || !servG || !cal){ flashSave("Need name, serving size, calories", true); return; }
  const pro = Number(document.getElementById("mfPro").value||0);
  const carb = Number(document.getElementById("mfCarb").value||0);
  const fat = Number(document.getElementById("mfFat").value||0);
  const food = { name:name, brand:"My foods",
    cal100: cal/servG*100, pro100: pro/servG*100, carb100: carb/servG*100, fat100: fat/servG*100,
    servingG: servG, servingLabel: servG+"g" };
  const bc = document.getElementById("mfBarcode").value.replace(/\D/g,"");
  const key = bc || mfEditKey || ("cf_"+Date.now());
  const wasEdit = mfEditKey!=null;
  if (mfEditKey && key!==mfEditKey) delete data.myFoods[mfEditKey];
  data.myFoods[key] = food;
  save();
  ackBtn("mfSaveBtn", wasEdit ? "✓ Updated" : "✓ Saved");
  mfResetForm();
  renderMyFoods();
});
function renderMyFoods(){
  const el = document.getElementById("mfList");
  const keys = Object.keys(data.myFoods||{});
  if (!keys.length){
    el.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--dim);">Nothing saved yet. Create one above — or scan an unknown barcode and it lands here automatically.</div>';
    return;
  }
  el.innerHTML = "";
  keys.sort((a,b)=>(data.myFoods[a].name||"").localeCompare(data.myFoods[b].name||"")).forEach(key=>{
    const f = data.myFoods[key];
    const g = f.servingG||100;
    const perServ = Math.round((f.cal100||0)*g/100);
    const row = document.createElement("div");
    row.className = "list-item";
    const body = document.createElement("button");
    body.type = "button";
    body.setAttribute("aria-label","Log "+f.name);
    body.style.cssText = "flex:1; min-width:0; cursor:pointer; background:none; border:0; color:inherit; text-align:left; font:inherit; padding:0;";
    body.innerHTML = '<div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+esc(f.name)+'</div>'
      +'<div style="color:var(--dim); font-size:11px;">'+perServ+' kcal / '+g+'g'+(/^\d{6,}$/.test(key)?' · UPC '+key:'')+'</div>';
    body.addEventListener("click", ()=>{ mfResetForm(); closeMyFoods(); selectFood(f); });
    row.appendChild(body);
    const eBtn = document.createElement("button");
    eBtn.className = "del"; eBtn.style.color = "var(--dim)"; eBtn.textContent = "✎"; eBtn.setAttribute("aria-label","Edit");
    eBtn.addEventListener("click", ()=>{
      mfEditKey = key;
      document.getElementById("mfName").value = f.name;
      document.getElementById("mfServG").value = g;
      document.getElementById("mfCal").value = Math.round((f.cal100||0)*g/100);
      document.getElementById("mfPro").value = Math.round((f.pro100||0)*g/100*10)/10;
      document.getElementById("mfCarb").value = Math.round((f.carb100||0)*g/100*10)/10;
      document.getElementById("mfFat").value = Math.round((f.fat100||0)*g/100*10)/10;
      document.getElementById("mfBarcode").value = /^\d{6,}$/.test(key) ? key : "";
      document.getElementById("mfFormLabel").textContent = "Edit food";
      document.getElementById("mfSaveBtn").textContent = "Update food";
      document.getElementById("mfCancelBtn").classList.remove("hidden");
      document.getElementById("myFoodsOverlay").scrollTop = 0;
    });
    row.appendChild(eBtn);
    const dBtn = document.createElement("button");
    dBtn.className = "del"; dBtn.textContent = "✕"; dBtn.setAttribute("aria-label","Delete");
    dBtn.addEventListener("click", ()=>{
      const removed = data.myFoods[key];
      delete data.myFoods[key];
      if (!save()){ data.myFoods[key]=removed; renderMyFoods(); return; }
      if (mfEditKey===key) mfResetForm();
      renderMyFoods();
      offerUndo('Deleted saved food "'+(removed.name||"food")+'"', ()=>{
        data.myFoods[key]=removed;
        save(); renderMyFoods();
        flashSave("Saved food restored ✓");
      });
    });
    row.appendChild(dBtn);
    el.appendChild(row);
  });
}
function deleteSavedMealAt(i){
  const meal = data.meals && data.meals[i];
  if (!meal) return false;
  data.meals.splice(i,1);
  if (!save()){ data.meals.splice(i,0,meal); return false; }
  if (typeof renderMFMeals==="function") renderMFMeals();
  if (typeof renderMeals==="function") renderMeals();
  offerUndo('Deleted saved meal "'+(meal.name||"meal")+'"', ()=>{
    data.meals.splice(Math.min(i,data.meals.length),0,meal);
    save();
    if (typeof renderMFMeals==="function") renderMFMeals();
    if (typeof renderMeals==="function") renderMeals();
    flashSave("Saved meal restored ✓");
  });
  return true;
}
function renderMFMeals(){
  const el = document.getElementById("mfMeals");
  const meals = data.meals||[];
  if (!meals.length){
    el.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--dim);">No saved meals yet — on the Food page, log a day then tap "Save today as a meal".</div>';
    return;
  }
  el.innerHTML = "";
  meals.forEach((m,i)=>{
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = '<div style="flex:1;"><div style="font-weight:500;">'+esc(m.name)+'</div>'
      +'<div style="color:var(--dim); font-size:11px;">'+m.items.length+' item'+(m.items.length===1?'':'s')+' · '+Math.round(m.items.reduce((sum,x)=>sum+Number(x.cal||0),0))+' kcal</div></div>';
    const rBtn = document.createElement("button");
    rBtn.className = "del"; rBtn.style.color = "var(--dim)"; rBtn.textContent = "✎"; rBtn.setAttribute("aria-label","Rename");
    rBtn.addEventListener("click", ()=>{
      const nn = prompt("Meal name:", m.name);
      if (nn && nn.trim()){ m.name = nn.trim(); save(); renderMFMeals(); renderMeals(); }
    });
    row.appendChild(rBtn);
    const dBtn = document.createElement("button");
    dBtn.className = "del"; dBtn.textContent = "✕"; dBtn.setAttribute("aria-label","Delete");
    dBtn.addEventListener("click", ()=>deleteSavedMealAt(i));
    row.appendChild(dBtn);
    el.appendChild(row);
  });
}
document.getElementById("saveToMyFoodsBtn").addEventListener("click", ()=>{
  mfResetForm();
  document.getElementById("mfName").value = document.getElementById("mName").value.trim();
  document.getElementById("mfServG").value = 100;
  document.getElementById("mfCal").value = document.getElementById("mCal").value;
  document.getElementById("mfPro").value = document.getElementById("mPro").value;
  document.getElementById("mfCarb").value = document.getElementById("mCarb").value;
  document.getElementById("mfFat").value = document.getElementById("mFat").value;
  openMyFoods();
});

// ---- program builder ----
let builderProg = null;
function openBuilder(fromCurrent){
  builderProg = fromCurrent
    ? JSON.parse(JSON.stringify(program))
    : {name:"My Program", days:[{id:"D1", title:"Day 1", exercises:[]}]};
  document.getElementById("bName").value = builderProg.name || "";
  document.getElementById("bErr").classList.add("hidden");
  document.getElementById("builderCard").classList.remove("hidden");
  renderBuilder();
  const bc = document.getElementById("builderCard");
  if (bc.scrollIntoView) bc.scrollIntoView({behavior:"smooth", block:"start"});
}
document.getElementById("editProgBtn").addEventListener("click", ()=>openBuilder(true));
document.getElementById("newProgBtn").addEventListener("click", ()=>openBuilder(false));
document.getElementById("bCancelBtn").addEventListener("click", ()=>{
  builderProg = null;
  document.getElementById("builderCard").classList.add("hidden");
});
document.getElementById("bAddDayBtn").addEventListener("click", ()=>{
  builderProg.days.push({id:"", title:"Day "+(builderProg.days.length+1), exercises:[]});
  renderBuilder();
});
document.getElementById("bSaveBtn").addEventListener("click", ()=>{
  const errEl = document.getElementById("bErr");
  errEl.classList.add("hidden");
  builderProg.name = document.getElementById("bName").value.trim() || "My Program";
  const bad = builderProg.days.findIndex(d=>!d.exercises.length);
  if (builderProg.days.length===0){ errEl.textContent="Add at least one day."; errEl.classList.remove("hidden"); return; }
  if (bad>=0){ errEl.textContent='"'+(builderProg.days[bad].title||("Day "+(bad+1)))+'" has no exercises yet.'; errEl.classList.remove("hidden"); return; }
  builderProg.days.forEach((d,i)=>{ d.id = "D"+(i+1); if(!d.title) d.title = "Day "+(i+1); });
  let candidate;
  try { candidate = validateProgram(cloneJSON(builderProg)); }
  catch(e){ errEl.textContent = e.message; errEl.classList.remove("hidden"); return; }
  const replaced = replaceActiveProgram(candidate);
  if (replaced.cancelled) return;
  if (!replaced.ok){ errEl.textContent = replaced.reason || "Program could not be saved."; errEl.classList.remove("hidden"); return; }
  builderProg = null;
  document.getElementById("builderCard").classList.add("hidden");
  flashSave("Program saved ✓");
});

function renderBuilder(){
  const wrap = document.getElementById("bDays");
  wrap.innerHTML = "";
  builderProg.days.forEach((day, di)=>{
    const dd = document.createElement("div");
    dd.className = "bday";
    // day header: title + tools
    const head = document.createElement("div");
    head.className = "row";
    head.style.marginBottom = "10px";
    const tIn = document.createElement("input");
    tIn.value = day.title || "";
    tIn.setAttribute("aria-label","Program day "+(di+1)+" name");
    tIn.placeholder = "Day name (e.g. Push, Lower A)";
    tIn.addEventListener("input", ()=>{ day.title = tIn.value; });
    head.appendChild(tIn);
    const dup = document.createElement("button");
    dup.className = "xbtn"; dup.textContent = "⧉"; dup.title = "Duplicate day";
    dup.style.flex = "0 0 auto";
    dup.addEventListener("click", ()=>{
      day.title = tIn.value;
      const copy = JSON.parse(JSON.stringify(day));
      copy.title = (copy.title||"Day")+" copy";
      builderProg.days.splice(di+1, 0, copy);
      renderBuilder();
    });
    head.appendChild(dup);
    const del = document.createElement("button");
    del.className = "xbtn"; del.textContent = "✕"; del.title = "Remove day";
    del.style.flex = "0 0 auto"; del.style.color = "var(--warn)";
    del.addEventListener("click", ()=>{ builderProg.days.splice(di,1); renderBuilder(); });
    head.appendChild(del);
    dd.appendChild(head);
    // exercises
    day.exercises.forEach((ex, xi)=>{
      const row = document.createElement("div");
      row.className = "bex";
      const nIn = document.createElement("input");
      nIn.className = "bname"; nIn.value = ex.name; nIn.placeholder = "Exercise";
      nIn.setAttribute("aria-label",(day.title||("Day "+(di+1)))+" exercise "+(xi+1)+" name");
      nIn.addEventListener("input", ()=>{ ex.name = nIn.value; });
      const sIn = document.createElement("input");
      sIn.className = "bscheme"; sIn.value = ex.scheme||""; sIn.placeholder = "e.g. 4×5";
      sIn.setAttribute("aria-label",(day.title||("Day "+(di+1)))+" exercise "+(xi+1)+" set and rep scheme");
      sIn.addEventListener("input", ()=>{ ex.scheme = sIn.value; });
      const up = document.createElement("button");
      up.className = "xbtn"; up.textContent = "↑"; up.setAttribute("aria-label","Move "+ex.name+" up");
      up.addEventListener("click", ()=>{
        if (xi>0){ day.exercises.splice(xi-1,0,day.exercises.splice(xi,1)[0]); renderBuilder(); }
      });
      const dn = document.createElement("button");
      dn.className = "xbtn"; dn.textContent = "↓"; dn.setAttribute("aria-label","Move "+ex.name+" down");
      dn.addEventListener("click", ()=>{
        if (xi<day.exercises.length-1){ day.exercises.splice(xi+1,0,day.exercises.splice(xi,1)[0]); renderBuilder(); }
      });
      const rm = document.createElement("button");
      rm.className = "xbtn"; rm.textContent = "✕"; rm.setAttribute("aria-label","Remove "+ex.name); rm.style.color = "var(--warn)";
      rm.addEventListener("click", ()=>{ day.exercises.splice(xi,1); renderBuilder(); });
      row.appendChild(nIn); row.appendChild(sIn); row.appendChild(up); row.appendChild(dn); row.appendChild(rm);
      dd.appendChild(row);
    });
    // add-exercise row: canonical library + persistent user exercise creation
    const addRow = document.createElement("div");
    addRow.className = "bex builder-add-exercise";
    const sel = document.createElement("select");
    populateExerciseSelect(sel,"",true);
    sel.setAttribute("aria-label","Exercise to add to "+(day.title||("Day "+(di+1))));
    sel.style.flex = "2";
    const custom = document.createElement("input");
    custom.placeholder = "New exercise name"; custom.className = "bname hidden"; custom.setAttribute("aria-label","New exercise name for "+(day.title||("Day "+(di+1))));
    const shapeSel = document.createElement("select");
    shapeSel.className = "hidden"; shapeSel.setAttribute("aria-label","Tracking shape for new exercise");
    EXERCISE_SHAPES.forEach(shape=>{ const o=document.createElement("option"); o.value=shape; o.textContent=shapeGroupLabel(shape); shapeSel.appendChild(o); });
    sel.addEventListener("change", ()=>{ const customOn=sel.value==="__CUSTOM__"; custom.classList.toggle("hidden",!customOn); shapeSel.classList.toggle("hidden",!customOn); });
    const schIn = document.createElement("input");
    schIn.className = "bscheme"; schIn.placeholder = "Optional scheme"; schIn.setAttribute("aria-label","Scheme or note for new exercise");
    const addBtn = document.createElement("button");
    addBtn.className = "xbtn"; addBtn.textContent = "＋ Add";
    addBtn.addEventListener("click", ()=>{
      const err=document.getElementById("bErr");
      let entry;

      if(sel.value==="__CUSTOM__"){
        if(dayContainsExerciseIdentity(day,custom.value)){
          err.textContent=String(custom.value||"Exercise").trim()
            +" is already in this program day.";
          err.classList.remove("hidden");
          return;
        }

        const created=createUserExercise(
          custom.value,
          shapeSel.value
        );

        if(!created.ok){
          err.textContent=created.reason;
          err.classList.remove("hidden");
          return;
        }

        entry=created.entry;
      }else{
        entry=exerciseById(sel.value);
      }

      if(!entry)return;

      if(dayContainsExerciseIdentity(day,entry)){
        err.textContent=entry.name
          +" is already in this program day.";
        err.classList.remove("hidden");
        return;
      }

      day.exercises.push({
        name:entry.name,
        scheme:schIn.value.trim()
      });
      err.textContent="";
      err.classList.add("hidden");
      renderLibraryOptions();
      renderBuilder();
    });
    addRow.appendChild(sel); addRow.appendChild(custom); addRow.appendChild(shapeSel); addRow.appendChild(schIn); addRow.appendChild(addBtn);
    dd.appendChild(addRow);
    wrap.appendChild(dd);
  });
}

// ---- next workout suggestion ----
function nextProgramDay(){
  if (!program.days.length) return null;
  const inProgram = data.workouts
    .filter(s=>program.days.some(d=>d.id===s.day))
    .sort((a,b)=>a.date.localeCompare(b.date));
  if (!inProgram.length) return program.days[0];
  const lastDay = inProgram[inProgram.length-1].day;
  const idx = program.days.findIndex(d=>d.id===lastDay);
  return program.days[(idx+1) % program.days.length];
}
document.getElementById("nextWorkoutBtn").addEventListener("click", ()=>{
  const nd = nextProgramDay();
  if (!nd) return;
  wDaySel.value = nd.id;
  extraExercises = [];
  initSessionState();
  renderSessionInputs();
  activateView("work", "trainingSessionCard", false);
});

// ---- program import/export ----
document.getElementById("importBtn").addEventListener("click", ()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  const errEl = document.getElementById("programErr");
  errEl.classList.add("hidden");
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try {
      const candidate = validateProgram(JSON.parse(reader.result));
      const replaced = replaceActiveProgram(candidate);
      if (replaced.ok) flashSave("Program loaded ✓");
      else if (!replaced.cancelled) throw new Error(replaced.reason || "Program could not be saved.");
    } catch(err){
      errEl.textContent = "Couldn't load that file: "+err.message;
      errEl.classList.remove("hidden");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});
document.getElementById("exportBtn").addEventListener("click", ()=>{
  download((program.name||"blackpyre-program").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".json", JSON.stringify(program,null,2));
  ackBtn("exportBtn", "✓ Downloaded");
});

