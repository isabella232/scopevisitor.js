var should = require('should');

var server = require('../tern_server').startTernServer('.', {doc_comment: true, node: true, refs: true, symbols: true});

describe('Refs', function() {
  function requestRefs(src, test) {
    server.reset();
    server.addFile('a.js', src);
    server.request({
      query: {type: 'sourcegraph:symbols', file: 'a.js'}}, function(err) {
        if (err) throw err;
      });
    server.request({
      query: {type: 'sourcegraph:refs', file: 'a.js'},
    }, function(err, res) {
      should.ifError(err);
      test(res);
    });
  }

  it('omits <top> symbol (e.g., global this)', function(done) {
    // TODO(sqs): this is actually a bug that deserves more examination
    requestRefs(';(function(w){}(this))', function(res) {
      res.should.eql([]);
      done();
    });
  });
  it('returns a ref to a predef symbol', function(done) {
    requestRefs('require("fs").readFile', function(res) {
      res.should.eql(
        [
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/MemberExpression/object/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: 'exports.require',
            local: false,
            symbolOrigin: '@node',
            nodeStdlibModule: 'module',
          },
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'exports.readFile',
            local: false,
            symbolOrigin: '@node',
            nodeStdlibModule: 'fs',
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to external module', function(done) {
    requestRefs('var m = require("fs");', function(res) {
      res.should.eql(
        [
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:m/id/Identifier',
            kind: 'ident',
            symbol: 'exports',
            local: false,
            symbolOrigin: '@node',
            nodeStdlibModule: 'fs',
          },
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:m/init/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: 'exports.require',
            local: false,
            symbolOrigin: '@node',
            nodeStdlibModule: 'module',
          }
        ]
      );
      done();
    });
  });
});
