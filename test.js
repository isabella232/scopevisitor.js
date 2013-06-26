var astannotate = require('astannotate'),
    infer = require('tern/lib/infer'),
    scopevisitor = require('./scopevisitor'),
    fs = require('fs'),
    path_ = require('path'),
    should = require('should');

describe('inspect', function() {
  ['simple.js', 'proto.js', 'external.js', 'object.js', 'circular.js'].forEach(function(filename) {
    it(filename, function(done) {
      var file = fs.readFile(path_.join('testdata', filename), 'utf8', function(err, text) {
        should.ifError(err);

        var defs = [loadDef('ecma5')];

        var ast = infer.parse(text);
        var cx = new infer.Context(defs);
        infer.withContext(cx, function() {
          infer.analyze(ast, filename);
        });
        var paths = {};
        scopevisitor.inspect(filename, cx.topScope, function(path, prop) {
          paths[path] = prop;
        });

        var visitor = astannotate.nodeVisitor('PATH', function(type) { return type == 'Identifier' || type == 'Literal'; }, function(node, path) {
          should.exist(paths[path], 'expected path ' + path + ' to be emitted\npaths:\n  ' + Object.keys(paths).join('\n  '));
          should.exist(paths[path].originNode, 'expected path ' + path + ' to have non-null originNode');
          paths[path].originNode.should.equal(node);
        });
        visitor(text, ast);

        var re = new RegExp('/\\*NOPATH:(.*?)\\*/', 'g'), m;
        while ((m = re.exec(text)) !== null) {
          var nopath = eval('(' + m[1] + ')');
          Object.keys(paths).forEach(function(path) {
            path.should.not.match(nopath);
          });
        }
        done();
      });
    });
  });
});

function loadDef(name) {
  return JSON.parse(fs.readFileSync(path_.join(__dirname, 'node_modules/tern/defs', name + '.json'), 'utf8'));
}
