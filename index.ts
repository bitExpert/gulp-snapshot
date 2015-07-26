'use strict';
import * as through from 'through2';
import * as crypto from 'crypto';
import * as invert from 'invert-hash';
import File = require('vinyl');

interface IStreamDifference {
    /** Files present in the second snapshot that weren't in the first */
    addedFiles: string[];
    /** Files present in the first snapshot are aren't in the second */
    removedFiles: string[];
    /** Files with the same contents but a changed path */
    movedFiles: { was: string, is: string }[];
    /** Files with the same contents duplicated across multiple paths in the second snapshot */
    duplicatedFiles: string[][];
    /** Files with the same path but changed contents */
    changedFiles: string[];
    /** True if snapshots are identical (all change collections are empty) */
    same: boolean;
}

interface IPathsToHashes {
    [path: string]: string
}

interface IHashesToPaths {
    [hash: string]: string
}

let streamStates: IPathsToHashes[] = [];

export function take() {
    let streamState: IPathsToHashes = {};
    streamStates.unshift(streamState);
    if (streamStates.length > 2) {
        streamStates.length = 2;
    }

    return through.obj(function store(file: File, enc: string, done: Function) {
        let hash = crypto
            .createHash('sha1')
            .update(file.contents) //TODO support stream contents
            .digest('hex');

        streamState[file.path] = hash;

        this.push(file);
        done();
    });
}

function passthrough(file: File, enc: string, done: Function) {
    this.push(file);
    done();
}

export function compare(resultCallback: (difference: IStreamDifference) => void): NodeJS.ReadWriteStream {
    return through.obj(passthrough, <any>function flush(done: Function) {
        let diff: IStreamDifference = {
            addedFiles: [],
            changedFiles: [],
            duplicatedFiles: [],
            movedFiles: [],
            removedFiles: [],
            same: null
        };

        let oldFiles = streamStates[1];
        let newFiles = streamStates[0];
        let oldHashes = invert<IPathsToHashes, IHashesToPaths>(oldFiles);
        let newHashes = invert<IPathsToHashes, IHashesToPaths>(newFiles);
        
        for (let oldPath of Object.keys(oldFiles)) {
            //check for deletions
        }
        
        for (let newPath of Object.keys(newFiles)) {
            let newHash = newFiles[newPath];
            if (!oldFiles.hasOwnProperty(newPath) && oldHashes.hasOwnProperty(newHash)) {
                let oldPath = oldHashes[newHash];
                diff.movedFiles.push({
                    was: oldPath,
                    is: newPath
                });
            }
        }

        resultCallback(diff);
        done();
    });
}

export function reset() {
    streamStates = [];
}
