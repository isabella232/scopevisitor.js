// doc for A
function A() {
  return "Hello from A";
}

// doc for B
var B = function() {
  var j = 1;
  return j + 2;
};

module.exports.A = A;
module.exports.B = B;
