var idast = require('idast'), tern = require('tern'), walk = require('acorn/util/walk');

// ast takes a `file` parameter and returns an array of acorn AST node objects augmented with an
// `_id` property from node-idast.
tern.defineQueryType('ast', {
  takesFile: true,
  run: function(server, query, file) {
    var nodes = [];
    idast.assignIds(file.ast);
    // TODO(sqs): emit args for CallExpression nodes
    walk.simple(file.ast, {
      Node: function(node) {
        nodes.push(node);
      },
    }, idast.base);
    return nodes;
  }
});
