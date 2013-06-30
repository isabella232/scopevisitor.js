var fs = require('fs'),
    path = require('path'),
    tern = require('tern')

var localDir = process.cwd(), ternDir = path.resolve(__dirname, 'node_modules/tern');

function findFile(file, where, ext) {
  if (file.slice(file.length - ext.length) != ext) file += ext;
  var local = path.resolve(localDir, file);
  if (fs.existsSync(local)) return local;
  var our = path.resolve(path.resolve(ternDir, where), file);
  if (fs.existsSync(our)) return our;
}

exports.loadDef = function(defs, name) {
  var found = findFile(name, 'defs', '.json');
  if (!found) {
    console.error('Could not find def file ' + name);
    process.exit(1);
  }
  defs.push(JSON.parse(fs.readFileSync(found, 'utf8')));
}

exports.loadPlugin = function(plugins, name, val) {
  var found = findFile(name, 'plugin', '.js');
  if (!found) {
    console.error('Could not find plugin ' + name);
    process.exit(1);
  }
  require(found);
  plugins[path.basename(name, '.js')] = val;
}

exports.newServer = function(defs, plugins, dir) {
  if (!dir) dir = localDir;
  exports.loadDef(defs, 'ecma5');
  return new tern.Server({
    getFile: function(file) { return fs.readFileSync(path.resolve(dir, file), 'utf8'); },
    defs: defs,
    plugins: plugins,
    debug: true,
    projectDir: dir
  });
};
