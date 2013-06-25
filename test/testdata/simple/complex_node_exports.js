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
  freeExports/*REF:'complex_node_exports.js'*/;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && module.exports == freeExports && module;
  freeModule/*REF:'complex_node_exports.js'*/;

  var _ = /*DECL*/function(){}/*DECL:{id:'complex_node_exports.js'}*/;
  _.b = /*DECL*/function(){}/*DECL:{id:'complex_node_exports.js/exports.b'}*/;
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
}(this))
