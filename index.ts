'use strict';
import * as through from 'through2';
import * as crypto from 'crypto';
import * as invert from 'invert-hash';
import File = require('vinyl');

export interface IStreamDifference {
    /** Files present in the second snapshot that weren't in the first */
    addedFiles: string[];
    /** Files present in the first snapshot that aren't in the second */
    removedFiles: string[];
    /** Files with the same unique contents but a changed path */
    movedFiles: { was: string, is: string }[];
    /** Files with the same non-unique contents given a new path */
    copiedFiles: { was: string[], is: string }[];
    /** Files with the same path but changed contents */
    changedFiles: string[];
    /** True if snapshots are identical (all change collections are empty) */
    noChanges: boolean;
}

interface IPathsToHashes {
    [path: string]: string
}

interface IHashesToPaths {
    [hash: string]: string
}

const streamStates: IPathsToHashes[] = [];

export function take() {
    const streamState: IPathsToHashes = {};
    streamStates.unshift(streamState);
    if (streamStates.length > 2) {
        streamStates.length = 2;
    }

    return through.obj(function store(file: File, enc: string, fileDone: Function) {
        if (file.isNull()) {
            this.push(file);
            return fileDone();
        }

        const hash = crypto.createHash('sha1');

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
            }, <any>function (contentsDone: Function) {
                streamState[file.path] = hash.digest('hex');
                contentsDone();
                fileDone();
            }));
            this.push(file);
        }
    });
}

function passthrough(file: File, enc: string, done: Function) {
    this.push(file);
    done();
}

function containsOne<T>(array: T[], element: T): boolean {
    return array.filter(v => element === v).length === 1;
}

export function compare(resultCallback: (difference: IStreamDifference) => void): NodeJS.ReadWriteStream {
    const oldPathsToHashes = streamStates[1];
    const newPathsToHashes = streamStates[0];
    if (!oldPathsToHashes || !newPathsToHashes) {
        throw new Error('gulp-snapshot: take must be called twice before calling compare');
    }

    return through.obj(passthrough, <any>function flush(done: Function) {
        const diff: IStreamDifference = {
            addedFiles: [],
            changedFiles: [],
            movedFiles: [],
            copiedFiles: [],
            removedFiles: [],
            noChanges: null
        };
        
        const oldHashesToPaths = invert<IPathsToHashes, IHashesToPaths>(oldPathsToHashes); //not bijective but collisions are checked before use
        const newHashesToPaths = invert<IPathsToHashes, IHashesToPaths>(newPathsToHashes);
        const oldPathList = Object.keys(oldPathsToHashes);
        const newPathList = Object.keys(newPathsToHashes);
        const oldHashList = oldPathList.map(path => oldPathsToHashes[path]);
        const newHashList = newPathList.map(path => newPathsToHashes[path]);
        
        for (const oldPath of oldPathList) {
            const oldHash = oldPathsToHashes[oldPath];
            const pathRemoved = !newPathsToHashes.hasOwnProperty(oldPath);
            const contentRemoved = !newHashesToPaths.hasOwnProperty(oldHash);
            const hashOccursOnceInOldFiles = containsOne(oldHashList, oldHash);
            const hashOccursOnceInNewFiles = containsOne(newHashList, oldHash);
            const isOneToOneMove = hashOccursOnceInOldFiles && hashOccursOnceInNewFiles;

            if (pathRemoved && contentRemoved) {
                diff.removedFiles.push(oldPath);
                continue;
            }

            if (pathRemoved && !contentRemoved && !isOneToOneMove) {
                diff.removedFiles.push(oldPath);
            }
        }
        
        for (const newPath of newPathList) {
            var newHash = newPathsToHashes[newPath];
            const pathIsNew = !oldPathsToHashes.hasOwnProperty(newPath);
            const contentsAreNew = !oldHashesToPaths.hasOwnProperty(newHash);
            const hashOccursOnceInOldFiles = containsOne(oldHashList, newHash);
            const hashOccursOnceInNewFiles = containsOne(newHashList, newHash);
            const isOneToOneMove = hashOccursOnceInOldFiles && hashOccursOnceInNewFiles;

            if (pathIsNew && isOneToOneMove) {
                const oldPath = oldHashesToPaths[newHash];
                diff.movedFiles.push({ was: oldPath, is: newPath });
                continue;
            }
            
            if (pathIsNew && !contentsAreNew && !isOneToOneMove) {
                const originalPaths = oldPathList.filter(path => oldPathsToHashes[path] === newHash);
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

        diff.noChanges =
            diff.addedFiles.length === 0 &&
            diff.changedFiles.length === 0 &&
            diff.copiedFiles.length === 0 &&
            diff.movedFiles.length === 0 &&
            diff.removedFiles.length === 0

        resultCallback(diff);
        done();
    });
}

export function reset() {
    streamStates.length = 0;
}
