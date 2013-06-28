// adapted from https://github.com/bestiejs/lodash/blob/916c949629b23e6e78b6394dfc496414d2abd6a2/lodash.js#L117
;(function(window) {
  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports;
  freeExports/*REF:exports*/;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && module.exports == freeExports && module;
  freeModule/*REF:module,,@node*/;

  var _ = /*DEF*/function(){}/*DEF:{path:'exports'}*/;
  _.b = /*DEF*/function(){}/*DEF:{path:'exports.b'}*/;
  if (freeExports && !freeExports.nodeType) {
    // in Node.js or RingoJS v0.8.0+
    if (freeModule) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or RingoJS v0.7.0-
    else {
      freeExports._ = _;
    }
  }

  _;/*REF:exports._*/
  objectTypes;/*REF_DISABLED(need to traverse locals):whatever.objectTypes*/
}(this))
