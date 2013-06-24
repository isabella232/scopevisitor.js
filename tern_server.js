var fs = require('fs'), path = require('path'), tern = require('tern/lib/tern');

exports.verbose = false;

var libDir = __dirname;
var ternDir = path.resolve(__dirname, "node_modules/tern");

exports.startTernServer = function(dir, plugins) {
  function findFile(file, dir, fallbackDir) {
    var local = path.resolve(dir, file);
    if (fs.existsSync(local)) return local;
    var shared = path.resolve(fallbackDir, file);
    if (fs.existsSync(shared)) return shared;
    throw new Error('File not found: ' + file + ' (search paths: ' + dir + ':' + fallbackDir + ')');
  }

  Object.keys(plugins).forEach(function(plugin) {
    require(findFile(plugin + '.js', libDir, path.join(ternDir, 'plugin')));
  });

  var defs = ['ecma5'].map(function(def) {
    return JSON.parse(fs.readFileSync(findFile(def + '.json', path.join(ternDir, 'defs'))));
  });
  var server = new tern.Server({
    getFile: function(name, c) {
      return fs.readFileSync(name, 'utf8');
    },
    async: false,
    defs: defs,
    plugins: plugins,
    debug: exports.verbose,
    projectDir: dir
  });
  return server;
};
