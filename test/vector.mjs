import * as $ from "../src/index.js";

const list = $.construct($.vectorfloatclass);

console.log("const list = new <float>[];");

console.log("list.push(10.5) =", $.callproperty(list, null, "push", 10.5));

// 10.5
console.log("list[0]++ =", $.postincrementproperty(list, null, 0));

// 11.5
console.log("list[0] =", $.getproperty(list, null, 0));
// 1
console.log("list.length =", $.getproperty(list, null, "length"));