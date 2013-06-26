// TODO(sqs): It's a little bit weird how b aliases a.d, instead of a.d aliasing b. This is because
// a appears first. Maybe we should give shorter paths precedence?
var a/*DEF:a*/ = {};
var b/*DEF:b::a.d*/ = {c/*DEF:a.d.c::a*/: a};
a.d/*DEF:a.d*/ = b;
