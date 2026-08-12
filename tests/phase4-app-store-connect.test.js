const fs=require("fs");

let passed=0;
let failed=0;
function check(name,condition){
  if(condition){ passed+=1; console.log("PASS:",name); }
  else { failed+=1; console.error("FAIL:",name); }
}

const plist=fs.readFileSync("ios/App/App/Info.plist","utf8");
const packet=fs.readFileSync("BLACKPYRE-PHASE-04-APP-STORE-CONNECT.md","utf8");
const privacy=fs.readFileSync("privacy.html","utf8");
const support=fs.readFileSync("support.html","utf8");
const notices=fs.readFileSync("third-party-notices.html","utf8");
const faq=fs.readFileSync("data-faq.js","utf8");

const subtitle="Nutrition & Training, Forged";
const promotional="Track nutrition, training, weight, measurements, water, and Apple Health data—privately, locally, and without a BlackPyre account.";
const keywords="nutrition,calorie,macros,protein,workout,strength,weight,fitness,food,water,health";

check("export compliance declaration is explicit",/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(plist));
check("App Store subtitle fits 30 characters",[...subtitle].length<=30);
check("promotional text fits 170 characters",[...promotional].length<=170);
check("keyword list fits 100 UTF-8 bytes",Buffer.byteLength(keywords,"utf8")<=100);
check("packet includes required privacy URL",packet.includes("https://ryanlifts.github.io/Forge/privacy.html"));
check("packet includes required support URL",packet.includes("https://ryanlifts.github.io/Forge/support.html"));
check("privacy policy is iOS-specific",/BlackPyre for iOS Privacy Policy/.test(privacy));
check("privacy policy covers optional Apple Health",/Apple Health access is optional/.test(privacy));
check("privacy policy covers complete local deletion",/Erase all BlackPyre data/.test(privacy));
check("support page explains recovery before uninstall",/do not uninstall/i.test(support));
check("Open Food Facts rights are attributed",/Open Database License \(ODbL\)/.test(notices));
check("review notes include seven native capabilities",/1\. Apple Health/.test(packet) && /2\. Camera barcode scanning/.test(packet) && /3\. Rest timer Live Activity/.test(packet) && /4\. Local notifications/.test(packet) && /5\. Files backup\/import\/share/.test(packet) && /6\. Offline operation/.test(packet) && /7\. Native Vault/.test(packet));
check("review notes state no account",/No sign-in is required/.test(packet) && /no account exists/.test(packet));
check("regulated medical-device answer is recorded",/Declare \*\*No\*\* for the U\.S\., EU\/EEA, and UK/.test(packet));
check("13 plus age override is recorded",/Override to Higher Age Rating: 13\+/.test(packet));
check("fictional-data screenshot rule is explicit",/Use fictional data only/.test(packet) && /Never capture RAW's personal data/.test(packet));
check("FAQ explains partial Apple Health availability",/Why is Apple Health showing only some data\?/.test(faq) && /each permission works independently/i.test(faq));
check("FAQ explains Health sources and revocation safety",/Apple Watch, compatible scale, or another app/.test(faq) && /revoked Health access never deletes your BlackPyre history/.test(faq));
check("FAQ never compares native and web apps",!/native iPhone app|web app|browser version|website version/i.test(faq));

console.log(`\nPHASE 4 APP STORE CONNECT: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
