import * as through from 'through2';
import { Transform } from 'stream';
import File = require('vinyl');

export function changePath(to: string) {
    return through.obj(function (file, enc, done) {
        file.path = to;
        this.push(file);
        done();
    });
}

export function dropFiles(withPath?: string) {
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

export function changeBufferContents(to: string) {
    return through.obj(function (file, enc, done) {
        file.contents = new Buffer(to);
        this.push(file);
        done();
    });
}

export function changeStreamContents(to: string[]) {
    return through.obj(function (file, enc, done) {
        const fileStream: Transform = <any>through();
        to.forEach(c => fileStream.push(c));
        fileStream.push(null);
        file.contents = fileStream;
        this.push(file);
        done();
    });
}

export function insertFile(contents: string, path: string) {
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

export function makeCopies() {
    return through.obj(function (file: File, enc: string, done: Function) {
        this.push(file);
        this.push(new File({
            path: file.path.replace('.', '-Copy.'),
            contents: file.contents
        }));
        done();
    });
}

export function addHello(path: string) {
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

