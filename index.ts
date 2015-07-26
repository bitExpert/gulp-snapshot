'use strict';
import * as through from 'through2';
import * as crypto from 'crypto';
import File = require('vinyl');

interface IStreamDifference {
    /** Files present in the second snapshot that weren't in the first */
    addedFiles?: string[];
    /** Files present in the first snapshot are aren't in the second */
    removedFiles?: string[];
    /** Files with the same contents but a changed path */
    movedFiles?: string[];
    /** Files with the same contents duplicated across multiple paths in the second snapshot */
    duplicated?: string[];
    /** Files with the same path but changed contents */
    changedFiles?: string[];
}

interface IFileHashes {
    [path: string]: string
}

let streamStates: IFileHashes[] = [];

export function reset() {
    streamStates = [];
}

export function take() {
    let streamState: IFileHashes = {};
    streamStates.unshift(streamState);
    if (streamStates.length > 2) {
        streamStates.length = 2;
    }

    return through.obj(function (file: File, enc: string, done: Function) {
        let hash = crypto
            .createHash('sha1')
            .update(file.contents) //TODO support stream contents
            .digest('hex');

        streamState[file.path] = hash;

        this.push(file);
        done();
    });
}

export function compare(resultCallback: (difference: IStreamDifference) => any): NodeJS.ReadWriteStream {
    return through.obj(function(file: File, enc: string, done: Function) {
        this.push(file);
        done();
    }, <any>function (done: Function) {
        let diff: IStreamDifference = {};
        
        for (let oldFile of Object.keys(streamStates[1])) {
            
            for (let newFile of Object.keys(streamStates[0])) {

            }
        }

        resultCallback(diff);
        done();
    });
}
