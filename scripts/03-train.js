"use strict";
// ================== TRAIN ==================
const wDaySel = document.getElementById("wDay");
document.getElementById("wDate").value = todayStr();

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
  const sel = document.getElementById("cardioType");
  sel.innerHTML = "";
  CARDIO_TYPES.forEach(c=>{ const o=document.createElement("option"); o.value=c; o.textContent=c; sel.appendChild(o); });
}
function exercisePickerBuiltIns(){
  return EXERCISE_LIBRARY
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name));
}

function exercisePickerUserEntries(){
  if (!data || !data.myExercises || typeof data.myExercises!=="object") return [];
  return Object.values(data.myExercises)
    .filter(entry=>entry && entry.deprecated!==true)
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name));
}

function appendExerciseModelOption(group, entry, source){
  const o = document.createElement("option");
  o.value = entry.name;
  o.textContent = entry.name;
  o.dataset.exerciseId = entry.id;
  o.dataset.exerciseShape = entry.shape;
  o.dataset.exerciseSource = source;
  group.appendChild(o);
  return o;
}

function exercisePickerEntryMatchesQuery(entry,query){
  const normalizedQuery =
    normalizeExerciseName(query);

  if (!normalizedQuery) return true;

  return exerciseEntryNames(entry)
    .some(name=>name.indexOf(normalizedQuery)!==-1);
}

function populateUnifiedExercisePicker(sel,options){
  const opts = options || {};

  const query =
    String(opts.query||"")
      .trim();

  const includeCustom =
    opts.includeCustom!==false;

  const previousValue = sel.value;

  sel.innerHTML = "";

  const builtIns =
    exercisePickerBuiltIns()
      .filter(
        entry=>
          exercisePickerEntryMatchesQuery(
            entry,
            query
          )
      );

  let resultCount = 0;

  EXERCISE_SHAPES.forEach(shape=>{
    const entries = builtIns
      .filter(entry=>entry.shape===shape)
      .sort((a,b)=>a.name.localeCompare(b.name));

    if (!entries.length) return;

    const group = document.createElement("optgroup");
    group.label =
      EXERCISE_SHAPE_LABELS[shape] || shape;

    group.dataset.exerciseShape = shape;
    group.dataset.exerciseSource = "builtin";

    entries.forEach(entry=>{
      appendExerciseModelOption(
        group,
        entry,
        "builtin"
      );

      resultCount++;
    });

    sel.appendChild(group);
  });

  const mine =
    exercisePickerUserEntries()
      .filter(
        entry=>
          exercisePickerEntryMatchesQuery(
            entry,
            query
          )
      );

  if (mine.length){
    const userGroup =
      document.createElement("optgroup");

    userGroup.label = "My Exercises";
    userGroup.dataset.exerciseSource = "user";

    mine.forEach(entry=>{
      appendExerciseModelOption(
        userGroup,
        entry,
        "user"
      );

      resultCount++;
    });

    sel.appendChild(userGroup);
  }

  if (query && resultCount===0){
    const emptyGroup =
      document.createElement("optgroup");

    emptyGroup.label = "Search results";

    const empty =
      document.createElement("option");

    empty.value = "";
    empty.textContent = "No matching exercises";
    empty.disabled = true;
    empty.selected = true;

    emptyGroup.appendChild(empty);
    sel.appendChild(emptyGroup);
  }

  if (includeCustom){
    const customGroup =
      document.createElement("optgroup");

    customGroup.label = "Custom";

    const custom =
      document.createElement("option");

    custom.value = "__CUSTOM__";
    custom.textContent = "Type my own…";

    customGroup.appendChild(custom);
    sel.appendChild(customGroup);
  }

  if (
    previousValue
    && [...sel.options]
      .some(option=>option.value===previousValue)
  ){
    sel.value = previousValue;
  }

  return {
    count:resultCount,
    query:query
  };
}


const EXERCISE_SHAPE_LABELS = {
  lift:"Weight × reps",
  reps:"Reps (weight optional)",
  timeDist:"Time / distance",
  carry:"Weight + distance",
  rounds:"Rounds / intervals",
  text:"Free text"
};

function appendExerciseShapeOptions(sel){
  sel.innerHTML = "";
  EXERCISE_SHAPES.forEach(shape=>{
    const o = document.createElement("option");
    o.value = shape;
    o.textContent = EXERCISE_SHAPE_LABELS[shape] || shape;
    sel.appendChild(o);
  });
  return sel;
}

function makeExerciseShapeSelect(label){
  const sel = document.createElement("select");
  appendExerciseShapeOptions(sel);
  sel.value = "lift";
  sel.setAttribute("aria-label",label || "Custom exercise tracking type");
  return sel;
}

function ensureFreestyleCustomShapeSelect(){
  let sel = document.getElementById("addExCustomShape");
  if (sel) return sel;

  const nameInput = document.getElementById("addExCustom");
  sel = makeExerciseShapeSelect("Custom exercise tracking type");
  sel.id = "addExCustomShape";
  sel.classList.add("hidden");
  sel.style.marginTop = "8px";

  nameInput.insertAdjacentElement("afterend",sel);
  return sel;
}

function setFreestyleCustomControlsVisible(visible){
  const nameInput = document.getElementById("addExCustom");
  const shapeSel = ensureFreestyleCustomShapeSelect();

  nameInput.classList.toggle("hidden",!visible);
  shapeSel.classList.toggle("hidden",!visible);
}

function userExerciseIdBase(name){
  const slug = normalizeExerciseName(name)
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,60);

  return "u:"+(slug || "exercise");
}

function nextUserExerciseId(name){
  const base = userExerciseIdBase(name);
  if (!Object.prototype.hasOwnProperty.call(data.myExercises,base)) return base;

  let n = 2;
  while (Object.prototype.hasOwnProperty.call(data.myExercises,base+"-"+n)) n++;
  return base+"-"+n;
}

function createUserExercise(name,shape){
  const cleanName = String(name||"").trim().replace(/\s+/g," ");

  if (!cleanName){
    return {ok:false,reason:"Type the exercise name."};
  }

  if (!EXERCISE_SHAPES.includes(shape)){
    return {ok:false,reason:"Choose a valid tracking type."};
  }

  const collision = exerciseModelEntryForName(cleanName);
  if (collision){
    return {
      ok:false,
      reason:'"'+cleanName+'" already exists in your exercise library.'
    };
  }

  const previous = cloneJSON(data.myExercises || {});
  const id = nextUserExerciseId(cleanName);

  const entry = {
    id:id,
    name:cleanName,
    shape:shape,
    tags:[],
    aliases:[],
    formerNames:[],
    muscles:{primary:[],secondary:[]},
    equipment:[],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  };

  data.myExercises[id] = entry;

  try {
    validateUserExercisesMap(data.myExercises);
  } catch(e){
    data.myExercises = previous;
    return {
      ok:false,
      reason:e && e.message ? e.message : "The custom exercise is invalid."
    };
  }

  if (!save()){
    data.myExercises = previous;
    return {
      ok:false,
      reason:"The custom exercise could not be saved."
    };
  }

  return {ok:true,entry:entry};
}

function userExerciseEntryById(id){
  if (!data || !data.myExercises || typeof data.myExercises!=="object"){
    return null;
  }

  const entry = data.myExercises[id];

  return entry && entry.id===id ? entry : null;
}

function userExerciseNameCollision(name,excludedId){
  const normalized = normalizeExerciseName(name);

  if (!normalized) return null;

  const builtIns =
    typeof EXERCISE_LIBRARY!=="undefined"
    && Array.isArray(EXERCISE_LIBRARY)
      ? EXERCISE_LIBRARY
      : [];

  const users =
    data
    && data.myExercises
    && typeof data.myExercises==="object"
      ? Object.values(data.myExercises)
      : [];

  return builtIns.concat(users).find(entry=>
    entry
    && entry.id!==excludedId
    && exerciseEntryNames(entry).indexOf(normalized)!==-1
  ) || null;
}

function userExerciseReferenceSummary(id){
  const entry = userExerciseEntryById(id);

  if (!entry){
    return {
      id:id,
      name:"",
      counts:{
        program:0,
        history:0,
        draft:0,
        builder:0,
        session:0
      },
      total:0,
      protected:false,
      details:{
        program:[],
        history:[],
        draft:[],
        builder:[],
        session:[]
      }
    };
  }

  const accepted = exerciseEntryNames(entry);

  const matches = value=>{
    const normalized = normalizeExerciseName(
      String(value||"").replace(/^\[Cardio\]\s*/,"")
    );

    return !!normalized && accepted.indexOf(normalized)!==-1;
  };

  const details = {
    program:[],
    history:[],
    draft:[],
    builder:[],
    session:[]
  };

  if (program && Array.isArray(program.days)){
    program.days.forEach(day=>{
      (day.exercises||[]).forEach(ex=>{
        if (ex && matches(ex.name)){
          details.program.push(
            (day.title||day.id||"Program day")+" · "+ex.name
          );
        }
      });
    });
  }

  if (data && Array.isArray(data.workouts)){
    data.workouts.forEach(workout=>{
      Object.keys((workout && workout.sets)||{}).forEach(name=>{
        if (matches(name)){
          details.history.push(
            (workout.date||"Saved workout")+" · "+name
          );
        }
      });
    });
  }

  const draft =
    data
    && data.activeWorkoutDraft
    && data.activeWorkoutDraft.sets
      ? data.activeWorkoutDraft
      : null;

  if (draft){
    Object.keys(draft.sets||{}).forEach(name=>{
      if (matches(name)){
        details.draft.push(
          (draft.title||draft.date||"Saved draft")+" · "+name
        );
      }
    });
  }

  const builderCard = document.getElementById("builderCard");

  if (
    typeof builderProg!=="undefined"
    && builderProg
    && Array.isArray(builderProg.days)
    && builderCard
    && !builderCard.classList.contains("hidden")
  ){
    builderProg.days.forEach(day=>{
      (day.exercises||[]).forEach(ex=>{
        if (ex && matches(ex.name)){
          details.builder.push(
            (day.title||day.id||"Program builder")+" · "+ex.name
          );
        }
      });
    });
  }

  const transientNames = [];

  if (typeof sessionState!=="undefined" && sessionState){
    transientNames.push.apply(
      transientNames,
      Object.keys(sessionState)
    );
  }

  if (typeof extraExercises!=="undefined" && Array.isArray(extraExercises)){
    extraExercises.forEach(ex=>{
      if (ex && ex.name) transientNames.push(ex.name);
    });
  }

  Array.from(new Set(transientNames)).forEach(name=>{
    if (matches(name)) details.session.push(name);
  });

  const counts = {
    program:details.program.length,
    history:details.history.length,
    draft:details.draft.length,
    builder:details.builder.length,
    session:details.session.length
  };

  const total =
    counts.program
    + counts.history
    + counts.draft
    + counts.builder
    + counts.session;

  return {
    id:entry.id,
    name:entry.name,
    counts:counts,
    total:total,
    protected:total>0,
    details:details
  };
}

function listUserExercisesForManagement(){
  if (!data || !data.myExercises || typeof data.myExercises!=="object"){
    return [];
  }

  return Object.values(data.myExercises)
    .slice()
    .sort((a,b)=>a.name.localeCompare(b.name))
    .map(entry=>({
      entry:cloneJSON(entry),
      references:userExerciseReferenceSummary(entry.id)
    }));
}

function refreshUserExerciseSurfaces(){
  if (document.getElementById("addExSel")){
    renderLibraryOptions();
  }

  if (typeof renderMyExercisesManager==="function"){
    renderMyExercisesManager();
  }
}

function renameUserExercise(id,newName){
  const entry = userExerciseEntryById(id);

  if (!entry){
    return {ok:false,reason:"That custom exercise no longer exists."};
  }

  const cleanName =
    String(newName||"")
      .trim()
      .replace(/\s+/g," ");

  if (!cleanName){
    return {ok:false,reason:"Type the new exercise name."};
  }

  const collision =
    userExerciseNameCollision(cleanName,id);

  if (collision){
    return {
      ok:false,
      reason:'"'+cleanName+'" already exists in your exercise library.'
    };
  }

  const previous = cloneJSON(data.myExercises);
  const next = cloneJSON(entry);
  const oldNormalized = normalizeExerciseName(entry.name);
  const newNormalized = normalizeExerciseName(cleanName);

  next.name = cleanName;

  next.aliases = Array.from(
    new Set(
      (next.aliases||[])
        .map(normalizeExerciseName)
        .filter(name=>
          !!name
          && name!==newNormalized
          && name!==oldNormalized
        )
    )
  );

  next.formerNames = Array.from(
    new Set(
      (next.formerNames||[])
        .map(normalizeExerciseName)
        .filter(name=>!!name && name!==newNormalized)
    )
  );

  if (
    oldNormalized
    && oldNormalized!==newNormalized
    && next.formerNames.indexOf(oldNormalized)===-1
  ){
    next.formerNames.push(oldNormalized);
  }

  data.myExercises[id] = next;

  try {
    validateUserExercisesMap(data.myExercises);
  } catch(error){
    data.myExercises = previous;

    return {
      ok:false,
      reason:
        error && error.message
          ? error.message
          : "The renamed exercise is invalid."
    };
  }

  if (!save()){
    data.myExercises = previous;

    return {
      ok:false,
      reason:"The exercise rename could not be saved."
    };
  }

  refreshUserExerciseSurfaces();

  return {
    ok:true,
    entry:cloneJSON(next),
    references:userExerciseReferenceSummary(id)
  };
}

function setUserExerciseArchived(id,archived){
  const entry = userExerciseEntryById(id);

  if (!entry){
    return {ok:false,reason:"That custom exercise no longer exists."};
  }

  const shouldArchive = archived===true;

  if (entry.deprecated===shouldArchive){
    return {
      ok:true,
      unchanged:true,
      entry:cloneJSON(entry),
      references:userExerciseReferenceSummary(id)
    };
  }

  const previous = cloneJSON(data.myExercises);
  const next = cloneJSON(entry);

  next.deprecated = shouldArchive;
  data.myExercises[id] = next;

  try {
    validateUserExercisesMap(data.myExercises);
  } catch(error){
    data.myExercises = previous;

    return {
      ok:false,
      reason:
        error && error.message
          ? error.message
          : "The exercise archive state is invalid."
    };
  }

  if (!save()){
    data.myExercises = previous;

    return {
      ok:false,
      reason:
        shouldArchive
          ? "The exercise could not be archived."
          : "The exercise could not be restored."
    };
  }

  refreshUserExerciseSurfaces();

  return {
    ok:true,
    entry:cloneJSON(next),
    references:userExerciseReferenceSummary(id)
  };
}

function deleteUserExercisePermanently(id){
  const entry = userExerciseEntryById(id);

  if (!entry){
    return {ok:false,reason:"That custom exercise no longer exists."};
  }

  const references = userExerciseReferenceSummary(id);

  if (references.protected){
    const labels = [];

    if (references.counts.program) labels.push("your program");
    if (references.counts.history) labels.push("workout history");
    if (references.counts.draft) labels.push("the saved workout draft");
    if (references.counts.builder) labels.push("the open program builder");
    if (references.counts.session) labels.push("the current session");

    return {
      ok:false,
      protected:true,
      references:references,
      reason:
        "This exercise is still used by "
        +labels.join(", ")
        +". Archive it instead."
    };
  }

  const previous = cloneJSON(data.myExercises);

  delete data.myExercises[id];

  try {
    validateUserExercisesMap(data.myExercises);
  } catch(error){
    data.myExercises = previous;

    return {
      ok:false,
      reason:
        error && error.message
          ? error.message
          : "The remaining custom exercises are invalid."
    };
  }

  if (!save()){
    data.myExercises = previous;

    return {
      ok:false,
      reason:"The exercise could not be permanently deleted."
    };
  }

  refreshUserExerciseSurfaces();

  return {
    ok:true,
    deletedId:id,
    deletedName:entry.name
  };
}

function myExerciseReferenceText(references){
  if (!references || !references.protected){
    return "Unused — permanent deletion is available.";
  }

  const parts = [];

  if (references.counts.program){
    parts.push(
      references.counts.program
      +" program reference"
      +(references.counts.program===1 ? "" : "s")
    );
  }

  if (references.counts.history){
    parts.push(
      references.counts.history
      +" history reference"
      +(references.counts.history===1 ? "" : "s")
    );
  }

  if (references.counts.draft){
    parts.push(
      references.counts.draft
      +" saved-draft reference"
      +(references.counts.draft===1 ? "" : "s")
    );
  }

  if (references.counts.builder){
    parts.push(
      references.counts.builder
      +" open-builder reference"
      +(references.counts.builder===1 ? "" : "s")
    );
  }

  if (references.counts.session){
    parts.push(
      references.counts.session
      +" current-session reference"
      +(references.counts.session===1 ? "" : "s")
    );
  }

  return "Protected by "+parts.join(", ")+".";
}

function ensureMyExercisesManagerStyles(){
  let style =
    document.querySelector("#myExercisesManagerStyles");

  if (style) return style;

  style = document.createElement("style");
  style.id = "myExercisesManagerStyles";

  style.textContent = [
    "#myExercisesOverlay{",
    "position:fixed;",
    "inset:0;",
    "z-index:260;",
    "overflow:auto;",
    "padding:calc(14px + env(safe-area-inset-top,0px))",
    " 12px calc(20px + env(safe-area-inset-bottom,0px));",
    "background:rgba(16,18,21,.97);",
    "}",
    "#myExercisesOverlay.hidden{display:none!important;}",
    ".myex-shell{",
    "width:100%;",
    "max-width:720px;",
    "margin:0 auto;",
    "}",
    ".myex-head{",
    "position:sticky;",
    "top:0;",
    "z-index:2;",
    "display:flex;",
    "align-items:center;",
    "justify-content:space-between;",
    "gap:12px;",
    "padding:10px 0 12px;",
    "background:rgba(16,18,21,.97);",
    "}",
    ".myex-title{",
    "font-family:'Oswald',sans-serif;",
    "font-size:16px;",
    "font-weight:700;",
    "line-height:1.1;",
    "}",
    ".myex-list{",
    "display:grid;",
    "gap:12px;",
    "margin-top:14px;",
    "}",
    ".myex-card{",
    "padding:14px;",
    "border:1px solid var(--border);",
    "border-radius:12px;",
    "background:var(--panel);",
    "}",
    ".myex-card.archived{opacity:.82;}",
    ".myex-name{",
    "font-family:'Oswald',sans-serif;",
    "font-size:14px;",
    "font-weight:700;",
    "}",
    ".myex-badges{",
    "display:flex;",
    "flex-wrap:wrap;",
    "gap:6px;",
    "margin:8px 0;",
    "}",
    ".myex-badge{",
    "display:inline-flex;",
    "align-items:center;",
    "min-height:28px;",
    "padding:4px 8px;",
    "border:1px solid var(--border);",
    "border-radius:999px;",
    "font-size:11px;",
    "color:var(--dim);",
    "}",
    ".myex-badge.shape{",
    "border-color:rgba(var(--ember-rgb),.5);",
    "color:var(--ember);",
    "}",
    ".myex-ref{",
    "margin:8px 0 10px;",
    "font-size:12px;",
    "line-height:1.5;",
    "color:var(--dim);",
    "}",
    ".myex-ref.protected{color:var(--warn);}",
    ".myex-rename{",
    "display:grid;",
    "grid-template-columns:minmax(0,1fr) auto;",
    "gap:8px;",
    "align-items:center;",
    "}",
    ".myex-actions{",
    "display:flex;",
    "flex-wrap:wrap;",
    "gap:8px;",
    "margin-top:10px;",
    "}",
    ".myex-actions button,",
    ".myex-rename button,",
    "#myExercisesCloseBtn,",
    "#manageMyExercisesBtn{",
    "min-height:44px;",
    "}",
    ".myex-actions button{flex:1 1 150px;}",
    ".myex-delete{color:var(--warn)!important;}",
    ".myex-empty{",
    "padding:22px 16px;",
    "border:1px dashed var(--border);",
    "border-radius:12px;",
    "text-align:center;",
    "color:var(--dim);",
    "}",
    "@media(max-width:420px){",
    ".myex-rename{grid-template-columns:1fr;}",
    ".myex-rename button{width:100%;}",
    ".myex-title{font-size:16px;}",
    "}"
  ].join("");

  document.head.appendChild(style);

  return style;
}

function closeMyExercisesManager(){
  const overlay =
    document.querySelector("#myExercisesOverlay");

  if (!overlay) return;

  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden","true");

  const trigger =
    document.querySelector("#manageMyExercisesBtn");

  if (trigger && typeof trigger.focus==="function"){
    trigger.focus();
  }
}

function ensureMyExercisesManagerOverlay(){
  ensureMyExercisesManagerStyles();

  let overlay =
    document.querySelector("#myExercisesOverlay");

  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "myExercisesOverlay";
  overlay.className = "hidden";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");
  overlay.setAttribute(
    "aria-labelledby",
    "myExercisesTitle"
  );
  overlay.setAttribute("aria-hidden","true");
  overlay.tabIndex = -1;

  const shell = document.createElement("div");
  shell.className = "myex-shell";

  const head = document.createElement("div");
  head.className = "myex-head";

  const heading = document.createElement("div");

  const title = document.createElement("div");
  title.id = "myExercisesTitle";
  title.className = "myex-title";
  title.textContent = "Manage My Exercises";

  const subtitle = document.createElement("div");
  subtitle.className = "note";
  subtitle.textContent =
    "Rename or archive custom exercises without changing "
    +"their tracking type. Referenced exercises cannot be "
    +"permanently deleted.";

  heading.appendChild(title);
  heading.appendChild(subtitle);

  const close = document.createElement("button");
  close.id = "myExercisesCloseBtn";
  close.className = "btn ghost small";
  close.type = "button";
  close.textContent = "Close";
  close.setAttribute(
    "aria-label",
    "Close Manage My Exercises"
  );

  close.addEventListener(
    "click",
    closeMyExercisesManager
  );

  head.appendChild(heading);
  head.appendChild(close);

  const list = document.createElement("div");
  list.id = "myExercisesManagerList";
  list.className = "myex-list";

  shell.appendChild(head);
  shell.appendChild(list);
  overlay.appendChild(shell);
  document.body.appendChild(overlay);

  overlay.addEventListener("click",event=>{
    if (event.target===overlay){
      closeMyExercisesManager();
    }
  });

  overlay.addEventListener("keydown",event=>{
    if (event.key==="Escape"){
      event.preventDefault();
      closeMyExercisesManager();
    }
  });

  return overlay;
}

function ensureMyExercisesManagerButton(){
  let button =
    document.querySelector("#manageMyExercisesBtn");

  if (button) return button;

  const anchor =
    document.getElementById("trainingToolsCard");

  if (!anchor || !anchor.parentElement) return null;

  let card =
    document.querySelector("#myExercisesLaunchCard");

  if (!card){
    card = document.createElement("div");
    card.id = "myExercisesLaunchCard";
    card.className =
      "card my-exercises-launch-card";

    const title = document.createElement("div");
    title.className =
      "label my-exercises-launch-title";
    title.textContent = "My Exercises";

    const copy = document.createElement("div");
    copy.className =
      "my-exercises-launch-copy";
    copy.textContent =
      "Create, rename, archive, restore, or remove "
      +"your custom exercises.";

    button = document.createElement("button");
    button.id = "manageMyExercisesBtn";
    button.className = "btn ghost small";
    button.type = "button";
    button.textContent = "Manage My Exercises";
    button.style.width = "100%";

    button.addEventListener(
      "click",
      openMyExercisesManager
    );

    card.appendChild(title);
    card.appendChild(copy);
    card.appendChild(button);

    anchor.insertAdjacentElement(
      "afterend",
      card
    );
  }

  return (
    button
    || card.querySelector("#manageMyExercisesBtn")
  );
}
function renderMyExercisesManager(){
  const overlay =
    ensureMyExercisesManagerOverlay();

  const list =
    document.querySelector("#myExercisesManagerList");

  if (!overlay || !list) return;

  list.textContent = "";

  const records =
    listUserExercisesForManagement()
      .sort((a,b)=>{
        const archivedA =
          a.entry.deprecated===true ? 1 : 0;

        const archivedB =
          b.entry.deprecated===true ? 1 : 0;

        return archivedA-archivedB
          || a.entry.name.localeCompare(b.entry.name);
      });

  if (!records.length){
    const empty = document.createElement("div");
    empty.className = "myex-empty";
    empty.textContent =
      "No custom exercises yet. Create one from "
      +"Freestyle or the Program Builder.";

    list.appendChild(empty);
    return;
  }

  records.forEach(record=>{
    const entry = record.entry;
    const references = record.references;
    const archived = entry.deprecated===true;

    const card = document.createElement("section");
    card.className =
      "myex-card"+(archived ? " archived" : "");
    card.dataset.exerciseId = entry.id;

    const name = document.createElement("div");
    name.className = "myex-name";
    name.textContent = entry.name;

    const badges = document.createElement("div");
    badges.className = "myex-badges";

    const shape = document.createElement("span");
    shape.className = "myex-badge shape";
    shape.textContent =
      "Tracking: "
      +(EXERCISE_SHAPE_LABELS[entry.shape] || entry.shape)
      +" · locked";

    shape.setAttribute(
      "aria-label",
      "Tracking type "
      +(EXERCISE_SHAPE_LABELS[entry.shape] || entry.shape)
      +", cannot be changed"
    );

    const idBadge = document.createElement("span");
    idBadge.className = "myex-badge";
    idBadge.textContent = entry.id;

    badges.appendChild(shape);
    badges.appendChild(idBadge);

    if (archived){
      const archivedBadge =
        document.createElement("span");

      archivedBadge.className = "myex-badge";
      archivedBadge.textContent = "Archived";
      badges.appendChild(archivedBadge);
    }

    const former = document.createElement("div");
    former.className = "note";

    if ((entry.formerNames||[]).length){
      former.textContent =
        "Former names: "
        +entry.formerNames.join(", ");
    } else {
      former.textContent = "Former names: none";
    }

    const referenceText =
      document.createElement("div");

    referenceText.className =
      "myex-ref"
      +(references.protected ? " protected" : "");

    referenceText.textContent =
      myExerciseReferenceText(references);

    const renameRow = document.createElement("div");
    renameRow.className = "myex-rename";

    const renameInput =
      document.createElement("input");

    renameInput.type = "text";
    renameInput.value = entry.name;
    renameInput.maxLength = 120;

    renameInput.setAttribute(
      "aria-label",
      "New name for "+entry.name
    );

    const renameButton =
      document.createElement("button");

    renameButton.className = "btn ghost small";
    renameButton.type = "button";
    renameButton.textContent = "Rename";
    renameButton.dataset.action = "rename";

    renameButton.setAttribute(
      "aria-label",
      "Rename "+entry.name
    );

    const performRename = ()=>{
      const result =
        renameUserExercise(
          entry.id,
          renameInput.value
        );

      if (!result.ok){
        flashSave(result.reason,true);
        renameInput.focus();
        return;
      }

      flashSave("Exercise renamed ✓");
    };

    renameButton.addEventListener(
      "click",
      performRename
    );

    renameInput.addEventListener("keydown",event=>{
      if (event.key==="Enter"){
        event.preventDefault();
        performRename();
      }
    });

    renameRow.appendChild(renameInput);
    renameRow.appendChild(renameButton);

    const actions = document.createElement("div");
    actions.className = "myex-actions";

    const archiveButton =
      document.createElement("button");

    archiveButton.className = "btn ghost small";
    archiveButton.type = "button";

    archiveButton.dataset.action =
      archived ? "restore" : "archive";

    archiveButton.textContent =
      archived ? "Restore" : "Archive";

    archiveButton.setAttribute(
      "aria-label",
      (archived ? "Restore " : "Archive ")
      +entry.name
    );

    archiveButton.addEventListener("click",()=>{
      if (
        !archived
        && !confirm(
          'Archive "'
          +entry.name
          +'"?\n\nIt will leave exercise pickers but '
          +'will remain available to existing programs, '
          +'history, and saved drafts.'
        )
      ){
        return;
      }

      const result =
        setUserExerciseArchived(
          entry.id,
          !archived
        );

      if (!result.ok){
        flashSave(result.reason,true);
        return;
      }

      flashSave(
        archived
          ? "Exercise restored ✓"
          : "Exercise archived ✓"
      );
    });

    const deleteButton =
      document.createElement("button");

    deleteButton.className =
      "btn ghost small myex-delete";

    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.disabled = references.protected;

    deleteButton.textContent =
      references.protected
        ? "Protected"
        : "Delete permanently";

    deleteButton.setAttribute(
      "aria-label",
      references.protected
        ? entry.name
          +" is protected from permanent deletion"
        : "Permanently delete "+entry.name
    );

    deleteButton.title =
      references.protected
        ? myExerciseReferenceText(references)
        : "This exercise is unused and can be deleted.";

    deleteButton.addEventListener("click",()=>{
      if (references.protected) return;

      if (
        !confirm(
          'Permanently delete "'
          +entry.name
          +'"?\n\nThis cannot be undone.'
        )
      ){
        return;
      }

      const result =
        deleteUserExercisePermanently(entry.id);

      if (!result.ok){
        flashSave(result.reason,true);
        return;
      }

      flashSave("Exercise permanently deleted");
    });

    actions.appendChild(archiveButton);
    actions.appendChild(deleteButton);

    card.appendChild(name);
    card.appendChild(badges);
    card.appendChild(former);
    card.appendChild(referenceText);
    card.appendChild(renameRow);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

function openMyExercisesManager(){
  const overlay =
    ensureMyExercisesManagerOverlay();

  renderMyExercisesManager();

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden","false");
  overlay.scrollTop = 0;

  const close =
    document.querySelector("#myExercisesCloseBtn");

  if (close && typeof close.focus==="function"){
    close.focus();
  }
}

function renderLibraryOptions(){
  const picker =
    document.getElementById("addExSel");

  const search =
    document.getElementById("addExSearch");

  populateUnifiedExercisePicker(
    picker,
    {
      query:search ? search.value : ""
    }
  );

  ensureFreestyleCustomShapeSelect();

  setFreestyleCustomControlsVisible(
    picker.value==="__CUSTOM__"
  );

  ensureMyExercisesManagerButton();
}

function extraExerciseIndex(name){
  return extraExercises.findIndex(ex=>ex && ex.name===name);
}

function removeUnsavedExtraExercise(name){
  const idx = extraExerciseIndex(name);
  if (idx<0) return false;

  const st = sessionState[name];

  if (st && st.status==="saved" && st.saved!=null){
    showWorkoutError(
      name.replace("[Cardio] ","")
        +" — this exercise is already saved in the workout draft. Edit it rather than removing it here.",
      null
    );
    return false;
  }

  extraExercises.splice(idx,1);
  delete sessionState[name];

  clearWorkoutError();
  renderSessionInputs();
  return true;
}

let activeSessionType = null;
function sessionDraftHasMeaningfulWork(){
  if (typeof editingWorkoutIdx!=="undefined" && editingWorkoutIdx!=null) return true;
  if (document.getElementById("wNotes").value.trim()) return true;
  if (document.getElementById("cardioMin").value || document.getElementById("cardioDetail").value.trim()) return true;
  if (extraExercises.length || Object.keys(sessionSwaps).length) return true;
  return Object.keys(sessionState).some(name=>{
    const st = sessionState[name];
    if (st.saved!=null) return true;
    if (st.mode==="text") return !!st.textTouched && !!st.text.trim();
    if (st.mode==="timeDist" || st.mode==="carry" || st.mode==="rounds") return !!st.typedTouched;
    if (st.mode==="future") return false;
    return st.rows.some(r=>r.touched && (r.w!=="" || r.r!==""));
  });
}
function clearSessionDraftFields(){
  document.getElementById("wNotes").value = "";
  document.getElementById("cardioMin").value = "";
  document.getElementById("cardioDetail").value = "";
}
wDaySel.addEventListener("change", ()=>{
  const nextType = wDaySel.value;
  if (activeSessionType!==null && nextType!==activeSessionType && sessionDraftHasMeaningfulWork()){
    if (!confirm("Discard this in-progress session and switch session type?")){
      wDaySel.value = activeSessionType;
      return;
    }
    if (workoutDraftLoaded && !discardWorkoutDraft(false,false)){
      wDaySel.value = activeSessionType;
      return;
    }
    clearSessionDraftFields();
  }
  if (typeof editingWorkoutIdx!=="undefined" && editingWorkoutIdx!=null) endWorkoutEdit(true);
  extraExercises=[];
  initSessionState();
  clearWorkoutError();
  renderSessionInputs();
});

function currentDayExercises(){
  const v = wDaySel.value;
  if (v==="__CARDIO__" || v==="__FREE__") return [];
  const day = program.days.find(p=>p.id===v);
  return day ? day.exercises : [];
}

function renderProgramIdentity(){
  const name = document.getElementById("programName");
  const dayLine = document.getElementById("programDayName");
  if (name) name.textContent = program.name || "Unnamed program";
  if (!dayLine) return;
  const v = wDaySel.value;
  if (v==="__CARDIO__") dayLine.textContent = "Selected session: Cardio / Conditioning";
  else if (v==="__FREE__") dayLine.textContent = "Selected session: Freestyle";
  else {
    const day = program.days.find(p=>p.id===v);
    dayLine.textContent = day ? "Selected session: "+day.title : "Select a session below";
  }
}
function setProgramManagerOpen(open){
  const panel = document.getElementById("programToolsCard");
  const button = document.getElementById("programManageBtn");
  if (!panel || !button) return;
  panel.classList.toggle("hidden", !open);
  button.setAttribute("aria-expanded", open ? "true" : "false");
  button.textContent = open ? "Close" : "Manage";
}
document.getElementById("programManageBtn").addEventListener("click", ()=>{
  const panel = document.getElementById("programToolsCard");
  setProgramManagerOpen(panel.classList.contains("hidden"));
});
document.getElementById("programManageCloseBtn").addEventListener("click", ()=>setProgramManagerOpen(false));


function replaceActiveProgram(candidate,options){
  const opts = options || {};
  let next;
  try { next = validateProgram(cloneJSON(candidate)); }
  catch(e){ return {ok:false, reason:e.message}; }
  const currentName = (program && program.name) || "Unnamed program";
  const nextName = next.name || "Unnamed program";
  const draftNote = data.activeWorkoutDraft ? "\n\nYour saved workout draft will remain available." : "";
  if (!opts.confirmed && !confirm('Replace current program "'+currentName+'" with "'+nextName+'"?\n\nWorkout history will stay intact.'+draftNote)) return {ok:false, cancelled:true};
  const previous = program;
  program = next;
  if (!saveProgram()){
    program = previous;
    return {ok:false, reason:"The new program could not be saved."};
  }
  extraExercises = [];
  initSessionState();
  renderDayOptions();
  renderSessionInputs();
  renderWork();
  renderDash();
  if (typeof renderNextWorkout==="function") renderNextWorkout();
  return {ok:true, program:next};
}

// ---------- set-row engine ----------
let sessionState = {}; // exName -> editable/saved workout state
let workoutDraftLoaded = false;

// v76 stored workout-value discriminator.
//
// Legacy workout values remain valid forever:
//   string                -> legacy text
//   [{w,r}, ...]          -> lift/reps rows
//
// v76 typed objects carry a `t` discriminator. Known typed values are handled
// explicitly. An object with an unknown future `t` is never coerced to text,
// dropped, or rewritten; later editor work treats it as preserved/read-only.
const KNOWN_TYPED_WORKOUT_VALUE_TYPES = new Set(["timeDist","carry","rounds"]);

function isTypedWorkoutValue(val){
  return !!val
    && typeof val === "object"
    && !Array.isArray(val)
    && typeof val.t === "string"
    && !!val.t;
}

function workoutValueKind(val){
  if (Array.isArray(val)) return "rows";
  if (typeof val === "string") return "legacyText";
  if (isTypedWorkoutValue(val)){
    return KNOWN_TYPED_WORKOUT_VALUE_TYPES.has(val.t) ? val.t : "future";
  }
  if (val == null) return "empty";
  return "unknown";
}

function cloneWorkoutValue(val){
  if (val && typeof val === "object") return cloneJSON(val);
  return val;
}

function newerWorkoutValueNotice(val){
  const type = isTypedWorkoutValue(val) ? val.t : "";
  return "Saved by a newer BlackPyre version"
    +(type ? " ("+type+")" : "")
    +". This entry is preserved read-only.";
}

function toRows(val){
  // Converts only row-compatible stored values into editable rows.
  // Reps-only rows intentionally preserve an absent weight.
  if (Array.isArray(val)){
    return val.map(s=>({
      w:s && Object.prototype.hasOwnProperty.call(s,"w") ? s.w : undefined,
      r:s ? s.r : undefined,
      done:false,
      touched:false
    }));
  }
  if (typeof val === "string"){
    const rows = [];
    const re = /(\d+(?:\.\d+)?)\s*[x\u00d7]\s*(\d+)/g;
    let m;
    while((m = re.exec(val)) !== null){
      rows.push({w:parseFloat(m[1]), r:parseInt(m[2],10), done:false, touched:false});
    }
    return rows;
  }
  return [];
}

function formatWorkoutRow(row){
  if (!row || typeof row !== "object") return "";
  const hasW = row.w !== undefined && row.w !== null && row.w !== "";
  const hasR = row.r !== undefined && row.r !== null && row.r !== "";
  if (hasW && hasR) return row.w+"\u00d7"+row.r;
  if (hasR) return row.r+" rep"+(Number(row.r)===1 ? "" : "s");
  if (hasW) return String(row.w);
  return "";
}

function formatWorkoutSeconds(value){
  const n = Number(value);
  if (!(Number.isFinite(n) && n>0)) return "";
  const secs = Math.round(n);
  if (secs%60===0) return (secs/60)+" min";
  if (secs>=60) return Math.floor(secs/60)+"m "+(secs%60)+"s";
  return secs+" sec";
}

function formatSets(val){
  const kind = workoutValueKind(val);

  if (kind==="rows"){
    return val.map(formatWorkoutRow).filter(Boolean).join(", ");
  }

  if (kind==="legacyText") return val;

  if (kind==="timeDist"){
    const parts = [formatWorkoutSeconds(val.secs)];
    if (val.dist!==undefined && val.dist!==null && val.dist!==""){
      parts.push(val.dist+" "+val.distUnit);
    }
    return parts.filter(Boolean).join(" · ");
  }

  if (kind==="carry"){
    return val.lbs+" lb · "+val.dist+" "+val.distUnit;
  }

  if (kind==="rounds"){
    let out = val.rounds+" rounds · "+val.workSecs+"s work / "+val.recSecs+"s recovery";
    if (val.note) out += " · "+val.note;
    return out;
  }

  if (kind==="future") return newerWorkoutValueNotice(val);
  if (kind==="empty") return "";

  // Invalid/unsupported objects are deliberately never stringified.
  if (val && typeof val === "object") return "Unsupported saved workout entry";

  return String(val);
}

const TRAINING_PLAN_FORMAT = "blackpyre-training-plan";
const TRAINING_PLAN_VERSION = 1;
const TRAINING_PLAN_SHAPES = ["lift","reps","timeDist","carry","rounds","text"];
const TRAINING_PLAN_DISTANCE_UNITS = ["mi","km","m","ft"];
const TRAINING_PLAN_WEIGHT_UNITS = ["lb","kg"];

let trainingPlanPendingExerciseEntries = [];

function exerciseModelEntries(){
  const builtIns =
    typeof EXERCISE_LIBRARY!=="undefined"
    && Array.isArray(EXERCISE_LIBRARY)
      ? EXERCISE_LIBRARY
      : [];

  const users =
    data
    && data.myExercises
    && typeof data.myExercises==="object"
      ? Object.values(data.myExercises)
      : [];

  return builtIns.concat(
    users,
    trainingPlanPendingExerciseEntries
  );
}

function exerciseModelEntryForId(id){
  const wanted = String(id||"").trim();
  if (!wanted) return null;
  return exerciseModelEntries().find(entry=>entry && entry.id===wanted) || null;
}

function exerciseModelEntryForName(name){
  const normalized = normalizeExerciseName(
    String(name||"").replace(/^\[Cardio\]\s*/,"")
  );
  if (!normalized) return null;

  return exerciseModelEntries().find(entry=>
    exerciseEntryNames(entry).indexOf(normalized)!==-1
  ) || null;
}

function exerciseModelEntryForReference(exercise){
  if (exercise && typeof exercise==="object"){
    const byId = exerciseModelEntryForId(exercise.exerciseId);
    if (byId) return byId;
    return exerciseModelEntryForName(exercise.name);
  }
  return exerciseModelEntryForName(exercise);
}

function exerciseShapeForName(name){
  const entry = exerciseModelEntryForName(name);
  return entry ? entry.shape : null;
}

function trainingPlanSafeNameKey(value){
  let text = String(value==null?"":value);
  if (typeof text.normalize==="function") text = text.normalize("NFKC");
  return text
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g,"'")
    .replace(/['.]/g,"")
    .replace(/&/g," and ")
    .replace(/[‐-‒–—\-_/]+/g," ")
    .replace(/[()[\]{},:;]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function trainingPlanUniqueEntries(entries){
  const seen = new Set();
  return entries.filter(entry=>{
    if (!entry || !entry.id || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function trainingPlanEditDistance(a,b){
  const left = String(a||"");
  const right = String(b||"");
  const previous = Array.from({length:right.length+1},(_,i)=>i);

  for (let i=1;i<=left.length;i++){
    let diagonal = previous[0];
    previous[0] = i;

    for (let j=1;j<=right.length;j++){
      const above = previous[j];

      previous[j] = Math.min(
        previous[j]+1,
        previous[j-1]+1,
        diagonal+(left[i-1]===right[j-1]?0:1)
      );

      diagonal = above;
    }
  }

  return previous[right.length];
}

function rankTrainingPlanExerciseSuggestions(name, limit){
  const query = trainingPlanSafeNameKey(name);
  if (!query) return [];

  const maxItems = Number.isInteger(limit) && limit>0 ? limit : 5;

  return exerciseModelEntries().map(entry=>{
    const keys = [entry.name]
      .concat(entry.aliases||[],entry.formerNames||[])
      .map(trainingPlanSafeNameKey)
      .filter(Boolean);

    let best = Infinity;

    keys.forEach(key=>{
      const distance = trainingPlanEditDistance(query,key);
      const base = distance/Math.max(query.length,key.length,1);
      const prefixBonus =
        key.startsWith(query) || query.startsWith(key)
          ? 0.12
          : 0;

      best = Math.min(
        best,
        Math.max(0,base-prefixBonus)
      );
    });

    return {
      id:entry.id,
      name:entry.name,
      shape:entry.shape,
      score:Number(best.toFixed(4))
    };
  }).sort(
    (a,b)=>a.score-b.score || a.name.localeCompare(b.name)
  ).slice(0,maxItems);
}

function resolveTrainingPlanExercise(reference){
  const ref =
    reference && typeof reference==="object"
      ? reference
      : {name:reference};

  const importedName = String(ref.name||"").trim();
  const importedId = String(ref.exerciseId||"").trim();
  const warnings = [];

  if (importedId){
    const byId = exerciseModelEntryForId(importedId);

    if (byId){
      if (importedName){
        const importedKey =
          trainingPlanSafeNameKey(importedName);

        const acceptedKeys = [byId.name]
          .concat(byId.aliases||[],byId.formerNames||[])
          .map(trainingPlanSafeNameKey);

        if (acceptedKeys.indexOf(importedKey)===-1){
          return {
            ok:false,
            code:"id-name-conflict",
            status:"Conflicting identity",
            importedName:importedName,
            importedId:importedId,
            entry:byId,
            warnings:warnings,
            suggestions:[{
              id:byId.id,
              name:byId.name,
              shape:byId.shape,
              score:0
            }]
          };
        }
      }

      return {
        ok:true,
        code:"resolved",
        status:"Exact match",
        method:byId.id.startsWith("u:")
          ? "exact-user-id"
          : "exact-built-in-id",
        importedName:importedName,
        importedId:importedId,
        entry:byId,
        warnings:warnings
      };
    }

    warnings.push(
      "Unknown exerciseId was ignored; the exercise name was resolved instead."
    );
  }

  if (!importedName){
    return {
      ok:false,
      code:"missing-name",
      status:"Needs selection",
      importedName:importedName,
      importedId:importedId,
      warnings:warnings,
      suggestions:[]
    };
  }

  const entries = exerciseModelEntries();

  const exactName = trainingPlanUniqueEntries(
    entries.filter(entry=>
      String(entry.name||"").trim()===importedName
    )
  );

  if (exactName.length===1){
    return {
      ok:true,
      code:"resolved",
      status:"Exact match",
      method:"exact-name",
      importedName:importedName,
      importedId:importedId,
      entry:exactName[0],
      warnings:warnings
    };
  }

  if (exactName.length>1){
    return {
      ok:false,
      code:"ambiguous",
      status:"Needs selection",
      importedName:importedName,
      importedId:importedId,
      warnings:warnings,
      suggestions:exactName.map(entry=>({
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        score:0
      }))
    };
  }

  const exactAlias = trainingPlanUniqueEntries(
    entries.filter(entry=>
      (entry.aliases||[]).some(
        alias=>String(alias).trim()===importedName
      )
    )
  );

  if (exactAlias.length===1){
    return {
      ok:true,
      code:"resolved",
      status:"Alias match",
      method:"alias",
      importedName:importedName,
      importedId:importedId,
      entry:exactAlias[0],
      warnings:warnings
    };
  }

  if (exactAlias.length>1){
    return {
      ok:false,
      code:"ambiguous",
      status:"Needs selection",
      importedName:importedName,
      importedId:importedId,
      warnings:warnings,
      suggestions:exactAlias.map(entry=>({
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        score:0
      }))
    };
  }

  const exactFormer = trainingPlanUniqueEntries(
    entries.filter(entry=>
      (entry.formerNames||[]).some(
        former=>String(former).trim()===importedName
      )
    )
  );

  if (exactFormer.length===1){
    return {
      ok:true,
      code:"resolved",
      status:"Former-name match",
      method:"former-name",
      importedName:importedName,
      importedId:importedId,
      entry:exactFormer[0],
      warnings:warnings
    };
  }

  if (exactFormer.length>1){
    return {
      ok:false,
      code:"ambiguous",
      status:"Needs selection",
      importedName:importedName,
      importedId:importedId,
      warnings:warnings,
      suggestions:exactFormer.map(entry=>({
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        score:0
      }))
    };
  }

  const safeKey =
    trainingPlanSafeNameKey(importedName);

  const normalized = trainingPlanUniqueEntries(
    entries.filter(entry=>
      [entry.name]
        .concat(entry.aliases||[],entry.formerNames||[])
        .some(
          value=>
            trainingPlanSafeNameKey(value)===safeKey
        )
    )
  );

  if (normalized.length===1){
    return {
      ok:true,
      code:"resolved",
      status:"Normalized match",
      method:"normalized",
      importedName:importedName,
      importedId:importedId,
      entry:normalized[0],
      warnings:warnings
    };
  }

  if (normalized.length>1){
    return {
      ok:false,
      code:"ambiguous",
      status:"Needs selection",
      importedName:importedName,
      importedId:importedId,
      warnings:warnings,
      suggestions:normalized.map(entry=>({
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        score:0
      }))
    };
  }

  return {
    ok:false,
    code:"unknown",
    status:"Needs selection",
    importedName:importedName,
    importedId:importedId,
    warnings:warnings,
    suggestions:
      rankTrainingPlanExerciseSuggestions(
        importedName,
        5
      )
  };
}

function inspectTrainingPlanDocument(input){
  let documentValue;

  try {
    documentValue =
      typeof input==="string"
        ? JSON.parse(input)
        : cloneJSON(input);
  } catch(error){
    return {
      ok:false,
      code:"invalid-json",
      message:
        "The training-plan file is not valid JSON."
    };
  }

  if (!isPlainObject(documentValue)){
    return {
      ok:false,
      code:"invalid-document",
      message:
        "The training-plan file must contain one JSON object."
    };
  }

  const hasFormat =
    Object.prototype.hasOwnProperty.call(
      documentValue,
      "format"
    );

  const hasVersion =
    Object.prototype.hasOwnProperty.call(
      documentValue,
      "version"
    );

  if (hasFormat || hasVersion){
    if (documentValue.format!==TRAINING_PLAN_FORMAT){
      return {
        ok:false,
        code:"wrong-format",
        message:
          "This is not a BlackPyre training-plan file."
      };
    }

    if (
      !Number.isInteger(documentValue.version)
      || documentValue.version<1
    ){
      return {
        ok:false,
        code:"invalid-version",
        message:
          "The training-plan version is invalid."
      };
    }

    if (
      documentValue.version>
      TRAINING_PLAN_VERSION
    ){
      return {
        ok:false,
        code:"newer-version",
        newer:true,
        message:
          "This training plan was created by a newer BlackPyre format."
      };
    }

    if (
      documentValue.version!==
      TRAINING_PLAN_VERSION
    ){
      return {
        ok:false,
        code:"unsupported-version",
        message:
          "This training-plan version is not supported."
      };
    }

    if (!isPlainObject(documentValue.program)){
      return {
        ok:false,
        code:"missing-program",
        message:
          "The training-plan file is missing its program object."
      };
    }

    if (
      typeof documentValue.program.name!=="string"
      || !documentValue.program.name.trim()
    ){
      return {
        ok:false,
        code:"missing-program-name",
        message:
          "The training plan is missing a program name."
      };
    }

    try {
      return {
        ok:true,
        kind:"interchange-v1",
        format:documentValue.format,
        version:documentValue.version,
        program:validateProgram(
          cloneJSON(documentValue.program)
        )
      };
    } catch(error){
      return {
        ok:false,
        code:"invalid-program",
        message:error.message
      };
    }
  }

  try {
    return {
      ok:true,
      kind:"legacy",
      format:null,
      version:null,
      program:validateProgram(
        cloneJSON(documentValue)
      )
    };
  } catch(error){
    return {
      ok:false,
      code:"invalid-legacy-program",
      message:error.message
    };
  }
}

function normalizeTrainingPlanDistanceUnit(value){
  const unit =
    String(value||"").trim().toLowerCase();

  const aliases = {
    mile:"mi",
    miles:"mi",
    mi:"mi",
    kilometer:"km",
    kilometers:"km",
    kilometre:"km",
    kilometres:"km",
    km:"km",
    meter:"m",
    meters:"m",
    metre:"m",
    metres:"m",
    m:"m",
    foot:"ft",
    feet:"ft",
    ft:"ft"
  };

  return aliases[unit] || null;
}

function normalizeTrainingPlanWeightUnit(value){
  const unit =
    String(value||"").trim().toLowerCase();

  const aliases = {
    lb:"lb",
    lbs:"lb",
    pound:"lb",
    pounds:"lb",
    kg:"kg",
    kgs:"kg",
    kilogram:"kg",
    kilograms:"kg"
  };

  return aliases[unit] || null;
}

function sanitizeTrainingPlanPrescription(
  shape,
  prescription
){
  if (!TRAINING_PLAN_SHAPES.includes(shape)){
    return {
      ok:false,
      value:{},
      errors:[
        "The resolved exercise uses an unsupported tracking shape."
      ],
      ignoredFields:[]
    };
  }

  if (!isPlainObject(prescription)){
    return {
      ok:false,
      value:{},
      errors:[
        "Prescription must be a JSON object."
      ],
      ignoredFields:[]
    };
  }

  const known = [
    "sets",
    "reps",
    "intervals",
    "trips",
    "rounds",
    "durationSeconds",
    "workSeconds",
    "recoverySeconds",
    "restSeconds",
    "distance",
    "distanceUnit",
    "weight",
    "weightUnit",
    "pace",
    "effort",
    "notes",
    "instructions",
    "completionTarget",
    "movements"
  ];

  const allowed = {
    lift:[
      "sets",
      "reps",
      "weight",
      "weightUnit",
      "restSeconds",
      "effort",
      "notes"
    ],
    reps:[
      "sets",
      "reps",
      "weight",
      "weightUnit",
      "restSeconds",
      "effort",
      "notes"
    ],
    timeDist:[
      "intervals",
      "durationSeconds",
      "recoverySeconds",
      "restSeconds",
      "distance",
      "distanceUnit",
      "pace",
      "effort",
      "notes"
    ],
    carry:[
      "sets",
      "trips",
      "durationSeconds",
      "restSeconds",
      "distance",
      "distanceUnit",
      "weight",
      "weightUnit",
      "effort",
      "notes"
    ],
    rounds:[
      "rounds",
      "workSeconds",
      "recoverySeconds",
      "restSeconds",
      "movements",
      "effort",
      "notes"
    ],
    text:[
      "completionTarget",
      "instructions",
      "notes"
    ]
  }[shape];

  const errors = [];

  const ignoredFields =
    Object.keys(prescription).filter(
      key=>known.indexOf(key)===-1
    );

  const value = {};

  Object.keys(prescription).forEach(key=>{
    if (
      known.indexOf(key)!==-1
      && allowed.indexOf(key)===-1
    ){
      errors.push(
        key+
        " is not compatible with the "+
        shape+
        " tracking shape."
      );
    }
  });

  const readPositiveInteger = key=>{
    if (
      !Object.prototype.hasOwnProperty.call(
        prescription,
        key
      )
    ) return;

    const number = Number(prescription[key]);

    if (
      !Number.isInteger(number)
      || number<=0
    ){
      errors.push(
        key+
        " must be a positive whole number."
      );
    } else {
      value[key] = number;
    }
  };

  const readPositiveNumber = key=>{
    if (
      !Object.prototype.hasOwnProperty.call(
        prescription,
        key
      )
    ) return;

    const number = Number(prescription[key]);

    if (
      !Number.isFinite(number)
      || number<=0
    ){
      errors.push(
        key+
        " must be greater than zero."
      );
    } else {
      value[key] = number;
    }
  };

  const readNonNegativeNumber = key=>{
    if (
      !Object.prototype.hasOwnProperty.call(
        prescription,
        key
      )
    ) return;

    const number = Number(prescription[key]);

    if (
      !Number.isFinite(number)
      || number<0
    ){
      errors.push(
        key+
        " cannot be negative."
      );
    } else {
      value[key] = number;
    }
  };

  const readText = key=>{
    if (
      !Object.prototype.hasOwnProperty.call(
        prescription,
        key
      )
    ) return;

    if (typeof prescription[key]!=="string"){
      errors.push(
        key+
        " must be text."
      );
    } else if (prescription[key].trim()){
      value[key] =
        prescription[key].trim();
    }
  };

  [
    "sets",
    "intervals",
    "trips",
    "rounds"
  ].forEach(readPositiveInteger);

  [
    "durationSeconds",
    "workSeconds",
    "distance",
    "weight"
  ].forEach(readPositiveNumber);

  [
    "recoverySeconds",
    "restSeconds"
  ].forEach(readNonNegativeNumber);

  [
    "pace",
    "effort",
    "notes",
    "instructions",
    "completionTarget"
  ].forEach(readText);

  if (
    Object.prototype.hasOwnProperty.call(
      prescription,
      "reps"
    )
  ){
    const reps = prescription.reps;

    if (
      Number.isInteger(Number(reps))
      && Number(reps)>0
    ){
      value.reps = Number(reps);
    } else if (isPlainObject(reps)){
      const min = Number(reps.min);
      const max = Number(reps.max);

      if (
        !Number.isInteger(min)
        || min<=0
        || !Number.isInteger(max)
        || max<min
      ){
        errors.push(
          "reps must be a positive number or a valid min/max range."
        );
      } else {
        value.reps = {
          min:min,
          max:max
        };
      }
    } else {
      errors.push(
        "reps must be a positive number or a valid min/max range."
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      prescription,
      "distanceUnit"
    )
  ){
    const unit =
      normalizeTrainingPlanDistanceUnit(
        prescription.distanceUnit
      );

    if (!unit){
      errors.push(
        "distanceUnit is unsupported."
      );
    } else {
      value.distanceUnit = unit;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      value,
      "distance"
    )
    && !value.distanceUnit
  ){
    errors.push(
      "distanceUnit is required when distance is supplied."
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      value,
      "distance"
    )
    && Object.prototype.hasOwnProperty.call(
      value,
      "distanceUnit"
    )
  ){
    errors.push(
      "distanceUnit cannot be supplied without distance."
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      prescription,
      "weightUnit"
    )
  ){
    const unit =
      normalizeTrainingPlanWeightUnit(
        prescription.weightUnit
      );

    if (!unit){
      errors.push(
        "weightUnit is unsupported."
      );
    } else {
      value.weightUnit = unit;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      value,
      "weight"
    )
    && !value.weightUnit
  ){
    value.weightUnit = "lb";
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      value,
      "weight"
    )
    && Object.prototype.hasOwnProperty.call(
      value,
      "weightUnit"
    )
  ){
    errors.push(
      "weightUnit cannot be supplied without weight."
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      prescription,
      "movements"
    )
  ){
    if (
      typeof prescription.movements==="string"
      && prescription.movements.trim()
    ){
      value.movements = [
        prescription.movements.trim()
      ];
    } else if (
      Array.isArray(prescription.movements)
      && prescription.movements.length
      && prescription.movements.every(
        item=>
          typeof item==="string"
          && item.trim()
      )
    ){
      value.movements =
        prescription.movements.map(
          item=>item.trim()
        );
    } else {
      errors.push(
        "movements must be text or a non-empty list of text items."
      );
    }
  }

  const meaningful = {
    lift:
      Object.prototype.hasOwnProperty.call(
        value,
        "reps"
      )
      || !!value.notes
      || !!value.effort,
    reps:
      Object.prototype.hasOwnProperty.call(
        value,
        "reps"
      )
      || !!value.notes
      || !!value.effort,
    timeDist:
      Object.prototype.hasOwnProperty.call(
        value,
        "durationSeconds"
      )
      || Object.prototype.hasOwnProperty.call(
        value,
        "distance"
      )
      || !!value.notes,
    carry:
      Object.prototype.hasOwnProperty.call(
        value,
        "durationSeconds"
      )
      || Object.prototype.hasOwnProperty.call(
        value,
        "distance"
      )
      || !!value.notes,
    rounds:
      Object.prototype.hasOwnProperty.call(
        value,
        "rounds"
      )
      || Object.prototype.hasOwnProperty.call(
        value,
        "workSeconds"
      )
      || !!value.notes
      || !!value.movements,
    text:
      !!value.instructions
      || !!value.notes
      || !!value.completionTarget
  }[shape];

  if (!meaningful){
    errors.push(
      "Prescription does not include a usable target for the "+
      shape+
      " tracking shape."
    );
  }

  return {
    ok:errors.length===0,
    value:value,
    errors:errors,
    ignoredFields:ignoredFields
  };
}

function parseLegacySchemeForShape(
  scheme,
  shape
){
  const original =
    String(scheme||"").trim();

  if (!original){
    return {
      ok:true,
      value:{},
      warning:
        "No prescription was supplied."
    };
  }

  if (shape==="text"){
    return {
      ok:true,
      value:{
        instructions:original
      }
    };
  }

  let match;

  if (
    (shape==="lift" || shape==="reps")
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/i
      )
    )
  ){
    const min = Number(match[2]);
    const max =
      match[3]
        ? Number(match[3])
        : min;

    return {
      ok:true,
      value:{
        sets:Number(match[1]),
        reps:
          min===max
            ? min
            : {
                min:min,
                max:max
              }
      }
    };
  }

  if (
    shape==="timeDist"
    && (
      match=original.match(
        /^(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)$/i
      )
    )
  ){
    const seconds =
      /min/i.test(match[2])
        ? Number(match[1])*60
        : Number(match[1]);

    return {
      ok:true,
      value:{
        durationSeconds:seconds
      }
    };
  }

  if (
    shape==="timeDist"
    && (
      match=original.match(
        /^(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers|kilometre|kilometres|m|meter|meters|metre|metres|ft|foot|feet)$/i
      )
    )
  ){
    return {
      ok:true,
      value:{
        distance:Number(match[1]),
        distanceUnit:
          normalizeTrainingPlanDistanceUnit(
            match[2]
          )
      }
    };
  }

  if (
    shape==="timeDist"
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)$/i
      )
    )
  ){
    const seconds =
      /min/i.test(match[3])
        ? Number(match[2])*60
        : Number(match[2]);

    return {
      ok:true,
      value:{
        intervals:Number(match[1]),
        durationSeconds:seconds
      }
    };
  }

  if (
    shape==="timeDist"
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers|kilometre|kilometres|m|meter|meters|metre|metres|ft|foot|feet)$/i
      )
    )
  ){
    return {
      ok:true,
      value:{
        intervals:Number(match[1]),
        distance:Number(match[2]),
        distanceUnit:
          normalizeTrainingPlanDistanceUnit(
            match[3]
          )
      }
    };
  }

  if (
    shape==="carry"
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers|kilometre|kilometres|m|meter|meters|metre|metres|ft|foot|feet)$/i
      )
    )
  ){
    return {
      ok:true,
      value:{
        sets:Number(match[1]),
        distance:Number(match[2]),
        distanceUnit:
          normalizeTrainingPlanDistanceUnit(
            match[3]
          )
      }
    };
  }

  if (
    shape==="rounds"
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)(?:\s*(?:work)?\s*\/\s*(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)\s*(?:rest|recovery))?$/i
      )
    )
  ){
    const value = {
      rounds:Number(match[1]),
      workSeconds:
        /min/i.test(match[3])
          ? Number(match[2])*60
          : Number(match[2])
    };

    if (match[4]){
      value.recoverySeconds =
        /min/i.test(match[5])
          ? Number(match[4])*60
          : Number(match[4]);
    }

    return {
      ok:true,
      value:value
    };
  }

  if (
    shape==="rounds"
    && (
      match=original.match(
        /^(\d+)\s*rounds?$/i
      )
    )
  ){
    return {
      ok:true,
      value:{
        rounds:Number(match[1])
      }
    };
  }

  if (
    shape==="rounds"
    && (
      match=original.match(
        /^(?:(\d+)\s*rounds?\s*[,;:\-]\s*)?(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds)\s*work\s*\/\s*(\d+(?:\.\d+)?)\s*(?:sec|secs|second|seconds)\s*(?:rest|recovery)$/i
      )
    )
  ){
    const value = {
      workSeconds:Number(match[2]),
      recoverySeconds:Number(match[3])
    };

    if (match[1]){
      value.rounds = Number(match[1]);
    }

    return {
      ok:true,
      value:value
    };
  }

  return {
    ok:true,
    value:{
      notes:original
    },
    warning:
      "The legacy scheme was preserved as notes because it could not be interpreted safely."
  };
}

function trainingPlanSprintIntervalsPrescription(
  exercise
){
  const item =
    exercise && typeof exercise==="object"
      ? exercise
      : {};

  if (
    Object.prototype.hasOwnProperty.call(
      item,
      "prescription"
    )
  ){
    const source = item.prescription;

    if (!isPlainObject(source)){
      return null;
    }

    const has = key=>
      Object.prototype.hasOwnProperty.call(
        source,
        key
      );

    const intervals = Number(source.intervals);
    const rounds = Number(source.rounds);
    const durationSeconds =
      Number(source.durationSeconds);
    const workSeconds =
      Number(source.workSeconds);

    const distanceBased =
      has("distance")
      || has("distanceUnit")
      || has("pace");

    const repeatedTimed =
      (
        Number.isInteger(intervals)
        && intervals>1
        && Number.isFinite(durationSeconds)
        && durationSeconds>0
      )
      || (
        Number.isInteger(rounds)
        && rounds>0
        && (
          (
            Number.isFinite(workSeconds)
            && workSeconds>0
          )
          || (
            Number.isFinite(durationSeconds)
            && durationSeconds>0
          )
        )
      )
      || (
        Number.isFinite(durationSeconds)
        && durationSeconds>0
        && has("recoverySeconds")
      );

    if (
      !repeatedTimed
      || distanceBased
    ){
      return null;
    }

    const value =
      Object.assign({},source);

    if (
      !has("rounds")
      && Number.isInteger(intervals)
      && intervals>0
    ){
      value.rounds = intervals;
    }

    delete value.intervals;

    if (
      !has("workSeconds")
      && Number.isFinite(durationSeconds)
      && durationSeconds>0
    ){
      value.workSeconds =
        durationSeconds;
    }

    delete value.durationSeconds;

    return {
      value:value,
      source:"prescription"
    };
  }

  const legacy =
    parseLegacySchemeForShape(
      item.scheme,
      "rounds"
    );

  const value = legacy.value || {};

  if (
    legacy.ok
    && !legacy.warning
    && Object.prototype.hasOwnProperty.call(
         value,
         "workSeconds"
       )
  ){
    return {
      value:value,
      source:"legacy-scheme"
    };
  }

  return null;
}

function semanticallyResolveTrainingPlanSprintIntervals(
  exercise,
  resolution
){
  if (
    !resolution
    || !resolution.ok
    || !resolution.entry
    || resolution.entry.id!=="bp:sprinting"
    || String(
         exercise
         && exercise.exerciseId
         || ""
       ).trim()
  ){
    return null;
  }

  const interpreted =
    trainingPlanSprintIntervalsPrescription(
      exercise
    );

  if (!interpreted){
    return null;
  }

  const intervalEntry =
    exerciseModelEntryForId(
      "bp:sprint-intervals"
    );

  if (
    !intervalEntry
    || intervalEntry.shape!=="rounds"
  ){
    return null;
  }

  const warning =
    "Repeated sprint prescription resolved as Sprint Intervals.";

  const warnings =
    (resolution.warnings||[]).slice();

  if (warnings.indexOf(warning)===-1){
    warnings.push(warning);
  }

  return {
    resolution:Object.assign(
      {},
      resolution,
      {
        entry:intervalEntry,
        method:"semantic-sprint-intervals",
        status:"Semantic match",
        warnings:warnings
      }
    ),
    prescription:interpreted.value
  };
}

function trainingPlanPrescriptionSummary(
  shape,
  prescription,
  originalScheme
){
  const original =
    String(originalScheme||"").trim();

  if (original) return original;

  const p = prescription || {};

  const repsText =
    typeof p.reps==="number"
      ? String(p.reps)
      : (
          p.reps
          && typeof p.reps==="object"
            ? p.reps.min+"–"+p.reps.max
            : ""
        );

  if (
    (shape==="lift" || shape==="reps")
    && p.sets
    && repsText
  ){
    return p.sets+" × "+repsText;
  }

  if (shape==="timeDist"){
    const prefix =
      p.intervals
        ? p.intervals+" × "
        : "";

    if (p.durationSeconds){
      return (
        prefix+
        p.durationSeconds+
        " sec"+
        (
          p.recoverySeconds!==undefined
            ? " / "+
              p.recoverySeconds+
              " sec recovery"
            : ""
        )
      );
    }

    if (p.distance){
      return (
        prefix+
        p.distance+
        " "+
        p.distanceUnit
      );
    }
  }

  if (shape==="carry"){
    const count =
      p.sets || p.trips;

    const pieces = [];

    if (p.weight){
      pieces.push(
        p.weight+
        " "+
        (p.weightUnit||"lb")
      );
    }

    if (p.distance){
      pieces.push(
        p.distance+
        " "+
        p.distanceUnit
      );
    }

    if (p.durationSeconds){
      pieces.push(
        p.durationSeconds+
        " sec"
      );
    }

    if (pieces.length){
      return (
        (count ? count+" × " : "")+
        pieces.join(" · ")
      );
    }
  }

  if (shape==="rounds"){
    if (p.rounds && p.workSeconds){
      return (
        p.rounds+
        " rounds · "+
        p.workSeconds+
        " sec work / "+
        (p.recoverySeconds||0)+
        " sec recovery"
      );
    }

    if (p.rounds){
      return p.rounds+" rounds";
    }
  }

  if (shape==="text"){
    return (
      p.instructions
      || p.completionTarget
      || p.notes
      || ""
    );
  }

  return p.notes || p.effort || "";
}

function prepareTrainingPlanImport(input){
  const parsed =
    inspectTrainingPlanDocument(input);

  if (!parsed.ok) return parsed;

  const review = [];
  const candidateDays = [];
  let blockers = 0;
  let warningsCount = 0;

  parsed.program.days.forEach(
    (day,dayIndex)=>{
      const candidateExercises = [];

      day.exercises.forEach(
        (exercise,exerciseIndex)=>{
          let resolution =
            resolveTrainingPlanExercise(
              exercise
            );

          let semanticPrescription = null;

          const semanticSprint =
            semanticallyResolveTrainingPlanSprintIntervals(
              exercise,
              resolution
            );

          if (semanticSprint){
            resolution =
              semanticSprint.resolution;

            semanticPrescription =
              semanticSprint.prescription;
          }

          const row = {
            dayId:day.id,
            dayTitle:day.title,
            dayIndex:dayIndex,
            exerciseIndex:exerciseIndex,
            importedName:
              String(exercise.name||""),
            importedExerciseId:
              String(exercise.exerciseId||""),
            canonicalName:
              resolution.entry
                ? resolution.entry.name
                : null,
            exerciseId:
              resolution.entry
                ? resolution.entry.id
                : null,
            shape:
              resolution.entry
                ? resolution.entry.shape
                : null,
            resolutionMethod:
              resolution.method || null,
            status:resolution.status,
            warnings:
              (resolution.warnings||[]).slice(),
            errors:[],
            suggestions:
              resolution.suggestions || []
          };

          if (!resolution.ok){
            row.errors.push(
              resolution.code==="id-name-conflict"
                ? "The supplied exerciseId and exercise name identify different exercises."
                : "Choose an existing BlackPyre exercise or create a custom exercise before importing."
            );

            blockers++;
            warningsCount += row.warnings.length;
            review.push(row);
            return;
          }

          const shape =
            resolution.entry.shape;

          if (
            Object.prototype.hasOwnProperty.call(
              exercise,
              "trackingShape"
            )
          ){
            if (
              !TRAINING_PLAN_SHAPES.includes(
                exercise.trackingShape
              )
            ){
              row.errors.push(
                "The supplied trackingShape is unsupported."
              );
            } else if (
              exercise.trackingShape!==shape
            ){
              if (semanticSprint){
                row.warnings.push(
                  "The supplied trackingShape was replaced by BlackPyre's canonical rounds shape after sprint-interval resolution."
                );
              } else {
                row.errors.push(
                  "The supplied trackingShape conflicts with BlackPyre's canonical "+
                  shape+
                  " shape."
                );
              }
            }
          }

          let prescriptionResult;

          if (semanticPrescription!==null){
            prescriptionResult =
              sanitizeTrainingPlanPrescription(
                shape,
                semanticPrescription
              );
          } else if (parsed.kind==="interchange-v1"){
            if (
              !Object.prototype.hasOwnProperty.call(
                exercise,
                "prescription"
              )
            ){
              prescriptionResult = {
                ok:false,
                value:{},
                errors:[
                  "Version 1 exercises require a prescription object."
                ],
                ignoredFields:[]
              };
            } else {
              prescriptionResult =
                sanitizeTrainingPlanPrescription(
                  shape,
                  exercise.prescription
                );
            }
          } else if (
            Object.prototype.hasOwnProperty.call(
              exercise,
              "prescription"
            )
          ){
            prescriptionResult =
              sanitizeTrainingPlanPrescription(
                shape,
                exercise.prescription
              );
          } else {
            const legacy =
              parseLegacySchemeForShape(
                exercise.scheme,
                shape
              );

            prescriptionResult = {
              ok:legacy.ok,
              value:legacy.value,
              errors:
                legacy.ok
                  ? []
                  : [legacy.message],
              ignoredFields:[]
            };

            if (legacy.warning){
              row.warnings.push(
                legacy.warning
              );
            }
          }

          row.errors = row.errors.concat(
            prescriptionResult.errors||[]
          );

          if (
            (prescriptionResult.ignoredFields||[])
              .length
          ){
            row.warnings.push(
              "Ignored additional fields: "+
              prescriptionResult
                .ignoredFields
                .join(", ")+
              "."
            );
          }

          if (row.errors.length){
            row.status =
              "Conflicting prescription";
            blockers++;
          } else {
            const stored = {
              exerciseId:
                resolution.entry.id,
              name:
                resolution.entry.name,
              scheme:
                trainingPlanPrescriptionSummary(
                  shape,
                  prescriptionResult.value,
                  exercise.scheme
                )
            };

            if (
              Object.keys(
                prescriptionResult.value||{}
              ).length
            ){
              stored.prescription =
                prescriptionResult.value;
            }

            candidateExercises.push(stored);
          }

          warningsCount +=
            row.warnings.length;

          review.push(row);
        }
      );

      candidateDays.push({
        id:
          day.id ||
          "D"+(dayIndex+1),
        title:
          day.title ||
          "Day "+(dayIndex+1),
        exercises:candidateExercises
      });
    }
  );

  let candidate = null;

  if (blockers===0){
    candidate = {
      name:
        parsed.program.name ||
        "Imported Program",
      days:candidateDays
    };

    if (
      typeof parsed.program.author==="string"
      && parsed.program.author.trim()
    ){
      candidate.author =
        parsed.program.author.trim();
    }

    if (
      typeof parsed.program.notes==="string"
      && parsed.program.notes.trim()
    ){
      candidate.notes =
        parsed.program.notes.trim();
    }

    candidate =
      validateProgram(candidate);
  }

  return {
    ok:true,
    kind:parsed.kind,
    format:parsed.format,
    version:parsed.version,
    canConfirm:blockers===0,
    blockers:blockers,
    warningCount:warningsCount,
    review:review,
    candidate:candidate
  };
}

function trainingPlanInterchangeFromProgram(
  sourceProgram
){
  const source =
    validateProgram(
      cloneJSON(sourceProgram)
    );

  const exported = {
    format:TRAINING_PLAN_FORMAT,
    version:TRAINING_PLAN_VERSION,
    program:{
      name:
        source.name ||
        "BlackPyre Program",
      days:source.days.map(
        (day,dayIndex)=>({
          id:
            day.id ||
            "D"+(dayIndex+1),
          title:
            day.title ||
            "Day "+(dayIndex+1),
          exercises:
            day.exercises.map(exercise=>{
              const resolution =
                resolveTrainingPlanExercise(
                  exercise
                );

              const entry =
                resolution.ok
                  ? resolution.entry
                  : null;

              const shape =
                entry
                  ? entry.shape
                  : null;

              let prescription = null;

              if (
                shape
                && Object.prototype.hasOwnProperty.call(
                  exercise,
                  "prescription"
                )
              ){
                const sanitized =
                  sanitizeTrainingPlanPrescription(
                    shape,
                    exercise.prescription
                  );

                if (sanitized.ok){
                  prescription =
                    sanitized.value;
                }
              }

              if (!prescription && shape){
                prescription =
                  parseLegacySchemeForShape(
                    exercise.scheme,
                    shape
                  ).value;
              }

              if (
                !prescription
                || !Object.keys(prescription).length
              ){
                prescription = {
                  notes:
                    String(
                      exercise.scheme ||
                      "No prescription supplied."
                    )
                };
              }

              const out = {
                name:
                  entry
                    ? entry.name
                    : String(
                        exercise.name ||
                        "Unknown exercise"
                      ),
                scheme:
                  String(
                    exercise.scheme ||
                    trainingPlanPrescriptionSummary(
                      shape,
                      prescription,
                      ""
                    )
                  ),
                prescription:
                  prescription
              };

              if (entry){
                out.exerciseId =
                  entry.id;

                out.trackingShape =
                  entry.shape;
              }

              return out;
            })
        })
      )
    }
  };

  if (
    typeof source.author==="string"
    && source.author.trim()
  ){
    exported.program.author =
      source.author.trim();
  }

  if (
    typeof source.notes==="string"
    && source.notes.trim()
  ){
    exported.program.notes =
      source.notes.trim();
  }

  return exported;
}

function isTrainingPlanDocumentCandidate(value){
  if (!isPlainObject(value)) return false;

  return Array.isArray(value.days)
    || Object.prototype.hasOwnProperty.call(value,"format")
    || Object.prototype.hasOwnProperty.call(value,"version")
    || isPlainObject(value.program);
}

function extractTrainingPlanDocumentFromText(text){
  const cleaned = String(text||"")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g,'"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g,"'")
    .replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g,"")
    .replace(/\u00A0/g," ")
    .trim();

  if (!cleaned) return null;

  const candidates = [cleaned];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;

  while ((match=fencePattern.exec(cleaned))!==null){
    candidates.push(match[1].trim());
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace!==-1 && lastBrace>firstBrace){
    candidates.push(
      cleaned.slice(firstBrace,lastBrace+1)
    );
  }

  const seen = new Set();

  for (const candidate of candidates){
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    try {
      const parsed = JSON.parse(candidate);

      if (isTrainingPlanDocumentCandidate(parsed)){
        return parsed;
      }
    } catch(error){
      // Continue looking through other possible JSON blocks.
    }
  }

  return null;
}

function blackpyreTrainingPlanFilename(name){
  const base = String(name||"blackpyre-program")
    .replace(/[^a-z0-9]+/gi,"-")
    .replace(/^-+|-+$/g,"")
    .toLowerCase();

  return (base || "blackpyre-program")
    + "-training-plan.json";
}

let trainingPlanReviewState = null;

function trainingPlanReviewRowKey(row){
  return row.dayIndex+":"+row.exerciseIndex;
}

function trainingPlanReviewCustomEntries(){
  if (
    !trainingPlanReviewState
    || !trainingPlanReviewState.customExercises
  ){
    return [];
  }

  return Object.values(
    trainingPlanReviewState.customExercises
  );
}

function syncTrainingPlanPendingExerciseEntries(){
  trainingPlanPendingExerciseEntries =
    trainingPlanReviewCustomEntries()
      .map(entry=>cloneJSON(entry));
}

function trainingPlanCustomComparisonEntries(excludedKey){
  const builtIns =
    typeof EXERCISE_LIBRARY!=="undefined"
    && Array.isArray(EXERCISE_LIBRARY)
      ? EXERCISE_LIBRARY
      : [];

  const users =
    data
    && data.myExercises
    && typeof data.myExercises==="object"
      ? Object.values(data.myExercises)
      : [];

  const pending =
    trainingPlanReviewState
    && trainingPlanReviewState.customExercises
      ? Object.keys(
          trainingPlanReviewState.customExercises
        )
          .filter(key=>key!==excludedKey)
          .map(
            key=>
              trainingPlanReviewState
                .customExercises[key]
          )
      : [];

  return builtIns.concat(users,pending);
}

function nextTrainingPlanCustomExerciseId(
  name,
  excludedKey
){
  const base = userExerciseIdBase(name);

  const used = new Set(
    trainingPlanCustomComparisonEntries(
      excludedKey
    )
      .map(entry=>entry && entry.id)
      .filter(Boolean)
  );

  if (!used.has(base)) return base;

  let suffix = 2;

  while (used.has(base+"-"+suffix)){
    suffix++;
  }

  return base+"-"+suffix;
}

function prepareTrainingPlanCustomExercise(
  row,
  name,
  shape
){
  const key = trainingPlanReviewRowKey(row);

  const cleanName =
    String(name||"")
      .trim()
      .replace(/\s+/g," ");

  if (!cleanName){
    return {
      ok:false,
      reason:"Type the custom exercise name."
    };
  }

  if (!TRAINING_PLAN_SHAPES.includes(shape)){
    return {
      ok:false,
      reason:"Choose the custom exercise tracking type."
    };
  }

  const normalized =
    normalizeExerciseName(cleanName);

  const collision =
    trainingPlanCustomComparisonEntries(key)
      .find(entry=>
        entry
        && exerciseEntryNames(entry)
             .indexOf(normalized)!==-1
      );

  if (collision){
    return {
      ok:false,
      reason:
        '"'
        +cleanName
        +'" already exists. Choose it from the '
        +"BlackPyre exercise list instead."
    };
  }

  const entry = {
    id:nextTrainingPlanCustomExerciseId(
      cleanName,
      key
    ),
    name:cleanName,
    shape:shape,
    tags:[],
    aliases:[],
    formerNames:[],
    muscles:{
      primary:[],
      secondary:[]
    },
    equipment:[],
    unilateral:false,
    bodyweight:false,
    deprecated:false
  };

  return {
    ok:true,
    key:key,
    entry:entry
  };
}

function setTrainingPlanReviewCustomExercise(
  row,
  name,
  shape
){
  if (!trainingPlanReviewState){
    return {
      ok:false,
      reason:"The training-plan review is no longer open."
    };
  }

  const prepared =
    prepareTrainingPlanCustomExercise(
      row,
      name,
      shape
    );

  if (!prepared.ok) return prepared;

  trainingPlanReviewState
    .customExercises[prepared.key] =
      prepared.entry;

  trainingPlanReviewState
    .selections[prepared.key] =
      prepared.entry.id;

  syncTrainingPlanPendingExerciseEntries();
  rebuildTrainingPlanReview();

  return {
    ok:true,
    entry:cloneJSON(prepared.entry)
  };
}

function clearTrainingPlanReviewCustomExercise(key){
  if (
    !trainingPlanReviewState
    || !trainingPlanReviewState.customExercises
    || !trainingPlanReviewState.customExercises[key]
  ){
    return false;
  }

  delete trainingPlanReviewState
    .customExercises[key];

  syncTrainingPlanPendingExerciseEntries();

  return true;
}


function trainingPlanReviewSourceDocument(parsed){
  if (parsed.kind==="interchange-v1"){
    return {
      format:parsed.format,
      version:parsed.version,
      program:cloneJSON(parsed.program)
    };
  }

  return cloneJSON(parsed.program);
}

function trainingPlanReviewProgramFromDocument(documentValue,kind){
  return kind==="interchange-v1"
    ? documentValue.program
    : documentValue;
}

function trainingPlanReviewSourceExercise(row){
  if (!trainingPlanReviewState) return null;

  const sourceProgram =
    trainingPlanReviewProgramFromDocument(
      trainingPlanReviewState.sourceDocument,
      trainingPlanReviewState.kind
    );

  if (
    !sourceProgram
    || !sourceProgram.days[row.dayIndex]
    || !sourceProgram.days[row.dayIndex]
         .exercises[row.exerciseIndex]
  ){
    return null;
  }

  return sourceProgram.days[row.dayIndex]
    .exercises[row.exerciseIndex];
}

function trainingPlanReviewDocumentWithSelections(){
  if (!trainingPlanReviewState) return null;

  const state = trainingPlanReviewState;
  const documentValue = cloneJSON(state.sourceDocument);
  const sourceProgram =
    trainingPlanReviewProgramFromDocument(
      documentValue,
      state.kind
    );

  Object.keys(state.selections).forEach(key=>{
    const parts = key.split(":");
    const dayIndex = Number(parts[0]);
    const exerciseIndex = Number(parts[1]);
    const selectedId = state.selections[key];
    const entry = exerciseModelEntryForId(selectedId);

    if (
      !entry
      || !sourceProgram.days[dayIndex]
      || !sourceProgram.days[dayIndex]
           .exercises[exerciseIndex]
    ){
      return;
    }

    const exercise =
      sourceProgram.days[dayIndex]
        .exercises[exerciseIndex];

    exercise.exerciseId = entry.id;
    exercise.name = entry.name;

    if (state.kind==="interchange-v1"){
      exercise.trackingShape = entry.shape;
    }
  });

  return documentValue;
}

function rebuildTrainingPlanReview(){
  if (!trainingPlanReviewState) return null;

  const documentValue =
    trainingPlanReviewDocumentWithSelections();

  trainingPlanReviewState.prepared =
    prepareTrainingPlanImport(documentValue);

  return trainingPlanReviewState.prepared;
}

function appendTrainingPlanReviewMessage(parent,text,color){
  const line = document.createElement("div");
  line.textContent = text;
  line.style.cssText =
    "font-size:12px; line-height:1.55; margin-top:5px;"
    +(color ? " color:"+color+";" : "");

  parent.appendChild(line);
}

function appendTrainingPlanResolutionOption(
  parent,
  entry
){
  const option = document.createElement("option");
  option.value = entry.id;
  option.textContent =
    entry.name
    +" · "
    +entry.shape;

  parent.appendChild(option);
}

function buildTrainingPlanResolutionSelect(row){
  const key = trainingPlanReviewRowKey(row);
  const select = document.createElement("select");

  select.setAttribute(
    "aria-label",
    "Choose the BlackPyre exercise for "
      +(row.importedName || "this imported exercise")
  );

  select.dataset.reviewKey = key;
  select.style.cssText =
    "width:100%; margin-top:10px; font-size:16px;";

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "Choose a BlackPyre exercise";
  select.appendChild(blank);

  const suggestedIds = new Set();

  if (row.suggestions && row.suggestions.length){
    const suggested = document.createElement("optgroup");
    suggested.label = "Suggested matches";

    row.suggestions.forEach(suggestion=>{
      const entry =
        exerciseModelEntryForId(suggestion.id);

      if (!entry || suggestedIds.has(entry.id)) return;

      suggestedIds.add(entry.id);
      appendTrainingPlanResolutionOption(
        suggested,
        entry
      );
    });

    if (suggested.children.length){
      select.appendChild(suggested);
    }
  }

  const all = document.createElement("optgroup");
  all.label = "All exercises";

  exerciseModelEntries()
    .slice()
    .sort(
      (a,b)=>
        a.name.localeCompare(b.name)
        || a.id.localeCompare(b.id)
    )
    .forEach(entry=>{
      if (suggestedIds.has(entry.id)) return;

      appendTrainingPlanResolutionOption(
        all,
        entry
      );
    });

  select.appendChild(all);

  select.value =
    trainingPlanReviewState
    && trainingPlanReviewState.selections[key]
      ? trainingPlanReviewState.selections[key]
      : "";

  select.addEventListener("change",()=>{
    if (!trainingPlanReviewState) return;

    const pending =
      trainingPlanReviewState.customExercises
        ? trainingPlanReviewState
            .customExercises[key] || null
        : null;

    if (
      pending
      && select.value!==pending.id
    ){
      clearTrainingPlanReviewCustomExercise(key);
    }

    if (select.value){
      trainingPlanReviewState.selections[key] =
        select.value;
    } else {
      delete trainingPlanReviewState.selections[key];
    }

    rebuildTrainingPlanReview();
    renderTrainingPlanReview();
  });

  return select;
}


function buildTrainingPlanCustomExerciseControls(row){
  const state = trainingPlanReviewState;
  const key = trainingPlanReviewRowKey(row);

  const pending =
    state
    && state.customExercises
      ? state.customExercises[key] || null
      : null;

  const sourceExercise =
    trainingPlanReviewSourceExercise(row);

  const suppliedShape =
    sourceExercise
    && TRAINING_PLAN_SHAPES.includes(
      sourceExercise.trackingShape
    )
      ? sourceExercise.trackingShape
      : "";

  const shell = document.createElement("div");

  shell.style.cssText =
    "margin-top:10px; padding:10px;"
    +" border:1px solid var(--border);"
    +" border-radius:10px;"
    +" background:var(--panel-up);";

  const heading = document.createElement("div");

  heading.textContent =
    pending
      ? "Pending custom exercise"
      : "Create a custom exercise";

  heading.style.cssText =
    "font-family:'Oswald',sans-serif;"
    +" font-size:14px; font-weight:700;";

  shell.appendChild(heading);

  appendTrainingPlanReviewMessage(
    shell,
    pending
      ? "This exercise will be saved only when the entire program is imported."
      : "Keep or edit the imported name, then choose how BlackPyre should track it.",
    "var(--dim)"
  );

  const nameInput = document.createElement("input");

  nameInput.type = "text";
  nameInput.value =
    pending
      ? pending.name
      : String(row.importedName||"");

  nameInput.placeholder = "Custom exercise name";
  nameInput.autocomplete = "off";
  nameInput.dataset.customReviewKey = key;

  nameInput.setAttribute(
    "aria-label",
    "Custom exercise name for "
      +(row.importedName || "imported exercise")
  );

  nameInput.style.marginTop = "10px";

  shell.appendChild(nameInput);

  const shapeSelect =
    makeExerciseShapeSelect(
      "Custom exercise tracking type for "
        +(row.importedName || "imported exercise")
    );

  const blank = document.createElement("option");

  blank.value = "";
  blank.textContent = "Choose tracking type";

  shapeSelect.insertBefore(
    blank,
    shapeSelect.firstChild
  );

  shapeSelect.value =
    pending
      ? pending.shape
      : suppliedShape;

  shapeSelect.dataset.customShapeKey = key;
  shapeSelect.style.marginTop = "8px";

  shell.appendChild(shapeSelect);

  const error = document.createElement("div");

  error.dataset.customErrorKey = key;
  error.style.cssText =
    "font-size:12px; line-height:1.45;"
    +" margin-top:7px; color:var(--warn);";

  shell.appendChild(error);

  const useButton = document.createElement("button");

  useButton.type = "button";
  useButton.className = "btn ghost small";
  useButton.dataset.customUseKey = key;

  useButton.textContent =
    pending
      ? "Update custom exercise"
      : "Use custom exercise";

  useButton.setAttribute(
    "aria-label",
    (pending
      ? "Update custom exercise for "
      : "Use custom exercise for ")
      +(row.importedName || "imported exercise")
  );

  useButton.style.cssText =
    "width:100%; min-height:44px;"
    +" margin-top:8px;";

  useButton.addEventListener("click",()=>{
    const result =
      setTrainingPlanReviewCustomExercise(
        row,
        nameInput.value,
        shapeSelect.value
      );

    if (!result.ok){
      error.textContent =
        result.reason
        || "The custom exercise could not be prepared.";

      return;
    }

    renderTrainingPlanReview();
  });

  shell.appendChild(useButton);

  return shell;
}

function renderTrainingPlanReview(){
  const state = trainingPlanReviewState;
  const list =
    document.getElementById("trainingPlanReviewList");
  const summary =
    document.getElementById("trainingPlanReviewSummary");
  const error =
    document.getElementById("trainingPlanReviewError");
  const confirmButton =
    document.getElementById(
      "trainingPlanReviewConfirmBtn"
    );

  list.textContent = "";
  error.textContent = "";
  error.classList.add("hidden");

  if (!state || !state.prepared){
    summary.textContent =
      "No training plan is ready for review.";
    confirmButton.disabled = true;
    return;
  }

  const prepared = state.prepared;

  if (!prepared.ok){
    summary.textContent =
      "This training plan could not be reviewed.";

    error.textContent =
      prepared.message
      || "The training-plan document is invalid.";

    error.classList.remove("hidden");
    confirmButton.disabled = true;
    return;
  }

  const sourceLabel =
    state.kind==="interchange-v1"
      ? "BlackPyre training-plan v1"
      : "Legacy program";

  summary.textContent =
    sourceLabel
    +" · "
    +prepared.review.length
    +" exercise"
    +(prepared.review.length===1 ? "" : "s")
    +" · "
    +prepared.blockers
    +" blocking issue"
    +(prepared.blockers===1 ? "" : "s")
    +" · "
    +prepared.warningCount
    +" warning"
    +(prepared.warningCount===1 ? "" : "s");

  prepared.review.forEach(row=>{
    const card = document.createElement("div");
    card.className = "card";
    card.style.cssText =
      "margin-bottom:10px; padding:12px;";

    const heading = document.createElement("div");
    heading.style.cssText =
      "font-family:'Oswald',sans-serif;"
      +"font-size:14px; font-weight:700;";

    heading.textContent =
      row.importedName || "Unnamed imported exercise";

    card.appendChild(heading);

    appendTrainingPlanReviewMessage(
      card,
      (row.dayTitle || "Program day")
        +" · Imported position "
        +(row.exerciseIndex+1),
      "var(--dim)"
    );

    const sourceExercise =
      trainingPlanReviewSourceExercise(row);

    const prescriptionText =
      sourceExercise
        ? (
            String(sourceExercise.scheme||"").trim()
            || (
                isPlainObject(sourceExercise.prescription)
                  ? JSON.stringify(sourceExercise.prescription)
                  : "No prescription supplied"
              )
          )
        : "No prescription supplied";

    appendTrainingPlanReviewMessage(
      card,
      "Prescription: "+prescriptionText,
      "var(--text)"
    );

    const selectedKey =
      trainingPlanReviewRowKey(row);

    const manuallySelected =
      !!state.selections[selectedKey];

    const pendingCustom =
      state.customExercises
        ? state.customExercises[selectedKey] || null
        : null;

    if (row.exerciseId){
      appendTrainingPlanReviewMessage(
        card,
        "Resolved to "
          +row.canonicalName
          +" · "
          +row.shape
          +" · "
          +(manuallySelected
              ? "manual selection"
              : (
                  row.resolutionMethod
                  || row.status
                  || "resolved"
                )
            ),
        row.errors.length
          ? "var(--warn)"
          : (
              row.warnings.length
                ? "var(--amber)"
                : "var(--ok)"
            )
      );
    } else {
      appendTrainingPlanReviewMessage(
        card,
        "No canonical BlackPyre exercise is selected.",
        "var(--warn)"
      );
    }

    row.errors.forEach(message=>{
      appendTrainingPlanReviewMessage(
        card,
        "Blocking: "+message,
        "var(--warn)"
      );
    });

    row.warnings.forEach(message=>{
      appendTrainingPlanReviewMessage(
        card,
        "Warning: "+message,
        "var(--amber)"
      );
    });

    if (
      row.errors.length
      || !row.exerciseId
      || pendingCustom
    ){
      card.appendChild(
        buildTrainingPlanResolutionSelect(row)
      );
    }

    if (
      row.errors.length
      || !row.exerciseId
      || pendingCustom
    ){
      card.appendChild(
        buildTrainingPlanCustomExerciseControls(row)
      );
    }

    list.appendChild(card);
  });

  confirmButton.disabled = !prepared.canConfirm;

  confirmButton.textContent =
    prepared.canConfirm
      ? "Import reviewed program"
      : "Resolve blocking issues";
}

function setTrainingPlanReviewRestDockSuppressed(suppressed){
  const restDock =
    document.getElementById("restDock");

  const workView =
    document.getElementById("view-work");

  const trainActive =
    !!(
      workView
      && workView.classList.contains("active")
    );

  if (suppressed){
    if (
      typeof setRestOptionsOpen==="function"
    ){
      setRestOptionsOpen(false);
    }

    if (restDock){
      restDock.classList.add("hidden");
    }

    document.body.classList.remove(
      "rest-dock-visible"
    );

    document.body.classList.remove(
      "rest-options-open"
    );

    return;
  }

  if (restDock){
    restDock.classList.toggle(
      "hidden",
      !trainActive
    );
  }

  document.body.classList.toggle(
    "rest-dock-visible",
    trainActive
  );

  document.body.classList.remove(
    "rest-options-open"
  );
}

function openTrainingPlanReview(input,options){
  const parsed = inspectTrainingPlanDocument(input);

  if (!parsed.ok) return parsed;

  const sourceDocument =
    trainingPlanReviewSourceDocument(parsed);

  trainingPlanPendingExerciseEntries = [];

  const prepared =
    prepareTrainingPlanImport(sourceDocument);

  if (!prepared.ok) return prepared;

  trainingPlanReviewState = {
    kind:parsed.kind,
    sourceDocument:sourceDocument,
    selections:{},
    customExercises:{},
    prepared:prepared,
    options:options || {}
  };

  renderTrainingPlanReview();

  const overlay =
    document.getElementById(
      "trainingPlanReviewOverlay"
    );

  const wasHidden =
    overlay.classList.contains("hidden");

  setTrainingPlanReviewRestDockSuppressed(true);

  if (wasHidden) lockScroll();

  overlay.classList.remove("hidden");
  overlay.scrollTop = 0;

  return {
    ok:true,
    prepared:prepared
  };
}

function closeTrainingPlanReview(){
  const overlay =
    document.getElementById(
      "trainingPlanReviewOverlay"
    );

  const wasOpen =
    !overlay.classList.contains("hidden");

  const hadPendingCustomExercises =
    trainingPlanPendingExerciseEntries.length>0;

  overlay.classList.add("hidden");
  trainingPlanReviewState = null;
  trainingPlanPendingExerciseEntries = [];

  setTrainingPlanReviewRestDockSuppressed(false);

  if (wasOpen) unlockScroll();

  if (
    hadPendingCustomExercises
    && typeof refreshUserExerciseSurfaces==="function"
  ){
    refreshUserExerciseSurfaces();
  }
}

document.getElementById(
  "trainingPlanReviewCloseBtn"
).addEventListener(
  "click",
  closeTrainingPlanReview
);

document.getElementById(
  "trainingPlanReviewCancelBtn"
).addEventListener(
  "click",
  closeTrainingPlanReview
);

document.getElementById(
  "trainingPlanReviewOverlay"
).addEventListener("keydown",event=>{
  if (event.key==="Escape"){
    event.preventDefault();
    closeTrainingPlanReview();
  }
});


function commitTrainingPlanReviewedProgram(state){
  const customEntries =
    state
    && state.customExercises
      ? Object.values(state.customExercises)
      : [];

  if (!customEntries.length){
    return replaceActiveProgram(
      state.prepared.candidate,
      {confirmed:true}
    );
  }

  const previousMyExercises =
    cloneJSON(data.myExercises || {});

  const nextMyExercises =
    cloneJSON(previousMyExercises);

  try {
    customEntries.forEach(entry=>{
      const collision =
        userExerciseNameCollision(entry.name);

      if (collision){
        throw new Error(
          '"'
          +entry.name
          +'" now matches an existing exercise. '
          +"Reopen the review and choose that exercise."
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(
          nextMyExercises,
          entry.id
        )
      ){
        throw new Error(
          "A custom exercise ID collision occurred. "
          +"Reopen the review and try again."
        );
      }

      nextMyExercises[entry.id] =
        cloneJSON(entry);
    });

    validateUserExercisesMap(nextMyExercises);
  } catch(error){
    return {
      ok:false,
      reason:
        error && error.message
          ? error.message
          : "The pending custom exercises are invalid."
    };
  }

  data.myExercises = nextMyExercises;

  if (!save()){
    data.myExercises = previousMyExercises;

    return {
      ok:false,
      reason:
        "The custom exercises could not be saved. "
        +"The active program was not changed."
    };
  }

  const replaced =
    replaceActiveProgram(
      state.prepared.candidate,
      {confirmed:true}
    );

  if (!replaced.ok){
    data.myExercises = previousMyExercises;

    const rollbackSaved = save();

    return {
      ok:false,
      reason:
        (
          replaced.reason
          || "The reviewed program could not be saved."
        )
        +(
          rollbackSaved
            ? " No custom exercises were kept."
            : " The custom-exercise rollback could not be saved."
        )
    };
  }

  return replaced;
}

document.getElementById(
  "trainingPlanReviewConfirmBtn"
).addEventListener("click",()=>{
  const state = trainingPlanReviewState;
  const error =
    document.getElementById(
      "trainingPlanReviewError"
    );

  if (
    !state
    || !state.prepared
    || !state.prepared.ok
    || !state.prepared.canConfirm
    || !state.prepared.candidate
  ){
    error.textContent =
      "Resolve every blocking issue before importing.";

    error.classList.remove("hidden");
    return;
  }

  const replaced =
    commitTrainingPlanReviewedProgram(state);

  if (!replaced.ok){
    error.textContent =
      replaced.reason
      || "The reviewed program could not be saved.";

    error.classList.remove("hidden");
    return;
  }

  const options = state.options || {};
  const onImported = options.onImported;
  const successMessage =
    options.successMessage || "Program loaded ✓";

  closeTrainingPlanReview();
  setProgramManagerOpen(false);

  if (typeof onImported==="function"){
    try {
      onImported(replaced.program);
    } catch(error){
      console.error(
        "Training-plan import completion handler failed:",
        error
      );
    }
  }

  flashSave(successMessage);
});

function rowShapeForValue(exName, val){
  const shape = exerciseShapeForName(exName);
  if (shape==="reps") return "reps";
  if (shape==="lift") return "lift";

  // Legacy/custom history can still reveal a reps-only row model.
  if (Array.isArray(val) && val.some(row=>
    row && typeof row==="object" && !Object.prototype.hasOwnProperty.call(row,"w")
  )) return "reps";

  return "lift";
}

function blankTypedWorkoutValue(kind){
  if (kind==="timeDist") return {t:"timeDist", secs:"", dist:"", distUnit:"mi"};
  if (kind==="carry") return {t:"carry", lbs:"", dist:"", distUnit:"ft"};
  if (kind==="rounds") return {t:"rounds", rounds:"", workSecs:"", recSecs:0, note:""};
  return null;
}

function editableWorkoutValueKind(kind){
  return kind==="rows"
    || kind==="legacyText"
    || kind==="timeDist"
    || kind==="carry"
    || kind==="rounds";
}

function makePlanSessionState(ex, lastVal){
  const modelEntry = exerciseModelEntryForReference(ex);
  const shape = modelEntry ? modelEntry.shape : null;
  const lastKind = workoutValueKind(lastVal);
  const typedShape = ["timeDist","carry","rounds"].includes(shape)
    ? shape
    : (["timeDist","carry","rounds"].includes(lastKind) ? lastKind : null);

  if (typedShape){
    return {
      mode:typedShape,
      rowShape:null,
      rows:[],
      text:"",
      textTouched:false,
      typed:blankTypedWorkoutValue(typedShape),
      typedTouched:false,
      auto:false,
      autoDelta:0,
      saved:null,
      status:"plan"
    };
  }

  if (shape==="text" || ex.name.indexOf("[Cardio] ")===0){
    return {
      mode:"text",
      rowShape:null,
      rows:[],
      text:"",
      textTouched:false,
      typed:null,
      typedTouched:false,
      auto:false,
      autoDelta:0,
      saved:null,
      status:"plan"
    };
  }

  const pf = prefillRows(ex, lastVal);
  return {
    mode:"rows",
    rowShape:shape==="reps" ? "reps" : rowShapeForValue(ex.name,lastVal),
    rows:pf.rows,
    text:"",
    textTouched:false,
    typed:null,
    typedTouched:false,
    auto:pf.auto,
    autoDelta:pf.autoDelta,
    saved:null,
    status:"plan"
  };
}

function makeSavedSessionState(exName, val){
  const kind = workoutValueKind(val);
  const base = {
    rowShape:null,
    rows:[],
    text:"",
    textTouched:false,
    typed:null,
    typedTouched:false,
    auto:false,
    autoDelta:0,
    saved:cloneWorkoutValue(val),
    status:"saved"
  };

  if (kind==="rows"){
    base.mode = "rows";
    base.rowShape = rowShapeForValue(exName,val);
    return base;
  }

  if (kind==="legacyText"){
    base.mode = "text";
    return base;
  }

  if (kind==="timeDist" || kind==="carry" || kind==="rounds"){
    base.mode = kind;
    base.typed = cloneWorkoutValue(val);
    return base;
  }

  // Unknown future typed objects are deliberately kept in the saved state
  // and never exposed through a writable editor.
  base.mode = "future";
  return base;
}

function loadWorkoutValueIntoEditableState(st, exName, val){
  const kind = workoutValueKind(val);

  st.auto = false;
  st.autoDelta = 0;
  st.textTouched = false;
  st.typedTouched = false;

  if (kind==="rows"){
    st.mode = "rows";
    st.rowShape = rowShapeForValue(exName,val);
    st.rows = toRows(val).map(r=>({
      w:r.w,
      r:r.r,
      done:false,
      touched:true
    }));
    st.typed = null;
    return true;
  }

  if (kind==="legacyText"){
    st.mode = "text";
    st.rowShape = null;
    st.text = val;
    st.textTouched = true;
    st.typed = null;
    return true;
  }

  if (kind==="timeDist" || kind==="carry" || kind==="rounds"){
    st.mode = kind;
    st.rowShape = null;
    st.rows = [];
    st.text = "";
    st.typed = cloneWorkoutValue(val);
    st.typedTouched = true;
    return true;
  }

  return false;
}
function parseScheme(scheme){
  // "4\u00d75" -> 4 sets at 5; "3x8-12" -> start at 8, progress only after 12
  if (!scheme) return null;
  const m = String(scheme).match(/(\d+)\s*[x\u00d7]\s*(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?/);
  if (!m) return null;
  const reps = parseInt(m[2],10);
  const topReps = m[3] ? Math.max(reps, parseInt(m[3],10)) : reps;
  return {sets:parseInt(m[1],10), reps:reps, topReps:topReps};
}
function autoProgressionEnabled(){ return cfg.autoProgressionOn !== false; }
function isAssistedExercise(name){ return /\bassist(?:ed|ance)\b/i.test(String(name||"")); }
function progressionDeltaFor(ex){ return isAssistedExercise(ex&&ex.name) ? -5 : 5; }
function prefillRows(ex, lastVal){
  const sch = parseScheme(ex.scheme);
  if (lastVal){
    const rows = toRows(lastVal);
    if (rows.length){
      // Optional auto-progression: complete the programmed sets at the top of the rep target,
      // with every logged set using the same positive weight. Normal loads add 5 lb;
      // assisted movements reduce assistance by 5 lb, which is the harder direction.
      let auto = false, autoDelta = 0;
      if (autoProgressionEnabled() && sch && rows.length>=sch.sets && rows.every(r=>r.r>=sch.topReps)){
        const w0 = rows[0].w;
        const delta = progressionDeltaFor(ex);
        const nextWeight = Number(w0)+delta;
        if (rows.every(r=>r.w===w0) && w0>0 && nextWeight>0){
          rows.forEach(r=>{ r.w = nextWeight; r.r = sch.reps; });
          auto = true;
          autoDelta = delta;
        }
      }
      return {rows:rows, auto:auto, autoDelta:autoDelta};
    }
  }
  // no history: build empty rows from scheme
  const n = sch ? sch.sets : 3;
  const rows = [];
  for(let i=0;i<n;i++) rows.push({w:"", r: sch?sch.reps:"", done:false, touched:false});
  return {rows:rows, auto:false, autoDelta:0};
}
function initSessionState(){
  workoutDraftLoaded = false;
  sessionState = {};
  sessionSwaps = {};
  const v = wDaySel.value;
  activeSessionType = v;
  if (v==="__CARDIO__") return;

  const last = (v!=="__FREE__") ? lastSessionFor(v) : null;

  sessionList().forEach(ex=>{
    const lastVal = last && last.sets
      ? last.sets[ex.name.replace("[Cardio] ","")]
      : null;
    sessionState[ex.name] = makePlanSessionState(ex,lastVal);
  });
}
// ---------- v51 exercise-level completion engine ----------
// A row is "entered" once the lifter touched it and gave it any value; untouched
// prefilled rows remain plans and can never be saved or logged (v49 rule, kept).
function enteredRows(st){
  return st.rows.map((r,i)=>({r:r, i:i})).filter(x=>x.r.touched && (x.r.w!=="" || x.r.r!==""));
}
function validateExerciseEntry(st){
  if (st.mode==="text"){
    const t = (st.textTouched && st.text.trim()) ? st.text.trim() : null;
    return {ok:true, value:t};
  }

  if (st.mode==="timeDist"){
    if (!st.typedTouched) return {ok:true, value:null};
    const raw = st.typed || {};
    const secs = Number(raw.secs);
    if (!(secs>0)){
      return {ok:false, message:"enter a duration greater than 0 before saving."};
    }

    const hasDist = raw.dist!==undefined && raw.dist!==null && raw.dist!=="";
    const value = {t:"timeDist", secs:secs};

    if (hasDist){
      const dist = Number(raw.dist);
      if (!(dist>0)){
        return {ok:false, message:"enter a distance greater than 0, or clear the distance."};
      }
      if (!EXERCISE_DISTANCE_UNITS.includes(raw.distUnit)){
        return {ok:false, message:"choose a valid distance unit."};
      }
      value.dist = dist;
      value.distUnit = raw.distUnit;
    }

    return {ok:true, value:value};
  }

  if (st.mode==="carry"){
    if (!st.typedTouched) return {ok:true, value:null};
    const raw = st.typed || {};
    const lbs = Number(raw.lbs);
    const dist = Number(raw.dist);

    if (!(lbs>0)){
      return {ok:false, message:"enter a carry weight greater than 0 lb before saving."};
    }
    if (!(dist>0)){
      return {ok:false, message:"enter a carry distance greater than 0 before saving."};
    }
    if (!EXERCISE_DISTANCE_UNITS.includes(raw.distUnit)){
      return {ok:false, message:"choose a valid carry distance unit."};
    }

    return {
      ok:true,
      value:{t:"carry", lbs:lbs, dist:dist, distUnit:raw.distUnit}
    };
  }

  if (st.mode==="rounds"){
    if (!st.typedTouched) return {ok:true, value:null};
    const raw = st.typed || {};
    const rounds = Number(raw.rounds);
    const workSecs = Number(raw.workSecs);
    const recSecs = Number(raw.recSecs);

    if (!(Number.isInteger(rounds) && rounds>0)){
      return {ok:false, message:"enter a whole number of rounds greater than 0."};
    }
    if (!(Number.isInteger(workSecs) && workSecs>0)){
      return {ok:false, message:"enter whole work seconds greater than 0."};
    }
    if (!(Number.isInteger(recSecs) && recSecs>=0)){
      return {ok:false, message:"enter whole recovery seconds of 0 or more."};
    }

    const value = {
      t:"rounds",
      rounds:rounds,
      workSecs:workSecs,
      recSecs:recSecs
    };
    if (typeof raw.note==="string" && raw.note.trim()){
      value.note = raw.note.trim();
    }
    return {ok:true, value:value};
  }

  if (st.mode==="future"){
    return {
      ok:false,
      message:"this entry was saved by a newer BlackPyre version and is read-only."
    };
  }

  const entered = enteredRows(st);
  if (!entered.length) return {ok:true, value:null};

  const sets = [];
  const repsOnly = st.rowShape==="reps";

  for (const x of entered){
    const reps = Number(x.r.r);
    const hasWeight = x.r.w!==undefined && x.r.w!==null && x.r.w!=="";

    if (!(reps>0)){
      return {
        ok:false,
        rowIndex:x.i,
        field:"reps",
        message:"enter reps for Set "+(x.i+1)+", or clear it, before saving."
      };
    }

    if (repsOnly){
      const row = {r:reps};
      if (hasWeight){
        const weight = Number(x.r.w);
        if (!(weight>=0)){
          return {
            ok:false,
            rowIndex:x.i,
            field:"weight",
            message:"enter a valid optional weight for Set "+(x.i+1)+", or clear it."
          };
        }
        row.w = weight;
      }
      sets.push(row);
      continue;
    }

    if (!(Number(x.r.w)>0)){
      return {
        ok:false,
        rowIndex:x.i,
        field:"weight",
        message:"enter weight and reps for Set "+(x.i+1)+", or clear it, before saving."
      };
    }

    sets.push({w:Number(x.r.w), r:reps});
  }

  return {ok:true, value:sets};
}
function saveExercise(exName){
  const st = sessionState[exName];
  if (!st) return {ok:false};
  const key = exName.replace("[Cardio] ","");
  const v = validateExerciseEntry(st);
  if (!v.ok){
    showWorkoutError(key+" — "+v.message, v.rowIndex==null ? null : findSessionSetInput(exName, v.rowIndex, v.field || (!(Number(st.rows[v.rowIndex].w)>0)?"weight":"reps")));
    return {ok:false};
  }
  if (v.value===null){
    const message = st.mode==="text"
      ? "enter details / notes before saving this exercise."
      : "enter at least one set before saving this exercise.";
    showWorkoutError(key+" — "+message, null);
    return {ok:false};
  }
  const previousSaved = st.saved;
  const previousStatus = st.status;
  st.saved = v.value;
  st.status = "saved";
  const persisted = persistWorkoutDraft();
  if (!persisted.ok){
    st.saved = previousSaved;
    st.status = previousStatus==="saved" ? "saved" : "unsaved";
    renderSessionInputs();
    showWorkoutError(persisted.cancelled ? "The existing saved workout draft was kept. Resume or discard it before starting a different session." : "This exercise could not be saved to the workout draft.", null);
    return {ok:false};
  }
  clearWorkoutError();
  renderSessionInputs();
  return {ok:true};
}
function hasUnsavedEntry(st){
  if (st.status!=="unsaved") return false;
  if (st.mode==="text") return !!st.textTouched && !!st.text.trim();
  if (st.mode==="timeDist" || st.mode==="carry" || st.mode==="rounds") return !!st.typedTouched;
  if (st.mode==="future") return false;
  return enteredRows(st).length>0;
}
function unsavedExerciseNames(){
  return Object.keys(sessionState).filter(n=>hasUnsavedEntry(sessionState[n]));
}
function collectSavedSessionSets(state){
  const sets = {};
  let completedRows = 0;
  for (const exName of Object.keys(state)){
    const st = state[exName];
    if (st.status!=="saved" || st.saved==null) continue;
    const key = exName.replace("[Cardio] ","");
    sets[key] = st.saved;
    if (Array.isArray(st.saved)) completedRows += st.saved.length;
  }
  return {ok:true, sets:sets, completedRows:completedRows, error:null};
}

function draftTitleFor(dayId){
  if (dayId==="__FREE__") return "Freestyle";
  const d = program.days.find(x=>x.id===dayId);
  return d ? d.title : "Saved workout";
}
function buildWorkoutDraft(){
  const collected = collectSavedSessionSets(sessionState);
  if (!Object.keys(collected.sets).length) return null;
  return {
    date:document.getElementById("wDate").value || todayStr(),
    day:wDaySel.value,
    title:draftTitleFor(wDaySel.value),
    programName:program.name || "Unnamed program",
    sets:cloneJSON(collected.sets),
    notes:document.getElementById("wNotes").value.trim(),
    updatedAt:new Date().toISOString()
  };
}
function sameDraftSession(a,b){ return !!a && !!b && a.date===b.date && a.day===b.day; }
function persistWorkoutDraft(){
  if (editingWorkoutIdx!=null) return {ok:true, skipped:true};
  const next = buildWorkoutDraft();
  if (!next) return {ok:true, skipped:true};
  const previous = data.activeWorkoutDraft ? cloneJSON(data.activeWorkoutDraft) : null;
  if (previous && !sameDraftSession(previous,next) && !workoutDraftLoaded){
    if (!confirm('A saved workout draft already exists for "'+(previous.title||"another session")+'".\n\nDiscard that draft and save this exercise as a new draft?')) return {ok:false, cancelled:true};
  }
  data.activeWorkoutDraft = next;
  if (!save()){
    data.activeWorkoutDraft = previous;
    return {ok:false, reason:"Workout draft could not be saved."};
  }
  workoutDraftLoaded = true;
  renderWorkoutDraftCard();
  return {ok:true};
}
function renderWorkoutDraftCard(){
  const card = document.getElementById("workoutDraftCard");
  const text = document.getElementById("workoutDraftText");
  if (!card || !text) return;
  const d = data.activeWorkoutDraft;
  // While the draft is already open in this session, Completed cards are the status UI.
  // Resume/Discard appears only after a reload or when another saved draft is not loaded.
  if (!d || workoutDraftLoaded){ card.classList.add("hidden"); text.textContent=""; return; }
  const count = Object.keys(d.sets||{}).length;
  text.textContent = (d.title||"Workout")+" · "+fmtDate(d.date)+" · "+count+" saved exercise"+(count===1?"":"s")+". Resume it or deliberately discard it.";
  card.classList.remove("hidden");
}
function resumeWorkoutDraft(){
  const d = data.activeWorkoutDraft;
  if (!d) return false;

  if (sessionDraftHasMeaningfulWork() && !workoutDraftLoaded){
    if (!confirm("Replace the current in-progress screen with the saved workout draft?")) return false;
  }

  document.getElementById("wDate").value = d.date || todayStr();
  document.getElementById("wNotes").value = d.notes || "";

  const hasDay = [...wDaySel.options].some(o=>o.value===d.day);
  wDaySel.value = hasDay ? d.day : "__FREE__";

  const dayObj = program.days.find(x=>x.id===wDaySel.value);
  const planned = dayObj
    ? dayObj.exercises.map(ex=>ex.name.replace("[Cardio] ",""))
    : [];

  extraExercises = Object.keys(d.sets||{})
    .filter(name=>planned.indexOf(name)===-1)
    .map(name=>({name:name,scheme:""}));

  initSessionState();

  Object.keys(d.sets||{}).forEach(key=>{
    const stateName = Object.keys(sessionState)
      .find(n=>n.replace("[Cardio] ","")===key) || key;

    sessionState[stateName] = makeSavedSessionState(stateName,d.sets[key]);
  });

  activeSessionType = wDaySel.value;
  workoutDraftLoaded = true;
  clearWorkoutError();
  renderSessionInputs();
  renderWorkoutDraftCard();
  activateView("work","trainingSessionCard",false);
  flashSave("Workout draft resumed ✓");
  return true;
}
function discardWorkoutDraft(ask, resetSession){
  const old = data.activeWorkoutDraft;
  if (!old) return true;
  if (ask!==false && !confirm('Discard the saved workout draft for "'+(old.title||"this session")+'"?')) return false;
  data.activeWorkoutDraft = null;
  if (!save()){
    data.activeWorkoutDraft = old;
    return false;
  }
  const wasLoaded = workoutDraftLoaded;
  workoutDraftLoaded = false;
  if (resetSession!==false && wasLoaded){
    extraExercises=[];
    clearSessionDraftFields();
    initSessionState();
    renderSessionInputs();
  }
  renderWorkoutDraftCard();
  flashSave("Workout draft discarded");
  return true;
}
document.getElementById("resumeWorkoutDraftBtn").addEventListener("click", resumeWorkoutDraft);
document.getElementById("discardWorkoutDraftBtn").addEventListener("click", ()=>discardWorkoutDraft(true,true));

// A successful backup restore replaces persisted data and program state.
// Sever every transient reference to the pre-restore workout screen before
// rebuilding the UI. Otherwise stale loaded-session state can hide and later
// delete the newly restored activeWorkoutDraft.
function resetTrainingUiAfterRestore(){
  workoutDraftLoaded = false;
  extraExercises = [];
  sessionState = {};
  sessionSwaps = {};
  activeSessionType = null;

  if (typeof editingWorkoutIdx!=="undefined"){
    editingWorkoutIdx = null;
  }

  const dateInput = document.getElementById("wDate");
  if (dateInput) dateInput.value = todayStr();

  clearSessionDraftFields();
  renderDayOptions();
  initSessionState();
  renderLibraryOptions();
  clearWorkoutError();
  renderSessionInputs();
  renderWorkoutDraftCard();
}

function clearWorkoutError(){
  const el = document.getElementById("workoutErr");
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}
function showWorkoutError(message, target){
  const el = document.getElementById("workoutErr");
  el.textContent = message;
  el.classList.remove("hidden");
  if (target){
    if (target.focus) target.focus();
    if (target.scrollIntoView) target.scrollIntoView({behavior:"smooth", block:"center"});
  } else if (el.scrollIntoView){
    el.scrollIntoView({behavior:"smooth", block:"center"});
  }
}
function findSessionSetInput(exercise, rowIndex, field){
  return [...document.querySelectorAll("#exerciseInputs .snum")].find(el=>
    el.dataset.exercise===exercise && Number(el.dataset.row)===rowIndex && el.dataset.field===field) || null;
}

function markUnsavedChip(exDiv){
  const c = exDiv.querySelector(".unsavedChip");
  if (c) c.style.display = "";
}

function touchTypedWorkoutState(st, div){
  st.typedTouched = true;
  st.status = "unsaved";
  markUnsavedChip(div);
  clearWorkoutError();
}

function appendTypedWorkoutEditor(div, ex, st){
  const name = ex.name.replace("[Cardio] ","");
  if (!st.typed) st.typed = blankTypedWorkoutValue(st.mode);

  const addNumber = (label, key, placeholder, options)=>{
    const row = document.createElement("div");
    row.className = "srow";

    const lab = document.createElement("span");
    lab.className = "slabel";
    lab.textContent = label;
    row.appendChild(lab);

    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "snum";
    inp.inputMode = options && options.integer ? "numeric" : "decimal";
    inp.placeholder = placeholder || "";
    inp.value = st.typed[key]===undefined || st.typed[key]===null
      ? ""
      : st.typed[key];

    if (options && options.min!==undefined) inp.min = String(options.min);
    if (options && options.step!==undefined) inp.step = String(options.step);

    inp.setAttribute("aria-label",name+" "+label.toLowerCase());

    inp.addEventListener("input",()=>{
      st.typed[key] = inp.value==="" ? "" : Number(inp.value);
      touchTypedWorkoutState(st,div);
    });

    row.appendChild(inp);
    div.appendChild(row);
    return inp;
  };

  const addUnit = (label, key)=>{
    const row = document.createElement("div");
    row.className = "srow";

    const lab = document.createElement("span");
    lab.className = "slabel";
    lab.textContent = label;
    row.appendChild(lab);

    const sel = document.createElement("select");
    sel.setAttribute("aria-label",name+" distance unit");

    EXERCISE_DISTANCE_UNITS.forEach(unit=>{
      const opt = document.createElement("option");
      opt.value = unit;
      opt.textContent = unit;
      sel.appendChild(opt);
    });

    sel.value = EXERCISE_DISTANCE_UNITS.includes(st.typed[key])
      ? st.typed[key]
      : EXERCISE_DISTANCE_UNITS[0];

    st.typed[key] = sel.value;

    sel.addEventListener("change",()=>{
      st.typed[key] = sel.value;
      touchTypedWorkoutState(st,div);
    });

    row.appendChild(sel);
    div.appendChild(row);
  };

  if (st.mode==="timeDist"){
    const totalSecs = Number(st.typed.secs);
    const hasDuration =
      st.typed.secs!=="" &&
      Number.isFinite(totalSecs) &&
      totalSecs>=0;

    const initialMinutes = hasDuration
      ? Math.floor(totalSecs/60)
      : "";

    const initialSeconds = hasDuration
      ? totalSecs%60
      : "";

    const addDurationNumber = (label,value,aria,max)=>{
      const row = document.createElement("div");
      row.className = "srow";

      const lab = document.createElement("span");
      lab.className = "slabel";
      lab.textContent = label;

      const input = document.createElement("input");
      input.type = "number";
      input.inputMode = "numeric";
      input.min = "0";
      input.step = "1";

      if (max!=null) input.max = String(max);

      input.value = value;
      input.setAttribute("aria-label",name+" "+aria);

      row.appendChild(lab);
      row.appendChild(input);
      div.appendChild(row);

      return input;
    };

    const minutesInput =
      addDurationNumber("Minutes",initialMinutes,"minutes",null);

    const secondsInput =
      addDurationNumber("Seconds",initialSeconds,"seconds",59);

    const syncDuration = ()=>{
      const mText = minutesInput.value.trim();
      const sText = secondsInput.value.trim();

      if (mText==="" && sText===""){
        st.typed.secs = "";
        touchTypedWorkoutState(st,div);
        return;
      }

      const minutes = mText==="" ? 0 : Number(mText);
      const seconds = sText==="" ? 0 : Number(sText);

      if (
        !Number.isInteger(minutes) ||
        minutes<0 ||
        !Number.isInteger(seconds) ||
        seconds<0 ||
        seconds>59
      ){
        st.typed.secs = "";
        touchTypedWorkoutState(st,div);
        return;
      }

      st.typed.secs = (minutes*60)+seconds;
      touchTypedWorkoutState(st,div);
    };

    minutesInput.addEventListener("input",syncDuration);
    secondsInput.addEventListener("input",syncDuration);

    addNumber("Distance","dist","optional",{min:0,step:"any"});
    addUnit("Distance unit","distUnit");
    return;
  }

  if (st.mode==="carry"){
    addNumber("Weight (lb)","lbs","lb",{min:0,step:"any"});
    addNumber("Distance","dist","distance",{min:0,step:"any"});
    addUnit("Distance unit","distUnit");
    return;
  }

  if (st.mode==="rounds"){
    addNumber("Rounds","rounds","rounds",{min:1,step:1,integer:true});
    addNumber("Work (sec)","workSecs","seconds",{min:1,step:1,integer:true});
    addNumber("Recovery (sec)","recSecs","seconds",{min:0,step:1,integer:true});

    const row = document.createElement("div");
    row.className = "srow";

    const lab = document.createElement("span");
    lab.className = "slabel";
    lab.textContent = "Note";
    row.appendChild(lab);

    const note = document.createElement("input");
    note.placeholder = "optional";
    note.value = typeof st.typed.note==="string" ? st.typed.note : "";
    note.setAttribute("aria-label",name+" rounds note");
    note.addEventListener("input",()=>{
      st.typed.note = note.value;
      touchTypedWorkoutState(st,div);
    });

    row.appendChild(note);
    div.appendChild(row);
  }
}

function renderSessionInputs(){
  renderProgramIdentity();
  const v = wDaySel.value;
  const strengthBlock = document.getElementById("strengthBlock");
  const cardioBlock = document.getElementById("cardioBlock");
  if (v==="__CARDIO__"){
    strengthBlock.classList.add("hidden"); cardioBlock.classList.remove("hidden");
    return;
  }
  strengthBlock.classList.remove("hidden"); cardioBlock.classList.add("hidden");
  const last = (v!=="__FREE__") ? lastSessionFor(v) : null;
  const list = sessionList();
  const container = document.getElementById("exerciseInputs");
  container.innerHTML = "";
  if (!list.length){
    container.innerHTML = '<div class="note" style="margin-bottom:14px;">No exercises yet \u2014 add from the library below.</div>';
    return;
  }
  list.forEach(ex=>{
    if (!sessionState[ex.name]) {
      const historical = last && last.sets
        ? last.sets[ex.name.replace("[Cardio] ","")]
        : null;
      sessionState[ex.name] = makePlanSessionState(ex,historical);
    }
    const st = sessionState[ex.name];
    const prevVal = last && last.sets ? last.sets[ex.name.replace("[Cardio] ","")] : null;
    const div = document.createElement("div");
    div.className = "exercise";
    if (st.status==="saved" && st.saved!=null){
      const head0 = document.createElement("div");
      head0.className = "x-head";
      head0.innerHTML = '<span><b>'+esc(ex.name.replace("[Cardio] ",""))+'</b>'
        +(ex.scheme?' <span class="scheme">· '+esc(ex.scheme)+'</span>':'')+'</span>';
      div.appendChild(head0);

      const line = document.createElement("div");
      line.className = "savedLine";
      line.innerHTML = '<span class="savedChip">✓ Completed</span> <span>'+esc(formatSets(st.saved))+'</span>';

      const savedKind = workoutValueKind(st.saved);

      if (editableWorkoutValueKind(savedKind)){
        const editBtn = document.createElement("button");
        editBtn.className = "xbtn";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click",()=>{
          if (!loadWorkoutValueIntoEditableState(st,ex.name,st.saved)){
            showWorkoutError(ex.name.replace("[Cardio] ","")+" — this saved entry cannot be edited by this BlackPyre version.",null);
            return;
          }
          st.status = "unsaved";
          clearWorkoutError();
          renderSessionInputs();
        });
        line.appendChild(editBtn);
      } else {
        const ro = document.createElement("span");
        ro.className = "scheme";
        ro.textContent = "Read only";
        line.appendChild(ro);
      }

      div.appendChild(line);
      container.appendChild(div);
      return;
    }
    const head = document.createElement("div");
    head.className = "x-head";
    head.innerHTML = '<span><b>'+esc(ex.name.replace("[Cardio] ",""))+'</b>'
      +(ex.scheme?' <span class="scheme">\u00b7 '+esc(ex.scheme)+'</span>':'')
      +(st.auto?' <span class="autoUp">'+(st.autoDelta<0?'−5 assist':'+5 auto')+'</span>':'')+'</span>';
    const tools = document.createElement("div");
    tools.className = "x-tools";
    if (prevVal && editableWorkoutValueKind(workoutValueKind(prevVal))){
      const sameBtn = document.createElement("button");
      sameBtn.className = "xbtn";
      sameBtn.textContent = "= last";
      sameBtn.title = "Log same as last time";
      sameBtn.addEventListener("click",()=>{
        if (!loadWorkoutValueIntoEditableState(st,ex.name,prevVal)) return;
        st.status = "unsaved";
        clearWorkoutError();
        renderSessionInputs();
      });
      tools.appendChild(sameBtn);
    }
    const vBtn = document.createElement("button");
    vBtn.className = "xbtn"; vBtn.textContent = "Video";
    vBtn.title = "How to do this - video";
    vBtn.addEventListener("click", ()=>openFormVideo(ex.name));
    tools.appendChild(vBtn);

    if (extraExerciseIndex(ex.name)>=0){
      const removeBtn = document.createElement("button");
      removeBtn.className = "xbtn";
      removeBtn.textContent = "Remove";
      removeBtn.style.color = "var(--warn)";
      removeBtn.setAttribute(
        "aria-label",
        "Remove "+ex.name.replace("[Cardio] ","")
      );
      removeBtn.addEventListener("click",()=>{
        removeUnsavedExtraExercise(ex.name);
      });
      tools.appendChild(removeBtn);
    }
    const origName = ex.__orig || ex.name;

    const plannedExercise =
      currentDayExercises()
        .some(
          planned=>
            planned
            && planned.name===origName
        );

    if (plannedExercise){
      const swBtn =
        document.createElement("button");

      swBtn.className = "xbtn";
      swBtn.textContent = "Replace";
      swBtn.title = "Replace this exercise";

      swBtn.setAttribute(
        "aria-label",
        "Replace "
          +ex.name.replace("[Cardio] ","")
      );

      swBtn.addEventListener("click", ()=>{
        const existing =
          div.querySelector(".swapmenu");

        if (existing){
          existing.remove();
          return;
        }

        const holder =
          document.createElement("div");

        holder.className = "swapmenu";

        div.insertBefore(
          holder,
          div.children[1] || null
        );

        offerSwap(
          origName,
          ex.name,
          holder
        );
      });

      tools.appendChild(swBtn);
    }
    const canonicalShape = exerciseShapeForName(ex.name);
    const allowLegacyToggle = !canonicalShape || canonicalShape==="lift";
    if (allowLegacyToggle && (st.mode==="rows" || st.mode==="text")){
      const tBtn = document.createElement("button");
      tBtn.className = "xbtn";
      tBtn.textContent = st.mode==="rows" ? "Aa" : "#";
      tBtn.title = "Toggle text entry";
      tBtn.addEventListener("click",()=>{
        if (st.mode==="rows"){
          const entered = enteredRows(st)
            .map(x=>x.r)
            .filter(r=>Number(r.w)>0 && Number(r.r)>0);
          st.text = entered.map(r=>r.w+"x"+r.r).join(", ");
          st.textTouched = entered.length>0;
          if (st.textTouched) st.status = "unsaved";
          st.mode = "text";
        } else {
          const hadText = !!st.textTouched && !!st.text.trim();
          st.rows = toRows(st.text).map(r=>({
            w:r.w,
            r:r.r,
            done:false,
            touched:hadText
          }));
          if (!st.rows.length){
            st.rows = [{w:"",r:"",done:false,touched:false}];
          }
          st.rowShape = "lift";
          if (hadText) st.status = "unsaved";
          st.mode = "rows";
        }
        clearWorkoutError();
        renderSessionInputs();
      });
      tools.appendChild(tBtn);
    }
    head.appendChild(tools);
    div.appendChild(head);
    if (prevVal){
      const lastLine = document.createElement("div");
      lastLine.style.cssText = "color:var(--dim); font-size:11px; margin-bottom:6px;";
      lastLine.textContent = "last: "+formatSets(prevVal);
      div.appendChild(lastLine);
    }

    if (st.mode==="text"){
      const row = document.createElement("div");
      row.className = "srow";

      const lab = document.createElement("span");
      lab.className = "slabel";
      lab.textContent = "Details / notes (required)";

      const inp = document.createElement("input");
      inp.setAttribute(
        "aria-label",
        ex.name.replace("[Cardio] ","")+" details or notes"
      );
      inp.placeholder = "Enter what you completed";
      inp.value = st.text;
      inp.addEventListener("input",()=>{
        st.text = inp.value;
        st.textTouched = true;
        st.status = "unsaved";
        markUnsavedChip(div);
        clearWorkoutError();
      });

      row.appendChild(lab);
      row.appendChild(inp);
      div.appendChild(row);
    } else if (st.mode==="timeDist" || st.mode==="carry" || st.mode==="rounds"){
      appendTypedWorkoutEditor(div,ex,st);
    } else if (st.mode==="future"){
      const notice = document.createElement("div");
      notice.className = "note";
      notice.textContent = newerWorkoutValueNotice(st.saved);
      div.appendChild(notice);
    } else {
      st.rows.forEach((row, ri)=>{
        const rdiv = document.createElement("div");
        rdiv.className = "srow";
        rdiv.innerHTML = '<span class="slabel">Set '+(ri+1)+'</span>';
        const mkStep = (txt, label, fn)=>{ const b=document.createElement("button"); b.className="step"; b.textContent=txt; b.setAttribute("aria-label",label); b.addEventListener("click", fn); return b; };
        const wIn = document.createElement("input");
        wIn.type="number"; wIn.className="snum"; wIn.inputMode="decimal"; wIn.placeholder=st.rowShape==="reps" ? "lb opt." : "lb"; wIn.value=(row.w===undefined || row.w===null) ? "" : row.w;
        wIn.dataset.exercise=ex.name; wIn.dataset.row=String(ri); wIn.dataset.field="weight";
        wIn.setAttribute("aria-label",ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" weight in pounds");
        wIn.addEventListener("input", ()=>{ row.w = wIn.value===""?"":Number(wIn.value); row.touched=true; st.status="unsaved"; markUnsavedChip(div); clearWorkoutError(); });
        const rIn = document.createElement("input");
        rIn.type="number"; rIn.className="snum"; rIn.inputMode="numeric"; rIn.placeholder="reps"; rIn.value=row.r;
        rIn.dataset.exercise=ex.name; rIn.dataset.row=String(ri); rIn.dataset.field="reps";
        rIn.setAttribute("aria-label",ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" repetitions");
        rIn.addEventListener("input", ()=>{ row.r = rIn.value===""?"":Number(rIn.value); row.touched=true; st.status="unsaved"; markUnsavedChip(div); clearWorkoutError(); });
        rdiv.appendChild(mkStep("\u22125", "Decrease "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" weight by 5 pounds", ()=>{ row.w = Math.max(0,(Number(row.w)||0)-5); row.touched=true; st.status="unsaved"; markUnsavedChip(div); wIn.value=row.w; clearWorkoutError(); }));
        rdiv.appendChild(wIn);
        rdiv.appendChild(mkStep("+5", "Increase "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" weight by 5 pounds", ()=>{ row.w = (Number(row.w)||0)+5; row.touched=true; st.status="unsaved"; markUnsavedChip(div); wIn.value=row.w; clearWorkoutError(); }));
        const x = document.createElement("span"); x.className="sx"; x.textContent="\u00d7"; rdiv.appendChild(x);
        rdiv.appendChild(mkStep("\u22121", "Decrease "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" repetitions by 1", ()=>{ row.r = Math.max(0,(Number(row.r)||0)-1); row.touched=true; st.status="unsaved"; markUnsavedChip(div); rIn.value=row.r; clearWorkoutError(); }));
        rdiv.appendChild(rIn);
        rdiv.appendChild(mkStep("+1", "Increase "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" repetitions by 1", ()=>{ row.r = (Number(row.r)||0)+1; row.touched=true; st.status="unsaved"; markUnsavedChip(div); rIn.value=row.r; clearWorkoutError(); }));
        div.appendChild(rdiv);
      });
      const addRow = document.createElement("button");
      addRow.className = "xbtn"; addRow.textContent = "+ Add set";
      addRow.style.marginTop = "2px";
      addRow.addEventListener("click", ()=>{
        const filled = st.rows.slice().reverse().find(r=>Number(r.w)>0);
        const prev = filled || st.rows[st.rows.length-1];
        st.rows.push(prev ? {w:prev.w, r:prev.r, done:false, touched:true} : {w:"", r:"", done:false, touched:true});
        st.status = "unsaved";
        clearWorkoutError();
        renderSessionInputs();
      });
      div.appendChild(addRow);
    }
    const foot = document.createElement("div");
    foot.className = "exFoot";
    const saveBtn = document.createElement("button");
    saveBtn.className = "xbtn saveExBtn";
    saveBtn.textContent = "Save Exercise";
    saveBtn.dataset.exercise = ex.name;
    saveBtn.addEventListener("click", ()=>saveExercise(ex.name));
    foot.appendChild(saveBtn);
    const chip = document.createElement("span");
    chip.className = "unsavedChip";
    chip.textContent = "Unsaved";
    if (!hasUnsavedEntry(st)) chip.style.display = "none";
    foot.appendChild(chip);
    div.appendChild(foot);
    container.appendChild(div);
  });
}

document.getElementById(
  "addExSearch"
).addEventListener("input",()=>{
  renderLibraryOptions();
});

document.getElementById("addExSel").addEventListener("change", ()=>{
  setFreestyleCustomControlsVisible(
    document.getElementById("addExSel").value==="__CUSTOM__"
  );
});

document.getElementById("addExBtn").addEventListener("click", ()=>{
  const picker = document.getElementById("addExSel");
  let name = picker.value;

  if (name==="__CUSTOM__"){
    const nameInput = document.getElementById("addExCustom");
    const shapeSel = ensureFreestyleCustomShapeSelect();

    const created = createUserExercise(
      nameInput.value,
      shapeSel.value
    );

    if (!created.ok){
      flashSave(created.reason,true);
      return;
    }

    name = created.entry.name;

    nameInput.value = "";
    shapeSel.value = "lift";

    renderLibraryOptions();
    picker.value = name;

    flashSave("Custom exercise saved ✓");
  }

  const duplicate = sessionList().some(ex=>
    ex.name.replace("[Cardio] ","")===name.replace("[Cardio] ","")
  );

  if (duplicate){
    showWorkoutError(
      name.replace("[Cardio] ","")+" — this exercise is already in the session.",
      null
    );
    return;
  }

  extraExercises.push({name:name,scheme:""});

  const search =
    document.getElementById("addExSearch");

  if (search) search.value = "";

  clearWorkoutError();
  renderLibraryOptions();
  renderSessionInputs();
});

document.getElementById("logWorkoutBtn").addEventListener("click", ()=>{
  const v = wDaySel.value;
  const date = document.getElementById("wDate").value;
  const notes = document.getElementById("wNotes").value.trim();
  clearWorkoutError();
  if (!date){ showWorkoutError("Choose a date before logging this session.", document.getElementById("wDate")); return; }

  if (v==="__CARDIO__"){
    const type = document.getElementById("cardioType").value;
    const min = document.getElementById("cardioMin").value;
    const detail = document.getElementById("cardioDetail").value.trim();
    if(!(Number(min)>0)){
      showWorkoutError("Enter cardio minutes before logging this session.", document.getElementById("cardioMin"));
      return;
    }
    const sets = {}; sets[type] = min+" min"+(detail?" \u00b7 "+detail:"");
    const cObj = {date:date, day:"CARDIO", title:"Cardio", sets:sets, notes:notes};
    const wasCardioEdit = editingWorkoutIdx!=null;
    if (wasCardioEdit){ data.workouts[editingWorkoutIdx] = cObj; }
    else { data.workouts.push(cObj); bumpLog(); }
    document.getElementById("cardioMin").value=""; document.getElementById("cardioDetail").value="";
    save(); renderWork(); renderDash(); renderBackup();
    if (wasCardioEdit){
      endWorkoutEdit();
      ackBtn("logWorkoutBtn", "\u2713 Session updated");
      flashSave("Session updated \u2713");
    } else {
      showCelebration("Cardio Banked", null, type+" \u00b7 "+min+" min");
    }
    return;
  }
  // v51: never silently ignore or log unsaved entered work — warn even for ONE unsaved exercise
  const unsaved = unsavedExerciseNames();
  if (unsaved.length){
    const pretty = unsaved.map(n=>n.replace("[Cardio] ","")).join(", ");
    const ok = confirm("Unsaved exercise"+(unsaved.length>1?"s":"")+": "+pretty
      +"\n\nOK — Save valid exercises & log session\nCancel — Review exercises");
    if (!ok){
      showWorkoutError("Review the unsaved exercise"+(unsaved.length>1?"s":"")+" ("+pretty+"), tap Save Exercise on each, then log the session.", document.getElementById("exerciseInputs"));
      return;
    }
    for (const n of unsaved){
      if (!saveExercise(n).ok) return; // precise row error already shown; nothing logged
    }
  }
  const collected = collectSavedSessionSets(sessionState);
  const sets = collected.sets;
  if(Object.keys(sets).length===0){
    showWorkoutError("Nothing saved yet — tap Save Exercise on at least one exercise before logging this session.", document.getElementById("exerciseInputs"));
    return;
  }
  // PR detection BEFORE pushing the new session
  const prLines = [];
  Object.keys(sets).forEach(ex=>{
    const nb = parseBestSet(sets[ex]);
    if(!nb) return;
    const hist = bestHistorical(ex, editingWorkoutIdx!=null ? editingWorkoutIdx : -1);
    if (hist && nb.e1rm > hist.e1rm + 0.5){
      prLines.push("\ud83c\udfc6 PR: "+ex+" "+nb.w+"\u00d7"+nb.r+" (est 1RM "+Math.round(nb.e1rm)+", was "+Math.round(hist.e1rm)+")");
    }
  });
  const day = program.days.find(p=>p.id===v);
  const wasEdit = editingWorkoutIdx!=null;
  const beforeLogData = cloneJSON(data);
  if (wasEdit){
    const orig = data.workouts[editingWorkoutIdx];
    data.workouts[editingWorkoutIdx] = {date:date, day:orig.day, title:orig.title, sets:sets, notes:notes};
  } else {
    data.workouts.push({date:date, day:v, title: v==="__FREE__" ? "Freestyle" : (day?day.title:v), sets:sets, notes:notes});
    data.activeWorkoutDraft = null;
    bumpLog();
  }
  if (!save()){
    data = beforeLogData;
    showWorkoutError("The session could not be saved. Your workout draft is still available.", null);
    renderWorkoutDraftCard();
    return;
  }
  workoutDraftLoaded = false;
  extraExercises=[];
  initSessionState();
  renderSessionInputs();
  document.getElementById("wNotes").value="";
  renderWork(); renderDash(); renderNextWorkout(); renderBackup();
  if (wasEdit){
    endWorkoutEdit();
    ackBtn("logWorkoutBtn", "\u2713 Session updated");
    flashSave("Session updated \u2713"+(prLines.length?" \u00b7 PR!":""));
    return;
  }
  const streak = computeStreak();
  showCelebration(prLines.length ? "PR FORGED" : "Session Forged", prLines,
    Object.keys(sets).length+" exercises logged"+(streak>1?"  \u00b7  \ud83d\udd25 "+streak+"-day streak":""));
});

const WORK_HISTORY_PAGE_SIZE = 25;
let workHistoryVisibleCount = WORK_HISTORY_PAGE_SIZE;

function renderWork(){
  renderWorkoutDraftCard();
  renderPRs();
  renderProgramIdentity();

  const el = document.getElementById("workHistory");
  const countEl = document.getElementById("workHistoryCount");

  if (countEl){
    countEl.textContent =
      data.workouts.length+" session"+(data.workouts.length===1?"":"s");
  }

  if(data.workouts.length===0){
    workHistoryVisibleCount = WORK_HISTORY_PAGE_SIZE;
    el.innerHTML =
      '<div style="padding:18px; font-size:13px; color:var(--dim);">No sessions yet.</div>';
    return;
  }

  const sorted = data.workouts
    .map((s,idx)=>Object.assign({},s,{idx:idx}))
    .sort((a,b)=>b.date.localeCompare(a.date) || b.idx-a.idx);

  const visible = sorted.slice(0,workHistoryVisibleCount);

  const body = visible.map(s=>{
    const dayObj = program.days.find(p=>p.id===s.day);
    const title = s.title || (dayObj?dayObj.title:s.day) || "Workout";
    const names = Object.keys(s.sets||{});

    const values = names.map(ex=>
      '<div>'+esc(ex)+': <span style="color:var(--text)">'
      +esc(formatSets(s.sets[ex]))+'</span></div>'
    ).join("");

    return '<details class="workSession" data-i="'+s.idx+'" style="border-bottom:1px solid var(--border);">'
      +'<summary style="padding:13px 16px; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; gap:12px;">'
      +'<span style="min-width:0;"><span style="font-weight:600; color:var(--ember);">'
      +fmtDate(s.date)+'</span> <span style="color:var(--dim);">·</span> '
      +'<span style="color:var(--text);">'+esc(title)+'</span></span>'
      +'<span style="flex:none; color:var(--dim); font-size:10px;">'
      +names.length+' exercise'+(names.length===1?'':'s')+'</span>'
      +'</summary>'
      +'<div style="padding:0 16px 14px; font-size:12px;">'
      +'<div style="color:var(--dim); line-height:1.7;">'
      +values
      +(s.notes?'<div style="color:var(--ember); margin-top:5px;">Note: '+esc(s.notes)+'</div>':'')
      +'</div>'
      +'<div style="display:flex; justify-content:flex-end; gap:6px; margin-top:10px;">'
      +'<button class="xbtn edtWork" data-i="'+s.idx+'" aria-label="Edit '+esc(title)+'">✎ Edit</button>'
      +'<button class="xbtn delWork" data-i="'+s.idx+'" aria-label="Delete '+esc(title)+'" style="color:var(--warn);">✕ Delete</button>'
      +'</div></div></details>';
  }).join("");

  const remaining = sorted.length-visible.length;
  const nextCount = Math.min(WORK_HISTORY_PAGE_SIZE,remaining);

  el.innerHTML = body
    +(remaining>0
      ? '<div style="padding:12px 16px; text-align:center;">'
        +'<button class="btn ghost small" id="workHistoryMore">Load '
        +nextCount+' older workout'+(nextCount===1?'':'s')+'</button>'
        +'<div style="color:var(--dim); font-size:10px; margin-top:6px;">'
        +visible.length+' of '+sorted.length+' sessions shown</div></div>'
      : '');

  // Dynamic control: query inside the just-rendered History container
  // rather than treating it as a permanent static document element.
  const more = el.querySelector("#workHistoryMore");

  if (more){
    more.addEventListener("click",()=>{
      workHistoryVisibleCount += WORK_HISTORY_PAGE_SIZE;
      renderWork();
    });
  }

  el.querySelectorAll(".delWork").forEach(b=>b.addEventListener("click",()=>{
    const i = Number(b.dataset.i);
    const removed = data.workouts[i];

    if (!removed) return;

    data.workouts.splice(i,1);

    if (!save()){
      data.workouts.splice(i,0,removed);
      renderWork();
      return;
    }

    renderWork();
    renderDash();

    offerUndo('Deleted workout "'+(removed.title||removed.day||"session")+'"', ()=>{
      data.workouts.splice(Math.min(i,data.workouts.length),0,removed);
      save();
      renderWork();
      renderDash();
      flashSave("Workout restored ✓");
    });
  }));

  el.querySelectorAll(".edtWork").forEach(
    b=>b.addEventListener("click",()=>startEditWorkout(Number(b.dataset.i)))
  );
}

// ---------- workout edit mode ----------
let editingWorkoutIdx = null;
function endWorkoutEdit(skipRender){
  editingWorkoutIdx = null;
  document.getElementById("logWorkoutBtn").textContent = "Log session";
  document.getElementById("cancelEditWorkBtn").classList.add("hidden");
  if (!skipRender){ extraExercises=[]; initSessionState(); renderSessionInputs(); }
}
function startEditWorkout(i){
  const sess = data.workouts[i];
  if (!sess) return;

  editingWorkoutIdx = i;
  document.getElementById("wDate").value = sess.date;
  document.getElementById("wNotes").value = sess.notes||"";

  const storedValues = Object.values(sess.sets||{});
  const legacyCardio = sess.day==="CARDIO"
    && storedValues.length>0
    && storedValues.every(v=>typeof v==="string");

  if (legacyCardio){
    wDaySel.value = "__CARDIO__";
    renderSessionInputs();

    const type = Object.keys(sess.sets)[0];
    const valStr = String(sess.sets[type]||"");
    const m = valStr.match(/(\d+(?:\.\d+)?)\s*min(?:\s*·\s*(.*))?/);

    const typeSel = document.getElementById("cardioType");
    if ([...typeSel.options].some(o=>o.value===type)) typeSel.value = type;

    document.getElementById("cardioMin").value = m ? m[1] : "";
    document.getElementById("cardioDetail").value = (m && m[2]) ? m[2] : "";
  } else {
    const dayObj = program.days.find(d=>d.id===sess.day);
    wDaySel.value = dayObj ? sess.day : "__FREE__";

    const dayNames = dayObj
      ? dayObj.exercises.map(e=>e.name.replace("[Cardio] ",""))
      : [];

    extraExercises = Object.keys(sess.sets||{})
      .filter(k=>dayNames.indexOf(k)===-1)
      .map(k=>({name:k,scheme:""}));

    sessionState = {};

    const allNames = (dayObj ? dayObj.exercises.map(e=>e.name) : [])
      .concat(extraExercises.map(e=>e.name));

    allNames.forEach(exName=>{
      const key = exName.replace("[Cardio] ","");
      const val = sess.sets[key];

      if (val==null){
        const programExercise = dayObj
          ? dayObj.exercises.find(e=>e.name===exName)
          : null;

        sessionState[exName] = makePlanSessionState(
          programExercise || {name:exName,scheme:""},
          null
        );
      } else {
        sessionState[exName] = makeSavedSessionState(exName,val);
      }
    });

    renderSessionInputs();
  }

  activeSessionType = wDaySel.value;
  clearWorkoutError();
  document.getElementById("logWorkoutBtn").textContent = "Update session";
  document.getElementById("cancelEditWorkBtn").classList.remove("hidden");
  activateView("work","trainingSessionCard",false);
}
document.getElementById("cancelEditWorkBtn").addEventListener("click", ()=>{
  document.getElementById("wNotes").value = "";
  document.getElementById("wDate").value = todayStr();
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
    // add-exercise row: library select + custom entry
    const addRow = document.createElement("div");
    addRow.className = "bex";
    const search =
      document.createElement("input");

    search.type = "search";
    search.className = "bexercise-search";
    search.placeholder = "Search exercises";
    search.autocomplete = "off";

    search.setAttribute(
      "aria-label",
      "Search exercises for "
        +(day.title||("Day "+(di+1)))
    );

    search.style.cssText =
      "flex:2 0 100%;";

    const sel = document.createElement("select");

    populateUnifiedExercisePicker(sel);

    sel.setAttribute(
      "aria-label",
      "Exercise to add to "
        +(day.title||("Day "+(di+1)))
    );

    sel.style.flex = "2";

    search.addEventListener("input",()=>{
      populateUnifiedExercisePicker(
        sel,
        {query:search.value}
      );

      const isCustom =
        sel.value==="__CUSTOM__";

      custom.classList.toggle(
        "hidden",
        !isCustom
      );

      customShape.classList.toggle(
        "hidden",
        !isCustom
      );
    });

    const custom = document.createElement("input");
    custom.placeholder = "Custom exercise name";
    custom.className = "bname hidden";
    custom.setAttribute(
      "aria-label",
      "Custom exercise name for "+(day.title||("Day "+(di+1)))
    );

    const customShape = makeExerciseShapeSelect(
      "Custom exercise tracking type for "+(day.title||("Day "+(di+1)))
    );
    customShape.classList.add("bshape","hidden");

    sel.addEventListener("change",()=>{
      const isCustom = sel.value==="__CUSTOM__";
      custom.classList.toggle("hidden",!isCustom);
      customShape.classList.toggle("hidden",!isCustom);
    });

    const schIn = document.createElement("input");
    schIn.className = "bscheme";
    schIn.placeholder = "e.g. 3×8";
    schIn.setAttribute(
      "aria-label",
      "Set and rep scheme for new exercise"
    );

    const addBtn = document.createElement("button");
    addBtn.className = "xbtn";
    addBtn.textContent = "＋ Add";

    addBtn.addEventListener("click",()=>{
      let name = sel.value;

      if (name==="__CUSTOM__"){
        const created = createUserExercise(
          custom.value,
          customShape.value
        );

        if (!created.ok){
          flashSave(created.reason,true);
          return;
        }

        name = created.entry.name;
        renderLibraryOptions();
        flashSave("Custom exercise saved ✓");
      }

      if (!name) return;

      day.exercises.push({
        name:name,
        scheme:schIn.value.trim()
      });

      renderBuilder();
    });

    addRow.appendChild(search);
    addRow.appendChild(sel);
    addRow.appendChild(custom);
    addRow.appendChild(customShape);
    addRow.appendChild(schIn);
    addRow.appendChild(addBtn);
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

// ---- reviewed program import / public export ----
document.getElementById("importBtn").addEventListener("click", ()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  const errEl = document.getElementById("programErr");
  errEl.textContent = "";
  errEl.classList.add("hidden");

  if (!file) return;

  const reader = new FileReader();

  reader.onload = ()=>{
    const opened = openTrainingPlanReview(
      reader.result,
      {
        source:"file",
        successMessage:"Program loaded ✓"
      }
    );

    if (!opened.ok){
      errEl.textContent =
        "Couldn't load that file: "
        +(opened.message || "The training-plan file is invalid.");

      errEl.classList.remove("hidden");
    }
  };

  reader.onerror = ()=>{
    errEl.textContent =
      "Couldn't read that training-plan file.";

    errEl.classList.remove("hidden");
  };

  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("exportBtn").addEventListener("click", ()=>{
  const publicPlan =
    trainingPlanInterchangeFromProgram(program);

  download(
    blackpyreTrainingPlanFilename(program.name),
    JSON.stringify(publicPlan,null,2)
  );

  ackBtn("exportBtn", "✓ Downloaded");
});

