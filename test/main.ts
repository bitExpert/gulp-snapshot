'use strict';
import * as through from 'through2';
import * as assert from 'stream-assert';
import * as snapshot from '../index';
//import replace = require('gulp-replace');
import File = require('vinyl');
import { Transform } from 'stream';
import 'should';

const uniquePath = (function () {
    let i = 0;
    return () => '/home/file/' + i++ + '.txt';
})();

function source(contents: any, path = uniquePath()) {
    const stream: Transform = <any>through.obj();
    stream.push(new File({
        path: path,
        contents: contents
    }));
    stream.push(null);
    return stream;
}

function sourceString(contents: string, path?: string) {
    return source(new Buffer(contents), path);
}

function contentsEqual(expected: string) {
    return function (file: File) {
        file.contents.toString().should.eql(expected);
    };
}

function dropFiles(withPath?: string) {
    return through.obj(function (file, enc, done) {
        if (withPath) {
            if (file.path === withPath) {
                return done();
            }
            this.push(file);
        }
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

it('should add a file to "renamedFiles" collection when path changes and contents do not', done => {
    function changePath(to: string) {
        return through.obj(function (file, enc, done) {
            file.path = to;
            this.push(file);
            done();
        });
    }

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

it('should add a file to "changedFiles" when contents change and path does not', done => {
    function changeContents(to: string) {
        return through.obj(function (file, enc, done) {
            file.contents = new Buffer(to);
            this.push(file);
            done();
        });
    }

    sourceString('hello world', '/home/changeme.txt')
        .pipe(snapshot.take())
        .pipe(changeContents('goodbye world'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.changedFiles[0].should.eql('/home/changeme.txt');
        }))
        .pipe(assert.end(done));
});

it('should add a file to "addedFiles" when new file is present in second snapshot', done => {
    function insertFile(contents: string, path: string) {
        return through.obj(function (file, enc, done) {
            this.push(file);
            done();
        }, <any>function (done: Function) {
            this.push(new File({
                path: path,
                contents: new Buffer(contents)
            }));
            done();
        });
    }

    sourceString('hello world')
        .pipe(snapshot.take())
        .pipe(insertFile('new file', '/home/new.txt'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.addedFiles[0].should.eql('/home/new.txt');
        }))
        .pipe(assert.end(done));
});

it('should add a file to "removedFiles" when a file is removed from second snapshot', done => {
    sourceString('hello world', '/home/deleteme.txt')
        .pipe(snapshot.take())
        .pipe(dropFiles())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.removedFiles[0].should.eql('/home/deleteme.txt');
        }))
        .pipe(assert.end(done));
});


describe('copied files', () => {
    function makeCopies() {
        return through.obj(function (file: File, enc: string, done: Function) {
            this.push(file);
            this.push(new File({
                path: file.path.replace('.', '-Copy.'),
                contents: file.contents
            }));
            done();
        });
    }

    function addAnotherHello(path: string) {
        return through.obj(function (file, enc, done) {
            this.push(file)
            done();
        }, <any>function (done: Function) {
            this.push(new File({
                contents: new Buffer('hello world'),
                path: path
            }));
            done();
        });
    }

    it('should add a file to "copiedFiles" when a file is copied', done => {
        sourceString('hello world', '/home/copyme.txt')
            .pipe(snapshot.take())
            .pipe(makeCopies())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].was[0].should.eql('/home/copyme.txt');
                diff.copiedFiles[0].is.should.eql('/home/copyme-Copy.txt');
            }))
            .pipe(assert.end(done));
    });

    it.skip('should add a file to "removedFiles" when a copy is removed', done => {
        sourceString('hello world', '/home/copyme.txt')
            .pipe(makeCopies())
            .pipe(snapshot.take())
            .pipe(dropFiles('/home/copyme.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.removedFiles.should.eql('/home/copyme.txt');
            }))
            .pipe(assert.end(done));
    });

    it.skip('should supply all sources if a new file matches multiple originals', done => {
        sourceString('hello world', '/home/source-one.txt')
            .pipe(addAnotherHello('/home/source-two.txt'))
            .pipe(snapshot.take())
            .pipe(addAnotherHello('/home/copy.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].is.should.eql('/home/copy.txt')
                diff.copiedFiles[0].was.length.should.eql(2);
                diff.copiedFiles[0].was.should.contain('/home/source-one.txt');
                diff.copiedFiles[0].was.should.contain('/home/source-two.txt');
            }))
            .pipe(assert.end(done));
    });
    
    it.skip('should supply removed sources for a new copy', done => {
        sourceString('hello world', '/home/source-one.txt')
            .pipe(addAnotherHello('/home/source-two.txt'))
            .pipe(snapshot.take())
            .pipe(dropFiles('/home/source-one.txt'))
            .pipe(addAnotherHello('/home/copy.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].was.should.contain('/home/source-one.txt');
            }))
            .pipe(assert.end(done));
    });
});