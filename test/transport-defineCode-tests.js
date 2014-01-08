'use strict';
require('../'); // Load the module
var nodePath = require('path');
var chai = require('chai');
chai.Assertion.includeStack = true;
require('chai').should();
var expect = require('chai').expect;
var fs = require('fs');

require('../transport'); // Load this module just to make sure it works

describe('raptor-modules/transport.defineCode' , function() {

    beforeEach(function(done) {
        for (var k in require.cache) {
            if (require.cache.hasOwnProperty(k)) {
                delete require.cache[k];
            }
        }
        done();
    });

    it('should handle String argument for factory function code', function(done) {
        var transport = require('../transport');
        var out = transport.defineCode('/some/path', 'exports.test=true;');
        var code = '';
        out.on('data', function(data) {
            code += data;
        });
        out.on('end', function() {
            expect(code).to.equal('$rmod.def("/some/path", function(require, exports, module, __filename, __dirname) { exports.test=true; });');
            done();
        });
    });

    it('should handle String argument for object code', function(done) {
        var transport = require('../transport');
        var out = transport.defineCode('/some/path', '{ "hello": "world" }', {object: true});
        var code = '';
        out.on('data', function(data) {
            code += data;
        });
        out.on('end', function() {
            expect(code).to.equal('$rmod.def("/some/path", { "hello": "world" });');
            done();
        });
    });

    it('should handle Stream argument for factory function code', function(done) {
        var transport = require('../transport');
        var stream = fs.createReadStream(nodePath.join(__dirname, 'test.js'), {encoding: 'utf8'});
        var out = transport.defineCode('/some/path', stream);
        var code = '';
        out.on('data', function(data) {
            code += data;
        });
        out.on('end', function() {
            expect(code).to.equal('$rmod.def("/some/path", function(require, exports, module, __filename, __dirname) { exports.test=true; });');
            done();
        });
    });

    it('should handle Stream argument for object code', function(done) {
        var transport = require('../transport');
        var stream = fs.createReadStream(nodePath.join(__dirname, 'test.json'), {encoding: 'utf8'});
        var out = transport.defineCode('/some/path', stream, {object: true});
        var code = '';
        out.on('data', function(data) {
            code += data;
        });
        out.on('end', function() {
            expect(code).to.equal('$rmod.def("/some/path", { "hello": "world" });');
            done();
        });
    });


});

