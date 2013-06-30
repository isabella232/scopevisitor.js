var util = require('./util');
var assert = require('assert'), defnode = require('defnode'), idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), path = require('path'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

exports.debug = false;

// refs takes a `file` parameter and returns an array of SourceGraph refs originating from AST nodes
// in the file.
tern.defineQueryType('sourcegraph:refs', {
  takesFile: true,
  run: function(server, query, file) {
    if (!file.ast._sourcegraph_symbols) throw new Error('AST not yet annotated with local symbol decls: ' + file.name);

    var refs = [];
    idents.inspect(file.ast, function(ident) {
      var ref = {astNode: ident._id, kind: 'ident'};
      if (ident._declSymbol) {
        // is ident of declaration/definition
        setSymbol(ref, ident._declSymbol);
      } else {
        var expr = tern.findQueryExpr(file, {start: ident.start, end: ident.end})
        if (expr) {
          var av = infer.expressionType(expr);
          if (av.originNode && av.originNode._declSymbol) {
            setSymbol(ref, av.originNode._declSymbol);
          } else if (isNodeModule(av)) {
            setSymbol(ref, {path: 'exports.Module', origin: '@node'});
            ref.nodeStdlibModule = 'module'
          } else {
            var typ = av.getType(false);
            if (typ) {
              if (isNodeExports(av)) {
                var typOrigin = getOriginOfNodeExportsSymbol(typ);
                if (typOrigin) setSymbol(ref, {path: 'exports', origin: typOrigin});
              } else if (typ.originNode && typ.originNode._declSymbol) {
                setSymbol(ref, typ.originNode._declSymbol);
              } else if (storedDefOrigins.indexOf(typ.origin) > -1) {
                if (typ.origin === 'node') {
                  setNodeStdlibSymbol(ref, typ);
                } else {
                  setSymbol(ref, {path: typ.name, origin: '@' + typ.origin});
                }
              } else if (/^exports\./.test(typ.name)) {
                setSymbol(ref, {path: typ.name, origin: typ.origin});
              } else {
                try {
                  var info = getNonFuncValueRecursively(server, file, ident);
                  if (info) setSymbol(ref, info);
                } catch (e) {}
//                console.error('FOO', 'ident=', ident.name, 'typ=', typ.name, typ.origin, typ, util.getDefinition(server, file, ident));
                // console.error(typ);
              }
            } else {
              // console.error('no type for expr at', ident.name, ident.start, ident.end);
              // console.error('\n', av, '\n', util.getType(server, file, ident));
            }
          }
        } else {
          // console.error('no expr at ', ident.name, ident.start, ident.end, util.getType(server, file, ident));
        }
      }

      if (ref.symbol) refs.push(ref);
    });
    return refs;
  }
});

function setSymbol(ref, sym) {
  // FIXME(sqs): hacky workaround for test 'omits <top> symbol (e.g., global this)'
  if (sym.path === '<top>') return;
  ref.symbol = sym.path;
  ref.local = !!sym.local;
  ref.symbolOrigin = sym.origin;
}

// typ.name is like 'fs.readFileSync'; we want to munge this to origin=@node,
// nodeStdlibModule=fs, path=exports.readFileSync
function setNodeStdlibSymbol(ref, typ) {
  var nameParts = typ.name.split('.');
  if (typ.name === 'require') nameParts.unshift('module');
  var path = ['exports'].concat(nameParts.slice(1)).join('.');
  setSymbol(ref, {path: path, origin: '@node'});
  ref.nodeStdlibModule = nameParts[0];
}

function isNodeModule(av) {
  if (!av.types) return false;
  for (var i = 0; i < av.types.length; ++i) {
    var typ = av.types[i];
    if (typ.name == 'Module') return true;
  }
  return false;
}

function isNodeExports(av) {
  if (!av.types) return false;
  for (var i = 0; i < av.types.length; ++i) {
    var typ = av.types[i];
    if (typ.name == 'exports') return true;
  }
  return false;
}

// getOriginOfNodeExportsSymbol takes an infer.Type that is a node exports symbol and finds the
// origin it was defined in. For some reason, tern does not set the "origin" property on exports,
// and so we must use this heuristic to determine the origin. This will fail for modules that define
// no exports.
function getOriginOfNodeExportsSymbol(typ) {
  if (typ.origin) return typ.origin;

  var moduleProps = typ.props;
  // no hasOwnProperty check needed because moduleProps has a stripped object prototype (from tern)??
  for (var key in moduleProps) {
    // TODO(sqs): pick the most common origin instead of just the first non-null origin? also, this
    // is non-deterministic in the iteration order of object
    if (moduleProps[key].origin) return moduleProps[key].origin;
  }
}

// getDeclIdNode searches the AST for the declaration node at the given start and end character
// offsets (i.e., its _declSymbol was set by a symbol query of this AST).
function getDeclIdNode(file, start, end) {
  var test = function(_t, node) {
    return typeof node._declSymbol !== 'undefined';
  };
  var expr = walk.findNodeAround(file.ast, end, test, walkall.traversers);
  if (expr && expr.node) {
    return expr.node;
  }
  // TODO(sqs): eliminate cases where this error occurs:
  // console.error('No DeclIdNode at file ' + file.name + ':' + start + '-' + end);
}

// a ref to a non-func value defined in an external module
function getNonFuncValueRecursively(server, file, node, seen) {
  if (!seen) seen = [];
  if (seen.indexOf(node) > -1) return;
  seen.push(node);
  // console.error('getNonFuncValueDefinedExternally for node', node, 'in file', file.name);
  var def = util.getDefinition(server, file, node);
  if (def) {
    var defFile = server.files.filter(function(f) { return f.name === def.file; });
    if (!defFile) return;
    defFile = defFile[0];
    if (!defFile.ast._sourcegraph_symbols) {
      // assumes that this runs synchronously
      server.request({
        query: {type: 'sourcegraph:symbols', file: path.resolve(defFile.name)}}, function(err, res) {
          if (err) throw err;
        });
    }
    var defExpr = tern.findQueryExpr(defFile, {start: def.start, end: def.end});
    if (!defExpr) return;

    // if we have e.g. 'var D = foomodule.B', then we want to find the expressionType of
    // foomodule.B, not of 'var D' (which is just in this same file), so let's just recurse on the RHS
    if (defExpr.node == node) {
      defExpr.node = defnode.findDefinitionNode(defFile.ast, defExpr.node.start, defExpr.node.end);
      if (defExpr.node.id) defExpr.node = defExpr.node.id;
      return getNonFuncValueRecursively(server, defFile, defExpr.node, seen);
    }

    var defType = infer.expressionType(defExpr)
    if (defType && defType.originNode && defType.originNode._declSymbol) {
      return {path: defType.originNode._declSymbol.path, origin: defFile.name};
    }
  }
}

var storedDefOrigins = ['ecma5', 'node', 'jquery', 'requirejs', 'browser'];
