const fs = require('fs')

const input = process.argv[2];
if (!input) {
  console.error("Input file not supplied.");
  process.exit(1);
}

const output = process.argv[3] ? process.argv[3] : "output";
if (!fs.existsSync(output)) {
    fs.mkdirSync(output)
}

const reader = require("./map-reader");
const exporter = require("./reader-export");

let mapData = reader(input);
let mapDataClone = JSON.parse(JSON.stringify(mapData));
let mapConverted = exporter(mapDataClone, output);