'use strict';
var through = require('through2');
;
var firstState = [];
var secondState = [];
var capture = (function () {
    return function (collection, flush) {
        return through.obj(function (file, enc, done) {
            collection.push({
                hash: 'abc123',
                path: file.path
            });
            done(null, file);
        }, flush);
    };
})();
function snapshot() {
    return capture(firstState);
}
exports.snapshot = snapshot;
function compare(resultCallback) {
    return capture(secondState, function (done) {
        if (resultCallback) {
            resultCallback([]);
        }
        done();
    });
}
exports.compare = compare;
