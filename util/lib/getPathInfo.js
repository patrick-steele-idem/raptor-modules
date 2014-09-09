require('raptor-polyfill/string/startsWith');
var nodePath = require('path');
var ok = require('assert').ok;

var raptorModulesUtil = require('../../util');
var cachingFs = raptorModulesUtil.cachingFs;
var raptorModulesResolver = require('../../resolver');
var getProjectRootDir = raptorModulesUtil.getProjectRootDir;
var getModuleRootPackage = raptorModulesUtil.getModuleRootPackage;
var findMain = raptorModulesUtil.findMain;
var getBrowserOverrides = require('./browser-overrides').getBrowserOverrides;

function normalizeDepDirnames(path) {
    var parts = path.split('/');
    for (var i=0, len=parts.length; i<len; i++) {
        if (parts[i] === 'node_modules') {
            parts[i] = '$';
        }
    }

    return parts.join('/');
}


function removeRegisteredExt(path) {
    var basename = nodePath.basename(path);
    var ext = nodePath.extname(basename);

    if (ext === '.js') {
        return path.slice(0, -3);
    } else {
        return path;
    }
}

function getPathInfo(path, options) {
    ok(typeof path === 'string', 'path should be a string');
    options = options || {};

    var removeExt = options.removeExt !== false;

    var root = options.root || getProjectRootDir(path);
    path = path.replace(/[\\]/g, '/');

    var lastNodeModules = path.lastIndexOf('node_modules/');
    var logicalPath;
    var realPath;
    var dep;
    var stat = cachingFs.statSync(path);

    if (!stat.exists(path)) {
        throw new Error('File does not exist: ' + path);
    }

    var name;
    var version;
    var basePath;

    if (path.startsWith(root)) {
        logicalPath = normalizeDepDirnames(path.substring(root.length));

        if (lastNodeModules !== -1) {
            var nodeModulesDir = path.substring(0, lastNodeModules + 'node_modules/'.length);

            var moduleNameEnd = path.indexOf('/', nodeModulesDir.length);
            if (moduleNameEnd === -1) {
                moduleNameEnd = path.length;
            }

            var pkg = getModuleRootPackage(path);
            name = pkg.name;
            version = pkg.version;

            basePath = '/' + name + '@' + version;
            realPath = normalizeDepDirnames(basePath + path.substring(moduleNameEnd));

            dep = {
                parentPath: normalizeDepDirnames(nodePath.dirname(nodeModulesDir).substring(root.length)),
                childName: name,
                childVersion: version
            };
        } else {
            realPath = logicalPath;
        }
    } else {

        // The module must be linked in so treat it as a top-level installed
        // dependency since we have no way of knowing which dependency this module belongs to
        // based on the given path
        var moduleRootPkg = getModuleRootPackage(path);
        name = moduleRootPkg.name;
        version = moduleRootPkg.version;


        basePath = '/' + name + '@' + version;
        realPath = normalizeDepDirnames(basePath + path.substring(moduleRootPkg.__dirname.length));
        logicalPath = name + path.substring(moduleRootPkg.__dirname.length);

        dep = {
            parentPath: '',
            childName: name,
            childVersion: version
        };

        // console.log('RESOLVE LINKED MODULE: ', '\npath: ', path, '\nrealPath: ', realPath, '\nlogicalPath: ', logicalPath, '\ndep: ', dep, '\nmoduleRootPkg.__dirname: ', moduleRootPkg.__dirname);
    }



    var isDir = stat.isDirectory();
    var main;
    var remap;

    if (isDir) {
        var mainFilePath = findMain(path);
        if (mainFilePath) {
            var mainRelPath = removeRegisteredExt(nodePath.relative(path, mainFilePath));
            main = {
                filePath: mainFilePath,
                path: mainRelPath
            };
        }
    } else {

        if (removeExt) {
            logicalPath = removeRegisteredExt(logicalPath);
            realPath = removeRegisteredExt(realPath);
        }

        var dirname = nodePath.dirname(path);

        var browserOverrides = getBrowserOverrides(dirname);
        if (browserOverrides) {
            var browserOverride = browserOverrides.getRemappedModuleInfo(path, options);

            if (browserOverride) {
                var overridePathInfo;
                var targetFile;

                if (browserOverride.filePath) {
                    targetFile = browserOverride.filePath;

                } else if (browserOverride.name) {
                    ok(browserOverride.from, 'browserOverride.from expected');

                    var targetModule = raptorModulesResolver.resolveRequire(browserOverride.name, browserOverride.from);
                    ok(targetModule.main && targetModule.main.filePath, 'Invalid target module');
                    targetFile = targetModule.main.filePath;

                } else {
                    throw new Error('Invalid browser override for "' + path + '": ' + require('util').inspect(path));
                }

                var remapTo = normalizeDepDirnames(nodePath.relative(dirname, targetFile));

                remap = {
                    from: realPath,
                    to: removeExt ? removeRegisteredExt(remapTo) : remapTo
                };

                ok(targetFile, 'targetFile is null');

                overridePathInfo = getPathInfo(targetFile, options);
                overridePathInfo.isBrowserOverride = true;
                overridePathInfo.remap = remap;
                return overridePathInfo;
            }
        }
    }

    var result = {
        filePath: path,
        logicalPath: logicalPath,
        realPath: realPath,
        isDir: isDir
    };

    if (dep) {
        result.dep = dep;
    }

    if (main) {
        result.main = main;
    }

    return result;
}

module.exports = getPathInfo;
