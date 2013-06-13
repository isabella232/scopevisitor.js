var idast = require('idast'), infer = require('tern/lib/infer'), tern = require('tern');

// symbols takes a `file` parameter and returns an array of SourceGraph symbols defined in the file.
tern.defineQueryType('symbols', {
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
        var id = file.name + '/' + x.name;

        if (x.doc) {
          res.docs.push({
            symbol: id,
            body: x.doc,
          });
        }

        var nodes = getNodes(file, x.name, x.start, x.end);
        var symbol = {
          id: id,
          kind: 'var', // TODO(sqs): set if func
          name: x.name,
          declId: nodes.ident.node._id,
          decl: nodes.decl.node._id,
          exported: true,
        };

        // record what this ident declares, for later use in computing refs
        nodes.ident.node._declSymbol = id;

        var type = infer.expressionType(nodes.ident).getType();
        if (type) {
          symbol.obj = {typeExpr: type.toString(5)};
          symbol.kind = symbol.obj.typeExpr.indexOf('fn(') == -1 ? 'var' : 'func';
        }

        return symbol;
      }));
    });

    file.ast._sourcegraph_annotatedSymbolDeclIds = true;

    return res;
  }
});

// getNodes searches the AST for the most appropriate identifier and declaration to associate with
// the named symbol at the specified start/end character offsets.
function getNodes(file, name, start, end) {
  var ident = infer.findExpressionAround(file.ast, start, end, file.scope);
  var decl = {scope: ident.scope};

  // be smart about what the logical identifier and declaration is
  switch (ident.node.type) {

  // TODO(sqs): in AssignmentExpressions, set the decl to the rightmost value (i.e., `z` in `x = y = z`)

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
