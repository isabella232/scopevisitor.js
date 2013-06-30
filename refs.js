var util = require('./util');
var assert = require('assert'), idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), path = require('path'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

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
              } else {
                setSymbol(ref, {path: 'exports.' + ident.name, origin: typ.origin || av.origin});
                // console.error('FOO', 'ident=', ident.name, 'typ=', typ.name, typ.origin, av);
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

var storedDefOrigins = ['ecma5', 'node', 'jquery', 'requirejs', 'browser'];
