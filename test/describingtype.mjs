import * as $ from "../src/index.js";

let $publicns = $.packagens("");

const c1class = $.defineclass($.name($publicns, "C1"),
{
},
[
    [$.name($publicns, "x"), $.variable({
        type: $.numberclass,
        metadata: [
            new $.Metadata("Foo", [["k", "v"]]),
        ],
    })],
]);

console.log($.callproperty($.callglobal($.packagens("whack.utils"), "describeType", $.reflectclass(c1class)), null, "toXMLString"));