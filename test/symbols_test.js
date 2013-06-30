var should = require('should');

var tern_support = require('../tern_support'), plugins = {};
tern_support.loadPlugin(plugins, 'node', {});
tern_support.loadPlugin(plugins, 'doc_comment', {});
var server = tern_support.newServer([], plugins);
require('../ast');
require('../refs');
require('../symbols');

require('../symbols').debug = true;

describe('Symbols', function() {
  var fakeFilename = 'a.js';
  function requestSymbols(src, test) {
    server.reset();
    server.request({
      query: {type: 'sourcegraph:symbols', file: '#0'},
      files: [
        {name: fakeFilename, type: 'full', text: src},
      ],
    }, function(err, res) {
      should.ifError(err);
      test(res);
    });
  }

  function getSymbol(symbols, path) {
    for (var i = 0; i < symbols.length; ++i) {
      if (symbols[i].path === path) return symbols[i];
    }
    throw new Error('No symbol with name "' + path + '" found (all symbols: ' + JSON.stringify(symbols.map(function(s) { return s.path; })) + ')');
  }

  it('returns docs', function(done) {
    requestSymbols('// doc for x\nmodule.exports.x = function() {};\n\nvar z={\n  //doc for y\n  y: function(){}\n};\nmodule.exports.y=z.y;', function(res) {
      getSymbol(res, 'exports.x').doc.should.eql('doc for x');
      getSymbol(res, 'exports.y').doc.should.eql('doc for y');
      done();
    });
  });

});
