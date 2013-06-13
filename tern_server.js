var fs = require('fs'), path = require('path'), tern = require('tern/lib/tern');

exports.verbose = false;

exports.startTernServer = function(dir, plugins) {
  function findFile(file, dir, fallbackDir) {
    var local = path.resolve(dir, file);
    if (fs.existsSync(local)) return local;
    var shared = path.resolve(fallbackDir, file);
    if (fs.existsSync(shared)) return shared;
    throw new Error('File not found: ' + file + ' (search paths: ' + dir + ':' + fallbackDir + ')');
  }

  Object.keys(plugins).forEach(function(plugin) {
    require(findFile(plugin + '.js', '.', 'node_modules/tern/plugin'));
  });
  var server = new tern.Server({
    getFile: function(name, c) {
      return fs.readFileSync(name, 'utf8');
    },
    async: false,
    plugins: plugins,
    debug: exports.verbose,
    projectDir: dir
  });
  return server;
};
