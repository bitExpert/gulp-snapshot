'use strict';
import * as through from 'through2';
import File = require('vinyl');

interface IFileState {
    path: string
    hash: string
};

let firstState: IFileState[] = [];
let secondState: IFileState[] = [];
let capture = (function () {
    return function (collection: IFileState[], flush?: any) {
        return through.obj(function (file: File, enc: string, done: Function) {
            collection.push({
                hash: 'abc123',
                path: file.path
            });
            done(null, file);
        }, flush);
    }
})();

export function snapshot() {
    return capture(firstState);
}

export function compare(resultCallback?: (differences: any[]) => void) {
    return capture(secondState, function(done: Function) {
        if (resultCallback) {
            resultCallback([]);
        }
        done();
    });
}
