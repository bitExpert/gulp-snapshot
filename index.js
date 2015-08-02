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
    var oldPathsToHashes = streamStates[1];
    var newPathsToHashes = streamStates[0];
    if (!oldPathsToHashes || !newPathsToHashes) {
        throw new Error('gulp-snapshot: take must be called twice before calling compare');
    }
    return through.obj(passthrough, function flush(done) {
        var diff = {
            addedFiles: [],
            changedFiles: [],
            movedFiles: [],
            copiedFiles: [],
            removedFiles: []
        };
        var oldHashesToPaths = invert(oldPathsToHashes); //not bijective but collisions are checked before use
        var newHashesToPaths = invert(newPathsToHashes);
        var oldPathList = Object.keys(oldPathsToHashes);
        var newPathList = Object.keys(newPathsToHashes);
        var oldHashList = oldPathList.map(function (path) { return oldPathsToHashes[path]; });
        var newHashList = newPathList.map(function (path) { return newPathsToHashes[path]; });
        for (var _i = 0; _i < oldPathList.length; _i++) {
            var oldPath = oldPathList[_i];
            var oldHash = oldPathsToHashes[oldPath];
            var pathRemoved = !newPathsToHashes.hasOwnProperty(oldPath);
            var contentRemoved = !newHashesToPaths.hasOwnProperty(oldHash);
            var hashOccursOnceInOldFiles = containsOne(oldHashList, oldHash);
            var hashOccursOnceInNewFiles = containsOne(newHashList, oldHash);
            var isOneToOneMove = hashOccursOnceInOldFiles && hashOccursOnceInNewFiles;
            if (pathRemoved && contentRemoved) {
                diff.removedFiles.push(oldPath);
                continue;
            }
            if (pathRemoved && !contentRemoved && !isOneToOneMove) {
                diff.removedFiles.push(oldPath);
            }
        }
        for (var _a = 0; _a < newPathList.length; _a++) {
            var newPath = newPathList[_a];
            var newHash = newPathsToHashes[newPath];
            var pathIsNew = !oldPathsToHashes.hasOwnProperty(newPath);
            var contentsAreNew = !oldHashesToPaths.hasOwnProperty(newHash);
            var hashOccursOnceInOldFiles = containsOne(oldHashList, newHash);
            var hashOccursOnceInNewFiles = containsOne(newHashList, newHash);
            var isOneToOneMove = hashOccursOnceInOldFiles && hashOccursOnceInNewFiles;
            if (pathIsNew && isOneToOneMove) {
                var oldPath = oldHashesToPaths[newHash];
                diff.movedFiles.push({ was: oldPath, is: newPath });
                continue;
            }
            if (pathIsNew && !contentsAreNew && !isOneToOneMove) {
                var originalPaths = oldPathList.filter(function (path) { return oldPathsToHashes[path] === newHash; });
                diff.copiedFiles.push({ was: originalPaths, is: newPath });
                continue;
            }
            if (pathIsNew && contentsAreNew) {
                diff.addedFiles.push(newPath);
                continue;
            }
            if (!pathIsNew && contentsAreNew) {
                diff.changedFiles.push(newPath);
            }
        }
        var streamHasAnyChanges = false;
        for (var _b = 0, _c = Object.keys(diff); _b < _c.length; _b++) {
            var collection = _c[_b];
            if (diff[collection].length === 0) {
                delete diff[collection];
            }
            else {
                streamHasAnyChanges = true;
            }
        }
        diff.noChanges = !streamHasAnyChanges;
        resultCallback.call(this, diff);
        done();
    });
}
exports.compare = compare;
function reset() {
    streamStates.length = 0;
}
exports.reset = reset;
