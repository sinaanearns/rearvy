const fs = require("fs");
const path = "C:/Users/sinaa/rearvy2.0/src/app/(dashboard)/integrations/page.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. Add linkedin to IntegrationSlug type
let old = `type IntegrationSlug =
  | "shopify"
  | "razorpay"
  | "youtube"
  | "instagram"
  | "facebook"
  | "github"
  | "google_analytics"
  | "gmail"
  | "excel";`;
let rep = `type IntegrationSlug =
  | "shopify"
  | "razorpay"
  | "youtube"
  | "instagram"
  | "facebook"
  | "github"
  | "google_analytics"
  | "gmail"
  | "excel"
  | "linkedin";`;
content = content.split(old).join(rep);

// 2. Add linkedin to EMPTY_SYNCED_DATA
old = `  excelRows: 0,
};`;
rep = `  excelRows: 0,
  linkedinPosts: 0,
  linkedinComments: 0,
};`;
content = content.split(old).join(rep);

// 3. Add linkedin to INTEGRATION_CONFIGURATION_HELP
old = `  excel:
    "Server setup required: add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
};`;
rep = `  excel:
    "Server setup required: add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
  linkedin:
    "Server setup required: add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.",
};`;
content = content.split(old).join(rep);

fs.writeFileSync(path, content);
console.log("Step 1-3 done");
console.log("Has linkedin slug:", content.includes('| "linkedin"'));
