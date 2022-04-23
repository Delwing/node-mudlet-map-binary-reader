# Mudlet Map Binary Reader

[![NPM](https://nodei.co/npm/mudlet-map-binary-reader.png)](https://nodei.co/npm/mudlet-map-binary-reader/)

Reads Mudlet's map binary file (v20 only!). Can output .js files needed for Mudlet Map Reader.
Mudlet map JSON format is yet unsupported.

*API until version `1.0.0` is subject to change! Use with caution.*

I am no Node developer, so any hints and suggestions are more then welcome.

## TODOs and plans

- [ ] Convert to .ts
- [X] Document map model
- [ ] Document classes
- [X] Add Mudlet's JSON exporter
- [X] Correct QFont read
- [ ] Add test
- [ ] Add linting
## Usage example

```js
const { MudletMapReader } = require("mudlet-map-binary-reader");

const inputFile = "map.dat"
const outputDirectory = "output";

let mapModel = MudletMapReader.read(inputFile);

// Export to map renderer format and save to .js and .json files https://github.com/Delwing/js-mudlet-map-renderer
let { mudletMap, colors } = MudletMapReader.export(mapModel, outputDirectory);

// Export as Mudlet Json map
const outputFile = 'file.json'
let mudletJsonFormat = MudletMapReader.exportJson(mapModel, outputFile)

//Modify and save binary
mapModel.rooms[1].name = "Funny name!"
MudletMapReader.write(mapModel, inputFile)
```