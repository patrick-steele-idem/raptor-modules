'use strict';

var chai = require('chai');
chai.Assertion.includeStack = true;
var expect = chai.expect;
var assert = chai.assert;

describe('raptor-modules/client' , function() {

    beforeEach(function(done) {
        for (var k in require.cache) {
            if (require.cache.hasOwnProperty(k)) {
                delete require.cache[k];
            }
        }
        done();
    });

    it('should throw error if trying to resolve target that is falsey', function(done) {
        var clientImpl = require('../lib/index');

        try {
            clientImpl.resolve('', '/some/module');
            assert(false, 'Exception should have been thrown');
        } catch(err) {
            expect(err.code).to.equal('MODULE_NOT_FOUND');
        }

        try {
            clientImpl.resolve(null, '/some/module');
            assert(false, 'Exception should have been thrown');
        } catch(err) {
            expect(err.code).to.equal('MODULE_NOT_FOUND');
        }

        try {
            clientImpl.resolve(undefined, '/some/module');
            assert(false, 'Exception should have been thrown');
        } catch(err) {
            expect(err.code).to.equal('MODULE_NOT_FOUND');
        }

        try {
            clientImpl.resolve(0, '/some/module');
            assert(false, 'Exception should have been thrown');
        } catch(err) {
            expect(err.code).to.equal('MODULE_NOT_FOUND');
        }

        done();
    });

    it('should resolve modules using search path', function(done) {
        var clientImpl = require('../lib/index');

        // define a module for a given real path
        clientImpl.def('/baz@3.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            module.exports.test = true;
        });

        // Module "foo" requires "baz" 3.0.0
        // This will create the following link:
        // /$/foo/$/baz --> baz@3.0.0
        clientImpl.dep('/$/foo', 'baz', '3.0.0');

        var resolved;

        // Make sure that if we try to resolve "baz/lib/index" from within some module
        // located at "/$/foo" then we should get back "/$/foo/$/baz"
        resolved = clientImpl.resolve('baz/lib/index', '/$/foo');
        expect(resolved[0]).to.equal('/$/foo/$/baz/lib/index');
        expect(resolved[1]).to.equal('/baz@3.0.0/lib/index');

        // A module further nested under /$/foo should also resolve to the same
        // logical path
        resolved = clientImpl.resolve('baz/lib/index', '/$/foo/some/other/module');
        expect(resolved[0]).to.equal('/$/foo/$/baz/lib/index');
        expect(resolved[1]).to.equal('/baz@3.0.0/lib/index');

        // Code at under "/some/module" doesn't know about baz
        try {
            clientImpl.resolve('baz/lib/index', '/some/module');
            assert(false, 'Exception should have been thrown');
        } catch(err) {
            expect(err.code).to.equal('MODULE_NOT_FOUND');
        }

        done();
    });

    it('should resolve absolute paths not containing installed modules', function(done) {
        var clientImpl = require('../lib/index');

        var resolved;

        // define a module for a given real path
        clientImpl.def('/my/app/util', function(require, exports, module, __filename, __dirname) {
            module.exports.test = true;
        });

        resolved = clientImpl.resolve(
            '/my/app/util' /* target is absolute path to specific version of module */,
            '/my/app/index' /* from is ignored if target is absolute path */);

        expect(resolved[0]).to.equal('/my/app/util');
        expect(resolved[1]).to.equal('/my/app/util');
        
        done();
    });

    it('should resolve absolute paths containing installed modules', function(done) {

        var clientImpl = require('../lib/index');

        var resolved;

        // define a module for a given real path
        clientImpl.def('/baz@3.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            module.exports.test = true;
        });

        // Module "foo" requires "baz" 3.0.0
        // This will create the following link:
        // /$/foo/$/baz --> baz@3.0.0
        clientImpl.dep('/$/foo', 'baz', '3.0.0');

        // Make sure that if we try to resolve "baz" with  from within some module
        // located at "/$/foo" then we should get back "/$/foo/$/baz"
        resolved = clientImpl.resolve(
            '/$/foo/$/baz/lib/index' /* target is absolute path */,
            '/$/foo' /* the from is ignored */);

        expect(resolved[0]).to.equal('/$/foo/$/baz/lib/index');
        expect(resolved[1]).to.equal('/baz@3.0.0/lib/index');

        resolved = clientImpl.resolve(
            '/baz@3.0.0/lib/index' /* target is absolute path to specific version of module */,
            '/$/foo' /* from is ignored if target is absolute path */);

        expect(resolved[0]).to.equal('/baz@3.0.0/lib/index');
        expect(resolved[1]).to.equal('/baz@3.0.0/lib/index');

        
        expect(function() {
            // Without registering "main", "/baz@3.0.0" will not be known
            resolved = clientImpl.resolve('/baz@3.0.0', '/some/module');
        }).to.throw(Error);
        
        done();
    });

    it('should instantiate modules', function(done) {
        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        // define a module for a given real path
        clientImpl.def('/baz@3.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            instanceCount++;

            expect(module.id).to.equal('/$/foo/$/baz/lib/index');
            expect(module.filename).to.equal('/$/foo/$/baz/lib/index');

            module.exports = {
                __filename: __filename,
                __dirname: __dirname
            };
        });

        // Module "foo" requires "baz" 3.0.0
        // This will create the following link:
        // /$/foo/$/baz --> baz@3.0.0
        clientImpl.dep('/$/foo', 'baz', '3.0.0');

        var baz = clientImpl.require('baz/lib/index', '/$/foo');

        expect(instanceCount).to.equal(1);

        expect(baz.__filename).to.equal('/$/foo/$/baz/lib/index');
        expect(baz.__dirname).to.equal('/$/foo/$/baz/lib');

        clientImpl.require('baz/lib/index', '/$/foo');

        expect(instanceCount).to.equal(1);

        done();
    });

    it('should instantiate multiple instances of module if loaded from separate logical paths', function(done) {
        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        // define a module for a given real path
        clientImpl.def('/baz@3.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            instanceCount++;

            module.exports = {
                __filename: __filename,
                __dirname: __dirname,
                moduleId: module.id,
                moduleFilename: module.filename
            };
        });

        // Module "foo" requires "baz" 3.0.0
        // This will create the following link:
        // /$/foo/$/baz --> baz@3.0.0
        clientImpl.dep('/$/foo', 'baz', '3.0.0');

        // Module "foo" requires "baz" 3.0.0
        // This will create the following link:
        // /$/bar/$/baz --> baz@3.0.0
        clientImpl.dep('/$/bar', 'baz', '3.0.0');

        var bazFromFoo = clientImpl.require('baz/lib/index', '/$/foo');
        expect(bazFromFoo.moduleId).to.equal('/$/foo/$/baz/lib/index');
        expect(bazFromFoo.moduleFilename).to.equal('/$/foo/$/baz/lib/index');

        expect(instanceCount).to.equal(1);

        var bazFromBar = clientImpl.require('baz/lib/index', '/$/bar');
        expect(bazFromBar.moduleId).to.equal('/$/bar/$/baz/lib/index');
        expect(bazFromBar.moduleFilename).to.equal('/$/bar/$/baz/lib/index');

        expect(instanceCount).to.equal(2);

        done();
    });

    it('should throw exception if required module is not found', function(done) {

        expect(function() {
            require('something/that/does/not/exist');
        }).to.throw(Error);

        done();
    });

    it('should load modules that are objects', function(done) {
        var clientImpl = require('../lib/index');


        // define a module for a given real path
        clientImpl.def('/baz@3.0.0/lib/index', {
            test: true
        });

        // Module "foo" requires "baz" 3.0.0
        // This will create the following link:
        // /$/foo/$/baz --> baz@3.0.0
        clientImpl.dep('/$/foo', 'baz', '3.0.0');

        var baz = clientImpl.require('baz/lib/index', '/$/foo');

        expect(baz.test).to.equal(true);

        done();
    });

    it('should run modules', function(done) {
        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            instanceCount++;
            module.exports = {
                __filename: __filename,
                __dirname: __dirname
            };
        });

        // run will define the instance and automatically load it
        expect(instanceCount).to.equal(1);

        // you can also require the instance again if you really want to
        var launch = clientImpl.require('/app/launch/index', '/$/foo');

        expect(instanceCount).to.equal(1);

        expect(launch.__filename).to.equal('/app/launch/index');
        expect(launch.__dirname).to.equal('/app/launch');

        // use a relative path to require it as well
        launch = clientImpl.require('./index', '/app/launch');

        expect(launch.__filename).to.equal('/app/launch/index');
        expect(launch.__dirname).to.equal('/app/launch');

        expect(instanceCount).to.equal(1);

        done();
    });

    it('should provide require function to module', function(done) {
        var clientImpl = require('../lib/index');

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            module.exports.sayHello = function() {
                return 'Hello!';
            };
        });

        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {

            var util;

            // test requesting
            util = require('./util');
            expect(Object.keys(util)).to.deep.equal(['sayHello']);

            // test requiring something via absolute path
            util = require('/app/launch/util');
            expect(Object.keys(util)).to.deep.equal(['sayHello']);

            module.exports = {
                greeting: util.sayHello()
            };
        });

        // you can also require the instance again if you really want to
        var launch = clientImpl.require('/app/launch/index', '/$/foo');

        expect(launch.greeting).to.equal('Hello!');

        done();
    });

    it('should provide require function that has a resolve property', function(done) {

        var clientImpl = require('../lib/index');

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            module.exports.sayHello = function() {
                return 'Hello!';
            };
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {

            expect(require('./util')).to.equal(require(require.resolve('./util')));

            var util = require('./util');

            module.exports = {
                greeting: util.sayHello()
            };
        });

        done();

    });

    it('should not instantiate during require.resolve(target) call', function(done) {

        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            instanceCount++;

            module.exports.sayHello = function() {
                return 'Hello!';
            };
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {

            var logicalPath = require.resolve('./util');

            expect(logicalPath).to.equal('/app/launch/util');
            expect(instanceCount).to.equal(0);
        });

        done();

    });

    it('should allow factory to provide new exports', function(done) {

        var clientImpl = require('../lib/index');

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            module.exports = {
                greeting: 'Hello!'
            };
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            var util = require('./util');
            expect(util.greeting).to.equal('Hello!');
        });

        done();

    });

    it('should allow factory to add properties to export', function(done) {

        var clientImpl = require('../lib/index');

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            module.exports.greeting = 'Hello!';
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            var util = require('./util');
            expect(util.greeting).to.equal('Hello!');
        });

        done();
    });

    it('should allow factory to be object', function(done) {

        var clientImpl = require('../lib/index');

        clientImpl.def('/app/launch/util', {
            greeting: 'Hello!'
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            var util = require('./util');
            expect(util.greeting).to.equal('Hello!');
        });

        done();
    });

    it('should allow factory to be null object', function(done) {

        /*
         * NOTE: Using null doesn't provide much value but it is an object
         * so we'll just return null as the exports. We will however, treat
         * undefined specially.
         */
        var clientImpl = require('../lib/index');

        clientImpl.def('/app/launch/util', null);
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            var util = require('./util');
            expect(util).to.equal(null);
        });

        done();
    });

    it('should allow factory to be undefined object', function(done) {

        var clientImpl = require('../lib/index');

        // An undefined value as factory will remove the definition and make it
        // appear as though the module does not exist
        clientImpl.def('/app/launch/util', undefined);
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            expect(function() {
                require('./util');
            }).to.throw(Error);
        });

        done();
    });

    it('should find targets with or without ".js" extension', function(done) {

        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            instanceCount++;
            module.exports.greeting = 'Hello!';
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            var util0 = require('./util.js');
            var util1 = require('./util');

            expect(instanceCount).to.equal(1);
            expect(util0).to.equal(util1);
            expect(util0.greeting).to.equal('Hello!');
        });

        done();
    });

    it('should resolve targets with or without ".js" extension', function(done) {

        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        clientImpl.def('/app/launch/util', function(require, exports, module, __filename, __dirname) {
            instanceCount++;
            module.exports.greeting = 'Hello!';
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {

            expect(require.resolve('./util.js')).to.equal('/app/launch/util');
            expect(require.resolve('./util')).to.equal('/app/launch/util');

            expect(instanceCount).to.equal(0);
        });

        done();
    });

    it('should find targets when definition includes extension', function(done) {

        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        clientImpl.def('/app/launch/do.something', function(require, exports, module, __filename, __dirname) {
            instanceCount++;
            module.exports.greeting = 'Hello!';
        });
        
        // define a module for a given real path
        clientImpl.run('/app/launch/index', function(require, exports, module, __filename, __dirname) {
            var util0 = require('./do.something.js');
            var util1 = require('./do.something');

            expect(instanceCount).to.equal(1);
            expect(util0).to.equal(util1);
            expect(util0.greeting).to.equal('Hello!');
        });

        done();
    });

    it('should allow main file to be specified for any directory', function(done) {

        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        clientImpl.def('/app/lib/index', function(require, exports, module, __filename, __dirname) {
            instanceCount++;

            expect(__dirname).to.equal('/app/lib');
            expect(__filename).to.equal('/app/lib/index');

            module.exports.greeting = 'Hello!';
        });

        clientImpl.main('/app', 'lib/index');
        
        var resolved;

        resolved = clientImpl.resolve('../../lib/index', '/app/lib/launch');
        expect(resolved[0]).to.equal('/app/lib/index');

        resolved = clientImpl.resolve('../../', '/app/lib/launch');
        expect(resolved[0]).to.equal('/app/lib/index');

        // define a module for a given real path
        clientImpl.run('/app/lib/launch', function(require, exports, module, __filename, __dirname) {

            expect(__dirname).to.equal('/app/lib');
            expect(__filename).to.equal('/app/lib/launch');

            // all of the follow require statements are equivalent to require('/app/lib/index')
            var app0 = require('../');
            var app1 = require('/app');
            var app2 = require('/app/lib/index');
            var app3 = require('/app/lib/index.js');
            var app4 = require('./index');
            var app5 = require('./index.js');

            expect(instanceCount).to.equal(1);

            expect(app0.greeting).to.equal('Hello!');

            assert(app1 === app0 &&
                   app2 === app0 &&
                   app3 === app0 &&
                   app4 === app0 &&
                   app5 === app0, 'All instances are not equal to each other');
        });

        done();
    });

    it('should allow main file to be specified for a module', function(done) {

        var clientImpl = require('../lib/index');

        var instanceCount = 0;

        clientImpl.def('/streams@1.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            instanceCount++;

            expect(__dirname).to.equal('/streams@1.0.0/app/lib');
            expect(__filename).to.equal('/streams@1.0.0/app/lib/index');

            module.exports.greeting = 'Hello!';
        });

        clientImpl.main('/streams@1.0.0', 'lib/index');

        clientImpl.dep('', 'streams', '1.0.0');

        // define a module for a given real path
        clientImpl.run('/app', function(require, exports, module, __filename, __dirname) {

            expect(__dirname).to.equal('');
            expect(__filename).to.equal('/app');

            expect(require.resolve('streams')).to.equal('/$/streams/lib/index');
        });

        // define a module for a given real path
        clientImpl.run('/app/launch', function(require, exports, module, __filename, __dirname) {

            expect(__dirname).to.equal('/app');
            expect(__filename).to.equal('/app/launch');

            expect(require.resolve('streams')).to.equal('/$/streams/lib/index');
            expect(require.resolve('streams/lib/index')).to.equal('/$/streams/lib/index');
        });

        done();
    });

    it('should handle remapping individual files', function(done) {

        var clientImpl = require('../lib/index');

        clientImpl.def('/universal@1.0.0/lib/index', function(require, exports, module, __filename, __dirname) {
            module.exports = {
                name: 'default'
            };
        });

        clientImpl.def('/universal@1.0.0/lib/browser/index', function(require, exports, module, __filename, __dirname) {
            module.exports = {
                name: 'browser'
            };
        });

        clientImpl.main('/universal@1.0.0', 'lib/index');

        clientImpl.dep('', 'universal', '1.0.0');

        // require "universal" before it is remapped
        var runtime0 = clientImpl.require('universal', '/app/lib');
        expect(runtime0.name).to.equal('default');
        expect(clientImpl.require('universal/lib/index', '/app/lib')).to.equal(runtime0);

        clientImpl.remap(
            // choose a specific "file" to remap
            '/universal@1.0.0/lib/index',
            // following path is relative to /universal@1.0.0/lib
            './browser/index');

        // require "universal" after it is remapped
        var runtime1 = clientImpl.require('universal', '/app/lib');
        expect(runtime1.name).to.equal('browser');
        expect(clientImpl.require('universal/lib/index', '/app/lib')).to.equal(runtime1);

        done();
    });
    
    it('should handle remapping entire modules to shim modules', function(done) {
        var clientImpl = require('../lib/index');

        clientImpl.def('/streams-browser@1.0.0/lib/index', function(require, exports, module, __filename, __dirname) {

            expect(__dirname).to.equal('/$/streams/lib');
            expect(__filename).to.equal('/$/streams/lib/index');

            module.exports = {
                name: 'browser'
            };
        });

        clientImpl.dep(
            // logical path
            '',

            // depends on streams-browser 1.0.0
            'streams-browser', '1.0.0',

            // streams-browser is also known as "streams"
            'streams');

        //clientImpl.remap('streams', 'streams-browser', '/abc');

        // requiring "streams" effectively a require on "streams-browser";
        var streams = clientImpl.require('streams/lib/index', '/app/lib/index');

        expect(streams.name).to.equal('browser');

        done();
    });

    it('should join relative paths', function(done) {
        // NOTE: Second argument to join should start with "." or "..".
        //       I don't care about joining an absolute path, empty string
        //       or even a "module name" because these are handled specially
        //       in the resolve method.
        var clientImpl = require('../lib/index');

        expect(clientImpl.join('/foo/baz', './abc.js')).to.equal('/foo/baz/abc.js');
        expect(clientImpl.join('/foo/baz', '../abc.js')).to.equal('/foo/abc.js');
        expect(clientImpl.join('/foo', '..')).to.equal('/');
        expect(clientImpl.join('/foo', '../..')).to.equal('');
        expect(clientImpl.join('foo', '..')).to.equal('');
        expect(clientImpl.join('foo/bar', '../test.js')).to.equal('foo/test.js');
        expect(clientImpl.join('abc/def', '.')).to.equal('abc/def');
        expect(clientImpl.join('/', '.')).to.equal('/');
        expect(clientImpl.join('/', '.')).to.equal('/');
        expect(clientImpl.join('/app/lib/launch', '../../')).to.equal('/app');
        expect(clientImpl.join('/app/lib/launch', '../..')).to.equal('/app');
        expect(clientImpl.join('/app/lib/launch', './../..')).to.equal('/app');
        expect(clientImpl.join('/app/lib/launch', './../.././././')).to.equal('/app');
        done();
    });

    it('should run module from root', function(done) {
        var clientImpl = require('../lib/index');

        /* 
        TEST SETUP:

        Call require('raptor-util') from within the following file:
        /node_modules/raptor-widgets/lib/index.js

        'raptor-util' is installed as a dependency for the top-level 'raptor-modules' module
        */

        
        var widgetsModule = null;
        // var raptorUtilModule = null;
        clientImpl.dep("/$/raptor-widgets", "raptor-util", "0.1.0-SNAPSHOT");
        clientImpl.main("/raptor-util@0.1.0-SNAPSHOT", "lib/index");
        clientImpl.def("/raptor-util@0.1.0-SNAPSHOT/lib/index", function(require, exports, module, __filename, __dirname) {
            exports.filename = __filename;
        });

        clientImpl.dep("", "raptor-widgets", "0.1.0-SNAPSHOT");
        clientImpl.main("/raptor-widgets@0.1.0-SNAPSHOT", "lib/index");
        clientImpl.main("/raptor-widgets@0.1.0-SNAPSHOT/lib", "index");
        clientImpl.def("/raptor-widgets@0.1.0-SNAPSHOT/lib/index", function(require, exports, module, __filename, __dirname) {
            exports.filename = __filename;
            exports.raptorUtil = require('raptor-util');
        });

        // define a module for a given real path
        clientImpl.run("/", function(require, exports, module, __filename, __dirname) { 
            widgetsModule = require("/$/raptor-widgets");
        });

        // run will define the instance and automatically load it
        expect(widgetsModule.filename).to.equal('/$/raptor-widgets/lib/index');
        expect(widgetsModule.raptorUtil.filename).to.equal('/$/raptor-widgets/$/raptor-util/lib/index');

        done();
    });

    it('should allow main with a relative path', function(done) {
        var clientImpl = require('../lib/index');

        clientImpl.dep("/$/foo", "bar", "0.1.0-SNAPSHOT");
        clientImpl.main("/bar@0.1.0-SNAPSHOT/Baz", "../lib/Baz");
        clientImpl.def("/bar@0.1.0-SNAPSHOT/lib/Baz", function(require, exports, module, __filename, __dirname) {
            exports.isBaz = true;
        });

        clientImpl.dep("", "foo", "0.1.0-SNAPSHOT");
        clientImpl.main("/foo@0.1.0-SNAPSHOT", "lib/index");
        clientImpl.def("/foo@0.1.0-SNAPSHOT/lib/index", function(require, exports, module, __filename, __dirname) {
            exports.Baz = require('bar/Baz');
        });



        var Baz = null;
        clientImpl.run("/", function(require, exports, module, __filename, __dirname) { 
            var foo = require('foo');
            Baz = foo.Baz;

        });

        expect(Baz.isBaz).to.equal(true);


        done();
    });
});
