# Mudlet Map Binary Reader

Reads Mudlet's map binary file (v20 only!). Can output .js files needed for Mudlet Map Reader.
Mudlet map JSON format is yet unsupported.

*API until version `1.0.0` is subject to change! Use with caution.*

I am no Node developer, so any hints and suggestions are more then welcome.

## TODOs and plans

- [ ] Convert to .ts
- [ ] Document map model
- [ ] Document classes
- [ ] Add Mudlet's JSON exporter
- [ ] Correct QFont read
- [ ] Add test
- [ ] Add linting
## Usage example

```js
const { MudletMapReader } = require("mudlet-map-reader");

const inputFile = "map.data"
const outputDirectory = "output";

let mapModel = MudletMapReader.read(inputFile);
let mudletMapReaderFormat = MudletMapReader.export(mapModel, outputDirectory);
```