import File = require('vinyl');
import * as through from 'through2';
import { Transform } from 'stream';

const uniquePath = (() => {
    let i = 0;
    return () => '/home/file/' + i++ + '.txt';
})();

function startVinylStream(contents: any, path: string) {
    const stream: Transform = <any>through.obj();
    stream.push(new File({ path: path, contents: contents }));
    stream.push(null);
    return stream;
}

export function sourceBuffer(contents: string, path = uniquePath()) {
    return startVinylStream(new Buffer(contents), path);
}

export function sourceStream(chunks: string[], path = uniquePath()) {
    const fileStream: Transform = <any>through();
    chunks.forEach(c => fileStream.push(c));
    fileStream.push(null);
    return startVinylStream(fileStream, path);
}