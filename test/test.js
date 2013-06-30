var astannotate = require('astannotate'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path'),
    should = require('should');

var tern_support = require('../tern_support');
require('../ast');
require('../refs');
require('../symbols');

var debug = true;

function graph(dir, file, src, test) {
  var plugins = {};
  tern_support.loadPlugin(plugins, 'node', {});
  var server = tern_support.newServer([], plugins, dir);
  server.addFile(file, src);
  var fileAST = server.files.filter(function(f) { return f.name == file; })[0].ast;
  server.flush(function(err) {
    should.ifError(err);
    var r = {symbols: [], refs: []};
    server.request({
      query: {type: 'sourcegraph:symbols', file: file}}, function(err, res) {
        should.ifError(err);
        r.symbols.push.apply(r.symbols, res);
      });
    server.request({
      query: {type: 'sourcegraph:refs', file: file},
    }, function(err, res) {
      should.ifError(err);
      r.refs = res;
      test(fileAST, r);
    });
  });
}

function check(dir, file, src, ast, r) {
  function mkDefVisitor(directive) {
    return astannotate.rangeVisitor(directive, null, function(range, x) {
      should.exist(range.node, range.node || ('No AST node found at range ' + JSON.stringify(range)));
      x = eval('(' + x + ')');
      var sym = r.symbols.filter(function(s) { return s.defNode == range.node._id && s.path.indexOf(x._ignoreSymbol) == -1; })[0];
      should.exist(sym, 'No symbol found with definition at ' + range.node._id + '\nWant: ' + JSON.stringify(x) + '\nAll symbols:\n' + JSON.stringify(r.symbols, null, 2));
      for (var key in x) if (x.hasOwnProperty(key)) {
        var v = x[key];
        should.exist(sym[key], 'expected symbol to have key ' + JSON.stringify(key) + '; keys are ' + JSON.stringify(Object.keys(sym)));
        if (sym[key] !== v && debug) {
          console.log('KEY', key, v, sym);
        }
        sym[key].should.eql(v);
      }
    });
  }
  // Support nesting (use DECL1 for the first level of nesting).
  var defVisitor = mkDefVisitor('DEF'), def1Visitor = mkDefVisitor('DEF1');
  var declIdentVisitor = astannotate.nodeVisitor('DECLID', identOrLiteral, function(identNode, info) {
    info = info.split(',');
    var symbolPath = info[0], symbolIsLocal = info[1] === 'local';
    var sym = r.symbols.filter(function(s) { return s.declIdentNode == identNode._id; })[0];
    should.exist(sym, 'No symbol found with declIdentNode at ' + identNode._id + '\nWant: ' + JSON.stringify(info) + '\nAll symbols:\n' + JSON.stringify(r.symbols, null, 2));
    sym.path.should.eql(symbolPath);
    sym.local.should.eql(symbolIsLocal);
  });
  var refVisitor = astannotate.nodeVisitor('REF', identOrLiteral, function(identNode, info) {
    info = info.split(',');
    var symbolPath = info[0], symbolIsLocal = info[1] === 'local', origin = info[2] || file;
    var ref = r.refs.filter(function(r) { return r.astNode == identNode._id; })[0];
    should.exist(ref, 'No ref found at AST node ' + identNode._id + '\nWant: ' + JSON.stringify(info));
    should.exist(ref.symbol, 'Ref ' + JSON.stringify(info) + ' at AST node ' + identNode._id + ' has no symbol property');
    ref.symbol.should.eql(symbolPath);
    should.exist(ref.local, 'Ref ' + JSON.stringify(info) + ' at AST node ' + identNode._id + ' has no local property');
    should.equal(ref.local, symbolIsLocal, 'Expected ref ' + JSON.stringify(info) + ' at AST node ' + identNode._id + ' to have local=' + symbolIsLocal + ', got ' + ref.local);
    origin = origin.replace('$DIR', dir);
    should.exist(ref.symbolOrigin, 'Ref ' + JSON.stringify(info) + ' at AST node ' + identNode._id + ' has no origin property');
    should.equal(ref.symbolOrigin, origin, 'Expected ref ' + JSON.stringify(info) + ' at AST node ' + identNode._id + ' to have origin=' + origin + ', got ' + ref.symbolOrigin);
  });
  astannotate.multi([defVisitor, def1Visitor, declIdentVisitor, refVisitor])(src, ast);
}

function identOrLiteral(nodeType) {
  return nodeType === 'Identifier' || nodeType === 'Literal';
}

var testCases = [
  {dir: 'simple', files: [
    // 'local_vars.js',
    // 'local_funcs.js',
    'node_stdlib.js',
    'node_exports.js',
    'def.js',
    'reassign_module_exports1.js',
    'reassign_module_exports2.js',
    'reassign_module_exports3.js',
    'conditional_node_export.js',
    'complex_node_exports.js',
    'exports_and_locals.js',
    'chained_exports.js']},
  {dir: 'node_modules/bar/node_modules/foo', files: ['foo.js']},
  {dir: 'node_modules/bar', files: ['requires.js', 'index.js', 'modfunc_call.js']},
];

testCases.forEach(function(testCase) {
  describe('Case: ' + testCase.dir + '/', function() {
    testCase.files.forEach(function(filename) {
      it(filename, function(done) {
        var dir = path.join(__dirname, 'testdata', testCase.dir);
        var file = path.join(dir, filename);
        var src = fs.readFile(file, 'utf8', function(err, src) {
          should.ifError(err);
          graph(dir, file, src, function(ast, r) {
            check(dir, file, src, ast, r);
            done();
          });
        });
      });
    });
  });
});
