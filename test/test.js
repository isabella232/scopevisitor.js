var astannotate = require('astannotate'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path'),
    should = require('should');

var server = require('../tern_server').startTernServer('.', {doc_comment: true, node: true, refs: true, exported_symbols: true, local_symbols: true});

function graph(file, src, test) {
  server.reset();
  server.addFile(file, src);
  var fileAST = server.files.filter(function(f) { return f.name == file; })[0].ast;
  server.flush(function(err) {
    should.ifError(err);
    var r = {symbols: [], docs: [], refs: []};
    server.request({
      query: {type: 'sourcegraph:exported_symbols', file: file}}, function(err, res) {
        should.ifError(err);
        r.symbols.push.apply(r.symbols, res.symbols);
        r.docs.push.apply(r.docs, res.docs);
      });
    server.request({
      query: {type: 'sourcegraph:local_symbols', file: file}}, function(err, res) {
        should.ifError(err);
        r.symbols.push.apply(r.symbols, res.symbols);
        r.docs.push.apply(r.docs, res.docs);
      });
    server.request({
      query: {type: 'sourcegraph:refs', file: file},
    }, function(err, res) {
      should.ifError(err);
      r.refs = res.refs;
      test(fileAST, r);
    });
  });
}

function check(file, src, ast, r) {
  function mkDeclVisitor(directive) {
    return astannotate.rangeVisitor(directive, null, function(range, x) {
      should.exist(range.node, range.node || ('No AST node found at range ' + JSON.stringify(range)));
      x = eval('(' + x + ')');
      var sym = r.symbols.filter(function(s) { return s.decl == range.node._id && s.id.indexOf(x._ignoreSymbol) == -1; })[0];
      should.exist(sym, 'No symbol found with declaration at ' + range.node._id + '\nWant: ' + JSON.stringify(x) + '\nAll symbols:\n' + JSON.stringify(r.symbols, null, 2));
      for (var key in x) if (x.hasOwnProperty(key)) {
        var v = x[key];
        if (v instanceof RegExp) {
          sym[key].should.match(v);
        } else {
          sym[key].should.include(v);
        }
      }
    });
  }
  // Support nesting (use DECL1 for the first level of nesting).
  var declVisitor = mkDeclVisitor('DECL'), decl1Visitor = mkDeclVisitor('DECL1');
  var declIdVisitor = astannotate.nodeVisitor('DECLID', 'Identifier', function(identNode, x) {
    x = eval('(' + x + ')');
    var sym = r.symbols.filter(function(s) { return s.declId == identNode._id; })[0];
    should.exist(sym, 'No symbol found with declId at ' + identNode._id + '\nWant: ' + JSON.stringify(x) + '\nAll symbols:\n' + JSON.stringify(r.symbols, null, 2));
    sym.id.should.include(x);
  });
  var refVisitor = astannotate.nodeVisitor('REF', 'Identifier', function(identNode, x) {
    x = eval('(' + x + ')');
    var ref = r.refs.filter(function(r) { return r.astNode == identNode._id; })[0];
    should.exist(ref, 'No ref found at AST node ' + identNode._id);
    ref.symbol.should.include(x);
  });
  astannotate.multi([declVisitor, decl1Visitor, declIdVisitor, refVisitor])(src, ast);
}

var testCases = [
  {dir: 'simple', files: ['local_vars.js', 'local_funcs.js', 'node_exports.js', 'reassign_module_exports1.js', 'reassign_module_exports2.js', 'reassign_module_exports3.js', 'conditional_node_export.js', 'complex_node_exports.js', 'exports_and_locals.js']},
];

testCases.forEach(function(testCase) {
  describe('Case: ' + testCase.dir + '/', function() {
    testCase.files.forEach(function(filename) {
      it(filename, function(done) {
        var file = path.join(__dirname, 'testdata', testCase.dir, filename);
        var src = fs.readFile(file, 'utf8', function(err, src) {
          should.ifError(err);
          graph(file, src, function(ast, r) {
            check(file, src, ast, r);
            done();
          });
        });
      });
    });
  });
});
