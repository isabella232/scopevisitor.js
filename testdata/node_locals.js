// FIXME(sqs): this isn't working because the node plugin obliterates locals that are not reachable
// by an exported path

// ensure that we still emit locals
function a/*DEF_DISABLED:a:local*/(b/*DEF_DISABLED:a.b:local*/) {}

exports.c = {z:a};
