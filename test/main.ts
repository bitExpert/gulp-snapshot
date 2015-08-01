'use strict';
import File = require('vinyl');
import { Transform } from 'stream';
import * as through from 'through2';
import * as assert from 'stream-assert';
import * as should from 'should';
import * as snapshot from '../index';
import * as mut from './mutators';
import * as source from './sources';

const notCalledTwiceError = /take must be called twice/; 

it('should throw when compare is called before take is called', () => {
    function badStream() {
        source.buffer()
            .pipe(snapshot.compare(_ => _));
    }
    
    badStream.should.throw(notCalledTwiceError);
});

it('should throw if take is only called once', () => {
    function badStream() {
        source.buffer()
            .pipe(snapshot.take())
            .pipe(snapshot.compare(_ => _));
    }
    
    badStream.should.throw(notCalledTwiceError);
});

it('should reset snapshots when reset is called', () => {
    function deferredReset() {
        snapshot.reset();
        return through.obj();
    }

    function badStream() {
        source.buffer()
            .pipe(snapshot.take())
            .pipe(snapshot.take())
            .pipe(deferredReset())
            .pipe(snapshot.compare(_ => _));
    }

    badStream.should.throw(notCalledTwiceError);
});

it('should not touch stream contents', done => {
    function contentsEqual(expected: string) {
        return function (file: File) {
            file.contents.toString().should.eql(expected);
        };
    }

    const helloWorld = 'hello world';

    source.buffer('/home/hello.txt', helloWorld)
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(_ => _))
        .pipe(assert.length(1))
        .pipe(assert.first(contentsEqual(helloWorld)))
        .pipe(assert.end(done));
});

it('should work with empty streams', done => {
    source.emptyStream()
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.noChanges.should.eql(true);
        }))
        .pipe(assert.end(done))
});

it('should work with null files', done => {
    source.vinylStream(null, '/home/empty.txt')
        .pipe(snapshot.take())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.noChanges.should.eql(true);
        }))
        .pipe(assert.end(done))        
});

it('should provide a "noChanges" property of true when states match', done => {
    source.buffer()
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
    source.buffer()
        .pipe(mut.changePath(oldPath))
        .pipe(snapshot.take())
        .pipe(mut.changePath(newPath))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            should.deepEqual(diff.movedFiles, [{
                was: oldPath,
                is: newPath
            }]);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "changedFiles" when contents change and path does not', done => {
    const path = '/home/changeme.txt';
    source.buffer(path)
        .pipe(snapshot.take())
        .pipe(mut.changeBufferContents('goodbye world'))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            should.deepEqual(diff.changedFiles, [path]);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "addedFiles" when new file is present in second snapshot', done => {
    const path = '/home/new.txt';
    source.buffer()
        .pipe(snapshot.take())
        .pipe(mut.appendFile('new file', path))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            should.deepEqual(diff.addedFiles, [path]);
        }))
        .pipe(assert.end(done));
});

it('should add a file to "removedFiles" when a file is removed from second snapshot', done => {
    const path = '/home/deleteme.txt';
    source.buffer(path)
        .pipe(snapshot.take())
        .pipe(mut.dropFiles())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            should.deepEqual(diff.removedFiles, [path]);
        }))
        .pipe(assert.end(done));
});

it('should be usable multiple times in a stream', done => {
    const helloPath = '/home/hello.txt';
    const newFilePath = '/home/new.txt';
    source.buffer(helloPath)
        .pipe(snapshot.take())
        .pipe(mut.dropFiles())
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            should.deepEqual(diff.removedFiles, [helloPath]);
        }))
        .pipe(mut.appendFile('new file', newFilePath))
        .pipe(snapshot.take())
        .pipe(snapshot.compare(diff => {
            diff.removedFiles.length.should.eql(0);
            should.deepEqual(diff.addedFiles, [newFilePath]);
        }))
        .pipe(assert.end(done));
});

describe('streamed files', () => {
    it('should detect matching states', done => {
        source.stream(['hello ', 'world', '!'])
            .pipe(snapshot.take())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                diff.noChanges.should.eql(true);
            }))
            .pipe(assert.end(done));
    });

    it('should detect changes', done => {
        const path = '/home/stream.txt';
        source.stream(['hello', 'world', '!'], path)
            .pipe(snapshot.take())
            .pipe(mut.changeStreamContents(['goodbye ', 'stream']))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.changedFiles, [path]);
            }))
            .pipe(assert.end(done));
    });
});

describe('copied files', () => {
    it('should add a file to "copiedFiles" when a file is copied', done => {
        const originalPath = '/home/copyme.txt';
        const copiedPath = '/home/copyme-Copy.txt';
        source.buffer(originalPath)
            .pipe(snapshot.take())
            .pipe(mut.makeCopies())
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.copiedFiles, [{
                    was: [originalPath],
                    is: copiedPath
                }]);
            }))
            .pipe(assert.end(done));
    });

    it('should add a file to "removedFiles" when a copy is removed', done => {
        const path = '/home/copyme.txt';
        source.buffer(path)
            .pipe(mut.makeCopies())
            .pipe(snapshot.take())
            .pipe(mut.dropFiles(path))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.removedFiles, [path]);
            }))
            .pipe(assert.end(done));
    });

    it('should supply all sources if a new file matches multiple originals', done => {
        const sourceOnePath = '/home/source-one.txt';
        const sourceTwoPath = '/home/source-two.txt';
        const copyPath = '/home/copy.txt';
        source.buffer(sourceOnePath)
            .pipe(mut.addHello(sourceTwoPath))
            .pipe(snapshot.take())
            .pipe(mut.addHello(copyPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.copiedFiles, [{
                    was: [sourceOnePath, sourceTwoPath],
                    is: copyPath
                }]);
            }))
            .pipe(assert.end(done));
    });
    
    it('should supply removed sources for a new copy', done => {
        const sourceOnePath = '/home/source-one.txt';
        const sourceTwoPath = '/home/source-two.txt';
        const copyPath = '/home/copy.txt';
        source.buffer(sourceOnePath)
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
        source.buffer(sourceOnePath)
            .pipe(mut.addHello(sourceTwoPath))
            .pipe(snapshot.take())
            .pipe(mut.dropFiles())
            .pipe(mut.addHello(copyPath))
            .pipe(snapshot.take())
            .pipe(snapshot.compare(diff => {
                should.deepEqual(diff.copiedFiles, [{
                    was: [sourceOnePath, sourceTwoPath],
                    is: copyPath
                }]);
            }))
            .pipe(assert.end(done));
    });
});

describe('no early exit/order insensivity', () => {
    it('should mark copies and originals deleted', done => {
        const uniquePath = '/home/file.txt';
        const helloPath = '/home/hello.txt';
        const helloTwoPath = '/home/hello2.txt';
        source.buffer(helloPath)
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
        source.buffer(movePath)
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
        source.buffer()
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
        source.buffer()
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