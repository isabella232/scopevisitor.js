// This file isn't tested directly, but you can load it into an infer.Context with locals.js to get
// better type information by running:
//   bin/defpaths +testdata/call_locals.js testdata/locals.js

X(1, true);
Y('foo', {bar: 3});

function Z() {}
