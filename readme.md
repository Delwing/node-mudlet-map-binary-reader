Reads Mudlet's map binary file. Can output .js files needed for Mudlet Map Reader

I am no Node developer, so any hints and suggestions are more then welcome.

Usage example

```js
const fs = require("fs")

const input = "input_map.data"
const outputDirectory = "output";

const reader = require("./map-reader");
const exporter = require("./reader-export");

let mapData = reader(input);
let mapConverted = exporter(mapData, output);
```