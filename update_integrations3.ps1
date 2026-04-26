const fs = require("fs");
const path = "C:/Users/sinaa/rearvy2.0/src/app/(dashboard)/integrations/page.tsx";
let content = fs.readFileSync(path, "utf8");

// 11. Add LinkedIn integration config object after excel config
let old = `    ],
  },
};

export default function IntegrationsPage() {`;
let rep = `    ],
  },
  linkedin: {
    title: "LinkedIn",
    subtitle: "Track professional network activity and engagement",
    description:
      "Connect your LinkedIn account so Rearvy can analyze your posts, engagement metrics, and professional network growth.",
    category: "Social",
    capabilityType: "Interactive",
    website: "linkedin.com",
    connectLabel: "Connect LinkedIn",
    isComingSoon: false,
    previewChats: [
      {
        user: "@LinkedIn which posts got the most engagement this week?",
        reply: "Your post \"Career Growth Tips\" received the highest engagement with 245 reactions and 38 comments. Text-only posts are outperforming links.",
      },
      {
        user: "@LinkedIn how is my network growing?",
        reply: "You gained 127 connections this week (+3.2%). Your strongest growth came from tech and startup industries.",
      },
      {
        user: "@LinkedIn which content topics resonate most with my audience?",
        reply: "Career development and industry insights posts receive 2.3x more engagement than promotional content.",
      },
    ],
  },
};

export default function IntegrationsPage() {`;
content = content.split(old).join(rep);

fs.writeFileSync(path, content);
console.log("Step 11 done");
console.log("Has linkedin config:", content.includes("linkedin: {"));
