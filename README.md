# gulp-snapshot [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]
[Gulp](http://gulpjs.com/) plugin for taking and comparing snapshots of Gulp stream states. 

This doesn't touch file contents, it informs you when other things do.

## Usage

```javascript
var gulp = require('gulp');
var snapshot = require('gulp-snapshot');
var somePlugin = require('some-plugin');

gulp.task('default', function() {
  gulp.src('/some/files/*.js')
    .pipe(snapshot.take())
    .pipe(somePlugin())
    .pipe(snapshot.take())
    .pipe(snapshot.compare(function(difference) {
      console.log(difference); // see what somePlugin did to the stream
    }))
    .pipe(gulp.dest('/some/files/'));
});
```

Calling compare will always compare the last two snapshots taken. Taking three or more snapshots in a row will discard the older ones.

Streamed file contents are supported (gulp.src called with `{ buffer: false}`).

## What does it tell you?
Sadly it doesn't perform a text diff on file contents (yet).

The callback you provide to compare is called with one of these:

```typescript
interface IStreamDifference {
    /** Files present in the second snapshot that weren't in the first */
    addedFiles: string[];
    /** Files present in the first snapshot that aren't in the second */
    removedFiles: string[];
    /** Files with the same unique contents but a changed path */
    movedFiles: { was: string, is: string }[];
    /** Files with the same non-unique contents given a new path */
    copiedFiles: { was: string[], is: string }[];
    /** Files with the same path but changed contents */
    changedFiles: string[];
    /** True if snapshots are identical (all change collections are empty) */
    noChanges: boolean;
}
```

* `movedFiles` also means renamed files. One and the same.
* Files with null contents are treated as not present in the stream for comparison purposes.
* The `copiedFiles` entry specifies originals as an array of paths. This probably seems strange, but there was really no other way I could think of to account for the possibility of multiple identical source files. The alternative was to pick one to be the 'true' source and do something different with the others, but that would seem nondeterministic and be more or less a lie.
* One outlier worth mentioning: let's say you have two files with the same contents, A and B. Something in the stream kills one and renames the other to C. Since there's no way to tell which path C originated from, this is reported as a multi-source copy and not a move.
* Entries in the `was` property for a copiedFiles entry may have been deleted, and will be in the `removedFiles` entry if so. In the case above, both A and B will be in `removedFiles`.

## License
MIT License (Expat)

[npm-url]: https://npmjs.org/package/gulp-snapshot
[npm-image]: https://img.shields.io/npm/v/gulp-snapshot.svg?style=flat
[travis-url]: https://travis-ci.org/jwbay/gulp-snapshot
[travis-image]: https://travis-ci.org/jwbay/gulp-snapshot.svg?branch=master