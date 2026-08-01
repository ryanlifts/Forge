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
  return !!(
    isPlainObject(value)
    && value.t
    && !bpProfileSavedTypeKnown(value)
  );
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
const TRAINING_PLAN_FORMAT = "blackpyre-training-plan";
const TRAINING_PLAN_VERSION = 1;
const TRAINING_PLAN_SHAPES = [
  "lift",
  "reps",
  "timeDist",
  "carry",
  "rounds",
  "text"
];

function trainingPlanExerciseEntries(extraEntries){
  const builtIns=
    typeof EXERCISE_LIBRARY!=="undefined"
    && Array.isArray(EXERCISE_LIBRARY)
      ? EXERCISE_LIBRARY
      : [];

  const users=
    data
    && data.myExercises
    && typeof data.myExercises==="object"
      ? Object.values(data.myExercises)
      : [];

  const extras=Array.isArray(extraEntries)
    ? extraEntries
    : [];

  return builtIns.concat(users,extras);
}

function trainingPlanEntryById(id,extraEntries){
  const wanted=String(id||"").trim();

  if(!wanted)return null;

  return trainingPlanExerciseEntries(extraEntries).find(
    entry=>entry && entry.id===wanted
  )||null;
}

function trainingPlanSafeNameKey(value){
  let text=String(value==null?"":value);

  if(typeof text.normalize==="function"){
    text=text.normalize("NFKC");
  }

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

function trainingPlanEntryClaims(entry){
  return [entry.name]
    .concat(entry.aliases||[],entry.formerNames||[])
    .filter(value=>typeof value==="string" && value.trim());
}

const TRAINING_PLAN_EQUIVALENT_WORDS={
  pressdown:"pushdown",
  pressdowns:"pushdown",
  pushdowns:"pushdown"
};

const TRAINING_PLAN_REMOVABLE_QUALIFIERS=new Set([
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith",
  "rope",
  "band",
  "plate",
  "landmine",
  "trap",
  "hex",
  "safety",
  "axle",
  "swiss",
  "football",
  "ez",
  "bar",
  "seated",
  "standing",
  "lying",
  "kneeling",
  "half",
  "tall",
  "weighted",
  "loaded"
]);

const TRAINING_PLAN_EQUIPMENT_WORDS={
  barbell:"barbell",
  bar:"barbell",
  ez:"barbell",
  dumbbell:"dumbbell",
  kettlebell:"kettlebell",
  cable:"cable",
  machine:"machine",
  smith:"machine",
  rope:"cable",
  band:"bands",
  plate:"plate",
  landmine:"landmine",
  trap:"barbell",
  hex:"barbell"
};

const TRAINING_PLAN_GENERIC_MOVEMENTS=new Set([
  "curl",
  "extension",
  "press",
  "row",
  "raise",
  "squat",
  "deadlift",
  "lunge",
  "carry",
  "crunch",
  "fly",
  "pulldown",
  "pushdown"
]);

const TRAINING_PLAN_GENERIC_ANATOMY=new Set([
  "bicep",
  "tricep",
  "chest",
  "shoulder",
  "lat",
  "calf",
  "hamstring",
  "quad",
  "glute",
  "hip",
  "back",
  "ab",
  "oblique",
  "forearm"
]);

function trainingPlanSingularWord(value){
  const word=String(value||"");

  if(word.length<=3)return word;

  if(/ies$/.test(word) && !/series$/.test(word)){
    return word.slice(0,-3)+"y";
  }

  if(/(ches|shes|xes|zes|sses)$/.test(word)){
    return word.slice(0,-2);
  }

  if(
    /s$/.test(word)
    && !/(ss|us|is)$/.test(word)
  ){
    return word.slice(0,-1);
  }

  return word;
}

function trainingPlanLexicalTokens(value){
  return trainingPlanSafeNameKey(value)
    .split(" ")
    .filter(Boolean)
    .map(word=>{
      const singular=
        trainingPlanSingularWord(word);

      return (
        TRAINING_PLAN_EQUIVALENT_WORDS[
          singular
        ]
        || singular
      );
    });
}

function trainingPlanLexicalKey(value){
  return trainingPlanLexicalTokens(value)
    .join(" ");
}

function trainingPlanWordOrderKey(value){
  return trainingPlanLexicalTokens(value)
    .slice()
    .sort()
    .join(" ");
}

function trainingPlanReferenceShapeCompatible(
  entry,
  reference
){
  const requested=
    reference
    && TRAINING_PLAN_SHAPES.includes(
      reference.trackingShape
    )
      ? reference.trackingShape
      : null;

  return !requested || entry.shape===requested;
}

function trainingPlanQualifierVariants(value){
  const source=trainingPlanLexicalTokens(value);
  const variants=new Map();

  const visit=(tokens,removed)=>{
    const key=tokens.join(" ");

    if(!key)return;

    const existing=variants.get(key);

    if(!existing || removed<existing.removed){
      variants.set(key,{
        key:key,
        orderKey:tokens
          .slice()
          .sort()
          .join(" "),
        removed:removed
      });
    }

    tokens.forEach((word,index)=>{
      if(
        !TRAINING_PLAN_REMOVABLE_QUALIFIERS
          .has(word)
      ){
        return;
      }

      visit(
        tokens
          .slice(0,index)
          .concat(tokens.slice(index+1)),
        removed+1
      );
    });
  };

  visit(source,0);

  return [...variants.values()]
    .sort(
      (left,right)=>
        left.removed-right.removed
        || left.key.localeCompare(right.key)
    );
}

function trainingPlanRequestedEquipment(value){
  return new Set(
    trainingPlanLexicalTokens(value)
      .map(word=>
        TRAINING_PLAN_EQUIPMENT_WORDS[word]
      )
      .filter(Boolean)
  );
}

function trainingPlanGenericMovementMatches(
  value,
  entries,
  reference
){
  const sourceTokens=
    trainingPlanLexicalTokens(value);

  const stripped=sourceTokens.filter(
    word=>
      !TRAINING_PLAN_REMOVABLE_QUALIFIERS
        .has(word)
  );

  if(
    stripped.length!==1
    || !TRAINING_PLAN_GENERIC_MOVEMENTS
      .has(stripped[0])
  ){
    return [];
  }

  const movement=stripped[0];
  const equipment=
    trainingPlanRequestedEquipment(value);

  return entries.filter(entry=>{
    if(
      !trainingPlanReferenceShapeCompatible(
        entry,
        reference
      )
    ){
      return false;
    }

    if(equipment.size){
      const available=new Set(
        entry.equipment||[]
      );

      if(
        ![...equipment].every(
          item=>available.has(item)
        )
      ){
        return false;
      }
    }

    return trainingPlanEntryClaims(entry)
      .some(claim=>{
        const tokens=
          trainingPlanLexicalTokens(claim);

        const movements=tokens.filter(
          word=>
            TRAINING_PLAN_GENERIC_MOVEMENTS
              .has(word)
        );

        if(
          movements.length!==1
          || movements[0]!==movement
        ){
          return false;
        }

        const remaining=tokens.filter(
          word=>word!==movement
        );

        return (
          remaining.length>0
          && remaining.every(
            word=>
              TRAINING_PLAN_GENERIC_ANATOMY
                .has(word)
          )
        );
      });
  });
}

function trainingPlanUniqueEntries(entries){
  const seen=new Set();

  return entries.filter(entry=>{
    if(!entry || !entry.id || seen.has(entry.id)){
      return false;
    }

    seen.add(entry.id);
    return true;
  });
}

function trainingPlanEditDistance(leftValue,rightValue){
  const left=String(leftValue||"");
  const right=String(rightValue||"");
  const row=Array.from(
    {length:right.length+1},
    (_,index)=>index
  );

  for(let leftIndex=1;leftIndex<=left.length;leftIndex++){
    let diagonal=row[0];
    row[0]=leftIndex;

    for(let rightIndex=1;rightIndex<=right.length;rightIndex++){
      const above=row[rightIndex];

      row[rightIndex]=Math.min(
        row[rightIndex]+1,
        row[rightIndex-1]+1,
        diagonal+(
          left[leftIndex-1]===right[rightIndex-1]
            ? 0
            : 1
        )
      );

      diagonal=above;
    }
  }

  return row[right.length];
}

function rankTrainingPlanExerciseSuggestions(
  name,
  limit,
  extraEntries
){
  const query=trainingPlanSafeNameKey(name);

  if(!query)return [];

  const maximum=
    Number.isInteger(limit) && limit>0
      ? limit
      : 5;

  return trainingPlanExerciseEntries(extraEntries)
    .filter(entry=>entry && entry.deprecated!==true)
    .map(entry=>{
      let score=Infinity;

      trainingPlanEntryClaims(entry).forEach(claim=>{
        const key=trainingPlanSafeNameKey(claim);
        const distance=trainingPlanEditDistance(query,key);
        const ratio=
          distance/
          Math.max(query.length,key.length,1);

        const prefixBonus=
          key.startsWith(query)
          || query.startsWith(key)
            ? 0.12
            : 0;

        score=Math.min(
          score,
          Math.max(0,ratio-prefixBonus)
        );
      });

      return {
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        score:Number(score.toFixed(4))
      };
    })
    .sort(
      (a,b)=>
        a.score-b.score
        || a.name.localeCompare(b.name)
    )
    .slice(0,maximum);
}


function resolveTrainingPlanExercise(
  reference,
  extraEntries
){
  const ref=
    reference && typeof reference==="object"
      ? reference
      : {name:reference};

  const importedName=String(ref.name||"").trim();
  const importedId=String(
    ref.exerciseId||""
  ).trim();

  const entries=trainingPlanExerciseEntries(
    extraEntries
  );

  const warnings=[];

  const resolved=(entry,method,status)=>({
    ok:true,
    code:"resolved",
    status:status,
    method:method,
    importedName:importedName,
    importedId:importedId,
    entry:entry,
    warnings:warnings
  });

  const unresolved=(
    code,
    suggestions,
    status
  )=>({
    ok:false,
    code:code,
    status:status||"Needs selection",
    importedName:importedName,
    importedId:importedId,
    warnings:warnings,
    suggestions:suggestions||[]
  });

  if(importedId){
    const byId=trainingPlanEntryById(
      importedId,
      extraEntries
    );

    if(byId){
      if(importedName){
        const wanted=
          trainingPlanSafeNameKey(
            importedName
          );

        const accepted=
          trainingPlanEntryClaims(byId)
            .map(trainingPlanSafeNameKey);

        if(!accepted.includes(wanted)){
          return unresolved(
            "id-name-conflict",
            [{
              id:byId.id,
              name:byId.name,
              shape:byId.shape,
              score:0
            }],
            "Conflicting identity"
          );
        }
      }

      return resolved(
        byId,
        byId.id.startsWith("pending:")
          ? "pending-custom"
          : byId.id.startsWith("u:")
            ? "exact-user-id"
            : "exact-built-in-id",
        byId.id.startsWith("pending:")
          ? "New exercise"
          : "Exact match"
      );
    }

    warnings.push(
      "Unknown exercise ID was ignored; the exercise name was checked instead."
    );
  }

  if(!importedName){
    return unresolved(
      "missing-name",
      []
    );
  }

  const choose=(matches,method,status)=>{
    const unique=
      trainingPlanUniqueEntries(matches);

    if(unique.length===1){
      return resolved(
        unique[0],
        method,
        status
      );
    }

    if(unique.length>1){
      return unresolved(
        "ambiguous",
        unique.map(entry=>({
          id:entry.id,
          name:entry.name,
          shape:entry.shape,
          score:0
        }))
      );
    }

    return null;
  };

  let result=choose(
    entries.filter(
      entry=>
        String(entry.name||"").trim()
        ===importedName
    ),
    "exact-name",
    "Exact match"
  );

  if(result)return result;

  result=choose(
    entries.filter(entry=>
      (entry.aliases||[]).some(
        alias=>
          String(alias).trim()
          ===importedName
      )
    ),
    "alias",
    "Alias match"
  );

  if(result)return result;

  result=choose(
    entries.filter(entry=>
      (entry.formerNames||[]).some(
        formerName=>
          String(formerName).trim()
          ===importedName
      )
    ),
    "former-name",
    "Former-name match"
  );

  if(result)return result;

  const safeKey=
    trainingPlanSafeNameKey(importedName);

  result=choose(
    entries.filter(entry=>
      trainingPlanEntryClaims(entry).some(
        claim=>
          trainingPlanSafeNameKey(claim)
          ===safeKey
      )
    ),
    "normalized",
    "Normalized match"
  );

  if(result)return result;

  const lexicalKey=
    trainingPlanLexicalKey(importedName);

  result=choose(
    entries.filter(entry=>
      trainingPlanReferenceShapeCompatible(
        entry,
        ref
      )
      && trainingPlanEntryClaims(entry).some(
        claim=>
          trainingPlanLexicalKey(claim)
          ===lexicalKey
      )
    ),
    "language-normalized",
    "Safe name match"
  );

  if(result)return result;

  const wordOrderKey=
    trainingPlanWordOrderKey(importedName);

  result=choose(
    entries.filter(entry=>
      trainingPlanReferenceShapeCompatible(
        entry,
        ref
      )
      && trainingPlanEntryClaims(entry).some(
        claim=>
          trainingPlanWordOrderKey(claim)
          ===wordOrderKey
      )
    ),
    "word-order",
    "Safe word-order match"
  );

  if(result)return result;

  const variants=
    trainingPlanQualifierVariants(
      importedName
    ).filter(
      variant=>variant.removed>0
    );

  const removalLevels=[
    ...new Set(
      variants.map(
        variant=>variant.removed
      )
    )
  ].sort((left,right)=>left-right);

  for(const level of removalLevels){
    const levelVariants=variants.filter(
      variant=>variant.removed===level
    );

    const matches=entries.filter(entry=>
      trainingPlanReferenceShapeCompatible(
        entry,
        ref
      )
      && trainingPlanEntryClaims(entry).some(
        claim=>{
          const claimKey=
            trainingPlanLexicalKey(claim);

          const claimOrder=
            trainingPlanWordOrderKey(claim);

          return levelVariants.some(
            variant=>
              variant.key===claimKey
              || variant.orderKey
                ===claimOrder
          );
        }
      )
    );

    if(matches.length){
      return choose(
        matches,
        "qualifier-reduced",
        "Safe qualifier match"
      );
    }
  }

  result=choose(
    trainingPlanGenericMovementMatches(
      importedName,
      entries,
      ref
    ),
    "generic-movement",
    "Safe movement match"
  );

  if(result)return result;

  return unresolved(
    "unknown",
    rankTrainingPlanExerciseSuggestions(
      importedName,
      5,
      extraEntries
    )
  );
}

function inspectTrainingPlanDocument(input){
  let documentValue;

  try{
    documentValue=
      typeof input==="string"
        ? JSON.parse(input)
        : cloneJSON(input);
  }catch(error){
    return {
      ok:false,
      code:"invalid-json",
      message:"The training-plan file is not valid JSON."
    };
  }

  if(!isPlainObject(documentValue)){
    return {
      ok:false,
      code:"invalid-document",
      message:"The training-plan file must contain one JSON object."
    };
  }

  const hasFormat=
    Object.prototype.hasOwnProperty.call(
      documentValue,
      "format"
    );

  const hasVersion=
    Object.prototype.hasOwnProperty.call(
      documentValue,
      "version"
    );

  if(hasFormat || hasVersion){
    if(documentValue.format!==TRAINING_PLAN_FORMAT){
      return {
        ok:false,
        code:"wrong-format",
        message:"This is not a BlackPyre training-plan file."
      };
    }

    if(
      !Number.isInteger(documentValue.version)
      || documentValue.version<1
    ){
      return {
        ok:false,
        code:"invalid-version",
        message:"The training-plan version is invalid."
      };
    }

    if(documentValue.version>TRAINING_PLAN_VERSION){
      return {
        ok:false,
        code:"newer-version",
        newer:true,
        message:"This training plan uses a newer BlackPyre format."
      };
    }

    if(documentValue.version!==TRAINING_PLAN_VERSION){
      return {
        ok:false,
        code:"unsupported-version",
        message:"This training-plan version is unsupported."
      };
    }

    if(!isPlainObject(documentValue.program)){
      return {
        ok:false,
        code:"missing-program",
        message:"The training-plan file is missing its program object."
      };
    }

    try{
      return {
        ok:true,
        kind:"interchange-v1",
        format:documentValue.format,
        version:documentValue.version,
        sourceDocument:cloneJSON(documentValue),
        program:validateProgram(
          cloneJSON(documentValue.program)
        )
      };
    }catch(error){
      return {
        ok:false,
        code:"invalid-program",
        message:error.message
      };
    }
  }

  try{
    return {
      ok:true,
      kind:"legacy",
      format:null,
      version:null,
      sourceDocument:cloneJSON(documentValue),
      program:validateProgram(cloneJSON(documentValue))
    };
  }catch(error){
    return {
      ok:false,
      code:"invalid-legacy-program",
      message:error.message
    };
  }
}

function normalizeTrainingPlanDistanceUnit(value){
  const key=String(value||"").trim().toLowerCase();

  return ({
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
  })[key]||null;
}

function normalizeTrainingPlanWeightUnit(value){
  const key=String(value||"").trim().toLowerCase();

  return ({
    lb:"lb",
    lbs:"lb",
    pound:"lb",
    pounds:"lb",
    kg:"kg",
    kgs:"kg",
    kilogram:"kg",
    kilograms:"kg"
  })[key]||null;
}

function trainingPlanShapeLabel(shape){
  return ({
    lift:"weight and reps",
    reps:"reps",
    timeDist:"time or distance",
    carry:"weight and distance",
    rounds:"rounds or intervals",
    text:"written instructions"
  })[shape]||"the correct";
}

function trainingPlanFieldLabel(key){
  return ({
    sets:"Sets",
    reps:"Reps",
    intervals:"Intervals",
    trips:"Trips",
    rounds:"Rounds",
    durationSeconds:"Duration",
    workSeconds:"Work time",
    recoverySeconds:"Recovery time",
    restSeconds:"Rest time",
    distance:"Distance",
    distanceUnit:"Distance unit",
    weight:"Weight",
    weightUnit:"Weight unit",
    pace:"Pace",
    effort:"Effort",
    notes:"Notes",
    instructions:"Instructions",
    completionTarget:"Completion target",
    movements:"Movements"
  })[key]||String(key||"Field");
}


function sanitizeTrainingPlanPrescription(
  shape,
  prescription
){
  if(!TRAINING_PLAN_SHAPES.includes(shape)){
    return {
      ok:false,
      value:{},
      errors:[
        "BlackPyre does not recognize this tracking type."
      ],
      ignoredFields:[]
    };
  }

  if(!isPlainObject(prescription)){
    return {
      ok:false,
      value:{},
      errors:[
        "The exercise instructions are not in a usable format."
      ],
      ignoredFields:[]
    };
  }

  const source=cloneJSON(prescription);
  const normalizationErrors=[];

  if(
    shape==="timeDist"
    && Object.prototype.hasOwnProperty.call(
      source,
      "sets"
    )
  ){
    if(
      Object.prototype.hasOwnProperty.call(
        source,
        "intervals"
      )
      && Number(source.sets)
        !==Number(source.intervals)
    ){
      normalizationErrors.push(
        "Sets and intervals give different counts. Keep only one count."
      );
    }else if(
      !Object.prototype.hasOwnProperty.call(
        source,
        "intervals"
      )
    ){
      source.intervals=source.sets;
    }

    delete source.sets;
  }

  const known=[
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

  const allowed={
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

  const errors=normalizationErrors.slice();
  const value={};

  const ignoredFields=
    Object.keys(source).filter(
      key=>!known.includes(key)
    );

  Object.keys(source).forEach(key=>{
    if(
      known.includes(key)
      && !allowed.includes(key)
    ){
      errors.push(
        trainingPlanFieldLabel(key)
        +" is not allowed for "
        +trainingPlanShapeLabel(shape)
        +" tracking."
      );
    }
  });

  const has=key=>
    Object.prototype.hasOwnProperty.call(
      source,
      key
    );

  const positiveInteger=key=>{
    if(!has(key))return;

    const number=Number(source[key]);

    if(
      !Number.isInteger(number)
      || number<=0
    ){
      errors.push(
        trainingPlanFieldLabel(key)
        +" must be a positive whole number."
      );
    }else{
      value[key]=number;
    }
  };

  const positiveNumber=key=>{
    if(!has(key))return;

    const number=Number(source[key]);

    if(
      !Number.isFinite(number)
      || number<=0
    ){
      errors.push(
        trainingPlanFieldLabel(key)
        +" must be greater than zero."
      );
    }else{
      value[key]=number;
    }
  };

  const nonNegativeNumber=key=>{
    if(!has(key))return;

    const number=Number(source[key]);

    if(
      !Number.isFinite(number)
      || number<0
    ){
      errors.push(
        trainingPlanFieldLabel(key)
        +" cannot be negative."
      );
    }else{
      value[key]=number;
    }
  };

  const textValue=key=>{
    if(!has(key))return;

    if(typeof source[key]!=="string"){
      errors.push(
        trainingPlanFieldLabel(key)
        +" must be text."
      );
    }else if(source[key].trim()){
      value[key]=source[key].trim();
    }
  };

  [
    "sets",
    "intervals",
    "trips",
    "rounds"
  ].forEach(positiveInteger);

  [
    "durationSeconds",
    "workSeconds",
    "distance",
    "weight"
  ].forEach(positiveNumber);

  [
    "recoverySeconds",
    "restSeconds"
  ].forEach(nonNegativeNumber);

  [
    "pace",
    "effort",
    "notes",
    "instructions",
    "completionTarget"
  ].forEach(textValue);

  if(has("reps")){
    const reps=source.reps;

    if(
      Number.isInteger(Number(reps))
      && Number(reps)>0
    ){
      value.reps=Number(reps);
    }else if(isPlainObject(reps)){
      const minimum=Number(reps.min);
      const maximum=Number(reps.max);

      if(
        !Number.isInteger(minimum)
        || minimum<=0
        || !Number.isInteger(maximum)
        || maximum<minimum
      ){
        errors.push(
          "Reps must be a positive number or a valid minimum and maximum."
        );
      }else{
        value.reps={
          min:minimum,
          max:maximum
        };
      }
    }else{
      errors.push(
        "Reps must be a positive number or a valid minimum and maximum."
      );
    }
  }

  if(has("distanceUnit")){
    const unit=
      normalizeTrainingPlanDistanceUnit(
        source.distanceUnit
      );

    if(!unit){
      errors.push(
        "Choose a supported distance unit."
      );
    }else{
      value.distanceUnit=unit;
    }
  }

  if(
    Object.prototype.hasOwnProperty.call(
      value,
      "distance"
    )
    && !value.distanceUnit
  ){
    errors.push(
      "Add a unit for the distance."
    );
  }

  if(
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
      "Remove the distance unit or add a distance."
    );
  }

  if(has("weightUnit")){
    const unit=
      normalizeTrainingPlanWeightUnit(
        source.weightUnit
      );

    if(!unit){
      errors.push(
        "Choose pounds or kilograms for the weight."
      );
    }else{
      value.weightUnit=unit;
    }
  }

  if(
    Object.prototype.hasOwnProperty.call(
      value,
      "weight"
    )
    && !value.weightUnit
  ){
    value.weightUnit="lb";
  }

  if(
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
      "Remove the weight unit or add a weight."
    );
  }

  if(has("movements")){
    if(
      typeof source.movements==="string"
      && source.movements.trim()
    ){
      value.movements=[
        source.movements.trim()
      ];
    }else if(
      Array.isArray(source.movements)
      && source.movements.length
      && source.movements.every(
        item=>
          typeof item==="string"
          && item.trim()
      )
    ){
      value.movements=
        source.movements.map(
          item=>item.trim()
        );
    }else{
      errors.push(
        "Movements must be text or a non-empty list of text items."
      );
    }
  }

  const hasValue=key=>
    Object.prototype.hasOwnProperty.call(
      value,
      key
    );

  const meaningful={
    lift:
      hasValue("reps")
      || !!value.notes
      || !!value.effort,

    reps:
      hasValue("reps")
      || !!value.notes
      || !!value.effort,

    timeDist:
      hasValue("durationSeconds")
      || hasValue("distance")
      || !!value.notes,

    carry:
      hasValue("durationSeconds")
      || hasValue("distance")
      || !!value.notes,

    rounds:
      hasValue("rounds")
      || hasValue("workSeconds")
      || !!value.notes
      || !!value.movements,

    text:
      !!value.instructions
      || !!value.notes
      || !!value.completionTarget
  }[shape];

  if(!meaningful){
    if(
      shape==="timeDist"
      && hasValue("intervals")
    ){
      errors.push(
        "Add a duration for each interval."
      );
    }else if(shape==="timeDist"){
      errors.push(
        "Add a duration or distance."
      );
    }else{
      errors.push(
        "Add usable instructions for "
        +trainingPlanShapeLabel(shape)
        +" tracking."
      );
    }
  }

  return {
    ok:errors.length===0,
    value:value,
    errors:errors,
    ignoredFields:ignoredFields
  };
}

function trainingPlanProfileForEntry(entry){
  const resolved=
    typeof bpWorkoutProfileResolution==="function"
      ? bpWorkoutProfileResolution(entry)
      : null;

  return resolved && resolved.profile
    ? resolved.profile
    : null;
}

function trainingPlanPrescriptionAlias(
  source,
  target,
  aliases,
  errors
){
  const keys=[target].concat(aliases||[]);
  const supplied=keys.filter(key=>
    Object.prototype.hasOwnProperty.call(source,key)
  );

  if(!supplied.length)return false;

  const first=source[supplied[0]];
  const comparable=value=>{
    const number=Number(value);
    return Number.isFinite(number)
      ? "number:"+number
      : "value:"+JSON.stringify(value);
  };

  if(
    supplied.some(key=>
      comparable(source[key])!==comparable(first)
    )
  ){
    errors.push(
      supplied
        .map(trainingPlanFieldLabel)
        .join(" and ")
      +" give different values. Keep only one."
    );
  }

  source[target]=cloneJSON(first);

  supplied.forEach(key=>{
    if(key!==target)delete source[key];
  });

  return supplied[0]!==target || supplied.length>1;
}

function sanitizeTrainingPlanPrescriptionForEntry(
  entry,
  exercise
){
  const item=
    exercise && typeof exercise==="object"
      ? exercise
      : {prescription:exercise};

  const shape=
    entry && TRAINING_PLAN_SHAPES.includes(entry.shape)
      ? entry.shape
      : null;

  const profile=trainingPlanProfileForEntry(entry);
  const source=isPlainObject(item.prescription)
    ? cloneJSON(item.prescription)
    : item.prescription;

  if(!shape || !isPlainObject(source)){
    const direct=sanitizeTrainingPlanPrescription(
      shape,
      source
    );

    direct.profile=profile;
    direct.repairKind=null;
    direct.repairSeed=null;
    direct.adjusted=false;
    return direct;
  }

  const normalized=cloneJSON(source);
  const aliasErrors=[];
  let adjusted=false;
  let validationShape=shape;

  if(
    profile==="timedIntervals"
    || profile==="distanceIntervals"
  ){
    adjusted=
      trainingPlanPrescriptionAlias(
        normalized,
        "intervals",
        ["rounds","sets"],
        aliasErrors
      ) || adjusted;

    adjusted=
      trainingPlanPrescriptionAlias(
        normalized,
        "durationSeconds",
        ["workSeconds"],
        aliasErrors
      ) || adjusted;

    validationShape="timeDist";
  }else if(
    profile==="durationActivity"
    && shape==="text"
  ){
    const detailParts=[
      normalized.notes,
      normalized.instructions,
      normalized.completionTarget
    ].filter(value=>
      typeof value==="string" && value.trim()
    ).map(value=>value.trim());

    if(detailParts.length){
      normalized.notes=[...new Set(detailParts)].join(" ");
    }

    if(
      Object.prototype.hasOwnProperty.call(
        normalized,
        "instructions"
      )
      || Object.prototype.hasOwnProperty.call(
        normalized,
        "completionTarget"
      )
    ){
      adjusted=true;
    }

    delete normalized.instructions;
    delete normalized.completionTarget;
    validationShape="timeDist";
  }

  if(profile==="activityNotes"){
    const textSource=cloneJSON(normalized);
    const duration=textSource.durationSeconds;
    const hasDuration=
      Object.prototype.hasOwnProperty.call(
        textSource,
        "durationSeconds"
      );

    delete textSource.durationSeconds;

    const textResult=sanitizeTrainingPlanPrescription(
      "text",
      textSource
    );

    if(hasDuration){
      const durationResult=
        sanitizeTrainingPlanPrescription(
          "timeDist",
          {durationSeconds:duration}
        );

      if(durationResult.ok){
        textResult.value.durationSeconds=
          durationResult.value.durationSeconds;
      }else{
        textResult.errors.push(
          ...(durationResult.errors||[])
        );
      }
    }

    textResult.ok=textResult.errors.length===0;
    textResult.profile=profile;
    textResult.repairKind=null;
    textResult.repairSeed=null;
    textResult.adjusted=hasDuration;
    return textResult;
  }

  const result=sanitizeTrainingPlanPrescription(
    validationShape,
    normalized
  );

  result.errors=aliasErrors.concat(result.errors||[]);
  result.profile=profile;
  result.repairKind=null;
  result.repairSeed=null;
  result.adjusted=adjusted || validationShape!==shape;

  const hasValue=key=>
    Object.prototype.hasOwnProperty.call(
      result.value||{},
      key
    );

  const requireValue=(key,message)=>{
    if(!hasValue(key) && !result.errors.includes(message)){
      result.errors.push(message);
    }
  };

  if(profile==="timedHold"){
    requireValue(
      "intervals",
      "Add the number of holds."
    );
    if(
      !hasValue("durationSeconds")
      && !result.errors.some(message=>
        /duration/i.test(message)
      )
    ){
      result.errors.push(
        "Add a duration for each hold."
      );
    }
  }else if(profile==="distanceIntervals"){
    requireValue(
      "intervals",
      "Add the number of repeats."
    );
    requireValue(
      "distance",
      "Add the distance for each repeat."
    );
  }else if(profile==="loadedDistance"){
    requireValue(
      "weight",
      "Add the planned load."
    );
    requireValue(
      "distance",
      "Add the planned distance."
    );
  }else if(profile==="conditioningRounds"){
    requireValue(
      "rounds",
      "Add the number of rounds."
    );
    requireValue(
      "workSeconds",
      "Add the work duration for each round."
    );
  }

  if(
    profile==="timedIntervals"
    && shape==="rounds"
    && hasValue("durationSeconds")
    && !hasValue("intervals")
    && result.errors.length===0
  ){
    result.errors.push(
      "Add the number of intervals."
    );
    result.repairKind="missing-interval-count";
    result.repairSeed=cloneJSON(result.value||{});
  }

  if(
    profile==="distanceIntervals"
    && hasValue("distance")
    && !hasValue("intervals")
    && result.errors.length===0
  ){
    result.errors.push(
      "Add the number of repeats."
    );
  }

  if(
    profile==="loadedDistance"
    && hasValue("distance")
    && !hasValue("weight")
    && result.errors.length===1
    && result.errors[0]==="Add the planned load."
  ){
    result.repairKind="missing-load";
    result.repairSeed=cloneJSON(result.value||{});
  }

  result.ok=result.errors.length===0;
  return result;
}

function trainingPlanCompatibleExerciseSuggestions(
  exercise,
  currentEntry,
  extraEntries
){
  if(
    !currentEntry
    || !exercise
    || !isPlainObject(exercise.prescription)
  ){
    return [];
  }

  const entries=trainingPlanExerciseEntries(
    extraEntries
  ).filter(entry=>
    entry
    && entry.deprecated!==true
    && entry.id!==currentEntry.id
  );

  const lexical=new Map(
    rankTrainingPlanExerciseSuggestions(
      exercise.name || currentEntry.name,
      entries.length,
      extraEntries
    ).map(item=>[item.id,item.score])
  );

  const sourceEquipment=new Set(
    currentEntry.equipment||[]
  );

  const sourceTags=new Set(
    currentEntry.tags||[]
  );

  return entries
    .map(entry=>{
      const checked=
        sanitizeTrainingPlanPrescriptionForEntry(
          entry,
          exercise
        );

      if(!checked.ok)return null;

      const equipmentOverlap=(entry.equipment||[])
        .filter(value=>sourceEquipment.has(value))
        .length;

      const tagOverlap=(entry.tags||[])
        .filter(value=>sourceTags.has(value))
        .length;

      const score=
        (lexical.get(entry.id) ?? 1)
        -Math.min(equipmentOverlap,2)*0.35
        -Math.min(tagOverlap,3)*0.03
        +(
          sourceEquipment.size
          && equipmentOverlap===0
            ? 0.18
            : 0
        )
        +(entry.shape===currentEntry.shape ? -0.02 : 0);

      return {
        id:entry.id,
        name:entry.name,
        shape:entry.shape,
        score:Number(score.toFixed(4)),
        compatible:true
      };
    })
    .filter(Boolean)
    .sort((left,right)=>
      left.score-right.score
      || left.name.localeCompare(right.name)
    )
    .slice(0,5);
}

function parseLegacyTrainingPlanScheme(scheme,shape){
  const original=String(scheme||"").trim();

  if(!original){
    return {
      ok:true,
      value:{},
      warning:"No prescription was supplied."
    };
  }

  if(shape==="text"){
    return {
      ok:true,
      value:{instructions:original}
    };
  }

  let match;

  if(
    (shape==="lift" || shape==="reps")
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/i
      )
    )
  ){
    const minimum=Number(match[2]);
    const maximum=match[3]
      ? Number(match[3])
      : minimum;

    return {
      ok:true,
      value:{
        sets:Number(match[1]),
        reps:
          minimum===maximum
            ? minimum
            : {min:minimum,max:maximum}
      }
    };
  }

  if(
    shape==="timeDist"
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(sec|secs|second|seconds|min|mins|minute|minutes)$/i
      )
    )
  ){
    return {
      ok:true,
      value:{
        intervals:Number(match[1]),
        durationSeconds:
          /min/i.test(match[3])
            ? Number(match[2])*60
            : Number(match[2])
      }
    };
  }

  if(
    (shape==="timeDist" || shape==="carry")
    && (
      match=original.match(
        /^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers|kilometre|kilometres|m|meter|meters|metre|metres|ft|foot|feet)$/i
      )
    )
  ){
    const value={
      distance:Number(match[2]),
      distanceUnit:
        normalizeTrainingPlanDistanceUnit(match[3])
    };

    if(shape==="carry"){
      value.sets=Number(match[1]);
    }else{
      value.intervals=Number(match[1]);
    }

    return {
      ok:true,
      value:value
    };
  }

  if(
    shape==="rounds"
    && (
      match=original.match(/^(\d+)\s*rounds?$/i)
    )
  ){
    return {
      ok:true,
      value:{rounds:Number(match[1])}
    };
  }

  return {
    ok:true,
    value:{notes:original},
    warning:
      "The legacy scheme was preserved as notes because it could not be interpreted safely."
  };
}


function trainingPlanPrescriptionSummary(
  shape,
  prescription,
  originalScheme,
  entry
){
  const original=
    String(originalScheme||"").trim();

  const value=prescription||{};
  const hasStructured=
    Object.keys(value).length>0;

  const profile=trainingPlanProfileForEntry(entry);

  if(
    profile==="timedHold"
    || profile==="timedIntervals"
    || profile==="distanceIntervals"
  ){
    shape="timeDist";
  }else if(
    profile==="durationActivity"
    || profile==="activityNotes"
  ){
    if(value.durationSeconds){
      const parts=[
        value.durationSeconds+" sec"
      ];

      const detail=
        value.notes
        || value.instructions
        || value.completionTarget;

      if(detail)parts.push(detail);
      return parts.join(" · ");
    }
  }

  if(original && !hasStructured){
    return original;
  }

  const repsText=
    typeof value.reps==="number"
      ? String(value.reps)
      : (
          value.reps
          && typeof value.reps==="object"
            ? value.reps.min
              +"–"
              +value.reps.max
            : ""
        );

  if(
    (shape==="lift" || shape==="reps")
    && value.sets
    && repsText
  ){
    return value.sets+" × "+repsText;
  }

  if(shape==="timeDist"){
    const parts=[];

    if(value.intervals){
      parts.push(
        value.intervals
        +(value.intervals===1
          ? " interval"
          : " intervals")
      );
    }

    if(value.durationSeconds){
      parts.push(
        value.durationSeconds
        +" sec"
        +(value.intervals
          ? " each"
          : "")
      );
    }

    if(value.distance){
      parts.push(
        value.distance
        +" "
        +value.distanceUnit
        +(value.intervals
          ? " each"
          : "")
      );
    }

    if(
      value.recoverySeconds
      !==undefined
    ){
      parts.push(
        value.recoverySeconds
        +" sec recovery"
      );
    }

    if(parts.length){
      return parts.join(" · ");
    }
  }

  if(shape==="carry"){
    const count=
      value.sets||value.trips;

    const parts=[];

    if(value.weight){
      parts.push(
        value.weight
        +" "
        +(value.weightUnit||"lb")
      );
    }

    if(value.distance){
      parts.push(
        value.distance
        +" "
        +value.distanceUnit
      );
    }

    if(value.durationSeconds){
      parts.push(
        value.durationSeconds
        +" sec"
      );
    }

    if(parts.length){
      return (
        (count ? count+" × " : "")
        +parts.join(" · ")
      );
    }
  }

  if(shape==="rounds"){
    if(
      value.rounds
      && value.workSeconds
    ){
      return (
        value.rounds
        +" rounds · "
        +value.workSeconds
        +" sec work · "
        +(value.recoverySeconds||0)
        +" sec recovery"
      );
    }

    if(value.rounds){
      return value.rounds+" rounds";
    }
  }

  if(shape==="text"){
    return (
      value.instructions
      || value.completionTarget
      || value.notes
      || original
      || ""
    );
  }

  return (
    value.notes
    || value.effort
    || original
    || ""
  );
}

function prepareTrainingPlanImport(input,options){
  options=options||{};

  const extraEntries=Array.isArray(options.extraEntries)
    ? options.extraEntries
    : [];

  const parsed=inspectTrainingPlanDocument(input);

  if(!parsed.ok)return parsed;

  const review=[];
  const candidateDays=[];
  let blockers=0;
  let warningCount=0;
  const programErrors=[];

  parsed.program.days.forEach((day,dayIndex)=>{
    const candidateExercises=[];

    day.exercises.forEach((exercise,exerciseIndex)=>{
      const resolution=
        resolveTrainingPlanExercise(
          exercise,
          extraEntries
        );

      const row={
        dayId:day.id,
        dayTitle:day.title,
        dayIndex:dayIndex,
        exerciseIndex:exerciseIndex,
        importedName:String(exercise.name||""),
        importedExerciseId:String(
          exercise.exerciseId||""
        ),
        sourceExercise:cloneJSON(exercise),
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
        resolutionMethod:resolution.method||null,
        status:resolution.status,
        warnings:(resolution.warnings||[]).slice(),
        errors:[],
        suggestions:resolution.suggestions||[],
        prescription:{},
        prescriptionSummary:"",
        repairKind:null,
        repairSeed:null,
        incompatibleFields:[]
      };

      if(!resolution.ok){
        row.errors.push(
          resolution.code==="id-name-conflict"
            ? "The exercise ID and name point to different exercises."
            : "Choose a matching BlackPyre exercise, create a custom exercise, or remove this exercise."
        );

        blockers++;
        warningCount+=row.warnings.length;
        review.push(row);
        return;
      }

      const shape=resolution.entry.shape;

      if(
        Object.prototype.hasOwnProperty.call(
          exercise,
          "trackingShape"
        )
      ){
        if(
          !TRAINING_PLAN_SHAPES.includes(
            exercise.trackingShape
          )
        ){
          row.errors.push(
            "This file uses a tracking type BlackPyre does not recognize."
          );
        }else if(exercise.trackingShape!==shape){
          row.errors.push(
            "The file's tracking type conflicts with BlackPyre's "+
            trainingPlanShapeLabel(shape)+
            " tracking for "+
            resolution.entry.name+
            "."
          );
        }
      }

      let prescriptionResult;

      if(parsed.kind==="interchange-v1"){
        prescriptionResult=
          sanitizeTrainingPlanPrescriptionForEntry(
            resolution.entry,
            exercise
          );
      }else{
        prescriptionResult=
          parseLegacyTrainingPlanScheme(
            exercise.scheme,
            shape
          );
      }

      if(!prescriptionResult.ok){
        row.errors.push(
          ...(prescriptionResult.errors||[])
        );

        row.prescription=
          cloneJSON(prescriptionResult.value||{});

        const sourcePrescription=
          isPlainObject(exercise.prescription)
            ? exercise.prescription
            : {};

        row.incompatibleFields=
          Object.keys(sourcePrescription)
            .filter(key=>
              (prescriptionResult.errors||[])
                .some(message=>
                  message.indexOf(
                    trainingPlanFieldLabel(key)
                    +" is not allowed"
                  )===0
                )
            );

        const compatibleSeed=
          cloneJSON(row.prescription);

        row.incompatibleFields.forEach(
          key=>delete compatibleSeed[key]
        );

        const compatibleOnly=
          sanitizeTrainingPlanPrescriptionForEntry(
            resolution.entry,
            {prescription:compatibleSeed}
          );

        if(
          prescriptionResult.repairKind
        ){
          row.repairKind=
            prescriptionResult.repairKind;
          row.repairSeed=cloneJSON(
            prescriptionResult.repairSeed
            || row.prescription
          );
        }else if(
          shape==="timeDist"
          && Number(row.prescription.intervals)>0
          && (prescriptionResult.errors||[])
            .includes(
              "Add a duration for each interval."
            )
        ){
          row.repairKind="missing-time-duration";
          row.repairSeed=cloneJSON(
            row.prescription
          );
        }else if(
          row.incompatibleFields.length
          && compatibleOnly.ok
        ){
          row.repairKind="remove-incompatible-fields";
          row.repairSeed=cloneJSON(
            compatibleOnly.value
          );
        }
      }else{
        row.prescription=
          cloneJSON(prescriptionResult.value||{});

        if(prescriptionResult.warning){
          row.warnings.push(
            prescriptionResult.warning
          );
        }

        if(
          prescriptionResult.ignoredFields
          && prescriptionResult.ignoredFields.length
        ){
          row.warnings.push(
            "Ignored extra details: "+
            prescriptionResult.ignoredFields
              .map(trainingPlanFieldLabel)
              .join(", ")+
            "."
          );
        }
      }

      row.prescriptionSummary=
        trainingPlanPrescriptionSummary(
          shape,
          row.prescription,
          exercise.scheme,
          resolution.entry
        );

      if(row.errors.length){
        const compatibleSuggestions=
          trainingPlanCompatibleExerciseSuggestions(
            exercise,
            resolution.entry,
            extraEntries
          );

        if(compatibleSuggestions.length){
          const compatibleIds=new Set(
            compatibleSuggestions.map(item=>item.id)
          );

          row.suggestions=compatibleSuggestions.concat(
            (row.suggestions||[]).filter(item=>
              !compatibleIds.has(item.id)
            )
          );
          row.canChooseAlternative=true;
        }

        blockers++;
        warningCount+=row.warnings.length;
        review.push(row);
        return;
      }

      candidateExercises.push({
        exerciseId:resolution.entry.id,
        name:resolution.entry.name,
        trackingShape:shape,
        scheme:String(
          exercise.scheme
          || row.prescriptionSummary
          || ""
        ),
        prescription:cloneJSON(row.prescription)
      });

      warningCount+=row.warnings.length;
      review.push(row);
    });

    candidateDays.push({
      id:day.id||"D"+(dayIndex+1),
      title:day.title||"Day "+(dayIndex+1),
      exercises:candidateExercises
    });
  });

  let candidate=null;

  if(blockers===0){
    candidate={
      name:parsed.program.name||"Imported Program",
      days:candidateDays
    };

    if(
      typeof parsed.program.author==="string"
      && parsed.program.author.trim()
    ){
      candidate.author=parsed.program.author.trim();
    }

    if(
      typeof parsed.program.notes==="string"
      && parsed.program.notes.trim()
    ){
      candidate.notes=parsed.program.notes.trim();
    }

    try{
      candidate=validateProgramExerciseIdentities(
        validateProgram(candidate)
      );
    }catch(error){
      candidate=null;
      blockers++;
      programErrors.push(error.message);
    }
  }

  return {
    ok:true,
    kind:parsed.kind,
    format:parsed.format,
    version:parsed.version,
    sourceDocument:cloneJSON(parsed.sourceDocument),
    canConfirm:blockers===0,
    blockers:blockers,
    warningCount:warningCount,
    programErrors:programErrors,
    review:review,
    candidate:candidate
  };
}

function trainingPlanInterchangeFromProgram(sourceProgram){
  const source=validateProgram(
    cloneJSON(sourceProgram)
  );

  const result={
    format:TRAINING_PLAN_FORMAT,
    version:TRAINING_PLAN_VERSION,
    program:{
      name:source.name,
      days:source.days.map((day,dayIndex)=>({
        id:day.id||"D"+(dayIndex+1),
        title:day.title||"Day "+(dayIndex+1),
        exercises:day.exercises.map(exercise=>{
          const entry=
            trainingPlanEntryById(exercise.exerciseId)
            || resolveTrainingPlanExercise({
              name:exercise.name
            }).entry
            || null;

          const shape=
            entry
              ? entry.shape
              : (
                  TRAINING_PLAN_SHAPES.includes(
                    exercise.trackingShape
                  )
                    ? exercise.trackingShape
                    : "text"
                );

          const rawPrescription=
            isPlainObject(exercise.prescription)
              ? exercise.prescription
              : parseLegacyTrainingPlanScheme(
                  exercise.scheme,
                  shape
                ).value;

          const checked=
            sanitizeTrainingPlanPrescriptionForEntry(
              entry || {
                id:exercise.exerciseId || "",
                name:exercise.name || "",
                shape:shape
              },
              {
                prescription:rawPrescription,
                scheme:exercise.scheme
              }
            );

          const exported={
            name:
              entry
                ? entry.name
                : String(
                    exercise.name
                    || "Unknown exercise"
                  ),
            trackingShape:shape,
            scheme:String(
              exercise.scheme
              || trainingPlanPrescriptionSummary(
                shape,
                checked.value,
                "",
                entry
              )
            ),
            prescription:cloneJSON(
              checked.value||rawPrescription||{}
            )
          };

          if(entry){
            exported.exerciseId=entry.id;
          }

          return exported;
        })
      }))
    }
  };

  if(
    typeof source.author==="string"
    && source.author.trim()
  ){
    result.program.author=source.author.trim();
  }

  if(
    typeof source.notes==="string"
    && source.notes.trim()
  ){
    result.program.notes=source.notes.trim();
  }

  return result;
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
    const replaced=shown!==base;
    const shownEntry=exerciseDescriptor(
      shown,
      null
    );

    const descriptorInput={
      name:shown,
      scheme:replaced
        ? ""
        : raw.scheme||""
    };

    if(replaced){
      if(shownEntry && !shownEntry.legacy){
        descriptorInput.exerciseId=shownEntry.id;
      }

      descriptorInput.trackingShape=
        shownEntry.shape;
    }else{
      if(raw.exerciseId){
        descriptorInput.exerciseId=
          raw.exerciseId;
      }

      if(raw.trackingShape){
        descriptorInput.trackingShape=
          raw.trackingShape;
      }

      if(isPlainObject(raw.prescription)){
        descriptorInput.prescription=
          cloneJSON(raw.prescription);
      }
    }

    const desc=
      exerciseDescriptorForProgram(
        descriptorInput
      );

    if(replaced){
      desc.__orig=base;
    }

    if(isPlainObject(descriptorInput.prescription)){
      desc.prescription=
        cloneJSON(descriptorInput.prescription);
    }

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
function replaceActiveProgram(candidate,options){
  options=options||{};
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
  if(
    !options.skipConfirm
    && !confirm(
      'Replace current program "'
      +currentName
      +'" with "'
      +nextName
      +'"?\n\nWorkout history will stay intact.'
      +draftNote
    )
  ){
    return {ok:false,cancelled:true};
  }
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
function formatWorkoutSeconds(value){
  const number=Number(value);
  if(!(Number.isFinite(number) && number>0))return "";
  const seconds=Math.round(number);
  if(seconds%60===0)return (seconds/60)+" min";
  if(seconds>=60)return Math.floor(seconds/60)+"m "+(seconds%60)+"s";
  return seconds+" sec";
}
const BP_WORKOUT_PROFILES =
  globalThis.BLACKPYRE_WORKOUT_PROFILES || null;

const BP_FALLBACK_PROFILE_BY_SHAPE = {
  lift:"strengthSets",
  reps:"repetitionSets",
  timeDist:"steadyTimeDistance",
  carry:"loadedDistance",
  rounds:"conditioningRounds",
  text:"activityNotes"
};

function bpWorkoutProfileResolution(ex){
  if(!BP_WORKOUT_PROFILES)return null;

  let entry=null;

  if(ex && typeof ex==="object" && (ex.exerciseId || ex.id)){
    entry=exerciseById(ex.exerciseId || ex.id);
  }

  if(!entry && ex && typeof ex==="object" && ex.name){
    entry=resolveExerciseByName(ex.name);
  }

  if(!entry && typeof ex==="string"){
    entry=resolveExerciseByName(ex);
  }

  if(!entry && ex && typeof ex==="object"){
    entry={
      id:ex.exerciseId || ex.id || "",
      name:ex.name || "",
      shape:EXERCISE_SHAPES.includes(ex.shape)
        ? ex.shape
        : EXERCISE_SHAPES.includes(ex.trackingShape)
          ? ex.trackingShape
          : ""
    };
  }

  let resolved=
    entry
      ? BP_WORKOUT_PROFILES.resolve(entry)
      : null;

  if(resolved && resolved.profile){
    return Object.assign(
      {
        id:entry ? entry.id : "",
        name:entry ? entry.name : "",
        shape:entry ? entry.shape : ""
      },
      resolved
    );
  }

  const shape=
    entry && EXERCISE_SHAPES.includes(entry.shape)
      ? entry.shape
      : (
          ex && EXERCISE_SHAPES.includes(ex.shape)
            ? ex.shape
            : ex && EXERCISE_SHAPES.includes(ex.trackingShape)
              ? ex.trackingShape
            : "lift"
        );

  return {
    id:entry ? entry.id : "",
    name:entry ? entry.name : String(ex && ex.name || ""),
    shape:shape,
    profile:BP_FALLBACK_PROFILE_BY_SHAPE[shape] || "strengthSets",
    options:{}
  };
}

function bpWorkoutProfilePrescription(ex){
  if(
    ex
    && typeof ex==="object"
    && isPlainObject(ex.prescription)
  ){
    return cloneJSON(ex.prescription);
  }

  if(
    ex
    && ex.scheme
    && typeof parseLegacySchemeForShape==="function"
  ){
    const resolution=bpWorkoutProfileResolution(ex);
    const legacy=parseLegacySchemeForShape(
      ex.scheme,
      resolution ? resolution.shape : ex.shape
    );

    if(legacy && legacy.ok && isPlainObject(legacy.value)){
      return cloneJSON(legacy.value);
    }
  }

  return {};
}

function bpUnwrapProfileDraft(result){
  if(result===null || result===undefined)return null;
  if(isPlainObject(result) && result.ok===false)return null;

  if(isPlainObject(result) && isPlainObject(result.draft)){
    return cloneJSON(result.draft);
  }

  if(
    isPlainObject(result)
    && isPlainObject(result.value)
    && !hasOwn(result.value,"t")
  ){
    return cloneJSON(result.value);
  }

  if(isPlainObject(result)){
    const copy=cloneJSON(result);
    delete copy.ok;
    delete copy.warning;
    delete copy.legacy;
    delete copy.converted;
    return copy;
  }

  return null;
}

function bpBlankProfileDraft(profile,prescription){
  if(!BP_WORKOUT_PROFILES)return {};

  const source=
    isPlainObject(prescription)
      ? prescription
      : {};

  const prefilled=bpUnwrapProfileDraft(
    BP_WORKOUT_PROFILES.prefill(profile,source)
  );

  if(prefilled)return prefilled;

  return bpUnwrapProfileDraft(
    BP_WORKOUT_PROFILES.blank(profile)
  ) || {};
}

function bpStoredProfileDraft(profile,value){
  if(!BP_WORKOUT_PROFILES)return null;

  return bpUnwrapProfileDraft(
    BP_WORKOUT_PROFILES.fromStored(profile,value)
  );
}

function bpProfileIsRow(profile){
  return !!(
    BP_WORKOUT_PROFILES
    && BP_WORKOUT_PROFILES.isRowProfile(profile)
  );
}

function bpProfileValueKind(value){
  if(
    BP_WORKOUT_PROFILES
    && typeof BP_WORKOUT_PROFILES.kind==="function"
  ){
    return BP_WORKOUT_PROFILES.kind(value);
  }

  if(Array.isArray(value))return "rows";
  if(typeof value==="string")return "text";
  if(isPlainObject(value) && value.t)return value.t;
  return null;
}

function bpProfileSavedTypeKnown(value){
  const kind=bpProfileValueKind(value);

  return !!(
    kind
    && (
      kind==="rows"
      || kind==="text"
      || kind==="timeDist"
      || kind==="carry"
      || kind==="rounds"
      || (
        BP_WORKOUT_PROFILES
        && BP_WORKOUT_PROFILES.isEditableSavedType(kind)
      )
    )
  );
}

function bpProfileHasMeaningfulDraft(st){
  if(!st || !st.profile || !BP_WORKOUT_PROFILES){
    return false;
  }

  return !!BP_WORKOUT_PROFILES.hasMeaningful(
    st.profile,
    st.typed || {}
  );
}

function bpValidateProfileState(st){
  if(!st || !st.profile || !BP_WORKOUT_PROFILES){
    return {
      ok:false,
      message:"This workout card is unavailable."
    };
  }

  const result=BP_WORKOUT_PROFILES.validate(
    st.profile,
    st.typed || {}
  );

  if(!result || result.ok!==true){
    return {
      ok:false,
      field:result && (
        result.field
        || result.fieldKey
        || result.key
      ) || null,
      message:result && (
        result.message
        || result.reason
        || result.error
      ) || "Enter the required workout details."
    };
  }

  return {
    ok:true,
    value:cloneJSON(result.value)
  };
}

function bpProfileInputForExercise(exName,field){
  const saveButton=[
    ...document.querySelectorAll(
      "#exerciseInputs .saveExBtn"
    )
  ].find(button=>
    button.dataset.exercise===exName
  );

  const card=saveButton
    ? saveButton.closest(".exercise")
    : null;

  if(!card || !field)return null;

  return card.querySelector(
    '[data-profile-field="'
      +String(field).replace(/"/g,"")
      +'"]'
  );
}

function renderProfileShape(div,ex,st){
  if(!BP_WORKOUT_PROFILES){
    renderUnknownShape(div,ex,st);
    return;
  }

  BP_WORKOUT_PROFILES.appendEditor(
    div,
    ex,
    st,
    ()=>{
      st.typedTouched=true;
      st.touched=true;
      st.fields=st.typed;
      st.status="unsaved";
      markUnsavedChip(div);
      clearWorkoutError();
    }
  );
}

function formatSets(val){
  if(
    BP_WORKOUT_PROFILES
    && typeof BP_WORKOUT_PROFILES.formatStored==="function"
  ){
    const formatted=BP_WORKOUT_PROFILES.formatStored(val);
    if(formatted!==null && formatted!==undefined)return formatted;
  }

  if(Array.isArray(val)){
    return val.map(row=>
      (Number(row.w)>0 ? Number(row.w)+"×" : "")
      +Number(row.r)
      +(Number(row.w)>0 ? "" : " reps")
    ).join(", ");
  }

  if(typeof val==="string")return val;

  if(isPlainObject(val) && val.t==="timeDist"){
    return formatDuration(val.secs)
      +(Number(val.dist)>0
        ? " · "+val.dist+" "+val.distUnit
        : "");
  }

  if(isPlainObject(val) && val.t==="carry"){
    return val.lbs+" lb · "+val.dist+" "+val.distUnit;
  }

  if(isPlainObject(val) && val.t==="rounds"){
    return val.rounds+" rounds · "
      +val.workSecs+"s work / "
      +val.recSecs+"s recovery"
      +(val.note ? " · "+val.note : "");
  }

  if(isPlainObject(val) && val.t){
    return "Newer-version workout entry preserved read-only.";
  }

  if(isPlainObject(val)){
    return "Unsupported saved workout entry.";
  }

  return String(val==null ? "" : val);
}
function parseScheme(scheme){
  if(!scheme)return null; const m=String(scheme).match(/(\d+)\s*[x×]\s*(\d+)(?:\s*[-–—]\s*(\d+))?/); if(!m)return null;
  const reps=parseInt(m[2],10),topReps=m[3]?Math.max(reps,parseInt(m[3],10)):reps;
  return{sets:parseInt(m[1],10),reps:reps,topReps:topReps};
}
function autoProgressionEnabled(){return cfg.autoProgressionOn!==false;}
function isAssistedExercise(name){return /\bassist(?:ed|ance)\b/i.test(String(name||""));}
function progressionDeltaFor(ex){return isAssistedExercise(ex&&ex.name)?-5:5;}
function legacyPrefillRows(ex,lastVal){
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

function prefillRows(ex,lastRows){
  const base=legacyPrefillRows(ex,lastRows);
  const prescription=
    ex && isPlainObject(ex.prescription)
      ? ex.prescription
      : null;

  if (
    !prescription
    || !Number.isInteger(Number(prescription.sets))
    || Number(prescription.sets)<=0
    || !(Number(prescription.reps)>0)
  ){
    return base;
  }

  const count=Number(prescription.sets);
  const reps=Number(prescription.reps);
  const explicitWeight=
    Number(prescription.weight)>0
      ? Number(prescription.weight)
      : null;
  const rows=[];

  for(let index=0;index<count;index++){
    const prior=
      base.rows[index]
      || (
        Array.isArray(lastRows)
        && lastRows[index]
          ? lastRows[index]
          : null
      );

    rows.push({
      w:explicitWeight!==null
        ? explicitWeight
        : (
            prior
            && Number(prior.w)>0
              ? Number(prior.w)
              : ""
          ),
      r:reps,
      done:false,
      touched:false
    });
  }

  return {
    rows:rows,
    auto:explicitWeight!==null ? false : !!base.auto,
    autoDelta:explicitWeight!==null ? 0 : Number(base.autoDelta)||0
  };
}
function blankShapeState(ex){
  const resolution=bpWorkoutProfileResolution(ex);
  const shape=
    resolution && EXERCISE_SHAPES.includes(resolution.shape)
      ? resolution.shape
      : (
          EXERCISE_SHAPES.includes(ex.shape)
            ? ex.shape
            : "lift"
        );

  const profile=
    resolution
      ? resolution.profile
      : BP_FALLBACK_PROFILE_BY_SHAPE[shape];

  const base={
    shape:shape,
    profile:profile,
    profileOptions:cloneJSON(
      resolution && resolution.options
        ? resolution.options
        : {}
    ),
    rows:[],
    typed:{},
    typedTouched:false,
    text:"",
    textTouched:false,
    touched:false,
    fields:{},
    auto:false,
    autoDelta:0,
    saved:null,
    status:"plan",
    historyKey:null,
    readOnly:false
  };

  if(bpProfileIsRow(profile)){
    const prefilled=prefillRows(ex,null);
    base.rows=prefilled.rows;
    base.auto=prefilled.auto;
    base.autoDelta=prefilled.autoDelta;
  }else{
    base.typed=bpBlankProfileDraft(
      profile,
      bpWorkoutProfilePrescription(ex)
    );
    base.fields=base.typed;
  }

  return base;
}
function stateFromStoredValue(
  ex,
  value,
  status,
  historyKey,
  touched
){
  const st=blankShapeState(ex);
  st.status=status || "saved";
  st.saved=cloneJSON(value);
  st.historyKey=historyKey || null;

  if(
    bpProfileIsRow(st.profile)
    && Array.isArray(value)
  ){
    st.rows=value.map(row=>({
      w:hasOwn(row,"w") ? row.w : "",
      r:row.r,
      done:false,
      touched:!!touched
    }));
    return st;
  }

  if(
    st.profile
    && BP_WORKOUT_PROFILES
    && !bpProfileIsRow(st.profile)
  ){
    const restored=bpStoredProfileDraft(
      st.profile,
      value
    );

    if(restored){
      st.typed=restored;
      st.fields=st.typed;
      st.typedTouched=!!touched;
      st.touched=!!touched;
      return st;
    }
  }

  if(typeof value==="string"){
    st.shape="text";
    st.text=value;
    st.textTouched=!!touched;
    return st;
  }

  if(Array.isArray(value)){
    st.shape=ex.shape==="reps" ? "reps" : "lift";
    st.profile=st.shape==="reps"
      ? "repetitionSets"
      : "strengthSets";
    st.rows=value.map(row=>({
      w:hasOwn(row,"w") ? row.w : "",
      r:row.r,
      done:false,
      touched:!!touched
    }));
    return st;
  }

  if(isPlainObject(value) && value.t){
    st.shape="unknown";
    st.profile=null;
    st.readOnly=true;
    return st;
  }

  return st;
}
function newStateForExercise(ex,lastHit){
  const st=blankShapeState(ex);

  if(
    bpProfileIsRow(st.profile)
    && lastHit
    && Array.isArray(lastHit.value)
  ){
    const prefilled=prefillRows(ex,lastHit.value);
    st.rows=prefilled.rows;
    st.auto=prefilled.auto;
    st.autoDelta=prefilled.autoDelta;
    return st;
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
  if(st && st.readOnly){
    return validateUnknownShape(st);
  }

  if(
    st
    && st.profile
    && BP_WORKOUT_PROFILES
  ){
    if(st.profile==="strengthSets"){
      return validateLiftShape(st);
    }

    if(st.profile==="repetitionSets"){
      return validateRepsShape(st);
    }

    if(!st.typedTouched && !st.touched){
      return {ok:true,value:null};
    }

    return bpValidateProfileState(st);
  }

  const shape=
    st.shape
    || (
      st.mode==="rows"
        ? "lift"
        : st.mode==="text"
          ? "text"
          : "unknown"
    );

  return (
    SHAPE_VALIDATORS[shape]
    || validateUnknownShape
  )(st);
}
function stateHasInput(st){
  if(!st)return false;
  if(st.saved!=null)return true;

  if(
    st.profile
    && BP_WORKOUT_PROFILES
  ){
    if(bpProfileIsRow(st.profile)){
      return st.rows.some(row=>
        row.touched
        && (row.w!=="" || row.r!=="")
      );
    }

    return !!(
      st.typedTouched
      && bpProfileHasMeaningfulDraft(st)
    );
  }

  if(st.shape==="text"){
    return !!st.textTouched && !!st.text.trim();
  }

  if(st.shape==="lift" || st.shape==="reps"){
    return st.rows.some(row=>
      row.touched
      && (row.w!=="" || row.r!=="")
    );
  }

  return !!st.touched;
}
function hasUnsavedEntry(st){return st.status!=="saved"&&stateHasInput(st);}
function exerciseSaveEntryTarget(exName,st){
  if(!st)return null;

  if(bpProfileIsRow(st.profile)){
    return findSessionSetInput(
      exName,
      0,
      st.profile==="repetitionSets"
        ? "reps"
        : "weight"
    );
  }

  const firstRequired=
    BP_WORKOUT_PROFILES
    && st.profile
      ? BP_WORKOUT_PROFILES
          .fields(
            st.profile,
            st.profileOptions || {}
          )
          .find(field=>field.required)
      : null;

  return bpProfileInputForExercise(
    exName,
    firstRequired ? firstRequired.key : null
  );
}
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
  const st=sessionState[exName];
  if(!st)return {ok:false};

  const result=validateExerciseEntry(st);

  if(!result.ok){
    let target=null;

    if(result.rowIndex!=null){
      const field=
        st.profile==="repetitionSets"
          ? "reps"
          : "weight";

      target=findSessionSetInput(
        exName,
        result.rowIndex,
        field
      );
    }else if(result.field){
      target=bpProfileInputForExercise(
        exName,
        result.field
      );
    }

    showWorkoutError(
      displayExerciseName(exName)
        +" — "
        +result.message,
      target
    );

    return {ok:false};
  }

  if(result.value===null){
    const message=
      bpProfileIsRow(st.profile)
        ? "enter at least one completed set before saving. Planned values are not logged until you edit a set."
        : "enter a completed result before saving. Planned values are not logged until you enter what you completed.";

    showWorkoutError(
      displayExerciseName(exName)
        +" — "+message,
      exerciseSaveEntryTarget(exName,st)
    );

    flashSave(
      displayExerciseName(exName)
        +" — "+message,
      true
    );

    return {ok:false};
  }

  const previousSaved=
    st.saved==null
      ? null
      : cloneJSON(st.saved);
  const previousStatus=st.status;
  const previousHistoryKey=st.historyKey;

  st.saved=cloneJSON(result.value);
  st.status="saved";
  st.historyKey=historyExerciseKey(exName);

  const persisted=persistWorkoutDraft();

  if(!persisted.ok){
    st.saved=previousSaved;
    st.status=previousStatus;
    st.historyKey=previousHistoryKey;
    renderSessionInputs();

    showWorkoutError(
      persisted.cancelled
        ? "The existing saved workout draft was kept. Resume or discard it before starting a different session."
        : "This exercise could not be saved to the workout draft.",
      null
    );

    return {ok:false};
  }

  clearWorkoutError();
  renderSessionInputs();
  flashSave(displayExerciseName(exName)+" saved ✓");

  return {
    ok:true,
    value:st.saved
  };
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
function syncVisibleSessionInputs(exName){
  const name=String(exName||"");

  [...document.querySelectorAll("#exerciseInputs input")]
    .forEach(input=>{
      const label=input.getAttribute("aria-label")||"";
      const belongsToExercise=
        input.dataset.exercise===name
        ||label===name
        ||label.indexOf(name+" ")===0;

      if(
        !belongsToExercise
        ||String(input.value||"").trim()===""
      ){
        return;
      }

      input.dispatchEvent(
        new Event("input",{bubbles:true})
      );
    });
}
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

function renderLiftShape(div,ex,st){
  appendWorkoutSetRows(div,ex,st);
}
function renderRepsShape(div,ex,st){
  const policy=String(
    st.profileOptions
    && st.profileOptions.weightPolicy
    || "optional"
  );

  const label=String(
    st.profileOptions
    && st.profileOptions.weightLabel
    || "Weight"
  );

  const note=document.createElement("div");
  note.className="note shape-note";

  if(policy==="hidden"){
    note.textContent=
      "Track the repetitions completed for each set.";
  }else if(label==="Assistance"){
    note.textContent=
      "Assistance is optional. Leave it blank when no assistance was used.";
  }else{
    note.textContent=
      "Weight is optional. Leave it blank for bodyweight reps.";
  }

  div.appendChild(note);
  appendWorkoutSetRows(div,ex,st);
}
function renderTimeDistShape(div,ex,st){
  renderProfileShape(div,ex,st);
}
function renderCarryShape(div,ex,st){
  renderProfileShape(div,ex,st);
}
function renderRoundsShape(div,ex,st){
  renderProfileShape(div,ex,st);
}
function renderTextShape(div,ex,st){
  renderProfileShape(div,ex,st);
}
function renderUnknownShape(div,ex,st){
  const notice=document.createElement("div");
  notice.className="newer-shape-notice";
  notice.textContent=
    "Created by a newer BlackPyre version. "
    +"This workout value is read-only and will be preserved.";
  div.appendChild(notice);
}
const PROFILE_RENDERERS={
  strengthSets:renderLiftShape,
  repetitionSets:renderRepsShape,
  timedHold:renderProfileShape,
  steadyTimeDistance:renderProfileShape,
  durationActivity:renderProfileShape,
  timedIntervals:renderProfileShape,
  distanceIntervals:renderProfileShape,
  loadedDistance:renderProfileShape,
  conditioningRounds:renderProfileShape,
  activityNotes:renderProfileShape
};
const SHAPE_RENDERERS={
  lift:renderLiftShape,
  reps:renderRepsShape,
  timeDist:renderTimeDistShape,
  carry:renderCarryShape,
  rounds:renderRoundsShape,
  text:renderTextShape,
  unknown:renderUnknownShape
};
function renderSessionInputs(){
  renderProgramIdentity();const v=wDaySel.value,strengthBlock=document.getElementById("strengthBlock"),cardioBlock=document.getElementById("cardioBlock");
  if(v==="__CARDIO__"){strengthBlock.classList.add("hidden");cardioBlock.classList.remove("hidden");return;}
  strengthBlock.classList.remove("hidden");cardioBlock.classList.add("hidden");const last=v!=="__FREE__"?lastSessionFor(v):null,list=sessionList(),container=document.getElementById("exerciseInputs");container.innerHTML="";
  if(!list.length){container.innerHTML='<div class="note" style="margin-bottom:14px;">No exercises yet — add from the library below.</div>';return;}
  list.forEach(ex=>{
    const hit=last
  ? findHistoryValue(last.sets,ex)
  : null;

if(!sessionState[ex.name]){
  sessionState[ex.name]=newStateForExercise(ex,hit);
}

let st=sessionState[ex.name];
const expectedProfile=bpWorkoutProfileResolution(ex);

if(
  st
  && st.profile
  && expectedProfile
  && BP_WORKOUT_PROFILES
  && !BP_WORKOUT_PROFILES.compatible(
    st.profile,
    expectedProfile.profile
  )
  && st.saved==null
){
  sessionState[ex.name]=newStateForExercise(ex,hit);
  st=sessionState[ex.name];
}

const prev=hit && hit.value;
    const div=document.createElement("div");div.className="exercise";div.dataset.shape=st.shape;
    div.dataset.profile=st.profile || "";
    const head=document.createElement("div");head.className="x-head";head.innerHTML='<span><b>'+esc(ex.name)+'</b> <span class="shapeChip">'+esc(shapeGroupLabel(st.shape))+'</span>'+(ex.scheme?' <span class="scheme">· '+esc(ex.scheme)+'</span>':'')+(st.auto?' <span class="autoUp">'+(st.autoDelta<0?'−5 assist':'+5 auto')+'</span>':'')+'</span>';
    const tools=document.createElement("div");tools.className="x-tools";
    const rawExtra=extraExercises.find(item=>sessionExtraMatchesRendered(item,ex));
    if(
      st.status!=="saved"
      && prev
      && !storedValueUsesUnknownShape(prev)
    ){
      const same=document.createElement("button");same.className="xbtn";same.textContent="= last";same.addEventListener("click",()=>{sessionState[ex.name]=stateFromStoredValue(ex,prev,"unsaved",null,true);sessionState[ex.name].saved=null;renderSessionInputs();});tools.appendChild(same);}
    if(rawExtra){
      const remove=document.createElement("button");
      remove.type="button";
      remove.className="xbtn removeSessionExerciseBtn";
      remove.textContent="Remove";
      remove.setAttribute(
        "aria-label",
        "Remove "+displayExerciseName(ex.name)+" from this session"
      );
      remove.addEventListener("click",()=>{
        removeExtraExerciseFromSession(rawExtra);
      });
      tools.appendChild(remove);
    }
    const video=document.createElement("button");video.className="xbtn";video.textContent="Video";video.addEventListener("click",()=>openFormVideo(ex.name));tools.appendChild(video);
    const orig=
      ex.__orig
      ||ex.programName
      ||ex.name;

    if(
      st.status!=="saved"
      && !st.readOnly
      && typeof offerSessionReplacement==="function"
    ){
      const replace=document.createElement(
        "button"
      );

      replace.type="button";
      replace.className=
        "xbtn sessionReplaceBtn";
      replace.textContent="Replace";

      replace.setAttribute(
        "aria-label",
        "Replace "
        +displayExerciseName(ex.name)
        +" for this session"
      );

      replace.addEventListener("click",()=>{
        const existing=div.querySelector(
          ".session-replace-holder"
        );

        if(existing){
          existing.remove();
          return;
        }

        const holder=document.createElement(
          "div"
        );

        holder.className=
          "session-replace-holder";

        div.insertBefore(
          holder,
          div.children[1]||null
        );

        syncVisibleSessionInputs(ex.name);

        offerSessionReplacement(
          orig,
          ex.name,
          holder
        );
      });

      tools.appendChild(replace);
    }
    head.appendChild(tools);div.appendChild(head);
    if(prev){const line=document.createElement("div");line.className="lastLine";line.textContent="last: "+formatSets(prev);div.appendChild(line);}
    if(st.status==="saved"&&st.saved!=null){
      if(st.readOnly){renderUnknownShape(div,ex,st);container.appendChild(div);return;}
      const line=document.createElement("div");line.className="savedLine";line.innerHTML='<span class="savedChip">✓ Completed</span> <span>'+esc(formatSets(st.saved))+'</span>';
      const edit=document.createElement("button");edit.className="xbtn";edit.textContent="Edit";edit.addEventListener("click",()=>{sessionState[ex.name]=stateFromStoredValue(ex,st.saved,"unsaved",st.historyKey,true);sessionState[ex.name].saved=cloneJSON(st.saved);renderSessionInputs();});line.appendChild(edit);div.appendChild(line);container.appendChild(div);return;}
    ((st.profile && PROFILE_RENDERERS[st.profile]) || SHAPE_RENDERERS[st.shape] || renderUnknownShape)(div,ex,st);
    if(!st.readOnly){const foot=document.createElement("div");foot.className="exFoot";const saveBtn=document.createElement("button");saveBtn.className="xbtn saveExBtn";saveBtn.textContent="Save Exercise";saveBtn.dataset.exercise=ex.name;saveBtn.addEventListener("click",()=>saveExercise(ex.name));foot.appendChild(saveBtn);const chip=document.createElement("span");chip.className="unsavedChip";chip.textContent="Unsaved";if(!hasUnsavedEntry(st))chip.style.display="none";foot.appendChild(chip);div.appendChild(foot);}container.appendChild(div);
  });
}

document.getElementById("exerciseSearch").addEventListener("input",renderLibraryOptions);

function sessionExtraNameKey(name){
  return normalizeExerciseName(
    displayExerciseName(name)
  );
}
function sessionExtraMatchesRendered(raw,rendered){
  if(
    raw
    && rendered
    && raw.id
    && rendered.id
    && raw.id===rendered.id
  ){
    return true;
  }

  return !!(
    raw
    && rendered
    && sessionExtraNameKey(raw.name)
      ===sessionExtraNameKey(rendered.__orig||rendered.name)
  );
}
function removeExtraExerciseFromSession(rawEntry){
  const index=extraExercises.findIndex(item=>
    item===rawEntry
    ||(
      item
      && rawEntry
      && item.id
      && rawEntry.id
      && item.id===rawEntry.id
    )
    ||(
      item
      && rawEntry
      && sessionExtraNameKey(item.name)
        ===sessionExtraNameKey(rawEntry.name)
    )
  );

  if(index<0)return false;

  const runtime=openSessionRuntimeSnapshot();
  const removed=extraExercises[index];
  const shownName=sessionSwaps[removed.name]||removed.name;
  const removedNames=new Set([
    sessionExtraNameKey(removed.name),
    sessionExtraNameKey(shownName)
  ]);

  extraExercises.splice(index,1);
  delete sessionSwaps[removed.name];

  Object.keys(sessionState||{}).forEach(key=>{
    const state=sessionState[key];

    if(
      removedNames.has(sessionExtraNameKey(key))
      ||(
        state
        && state.historyKey
        && removedNames.has(
          sessionExtraNameKey(state.historyKey)
        )
      )
    ){
      delete sessionState[key];
    }
  });

  let draftChanged=false;

  if(
    data.activeWorkoutDraft
    && isPlainObject(data.activeWorkoutDraft.sets)
  ){
    Object.keys(data.activeWorkoutDraft.sets).forEach(key=>{
      if(removedNames.has(sessionExtraNameKey(key))){
        delete data.activeWorkoutDraft.sets[key];
        draftChanged=true;
      }
    });

    if(draftChanged){
      if(!Object.keys(data.activeWorkoutDraft.sets).length){
        data.activeWorkoutDraft=null;
      }else{
        data.activeWorkoutDraft.updatedAt=
          new Date().toISOString();
      }

      if(!save()){
        restoreOpenSessionRuntime(runtime);
        renderSessionInputs();
        flashSave(
          "The exercise could not be removed.",
          true
        );
        return false;
      }
    }
  }

  clearWorkoutError();
  renderWorkoutDraftCard();
  renderSessionInputs();
  flashSave("Exercise removed from this session ✓");
  return true;
}
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

  const entries=Object.entries(data.myExercises||{})
    .map(([id,stored])=>{
      if(!stored||typeof stored!=="object"||Array.isArray(stored))return null;
      return Object.assign({id:id},stored);
    })
    .filter(Boolean)
    .sort(
      (a,b)=>
        Number(a.deprecated)-Number(b.deprecated)
        ||a.name.localeCompare(b.name)
    );

  if(!entries.length){
    list.innerHTML='<div class="note">No user-created exercises yet.</div>';
    return;
  }

  list.innerHTML="";

  let currentSection="";

  entries.forEach(entry=>{
    const section=entry.deprecated?"Archived":"Active";

    if(section!==currentSection){
      const heading=document.createElement("div");
      heading.className="label my-exercise-section-title";
      heading.textContent=section;
      list.appendChild(heading);
      currentSection=section;
    }

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

      refreshMyExercisesManager();
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

        refreshMyExercisesManager();
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


          refreshMyExercisesManager();
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


      refreshMyExercisesManager();

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

function focusMyExercisesManager(){
  const overlay=document.getElementById("myExercisesOverlay");
  const close=document.getElementById("myExercisesCloseBtn");

  if(
    overlay
    && !overlay.classList.contains("hidden")
    && close
    && typeof close.focus==="function"
  ){
    close.focus();
  }
}
function refreshMyExercisesManager(){
  renderLibraryOptions();
  renderSessionInputs();
  if(builderProg)renderBuilder();
  focusMyExercisesManager();
}

let myExercisesReturnFocus=null;
function openMyExercisesManager(){
  const overlay=document.getElementById("myExercisesOverlay");
  const opener=document.getElementById("myExercisesManageBtn");
  const close=document.getElementById("myExercisesCloseBtn");

  if(!overlay||!opener||!close)return;

  myExercisesReturnFocus=document.activeElement;
  renderMyExercisesManager();
  overlay.classList.remove("hidden");
  opener.setAttribute("aria-expanded","true");
  lockScroll();
  close.focus();
}
function closeMyExercisesManager(){
  const overlay=document.getElementById("myExercisesOverlay");
  const opener=document.getElementById("myExercisesManageBtn");

  if(!overlay||overlay.classList.contains("hidden"))return;

  overlay.classList.add("hidden");
  if(opener)opener.setAttribute("aria-expanded","false");
  unlockScroll();

  const target=
    myExercisesReturnFocus
    && typeof myExercisesReturnFocus.focus==="function"
      ?myExercisesReturnFocus
      :opener;

  myExercisesReturnFocus=null;
  if(target&&typeof target.focus==="function")target.focus();
}
function handleMyExercisesManagerKeydown(event){
  const overlay=document.getElementById("myExercisesOverlay");

  if(!overlay||overlay.classList.contains("hidden"))return;

  if(event.key==="Escape"){
    event.preventDefault();
    closeMyExercisesManager();
    return;
  }

  if(event.key!=="Tab")return;

  const focusable=[...overlay.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )];

  if(!focusable.length)return;

  const first=focusable[0];
  const last=focusable[focusable.length-1];

  if(event.shiftKey&&document.activeElement===first){
    event.preventDefault();
    last.focus();
  }else if(!event.shiftKey&&document.activeElement===last){
    event.preventDefault();
    first.focus();
  }
}

document.getElementById("myExercisesManageBtn").addEventListener(
  "click",
  openMyExercisesManager
);
document.getElementById("myExercisesCloseBtn").addEventListener(
  "click",
  closeMyExercisesManager
);
document.getElementById("myExercisesOverlay").addEventListener(
  "click",
  event=>{
    if(event.target===event.currentTarget)closeMyExercisesManager();
  }
);
document.getElementById("myExercisesOverlay").addEventListener(
  "keydown",
  handleMyExercisesManagerKeydown
);

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
  el.innerHTML=order.map(key=>{const list=groups[key],label=months[Number(key.slice(5,7))-1]+" "+key.slice(0,4),open=key===cur?" open":"";const body=list.map(s=>{const dayObj=program.days.find(p=>p.id===s.day),title=s.title||(dayObj?dayObj.title:s.day);const setsHTML=Object.keys(s.sets).map(name=>{const value=s.sets[name],unknown=storedValueUsesUnknownShape(value);return'<div>'+esc(name)+': <span style="color:var(--text)">'+esc(formatSets(value))+'</span>'+(unknown?'<div class="newer-inline">Newer-version value preserved read-only.</div>':'')+'</div>';}).join("");return'<div style="padding:14px 16px; border-bottom:1px solid var(--border); font-size:12px;"><div style="display:flex; justify-content:space-between;"><span style="font-weight:600; color:var(--ember);">'+fmtDate(s.date)+' — '+esc(title)+'</span><button class="del edtWork" data-i="'+s.idx+'" aria-label="Edit" style="color:var(--dim); margin-right:2px;">✎</button><button class="del delWork" data-i="'+s.idx+'" aria-label="Delete">✕</button></div><div style="color:var(--dim); margin-top:6px; line-height:1.7;">'+setsHTML+(s.notes?'<div style="color:var(--ember); margin-top:3px;">Note: '+esc(s.notes)+'</div>':'')+'</div></div>';}).join("");return'<details'+open+' style="border-bottom:1px solid var(--border);"><summary style="padding:12px 16px; cursor:pointer; font-family:\'Oswald\',sans-serif; font-weight:600; font-size:13px; letter-spacing:.05em; text-transform:uppercase; color:var(--text); list-style:none; display:flex; justify-content:space-between;"><span>'+label+'</span><span style="color:var(--dim); font-size:11px;">'+list.length+' session'+(list.length===1?'':'s')+'</span></summary>'+body+'</details>';}).join("");
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

function builderTrackingPresentation(ex){
  const entry=exerciseDescriptorForProgram(ex);

  const shape=EXERCISE_SHAPES.includes(entry.shape)
    ? entry.shape
    : "text";

  const presentations={
    lift:{
      label:"Weight + reps",
      placeholder:"e.g. 4 × 5 at 185 lb"
    },
    reps:{
      label:"Reps",
      placeholder:"e.g. 3 × 12"
    },
    timeDist:{
      label:"Time + distance",
      placeholder:"e.g. 20 min or 5 km"
    },
    carry:{
      label:"Weight + distance",
      placeholder:"e.g. 4 × 40 yd at 80 lb"
    },
    rounds:{
      label:"Rounds + work/rest",
      placeholder:"e.g. 8 rounds: 20 sec / 40 sec"
    },
    text:{
      label:"Notes",
      placeholder:"e.g. technique or mobility notes"
    }
  };

  return {
    shape:shape,
    label:presentations[shape].label,
    placeholder:presentations[shape].placeholder
  };
}

let builderPrescriptionOpenKey=null;

function builderPrescriptionProfile(ex){
  const resolution=
    bpWorkoutProfileResolution(ex);

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

  return Number.isInteger(number) && number>0
    ? number
    : null;
}

function builderPositiveNumber(value){
  const number=Number(value);

  return Number.isFinite(number) && number>0
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

      row.className=
        "bex bex-main builder-exercise-row";

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
        delete ex.exerciseId;
        delete ex.trackingShape;
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

      const identity=
        document.createElement("div");

      identity.className=
        "builder-exercise-identity";

      const trackingChip=
        document.createElement("span");

      trackingChip.className=
        "builder-tracking-chip";

      const presentation=
        builderTrackingPresentation(ex);

      trackingChip.dataset.trackingShape=
        presentation.shape;

      trackingChip.textContent=
        "Tracks: "+presentation.label;

      identity.appendChild(nIn);
      identity.appendChild(trackingChip);

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

      row.appendChild(identity);
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
      "bex bex-add builder-add-exercise";

    const search=
      document.createElement("input");

    search.type="search";
    search.className=
      "bexercise-search builderExerciseSearch";

    search.placeholder=
      "Search name, alias, former name, tag, muscle, or equipment";

    search.autocomplete="off";

    search.setAttribute(
      "aria-label",
      "Search exercises for "
      +(day.title || ("Day "+(di+1)))
    );

    const sel=
      document.createElement("select");

    sel.className="builderExerciseSelect";

    populateExerciseSelect(sel,"",true);

    sel.setAttribute(
      "aria-label",
      "Exercise to add to "
      +(day.title || ("Day "+(di+1)))
    );

    const custom=
      document.createElement("input");

    custom.placeholder=
      "New exercise name";

    custom.className=
      "bname builderExerciseCustomName hidden";

    custom.setAttribute(
      "aria-label",
      "Custom exercise name for "
      +(day.title || ("Day "+(di+1)))
    );

    const customShape=
      document.createElement("select");

    customShape.className=
      "bshape builderExerciseCustomShape hidden";

    customShape.setAttribute(
      "aria-label",
      "Custom exercise tracking type for "
      +(day.title || ("Day "+(di+1)))
    );

    EXERCISE_SHAPES.forEach(shape=>{
      const option=document.createElement("option");
      option.value=shape;
      option.textContent=shapeGroupLabel(shape);
      customShape.appendChild(option);
    });

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
        populateExerciseSelect(
          sel,
          search.value,
          true
        );

        custom.classList.add("hidden");
        customShape.classList.add("hidden");
      }
    );

    sel.addEventListener(
      "change",
      updateCustomVisibility
    );

    const addBtn=
      document.createElement("button");

    addBtn.className=
      "xbtn builderExerciseAddButton";
    addBtn.textContent="＋ Add";

    addBtn.addEventListener("click",()=>{
      const err=document.getElementById("bErr");
      let entry=null;

      if (sel.value==="__CUSTOM__"){
        if(dayContainsExerciseIdentity(day,custom.value)){
          err.textContent=
            String(custom.value||"Exercise").trim()
            +" is already in this program day.";
          err.classList.remove("hidden");
          return;
        }

        const created=
          createUserExercise(
            custom.value,
            customShape.value
          );

        if (!created.ok){
          err.textContent=created.reason;
          err.classList.remove("hidden");
          return;
        }

        entry=created.entry;
        renderLibraryOptions();

        flashSave(
          "Custom exercise saved ✓"
        );
      }else{
        entry=exerciseById(sel.value);
      }

      if (!entry)return;

      if(dayContainsExerciseIdentity(day,entry)){
        err.textContent=
          entry.name+" is already in this program day.";
        err.classList.remove("hidden");
        return;
      }

      day.exercises.push({
        exerciseId:entry.id,
        name:entry.name,
        trackingShape:entry.shape
      });

      err.textContent="";
      err.classList.add("hidden");
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

// ---- program import/export ----
let trainingPlanReviewState=null;

function trainingPlanReviewIsOpen(){
  const overlay=document.getElementById(
    "trainingPlanReviewOverlay"
  );

  return !!(
    overlay
    && !overlay.classList.contains("hidden")
  );
}

function setTrainingPlanReviewError(message){
  const err=document.getElementById(
    "trainingPlanReviewErr"
  );

  if(!err)return;

  if(message){
    err.textContent=message;
    err.classList.remove("hidden");
  }else{
    err.textContent="";
    err.classList.add("hidden");
  }
}

function closeTrainingPlanReview(options){
  options=options||{};

  const overlay=document.getElementById(
    "trainingPlanReviewOverlay"
  );

  if(overlay){
    overlay.classList.add("hidden");
  }

  document.body.classList.remove(
    "training-plan-review-open"
  );

  trainingPlanReviewState=null;
  setTrainingPlanReviewError("");

  if(!options.skipFocus){
    const importButton=document.getElementById(
      "importBtn"
    );

    if(importButton && importButton.focus){
      importButton.focus();
    }
  }
}

function trainingPlanReviewMessage(
  container,
  message,
  kind
){
  const line=document.createElement("div");

  line.className=
    "training-plan-review-message"
    +(kind ? " is-"+kind : "");

  line.textContent=message;
  container.appendChild(line);
}

function trainingPlanReviewSourceProgram(state){
  if(!state || !state.sourceDocument){
    return null;
  }

  return state.sourceDocument.format
    ===TRAINING_PLAN_FORMAT
      ? state.sourceDocument.program
      : state.sourceDocument;
}

function trainingPlanReviewSourceExercise(row){
  const state=trainingPlanReviewState;
  const sourceProgram=
    trainingPlanReviewSourceProgram(state);

  if(
    !sourceProgram
    || !Array.isArray(sourceProgram.days)
    || !row
  ){
    return null;
  }

  const day=sourceProgram.days[row.dayIndex];

  if(!day || !Array.isArray(day.exercises)){
    return null;
  }

  return day.exercises[row.exerciseIndex]||null;
}

function trainingPlanReviewExtraEntries(state){
  return Object.values(
    state && state.pendingEntries
      ? state.pendingEntries
      : {}
  );
}

function reprepareTrainingPlanReview(){
  const state=trainingPlanReviewState;

  if(!state || !state.sourceDocument){
    return {
      ok:false,
      reason:"The import review is no longer available."
    };
  }

  const prepared=prepareTrainingPlanImport(
    state.sourceDocument,
    {
      extraEntries:
        trainingPlanReviewExtraEntries(state)
    }
  );

  if(!prepared.ok){
    return {
      ok:false,
      reason:
        prepared.message
        || "The training program could not be reviewed."
    };
  }

  state.prepared=prepared;
  state.sourceDocument=cloneJSON(
    prepared.sourceDocument
  );

  renderTrainingPlanReview();

  return {
    ok:true,
    prepared:prepared
  };
}

function trainingPlanReviewPendingNameIssue(
  name,
  ignoreId
){
  const clean=String(name||"")
    .trim()
    .replace(/\s+/g," ");

  if(!clean){
    return "Type an exercise name.";
  }

  const reservation=
    userExerciseNameReservation(clean);

  if(reservation){
    return reservation;
  }

  const key=trainingPlanSafeNameKey(clean);

  const owner=trainingPlanExerciseEntries(
    trainingPlanReviewExtraEntries(
      trainingPlanReviewState
    )
  ).find(entry=>
    entry
    && entry.id!==ignoreId
    && trainingPlanEntryClaims(entry).some(
      claim=>
        trainingPlanSafeNameKey(claim)===key
    )
  );

  if(owner){
    return (
      '"'
      +clean
      +'" conflicts with '
      +owner.name
      +'.'
    );
  }

  return null;
}

function pendingTrainingPlanExercise(
  id,
  name,
  shape
){
  const clean=String(name||"")
    .trim()
    .replace(/\s+/g," ");

  const bodyweight=shape==="reps";

  return {
    id:id,
    name:clean,
    shape:shape,
    tags:
      shape==="timeDist"
        ? ["cardio"]
        : shape==="carry"
          ? ["strength","carry"]
          : shape==="rounds"
            ? ["conditioning"]
            : shape==="text"
              ? []
              : ["strength"],
    aliases:[],
    formerNames:[],
    muscles:{
      primary:["full-body"],
      secondary:[]
    },
    equipment:[
      bodyweight
        ? "bodyweight"
        : "other"
    ],
    unilateral:false,
    bodyweight:bodyweight,
    deprecated:false
  };
}

function clearPendingTrainingPlanExercise(
  sourceExercise
){
  if(
    !trainingPlanReviewState
    || !sourceExercise
  ){
    return;
  }

  const id=String(
    sourceExercise.exerciseId||""
  );

  if(
    id.startsWith("pending:")
    && trainingPlanReviewState.pendingEntries
  ){
    delete trainingPlanReviewState
      .pendingEntries[id];
  }
}

function matchTrainingPlanReviewExercise(
  row,
  entryId
){
  const state=trainingPlanReviewState;
  const sourceExercise=
    trainingPlanReviewSourceExercise(row);
  const entry=exerciseById(entryId);

  if(!state || !sourceExercise || !entry){
    return {
      ok:false,
      reason:"Choose a BlackPyre exercise."
    };
  }

  const previousSource=cloneJSON(
    state.sourceDocument
  );
  const previousPending=cloneJSON(
    state.pendingEntries||{}
  );

  clearPendingTrainingPlanExercise(
    sourceExercise
  );

  sourceExercise.exerciseId=entry.id;
  sourceExercise.name=entry.name;
  sourceExercise.trackingShape=entry.shape;

  const refreshed=
    reprepareTrainingPlanReview();

  if(!refreshed.ok){
    state.sourceDocument=previousSource;
    state.pendingEntries=previousPending;
    reprepareTrainingPlanReview();
    return refreshed;
  }

  return {
    ok:true,
    entry:entry,
    prepared:refreshed.prepared
  };
}

function createPendingTrainingPlanExercise(
  row,
  name,
  shape
){
  const state=trainingPlanReviewState;
  const sourceExercise=
    trainingPlanReviewSourceExercise(row);

  if(!state || !sourceExercise){
    return {
      ok:false,
      reason:"The imported exercise is no longer available."
    };
  }

  if(!TRAINING_PLAN_SHAPES.includes(shape)){
    return {
      ok:false,
      reason:"Choose a tracking type."
    };
  }

  const currentId=String(
    sourceExercise.exerciseId||""
  );

  const issue=
    trainingPlanReviewPendingNameIssue(
      name,
      currentId.startsWith("pending:")
        ? currentId
        : null
    );

  if(issue){
    return {
      ok:false,
      reason:issue
    };
  }

  const previousSource=cloneJSON(
    state.sourceDocument
  );
  const previousPending=cloneJSON(
    state.pendingEntries||{}
  );

  clearPendingTrainingPlanExercise(
    sourceExercise
  );

  state.pendingSequence=
    Number(state.pendingSequence||0)+1;

  const pendingId=
    "pending:"
    +state.pendingSequence;

  const entry=pendingTrainingPlanExercise(
    pendingId,
    name,
    shape
  );

  state.pendingEntries[pendingId]=entry;

  sourceExercise.exerciseId=pendingId;
  sourceExercise.name=entry.name;
  sourceExercise.trackingShape=entry.shape;

  const refreshed=
    reprepareTrainingPlanReview();

  if(!refreshed.ok){
    state.sourceDocument=previousSource;
    state.pendingEntries=previousPending;
    reprepareTrainingPlanReview();
    return refreshed;
  }

  return {
    ok:true,
    entry:entry,
    prepared:refreshed.prepared
  };
}

function removeTrainingPlanReviewExercise(row){
  const state=trainingPlanReviewState;
  const sourceProgram=
    trainingPlanReviewSourceProgram(state);

  if(
    !state
    || !sourceProgram
    || !row
    || !sourceProgram.days[row.dayIndex]
    || !Array.isArray(
      sourceProgram.days[row.dayIndex].exercises
    )
  ){
    return {
      ok:false,
      reason:"The imported exercise is no longer available."
    };
  }

  const previousSource=cloneJSON(
    state.sourceDocument
  );
  const previousPending=cloneJSON(
    state.pendingEntries||{}
  );
  const previousRemoved=cloneJSON(
    state.removed||[]
  );

  const day=
    sourceProgram.days[row.dayIndex];

  const sourceExercise=
    day.exercises[row.exerciseIndex];

  if(!sourceExercise){
    return {
      ok:false,
      reason:"The imported exercise is no longer available."
    };
  }

  clearPendingTrainingPlanExercise(
    sourceExercise
  );

  state.removed.push({
    name:
      row.importedName
      || sourceExercise.name
      || "Exercise",
    dayTitle:
      row.dayTitle
      || day.title
      || day.id
      || "Program day"
  });

  day.exercises.splice(
    row.exerciseIndex,
    1
  );

  const refreshed=
    reprepareTrainingPlanReview();

  if(!refreshed.ok){
    state.sourceDocument=previousSource;
    state.pendingEntries=previousPending;
    state.removed=previousRemoved;
    reprepareTrainingPlanReview();
    return refreshed;
  }

  return {
    ok:true,
    prepared:refreshed.prepared
  };
}


function populateTrainingPlanReviewSelect(
  select,
  query,
  suggestions
){
  populateExerciseSelect(
    select,
    query,
    false
  );

  if(
    !String(query||"").trim()
    && Array.isArray(suggestions)
    && suggestions.length
  ){
    const likely=suggestions
      .map(item=>
        item && item.id
          ? exerciseById(item.id)
          : null
      )
      .filter(Boolean)
      .filter(
        (entry,index,array)=>
          array.findIndex(
            candidate=>
              candidate.id===entry.id
          )===index
      );

    const likelyIds=new Set(
      likely.map(entry=>entry.id)
    );

    [
      ...select.querySelectorAll("option")
    ].forEach(option=>{
      if(likelyIds.has(option.value)){
        option.remove();
      }
    });

    [
      ...select.querySelectorAll("optgroup")
    ].forEach(group=>{
      if(!group.querySelector("option")){
        group.remove();
      }
    });

    if(likely.length){
      const group=
        document.createElement(
          "optgroup"
        );

      group.label=suggestions.some(item=>
        item && item.compatible===true
      )
        ? "Compatible matches"
        : "Likely matches";

      likely.forEach(entry=>{
        const option=
          document.createElement(
            "option"
          );

        option.value=entry.id;
        option.textContent=entry.name;
        group.appendChild(option);
      });

      select.insertBefore(
        group,
        select.firstChild
      );
    }
  }

  const choose=document.createElement(
    "option"
  );

  choose.value="";
  choose.textContent="Choose an exercise";
  choose.selected=true;

  select.insertBefore(
    choose,
    select.firstChild
  );

  select.value="";
}

function trainingPlanReviewInlineError(
  container,
  message
){
  container.textContent=message||"";
  container.classList.toggle(
    "hidden",
    !message
  );
}

function applyTrainingPlanPrescriptionRepair(
  row,
  prescription
){
  const state=trainingPlanReviewState;
  const sourceExercise=
    trainingPlanReviewSourceExercise(row);

  if(
    !state
    || !sourceExercise
    || !isPlainObject(prescription)
  ){
    return {
      ok:false,
      reason:"These workout details are no longer available."
    };
  }

  const previousSource=cloneJSON(
    state.sourceDocument
  );

  sourceExercise.prescription=
    cloneJSON(prescription);

  delete sourceExercise.scheme;

  if(row.exerciseId){
    sourceExercise.exerciseId=row.exerciseId;
  }

  if(row.canonicalName){
    sourceExercise.name=row.canonicalName;
  }

  if(row.shape){
    sourceExercise.trackingShape=row.shape;
  }

  const refreshed=reprepareTrainingPlanReview();

  const repairedRow=
    refreshed.ok
      ? (refreshed.prepared.review||[]).find(
          item=>
            item.dayIndex===row.dayIndex
            && item.exerciseIndex===row.exerciseIndex
        )
      : null;

  if(
    !refreshed.ok
    || !repairedRow
    || (repairedRow.errors||[]).length
  ){
    state.sourceDocument=previousSource;
    reprepareTrainingPlanReview();

    return {
      ok:false,
      reason:
        refreshed.reason
        || "These workout details still need attention."
    };
  }

  return {
    ok:true,
    prepared:refreshed.prepared
  };
}

function buildTrainingPlanPrescriptionRepair(row){
  if(
    !row
    || !row.exerciseId
    || !row.repairKind
  ){
    return null;
  }

  const shell=document.createElement("div");
  shell.className="training-plan-prescription-editor";

  const title=document.createElement("div");
  title.className="training-plan-prescription-title";

  const help=document.createElement("div");
  help.className="training-plan-prescription-help";

  const error=document.createElement("div");
  error.className=
    "training-plan-review-inline-error hidden";

  if(row.repairKind==="missing-time-duration"){
    title.textContent=
      /^plank$/i.test(
        String(row.canonicalName||"")
      )
        ? "How long is each plank?"
        : "Add the missing interval duration";

    help.textContent=
      "The exercise match is correct. Add the planned time so BlackPyre can import it safely.";

    const grid=document.createElement("div");
    grid.className="builder-prescription-grid";

    const seed=cloneJSON(row.repairSeed||{});

    const field=(labelText,key,value,max)=>{
      const label=document.createElement("label");
      label.className="builder-prescription-field";

      const text=document.createElement("span");
      text.textContent=labelText;

      const input=document.createElement("input");
      input.type="number";
      input.inputMode="numeric";
      input.min="0";
      input.step="1";
      input.value=value==null ? "" : String(value);
      input.dataset.prescriptionRepairField=key;
      input.setAttribute("aria-label",labelText);

      if(max!=null)input.max=String(max);

      label.appendChild(text);
      label.appendChild(input);
      grid.appendChild(label);

      return input;
    };

    const intervals=field(
      "Number of sets",
      "intervals",
      seed.intervals||""
    );

    const minutes=field(
      "Minutes per set",
      "minutes",
      ""
    );

    const seconds=field(
      "Seconds per set",
      "seconds",
      "",
      59
    );

    const apply=document.createElement("button");
    apply.type="button";
    apply.className="btn ghost small";
    apply.textContent="Use this duration";
    apply.dataset.prescriptionRepairAction="duration";

    apply.addEventListener("click",()=>{
      const count=Number(intervals.value);
      const minuteValue=Number(minutes.value||0);
      const secondValue=Number(seconds.value||0);

      if(!Number.isInteger(count)||count<=0){
        trainingPlanReviewInlineError(
          error,
          "Enter the number of sets."
        );
        intervals.focus();
        return;
      }

      if(
        !Number.isInteger(minuteValue)
        || minuteValue<0
        || !Number.isInteger(secondValue)
        || secondValue<0
        || secondValue>59
      ){
        trainingPlanReviewInlineError(
          error,
          "Enter whole minutes and seconds from 0 through 59."
        );
        return;
      }

      const total=minuteValue*60+secondValue;

      if(total<=0){
        trainingPlanReviewInlineError(
          error,
          "Enter the time for each set."
        );
        minutes.focus();
        return;
      }

      const value=cloneJSON(seed);
      value.intervals=count;
      value.durationSeconds=total;

      const checked=
        sanitizeTrainingPlanPrescriptionForEntry(
          trainingPlanEntryById(row.exerciseId),
          {prescription:value}
        );

      if(!checked.ok){
        trainingPlanReviewInlineError(
          error,
          (checked.errors||[]).join(" ")
        );
        return;
      }

      const result=
        applyTrainingPlanPrescriptionRepair(
          row,
          checked.value
        );

      if(!result.ok){
        trainingPlanReviewInlineError(
          error,
          result.reason
        );
      }
    });

    shell.appendChild(title);
    shell.appendChild(help);
    shell.appendChild(grid);
    shell.appendChild(apply);
    shell.appendChild(error);

    return shell;
  }

  if(row.repairKind==="missing-interval-count"){
    title.textContent="How many intervals?";

    const duration=Number(
      row.repairSeed
      && row.repairSeed.durationSeconds
    );

    help.textContent=
      "BlackPyre matched this to an interval exercise. "
      +(duration>0
        ? duration+" seconds will be used for each interval. "
        : "Add the interval count. ")
      +"If the imported duration is for the whole activity, choose a compatible steady exercise below instead.";

    const label=document.createElement("label");
    label.className="builder-prescription-field";

    const labelText=document.createElement("span");
    labelText.textContent="Number of intervals";

    const input=document.createElement("input");
    input.type="number";
    input.inputMode="numeric";
    input.min="1";
    input.step="1";
    input.dataset.prescriptionRepairField="intervals";
    input.setAttribute(
      "aria-label",
      "Number of intervals"
    );

    label.appendChild(labelText);
    label.appendChild(input);

    const apply=document.createElement("button");
    apply.type="button";
    apply.className="btn ghost small";
    apply.textContent="Use interval count";
    apply.dataset.prescriptionRepairAction=
      "interval-count";

    apply.addEventListener("click",()=>{
      const count=Number(input.value);

      if(!Number.isInteger(count)||count<=0){
        trainingPlanReviewInlineError(
          error,
          "Enter the number of intervals."
        );
        input.focus();
        return;
      }

      const value=cloneJSON(row.repairSeed||{});
      value.intervals=count;

      const checked=
        sanitizeTrainingPlanPrescriptionForEntry(
          trainingPlanEntryById(row.exerciseId),
          {prescription:value}
        );

      if(!checked.ok){
        trainingPlanReviewInlineError(
          error,
          (checked.errors||[]).join(" ")
        );
        return;
      }

      const result=
        applyTrainingPlanPrescriptionRepair(
          row,
          checked.value
        );

      if(!result.ok){
        trainingPlanReviewInlineError(
          error,
          result.reason
        );
      }
    });

    shell.appendChild(title);
    shell.appendChild(help);
    shell.appendChild(label);
    shell.appendChild(apply);
    shell.appendChild(error);

    return shell;
  }

  if(row.repairKind==="missing-load"){
    title.textContent="What load is planned?";

    const seed=cloneJSON(row.repairSeed||{});
    const count=seed.trips||seed.sets;
    const distance=Number(seed.distance);
    const distanceUnit=String(
      seed.distanceUnit||""
    ).trim();
    const details=[];

    if(count)details.push(count+" trips");
    if(distance>0){
      details.push(
        distance+(distanceUnit ? " "+distanceUnit : "")
      );
    }

    help.textContent=
      "Farmer Carry is a loaded carry. Enter the total planned load in pounds so BlackPyre can keep the exercise"
      +(details.length
        ? " and its "+details.join(" × ")+" prescription."
        : ".");

    const label=document.createElement("label");
    label.className="builder-prescription-field";

    const labelText=document.createElement("span");
    labelText.textContent="Total load (lb)";

    const input=document.createElement("input");
    input.type="number";
    input.inputMode="decimal";
    input.min="0";
    input.step="any";
    input.dataset.prescriptionRepairField="weight";
    input.setAttribute(
      "aria-label",
      "Total planned load in pounds"
    );

    label.appendChild(labelText);
    label.appendChild(input);

    const apply=document.createElement("button");
    apply.type="button";
    apply.className="btn ghost small";
    apply.textContent="Use this load";
    apply.dataset.prescriptionRepairAction="load";

    apply.addEventListener("click",()=>{
      const load=Number(input.value);

      if(!Number.isFinite(load)||load<=0){
        trainingPlanReviewInlineError(
          error,
          "Enter the total planned load in pounds."
        );
        input.focus();
        return;
      }

      const value=cloneJSON(seed);
      value.weight=load;
      value.weightUnit="lb";

      const checked=
        sanitizeTrainingPlanPrescriptionForEntry(
          trainingPlanEntryById(row.exerciseId),
          {prescription:value}
        );

      if(!checked.ok){
        trainingPlanReviewInlineError(
          error,
          (checked.errors||[]).join(" ")
        );
        return;
      }

      const result=
        applyTrainingPlanPrescriptionRepair(
          row,
          checked.value
        );

      if(!result.ok){
        trainingPlanReviewInlineError(
          error,
          result.reason
        );
      }
    });

    shell.appendChild(title);
    shell.appendChild(help);
    shell.appendChild(label);
    shell.appendChild(apply);
    shell.appendChild(error);

    return shell;
  }

  if(row.repairKind==="remove-incompatible-fields"){
    title.textContent="Remove incompatible workout details";

    const labels=(row.incompatibleFields||[])
      .map(trainingPlanFieldLabel);

    help.textContent=
      "The exercise match is correct. BlackPyre can keep the compatible details and remove "
      +(labels.length
        ? labels.join(" and ")
        : "the incompatible fields")
      +".";

    const apply=document.createElement("button");
    apply.type="button";
    apply.className="btn ghost small";
    apply.textContent="Remove incompatible details";
    apply.dataset.prescriptionRepairAction=
      "remove-incompatible";

    apply.addEventListener("click",()=>{
      const result=
        applyTrainingPlanPrescriptionRepair(
          row,
          cloneJSON(row.repairSeed||{})
        );

      if(!result.ok){
        trainingPlanReviewInlineError(
          error,
          result.reason
        );
      }
    });

    shell.appendChild(title);
    shell.appendChild(help);
    shell.appendChild(apply);
    shell.appendChild(error);

    return shell;
  }

  return null;
}

function renderTrainingPlanReview(){
  const state=trainingPlanReviewState;
  const summary=document.getElementById(
    "trainingPlanReviewSummary"
  );
  const list=document.getElementById(
    "trainingPlanReviewList"
  );
  const confirmButton=document.getElementById(
    "trainingPlanReviewConfirmBtn"
  );

  if(!state || !summary || !list || !confirmButton){
    return false;
  }

  const prepared=state.prepared;
  const review=prepared.review||[];
  const blocked=review.filter(
    row=>(row.errors||[]).length>0
  ).length;

  const warningRows=review.filter(
    row=>
      !(row.errors||[]).length
      && (row.warnings||[]).length
  ).length;

  const ready=review.length-blocked;
  const removedCount=(state.removed||[]).length;
  const pendingCount=Object.keys(
    state.pendingEntries||{}
  ).length;

  const fileText=state.fileName
    ? ' from "'+state.fileName+'"'
    : "";

  summary.textContent=
    (prepared.kind==="interchange-v1"
      ? "BlackPyre-compatible v1 program"
      : "Legacy program")
    +fileText
    +". "
    +ready
    +" exercise"
    +(ready===1 ? "" : "s")
    +" ready"
    +(pendingCount
      ? ", "+pendingCount+" new"
      : "")
    +(warningRows
      ? ", "+warningRows+" with notes"
      : "")
    +(blocked
      ? ", "+blocked+" needing attention"
      : "")
    +(removedCount
      ? ", "+removedCount+" removed"
      : "")
    +".";

  list.innerHTML="";

  if(removedCount){
    const removed=document.createElement("div");
    removed.className=
      "training-plan-review-removed";

    removed.textContent=
      state.removed
        .map(item=>
          item.name
          +" was removed from "
          +item.dayTitle
          +"."
        )
        .join(" ");

    list.appendChild(removed);
  }

  (prepared.programErrors||[]).forEach(
    message=>{
      trainingPlanReviewMessage(
        list,
        message,
        "error"
      );
    }
  );

  review.forEach(row=>{
    const card=document.createElement("div");
    const errors=row.errors||[];
    const warnings=row.warnings||[];
    const isPending=
      String(row.exerciseId||"")
        .startsWith("pending:");

    card.className=
      "training-plan-review-item"
      +(errors.length
        ? " is-blocked"
        : warnings.length || isPending
          ? " has-warning"
          : " is-ready");

    const head=document.createElement("div");
    head.className=
      "training-plan-review-item-head";

    const name=document.createElement("div");
    name.className=
      "training-plan-review-name";

    name.textContent=
      row.importedName
      +(row.canonicalName
        && row.canonicalName!==row.importedName
          ? " → "+row.canonicalName
          : "");

    const status=document.createElement("div");
    status.className=
      "training-plan-review-status";

    status.textContent=
      errors.length
        ? "Needs attention"
        : isPending
          ? "New exercise"
          : row.status||"Ready";

    head.appendChild(name);
    head.appendChild(status);
    card.appendChild(head);

    const meta=document.createElement("div");
    meta.className="training-plan-review-meta";

    const metaParts=[
      row.dayTitle||row.dayId||"Program day"
    ];

    if(row.shape){
      metaParts.push(shapeGroupLabel(row.shape));
    }

    if(row.prescriptionSummary){
      metaParts.push(row.prescriptionSummary);
    }

    meta.textContent=metaParts.join(" · ");
    card.appendChild(meta);

    errors.forEach(message=>{
      trainingPlanReviewMessage(
        card,
        message,
        "error"
      );
    });

    warnings.forEach(message=>{
      trainingPlanReviewMessage(
        card,
        message,
        "warning"
      );
    });

    if(errors.length && row.repairKind){
      const repair=
        buildTrainingPlanPrescriptionRepair(row);

      if(repair){
        card.appendChild(repair);
      }
    }

    if(isPending){
      const pendingMessage=
        document.createElement("div");

      pendingMessage.className=
        "training-plan-review-pending";

      pendingMessage.textContent=
        "This exercise will be added to My Exercises only after Confirm import.";

      card.appendChild(pendingMessage);
    }

    if(
      errors.length
      && row.suggestions
      && row.suggestions.length
    ){
      const suggestions=document.createElement(
        "div"
      );

      suggestions.className=
        "training-plan-review-suggestions";

      suggestions.textContent=
        (row.suggestions.some(item=>
          item && item.compatible===true
        )
          ? "Compatible alternatives: "
          : "Possible matches: ")
        +row.suggestions
          .slice(0,3)
          .map(item=>item.name)
          .join(", ")
        +".";

      card.appendChild(suggestions);
    }

    if(
      (
        errors.length
        && (
          !row.repairKind
          || row.canChooseAlternative
        )
      )
      || isPending
    ){
      const controls=document.createElement(
        "div"
      );

      controls.className=
        "training-plan-review-resolution";

      const matchRow=document.createElement(
        "div"
      );

      matchRow.className=
        "training-plan-review-resolution-row";

      const searchField=document.createElement(
        "div"
      );

      searchField.className=
        "training-plan-review-resolution-field";

      const searchLabel=document.createElement(
        "label"
      );

      searchLabel.textContent=
        "Search BlackPyre exercises";

      const search=document.createElement(
        "input"
      );

      search.type="search";
      search.placeholder="Search exercises";
      search.setAttribute(
        "aria-label",
        "Search matches for "+row.importedName
      );

      searchField.appendChild(searchLabel);
      searchField.appendChild(search);

      const selectField=document.createElement(
        "div"
      );

      selectField.className=
        "training-plan-review-resolution-field";

      const selectLabel=document.createElement(
        "label"
      );

      selectLabel.textContent=
        "Match to existing";

      const select=document.createElement(
        "select"
      );

      select.setAttribute(
        "aria-label",
        "Match "+row.importedName
        +" to an existing exercise"
      );

      populateTrainingPlanReviewSelect(
        select,
        "",
        row.suggestions||[]
      );

      selectField.appendChild(selectLabel);
      selectField.appendChild(select);

      const matchButton=document.createElement(
        "button"
      );

      matchButton.type="button";
      matchButton.className="xbtn";
      matchButton.textContent="Use match";
      matchButton.disabled=true;

      search.addEventListener("input",()=>{
        populateTrainingPlanReviewSelect(
          select,
          search.value,
          row.suggestions||[]
        );

        matchButton.disabled=true;
      });

      select.addEventListener("change",()=>{
        matchButton.disabled=!select.value;
      });

      const inlineError=document.createElement(
        "div"
      );

      inlineError.className=
        "training-plan-review-inline-error hidden";

      matchButton.addEventListener("click",()=>{
        const result=
          matchTrainingPlanReviewExercise(
            row,
            select.value
          );

        if(!result.ok){
          trainingPlanReviewInlineError(
            inlineError,
            result.reason
          );
        }
      });

      matchRow.appendChild(searchField);
      matchRow.appendChild(selectField);
      matchRow.appendChild(matchButton);
      controls.appendChild(matchRow);

      const actionRow=document.createElement(
        "div"
      );

      actionRow.className=
        "training-plan-review-resolution-row";

      const customToggle=document.createElement(
        "button"
      );

      customToggle.type="button";
      customToggle.className="xbtn";
      customToggle.textContent=isPending
        ? "Edit custom exercise"
        : "Create a custom exercise instead";

      const removeButton=document.createElement(
        "button"
      );

      removeButton.type="button";
      removeButton.className="xbtn";
      removeButton.textContent=
        "Remove from import";

      actionRow.appendChild(customToggle);
      actionRow.appendChild(removeButton);
      controls.appendChild(actionRow);

      const custom=document.createElement("div");
      custom.className=
        "training-plan-review-custom hidden";

      const customNameField=
        document.createElement("div");

      customNameField.className=
        "training-plan-review-resolution-field";

      const customNameLabel=
        document.createElement("label");

      customNameLabel.textContent=
        "New exercise name";

      const customName=
        document.createElement("input");

      customName.type="text";
      customName.value=
        isPending
          ? row.canonicalName||row.importedName
          : row.importedName;

      customName.setAttribute(
        "aria-label",
        "New exercise name for "
        +row.importedName
      );

      customNameField.appendChild(
        customNameLabel
      );

      customNameField.appendChild(customName);

      const shapeField=document.createElement(
        "div"
      );

      shapeField.className=
        "training-plan-review-resolution-field";

      const shapeLabel=document.createElement(
        "label"
      );

      shapeLabel.textContent="Tracking type";

      const shapeSelect=document.createElement(
        "select"
      );

      shapeSelect.setAttribute(
        "aria-label",
        "Tracking type for "
        +row.importedName
      );

      const chooseShape=
        document.createElement("option");

      chooseShape.value="";
      chooseShape.textContent=
        "Choose tracking type";

      shapeSelect.appendChild(chooseShape);

      TRAINING_PLAN_SHAPES.forEach(shape=>{
        const option=document.createElement(
          "option"
        );

        option.value=shape;
        option.textContent=
          shapeGroupLabel(shape);

        shapeSelect.appendChild(option);
      });

      if(isPending){
        shapeSelect.value=row.shape||"";
      }else{
        shapeSelect.value="";
      }

      shapeField.appendChild(shapeLabel);
      shapeField.appendChild(shapeSelect);

      const createButton=document.createElement(
        "button"
      );

      createButton.type="button";
      createButton.className="xbtn";
      createButton.textContent=
        isPending
          ? "Update for import"
          : "Create for import";

      const customError=document.createElement(
        "div"
      );

      customError.className=
        "training-plan-review-inline-error hidden";

      customToggle.addEventListener("click",()=>{
        custom.classList.toggle("hidden");

        if(!custom.classList.contains("hidden")){
          customName.focus();
        }
      });

      createButton.addEventListener("click",()=>{
        const result=
          createPendingTrainingPlanExercise(
            row,
            customName.value,
            shapeSelect.value
          );

        if(!result.ok){
          trainingPlanReviewInlineError(
            customError,
            result.reason
          );
        }
      });

      removeButton.addEventListener("click",()=>{
        const result=
          removeTrainingPlanReviewExercise(row);

        if(!result.ok){
          trainingPlanReviewInlineError(
            inlineError,
            result.reason
          );
        }
      });

      custom.appendChild(customNameField);
      custom.appendChild(shapeField);
      custom.appendChild(createButton);
      custom.appendChild(customError);

      controls.appendChild(custom);
      controls.appendChild(inlineError);
      card.appendChild(controls);
    }

    list.appendChild(card);
  });

  confirmButton.disabled=!prepared.canConfirm;

  if(prepared.canConfirm){
    confirmButton.removeAttribute("aria-disabled");
  }else{
    confirmButton.setAttribute(
      "aria-disabled",
      "true"
    );
  }

  const allErrors=(prepared.programErrors||[])
    .concat(
      prepared.canConfirm
        ? []
        : [
            "Fix workout details, choose a match, create an exercise, or remove every item marked Needs attention before importing."
          ]
    );

  setTrainingPlanReviewError(
    allErrors.join(" ")
  );

  return true;
}

function openTrainingPlanReview(prepared,fileName){
  if(
    !prepared
    || !prepared.ok
    || !Array.isArray(prepared.review)
    || !prepared.sourceDocument
  ){
    return false;
  }

  trainingPlanReviewState={
    prepared:cloneJSON(prepared),
    sourceDocument:cloneJSON(
      prepared.sourceDocument
    ),
    pendingEntries:{},
    pendingSequence:0,
    removed:[],
    fileName:String(fileName||"").trim()
  };

  setProgramManagerOpen(false);

  const overlay=document.getElementById(
    "trainingPlanReviewOverlay"
  );

  overlay.classList.remove("hidden");
  document.body.classList.add(
    "training-plan-review-open"
  );

  renderTrainingPlanReview();

  if(overlay.focus){
    overlay.focus();
  }

  return true;
}

function materializeTrainingPlanPendingEntries(
  state
){
  const pendingEntries=
    trainingPlanReviewExtraEntries(state);

  const idMap={};
  const entries=[];

  for(const pending of pendingEntries){
    const issue=
      trainingPlanReviewPendingNameIssue(
        pending.name,
        pending.id
      );

    if(issue){
      return {
        ok:false,
        reason:issue
      };
    }

    const entry=genericUserExercise(
      pending.name,
      pending.shape
    );

    try{
      validateExerciseEntryObject(
        entry,
        "u:"
      );
    }catch(error){
      return {
        ok:false,
        reason:error.message
      };
    }

    idMap[pending.id]=entry;
    entries.push(entry);
  }

  return {
    ok:true,
    idMap:idMap,
    entries:entries
  };
}

function candidateWithMaterializedExercises(
  candidate,
  idMap
){
  const next=cloneJSON(candidate);

  next.days.forEach(day=>{
    day.exercises.forEach(exercise=>{
      const entry=idMap[exercise.exerciseId];

      if(!entry)return;

      exercise.exerciseId=entry.id;
      exercise.name=entry.name;
      exercise.trackingShape=entry.shape;
    });
  });

  return next;
}

function confirmTrainingPlanReview(){
  const state=trainingPlanReviewState;

  if(
    !state
    || !state.prepared
    || !state.prepared.canConfirm
    || !state.prepared.candidate
  ){
    setTrainingPlanReviewError(
      "This program still has exercises that need attention."
    );

    return false;
  }

  const materialized=
    materializeTrainingPlanPendingEntries(
      state
    );

  if(!materialized.ok){
    setTrainingPlanReviewError(
      materialized.reason
    );

    return false;
  }

  const candidate=
    candidateWithMaterializedExercises(
      state.prepared.candidate,
      materialized.idMap
    );

  const previousExercises=cloneJSON(
    data.myExercises||{}
  );

  materialized.entries.forEach(entry=>{
    data.myExercises[entry.id]=entry;
  });

  if(materialized.entries.length && !save()){
    data.myExercises=previousExercises;

    setTrainingPlanReviewError(
      "The new exercise could not be saved. Nothing was imported."
    );

    return false;
  }

  const replaced=replaceActiveProgram(
    candidate,
    {skipConfirm:true}
  );

  if(!replaced.ok){
    if(materialized.entries.length){
      data.myExercises=previousExercises;

      const rolledBack=save();

      if(!rolledBack){
        setTrainingPlanReviewError(
          "The program was not imported, and BlackPyre could not fully restore the exercise library. Do not close the app until your data is backed up."
        );

        return false;
      }
    }

    setTrainingPlanReviewError(
      replaced.reason
      || "The program could not be saved. The new exercise was not kept."
    );

    return false;
  }

  if(materialized.entries.length){
    renderLibraryOptions();
  }

  closeTrainingPlanReview({
    skipFocus:true
  });

  flashSave("Program imported ✓");
  return true;
}

document.getElementById(
  "trainingPlanReviewCloseBtn"
).addEventListener(
  "click",
  ()=>closeTrainingPlanReview()
);

document.getElementById(
  "trainingPlanReviewCancelBtn"
).addEventListener(
  "click",
  ()=>closeTrainingPlanReview()
);

document.getElementById(
  "trainingPlanReviewConfirmBtn"
).addEventListener(
  "click",
  confirmTrainingPlanReview
);

document.addEventListener("keydown",event=>{
  if(
    event.key==="Escape"
    && trainingPlanReviewIsOpen()
  ){
    event.preventDefault();
    closeTrainingPlanReview();
  }
});

document.getElementById(
  "importBtn"
).addEventListener(
  "click",
  ()=>document.getElementById("importFile").click()
);

document.getElementById(
  "importFile"
).addEventListener("change",event=>{
  const file=event.target.files[0];
  const err=document.getElementById("programErr");

  err.textContent="";
  err.classList.add("hidden");

  if(!file)return;

  const reader=new FileReader();

  reader.onload=()=>{
    const prepared=prepareTrainingPlanImport(
      reader.result
    );

    if(!prepared.ok){
      err.textContent=
        "Couldn't load that file: "
        +(prepared.message||"Invalid program file.");

      err.classList.remove("hidden");
      return;
    }

    openTrainingPlanReview(
      prepared,
      file.name
    );
  };

  reader.onerror=()=>{
    err.textContent=
      "Couldn't read that program file.";

    err.classList.remove("hidden");
  };

  reader.readAsText(file);
  event.target.value="";
});

document.getElementById(
  "exportBtn"
).addEventListener("click",()=>{
  const exported=
    trainingPlanInterchangeFromProgram(program);

  const baseName=
    (program.name||"blackpyre-program")
      .replace(/[^a-z0-9]+/gi,"-")
      .replace(/^-+|-+$/g,"")
      .toLowerCase()
    || "blackpyre-program";

  download(
    baseName+"-blackpyre-v1.json",
    JSON.stringify(exported,null,2)
  );

  ackBtn("exportBtn","✓ Downloaded");
});
