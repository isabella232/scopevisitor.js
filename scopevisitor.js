var infer = require('tern/lib/infer');

// inspect calls c(path, prop) for each property in scope and its children.
exports.inspect = function(scope, c) {
  if (!(scope instanceof infer.Scope))
    throw new Error('scope must be instanceof infer.Scope');
  for (var v in scope.props) {
    visit(scope.props[v], c, v);
  }
};

function visit(av, c, path) {
  c(path, av);
  var typ = av.getType(false);
  typ.forAllProps(function(prop, pv, local) {
    visit(pv, c, path + '.' + prop);
  });
}
