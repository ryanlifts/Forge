// BlackPyre web v85 nutrition-label scanner removal contract.
const {
  check,
  summary
} = require("./harness");

const fs = require("fs");

const html =
  fs.readFileSync(
    "index.html",
    "utf8"
  );

const food =
  fs.readFileSync(
    "scripts/02-food.js",
    "utf8"
  );

const faq =
  fs.readFileSync(
    "data-faq.js",
    "utf8"
  );

const sw =
  fs.readFileSync(
    "sw.js",
    "utf8"
  );

check(
  "nutrition-label scanner UI does not ship",
  !/labelScanBtn|labelScanFile|labelScanStatus|Scan nutrition label/.test(
    html
  )
);

check(
  "nutrition-label scanner implementation does not ship",
  !/nutritionLabel|PaddleOCR|paddleocr|NUTRITION_LABEL|PP-OCR/.test(
    food
  )
);

check(
  "nutrition-label scanner FAQ does not ship",
  !/How does nutrition-label scanning work|Scan nutrition label|PaddleOCR/.test(
    faq
  )
);

check(
  "barcode camera scanner still ships",
  /id="scanBtn"/.test(html)
  && /id="barcodeInput"/.test(html)
  && /id="barcodeBtn"/.test(html)
  && /function loadScannerLib\(\)/.test(food)
  && /async function runBarcode\(\)/.test(food)
  && /html5-qrcode/.test(sw)
);

check(
  "PaddleOCR is absent from service worker",
  !/PaddleOCR|paddleocr|PP-OCR/.test(sw)
);

check(
  "v85 no-label-scanner cache is active",
  /blackpyre-v103/.test(sw)
);

check(
  "PaddleOCR vendor directory is removed",
  !fs.existsSync(
    "vendor/paddleocr"
  )
);

summary(
  "PHASE 2.1 WEB LABEL SCANNER REMOVAL"
);
