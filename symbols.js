var util = require('./util');
var idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern');

// sourcegraph:symbols takes a `file` parameter and returns an array of SourceGraph symbols defined
// in the file.
tern.defineQueryType('sourcegraph:symbols', {
  takesFile: true,
  run: function(server, query, file) {
    if (!server.options.plugins.doc_comment) throw new Error('doc_comment plugin not loaded');
    if (!server.options.plugins.node) throw new Error('node plugin not loaded');

    if (!file.ast._id) {
      // file AST nodes have not been assigned IDs by idast
      idast.assignIds(file.ast);
    }

    var res = {docs: [], symbols: []};

    server.request({
      query: {type: 'node_exports', file: file.name},
    }, function(err, xres) {
      if (err) throw err;
      res.symbols.push.apply(res.symbols, xres.exports.map(function(x) {
        var nodes = getNodes(file, x.name, x.start, x.end);
        var symbol = {
          id: file.name + '/' + x.name,
          kind: 'var',
          name: x.name,
          declId: nodes.ident.node._id,
          decl: nodes.decl.node._id,
          exported: true,
        };

        // record that this decl is of an exported symbol so we don't re-emit it as a local decl below
        nodes.decl.node._isExportedDecl = true;

        // record what this ident declares, for later use in computing refs
        nodes.ident.node._declSymbol = symbol.id;

        updateSymbolWithType(symbol, infer.expressionType(nodes.ident).getType());

        if (x.doc) {
          res.docs.push({
            symbol: symbol.id,
            body: x.doc,
          });
        }

        return symbol;
      }));
    });

    idents.inspect(file.ast, function(ident) {
      var def = util.getDefinition(server, file, ident);
      var isDecl = (def.start == ident.start && def.end == ident.end && def.file == file.name);
      var declNode = getNodes(file, ident.name, ident.start, ident.end).decl.node;
      if (isDecl && !declNode._isExportedDecl) {
        var symbol = {
          id: file.name + '/' + ident.name + ':local:' + ident.start,
          kind: 'var',
          name: ident.name,
          declId: ident._id,
          decl: declNode._id,
          exported: false,
        };

        // record what this ident declares, for later use in computing refs
        ident._declSymbol = symbol.id;

        updateSymbolWithType(symbol, util.getType(server, file, ident).type);

        res.symbols.push(symbol);
      }
    });

    file.ast._sourcegraph_annotatedSymbolDeclIds = true;

    return res;
  }
});

// updateSymbolWithType sets symbol's obj and kind based on the type.
function updateSymbolWithType(symbol, type) {
  if (type) {
    symbol.obj = {typeExpr: type.toString(5)};
    symbol.kind = symbol.obj.typeExpr.indexOf('fn(') == -1 ? 'var' : 'func';
  }
}

// getNodes searches the AST for the most appropriate identifier and declaration to associate with
// the named symbol at the specified start/end character offsets.
function getNodes(file, name, start, end) {
  var ident = infer.findExpressionAround(file.ast, start, end, file.scope);
  var decl = {scope: ident.scope};

  // be smart about what the logical identifier and declaration is
  switch (ident.node.type) {

  // TODO(sqs): in chained AssignmentExpressions, set the decl to the rightmost value (i.e., `z` in `x = y = z`)

  case 'ObjectExpression':
    // set the ident to the key and decl to the value
    for (var i = 0; i < ident.node.properties.length; ++i) {
      var prop = ident.node.properties[i];
      if ((prop.key.name || prop.key.value) == name) {
        ident.node = prop.key;
        decl.node = prop.value;
        break;
      }
    }
    break;

  }

  // fall back to the enclosing statement
  if (!decl.node) {
    decl = infer.findExpressionAround(file.ast, start, end, file.scope, "Statement");
  }

  return {ident: ident, decl: decl};
}
