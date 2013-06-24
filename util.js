// getDefinition gets the definition of the identifier that appears in file.
exports.getDefinition = function(server, file, ident) {
  var res;
  server.request({
    query: {type: 'definition', file: file.name, start: ident.start, end: ident.end}
  }, function(err, dres) {
    if (err) throw err;
    res = dres;
  });
  return res;
};

// getType gets the type of the identifier that appears in file.
exports.getType = function(server, file, ident) {
  var res;
  server.request({
    query: {type: 'type', file: file.name, start: ident.start, end: ident.end, depth: 2}
  }, function(err, tres) {
    if (err) throw err;
    res = tres;
  });
  return res;
};

// getDoc gets the documentation for the identifier that appears in file.
exports.getDoc = function(server, file, ident) {
  var res;
  server.request({
    query: {type: 'documentation', file: file.name, start: ident.start, end: ident.end}
  }, function(err, dres) {
    // Don't throw on error; just return empty.
    res = dres;
  });
  return res;
};

// getRefs gets the refs of the identifier that appear in file.
exports.getRefs = function(server, file, ident) {
  var res;
  server.request({
    query: {type: 'refs', file: file.name, start: ident.start, end: ident.end}
  }, function(err, tres) {
    if (err) throw err;
    res = tres;
  });
  console.error('REFS', ident, res);
  return res;
};
