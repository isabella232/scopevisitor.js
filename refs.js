var util = require('./util');
var assert = require('assert'), idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), path = require('path'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

exports.debug = false;

// refs takes a `file` parameter and returns an array of SourceGraph refs originating from AST nodes
// in the file.
tern.defineQueryType('sourcegraph:refs', {
  takesFile: true,
  run: function(server, query, file) {
    if (!server.options.plugins.node) throw new Error('node plugin not loaded');
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
            setSymbol(ref, {path: 'module', origin: '@node'});
          } else if (isNodeExports(av)) {
            setSymbol(ref, {path: 'exports', origin: file.name});
          } else {
            var typ = av.getType(false);
            if (typ) {
              if (typ.originNode && typ.originNode._declSymbol) {
                setSymbol(ref, typ.originNode._declSymbol);
              } else if (storedDefOrigins.indexOf(typ.origin) > -1) {
                if (typ.origin === 'node') {
                  setNodeStdlibSymbol(ref, typ);
                } else {
                  setSymbol(ref, {path: typ.name, origin: '@' + typ.origin});
                }
              } else {
                // console.log('FOO', ident.name, typ.name, typ.origin);
              }
            } else {
              // console.log('no type for expr at', ident.name, ident.start, ident.end, '\n', av, '\n', util.getType(server, file, ident));
            }
          }
        } else {
          // console.log('no expr at ', ident.name, ident.start, ident.end, util.getType(server, file, ident));
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

// getModuleRef takes a start+end containing an ident whose value is an node.js module's exports
// (e.g., "var m = require('foo')"), and returns the module's filename.
function getModuleRef(server, file, start, end) {
  try {
    var decl = infer.findExpressionAt(file.ast, start, end, file.scope);
  } catch(e) {}

  if (!decl) {
    if (exports.debug) console.error('Failed to get decl of module ref at ' + file.name + ':' + start + '-' + end);
    return;
  }
  // iterate over module props. this will fail if the module re-exports a def from another origin
  // and we happen to iterate over it first here.
  var moduleType = infer.expressionType(decl).types[0];
  if (!moduleType) {
    if (exports.debug) console.error('Module has no type at file ' + file.name + ':' + start + '-' + end);
    return;
  }
  var moduleProps = moduleType.props;
  // no hasOwnProperty check needed because moduleProps has a stripped object prototype (from tern)??
  for (var key in moduleProps) {
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
