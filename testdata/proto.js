// adapted from tern/test/cases/proto.js

function Foo/*DEF:Foo*/(x) {
  this.x/*DEF:z.x*/ = x;
  this.y/*DEF:z.y*/ = [1];
}
Foo;

Foo.prototype/*DEF:Foo.prototype*/ = {
  makeString/*DEF:Foo.prototype.makeString*/: function() { return "hi"; },
  bar/*DEF:Foo.prototype.bar*/: 13
};

var z/*DEF:z*/ = new Foo(true);
