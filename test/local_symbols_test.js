var should = require('should');

var server = require('../tern_server').startTernServer('.', {doc_comment: true, node: true, local_symbols: true});

require('../local_symbols').debug = true;

describe('Local symbols', function() {
  function requestSymbols(src, test) {
    server.reset();
    server.request({
      query: {type: 'sourcegraph:local_symbols', file: '#0'},
      files: [
        {name: 'a.js', type: 'full', text: src},
      ],
    }, function(err, res) {
      should.ifError(err);
      test(res);
    });
  }

  function withoutModule(symbols) {
    return symbols.filter(function(symbol) {
      return !/module\.exports$/.test(symbol.id);
    });
  }

  describe('locals', function() {
    it('returns an array of local symbols', function(done) {
      requestSymbols('var x = 1;', function(res) {
        withoutModule(res.symbols).should.eql(
          [
            {
              id: 'a.js/local:x:4',
              kind: 'var',
              name: 'x',
              declId: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:x/id/Identifier',
              decl: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:x/init/Literal',
              exported: false,
              obj: {typeExpr: 'number'}
            }
          ]
        );
        done();
      });
    });
    it('emits func expr param symbols', function(done) {
      requestSymbols('(function(a){})', function(res) {
        withoutModule(res.symbols).should.eql(
          [
            {
              id: 'a.js/local:a:10',
              kind: 'var',
              name: 'a',
              declId: '/Program/body/0/ExpressionStatement/expression/FunctionExpression/params/0/Identifier',
              decl: '/Program/body/0/ExpressionStatement/expression/FunctionExpression/params/0/Identifier',
              exported: false,
              obj: {typeExpr: '?'}
            }
          ]
        );
        done();
      });
    });
    it('emits func decl param symbols', function(done) {
      requestSymbols('function f(a){}', function(res) {
        withoutModule(res.symbols).should.includeEql(
          {
            id: 'a.js/local:a:11',
            kind: 'var',
            name: 'a',
            declId: '/Program/body/0/FunctionDeclaration:f/params/0/Identifier',
            decl: '/Program/body/0/FunctionDeclaration:f/params/0/Identifier',
            exported: false,
            obj: {typeExpr: '?'}
          }
        );
        done();
      });
    });
    it('emits innermost func as decl for func decl symbol', function(done) {
      requestSymbols('(function(){function f(){}})', function(res) {
        withoutModule(res.symbols).should.eql(
          [{
            id: 'a.js/local:f:21',
            kind: 'func',
            name: 'f',
            declId: '/Program/body/0/ExpressionStatement/expression/FunctionExpression/body/BlockStatement/body/0/FunctionDeclaration:f/id/Identifier',
            decl: '/Program/body/0/ExpressionStatement/expression/FunctionExpression/body/BlockStatement/body/0/FunctionDeclaration:f',
            exported: false,
            obj: { typeExpr: 'fn()' }
          }]
        );
        done();
      });
    });
  });
});
