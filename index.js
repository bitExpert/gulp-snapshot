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
    return through.obj(function store(file, enc, fileDone) {
        if (file.isNull()) {
            this.push(file);
            return fileDone();
        }
        var hash = crypto.createHash('sha1');
        if (file.isBuffer()) {
            streamState[file.path] = hash.update(file.contents).digest('hex');
            this.push(file);
            return fileDone();
        }
        if (file.isStream()) {
            file.pipe(through(function (chunk, enc, chunkDone) {
                hash.update(chunk, enc);
                this.push(chunk);
                chunkDone();
            }, function (contentsDone) {
                streamState[file.path] = hash.digest('hex');
                contentsDone();
                fileDone();
            }));
            this.push(file);
        }
    });
}
exports.take = take;
function passthrough(file, enc, done) {
    this.push(file);
    done();
}
function containsOne(array, element) {
    return array.filter(function (v) { return element === v; }).length === 1;
}
function compare(resultCallback) {
    return through.obj(passthrough, function flush(done) {
        var diff = {
            addedFiles: [],
            changedFiles: [],
            movedFiles: [],
            copiedFiles: [],
            removedFiles: [],
            same: null
        };
        var oldFiles = streamStates[1];
        var newFiles = streamStates[0];
        var oldHashes = invert(oldFiles); //not bijective but collisions are checked before use
        var newHashes = invert(newFiles);
        var oldHashList = Object.keys(oldFiles).map(function (path) { return oldFiles[path]; });
        var newHashList = Object.keys(newFiles).map(function (path) { return newFiles[path]; });
        for (var _i = 0, _a = Object.keys(oldFiles); _i < _a.length; _i++) {
            var oldPath = _a[_i];
            var oldHash = oldFiles[oldPath];
            var pathRemoved = !newFiles.hasOwnProperty(oldPath);
            var contentRemoved = !newHashes.hasOwnProperty(oldHash);
            var hashOccursOnceInOldFiles = containsOne(oldHashList, oldHash);
            var hashOccursOnceInNewFiles = containsOne(newHashList, oldHash);
            var isOneToOneMove = hashOccursOnceInOldFiles && hashOccursOnceInNewFiles;
            if (pathRemoved && contentRemoved) {
                diff.removedFiles.push(oldPath);
                break;
            }
            if (pathRemoved && !contentRemoved && !isOneToOneMove) {
                diff.removedFiles.push(oldPath);
            }
        }
        for (var _b = 0, _c = Object.keys(newFiles); _b < _c.length; _b++) {
            var newPath = _c[_b];
            var newHash = newFiles[newPath];
            var pathIsNew = !oldFiles.hasOwnProperty(newPath);
            var contentsAreNew = !oldHashes.hasOwnProperty(newHash);
            var hashOccursOnceInOldFiles = containsOne(oldHashList, newHash);
            var hashOccursOnceInNewFiles = containsOne(newHashList, newHash);
            var isOneToOneMove = hashOccursOnceInOldFiles && hashOccursOnceInNewFiles;
            if (pathIsNew && isOneToOneMove) {
                var oldPath = oldHashes[newHash];
                diff.movedFiles.push({ was: oldPath, is: newPath });
                break;
            }
            if (pathIsNew && !contentsAreNew && !isOneToOneMove) {
                var originalPaths = Object.keys(oldFiles).filter(function (path) { return oldFiles[path] === newHash; });
                diff.copiedFiles.push({ was: originalPaths, is: newPath });
                break;
            }
            if (pathIsNew && contentsAreNew) {
                diff.addedFiles.push(newPath);
                break;
            }
            if (!pathIsNew && contentsAreNew) {
                diff.changedFiles.push(newPath);
            }
        }
        diff.same =
            diff.addedFiles.length === 0 &&
                diff.changedFiles.length === 0 &&
                diff.copiedFiles.length === 0 &&
                diff.movedFiles.length === 0 &&
                diff.removedFiles.length === 0;
        resultCallback(diff);
        done();
    });
}
exports.compare = compare;
function reset() {
    streamStates.length = 0;
}
exports.reset = reset;
