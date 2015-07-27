'use strict';
import * as through from 'through2';
import * as assert from 'stream-assert';
import * as snapshot from '../index';
import * as mut from './mutators';
import { sourceBuffer, sourceStream } from './sources';
import File = require('vinyl');
import 'should';

function contentsEqual(expected: string) {
    return function (file: File) {
        file.contents.toString().should.eql(expected);
    };
}

it('should not touch stream contents', done => {
    sourceBuffer('hello world')
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(_ => _))
        .pipe(assert.length(1))
        .pipe(assert.first(contentsEqual('hello world')))
        .pipe(assert.end(done));
});

it('should provide a "same" property of true when states match', done => {
    sourceBuffer('hello world')
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.same.should.eql(true);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "movedFiles" collection when path changes and contents do not', done => {
    sourceBuffer('hello world')
        .pipe(mut.changePath('/old/file.txt'))
        .pipe(snapshot.take())
        .pipe(mut.changePath('/new/file.txt'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.movedFiles[0].was.should.eql('/old/file.txt');
            diff.movedFiles[0].is.should.eql('/new/file.txt');
        }))
        .pipe(assert.end(done));
});

it('should add a file to "changedFiles" when contents change and path does not', done => {
    sourceBuffer('hello world', '/home/changeme.txt')
        .pipe(snapshot.take())
        .pipe(mut.changeBufferContents('goodbye world'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.changedFiles[0].should.eql('/home/changeme.txt');
        }))
        .pipe(assert.end(done));
});

it('should add a file to "addedFiles" when new file is present in second snapshot', done => {
    sourceBuffer('hello world')
        .pipe(snapshot.take())
        .pipe(mut.insertFile('new file', '/home/new.txt'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.addedFiles[0].should.eql('/home/new.txt');
        }))
        .pipe(assert.end(done));
});

it('should add a file to "removedFiles" when a file is removed from second snapshot', done => {
    sourceBuffer('hello world', '/home/deleteme.txt')
        .pipe(snapshot.take())
        .pipe(mut.dropFiles())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.removedFiles[0].should.eql('/home/deleteme.txt');
        }))
        .pipe(assert.end(done));
});

describe('streamed files', () => {
    it('should detect matching states', done => {
        sourceStream(['hello ', 'world', '!'])
            .pipe(snapshot.take())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.same.should.eql(true);
            }))
            .pipe(assert.end(done));
    });

    it('should detect changes', done => {
        sourceStream(['hello', 'world', '!'], '/home/stream.txt')
            .pipe(snapshot.take())
            .pipe(mut.changeStreamContents(['goodbye ', 'stream']))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.changedFiles[0].should.eql('/home/stream.txt');
            }))
            .pipe(assert.end(done));
    });
});

describe('copied files', () => {
    it('should add a file to "copiedFiles" when a file is copied', done => {
        sourceBuffer('hello world', '/home/copyme.txt')
            .pipe(snapshot.take())
            .pipe(mut.makeCopies())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].was[0].should.eql('/home/copyme.txt');
                diff.copiedFiles[0].is.should.eql('/home/copyme-Copy.txt');
            }))
            .pipe(assert.end(done));
    });

    it('should add a file to "removedFiles" when a copy is removed', done => {
        sourceBuffer('hello world', '/home/copyme.txt')
            .pipe(mut.makeCopies())
            .pipe(snapshot.take())
            .pipe(mut.dropFiles('/home/copyme.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.removedFiles[0].should.eql('/home/copyme.txt');
            }))
            .pipe(assert.end(done));
    });

    it('should supply all sources if a new file matches multiple originals', done => {
        sourceBuffer('hello world', '/home/source-one.txt')
            .pipe(mut.addHello('/home/source-two.txt'))
            .pipe(snapshot.take())
            .pipe(mut.addHello('/home/copy.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].is.should.eql('/home/copy.txt')
                diff.copiedFiles[0].was.length.should.eql(2);
                diff.copiedFiles[0].was.should.containEql('/home/source-one.txt');
                diff.copiedFiles[0].was.should.containEql('/home/source-two.txt');
            }))
            .pipe(assert.end(done));
    });
    
    it('should supply removed sources for a new copy', done => {
        sourceBuffer('hello world', '/home/source-one.txt')
            .pipe(mut.addHello('/home/source-two.txt'))
            .pipe(snapshot.take())
            .pipe(mut.dropFiles('/home/source-one.txt'))
            .pipe(mut.addHello('/home/copy.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].was.should.containEql('/home/source-one.txt');
            }))
            .pipe(assert.end(done));
    });

    it('should mark as copy if all sources are dropped', done => {
        sourceBuffer('hello world', '/home/source-one.txt')
            .pipe(mut.addHello('/home/source-two.txt'))
            .pipe(snapshot.take())
            .pipe(mut.dropFiles())
            .pipe(mut.addHello('/home/copy.txt'))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].is.should.eql('/home/copy.txt');
                diff.copiedFiles[0].was.should.containEql('/home/source-one.txt');
                diff.copiedFiles[0].was.should.containEql('/home/source-two.txt');
            }))
            .pipe(assert.end(done));
    });
});