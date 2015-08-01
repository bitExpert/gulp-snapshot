import File = require('vinyl');
import * as through from 'through2';
import { Transform } from 'stream';

const uniquePath = (() => {
    let i = 0;
    return () => '/home/file/' + i++ + '.txt';
})();

export function vinylStream(contents: any, path: string) {
    const stream: Transform = <any>through.obj();
    stream.push(new File({ path, contents }));
    stream.push(null);
    return stream;
}

export function emptyStream() {
    const stream: Transform = <any>through.obj();
    stream.push(null);
    return stream;
}

export function buffer(path = uniquePath(), contents = 'hello world') {
    return vinylStream(new Buffer(contents), path);
}

export function stream(chunks: string[], path = uniquePath()) {
    const fileStream: Transform = <any>through();
    chunks.forEach(c => fileStream.push(c));
    fileStream.push(null);
    return vinylStream(fileStream, path);
}