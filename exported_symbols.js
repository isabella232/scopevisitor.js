var symbol_helpers = require('./symbol_helpers'), util = require('./util');
var condense = require('tern/lib/condense'), idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), path = require('path'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

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

    server._node.modules[file.name].propagate(server.cx.topScope.defProp("exports"));
    var defs = condense.condense(server.cx, file.name, file.name, {spans: true, spanNodes: true});

    var emittedModule = false;
    function visit(parentPath, name, def) {
      if (typeof def == 'string' && def.indexOf('exports.') == 0) {
        // alias to other export
        // TODO(sqs): handle this case
        return;
      }
      if (typeof def == 'string') return;
      if (!def) {
        console.error('Def undefined:', name, parentPath);
        return
      }

      name = name.replace('.prototype', '');
      var fullName = name, nameParts = name.split('.');
      name = nameParts[nameParts.length - 1];
      if (fullName.indexOf('!') !== -1) return; // skip param/return symbols
      var id = (parentPath ? (parentPath + '/') : '') + nameParts.join('/');
      id = id.replace('exports/', 'exports.');
      var symbol;
      if (def['!type']) {
        if (!parentPath && name == 'exports') {
          // node.js module.exports reassigned to a function.
          symbol = {
            id: file.name,
            kind: def['!type'].indexOf('fn(') !== -1 ? 'func' : 'module',
            name: file.name.replace(/\.js$/i, ''),
            decl: def['!node']._id,

	    // consider the module to be not exported if the filename starts with "_" (e.g.,
	    // github.com/joyent/node lib/_*.js)
            exported: path.basename(file.name).indexOf('_') == -1,
            obj: {typeExpr: def['!type']},
          };
          emittedModule = true;
        } else {
          // definition
          symbol = {
            id: file.name + '/' + id,
            name: name,
            decl: def['!node']._id,
            exported: true,
            obj: {typeExpr: def['!type']},
          };
          if (def['prototype']) {
            // type definition
            symbol.kind = 'type';
          } else if (Object.keys(def).filter(function(k) { return k[0] !== '!'; }).length) {
            symbol.kind = 'type';
          } else if (def['!type'].indexOf('fn(') == 0) {
            // func/method definition
            symbol.kind = 'func';
            if (id.indexOf('.prototype.') !== -1) {
              // method
              symbol.obj.recvType = id.replace('.prototype.' + name, '');
            }
          } else {
            symbol.kind = 'var';
          }
        }
      }

      if (symbol && def['!node']) {
        var refs = getRefs(server, file, (parentPath ? parentPath + '.' : '') + name, def['!node']);
        refs.forEach(function(ref) {
          setExportedSymbol(ref, symbol.id);
        });
      }

      if (symbol && def['!node']) {
        var nodes = getIdentAndDeclNodesForExport(server, file, {end: def['!node'].end, name: name});
        if (nodes) {
          if (nodes.idents) {
            if (nodes.idents[0]) symbol.declId = nodes.idents[0]._id;
            nodes.idents.forEach(function(ident) {
              setExportedSymbol(ident, symbol.id);
            });
          }
          if (nodes.decl) setExportedSymbol(nodes.decl, symbol.id);
        }
      }

      if (symbol) {
        res.symbols.push(symbol);
        setExportedSymbol(def['!node'], symbol.id);
        if (def['!doc']) {
          res.docs.push({
            symbol: symbol.id,
            body: def['!doc'],
          });
        }
      }

      // Traverse children.
      for (var key in def) if (def.hasOwnProperty(key) && key[0] !== '!') visit(id, key, def[key]);
    }
    function setExportedSymbol(node, symbolId) {
      // record that this decl is of an exported symbol so we don't re-emit it later as a local
      // decl
      node._isExportedDecl = true;
      // record what was defined here, for later use in computing refs
      node._declSymbol = symbolId;
    }

    visit(null, '', defs);
    if (defs['!define']) visit(null, '', defs['!define']);

    if (!emittedModule) {
      res.symbols.push({
        id: file.name,
        kind: 'module',
        name: file.name.replace(/\.js$/i, ''),
        decl: '/Program',
        exported: true,
      });
      setExportedSymbol(file.ast, '');
    }

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
  return assignExpr && assignExpr.node;
}

function isModuleExports(server, file, memberExpr) {
  assert.equal(memberExpr.type, 'MemberExpression');
  var lhsObject = util.getType(server, file, memberExpr.object);
  // lhsObject should be "module." in "module.exports" ObjectExpression
  var lhsProp = util.getType(server, file, memberExpr.property);
  // lodash.js uses freeModule and freeExports...support that but TODO(sqs) find a better way
  return (/Module/.test(lhsObject.name || lhsObject.exprName) && /exports/i.test(lhsProp.exprName));
}

// getIdentAndDeclNodes searches the AST for the most appropriate identifier and declaration to associate with
// the named symbol at the specified start/end character offsets.
var assert = require('assert');
function getIdentAndDeclNodesForExport(server, file, x) {
  var exportDeclNode = symbol_helpers.getAssignmentAround(file, x.end);

  var isIndirectModuleExportsReassignment = x.name == 'exports' && !exportDeclNode;
  if (isIndirectModuleExportsReassignment) {
    // we've encountered something like "module.exports = f; function f() {}", where we are
    // reassigning module.exports to an expression whose def is not on the RHS of the "module.exports="
    // AssignmentExpression.
    var node = symbol_helpers.getNamedDeclarationAround(file, x.end);
    exportDeclNode = findModuleExportsReassignmentTo(server, file, nodeIdent(node));
    assert(exportDeclNode, 'No AssignmentExpression node found containing module.exports reassignment in ' + file.name + ' for ' + JSON.stringify(x));
  }
  if (!exportDeclNode) return;

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

function getRefs(server, file, path, node) {
  var refs = [];
  infer.withContext(server.cx, function() {
    var parts = path.split('.');
    var parentPath = parts.slice(0, parts.length - 1).join('.');
    var lastPart = parts[parts.length - 1];
    var p = parentPath ? infer.def.parsePath(parentPath) : server.cx.topScope;
    var me = p.getProp(lastPart);
    infer.findRefs(file.ast, file.scope, lastPart, p, function(node, scope) {
      refs.push(node);
    });
    infer.findPropRefs(file.ast, file.scope, p.getType(), lastPart, function(node) {
      refs.push(node);
    });
  });
  return refs;
}
