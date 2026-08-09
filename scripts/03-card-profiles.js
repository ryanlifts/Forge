"use strict";

(function(root,factory){
  "use strict";
  const exported=factory();
  if (typeof module==="object" && module.exports) module.exports=exported;
  if (root && root.BLACKPYRE_EXERCISE_CARD_PROFILE_DATA){
    root.BLACKPYRE_WORKOUT_PROFILES=exported.createEngine(root.BLACKPYRE_EXERCISE_CARD_PROFILE_DATA);
  }
})(typeof globalThis!=="undefined" ? globalThis : this, function(){
  "use strict";

  const PROFILE_TYPES=new Set([
    "timedHold",
    "steadyTimeDistance",
    "durationActivity",
    "timedIntervals",
    "distanceIntervals",
    "loadedDistance",
    "conditioningRounds",
    "activityNotes"
  ]);

  const ROW_PROFILES=new Set(["strengthSets","repetitionSets"]);
  const ROW_OUTCOMES=new Set([
    "missed",
    "skipped",
    "removed"
  ]);
  const ROW_REASONS=new Set([
    "fatigue",
    "pain",
    "time",
    "equipment",
    "other"
  ]);

  // Unit helpers are supplied by the app. The fallbacks keep this standalone
  // engine deterministic for interchange tooling and isolated contract tests.
  function runtimeUnitCall(name,args,fallback){
    const fn=typeof globalThis!=="undefined" ? globalThis[name] : null;
    return typeof fn==="function" ? fn.apply(null,args) : fallback();
  }
  function currentUnitSystem(){return runtimeUnitCall("currentUnitSystem",[],()=>"imperial");}
  function isMetricSystem(system){return runtimeUnitCall("isMetricSystem",[system],()=>String(system||currentUnitSystem())==="metric");}
  function poundsFromUnit(value,system){return runtimeUnitCall("poundsFromUnit",[value,system],()=>Number(value));}
  function poundsToUnit(value,system,digits){return runtimeUnitCall("poundsToUnit",[value,system,digits],()=>Number(value));}
  function formatBodyWeight(value,system,digits){return runtimeUnitCall("formatBodyWeight",[value,system,digits],()=>Number(value)+" lb");}

  function clone(value){
    return value==null ? value : JSON.parse(JSON.stringify(value));
  }

  function finiteNumber(value){
    if (value==="" || value===null || value===undefined) return null;
    const number=Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function positiveNumber(value){
    const number=finiteNumber(value);
    return number!==null && number>0 ? number : null;
  }

  function nonNegativeInteger(value){
    if (value==="" || value===null || value===undefined) return null;
    const number=Number(value);
    return Number.isInteger(number) && number>=0 ? number : null;
  }

  function positiveInteger(value){
    const number=nonNegativeInteger(value);
    return number!==null && number>0 ? number : null;
  }

  function cleanText(value){
    return String(value==null ? "" : value).trim();
  }

  function durationSeconds(draft,prefix,includeHours){
    const hoursKey=prefix ? prefix+"Hours" : "hours";
    const minutesKey=prefix ? prefix+"Minutes" : "minutes";
    const secondsKey=prefix ? prefix+"Seconds" : "seconds";
    const rawHours=includeHours ? draft[hoursKey] : 0;
    const rawMinutes=draft[minutesKey];
    const rawSeconds=draft[secondsKey];
    const supplied=value=>
      value!=="" && value!==null && value!==undefined;
    const any=includeHours
      ? [rawHours,rawMinutes,rawSeconds].some(supplied)
      : [rawMinutes,rawSeconds].some(supplied);

    if (!any) return null;

    const hours=includeHours
      ? (supplied(rawHours) ? nonNegativeInteger(rawHours) : 0)
      : 0;
    const minutes=supplied(rawMinutes)
      ? nonNegativeInteger(rawMinutes)
      : 0;
    const seconds=supplied(rawSeconds)
      ? nonNegativeInteger(rawSeconds)
      : 0;

    if (hours===null || minutes===null || seconds===null) return NaN;
    if (seconds>59 || (includeHours && minutes>59)) return NaN;

    return hours*3600+minutes*60+seconds;
  }

  function assignDuration(draft,prefix,total,includeHours){
    const numeric=Number(total);
    if (!(Number.isFinite(numeric) && numeric>=0)) return draft;
    const seconds=Math.round(numeric);
    const hoursKey=prefix ? prefix+"Hours" : "hours";
    const minutesKey=prefix ? prefix+"Minutes" : "minutes";
    const secondsKey=prefix ? prefix+"Seconds" : "seconds";

    if (includeHours){
      draft[hoursKey]=Math.floor(seconds/3600);
    }

    draft[minutesKey]=Math.floor((seconds%3600)/60);
    draft[secondsKey]=seconds%60;
    return draft;
  }

  function formatSeconds(value){
    const number=Number(value);
    if (!(Number.isFinite(number) && number>0)) return "";
    const seconds=Math.round(number);
    if (seconds%3600===0) return (seconds/3600)+" hr";
    if (seconds%60===0) return (seconds/60)+" min";
    if (seconds>=3600){
      const hours=Math.floor(seconds/3600);
      const minutes=Math.floor((seconds%3600)/60);
      const remainder=seconds%60;
      return [hours+"h",minutes ? minutes+"m" : "",remainder ? remainder+"s" : ""].filter(Boolean).join(" ");
    }
    if (seconds>=60) return Math.floor(seconds/60)+"m "+(seconds%60)+"s";
    return seconds+" sec";
  }

  function formatCount(value,singular,plural){
    const number=Number(value);
    if (!(Number.isFinite(number) && number>0)) return "";
    return number+" "+(number===1 ? singular : plural);
  }

  function createEngine(data){
    if (!data || typeof data!=="object") throw new Error("Workout card profile data is missing.");
    const definitions=data.profileDefinitions || {};
    const assignments=data.assignments || {};
    const distanceUnits=Array.isArray(data.distanceUnits) && data.distanceUnits.length
      ? data.distanceUnits.slice()
      : ["mi","km","m","yd","ft"];

    const customDefaults={
      lift:{profile:"strengthSets",options:{weightPolicy:"required",weightLabel:"Weight"},source:"custom-default"},
      reps:{profile:"repetitionSets",options:{weightPolicy:"optional",weightLabel:"Weight"},source:"custom-default"},
      duration:{profile:"durationActivity",options:{timeOnly:true},source:"custom-default"},
      timeDist:{profile:"steadyTimeDistance",options:{},source:"custom-default"},
      carry:{profile:"loadedDistance",options:{countLabel:"Trips / sets",loadLabel:"Load"},source:"custom-default"},
      rounds:{profile:"conditioningRounds",options:{},source:"custom-default"},
      text:{profile:"activityNotes",options:{},source:"custom-default"}
    };

    const runtimeContracts={
      strengthSets:{
        renderer:"setRows",
        validator:"validateRows",
        savedValueContract:"rows",
        draftSerializer:"saved-value-clone",
        draftRestorer:"rows",
        editRestorer:"rows",
        historyFormatter:"formatRows",
        replacementFamily:"strengthSets"
      },
      repetitionSets:{
        renderer:"setRows",
        validator:"validateRows",
        savedValueContract:"rows",
        draftSerializer:"saved-value-clone",
        draftRestorer:"rows",
        editRestorer:"rows",
        historyFormatter:"formatRows",
        replacementFamily:"repetitionSets"
      },
      timedHold:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"timedHold",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"timedHold"
      },
      steadyTimeDistance:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"timeDist",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"steadyTimeDistance"
      },
      durationActivity:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"durationActivity",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"durationActivity"
      },
      timedIntervals:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"timedIntervals",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"timedIntervals"
      },
      distanceIntervals:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"distanceIntervals",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"distanceIntervals"
      },
      loadedDistance:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"loadedDistance",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"loadedDistance"
      },
      conditioningRounds:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"conditioningRounds",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"conditioningRounds"
      },
      activityNotes:{
        renderer:"profileFields",
        validator:"validateProfile",
        savedValueContract:"activityNotes",
        draftSerializer:"saved-value-clone",
        draftRestorer:"fromStored",
        editRestorer:"fromStored",
        historyFormatter:"formatStored",
        replacementFamily:"activityNotes"
      }
    };

    function resolve(entry,prescription){
      if (!entry || typeof entry!=="object") return null;
      const id=String(entry.id||"");
      let resolved;
      if (id && assignments[id]){
        const assigned=assignments[id];
        resolved={
          profile:assigned.profile,
          options:clone(assigned.options||{}),
          source:"canonical",
          exerciseId:id
        };
      } else {
        const shape=String(entry.shape||"");
        if (!customDefaults[shape]) return null;
        resolved=clone(customDefaults[shape]);
      }

      const p=
        prescription && typeof prescription==="object"
          ? prescription
          : {};
      const intervals=
        positiveInteger(p.intervals)
        || positiveInteger(p.rounds);

      /*
       * A steady-card canonical assignment describes the exercise's default,
       * not every possible prescription. Dedicated interval assignments stay
       * authoritative; only flexible steady cardio is promoted here.
       */
      if (
        resolved.profile==="steadyTimeDistance"
        && intervals!==null
      ){
        const timedWork=
          positiveNumber(p.workSeconds)
          || positiveNumber(p.durationSeconds);
        const distanceWork=positiveNumber(p.distance);

        if (timedWork!==null){
          resolved.profile="timedIntervals";
          resolved.source="prescription-intervals";
        } else if (distanceWork!==null){
          resolved.profile="distanceIntervals";
          resolved.source="prescription-distance-intervals";
        }
      }

      return resolved;
    }

    function profileDefinition(profile){
      return definitions[profile] || null;
    }

    function runtimeContract(profile){
      return runtimeContracts[profile] || null;
    }

    function canRender(profile){
      return !!runtimeContract(profile);
    }

    function isRowProfile(profile){
      return ROW_PROFILES.has(profile);
    }

    function isKnownSavedType(type){
      return PROFILE_TYPES.has(type);
    }

    function blank(profile){
      switch(profile){
        case "timedHold":
          return {holds:"",holdMinutes:"",holdSeconds:"",recoverySeconds:""};
        case "steadyTimeDistance":
          return {hours:"",minutes:"",seconds:"",distance:"",distanceUnit:distanceUnits[0],pace:"",effort:""};
        case "durationActivity":
          return {hours:"",minutes:"",seconds:"",note:""};
        case "timedIntervals":
          return {intervals:"",workMinutes:"",workSeconds:"",recoverySeconds:"",distance:"",distanceUnit:distanceUnits[0],effort:""};
        case "distanceIntervals":
          return {repeats:"",distance:"",distanceUnit:distanceUnits[0],workMinutes:"",workSeconds:"",recoverySeconds:"",effort:""};
        case "loadedDistance":
          return {count:"",lbs:"",distance:"",distanceUnit:distanceUnits[0],durationMinutes:"",durationSeconds:"",recoverySeconds:"",effort:""};
        case "conditioningRounds":
          return {rounds:"",workMinutes:"",workSeconds:"",recoverySeconds:"",note:""};
        case "activityNotes":
          return {hours:"",minutes:"",seconds:"",note:""};
        default:
          return null;
      }
    }

    function prescriptionCount(p,primary,fallback){
      const direct=positiveInteger(p && p[primary]);
      if (direct!==null) return direct;
      return fallback ? positiveInteger(p && p[fallback]) : null;
    }

    function prefill(profile,prescription){
      const p=prescription && typeof prescription==="object" ? prescription : {};
      const draft=blank(profile);
      if (!draft) return null;

      const recovery=p.recoverySeconds!==undefined ? p.recoverySeconds : p.restSeconds;
      const note=cleanText(p.notes || p.instructions || p.completionTarget || "");

      switch(profile){
        case "timedHold": {
          draft.holds=prescriptionCount(p,"intervals","sets") || "";
          assignDuration(draft,"hold",positiveNumber(p.durationSeconds)||0,false);
          draft.recoverySeconds=nonNegativeInteger(recovery);
          if (draft.recoverySeconds===null) draft.recoverySeconds="";
          return draft;
        }
        case "steadyTimeDistance": {
          assignDuration(draft,"",positiveNumber(p.durationSeconds)||0,true);
          draft.distance=positiveNumber(p.distance)||"";
          if (p.distanceUnit && distanceUnits.includes(p.distanceUnit)) draft.distanceUnit=p.distanceUnit;
          draft.pace=cleanText(p.pace);
          draft.effort=cleanText(p.effort);
          return draft;
        }
        case "durationActivity": {
          assignDuration(draft,"",positiveNumber(p.durationSeconds)||0,true);
          draft.note=note;
          return draft;
        }
        case "timedIntervals": {
          draft.intervals=prescriptionCount(p,"intervals","rounds") || "";
          assignDuration(draft,"work",positiveNumber(p.durationSeconds)||positiveNumber(p.workSeconds)||0,false);
          draft.recoverySeconds=nonNegativeInteger(recovery);
          if (draft.recoverySeconds===null) draft.recoverySeconds="";
          draft.distance=positiveNumber(p.distance)||"";
          if (p.distanceUnit && distanceUnits.includes(p.distanceUnit)) draft.distanceUnit=p.distanceUnit;
          draft.effort=cleanText(p.effort);
          return draft;
        }
        case "distanceIntervals": {
          draft.repeats=prescriptionCount(p,"intervals","rounds") || "";
          draft.distance=positiveNumber(p.distance)||"";
          if (p.distanceUnit && distanceUnits.includes(p.distanceUnit)) draft.distanceUnit=p.distanceUnit;
          assignDuration(draft,"work",positiveNumber(p.durationSeconds)||positiveNumber(p.workSeconds)||0,false);
          draft.recoverySeconds=nonNegativeInteger(recovery);
          if (draft.recoverySeconds===null) draft.recoverySeconds="";
          draft.effort=cleanText(p.effort);
          return draft;
        }
        case "loadedDistance": {
          draft.count=prescriptionCount(p,"trips","sets") || "";
          const prescribedLoad=positiveNumber(p.weight);
          const canonicalLoad=prescribedLoad===null?null:poundsFromUnit(prescribedLoad,p.weightUnit==="kg"?"metric":"imperial");
          draft.lbs=canonicalLoad===null?"":poundsToUnit(canonicalLoad,currentUnitSystem(),1);
          draft.distance=positiveNumber(p.distance)||"";
          if (p.distanceUnit && distanceUnits.includes(p.distanceUnit)) draft.distanceUnit=p.distanceUnit;
          assignDuration(draft,"duration",positiveNumber(p.durationSeconds)||0,false);
          draft.recoverySeconds=nonNegativeInteger(recovery);
          if (draft.recoverySeconds===null) draft.recoverySeconds="";
          draft.effort=cleanText(p.effort);
          return draft;
        }
        case "conditioningRounds": {
          draft.rounds=positiveInteger(p.rounds)||"";
          assignDuration(draft,"work",positiveNumber(p.workSeconds)||0,false);
          draft.recoverySeconds=nonNegativeInteger(recovery);
          if (draft.recoverySeconds===null) draft.recoverySeconds="";
          draft.note=note || (Array.isArray(p.movements) ? p.movements.join(", ") : "");
          return draft;
        }
        case "activityNotes": {
          assignDuration(draft,"",positiveNumber(p.durationSeconds)||0,true);
          draft.note=note;
          return draft;
        }
        default:
          return draft;
      }
    }

    function hasMeaningful(profile,draft){
      if (!draft || typeof draft!=="object") return false;
      return Object.keys(draft).some(key=>{
        if (key==="distanceUnit") return false;
        return draft[key]!=="" && draft[key]!==null && draft[key]!==undefined;
      });
    }

    function validateRows(profile,rows,options){
      const source=
        Array.isArray(rows)
          ? rows
          : [];

      const policy=
        profile==="strengthSets"
          ? "required"
          : String(
              (options||{}).weightPolicy
              || "optional"
            );

      const entered=[];

      for (
        let index=0;
        index<source.length;
        index+=1
      ){
        const row=source[index] || {};
        const status=cleanText(row.status);
        const reason=cleanText(row.reason);
        const extra=row.extra===true;

        if (
          status
          && !ROW_OUTCOMES.has(status)
        ){
          return {
            ok:false,
            message:
              "choose a valid outcome for Set "
              +(index+1)+".",
            rowIndex:index,
            field:"status"
          };
        }

        if (
          reason
          && (
            !status
            || !ROW_REASONS.has(reason)
          )
        ){
          return {
            ok:false,
            message:
              "choose a valid reason for Set "
              +(index+1)+".",
            rowIndex:index,
            field:"reason"
          };
        }

        if (!row.touched && !status){
          continue;
        }

        if (
          status==="skipped"
          || status==="removed"
        ){
          const savedRow={
            status:status
          };

          if (reason){
            savedRow.reason=reason;
          }

          if (extra){
            savedRow.extra=true;
          }

          entered.push(savedRow);
          continue;
        }

        if (status==="missed"){
          let savedRow;

          if (policy==="required"){
            const weight=
              positiveNumber(row.w);

            if (weight===null){
              return {
                ok:false,
                message:
                  "enter the attempted weight for missed Set "
                  +(index+1)+".",
                rowIndex:index,
                field:"weight"
              };
            }

            // Preserve established weight-before-reps row ordering.
            savedRow={
              w:weight,
              r:0,
              status:"missed"
            };
          } else {
            const hasWeight=
              policy==="optional"
              && row.w!==""
              && row.w!==null
              && row.w!==undefined;

            if (hasWeight){
              const weight=
                finiteNumber(row.w);

              if (
                weight===null
                || weight<0
              ){
                return {
                  ok:false,
                  message:
                    "enter a valid optional weight for missed Set "
                    +(index+1)+", or clear it.",
                  rowIndex:index,
                  field:"weight"
                };
              }

              savedRow=
                weight>0
                  ? {
                      w:weight,
                      r:0,
                      status:"missed"
                    }
                  : {
                      r:0,
                      status:"missed"
                    };
            } else {
              savedRow={
                r:0,
                status:"missed"
              };
            }
          }

          if (reason){
            savedRow.reason=reason;
          }

          if (extra){
            savedRow.extra=true;
          }

          entered.push(savedRow);
          continue;
        }

        const reps=
          positiveInteger(row.r);

        if (reps===null){
          return {
            ok:false,
            message:
              "enter reps for Set "+(index+1)
              +", or choose Missed, Skipped, "
              +"or Remove today.",
            rowIndex:index,
            field:"reps"
          };
        }

        let savedRow;

        if (policy==="required"){
          const weight=
            positiveNumber(row.w);

          if (weight===null){
            return {
              ok:false,
              message:
                "enter weight and reps for Set "
                +(index+1)
                +", or choose a set outcome.",
              rowIndex:index,
              field:"weight"
            };
          }

          // CRITICAL: exact legacy row contract is {w,r}.
          savedRow={
            w:weight,
            r:reps
          };
        } else if (policy==="optional"){
          const hasWeight=
            row.w!==""
            && row.w!==null
            && row.w!==undefined;

          if (hasWeight){
            const weight=
              positiveNumber(row.w);

            if (weight===null){
              return {
                ok:false,
                message:
                  "enter a valid optional weight for Set "
                  +(index+1)+", or clear it.",
                rowIndex:index,
                field:"weight"
              };
            }

            // Preserve established weighted repetition {w,r}.
            savedRow={
              w:weight,
              r:reps
            };
          } else {
            // Preserve established bodyweight {r}.
            savedRow={
              r:reps
            };
          }
        } else {
          savedRow={
            r:reps
          };
        }

        if (extra){
          savedRow.extra=true;
        }

        entered.push(savedRow);
      }

      if (!entered.length){
        return {
          ok:true,
          value:null
        };
      }

      return {
        ok:true,
        value:entered
      };
    }

    function validate(profile,draft){
      const d=draft && typeof draft==="object" ? draft : {};
      let value;

      switch(profile){
        case "timedHold": {
          const holds=positiveInteger(d.holds);
          if (holds===null) return {ok:false,message:"enter the number of holds.",field:"holds"};
          const holdSecs=durationSeconds(d,"hold",false);
          if (!(Number.isFinite(holdSecs) && holdSecs>0)) return {ok:false,message:"enter the duration of each hold.",field:"holdMinutes"};
          const rec=nonNegativeInteger(d.recoverySeconds);
          value={t:"timedHold",holds:holds,holdSecs:holdSecs};
          if (rec!==null) value.recSecs=rec;
          return {ok:true,value:value};
        }
        case "steadyTimeDistance": {
          const secs=durationSeconds(d,"",true);
          if (!(Number.isFinite(secs) && secs>0)) return {ok:false,message:"enter the activity duration.",field:"minutes"};
          const pace=cleanText(d.pace);
          const effort=cleanText(d.effort);
          value={t:(pace || effort) ? "steadyTimeDistance" : "timeDist",secs:secs};
          const distance=positiveNumber(d.distance);
          if (d.distance!=="" && distance===null) return {ok:false,message:"distance must be greater than zero.",field:"distance"};
          if (distance!==null){
            if (!distanceUnits.includes(d.distanceUnit)) return {ok:false,message:"choose a distance unit.",field:"distanceUnit"};
            value.dist=distance;
            value.distUnit=d.distanceUnit;
          }
          if (pace) value.pace=pace;
          if (effort) value.effort=effort;
          return {ok:true,value:value};
        }
        case "durationActivity": {
          const secs=durationSeconds(d,"",true);
          if (!(Number.isFinite(secs) && secs>0)) return {ok:false,message:"enter the activity duration.",field:"minutes"};
          value={t:"durationActivity",secs:secs};
          const note=cleanText(d.note);
          if (note) value.note=note;
          return {ok:true,value:value};
        }
        case "timedIntervals": {
          const intervals=positiveInteger(d.intervals);
          if (intervals===null) return {ok:false,message:"enter the number of intervals.",field:"intervals"};
          const workSecs=durationSeconds(d,"work",false);
          if (!(Number.isFinite(workSecs) && workSecs>0)) return {ok:false,message:"enter the work duration for each interval.",field:"workMinutes"};
          value={t:"timedIntervals",intervals:intervals,workSecs:workSecs};
          const rec=nonNegativeInteger(d.recoverySeconds);
          if (rec!==null) value.recSecs=rec;
          const distance=positiveNumber(d.distance);
          if (d.distance!=="" && distance===null) return {ok:false,message:"distance per interval must be greater than zero.",field:"distance"};
          if (distance!==null){
            if (!distanceUnits.includes(d.distanceUnit)) return {ok:false,message:"choose a distance unit.",field:"distanceUnit"};
            value.dist=distance;
            value.distUnit=d.distanceUnit;
          }
          const effort=cleanText(d.effort);
          if (effort) value.effort=effort;
          return {ok:true,value:value};
        }
        case "distanceIntervals": {
          const repeats=positiveInteger(d.repeats);
          if (repeats===null) return {ok:false,message:"enter the number of repeats.",field:"repeats"};
          const distance=positiveNumber(d.distance);
          if (distance===null) return {ok:false,message:"enter the distance for each repeat.",field:"distance"};
          if (!distanceUnits.includes(d.distanceUnit)) return {ok:false,message:"choose a distance unit.",field:"distanceUnit"};
          value={t:"distanceIntervals",repeats:repeats,dist:distance,distUnit:d.distanceUnit};
          const workSecs=durationSeconds(d,"work",false);
          if (Number.isNaN(workSecs)) return {ok:false,message:"work duration is invalid.",field:"workMinutes"};
          if (workSecs!==null && workSecs>0) value.workSecs=workSecs;
          const rec=nonNegativeInteger(d.recoverySeconds);
          if (rec!==null) value.recSecs=rec;
          const effort=cleanText(d.effort);
          if (effort) value.effort=effort;
          return {ok:true,value:value};
        }
        case "loadedDistance": {
          const displayedLoad=positiveNumber(d.lbs);
          if (displayedLoad===null) return {ok:false,message:"enter the load.",field:"lbs"};
          const load=poundsFromUnit(displayedLoad,currentUnitSystem());
          const distance=positiveNumber(d.distance);
          if (distance===null) return {ok:false,message:"enter the distance.",field:"distance"};
          if (!distanceUnits.includes(d.distanceUnit)) return {ok:false,message:"choose a distance unit.",field:"distanceUnit"};
          const count=positiveInteger(d.count);
          if (d.count!=="" && count===null) return {ok:false,message:"trips or sets must be a whole number.",field:"count"};
          const secs=durationSeconds(d,"duration",false);
          if (Number.isNaN(secs)) return {ok:false,message:"duration is invalid.",field:"durationMinutes"};
          const rec=nonNegativeInteger(d.recoverySeconds);
          const effort=cleanText(d.effort);

          if (
            count===null
            && !(secs!==null && secs>0)
            && rec===null
            && !effort
          ){
            return {
              ok:true,
              value:{
                t:"carry",
                lbs:load,
                dist:distance,
                distUnit:d.distanceUnit
              }
            };
          }

          value={t:"loadedDistance",lbs:load,dist:distance,distUnit:d.distanceUnit};
          if (count!==null) value.count=count;
          if (secs!==null && secs>0) value.secs=secs;
          if (rec!==null) value.recSecs=rec;
          if (effort) value.effort=effort;
          return {ok:true,value:value};
        }
        case "conditioningRounds": {
          const rounds=positiveInteger(d.rounds);
          if (rounds===null) return {ok:false,message:"enter the number of rounds.",field:"rounds"};
          const workSecs=durationSeconds(d,"work",false);
          if (!(Number.isFinite(workSecs) && workSecs>0)) return {ok:false,message:"enter the work duration for each round.",field:"workMinutes"};
          const rec=nonNegativeInteger(d.recoverySeconds);
          value={t:"rounds",rounds:rounds,workSecs:workSecs,recSecs:rec===null ? 0 : rec};
          const note=cleanText(d.note);
          if (note) value.note=note;
          return {ok:true,value:value};
        }
        case "activityNotes": {
          const note=cleanText(d.note);
          if (!note) return {ok:false,message:"enter details or notes.",field:"note"};
          value={t:"activityNotes",note:note};
          const secs=durationSeconds(d,"",true);
          if (Number.isNaN(secs)) return {ok:false,message:"duration is invalid.",field:"minutes"};
          if (secs!==null && secs>0) value.secs=secs;
          return {ok:true,value:value};
        }
        default:
          return {ok:false,message:"this workout card profile is not supported."};
      }
    }

    function fromStored(profile,value){
      if (!value || (typeof value!=="object" && typeof value!=="string")) return null;
      const draft=blank(profile);
      if (!draft) return null;

      if (typeof value==="string"){
        if (profile==="activityNotes" || profile==="durationActivity"){
          draft.note=value;
          return draft;
        }
        return null;
      }

      const type=String(value.t||"");

      if (type===profile){
        switch(profile){
          case "timedHold":
            draft.holds=value.holds;
            assignDuration(draft,"hold",value.holdSecs,false);
            draft.recoverySeconds=value.recSecs!==undefined ? value.recSecs : "";
            return draft;
          case "steadyTimeDistance":
            assignDuration(draft,"",value.secs,true);
            draft.distance=value.dist!==undefined ? value.dist : "";
            if (value.distUnit) draft.distanceUnit=value.distUnit;
            draft.pace=value.pace||"";
            draft.effort=value.effort||"";
            return draft;
          case "durationActivity":
            assignDuration(draft,"",value.secs,true);
            draft.note=value.note||"";
            return draft;
          case "timedIntervals":
            draft.intervals=value.intervals;
            assignDuration(draft,"work",value.workSecs,false);
            draft.recoverySeconds=value.recSecs!==undefined ? value.recSecs : "";
            draft.distance=value.dist!==undefined ? value.dist : "";
            if (value.distUnit) draft.distanceUnit=value.distUnit;
            draft.effort=value.effort||"";
            return draft;
          case "distanceIntervals":
            draft.repeats=value.repeats;
            draft.distance=value.dist;
            if (value.distUnit) draft.distanceUnit=value.distUnit;
            if (value.workSecs!==undefined) assignDuration(draft,"work",value.workSecs,false);
            draft.recoverySeconds=value.recSecs!==undefined ? value.recSecs : "";
            draft.effort=value.effort||"";
            return draft;
          case "loadedDistance":
            draft.count=value.count!==undefined ? value.count : "";
            draft.lbs=poundsToUnit(value.lbs,currentUnitSystem(),1);
            draft.distance=value.dist;
            if (value.distUnit) draft.distanceUnit=value.distUnit;
            if (value.secs!==undefined) assignDuration(draft,"duration",value.secs,false);
            draft.recoverySeconds=value.recSecs!==undefined ? value.recSecs : "";
            draft.effort=value.effort||"";
            return draft;
          case "conditioningRounds":
            draft.rounds=value.rounds;
            assignDuration(draft,"work",value.workSecs,false);
            draft.recoverySeconds=value.recSecs!==undefined ? value.recSecs : "";
            draft.note=value.note||"";
            return draft;
          case "activityNotes":
            if (value.secs!==undefined) assignDuration(draft,"",value.secs,true);
            draft.note=value.note||"";
            return draft;
        }
      }

      if (profile==="timedHold" && type==="timeDist"){
        draft.holds=1;
        assignDuration(draft,"hold",value.secs,false);
        return draft;
      }

      if (profile==="steadyTimeDistance" && type==="timeDist"){
        assignDuration(draft,"",value.secs,true);
        draft.distance=value.dist!==undefined ? value.dist : "";
        if (value.distUnit) draft.distanceUnit=value.distUnit;
        return draft;
      }

      if (profile==="durationActivity" && type==="timeDist"){
        assignDuration(draft,"",value.secs,true);
        return draft;
      }

      if (profile==="activityNotes" && type==="timeDist"){
        assignDuration(draft,"",value.secs,true);
        return draft;
      }

      if (profile==="loadedDistance" && type==="carry"){
        draft.lbs=poundsToUnit(value.lbs,currentUnitSystem(),1);
        draft.distance=value.dist;
        if (value.distUnit) draft.distanceUnit=value.distUnit;
        return draft;
      }

      if (profile==="conditioningRounds" && type==="rounds"){
        draft.rounds=value.rounds;
        assignDuration(draft,"work",value.workSecs,false);
        draft.recoverySeconds=value.recSecs;
        draft.note=value.note||"";
        return draft;
      }

      if (profile==="timedIntervals" && type==="rounds"){
        draft.intervals=value.rounds;
        assignDuration(draft,"work",value.workSecs,false);
        draft.recoverySeconds=value.recSecs;
        draft.effort=value.note||"";
        return draft;
      }

      if (profile==="timedIntervals" && type==="timeDist"){
        draft.intervals=1;
        assignDuration(draft,"work",value.secs,false);
        draft.distance=value.dist!==undefined ? value.dist : "";
        if (value.distUnit) draft.distanceUnit=value.distUnit;
        return draft;
      }

      if (profile==="distanceIntervals" && type==="rounds"){
        draft.repeats=value.rounds;
        assignDuration(draft,"work",value.workSecs,false);
        draft.recoverySeconds=value.recSecs;
        return draft;
      }

      if (profile==="distanceIntervals" && type==="timeDist"){
        draft.repeats=1;
        draft.distance=value.dist!==undefined ? value.dist : "";
        if (value.distUnit) draft.distanceUnit=value.distUnit;
        assignDuration(draft,"work",value.secs,false);
        return draft;
      }

      return null;
    }

    function formatStored(value){
      if (!value || typeof value!=="object") return null;
      const type=String(value.t||"");
      const parts=[];

      switch(type){
        case "timedHold":
          parts.push(formatCount(value.holds,"hold","holds"));
          parts.push(formatSeconds(value.holdSecs)+" each");
          if (value.recSecs!==undefined) parts.push(formatSeconds(value.recSecs)+" recovery");
          return parts.filter(Boolean).join(" · ");
        case "steadyTimeDistance":
          parts.push(formatSeconds(value.secs));
          if (value.dist!==undefined) parts.push(value.dist+" "+value.distUnit);
          if (value.pace) parts.push(value.pace);
          if (value.effort) parts.push(value.effort);
          return parts.filter(Boolean).join(" · ");
        case "durationActivity":
          parts.push(formatSeconds(value.secs));
          if (value.note) parts.push(value.note);
          return parts.filter(Boolean).join(" · ");
        case "timedIntervals":
          parts.push(formatCount(value.intervals,"interval","intervals"));
          parts.push(formatSeconds(value.workSecs)+" each");
          if (value.dist!==undefined) parts.push(value.dist+" "+value.distUnit+" each");
          if (value.recSecs!==undefined) parts.push(formatSeconds(value.recSecs)+" recovery");
          if (value.effort) parts.push(value.effort);
          return parts.filter(Boolean).join(" · ");
        case "distanceIntervals":
          parts.push(formatCount(value.repeats,"repeat","repeats"));
          parts.push(value.dist+" "+value.distUnit+" each");
          if (value.workSecs!==undefined) parts.push(formatSeconds(value.workSecs)+" work");
          if (value.recSecs!==undefined) parts.push(formatSeconds(value.recSecs)+" recovery");
          if (value.effort) parts.push(value.effort);
          return parts.filter(Boolean).join(" · ");
        case "loadedDistance":
          if (value.count!==undefined) parts.push(formatCount(value.count,"trip / set","trips / sets"));
          parts.push(formatBodyWeight(value.lbs,currentUnitSystem(),1));
          parts.push(value.dist+" "+value.distUnit);
          if (value.secs!==undefined) parts.push(formatSeconds(value.secs));
          if (value.recSecs!==undefined) parts.push(formatSeconds(value.recSecs)+" recovery");
          if (value.effort) parts.push(value.effort);
          return parts.filter(Boolean).join(" · ");
        case "conditioningRounds":
          parts.push(formatCount(value.rounds,"round","rounds"));
          parts.push(formatSeconds(value.workSecs)+" work");
          parts.push(formatSeconds(value.recSecs)+" recovery");
          if (value.note) parts.push(value.note);
          return parts.filter(Boolean).join(" · ");
        case "activityNotes":
          if (value.secs!==undefined) parts.push(formatSeconds(value.secs));
          parts.push(value.note||"");
          return parts.filter(Boolean).join(" · ");
        default:
          return null;
      }
    }

    function kind(value){
      if (value && typeof value==="object" && !Array.isArray(value) && isKnownSavedType(value.t)){
        return value.t;
      }
      return null;
    }

    function isEditableSavedType(type){
      return isKnownSavedType(type);
    }

    function compatible(first,second){
      const a=runtimeContract(first);
      const b=runtimeContract(second);
      return !!a && !!b && a.replacementFamily===b.replacementFamily;
    }

    function fields(profile,options){
      const opts=options||{};
      switch(profile){
        case "timedHold":
          return [
            {key:"holds",label:"Holds (required)",type:"number",inputMode:"numeric",required:true},
            {key:"holdMinutes",label:"Minutes per hold",type:"number",inputMode:"numeric"},
            {key:"holdSeconds",label:"Seconds per hold",type:"number",inputMode:"numeric"},
            {key:"recoverySeconds",label:"Recovery seconds (optional)",type:"number",inputMode:"numeric"}
          ];
        case "steadyTimeDistance":
          return [
            {key:"hours",label:"Hours",type:"number",inputMode:"numeric"},
            {key:"minutes",label:"Minutes (required)",type:"number",inputMode:"numeric",required:true},
            {key:"seconds",label:"Seconds",type:"number",inputMode:"numeric"},
            {key:"distance",label:"Distance (optional)",type:"number",inputMode:"decimal"},
            {key:"distanceUnit",label:"Distance unit",type:"select",options:distanceUnits},
            {key:"pace",label:"Pace (optional)",type:"text"},
            {key:"effort",label:"Effort (optional)",type:"text"}
          ];
        case "durationActivity":
          return [
            {key:"hours",label:"Hours",type:"number",inputMode:"numeric"},
            {key:"minutes",label:opts.timeOnly ? "Minutes" : "Minutes (required)",type:"number",inputMode:"numeric",required:!opts.timeOnly},
            {key:"seconds",label:"Seconds",type:"number",inputMode:"numeric"},
          ].concat(opts.timeOnly ? [] : [
            {key:"note",label:"Notes (optional)",type:"text"}
          ]);
        case "timedIntervals":
          return [
            {key:"intervals",label:"Intervals (required)",type:"number",inputMode:"numeric",required:true},
            {key:"workMinutes",label:"Work minutes each",type:"number",inputMode:"numeric"},
            {key:"workSeconds",label:"Work seconds each (required)",type:"number",inputMode:"numeric",required:true},
            {key:"recoverySeconds",label:"Recovery seconds (optional)",type:"number",inputMode:"numeric"},
            {key:"distance",label:"Distance each (optional)",type:"number",inputMode:"decimal"},
            {key:"distanceUnit",label:"Distance unit",type:"select",options:distanceUnits},
            {key:"effort",label:"Effort (optional)",type:"text"}
          ];
        case "distanceIntervals":
          return [
            {key:"repeats",label:"Repeats (required)",type:"number",inputMode:"numeric",required:true},
            {key:"distance",label:"Distance each (required)",type:"number",inputMode:"decimal",required:true},
            {key:"distanceUnit",label:"Distance unit (required)",type:"select",options:distanceUnits,required:true},
            {key:"workMinutes",label:"Work minutes each (optional)",type:"number",inputMode:"numeric"},
            {key:"workSeconds",label:"Work seconds each (optional)",type:"number",inputMode:"numeric"},
            {key:"recoverySeconds",label:"Recovery seconds (optional)",type:"number",inputMode:"numeric"},
            {key:"effort",label:"Effort (optional)",type:"text"}
          ];
        case "loadedDistance":
          return [
            {key:"count",label:(opts.countLabel||"Trips / sets")+" (optional)",type:"number",inputMode:"numeric"},
            {key:"lbs",label:(opts.loadLabel||"Load")+" in "+(isMetricSystem()?"kilograms":"pounds")+" (required)",type:"number",inputMode:"decimal",required:true},
            {key:"distance",label:"Distance (required)",type:"number",inputMode:"decimal",required:true},
            {key:"distanceUnit",label:"Distance unit (required)",type:"select",options:distanceUnits,required:true},
            {key:"durationMinutes",label:"Duration minutes (optional)",type:"number",inputMode:"numeric"},
            {key:"durationSeconds",label:"Duration seconds (optional)",type:"number",inputMode:"numeric"},
            {key:"recoverySeconds",label:"Recovery seconds (optional)",type:"number",inputMode:"numeric"},
            {key:"effort",label:"Effort (optional)",type:"text"}
          ];
        case "conditioningRounds":
          return [
            {key:"rounds",label:"Rounds (required)",type:"number",inputMode:"numeric",required:true},
            {key:"workMinutes",label:"Work minutes",type:"number",inputMode:"numeric"},
            {key:"workSeconds",label:"Work seconds (required)",type:"number",inputMode:"numeric",required:true},
            {key:"recoverySeconds",label:"Recovery seconds",type:"number",inputMode:"numeric"},
            {key:"note",label:"Notes (optional)",type:"text"}
          ];
        case "activityNotes":
          return [
            {key:"hours",label:"Hours (optional)",type:"number",inputMode:"numeric"},
            {key:"minutes",label:"Minutes (optional)",type:"number",inputMode:"numeric"},
            {key:"seconds",label:"Seconds (optional)",type:"number",inputMode:"numeric"},
            {key:"note",label:"Details / notes (required)",type:"text",required:true}
          ];
        default:
          return [];
      }
    }

    function appendEditor(container,exercise,state,onChange){
      if (!container || !state || !canRender(state.profile)) return false;
      const specs=fields(state.profile,state.profileOptions);
      if (!specs.length) return false;
      const exerciseName=String((exercise&&exercise.name)||"Exercise").replace("[Cardio] ","");

      specs.forEach(spec=>{
        const row=document.createElement("div");
        row.className="srow";

        const label=document.createElement("span");
        label.className="slabel";
        label.textContent=spec.label;

        let input;
        if (spec.type==="select"){
          input=document.createElement("select");
          (spec.options||[]).forEach(optionValue=>{
            const option=document.createElement("option");
            option.value=optionValue;
            option.textContent=optionValue;
            input.appendChild(option);
          });
        } else {
          input=document.createElement("input");
          input.type=spec.type;
          if (spec.inputMode) input.inputMode=spec.inputMode;
          if (spec.type==="number"){
            input.min="0";
            if (["seconds","holdSeconds","workSeconds","durationSeconds"].includes(spec.key)){
              input.max="59";
            }
          }
          if (spec.type==="text"){
            input.style.flex="1";
            input.style.minWidth="0";
          }
        }

        input.className=spec.type==="text" ? "" : "snum";
        input.value=state.typed && state.typed[spec.key]!==undefined ? state.typed[spec.key] : "";
        input.dataset.profileField=spec.key;
        const ariaLabel=spec.label
          .replace(/\s*\([^)]*\)\s*$/,"")
          .replace(/^./,character=>character.toLowerCase());
        input.setAttribute("aria-label",exerciseName+" "+ariaLabel);
        if (spec.required) input.setAttribute("aria-required","true");

        const eventName=spec.type==="select" ? "change" : "input";
        input.addEventListener(eventName,()=>{
          state.typed[spec.key]=input.value;
          if (typeof onChange==="function") onChange(spec.key,input);
        });

        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
      });

      return true;
    }

    return {
      version:data.version,
      assignments:assignments,
      definitions:definitions,
      runtimeContracts:runtimeContracts,
      distanceUnits:distanceUnits,
      resolve:resolve,
      profileDefinition:profileDefinition,
      runtimeContract:runtimeContract,
      canRender:canRender,
      isRowProfile:isRowProfile,
      isKnownSavedType:isKnownSavedType,
      isEditableSavedType:isEditableSavedType,
      blank:blank,
      prefill:prefill,
      hasMeaningful:hasMeaningful,
      validateRows:validateRows,
      validate:validate,
      fromStored:fromStored,
      formatStored:formatStored,
      kind:kind,
      compatible:compatible,
      fields:fields,
      appendEditor:appendEditor,
      clone:clone
    };
  }

  return {createEngine:createEngine};
});
