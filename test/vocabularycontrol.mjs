import * as $ from "../src/index.js";

let $publicns = $.packagens("com.hydroper.actioncore.test");

const Portuguese_ns = new $.Userns("http://linguagem.br");

const speakerclass = $.defineclass($.name($publicns, "Speaker"),
{
    ctor(name)
    {
        $.setproperty(this, null, "name", name);
    }
},
[
    [$.name($publicns, "name"), $.variable({
        type: $.stringclass,
    })],
    [$.name($publicns, "speak"), $.method({
        exec()
        {
            return "Hello! My name is " + $.getproperty(this, null, "name") + ".";
        },
    })],
    [$.name(Portuguese_ns, "speak"), $.method({
        exec()
        {
            return "Olá! Meu nome é " + $.getproperty(this, null, "name") + ".";
        },
    })],
]);

const speaker = $.construct(speakerclass, "Speaker");
console.log("Speaker#speak() = " + $.callproperty(speaker, null, "speak"));
console.log("Speaker#Portuguese::speak() = " + $.callproperty(speaker, Portuguese_ns, "speak"));