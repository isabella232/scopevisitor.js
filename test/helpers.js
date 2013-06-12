var fs = require('fs'), path = require('path'), tern = require('tern/lib/tern');

exports.verbose = false;

exports.startTernServer = function(dir, plugins) {
  plugins.forEach(function(plugin) {
    require('../' + plugin);
  });
  var server = new tern.Server({
    getFile: function(name, c) {
      fs.readFile(path.resolve(dir, name), 'utf8', c);
    },
    async: true,
    plugins: plugins,
    debug: exports.verbose,
    projectDir: dir
  });
  return server;
};
