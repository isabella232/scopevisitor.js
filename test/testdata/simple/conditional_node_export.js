if (true) {
  exports.a/*DECLID:'/exports.a'*/ = function(){};
}
if (exports) {
  exports.b/*DECLID:'/exports.b'*/ = function(){};
}
if (typeof exports !== 'undefined') {
  exports.c/*DECLID:'/exports.c'*/ = function(){};
}

(exports || window).d/*DECLID:'/exports.d'*/ = function(){};
((module && module.exports) || window).e/*DECLID:'/exports.e'*/ = function(){};
