var astannotate = require('astannotate'),
    infer = require('tern/lib/infer'),
    scopevisitor = require('./scopevisitor'),
    fs = require('fs'),
    path_ = require('path'),
    should = require('should');

describe('inspect', function() {
  ['simple.js', 'proto.js', 'external.js', 'object.js', 'circular.js', 'dedupe.js', 'locals.js', 'aliases.js', 'aliases_external.js'].forEach(function(filename) {
    it(filename, function(done) {
      var file = fs.readFile(path_.join('testdata', filename), 'utf8', function(err, text) {
        should.ifError(err);

        var defs = [loadDef('ecma5')];

        var ast = infer.parse(text);
        var cx = new infer.Context(defs);
        infer.withContext(cx, function() {
          infer.analyze(ast, filename);
        });
        var aliases = {local: {}, nonlocal: {}}, locals = {}, nonlocals = {};
        scopevisitor.inspect(filename, cx.topScope, function(path, prop, local, alias) {
          (local ? locals : nonlocals)[path] = prop;
          if (alias) aliases[local ? 'local' : 'nonlocal'][path] = alias;
        });

        // Parse inline directives of the form:
        // /*DEF:<path>:<local>:<alias>*/
        // where <path> is the def's path, <local> is either 'local' or 'nonlocal' (without quotes),
        // and <alias> is the path of the destination def for this alias def. Options <local> and
        // <alias> are optional.
        var visitor = astannotate.nodeVisitor('DEF', function(type) { return type == 'Identifier' || type == 'Literal'; }, function(node, info) {
          info = info.split(':');
          var path = info[0];
          var kind = info[1] || 'nonlocal';
          var defs = ({nonlocal: nonlocals, local: locals})[kind];
          should.exist(defs[path], 'expected ' + kind + ' path ' + path + ' to be emitted\n' + kind + 's:\n  ' + Object.keys(defs).join('\n  '));
          should.exist(defs[path].originNode, 'expected ' + kind + ' path ' + path + ' to have non-null originNode');
          defs[path].originNode.should.equal(node);

          var alias = info[2];
          if (alias) {
            should.exist(aliases[kind][path], 'expected ' + kind + ' path ' + path + ' to be an alias');
            aliases[kind][path].should.eql(alias);
          } else {
            should.not.exist(aliases[kind][path], 'expected ' + kind + ' path ' + path + ' to not be an alias, but it aliases ' + aliases[kind][path]);
          }
        });
        visitor(text, ast);

        var re = new RegExp('/\\*NOPATH:(.*?)\\*/', 'g'), m;
        var allpaths = [].concat(Object.keys(locals), Object.keys(nonlocals));
        while ((m = re.exec(text)) !== null) {
          var nopath = eval('(' + m[1] + ')');
          allpaths.forEach(function(path) {
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
