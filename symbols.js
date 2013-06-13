var util = require('./util');
var idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern'), walk = require('acorn/util/walk');

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
        var nodes = getNodes(file, x.name, x.start, x.end, !x.name);
        var symbol = {
          id: file.name + '/' + (x.name || 'module.exports'),
          kind: 'var',
          name: x.name,
          declId: nodes.ident._id,
          decl: nodes.decl._id,
          exported: true,
        };

        // record that this decl is of an exported symbol so we don't re-emit it as a local decl below
        nodes.decl._isExportedDecl = true;

        // record what this ident declares, for later use in computing refs
        nodes.ident._declSymbol = symbol.id;

        updateSymbolWithType(symbol, util.getType(server, file, nodes.ident).type);

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
      var type = util.getType(server, file, ident);
      if (type.exprName == 'exports') return;
      var def = util.getDefinition(server, file, ident);
      var isDecl = (def.start == ident.start && def.end == ident.end && def.file == file.name && (!type.origin || type.origin == file.name));
      if (!isDecl) return;
      var declNode = getNodes(file, ident.name, ident.start, ident.end).decl;
      if (isDecl && declNode && !declNode._isExportedDecl) {
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
function getNodes(file, name, start, end, isModuleExports) {
  var ident, decl;
  var node;

  if (isModuleExports) {
    // find the "module.exports =" AssignmentExpression that likely contains this, and set start/end
    // to the LHS of the AssignmentExpression (which is "module.exports"). this is because
    // node_exports has an inconsistency where the start/end of the module.exports reassignment is
    // just the definition, whereas the start/end of exported properties are of the MemberExpression
    // "module.exports.foo". this normalizes the former case.
    node = walk.findNodeAround(file.ast, end, nodeType(["AssignmentExpression"]));
    if (node) {
      node = node.node;
      start = node.left.start;
      end = node.left.end;
    }
  }

  node = walk.findNodeAround(file.ast, end, function(_t, node) { return node.start <= start; }).node;

  if (!node) {
    console.error('Failed to find node named "' + name + '" in file ' + file.name + ':' + start + '-' + end);
    return;
  }

  // be smart about what the logical identifier and declaration is
  switch (node.type) {

  // TODO(sqs): in chained AssignmentExpressions, set the decl to the rightmost value (i.e., `z` in `x = y = z`)

  case 'FunctionDeclaration':
    ident = node.id;
    decl = node;
    break;

  case 'ObjectExpression':
    // set the ident to the key and decl to the value
    for (var i = 0; i < node.properties.length; ++i) {
      var prop = node.properties[i];
      if ((prop.key.name || prop.key.value) == name) {
        ident = prop.key;
        decl = prop.value;
        break;
      }
    }
    break;

  }

  // fall back to the identifier
  if (!ident) {
    ident = walk.findNodeAt(file.ast, start, end, null, idast.base).node;
  }

  // fall back to the enclosing statement
  if (!decl) {
    decl = walk.findNodeAround(file.ast, end, nodeType(["Statement", "Declaration"]));
    if (!decl) {
      console.error('No enclosing Statement found at', file.name + ':' + start + '-' + end);
    }
    decl = decl && decl.node;
  }

  return {ident: ident, decl: decl};
}

function nodeType(types) {
  return function(_t, node) {
    for (var i = 0; i < types.length; ++i) {
      if (node.type.indexOf(types[i]) != -1) return true;
    }
    return false;
  };
}

function nodeTypeNot(types) {
  return function(_t, node) {
    for (var i = 0; i < types.length; ++i) {
      if (node.type.indexOf(types[i]) != -1) return false;
    }
    return true;
  };
}
