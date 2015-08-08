# gulp-snapshot [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url]
[Gulp](http://gulpjs.com/) meta-plugin for comparing snapshots of Gulp stream states. 

This doesn't touch files, it informs you when other things do.

If you'd like to save and restore snapshots instead of comparing them, check out [gulp-save](https://www.npmjs.com/package/gulp-save).

## Usage
`$ npm install gulp-snapshot`

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

Calling `compare` will always compare the last two snapshots taken. Taking three or more snapshots in a row will discard the older ones.

Streamed file contents are supported.

For the callback provided to `compare`, `this` is set to the Gulp stream.

## What's it for?
* Troubleshooting plugins in your build pipeline (where are files getting dropped? what's changing a certain file's content? etc)
* Developing plugins
* Turning any sort of code or file formatter into a pass/fail linter

## What does it tell you?
Sadly it doesn't perform a text diff on file contents (yet).

The callback you provide to compare is called with an object like this. All strings are file paths.

```javascript
{
    /** Files present in the second snapshot that weren't in the first */
    addedFiles: String[];
    /** Files present in the first snapshot that aren't in the second */
    removedFiles: String[];
    /** Files with the same unique contents but a changed path, i.e. renames */
    movedFiles: {
        was: String,
        is: String
    }[];
    /** Files with the same non-unique contents given a new path */
    copiedFiles: {
        was: String[],
        is: String
    }[];
    /** Files with the same path but changed contents */
    changedFiles: String[];
    /** True if snapshots are identical (all change collections are empty) */
    noChanges: Boolean;
}
```

### Null files
Files with null contents are treated as not present in the stream for comparison purposes. So if a plugin nulls out a file's contents, it is treated as a removal, and if it gives a null file content, it is treated as an addition.

### Changes
Files are compared by hashing their contents with SHA1. Any change in file contents, whether it's whitespace, a BOM, or a single character, will result in a different hash and trigger a `changedFiles` entry. 

### Copies
The `copiedFiles` entry specifies originals as an array of paths because of the possibility of multiple identical source files. If you've got duplicate files in the stream on either end of a comparison, the output will be as explicit as possible and won't make any assumptions or take any guesses.

## Example
Here's a verbose example that annotates a build pipeline involving gulp-less and gulp-autoprefixer operating on a couple LESS files.

```javascript
var gulp = require('gulp');
var less = require('gulp-less');
var prefix = require('gulp-autoprefixer')
var snapshot = require('gulp-snapshot')

gulp.task('default', function() {
  return gulp.src('styles/*.less')
    .pipe(snapshot.take())
    .pipe(less())
    .pipe(snapshot.take())
    .pipe(snapshot.compare(function(difference) {
      // gulp-less has dropped the source files from the stream and
      // added compiled css files, so `difference` would be:
      {
        addedFiles: [
          "c:\project\styles\main.css",
          "c:\project\styles\nav.css"
        ],
        removedFiles: [
          "c:\project\styles\main.less",
          "c:\project\styles\nav.less"
        ],
        noChanges: false
      }
    }))
    .pipe(prefix())
    .pipe(snapshot.take())
    .pipe(snapshot.compare(function(difference) {
      // gulp-autoprefixer only found work to do in nav.css,
      // so `difference` would be:
      {
        changedFiles: [
          "c:\project\styles\nav.css"
        ],
        noChanges: false
      }
    }))
    .pipe(gulp.dest('out'));
});
```

## License
MIT License (Expat)

[npm-url]: https://npmjs.org/package/gulp-snapshot
[npm-image]: https://img.shields.io/npm/v/gulp-snapshot.svg?style=flat
[travis-url]: https://travis-ci.org/jwbay/gulp-snapshot
[travis-image]: https://travis-ci.org/jwbay/gulp-snapshot.svg?branch=master