exports.A/*DEF:exports.A*/ = function(p/*DEF:exports.A.p:local*/) {
};

exports.B/*DEF:exports.B*/ = B;

function B(p/*DEF:exports.B.p:local*/) {
  exports.C/*DEF:exports.C*/ = 3;
}
/*NOPATH:/^B\./*/

module.exports.D/*DEF:exports.D::exports.A*/ = exports.A;
