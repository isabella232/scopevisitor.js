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
      for (var i = 0; i < xres.exports.length; ++i) {
        try {
          var x = xres.exports[i];
          var nodes = getIdentAndDeclNodesForExport(server, file, x);
          if (!nodes) return;
          var symbol = {
            id: file.name + '/' + (x.name || 'module.exports'),
            kind: 'var',
            name: x.name,
            declId: nodes.idents[0]._id,
            decl: nodes.decl._id,
            exported: true,
          };

          // record that this decl is of an exported symbol so we don't re-emit it as a local decl below
          nodes.decl._isExportedDecl = true;

          // record what the idents declares, for later use in computing refs
          nodes.idents.forEach(function(ident) {
            ident._declSymbol = symbol.id;
          });

          updateSymbolWithType(symbol, util.getType(server, file, nodes.idents[0]).type);

          var doc = util.getDoc(server, file, nodes.decl)
          if (doc && doc.doc) {
            res.docs.push({
              symbol: symbol.id,
              body: doc.doc,
            });
          }

          res.symbols.push(symbol);
        } catch (e) {
          console.error('Error processing export ' + JSON.stringify(x) + ' in file ' + file.name);
        }
      }
    });

    idents.inspect(file.ast, function(ident) {
      if (ident._declSymbol) return;
      var type = util.getType(server, file, ident);
      if (type.exprName == 'exports') return;
      var def = util.getDefinition(server, file, ident);
      var isDecl = (def.start == ident.start && def.end == ident.end && def.file == file.name && (!type.origin || type.origin == file.name));
      if (!isDecl) return;
      var declNode = getDeclNodeForLocal(server, file, ident, type, def);
      if (!declNode) return;
      var symbol = {
        id: file.name + '/' + ident.name + ':local:' + ident.start,
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

function findModuleExportsReassignmentTo(server, file, node) {
  var assignExpr;
  server.request({query: {type: 'refs', file: file.name, start: node.start, end: node.end}}, function(err, res) {
    if (err) throw err;
    for (var i = 0; i < res.refs.length; ++i) {
      var ref = res.refs[i];
      if (ref.file != file.name) continue;

      // Find an AssignmentExpression wrapping this ref that has an LHS of "module.exports".
      assignExpr = walk.findNodeAround(file.ast, ref.end, function(_t, node) {
        if (node.type != 'AssignmentExpression') return false;
        if (node.left.type != 'MemberExpression') return false;
        return isModuleExports(server, file, node.left);
      });
      if (assignExpr) return;
    }
  });
  return assignExpr.node;
}

function isModuleExports(server, file, memberExpr) {
  assert.equal(memberExpr.type, 'MemberExpression');
  var lhsObject = util.getType(server, file, memberExpr.object);
  // lhsObject should be "module." in "module.exports" ObjectExpression
  var lhsProp = util.getType(server, file, memberExpr.property);
  return (lhsObject.type == 'Module' && lhsProp.exprName == 'exports');
}

function nodeIdent(node) {
  switch (node.type) {
  case 'FunctionDeclaration':
    return node.id;
  case 'VariableDeclarator':
    return node.id;
  default:
    throw new Error('Unhandled node type: ' + node.type);
  }
}

// getIdentAndDeclNodes searches the AST for the most appropriate identifier and declaration to associate with
// the named symbol at the specified start/end character offsets.
var assert = require('assert');
function getIdentAndDeclNodesForExport(server, file, x) {
  var exportDeclNode = getAssignmentAround(file, x.end);

  var isIndirectModuleExportsReassignment = !x.name && !exportDeclNode;
  if (isIndirectModuleExportsReassignment) {
    // we've encountered something like "module.exports = f; function f() {}", where we are
    // reassigning module.exports to an expression whose def is not on the RHS of the "module.exports="
    // AssignmentExpression.
    var node = getDeclarationAround(file, x.end);
    exportDeclNode = findModuleExportsReassignmentTo(server, file, nodeIdent(node));
    assert(exportDeclNode, 'No AssignmentExpression node found containing module.exports reassignment in ' + file.name + ' for ' + JSON.stringify(x));
  }
  assert(exportDeclNode, 'No export decl node found');

  var r = getIdentAndDeclNodes(server, file, exportDeclNode, x.name);
  if (r && r.skip) return;
  assert(r.idents.length > 0, 'No ident found in ' + file.name + ' for ' + JSON.stringify(x));
  assert(r.decl, 'No decl found in ' + file.name + ' for ' + JSON.stringify(x));
  return r;
}

function getDeclNodeForLocal(server, file, node, type, def) {
  var declNode = getDeclarationAround(file, node.end);
  if (!declNode) return;
  var nodes = getIdentAndDeclNodes(server, file, declNode, node.name, true);
  if (nodes) return nodes.decl;
  else console.error('Failed to get decl node for local symbol at ' + file.name + ':' + node.start + '-' + node.end);
}

function getAssignmentAround(file, pos) {
  var assign = walk.findNodeAround(file.ast, pos, nodeType(['AssignmentExpression', 'ObjectExpression']));
  return assign && assign.node;
}

function getDeclarationAround(file, pos) {
  var decl = walk.findNodeAround(file.ast, pos, nodeType(['VariableDeclarator', 'FunctionDeclaration', 'ObjectExpression']), require('idast').base);
  return decl && decl.node;
}

function getIdentAndDeclNodes(server, file, node, name, localOk) {
  if (node.type == 'ObjectExpression') {
    // CASE: 'module.exports = {a: b}'
    // set the ident to the key and decl to the value
    var prop = findPropInObjectExpressionByName(node, name);
    if (prop) {
      return {idents: [prop.key], decl: prop.value};
    } else {
      console.error('No property found with name "' + name + '" in ObjectExpression at ' + file.name + ':' + node.start + '-' + node.end);
      return {skip: true};
    }
  } else if (node.type == 'AssignmentExpression') {
    var r = {};
    if (node.left.type == 'MemberExpression') r.idents = [node.left.property];
    else r.idents = [node.left];

    if (node.right.type == 'AssignmentExpression') {
      // CASE: 'module.exports.x = foo = bar = qux;'
      // Set the decl to "qux", not "foo = bar = qux".
      var rr = getIdentAndDeclNodes(server, file, node.right);
      if (rr.decl.type == 'AssignmentExpression') r.decl = rr.decl.right;
      else r.decl = rr.decl;
    } else if (node.right.type == 'MemberExpression' || node.right.type == 'Identifier') {
      var def = util.getDefinition(server, file, node.right);
      assert(def);
      if (!def.start && !def.end) {
        // External def, so we don't need to emit it as a symbol of this module file.
        return {skip: true};
      }
      var declNode = walk.findNodeAround(file.ast, def.end, nodeType(['FunctionDeclaration', 'ObjectExpression']));
      declNode = declNode && declNode.node;
      if (!declNode) {
        declNode = getDeclarationAround(file, def.end);
      }
      assert(declNode, 'No decl node found for symbol on RHS of AssignmentExpression at ' + file.name + '@' + def.end);
      if (declNode.type == 'ObjectExpression') {
        // CASE: 'var y={z:7}; module.exports.x=y.z;'
        // Set the decl to '7'
        declNode = findPropInObjectExpressionByKeyPos(declNode, def.start, def.end).value;
      }
      r.decl = declNode;
      if (declNode && declNode.id) r.idents.push(declNode.id);
    } else {
      // CASE: 'module.exports.X = Y', where Y.type not in ['AssignmentExpression', 'MemberExpression', 'Identifier']
      r.decl = node;
    }
    return r;
  } else if (localOk) {
    if (node.type == 'FunctionDeclaration') {
      return {ident: node.id, decl: node};
    } else if (node.type == 'VariableDeclarator') {
      return {ident: node.id, decl: node};
    } else throw new Error('Unhandled node type (local decl): ' + node.type + ' (in file:' + file.name + ')');
  } else throw new Error('Unhandled node type: ' + node.type + ' (in file:' + file.name + ')');
}

function findPropInObjectExpressionByName(objectExpr, name) {
  for (var i = 0; i < objectExpr.properties.length; ++i) {
    var prop = objectExpr.properties[i];
    if ((prop.key.name || prop.key.value) == name) {
      return prop;
    }
  }
}

function findPropInObjectExpressionByKeyPos(objectExpr, start, end) {
  for (var i = 0; i < objectExpr.properties.length; ++i) {
    var prop = objectExpr.properties[i];
    if (prop.key.start == start && prop.key.end == end) {
      return prop;
    }
  }
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
