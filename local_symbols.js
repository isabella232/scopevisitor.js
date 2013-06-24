var symbol_helpers = require('./symbol_helpers'), util = require('./util');
var idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

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
      var declNode = getDeclNodeForLocal(server, file, ident, type, def);
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
      symbol_helpers.updateSymbolWithType(symbol, util.getType(server, file, ident).type);
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

function getDeclNodeForLocal(server, file, node, type, def) {
  var declNode = symbol_helpers.getDeclarationAround(file, node.end);
  if (!declNode) return;
  var nodes = symbol_helpers.getIdentAndDeclNodes(server, file, declNode, node.name, true, node);
  if (nodes) return nodes.decl;
  else if (exports.debug) console.error('Failed to get decl node for local symbol at ' + file.name + ':' + node.start + '-' + node.end);
}
