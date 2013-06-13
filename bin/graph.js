#!/usr/bin/env node

var file = process.argv[2];
if (!file) {
  console.error('error: no file specified\n');
  console.error('usage:', process.argv[0], process.argv[1], '<file>');
  process.exit(1);
}

var path = require('path');
var dir = path.dirname(file);
var t0 = Date.now();
console.error('Starting to graph', file);

var server = require('../tern_server').startTernServer(dir, {ast: true, doc_comment: true, node: true, refs: true, symbols: true});

server.request({query: {type: 'sourcegraph:ast', file: file}}, function(err, res) {
  if (err) throw err;
  // AST nodes
  process.stdout.write('{"astNodes":[');
  for (var i = 0; i < res.length; ++i) {
    process.stdout.write(JSON.stringify(res[i]));
    if (i != res.length - 1) process.stdout.write(',');
  }
  process.stdout.write(']');
});

server.request({query: {type: 'symbols', file: file}}, function(err, res) {
  if (err) throw err;

  // docs
  process.stdout.write(',"docs":[');
  for (var i = 0; i < res.docs.length; ++i) {
    process.stdout.write(JSON.stringify(res.docs[i]));
    if (i != res.docs.length - 1) process.stdout.write(',');
  }
  process.stdout.write(']');

  // symbols
  process.stdout.write(',"symbols":[');
  for (var i = 0; i < res.symbols.length; ++i) {
    process.stdout.write(JSON.stringify(res.symbols[i]));
    if (i != res.symbols.length - 1) process.stdout.write(',');
  }
  process.stdout.write(']');
});

server.request({query: {type: 'sourcegraph:refs', file: file}}, function(err, res) {
  if (err) throw err;
  // refs
  process.stdout.write(',"refs":[');
  for (var i = 0; i < res.refs.length; ++i) {
    process.stdout.write(JSON.stringify(res.refs[i]));
    if (i != res.refs.length - 1) process.stdout.write(',');
  }
  process.stdout.write(']');
});

process.stdout.write('}\n');
console.error('Finished graphing file', file, '(took', (Date.now() - t0), 'msec)');
