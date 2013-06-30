#!/usr/bin/env node

// adapted from tern/bin/condense

var tern_support = require('../tern_support');
var path = require('path'), fs = require('fs');
require('tern/plugin/doc_comment');
require('../ast');
require('../symbols');
require('../refs');

var debug = process.stdout.isTTY, localDir = process.cwd(), ternDir = path.resolve(__dirname, '../node_modules/tern');

function usage(exit) {
  console.error('usage: ' + process.argv[1] + ' [--plugin name]* [--def name]* file.js');
  if (exit != null) process.exit(exit);
}

var defs = [], plugins = {doc_comment: {}}, file;

for (var i = 2, len = process.argv.length; i < len; ++i) {
  var cur = process.argv[i];
  if (cur == '--plugin' && i < len - 1) {
    var plugin = process.argv[++i], eq = plugin.indexOf('=');
    if (eq > -1)
      tern_support.loadPlugin(plugins, plugin.slice(0, eq), JSON.parse(plugin.slice(eq + 1)));
    else
      tern_support.loadPlugin(plugins, plugin, {});
  } else if (cur == '--def' && i < len - 1) {
    tern_support.loadDef(defs, process.argv[++i]);
  } else if (cur.charAt(0) == '-') {
    usage(1);
  } else {
    if (file) {
      console.error('Only 1 file may be specified');
      process.exit(1);
    }
    file = cur;
  }
}

if (!file) usage(1);
var server = tern_support.newServer(defs, plugins);
server.addFile(file, fs.readFileSync(file, 'utf8'));

var t0 = Date.now();
var fsize = fs.statSync(file).size;
var count = {astNodes: 0, docs: 0, symbols: 0, refs: 0};
server.request({query: {type: 'sourcegraph:ast', file: file}}, function(err, res) {
  if (err) throw err;
  process.stdout.write('{"astNodes":[');
  for (var i = 0; i < res.length; ++i) {
    process.stdout.write(JSON.stringify(res[i]));
    if (i != res.length - 1) process.stdout.write(',');
  }
  count.astNodes = res.length;
  process.stdout.write(']');
});
server.request({query: {type: 'sourcegraph:symbols', file: file}}, function(err, res) {
  if (err) throw err;
  process.stdout.write(',"symbols":[');
  for (var i = 0; i < res.length; ++i) {
    process.stdout.write(JSON.stringify(res[i]));
    if (i != res.length - 1) process.stdout.write(',');
  }
  count.symbols = res.length;
  process.stdout.write(']');
});
server.request({query: {type: 'sourcegraph:refs', file: file}}, function(err, res) {
  if (err) throw err;
  process.stdout.write(',"refs":[');
  for (var i = 0; i < res.length; ++i) {
    process.stdout.write(JSON.stringify(res[i]));
    if (i != res.length - 1) process.stdout.write(',');
  }
  count.refs = res.length;
  process.stdout.write(']');
});
process.stdout.write('}\n');
var msec = (Date.now() - t0);
if (debug) console.error('Finished graphing file', file, ': took', msec, 'msec, emitted', count);
