var infer = require('tern/lib/infer');

// inspect calls c(path, prop, local, alias) for each property in scope and its children that is
// defined in one of the specified targetOrigins.
exports.inspect = function(targetOrigins, scope, c) {
  if (typeof targetOrigins === 'string') targetOrigins = [targetOrigins];
  var seen = [];
  visitScope(scope, c);

  function visitScope(scope, c, path, local) {
    var pathPrefix = path ? path + '.' : '';
    for (var v in scope.props) {
      visitAVal(scope.props[v], c, pathPrefix + v, local);
    }
  }

  function visitAVal(av, c, path, local) {
    if (seen.indexOf(av) !== -1) return;
    seen.push(av);
    var typ = av.getType(false) || av.getFunctionType();
    var origin = (typ || {}).origin || av.origin;
    if (typ) {
      if (typ._path) {
        // This type has already been traversed.
        if (isTarget(typ.origin)) {
          c(path, av, local, typ._path);
          return;
        }
      } else if (isTarget(typ.origin)) {
        if (!isDistinctInstance(typ)) {
          typ._path = path;
        }
      } else if (isTarget(av.origin)) {
        if (typ.origin) {
          c(path, av, local, typ.origin + '/' + typ.name);
          return;
        }
      }
    }

    // Hack to get the originNode of `exports` when using the node plugin.
    if (path == 'exports' && !av.originNode) {
      // Make sure we're using the node plugin.
      var mType = scope.getProp('module').getType();
      if (mType && mType.origin == 'node') {
        var typ2 = (av.getType(false) || av.getFunctionType());
        if (!typ2) {
          typ2 = av.types[1].getType();
        }
        if (typ2) {
          // TODO(sqs): we can probably figure out the origin from what we have here
          av.originNode = typ2.originNode;
          if (av.originNode && av.originNode.type == 'FunctionDeclaration') av.originNode = av.originNode.id;
        }
      }
    }

    if (isTarget(origin)) {
      c(path, av, local);
    }
    if (typ) {
      typ.forAllProps(function(prop, pv) {
        if (isTarget(pv.origin))
          visitAVal(pv, c, path + '.' + prop, local);
      });
      if (isTarget(origin) && typ.originNode && typ.originNode.body) {
        visitScope(typ.originNode.body.scope, c, path, true);
      }
    }
    seen.pop();
  }

  function isTarget(orig) {
    return targetOrigins.indexOf(orig) !== -1;
  }
};

function isDistinctInstance(o) {
  return o.proto && o.proto.hasCtor && !o.hasCtor && o.proto.hasCtor._path;
}
