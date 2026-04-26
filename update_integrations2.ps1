const fs = require("fs");
const path = "C:/Users/sinaa/rearvy2.0/src/app/(dashboard)/integrations/page.tsx";
let content = fs.readFileSync(path, "utf8");

// 4. Add linkedin to successMessages
let old = `      excel_connected: "Excel connected successfully! Click Sync Now to import workbook data.",
    };`;
let rep = `      excel_connected: "Excel connected successfully! Click Sync Now to import workbook data.",
      linkedin_connected: "LinkedIn connected successfully! Data sync in progress.",
    };`;
content = content.split(old).join(rep);

// 5. Add linkedin state variables
old = `  const [excelDisconnecting, setExcelDisconnecting] = useState(false);`;
rep = `  const [excelDisconnecting, setExcelDisconnecting] = useState(false);
  const [liConnecting, setLiConnecting] = useState(false);
  const [liSyncing, setLiSyncing] = useState(false);
  const [liDisconnecting, setLiDisconnecting] = useState(false);`;
content = content.split(old).join(rep);

// 6. Add linkedin to setSyncingMap
old = `      excel: setExcelSyncing,
    };`;
rep = `      excel: setExcelSyncing,
      linkedin: setLiSyncing,
    };`;
content = content.split(old).join(rep);

// 7. Add linkedin to setDisconnectingMap
old = `      excel: setExcelDisconnecting,
    };`;
rep = `      excel: setExcelDisconnecting,
      linkedin: setLiDisconnecting,
    };`;
content = content.split(old).join(rep);

// 8. Add linkedin to setConnectingMap
old = `      excel: setExcelConnecting,
    };`;
rep = `      excel: setExcelConnecting,
      linkedin: setLiConnecting,
    };`;
content = content.split(old).join(rep);

// 9. Add linkedin to isConnecting check
old = `    (detailsSlug === "excel" && excelConnecting);`;
rep = `    (detailsSlug === "excel" && excelConnecting) ||
    (detailsSlug === "linkedin" && liConnecting);`;
content = content.split(old).join(rep);

// 10. Add linkedin to isSyncing check
old = `    (detailsSlug === "excel" && excelSyncing);`;
rep = `    (detailsSlug === "excel" && excelSyncing) ||
    (detailsSlug === "linkedin" && liSyncing);`;
content = content.split(old).join(rep);

fs.writeFileSync(path, content);
console.log("Steps 4-10 done");
console.log("Has linkedin_connected:", content.includes("linkedin_connected"));
console.log("Has liConnecting:", content.includes("setLiConnecting"));
