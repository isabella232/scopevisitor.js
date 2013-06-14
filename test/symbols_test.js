var should = require('should');

var server = require('../tern_server').startTernServer('.', {doc_comment: true, node: true, symbols: true});

describe('Symbols', function() {
  function requestSymbols(src, test) {
    server.request({
      query: {type: 'sourcegraph:symbols', file: '#0'},
      files: [
        {name: 'a.js', type: 'full', text: src},
      ],
    }, function(err, res) {
      should.ifError(err);
      test(res);
    });
  }

  function getSymbolNamed(symbols, name) {
    for (var i = 0; i < symbols.length; ++i) {
      if (symbols[i].name == name) return symbols[i];
    }
    throw new Error('No symbol with name "' + name + '" found (all symbols: ' + JSON.stringify(symbols.map(function(s) { return s.name; })) + ')');
  }

  it('returns an array of exported symbols', function(done) {
    requestSymbols('module.exports.x = 1;', function(res) {
      res.symbols.should.eql(
          [
            {
              id: 'a.js/x',
              kind: 'var',
              name: 'x',
              declId: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property',
              decl: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression',
              exported: true,
              obj: {typeExpr: 'number'},
            },
          ]
      );
      done();
    });
  });
  it('returns an array of local symbols', function(done) {
    requestSymbols('var x = 1;', function(res) {
      res.symbols.should.eql(
        [
          {
            id: 'a.js/x:local:4',
            kind: 'var',
            name: 'x',
            declId: '/Program/body/0/VariableDeclaration/declarations/0:x/id',
            decl: '/Program/body/0/VariableDeclaration/declarations/0:x',
            exported: false,
            obj: {typeExpr: 'number'}
          }
        ]
      );
      done();
    });
  });
  it('annotates the types of functions', function(done) {
    requestSymbols('module.exports.x = function(a, b) { b*=2; a+="z"; return [a]; };', function(res) {
      var x = getSymbolNamed(res.symbols, 'x');
      should.equal(x.obj.typeExpr, 'fn(a: string, b: number) -> [string]');
      should.equal(x.kind, 'func');
      done();
    });
  });
  it('returns docs', function(done) {
    requestSymbols('// doc for x\nmodule.exports.x = function() {};\n\nvar z={\n  //doc for y\n  y: function(){}\n};\nmodule.exports.y=z.y;', function(res) {
      should.deepEqual(res.docs, [
        {symbol: 'a.js/x', body: 'doc for x'},
        // TODO(sqs): emit the doc for y
        // {symbol: 'a.js/y', body: 'doc for y'},
      ]);
      done();
    });
  });
  it('sets the declId and decl to the key/value in an object literal (indirect)', function(done) {
    requestSymbols('var y={z:7};module.exports.x = y.z;', function(res) {
      var x = getSymbolNamed(res.symbols, 'x');
      should.equal(x.declId, '/Program/body/1/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(x.decl, '/Program/body/0/VariableDeclaration/declarations/0:y/init/ObjectExpression/properties/0/value');
      done();
    });
  });
  it('sets the declId and decl to the key/value in an object literal', function(done) {
    requestSymbols('module.exports = {w: 1, x: function(){}, z: 7};', function(res) {
      var x = getSymbolNamed(res.symbols, 'x');
      should.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/ObjectExpression/properties/1/key');
      should.equal(x.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/ObjectExpression/properties/1/value/FunctionExpression');
      done();
    });
  });
  it('sets the decl to the def of the RHS', function(done) {
    requestSymbols('module.exports=f;function f(){}', function(res) {
      var f = getSymbolNamed(res.symbols, null);
      should.equal(f.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(f.decl, '/Program/body/1/FunctionDeclaration:f');
      done();
    });
  });
  it('sets the decl to the exported function stmt', function(done) {
    requestSymbols('module.exports.F=f;function f(){}', function(res) {
      var f = getSymbolNamed(res.symbols, 'F');
      should.equal(f.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(f.decl, '/Program/body/1/FunctionDeclaration:f');
      done();
    });
  });
  it('sets the decl to the exported function expr', function(done) {
    requestSymbols('var f = function(){};module.exports.F=f', function(res) {
      var f = getSymbolNamed(res.symbols, 'F');
      should.equal(f.declId, '/Program/body/1/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(f.decl, '/Program/body/0/VariableDeclaration/declarations/0:f');
      done();
    });
  });
  it('sets the decl to the exported function expr (reassign)', function(done) {
    requestSymbols('var f = function(){};module.exports=f', function(res) {
      var f = getSymbolNamed(res.symbols, null);
      should.equal(f.declId, '/Program/body/1/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(f.decl, '/Program/body/0/VariableDeclaration/declarations/0:f');
      done();
    });
  });
  it('sets the decl to the whole function expr', function(done) {
    requestSymbols('module.exports = function() {};', function(res) {
      var m = getSymbolNamed(res.symbols, null);
      should.equal(m.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(m.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression');
      done();
    });
  });
  it('sets the decl to the rightmost value in a chained assignment', function(done) {
    requestSymbols('module.exports.x = module.exports.y = function() {};', function(res) {
      var x = getSymbolNamed(res.symbols, 'x');
      should.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property');
      should.equal(x.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/AssignmentExpression/right/FunctionExpression');
      done();
    });
  });
});
