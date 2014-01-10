var resumer = require('resumer');

function registerDependencyCode(logicalParentPath, childId, childVersion) {
    var out = resumer();
    out.write('$rmod.dep(' + JSON.stringify(logicalParentPath) + ', ' +
        JSON.stringify(childId) + ', ' +
        JSON.stringify(childVersion) + ');');

    out.end();

    return out;
}

module.exports = registerDependencyCode;