'use strict';
import * as through from 'through2';
import * as assert from 'stream-assert';
import * as hasChanged from '../index';
import replace = require('gulp-replace');
import File = require('vinyl');
import { Transform } from 'stream';
import 'should';

let source = (function () {
    let i = 0;
    return function (contents: any) {
        const stream: Transform = <any>through.obj();
        stream.push(new File({
            path: '/home/file/' + i + '.txt',
            contents: contents
        }));
        stream.push(null);
        return stream;
    }
})();

function sourceString(contents: string) {
    return source(new Buffer(contents));
}

function contentsEqual(expected: string) {
    return function (file: File) {
        file.contents.toString().should.eql(expected);
    };
}

it('should not touch stream contents', done => {
    sourceString('hello world')
        .pipe(hasChanged.snapshot())
        .pipe(hasChanged.compare())
        .pipe(assert.length(1))
        .pipe(assert.first(contentsEqual('hello world')))
        .pipe(assert.end(done));
});

it('should provide empty array to callback when states match', done => {
    sourceString('hello world')
        .pipe(hasChanged.snapshot())
        .pipe(hasChanged.compare(differences => {
            differences.length.should.eql(0);
        }))
        .pipe(assert.end(done));
});