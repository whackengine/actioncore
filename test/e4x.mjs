import * as $ from "../src/index.js";

const xnode = $.construct($.xmlclass, `\
<?xml version="1.0"?>
<a:data xmlns:a="a" val="10">
    <a:item/>
    <foo>hi</foo>
</a:data>
`);

const a_ns = $.construct($.namespaceclass, "a", "a");

let i = 0;
for (const child_xn of $.valueiterator(xnode))
{
    console.log("child_xn[" + i + "].nodeKind() =", $.callproperty(child_xn, null, "nodeKind"));
    i++;
}

console.log("<a:data/>.nodeKind() =", $.callproperty(xnode, null, "nodeKind"));
console.log("<a:data/>.@val =", $.getattribute(xnode, null, "val"));

const fooel = $.getproperty($.getdescendants(xnode, null, "foo"), null, 0);
console.log("<foo/>.toString() =", $.callproperty(fooel, null, "toString"));