function X(p/*DEF:X.p:local*/, q/*DEF:X.q:local*/) {
  var v/*DEF:X.v:local*/;
  function X2(p2/*DEF:X.X2.p2:local*/) {
    var v2/*DEF:X.X2.v2:local*/;
  }
  var X3 = function(p3/*DEF:X.X3.p3:local*/) {
    var v3/*DEF:X.X3.v3:local*/;
  }
  X.p/*DEF:X.p:nonlocal*/ = 1;
  X2.p/*DEF:X.X2.p:local*/ = 1;
}

var Y = function(p/*DEF:Y.p:local*/, q/*DEF:Y.q:local*/) {
  var v/*DEF:Y.v:local*/;
  function Y2(p2/*DEF:Y.Y2.p2:local*/) {
    var v2/*DEF:Y.Y2.v2:local*/;
  }
  var Y3 = function(p3/*DEF:Y.Y3.p3:local*/) {
    var v3/*DEF:Y.Y3.v3:local*/;
  }
  Y.p/*DEF:Y.p:nonlocal*/ = 1;
  Y2.p/*DEF:Y.Y2.p:local*/ = 1;
}
