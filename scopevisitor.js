var infer = require('tern/lib/infer');

// inspect calls c(path, prop) for each property in scope and its children that is defined in one of
// the specified targetOrigins.
exports.inspect = function(targetOrigins, scope, c) {
  if (typeof targetOrigins === 'string') targetOrigins = [targetOrigins];
  if (!(scope instanceof infer.Scope))
    throw new Error('scope must be instanceof infer.Scope');

  var seen = [];
  for (var v in scope.props) {
    if (isTarget(scope.props[v].origin)) visit(scope.props[v], c, v);
  }

  function visit(av, c, path) {
    if (seen.indexOf(av) !== -1) return;
    seen.push(av);
    c(path, av);
    var typ = av.getType(false);
    if (typ) {
      typ.forAllProps(function(prop, pv, local) {
        if (isTarget(pv.origin))
          visit(pv, c, path + '.' + prop);
      });
    }
    seen.pop();
  }

  function isTarget(orig) {
    return targetOrigins.indexOf(orig) !== -1;
  }
};
