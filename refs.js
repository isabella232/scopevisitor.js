var util = require('./util');
var idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern'), walk = require('acorn/util/walk');

// refs takes a `file` parameter and returns an array of SourceGraph refs originating from AST nodes
// in the file.
tern.defineQueryType('sourcegraph:refs', {
  takesFile: true,
  run: function(server, query, file) {
    if (!server.options.plugins.node) throw new Error('node plugin not loaded');
    if (!file.ast._sourcegraph_annotatedSymbolDeclIds) throw new Error('AST not yet annotated with symbol decls by "symbols" query; run "symbols" first on ' + file.name);

    var res = {refs: []};
    idents.inspect(file.ast, function(ident) {
      var def = util.getDefinition(server, file, ident);
      var type = util.getType(server, file, ident);

      if (Object.keys(def) == 0) {
        // console.error('No def found for ident "' + ident.name + '" at file ' + file.name + ':' + ident.start + '-' + ident.end);
        return;
      }
      var ref = {astNode: ident._id, kind: 'ident'};
      if ((!type.origin || type.origin == file.name) && def.file == file.name) {
        // internal (same file) ref
        if (type.exprName == 'exports') {
          // handle reference to module.exports. the 'Refs returns a ref to reassigned
          // module.exports' test is an example of where this needs to be special cased.
          ref.symbol = def.origin + '/module.exports';
        } else {
          var declId = getDeclIdNode(file, def.start, def.end);
          ref.symbol = declId._declSymbol;
        }
      } else {
        if (!def.origin) throw new Error('No origin');
        // external ref
        if (storedDefOrigins.indexOf(type.origin) != -1) {
          // ref to stored def (not to external file)
          // query for type to get full name of referenced symbol (not just ident); e.g.,
          // "fs.readFile" not just "readFile"
          ref.symbol = '@' + type.origin + '/' + type.name;
        } else {
          ref.symbol = def.origin + '/' + ident.name;
        }
      }
      res.refs.push(ref);
    });
    return res;
  }
});

// getDeclIdNode searches the AST for the declaration node at the given start and end character
// offsets (i.e., its _declSymbol was set by a symbol query of this AST).
function getDeclIdNode(file, start, end) {
  var test = function(_t, node) {
    return !!node._declSymbol;
  };
  var expr = walk.findNodeAt(file.ast, null, end, test, idast.base);
  if (expr && expr.node) {
    return expr.node;
  }
  console.error('No DeclIdNode at file ' + file.name + ':' + start + '-' + end);
}

var storedDefOrigins = ['ecma5', 'node', 'jquery', 'requirejs', 'browser'];
