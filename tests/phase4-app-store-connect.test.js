const fs=require("fs");
const crypto=require("crypto");

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
const screenshotReadme=fs.readFileSync("APP-STORE-SCREENSHOTS/README.md","utf8");
const screenshotManifest=fs.readFileSync("APP-STORE-SCREENSHOTS/MANIFEST.sha256","utf8");
const screenshotSeed=fs.readFileSync("scripts/prepare-app-store-screenshots.js","utf8");

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
const screenshotNames=[
  "01-home.jpg",
  "02-food.jpg",
  "03-barcode-verification.jpg",
  "04-train.jpg",
  "05-rest-timer.jpg",
  "06-weight.jpg",
  "07-apple-health.jpg",
  "08-data-recovery.jpg"
];
function jpegDimensions(buffer){
  if(buffer[0]!==0xff||buffer[1]!==0xd8) return null;
  let offset=2;
  while(offset+8<buffer.length){
    if(buffer[offset]!==0xff){ offset+=1; continue; }
    const marker=buffer[offset+1];
    if(marker===0xd9||marker===0xda) break;
    const length=buffer.readUInt16BE(offset+2);
    if(length<2) return null;
    if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
      return {height:buffer.readUInt16BE(offset+5),width:buffer.readUInt16BE(offset+7)};
    }
    offset+=2+length;
  }
  return null;
}
const screenshotChecks=screenshotNames.map(name=>{
  const relative="iphone-6.9/"+name;
  const file="APP-STORE-SCREENSHOTS/"+relative;
  if(!fs.existsSync(file)) return false;
  const bytes=fs.readFileSync(file);
  const dimensions=jpegDimensions(bytes);
  const digest=crypto.createHash("sha256").update(bytes).digest("hex");
  return dimensions&&dimensions.width===1320&&dimensions.height===2868
    &&screenshotManifest.includes(digest+"  "+relative);
});
check("6.9-inch App Store screenshot master set is complete and checksummed",
  screenshotChecks.every(Boolean)
  &&/JPEG, no alpha channel/.test(screenshotReadme)
  &&/fictional screenshot-only profile/.test(screenshotReadme));
check("screenshot seed is simulator-only and cannot target RAW",
  /Pass an iOS Simulator UDID/.test(screenshotSeed)
  &&/\/CoreSimulator\/Devices\//.test(screenshotSeed)
  &&!/RAW/.test(screenshotSeed));
check("Phase 4 records resolved U.S. launch and continued web support",
  /\*\*Status:\*\* COMPLETE/.test(packet)
  &&/Initial country and region: United States only/.test(packet)
  &&/Web disposition: keep the web app live/.test(packet));
check("FAQ explains partial Apple Health availability",/Why is Apple Health showing only some data\?/.test(faq) && /each permission works independently/i.test(faq));
check("FAQ explains Health sources and revocation safety",/Apple Watch, compatible scale, or another app/.test(faq) && /revoked Health access never deletes your BlackPyre history/.test(faq));
check("FAQ never compares native and web apps",!/native iPhone app|web app|browser version|website version/i.test(faq));

console.log(`\nPHASE 4 APP STORE CONNECT: ${passed} passed, ${failed} failed`);
if(failed) process.exit(1);
