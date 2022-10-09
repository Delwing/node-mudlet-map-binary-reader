module.exports = {
    MudletMapReader : {
        read: require("./map-operations").readMap,
        write: require("./map-operations").writeMap,
        export: require("./reader-export"),
        exportJson: require('./json-export')
    }
};
