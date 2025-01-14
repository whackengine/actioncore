import * as $ from "../src/index.js";

let $publicns = $.packagens("demo");

const aclass = $.defineclass($.name($publicns, "A"),
{
    ctor(name)
    {
    }
}, []);

const bclass = $.defineclass($.name($publicns, "B"),
{
    extendslist: aclass,
    ctor(name)
    {
    }
}, []);

const yclass = $.defineclass($.name($publicns, "Y"),
{
    ctor(name)
    {
    }
}, []);

const a = $.construct(aclass);
console.log("a is Object", $.istype(a, $.objectclass));
console.log("a is A", $.istype(a, aclass));
console.log("a is B", $.istype(a, bclass));
console.log("a is Y", $.istype(a, yclass));
console.log("a as A =", $.tostring($.coerce(a, aclass)));
console.log("a as B =", $.tostring($.coerce(a, bclass)));

const b = $.construct(bclass);
console.log("b is Object", $.istype(b, $.objectclass));
console.log("b is A", $.istype(b, aclass));
console.log("b is B", $.istype(b, bclass));
console.log("b is Y", $.istype(b, yclass));
console.log("b as A =", $.tostring($.coerce(b, aclass)));
console.log("b as B =", $.tostring($.coerce(b, bclass)));

const obj = $.construct($.objectclass);
console.log("obj is Object", $.istype(obj, $.objectclass));
console.log("obj is A", $.istype(obj, aclass));

console.log("obj as A =", $.tostring($.coerce(obj, aclass)));
console.log("obj as Object =", $.tostring($.coerce(obj, $.objectclass)));