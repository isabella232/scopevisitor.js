exports.a/*DECLID:exports.a*//*REF:exports.a*/ = /*DEF*/function(){}/*DEF:{path:'exports.a'}*/;

module.exports.b/*DECLID:exports.b*/ = /*DEF*/function(){}/*DEF:{path:'exports.b'}*/;

var e = exports;
e.c/*DECLID:exports.c*/ = /*DEF*/function(){}/*DEF:{path:'exports.c'}*/;

var m = module.exports;
m.d/*DECLID:exports.d*/ = /*DEF*/function(){}/*DEF:{path:'exports.d'}*/;

// TODO(sqs): these declids shouldn't be too hard to get working

module.exports['e']/*DECLID:exports.e*/ = /*DEF*/function(){}/*DEF:{path:'exports.e'}*/;

var f = /*DEF*/function(){}/*DEF:{path:'exports.f'}*/;
module.exports.f/*DECLID:exports.f*/ = f;

var g = {h: /*DEF*/function(){}/*DEF:{path:'exports.g'}*/};
module.exports.g/*DECLID:exports.g*/ = g.h;

// TODO(sqs): comment out exports.i until we get aliasing; it shows up in condense defs like:
// {..., "i": "exports.j", ...}
module.exports.i/*#DECLID:exports.i*/ = module.exports.j/*DECLID:exports.j*/ = /*#DEF*/function(){}/*DEF:{path:'exports.i', _ignoreSymbol:'exports.j'}*/;


f;/*REF:exports.f*/
exports/*REF:exports*/.a;/*REF:exports.a*/
g/*REF_DISABLED(not traversing locals yet):g,local*/.h;/*REF:exports.g*/
module.exports.i;/*REF:exports.i*/
m;/*REF:exports*/
module.exports;/*REF:exports*/
e;/*REF:exports*/
module.exports.e;/*REF:exports.e*/

// TODO(sqs): handle Literals
module.exports['e'];/*REF_DISABLED:exports.e*/

module;/*REF:module,,@node*/
