'use strict';
var through = require('through2');
function default_1() {
    return through.obj(function (file, enc, done) {
        this.push(file);
        return done();
    });
}
exports.default = default_1;
