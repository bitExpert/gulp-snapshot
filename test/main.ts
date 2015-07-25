'use strict';
import * as through from 'through2';
import * as assert from 'stream-assert';
import File = require('vinyl');
import { Transform } from 'stream';
import hasChanged from '../index';
import 'should';

function testRaw(contents: any) {
    const stream: Transform = <any>through.obj();
    stream.push(new File({ contents: contents }));
    stream.push(null);
    return stream;
}

function testObject(object: any) {
    return testRaw(new Buffer(JSON.stringify(object)));
}

function contentsEqual(expected: string) {
    return function (file: File) {
        file.contents.toString().should.eql(expected);
    };
}

it('should pass files', done => {
    testRaw(null)
        .pipe(hasChanged())
        .pipe(assert.length(1))
        .pipe(assert.end(done));
});