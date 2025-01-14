import * as $ from "../src/index.js";

const regexfloatgroup_t = $.tupletype([$.regexpclass, $.floatclass]);
const regexfloatgroup = [regexfloatgroup_t, $.untoucheddynamic, $.construct($.regexpclass, "(?:)", "gi"), 10];
console.log("type RegexFloatGroup = [RegExp, float];");
console.log("const regexFloatGroup:RegexFloatGroup = [/(?:)/gi, 10];");
console.log("regexFloatGroup[0] ==", $.tostring($.getproperty(regexfloatgroup, null, 0)));
console.log("regexFloatGroup[1] ==", $.tostring($.getproperty(regexfloatgroup, null, 1)));