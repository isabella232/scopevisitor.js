// mimic what node-fs-extra lib/index.js does (it's quite complex, so it's a good stress test)
// https://github.com/jprichardson/node-fs-extra/blob/95098c31eaf5c3547628e29c514ded7499e6df08/lib/index.js
var qs = null, qse = {};

try {
  qs = require("doesntexist");
} catch (err) {
  qs = require("querystring"); // node.js querystring stdlib module
}

Object.keys(qs).forEach(function (key) {
  var func = qs[key];
  if (typeof func === "function") {
    qse[key] = func;
  }
});

qs = qse;

qs.A/*DEF:exports.A*/ = require("./extra_AB").A;

var cd = require("./extra_CD");
qs.C/*DEF:exports.C*/ = cd.C;
qs["delete"]/*DEF:exports.delete*/ = cd.D;

// doc for E
qs.E/*DEF:exports.E*/ = function E2(i) {
  var j = 3;
  return qs.C * j * i;
};

module.exports = qs;

module.exports.F/*DEF:exports.F*/ = require("./extra_F");
module.exports.G/*DEF:exports.G*/ = module.exports.F.F;

// unescape is from "querystring" lib
module.exports.H2/*DEF:exports.H2::node/querystring.unescape*/ = module.exports.unescape;

console.log(module.exports);
