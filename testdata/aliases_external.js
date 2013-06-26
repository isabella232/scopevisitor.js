// FIXME(sqs)
var s1/*DEF:s1::ecma5/String*/ = String, s2/*DEF:s2::ecma5/String*/ = String;
s1.a/*DEF:String.a*/ = 1;
/*NOPATH:/s1\./*/
/*NOPATH:/s2\./*/

// Check that we properly handle aliases to nested external defs (with a dot, like Date.now instead
// of just single terms like Date or String).
var d1/*DEF:d1::ecma5/Date.now*/ = Date.now;
/*NOPATH:/d1\./*/

String.b/*DEF2:String.b*/ = 1;

// // TODO(sqs): check that when we create instances of an external type, they are not aliases
// var o1/*DEF2:o1*/ = new Object(), o2/*DEF2:o2*/ = new Object();
// o1.a/*DEF2:o1.a*/ = 1;
// o2.a/*DEF2:o2.a*/ = 1;
