function f0() {
  return 3;
}
function f1() {
  var z = {};
  return z;
}
function f2() {
  return {};
}

exports.x0/*DECLID:exports.x0*/ = /*DEF*/f0()/*DEF:{path:'exports.x0'}*/;
exports.x1/*DECLID:exports.x1*/ = /*DEF*/f1()/*DEF:{path:'exports.x1'}*/;
exports.x2/*DECLID:exports.x2*/ = /*DEF*/exports.f2()/*DEF:{path:'exports.x2'}*/;
