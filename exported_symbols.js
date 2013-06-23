var symbol_helpers = require('./symbol_helpers'), util = require('./util');
var idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

exports.debug = false;

// sourcegraph:exported_symbols takes a `file` parameter and returns an array of SourceGraph symbols
// defined in the file.
tern.defineQueryType('sourcegraph:exported_symbols', {
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
      var emittedModuleExports = false;
      for (var i = 0; i < xres.exports.length; ++i) {
        var x = xres.exports[i];
        function work(x) {
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

          if (!x.name) emittedModuleExports = true;

          // record that this decl is of an exported symbol so we don't re-emit it as a local decl below
          nodes.decl._isExportedDecl = true;

          // record what the idents declares, for later use in computing refs
          nodes.idents.forEach(function(ident) {
            ident._declSymbol = symbol.id;
          });

          symbol_helpers.updateSymbolWithType(symbol, util.getType(server, file, nodes.idents[0]).type);

          var doc = util.getDoc(server, file, nodes.decl) || util.getDoc(server, file, nodes.idents[0]);
          if (doc && doc.doc) {
            res.docs.push({
              symbol: symbol.id,
              body: doc.doc,
            });
          }

          res.symbols.push(symbol);
        }
        if (exports.debug) work(x);
        else try { work(x) } catch (e) {
          console.error('Error processing export ' + x.name + ' in file ' + file.name + ':', e);
        }
      }

      if (!emittedModuleExports) {
        res.symbols.push({
          id: file.name + '/module.exports',
          kind: 'var',
          name: require('path').basename(file.name),
          declId: '',
          decl: '/Program',
          exported: false,
        });
      }
    });

    file.ast._sourcegraph_annotatedExportedSymbolDeclIds = true;
    return res;
  }
});

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
  return (lhsObject.name == 'Module' && lhsProp.exprName == 'exports');
}

// getIdentAndDeclNodes searches the AST for the most appropriate identifier and declaration to associate with
// the named symbol at the specified start/end character offsets.
var assert = require('assert');
function getIdentAndDeclNodesForExport(server, file, x) {
  var exportDeclNode = symbol_helpers.getAssignmentAround(file, x.end);

  var isIndirectModuleExportsReassignment = !x.name && !exportDeclNode;
  if (isIndirectModuleExportsReassignment) {
    // we've encountered something like "module.exports = f; function f() {}", where we are
    // reassigning module.exports to an expression whose def is not on the RHS of the "module.exports="
    // AssignmentExpression.
    var node = symbol_helpers.getNamedDeclarationAround(file, x.end);
    exportDeclNode = findModuleExportsReassignmentTo(server, file, nodeIdent(node));
    assert(exportDeclNode, 'No AssignmentExpression node found containing module.exports reassignment in ' + file.name + ' for ' + JSON.stringify(x));
  }
  assert(exportDeclNode, 'No export decl node found');

  var r = symbol_helpers.getIdentAndDeclNodes(server, file, exportDeclNode, x.name);
  if (r && r.skip) return;
  assert(r.idents.length > 0, 'No ident found in ' + file.name + ' for ' + JSON.stringify(x));
  assert(r.decl, 'No decl found in ' + file.name + ' for ' + JSON.stringify(x));
  return r;
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
