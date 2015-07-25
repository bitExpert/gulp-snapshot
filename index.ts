'use strict';
import * as through from 'through2';
import File = require('vinyl');

export function snapshot() {
    return through.obj(function (file: File, enc: string, done: Function) {

        done(null, file);
    });
}

export function compare(resultCallback?: (differences: any[]) => void) {
    return through.obj(function (file: File, enc: string, done: Function) {

        if (resultCallback) {
            resultCallback([])
        }

        done(null, file);
    });
}
