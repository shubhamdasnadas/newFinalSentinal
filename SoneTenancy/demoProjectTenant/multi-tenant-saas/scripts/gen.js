const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "../app/components/SentinelOneDashboard.tsx");
fs.writeFileSync(out, "// generated");
console.log("done");
