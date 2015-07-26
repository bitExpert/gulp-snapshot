'use strict';
import * as through from 'through2';
import * as assert from 'stream-assert';
import * as snapshot from '../index';
//import replace = require('gulp-replace');
import File = require('vinyl');
import { Transform } from 'stream';
import 'should';

let source = (function () {
    let i = 0;
    return function (contents: any) {
        const stream: Transform = <any>through.obj();
        stream.push(new File({
            path: '/home/file/' + i++ + '.txt',
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

function changePath(to: string) {
    return through.obj(function (file, enc, done) {
        file.path = to;
        this.push(file);
        done();
    });
}

function changeContents(to: string) {
    return through.obj(function (file, enc, done) {
        file.contents = new Buffer(to);
        this.push(file);
        done();
    });
}

it('should not touch stream contents', done => {
    sourceString('hello world')
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(_ => _))
        .pipe(assert.length(1))
        .pipe(assert.first(contentsEqual('hello world')))
        .pipe(assert.end(done));
});

it.skip('should provide a "none" property of true when states match', done => {
    sourceString('hello world')
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.same.should.eql(true);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "moved" collection when path changes', done => {
    sourceString('hello world')
        .pipe(changePath('/old/file.txt'))
        .pipe(snapshot.take())
        .pipe(changePath('/new/file.txt'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.movedFiles[0].was.should.eql('/old/file.txt');
            diff.movedFiles[0].is.should.eql('/new/file.txt');
        }))
        .pipe(assert.end(done));
});

