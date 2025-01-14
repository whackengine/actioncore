import * as $ from "../src/index.js";

const map1 = $.construct($.applytype($.mapclass, [$.stringclass, $.stringclass]));
console.log("const map1 = new Map.<*, *>();");
console.log("map1.x = 'hi';");
$.setproperty(map1, null, "x", "hi");
console.log("map1.x ==", $.getproperty(map1, null, "x"));
console.log("map1.length() ==", $.callproperty(map1, null, "length"));

console.log("// Testing weak Map");
const map2 = $.construct($.applytype($.mapclass, [$.regexpclass, $.floatclass]), true);
console.log("const map2 = new Map.<RegExp, float>(true);");
const regex = $.construct($.regexpclass, "(?:)", "gi");
console.log("const regex = /(?:)/gi;");
console.log("map2[regex] = 10;");
$.setproperty(map2, null, regex, 10);
console.log("map2[regex] ==", $.getproperty(map2, null, regex));

$.construct($.mapclass);