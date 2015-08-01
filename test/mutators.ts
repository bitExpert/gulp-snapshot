import * as through from 'through2';
import { Transform } from 'stream';
import File = require('vinyl');

export function changePath(from: string, to: string): NodeJS.ReadWriteStream
export function changePath(to: string): NodeJS.ReadWriteStream
export function changePath(toOrFrom: string, to?: string) {
    const fromPath = to ? toOrFrom : null;
    const toPath = to ? to : toOrFrom;
    return through.obj(function (file, enc, done) {
        if (fromPath && file.path !== fromPath) {
            this.push(file);
            return done();
        }
        file.path = toPath;
        this.push(file);
        done();
    });
}

export function dropFiles(withPath?: string) {
    return through.obj(function (file, enc, done) {
        if (!withPath || file.path === withPath) {
            return done();
        }
        this.push(file);
        done();
    });
}

export function changeBufferContents(to: string, forPath?: string) {
    return through.obj(function (file, enc, done) {
        if (!forPath || forPath === file.path) {
            file.contents = new Buffer(to);
        }
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

export function appendFile(contents: string, path: string) {
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

