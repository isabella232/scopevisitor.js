var defnode = require('defnode'),
    idast = require('idast'),
    infer = require('tern/lib/infer'),
    path_ = require('path'),
    scopevisitor = require('scopevisitor'),
    tern = require('tern');

exports.debug = false;

// sourcegraph:symbols takes a `file` parameter and returns an array of SourceGraph symbols
// defined in the file.
tern.defineQueryType('sourcegraph:symbols', {
  takesFile: true,
  run: function(server, query, file) {
    if (!file.ast._id) {
      // file AST nodes have not been assigned IDs by idast
      idast.assignIds(file.ast);
    }

    var symbols = [];

    if (server.options.plugins.node) server._node.modules[file.name].propagate(server.cx.topScope.defProp('exports'));
    scopevisitor.inspect([file.name], server.cx.topScope, function(path, av, local, alias) {
      var sym = {
        origin: file.name,
        path: path,
        local: !!local,
        alias: alias,
      };

      var typ = av.getType(false);
      if (typ) {
        sym.typeExpr = typ.toString(1);
      }

      if (av.doc) sym.doc = av.doc;
      else if (typ) sym.doc = typ.doc;

      if (typ && typ.originNode) {
        sym.defNode = typ.originNode._id;
        typ.originNode._declSymbol = sym;
      }
      if (av.originNode) {
        if (av.originNode.type === 'Identifier' || av.originNode.type === 'Literal') {
          if (!sym.declIdentNode) {
            sym.declIdentNode = av.originNode._id;
            av.originNode._declSymbol = sym;
          }
          if (!sym.defNode) {
            var defNode = defnode.findDefinitionNode(file.ast, av.originNode.start, av.originNode.end);
            if (defNode) {
              sym.defNode = defNode._id;
              defNode._declSymbol = sym;
            }
          }
        } else {
          if (!sym.defNode) {
            sym.defNode = av.originNode._id;
            av.originNode._declSymbol = sym;
          }
        }
      }
      if (typ && typ.originNode && !sym.declIdentNode) {
        var nameNodes = defnode.findNameNodes(file.ast, typ.originNode.start, typ.originNode.end);
        if (nameNodes) {
          var parts = path.split('.'), name = parts[parts.length - 1];
          nameNodes = nameNodes.filter(function(nn) { return defnode.identOrLiteralString(nn) === name; });
          if (nameNodes[0]) {
            sym.declIdentNode = nameNodes[0]._id;
            nameNodes[0]._declSymbol = sym;
          }
        }
      }

      symbols.push(sanitize(sym));
    });

    file.ast._sourcegraph_symbols = true;

    return symbols;
  },
});


function sanitize(obj) {
  Object.keys(obj).forEach(function(key) {
    if (typeof obj[key] === 'undefined') delete obj[key];
  });
  return obj;
}
