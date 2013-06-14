var should = require('should');

var server = require('../tern_server').startTernServer('.', {ast: true});

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
      should.ifError(err);
      res.map(nodeInfo).should.eql(
        [
          {_id: '/Program', type: 'Program', start: 0, end: 12},
          {_id: '/Program/body/0/VariableDeclaration', type: 'VariableDeclaration', start: 0, end: 11},
          {_id: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:foo', type: 'VariableDeclarator', start: 4, end: 11},
          {_id: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:foo/init/Literal', type: 'Literal', start: 10, end: 11},
          {_id: '/Program/body/0/VariableDeclaration/declarations/0/VariableDeclarator:foo/id/Identifier', type: 'Identifier', start: 4, end: 7},
        ]
      );
    });
    done();
  });
});
