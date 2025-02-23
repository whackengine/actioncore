import * as $ from "../src/index.js";

let $publicns = $.packagens("demo");

const aclass = $.defineclass($.name($publicns, "A"),
{
    ctor(name = "")
    {
        $.setproperty(this, null, "name", name);
    }
}, [
    [$.name($publicns, "name"), $.variable({
        type: $.stringclass,
    })],
]);

const a = $.construct(aclass, "xxx");
console.log($.getproperty($.callproperty(a, null, "clone"), null, "name"));