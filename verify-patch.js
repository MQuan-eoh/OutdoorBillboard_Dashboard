const fs = require("fs");
const code = fs.readFileSync("build-renderer.js", "utf8");
const snippets = ["UV", "Nhiệt độ", "PM2.5"];
snippets.forEach((s) => {
  const index = code.indexOf('}, "' + s + '"');
  console.log("--- " + s + " ---");
  console.log(code.substring(index - 100, index + 250));
});
