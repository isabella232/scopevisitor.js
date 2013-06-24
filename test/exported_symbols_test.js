var should = require('should');

var server = require('../tern_server').startTernServer('.', {doc_comment: true, node: true, exported_symbols: true});

require('../exported_symbols').debug = true;

describe('Symbols', function() {
  var fakeFilename = 'a.js';
  function requestSymbols(src, test) {
    server.reset();
    server.request({
      query: {type: 'sourcegraph:exported_symbols', file: '#0'},
      files: [
        {name: fakeFilename, type: 'full', text: src},
      ],
    }, function(err, res) {
      should.ifError(err);
      test(res);
    });
  }

  function getSymbol(symbols, id) {
    for (var i = 0; i < symbols.length; ++i) {
      if (symbols[i].id.indexOf(id) !== -1) return symbols[i];
    }
    throw new Error('No symbol with name "' + id + '" found (all symbols: ' + JSON.stringify(symbols.map(function(s) { return s.id; })) + ')');
  }

  function withoutModule(symbols) {
    return symbols.filter(function(symbol) {
      return symbol.kind !== 'module';
    });
  }

  describe('file/module', function() {
    it('returns the module as a module if module.exports is not reassigned to a func', function(done) {
      requestSymbols(' ', function(res) {
        res.symbols.should.eql([
          {
            id: '',
            kind: 'module',
            name: 'a',
            decl: '/Program',
            exported: true,
          }
        ]);
        done();
      });
    });
    it('returns the module as a func if module.exports is reassigned to a func', function(done) {
      requestSymbols('module.exports = function(){};', function(res) {
        res.symbols.should.eql([
          {
            id: '',
            kind: 'func',
            name: 'a',
            decl: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/FunctionExpression',
            declId: "/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier",

            exported: true,
            obj: {typeExpr: 'fn()'},
          }
        ]);
        done();
      });
    });
  });

  it('returns an array of exported symbols', function(done) {
    requestSymbols('module.exports.x = function(){};', function(res) {
      withoutModule(res.symbols).should.eql(
          [
            {
              id: 'exports.x',
              kind: 'func',
              name: 'x',
              declId: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier',
              decl: '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/FunctionExpression',
              exported: true,
              obj: {typeExpr: 'fn()'},
            },
          ]
      );
      done();
    });
  });
  it('annotates the types of functions', function(done) {
    requestSymbols('module.exports.x = function(a, b) { b*=2; a+="z"; return [a]; };', function(res) {
      var x = getSymbol(res.symbols, 'exports.x');
      should.equal(x.obj.typeExpr, 'fn(a: string, b: number) -> [!0]');
      /// should.equal(x.obj.typeExpr, 'fn(a: string, b: number) -> [string]');
      should.equal(x.kind, 'func');
      done();
    });
  });
  it('returns docs', function(done) {
    requestSymbols('// doc for x\nmodule.exports.x = function() {};\n\nvar z={\n  //doc for y\n  y: function(){}\n};\nmodule.exports.y=z.y;', function(res) {
      res.docs.should.eql([
        {symbol: 'exports.x', body: 'doc for x'},
        {symbol: 'exports.y', body: 'doc for y'},
      ]);
      done();
    });
  });
  it('sets the declId and decl to the key/value in an object literal (indirect)', function(done) {
    requestSymbols('var y={z:function(){}};module.exports.x = y.z;', function(res) {
      var x = getSymbol(res.symbols, 'exports.x');
      /// should.equal(x.declId, '/Program/body/1/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
      should.equal(x.decl, '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:y/init/ObjectExpression/properties/0:z/value/FunctionExpression');
      done();
    });
  });
  it('sets the declId and decl to the key/value in an object literal', function(done) {
    requestSymbols('module.exports = {w: 1, x: function(){}, z: 7};', function(res) {
      var x = getSymbol(res.symbols, 'exports.x');
      should.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/ObjectExpression/properties/1:x/key/Identifier');
      should.equal(x.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/ObjectExpression/properties/1:x/value/FunctionExpression');
      done();
    });
  });
  it('sets the decl to the def of the RHS', function(done) {
    requestSymbols('module.exports=f;function f(){}', function(res) {
      var f = getSymbol(res.symbols, '');
      should.equal(f.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
      should.equal(f.decl, '/Program/body/1/FunctionDeclaration:f');
      done();
    });
  });
  it('sets the decl to the exported function stmt', function(done) {
    requestSymbols('module.exports.F=f;function f(){}', function(res) {
      var f = getSymbol(res.symbols, 'exports.F');
      /// should.equal(f.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
      should.equal(f.decl, '/Program/body/1/FunctionDeclaration:f');
      done();
    });
  });
  it('sets the decl to the exported function expr', function(done) {
    requestSymbols('var f = function(){};module.exports.F=f', function(res) {
      var f = getSymbol(res.symbols, 'exports.F');
      /// should.equal(f.declId, '/Program/body/1/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
      should.equal(f.decl, '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:f/init/FunctionExpression');
      done();
    });
  });
  it('sets the decl to the exported function expr (reassign)', function(done) {
    requestSymbols('var f = function(){};module.exports=f', function(res) {
      var f = getSymbol(res.symbols, '');
      should.equal(f.declId, '/Program/body/1/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
      should.equal(f.decl, '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:f/init/FunctionExpression');
      done();
    });
  });
  it('sets the decl to the whole function expr', function(done) {
    requestSymbols('module.exports = function() {};', function(res) {
      var m = getSymbol(res.symbols, '');
      should.equal(m.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
      should.equal(m.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/FunctionExpression');
      done();
    });
  });
  /// it('sets the decl to the rightmost value in a chained assignment', function(done) {
  ///   requestSymbols('module.exports.x = module.exports.y = function() {};', function(res) {
  ///     var x = getSymbol(res.symbols, 'exports.x');
  ///     /// should.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
  ///     should.equal(x.decl, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/right/AssignmentExpression/right/FunctionExpression');
  ///     done();
  ///   });
  /// });
  /// it('sets the decl to the rightmost value in a chained assignment (with indirect)', function(done) {
  ///   requestSymbols('module.exports.x = module.exports.y = f; function f() {};', function(res) {
  ///     var x = getSymbol(res.symbols, 'exports.x');
  ///     /// should.equal(x.declId, '/Program/body/0/ExpressionStatement/expression/AssignmentExpression/left/MemberExpression/property/Identifier');
  ///     should.equal(x.decl, '/Program/body/1/FunctionDeclaration:f');
  ///     done();
  ///   });
  /// });
});
