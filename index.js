'use strict';
var through = require('through2');
var crypto = require('crypto');
var invert = require('invert-hash');
var streamStates = [];
function take() {
    var streamState = {};
    streamStates.unshift(streamState);
    if (streamStates.length > 2) {
        streamStates.length = 2;
    }
    return through.obj(function store(file, enc, done) {
        var hash = crypto
            .createHash('sha1')
            .update(file.contents) //TODO support stream contents
            .digest('hex');
        streamState[file.path] = hash;
        this.push(file);
        done();
    });
}
exports.take = take;
function passthrough(file, enc, done) {
    this.push(file);
    done();
}
function compare(resultCallback) {
    return through.obj(passthrough, function flush(done) {
        var diff = {
            addedFiles: [],
            changedFiles: [],
            duplicatedFiles: [],
            movedFiles: [],
            removedFiles: [],
            same: null
        };
        var oldFiles = streamStates[1];
        var newFiles = streamStates[0];
        var oldHashes = invert(oldFiles);
        var newHashes = invert(newFiles);
        for (var _i = 0, _a = Object.keys(oldFiles); _i < _a.length; _i++) {
            var oldPath = _a[_i];
            var oldHash = oldFiles[oldPath];
            if (!newFiles.hasOwnProperty(oldPath) && !newHashes.hasOwnProperty(oldHash)) {
                diff.removedFiles.push(oldPath);
            }
        }
        for (var _b = 0, _c = Object.keys(newFiles); _b < _c.length; _b++) {
            var newPath = _c[_b];
            var newHash = newFiles[newPath];
            if (!oldFiles.hasOwnProperty(newPath)) {
                if (oldHashes.hasOwnProperty(newHash)) {
                    var oldPath = oldHashes[newHash];
                    diff.movedFiles.push({
                        was: oldPath,
                        is: newPath
                    });
                }
                else {
                    diff.addedFiles.push(newPath);
                }
            }
        }
        resultCallback(diff);
        done();
    });
}
exports.compare = compare;
function reset() {
    streamStates.length = 0;
}
exports.reset = reset;
