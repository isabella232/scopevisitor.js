var should = require('should');

var server = require('../tern_server').startTernServer('.', {doc_comment: true, node: true, refs: true, symbols: true});

describe('Refs', function() {
  function requestRefs(src, test) {
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

  it('returns a ref to an external symbol', function(done) {
    requestRefs('require("./test/testdata/b").x', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/MemberExpression/object/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: '@node/require'
          },
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/b.js/x'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to an external symbol (indirect)', function(done) {
    requestRefs('var b = require("./test/testdata/b");b;b.x', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:b/id/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/b.js/module.exports'
          },
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:b/init/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: '@node/require'
          },
          {
            astNode: '/Program/body/1/ExpressionStatement/expression/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/b.js/module.exports'
          },
          {
            astNode: '/Program/body/2/ExpressionStatement/expression/MemberExpression/object/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/b.js/module.exports'
          },
          {
            astNode: '/Program/body/2/ExpressionStatement/expression/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/b.js/x'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to an external symbol (indirect, with reassigned module.exports)', function(done) {
    requestRefs('var c = require("./test/testdata/c");c;c();c.d()', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:c/id/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/c.js/module.exports'
          },
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:c/init/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: '@node/require'
          },
          {
            astNode: '/Program/body/1/ExpressionStatement/expression/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/c.js/module.exports'
          },
          {
            astNode: '/Program/body/2/ExpressionStatement/expression/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/c.js/module.exports'
          },
          {
            astNode: '/Program/body/3/ExpressionStatement/expression/CallExpression/callee/MemberExpression/object/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/c.js/module.exports'
          },
          {
            astNode: '/Program/body/3/ExpressionStatement/expression/CallExpression/callee/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'test/testdata/c.js/d'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to a predef symbol', function(done) {
    requestRefs('require("fs").readFile', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/MemberExpression/object/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: '@node/require'
          },
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: '@node/fs.readFile'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to external module', function(done) {
    requestRefs('var m = require("fs");', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:m/id/Identifier',
            kind: 'ident',
            symbol: '@node/fs'
          },
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:m/init/CallExpression/callee/Identifier',
            kind: 'ident',
            symbol: '@node/require'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to an exported symbol defined in the same file', function(done) {
    requestRefs('module.exports.x=function(){};var y = module.exports.x;', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'a.js/x'
          },
          {
            astNode: '/Program/body/1/VariableDeclaration/declarations/0/VariableDeclarator:y/id/Identifier',
            kind: 'ident',
            symbol: 'a.js/y:local:34'
          },
          {
            astNode: '/Program/body/1/VariableDeclaration/declarations/0/VariableDeclarator:y/init/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'a.js/x'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to reassigned module.exports', function(done) {
    requestRefs('module.exports = x;function x() {}', function(res) {
      res.refs.should.eql(
        [
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier',
            kind: 'ident',
            symbol: 'a.js/module.exports'
          },
          {
            astNode: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/Identifier',
            kind: 'ident',
            symbol: 'a.js/module.exports'
          },
          {
            astNode: '/Program/body/1/FunctionDeclaration:x/id/Identifier',
            kind: 'ident',
            symbol: 'a.js/module.exports'
          }
        ]
      );
      done();
    });
  });
  it('returns a ref to a local symbol', function(done) {
    requestRefs('var x = 7; x;', function(res) {
      res.refs.should.eql(
        res.refs,
        [
          {
            astNode: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:x/id/Identifier',
            kind: 'ident',
            symbol: 'a.js/x:local:4'
          },
          {
            astNode: '/Program/body/1/ExpressionStatement/expression',
            kind: 'ident',
            symbol: 'a.js/x:local:4'
          }
        ]
      );
      done();
    });
  });
});
