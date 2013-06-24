var util = require('./util');
var assert = require('assert'), idast = require('idast'), idents = require('javascript-idents'), infer = require('tern/lib/infer'), tern = require('tern'), walk = require('acorn/util/walk'), walkall = require('walkall');

exports.debug = false;

// refs takes a `file` parameter and returns an array of SourceGraph refs originating from AST nodes
// in the file.
tern.defineQueryType('sourcegraph:refs', {
  takesFile: true,
  run: function(server, query, file) {
    if (!server.options.plugins.node) throw new Error('node plugin not loaded');
    if (!file.ast._sourcegraph_annotatedLocalSymbolDeclIds) throw new Error('AST not yet annotated with local symbol decls: ' + file.name);
    if (!file.ast._sourcegraph_annotatedExportedSymbolDeclIds) throw new Error('AST not yet annotated with exported symbol decls: ' + file.name);

    var res = {refs: []};
    idents.inspect(file.ast, function(ident) {
      var def = util.getDefinition(server, file, ident);
      var type = util.getType(server, file, ident);

      if (Object.keys(def) == 0) {
        // console.error('No def found for ident "' + ident.name + '" at file ' + file.name + ':' + ident.start + '-' + ident.end);
        return;
      }

      var ref = {astNode: ident._id, kind: 'ident'};
      if (type.name == 'exports' || type.name == 'module.exports') {
        // external module ref
        // ex: "m" in "var m = require('foo')"
        // tern doesn't set the type.origin of m to "foo" in all cases, so we have to manually
        // resolve the ident to the module
        var mod = type.origin || getModuleRef(server, file, def.start, def.end);
        if (!mod) {
          if (exports.debug) console.error('Failed to resolve module ref at file', file.name + ':' + ident.start + '-' + ident.end, 'at identifier type', type, 'definition', def);
          return;
        }
        ref.symbol = mod;
        ref.symbolOrigin = 'external';
      } else if ((!type.origin || type.origin == file.name) && def.file == file.name) {
        var declId = getDeclIdNode(file, def.start, def.end);
        if (!declId) return;
        ref.symbol = file.name + '/' + declId._declSymbol;
        ref.symbolOrigin = 'local';
      } else {
        if (!def.origin) throw new Error('No origin');
        // external ref
        if (storedDefOrigins.indexOf(type.origin) != -1) {
          // ref to stored def (not to external file)
          if (type.name == 'require') type.name = 'module.require';
          type.name = type.name.replace('.', '.js/exports.');
          ref.symbol = type.origin + '/' + type.name;
          ref.symbolOrigin = 'predef';
        } else {
          ref.symbol = def.origin + '/exports.' + ident.name;
          ref.symbolOrigin = 'external';
        }
      }
      res.refs.push(ref);
    });
    return res;
  }
});

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
  var expr = walk.findNodeAt(file.ast, null, end, test, walkall.traversers);
  if (expr && expr.node) {
    return expr.node;
  }
  // TODO(sqs): eliminate cases where this error occurs:
  // console.error('No DeclIdNode at file ' + file.name + ':' + start + '-' + end);
}

var storedDefOrigins = ['ecma5', 'node', 'jquery', 'requirejs', 'browser'];
