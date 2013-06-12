var assert = require('assert');

var server = require('./helpers').startTernServer('.', {doc_comment: true, node: true, symbols: true});

describe('Symbols', function() {
  function requestSymbols(src, test) {
    server.request({
      query: {type: 'symbols', file: '#0'},
      files: [
        {name: 'a.js', type: 'full', text: src},
      ],
    }, function(err, res) {
      assert.ifError(err);
      test(res);
    });
  }

  it('returns an array of symbols', function(done) {
    requestSymbols('module.exports.x = 1;', function(res) {
      assert.deepEqual(
        res.symbols,
          [
            {
              id: 'a.js/x',
              kind: 'var',
              name: 'x',
              decl: '/Program/body/0/ExpressionStatement',
              declId: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression',
              exported: true,
              obj: {typeExpr: 'number'},
            },
          ]
      );
      done();
    });
  });
  it('annotates the types of functions', function(done) {
    requestSymbols('module.exports.x = function(a, b) { b*=2; a+="z"; return [a]; };', function(res) {
      assert.equal(res.symbols.length, 1);
      assert.equal(res.symbols[0].obj.typeExpr, 'fn(a: string, b: number) -> [string]');
      assert.equal(res.symbols[0].kind, 'func');
      done();
    });
  });
  it('returns docs', function(done) {
    requestSymbols('// doc for x\nmodule.exports.x = function() {};\n\nvar z={\n  //doc for y\n  y: function(){}\n};\nmodule.exports.y=z.y;', function(res) {
      assert.deepEqual(res.docs, [
        {symbol: 'a.js/x', body: 'doc for x'},
        // TODO(sqs): emit the doc for y
        // {symbol: 'a.js/y', body: 'doc for y'},
      ]);
      done();
    });
  });
  it('sets the declId and decl to the key/value in an object literal', function(done) {
    requestSymbols('module.exports = {w: 1, x: function(){}, z: 7};', function(res) {
      var x = res.symbols[1];
      assert.equal(x.name, 'x');
      assert.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/ObjectExpression/properties/1/key');
      assert.equal(x.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/ObjectExpression/properties/1/value/FunctionExpression');
      done();
    });
  });
  if (0) it('sets the decl to the rightmost value in a chained assignment', function(done) {
    requestSymbols('module.exports.x = module.exports.y = function() {};', function(res) {
      var x = res.symbols[1];
      assert.equal(x.name, 'x');
      assert.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression');
      assert.equal(x.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/AssignmentExpression/right/FunctionExpression');
      done();
    });
  });
});
