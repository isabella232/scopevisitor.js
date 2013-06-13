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
    query: {type: 'type', file: file.name, start: ident.start, end: ident.end}
  }, function(err, tres) {
    if (err) throw err;
    res = tres;
  });
  return res;
};
