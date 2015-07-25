'use strict';
import * as through from 'through2';
import File = require('vinyl');

export default function () {
    return through.obj(function (file: File, enc: string, done: Function) {

        this.push(file);
        return done();
    });
}
