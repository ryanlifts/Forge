// Weight time-of-day and proprietary copyright regression suite.
const fs = require("fs");
const path = require("path");
const { boot, EXISTING_CFG, EMPTY_DATA } = require("./harness");

let passed=0, failed=0;
const failures=[];
function check(name,condition){
  if(condition) passed++;
  else { failed++; failures.push(name); console.error("  FAIL:",name); }
}

const root=path.join(__dirname,"..");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const readme=fs.readFileSync(path.join(root,"README.md"),"utf8");
const license=fs.readFileSync(path.join(root,"LICENSE"),"utf8");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");

check("root proprietary license identifies the owner and reserves all rights",
  /^BlackPyre\nCopyright \(c\) 2026 Ryan Allen Wilsey\. All rights reserved\./.test(license)
  && /Viewing this source does not grant any license to use it\./.test(license)
  && /THE SOFTWARE IS PROVIDED "AS IS"/.test(license));
check("page source begins with the traveling copyright notice",
  index.startsWith("<!--\n  BlackPyre\n  Copyright (c) 2026 Ryan Allen Wilsey. All rights reserved.\n  Proprietary. Unauthorized copying, modification, or distribution is prohibited.\n  See LICENSE for terms.\n-->\n<!DOCTYPE html>"));
check("README carries the proprietary notice beneath its title",
  /^# Forge\n\n© 2026 Ryan Allen Wilsey\. All rights reserved\. Proprietary — see LICENSE\./.test(readme));
check("Settings ends with the muted copyright notice",
  /id="appCopyright"[^>]*>© 2026 Ryan Allen Wilsey\. All rights reserved\.<\/div>/.test(index));
check("service worker uses the v113 release cache",/const CACHE = "blackpyre-v113";/.test(sw));
check("Weight entry includes an accessible time-of-day control",
  /type="time" id="wtTime" aria-label="Weigh-in time"/.test(index));
check("Weight date and time share a contained two-column row",
  /\.weigh-in-datetime\s*\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[^}]*gap:18px;[^}]*max-width:100%;/.test(index)
  && /\.weigh-in-datetime > div \{ min-width:0; width:100%; max-width:100%; \}/.test(index)
  && /\.weigh-in-datetime input\s*\{[^}]*-webkit-appearance:none; appearance:none;[^}]*min-width:0; width:100%; max-width:100%;/.test(index)
  && /<div class="weigh-in-datetime">\s*<div><div class="label">Date<\/div><input type="date" id="wtDate"/.test(index)
  && !/<div id="cardioBlock"[^>]*>\s*<div class="weigh-in-datetime">/.test(index));

const app=boot(EXISTING_CFG,EMPTY_DATA);
const doc=app.window.document;
check("new weigh-ins default to a valid local time",
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(doc.getElementById("wtTime").value));

doc.getElementById("wtDate").value="2026-08-08";
doc.getElementById("wtTime").value="14:35";
doc.getElementById("wtVal").value="201.4";
doc.getElementById("addWtBtn").click();
check("recorded weigh-in persists its date, time, and weight",
  app.window.eval(`data.weights.length===1 && data.weights[0].date==="2026-08-08" && data.weights[0].time==="14:35" && data.weights[0].lbs===201.4`)
  && JSON.parse(app.window.localStorage.getItem("forge:data")).weights[0].time==="14:35");
check("weight history displays the recorded local time",
  doc.getElementById("wtList").textContent.includes(app.window.eval(`formatWeighInTime("14:35")`)));

doc.getElementById("wtTime").value="18:05";
doc.getElementById("wtVal").value="200.8";
doc.getElementById("addWtBtn").click();
check("same-date replacement updates time without creating a duplicate day",
  app.window.eval(`data.weights.length===1 && data.weights[0].time==="18:05" && data.weights[0].lbs===200.8`));

doc.querySelector("#wtList .delWt").click();
check("deleting a timed weigh-in removes the correct day",app.window.eval(`data.weights.length===0`));
doc.getElementById("undoBtn").click();
check("Undo restores the weigh-in time with the entry",
  app.window.eval(`data.weights.length===1 && data.weights[0].date==="2026-08-08" && data.weights[0].time==="18:05"`));

app.window.eval(`data.weights=[{date:"2026-08-07",lbs:202}]; renderWeight();`);
check("legacy date-only weigh-ins remain readable",
  doc.getElementById("wtList").textContent.includes("202")
  && !doc.getElementById("wtList").textContent.includes("undefined"));

app.window.eval(`data.weights=[]`);
doc.getElementById("dashWtInput").value="199.6";
doc.getElementById("dashWtBtn").click();
check("Home quick weigh-in records the current time automatically",
  app.window.eval(`data.weights.length===1 && /^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(data.weights[0].time)`));

app.window.close();
console.log(`\nWEIGHT TIME + COPYRIGHT: ${passed} passed, ${failed} failed`);
if(failed) console.log("failures:",failures.join(" | "));
process.exit(failed?1:0);
