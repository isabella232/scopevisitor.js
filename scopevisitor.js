var infer = require('tern/lib/infer');

// inspect calls c(path, prop) for each property in scope and its children that is defined in one of
// the specified targetOrigins.
exports.inspect = function(targetOrigins, scope, c) {
  if (typeof targetOrigins === 'string') targetOrigins = [targetOrigins];
  var seen = [];
  visitScope(scope, c);

  function visitScope(scope, c, path, local) {
    if (!(scope instanceof infer.Scope))
      throw new Error('scope must be instanceof infer.Scope');
    var pathPrefix = path ? path + '.' : '';
    for (var v in scope.props) {
      visitAVal(scope.props[v], c, pathPrefix + v, local);
    }
  }

  function visitAVal(av, c, path, local) {
    if (seen.indexOf(av) !== -1) return;
    seen.push(av);
    var typ = av.getType(false);
    var origin = (typ || {}).origin || av.origin;
    if (isTarget(origin)) {
      c(path, av, local);
    }
    if (typ) {
      typ.forAllProps(function(prop, pv) {
        if (isTarget(pv.origin))
          visitAVal(pv, c, path + '.' + prop, local);
      });
      if (isTarget(origin) && typ instanceof infer.Fn && typ.originNode) {
        visitScope(typ.originNode.body.scope, c, path, true);
      }
    }
    seen.pop();
  }

  function isTarget(orig) {
    return targetOrigins.indexOf(orig) !== -1;
  }
};
