var astannotate = require('astannotate'),
    infer = require('tern/lib/infer'),
    scopevisitor = require('./scopevisitor'),
    fs = require('fs'),
    path_ = require('path'),
    should = require('should'),
    tern_support = require('./tern_support');

var tests = [
  {path: 'simple.js', plugins: []},
  {path: 'proto.js', plugins: []},
  {path: 'external.js', plugins: []},
  {path: 'object.js', plugins: []},
  {path: 'circular.js', plugins: []},
  {path: 'dedupe.js', plugins: []},
  {path: 'locals.js', plugins: []},
  {path: 'aliases.js', plugins: []},
  {path: 'aliases_external.js', plugins: []},
  {path: 'node_exports.js', plugins: ['node']},
  {path: 'node_exports_reassign.js', plugins: ['node']},
  {path: 'node_exports_reassign2.js', plugins: ['node']},
  {path: 'node_exports_reassign3.js', plugins: ['node']},
];

describe('inspect', function() {
  tests.forEach(function(test) {
    it(test.path, function(done) {
      var file = fs.readFile(path_.join('testdata', test.path), 'utf8', function(err, text) {
        should.ifError(err);

        var defs = [], plugins = {doc_comment: {}}, files = [];
        test.plugins.forEach(function(p) { tern_support.loadPlugin(plugins, p, {}); });
        var server = tern_support.newServer(defs, plugins);
        server.addFile(test.path, text);
        server.flush(function(err) {
          should.ifError(err);
          if (plugins.node) server._node.modules[test.path].propagate(server.cx.topScope.defProp('exports'));

          var aliases = {local: {}, nonlocal: {}}, locals = {}, nonlocals = {};
          scopevisitor.inspect(test.path, server.cx.topScope, function(path, prop, local, alias) {
            (local ? locals : nonlocals)[path] = prop;
            if (alias) aliases[local ? 'local' : 'nonlocal'][path] = alias;
          });

          // Parse inline directives of the form:
          // /*DEF:<path>:<local>:<alias>*/
          // where <path> is the def's path, <local> is either 'local' or 'nonlocal' (without quotes),
          // and <alias> is the path of the destination def for this alias def. Options <local> and
          // <alias> are optional.
          var visitor = astannotate.nodeVisitor('DEF', function(type) { return type == 'Identifier' || type == 'Literal' || type == 'FunctionExpression'; }, function(node, info) {
            info = info.split(':');
            var path = info[0];
            var kind = info[1] || 'nonlocal';
            var defs = ({nonlocal: nonlocals, local: locals})[kind];
            should.exist(defs[path], 'expected ' + kind + ' path ' + path + ' to be emitted\n' + kind + 's:\n  ' + Object.keys(defs).join('\n  '));
            should.exist(defs[path].originNode, 'expected ' + kind + ' path ' + path + ' to have non-null originNode\nFull def:\n' + require('util').inspect(defs[path], null, 2));
            defs[path].originNode.should.equal(node);

            var alias = info[2];
            if (alias) {
              should.exist(aliases[kind][path], 'expected ' + kind + ' path ' + path + ' to be an alias');
              aliases[kind][path].should.eql(alias);
            } else {
              should.not.exist(aliases[kind][path], 'expected ' + kind + ' path ' + path + ' to not be an alias, but it aliases ' + aliases[kind][path]);
            }
          });
          visitor(text, server.files[0].ast);

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
});
