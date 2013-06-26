// TODO(sqs): Decide how we want to handle this. Do we want to duplicate T's
// prototype on T2?

function T(x) {}
T.prototype = {
  x: 1
};

var T2 = T;
var T3 = new T;
