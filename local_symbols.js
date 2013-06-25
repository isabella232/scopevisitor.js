var util = require('./util');
var defnode = require('defnode'), idast = require('idast'), idents = require('javascript-idents'), tern = require('tern');

exports.debug = false;

// sourcegraph:local_symbols takes a `file` parameter and returns an array of SourceGraph symbols
// defined in the file.
tern.defineQueryType('sourcegraph:local_symbols', {
  takesFile: true,
  run: function(server, query, file) {
    if (!server.options.plugins.doc_comment) throw new Error('doc_comment plugin not loaded');

    if (!file.ast._id) {
      // file AST nodes have not been assigned IDs by idast
      idast.assignIds(file.ast);
    }

    var res = {docs: [], symbols: []};
    idents.inspect(file.ast, function(ident) {
      if (typeof ident._declSymbol !== 'undefined') return;
      var type = util.getType(server, file, ident);
      if (type.exprName == 'exports') return;
      var def = util.getDefinition(server, file, ident);
      var isDecl = (def.start == ident.start && def.end == ident.end && def.file == file.name && (!type.origin || type.origin == file.name));
      if (!isDecl) return;
      var declNode = defnode.findDefinitionNode(file.ast, ident.start, ident.end);
      if (!declNode) return;
      if (declNode._declSymbol && ident._id.indexOf('params') == -1) return;
      var symbol = {
        id: file.name + '/local:' + ident.name + ':' + ident.start,
        kind: 'var',
        name: ident.name,
        declId: ident._id,
        decl: declNode._id,
        exported: false,
      };
      updateSymbolWithType(symbol, util.getType(server, file, ident).type);
      res.symbols.push(symbol);
      // record what this ident declares, for later use in computing refs
      ident._declSymbol = symbol.id;

      var doc = util.getDoc(server, file, declNode) || util.getDoc(server, file, ident);
      if (doc && doc.doc) {
        res.docs.push({
          symbol: symbol.id,
          body: doc.doc,
        });
      }
    });

    file.ast._sourcegraph_annotatedLocalSymbolDeclIds = true;

    return res;
  }
});

// updateSymbolWithType sets symbol's obj and kind based on the type.
function updateSymbolWithType(symbol, type) {
  if (type) {
    symbol.obj = {typeExpr: type};
    symbol.kind = symbol.obj.typeExpr.indexOf('fn(') === 0 ? 'func' : 'var';
  }
}
