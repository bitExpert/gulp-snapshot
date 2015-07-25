'use strict';
var through = require('through2');
function snapshot() {
    return through.obj(function (file, enc, done) {
        done(null, file);
    });
}
exports.snapshot = snapshot;
function compare(resultCallback) {
    return through.obj(function (file, enc, done) {
        if (resultCallback) {
            resultCallback([]);
        }
        done(null, file);
    });
}
exports.compare = compare;
