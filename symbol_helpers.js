var util = require('./util');
var assert = require('assert'), infer = require('tern/lib/infer'), walk = require('acorn/util/walk'), walkall = require('walkall');

// updateSymbolWithType sets symbol's obj and kind based on the type.
var updateSymbolWithType = exports.updateSymbolWithType = function(symbol, type) {
  if (type) {
    symbol.obj = {typeExpr: type};
    symbol.kind = symbol.obj.typeExpr.indexOf('fn(') == 0 ? 'func' : 'var';
  }
}

var getAssignmentAround = exports.getAssignmentAround = function(file, pos) {
  var assign = walk.findNodeAround(file.ast, pos, nodeType(['AssignmentExpression', 'ObjectExpression']));
  return assign && assign.node;
}

var getNamedDeclarationAround = exports.getNamedDeclarationAround = function(file, pos) {
  var decl = walk.findNodeAround(file.ast, pos, nodeType(['VariableDeclarator', 'FunctionDeclaration', 'ObjectExpression']), walkall.traversers);
  return decl && decl.node;
}

var getDeclarationAround = exports.getDeclarationAround = function(file, pos) {
  var decl = walk.findNodeAround(file.ast, pos, nodeType(['VariableDeclarator', 'FunctionDeclaration', 'FunctionExpression', 'ObjectExpression']), walkall.traversers);
  return decl && decl.node;
}

var getIdentAndDeclNodes = exports.getIdentAndDeclNodes = function(server, file, node, name, localOk, origNode) {
  if (node.type == 'ObjectExpression') {
    // CASE: 'module.exports = {a: b}'
    // set the ident to the key and decl to the value
    var prop = findPropInObjectExpressionByName(node, name);
    if (prop) {
      return {idents: [prop.key], decl: prop.value};
    } else {
      if (exports.debug) console.error('No property found with name "' + name + '" in ObjectExpression at ' + file.name + ':' + node.start + '-' + node.end);
      return {skip: true};
    }
  } else if (node.type == 'AssignmentExpression') {
    var r = {};
    if (node.left.type == 'MemberExpression') r.idents = [node.left.property];
    else r.idents = [node.left];

    if (node.right.type == 'AssignmentExpression') {
      // CASE: 'module.exports.x = foo = bar = qux;'
      // Set the decl to "qux", not "foo = bar = qux".
      var rr = getIdentAndDeclNodes(server, file, node.right);
      if (rr.decl.type == 'AssignmentExpression') r.decl = rr.decl.right;
      else r.decl = rr.decl;
    } else if (node.right.type == 'MemberExpression' || node.right.type == 'Identifier') {
      var def = util.getDefinition(server, file, node.right);
      assert(def);
      if (!def.start && !def.end) {
        // External def, so we don't need to emit it as a symbol of this module file.
        return {skip: true};
      }
      var declNode = walk.findNodeAround(file.ast, def.end, nodeType(['FunctionDeclaration', 'ObjectExpression']));
      declNode = declNode && declNode.node;
      if (!declNode) {
        declNode = getDeclarationAround(file, def.end);
      }
      assert(declNode, 'No decl node found for symbol on RHS of AssignmentExpression at ' + file.name + '@' + def.end);
      if (declNode.type == 'ObjectExpression') {
        // CASE: 'var y={z:7}; module.exports.x=y.z;'
        // Set the decl to '7'
        declNode = findPropInObjectExpressionByKeyPos(declNode, def.start, def.end).value;
      }
      r.decl = declNode;
      if (declNode && declNode.id) r.idents.push(declNode.id);
    } else {
      // CASE: 'module.exports.X = Y', where Y.type not in ['AssignmentExpression', 'MemberExpression', 'Identifier']
      r.decl = node;
    }
    return r;
  } else if (localOk) {
    if (node.type == 'FunctionDeclaration' || node.type == 'FunctionExpression') {
      if (node.params.indexOf(origNode) != -1) {
        // origNode is a param of the func
        return {ident: origNode, decl: node};
      } else return {ident: node.id, decl: node};
    } else if (node.type == 'VariableDeclarator') {
      return {ident: node.id, decl: node};
    } else throw new Error('Unhandled node type (local decl): ' + node.type + ' (in file:' + file.name + ')');
  } else throw new Error('Unhandled node type: ' + node.type + ' (in file:' + file.name + ')');
}

function findPropInObjectExpressionByName(objectExpr, name) {
  for (var i = 0; i < objectExpr.properties.length; ++i) {
    var prop = objectExpr.properties[i];
    if ((prop.key.name || prop.key.value) == name) {
      return prop;
    }
  }
}

function findPropInObjectExpressionByKeyPos(objectExpr, start, end) {
  for (var i = 0; i < objectExpr.properties.length; ++i) {
    var prop = objectExpr.properties[i];
    if (prop.key.start == start && prop.key.end == end) {
      return prop;
    }
  }
}

function nodeType(types) {
  return function(_t, node) {
    for (var i = 0; i < types.length; ++i) {
      if (node.type.indexOf(types[i]) != -1) return true;
    }
    return false;
  };
}

function nodeTypeNot(types) {
  return function(_t, node) {
    for (var i = 0; i < types.length; ++i) {
      if (node.type.indexOf(types[i]) != -1) return false;
    }
    return true;
  };
}
