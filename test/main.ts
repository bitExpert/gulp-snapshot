'use strict';
import * as through from 'through2';
import * as assert from 'stream-assert';
import * as snapshot from '../index';
import * as mut from './mutators';
import { sourceHelloBuffer, sourceStream } from './sources';
import File = require('vinyl');
import * as should from 'should';

function contentsEqual(expected: string) {
    return function (file: File) {
        file.contents.toString().should.eql(expected);
    };
}

const helloWorld = 'hello world';

it('should not touch stream contents', done => {
    sourceHelloBuffer()
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(_ => _))
        .pipe(assert.length(1))
        .pipe(assert.first(contentsEqual(helloWorld)))
        .pipe(assert.end(done));
});

it('should provide a "noChanges" property of true when states match', done => {
    sourceHelloBuffer()
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.noChanges.should.eql(true);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "movedFiles" collection when path changes and contents do not', done => {
    const oldPath = '/old/file.txt';
    const newPath = '/new/file.txt';
    sourceHelloBuffer()
        .pipe(mut.changePath(oldPath))
        .pipe(snapshot.take())
        .pipe(mut.changePath(newPath))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.movedFiles[0].was.should.eql(oldPath);
            diff.movedFiles[0].is.should.eql(newPath);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "changedFiles" when contents change and path does not', done => {
    const path = '/home/changeme.txt';
    sourceHelloBuffer(path)
        .pipe(snapshot.take())
        .pipe(mut.changeBufferContents('goodbye world'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.changedFiles[0].should.eql(path);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "addedFiles" when new file is present in second snapshot', done => {
    const path = '/home/new.txt';
    sourceHelloBuffer()
        .pipe(snapshot.take())
        .pipe(mut.appendFile('new file', path))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.addedFiles[0].should.eql(path);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "removedFiles" when a file is removed from second snapshot', done => {
    const path = '/home/deleteme.txt';
    sourceHelloBuffer(path)
        .pipe(snapshot.take())
        .pipe(mut.dropFiles())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.removedFiles[0].should.eql(path);
        }))
        .pipe(assert.end(done));
});

describe('streamed files', () => {
    it('should detect matching states', done => {
        sourceStream(['hello ', 'world', '!'])
            .pipe(snapshot.take())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.noChanges.should.eql(true);
            }))
            .pipe(assert.end(done));
    });

    it('should detect changes', done => {
        const path = '/home/stream.txt';
        sourceStream(['hello', 'world', '!'], path)
            .pipe(snapshot.take())
            .pipe(mut.changeStreamContents(['goodbye ', 'stream']))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.changedFiles[0].should.eql(path);
            }))
            .pipe(assert.end(done));
    });
});

describe('copied files', () => {
    it('should add a file to "copiedFiles" when a file is copied', done => {
        const originalPath = '/home/copyme.txt';
        const copiedPath = '/home/copyme-Copy.txt';
        sourceHelloBuffer(originalPath)
            .pipe(snapshot.take())
            .pipe(mut.makeCopies())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].was[0].should.eql(originalPath);
                diff.copiedFiles[0].is.should.eql(copiedPath);
            }))
            .pipe(assert.end(done));
    });

    it('should add a file to "removedFiles" when a copy is removed', done => {
        const path = '/home/copyme.txt';
        sourceHelloBuffer(path)
            .pipe(mut.makeCopies())
            .pipe(snapshot.take())
            .pipe(mut.dropFiles(path))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.removedFiles[0].should.eql(path);
            }))
            .pipe(assert.end(done));
    });

    it('should supply all sources if a new file matches multiple originals', done => {
        const sourceOnePath = '/home/source-one.txt';
        const sourceTwoPath = '/home/source-two.txt';
        const copyPath = '/home/copy.txt';
        sourceHelloBuffer(sourceOnePath)
            .pipe(mut.addHello(sourceTwoPath))
            .pipe(snapshot.take())
            .pipe(mut.addHello(copyPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].is.should.eql(copyPath)
                diff.copiedFiles[0].was.length.should.eql(2);
                diff.copiedFiles[0].was.should.containEql(sourceOnePath);
                diff.copiedFiles[0].was.should.containEql(sourceTwoPath);
            }))
            .pipe(assert.end(done));
    });
    
    it('should supply removed sources for a new copy', done => {
        const sourceOnePath = '/home/source-one.txt';
        const sourceTwoPath = '/home/source-two.txt';
        const copyPath = '/home/copy.txt';
        sourceHelloBuffer(sourceOnePath)
            .pipe(mut.addHello(sourceTwoPath))
            .pipe(snapshot.take())
            .pipe(mut.dropFiles(sourceOnePath))
            .pipe(mut.addHello(copyPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].was.should.containEql(sourceOnePath);
            }))
            .pipe(assert.end(done));
    });

    it('should mark as copy if all sources are dropped', done => {
        const sourceOnePath = '/home/source-one.txt';
        const sourceTwoPath = '/home/source-two.txt';
        const copyPath = '/home/copy.txt';
        sourceHelloBuffer(sourceOnePath)
            .pipe(mut.addHello(sourceTwoPath))
            .pipe(snapshot.take())
            .pipe(mut.dropFiles())
            .pipe(mut.addHello(copyPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.copiedFiles[0].is.should.eql(copyPath);
                diff.copiedFiles[0].was.should.containEql(sourceOnePath);
                diff.copiedFiles[0].was.should.containEql(sourceTwoPath);
            }))
            .pipe(assert.end(done));
    });
});

describe('no early exit/order insensivity', () => {
    it('should mark copies and originals deleted', done => {
        const uniquePath = '/home/file.txt';
        const helloPath = '/home/hello.txt';
        const helloTwoPath = '/home/hello2.txt';
        sourceHelloBuffer(helloPath)
            .pipe(mut.appendFile('some contents', uniquePath))
            .pipe(mut.addHello(helloTwoPath))
            .pipe(snapshot.take())
            .pipe(mut.dropFiles(uniquePath))
            .pipe(mut.dropFiles(helloTwoPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.removedFiles, [uniquePath, helloTwoPath]);
            }))
            .pipe(assert.end(done));
    });

    it('should mark files changed after moves', done => {
        const movePath = '/home/moveme.txt';
        const changePath = '/home/changeme.txt';
        sourceHelloBuffer(movePath)
            .pipe(mut.appendFile('change this', changePath))
            .pipe(snapshot.take())
            .pipe(mut.changePath(movePath, '/home/moved.txt'))
            .pipe(mut.changeBufferContents('changed', changePath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.changedFiles, [changePath]);
            }))
            .pipe(assert.end(done));
    });

    it('should mark files added after copies', done => {
        const addedPath = '/home/added.txt';
        sourceHelloBuffer()
            .pipe(snapshot.take())
            .pipe(mut.addHello('/home/hello2.txt'))
            .pipe(mut.appendFile('new file', addedPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.addedFiles, [addedPath]);
            }))
            .pipe(assert.end(done));
    });

    it('should mark multiple files added', done => {
        const pathOne = '/home/one.txt';
        const pathTwo = '/home/two.txt'
        sourceHelloBuffer()
            .pipe(snapshot.take())
            .pipe(mut.appendFile('asdf', pathOne))
            .pipe(mut.appendFile('qwer', pathTwo))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.addedFiles, [pathOne, pathTwo]);
            }))
            .pipe(assert.end(done));
    });
});