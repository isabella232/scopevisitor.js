// adapted from tern/test/cases/proto.js

function Foo/*PATH:Foo*/(x) {
  this.x/*PATH:z.x*/ = x;
  this.y/*PATH:z.y*/ = [1];
}
Foo;

Foo.prototype/*PATH:Foo.prototype*/ = {
  makeString/*PATH:Foo.prototype.makeString*/: function() { return "hi"; },
  bar/*PATH:Foo.prototype.bar*/: 13
};

var z/*PATH:z*/ = new Foo(true);
