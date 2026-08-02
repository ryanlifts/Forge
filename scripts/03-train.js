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
  if (
    typeof editingWorkoutIdx!=="undefined"
    && editingWorkoutIdx!=null
  ) return true;

  if (document.getElementById("wNotes").value.trim()) return true;

  if (
    document.getElementById("cardioMin").value
    || document.getElementById("cardioDetail").value.trim()
  ) return true;

  if (
    extraExercises.length
    || Object.keys(sessionSwaps).length
  ) return true;

  return Object.keys(sessionState).some(name=>{
    const st=sessionState[name];
    if (st.saved!=null) return true;
    if (st.mode==="text"){
      return !!st.textTouched && !!st.text.trim();
    }
    if (
      st.profile
      && BP_WORKOUT_PROFILES
      && !BP_WORKOUT_PROFILES.isRowProfile(st.profile)
    ){
      return !!st.typedTouched;
    }
    if (st.mode==="future") return false;
    return st.rows.some(row=>
      row.touched
      && (row.w!=="" || row.r!=="")
    );
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
function blackpyreAIPlanFormAnswers(){
  const value = id=>{
    const field = document.getElementById(id);
    return field ? String(field.value||"").trim() : "";
  };

  return {
    goal:value("aiPlanGoal"),
    days:value("aiPlanDays"),
    equipment:value("aiPlanEquipment"),
    length:value("aiPlanLength"),
    experience:value("aiPlanExperience"),
    limits:value("aiPlanLimits"),
    preferences:value("aiPlanPreferences")
  };
}

let aiPlanKeyboardViewportBaseline = 0;

function aiPlanKeyboardViewportHeight(){
  if (
    window.visualViewport
    && Number.isFinite(
      Number(window.visualViewport.height)
    )
  ){
    return Number(window.visualViewport.height);
  }

  return Number(window.innerHeight) || 0;
}

function aiPlanKeyboardFieldFocused(){
  const helper =
    document.getElementById("aiPlanHelperCard");

  const active = document.activeElement;

  return !!(
    helper
    && !helper.classList.contains("hidden")
    && active
    && helper.contains(active)
    && /^(INPUT|TEXTAREA|SELECT)$/.test(
         active.tagName
       )
  );
}

function clearAIPlanKeyboardFooterOffset(){
  document.documentElement.style.removeProperty(
    "--keyboard-footer-offset"
  );
}

function updateAIPlanKeyboardFooterOffset(){
  if (!aiPlanKeyboardFieldFocused()){
    clearAIPlanKeyboardFooterOffset();
    return;
  }

  const currentHeight =
    aiPlanKeyboardViewportHeight();

  if (
    !aiPlanKeyboardViewportBaseline
    || currentHeight > aiPlanKeyboardViewportBaseline
  ){
    aiPlanKeyboardViewportBaseline =
      currentHeight;
  }

  const offset = Math.max(
    0,
    Math.round(
      aiPlanKeyboardViewportBaseline
      - currentHeight
    )
  );

  document.documentElement.style.setProperty(
    "--keyboard-footer-offset",
    offset+"px"
  );
}

function setAIPlanKeyboardFooterTracking(enabled){
  if (!enabled){
    aiPlanKeyboardViewportBaseline = 0;
    clearAIPlanKeyboardFooterOffset();
    return;
  }

  aiPlanKeyboardViewportBaseline = Math.max(
    Number(window.innerHeight) || 0,
    aiPlanKeyboardViewportHeight()
  );

  requestAnimationFrame(
    updateAIPlanKeyboardFooterOffset
  );
}

window.addEventListener(
  "resize",
  updateAIPlanKeyboardFooterOffset
);

if (
  window.visualViewport
  && typeof window.visualViewport.addEventListener
    ==="function"
){
  window.visualViewport.addEventListener(
    "resize",
    updateAIPlanKeyboardFooterOffset
  );

  window.visualViewport.addEventListener(
    "scroll",
    updateAIPlanKeyboardFooterOffset
  );
}

document.getElementById(
  "aiPlanHelperCard"
).addEventListener(
  "focusin",
  updateAIPlanKeyboardFooterOffset
);

document.getElementById(
  "aiPlanHelperCard"
).addEventListener("focusout",()=>{
  setTimeout(
    updateAIPlanKeyboardFooterOffset,
    0
  );
});

function setProgramManagerGuide(openId){
  const ids = [
    "aiPlanHelperCard",
    "loadPlanHelpCard"
  ];

  ids.forEach(id=>{
    const element = document.getElementById(id);
    if (element){
      element.classList.toggle(
        "hidden",
        id!==openId
      );
    }
  });

  const createButton =
    document.getElementById("createAIPlanBtn");
  const loadHelpButton =
    document.getElementById("loadPlanHelpBtn");

  if (createButton){
    createButton.setAttribute(
      "aria-expanded",
      openId==="aiPlanHelperCard"
        ? "true"
        : "false"
    );
  }

  if (loadHelpButton){
    loadHelpButton.setAttribute(
      "aria-expanded",
      openId==="loadPlanHelpCard"
        ? "true"
        : "false"
    );
  }

  if (
    typeof setTrainingPlanReviewRestDockSuppressed
      ==="function"
  ){
    setTrainingPlanReviewRestDockSuppressed(
      openId==="aiPlanHelperCard"
    );
  }

  setAIPlanKeyboardFooterTracking(
    openId==="aiPlanHelperCard"
  );
}

async function copyBlackpyreText(text){
  if (
    navigator.clipboard
    && typeof navigator.clipboard.writeText==="function"
  ){
    await navigator.clipboard.writeText(text);
    return true;
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly","");
  area.style.cssText =
    "position:fixed; left:-9999px; top:0;";

  document.body.appendChild(area);
  area.select();

  let copied = false;

  try {
    copied =
      typeof document.execCommand==="function"
      && document.execCommand("copy");
  } catch(error){
    copied = false;
  }

  area.remove();
  return copied;
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
document.getElementById("programManageCloseBtn").addEventListener("click", ()=>{
  setProgramManagerGuide(null);
  setProgramManagerOpen(false);
});

document.getElementById("createAIPlanBtn").addEventListener("click",()=>{
  const helper =
    document.getElementById("aiPlanHelperCard");

  const opening =
    helper.classList.contains("hidden");

  setProgramManagerGuide(
    opening ? "aiPlanHelperCard" : null
  );

  if (opening){
    document.getElementById("aiPlanGoal").focus();
  }
});

document.getElementById("loadPlanHelpBtn").addEventListener("click",()=>{
  const guide =
    document.getElementById("loadPlanHelpCard");

  const opening =
    guide.classList.contains("hidden");

  setProgramManagerGuide(
    opening ? "loadPlanHelpCard" : null
  );
});

document.getElementById(
  "copyAIPlanInstructionsBtn"
).addEventListener("click",async()=>{
  const promptText =
    blackpyreTrainingPlanAIPrompt(
      blackpyreAIPlanFormAnswers()
    );

  const status =
    document.getElementById("aiPlanCopyStatus");

  try {
    const copied =
      await copyBlackpyreText(promptText);

    if (!copied){
      window.prompt(
        "Copy these instructions for the AI:",
        promptText
      );
    }

    status.textContent =
      "Paste these instructions into an AI. "
      +"When it finishes, download the .json file, "
      +"return to BlackPyre, and choose Load program.";

    status.classList.remove("hidden");
    ackBtn(
      "copyAIPlanInstructionsBtn",
      "✓ Instructions copied"
    );
  } catch(error){
    window.prompt(
      "Copy these instructions for the AI:",
      promptText
    );

    status.textContent =
      "Paste these instructions into an AI. "
      +"When it finishes, download the .json file, "
      +"return to BlackPyre, and choose Load program.";

    status.classList.remove("hidden");
  }
});


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


const BP_WORKOUT_PROFILES =
  globalThis.BLACKPYRE_WORKOUT_PROFILES || null;

function bpWorkoutProfileResolutionForExercise(ex){
  if (!BP_WORKOUT_PROFILES) return null;
  const entry =
    exerciseModelEntryForReference(ex)
    || (
      ex && typeof ex==="object"
        ? {
            id:ex.exerciseId || ex.id || "",
            name:ex.name || "",
            shape:exerciseShapeForName(ex.name || "")
          }
        : null
    );
  return BP_WORKOUT_PROFILES.resolve(entry);
}

function bpWorkoutProfileResolutionForName(exName){
  if (!BP_WORKOUT_PROFILES) return null;
  const cleanName=String(exName||"").replace("[Cardio] ","");
  const entry =
    exerciseModelEntryForReference({name:cleanName})
    || {
      id:"",
      name:cleanName,
      shape:exerciseShapeForName(cleanName)
    };
  return BP_WORKOUT_PROFILES.resolve(entry);
}

function bpWorkoutProfilePrescription(ex){
  if (!ex || typeof ex!=="object") return {};
  if (isPlainObject(ex.prescription)) return cloneJSON(ex.prescription);

  const entry=exerciseModelEntryForReference(ex);
  const shape=entry ? entry.shape : exerciseShapeForName(ex.name || "");
  const legacy=parseLegacySchemeForShape(ex.scheme,shape);

  return legacy && legacy.ok && isPlainObject(legacy.value)
    ? cloneJSON(legacy.value)
    : {};
}

function appendLegacyWorkoutTextEditor(div,ex,st){
  const row=document.createElement("div");
  row.className="srow";

  const lab=document.createElement("span");
  lab.className="slabel";
  lab.textContent="Details / notes (required)";

  const inp=document.createElement("input");
  inp.setAttribute(
    "aria-label",
    ex.name.replace("[Cardio] ","")+" details or notes"
  );
  inp.setAttribute("aria-required","true");
  inp.placeholder="Enter what you completed";
  inp.value=st.text;
  inp.style.flex="1";
  inp.style.minWidth="0";
  inp.addEventListener("input",()=>{
    st.text=inp.value;
    st.textTouched=true;
    st.status="unsaved";
    markUnsavedChip(div);
    clearWorkoutError();
  });

  row.appendChild(lab);
  row.appendChild(inp);
  div.appendChild(row);
}

function appendWorkoutSetRows(div,ex,st){
  const options=st.profileOptions || {};
  const weightPolicy =
    st.profile==="strengthSets"
      ? "required"
      : String(options.weightPolicy || "optional");
  const weightLabel=String(options.weightLabel || "Weight");

  st.rows.forEach((row,ri)=>{
    const rdiv=document.createElement("div");
    rdiv.className="srow";
    rdiv.innerHTML='<span class="slabel">Set '+(ri+1)+'</span>';

    const mkStep=(txt,label,fn)=>{
      const button=document.createElement("button");
      button.className="step";
      button.textContent=txt;
      button.setAttribute("aria-label",label);
      button.addEventListener("click",fn);
      return button;
    };

    let weightInput=null;

    if (weightPolicy!=="hidden"){
      weightInput=document.createElement("input");
      weightInput.type="number";
      weightInput.className="snum";
      weightInput.inputMode="decimal";
      weightInput.min="0";
      weightInput.placeholder=
        weightPolicy==="required"
          ? (weightLabel==="Assistance" ? "assist" : "lb")
          : (weightLabel==="Assistance" ? "assist opt." : "lb opt.");
      weightInput.value=
        row.w===undefined || row.w===null
          ? ""
          : row.w;
      weightInput.dataset.exercise=ex.name;
      weightInput.dataset.row=String(ri);
      weightInput.dataset.field="weight";
      weightInput.setAttribute(
        "aria-label",
        ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" "
          +weightLabel.toLowerCase()+" in pounds"
      );
      if (weightPolicy==="required"){
        weightInput.setAttribute("aria-required","true");
      }
      weightInput.addEventListener("input",()=>{
        row.w=weightInput.value==="" ? "" : Number(weightInput.value);
        row.touched=true;
        st.status="unsaved";
        markUnsavedChip(div);
        clearWorkoutError();
      });

      rdiv.appendChild(
        mkStep(
          "−5",
          "Decrease "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)
            +" "+weightLabel.toLowerCase()+" by 5 pounds",
          ()=>{
            row.w=Math.max(0,(Number(row.w)||0)-5);
            row.touched=true;
            st.status="unsaved";
            markUnsavedChip(div);
            weightInput.value=row.w;
            clearWorkoutError();
          }
        )
      );
      rdiv.appendChild(weightInput);
      rdiv.appendChild(
        mkStep(
          "+5",
          "Increase "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)
            +" "+weightLabel.toLowerCase()+" by 5 pounds",
          ()=>{
            row.w=(Number(row.w)||0)+5;
            row.touched=true;
            st.status="unsaved";
            markUnsavedChip(div);
            weightInput.value=row.w;
            clearWorkoutError();
          }
        )
      );

      const multiply=document.createElement("span");
      multiply.className="sx";
      multiply.textContent="×";
      rdiv.appendChild(multiply);
    }

    const repsInput=document.createElement("input");
    repsInput.type="number";
    repsInput.className="snum";
    repsInput.inputMode="numeric";
    repsInput.min="0";
    repsInput.placeholder="reps";
    repsInput.value=row.r;
    repsInput.dataset.exercise=ex.name;
    repsInput.dataset.row=String(ri);
    repsInput.dataset.field="reps";
    repsInput.setAttribute(
      "aria-label",
      ex.name.replace("[Cardio] ","")+" set "+(ri+1)+" repetitions"
    );
    repsInput.setAttribute("aria-required","true");
    repsInput.addEventListener("input",()=>{
      row.r=repsInput.value==="" ? "" : Number(repsInput.value);
      row.touched=true;
      st.status="unsaved";
      markUnsavedChip(div);
      clearWorkoutError();
    });

    rdiv.appendChild(
      mkStep(
        "−1",
        "Decrease "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)
          +" repetitions by 1",
        ()=>{
          row.r=Math.max(0,(Number(row.r)||0)-1);
          row.touched=true;
          st.status="unsaved";
          markUnsavedChip(div);
          repsInput.value=row.r;
          clearWorkoutError();
        }
      )
    );
    rdiv.appendChild(repsInput);
    rdiv.appendChild(
      mkStep(
        "+1",
        "Increase "+ex.name.replace("[Cardio] ","")+" set "+(ri+1)
          +" repetitions by 1",
        ()=>{
          row.r=(Number(row.r)||0)+1;
          row.touched=true;
          st.status="unsaved";
          markUnsavedChip(div);
          repsInput.value=row.r;
          clearWorkoutError();
        }
      )
    );

    div.appendChild(rdiv);
  });

  const addRow=document.createElement("button");
  addRow.className="xbtn";
  addRow.textContent="+ Add set";
  addRow.style.marginTop="2px";
  addRow.addEventListener("click",()=>{
    const previous=
      st.rows.slice().reverse().find(row=>
        Number(row.r)>0
        || (weightPolicy!=="hidden" && row.w!=="")
      )
      || st.rows[st.rows.length-1];

    st.rows.push(
      previous
        ? {
            w:weightPolicy==="hidden" ? "" : previous.w,
            r:previous.r,
            done:false,
            touched:true
          }
        : {w:"",r:"",done:false,touched:true}
    );
    st.status="unsaved";
    clearWorkoutError();
    renderSessionInputs();
  });
  div.appendChild(addRow);
}

function appendWorkoutProfileEditor(div,ex,st){
  if (
    st.profile==="strengthSets"
    || st.profile==="repetitionSets"
  ){
    appendWorkoutSetRows(div,ex,st);
    return;
  }

  if (
    BP_WORKOUT_PROFILES
    && st.profile
    && BP_WORKOUT_PROFILES.canRender(st.profile)
  ){
    const rendered=BP_WORKOUT_PROFILES.appendEditor(
      div,
      ex,
      st,
      ()=>{
        st.typedTouched=true;
        st.status="unsaved";
        markUnsavedChip(div);
        clearWorkoutError();
      }
    );

    if (rendered){
      return;
    }
  }

  if (st.mode==="text"){
    appendLegacyWorkoutTextEditor(div,ex,st);
    return;
  }

  if (st.mode==="future"){
    const notice=document.createElement("div");
    notice.className="note";
    notice.textContent=
      st.saved
        ? newerWorkoutValueNotice(st.saved)
        : "This exercise does not have a supported workout card profile.";
    div.appendChild(notice);
    return;
  }

  const notice=document.createElement("div");
  notice.className="note";
  notice.textContent=
    "This exercise does not have a supported workout card profile.";
  div.appendChild(notice);
}

function workoutValueKind(val){
  if (Array.isArray(val)) return "rows";
  if (typeof val==="string") return "legacyText";

  if (
    BP_WORKOUT_PROFILES
    && BP_WORKOUT_PROFILES.kind(val)
  ){
    return BP_WORKOUT_PROFILES.kind(val);
  }

  if (isTypedWorkoutValue(val)){
    return KNOWN_TYPED_WORKOUT_VALUE_TYPES.has(val.t)
      ? val.t
      : "future";
  }

  if (val==null) return "empty";
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
  const kind=workoutValueKind(val);

  if (kind==="rows"){
    return val.map(formatWorkoutRow).filter(Boolean).join(", ");
  }

  if (kind==="legacyText") return val;

  if (BP_WORKOUT_PROFILES){
    const formatted=BP_WORKOUT_PROFILES.formatStored(val);
    if (formatted!==null) return formatted;
  }

  if (kind==="timeDist"){
    const parts=[formatWorkoutSeconds(val.secs)];
    if (
      val.dist!==undefined
      && val.dist!==null
      && val.dist!==""
    ){
      parts.push(val.dist+" "+val.distUnit);
    }
    return parts.filter(Boolean).join(" · ");
  }

  if (kind==="carry"){
    return val.lbs+" lb · "+val.dist+" "+val.distUnit;
  }

  if (kind==="rounds"){
    let out=
      val.rounds+" rounds · "
      +val.workSecs+"s work / "
      +val.recSecs+"s recovery";
    if (val.note) out+=" · "+val.note;
    return out;
  }

  if (kind==="future") return newerWorkoutValueNotice(val);
  if (kind==="empty") return "";
  if (val && typeof val==="object"){
    return "Unsupported saved workout entry";
  }
  return String(val);
}

const TRAINING_PLAN_FORMAT = "blackpyre-training-plan";
const TRAINING_PLAN_VERSION = 1;
const TRAINING_PLAN_SHAPES = ["lift","reps","timeDist","carry","rounds","text"];
const TRAINING_PLAN_DISTANCE_UNITS = ["mi","km","m","ft"];
const TRAINING_PLAN_WEIGHT_UNITS = ["lb","kg"];

function blackpyreTrainingPlanFormatInstructions(){
  return [
    "Use the BlackPyre public training-plan format.",
    "The top-level object must include exactly \"format\":\""
      +TRAINING_PLAN_FORMAT
      +"\" and \"version\":"
      +TRAINING_PLAN_VERSION
      +".",
    "Return a complete program wrapper with program.name and program.days.",
    "Use this structure: {\"format\":\""
      +TRAINING_PLAN_FORMAT
      +"\",\"version\":"
      +TRAINING_PLAN_VERSION
      +",\"program\":{\"name\":\"Program name\",\"days\":[{\"id\":\"D1\",\"title\":\"Day 1\",\"exercises\":[{\"name\":\"Exercise name\",\"scheme\":\"3 × 8\",\"prescription\":{\"sets\":3,\"reps\":8}}]}]}}.",
    "Use exercise names instead of invented IDs. Do not invent exerciseId values.",
    "Use the correct prescription fields for the work being prescribed.",
    "Strength or repetition work may use sets, reps, optional weight, weightUnit, restSeconds, effort, and notes.",
    "Timed or distance work may use intervals, durationSeconds, recoverySeconds, distance, distanceUnit, pace, effort, and notes.",
    "Carries may use sets or trips, weight, distance or durationSeconds, distanceUnit, effort, and notes.",
    "Round-based work may use rounds, workSeconds, recoverySeconds, movements, effort, and notes.",
    "Instruction-only work may use instructions, completionTarget, and notes.",
    "Do not treat every exercise as sets, reps, and weight.",
    "BlackPyre resolves exercise identity and how it should be recorded; unknown exercise names require review.",
    "Do not silently convert an unknown exercise into a strength exercise. Leave its requested name unchanged for BlackPyre to review."
  ].join("\n");
}

function blackpyreTrainingPlanAIPrompt(answers){
  const source =
    answers && typeof answers==="object"
      ? answers
      : {};

  const details = [
    ["Main goal",source.goal],
    ["Days per week",source.days],
    ["Equipment",source.equipment],
    ["Workout length",source.length],
    ["Experience",source.experience],
    ["Injuries or limits",source.limits],
    [
      "Preferred training style or activities",
      source.preferences
    ]
  ].filter(item=>String(item[1]||"").trim())
   .map(item=>item[0]+": "+String(item[1]).trim());

  return [
    "Create a training plan for me and provide it as a downloadable .json file for BlackPyre.",
    "",
    "My request:",
    details.length
      ? details.join("\n")
      : "No extra preferences were provided.",
    "",
    "Output rules:",
    "Return valid JSON only. Do not include Markdown fences, explanations, or commentary.",
    blackpyreTrainingPlanFormatInstructions(),
    "Preserve every provided goal, schedule, equipment detail, workout-length request, limitation, and preference in the program."
  ].join("\n");
}

function blackpyreTrainingPlanRejectionMessage(){
  return "This does not appear to be a BlackPyre training plan file. "
    +"Create a new file using BlackPyre’s Create a plan with AI instructions, "
    +"or export the plan from another copy of BlackPyre.";
}

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

function trainingPlanSafeImportAliasId(name){
  const matches =
    trainingPlanReducedExerciseMatches(
      name,
      exerciseModelEntries()
    );

  if (!matches.length) return null;

  const bestRank = matches[0].rank;
  const best = trainingPlanUniqueEntries(
    matches
      .filter(item=>item.rank===bestRank)
      .map(item=>item.entry)
  );

  return best.length===1
    ? best[0].id
    : null;
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

// BLACKPYRE_V77_SYSTEMIC_RESOLVER_REPAIR
const TRAINING_PLAN_EQUIVALENT_NAME_TOKENS = Object.freeze({
  pressdown:"pushdown",
  pressdowns:"pushdown",
  pushdowns:"pushdown",
  tricep:"triceps"
});

const TRAINING_PLAN_SAFE_SINGULAR_TOKENS = Object.freeze({
  barbells:"barbell",
  dumbbells:"dumbbell",
  kettlebells:"kettlebell",
  machines:"machine",
  cables:"cable",
  curls:"curl",
  rows:"row",
  presses:"press",
  squats:"squat",
  lunges:"lunge",
  raises:"raise",
  extensions:"extension",
  pullups:"pullup",
  pushups:"pushup",
  flyes:"fly",
  flies:"fly",
  carries:"carry",
  crunches:"crunch",
  slams:"slam",
  dips:"dip"
});

const TRAINING_PLAN_EQUIPMENT_NAME_TOKENS = Object.freeze({
  barbell:"barbell",
  dumbbell:"dumbbell",
  kettlebell:"kettlebell",
  cable:"cable",
  machine:"machine",
  landmine:"landmine",
  trapbar:"trap-bar",
  ezbar:"barbell",
  smith:"machine"
});

const TRAINING_PLAN_POSITION_NAME_TOKENS =
  new Set(["seated","standing"]);

const TRAINING_PLAN_LOADING_NAME_TOKENS =
  new Set(["weighted","loaded"]);

function trainingPlanResolverClaims(entry){
  return [entry && entry.name]
    .concat(entry && entry.aliases || [])
    .concat(entry && entry.formerNames || [])
    .filter(value=>String(value||"").trim());
}

function trainingPlanResolverTokens(value){
  let key = trainingPlanSafeNameKey(value);

  key = key
    .replace(/\bez\s+bar\b/g,"ezbar")
    .replace(/\btrap\s+bar\b/g,"trapbar")
    .replace(/\bpull\s+ups?\b/g,"pullup")
    .replace(/\bpush\s+ups?\b/g,"pushup")
    .replace(/\bpress\s+downs?\b/g,"pressdown")
    .replace(/\bpush\s+downs?\b/g,"pushdown");

  return key
    .split(/\s+/)
    .filter(Boolean)
    .map(token=>
      TRAINING_PLAN_EQUIVALENT_NAME_TOKENS[token]
      || TRAINING_PLAN_SAFE_SINGULAR_TOKENS[token]
      || token
    );
}

function trainingPlanResolverProfile(value){
  const tokens = trainingPlanResolverTokens(value);
  const equipment = [];
  const positions = [];
  const loading = [];
  const core = [];

  tokens.forEach(token=>{
    if (
      Object.prototype.hasOwnProperty.call(
        TRAINING_PLAN_EQUIPMENT_NAME_TOKENS,
        token
      )
    ){
      equipment.push(
        TRAINING_PLAN_EQUIPMENT_NAME_TOKENS[token]
      );
      return;
    }

    if (TRAINING_PLAN_POSITION_NAME_TOKENS.has(token)){
      positions.push(token);
      return;
    }

    if (TRAINING_PLAN_LOADING_NAME_TOKENS.has(token)){
      loading.push(token);
      return;
    }

    core.push(token);
  });

  return {
    tokens:tokens,
    core:core,
    coreKey:core.join(" "),
    sortedCoreKey:core.slice().sort().join(" "),
    equipment:[...new Set(equipment)],
    positions:[...new Set(positions)],
    loading:[...new Set(loading)]
  };
}

function trainingPlanEntryEquipmentSet(entry){
  return new Set(
    (entry && Array.isArray(entry.equipment)
      ? entry.equipment
      : []
    ).map(value=>String(value||"").trim().toLowerCase())
     .filter(Boolean)
  );
}

function trainingPlanEntrySupportsEquipment(entry,required){
  if (!required || !required.length) return true;
  const available = trainingPlanEntryEquipmentSet(entry);
  return required.every(item=>available.has(item));
}

function trainingPlanPrimaryMuscleTokenSet(entry){
  const primary =
    entry
    && entry.muscles
    && Array.isArray(entry.muscles.primary)
      ? entry.muscles.primary
      : [];

  return new Set(
    primary
      .flatMap(value=>trainingPlanResolverTokens(value))
      .filter(Boolean)
  );
}

function trainingPlanQualifierSubset(required,available){
  const allowed = new Set(available || []);
  return (required || []).every(item=>allowed.has(item));
}

function trainingPlanReductionRank(sourceProfile,claimProfile,entry){
  if (
    !sourceProfile.core.length
    || !claimProfile.core.length
  ){
    return null;
  }

  if (
    !trainingPlanEntrySupportsEquipment(
      entry,
      sourceProfile.equipment
    )
  ){
    return null;
  }

  if (
    claimProfile.equipment.length
    && !sourceProfile.equipment.length
  ){
    return null;
  }

  if (
    sourceProfile.equipment.length
    && claimProfile.equipment.length
    && !trainingPlanQualifierSubset(
      claimProfile.equipment,
      sourceProfile.equipment
    )
  ){
    return null;
  }

  if (
    !trainingPlanQualifierSubset(
      claimProfile.positions,
      sourceProfile.positions
    )
    || !trainingPlanQualifierSubset(
      claimProfile.loading,
      sourceProfile.loading
    )
  ){
    return null;
  }

  if (sourceProfile.coreKey===claimProfile.coreKey){
    return 0;
  }

  if (
    sourceProfile.core.length===claimProfile.core.length
    && sourceProfile.sortedCoreKey===claimProfile.sortedCoreKey
  ){
    return 1;
  }

  const sourceCore = new Set(sourceProfile.core);
  const claimCore = new Set(claimProfile.core);
  const primaryMuscles =
    trainingPlanPrimaryMuscleTokenSet(entry);

  if (
    sourceProfile.core.length===1
    && claimProfile.core.length===2
    && claimProfile.core.every(token=>
      sourceCore.has(token)
      || primaryMuscles.has(token)
    )
    && claimProfile.core.some(token=>sourceCore.has(token))
  ){
    return 2;
  }

  if (
    claimProfile.core.length===1
    && sourceProfile.core.length===2
    && sourceProfile.core.every(token=>
      claimCore.has(token)
      || primaryMuscles.has(token)
    )
    && sourceProfile.core.some(token=>claimCore.has(token))
  ){
    return 2;
  }

  return null;
}

function trainingPlanReducedExerciseMatches(name,entries){
  const sourceProfile =
    trainingPlanResolverProfile(name);

  return (entries || exerciseModelEntries())
    .map(entry=>{
      let bestRank = null;
      let bestClaim = "";

      trainingPlanResolverClaims(entry).forEach(claim=>{
        const rank = trainingPlanReductionRank(
          sourceProfile,
          trainingPlanResolverProfile(claim),
          entry
        );

        if (
          rank!==null
          && (bestRank===null || rank<bestRank)
        ){
          bestRank = rank;
          bestClaim = claim;
        }
      });

      return bestRank===null
        ? null
        : {
            entry:entry,
            rank:bestRank,
            claim:bestClaim
          };
    })
    .filter(Boolean)
    .sort((left,right)=>
      left.rank-right.rank
      || left.entry.name.localeCompare(right.entry.name)
      || left.entry.id.localeCompare(right.entry.id)
    );
}

function trainingPlanSuggestionScore(name,entry){
  const queryKey = trainingPlanSafeNameKey(name);
  const queryProfile = trainingPlanResolverProfile(name);
  let best = Infinity;

  trainingPlanResolverClaims(entry).forEach(claim=>{
    const claimKey = trainingPlanSafeNameKey(claim);
    const claimProfile = trainingPlanResolverProfile(claim);
    const fullDistance =
      trainingPlanEditDistance(queryKey,claimKey)
      / Math.max(queryKey.length,claimKey.length,1);

    const coreDistance =
      trainingPlanEditDistance(
        queryProfile.sortedCoreKey,
        claimProfile.sortedCoreKey
      )
      / Math.max(
          queryProfile.sortedCoreKey.length,
          claimProfile.sortedCoreKey.length,
          1
        );

    let qualifierPenalty = 0;

    if (
      queryProfile.equipment.length
      && !trainingPlanEntrySupportsEquipment(
        entry,
        queryProfile.equipment
      )
    ){
      qualifierPenalty += 0.35;
    }

    if (
      !queryProfile.equipment.length
      && claimProfile.equipment.length
    ){
      qualifierPenalty += 0.04;
    }

    if (
      claimProfile.positions.length
      && !trainingPlanQualifierSubset(
        claimProfile.positions,
        queryProfile.positions
      )
    ){
      qualifierPenalty += 0.08;
    }

    best = Math.min(
      best,
      Math.min(fullDistance,coreDistance+0.03)
      +qualifierPenalty
    );
  });

  return Number(best.toFixed(4));
}


function rankTrainingPlanExerciseSuggestions(name,limit){
  const query = trainingPlanSafeNameKey(name);
  if (!query) return [];

  const maximum =
    Number.isInteger(limit) && limit>0
      ? limit
      : 5;

  return exerciseModelEntries()
    .map(entry=>({
      id:entry.id,
      name:entry.name,
      shape:entry.shape,
      score:trainingPlanSuggestionScore(name,entry)
    }))
    .sort((left,right)=>
      left.score-right.score
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id)
    )
    .slice(0,maximum);
}


function resolveTrainingPlanExercise(reference){
  const ref =
    reference && typeof reference==="object"
      ? reference
      : {name:reference};

  const importedName = String(ref.name||"").trim();
  const importedId = String(ref.exerciseId||"").trim();
  const warnings = [];
  const entries = exerciseModelEntries();

  const resolved = (entry,method,status)=>({
    ok:true,
    code:"resolved",
    status:status,
    method:method,
    importedName:importedName,
    importedId:importedId,
    entry:entry,
    warnings:warnings
  });

  const suggestion = (entry,score)=>({
    id:entry.id,
    name:entry.name,
    shape:entry.shape,
    score:score
  });

  const unresolved = (code,suggestions,status)=>({
    ok:false,
    code:code,
    status:status || "Needs selection",
    importedName:importedName,
    importedId:importedId,
    warnings:warnings,
    suggestions:suggestions || []
  });

  if (importedId){
    const byId = exerciseModelEntryForId(importedId);

    if (byId){
      if (importedName){
        const importedKey =
          trainingPlanSafeNameKey(importedName);

        const acceptedKeys =
          trainingPlanResolverClaims(byId)
            .map(trainingPlanSafeNameKey);

        if (!acceptedKeys.includes(importedKey)){
          const reduced =
            trainingPlanReducedExerciseMatches(
              importedName,
              entries
            );

          const bestRank =
            reduced.length
              ? reduced[0].rank
              : null;

          const best =
            bestRank===null
              ? []
              : trainingPlanUniqueEntries(
                  reduced
                    .filter(item=>item.rank===bestRank)
                    .map(item=>item.entry)
                );

          if (
            best.length!==1
            || best[0].id!==byId.id
          ){
            return unresolved(
              "id-name-conflict",
              [suggestion(byId,0)],
              "Conflicting identity"
            );
          }
        }
      }

      return resolved(
        byId,
        byId.id.startsWith("u:")
          ? "exact-user-id"
          : "exact-built-in-id",
        "Exact match"
      );
    }

    warnings.push(
      "Unknown exerciseId was ignored; the exercise name was resolved instead."
    );
  }

  if (!importedName){
    return unresolved("missing-name",[]);
  }

  const exactName = trainingPlanUniqueEntries(
    entries.filter(entry=>
      String(entry.name||"").trim()===importedName
    )
  );

  if (exactName.length===1){
    return resolved(
      exactName[0],
      "exact-name",
      "Exact match"
    );
  }

  if (exactName.length>1){
    return unresolved(
      "ambiguous",
      exactName.map(entry=>suggestion(entry,0))
    );
  }

  const exactAlias = trainingPlanUniqueEntries(
    entries.filter(entry=>
      (entry.aliases||[]).some(
        alias=>String(alias).trim()===importedName
      )
    )
  );

  if (exactAlias.length===1){
    return resolved(
      exactAlias[0],
      "alias",
      "Alias match"
    );
  }

  if (exactAlias.length>1){
    return unresolved(
      "ambiguous",
      exactAlias.map(entry=>suggestion(entry,0))
    );
  }

  const exactFormer = trainingPlanUniqueEntries(
    entries.filter(entry=>
      (entry.formerNames||[]).some(
        former=>String(former).trim()===importedName
      )
    )
  );

  if (exactFormer.length===1){
    return resolved(
      exactFormer[0],
      "former-name",
      "Former-name match"
    );
  }

  if (exactFormer.length>1){
    return unresolved(
      "ambiguous",
      exactFormer.map(entry=>suggestion(entry,0))
    );
  }

  const safeKey =
    trainingPlanSafeNameKey(importedName);

  const normalized = trainingPlanUniqueEntries(
    entries.filter(entry=>
      trainingPlanResolverClaims(entry).some(
        claim=>
          trainingPlanSafeNameKey(claim)===safeKey
      )
    )
  );

  if (normalized.length===1){
    return resolved(
      normalized[0],
      "normalized",
      "Normalized match"
    );
  }

  if (normalized.length>1){
    return unresolved(
      "ambiguous",
      normalized.map(entry=>suggestion(entry,0))
    );
  }

  const reduced =
    trainingPlanReducedExerciseMatches(
      importedName,
      entries
    );

  if (reduced.length){
    const bestRank = reduced[0].rank;
    const best = trainingPlanUniqueEntries(
      reduced
        .filter(item=>item.rank===bestRank)
        .map(item=>item.entry)
    );

    if (best.length===1){
      return resolved(
        best[0],
        "safe-reduction",
        "Normalized match"
      );
    }

    if (best.length>1){
      return unresolved(
        "ambiguous",
        best.map(entry=>suggestion(entry,0))
      );
    }
  }

  return unresolved(
    "unknown",
    rankTrainingPlanExerciseSuggestions(
      importedName,
      5
    )
  );
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
    shape==="timeDist"
    && (
      match=original.match(
        /^(?:(\d+)\s*(?:rounds?|intervals?)\s*[,;:\-]\s*)?(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)\s*work\s*\/\s*(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)\s*(?:rest|recovery)$/i
      )
    )
  ){
    const value = {
      durationSeconds:
        /min/i.test(match[3])
          ? Number(match[2])*60
          : Number(match[2]),
      recoverySeconds:
        /min/i.test(match[5])
          ? Number(match[4])*60
          : Number(match[4])
    };

    if (match[1]){
      value.intervals =
        Number(match[1]);
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

function normalizeTrainingPlanPrescriptionForCanonicalShape(
  shape,
  exercise
){
  const item =
    exercise && typeof exercise==="object"
      ? exercise
      : {};

  const source = item.prescription;

  const direct =
    sanitizeTrainingPlanPrescription(
      shape,
      source
    );

  if (
    direct.ok
    || shape!=="timeDist"
    || !isPlainObject(source)
  ){
    return Object.assign(
      {},
      direct,
      {
        repairKind:null,
        repairSeed:null,
        adjusted:false
      }
    );
  }

  const hasSource = key=>
    Object.prototype.hasOwnProperty.call(
      source,
      key
    );

  const repairableIncompatibleFields =
    ["sets","reps"];

  const unsafeIncompatibleFields = [
    "trips",
    "rounds",
    "workSeconds",
    "weight",
    "weightUnit",
    "instructions",
    "completionTarget",
    "movements"
  ].filter(hasSource);

  if (unsafeIncompatibleFields.length){
    return Object.assign(
      {},
      direct,
      {
        repairKind:null,
        repairSeed:null,
        adjusted:false
      }
    );
  }

  const normalized = {};

  [
    "intervals",
    "durationSeconds",
    "recoverySeconds",
    "restSeconds",
    "distance",
    "distanceUnit",
    "pace",
    "effort",
    "notes"
  ].forEach(key=>{
    if (hasSource(key)){
      normalized[key] =
        cloneJSON(source[key]);
    }
  });

  let adjusted =
    repairableIncompatibleFields.some(
      hasSource
    );

  if (
    !Object.prototype.hasOwnProperty.call(
      normalized,
      "intervals"
    )
    && hasSource("sets")
  ){
    const sets = Number(source.sets);

    if (
      Number.isInteger(sets)
      && sets>0
    ){
      normalized.intervals = sets;
    }
  }

  const legacy =
    parseLegacySchemeForShape(
      item.scheme,
      shape
    );

  let legacyConflict = false;

  if (
    legacy.ok
    && !legacy.warning
    && isPlainObject(legacy.value)
  ){
    Object.keys(legacy.value).forEach(key=>{
      if (
        Object.prototype.hasOwnProperty.call(
          normalized,
          key
        )
      ){
        if (
          JSON.stringify(normalized[key])
          !==JSON.stringify(legacy.value[key])
        ){
          legacyConflict = true;
        }

        return;
      }

      normalized[key] =
        cloneJSON(legacy.value[key]);

      adjusted = true;
    });
  }

  if (legacyConflict){
    return Object.assign(
      {},
      direct,
      {
        repairKind:null,
        repairSeed:null,
        adjusted:false
      }
    );
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      normalized,
      "distance"
    )
  ){
    delete normalized.distanceUnit;
  }

  const sanitized =
    sanitizeTrainingPlanPrescription(
      shape,
      normalized
    );

  const seed =
    cloneJSON(sanitized.value || {});

  const hasDuration =
    Object.prototype.hasOwnProperty.call(
      seed,
      "durationSeconds"
    )
    && Number(seed.durationSeconds)>0;

  const hasDistance =
    Object.prototype.hasOwnProperty.call(
      seed,
      "distance"
    )
    && Number(seed.distance)>0;

  const missingTargetMessage =
    "Prescription does not include a usable target for the "
    +shape
    +" tracking shape.";

  const onlyMissingTarget =
    Array.isArray(sanitized.errors)
    && sanitized.errors.length===1
    && sanitized.errors[0]
       ===missingTargetMessage;

  if (
    onlyMissingTarget
    && !hasDuration
    && !hasDistance
  ){
    return {
      ok:false,
      value:seed,
      errors:[
        "The imported plan does not include a duration."
      ],
      ignoredFields:[],
      repairKind:"missing-time-duration",
      repairSeed:seed,
      adjusted:true
    };
  }

  return Object.assign(
    {},
    sanitized,
    {
      repairKind:null,
      repairSeed:null,
      adjusted:
        adjusted
        || !direct.ok
    }
  );
}

function trainingPlanTrackingAdjustmentMessage(
  entry,
  prescription
){
  if (!entry) return "";

  const name =
    String(entry.name || "exercise").trim();

  const possessive =
    /s$/i.test(name)
      ? name+"'"
      : name+"'s";

  const value =
    prescription && typeof prescription==="object"
      ? prescription
      : {};

  if (entry.shape==="timeDist"){
    const intervals =
      Number(value.intervals);

    const duration =
      Number(value.durationSeconds);

    if (
      Number.isInteger(intervals)
      && intervals>0
      && Number.isFinite(duration)
      && duration>0
    ){
      const countLabel =
        /^plank$/i.test(name)
          ? "sets"
          : "intervals";

      return (
        "Adjusted to "
        +possessive
        +" time tracking: "
        +intervals
        +" "
        +countLabel
        +" of "
        +duration
        +" seconds."
      );
    }

    if (
      Number.isFinite(duration)
      && duration>0
    ){
      return (
        "Adjusted to "
        +possessive
        +" time tracking: "
        +duration
        +" seconds."
      );
    }

    const distance =
      Number(value.distance);

    if (
      Number.isFinite(distance)
      && distance>0
      && value.distanceUnit
    ){
      return (
        "Adjusted to "
        +possessive
        +" distance tracking: "
        +distance
        +" "
        +value.distanceUnit
        +"."
      );
    }
  }

  return (
    "Adjusted to "
    +possessive
    +" BlackPyre tracking."
  );
}


function trainingPlanPrescriptionSummary(
  shape,
  prescription,
  originalScheme
){
  const original =
    String(originalScheme||"").trim();

  const p = prescription || {};

  const seconds = value=>
    Number.isFinite(Number(value))
      ? Number(value)+" sec"
      : "";

  const countText = (value,singular,plural)=>{
    const count = Number(value);
    if (!Number.isFinite(count) || count<=0) return "";
    return count+" "+(count===1 ? singular : plural);
  };

  if (shape==="timeDist"){
    const pieces = [];
    const intervals =
      countText(p.intervals,"interval","intervals");

    if (intervals) pieces.push(intervals);

    if (p.durationSeconds!==undefined){
      pieces.push(
        seconds(p.durationSeconds)
        +(p.intervals ? " each" : "")
      );
    }

    if (
      p.distance!==undefined
      && p.distanceUnit
    ){
      pieces.push(
        p.distance+" "+p.distanceUnit
        +(p.intervals ? " each" : "")
      );
    }

    if (p.recoverySeconds!==undefined){
      pieces.push(
        seconds(p.recoverySeconds)
        +" recovery"
      );
    } else if (p.restSeconds!==undefined){
      pieces.push(
        seconds(p.restSeconds)
        +" rest"
      );
    }

    if (p.pace) pieces.push(String(p.pace));
    if (p.effort) pieces.push(String(p.effort));

    if (pieces.length>1 || (!original && pieces.length)){
      return pieces.join(" · ");
    }
  }

  if (shape==="carry"){
    const pieces = [];
    const count =
      p.trips!==undefined
        ? countText(p.trips,"trip","trips")
        : countText(p.sets,"set","sets");

    if (count) pieces.push(count);

    if (p.weight!==undefined){
      pieces.push(
        p.weight+" "+(p.weightUnit||"lb")
      );
    }

    if (
      p.distance!==undefined
      && p.distanceUnit
    ){
      pieces.push(
        p.distance+" "+p.distanceUnit
        +(count ? " each" : "")
      );
    }

    if (p.durationSeconds!==undefined){
      pieces.push(
        seconds(p.durationSeconds)
        +(count ? " each" : "")
      );
    }

    if (p.restSeconds!==undefined){
      pieces.push(
        seconds(p.restSeconds)+" rest"
      );
    }

    if (p.effort) pieces.push(String(p.effort));

    if (pieces.length>1 || (!original && pieces.length)){
      return pieces.join(" · ");
    }
  }

  if (shape==="rounds"){
    const pieces = [];
    const rounds =
      countText(p.rounds,"round","rounds");

    if (rounds) pieces.push(rounds);

    if (p.workSeconds!==undefined){
      pieces.push(
        seconds(p.workSeconds)+" work"
      );
    }

    if (p.recoverySeconds!==undefined){
      pieces.push(
        seconds(p.recoverySeconds)+" recovery"
      );
    } else if (p.restSeconds!==undefined){
      pieces.push(
        seconds(p.restSeconds)+" rest"
      );
    }

    if (
      Array.isArray(p.movements)
      && p.movements.length
    ){
      pieces.push(p.movements.join(", "));
    }

    if (p.effort) pieces.push(String(p.effort));

    if (pieces.length>1 || (!original && pieces.length)){
      return pieces.join(" · ");
    }
  }

  if (original) return original;

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
    if (p.durationSeconds!==undefined){
      return seconds(p.durationSeconds);
    }

    if (
      p.distance!==undefined
      && p.distanceUnit
    ){
      return p.distance+" "+p.distanceUnit;
    }
  }

  if (shape==="carry"){
    if (p.durationSeconds!==undefined){
      return seconds(p.durationSeconds);
    }

    if (
      p.distance!==undefined
      && p.distanceUnit
    ){
      return p.distance+" "+p.distanceUnit;
    }
  }

  if (shape==="rounds" && p.rounds){
    return countText(p.rounds,"round","rounds");
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
          const resolution =
            resolveTrainingPlanExercise(
              exercise
            );

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
            adjustments:[],
            errors:[],
            repairKind:null,
            repairSeed:null,
            prescription:null,
            suggestions:
              resolution.suggestions || []
          };

          if (!resolution.ok){
            row.errors.push(
              resolution.code==="id-name-conflict"
                ? "The supplied exerciseId and exercise name identify different exercises."
                : "Choose a BlackPyre exercise, or create a custom one."
            );

            blockers++;
            warningsCount += row.warnings.length;
            review.push(row);
            return;
          }

          const shape =
            resolution.entry.shape;

          let trackingShapeAdjusted = false;

          if (
            Object.prototype.hasOwnProperty.call(
              exercise,
              "trackingShape"
            )
          ){
            trackingShapeAdjusted =
              !TRAINING_PLAN_SHAPES.includes(
                exercise.trackingShape
              )
              || exercise.trackingShape!==shape;
          }

          let prescriptionResult;

          if (parsed.kind==="interchange-v1"){
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
                ignoredFields:[],
                repairKind:null,
                repairSeed:null,
                adjusted:false
              };
            } else {
              prescriptionResult =
                normalizeTrainingPlanPrescriptionForCanonicalShape(
                  shape,
                  exercise
                );
            }
          } else if (
            Object.prototype.hasOwnProperty.call(
              exercise,
              "prescription"
            )
          ){
            prescriptionResult =
              normalizeTrainingPlanPrescriptionForCanonicalShape(
                shape,
                exercise
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
              ignoredFields:[],
              repairKind:null,
              repairSeed:null,
              adjusted:false
            };

            if (legacy.warning){
              row.warnings.push(
                legacy.warning
              );
            }
          }

          row.repairKind =
            prescriptionResult.repairKind
            || null;

          row.repairSeed =
            prescriptionResult.repairSeed
              ? cloneJSON(
                  prescriptionResult.repairSeed
                )
              : null;

          row.prescription =
            cloneJSON(
              prescriptionResult.value || {}
            );

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

          if (
            prescriptionResult.ok
            && (
              trackingShapeAdjusted
              || prescriptionResult.adjusted
            )
          ){
            const adjustment =
              trainingPlanTrackingAdjustmentMessage(
                resolution.entry,
                prescriptionResult.value
              );

            if (
              adjustment
              && row.adjustments.indexOf(
                   adjustment
                 )===-1
            ){
              row.adjustments.push(
                adjustment
              );
            }
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

  Object.keys(
    state.prescriptionOverrides || {}
  ).forEach(key=>{
    const parts = key.split(":");
    const dayIndex = Number(parts[0]);
    const exerciseIndex = Number(parts[1]);
    const override =
      state.prescriptionOverrides[key];

    if (
      !isPlainObject(override)
      || !sourceProgram.days[dayIndex]
      || !sourceProgram.days[dayIndex]
           .exercises[exerciseIndex]
    ){
      return;
    }

    const exercise =
      sourceProgram.days[dayIndex]
        .exercises[exerciseIndex];

    exercise.prescription =
      cloneJSON(override);

    delete exercise.scheme;

    if (state.kind==="interchange-v1"){
      const entry =
        exerciseModelEntryForId(
          exercise.exerciseId
        )
        || exerciseModelEntryForName(
          exercise.name
        );

      if (entry){
        exercise.trackingShape =
          entry.shape;
      }
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

function trainingPlanReviewSecondsText(value){
  const number = Number(value);

  if (
    !Number.isFinite(number)
    || number<0
  ){
    return "";
  }

  const seconds =
    Math.round(number);

  if (
    seconds>=120
    && seconds%60===0
  ){
    return (
      seconds/60
      +" min"
    );
  }

  return seconds+" sec";
}

function trainingPlanReviewPrescriptionText(
  row,
  sourceExercise
){
  const source =
    sourceExercise
    && typeof sourceExercise==="object"
      ? sourceExercise
      : {};

  const prescription =
    row
    && row.shape==="timeDist"
    && isPlainObject(row.prescription)
      ? row.prescription
      : null;

  if (prescription){
    const parts = [];

    const intervals =
      Number(prescription.intervals);

    const hasIntervals =
      Number.isInteger(intervals)
      && intervals>0;

    if (hasIntervals){
      parts.push(
        intervals
        +" "
        +(
          /^plank$/i.test(
            String(row.canonicalName||"")
          )
            ? "sets"
            : "intervals"
        )
      );
    }

    const duration =
      trainingPlanReviewSecondsText(
        prescription.durationSeconds
      );

    if (duration){
      parts.push(
        duration
        +(hasIntervals ? " each" : "")
      );
    }

    const distance =
      Number(prescription.distance);

    if (
      Number.isFinite(distance)
      && distance>0
      && prescription.distanceUnit
    ){
      parts.push(
        distance
        +" "
        +prescription.distanceUnit
        +(hasIntervals ? " each" : "")
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        prescription,
        "recoverySeconds"
      )
    ){
      const recovery =
        trainingPlanReviewSecondsText(
          prescription.recoverySeconds
        );

      if (recovery){
        parts.push(
          recovery+" recovery"
        );
      }
    }

    if (prescription.pace){
      parts.push(
        "Pace: "+prescription.pace
      );
    }

    if (prescription.effort){
      parts.push(
        "Effort: "+prescription.effort
      );
    }

    if (prescription.notes){
      parts.push(
        prescription.notes
      );
    }

    if (parts.length){
      return parts.join(" · ");
    }
  }

  const scheme =
    String(source.scheme||"").trim();

  if (scheme){
    return scheme;
  }

  if (isPlainObject(source.prescription)){
    return JSON.stringify(
      source.prescription
    );
  }

  return "No prescription supplied";
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

    if (
      trainingPlanReviewState
        .customExerciseExpanded
    ){
      delete trainingPlanReviewState
        .customExerciseExpanded[key];
    }

    const previousSelection =
      trainingPlanReviewState.selections[key]
      || "";

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

    if (
      select.value!==previousSelection
      && trainingPlanReviewState
           .prescriptionOverrides
    ){
      delete trainingPlanReviewState
        .prescriptionOverrides[key];
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



function trainingPlanReviewPrescriptionShapeLabel(shape){
  return {
    lift:"weight and repetitions",
    reps:"repetitions",
    timeDist:"time or distance",
    carry:"carry details",
    rounds:"round details",
    text:"instructions"
  }[shape] || "workout details";
}


function buildTrainingPlanMissingDurationPrompt(row){
  const state = trainingPlanReviewState;

  if (
    !state
    || !row
    || !row.exerciseId
  ){
    return null;
  }

  const key =
    trainingPlanReviewRowKey(row);

  const seed =
    state.prescriptionOverrides
    && isPlainObject(
      state.prescriptionOverrides[key]
    )
      ? cloneJSON(
          state.prescriptionOverrides[key]
        )
      : cloneJSON(
          row.repairSeed || {}
        );

  const count =
    Number(seed.intervals);

  const duration =
    Number(seed.durationSeconds);

  const durationMinutes =
    Number.isFinite(duration)
    && duration>0
      ? Math.floor(duration/60)
      : "";

  const durationSeconds =
    Number.isFinite(duration)
    && duration>0
      ? duration%60
      : "";

  const shell =
    document.createElement("div");

  shell.className =
    "training-plan-prescription-editor";

  shell.dataset.reviewKey = key;

  shell.style.cssText =
    "margin-top:10px; padding:10px;"
    +" border:1px solid var(--border);"
    +" border-radius:10px;";

  const heading =
    document.createElement("div");

  heading.textContent =
    /^plank$/i.test(
      String(row.canonicalName||"")
    )
      ? "How long is each plank?"
      : "How long is each set?";

  heading.style.cssText =
    "font-family:'Oswald',sans-serif;"
    +" font-size:14px; font-weight:700;";

  shell.appendChild(heading);

  const countText =
    Number.isInteger(count)
    && count>0
      ? String(count)
      : "the listed number of";

  appendTrainingPlanReviewMessage(
    shell,
    "The imported plan says "
      +countText
      +" sets, but it does not include a duration.",
    "var(--dim)"
  );

  const fields = {};

  const appendNumberField = (
    name,
    labelText,
    value,
    minimum,
    maximum
  )=>{
    const wrapper =
      document.createElement("label");

    wrapper.style.cssText =
      "display:block; margin-top:9px;"
      +" font-size:12px; line-height:1.4;";

    const label =
      document.createElement("span");

    label.textContent = labelText;
    wrapper.appendChild(label);

    const input =
      document.createElement("input");

    input.type = "number";
    input.inputMode = "numeric";
    input.step = "1";
    input.min = String(minimum);

    if (
      maximum!==undefined
      && maximum!==null
    ){
      input.max = String(maximum);
    }

    if (
      value!==undefined
      && value!==null
      && value!==""
    ){
      input.value = String(value);
    }

    input.dataset.prescriptionField =
      name;

    input.setAttribute(
      "aria-label",
      labelText
    );

    input.style.cssText =
      "width:100%; margin-top:4px;"
      +" font-size:16px;";

    wrapper.appendChild(input);
    shell.appendChild(wrapper);

    fields[name] = input;

    return input;
  };

  appendNumberField(
    "intervals",
    "Number of sets",
    Number.isInteger(count)
      && count>0
        ? count
        : "",
    1
  );

  appendNumberField(
    "durationMinutes",
    "Time per set — minutes",
    durationMinutes,
    0
  );

  appendNumberField(
    "durationSeconds",
    "Time per set — seconds",
    durationSeconds,
    0,
    59
  );

  const inlineError =
    document.createElement("div");

  inlineError.className =
    "training-plan-review-inline-error hidden";

  inlineError.style.cssText =
    "margin-top:8px; font-size:12px;"
    +" line-height:1.45; color:var(--warn);";

  shell.appendChild(inlineError);

  const apply =
    document.createElement("button");

  apply.type = "button";
  apply.className = "btn ghost small mt10";
  apply.dataset.prescriptionAction = "apply";
  apply.textContent = "Use this duration";

  apply.style.cssText =
    "width:100%; font-size:16px;";

  apply.addEventListener("click",()=>{
    if (!trainingPlanReviewState) return;

    inlineError.textContent = "";
    inlineError.classList.add("hidden");

    const setsSource =
      String(
        fields.intervals.value || ""
      ).trim();

    const minutesSource =
      String(
        fields.durationMinutes.value || ""
      ).trim();

    const secondsSource =
      String(
        fields.durationSeconds.value || ""
      ).trim();

    const sets = Number(setsSource);

    if (
      !setsSource
      || !Number.isInteger(sets)
      || sets<=0
    ){
      inlineError.textContent =
        "Enter the number of sets.";

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    const minutes =
      minutesSource
        ? Number(minutesSource)
        : 0;

    const seconds =
      secondsSource
        ? Number(secondsSource)
        : 0;

    if (
      !Number.isInteger(minutes)
      || minutes<0
    ){
      inlineError.textContent =
        "Minutes must be zero or a positive whole number.";

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    if (
      !Number.isInteger(seconds)
      || seconds<0
      || seconds>59
    ){
      inlineError.textContent =
        "Seconds must be from 0 through 59.";

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    const total =
      minutes*60+seconds;

    if (total<=0){
      inlineError.textContent =
        "Enter the time for each set.";

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    const value =
      cloneJSON(seed || {});

    value.intervals = sets;
    value.durationSeconds = total;

    delete value.sets;
    delete value.reps;
    delete value.distance;
    delete value.distanceUnit;

    const sanitized =
      sanitizeTrainingPlanPrescription(
        "timeDist",
        value
      );

    if (!sanitized.ok){
      inlineError.textContent =
        "These workout details could not be used.";

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    if (
      !trainingPlanReviewState
        .prescriptionOverrides
    ){
      trainingPlanReviewState
        .prescriptionOverrides = {};
    }

    trainingPlanReviewState
      .prescriptionOverrides[key] =
        cloneJSON(sanitized.value);

    rebuildTrainingPlanReview();
    renderTrainingPlanReview();
  });

  shell.appendChild(apply);

  return shell;
}

function buildTrainingPlanPrescriptionEditor(row){
  const state = trainingPlanReviewState;

  if (
    !state
    || !row
    || !row.exerciseId
    || !TRAINING_PLAN_SHAPES.includes(
      row.shape
    )
  ){
    return null;
  }

  if (
    row.repairKind
    ==="missing-time-duration"
  ){
    return buildTrainingPlanMissingDurationPrompt(
      row
    );
  }

  const key =
    trainingPlanReviewRowKey(row);

  const shape = row.shape;

  const current =
    state.prescriptionOverrides
    && isPlainObject(
      state.prescriptionOverrides[key]
    )
      ? state.prescriptionOverrides[key]
      : {};

  const shell =
    document.createElement("div");

  shell.className =
    "training-plan-prescription-editor";

  shell.dataset.reviewKey = key;

  shell.style.cssText =
    "margin-top:10px; padding:10px;"
    +" border:1px solid var(--border);"
    +" border-radius:10px;";

  const heading =
    document.createElement("div");

  heading.textContent =
    Object.keys(current).length
      ? "Workout details updated"
      : "Replace incompatible workout details";

  heading.style.cssText =
    "font-family:'Oswald',sans-serif;"
    +" font-size:14px; font-weight:700;";

  shell.appendChild(heading);

  const directions = {
    lift:
      "Enter repetitions and any optional sets, weight, rest, or notes. BlackPyre will not guess missing values.",
    reps:
      "Enter repetitions and any optional sets, weight, rest, or notes. BlackPyre will not guess missing values.",
    timeDist:
      "Enter a duration or distance. BlackPyre will not guess one.",
    carry:
      "Enter trips, duration, or distance. Weight, sets, rest, and notes are optional.",
    rounds:
      "Enter the number of rounds. Work, recovery, movements, rest, and notes are optional.",
    text:
      "Enter instructions, a completion target, or notes."
  };

  appendTrainingPlanReviewMessage(
    shell,
    Object.keys(current).length
      ? "These replacement details fit the selected "
        +trainingPlanReviewPrescriptionShapeLabel(shape)
        +" tracking."
      : "The imported workout details do not fit the selected exercise. "
        +directions[shape],
    "var(--dim)"
  );

  const fields = {};

  const appendField = (
    name,
    labelText,
    element
  )=>{
    const wrapper =
      document.createElement("label");

    wrapper.style.cssText =
      "display:block; margin-top:9px;"
      +" font-size:12px; line-height:1.4;";

    const label =
      document.createElement("span");

    label.textContent = labelText;
    wrapper.appendChild(label);

    element.dataset.prescriptionField =
      name;

    element.setAttribute(
      "aria-label",
      labelText
    );

    element.style.cssText =
      "width:100%; margin-top:4px;"
      +" font-size:16px;";

    wrapper.appendChild(element);
    shell.appendChild(wrapper);

    fields[name] = element;

    return element;
  };

  const addNumber = (
    name,
    labelText,
    value,
    options
  )=>{
    const input =
      document.createElement("input");

    input.type = "number";

    input.inputMode =
      options && options.decimal
        ? "decimal"
        : "numeric";

    if (
      options
      && Object.prototype.hasOwnProperty.call(
        options,
        "min"
      )
    ){
      input.min = String(options.min);
    }

    if (
      options
      && Object.prototype.hasOwnProperty.call(
        options,
        "max"
      )
    ){
      input.max = String(options.max);
    }

    input.step =
      options && options.decimal
        ? "any"
        : "1";

    if (
      value!==undefined
      && value!==null
      && value!==""
    ){
      input.value = String(value);
    }

    return appendField(
      name,
      labelText,
      input
    );
  };

  const addSelect = (
    name,
    labelText,
    value,
    options
  )=>{
    const select =
      document.createElement("select");

    const blank =
      document.createElement("option");

    blank.value = "";
    blank.textContent = "Choose";

    select.appendChild(blank);

    options.forEach(item=>{
      const option =
        document.createElement("option");

      option.value = item[0];
      option.textContent = item[1];

      select.appendChild(option);
    });

    select.value =
      value ? String(value) : "";

    return appendField(
      name,
      labelText,
      select
    );
  };

  const addText = (
    name,
    labelText,
    value,
    multiline
  )=>{
    const input =
      multiline
        ? document.createElement("textarea")
        : document.createElement("input");

    if (!multiline){
      input.type = "text";
    } else {
      input.rows = 3;
    }

    input.value =
      Array.isArray(value)
        ? value.join(", ")
        : String(value || "");

    return appendField(
      name,
      labelText,
      input
    );
  };

  const duration =
    Number(current.durationSeconds);

  const durationMinutes =
    Number.isFinite(duration)
    && duration>0
      ? Math.floor(duration/60)
      : "";

  const durationSeconds =
    Number.isFinite(duration)
    && duration>0
      ? duration%60
      : "";

  if (shape==="lift" || shape==="reps"){
    addNumber(
      "sets",
      "Sets — optional",
      current.sets,
      {min:1}
    );

    addNumber(
      "reps",
      "Repetitions",
      typeof current.reps==="number"
        ? current.reps
        : "",
      {min:1}
    );

    addNumber(
      "weight",
      "Suggested weight — optional",
      current.weight,
      {min:0,decimal:true}
    );

    addSelect(
      "weightUnit",
      "Weight unit",
      current.weightUnit,
      [
        ["lb","Pounds"],
        ["kg","Kilograms"]
      ]
    );

    addNumber(
      "restSeconds",
      "Rest seconds — optional",
      current.restSeconds,
      {min:0}
    );
  }

  if (shape==="timeDist"){
    addNumber(
      "intervals",
      "Intervals — optional",
      current.intervals,
      {min:1}
    );

    addNumber(
      "durationMinutes",
      "Duration minutes",
      durationMinutes,
      {min:0}
    );

    addNumber(
      "durationSeconds",
      "Additional duration seconds",
      durationSeconds,
      {min:0,max:59}
    );

    addNumber(
      "distance",
      "Distance — optional",
      current.distance,
      {min:0,decimal:true}
    );

    addSelect(
      "distanceUnit",
      "Distance unit",
      current.distanceUnit,
      [
        ["mi","Miles"],
        ["km","Kilometers"],
        ["m","Meters"],
        ["ft","Feet"]
      ]
    );

    addNumber(
      "recoverySeconds",
      "Recovery seconds — optional",
      current.recoverySeconds,
      {min:0}
    );

    addNumber(
      "restSeconds",
      "Rest seconds — optional",
      current.restSeconds,
      {min:0}
    );
  }

  if (shape==="carry"){
    addNumber(
      "sets",
      "Sets — optional",
      current.sets,
      {min:1}
    );

    addNumber(
      "trips",
      "Trips — optional",
      current.trips,
      {min:1}
    );

    addNumber(
      "durationMinutes",
      "Duration minutes — optional",
      durationMinutes,
      {min:0}
    );

    addNumber(
      "durationSeconds",
      "Additional duration seconds",
      durationSeconds,
      {min:0,max:59}
    );

    addNumber(
      "distance",
      "Distance — optional",
      current.distance,
      {min:0,decimal:true}
    );

    addSelect(
      "distanceUnit",
      "Distance unit",
      current.distanceUnit,
      [
        ["mi","Miles"],
        ["km","Kilometers"],
        ["m","Meters"],
        ["ft","Feet"]
      ]
    );

    addNumber(
      "weight",
      "Weight — optional",
      current.weight,
      {min:0,decimal:true}
    );

    addSelect(
      "weightUnit",
      "Weight unit",
      current.weightUnit,
      [
        ["lb","Pounds"],
        ["kg","Kilograms"]
      ]
    );

    addNumber(
      "restSeconds",
      "Rest seconds — optional",
      current.restSeconds,
      {min:0}
    );
  }

  if (shape==="rounds"){
    addNumber(
      "rounds",
      "Rounds",
      current.rounds,
      {min:1}
    );

    addNumber(
      "workSeconds",
      "Work seconds — optional",
      current.workSeconds,
      {min:1}
    );

    addNumber(
      "recoverySeconds",
      "Recovery seconds — optional",
      current.recoverySeconds,
      {min:0}
    );

    addNumber(
      "restSeconds",
      "Rest seconds — optional",
      current.restSeconds,
      {min:0}
    );

    addText(
      "movements",
      "Movements — optional, separated by commas",
      current.movements,
      true
    );
  }

  if (shape==="text"){
    addText(
      "instructions",
      "Instructions",
      current.instructions,
      true
    );

    addText(
      "completionTarget",
      "Completion target — optional",
      current.completionTarget,
      true
    );
  }

  addText(
    "notes",
    "Notes — optional",
    current.notes,
    true
  );

  const inlineError =
    document.createElement("div");

  inlineError.className =
    "training-plan-review-inline-error hidden";

  inlineError.style.cssText =
    "margin-top:8px; font-size:12px;"
    +" line-height:1.45; color:var(--warn);";

  shell.appendChild(inlineError);

  const apply =
    document.createElement("button");

  apply.type = "button";
  apply.className = "btn ghost small mt10";
  apply.dataset.prescriptionAction = "apply";

  apply.textContent =
    Object.keys(current).length
      ? "Update workout details"
      : "Use these workout details";

  apply.style.cssText =
    "width:100%; font-size:16px;";

  apply.addEventListener("click",()=>{
    if (!trainingPlanReviewState) return;

    inlineError.textContent = "";
    inlineError.classList.add("hidden");

    const value = {};
    const errors = [];

    const raw = name=>
      fields[name]
        ? String(fields[name].value||"").trim()
        : "";

    const readPositiveInteger = (
      name,
      target,
      labelText,
      required
    )=>{
      const source = raw(name);

      if (!source){
        if (required){
          errors.push(
            "Enter "+labelText+"."
          );
        }

        return;
      }

      const number = Number(source);

      if (
        !Number.isInteger(number)
        || number<=0
      ){
        errors.push(
          labelText
          +" must be a positive whole number."
        );

        return;
      }

      value[target] = number;
    };

    const readPositiveNumber = (
      name,
      target,
      labelText
    )=>{
      const source = raw(name);

      if (!source) return;

      const number = Number(source);

      if (
        !Number.isFinite(number)
        || number<=0
      ){
        errors.push(
          labelText
          +" must be greater than zero."
        );

        return;
      }

      value[target] = number;
    };

    const readNonNegativeInteger = (
      name,
      target,
      labelText
    )=>{
      const source = raw(name);

      if (source==="") return;

      const number = Number(source);

      if (
        !Number.isInteger(number)
        || number<0
      ){
        errors.push(
          labelText
          +" must be zero or a positive whole number."
        );

        return;
      }

      value[target] = number;
    };

    const readText = (
      name,
      target
    )=>{
      const source = raw(name);

      if (source){
        value[target] = source;
      }
    };

    const readDuration = ()=>{
      const minutesSource =
        raw("durationMinutes");

      const secondsSource =
        raw("durationSeconds");

      if (
        minutesSource===""
        && secondsSource===""
      ){
        return;
      }

      const minutes =
        minutesSource===""
          ? 0
          : Number(minutesSource);

      const seconds =
        secondsSource===""
          ? 0
          : Number(secondsSource);

      if (
        !Number.isInteger(minutes)
        || minutes<0
      ){
        errors.push(
          "Duration minutes must be zero or a positive whole number."
        );

        return;
      }

      if (
        !Number.isInteger(seconds)
        || seconds<0
        || seconds>59
      ){
        errors.push(
          "Additional duration seconds must be from 0 through 59."
        );

        return;
      }

      const total =
        minutes*60+seconds;

      if (total<=0){
        errors.push(
          "Duration must be greater than zero."
        );

        return;
      }

      value.durationSeconds = total;
    };

    if (shape==="lift" || shape==="reps"){
      readPositiveInteger(
        "sets",
        "sets",
        "sets",
        false
      );

      readPositiveInteger(
        "reps",
        "reps",
        "repetitions",
        true
      );

      readPositiveNumber(
        "weight",
        "weight",
        "weight"
      );

      if (
        Object.prototype.hasOwnProperty.call(
          value,
          "weight"
        )
      ){
        const unit = raw("weightUnit");

        if (!unit){
          errors.push(
            "Choose the weight unit."
          );
        } else {
          value.weightUnit = unit;
        }
      }

      readNonNegativeInteger(
        "restSeconds",
        "restSeconds",
        "rest seconds"
      );
    }

    if (shape==="timeDist"){
      readPositiveInteger(
        "intervals",
        "intervals",
        "intervals",
        false
      );

      readDuration();

      readPositiveNumber(
        "distance",
        "distance",
        "distance"
      );

      if (
        Object.prototype.hasOwnProperty.call(
          value,
          "distance"
        )
      ){
        const unit = raw("distanceUnit");

        if (!unit){
          errors.push(
            "Choose the distance unit."
          );
        } else {
          value.distanceUnit = unit;
        }
      }

      readNonNegativeInteger(
        "recoverySeconds",
        "recoverySeconds",
        "recovery seconds"
      );

      readNonNegativeInteger(
        "restSeconds",
        "restSeconds",
        "rest seconds"
      );

      if (
        !Object.prototype.hasOwnProperty.call(
          value,
          "durationSeconds"
        )
        && !Object.prototype.hasOwnProperty.call(
          value,
          "distance"
        )
      ){
        errors.push(
          "Enter a duration or distance."
        );
      }
    }

    if (shape==="carry"){
      readPositiveInteger(
        "sets",
        "sets",
        "sets",
        false
      );

      readPositiveInteger(
        "trips",
        "trips",
        "trips",
        false
      );

      readDuration();

      readPositiveNumber(
        "distance",
        "distance",
        "distance"
      );

      if (
        Object.prototype.hasOwnProperty.call(
          value,
          "distance"
        )
      ){
        const unit = raw("distanceUnit");

        if (!unit){
          errors.push(
            "Choose the distance unit."
          );
        } else {
          value.distanceUnit = unit;
        }
      }

      readPositiveNumber(
        "weight",
        "weight",
        "weight"
      );

      if (
        Object.prototype.hasOwnProperty.call(
          value,
          "weight"
        )
      ){
        const unit = raw("weightUnit");

        if (!unit){
          errors.push(
            "Choose the weight unit."
          );
        } else {
          value.weightUnit = unit;
        }
      }

      readNonNegativeInteger(
        "restSeconds",
        "restSeconds",
        "rest seconds"
      );

      if (
        !Object.prototype.hasOwnProperty.call(
          value,
          "trips"
        )
        && !Object.prototype.hasOwnProperty.call(
          value,
          "durationSeconds"
        )
        && !Object.prototype.hasOwnProperty.call(
          value,
          "distance"
        )
      ){
        errors.push(
          "Enter trips, duration, or distance."
        );
      }
    }

    if (shape==="rounds"){
      readPositiveInteger(
        "rounds",
        "rounds",
        "rounds",
        true
      );

      readPositiveInteger(
        "workSeconds",
        "workSeconds",
        "work seconds",
        false
      );

      readNonNegativeInteger(
        "recoverySeconds",
        "recoverySeconds",
        "recovery seconds"
      );

      readNonNegativeInteger(
        "restSeconds",
        "restSeconds",
        "rest seconds"
      );

      const movements = raw("movements");

      if (movements){
        value.movements =
          movements
            .split(",")
            .map(item=>item.trim())
            .filter(Boolean);
      }
    }

    if (shape==="text"){
      readText(
        "instructions",
        "instructions"
      );

      readText(
        "completionTarget",
        "completionTarget"
      );
    }

    readText(
      "notes",
      "notes"
    );

    if (
      shape==="text"
      && !value.instructions
      && !value.completionTarget
      && !value.notes
    ){
      errors.push(
        "Enter instructions, a completion target, or notes."
      );
    }

    if (errors.length){
      inlineError.textContent =
        errors.join(" ");

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    const sanitized =
      sanitizeTrainingPlanPrescription(
        shape,
        value
      );

    if (!sanitized.ok){
      inlineError.textContent =
        (sanitized.errors||[]).join(" ")
        || "These workout details are incomplete.";

      inlineError.classList.remove(
        "hidden"
      );

      return;
    }

    if (
      !trainingPlanReviewState
        .prescriptionOverrides
    ){
      trainingPlanReviewState
        .prescriptionOverrides = {};
    }

    trainingPlanReviewState
      .prescriptionOverrides[key] =
        cloneJSON(sanitized.value);

    rebuildTrainingPlanReview();
    renderTrainingPlanReview();
  });

  shell.appendChild(apply);

  return shell;
}


function buildTrainingPlanCustomExerciseEditor(row){
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

  const details =
    document.createElement("details");

  details.className =
    "training-plan-custom-exercise-details";

  details.dataset.reviewKey = key;
  details.open = !!pending;
  details.style.cssText =
    "margin-top:10px;";

  const toggle =
    document.createElement("summary");

  toggle.textContent =
    pending
      ? "Edit pending custom exercise"
      : "Create a custom exercise instead";

  toggle.style.cssText =
    "cursor:pointer; min-height:44px;"
    +" display:flex; align-items:center;"
    +" padding:10px 12px;"
    +" border:1px solid var(--border);"
    +" border-radius:10px;"
    +" font-family:'Oswald',sans-serif;"
    +" font-size:14px; font-weight:700;";

  details.appendChild(toggle);

  const shell = document.createElement("div");

  shell.style.cssText =
    "margin-top:8px; padding:10px;"
    +" border:1px solid var(--border);"
    +" border-radius:10px;"
    +" background:var(--panel-up);";

  const heading = document.createElement("div");

  heading.textContent =
    pending
      ? "Pending custom exercise"
      : "Custom exercise details";

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
  details.appendChild(shell);

  return details;
}

function buildTrainingPlanCustomExerciseControls(row){
  const state = trainingPlanReviewState;
  const key = trainingPlanReviewRowKey(row);

  if (!state) return document.createElement("div");

  if (!state.customExerciseExpanded){
    state.customExerciseExpanded = {};
  }

  const pending =
    state.customExercises
      ? state.customExercises[key] || null
      : null;

  const hasStoredChoice =
    Object.prototype.hasOwnProperty.call(
      state.customExerciseExpanded,
      key
    );

  const expanded =
    hasStoredChoice
      ? state.customExerciseExpanded[key]===true
      : !!pending;

  const shell = document.createElement("div");
  shell.className =
    "training-plan-custom-exercise-collapsible";
  shell.dataset.customContainerKey = key;
  shell.style.marginTop = "9px";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "btn ghost small";
  toggle.dataset.customToggleKey = key;
  toggle.textContent =
    expanded
      ? "Hide custom exercise form"
      : "Create a custom exercise instead";
  toggle.setAttribute(
    "aria-expanded",
    expanded ? "true" : "false"
  );
  toggle.style.cssText =
    "width:100%; min-height:44px; font-size:16px;";

  const editorId =
    "trainingPlanCustomEditor-"
    +key.replace(/[^a-z0-9]+/gi,"-");

  toggle.setAttribute("aria-controls",editorId);

  toggle.addEventListener("click",()=>{
    if (!trainingPlanReviewState) return;

    if (!trainingPlanReviewState.customExerciseExpanded){
      trainingPlanReviewState.customExerciseExpanded = {};
    }

    trainingPlanReviewState
      .customExerciseExpanded[key] = !expanded;

    renderTrainingPlanReview();
  });

  shell.appendChild(toggle);

  if (expanded){
    const editor =
      buildTrainingPlanCustomExerciseEditor(row);

    editor.id = editorId;
    editor.classList.add(
      "training-plan-custom-exercise-editor"
    );
    shell.appendChild(editor);
  }

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

  const needsExerciseMatches =
    prepared.review.some(
      row=>!row.exerciseId
    );

  summary.textContent =
    prepared.blockers>0
      ? (
          needsExerciseMatches
            ? "This file needs a few exercise matches before it can be loaded. Review the choices below."
            : "This file needs a few details before it can be loaded. Review the items below."
        )
      : "This training plan is ready to review. Your current program will not change until you confirm.";

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
      trainingPlanReviewPrescriptionText(
        row,
        sourceExercise
      );

    appendTrainingPlanReviewMessage(
      card,
      "Prescription: "+prescriptionText,
      "var(--text)"
    );

    const selectedKey =
      trainingPlanReviewRowKey(row);

    const manuallySelected =
      !!state.selections[selectedKey];

    const prescriptionOverride =
      state.prescriptionOverrides
      && isPlainObject(
        state.prescriptionOverrides[
          selectedKey
        ]
      )
        ? state.prescriptionOverrides[
            selectedKey
          ]
        : null;

    const pendingCustom =
      state.customExercises
        ? state.customExercises[selectedKey] || null
        : null;

    if (row.exerciseId){
      appendTrainingPlanReviewMessage(
        card,
        "Matched to "
          +row.canonicalName
          +(manuallySelected
              ? " by your selection."
              : "."
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
        "Choose the matching BlackPyre exercise.",
        "var(--warn)"
      );
    }

    if (
      row.repairKind
      !=="missing-time-duration"
    ){
      row.errors.forEach(message=>{
        appendTrainingPlanReviewMessage(
          card,
          "Needs attention: "+message,
          "var(--warn)"
        );
      });
    }

    const adjustmentMessages =
      (row.adjustments || []).slice();

    if (
      prescriptionOverride
      && !row.errors.length
      && row.exerciseId
    ){
      const overrideEntry =
        exerciseModelEntryForId(
          row.exerciseId
        );

      const overrideMessage =
        trainingPlanTrackingAdjustmentMessage(
          overrideEntry,
          prescriptionOverride
        );

      if (
        overrideMessage
        && adjustmentMessages.indexOf(
             overrideMessage
           )===-1
      ){
        adjustmentMessages.push(
          overrideMessage
        );
      }
    }

    adjustmentMessages.forEach(message=>{
      appendTrainingPlanReviewMessage(
        card,
        message,
        "var(--ok)"
      );
    });

    row.warnings.forEach(message=>{
      appendTrainingPlanReviewMessage(
        card,
        "Note: "+message,
        "var(--amber)"
      );
    });

    if (
      row.exerciseId
      && row.errors.length
    ){
      const prescriptionEditor =
        buildTrainingPlanPrescriptionEditor(
          row
        );

      if (prescriptionEditor){
        card.appendChild(
          prescriptionEditor
        );
      }
    }

    const needsExerciseResolution =
      !row.exerciseId
      || pendingCustom
      || (
        row.errors.length
        && !row.repairKind
      );

    if (needsExerciseResolution){
      card.appendChild(
        buildTrainingPlanResolutionSelect(row)
      );
    }

    if (needsExerciseResolution){
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
      : "Review highlighted exercises";
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
    customExerciseExpanded:{},
    prescriptionOverrides:{},
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
    || kind==="rounds"
    || (
      BP_WORKOUT_PROFILES
      && BP_WORKOUT_PROFILES.isEditableSavedType(kind)
    );
}

function makePlanSessionState(ex,lastVal){
  const resolution=bpWorkoutProfileResolutionForExercise(ex);
  const modelEntry=exerciseModelEntryForReference(ex);
  const shape=
    modelEntry
      ? modelEntry.shape
      : exerciseShapeForName(
          ex && typeof ex==="object"
            ? ex.name || ""
            : ""
        );

  if (!resolution){
    return {
      mode:"future",
      profile:null,
      profileOptions:{},
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

  const profile=resolution.profile;
  const options=resolution.options || {};

  if (
    profile==="strengthSets"
    || profile==="repetitionSets"
  ){
    const pf=prefillRows(ex,lastVal);

    const hasStructuredPrescription=
      isPlainObject(
        ex && ex.prescription
      )
      && Object.keys(
        ex.prescription
      ).length>0;

    const prescription=
      hasStructuredPrescription
        ? ex.prescription
        : null;

    const prescribedSets=
      Number(
        prescription
        && prescription.sets
      );

    const prescribedReps=
      Number(
        prescription
        && prescription.reps
      );

    if (
      Number.isInteger(prescribedSets)
      && prescribedSets>0
      && Number.isInteger(prescribedReps)
      && prescribedReps>0
    ){
      const hasPrescribedWeight=
        prescription.weight!==""
        && prescription.weight!==null
        && prescription.weight!==undefined
        && Number.isFinite(
          Number(prescription.weight)
        )
        && Number(prescription.weight)>0;

      const prescribedWeight=
        hasPrescribedWeight
          ? Number(prescription.weight)
          : null;

      const prescribedRows=[];

      for (
        let index=0;
        index<prescribedSets;
        index+=1
      ){
        const existing=
          pf.rows[index] || {};

        const row={
          w:
            Object.prototype
              .hasOwnProperty.call(
                existing,
                "w"
              )
              ? existing.w
              : "",
          r:prescribedReps,
          touched:false
        };

        if (hasPrescribedWeight){
          row.w=prescribedWeight;
        }

        prescribedRows.push(row);
      }

      pf.rows=prescribedRows;

      if (hasPrescribedWeight){
        pf.auto=false;
        pf.autoDelta=0;
      }
    }

    return {
      mode:"rows",
      profile:profile,
      profileOptions:options,
      rowShape:
        profile==="repetitionSets"
          ? "reps"
          : rowShapeForValue(ex.name,lastVal),
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

  const prescription=bpWorkoutProfilePrescription(ex);
  const typed=
    BP_WORKOUT_PROFILES.prefill(profile,prescription)
    || BP_WORKOUT_PROFILES.blank(profile);

  const legacyMode=
    ["timeDist","carry","rounds","text"].includes(shape)
      ? shape
      : "future";

  return {
    mode:legacyMode,
    profile:profile,
    profileOptions:options,
    rowShape:null,
    rows:[],
    text:"",
    textTouched:false,
    typed:typed,
    typedTouched:false,
    auto:false,
    autoDelta:0,
    saved:null,
    status:"plan"
  };
}

function makeSavedSessionState(exName,val){
  const kind=workoutValueKind(val);
  const resolution=bpWorkoutProfileResolutionForName(exName);
  const cleanName=String(exName||"").replace("[Cardio] ","");
  const modelEntry=
    exerciseModelEntryForReference({name:cleanName});
  const shape=
    modelEntry
      ? modelEntry.shape
      : exerciseShapeForName(cleanName);
  const legacyMode=
    ["timeDist","carry","rounds","text"].includes(shape)
      ? shape
      : "future";

  const base={
    profile:resolution ? resolution.profile : null,
    profileOptions:resolution ? resolution.options || {} : {},
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
    base.mode="rows";
    base.profile=
      base.profile==="repetitionSets"
        ? "repetitionSets"
        : "strengthSets";
    base.rowShape=rowShapeForValue(exName,val);
    return base;
  }

  if (
    base.profile
    && BP_WORKOUT_PROFILES
    && !BP_WORKOUT_PROFILES.isRowProfile(base.profile)
  ){
    const draft=
      BP_WORKOUT_PROFILES.fromStored(base.profile,val);

    if (draft){
      base.mode=legacyMode;
      base.typed=draft;
      return base;
    }
  }

  if (kind==="legacyText"){
    base.profile=null;
    base.profileOptions={};
    base.mode="text";
    base.text=val;
    return base;
  }

  if (
    kind==="timeDist"
    || kind==="carry"
    || kind==="rounds"
  ){
    base.profile=null;
    base.profileOptions={};
    base.mode=kind;
    base.typed=cloneWorkoutValue(val);
    return base;
  }

  base.mode="future";
  return base;
}

function loadWorkoutValueIntoEditableState(st,exName,val){
  const kind=workoutValueKind(val);
  const resolution=bpWorkoutProfileResolutionForName(exName);
  const cleanName=String(exName||"").replace("[Cardio] ","");
  const modelEntry=
    exerciseModelEntryForReference({name:cleanName});
  const shape=
    modelEntry
      ? modelEntry.shape
      : exerciseShapeForName(cleanName);
  const legacyMode=
    ["timeDist","carry","rounds","text"].includes(shape)
      ? shape
      : "future";

  st.auto=false;
  st.autoDelta=0;
  st.textTouched=false;
  st.typedTouched=false;
  st.profile=resolution ? resolution.profile : st.profile || null;
  st.profileOptions=
    resolution
      ? resolution.options || {}
      : st.profileOptions || {};

  if (kind==="rows"){
    st.mode="rows";
    st.profile=
      st.profile==="repetitionSets"
        ? "repetitionSets"
        : "strengthSets";
    st.rowShape=rowShapeForValue(exName,val);
    st.rows=toRows(val).map(row=>({
      w:row.w,
      r:row.r,
      done:false,
      touched:true
    }));
    st.typed=null;
    return true;
  }

  if (
    st.profile
    && BP_WORKOUT_PROFILES
    && !BP_WORKOUT_PROFILES.isRowProfile(st.profile)
  ){
    const draft=
      BP_WORKOUT_PROFILES.fromStored(st.profile,val);

    if (draft){
      st.mode=legacyMode;
      st.rowShape=null;
      st.rows=[];
      st.text="";
      st.typed=draft;
      st.typedTouched=true;
      return true;
    }
  }

  if (kind==="legacyText"){
    st.profile=null;
    st.profileOptions={};
    st.mode="text";
    st.rowShape=null;
    st.text=val;
    st.textTouched=true;
    st.typed=null;
    return true;
  }

  if (
    kind==="timeDist"
    || kind==="carry"
    || kind==="rounds"
  ){
    st.profile=null;
    st.profileOptions={};
    st.mode=kind;
    st.rowShape=null;
    st.rows=[];
    st.text="";
    st.typed=cloneWorkoutValue(val);
    st.typedTouched=true;
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
  if (!st || typeof st!=="object"){
    return {
      ok:false,
      message:"workout entry is unavailable."
    };
  }

  if (st.mode==="rows"){
    if (
      BP_WORKOUT_PROFILES
      && typeof BP_WORKOUT_PROFILES.validateRows==="function"
    ){
      return BP_WORKOUT_PROFILES.validateRows(
        st.profile || (
          st.rowShape==="reps"
            ? "repetitionSets"
            : "strengthSets"
        ),
        st.rows,
        st.profileOptions || {}
      );
    }

    const entered=enteredRows(st);

    if (!entered.length){
      return {ok:true,value:null};
    }

    const repsOnly=st.rowShape==="reps";
    const sets=[];

    for (const item of entered){
      const reps=Number(item.r.r);

      if (!(reps>0)){
        return {
          ok:false,
          rowIndex:item.i,
          field:"reps",
          message:
            "enter reps for Set "+(item.i+1)
            +", or clear it, before saving."
        };
      }

      if (repsOnly){
        const row={r:reps};
        const hasWeight=
          item.r.w!==undefined
          && item.r.w!==null
          && item.r.w!=="";

        if (hasWeight){
          const weight=Number(item.r.w);

          if (!(weight>=0)){
            return {
              ok:false,
              rowIndex:item.i,
              field:"weight",
              message:
                "enter a valid optional weight for Set "
                +(item.i+1)+", or clear it."
            };
          }

          row.w=weight;
        }

        sets.push(row);
        continue;
      }

      if (!(Number(item.r.w)>0)){
        return {
          ok:false,
          rowIndex:item.i,
          field:"weight",
          message:
            "enter weight and reps for Set "+(item.i+1)
            +", or clear it, before saving."
        };
      }

      sets.push({
        w:Number(item.r.w),
        r:reps
      });
    }

    return {ok:true,value:sets};
  }

  if (
    st.profile
    && BP_WORKOUT_PROFILES
    && !BP_WORKOUT_PROFILES.isRowProfile(st.profile)
  ){
    if (!st.typedTouched){
      return {ok:true,value:null};
    }

    return BP_WORKOUT_PROFILES.validate(
      st.profile,
      st.typed || {}
    );
  }

  if (st.mode==="text"){
    const text=
      st.textTouched
      && String(st.text||"").trim()
        ? String(st.text||"").trim()
        : null;

    return {ok:true,value:text};
  }

  if (st.mode==="timeDist"){
    if (!st.typedTouched){
      return {ok:true,value:null};
    }

    const raw=st.typed || {};
    const secs=Number(raw.secs);

    if (!(secs>0)){
      return {
        ok:false,
        message:
          "enter a duration greater than 0 before saving."
      };
    }

    const value={
      t:"timeDist",
      secs:secs
    };

    const hasDistance=
      raw.dist!==undefined
      && raw.dist!==null
      && raw.dist!=="";

    if (hasDistance){
      const distance=Number(raw.dist);

      if (!(distance>0)){
        return {
          ok:false,
          message:
            "enter a distance greater than 0, or clear it."
        };
      }

      if (!EXERCISE_DISTANCE_UNITS.includes(raw.distUnit)){
        return {
          ok:false,
          message:"choose a valid distance unit."
        };
      }

      value.dist=distance;
      value.distUnit=raw.distUnit;
    }

    return {ok:true,value:value};
  }

  if (st.mode==="carry"){
    if (!st.typedTouched){
      return {ok:true,value:null};
    }

    const raw=st.typed || {};
    const pounds=Number(raw.lbs);
    const distance=Number(raw.dist);

    if (!(pounds>0)){
      return {
        ok:false,
        message:
          "enter a carry weight greater than 0 lb before saving."
      };
    }

    if (!(distance>0)){
      return {
        ok:false,
        message:
          "enter a carry distance greater than 0 before saving."
      };
    }

    if (!EXERCISE_DISTANCE_UNITS.includes(raw.distUnit)){
      return {
        ok:false,
        message:"choose a valid carry distance unit."
      };
    }

    return {
      ok:true,
      value:{
        t:"carry",
        lbs:pounds,
        dist:distance,
        distUnit:raw.distUnit
      }
    };
  }

  if (st.mode==="rounds"){
    if (!st.typedTouched){
      return {ok:true,value:null};
    }

    const raw=st.typed || {};
    const rounds=Number(raw.rounds);
    const work=Number(raw.workSecs);
    const recovery=Number(raw.recSecs);

    if (!(Number.isInteger(rounds) && rounds>0)){
      return {
        ok:false,
        message:
          "enter a whole number of rounds greater than 0."
      };
    }

    if (!(Number.isInteger(work) && work>0)){
      return {
        ok:false,
        message:
          "enter whole work seconds greater than 0."
      };
    }

    if (!(Number.isInteger(recovery) && recovery>=0)){
      return {
        ok:false,
        message:
          "enter whole recovery seconds of 0 or more."
      };
    }

    const value={
      t:"rounds",
      rounds:rounds,
      workSecs:work,
      recSecs:recovery
    };

    const note=String(raw.note||"").trim();

    if (note){
      value.note=note;
    }

    return {ok:true,value:value};
  }

  return {
    ok:false,
    message:
      "this exercise does not have a supported workout card."
  };
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
  if (!st || st.status==="saved") return false;

  if (st.mode==="text"){
    return !!st.textTouched && !!String(st.text||"").trim();
  }

  if (
    st.profile
    && BP_WORKOUT_PROFILES
    && !BP_WORKOUT_PROFILES.isRowProfile(st.profile)
  ){
    return !!st.typedTouched;
  }

  if (st.mode==="future") return false;

  return Array.isArray(st.rows) && st.rows.some(row=>
    row.touched
    && (row.w!=="" || row.r!=="")
  );
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
    let st = sessionState[ex.name];
    const expectedProfile =
      bpWorkoutProfileResolutionForExercise(ex);
    if (
      st
      && st.profile
      && expectedProfile
      && BP_WORKOUT_PROFILES
      && !BP_WORKOUT_PROFILES.compatible(
        st.profile,
        expectedProfile.profile
      )
    ){
      sessionState[ex.name] =
        makePlanSessionState(ex,null);
      st = sessionState[ex.name];
    }
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

    appendWorkoutProfileEditor(div,ex,st);
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

  [
    "mfName",
    "mfServingLabel",
    "mfServG",
    "mfCal",
    "mfPro",
    "mfCarb",
    "mfFat",
    "mfBarcode"
  ].forEach(id=>{
    document.getElementById(id).value="";
  });

  document.getElementById("mfServingUnit").value =
    "g";

  document.getElementById("mfFormLabel").textContent =
    "Create a food";

  document.getElementById("mfSaveBtn").textContent =
    "Save food";

  document
    .getElementById("mfCancelBtn")
    .classList
    .add("hidden");
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
  const result =
    buildServingFood({
      name:
        document
          .getElementById("mfName")
          .value,
      brand:"My foods",
      servingLabel:
        document
          .getElementById("mfServingLabel")
          .value,
      servingAmount:
        document
          .getElementById("mfServG")
          .value,
      servingUnit:
        document
          .getElementById("mfServingUnit")
          .value,
      calories:
        document
          .getElementById("mfCal")
          .value,
      protein:
        document
          .getElementById("mfPro")
          .value,
      carbs:
        document
          .getElementById("mfCarb")
          .value,
      fat:
        document
          .getElementById("mfFat")
          .value,
      sourceLabel:"My Foods"
    });

  if (!result.ok){
    const fieldMap = {
      name:"mfName",
      calories:"mfCal",
      servingAmount:"mfServG",
      macros:"mfPro"
    };

    const id =
      fieldMap[result.field];

    flashSave(
      result.message,
      true
    );

    if (id){
      document
        .getElementById(id)
        .focus();
    }

    return;
  }

  const food =
    result.food;

  const barcode =
    document
      .getElementById("mfBarcode")
      .value
      .replace(/\D/g,"");

  if (barcode){
    food.barcode=barcode;
  }

  const key =
    barcode
    || mfEditKey
    || (
      "cf_"
      +Date.now()
    );

  const wasEdit =
    mfEditKey!=null;

  if (
    mfEditKey
    && key!==mfEditKey
  ){
    delete data.myFoods[mfEditKey];
  }

  data.myFoods[key]=food;
  save();

  ackBtn(
    "mfSaveBtn",
    wasEdit
      ? "✓ Updated"
      : "✓ Saved"
  );

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

      const servingValues =
        servingValuesFromFood(f);

      const storedUnit =
        normalizedServingUnit(
          String(f.servingUnit||"g")
        );

      document.getElementById("mfServingLabel").value =
        f.servingLabel || "";

      document.getElementById("mfServingUnit").value =
        storedUnit;

      document.getElementById("mfServG").value =
        storedUnit==="serving"
          ? ""
          : (
              Number(f.servingAmount)>0
                ? f.servingAmount
                : (f.servingG||100)
            );

      document.getElementById("mfCal").value =
        Math.round(servingValues.cal*10)/10;

      document.getElementById("mfPro").value =
        Math.round(servingValues.pro*10)/10;

      document.getElementById("mfCarb").value =
        Math.round(servingValues.carb*10)/10;

      document.getElementById("mfFat").value =
        Math.round(servingValues.fat*10)/10;

      document.getElementById("mfBarcode").value =
        /^\d{6,}$/.test(key)
          ? key
          : "";

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
  builderPrescriptionOpenKey=null;
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

let builderPrescriptionOpenKey=null;

function builderPrescriptionProfile(ex){
  const resolution=
    bpWorkoutProfileResolutionForExercise(ex);

  if (!resolution){
    return null;
  }

  return {
    profile:resolution.profile,
    options:resolution.options || {}
  };
}

function builderPositiveInteger(value){
  const number=Number(value);

  return (
    Number.isInteger(number)
    && number>0
  )
    ? number
    : null;
}

function builderPositiveNumber(value){
  const number=Number(value);

  return (
    Number.isFinite(number)
    && number>0
  )
    ? number
    : null;
}

function builderPrescriptionSource(ex){
  const prescription=
    bpWorkoutProfilePrescription(ex);

  return (
    prescription
    && typeof prescription==="object"
  )
    ? prescription
    : {};
}

function builderHasPrescription(ex){
  return (
    isPlainObject(ex && ex.prescription)
    && Object.keys(ex.prescription).length>0
  )
  || !!String((ex && ex.scheme) || "").trim();
}

function builderPrescriptionSummary(ex){
  const p=builderPrescriptionSource(ex);
  const parts=[];

  if (
    Number(p.sets)>0
    && Number(p.reps)>0
  ){
    parts.push(
      Number(p.sets)+" × "+Number(p.reps)
    );
  }else if (
    Number(p.intervals)>0
    && Number(p.durationSeconds)>0
  ){
    parts.push(
      Number(p.intervals)
      +" intervals · "
      +formatWorkoutSeconds(
        Number(p.durationSeconds)
      )
    );
  }else if (
    Number(p.rounds)>0
    && Number(p.workSeconds)>0
  ){
    parts.push(
      Number(p.rounds)
      +" rounds · "
      +formatWorkoutSeconds(
        Number(p.workSeconds)
      )
      +" work"
    );
  }else if (Number(p.durationSeconds)>0){
    parts.push(
      formatWorkoutSeconds(
        Number(p.durationSeconds)
      )
    );
  }

  if (Number(p.distance)>0){
    parts.push(
      Number(p.distance)
      +" "
      +String(p.distanceUnit || "")
    );
  }

  if (Number(p.weight)>0){
    parts.push(
      Number(p.weight)
      +" "
      +String(p.weightUnit || "lb")
    );
  }

  if (
    !parts.length
    && (
      p.notes
      || p.instructions
      || p.completionTarget
    )
  ){
    parts.push("Details set");
  }

  if (
    !parts.length
    && String((ex && ex.scheme) || "").trim()
  ){
    parts.push(
      String(ex.scheme).trim()
    );
  }

  return parts.slice(0,2).join(" · ");
}

function builderPrescriptionField(
  labelText,
  key,
  type,
  value,
  config
){
  const options=config || {};
  const field=document.createElement("label");

  field.className=
    "builder-prescription-field"
    +(options.wide ? " wide" : "");

  const label=document.createElement("span");
  label.textContent=labelText;

  let input;

  if (type==="select"){
    input=document.createElement("select");

    (options.options || []).forEach(option=>{
      const element=
        document.createElement("option");

      element.value=option;
      element.textContent=option;
      input.appendChild(element);
    });
  }else{
    input=document.createElement("input");
    input.type=type || "text";

    if (input.type==="number"){
      input.min="0";
      input.inputMode=
        options.inputMode || "numeric";

      if (options.componentSeconds){
        input.max="59";
      }
    }
  }

  input.value=
    value===undefined
    || value===null
      ? ""
      : value;

  input.dataset.builderPrescriptionField=key;

  input.setAttribute(
    "aria-label",
    labelText
  );

  if (options.required){
    input.setAttribute(
      "aria-required",
      "true"
    );
  }

  field.appendChild(label);
  field.appendChild(input);

  return field;
}

function builderPrescriptionFromWorkoutValue(
  profile,
  value
){
  const out={};

  switch(profile){
    case "timedHold":
      out.intervals=value.holds;
      out.durationSeconds=value.holdSecs;

      if (value.recSecs!==undefined){
        out.recoverySeconds=value.recSecs;
      }

      return out;

    case "steadyTimeDistance":
      out.durationSeconds=value.secs;

      if (value.dist!==undefined){
        out.distance=value.dist;
        out.distanceUnit=value.distUnit;
      }

      if (value.pace){
        out.pace=value.pace;
      }

      if (value.effort){
        out.effort=value.effort;
      }

      return out;

    case "durationActivity":
      out.durationSeconds=value.secs;

      if (value.note){
        out.notes=value.note;
      }

      return out;

    case "timedIntervals":
      out.intervals=value.intervals;
      out.durationSeconds=value.workSecs;

      if (value.recSecs!==undefined){
        out.recoverySeconds=value.recSecs;
      }

      if (value.dist!==undefined){
        out.distance=value.dist;
        out.distanceUnit=value.distUnit;
      }

      if (value.effort){
        out.effort=value.effort;
      }

      return out;

    case "distanceIntervals":
      out.intervals=value.repeats;
      out.distance=value.dist;
      out.distanceUnit=value.distUnit;

      if (value.workSecs!==undefined){
        out.durationSeconds=value.workSecs;
      }

      if (value.recSecs!==undefined){
        out.recoverySeconds=value.recSecs;
      }

      if (value.effort){
        out.effort=value.effort;
      }

      return out;

    case "loadedDistance":
      if (value.count!==undefined){
        out.trips=value.count;
      }

      out.weight=value.lbs;
      out.weightUnit="lb";
      out.distance=value.dist;
      out.distanceUnit=value.distUnit;

      if (value.secs!==undefined){
        out.durationSeconds=value.secs;
      }

      if (value.recSecs!==undefined){
        out.recoverySeconds=value.recSecs;
      }

      if (value.effort){
        out.effort=value.effort;
      }

      return out;

    case "conditioningRounds":
      out.rounds=value.rounds;
      out.workSeconds=value.workSecs;

      if (value.recSecs!==undefined){
        out.recoverySeconds=value.recSecs;
      }

      if (value.note){
        out.notes=value.note;
      }

      return out;

    case "activityNotes":
      if (value.secs!==undefined){
        out.durationSeconds=value.secs;
      }

      out.notes=value.note;

      return out;

    default:
      return null;
  }
}

function builderReadPrescription(
  panel,
  profile,
  options
){
  const read=key=>{
    const element=
      panel.querySelector(
        '[data-builder-prescription-field="'
        +key+'"]'
      );

    return element
      ? element.value
      : "";
  };

  if (
    profile==="strengthSets"
    || profile==="repetitionSets"
  ){
    const sets=
      builderPositiveInteger(
        read("sets")
      );

    const reps=
      builderPositiveInteger(
        read("reps")
      );

    if (sets===null){
      return {
        ok:false,
        field:"sets",
        message:"Enter the planned number of sets."
      };
    }

    if (reps===null){
      return {
        ok:false,
        field:"reps",
        message:"Enter the planned repetitions."
      };
    }

    const prescription={
      sets:sets,
      reps:reps
    };

    const weightValue=read("weight");

    if (weightValue!==""){
      const weight=
        builderPositiveNumber(
          weightValue
        );

      if (weight===null){
        return {
          ok:false,
          field:"weight",
          message:
            "Enter a valid target "
            +String(
              options.weightLabel || "weight"
            ).toLowerCase()
            +", or leave it blank."
        };
      }

      prescription.weight=weight;
      prescription.weightUnit="lb";
    }

    return {
      ok:true,
      value:prescription
    };
  }

  const draft=
    BP_WORKOUT_PROFILES.blank(profile);

  if (!draft){
    return {
      ok:false,
      message:
        "This exercise does not have a supported prescription editor."
    };
  }

  BP_WORKOUT_PROFILES
    .fields(profile,options)
    .forEach(spec=>{
      draft[spec.key]=read(spec.key);
    });

  const validated=
    BP_WORKOUT_PROFILES.validate(
      profile,
      draft
    );

  if (!validated.ok){
    return validated;
  }

  const prescription=
    builderPrescriptionFromWorkoutValue(
      profile,
      validated.value
    );

  if (!prescription){
    return {
      ok:false,
      message:
        "This exercise does not have a supported prescription contract."
    };
  }

  return {
    ok:true,
    value:prescription
  };
}

function buildBuilderPrescriptionEditor(
  ex,
  key
){
  const resolved=
    builderPrescriptionProfile(ex);

  if (!resolved){
    return null;
  }

  const profile=resolved.profile;
  const options=resolved.options || {};
  const panel=document.createElement("div");

  panel.className=
    "builder-prescription-editor";

  panel.dataset.builderPrescriptionEditor=
    key;

  panel.dataset.profile=profile;

  const title=
    document.createElement("div");

  title.className=
    "builder-prescription-title";

  title.textContent=
    "Workout details for "
    +String(ex.name || "exercise");

  const help=
    document.createElement("div");

  help.className=
    "builder-prescription-help";

  help.textContent=
    "Set the planned target here. "
    +"You will record what you actually complete in the workout.";

  const grid=
    document.createElement("div");

  grid.className=
    "builder-prescription-grid";

  const source=
    builderPrescriptionSource(ex);

  if (
    profile==="strengthSets"
    || profile==="repetitionSets"
  ){
    grid.appendChild(
      builderPrescriptionField(
        "Sets (required)",
        "sets",
        "number",
        source.sets || "",
        {
          required:true,
          inputMode:"numeric"
        }
      )
    );

    grid.appendChild(
      builderPrescriptionField(
        "Repetitions (required)",
        "reps",
        "number",
        source.reps || "",
        {
          required:true,
          inputMode:"numeric"
        }
      )
    );

    const weightPolicy=
      profile==="strengthSets"
        ? "optional"
        : String(
            options.weightPolicy
            || "optional"
          );

    if (weightPolicy!=="hidden"){
      grid.appendChild(
        builderPrescriptionField(
          String(
            options.weightLabel
            || "Weight"
          )
          +" in pounds (optional)",
          "weight",
          "number",
          source.weight || "",
          {
            inputMode:"decimal"
          }
        )
      );
    }
  }else{
    const draft=
      BP_WORKOUT_PROFILES.prefill(
        profile,
        source
      )
      || BP_WORKOUT_PROFILES.blank(
        profile
      );

    BP_WORKOUT_PROFILES
      .fields(profile,options)
      .forEach(spec=>{
        const wide=
          spec.type==="text"
          || spec.key==="note"
          || spec.key==="pace"
          || spec.key==="effort";

        const componentSeconds=[
          "seconds",
          "holdSeconds",
          "workSeconds",
          "durationSeconds"
        ].includes(spec.key);

        grid.appendChild(
          builderPrescriptionField(
            spec.label,
            spec.key,
            spec.type,
            draft
              ? draft[spec.key]
              : "",
            {
              options:spec.options,
              required:!!spec.required,
              inputMode:spec.inputMode,
              wide:wide,
              componentSeconds:
                componentSeconds
            }
          )
        );
      });
  }

  const error=
    document.createElement("div");

  error.className=
    "builder-prescription-error hidden";

  error.setAttribute(
    "role",
    "alert"
  );

  const actions=
    document.createElement("div");

  actions.className=
    "builder-prescription-actions";

  const apply=
    document.createElement("button");

  apply.className="btn small";
  apply.textContent="Apply details";
  apply.dataset.builderPrescriptionAction=
    "apply";

  apply.addEventListener("click",()=>{
    const result=
      builderReadPrescription(
        panel,
        profile,
        options
      );

    if (!result.ok){
      error.textContent=
        result.message
        || "Check the workout details.";

      error.classList.remove("hidden");

      if (result.field){
        const field=
          panel.querySelector(
            '[data-builder-prescription-field="'
            +result.field+'"]'
          );

        if (field && field.focus){
          field.focus();
        }
      }

      return;
    }

    ex.prescription=
      cloneJSON(result.value);

    delete ex.scheme;

    builderPrescriptionOpenKey=null;
    renderBuilder();
  });

  const clear=
    document.createElement("button");

  clear.className="btn ghost small";
  clear.textContent="Clear details";
  clear.dataset.builderPrescriptionAction=
    "clear";

  clear.addEventListener("click",()=>{
    delete ex.prescription;
    delete ex.scheme;
    builderPrescriptionOpenKey=null;
    renderBuilder();
  });

  actions.appendChild(apply);
  actions.appendChild(clear);

  panel.appendChild(title);
  panel.appendChild(help);
  panel.appendChild(grid);
  panel.appendChild(error);
  panel.appendChild(actions);

  return panel;
}

function renderBuilder(){
  const wrap=
    document.getElementById("bDays");

  wrap.innerHTML="";

  builderProg.days.forEach((day,di)=>{
    const dd=
      document.createElement("div");

    dd.className="bday";

    const head=
      document.createElement("div");

    head.className="row";
    head.style.marginBottom="10px";

    const tIn=
      document.createElement("input");

    tIn.value=day.title || "";

    tIn.setAttribute(
      "aria-label",
      "Program day "+(di+1)+" name"
    );

    tIn.placeholder=
      "Day name (e.g. Push, Lower A)";

    tIn.addEventListener("input",()=>{
      day.title=tIn.value;
    });

    head.appendChild(tIn);

    const dup=
      document.createElement("button");

    dup.className="xbtn";
    dup.textContent="⧉";
    dup.title="Duplicate day";
    dup.style.flex="0 0 auto";

    dup.addEventListener("click",()=>{
      day.title=tIn.value;

      const copy=
        JSON.parse(
          JSON.stringify(day)
        );

      copy.title=
        (copy.title || "Day")
        +" copy";

      builderProg.days.splice(
        di+1,
        0,
        copy
      );

      builderPrescriptionOpenKey=null;
      renderBuilder();
    });

    head.appendChild(dup);

    const del=
      document.createElement("button");

    del.className="xbtn";
    del.textContent="✕";
    del.title="Remove day";
    del.style.flex="0 0 auto";
    del.style.color="var(--warn)";

    del.addEventListener("click",()=>{
      builderProg.days.splice(di,1);
      builderPrescriptionOpenKey=null;
      renderBuilder();
    });

    head.appendChild(del);
    dd.appendChild(head);

    day.exercises.forEach((ex,xi)=>{
      const key=di+":"+xi;

      const block=
        document.createElement("div");

      block.className=
        "builder-exercise";

      block.dataset.exerciseName=
        ex.name;

      const row=
        document.createElement("div");

      row.className="bex bex-main";

      const originalName=
        ex.name;

      const nIn=
        document.createElement("input");

      nIn.className="bname";
      nIn.value=ex.name;
      nIn.placeholder="Exercise";

      nIn.setAttribute(
        "aria-label",
        (day.title || ("Day "+(di+1)))
        +" exercise "
        +(xi+1)
        +" name"
      );

      nIn.addEventListener("input",()=>{
        ex.name=nIn.value;
        block.dataset.exerciseName=
          nIn.value;
      });

      nIn.addEventListener("change",()=>{
        const cleanName=
          nIn.value.trim();

        if (!cleanName){
          nIn.value=originalName;
          ex.name=originalName;
          return;
        }

        ex.name=cleanName;

        if (
          normalizeExerciseName(cleanName)
          !==normalizeExerciseName(
            originalName
          )
        ){
          delete ex.prescription;
          delete ex.scheme;
          builderPrescriptionOpenKey=null;
          renderBuilder();
        }
      });

      const up=
        document.createElement("button");

      up.className="xbtn";
      up.textContent="↑";

      up.setAttribute(
        "aria-label",
        "Move "+ex.name+" up"
      );

      up.addEventListener("click",()=>{
        if (xi>0){
          day.exercises.splice(
            xi-1,
            0,
            day.exercises.splice(
              xi,
              1
            )[0]
          );

          builderPrescriptionOpenKey=null;
          renderBuilder();
        }
      });

      const dn=
        document.createElement("button");

      dn.className="xbtn";
      dn.textContent="↓";

      dn.setAttribute(
        "aria-label",
        "Move "+ex.name+" down"
      );

      dn.addEventListener("click",()=>{
        if (
          xi
          <day.exercises.length-1
        ){
          day.exercises.splice(
            xi+1,
            0,
            day.exercises.splice(
              xi,
              1
            )[0]
          );

          builderPrescriptionOpenKey=null;
          renderBuilder();
        }
      });

      const rm=
        document.createElement("button");

      rm.className="xbtn";
      rm.textContent="✕";
      rm.style.color="var(--warn)";

      rm.setAttribute(
        "aria-label",
        "Remove "+ex.name
      );

      rm.addEventListener("click",()=>{
        day.exercises.splice(xi,1);
        builderPrescriptionOpenKey=null;
        renderBuilder();
      });

      row.appendChild(nIn);
      row.appendChild(up);
      row.appendChild(dn);
      row.appendChild(rm);
      block.appendChild(row);

      const resolved=
        builderPrescriptionProfile(ex);

      const toggle=
        document.createElement("button");

      toggle.className=
        "builder-prescription-toggle";

      toggle.dataset.builderPrescriptionToggle=
        key;

      const summary=
        builderPrescriptionSummary(ex);

      if (builderHasPrescription(ex)){
        toggle.classList.add(
          "has-details"
        );

        toggle.textContent=
          "Edit workout details"
          +(summary
            ? " · "+summary
            : "");
      }else{
        toggle.textContent=
          "Set workout details";
      }

      if (!resolved){
        toggle.disabled=true;
        toggle.textContent=
          "Workout details unavailable";
      }else{
        toggle.addEventListener(
          "click",
          ()=>{
            builderPrescriptionOpenKey=
              builderPrescriptionOpenKey===key
                ? null
                : key;

            renderBuilder();
          }
        );
      }

      block.appendChild(toggle);

      if (
        builderPrescriptionOpenKey===key
      ){
        const editor=
          buildBuilderPrescriptionEditor(
            ex,
            key
          );

        if (editor){
          block.appendChild(editor);
        }
      }

      dd.appendChild(block);
    });

    const addRow=
      document.createElement("div");

    addRow.className=
      "bex bex-add";

    const search=
      document.createElement("input");

    search.type="search";
    search.className=
      "bexercise-search";

    search.placeholder=
      "Search exercises";

    search.autocomplete="off";

    search.setAttribute(
      "aria-label",
      "Search exercises for "
      +(day.title || ("Day "+(di+1)))
    );

    const sel=
      document.createElement("select");

    populateUnifiedExercisePicker(sel);

    sel.setAttribute(
      "aria-label",
      "Exercise to add to "
      +(day.title || ("Day "+(di+1)))
    );

    const custom=
      document.createElement("input");

    custom.placeholder=
      "Custom exercise name";

    custom.className=
      "bname hidden";

    custom.setAttribute(
      "aria-label",
      "Custom exercise name for "
      +(day.title || ("Day "+(di+1)))
    );

    const customShape=
      makeExerciseShapeSelect(
        "Custom exercise tracking type for "
        +(day.title || ("Day "+(di+1)))
      );

    customShape.classList.add(
      "bshape",
      "hidden"
    );

    const updateCustomVisibility=()=>{
      const isCustom=
        sel.value==="__CUSTOM__";

      custom.classList.toggle(
        "hidden",
        !isCustom
      );

      customShape.classList.toggle(
        "hidden",
        !isCustom
      );
    };

    search.addEventListener(
      "input",
      ()=>{
        populateUnifiedExercisePicker(
          sel,
          {
            query:search.value
          }
        );

        updateCustomVisibility();
      }
    );

    sel.addEventListener(
      "change",
      updateCustomVisibility
    );

    const addBtn=
      document.createElement("button");

    addBtn.className="xbtn";
    addBtn.textContent="＋ Add";

    addBtn.addEventListener("click",()=>{
      let name=sel.value;

      if (name==="__CUSTOM__"){
        const created=
          createUserExercise(
            custom.value,
            customShape.value
          );

        if (!created.ok){
          flashSave(
            created.reason,
            true
          );

          return;
        }

        name=created.entry.name;
        renderLibraryOptions();

        flashSave(
          "Custom exercise saved ✓"
        );
      }

      if (!name){
        return;
      }

      day.exercises.push({
        name:name
      });

      builderPrescriptionOpenKey=null;
      renderBuilder();
    });

    addRow.appendChild(search);
    addRow.appendChild(sel);
    addRow.appendChild(custom);
    addRow.appendChild(customShape);
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
      console.error(
        "Training-plan file rejected:",
        opened.code || "",
        opened.message || ""
      );

      errEl.textContent =
        blackpyreTrainingPlanRejectionMessage();

      errEl.classList.remove("hidden");
    }
  };

  reader.onerror = ()=>{
    errEl.textContent =
      "BlackPyre could not read that file. Choose the file again, "
      +"or create a new one with Create a plan with AI.";

    errEl.classList.remove("hidden");
  };

  reader.readAsText(file);
  e.target.value = "";
});

function nativePlatformForTrainingPlanSave(){
  const capacitor =
    typeof window!=="undefined"
      ? window.Capacitor
      : null;

  try {
    return !!(
      capacitor
      && typeof capacitor.isNativePlatform==="function"
      && capacitor.isNativePlatform()
    );
  } catch(error){
    return false;
  }
}

async function saveCurrentTrainingPlanFile(){
  const publicPlan =
    trainingPlanInterchangeFromProgram(program);

  const filename =
    blackpyreTrainingPlanFilename(program.name);

  const text =
    JSON.stringify(publicPlan,null,2);

  const native =
    nativePlatformForTrainingPlanSave();

  const capability =
    typeof nativeJsonExportCapability==="function"
      ? nativeJsonExportCapability()
      : {
          available:false,
          shareAvailable:false
        };

  if (native){
    if (
      !capability.available
      || !capability.shareAvailable
      || typeof writeNativeJson!=="function"
      || typeof shareNativeJson!=="function"
    ){
      flashSave(
        "The iOS save screen is unavailable. Try Share instead.",
        true
      );

      ackBtn(
        "exportBtn",
        "✕ Save unavailable"
      );

      return false;
    }

    try {
      flashSave(
        "Choose Save to Files and select a folder."
      );

      const nativeFile =
        await writeNativeJson(
          capability,
          filename,
          text
        );

      await shareNativeJson(
        capability,
        nativeFile,
        "Save BlackPyre training plan"
      );

      ackBtn(
        "exportBtn",
        "✓ Save completed"
      );

      return true;
    } catch(error){
      const cancelled =
        typeof isNativeShareCancellation==="function"
          ? isNativeShareCancellation(error)
          : !!(
              error
              && (
                error.name==="AbortError"
                || /cancel/i.test(
                     error.message
                       ? error.message
                       : String(error)
                   )
              )
            );

      if (cancelled){
        ackBtn(
          "exportBtn",
          "↩ Save canceled"
        );

        return false;
      }

      console.error(
        "BlackPyre training-plan save failed:",
        error
      );

      flashSave(
        "BlackPyre could not open the save screen. Try again or use Share.",
        true
      );

      ackBtn(
        "exportBtn",
        "✕ Save failed"
      );

      return false;
    }
  }

  try {
    download(
      filename,
      text
    );

    ackBtn(
      "exportBtn",
      "✓ Downloaded"
    );

    return true;
  } catch(error){
    console.error(
      "BlackPyre training-plan browser download failed:",
      error
    );

    flashSave(
      "The training plan file could not be downloaded.",
      true
    );

    ackBtn(
      "exportBtn",
      "✕ Download failed"
    );

    return false;
  }
}

document
  .getElementById("exportBtn")
  .addEventListener(
    "click",
    ()=>saveCurrentTrainingPlanFile()
  );

