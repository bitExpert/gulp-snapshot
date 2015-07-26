'use strict';
import * as through from 'through2';
import * as crypto from 'crypto';
import File = require('vinyl');

interface IFileState {
    path: string
    hash: string
}

let streamStates: IFileState[][] = [];

export function reset() {
    streamStates = [];
}

export function take() {
    let streamState: IFileState[] = [];
    streamStates.unshift(streamState);
    if (streamStates.length > 2) {
        streamStates.length = 2;
    }

    return through.obj(function (file: File, enc: string, done: Function) {
        let hash = crypto
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

export function compare(resultCallback: (differences: any[]) => any): NodeJS.ReadWriteStream {
    return through.obj(function(file: File, enc: string, done: Function) {
        this.push(file);
        done();
    }, <any>function (done: Function) {
        let newer = streamStates[0][0];
        let older = streamStates[1][0];

        let result: any[] = [];

        if (newer.hash !== older.hash || newer.path !== older.path) {
            result = ['something'];
        }

        resultCallback(result);
        done();
    });
}
