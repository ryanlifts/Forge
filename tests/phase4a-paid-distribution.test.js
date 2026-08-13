const fs=require("fs");

let passed=0;
let failed=0;
function check(name,condition){
  if(condition){ passed+=1; console.log("PASS: "+name); }
  else{ failed+=1; console.error("FAIL: "+name); }
}

const packet=fs.readFileSync("BLACKPYRE-PHASE-04A-PAID-DISTRIBUTION.md","utf8");
const plan=fs.readFileSync("BLACKPYRE-APP-STORE-READINESS-PHASED-PLAN.md","utf8");
const shipping=[
  "package.json",
  "index.html",
  ...fs.readdirSync("scripts").filter(name=>name.endsWith(".js")).map(name=>"scripts/"+name)
].map(file=>fs.readFileSync(file,"utf8")).join("\n");

check("Phase 4a is commercial setup only",/commercial setup only/i.test(plan));
check("one-time paid download is explicit",/one-time paid download/i.test(packet));
check("every feature remains included",/every feature included/i.test(packet));
check("United States-only launch is recorded",/Initial storefront:\*\* United States only/.test(packet));
check("launch price is approved by Ryan",/US \$14\.99/.test(packet)&&/approved by Ryan/i.test(packet));
check("agreement banking tax and Small Business gates are recorded",
  /Paid Apps Agreement/.test(packet)&&/primary bank account/.test(packet)
  &&/U\.S\. tax form/.test(packet)&&/Small Business Program/.test(packet));
check("private financial and tax values are excluded from version control",
  /never add those values to this repository/i.test(packet)&&/Do not record bank numbers/.test(packet));
check("shipping source has no purchase or subscription machinery",
  !/StoreKit|restore purchases|receipt validation|subscription product|paywall/i.test(shipping));

console.log(`\nPHASE 4A PAID DISTRIBUTION: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
