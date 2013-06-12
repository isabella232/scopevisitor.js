var assert = require('assert');

var server = require('./helpers').startTernServer('.', ['ast']);

describe('AST', function() {
  function nodeInfo(node) {
    return {
      _id: node._id,
      type: node.type,
      start: node.start,
      end: node.end,
    };
  }

  it('returns an array of AST nodes with IDs from node-idast', function(done) {
    server.request({
      query: {type: 'ast', file: '#0'},
      files: [
        {name: 'a.js', type: 'full', text: 'var foo = 3;'},
      ],
    }, function(err, res) {
      assert.ifError(err);
      assert.deepEqual(
        res.map(nodeInfo),
          [
            {_id: '/Program', type: 'Program', start: 0, end: 12},
            {_id: '/Program/body/0/VariableDeclaration', type: 'VariableDeclaration', start: 0, end: 11},
            {_id: '/Program/body/0/VariableDeclaration/declarations/0:foo/id', type: 'Identifier', start: 4, end: 7},
            {_id: '/Program/body/0/VariableDeclaration/declarations/0:foo/init', type: 'Literal', start: 10, end: 11},
          ]
      );
    });
    done();
  });
});
