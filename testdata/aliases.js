var a/*DEF:a*/ = 1,
    b/*DEF:b*/ = 1;

function T(){}
var t1/*DEF:t1*/ = new T(),
    t2/*DEF:t2*/ = new T();

var T2/*DEF:T2::T*/ = T;

var u1/*DEF:u1*/, u1a/*DEF:u1a*/ = u1;

var u2/*DEF:u2*/ = {}, u2a/*DEF:u2a::u2*/ = u2;
u2.x/*DEF:u2.x*/ = 1;
u2a.y/*DEF:u2.y*/ = 1;

var u3/*DEF:u3*/ = {}, u4/*DEF:u4*/ = {};
u3.a/*DEF:u3.a*/ = 1;
u4.a/*DEF:u4.a*/ = 1;

var u5/*DEF:u5*/ = {}, u6/*DEF:u6*/ = u5;
u6 = {};

var u7/*DEF:u7*/ = {a/*DEF:u7.a::u7*/: u7};
u7.b/*DEF:u7.b::u7*/ = u7;

// TODO(sqs): enable and fix this test
/**
 * cf is type annotated
 *
 * @param {Function} cf
 */
function F(cf/*DEF_DISABLED:F.cf:local*/) {}
F()
