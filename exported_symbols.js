var condense = require('tern/lib/condense'), defnode = require('defnode'), idast = require('idast'), infer = require('tern/lib/infer'), path_ = require('path'), tern = require('tern');

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
      var path = (parentPath ? parentPath + '.' : '') + name;
      if (path.indexOf('<i>') !== -1) return;

      if (typeof def == 'string' && def.indexOf('exports.') === 0) {
        // alias to other export
        // TODO(sqs): handle this case
        return;
      }
      if (typeof def == 'string') {
        def = {
          '!node': getDefinitionNode(server, file, path),
          '!type': def,
        };
      }
      if (!def) {
        console.error('Def undefined:', name, parentPath);
        return;
      }

      var fullName = name, nameParts = name.split('.');
      name = nameParts[nameParts.length - 1];
      if (fullName.indexOf('!') !== -1) return; // skip param/return symbols
      var id = (parentPath ? (parentPath + '/') : '') + nameParts.join('/');
      id = id.replace('exports/', 'exports.');
      var symbol;

      if (!def['!type']) def['!type'] = getType(server, file, path);
      if (!def['!node']) def['!node'] = getDefinitionNode(server, file, path);

      if (def['!type']) {
        if (!parentPath && name == 'exports') {
          // node.js module.exports reassigned to a function.
          if (!def['!node']) def['!node'] = file.ast;
          symbol = {
            id: file.name,
            kind: def['!type'].indexOf('fn(') !== -1 ? 'func' : 'module',
            name: file.name.replace(/\.js$/i, ''),
            decl: def['!node']._id,

            // consider the module to be not exported if the filename starts with "_" (e.g.,
            // github.com/joyent/node lib/_*.js)
            exported: path_.basename(file.name).indexOf('_') == -1,
            obj: {typeExpr: def['!type']},
          };
          emittedModule = true;
        } else {
          // definition
          symbol = {
            id: file.name + '/' + id,
            name: name,
            decl: def['!node'] ? def['!node']._id : '',
            exported: true,
            obj: {typeExpr: def['!type']},
          };
          if (def['prototype']) {
            // type definition
            symbol.kind = 'type';
          } else if (Object.keys(def).filter(function(k) { return k[0] !== '!'; }).length) {
            symbol.kind = 'type';
          } else if (def['!type'].indexOf('fn(') === 0) {
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
        var refs = getRefs(server, file, path, def['!node']);
        refs.forEach(function(ref) {
          setExportedSymbol(ref, symbol.id);
        });
      }

      if (symbol && def['!node']) {
        setExportedSymbol(def['!node'], symbol.id);
        if (def['!node']._id != '/Program') {
          var nameNodes = defnode.findNameNodes(file.ast, def['!node'].start, def['!node'].end);
          if (nameNodes) {
            nameNodes.forEach(function(nameNode) {
              setExportedSymbol(nameNode, symbol.id);
            });
            if (nameNodes[0]) symbol.declId = nameNodes[0]._id;
          }
        }
      }

      if (symbol) {
        res.symbols.push(symbol);
        if (def['!doc']) {
          res.docs.push({
            symbol: symbol.id,
            body: def['!doc'],
          });
        }
      }

      // Traverse children.
      if (typeof def === 'object') {
        for (var key in def) if (def.hasOwnProperty(key) && key[0] !== '!') visit(id, key, def[key]);
      }
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

function getType(server, file, path) {
  var me = getPath(server, file, path);
  if (me && me.getType()) {
    return me.getType().toString(2);
  }
}

function getDefinitionNode(server, file, path) {
  var me = getPath(server, file, path);
  if (me && me.originNode) {
    var nameNode = me.originNode;
    return defnode.findDefinitionNode(file.ast, nameNode.start, nameNode.end);
  }
}

function getPath(server, file, path) {
  var me;
  infer.withContext(server.cx, function() {
    var parts = path.split('.');
    var parentPath = parts.slice(0, parts.length - 1).join('.');
    var lastPart = parts[parts.length - 1];
    var p = parentPath ? infer.def.parsePath(parentPath) : server.cx.topScope;
    me = p.getProp(lastPart);
  });
  return me;
}
