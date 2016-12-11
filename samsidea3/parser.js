var fs = require("fs");

var k = JSON.stringify(fs.readFileSync("people.json").toString())
console.log(k)
