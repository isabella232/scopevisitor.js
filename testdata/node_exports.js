// This file isn't tested directly yet, because the test runner doesn't start a tern server (which
// is the only way to load tern's node plugin). However, you can see the defpaths output by running:
//   bin/defpaths testdata/node_exports.js
exports.A = function(p) {
};

exports.B = B;

function B(p) {
  exports.C = 3;
}
