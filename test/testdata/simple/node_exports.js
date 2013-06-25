exports.a/*DECLID:'node_exports.js/exports.a'*/ = /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.a'}*/;

module.exports.b/*DECLID:'node_exports.js/exports.b'*/ = /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.b'}*/;

var e = exports;
e.c/*DECLID:'node_exports.js/exports.c'*/ = /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.c'}*/;

var m = module.exports;
m.d/*DECLID:'node_exports.js/exports.d'*/ = /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.d'}*/;

// TODO(sqs): these declids shouldn't be too hard to get working

module.exports['e']/*#DECLID:'node_exports.js/exports.e'*/ = /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.e'}*/;

var f = /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.f'}*/;
module.exports.f/*#DECLID:'node_exports.js/exports.f'*/ = f;

var g = {h: /*DECL*/function(){}/*DECL:{id:'node_exports.js/exports.g'}*/};
module.exports.g/*#DECLID:'node_exports.js/exports.g'*/ = g.h;

// TODO(sqs): comment out exports.i until we get aliasing; it shows up in condense defs like:
// {..., i": "exports.j", ...}
module.exports.i/*#DECLID:'node_exports.js/exports.i'*/ = module.exports.j/*DECLID:'node_exports.js/exports.j'*/ = /*#DECL*/function(){}/*DECL:{id:'node_exports.js/exports.i', _ignoreSymbol:'node_exports.js/exports.j'}*/;
