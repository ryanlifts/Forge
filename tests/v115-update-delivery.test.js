const fs=require("fs"),path=require("path");
let passed=0,failed=0;
function check(name,ok){
  if(ok){ passed++; console.log("PASS: "+name); }
  else { failed++; console.log("FAIL: "+name); }
}
const root=path.join(__dirname,"..");
const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
const boot=fs.readFileSync(path.join(root,"scripts","07-boot.js"),"utf8");
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
const update=fs.readFileSync(path.join(root,"update.html"),"utf8");

check(
  "v115 navigations use network-first no-store delivery",
  /e\.request\.mode === "navigate"/.test(sw)
  &&/fetch\(e\.request,\{cache:"no-store"\}\)/.test(sw)
);

check(
  "v115 navigation retains offline app-shell fallback",
  /cached \|\| caches\.match\("\.\/index\.html"\)/.test(sw)
);

check(
  "v115 service-worker registration uses release-specific URL and bypasses HTTP cache",
  /register\("sw\.js\?v=web-v117-removal-state-1",\{updateViaCache:"none"\}\)/.test(boot)
);

check(
  "v115 explicitly checks service worker for updates",
  /function requestServiceWorkerUpdate\(registration\)/.test(boot)
  &&/registration\.update\(\)/.test(boot)
);

check(
  "v115 rechecks updates when the PWA becomes active",
  /window\.addEventListener\("pageshow", checkPwaUpdate\)/.test(boot)
  &&/window\.addEventListener\("focus", checkPwaUpdate\)/.test(boot)
  &&/document\.visibilityState==="visible"/.test(boot)
);

check(
  "v115 rescue page forces a fresh app entry without touching storage",
  /blackpyre-update="\+Date\.now\(\)/.test(update)
  &&!/localStorage|sessionStorage|indexedDB|caches\.delete|unregister\(/.test(update)
);

check(
  "v115 runtime and cache family are version-busted",
  /blackpyre-v117-removal-state-1/.test(sw)
  &&/scripts\/07-boot\.js\?v=web-v117-removal-state-1/.test(index)
);

check(
  "v115 retains existing update notification behavior",
  /controllerchange/.test(boot)
  &&/showUpdateToast\(\)/.test(boot)
  &&/updateReloadBtn/.test(boot)
);

console.log("");
console.log("V115 UPDATE DELIVERY: "+passed+" passed, "+failed+" failed");
if(failed) process.exit(1);
