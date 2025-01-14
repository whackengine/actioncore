import * as $ from "../src/index.js";

const list = $.construct($.applytype($.arrayclass, [$.floatclass]));
console.log("const list:[float] = [];");
console.log("list.push(10.5) =", $.callproperty(list, null, "push", 10.5));
console.log("list[0]++ =", $.postincrementproperty(list, null, 0));
console.log("list[0] =", $.getproperty(list, null, 0));
console.log("list.length =", $.getproperty(list, null, "length"));

const listOfRegExp = $.construct($.applytype($.arrayclass, [$.regexpclass]));
console.log("const listOfRegExp:[RegExp] = [];");
console.log("listOfRegExp.push(/(?:)/gi) =", $.callproperty(listOfRegExp, null, "push", $.construct($.regexpclass, "(?:)", "gi")));

const dynamicList = $.construct($.applytype($.arrayclass, [null]));
console.log("const dynamicList:[*] = [];");
console.log("dynamicList.push(10.5) =", $.callproperty(dynamicList, null, "push", 10.5));