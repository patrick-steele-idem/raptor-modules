'use strict';
require('../'); // Load the module
var nodePath = require('path');
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var fs = require('fs');

require('../'); // Load this module just to make sure it works

describe('raptor-modules/optimizer/Dependency_commonjs-def' , function() {

    beforeEach(function(done) {
        for (var k in require.cache) {
            if (require.cache.hasOwnProperty(k)) {
                delete require.cache[k];
            }
        }
        done();
    });

    it('should generate the correct code for an installed module', function(done) {

        var defDependency = require('../lib/Dependency_commonjs-def');
        defDependency.path = "/foo@1.0.0/lib/index";
        defDependency._file = nodePath.join(__dirname, 'test-project/node_modules/foo/lib/index.js');
        var code = '';
        defDependency.read()
            .on('data', function(data) {
                code += data;
            })
            .on('end', function() {
                expect(code).to.equal('$rmod.def("/foo@1.0.0/lib/index", function(require, exports, module, __filename, __dirname) { exports.foo = "1.0.0"; });');
                done();
            })
            .on('error', done);
    });


});

