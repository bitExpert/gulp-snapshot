'use strict';
var through = require('through2');
var crypto = require('crypto');
var streamStates = [];
function reset() {
    streamStates = [];
}
exports.reset = reset;
function take() {
    var streamState = [];
    streamStates.unshift(streamState);
    if (streamStates.length > 2) {
        streamStates.length = 2;
    }
    return through.obj(function (file, enc, done) {
        var hash = crypto
            .createHash('sha1')
            .update(file.contents) //TODO support stream contents
            .digest('hex');
        streamState.push({
            hash: hash,
            path: file.path
        });
        this.push(file);
        done();
    });
}
exports.take = take;
function compare(resultCallback) {
    return through.obj(function (file, enc, done) {
        this.push(file);
        done();
    }, function (done) {
        var newer = streamStates[0][0];
        var older = streamStates[1][0];
        var result = [];
        if (newer.hash !== older.hash || newer.path !== older.path) {
            result = ['something'];
        }
        resultCallback(result);
        done();
    });
}
exports.compare = compare;
