const {
  boot,
  check,
  summary,
  wait,
  EXISTING_CFG,
  EMPTY_DATA
}=require("./harness");

const fs=require("fs");
const path=require("path");

(async ()=>{
const completeItems=[
  {
    text:"Nutrition Facts",
    score:0.99,
    poly:[
      [0,0],
      [300,0],
      [300,40],
      [0,40]
    ]
  },
  {
    text:"Serving size 2/3 cup (55g)",
    score:0.98,
    poly:[
      [0,50],
      [500,50],
      [500,90],
      [0,90]
    ]
  },
  {
    text:"Calories 230",
    score:0.99,
    poly:[
      [0,100],
      [300,100],
      [300,145],
      [0,145]
    ]
  },
  {
    text:"Total Fat 8g 10%",
    score:0.97,
    poly:[
      [0,150],
      [350,150],
      [350,190],
      [0,190]
    ]
  },
  {
    text:"Total Carbohydrate 37g 13%",
    score:0.96,
    poly:[
      [0,200],
      [550,200],
      [550,240],
      [0,240]
    ]
  },
  {
    text:"Protein 3g",
    score:0.98,
    poly:[
      [0,250],
      [250,250],
      [250,290],
      [0,290]
    ]
  }
];

let createCalls=0;
let initializeCalls=0;
let predictCalls=0;
let createOptions=null;
let predictInput=null;
let predictOptions=null;

const App=boot(
  EXISTING_CFG,
  EMPTY_DATA,
  window=>{
    window.WebAssembly={};

    window.BlackPyrePaddleOCR={
      PaddleOCR:{
        create:async options=>{
          createCalls++;
          createOptions=options;

          return {
            initialize:async ()=>{
              initializeCalls++;

              return {
                elapsedMs:120,
                backend:"wasm",
                detProvider:"wasm",
                recProvider:"wasm",
                assets:[1,2]
              };
            },

            predict:async (
              input,
              options
            )=>{
              predictCalls++;
              predictInput=input;
              predictOptions=options;

              return [{
                image:{
                  width:1280,
                  height:900
                },

                items:
                  completeItems,

                metrics:{
                  detMs:310,
                  recMs:490,
                  totalMs:800,
                  detectedBoxes:6,
                  recognizedCount:6
                },

                runtime:{
                  backend:"wasm"
                }
              }];
            },

            dispose:()=>{}
          };
        }
      }
    };
  }
);

const W=App.window;
const D=W.document;

W.eval(`
nutritionLabelPrepareCanvas=async function(){
  return {
    width:1280,
    height:900,
    dataset:{
      blackpyrePrepared:"true"
    }
  };
};
`);

check(
  "supported browser exposes PaddleOCR scanner",
  W.eval(
    "nutritionLabelScannerCapability().available"
  )===true
  && W.eval(
    "nutritionLabelScannerCapability().mode"
  )==="paddle-browser"
  && !D
    .getElementById(
      "labelScanBtn"
    )
    .classList
    .contains("hidden")
);

check(
  "unit-only nutrient values are rejected",
  W.eval(
    'nutritionLabelSanitizeCoreValue("protein","g")'
  )===null
  && W.eval(
    'nutritionLabelSanitizeCoreValue("carbs","grams")'
  )===null
  && W.eval(
    'nutritionLabelSanitizeCoreValue("fat","%")'
  )===null
);

check(
  "numeric nutrient values remain usable",
  W.eval(
    'nutritionLabelSanitizeCoreValue("calories","100")'
  )===100
  && W.eval(
    'nutritionLabelSanitizeCoreValue("protein","3g")'
  )===3
  && W.eval(
    'nutritionLabelSanitizeCoreValue("carbs","19 g")'
  )===19
);

const UnitOnlyProtein=
  W.eval(`
    nutritionLabelParsePaddleResult({
      items:[
        {
          text:"Protein g",
          score:0.9,
          poly:[
            [0,0],
            [120,0],
            [120,30],
            [0,30]
          ]
        }
      ]
    })
  `);

check(
  "Paddle parser rejects unit-only protein",
  UnitOnlyProtein.protein===null
);

const input=
  D.getElementById(
    "labelScanFile"
  );

Object.defineProperty(
  input,
  "files",
  {
    configurable:true,

    value:[
      new W.File(
        ["nutrition label"],
        "label.jpg",
        {
          type:"image/jpeg"
        }
      )
    ]
  }
);

input.dispatchEvent(
  new W.Event(
    "change",
    {
      bubbles:true
    }
  )
);

await wait(200);

check(
  "scanner initializes and predicts once",
  createCalls===1
  && initializeCalls===1
  && predictCalls===1
);

check(
  "scanner selects PP-OCRv6 tiny models",
  createOptions
  && createOptions.initialize===false
  && createOptions.worker===false
  && createOptions.textDetectionModelName
    ==="PP-OCRv6_tiny_det"
  && createOptions.textRecognitionModelName
    ==="PP-OCRv6_tiny_rec"
);

check(
  "scanner uses same-origin local model archives",
  new URL(
    createOptions
      .textDetectionModelAsset
      .url
  ).origin
    ==="https://example.com"
  && new URL(
    createOptions
      .textRecognitionModelAsset
      .url
  ).origin
    ==="https://example.com"
  && /PP-OCRv6_tiny_det_onnx_infer\.tar$/
    .test(
      createOptions
        .textDetectionModelAsset
        .url
    )
  && /PP-OCRv6_tiny_rec_onnx_infer\.tar$/
    .test(
      createOptions
        .textRecognitionModelAsset
        .url
    )
);

check(
  "scanner uses local single-threaded SIMD WASM",
  createOptions
    .ortOptions
    .backend==="wasm"
  && createOptions
    .ortOptions
    .numThreads===1
  && createOptions
    .ortOptions
    .simd===true
  && new URL(
    createOptions
      .ortOptions
      .wasmPaths
  ).origin
    ==="https://example.com"
  && /vendor\/paddleocr\/ort\/$/
    .test(
      createOptions
        .ortOptions
        .wasmPaths
    )
);

check(
  "scanner disables the ONNX Runtime proxy",
  createOptions
  && createOptions.ortOptions
  && createOptions.ortOptions.proxy===false
);

check(
  "scanner sends one prepared image no larger than 1280 pixels",
  predictInput
  && Number(
    predictInput.width
  )<=1280
  && Number(
    predictInput.height
  )<=1280
  && predictInput.dataset
  && predictInput.dataset
    .blackpyrePrepared
    ==="true"
);

check(
  "scanner uses one tuned OCR prediction",
  predictOptions
  && predictOptions
    .textDetLimitSideLen
    ===1280
  && predictOptions
    .textDetLimitType
    ==="max"
  && predictOptions
    .textRecScoreThresh
    ===0.2
);

check(
  "Paddle geometry preserves Calories 230",
  D.getElementById(
    "mCal"
  ).value==="230"
);

check(
  "Paddle scan fills protein carbohydrates and fat",
  D.getElementById(
    "mPro"
  ).value==="3"
  && D.getElementById(
    "mCarb"
  ).value==="37"
  && D.getElementById(
    "mFat"
  ).value==="8"
);

check(
  "Paddle scan fills serving information",
  D.getElementById(
    "mServingLabel"
  ).value==="2/3 cup (55g)"
  && D.getElementById(
    "mServingAmount"
  ).value==="55"
  && D.getElementById(
    "mServingUnit"
  ).value==="g"
);

check(
  "scanner displays an end-to-end scan time",
  /scan finished in [0-9.]+ seconds/i
    .test(
      D.getElementById(
        "labelScanStatus"
      ).textContent
    )
);

check(
  "food name stays editable and nothing logs automatically",
  D.getElementById(
    "mName"
  ).value===""
  && D.getElementById(
    "mName"
  ).disabled===false
  && W.eval(
    "Object.values(data.food).flat().length"
  )===0
);

D.getElementById(
  "mName"
).value=
  "Paddle scanned cereal";

D.getElementById(
  "manualUseBtn"
).click();

check(
  "Paddle scan opens at one serving",
  D.getElementById(
    "qtyUnit"
  ).value==="serving"
  && D.getElementById(
    "calcCal"
  ).textContent==="230"
);

D.getElementById(
  "qtyAmount"
).value="0.5";

D.getElementById(
  "qtyAmount"
).dispatchEvent(
  new W.Event(
    "input",
    {
      bubbles:true
    }
  )
);

check(
  "half serving preserves decimal nutrition",
  D.getElementById(
    "calcCal"
  ).textContent==="115"
  && D.getElementById(
    "calcPro"
  ).textContent==="1.5"
  && D.getElementById(
    "calcCarb"
  ).textContent==="18.5"
  && D.getElementById(
    "calcFat"
  ).textContent==="4"
);

D.getElementById(
  "addSelBtn"
).click();

check(
  "food logs only after Add to log",
  W.eval(
    "Object.values(data.food).flat().length"
  )===1
);

function makePaddleBoot(
  items,
  totalMs
){
  return boot(
    EXISTING_CFG,
    EMPTY_DATA,
    window=>{
      window.WebAssembly={};

      window.BlackPyrePaddleOCR={
        PaddleOCR:{
          create:async ()=>({
            initialize:
              async ()=>({
                elapsedMs:10,
                backend:"wasm",
                assets:[1,2]
              }),

            predict:
              async ()=>[{
                items,
                metrics:{
                  totalMs
                }
              }],

            dispose:()=>{}
          })
        }
      };
    }
  );
}

const Partial=
  makePaddleBoot(
    [
      {
        text:"Calories 230",
        score:0.95,
        poly:[
          [0,0],
          [250,0],
          [250,40],
          [0,40]
        ]
      },
      {
        text:"Total Fat 8g",
        score:0.94,
        poly:[
          [0,50],
          [250,50],
          [250,90],
          [0,90]
        ]
      }
    ],
    650
  );

Partial.window.eval(`
nutritionLabelPrepareCanvas=async function(){
  return {
    width:1000,
    height:700,
    dataset:{
      blackpyrePrepared:"true"
    }
  };
};
`);

const partialInput=
  Partial.window.document
    .getElementById(
      "labelScanFile"
    );

Object.defineProperty(
  partialInput,
  "files",
  {
    configurable:true,

    value:[
      new Partial.window.File(
        ["partial"],
        "partial.jpg",
        {
          type:"image/jpeg"
        }
      )
    ]
  }
);

partialInput.dispatchEvent(
  new Partial.window.Event(
    "change",
    {
      bubbles:true
    }
  )
);

await wait(170);

check(
  "partial Paddle result is shown instead of rejected",
  Partial.window.document
    .getElementById(
      "mCal"
    ).value==="230"
  && Partial.window.document
    .getElementById(
      "mFat"
    ).value==="8"
  && Partial.window.document
    .getElementById(
      "mPro"
    ).value===""
  && Partial.window.document
    .getElementById(
      "mCarb"
    ).value===""
  && /missing protein, carbohydrates/i.test(
    Partial.window.document
      .getElementById(
        "labelScanStatus"
      )
      .textContent
  )
);

check(
  "partial Paddle result logs nothing automatically",
  Partial.window.eval(
    "Object.values(data.food).flat().length"
  )===0
);

const Empty=
  makePaddleBoot(
    [],
    400
  );

Empty.window.eval(`
nutritionLabelPrepareCanvas=async function(){
  return {
    width:900,
    height:600,
    dataset:{
      blackpyrePrepared:"true"
    }
  };
};
`);

const emptyInput=
  Empty.window.document
    .getElementById(
      "labelScanFile"
    );

Object.defineProperty(
  emptyInput,
  "files",
  {
    configurable:true,

    value:[
      new Empty.window.File(
        ["empty"],
        "empty.jpg",
        {
          type:"image/jpeg"
        }
      )
    ]
  }
);

emptyInput.dispatchEvent(
  new Empty.window.Event(
    "change",
    {
      bubbles:true
    }
  )
);

await wait(170);

check(
  "empty Paddle result leaves manual fields open",
  /no nutrition values were read clearly/i.test(
    Empty.window.document
      .getElementById(
        "labelScanStatus"
      )
      .textContent
  )
  && Empty.window.document
    .getElementById(
      "mName"
    ).disabled===false
  && Empty.window.document
    .getElementById(
      "mCal"
    ).disabled===false
);

check(
  "fuzzy carbohydrate recovery remains available",
  W.eval(`
    nutritionLabelDirectTextValues(
      "Calories 230\\n"
      +"Total Fat 8g\\n"
      +"Total Carbohyd rate 37g\\n"
      +"Protein 3g"
    ).carbs
  `)===37
);

const root=
  path.join(
    __dirname,
    ".."
  );

const source=
  fs.readFileSync(
    path.join(
      root,
      "scripts/02-food.js"
    ),
    "utf8"
  );

const scanner=
  source.slice(
    source.indexOf(
      "// ================== PHASE 2.1: "
      +"NUTRITION-LABEL SCANNER =================="
    ),

    source.indexOf(
      "// --- camera barcode scanning"
    )
  );


{
  // BLACKPYRE_PHYSICAL_OCR_RECOVERY_FIXTURE
  const physicalRecoveryFs=
    require("fs");

  const physicalRecoveryVm=
    require("vm");

  const physicalRecoverySource=
    physicalRecoveryFs.readFileSync(
      "scripts/02-food.js",
      "utf8"
    );

  const physicalRecoveryStart=
    physicalRecoverySource.indexOf(
      "function nutritionLabelOcrComparableWord("
    );

  const physicalRecoveryEnd=
    physicalRecoverySource.indexOf(
      "function nutritionLabelStatus(message, isError){"
    );

  const physicalRecoveryContext={};

  let physicalRecoveryLoaded=false;
  let physicalFixturePassed=false;
  let unitOnlyFixturePassed=false;
  let existingZeroFixturePassed=false;

  if (
    physicalRecoveryStart!==-1
    && physicalRecoveryEnd
      >physicalRecoveryStart
  ){
    physicalRecoveryVm.createContext(
      physicalRecoveryContext
    );

    physicalRecoveryVm.runInContext(
      physicalRecoverySource.slice(
        physicalRecoveryStart,
        physicalRecoveryEnd
      ),
      physicalRecoveryContext
    );

    const repair=
      physicalRecoveryContext
        .nutritionLabelRepairParsedOcrValues;

    physicalRecoveryLoaded=
      typeof repair==="function";

    if (physicalRecoveryLoaded){
      const physicalFixture={
        servingLabel:
          "1bar (70g) Trans Fat Og 3% Total Carbohydrate 19g",

        servingAmount:70,
        servingUnit:"g",
        calories:100,
        protein:null,
        carbs:19,
        fat:1,

        ocrLines:[
          {
            text:"Serving size",
            confidence:90.653,
            x:72,
            y:262,
            width:182,
            height:78
          },
          {
            text:"1bar (70g)",
            confidence:89.9846,
            x:54,
            y:294,
            width:180,
            height:96
          },
          {
            text:"Total Carbohydrate 19g",
            confidence:95.0358,
            x:886,
            y:303,
            width:341,
            height:104
          },
          {
            text:"Proteln 3g",
            confidence:88.5528,
            x:867,
            y:517,
            width:169,
            height:57
          }
        ]
      };

      repair(physicalFixture);

      physicalFixturePassed=
        physicalFixture.protein===3
        && physicalFixture.servingLabel
          ==="1 bar (70 g)"
        && physicalFixture.carbs===19
        && physicalFixture.fat===1
        && physicalFixture.calories===100;

      const unitOnlyFixture={
        protein:null,

        ocrLines:[
          {
            text:"Proteln g",
            confidence:99,
            x:0,
            y:0,
            width:100,
            height:30
          }
        ]
      };

      repair(unitOnlyFixture);

      unitOnlyFixturePassed=
        unitOnlyFixture.protein===null;

      const existingZeroFixture={
        protein:0,

        ocrLines:[
          {
            text:"Proteln 3g",
            confidence:99,
            x:0,
            y:0,
            width:100,
            height:30
          }
        ]
      };

      repair(existingZeroFixture);

      existingZeroFixturePassed=
        existingZeroFixture.protein===0;
    }
  }

  check(
    "physical Proteln OCR recovers Protein 3 g and a bounded serving label",
    physicalRecoveryLoaded
      && physicalFixturePassed
  );

  check(
    "unit-only malformed protein remains rejected",
    physicalRecoveryLoaded
      && unitOnlyFixturePassed
  );

  check(
    "existing Protein 0 g remains valid during OCR recovery",
    physicalRecoveryLoaded
      && existingZeroFixturePassed
  );

  check(
    "temporary physical scanner diagnostics are removed",
    !physicalRecoverySource.includes(
      "nutritionLabelRenderTemporaryDiagnostics"
    )
    && !physicalRecoverySource.includes(
      "labelScanDiagnostics"
    )
    && !physicalRecoverySource.includes(
      "__blackPyreLastNutritionLabelDiagnostic"
    )
  );
}

check(
  "scanner contains PaddleOCR and no Tesseract implementation",
  /PaddleOCR\.create/.test(
    scanner
  )
  && /ocr\.predict/.test(
    scanner
  )
  && /paddleocr-entry\.js/.test(
    scanner
  )
  && !/Tesseract|tesseract|createWorker|eng\.traineddata/
    .test(scanner)
);

check(
  "scanner contains no timeout or fallback OCR pass",
  !/BlackPyreOcrTimeout|RecognizeWithTimeout|Trying one final|inverted/
    .test(scanner)
);

check(
  "scanner sends the photo only to browser inference",
  !/FormData|XMLHttpRequest|fetch\s*\(\s*file|upload/i
    .test(scanner)
);

check(
  "scanner source contains no remote runtime URL",
  !/\bhttps?:\/\//i.test(
    scanner
  )
);

check(
  "failed Tesseract directories are removed",
  !fs.existsSync(
    path.join(
      root,
      "vendor/tesseract"
    )
  )
  && !fs.existsSync(
    path.join(
      root,
      "vendor/tesseract-core"
    )
  )
  && !fs.existsSync(
    path.join(
      root,
      "vendor/tesseract-lang"
    )
  )
);

check(
  "local Paddle module models and WASM exist",
  fs.existsSync(
    path.join(
      root,
      "vendor/paddleocr/paddleocr-entry.js"
    )
  )
  && fs.existsSync(
    path.join(
      root,
      "vendor/paddleocr/models/"
      +"PP-OCRv6_tiny_det_onnx_infer.tar"
    )
  )
  && fs.existsSync(
    path.join(
      root,
      "vendor/paddleocr/models/"
      +"PP-OCRv6_tiny_rec_onnx_infer.tar"
    )
  )
  && fs.readdirSync(
    path.join(
      root,
      "vendor/paddleocr/ort"
    )
  ).some(name=>
    /^ort-wasm.*\.wasm$/.test(
      name
    )
  )
);

const ortAssetNames=
  fs.readdirSync(
    path.join(
      root,
      "vendor/paddleocr/ort"
    )
  );

const ortWasmNames=
  ortAssetNames.filter(name=>
    /^ort-wasm.*\.wasm$/.test(name)
  );

check(
  "every local ONNX Runtime WASM has a matching module loader",
  ortWasmNames.length===1
  && ortWasmNames.every(name=>
    ortAssetNames.includes(
      name.replace(/\.wasm$/,".mjs")
    )
  )
);

const paddleJavascript=
  [
    path.join(
      root,
      "vendor/paddleocr/paddleocr-entry.js"
    ),

    ...fs.readdirSync(
      path.join(
        root,
        "vendor/paddleocr/assets"
      )
    )
      .filter(name=>
        name.endsWith(".js")
      )
      .map(name=>
        path.join(
          root,
          "vendor/paddleocr/assets",
          name
        )
      )
  ]
    .map(file=>
      fs.readFileSync(
        file,
        "utf8"
      )
    )
    .join("\n");

check(
  "Safari runtime uses standard WASM and excludes JSEP",
  ortAssetNames.includes(
    "ort-wasm-simd-threaded.wasm"
  )
  && ortAssetNames.includes(
    "ort-wasm-simd-threaded.mjs"
  )
  && !ortAssetNames.some(name=>
    /jsep|jspi|asyncify/i.test(name)
  )
  && !/ort-wasm-simd-threaded\.jsep|ort\.bundle\.min/i
    .test(paddleJavascript)
);

check(
  "scanner includes a sixty-second initialization watchdog",
  /nutritionLabelPaddleWithTimeout/.test(scanner)
  && /60000/.test(scanner)
  && /did not finish within 60 seconds/.test(scanner)
);

check(
  "scanner automatically finds crops straightens and enhances the panel",
  /nutritionLabelFindPanelBounds/.test(
    scanner
  )
  && /nutritionLabelEstimatePanelRotation/.test(
    scanner
  )
  && /nutritionLabelEnhancePreparedCanvas/.test(
    scanner
  )
  && /blackpyreAutoCropped/.test(
    scanner
  )
  && /textDetLimitSideLen:1280/.test(
    scanner
  )
);

const sw=
  fs.readFileSync(
    path.join(
      root,
      "sw.js"
    ),
    "utf8"
  );

check(
  "service worker uses Paddle cache and removes Tesseract",
  /blackpyre-v84-paddle-10/.test(
    sw
  )
  && !/vendor\/tesseract/.test(
    sw
  )
);

const faq=
  fs.readFileSync(
    path.join(
      root,
      "data-faq.js"
    ),
    "utf8"
  );

check(
  "FAQ explains free local processing and first-use loading",
  /free, open-source PaddleOCR engine/.test(
    faq
  )
  && /scanner files stored in BlackPyre/.test(
    faq
  )
  && /first use may take longer/.test(
    faq
  )
  && /not uploaded or saved/.test(
    faq
  )
);

const index=
  fs.readFileSync(
    path.join(
      root,
      "index.html"
    ),
    "utf8"
  );

const scripts=[
  ...index.matchAll(
    /<script src="([^"]+)"><\/script>/g
  )
].map(match=>
  match[1]
);

check(
  "PaddleOCR preserves the approved fourteen-script order",
  scripts.length===14
  && !scripts.some(source=>
    /paddle|tesseract/i.test(
      source
    )
  )
);

summary(
  "PHASE 2.1 WEB LABEL SCANNER"
);
})().catch(error=>{
  console.error(error);
  process.exit(1);
});
