const fs = require("fs");
let content = fs.readFileSync("electron/ipc/strategy-ipc.ts", "utf8");

// Fix the specific damaged section by rewriting it directly
const searchStr = "K线数据不足（需要至";
const replaceStr = "K线数据不足（需要至少50根），请确认 OpenD 已连接";

const idx = content.indexOf(searchStr);
if (idx >= 0) {
  // Find end of this string (closing single quote)
  let endIdx = content.indexOf("'", idx + 30);
  if (endIdx < 0) endIdx = content.indexOf(";", idx + 30);
  if (endIdx >= 0) {
    content = content.substring(0, idx) + replaceStr + content.substring(endIdx);
    fs.writeFileSync("electron/ipc/strategy-ipc.ts", content, "utf8");
    console.log("String repaired");
  }
} else {
  console.log("Already fixed or not found");
}
