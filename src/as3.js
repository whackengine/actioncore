import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { ByteArray, FlexNumberVector, assert, isXMLName } from "./util.js";

// Object.prototype.constructor
export const CONSTRUCTOR_INDEX = 0;

const SLOT_FIXTURE_START = 2;

// dynamic class { ...[k]=v }
export const DYNAMIC_PROPERTIES_INDEX = 1;

export const untoucheddynamic = new Map();

let $setPrototypeNow = false;

export class Ns
{
    toString()
    {
        return "";
    }

    ispublicns()
    {
        return this instanceof Systemns && this.kind == Systemns.PUBLIC;
    }

    ispublicorinternalns()
    {
        return this instanceof Systemns && (this.kind == Systemns.PUBLIC || this.kind == Systemns.INTERNAL);
    }
}

export class Systemns extends Ns
{
    static INTERNAL = 0;
    static PUBLIC = 1;
    static PRIVATE = 2;
    static PROTECTED = 3;
    static STATIC_PROTECTED = 4;

    kind = Systemns.INTERNAL;

    /**
     * Nullable reference to an ActionScript package or class.
     */
    parent = null;

    constructor(kind, parent)
    {
        super();
        this.kind = kind;
        this.parent = parent;
    }

    toString() {
        return "ns://system";
    }
}

export class Userns extends Ns
{
    uri = "";

    constructor(uri)
    {
        super();
        this.uri = uri;
    }

    toString() {
        return this.uri;
    }
}

export class Package
{
    /**
     * Full name
     */
    name;
    publicns = new Systemns(Systemns.PUBLIC, null);
    internalns = new Systemns(Systemns.INTERNAL, null);
    namess = new Names();
    varvals = new Map();

    /**
     * @param name Full name
     */
    constructor(name) 
    {
        this.name = name;
        this.publicns.parent = this;
        this.internalns.parent = this;
    }
}

const interneduserns = new Map();

const packages = new Map();

/**
 * Interns an user namespace.
 */
export function userns(uri)
{
    let r = interneduserns.get(uri);
    if (!r)
    {
        r = new Userns(uri);
        interneduserns.set(uri, r);
    }
    return r;
}

/**
 * Retrieves the `public` namespace of a package.
 */
export function packagens(name)
{
    if (packages.has(name))
    {
        return packages.get(name).publicns;
    }
    const p = new Package(name);
    packages.set(name, p);
    return p.publicns;
}

/**
 * Retrieves the `internal` namespace of a package.
 */
export function packageinternalns(name)
{
    if (packages.has(name))
    {
        return packages.get(name).internalns;
    }
    const p = new Package(name);
    packages.set(name, p);
    return p.internalns;
}

export class Name
{
    ns;
    name;

    constructor(ns, name)
    {
        this.ns = ns;
        this.name = name;
    }

    toString()
    {
        if (this.ns instanceof Userns)
        {
            return this.ns.uri + ":" + this.name;
        }
        else
        {
            return this.name;
        }
    }

    fullpackagename()
    {
        if (this.ns instanceof Systemns && this.ns.parent instanceof Package && this.ns.parent.name != "")
        {
            return this.ns.parent.name + "." + this.name;
        }
        else
        {
            return this.name;
        }
    }
}

export function name(ns, name)
{
    return new Name(ns, name);
}

/**
 * Mapping from (*ns*, *name*) to a trait object.
 */
export class Names
{
    m_dict = new Map();

    constructor(initialItems = [])
    {
        for (const [name, trait] of initialItems)
        {
            this.setnsname(name.ns, name.name, trait);
        }
    }
    
    dictionary()
    {
        const result = new Map();
        for (const [ns, names] of this.m_dict)
        {
            for (const [name, trait] of names)
            {
                result.set(new Name(ns, name), trait);
            }
        }
        return result;
    }

    hasname(qual, name)
    {
        if (!qual)
        {
            return this.haspublicname(name);
        }
        return qual instanceof Ns ? this.hasnsname(qual, name) : this.hasnssetname(qual, name);
    }

    hasnsname(ns, name)
    {
        return this.m_dict.get(ns)?.has(name) ?? false;
    }

    hasnssetname(nsset, name)
    {
        let found = false;
        for (const ns of nsset)
        {
            const result = ns.ispublicns() || ns === as3ns ? this.getpublicname(name) : this.getnsname(ns, name);
            if (result !== null)
            {
                if (found)
                {
                    throw new ReferenceError("Ambiguous reference to " + name + ".");
                }
                found = true;
            }
        }
        return found;
    }

    haspublicname(name)
    {
        let found = false;
        for (const [ns, names] of this.m_dict)
        {
            if ((ns instanceof Systemns && ns.kind == Systemns.PUBLIC) || ns === as3ns)
            {
                const result = names.has(name);

                if (result)
                {
                    if (found)
                    {
                        throw new ReferenceError("Ambiguous reference to " + name + ".");
                    }
                    found = true;
                }
            }
        }
        return found;
    }

    /**
     * Retrieves name by a generic qualifier (namespace, namespace array, or nothing)
     * and a local name.
     */
    getname(qual, name)
    {
        if (qual instanceof Array)
        {
            return this.getnssetname(qual, name);
        }
        if (qual instanceof Ns)
        {
            return this.getnsname(qual, name);
        }
        assert(typeof qual === "undefined" || qual === null);
        return this.getpublicname(name);
    }
    
    getnsname(ns, name)
    {
        return this.m_dict.get(ns)?.get(name) ?? null;
    }

    getnssetname(nsset, name)
    {
        for (const ns of nsset)
        {
            const result = ns.ispublicns() || ns === as3ns ? this.getpublicname(name) : this.getnsname(ns, name);
            if (result !== null)
            {
                return result;
            }
        }
        return null;
    }
    
    getpublicname(name)
    {
        for (const [ns, names] of this.m_dict)
        {
            if ((ns instanceof Systemns && ns.kind == Systemns.PUBLIC) || ns === as3ns)
            {
                const result = names.get(name) ?? null;
                if (result !== null)
                {
                    return result;
                }
            }
        }
        return null;
    }

    setnsname(ns, name, trait)
    {
        let names = this.m_dict.get(ns) ?? null;
        if (names === null)
        {
            names = new Map();
            this.m_dict.set(ns, names);
        }
        names.set(name, trait);
    }
}

export class ActionCoreType
{
    isbasetypeof(type)
    {
        return type.issubtypeof(this);
    }

    issubtypeof(type)
    {
        return false;
    }

    get name()
    {
        return "$" + randomHexID();
    }

    get metadata()
    {
        return [];
    }
}

export function nameoftype(type)
{
    return type === null ? "*" : type.name;
}

/**
 * Encodes certain details of a class.
 * 
 * An instance of a class is an Array object
 * whose first element is a reference to the Class object
 * corresponding to that class, and is used for computing
 * the `constructor` property; the second element
 * are always the dynamic properties of the object.
 */
export class Class extends ActionCoreType
{
    baseclass = null;
    interfaces = [];

    /**
     * Fully package qualified name.
     */
    name;
    final;
    dynamic;
    metadata;
    ctor;

    staticnames = new Names();
    /**
     * The read-only ECMAScript 3 `prototype` Object
     * containing ActionScript values.
     */
    ecmaprototype = null;

    prototypenames = new Names();

    staticvarvals = new Map();

    /**
     * Sequence of instance variables.
     * 
     * If the class is not dynamic, the first Variable element
     * identifies the slot number 1 of the instance Array;
     * if the class is dynamic, the first Variable element identifies
     * the slot number 2 of the instance Array.
     */
    prototypevarslots = [];

    constructor(name, final, dynamic, metadata, ctor)
    {
        super();
        this.name = name;
        this.final = final;
        this.dynamic = dynamic;
        this.metadata = metadata;
        this.ctor = ctor;
    }

    recursivedescclasslist()
    {
        const result = [this];
        if (this.baseclass !== null)
        {
            result.push.apply(result, this.baseclass.recursivedescclasslist());
        }
        return result;
    }

    isbasetypeof(arg)
    {
        if (arg instanceof TupleType)
        {
            return this === objectclass;
        }
        return arg.issubtypeof(this);
    }

    issubtypeof(arg)
    {
        if (arg instanceof Class)
        {
            for (const t of this.recursivedescclasslist())
            {
                if (t === arg)
                {
                    return true;
                }
            }
        }
        if (arg instanceof Interface)
        {
            for (const t of this.recursivedescclasslist())
            {
                for (const itrfc of t.interfaces)
                {
                    if (t === arg || t.issubtypeof(arg))
                    {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}

/*
export type ClassOptions =
{
    extendslist?,
    implementslist?,
    final?,
    dynamic?,
    metadata?,
    ctor?,
};
*/

export function defineclass(name, options, items)
{
    assert(!globalnames.hasnsname(name.ns, name.name), "Name conflict: " + name.toString());

    const finalname = name.fullpackagename();

    const class1 = new Class(finalname, options.final ?? false, options.dynamic ?? false, options.metadata ?? [], options.ctor ?? function() {});

    const isobjectclass = name.ns === packagens("") && name.name == "Object";

    // Extend class
    if (!isobjectclass)
    {
        assert(!!objectclass, "Class definitions must follow the Object class.");
        class1.baseclass = options.extendslist ?? objectclass;
        assert(!class1.baseclass.final, "Cannot extend " + class1.baseclass.name);
        if ($setPrototypeNow)
        {
            class1.ecmaprototype = construct(objectclass);
        }
    }

    // Implement interfaces
    class1.interfaces = options.implementslist ?? [];

    // Define items
    const thesevars = [];
    for (const [itemname, item1] of items)
    {
        const item = item1;
        assert(item instanceof PossiblyStatic);

        item.name = itemname.name;

        if (item.static)
        {
            assert(!class1.staticnames.hasnsname(itemname.ns, itemname.name), "Name conflict: " + itemname.toString());
            class1.staticnames.setnsname(itemname.ns, itemname.name, item);
        }
        else
        {
            assert(!class1.prototypenames.hasnsname(itemname.ns, itemname.name), "Name conflict: " + itemname.toString());
            class1.prototypenames.setnsname(itemname.ns, itemname.name, item);
            if (item instanceof Variable)
            {
                thesevars.push(item);
            }
        }
    }

    // Calculate instance slots (-constructor [- dynamic] [+ fixed1 [+ fixed2 [+ fixedN]]])
    let baseslots = [];
    if (class1.baseclass !== null)
    {
        baseslots = class1.baseclass.prototypevarslots.slice(0);
    }
    class1.prototypevarslots.push.apply(baseslots, thesevars);

    // Finish
    globalnames.setnsname(name.ns, name.name, class1);

    return class1;
}

/**
 * Encodes certain details of an interface.
 */
export class Interface extends ActionCoreType
{
    baseinterfaces = [];

    /**
     * Fully package qualified name.
     */
    name;
    metadata;

    prototypenames = new Names();

    constructor(name, metadata)
    {
        super();
        this.name = name;
        this.metadata = metadata;
    }
    
    recursivedescinterfacelist()
    {
        const result = [this];
        for (const itrfc1 of this.baseinterfaces)
        {
            result.push.apply(result, itrfc1.recursivedescinterfacelist());
        }
        return result;
    }

    issubtypeof(arg)
    {
        if (arg instanceof Interface)
        {
            for (const t of this.recursivedescinterfacelist())
            {
                if (t === arg)
                {
                    return true;
                }
            }
        }
        return false;
    }
}

/*
export type InterfaceOptions =
{
    extendslist?,
    metadata?,
};
*/

export function defineinterface(name, options, items)
{
    assert(!globalnames.hasnsname(name.ns, name.name), "Name conflict: " + name.toString());

    const finalname = name.fullpackagename();

    const itrfc = new Interface(finalname, options.metadata ?? []);

    // Extends interfaces
    itrfc.baseinterfaces = options.extendslist ?? [];

    // Define items
    for (const [itemname, item1] of items)
    {
        const item = item1;
        assert(item instanceof PossiblyStatic);
        assert(!item.static && (item instanceof VirtualVariable || item instanceof Method));
        item.name = itemname.name;
        assert(!itrfc.prototypenames.hasnsname(itemname.ns, itemname.name), "Name conflict: " + itemname.toString());
        itrfc.prototypenames.setnsname(itemname.ns, itemname.name, item);
    }

    // Finish
    globalnames.setnsname(name.ns, name.name, itrfc);

    return itrfc;
}

/**
 * Represents a type substitution applied over `Array.<T>`, `Vector.<T>` and `Map.<K, V>`.
 */
export class SpecialTypeAfterSub extends ActionCoreType
{
    original;
    argumentslist;
    specialisedprototypenames = null;
    specialisedecmaprototype = null;
    specialisedctor = null;

    constructor(original, argumentslist)
    {
        super();
        this.original = original;
        this.argumentslist = argumentslist;
    }

    get baseclass()
    {
        return this.original.baseclass;
    }

    get interfaces()
    {
        return this.original.interfaces;
    }

    get name()
    {
        return this.original.name + "." + "<" + this.argumentslist.map(a => nameoftype(a)).join(", ") + ">";
    }

    get final()
    {
        return this.original.final;
    }

    get dynamic()
    {
        return this.original.dynamic;
    }

    get metadata()
    {
        return this.original.metadata;
    }

    get ctor()
    {
        return this.specialisedctor ?? this.original.ctor;
    }

    get staticnames()
    {
        return this.original.staticnames;
    }

    get ecmaprototype()
    {
        return this.specialisedecmaprototype ?? this.original.ecmaprototype;
    }

    get prototypenames()
    {
        return this.specialisedprototypenames ?? this.original.prototypenames;
    }

    get staticvarvals()
    {
        return this.original.staticvarvals;
    }

    get prototypevarslots()
    {
        return this.specialisedprototypenames !== null ? [] : this.original.prototypevarslots;
    }

    recursivedescclasslist()
    {
        const r = this.original.recursivedescclasslist();
        r.shift();
        r.unshift(this);
        return r;
    }

    issubtypeof(arg)
    {
        return this.original.issubtypeof(arg);
    }
}

/**
 * @type {Map<ActionCoreType, SpecialTypeAfterSub[]>}
 */
const appliedtypes = new Map();

let skipParameterizedMap = true;

export function applytype(original, argumentslist)
{
    if (skipParameterizedMap)
    {
        assert([arrayclass, vectorclass].indexOf(original) != -1, "Cannot apply types over given type.");
    }
    else
    {
        assert([arrayclass, vectorclass, mapclass].indexOf(original) != -1, "Cannot apply types over given type.");
    }

    const paramlen = new Map([
        [arrayclass, 1],
        [vectorclass, 1],
        [skipParameterizedMap ? objectclass : mapclass, 2],
    ]).get(original);

    assert(paramlen == argumentslist.length, "Incorrect number of type arguments.");

    let list = appliedtypes.get(original);
    if (list)
    {
        search: for (const t1 of list)
        {
            for (let i = 0; i < paramlen; i++)
            {
                if (t1.argumentslist[i] != argumentslist[i])
                {
                    continue search;
                }
            }
            return t1;
        }
    }

    list = list ?? [];
    appliedtypes.set(original, list);
    const r = new SpecialTypeAfterSub(original, argumentslist.slice(0));
    list.push(r);
    return r;
}

export class TupleType extends ActionCoreType
{
    static staticnames = new Names();
    static staticvarvals = new Map();
    static prototypenames = new Names();
    static prototypevarslots = [];

    elementtypes;

    constructor(elementtypes)
    {
        super();
        this.elementtypes = elementtypes;
    }

    get baseclass()
    {
        return objectclass;
    }

    get interfaces()
    {
        return [];
    }

    get name()
    {
        return "[" + this.elementtypes.map(t => nameoftype(t)).join(", ") + "]";
    }

    get final()
    {
        return true;
    }

    get dynamic()
    {
        return false;
    }

    get metadata()
    {
        return [];
    }

    get ctor()
    {
        return null;
    }

    get staticnames()
    {
        return TupleType.staticnames;
    }

    get prototypenames()
    {
        return TupleType.prototypenames;
    }

    get staticvarvals()
    {
        return TupleType.staticvarvals;
    }

    get prototypevarslots()
    {
        return TupleType.prototypevarslots;
    }

    recursivedescclasslist()
    {
        const result = [this];
        result.push.apply(result, this.baseclass.recursivedescclasslist());
        return result;
    }

    issubtypeof(arg)
    {
        return arg === this.baseclass;
    }
}

const tupletypes = new Map();

export function tupletype(elementtypes)
{
    const len = elementtypes.length;
    let list = tupletypes.get(len);
    if (list)
    {
        search: for (let t1 of list)
        {
            for (let i = 0; i < len; i++)
            {
                if (t1.elementtypes[i] !== elementtypes[i])
                {
                    continue search;
                }
            }
            return t1;
        }
    }
    list = list ?? [];
    tupletypes.set(len, list);
    const r = new TupleType(elementtypes);
    list.push(r);
    return r;
}

/**
 * Meta-data attached to traits such as classes, methods and properties.
 */
export class Metadata
{
    name;
    /**
     * @type {[string | null | undefined, string][]}
     */
    entries;

    constructor(name, entries)
    {
        this.name = name;
        this.entries = entries;
    }
}

export class PossiblyStatic
{
    /**
     * Fully package qualified name.
     */
    name = "";
    static = false;
}

export class Nsalias extends PossiblyStatic
{
    ns;

    constructor(name, ns)
    {
        super();
        this.name = name;
        this.ns = ns;
    }
}

/*
export type NsaliasOptions =
{
    ns,
    static?,
};
*/

export function nsalias(options)
{
    const r = new Nsalias("", options.ns);
    r.static = options.static ?? false;
    return r;
}

export function definensalias(propertyns, propertyname, options)
{
    assert(!globalnames.hasnsname(propertyns, propertyname), "Name conflict: " + new Name(propertyns, propertyname).toString());

    const finalname = new Name(propertyns, propertyname).fullpackagename();
    const trait = nsalias(options);
    trait.name = finalname;
    globalnames.setnsname(propertyns, propertyname, trait);
    return trait;
}

export class Variable extends PossiblyStatic
{
    readonly;
    metadata;
    type;

    constructor(name, readonly, metadata, type)
    {
        super();
        this.name = name;
        this.readonly = readonly;
        this.metadata = metadata;
        this.type = type;
    }
}

/*
export type VariableOptions =
{
    readonly?,
    metadata?,
    type,
    static?,
};
*/

export function variable(options)
{
    const varb = new Variable("", options.readonly ?? false, options.metadata ?? [], options.type);
    varb.static = options.static ?? false;
    return varb;
}

export function definevar(ns, name, options)
{
    assert(!globalnames.hasnsname(ns, name), "Name conflict: " + new Name(ns, name).toString());

    const finalname = new Name(ns, name).fullpackagename();
    const trait = variable(options);
    trait.name = finalname;
    globalnames.setnsname(ns, name, trait);
    return trait;
}

export class VirtualVariable extends PossiblyStatic
{
    getter;
    setter;
    metadata;
    type;

    constructor(name, getter, setter, metadata, type)
    {
        super();
        this.name = name;
        this.getter = getter;
        this.setter = setter;
        this.metadata = metadata;
        this.type = type;
    }
}

/*
export type VirtualVariableOptions =
{
    getter,
    setter,
    metadata?,
    type,
    static?,
};
*/

export function virtualvar(options)
{
    const vvar = new VirtualVariable("", options.getter, options.setter, options.metadata ?? [], options.type);
    vvar.static = options.static ?? false;
    return vvar;
}

export function definevirtualvar(ns, name, options)
{
    assert(!globalnames.hasnsname(ns, name), "Name conflict: " + new Name(ns, name).toString());

    const finalname = new Name(ns, name).fullpackagename();
    const trait = virtualvar(options);
    trait.name = finalname;
    globalnames.setnsname(ns, name, trait);
    return trait;
}

export class Method extends PossiblyStatic
{
    metadata;

    exec;

    constructor(name, metadata, exec)
    {
        super();
        this.name = name;
        this.metadata = metadata;
        this.exec = exec;
    }
}

/*
export type MethodOptions =
{
    exec,
    metadata?,
    static?,
};
*/

export function method(options)
{
    const m = new Method("", options.metadata ?? [], options.exec);
    m.static = options.static ?? false;
    return m;
}

export function definemethod(ns, name, options)
{
    assert(!globalnames.hasnsname(ns, name), "Name conflict: " + new Name(ns, name).toString());

    const finalname = new Name(ns, name).fullpackagename();
    const trait = method(options);
    trait.name = finalname;
    globalnames.setnsname(ns, name, trait);
    return trait;
}

const globalnames = new Names();

const globalvarvals = new Map();

/**
 * Maps (instance) to (method) to (bound method Function instance).
 */
const boundmethods = new WeakMap();

/**
 * Maps global method trait to a Function instance.
 */
const internedglobalfunctions = new Map();

/**
 * Maps a W3C "Node" to an E4X "XML" node.
 */
const w3cnodetoe4xnodemapping = new WeakMap();

function w3cnodetoe4xnode(w3cnode)
{
    let xnode = w3cnodetoe4xnodemapping.get(w3cnode);
    if (!xnode)
    {
        xnode = [xmlclass, new Map(), w3cnode];
        w3cnodetoe4xnodemapping.set(w3cnode, xnode);
    }
    return xnode;
}

/**
 * If node is document, return a clone of the root element.
 */
function w3cnodeexitdoc(w3cnode)
{
    if (w3cnode.nodeType == w3cnode.DOCUMENT_NODE)
    {
        for (let i = 0; i < w3cnode.childNodes.length; i++)
        {
            const c = w3cnode.childNodes[i];
            if (c.nodeType == c.ELEMENT_NODE)
            {
                return c.cloneNode(true);
            }
        }
    }
    return w3cnode;
}

function istypeinstantiatedfrom(type, fromType)
{
    return type instanceof SpecialTypeAfterSub && type.original === fromType;
}

/**
 * Checks whether an object has or inherits a given property name.
 * 
 * This method is used by the `name in o` expression, where
 * `o` is either a base class or a base instance.
 */
export function inobject(base, name)
{
    if (base instanceof Array)
    {
        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return name in base;
        }
        if (istype(base, xmlclass))
        {
            const children = (base[XML_NODE_INDEX]).childNodes;
            if (!isNaN(Number(name)) && name >>> 0 === Number(name) && (name >>> 0) < children.length)
            {
                return true;
            }
            for (let i = 0; i < children.length; i++)
            {
                const child = children[i];
                if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, null, name))
                {
                    return true;
                }
            }
        }

        if (istype(base, xmllistclass))
        {
            const children = base[XMLLIST_XMLARRAY_INDEX];
            if (!isNaN(Number(name)) && name >>> 0 === Number(name) && (name >>> 0) < children.length)
            {
                return true;
            }
            for (let i = 0; i < children.length; i++)
            {
                const child = children[i][XML_NODE_INDEX];
                if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, null, name))
                {
                    return true;
                }
            }
        }

        if (istypeinstantiatedfrom(ctor, mapclass))
        {
            const mm = base[MAP_PROPERTIES_INDEX];
            if (mm instanceof WeakMap && !(name instanceof Array))
            {
                throw new ReferenceError("Weak key must be a managed Object.");
            }
            if (mm.has(name))
            {
                return true;
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (ctor.dynamic && !isproxy)
        {
            if (base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return true;
            }
        }
        let c1 = ctor;
        while (c1 !== null)
        {
            if (c1.prototypenames.haspublicname(String(name)))
            {
                return true;
            }
            // ECMAScript 3 prototype
            if (hasdynamicproperty(c1.ecmaprototype, String(name)))
            {
                return true;
            }
            c1 = c1.baseclass;
        }

        // Proxy
        if (isproxy)
        {
            return !!callproperty(base, whackproxyns, "hasProperty", name);
        }

        // Test collection properties (Array, Vector[$double|$float|$int|$uint])
        if (istypeinstantiatedfrom(ctor, arrayclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[ARRAY_SUBARRAY_INDEX].length;
        }
        if (istypeinstantiatedfrom(ctor, vectorclass))
        {
            if (Number(name) != name >> 0)
            {
                return false;
            }
            if (ctor === vectordoubleclass)
            {
                let i = name >> 0;
                return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
            }
            if (ctor === vectorfloatclass)
            {
                let i = name >> 0;
                return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
            }
            if (ctor === vectorintclass)
            {
                let i = name >> 0;
                return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
            }
            if (ctor === vectoruintclass)
            {
                let i = name >> 0;
                return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
            }
            let i = name >> 0;
            return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
        }
        if (istype(base, bytearrayclass))
        {
            if (isNaN(Number(name)) || Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[BYTEARRAY_BA_INDEX].length;
        }
        if (ctor instanceof TupleType)
        {
            if (isNaN(Number(name)) || Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < ctor.elementtypes.length;
        }

        // Test the "Class" object
        if (istype(base, classclass) && inobject(base[CLASS_CLASS_INDEX], name))
        {
            return true;
        }

        if (name == "constructor")
        {
            return true;
        }
    }
    // Class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        if (String(name) == "prototype")
        {
            return true;
        }
        let c1 = base;
        while (c1 !== null)
        {
            if (c1.staticnames.haspublicname(String(name)))
            {
                return true;
            }
            c1 = c1.baseclass;
        }
        if (name == "constructor")
        {
            return true;
        }
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        return name in base;
    }
    return false;
}

/**
 * Checks whether an object owns a given property name or key.
 * 
 * This method looks for Array element indices and own variables,
 * either for a base class or for a base instance.
 */
export function hasownproperty(base, name)
{
    if (base instanceof Array)
    {
        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return Object.prototype.hasOwnProperty.call(base, name);
        }

        if (istype(base, xmlclass))
        {
            const children = (base[XML_NODE_INDEX]).childNodes;
            if (!isNaN(Number(name)) && name >>> 0 === Number(name) && (name >>> 0) < children.length)
            {
                return true;
            }
            for (let i = 0; i < children.length; i++)
            {
                const child = children[i];
                if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, null, name))
                {
                    return true;
                }
            }
            return false;
        }

        if (istype(base, xmllistclass))
        {
            const children = base[XMLLIST_XMLARRAY_INDEX];
            if (!isNaN(Number(name)) && name >>> 0 === Number(name) && (name >>> 0) < children.length)
            {
                return true;
            }
            for (let i = 0; i < children.length; i++)
            {
                const child = children[i][XML_NODE_INDEX];
                if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, null, name))
                {
                    return true;
                }
            }
        }

        // Map.<K, V>
        if (istypeinstantiatedfrom(ctor, mapclass))
        {
            const mm = base[MAP_PROPERTIES_INDEX];
            if (mm instanceof WeakMap && !(name instanceof Array))
            {
                throw new ReferenceError("Weak key must be a managed Object.");
            }
            return mm.has(name);
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (ctor.dynamic && !isproxy)
        {
            if (base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return true;
            }
        }

        let c1 = ctor;
        while (c1 !== null)
        {
            let varb = c1.prototypenames.getpublicname(String(name));
            if (varb instanceof Variable || varb instanceof VirtualVariable)
            {
                return true;
            }
            c1 = c1.baseclass;
        }

        // Proxy
        if (isproxy)
        {
            return !!callproperty(base, whackproxyns, "hasProperty", name);
        }

        // Test collection properties (Array, Vector[$double|$float|$int|$uint])
        if (ctor instanceof SpecialTypeAfterSub)
        {
            if (ctor.original === arrayclass)
            {
                if (isNaN(Number(name)) || Number(name) != name >> 0)
                {
                    return false;
                }
                let i = name >> 0;
                return i >= 0 && i < base[ARRAY_SUBARRAY_INDEX].length;
            }
            if (ctor.original === vectorclass || ctor.original === vectordoubleclass || ctor.original === vectorfloatclass || ctor.original === vectorintclass || ctor.original === vectoruintclass)
            {
                if (isNaN(Number(name)) || Number(name) != name >> 0)
                {
                    return false;
                }
                let i = name >> 0;
                return i >= 0 && i < base[VECTOR_SUBARRAY_INDEX].length;
            }
        }
        if (ctor instanceof TupleType)
        {
            if (isNaN(Number(name)) || Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < ctor.elementtypes.length;
        }
        if (istype(base, bytearrayclass))
        {
            if (isNaN(Number(name)) || Number(name) != name >> 0)
            {
                return false;
            }
            let i = name >> 0;
            return i >= 0 && i < base[BYTEARRAY_BA_INDEX].length;
        }

        // Test the "Class" object
        if (istype(base, classclass) && hasownproperty(base[CLASS_CLASS_INDEX], name))
        {
            return true;
        }
    }
    // Class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        if (String(name) == "prototype")
        {
            return true;
        }
        let varb = base.staticnames.getpublicname(String(name));
        return varb instanceof Variable;
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        return Object.prototype.hasOwnProperty.call(base, name);
    }
    return false;
}

/**
 * Returns a global trait property as is.
 */
export function globaltrait(qual, name)
{
    return globalnames.getname(qual, name);
}

export function getglobal(qual, name)
{
    const trait = globalnames.getname(qual, name);
    if (trait instanceof Variable)
    {
        return coerce(globalvarvals.get(trait), trait.type);
    }
    if (trait instanceof VirtualVariable)
    {
        const getter = trait.getter;
        if (getter === null)
        {
            throw new ReferenceError("Cannot read write-only property.");
        }
        return getter.exec.apply(undefined, []);
    }
    if (trait instanceof Method)
    {
        let m = internedglobalfunctions.get(trait);
        if (!m)
        {
            m = construct(functionclass);
            m[FUNCTION_FUNCTION_INDEX] = trait.exec.bind(undefined);
            internedglobalfunctions.set(trait, m);
        }
        return m;
    }
    if (trait instanceof Nsalias)
    {
        return reflectnamespace(trait.ns);
    }
    if (trait instanceof Class || trait instanceof Interface)
    {
        return reflectclass(trait);
    }
    if (trait)
    {
        throw new Error("Internal error");
    }
    throw new ReferenceError("Access of undefined property " + name + ".");
}

export function setglobal(qual, name, value)
{
    const trait = globalnames.getname(qual, name);
    if (trait instanceof Variable)
    {
        if (trait.readonly && globalvarvals.has(trait))
        {
            throw new ReferenceError("Cannot assign to read-only property.");
        }
        globalvarvals.set(trait, coerceorfail(value, trait.type, () => {
            throw new TypeError("Cannot assign incompatible value.");
        }));
        return;
    }
    if (trait instanceof VirtualVariable)
    {
        const setter = trait.setter;
        if (setter === null)
        {
            throw new ReferenceError("Cannot assign to read-only property.");
        }
        setter.exec.apply(undefined, [coerceorfail(value, trait.type, () => {
            throw new TypeError("Cannot assign incompatible value.");
        })]);
        return;
    }
    if (trait instanceof Method)
    {
        throw new ReferenceError("Cannot assign to read-only method.");
    }
    if (trait instanceof Nsalias)
    {
        throw new ReferenceError("Cannot assign to read-only namespace.");
    }
    if (trait)
    {
        throw new Error("Internal error");
    }
    throw new ReferenceError("Access of undefined property " + name + ".");
}

export function callglobal(qual, name, ...args)
{
    const trait = globalnames.getname(qual, name);
    if (trait instanceof Variable)
    {
        return call(globalvarvals.get(trait), ...args);
    }
    if (trait instanceof VirtualVariable)
    {
        const getter = trait.getter;
        if (getter === null)
        {
            throw new ReferenceError("Cannot read write-only property.");
        }
        return call(getter.exec.apply(undefined, []), ...args);
    }
    if (trait instanceof Method)
    {
        return trait.exec.apply(undefined, args);
    }
    if (trait instanceof Nsalias)
    {
        throw new TypeError("Value is not a function.");
    }
    if (trait)
    {
        throw new Error("Internal error");
    }
    throw new ReferenceError("Call to undefined property " + name + ".");
}

export function preincrementglobal(qual, name)
{
    return preincreaseglobal(qual, name, 1);
}

export function predecrementglobal(qual, name)
{
    return preincreaseglobal(qual, name, -1);
}

export function postincrementglobal(qual, name)
{
    return postincreaseglobal(qual, name, 1);
}

export function postdecrementglobal(qual, name)
{
    return postincreaseglobal(qual, name, -1);
}

function preincreaseglobal(qual, name, incVal)
{
    const trait = globalnames.getname(qual, name);
    // variable
    if (trait instanceof Variable)
    {
        if (trait.readonly && globalvarvals.has(trait))
        {
            throw new ReferenceError("Cannot assign to read-only property.");
        }
        let v = globalvarvals.get(trait);
        if (typeof v !== "number")
        {
            throw new TypeError("Cannot increment or decrement a non numeric value.");
        }
        v += incVal;
        v = coerce(v, trait.type);
        globalvarvals.set(trait, v);
        return v;
    }
    // property accessor
    if (trait instanceof VirtualVariable)
    {
        const getter = trait.getter;
        if (getter === null)
        {
            throw new ReferenceError("Cannot increment or decrement a write-only property.");
        }
        const setter = trait.setter;
        if (setter === null)
        {
            throw new ReferenceError("Cannot increment or decrement a read-only property.");
        }
        let v = getter.exec.call(undefined);
        if (typeof v !== "number")
        {
            throw new TypeError("Cannot increment or decrement a non numeric value.");
        }
        v += incVal;
        v = coerce(v, trait.type);
        setter.exec.call(undefined, v);
        return v;
    }
    // method
    if (trait instanceof Method)
    {
        throw new TypeError("Cannot increment or decrement from method.");
    }
    // namespace
    if (trait instanceof Nsalias)
    {
        throw new TypeError("Cannot increment or decrement from namespace.");
    }
    if (trait)
    {
        throw new ReferenceError("Internal error");
    }
    throw new ReferenceError("Access of undefined property " + name + ".");
}

function postincreaseglobal(qual, name, incVal)
{
    const trait = globalnames.getname(qual, name);
    // variable
    if (trait instanceof Variable)
    {
        if (trait.readonly && globalvarvals.has(trait))
        {
            throw new ReferenceError("Cannot assign to read-only property.");
        }
        let v = globalvarvals.get(trait);
        if (typeof v !== "number")
        {
            throw new TypeError("Cannot increment or decrement a non numeric value.");
        }
        globalvarvals.set(trait, coerce(v + incVal, trait.type));
        return v;
    }
    // property accessor
    if (trait instanceof VirtualVariable)
    {
        const getter = trait.getter;
        if (getter === null)
        {
            throw new ReferenceError("Cannot increment or decrement a write-only property.");
        }
        const setter = trait.setter;
        if (setter === null)
        {
            throw new ReferenceError("Cannot increment or decrement a read-only property.");
        }
        let v = getter.exec.call(undefined);
        if (typeof v !== "number")
        {
            throw new TypeError("Cannot increment or decrement a non numeric value.");
        }
        setter.exec.call(undefined, coerce(v + incVal, trait.type));
        return v;
    }
    // method
    if (trait instanceof Method)
    {
        throw new TypeError("Cannot increment or decrement from method.");
    }
    // namespace
    if (trait instanceof Nsalias)
    {
        throw new TypeError("Cannot increment or decrement from namespace.");
    }
    if (trait)
    {
        throw new ReferenceError("Internal error");
    }
    throw new ReferenceError("Access of undefined property " + name + ".");
}

export function nameiterator(obj)
{
    if (obj instanceof Array)
    {
        const ctor = obj[CONSTRUCTOR_INDEX];
        if (!(ctor instanceof ActionCoreType))
        {
            return es3nameiterator(obj);
        }
        if (istypeinstantiatedfrom(ctor, arrayclass))
        {
            return obj[ARRAY_SUBARRAY_INDEX].keys();
        }
        if (istypeinstantiatedfrom(ctor, vectorclass))
        {
            return obj[VECTOR_SUBARRAY_INDEX].keys();
        }
        if (istype(obj, bytearrayclass))
        {
            return obj[BYTEARRAY_BA_INDEX].keys();
        }
        if (istypeinstantiatedfrom(ctor, mapclass))
        {
            const m = obj[MAP_PROPERTIES_INDEX];
            if (m instanceof WeakMap)
            {
                throw new ReferenceError("Cannot enumerate entries of a weak Map.");
            }
            return m.keys();
        }
        if (istype(obj, proxyclass))
        {
            return nameiterator_assumeProxy(obj);
        }
        if (istype(obj, xmlclass))
        {
            return iteratexmlnames(obj);
        }
        if (istype(obj, xmllistclass))
        {
            return iteratexmllistnames(obj);
        }
        if ((obj[CONSTRUCTOR_INDEX]).dynamic)
        {
            return obj[DYNAMIC_PROPERTIES_INDEX].keys();
        }
    }
    if (typeof obj === "object" || typeof obj === "symbol")
    {
        return es3nameiterator(obj);
    }
    if (typeof obj === "string")
    {
        return iterstringindices(obj);
    }
    if (typeof obj === "undefined" || obj === null)
    {
        return [][Symbol.iterator]();
    }
    return new TypeError("Value is not iterable.");
}

export function valueiterator(obj)
{
    if (obj instanceof Array)
    {
        const ctor = obj[CONSTRUCTOR_INDEX];
        if (!(ctor instanceof ActionCoreType))
        {
            return es3valueiterator(obj);
        }
        if (istypeinstantiatedfrom(ctor, arrayclass))
        {
            return obj[ARRAY_SUBARRAY_INDEX].values();
        }
        if (istypeinstantiatedfrom(ctor, vectorclass))
        {
            return obj[VECTOR_SUBARRAY_INDEX].values();
        }
        if (istype(obj, bytearrayclass))
        {
            return obj[BYTEARRAY_BA_INDEX].values();
        }
        if (istypeinstantiatedfrom(ctor, mapclass))
        {
            if (obj[MAP_PROPERTIES_INDEX] instanceof WeakMap)
            {
                throw new TypeError("Cannot iterate a Map of weak keys.");
            }
            return obj[MAP_PROPERTIES_INDEX].values();
        }
        if (istype(obj, proxyclass))
        {
            return valueiterator_assumeProxy(obj);
        }
        if (istype(obj, xmlclass))
        {
            return iteratexmlvalues(obj);
        }
        if (istype(obj, xmllistclass))
        {
            return iteratexmllistvalues(obj);
        }
        if ((obj[CONSTRUCTOR_INDEX]).dynamic)
        {
            return obj[DYNAMIC_PROPERTIES_INDEX].values();
        }
    }
    if (typeof obj === "object" || typeof obj === "symbol")
    {
        return es3valueiterator(obj);
    }
    if (typeof obj === "string")
    {
        return iterstringchars(obj);
    }
    if (typeof obj === "undefined" || obj === null)
    {
        return [][Symbol.iterator]();
    }
    return new TypeError("Value is not iterable.");
}

function *es3nameiterator(obj)
{
    for (const k in obj)
    {
        yield k;
    }
}

function *es3valueiterator(obj)
{
    for (const v of obj)
    {
        yield v;
    }
}

function *iterstringindices(str)
{
    for (let index in str)
    {
        yield index;
    }
}

function *iterstringchars(str)
{
    for (let ch of str)
    {
        yield ch;
    }
}

function *nameiterator_assumeProxy(obj)
{
    const nextNameIndexv = getproperty(obj, whackproxyns, "nextNameIndex");
    const nextNamev = getproperty(obj, whackproxyns, "nextName");
    if (!(istype(nextNameIndexv, functionclass) && istype(nextNamev, functionclass)))
    {
        throw new TypeError("Cannot iterate an incorrectly implemented proxy.");
    }

    const nextNameIndex = nextNameIndexv[FUNCTION_FUNCTION_INDEX];
    const nextName = nextNamev[FUNCTION_FUNCTION_INDEX];

    let i = 0;
    for (;;)
    {
        let j = nextNameIndex(i);
        if (j <= i)
        {
            break;
        }
        i = j;
        yield nextName(i);
    }
}

function *valueiterator_assumeProxy(obj)
{
    const nextNameIndexv = getproperty(obj, whackproxyns, "nextNameIndex");
    const nextValuev = getproperty(obj, whackproxyns, "nextValue");
    if (!(istype(nextNameIndexv, functionclass) && istype(nextValuev, functionclass)))
    {
        throw new TypeError("Cannot iterate an incorrectly implemented proxy.");
    }

    const nextNameIndex = nextNameIndexv[FUNCTION_FUNCTION_INDEX];
    const nextValue = nextValuev[FUNCTION_FUNCTION_INDEX];

    let i = 0;
    for (;;)
    {
        let j = nextNameIndex(i);
        if (j <= i)
        {
            break;
        }
        i = j;
        yield nextValue(i);
    }
}

function *iteratexmlnames(base)
{
    const children = (base[XML_NODE_INDEX]).childNodes;
    for (let i = 0; i < children.length; i++)
    {
        yield i;
    }
}

function *iteratexmlvalues(base)
{
    const children = (base[XML_NODE_INDEX]).childNodes;
    for (let i = 0; i < children.length; i++)
    {
        yield w3cnodetoe4xnode(children[i]);
    }
}

function *iteratexmllistnames(base)
{
    const children = base[XMLLIST_XMLARRAY_INDEX];
    for (let i = 0; i < children.length; i++)
    {
        yield i;
    }
}

function *iteratexmllistvalues(base)
{
    const children = base[XMLLIST_XMLARRAY_INDEX];
    for (let i = 0; i < children.length; i++)
    {
        yield children[i];
    }
}

function w3celementhastagname(element, qual, name)
{
    qual = qual ? reflectnamespace(qual) : null;
    if (qual)
    {
        return element.namespaceURI == qual[NAMESPACE_URI_INDEX] && element.localName === name;
    }
    else
    {
        return element.localName == name;
    }
}

function w3cnodehasname(node, qual, name)
{
    if (node.nodeType == node.ELEMENT_NODE)
    {
        return w3celementhastagname(node, qual, name);
    }
    if (node.nodeType == node.PROCESSING_INSTRUCTION_NODE)
    {
        if (qual)
        {
            return false;
        }
        return node.nodeName == String(name);
    }
    return false;
}

/**
 * Retrieves the value of an attribute.
 */
export function getattribute(base, qual, name)
{
    // instance
    if (base instanceof Array)
    {
        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return undefined;
        }
        if (istype(base, xmlclass))
        {
            const m = [];
            const node = base[XML_NODE_INDEX];
            let qualrefl = qual ? reflectnamespace(qual) : null;
            if (node.nodeType == node.ELEMENT_NODE)
            {
                if (qualrefl)
                {
                    return (node).getAttributeNodeNS(qual[NAMESPACE_URI_INDEX], tostring(name))?.value ?? undefined;
                }
                else
                {
                    return (node).getAttribute(tostring(name)) ?? undefined;
                }
            }
            else
            {
                throw new ReferenceError("Cannot read attribute of unsupported node type.");
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        throw new ReferenceError("Cannot read attribute of unsupported type " + ctor.name + ".");
    }
    if (typeof base === "number")
    {
        throw new ReferenceError("Cannot read attribute of Number.");
    }
    if (typeof base === "boolean")
    {
        throw new ReferenceError("Cannot read attribute of Boolean.");
    }
    if (typeof base === "string")
    {
        throw new ReferenceError("Cannot read attribute of String.");
    }
    if (base instanceof Class || base instanceof Interface)
    {
        throw new ReferenceError("Cannot read attribute of a class static object.");
    }
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot read attribute of tuple type.");
    }
    if (base === null)
    {
        throw new ReferenceError("Cannot read attribute of null.");
    }
    throw new ReferenceError("Cannot read attribute of undefined.");
}

/**
 * Assigns a value to an attribute.
 */
export function setattribute(base, qual, name, value)
{
    // instance
    if (base instanceof Array)
    {
        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return;
        }
        if (istype(base, xmlclass))
        {
            const m = [];
            const node = base[XML_NODE_INDEX];
            let qualrefl = qual ? reflectnamespace(qual) : null;
            if (node.nodeType == node.ELEMENT_NODE)
            {
                if (qualrefl)
                {
                    (node).setAttributeNS(qual[NAMESPACE_URI_INDEX], tostring(name), tostring(value));
                    return;
                }
                else
                {
                    (node).setAttribute(tostring(name), tostring(value));
                    return;
                }
            }
            else
            {
                throw new ReferenceError("Cannot set attribute of unsupported node type.");
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        throw new ReferenceError("Cannot set attribute of unsupported type " + ctor.name + ".");
    }
    if (typeof base === "number")
    {
        throw new ReferenceError("Cannot set attribute of Number.");
    }
    if (typeof base === "boolean")
    {
        throw new ReferenceError("Cannot set attribute of Boolean.");
    }
    if (typeof base === "string")
    {
        throw new ReferenceError("Cannot set attribute of String.");
    }
    if (base instanceof Class || base instanceof Interface)
    {
        throw new ReferenceError("Cannot set attribute of a class static object.");
    }
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot set attribute of tuple type.");
    }
    if (base === null)
    {
        throw new ReferenceError("Cannot set attribute of null.");
    }
    throw new ReferenceError("Cannot set attribute of undefined.");
}

/**
 * Deletes an attribute.
 */
export function deleteattribute(base, qual, name)
{
    // instance
    if (base instanceof Array)
    {
        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return false;
        }
        if (istype(base, xmlclass))
        {
            const m = [];
            const node = base[XML_NODE_INDEX];
            let qualrefl = qual ? reflectnamespace(qual) : null;
            if (node.nodeType == node.ELEMENT_NODE)
            {
                if (qualrefl)
                {
                    if ((node).hasAttributeNS(qual[NAMESPACE_URI_INDEX], tostring(name)))
                    {
                        (node).removeAttributeNS(qual[NAMESPACE_URI_INDEX], tostring(name));
                        return true;
                    }
                    return false;
                }
                else
                {
                    if ((node).hasAttribute(tostring(name)))
                    {
                        (node).removeAttribute(tostring(name));
                        return true;
                    }
                    return false;
                }
            }
            else
            {
                throw new ReferenceError("Cannot delete attribute of unsupported node type.");
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        throw new ReferenceError("Cannot delete attribute of unsupported type " + ctor.name + ".");
    }
    if (typeof base === "number")
    {
        throw new ReferenceError("Cannot delete attribute of Number.");
    }
    if (typeof base === "boolean")
    {
        throw new ReferenceError("Cannot delete attribute of Boolean.");
    }
    if (typeof base === "string")
    {
        throw new ReferenceError("Cannot delete attribute of String.");
    }
    if (base instanceof Class || base instanceof Interface)
    {
        throw new ReferenceError("Cannot delete attribute of a class static object.");
    }
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot delete attribute of tuple type.");
    }
    if (base === null)
    {
        throw new ReferenceError("Cannot delete attribute of null.");
    }
    throw new ReferenceError("Cannot delete attribute of undefined.");
}

function w3cnodedescendants(node)
{
    const r = [];
    if (node.childNodes)
    {
        for (let i = 0; i < node.childNodes.length; i++)
        {
            const child = node.childNodes[i];
            r.push(child);
            r.push(...w3cnodedescendants(child));
        }
    }
    return r;
}

/**
 * Retrieves the descendants of a property.
 */
export function getdescendants(base, qual, name)
{
    // instance
    if (base instanceof Array)
    {
        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return undefined;
        }
        if (istype(base, xmlclass))
        {
            const m = [];
            const children = w3cnodedescendants(base[XML_NODE_INDEX]);
            let qualrefl = qual ? reflectnamespace(qual) : null;
            for (let i = 0; i < children.length; i++)
            {
                const child = children[i];
                if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, qualrefl, name))
                {
                    m.push(w3cnodetoe4xnode(child));
                }
            }
            return [xmllistclass, new Map(), m];
        }

        if (istype(base, xmllistclass))
        {
            const m = [];
            const children1 = base[XMLLIST_XMLARRAY_INDEX];
            const children = [];
            for (const child of children1)
            {
                children.push(child[XML_NODE_INDEX]);
                children.push(...w3cnodedescendants(child[XML_NODE_INDEX]));
            }
            let qualrefl = qual ? reflectnamespace(qual) : null;
            for (let i = 0; i < children.length; i++)
            {
                const child = children[i];
                if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, qualrefl, name))
                {
                    m.push(w3cnodetoe4xnode(child));
                }
            }
            if (m.length != 0)
            {
                return [xmllistclass, new Map(), m];
            }
        }

        if (istype(base, proxyclass))
        {
            const getDescendantsv = getproperty(base, whackproxyns, "getDescendants");
            if (!istype(getDescendantsv, functionclass))
            {
                throw new TypeError("Incorrect Proxy#getDescendants() method.");
            }
            let namearg = null;
            if (qual)
            {
                namearg = construct(qnameclass, reflectnamespace(qual), tostring(name));
            }
            else
            {
                namearg = tostring(name);
            }
            return getDescendantsv[FUNCTION_FUNCTION_INDEX](namearg);
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        throw new ReferenceError("Cannot get descendants of unsupported type " + ctor.name + ".");
    }
    if (typeof base === "number")
    {
        throw new ReferenceError("Cannot get descendants of Number.");
    }
    if (typeof base === "boolean")
    {
        throw new ReferenceError("Cannot get descendants of Boolean.");
    }
    if (typeof base === "string")
    {
        throw new ReferenceError("Cannot get descendants of String.");
    }
    if (base instanceof Class || base instanceof Interface)
    {
        throw new ReferenceError("Cannot get descendants of a class static object.");
    }

    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot get descendants of tuple type.");
    }
    if (base === null)
    {
        throw new ReferenceError("Cannot get descendants of null.");
    }
    throw new ReferenceError("Cannot get descendants of undefined.");
}

export function hasmethod(base, qual, name)
{
    if (typeof name != "string" || Number(name) === (name) >> 0)
    {
        return false;
    }

    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return notqual ? typeof base[name] == "function" : false;
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            if (ctor.dynamic && base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return istype(base[DYNAMIC_PROPERTIES_INDEX].get(String(name)), functionclass);
            }

            /*
             * Commented out as that does not make sense
             * as key-values holding function are called by .call(k) instead.
             *
            if (istypeinstantiatedfrom(ctor, mapclass))
            {
                const mm = base[MAP_PROPERTIES_INDEX];
                if (mm instanceof WeakMap)
                {
                    return false;
                }
                if (mm.has(name))
                {
                    return istype(mm.get(name), functionclass);
                }
            }
            */
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    return istype(base[SLOT_FIXTURE_START + i], functionclass);
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const getter = itrait.getter;
                    if (getter === null)
                    {
                        return false;
                    }
                    return istype(getter.exec.call(base), functionclass);
                }
                // bound method
                if (itrait instanceof Method)
                {
                    return true;
                }
                if (itrait instanceof Nsalias)
                {
                    return false;
                }
                
                throw new ReferenceError("Internal error");
            }
            
            // instance ecmaprototype
            if (qualincludespublic(qual) && hasdynamicproperty(c1.ecmaprototype, String(name)))
            {
                return istype(getdynamicproperty(c1.ecmaprototype, String(name)), functionclass);
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            return istype(callproperty(base, whackproxyns, "getProperty", qn), functionclass);
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return hasmethod(base[CLASS_CLASS_INDEX], qual, name);
        }

        if (notqual && ctor.dynamic)
        {
            return false;
        }
        return false;
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);
        if (notqual && String(name) == "prototype")
        {
            return base.ecmaprototype;
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    return istype(c1.staticvarvals.get(trait), functionclass);
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const getter = trait.getter;
                    if (getter === null)
                    {
                        return false;
                    }
                    return istype(getter.exec.apply(undefined, []), functionclass);
                }
                // method
                if (trait instanceof Method)
                {
                    return true;
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    return false;
                }
                throw new ReferenceError("Internal error");
            }
            c1 = c1.baseclass;
        }
        return false;
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        if (!qualincludespublic(qual))
        {
            return false;
        }
        return typeof base[name] == "function";
    }
    // Number
    if (typeof base == "number")
    {
        return hasmethod([numberclass, untoucheddynamic, base], qual, name);
    }
    // Boolean
    if (typeof base == "boolean")
    {
        return hasmethod([booleanclass, untoucheddynamic, base], qual, name);
    }
    // String
    if (typeof base == "string")
    {
        return hasmethod([stringclass, untoucheddynamic, base], qual, name);
    }
    // undefined or null
    return false;
}

export function ecmatypeof(v)
{
    if (v instanceof Array && v[CONSTRUCTOR_INDEX] === functionclass)
    {
        return "function";
    }
    return typeof v;
}

function qualincludespublic(qual)
{
    if (qual instanceof Array)
    {
        if (qual[CONSTRUCTOR_INDEX] instanceof ActionCoreType)
        {
            return false;
        }
        return qual.some(q => (q).ispublicns() || q === as3ns);
    }
    if (qual instanceof Ns && (qual.ispublicns() || qual === as3ns))
    {
        return true;
    }
    return !qual;
}

/**
 * Retrieves the value of a property.
 */
export function getproperty(base, qual, name)
{
    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return notqual ? base[name] : undefined;
        }

        if (istype(base, xmlclass))
        {
            const children = base[XML_NODE_INDEX].childNodes;
            if (notqual && !isNaN(Number(name)) && name >>> 0 === Number(name))
            {
                if ((name >>> 0) >= children.length)
                {
                    throw new ReferenceError("Index " + (name >>> 0) + " out of bounds (length=" + children.length + ").");
                }
                return w3cnodetoe4xnode(children[name >>> 0]);
            }
            else
            {
                const m = [];
                let qualrefl = qual ? reflectnamespace(qual) : null;
                if (!qualrefl && name == "*")
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        m.push(w3cnodetoe4xnode(children[i]));
                    }
                }
                else
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        const child = children[i];
                        if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, qualrefl, name))
                        {
                            m.push(w3cnodetoe4xnode(child));
                        }
                    }
                }
                return [xmllistclass, new Map(), m];
            }
        }

        if (istype(base, xmllistclass))
        {
            const children = base[XMLLIST_XMLARRAY_INDEX];
            if (notqual && !isNaN(Number(name)) && name >>> 0 === Number(name))
            {
                if ((name >>> 0) >= children.length)
                {
                    throw new ReferenceError("Index " + (name >>> 0) + " out of bounds (length=" + children.length + ").");
                }
                return children[name >>> 0];
            }
            else
            {
                const m = [];
                let qualrefl = qual ? reflectnamespace(qual) : null;
                if (!qualrefl && name == "*")
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        m.push(children[i]);
                    }
                }
                else
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        const child = children[i];
                        const childw3c = child[XML_NODE_INDEX];
                        if (childw3c.nodeType === childw3c.ELEMENT_NODE && w3celementhastagname(childw3c, qualrefl, name))
                        {
                            m.push(child);
                        }
                    }
                }
                return [xmllistclass, new Map(), m];
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            if (istypeinstantiatedfrom(ctor, mapclass))
            {
                const mm = base[MAP_PROPERTIES_INDEX];
                if (mm instanceof WeakMap && !(name instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                return mm.get(name);
            }

            if (ctor.dynamic && base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return base[DYNAMIC_PROPERTIES_INDEX].get(String(name));
            }

            if (istypeinstantiatedfrom(ctor, arrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                return base[ARRAY_SUBARRAY_INDEX][name >> 0];
            }
            if (istypeinstantiatedfrom(ctor, vectorclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const arr = base[VECTOR_SUBARRAY_INDEX];
                let i = name >> 0;
                if (i < 0 || i >= arr.length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + arr.length + ").");
                }
                return arr instanceof FlexNumberVector ? arr.get(i) : arr[i];
            }
            if (ctor instanceof TupleType)
            {
                const l = ctor.elementtypes.length;
                let i = name >> 0;
                if (i < 0 || i >= l)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + l + ").");
                }
                return base[2 + i];
            }
            if (istype(base, bytearrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                let i = name >> 0;
                if (i < 0 || i >= base[BYTEARRAY_BA_INDEX].length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + base[BYTEARRAY_BA_INDEX].length + ").");
                }
                return base[BYTEARRAY_BA_INDEX].get(i);
            }
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    return base[SLOT_FIXTURE_START + i];
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const getter = itrait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot read write-only property.");
                    }
                    return getter.exec.call(base);
                }
                // bound method
                if (itrait instanceof Method)
                {
                    let bm1 = boundmethods.get(base);
                    if (!bm1)
                    {
                        bm1 = new Map();
                        boundmethods.set(base, bm1);
                    }
                    let bm = boundmethods.get(itrait);
                    if (bm === null)
                    {
                        bm = construct(functionclass);
                        bm[FUNCTION_FUNCTION_INDEX] = itrait.exec.bind(base);
                        boundmethods.set(itrait, bm);
                    }
                    return bm;
                }
                if (itrait instanceof Nsalias)
                {
                    return reflectnamespace(itrait.ns);
                }
                
                throw new ReferenceError("Internal error");
            }
            
            // instance ecmaprototype
            if (qualincludespublic(qual) && hasdynamicproperty(c1.ecmaprototype, String(name)))
            {
                return getdynamicproperty(c1.ecmaprototype, String(name));
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            return callproperty(base, whackproxyns, "getProperty", qn);
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return getproperty(base[CLASS_CLASS_INDEX], qual, name);
        }

        if (notqual && name == "constructor")
        {
            return reflectclass(base[CONSTRUCTOR_INDEX]);
        }

        if (notqual && ctor.dynamic)
        {
            return undefined;
        }
        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);
        if (notqual && String(name) == "prototype")
        {
            return base.ecmaprototype;
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    return c1.staticvarvals.get(trait);
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const getter = trait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot read write-only property.");
                    }
                    return getter.exec.apply(undefined, []);
                }
                // method
                if (trait instanceof Method)
                {
                    let m = internedglobalfunctions.get(trait);
                    if (!m)
                    {
                        m = construct(functionclass);
                        m[FUNCTION_FUNCTION_INDEX] = trait.exec.bind(undefined);
                        internedglobalfunctions.set(trait, m);
                    }
                    return m;
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    return reflectnamespace(trait.ns);
                }
                throw new ReferenceError("Internal error");
            }
            c1 = c1.baseclass;
        }
        if (notqual && name == "constructor")
        {
            return reflectclass(classclass);
        }
        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        return qualincludespublic(qual) ? base[name] : undefined;
    }
    // Number
    if (typeof base == "number")
    {
        return getproperty([numberclass, untoucheddynamic, base], qual, name);
    }
    // Boolean
    if (typeof base == "boolean")
    {
        return getproperty([booleanclass, untoucheddynamic, base], qual, name);
    }
    // String
    if (typeof base == "string")
    {
        if (qualincludespublic(qual) && name == "length")
        {
            return base.length;
        }
        if (!isNaN(Number(name)) && Number(name) == name >> 0 && qualincludespublic(qual))
        {
            return base[name >> 0];
        }
        return getproperty([stringclass, untoucheddynamic, base], qual, name);
    }
    // Tuple
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot read property of tuple type.");
    }
    // null
    if (base === null)
    {
        throw new ReferenceError("Cannot read property of null.");
    }
    // undefined
    throw new ReferenceError("Cannot read property of undefined.");
}

/**
 * Assigns a value to a property.
 */
export function setproperty(base, qual, name, value)
{
    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            if (notqual)
            {
                base[name] = value;
            }
            return;
        }

        if (istype(base, xmlclass))
        {
            const children = (base[XML_NODE_INDEX]).childNodes;
            if (notqual && !isNaN(Number(name)) && name >>> 0 === Number(name))
            {
                if ((name >>> 0) >= children.length)
                {
                    throw new ReferenceError("Index " + (name >>> 0) + " out of bounds (length=" + children.length + ").");
                }
                const child = children[name >>> 0];
                (base[XML_NODE_INDEX]).insertBefore(call(xmlclass, value), child);
                (base[XML_NODE_INDEX]).removeChild(child);
                return;
            }
            else
            {
                throw new ReferenceError("Cannot assign to a XML tag.");
            }
        }

        if (istype(base, xmllistclass))
        {
            const children = base[XMLLIST_XMLARRAY_INDEX];
            if (notqual && !isNaN(Number(name)) && name >>> 0 === Number(name))
            {
                if ((name >>> 0) >= children.length)
                {
                    throw new ReferenceError("Index " + (name >>> 0) + " out of bounds (length=" + children.length + ").");
                }
                children[name >>> 0] = call(xmlclass, value);
                return;
            }
            else
            {
                throw new ReferenceError("Cannot assign value to a tag in XMLList.");
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            if (istypeinstantiatedfrom(ctor, mapclass))
            {
                const [keyType, valueType] = ctor.argumentslist;
                const mm = base[MAP_PROPERTIES_INDEX];
                if (mm instanceof WeakMap && !(name instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                name = coerceorfail(name, keyType, () => {
                    throw new TypeError("Expected key type " + nameoftype(keyType));
                });
                value = coerceorfail(value, valueType, () => {
                    throw new TypeError("Expected value type " + nameoftype(valueType));
                });
                mm.set(name, value);
                return;
            }

            if (istypeinstantiatedfrom(ctor, arrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const [elemType] = ctor.argumentslist;
                value = coerceorfail(value, elemType, () => {
                    throw new TypeError("Expected value of type " + nameoftype(elemType));
                });
                base[ARRAY_SUBARRAY_INDEX][name >> 0] = value;
                return;
            }
            if (istypeinstantiatedfrom(ctor, vectorclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const [elemType] = ctor.argumentslist;
                let i = name >> 0, arr = base[VECTOR_SUBARRAY_INDEX];
                if (i < 0 || i >= arr.length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + arr.length + ").");
                }
                if (arr instanceof FlexNumberVector)
                {
                    if (typeof value !== "number")
                    {
                        throw new TypeError("Cannot assign incompatible value.");
                    }
                    arr.set(i, value);
                    return;
                }
                value = coerceorfail(value, elemType, () => {
                    throw new TypeError("Expected value of type " + nameoftype(elemType));
                });
                arr[i] = value;
                return;
            }
            if (ctor instanceof TupleType)
            {
                throw new TypeError("Cannot assign to a tuple element.");
            }
            if (istype(base, bytearrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                let i = name >> 0;
                if (i < 0 || i >= base[BYTEARRAY_BA_INDEX].length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + base[BYTEARRAY_BA_INDEX].length + ").");
                }
                base[BYTEARRAY_BA_INDEX].set(i, value);
                return;
            }
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    if (itrait.readonly && typeof base[SLOT_FIXTURE_START + i] !== "undefined")
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    base[SLOT_FIXTURE_START + i] = coerceorfail(value, itrait.type, () => {
                        throw new TypeError("Cannot assign incompatible value.");
                    });
                    return;
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const setter = itrait.setter;
                    if (setter === null)
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    setter.exec.call(base, coerceorfail(value, itrait.type, () => {
                        throw new TypeError("Cannot assign incompatible value.");
                    }));
                    return;
                }
                // bound method
                if (itrait instanceof Method)
                {
                    throw new ReferenceError("Cannot assign to read-only method.");
                }
                if (itrait instanceof Nsalias)
                {
                    throw new ReferenceError("Cannot assign to read-only namespace.");
                }
                
                throw new ReferenceError("Internal error");
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            callproperty(base, whackproxyns, "setProperty", name, qn);
            return;
        }

        if (notqual && ctor.dynamic && base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
        {
            base[DYNAMIC_PROPERTIES_INDEX].set(String(name), value);
            return;
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            setproperty(base[CLASS_CLASS_INDEX], qual, name,value);
            return;
        }

        if (notqual && name == "constructor")
        {
            return;
        }

        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);
        if (notqual && String(name) == "prototype")
        {
            throw new ReferenceError("Cannot assign to read-only property 'prototype'.");
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    if (trait.readonly && c1.staticvarvals.has(trait))
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    c1.staticvarvals.set(trait, coerceorfail(value, trait.type, () => {
                        throw new TypeError("Cannot assign incompatible value.");
                    }));
                    return;
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const setter = trait.getter;
                    if (setter === null)
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    setter.exec.apply(undefined, [coerceorfail(value, trait.type, () => {
                        throw new TypeError("Cannot assign incompatible value.");
                    })]);
                    return;
                }
                // method
                if (trait instanceof Method)
                {
                    throw new TypeError("Cannot assign to read-only method.");
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    throw new TypeError("Cannot assign to read-only namespace.");
                }
                throw new ReferenceError("Internal error");
            }
            c1 = c1.baseclass;
        }
        if (notqual && name == "constructor")
        {
            return;
        }
        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        if (qualincludespublic(qual))
        {
            base[name] = value;
        }
        return;
    }
    // Number
    if (typeof base == "number")
    {
        setproperty([numberclass, untoucheddynamic, base], qual, name, value);
        return;
    }
    // Boolean
    if (typeof base == "boolean")
    {
        setproperty([booleanclass, untoucheddynamic, base], qual, name, value);
        return;
    }
    // String
    if (typeof base == "string")
    {
        setproperty([stringclass, untoucheddynamic, base], qual, name, value);
        return;
    }

    // Tuple
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot read property of tuple type.");
    }
    // null
    if (base === null)
    {
        throw new ReferenceError("Cannot read property of null.");
    }
    // undefined
    throw new ReferenceError("Cannot read property of undefined.");
}

/**
 * Deletes a property.
 */
export function deleteproperty(base, qual, name)
{
    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return notqual ? delete base[name] : false;
        }

        if (istype(base, xmlclass))
        {
            const m = [];
            const children = base[XML_NODE_INDEX].childNodes;
            if (notqual && !isNaN(Number(name)) && name >>> 0 === Number(name))
            {
                if ((name >>> 0) >= children.length)
                {
                    throw new ReferenceError("Index " + (name >>> 0) + " out of bounds (length=" + children.length + ").");
                }
                (base[XML_NODE_INDEX]).removeChild(children[name >>> 0]);
                return true;
            }
            else
            {
                let qualrefl = qual ? reflectnamespace(qual) : null;
                if (!qualrefl && name == "*")
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        m.push(children[i]);
                    }
                }
                else
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        const child = children[i];
                        if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, qualrefl, name))
                        {
                            m.push(child);
                        }
                    }
                }
                if (m.length != 0)
                {
                    for (const child of m)
                    {
                        child.remove();
                    }
                    return true;
                }
                return false;
            }
        }

        if (istype(base, xmllistclass))
        {
            const m = [];
            const children = base[XMLLIST_XMLARRAY_INDEX];
            if (notqual && !isNaN(Number(name)) && name >>> 0 === Number(name))
            {
                if ((name >>> 0) >= children.length)
                {
                    throw new ReferenceError("Index " + (name >>> 0) + " out of bounds (length=" + children.length + ").");
                }
                children.splice(name >>> 0, 1);
                return true;
            }
            else
            {
                let qualrefl = qual ? reflectnamespace(qual) : null;
                if (!qualrefl && name == "*")
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        m.push(i);
                    }
                }
                else
                {
                    for (let i = 0; i < children.length; i++)
                    {
                        const child = children[i][XML_NODE_INDEX];
                        if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, qualrefl, name))
                        {
                            m.push(i);
                        }
                    }
                }
                if (m.length != 0)
                {
                    m.reverse();
                    for (const i of m)
                    {
                        children.splice(i, 1);
                    }
                    return true;
                }
            }
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            if (istypeinstantiatedfrom(ctor, mapclass))
            {
                const mm = base[MAP_PROPERTIES_INDEX];
                if (mm instanceof WeakMap && !(name instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                return mm.delete(name);
            }

            if (ctor.dynamic && base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
            {
                return base[DYNAMIC_PROPERTIES_INDEX].delete(String(name));
            }

            // Delete collection properties (Array, Vector[$double|$float|$int|$uint], Map)

            if (istypeinstantiatedfrom(ctor, arrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                return delete base[ARRAY_SUBARRAY_INDEX][name >> 0];
            }
            if (istypeinstantiatedfrom(ctor, vectorclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                throw new TypeError("Cannot delete vector indices.");
            }
            if (ctor instanceof TupleType && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                throw new TypeError("Cannot delete tuple indices.");
            }
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                throw new TypeError("Cannot delete fixed property.");
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            return !!callproperty(base, whackproxyns, "deleteProperty", qn);
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return deleteproperty(base[CLASS_CLASS_INDEX], qual, name);
        }

        if (notqual && name == "constructor")
        {
            return false;
        }

        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);
        if (notqual && String(name) == "prototype")
        {
            throw new TypeError("Cannot delete property 'prototype'.");
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                throw new TypeError("Cannot delete fixed property.");
            }
            c1 = c1.baseclass;
        }

        if (notqual && name == "constructor")
        {
            return false;
        }

        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        return qualincludespublic(qual) ? delete base[name] : false;
    }
    // Number
    if (typeof base == "number")
    {
        return deleteproperty([numberclass, untoucheddynamic, base], qual, name);
    }
    // Boolean
    if (typeof base == "boolean")
    {
        return deleteproperty([booleanclass, untoucheddynamic, base], qual, name);
    }
    // String
    if (typeof base == "string")
    {
        return deleteproperty([stringclass, untoucheddynamic, base], qual, name);
    }
    // Tuple
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot delete property of tuple type.");
    }
    // null
    if (base === null)
    {
        throw new ReferenceError("Cannot delete property of null.");
    }
    // undefined
    throw new ReferenceError("Cannot delete property of undefined.");
}

/**
 * Calls a property.
 */
export function callproperty(base, qual, name, ...args)
{
    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            return notqual ? base[name].apply(base, args) : undefined;
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            if (ctor.dynamic)
            {
                if (base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
                {
                    return call(base[DYNAMIC_PROPERTIES_INDEX].get(String(name)), ...args);
                }
            }

            // Read collection properties (Array, Vector[$double|$float|$int|$uint], tuple)

            if (istypeinstantiatedfrom(ctor, arrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                return call(base[ARRAY_SUBARRAY_INDEX][name >> 0], ...args);
            }
            if (istypeinstantiatedfrom(ctor, vectorclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                let i = name >> 0, arr = base[VECTOR_SUBARRAY_INDEX];
                if (i < 0 || i >= arr.length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + arr.length + ").");
                }
                const el = arr instanceof FlexNumberVector ? arr.get(i) : arr[i];
                return call(el, ...args);
            }
            if (ctor instanceof TupleType && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                let i = name >> 0, l = ctor.elementtypes.length;
                if (i < 0 || i >= l)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + l + ").");
                }
                return call(base[2 + i], ...args);
            }
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    return call(base[SLOT_FIXTURE_START + i], ...args);
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const getter = itrait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot read write-only property.");
                    }
                    return call(getter.exec.call(base), ...args);
                }
                // bound method
                if (itrait instanceof Method)
                {
                    return itrait.exec.apply(base, args);
                }
                if (itrait instanceof Nsalias)
                {
                    throw new TypeError("Value is not a function.");
                }
                
                throw new ReferenceError("Internal error");
            }
            
            // instance ecmaprototype
            if (qualincludespublic(qual) && hasdynamicproperty(c1.ecmaprototype, String(name)))
            {
                return callboundfunctionorclass(getdynamicproperty(c1.ecmaprototype, String(name)), base, ...args);
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            return callproperty(base, whackproxyns, "callProperty", qn, ...args);
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return callproperty(base[CLASS_CLASS_INDEX], qual, name, ...args);
        }

        if (notqual && name == "constructor")
        {
            return call(reflectclass(base[CLASS_CLASS_INDEX]), ...args);
        }

        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);

        if (notqual && String(name) == "prototype")
        {
            return call(base.ecmaprototype, ...args);
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    return call(c1.staticvarvals.get(trait), ...args);
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const getter = trait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot read write-only property.");
                    }
                    return call(getter.exec.apply(undefined, []), ...args);
                }
                // method
                if (trait instanceof Method)
                {
                    return trait.exec.apply(undefined, []);
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    return call(reflectnamespace(trait.ns), ...args);
                }
                throw new ReferenceError("Internal error");
            }
            c1 = c1.baseclass;
        }
        if (notqual && name == "constructor")
        {
            return call(reflectclass(classclass), ...args);
        }
        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        return qualincludespublic(qual) ? base[name].apply(base, args) : undefined;
    }
    // Number
    if (typeof base == "number")
    {
        return callproperty([numberclass, untoucheddynamic, base], qual, name, ...args);
    }
    // Boolean
    if (typeof base == "boolean")
    {
        return callproperty([booleanclass, untoucheddynamic, base], qual, name, ...args);
    }
    // String
    if (typeof base == "string")
    {
        const notqual = qualincludespublic(qual);
        if (notqual)
        {
            if (name == "charAt")
            {
                return base.charAt(Number(args[0] ?? 0));
            }
            if (name == "charCodeAt")
            {
                return base.charCodeAt(Number(args[0] ?? 0));
            }
            if (name == "codePointAt")
            {
                return base.codePointAt(Number(args[0] ?? 0)) ?? 0;
            }
        }
        return callproperty([stringclass, untoucheddynamic, base], qual, name, ...args);
    }
    // Tuple
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot read property of tuple type.");
    }
    // null
    if (base === null)
    {
        throw new ReferenceError("Cannot read property of null.");
    }
    // undefined
    throw new ReferenceError("Cannot read property of undefined.");
}

export function preincrementproperty(base, qual, name)
{
    return preincreaseproperty(base, qual, name, 1);
}

export function predecrementproperty(base, qual, name)
{
    return preincreaseproperty(base, qual, name, -1);
}

export function postincrementproperty(base, qual, name)
{
    return postincreaseproperty(base, qual, name, 1);
}

export function postdecrementproperty(base, qual, name)
{
    return postincreaseproperty(base, qual, name, -1);
}

/**
 * Increases a number property by `incVal` and returns its new value.
 */
function preincreaseproperty(base, qual, name, incVal)
{
    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            if (notqual)
            {
                base[name] += incVal;
                return base[name];
            }
            return NaN;
        }
        if (istype(base, xmlclass))
        {
            throw new TypeError("Cannot increment or decrement a XML node.");
        }

        if (istype(base, xmllistclass))
        {
            throw new TypeError("Cannot increment or decrement a XML node.");
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            // Assign collection properties (Array, Vector[$double|$float|$int|$uint], Map)

            if (istypeinstantiatedfrom(ctor, arrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const arr = base[ARRAY_SUBARRAY_INDEX];
                if (typeof arr[name >> 0] !== "number")
                {
                    throw new TypeError("Cannot increment or decrement a non numeric value.");
                }
                arr[name >> 0] += incVal;
                return arr[name >> 0];
            }
            if (istypeinstantiatedfrom(ctor, vectorclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                let i = name >> 0;
                const arr = base[VECTOR_SUBARRAY_INDEX];
                if (i < 0 || i >= arr.length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + arr.length + ").");
                }
                if (arr instanceof FlexNumberVector)
                {
                    let v = arr.get(i) + incVal;
                    arr.set(i, v);
                    return v;
                }
                if (typeof arr[i] !== "number")
                {
                    throw new TypeError("Cannot increment or decrement a non numeric value.");
                }
                arr[i] += incVal;
                return arr[i];
            }
            if (istype(base, bytearrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const ba = base[BYTEARRAY_BA_INDEX];
                let i = name >> 0, l = ba.length;
                if (i < 0 || i >= l)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + l + ").");
                }
                let v = ba.get(i) + incVal;
                ba.set(i, v);
                return v;
            }
            if (istypeinstantiatedfrom(ctor, mapclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const mm = base[MAP_PROPERTIES_INDEX];
                if (mm instanceof WeakMap && !(name instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                let v = mm.get(name);
                if (typeof v !== "number")
                {
                    throw new TypeError("Cannot increment or decrement a non numeric value.");
                }
                v += incVal;
                mm.set(name, v);
                return v;
            }
            if (ctor instanceof TupleType)
            {
                throw new TypeError("Cannot update tuple elements.");
            }
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    if (itrait.readonly && typeof base[SLOT_FIXTURE_START + i] !== "undefined")
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    let v = base[SLOT_FIXTURE_START + i];
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    v += incVal;
                    v = coerce(v, itrait.type);
                    base[SLOT_FIXTURE_START + i] = v;
                    return v;
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const getter = itrait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a write-only property.");
                    }
                    const setter = itrait.setter;
                    if (setter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a read-only property.");
                    }
                    let v = getter.exec.call(base);
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    v += incVal;
                    v = coerce(v, itrait.type);
                    setter.exec.call(base, v);
                    return v;
                }
                // bound method
                if (itrait instanceof Method)
                {
                    throw new ReferenceError("Cannot increment or decrement from a method.");
                }
                if (itrait instanceof Nsalias)
                {
                    throw new ReferenceError("Cannot increment or decrement from a namespace.");
                }

                throw new ReferenceError("Internal error");
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            let v = callproperty(base, whackproxyns, "getProperty", qn);
            if (typeof v !== "number")
            {
                throw new TypeError("Cannot increment or decrement a non numeric value.");
            }
            v += incVal;
            callproperty(base, whackproxyns, "setProperty", qn, v);
            return v;
        }

        if (notqual && ctor.dynamic && base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
        {
            let v = base[DYNAMIC_PROPERTIES_INDEX].get(String(name));
            if (typeof v !== "number")
            {
                throw new TypeError("Cannot increment or decrement a non numeric value.");
            }
            v += incVal;
            base[DYNAMIC_PROPERTIES_INDEX].set(String(name), v);
            return v;
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return preincreaseproperty(base[CLASS_CLASS_INDEX], qual, name, incVal);
        }

        if (notqual && name == "constructor")
        {
            throw new ReferenceError("Cannot increment or decrement 'constructor'.");
        }

        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);
        if (notqual && String(name) == "prototype")
        {
            throw new ReferenceError("Cannot increment or decrement 'prototype'.");
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    if (trait.readonly && c1.staticvarvals.has(trait))
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    let v = c1.staticvarvals.get(trait);
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    v += incVal;
                    v = coerce(v, trait.type);
                    c1.staticvarvals.set(trait, v);
                    return v;
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const getter = trait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a write-only property.");
                    }
                    const setter = trait.setter;
                    if (setter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a read-only property.");
                    }
                    let v = getter.exec.call(base);
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    v += incVal;
                    v = coerce(v, trait.type);
                    setter.exec.call(base, v);
                    return v;
                }
                // method
                if (trait instanceof Method)
                {
                    throw new TypeError("Cannot increment or decrement from method.");
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    throw new TypeError("Cannot increment or decrement from namespace.");
                }
                throw new ReferenceError("Internal error");
            }
            c1 = c1.baseclass;
        }
        if (notqual && name == "constructor")
        {
            throw new ReferenceError("Cannot increment or decrement 'constructor'.");
        }
        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        if (qualincludespublic(qual))
        {
            base[name] += incVal;
            return base[name];
        }
        return NaN;
    }
    // Number
    if (typeof base == "number")
    {
        throw new TypeError("Cannot increment or decrement from a Number object.");
    }
    // Boolean
    if (typeof base == "boolean")
    {
        throw new TypeError("Cannot increment or decrement from a Boolean object.");
    }
    // String
    if (typeof base == "string")
    {
        throw new TypeError("Cannot increment or decrement from a String object.");
    }
    // Tuple
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot read property of tuple type.");
    }
    // null
    if (base === null)
    {
        throw new ReferenceError("Cannot read property of null.");
    }
    // undefined
    throw new ReferenceError("Cannot read property of undefined.");
}

/**
 * Increases a number property by `incVal` and returns its new value.
 */
function postincreaseproperty(base, qual, name, incVal)
{
    // instance
    if (base instanceof Array)
    {
        const notqual = qualincludespublic(qual);

        if (!(base[CONSTRUCTOR_INDEX] instanceof ActionCoreType))
        {
            if (notqual)
            {
                const v = base[name];
                base[name] += incVal;
                return v;
            }
            return NaN;
        }
        if (istype(base, xmlclass))
        {
            throw new TypeError("Cannot increment or decrement a XML node.");
        }

        if (istype(base, xmllistclass))
        {
            throw new TypeError("Cannot increment or decrement a XML node.");
        }

        const ctor = base[CONSTRUCTOR_INDEX];
        const isproxy = istype(base, proxyclass);

        if (notqual && !isproxy)
        {
            // Assign collection properties (Array, Vector[$double|$float|$int|$uint], Map)

            if (istypeinstantiatedfrom(ctor, arrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const arr = base[ARRAY_SUBARRAY_INDEX];
                const v = arr[name >> 0];
                if (typeof v !== "number")
                {
                    throw new TypeError("Cannot increment or decrement a non numeric value.");
                }
                arr[name >> 0] += incVal;
                return v;
            }
            if (istypeinstantiatedfrom(ctor, vectorclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                let i = name >> 0;
                const arr = base[VECTOR_SUBARRAY_INDEX];
                if (i < 0 || i >= arr.length)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + arr.length + ").");
                }
                if (arr instanceof FlexNumberVector)
                {
                    const v = arr.get(i);
                    arr.set(i, v + incVal);
                    return v;
                }
                const v = arr[i];
                if (typeof v !== "number")
                {
                    throw new TypeError("Cannot increment or decrement a non numeric value.");
                }
                arr[i] += incVal;
                return v;
            }
            if (istype(base, bytearrayclass) && !isNaN(Number(name)) && Number(name) == name >> 0)
            {
                const ba = base[BYTEARRAY_BA_INDEX];
                let i = name >> 0, l = ba.length;
                if (i < 0 || i >= l)
                {
                    throw new ReferenceError("Index " + i + " out of bounds (length=" + l + ").");
                }
                const v = ba.get(i);
                ba.set(i, v + incVal);
                return v;
            }
            if (istypeinstantiatedfrom(ctor, mapclass))
            {
                const mm = base[MAP_PROPERTIES_INDEX];
                if (mm instanceof WeakMap && !(name instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                let v = mm.get(name);
                if (typeof v !== "number")
                {
                    throw new TypeError("Cannot increment or decrement a non numeric value.");
                }
                mm.set(name, v + incVal);
                return v;
            }
            if (ctor instanceof TupleType)
            {
                throw new TypeError("Cannot update tuple elements.");
            }
        }

        // instance prototype
        let c1 = ctor;
        while (c1 !== null)
        {
            let itrait = c1.prototypenames.getname(qual, String(name));
            if (itrait)
            {
                // variable
                if (itrait instanceof Variable)
                {
                    const i = ctor.prototypevarslots.indexOf(itrait);
                    if (itrait.readonly && typeof base[SLOT_FIXTURE_START + i] !== "undefined")
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    let v = base[SLOT_FIXTURE_START + i];
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    base[SLOT_FIXTURE_START + i] = coerce(v + incVal, itrait.type);
                    return v;
                }
                // property accessor
                if (itrait instanceof VirtualVariable)
                {
                    const getter = itrait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a write-only property.");
                    }
                    const setter = itrait.setter;
                    if (setter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a read-only property.");
                    }
                    let v = getter.exec.call(base);
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    setter.exec.call(base, coerce(v + incVal, itrait.type));
                    return v;
                }
                // bound method
                if (itrait instanceof Method)
                {
                    throw new ReferenceError("Cannot increment or decrement from a method.");
                }
                if (itrait instanceof Nsalias)
                {
                    throw new ReferenceError("Cannot increment or decrement from a namespace.");
                }
                
                throw new ReferenceError("Internal error");
            }

            c1 = c1.baseclass;
        }

        if (isproxy)
        {
            const qn = notqual ? name : construct(qnameclass, reflectnamespace(qual), name);
            let v = callproperty(base, whackproxyns, "getProperty", qn);
            if (typeof v !== "number")
            {
                throw new TypeError("Cannot increment or decrement a non numeric value.");
            }
            callproperty(base, whackproxyns, "setProperty", qn, v + incVal);
            return v;
        }

        if (notqual && ctor.dynamic && base[DYNAMIC_PROPERTIES_INDEX].has(String(name)))
        {
            let v = base[DYNAMIC_PROPERTIES_INDEX].get(String(name));
            if (typeof v !== "number")
            {
                throw new TypeError("Cannot increment or decrement a non numeric value.");
            }
            base[DYNAMIC_PROPERTIES_INDEX].set(String(name), v + incVal);
            return v;
        }

        // Read the "Class" object's class properties
        if (istype(base, classclass))
        {
            return postincreaseproperty(base[CLASS_CLASS_INDEX], qual, name, incVal);
        }

        if (notqual && name == "constructor")
        {
            throw new ReferenceError("Cannot increment or decrement 'constructor'.");
        }

        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    // class static
    if (base instanceof Class || base instanceof SpecialTypeAfterSub)
    {
        const notqual = qualincludespublic(qual);
        if (notqual && String(name) == "prototype")
        {
            throw new ReferenceError("Cannot increment or decrement 'prototype'.");
        }
        let c1 = base;
        while (c1 !== null)
        {
            const trait = c1.staticnames.getname(qual, name);
            if (trait)
            {
                // variable
                if (trait instanceof Variable)
                {
                    if (trait.readonly && c1.staticvarvals.has(trait))
                    {
                        throw new ReferenceError("Cannot assign to read-only property.");
                    }
                    let v = c1.staticvarvals.get(trait);
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    c1.staticvarvals.set(trait, coerce(v + incVal, trait.type));
                    return v;
                }
                // property accessor
                if (trait instanceof VirtualVariable)
                {
                    const getter = trait.getter;
                    if (getter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a write-only property.");
                    }
                    const setter = trait.setter;
                    if (setter === null)
                    {
                        throw new ReferenceError("Cannot increment or decrement a read-only property.");
                    }
                    let v = getter.exec.call(base);
                    if (typeof v !== "number")
                    {
                        throw new TypeError("Cannot increment or decrement a non numeric value.");
                    }
                    setter.exec.call(base, coerce(v + incVal, trait.type));
                    return v;
                }
                // method
                if (trait instanceof Method)
                {
                    throw new TypeError("Cannot increment or decrement from method.");
                }
                // namespace
                if (trait instanceof Nsalias)
                {
                    throw new TypeError("Cannot increment or decrement from namespace.");
                }
                throw new ReferenceError("Internal error");
            }
            c1 = c1.baseclass;
        }
        if (notqual && name == "constructor")
        {
            throw new ReferenceError("Cannot increment or decrement 'constructor'.");
        }
        throw new ReferenceError("Access of undefined property " + name + ".");
    }
    if (typeof base === "object" || typeof base === "symbol")
    {
        if (qualincludespublic(qual))
        {
            const v = base[name];
            base[name] += incVal;
            return v;
        }
        return NaN;
    }
    // Number
    if (typeof base == "number")
    {
        throw new TypeError("Cannot increment or decrement from a Number object.");
    }
    // Boolean
    if (typeof base == "boolean")
    {
        throw new TypeError("Cannot increment or decrement from a Boolean object.");
    }
    // String
    if (typeof base == "string")
    {
        throw new TypeError("Cannot increment or decrement from a String object.");
    }
    // Tuple
    if (base instanceof TupleType)
    {
        throw new ReferenceError("Cannot read property of tuple type.");
    }
    // null
    if (base === null)
    {
        throw new ReferenceError("Cannot read property of null.");
    }
    // undefined
    throw new ReferenceError("Cannot read property of undefined.");
}

export function call(obj, ...args)
{
    if ((obj instanceof Array && !(obj[CONSTRUCTOR_INDEX] instanceof ActionCoreType)) || typeof obj == "function")
    {
        return obj(...args);
    }
    if (istype(obj, functionclass))
    {
        return obj[FUNCTION_FUNCTION_INDEX](...args);
    }
    else if (istype(obj, classclass))
    {
        const classobj = obj[CLASS_CLASS_INDEX];
        if (classobj === dateclass)
        {
            return classobj(...args.slice(0, 7));
        }
        if (istypeinstantiatedfrom(classobj, arrayclass))
        {
            return construct(classobj, ...args);
        }
        if (classobj === booleanclass || classobj === stringclass || numberclasses.indexOf(classobj) !== -1)
        {
            return construct(classobj, args[0]);
        }
        if (classobj === xmlclass && !istype(args[0], xmlclass))
        {
            if (istype(args[0], xmllistclass))
            {
                const nodes = args[0][XMLLIST_XMLARRAY_INDEX];
                if (nodes.length != 1)
                {
                    throw new TypeError("Invalid XML() argument.");
                }
                return nodes[0];
            }
            return construct(xmlclass, args[0]);
        }
        if (classobj === xmllistclass && !istype(args[0], xmllistclass))
        {
            if (istype(args[0], xmlclass))
            {
                return [xmlclass, new Map(), [args[0]]];
            }
            return construct(xmllistclass, args[0]);
        }
        if (istypeinstantiatedfrom(classobj, vectorclass))
        {
            if (args.length == 1 && typeof args[0] == "number")
            {
                return construct(classobj, args[0]);
            }
            throw new TypeError("Incorrect call to the Vector() class.");
        }
        const arg = args[0];
        if (istype(arg, classobj))
        {
            return arg;
        }
        throw new TypeError("Could not cast value to " + classobj.name + ".");
    }
    else
    {
        throw new TypeError("Value is not a function.");
    }
}

function callboundfunctionorclass(obj, thisreceiver, ...args)
{
    if (istype(obj, functionclass))
    {
        return obj[FUNCTION_FUNCTION_INDEX].apply(thisreceiver, args);
    }
    else if (istype(obj, classclass))
    {
        const classobj = obj[CLASS_CLASS_INDEX];
        if (classobj === dateclass)
        {
            return classobj(...args.slice(0, 7));
        }
        if (istypeinstantiatedfrom(classobj, arrayclass))
        {
            return construct(classobj, args[0] ?? 0);
        }
        const arg = args[0];
        return istype(arg, classobj) ? arg : null;
    }
    else
    {
        throw new TypeError("Value is not a function.");
    }
}

export function getdynamicproperty(base, name)
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX];
    return (base[DYNAMIC_PROPERTIES_INDEX]).get(name);
}

export function setdynamicproperty(base, name, value)
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX];
    (base[DYNAMIC_PROPERTIES_INDEX]).set(name, value);
}

export function deletedynamicproperty(base, name)
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX];
    return (base[DYNAMIC_PROPERTIES_INDEX]).delete(name);
}

export function hasdynamicproperty(base, name)
{
    assert(base instanceof Array);
    const ctor = base[CONSTRUCTOR_INDEX];
    return (base[DYNAMIC_PROPERTIES_INDEX]).has(name);
}

/**
 * Checks whether a value is of a type, or null or undefined according to the given type.
 */
export function istypeornull(value, type)
{
    return istype(value, type) || (value === null && nonnullableclasses.indexOf(type) === -1) || (type === objectclass && value === undefined);
}

/**
 * Checks for `v is T`.
 */
export function istype(value, type)
{
    if (type === null)
    {
        return true;
    }

    // type = null = *
    // type = [object Class] = a class
    // type = [object Interface] = an interface
    if (type instanceof Array && type[CONSTRUCTOR_INDEX] === classclass)
    {
        type = type[CLASS_CLASS_INDEX];
    }

    if (value instanceof Array)
    {
        const instanceClass = value[CONSTRUCTOR_INDEX];
        if (!(instanceClass instanceof ActionCoreType))
        {
            return value instanceof type;
        }

        if (type instanceof Interface)
        {
            const targetItrfcs = type.recursivedescinterfacelist();
            const instanceClasses = instanceClass.recursivedescclasslist();
            for (const class1 of instanceClasses)
            {
                for (const itrfc of class1.interfaces)
                {
                    if (itrfc.issubtypeof(type))
                    {
                        return true;
                    }
                }
            }
        }

        return instanceClass.issubtypeof(type);
    }
    else if (typeof value == "object" || typeof value == "symbol")
    {
        if (typeof type !== "function")
        {
            return false;
        }
        return value instanceof type;
    }

    if (type instanceof Class)
    {
        return (
            (typeof value === "number" && (numberclasses.indexOf(type) !== -1) || type === objectclass) ||
            (typeof value === "string" && (type == stringclass || type === objectclass)) ||
            (typeof value === "boolean" && (type == booleanclass || type === objectclass))
        );
    }

    return false;
}

const m_coercionDataView = new DataView(new ArrayBuffer(32));

/**
 * Performs implicit coercion.
 */
export function coerce(value, type)
{
    if (!istype(value, type))
    {
        if (type instanceof Class)
        {
            return (
                type === objectclass && typeof value === "undefined" ? undefined :
                floatclasses.indexOf(type) !== -1 ? NaN :
                integerclasses.indexOf(type) !== -1 ? 0 :
                type === booleanclass ? false : null
            );
        }
        return null;
    }
    if (numberclasses.indexOf(type) !== -1)
    {
        switch (type)
        {
            case floatclass:
                m_coercionDataView.setFloat32(0, value);
                value = m_coercionDataView.getFloat32(0);
                return value;
            case numberclass:
                return Number(value);
            case intclass:
                m_coercionDataView.setInt32(0, value);
                value = m_coercionDataView.getInt32(0);
                return value;
            case uintclass:
                m_coercionDataView.setUint32(0, value);
                value = m_coercionDataView.getUint32(0);
                return value;
        }
    }
    return value;
}

export function coerceorfail(value, type, failureCallback)
{
    if (!istype(value, type))
    {
        if (value === null && nonnullableclasses.indexOf(type) === -1)
        {
            return null;
        }
        if (value === undefined && (type === objectclass || nonnullableclasses.indexOf(type) == -1))
        {
            return type === objectclass ? undefined : null;
        }
        failureCallback();
        throw new TypeError("Implicit coercion to " + nameoftype(type) + " failed.");
    }
    if (numberclasses.indexOf(type) !== -1)
    {
        switch (type)
        {
            case floatclass:
                m_coercionDataView.setFloat32(0, value);
                value = m_coercionDataView.getFloat32(0);
                return value;
            case numberclass:
                return Number(value);
            case intclass:
                m_coercionDataView.setInt32(0, value);
                value = m_coercionDataView.getInt32(0);
                return value;
            case uintclass:
                m_coercionDataView.setUint32(0, value);
                value = m_coercionDataView.getUint32(0);
                return value;
        }
    }
    return value;
}

/**
 * Constructs an ActionScript class.
 */
export function construct(classobj, ...args)
{
    if (typeof classobj == "function") {
        return new classobj(...args);
    }
    if (classobj instanceof Array && istype(classobj, classclass))
    {
        classobj = classobj[CLASS_CLASS_INDEX];
    }
    if (!(classobj instanceof Class || classobj instanceof SpecialTypeAfterSub))
    {
        throw new TypeError("Constructor must be a Class object.");
    }
    switch (classobj)
    {
        case numberclass:
            return args.length == 0 ? NaN : Number(args[0]);
        case floatclass:
            m_coercionDataView.setFloat32(0, Number(args[0]));
            return m_coercionDataView.getFloat32(0);
        case intclass:
            return args.length == 0 ? 0 : args[0] >> 0;
        case uintclass:
            return args.length == 0 ? 0 : args[0] >>> 0;
        case booleanclass:
            return args.length == 0 ? false : !!args[0];
        case stringclass:
            return args.length == 0 ? "" : tostring(args[0]);
    }
    if (classobj === arrayclass || classobj === vectorclass || classobj === mapclass)
    {
        throw new TypeError("Constructor is a parameterized type and requires type arguments.");
    }
    const instance = [classobj, new Map()];
    classobj.ctor.apply(instance, args);
    return instance;
}

/**
 * Converts an argument to a string.
 */
export function tostring(arg)
{
    if (typeof arg == "string")
    {
        return arg;
    }
    if (typeof arg == "number" || typeof arg == "boolean" || typeof arg == "undefined" || arg === null)
    {
        return String(arg);
    }
    if (!hasmethod(arg, null, "toString"))
    {
        return tostring_objimpl(arg);
    }
    return String(callproperty(arg, null, "toString"));
}

function tostring_objimpl(arg)
{
    const ctor = arg[CONSTRUCTOR_INDEX];

    // Tuple returns a comma-separated list of elements
    if (ctor instanceof TupleType)
    {
        return arg.slice(2).map(v => tostring(v)).join(",");
    }
    // Other types print [object f.q.N] by default
    if (arg instanceof Array && ctor instanceof ActionCoreType)
    {
        return "[object " + ctor.name + "]";
    }
    return String(arg);
}

class ArgumentError extends Error
{
    constructor(message)
    {
        super(message);
    }
}

const __AS3__err_Symbol = Symbol("__AS3__err");

export function fromjserror(error)
{
    if (error instanceof Error)
    {
        const k = error[__AS3__err_Symbol];
        if (k)
        {
            return k;
        }
        const errname = error.name;
        if ((error instanceof AggregateError || errname == "AggregateError") && error.errors instanceof Array)
        {
            return [aggregateerrorclass, new Map(), error, error.errors.map(e => fromjserror(e))];
        }
        const ctor = errname == "SyntaxError" ? syntaxerrorclass :
            errname == "ReferenceError" ? referenceerrorclass :
            errname == "TypeError" ? typeerrorclass :
            errname == "ArgumentError" ? argumenterrorclass :
            errname == "RangeError" ? rangeerrorclass :
            errname == "URIError" ? urierrorclass :
            errname == "EvalError" ? evalerrorclass : errorclass;
        return [ctor, new Map(), error];
    }
    else
    {
        return error;
    }
}

export function tojserror(error)
{
    if (istype(error, errorclass))
    {
        if (istype(error, aggregateerrorclass))
        {
            const obj = error[ERROR_ERROR_INDEX];
            obj.name = error[CONSTRUCTOR_INDEX].name;
            obj.errors = error[AGGREGATEERROR_ERRORS_INDEX].map(e => tojserror(e));
            obj[__AS3__err_Symbol] = error;
            return obj;
        }
        const obj = error[ERROR_ERROR_INDEX];
        obj.name = error[CONSTRUCTOR_INDEX].name;
        obj[__AS3__err_Symbol] = error;
        return obj;
    }
    return type;
}

function randomHexID()
{
    return (Math.random() * 16).toString(16).replace(".", "").slice(0, 5);
}

/**
 * The `AS3` namespace.
 */
export const as3ns = userns("http://whack.net/AS3/2024/builtin");

/**
 * The `whack_proxy` namespace.
 */
export const whackproxyns = userns("http://whack.net/2024/actionscript/whack/proxy");

/**
 * The `JSBridgeFrom` namespace.
 */
export const jsbridgefromns = userns("http://whack.net/js/bridge/from");

/**
 * The `JSBridgeTo` namespace.
 */
export const jsbridgetons = userns("http://whack.net/js/bridge/to");

// ----- Globals -----

let $publicns = packagens("");

definevar($publicns, "undefined", {
    type: null,
    readonly: true,
});

definemethod($publicns, "isXMLName", {
    exec(str)
    {
        return isXMLName(str);
    }
});

export function isarray(arg)
{
    if (arg instanceof Array)
    {
        return istypeinstantiatedfrom(arg[CONSTRUCTOR_INDEX], arrayclass);
    }
    return false;
}

definemethod($publicns, "isArray", {
    exec: isarray,
});

export function ismap(arg)
{
    if (arg instanceof Array)
    {
        return istypeinstantiatedfrom(arg[CONSTRUCTOR_INDEX], mapclass);
    }
    return false;
}

definemethod($publicns, "isMap", {
    exec: ismap,
});

export function isvector(arg)
{
    if (arg instanceof Array)
    {
        return istypeinstantiatedfrom(arg[CONSTRUCTOR_INDEX], vectorclass);
    }
    return false;
}

definemethod($publicns, "isVector", {
    exec: isvector,
});

export const objectclass = defineclass(name($publicns, "Object"),
    {
        dynamic: true,
    },
    []
);

export const NUMBER_VALUE_INDEX = 2;
export const numberclass = defineclass(name($publicns, "Number"),
    {
        final: true,

        ctor()
        {
            this[NUMBER_VALUE_INDEX] = 0;
        },
    },
    [
        [name(as3ns, "toExponential"), method(
        {
            exec(fractionDigits)
            {
                return (this[NUMBER_VALUE_INDEX]).toExponential(fractionDigits);
            },
        })],
        [name(as3ns, "toFixed"), method(
        {
            exec(fractionDigits)
            {
                return (this[NUMBER_VALUE_INDEX]).toFixed(fractionDigits);
            },
        })],
        [name(as3ns, "toPrecision"), method(
        {
            exec(precision)
            {
                return (this[NUMBER_VALUE_INDEX]).toPrecision(precision);
            },
        })],
        [name(as3ns, "toString"), method(
        {
            exec(radix = 10)
            {
                return (this[NUMBER_VALUE_INDEX]).toString(radix);
            },
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this[NUMBER_VALUE_INDEX];
            },
        })],
    ]
);

definevar($publicns, "NaN", {
    type: numberclass,
    readonly: true,
});

definevar($publicns, "Infinity", {
    type: numberclass,
    readonly: true,
});

export const INT_VALUE_INDEX = 2;
export const intclass = defineclass(name($publicns, "int"),
    {
        final: true,

        ctor()
        {
            this[INT_VALUE_INDEX] = 0;
        },
    },
    [
    ]
);

export const UINT_VALUE_INDEX = 2;
export const uintclass = defineclass(name($publicns, "uint"),
    {
        final: true,

        ctor()
        {
            this[UINT_VALUE_INDEX] = 0;
        },
    },
    [
    ]
);

export const FLOAT_VALUE_INDEX = 2;
export const floatclass = defineclass(name($publicns, "float"),
    {
        final: true,

        ctor()
        {
            this[FLOAT_VALUE_INDEX] = 0;
        },
    },
    [
    ]
);

export const numberclasses = [numberclass, intclass, uintclass, floatclass];
export const floatclasses = [numberclass, floatclass];
export const integerclasses = [intclass, uintclass];

export const BOOLEAN_VALUE_INDEX = 2;
export const booleanclass = defineclass(name($publicns, "Boolean"),
    {
        final: true,

        ctor()
        {
            this[BOOLEAN_VALUE_INDEX] = true;
        },
    },
    [
        [name(as3ns, "toString"), method(
        {
            exec()
            {
                return (this[BOOLEAN_VALUE_INDEX]).toString();
            },
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this[BOOLEAN_VALUE_INDEX];
            },
        })],
    ]
);

export const STRING_VALUE_INDEX = 2;
export const stringclass = defineclass(name($publicns, "String"),
    {
        final: true,

        ctor()
        {
            this[STRING_VALUE_INDEX] = "";
        },
    },
    [
        [name($publicns, "length"), virtualvar(
        {
            type: intclass,
            getter: method(
            {
                exec()
                {
                    return (this[STRING_VALUE_INDEX]).length;
                },
            }),
            setter: null,
        })],
        [name(as3ns, "charAt"), method(
        {
            exec(index = 0)
            {
                return (this[STRING_VALUE_INDEX]).charAt(index);
            },
        })],
        [name(as3ns, "charCodeAt"), method(
        {
            exec(index = 0)
            {
                return (this[STRING_VALUE_INDEX]).charCodeAt(index);
            },
        })],
        [name(as3ns, "codePointAt"), method(
        {
            exec(index = 0)
            {
                return (this[STRING_VALUE_INDEX]).codePointAt(index) ?? 0;
            },
        })],
        [name(as3ns, "concat"), method(
        {
            exec(...args)
            {
                return (this[STRING_VALUE_INDEX]).concat(...args.map(a => tostring(a)));
            },
        })],
        [name(as3ns, "endsWith"), method(
        {
            exec(other)
            {
                return (this[STRING_VALUE_INDEX]).endsWith(tostring(other));
            },
        })],
        [name(as3ns, "fromCharCode"), method(
        {
            static: true,
            exec(...charCodes)
            {
                return String.fromCharCode(...charCodes);
            },
        })],
        [name(as3ns, "fromCodePoint"), method(
        {
            static: true,
            exec(...codePoints)
            {
                return String.fromCodePoint(...codePoints);
            },
        })],
        [name(as3ns, "indexOf"), method(
        {
            exec(val, startIndex = 0)
            {
                return (this[STRING_VALUE_INDEX]).indexOf(val, startIndex);
            },
        })],
        [name(as3ns, "lastIndexOf"), method(
        {
            exec(val, startIndex = 0)
            {
                return (this[STRING_VALUE_INDEX]).lastIndexOf(val, startIndex);
            },
        })],
        [name(as3ns, "localeCompare"), method(
        {
            exec(other, ...values)
            {
                return (this[STRING_VALUE_INDEX]).localeCompare(other, ...values);
            },
        })],
        [name(as3ns, "match"), method(
        {
            exec(pattern)
            {
                if (istype(pattern, regexpclass))
                {
                    pattern = pattern[REGEXP_REGEXP_INDEX];
                }
                else
                {
                    pattern = tostring(pattern);
                }
                const r1 = (this[STRING_VALUE_INDEX]).match(pattern);
                if (r1 === null)
                {
                    return null;
                }
                const r = [applytype(arrayclass, [null]), new Map(), r1];
                setdynamicproperty(r, "index", r1.index);
                setdynamicproperty(r, "input", r1.input);
                return r;
            },
        })],
        [name(as3ns, "replace"), method(
        {
            exec(pattern, repl)
            {
                if (istype(pattern, regexpclass))
                {
                    pattern = pattern[REGEXP_REGEXP_INDEX];
                }
                else
                {
                    pattern = tostring(pattern);
                }

                if (istype(repl, functionclass))
                {
                    repl = repl[FUNCTION_FUNCTION_INDEX];
                }
                else
                {
                    repl = tostring(repl);
                }

                return (this[STRING_VALUE_INDEX]).replace(pattern, repl);
            },
        })],
        [name(as3ns, "search"), method(
        {
            exec(pattern)
            {
                if (istype(pattern, regexpclass))
                {
                    pattern = pattern[REGEXP_REGEXP_INDEX];
                }
                else
                {
                    pattern = tostring(pattern);
                }

                return (this[STRING_VALUE_INDEX]).search(pattern);
            },
        })],
        [name(as3ns, "slice"), method(
        {
            exec(startIndex = 0, endIndex = 0x7FFFFFFF)
            {
                startIndex = startIndex ?? 0;
                endIndex = endIndex ?? 0x7FFFFFFF;
                return this[STRING_VALUE_INDEX].slice(startIndex, endIndex);
            },
        })],
        [name(as3ns, "split"), method(
        {
            exec(delimiter, limit = 0x7FFFFFFF)
            {
                if (istype(delimiter, regexpclass))
                {
                    delimiter = delimiter[REGEXP_REGEXP_INDEX];
                }
                else
                {
                    delimiter = tostring(delimiter);
                }
                limit = limit ?? 0x7FFFFFFF;
                const r1 = (this[STRING_VALUE_INDEX]).split(delimiter, limit);
                return [applytype(arrayclass, [stringclass]), new Map(), r1];
            },
        })],
        [name(as3ns, "startsWith"), method(
        {
            exec(other)
            {
                return (this[STRING_VALUE_INDEX]).startsWith(tostring(other));
            },
        })],
        [name(as3ns, "substr"), method(
        {
            exec(startIndex = 0, length = 0x7FFFFFFF)
            {
                startIndex = startIndex ?? 0;
                length = length ?? 0x7FFFFFFF;
                return (this[STRING_VALUE_INDEX]).substr(startIndex, length);
            },
        })],
        [name(as3ns, "substring"), method(
        {
            exec(startIndex = 0, endIndex = 0x7FFFFFFF)
            {
                startIndex = startIndex ?? 0;
                endIndex = endIndex ?? 0x7FFFFFFF;
                return (this[STRING_VALUE_INDEX]).substring(startIndex, endIndex);
            },
        })],
        [name(as3ns, "toLocaleLowerCase"), method(
        {
            exec()
            {
                return (this[STRING_VALUE_INDEX]).toLocaleLowerCase();
            },
        })],
        [name(as3ns, "toLocaleUpperCase"), method(
        {
            exec()
            {
                return (this[STRING_VALUE_INDEX]).toLocaleUpperCase();
            },
        })],
        [name(as3ns, "toLowerCase"), method(
        {
            exec()
            {
                return (this[STRING_VALUE_INDEX]).toLowerCase();
            },
        })],
        [name(as3ns, "toUpperCase"), method(
        {
            exec()
            {
                return (this[STRING_VALUE_INDEX]).toUpperCase();
            },
        })],
        [name(as3ns, "trim"), method(
        {
            exec()
            {
                return this[STRING_VALUE_INDEX].trim();
            },
        })],
        [name(as3ns, "trimStart"), method(
        {
            exec()
            {
                return this[STRING_VALUE_INDEX].trimStart();
            },
        })],
        [name(as3ns, "trimEnd"), method(
        {
            exec()
            {
                return this[STRING_VALUE_INDEX].trimEnd();
            },
        })],
        [name(as3ns, "trimLeft"), method(
        {
            exec()
            {
                return this[STRING_VALUE_INDEX].trimLeft();
            },
        })],
        [name(as3ns, "trimRight"), method(
        {
            exec()
            {
                return this[STRING_VALUE_INDEX].trimRight();
            },
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this[STRING_VALUE_INDEX];
            },
        })],
    ]
);

export const NAMESPACE_PREFIX_INDEX = 2; // prefix:String
export const NAMESPACE_URI_INDEX = 3; // uri:String
export const namespaceclass = defineclass(name($publicns, "Namespace"),
    {
        final: true,

        // Namespace(uri:*)
        // Namespace(prefix:*, uri:*)
        ctor(arg1, arg2 = undefined)
        {
            this[NAMESPACE_PREFIX_INDEX] =
            this[NAMESPACE_URI_INDEX] = "";

            if (typeof arg2 === "undefined")
            {
                if (istype(arg1, namespaceclass))
                {
                    this[NAMESPACE_URI_INDEX] = arg1[NAMESPACE_URI_INDEX];
                }
                else if (istype(arg1, qnameclass))
                {
                    this[NAMESPACE_URI_INDEX] = arg1[QNAME_URI_INDEX];
                }
                else
                {
                    this[NAMESPACE_URI_INDEX] = tostring(arg1);
                }
            }
            else
            {
                // arg1 = prefixValue
                if (typeof arg1 === "undefined" || !isXMLName(arg1))
                {
                    this[NAMESPACE_PREFIX_INDEX] = "undefined";
                }
                else
                {
                    this[NAMESPACE_PREFIX_INDEX] = tostring(arg1);
                }

                // arg2 = uriValue
                if (istype(arg2, qnameclass))
                {
                    this[NAMESPACE_URI_INDEX] = arg2[QNAME_URI_INDEX];
                }
                else
                {
                    this[NAMESPACE_URI_INDEX] = tostring(arg2);
                }
            }
        },
    },
    [
        [name($publicns, "prefix"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return this[NAMESPACE_PREFIX_INDEX];
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    this[NAMESPACE_PREFIX_INDEX] = tostring(value);
                },
            }),
        })],
        [name($publicns, "uri"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return this[NAMESPACE_URI_INDEX];
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    this[NAMESPACE_URI_INDEX] = tostring(value);
                },
            }),
        })],
        [name(as3ns, "toString"), method(
        {
            exec()
            {
                return this[NAMESPACE_URI_INDEX];
            },
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this[NAMESPACE_URI_INDEX];
            },
        })],
    ]
);

const nonnullableclasses = [booleanclass, numberclass, floatclass, intclass, uintclass];

const internedclassobjs = new Map();

/**
 * Returns a `Class` object for a class or interface.
 */
export function reflectclass(type)
{
    if (type === null)
    {
        return null;
    }
    if (!(type instanceof ActionCoreType))
    {
        throw new TypeError("Cannot reflect a value as a Class object.");
    }
    let obj = internedclassobjs.get(type);
    if (!obj)
    {
        obj = [classclass, new Map(), type];
        internedclassobjs.set(type, obj);
    }
    return obj;
}

/**
 * Either construct a `Namespace` object from an ActionScript namespace or return the same specified `Namespace`.
 * If the passed `ns` parameter is a namespace set, then the function returns `null`.
 */
export function reflectnamespace(ns)
{
    if (ns instanceof Array)
    {
        // Namespace set results into null.
        return istype(ns, namespaceclass) ? ns : null;
    }
    let uri = ns instanceof Systemns ? "" : ns instanceof Userns ? ns.uri : ns.uri;
    if (ns instanceof Systemns)
    {
        let p = ns.parent instanceof Package ? ns.parent.name : ns.parent instanceof ActionCoreType ? ns.parent.name : "";
        uri = p + "$" + randomHexID();
    }
    return construct(namespaceclass, uri);
}

export const QNAME_URI_INDEX = 2; // uri:String?
export const QNAME_LOCALNAME_INDEX = 3; // localName:String
export const qnameclass = defineclass(name($publicns, "QName"),
    {
        final: true,

        // QName(qname:*)
        // QName(uri:*, localName:*)
        ctor(arg1, arg2 = undefined)
        {
            this[QNAME_URI_INDEX] = null;
            this[QNAME_LOCALNAME_INDEX] = "";

            // QName(qname:*)
            if (typeof arg2 === "undefined" || arg2 === null)
            {
                if (typeof arg1 === "undefined")
                {
                    this[QNAME_LOCALNAME_INDEX] = "";
                }
                else if (istype(arg1, qnameclass))
                {
                    this[QNAME_URI_INDEX] = arg1[QNAME_URI_INDEX];
                    this[QNAME_LOCALNAME_INDEX] = arg1[QNAME_LOCALNAME_INDEX];
                }
                else
                {
                    this[QNAME_LOCALNAME_INDEX] = tostring(arg1);
                }
            }
            // QName(uri:*, localName:*)
            else
            {
                if (typeof arg1 !== "undefined" && arg1 !== null)
                {
                    if (istype(arg1, namespaceclass))
                    {
                        this[QNAME_URI_INDEX] = arg1[NAMESPACE_URI_INDEX];
                    }
                    else
                    {
                        this[QNAME_URI_INDEX] = tostring(arg1);
                    }
                }

                if (istype(arg2, qnameclass))
                {
                    this[QNAME_LOCALNAME_INDEX] = arg2[QNAME_LOCALNAME_INDEX];
                }
                else
                {
                    this[QNAME_LOCALNAME_INDEX] = tostring(arg2);
                }
            }
        },
    },
    [
        [name($publicns, "localName"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return this[QNAME_LOCALNAME_INDEX];
                },
            }),
            setter: null,
        })],
        [name($publicns, "uri"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return this[QNAME_URI_INDEX];
                },
            }),
            setter: null,
        })],
        [name(as3ns, "toString"), method(
        {
            exec()
            {
                const uri = this[QNAME_URI_INDEX];
                const localName = this[QNAME_LOCALNAME_INDEX];
                return uri === "" ? localName : uri === null ? "*::" + localName : uri + "::" + localName;
            },
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this;
            },
        })],
    ]
);

export const XML_NODE_INDEX = 2; // a XMLDOM Node
export const xmlclass = defineclass(name($publicns, "XML"),
    {
        final: true,

        ctor(value)
        {
            if (typeof value === "number" || typeof value === "boolean")
            {
                value = String(value);
            }
            else if (typeof value === "string")
            {
            }
            else if (value === null || typeof value === "undefined")
            {
                throw new TypeError("Invalid XML() argument.");
            }
            const node = new DOMParser().parseFromString(tostring(value), "text/xml");
            this[XML_NODE_INDEX] = node;
            w3cnodetoe4xnodemapping.set(node, this);
        },
    },
    [
        [name(as3ns, "appendChild"), method(
        {
            exec(child)
            {
                const thisNode = this[XML_NODE_INDEX];
                if (istype(child, xmlclass))
                {
                    thisNode.appendChild(w3cnodeexitdoc(child[XML_NODE_INDEX]));
                }
                else if (istype(child, xmllistclass))
                {
                    for (const newChild of child[XMLLIST_XMLARRAY_INDEX])
                    {
                        thisNode.appendChild(w3cnodeexitdoc(newChild[XML_NODE_INDEX]));
                    }
                }
                else
                {
                    thisNode.appendChild(w3cnodeexitdoc(call(xmlclass, tostring(child))[XML_NODE_INDEX]));
                }
                return this;
            },
        })],
        [name(as3ns, "attribute"), method(
        {
            exec(attributeName)
            {
                const thisNode = this[XML_NODE_INDEX];
                if (thisNode.nodeType !== thisNode.ELEMENT_NODE)
                {
                    return construct(xmllistclass);
                }
                const thisElem = thisNode;
                if (istype(attributeName, qnameclass))
                {
                    const a = thisElem.getAttributeNodeNS(attributeName[QNAME_URI_INDEX], attributeName[QNAME_LOCALNAME_INDEX]);
                    if (a === null)
                    {
                        return construct(xmllistclass);
                    }
                    return [xmllistclass, new Map(), [w3cnodetoe4xnode(a)]];
                }

                const a = thisElem.getAttributeNode(tostring(attributeName));
                if (a === null)
                {
                    return construct(xmllistclass);
                }
                return [xmllistclass, new Map(), [w3cnodetoe4xnode(a)]];
            },
        })],
        [name(as3ns, "attributes"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                if (thisNode.nodeType !== thisNode.ELEMENT_NODE)
                {
                    return construct(xmllistclass);
                }
                const thisElem = thisNode;
                const a = thisElem.attributes;
                const array = [];
                for (let i = 0; i < a.length; i++)
                {
                    array.push(w3cnodetoe4xnode(a[i]));
                }
                return [xmllistclass, new Map(), array];
            },
        })],
        [name(as3ns, "child"), method(
        {
            exec(propertyName)
            {
                const thisNode = this[XML_NODE_INDEX];
                const m = [];
                const children = thisNode.childNodes;
                if (typeof propertyName === "number")
                {
                    const i = propertyName >> 0;
                    if (i < 0 || i >= children.length)
                    {
                        return [xmllistclass, new Map(), []];
                    }
                    return [xmllistclass, new Map(), [w3cnodetoe4xnode(children[propertyName >>> 0])]];
                }
                else
                {
                    let qual = null;
                    if (istype(propertyName, qnameclass))
                    {
                        qual = construct(namespaceclass, propertyName[QNAME_URI_INDEX]);
                        propertyName = propertyName[QNAME_LOCALNAME_INDEX];
                    }
                    else
                    {
                        propertyName = tostring(propertyName);
                    }
                    for (let i = 0; i < children.length; i++)
                    {
                        const child = children[i];
                        if (child.nodeType == child.ELEMENT_NODE && w3celementhastagname(child, qual, propertyName))
                        {
                            m.push(w3cnodetoe4xnode(child));
                        }
                    }
                    return [xmllistclass, new Map(), m];
                }
            },
        })],
        [name(as3ns, "childIndex"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                if (thisNode.parentNode !== null)
                {
                    const c = thisNode.parentNode.childNodes;
                    for (let i = 0; i < c.length; i++)
                    {
                        if (c[i] === thisNode)
                        {
                            return i;
                        }
                    }
                }
                return -1;
            }
        })],
        [name(as3ns, "children"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                const m = [];
                const children = thisNode.childNodes;

                for (let i = 0; i < children.length; i++)
                {
                    m.push(w3cnodetoe4xnode(children[i]));
                }
                return [xmllistclass, new Map(), m];
            },
        })],
        [name(as3ns, "comments"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                const m = Array.from(thisNode.childNodes)
                    .filter(a => a.nodeType == a.COMMENT_NODE)
                    .map(a => w3cnodetoe4xnode(a));
                return [xmllistclass, new Map(), m];
            },
        })],
        [name(as3ns, "contains"), method(
        {
            exec(value)
            {
                const thisNode = this[XML_NODE_INDEX];
                value = call(xmlclass, value);
                return thisNode.isEqualNode(value[XML_NODE_INDEX]);
            }
        })],
        [name(as3ns, "copy"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                const newNode = thisNode.cloneNode(true);
                const r = [xmlclass, new Map(), newNode];
                w3cnodetoe4xnodemapping.set(newNode, r);
                return r;
            }
        })],
        [name(as3ns, "descendants"), method(
        {
            exec(name = "*")
            {
                const thisNode = this[XML_NODE_INDEX];
                if (typeof name === "undefined")
                {
                    name = "*";
                }
                let qual = null;
                if (istype(name, qnameclass))
                {
                    qual = name[QNAME_URI_INDEX];
                    name = name[QNAME_LOCALNAME_INDEX];
                }
                else
                {
                    name = tostring(name);
                }
                const descNodes1 = w3cnodedescendants(thisNode);
                let descNodes = descNodes1;
                if (qual || name != "*")
                {
                    descNodes = descNodes1.filter(a => a.nodeType == a.ELEMENT_NODE && w3celementhastagname(a, qual, name));
                }
                let e4xNodes = descNodes.map(a => w3cnodetoe4xnode(a));
                return [xmllistclass, new Map(), e4xNodes];
            }
        })],
        [name(as3ns, "elements"), method(
        {
            exec(name = "*")
            {
                const thisNode = this[XML_NODE_INDEX];
                if (typeof name === "undefined")
                {
                    name = "*";
                }
                let qual = null;
                if (istype(name, qnameclass))
                {
                    qual = name[QNAME_URI_INDEX];
                    name = name[QNAME_LOCALNAME_INDEX];
                }
                else
                {
                    name = tostring(name);
                }
                const nodes1 = Array.from(thisNode.childNodes);
                let nodes = [];
                if (qual || name != "*")
                {
                    nodes = nodes1.filter(a => a.nodeType == a.ELEMENT_NODE && w3celementhastagname(a, qual, name));
                }
                else
                {
                    nodes = nodes1.filter(a => a.nodeType == a.ELEMENT_NODE);
                }
                let e4xNodes = nodes.map(a => w3cnodetoe4xnode(a));
                return [xmllistclass, new Map(), e4xNodes];
            }
        })],
        [name(as3ns, "hasComplexContent"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                const nodes = Array.from(thisNode.childNodes).filter(a => a.nodeType == a.ELEMENT_NODE);
                return nodes.length != 0;
            }
        })],
        [name(as3ns, "hasOwnProperty"), method(
        {
            exec(name)
            {
                return hasownproperty(this, tostring(name));
            }
        })],
        [name(as3ns, "hasSimpleContent"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                if (thisNode.nodeType === thisNode.COMMENT_NODE || thisNode.nodeType === thisNode.PROCESSING_INSTRUCTION_NODE)
                {
                    return false;
                }
                const nodes = Array.from(thisNode.childNodes).filter(a => a.nodeType == a.ELEMENT_NODE);
                return nodes.length == 0;
            }
        })],
        [name(as3ns, "insertChildAfter"), method(
        {
            exec(child1, child2)
            {
                const thisNode = this[XML_NODE_INDEX];
                child1 = child1 === null ? null : call(xmlclass, child1);
                child2 = call(xmlclass, child2);

                // Prepend child2 if child1 is null or undefined
                if (!child1)
                {
                    if (thisNode.hasChildNodes())
                    {
                        thisNode.insertBefore(w3cnodeexitdoc(child2[XML_NODE_INDEX]), thisNode.childNodes[0]);
                    }
                    else
                    {
                        thisNode.appendChild(w3cnodeexitdoc(child2[XML_NODE_INDEX]));
                    }
                    return this;
                }

                // Return undefined if child1 is not an existing child
                if (!Array.from(thisNode.childNodes).includes(child1[XML_NODE_INDEX]))
                {
                    return undefined;
                }

                if ((child1[XML_NODE_INDEX]).nextSibling)
                {
                    thisNode.insertBefore(w3cnodeexitdoc(child2[XML_NODE_INDEX]), (child1[XML_NODE_INDEX]).nextSibling);
                }
                else
                {
                    thisNode.appendChild(w3cnodeexitdoc(child2[XML_NODE_INDEX]));
                }
                return this;
            }
        })],
        [name(as3ns, "insertChildBefore"), method(
        {
            exec(child1, child2)
            {
                const thisNode = this[XML_NODE_INDEX];
                child1 = child1 === null ? null : call(xmlclass, child1);
                child2 = call(xmlclass, child2);

                // Append child2 if child1 is null or undefined
                if (!child1)
                {
                    thisNode.appendChild(w3cnodeexitdoc(child2[XML_NODE_INDEX]));
                    return this;
                }

                // Return undefined if child1 is not an existing child
                if (!Array.from(thisNode.childNodes).includes(child1[XML_NODE_INDEX]))
                {
                    return undefined;
                }

                thisNode.insertBefore(w3cnodeexitdoc(child2[XML_NODE_INDEX]), child1[XML_NODE_INDEX]);
                return this;
            }
        })],
        [name(as3ns, "length"), method(
        {
            exec()
            {
                return 1;
            }
        })],
        [name(as3ns, "localName"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                return thisNode.nodeType == thisNode.ELEMENT_NODE ? (thisNode).localName : null;
            }
        })],
        [name(as3ns, "name"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                return thisNode.nodeType == thisNode.ELEMENT_NODE ? construct(qnameclass, (thisNode).namespaceURI, (thisNode).localName) : thisNode.nodeName;
            }
        })],
        [name(as3ns, "namespace"), method(
        {
            exec(prefix = null)
            {
                const thisNode = this[XML_NODE_INDEX];
                prefix = prefix === null || typeof prefix == "undefined" ? null : tostring(prefix);
                if (prefix === null)
                {
                    const nsURI = thisNode.nodeType == thisNode.ELEMENT_NODE ? (thisNode).namespaceURI : null;
                    return nsURI === null ? null : construct(namespaceclass, (thisNode).prefix ?? "", nsURI);
                }
                const nsURI = thisNode.lookupNamespaceURI(prefix);
                return nsURI === null ? null : construct(namespaceclass, prefix, nsURI);
            }
        })],
        [name(as3ns, "nodeKind"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                const t = thisNode.nodeType;
                switch (t)
                {
                    case thisNode.ELEMENT_NODE:
                        return "element";
                    case thisNode.TEXT_NODE:
                    case thisNode.CDATA_SECTION_NODE:
                        return "text";
                    case thisNode.ATTRIBUTE_NODE:
                        return "attribute";
                    case thisNode.COMMENT_NODE:
                        return "comment";
                    case thisNode.PROCESSING_INSTRUCTION_NODE:
                        return "processing-instruction";
                    default:
                        throw new TypeError("Inaccessible node kind.");
                }
            }
        })],
        [name(as3ns, "normalize"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                thisNode.normalize();
                return this;
            }
        })],
        [name(as3ns, "parent"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                return thisNode.parentNode ?? undefined;
            }
        })],
        [name(as3ns, "prependChild"), method(
        {
            exec(child)
            {
                const thisNode = this[XML_NODE_INDEX];
                let firstChild = thisNode.hasChildNodes() ? thisNode.childNodes[0] : null;
                if (istype(child, xmlclass))
                {
                    if (firstChild === null)
                    {
                        thisNode.appendChild(w3cnodeexitdoc(child[XML_NODE_INDEX]));
                    }
                    else
                    {
                        thisNode.insertBefore(w3cnodeexitdoc(child[XML_NODE_INDEX]), firstChild);
                    }
                }
                else if (istype(child, xmllistclass))
                {
                    for (const newChild of child[XMLLIST_XMLARRAY_INDEX])
                    {
                        if (firstChild === null)
                        {
                            thisNode.appendChild(w3cnodeexitdoc(newChild[XML_NODE_INDEX]));
                        }
                        else
                        {
                            thisNode.insertBefore(w3cnodeexitdoc(newChild[XML_NODE_INDEX]), firstChild);
                        }
                        firstChild = newChild[XML_NODE_INDEX];
                    }
                }
                else
                {
                    const e4xnode = call(xmlclass, tostring(child));
                    if (firstChild === null)
                    {
                        thisNode.appendChild(w3cnodeexitdoc(e4xnode[XML_NODE_INDEX]));
                    }
                    else
                    {
                        thisNode.insertBefore(w3cnodeexitdoc(e4xnode[XML_NODE_INDEX]), firstChild);
                    }
                }
                return this;
            },
        })],
        [name(as3ns, "processingInstructions"), method(
        {
            exec(name = "*")
            {
                const thisNode = this[XML_NODE_INDEX];
                name = typeof name === "undefined" || name === null ? "*" : tostring(name);
                let m = Array.from(thisNode.childNodes)
                    .filter(a => a.nodeType == a.PROCESSING_INSTRUCTION_NODE);
                if (name != "*")
                {
                    m = m.filter(a => a.nodeName == name);
                }
                return [xmllistclass, new Map(), m.map(a => w3cnodetoe4xnode(a))];
            },
        })],
        [name(as3ns, "replace"), method(
        {
            exec(propertyName, value)
            {
                const thisNode = this[XML_NODE_INDEX];
                value = call(xmlclass, value);
                if (typeof propertyName == "number")
                {
                    propertyName = propertyName >>> 0;
                    if (propertyName > thisNode.childNodes.length)
                    {
                        return this;
                    }
                    const existingChild = thisNode.childNodes[propertyName];
                    thisNode.insertBefore(w3cnodeexitdoc(value[XML_NODE_INDEX]), existingChild);
                    existingChild.remove();
                }
                else
                {
                    let qual = null;
                    if (istype(propertyName, qnameclass))
                    {
                        qual = propertyName[QNAME_URI_INDEX];
                        propertyName = propertyName[QNAME_LOCALNAME_INDEX];
                    }
                    else
                    {
                        propertyName = tostring(propertyName);
                    }
                    let elems = Array.from(thisNode.childNodes);
                    if (qual || propertyName != "*")
                    {
                        elems = elems.filter(a => a.nodeType == a.ELEMENT_NODE && w3celementhastagname(a, qual, propertyName));
                    }
                    if (elems.length == 0)
                    {
                        return this;
                    }
                    thisNode.insertBefore(w3cnodeexitdoc(value[XML_NODE_INDEX]), elems[0]);
                    for (const c of elems)
                    {
                        c.remove();
                    }
                }

                return this;
            }
        })],
        [name(as3ns, "setChildren"), method(
        {
            exec(value)
            {
                const thisNode = this[XML_NODE_INDEX];
                if (istype(value, xmllistclass))
                {
                    for (const c of Array.from(thisNode.childNodes))
                    {
                        c.remove();
                    }
                    for (const e4xchild of value[XMLLIST_XMLARRAY_INDEX])
                    {
                        thisNode.appendChild(w3cnodeexitdoc(e4xchild[XML_NODE_INDEX]));
                    }
                    return this;
                }

                value = call(xmlclass, value);
                thisNode.appendChild(w3cnodeexitdoc(value[XML_NODE_INDEX]));

                return this;
            }
        })],
        [name(as3ns, "text"), method(
        {
            exec()
            {
                const thisNode = this[XML_NODE_INDEX];
                const m = Array.from(thisNode.childNodes).filter(a => a.nodeType == a.TEXT_NODE).map(a => w3cnodetoe4xnode(a));
                return [xmllistclass, new Map(), m];
            }
        })],
        [name(as3ns, "toJSON"), method(
        {
            exec(k)
            {
                return (this[CONSTRUCTOR_INDEX]).name;
            }
        })],
        [name(as3ns, "toString"), method(
        {
            exec()
            {
                const ser = new XMLSerializer();
                const m = Array.from((this[XML_NODE_INDEX]).childNodes)
                    .map(node => ser.serializeToString(node));
                return m.join("\n");
            }
        })],
        [name(as3ns, "toXMLString"), method(
        {
            exec()
            {
                return new XMLSerializer().serializeToString(this[XML_NODE_INDEX]);
            }
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this;
            }
        })],
    ]
);

export const XMLLIST_XMLARRAY_INDEX = 2; // An array of E4X "XML" objects
export const xmllistclass = defineclass(name($publicns, "XMLList"),
    {
        final: true,

        ctor(object)
        {
            this[XMLLIST_XMLARRAY_INDEX] = [];
            if (istype(object, xmllistclass))
            {
                (this[XMLLIST_XMLARRAY_INDEX]).push(...(object[XMLLIST_XMLARRAY_INDEX]));
            }
            else if (istype(object, xmlclass))
            {
                (this[XMLLIST_XMLARRAY_INDEX]).push(object);
            }
            else
            {
                if (typeof object === "number" || typeof object === "boolean")
                {
                    object = String(object);
                }
                else if (typeof object === "string")
                {
                }
                else
                {
                    throw new TypeError("Invalid XMLList() argument.");
                }
                const docsrc = "<doc>" + object + "</doc>";
                const doc = new DOMParser().parseFromString(tostring(docsrc), "text/xml");
                const initElems = Array.from(doc.childNodes[0].childNodes).map(a => w3cnodetoe4xnode(a));
                for (const elem of initElems)
                {
                    doc.removeChild(elem[XML_NODE_INDEX]);
                }
                (this[XMLLIST_XMLARRAY_INDEX]).push(...initElems);
            }
        },
    },
    [
        [name(as3ns, "attribute"), method(
        {
            exec(attributeName)
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "attribute", attributeName);
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "attributes"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "attributes");
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "child"), method(
        {
            exec(propertyName)
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "child", propertyName);
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "children"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "children");
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "comments"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "comments");
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "contains"), method(
        {
            exec(value)
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    if (callproperty(elem, as3ns, "contains", value))
                    {
                        return true;
                    }
                }
                return false;
            },
        })],
        [name(as3ns, "copy"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                return [xmllistclass, new Map(), elems.map(elem =>
                {
                    elem = callproperty(elem, as3ns, "copy");
                    return call(xmlclass, elem);
                })];
            },
        })],
        [name(as3ns, "descendants"), method(
        {
            exec(name = "*")
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "descendants", name);
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "elements"), method(
        {
            exec(name = "*")
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "elements", name);
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "hasComplexContent"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                if (elems.length == 0)
                {
                    return false;
                }
                for (const elem of elems)
                {
                    if ((elem[XML_NODE_INDEX]).nodeType == (elem[XML_NODE_INDEX]).ELEMENT_NODE)
                    {
                        return true;
                    }
                    const complex = callproperty(elem, as3ns, "hasComplexContent");
                    if (complex)
                    {
                        return true;
                    }
                }
                return false;
            },
        })],
        [name(as3ns, "hasOwnProperty"), method(
        {
            exec(p)
            {
                return hasownproperty(this, p);
            }
        })],
        [name(as3ns, "hasSimpleContent"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                if (elems.length == 0)
                {
                    return true;
                }
                if (elems.length == 1)
                {
                    return !!callproperty(elems[0], as3ns, "hasSimpleContent");
                }
                for (const elem of elems)
                {
                    if ((elem[XML_NODE_INDEX]).nodeType == (elem[XML_NODE_INDEX]).ELEMENT_NODE)
                    {
                        return false;
                    }
                }
                return true;
            },
        })],
        [name(as3ns, "length"), method(
        {
            exec()
            {
                return (this[XMLLIST_XMLARRAY_INDEX]).length;
            }
        })],
        [name(as3ns, "normalize"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                for (const elem of elems)
                {
                    (elem[XML_NODE_INDEX]).normalize();
                }
                return this;
            }
        })],
        [name(as3ns, "parent"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                let parent = undefined;
                for (const elem of elems)
                {
                    const parent1 = (elem[XML_NODE_INDEX]).parentNode;
                    if (parent1)
                    {
                        if (parent && parent !== parent1)
                        {
                            return undefined;
                        }
                        parent = parent1;
                    }
                }
                return parent;
            }
        })],
        [name(as3ns, "processingInstructions"), method(
        {
            exec(name = "*")
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "processingInstructions", name);
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "text"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "text");
                    r.push(...call(xmlclass, r1)[XMLLIST_XMLARRAY_INDEX]);
                }
                return [xmllistclass, new Map(), r];
            },
        })],
        [name(as3ns, "toString"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "toString");
                    r.push(tostring(r1));
                }
                return r.join("\n");
            },
        })],
        [name(as3ns, "toXMLString"), method(
        {
            exec()
            {
                const elems = this[XMLLIST_XMLARRAY_INDEX];
                const r = [];
                for (const elem of elems)
                {
                    const r1 = callproperty(elem, as3ns, "toXMLString");
                    r.push(tostring(r1));
                }
                return r.join("\n");
            },
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return this;
            },
        })],
    ]
);

export const CLASS_CLASS_INDEX = 2;
export const classclass = defineclass(name($publicns, "Class"),
    {
        ctor()
        {
            this[CLASS_CLASS_INDEX] = objectclass;
        },
    },
    [
    ]
);

export const DATE_DATE_INDEX = 2;
export const dateclass = defineclass(name($publicns, "Date"),
    {
        final: true,

        ctor(arg1 = undefined, arg2 = undefined, arg3 = undefined, arg4 = undefined, arg5 = undefined, arg6 = undefined, arg7 = undefined)
        {
            this[DATE_DATE_INDEX] = new Date(arg1, arg2, arg3, arg4, arg5, arg6, arg7);
        },
    },
    [
        [name(as3ns, "date"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getDate();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setDate(value);
                },
            }),
        })],
        [name(as3ns, "dateUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCDate();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCDate(value);
                },
            }),
        })],
        [name(as3ns, "day"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getDay();
                },
            }),
            setter: null,
        })],
        [name(as3ns, "dayUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCDay();
                },
            }),
            setter: null,
        })],
        [name(as3ns, "fullYear"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getFullYear();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setFullYear(value);
                },
            }),
        })],
        [name(as3ns, "fullYearUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCFullYear();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCFullYear(value);
                },
            }),
        })],
        [name(as3ns, "hours"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getHours();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setHours(value);
                },
            }),
        })],
        [name(as3ns, "hoursUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCHours();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCHours(value);
                },
            }),
        })],
        [name(as3ns, "milliseconds"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getMilliseconds();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setMilliseconds(value);
                },
            }),
        })],
        [name(as3ns, "millisecondsUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCMilliseconds();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCMilliseconds(value);
                },
            }),
        })],
        [name(as3ns, "minutes"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getMinutes();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setMinutes(value);
                },
            }),
        })],
        [name(as3ns, "minutesUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCMinutes();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCMinutes(value);
                },
            }),
        })],
        [name(as3ns, "month"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getMonth();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setMonth(value);
                },
            }),
        })],
        [name(as3ns, "monthUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCMonth();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCMonth(value);
                },
            }),
        })],
        [name(as3ns, "seconds"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getSeconds();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setSeconds(value);
                },
            }),
        })],
        [name(as3ns, "secondsUTC"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getUTCSeconds();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setUTCSeconds(value);
                },
            }),
        })],
        [name(as3ns, "time"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getTime();
                },
            }),
            setter: method(
            {
                exec(value)
                {
                    (this[DATE_DATE_INDEX]).setTime(value);
                },
            }),
        })],
        [name(as3ns, "timezoneOffset"), virtualvar(
        {
            type: numberclass,
            getter: method(
            {
                exec()
                {
                    return (this[DATE_DATE_INDEX]).getTimezoneOffset();
                },
            }),
            setter: null,
        })],
        
        // "Date" methods

        [name(as3ns, "getDate"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getDate();
            },
        })],
        [name(as3ns, "getDay"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getDay();
            },
        })],
        [name(as3ns, "getFullYear"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getFullYear();
            },
        })],
        [name(as3ns, "getHours"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getHours();
            },
        })],
        [name(as3ns, "getMilliseconds"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getMilliseconds();
            },
        })],
        [name(as3ns, "getMinutes"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getMinutes();
            },
        })],
        [name(as3ns, "getMonth"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getMonth();
            },
        })],
        [name(as3ns, "getSeconds"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getSeconds();
            },
        })],
        [name(as3ns, "getTime"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getTime();
            },
        })],
        [name(as3ns, "getTimezoneOffset"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getTimezoneOffset();
            },
        })],
        [name(as3ns, "getUTCDate"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCDate();
            },
        })],
        [name(as3ns, "getUTCDay"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCDay();
            },
        })],
        [name(as3ns, "getUTCFullYear"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCFullYear();
            },
        })],
        [name(as3ns, "getUTCHours"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCHours();
            },
        })],
        [name(as3ns, "getUTCMilliseconds"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCMilliseconds();
            },
        })],
        [name(as3ns, "getUTCMinutes"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCMinutes();
            },
        })],
        [name(as3ns, "getUTCMonth"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCMonth();
            },
        })],
        [name(as3ns, "getUTCSeconds"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).getUTCSeconds();
            },
        })],
        [name(as3ns, "parse"), method(
        {
            static: true,
            exec(date)
            {
                return Date.parse(date);
            },
        })],
        [name(as3ns, "setDate"), method(
        {
            exec(value)
            {
                return (this[DATE_DATE_INDEX]).setDate(value);
            }
        })],
        [name(as3ns, "setFullYear"), method(
        {
            exec(year, month, day)
            {
                return (this[DATE_DATE_INDEX]).setFullYear(year, month, day);
            }
        })],
        [name(as3ns, "setHours"), method(
        {
            exec(hour, minute, second, millisecond)
            {
                return (this[DATE_DATE_INDEX]).setHours(hour, minute, second, millisecond);
            }
        })],
        [name(as3ns, "setMilliseconds"), method(
        {
            exec(millisecond)
            {
                return (this[DATE_DATE_INDEX]).setMilliseconds(millisecond);
            }
        })],
        [name(as3ns, "setMinutes"), method(
        {
            exec(minute, second, millisecond)
            {
                return (this[DATE_DATE_INDEX]).setMinutes(minute, second, millisecond);
            }
        })],
        [name(as3ns, "setMonth"), method(
        {
            exec(month, day)
            {
                return (this[DATE_DATE_INDEX]).setMonth(month, day);
            }
        })],
        [name(as3ns, "setSeconds"), method(
        {
            exec(second, millisecond)
            {
                return (this[DATE_DATE_INDEX]).setSeconds(second, millisecond);
            }
        })],
        [name(as3ns, "setTime"), method(
        {
            exec(millisecond)
            {
                return (this[DATE_DATE_INDEX]).setTime(millisecond);
            }
        })],
        [name(as3ns, "setUTCDate"), method(
        {
            exec(value)
            {
                return (this[DATE_DATE_INDEX]).setUTCDate(value);
            }
        })],
        [name(as3ns, "setUTCFullYear"), method(
        {
            exec(year, month, day)
            {
                return (this[DATE_DATE_INDEX]).setUTCFullYear(year, month, day);
            }
        })],
        [name(as3ns, "setUTCHours"), method(
        {
            exec(hour, minute, second, millisecond)
            {
                return (this[DATE_DATE_INDEX]).setUTCHours(hour, minute, second, millisecond);
            }
        })],
        [name(as3ns, "setUTCMilliseconds"), method(
        {
            exec(millisecond)
            {
                return (this[DATE_DATE_INDEX]).setUTCMilliseconds(millisecond);
            }
        })],
        [name(as3ns, "setUTCMinutes"), method(
        {
            exec(minute, second, millisecond)
            {
                return (this[DATE_DATE_INDEX]).setUTCMinutes(minute, second, millisecond);
            }
        })],
        [name(as3ns, "setUTCMonth"), method(
        {
            exec(month, day)
            {
                return (this[DATE_DATE_INDEX]).setUTCMonth(month, day);
            }
        })],
        [name(as3ns, "setUTCSeconds"), method(
        {
            exec(second, millisecond)
            {
                return (this[DATE_DATE_INDEX]).setUTCSeconds(second, millisecond);
            }
        })],
        [name(as3ns, "toDateString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toDateString();
            }
        })],
        [name(as3ns, "toLocaleDateString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toLocaleDateString();
            }
        })],
        [name(as3ns, "toLocaleString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toLocaleString();
            }
        })],
        [name(as3ns, "toLocaleTimeString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toLocaleTimeString();
            }
        })],
        [name(as3ns, "toString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toString();
            }
        })],
        [name(as3ns, "toTimeString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toTimeString();
            }
        })],
        [name(as3ns, "toUTCString"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).toUTCString();
            }
        })],
        [name($publicns, "UTC"), method(
        {
            static: true,
            exec(year, month, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0)
            {
                return Date.UTC(year, month, day, hour, minute, second, millisecond);
            }
        })],
        [name(as3ns, "valueOf"), method(
        {
            exec()
            {
                return (this[DATE_DATE_INDEX]).valueOf();
            }
        })],
    ]
);

function mdefaultfunction() {}

export const FUNCTION_FUNCTION_INDEX = 2;
export const functionclass = defineclass(name($publicns, "Function"),
    {
        final: true,

        ctor()
        {
            this[FUNCTION_FUNCTION_INDEX] = mdefaultfunction;
        },
    },
    [
        [name($publicns, "length"), virtualvar({
            type: numberclass,
            getter: method({
                exec()
                {
                    return this[FUNCTION_FUNCTION_INDEX].length;
                }
            }),
            setter: null,
        })],
        [name(as3ns, "apply"), method(
        {
            exec(thisArg, args)
            {
                return this[FUNCTION_FUNCTION_INDEX].apply(thisArg, args);
            },
        })],
        [name(as3ns, "call"), method(
        {
            exec(thisArg, ...args)
            {
                return this[FUNCTION_FUNCTION_INDEX].call(thisArg, ...args);
            },
        })],
    ]
);

export const thereflectclass = defineclass(name($publicns, "Reflect"),
    {
        ctor()
        {
            throw new Error("Cannot construct the Reflect class.");
        },
    },
    [
        [name($publicns, "typeArguments"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return null;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                if (type instanceof SpecialTypeAfterSub)
                {
                    return [applytype(arrayclass, [classclass]), new Map(), type.argumentslist.map(arg => reflectclass(arg))];
                }
                return null;
            },
        })],
        [name($publicns, "lookupMetadata"), method({
            static: true,

            exec(type, name)
            {
                if (type === null || type === undefined)
                {
                    return null;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                const metadata = type.metadata.find(m => m.name === name);
                if (metadata)
                {
                    const r = construct(objectclass);
                    setproperty(r, null, "name", metadata.name);
                    const entrytuple_t = tupletype([stringclass, stringclass]);
                    const r_entries = [];
                    for (const [k, v] of metadata.entries)
                    {
                        r_entries.push([entrytuple_t, untoucheddynamic, k ?? null, v]);
                    }
                    setproperty(r, null, "entries", [applytype(arrayclass, [entrytuple_t]), new Map(), r_entries]);
                    return r;
                }
                return null;
            },
        })],
        [name($publicns, "variables"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return null;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                if (!(type instanceof Class))
                {
                    return [];
                }
                const r = [];
                for (const [name, trait] of type.prototypenames.dictionary())
                {
                    if ((name.ns instanceof Systemns && name.ns.kind != Systemns.PUBLIC) || name.ns instanceof Userns)
                    {
                        continue;
                    }
            
                    const ns = name.ns instanceof Systemns ? null : name.ns.uri;
                    const localname = name.name;
            
                    if (trait instanceof Variable)
                    {
                        const r_metadata = [];
                        for (const metadata of trait.metadata)
                        {
                            const r = construct(objectclass);
                            setproperty(r, null, "name", metadata.name);
                            const entrytuple_t = tupletype([stringclass, stringclass]);
                            const r_entries = [];
                            for (const [k, v] of metadata.entries)
                            {
                                r_entries.push([entrytuple_t, untoucheddynamic, k ?? null, v]);
                            }
                            setproperty(r, null, "entries", [applytype(arrayclass, [entrytuple_t]), new Map(), r_entries]);
                            r_metadata.push(r);
                        }
                        const r_metadata_array = [applytype(arrayclass, [objectclass]), new Map(), r_metadata];

                        const r1 = construct(objectclass);
                        setproperty(r1, null, "metadata", r_metadata_array);
                        setproperty(r1, null, "namespace", ns);
                        setproperty(r1, null, "name", localname);
                        setproperty(r1, null, "type", reflectclass(trait.type));
                        r.push(r1);
                    }
                }
                return [applytype(arrayclass, [objectclass]), new Map(), r];
            }
        })],
        [name($publicns, "tupleTypeElements"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return null;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                if (type instanceof TupleType)
                {
                    return [applytype(arrayclass, [classclass]), new Map(), type.elementtypes.map(t => reflectclass(t))];
                }
                return null;
            },
        })],
        [name($publicns, "superType"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return null;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                if (type instanceof Interface)
                {
                    return null;
                }
                return type.baseclass ? reflectclass(type.baseclass) : null;
            }
        })],
        [name($publicns, "arrayOf"), method({
            static: true,

            exec(elementType)
            {
                if (!(elementType === null || elementType === undefined || istype(elementType, classclass)))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                elementType = elementType ? elementType[CLASS_CLASS_INDEX] : null;
                return applytype(arrayclass, [elementType]);
            }
        })],
        [name($publicns, "vectorOf"), method({
            static: true,

            exec(elementType)
            {
                if (!(elementType === null || elementType === undefined || istype(elementType, classclass)))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                elementType = elementType ? elementType[CLASS_CLASS_INDEX] : null;
                return applytype(vectorclass, [elementType]);
            }
        })],
        [name($publicns, "mapOf"), method({
            static: true,

            exec(keyType, valueType)
            {
                for (const t of [keyType, valueType])
                {
                    if (!(t === null || t === undefined || istype(t, classclass)))
                    {
                        throw new ArgumentError("Expected arguments of type Class.");
                    }
                }
                keyType = keyType ? keyType[CLASS_CLASS_INDEX] : null;
                valueType = valueType ? valueType[CLASS_CLASS_INDEX] : null;
                return applytype(mapclass, [keyType, valueType]);
            }
        })],
        [name($publicns, "tupleOf"), method({
            static: true,

            exec(elementTypes)
            {
                if (!istypeinstantiatedfrom(elementTypes, arrayclass))
                {
                    throw new ArgumentError("Expected an Array argument.");
                }
                elementTypes = elementTypes[ARRAY_SUBARRAY_INDEX].map(t =>
                {
                    if (!(t === null || t === undefined || istype(t, classclass)))
                    {
                        throw new ArgumentError("Expected arguments of type Class.");
                    }
                    return t ? t[CLASS_CLASS_INDEX] : null;
                });
                return tupletype(elementTypes);
            }
        })],
        [name($publicns, "constructTuple"), method({
            static: true,

            exec(elementTypes, elements)
            {
                if (!(istypeinstantiatedfrom(elementTypes, arrayclass) && istypeinstantiatedfrom(elements, arrayclass)))
                {
                    throw new ArgumentError("Expected Array arguments.");
                }
                const len = elementTypes.length;
                if (len != elements.length)
                {
                    throw new ArgumentError("Given Array arguments must have the same length.");
                }
                if (len < 2)
                {
                    throw new ArgumentError("Specified Arrays must each have a length greater than 1.");
                }
                elementTypes = elementTypes[ARRAY_SUBARRAY_INDEX].map(t =>
                {
                    if (!(t === null || t === undefined || istype(t, classclass)))
                    {
                        throw new ArgumentError("Expected arguments of type Class.");
                    }
                    return t ? t[CLASS_CLASS_INDEX] : null;
                });
                for (let i = 0; i < l; i++)
                {
                    elements[i] = coerceorfail(elements[i], elementTypes[i], () => {
                        throw new ArgumentError("Expected index " + i + " to be of type " + nameoftype(elementTypes[i]) + ".");
                    });
                }
                return [tupletype(elementTypes), untoucheddynamic, ...elements];
            }
        })],
        [name($publicns, "isArrayType"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return false;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                return istypeinstantiatedfrom(type, arrayclass);
            },
        })],
        [name($publicns, "isMapType"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return false;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                return istypeinstantiatedfrom(type, mapclass);
            },
        })],
        [name($publicns, "isTupleType"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return false;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                return type instanceof TupleType;
            },
        })],
        [name($publicns, "isVectorType"), method({
            static: true,

            exec(type)
            {
                if (type === null || type === undefined)
                {
                    return false;
                }
                if (!istype(type, classclass))
                {
                    throw new ArgumentError("Expected argument of type Class.");
                }
                type = type[CLASS_CLASS_INDEX];
                return istypeinstantiatedfrom(type, vectorclass);
            },
        })],
    ]
);

export const ARRAY_SUBARRAY_INDEX = 2;
export const arrayclass = defineclass(name($publicns, "Array"),
    {
        dynamic: true,
        final: true,

        ctor(...args)
        {
            if (args.length == 1 && typeof args[0] == "number")
            {
                const length = Math.max(0, args[0] >>> 0);
                this[ARRAY_SUBARRAY_INDEX] = new Array(length);
            }
            else
            {
                args = args.map(arg =>
                {
                    return coerceorfail(arg, elemType, () => {
                        throw new TypeError("Expected item of type " + nameoftype(elemType));
                    });
                });
                this[ARRAY_SUBARRAY_INDEX] = args.slice(0);
            }
        },
    },
    [
        [name($publicns, "length"), virtualvar(
        {
            type: uintclass,
            getter: method(
            {
                exec()
                {
                    return this[ARRAY_SUBARRAY_INDEX].length;
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    this[ARRAY_SUBARRAY_INDEX].length = val >>> 0;
                },
            }),
        })],
        [name(as3ns, "concat"), method(
        {
            exec(...args)
            {
                const thisarr = this[ARRAY_SUBARRAY_INDEX];
                const r = thisarr.slice(0);
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                for (const arg of args)
                {
                    if (isarray(arg))
                    {
                        for (const arg1 of arg[ARRAY_SUBARRAY_INDEX])
                        {
                            r.push(coerceorfail(arg1, elemType, () => {
                                throw new TypeError("Expected item of type " + nameoftype(elemType));
                            }));
                        }
                    }
                    else
                    {
                        r.push(coerceorfail(arg, elemType, () => {
                            throw new TypeError("Expected item of type " + nameoftype(elemType));
                        }));
                    }
                }
                return [this[CONSTRUCTOR_INDEX], new Map(), r];
            },
        })],
        [name(as3ns, "every"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[ARRAY_SUBARRAY_INDEX];
                for (let i = 0; i < arr.length; i++)
                {
                    if (!callbackFn(arr[i], i, this))
                    {
                        return false;
                    }
                }
                return true;
            },
        })],
        [name(as3ns, "filter"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[ARRAY_SUBARRAY_INDEX];
                const r = [];
                for (let i = 0; i < arr.length; i++)
                {
                    const item = arr[i];
                    if (callbackFn(item, i, this))
                    {
                        r.push(item);
                    }
                }
                return [this[CONSTRUCTOR_INDEX], new Map(), r];
            },
        })],
        [name(as3ns, "forEach"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[ARRAY_SUBARRAY_INDEX];
                for (let i = 0; i < arr.length; i++)
                {
                    callbackFn(arr[i], i, this);
                }
            },
        })],
        [name(as3ns, "includes"), method(
        {
            exec(item)
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                return arr.includes(item);
            },
        })],
        [name(as3ns, "indexOf"), method(
        {
            exec(searchElement, fromIndex = 0)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[ARRAY_SUBARRAY_INDEX];
                return arr.indexOf(coerceorfail(searchElement, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }), fromIndex);
            },
        })],
        [name(as3ns, "insertAt"), method(
        {
            exec(index, element)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[ARRAY_SUBARRAY_INDEX];
                element = coerceorfail(element, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                });
                arr.splice(index, 0, element);
            },
        })],
        [name(as3ns, "join"), method(
        {
            exec(sep = ",")
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                return arr.map(v => tostring(v)).join(sep ?? ",");
            },
        })],
        [name(as3ns, "lastIndexOf"), method(
        {
            exec(searchElement, fromIndex = 0x7FFFFFFF)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[ARRAY_SUBARRAY_INDEX];
                searchElement = coerceorfail(searchElement, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                });
                return arr.lastIndexOf(searchElement, fromIndex);
            },
        })],
        [name(as3ns, "map"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[ARRAY_SUBARRAY_INDEX];
                const r = [];
                for (let i = 0; i < arr.length; i++)
                {
                    r.push(callbackFn(arr[i], i, this));
                }
                return [applytype(arrayclass, [null]), new Map(), r];
            },
        })],
        [name(as3ns, "pop"), method(
        {
            exec()
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                if (arr.length === 0)
                {
                    return null;
                }
                return arr.pop();
            },
        })],
        [name(as3ns, "push"), method(
        {
            exec(...args)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[ARRAY_SUBARRAY_INDEX];
                args = args.map(arg => coerceorfail(arg, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }));
                return arr.push(...args);
            },
        })],
        [name(as3ns, "removeAt"), method(
        {
            exec(index)
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                return arr.splice(index, 1)[0] ?? null;
            },
        })],
        [name(as3ns, "reverse"), method(
        {
            exec()
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                arr.reverse();
                return this;
            },
        })],
        [name(as3ns, "shift"), method(
        {
            exec()
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                if (arr.length === 0)
                {
                    return null;
                }
                return arr.shift();
            },
        })],
        [name(as3ns, "slice"), method(
        {
            exec(startIndex = 0, endIndex = 0x7FFFFFFF)
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                return [this[CONSTRUCTOR_INDEX], new Map(), arr.slice(startIndex, endIndex)];
            },
        })],
        [name(as3ns, "some"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[ARRAY_SUBARRAY_INDEX];
                for (let i = 0; i < arr.length; i++)
                {
                    if (callbackFn(arr[i], i, this))
                    {
                        return true;
                    }
                }
                return false;
            },
        })],
        [name($publicns, "CASEINSENSITIVE"), variable(
        {
            static: true,
            type: uintclass,
            readonly: true,
        })],
        [name($publicns, "DESCENDING"), variable(
        {
            static: true,
            type: uintclass,
            readonly: true,
        })],
        [name($publicns, "NUMERIC"), variable(
        {
            static: true,
            type: uintclass,
            readonly: true,
        })],
        [name($publicns, "RETURNINDEXEDARRAY"), variable(
        {
            static: true,
            type: uintclass,
            readonly: true,
        })],
        [name($publicns, "UNIQUESORT"), variable(
        {
            static: true,
            type: uintclass,
            readonly: true,
        })],
        // sort(sortOptions)
        // sort(compareFunction)
        // sort(compareFunction, sortOptions)
        [name(as3ns, "sort"), method(
        {
            exec(...args)
            {
                let compareFunction = undefined;
                let sortOptions = 0;
                if (args.length == 1 && typeof args[0] == "number")
                {
                    sortOptions = args[0];
                }
                else
                {
                    compareFunction = args[0];
                    sortOptions = args[1];
                }
                sortOptions = sortOptions >>> 0;
                const returnindexedarray = (sortOptions & Array_RETURNINDEXEDARRAY) != 0;

                if (typeof compareFunction == "undefined" || compareFunction === null)
                {
                    compareFunction = (a, b) => compareadvanced(a, b, sortOptions);
                }
                else
                {
                    compareFunction = call(functionclass, compareFunction)[FUNCTION_FUNCTION_INDEX];
                }
                let arr = this[ARRAY_SUBARRAY_INDEX];
                if (returnindexedarray)
                {
                    const indices = [];
                    arr = arr.slice(0);
                    const l = arr.length;
                    for (let i = 0; i < l; i++)
                    {
                        indices.push(i);
                    }
                    for (let i = 0; i < l - 1; i++)
                    {
                        for (let j = 0; j < l - i - 1; j++)
                        {
                            if (compareFunction(arr[j], arr[j + 1]))
                            {
                                const temp = arr[j];
                                arr[j] = arr[j + 1];
                                arr[j + 1] = temp;
                                indices[j] = j + 1;
                                indices[j + 1] = j;
                            }
                        }
                    }
                    return [applytype(arrayclass, [null]), new Map(), indices];
                }
                else
                {
                    arr.sort(compareFunction);
                    return this;
                }
            },
        })],
        // sortOn(fieldName, sortOptions=)
        [name(as3ns, "sortOn"), method(
        {
            exec(fieldName, sortOptions = null)
            {
                const fieldNames = [];
                const sortOptionsByField = [];

                // fieldName => fieldNames
                if (isarray(fieldName))
                {
                    for (const name1 of fieldName[ARRAY_SUBARRAY_INDEX])
                    {
                        fieldNames.push(tostring(name1));
                    }
                }
                else
                {
                    fieldNames.push(tostring(fieldName));
                }

                const numNames = fieldNames.length;

                // sortOptions => sortOptionsByField
                if (isarray(sortOptions))
                {
                    for (const opt of sortOptions[ARRAY_SUBARRAY_INDEX])
                    {
                        sortOptionsByField.push(opt >>> 0);
                    }
                }
                else
                {
                    sortOptionsByField.push(sortOptions >>> 0);
                    sortOptionsByField.push(sortOptionsByField[0]);
                }

                const sortOptionsExcludingFields = sortOptionsByField.slice(fieldNames.length);

                const returnindexedarray = sortOptionsExcludingFields.some(opt => (opt & Array_RETURNINDEXEDARRAY) != 0);
                const descending = sortOptionsExcludingFields.some(opt => (opt & Array_DESCENDING) != 0);

                let compareFunction = (a, b) =>
                {
                    let r = 0;
                
                    for (let i = 0; i < numNames; i++)
                    {
                        const name = fieldNames[i];
                        if (!(inobject(a, name) && inobject(b, name)))
                        {
                            continue;
                        }
                        const a_val = getproperty(a, null, name);
                        const b_val = getproperty(b, null, name);
                        const opt = sortOptionsByField[i] >>> 0;
                        r += compareadvanced(a_val, b_val, opt);
                    }
                
                    return r;
                };

                let arr = this[ARRAY_SUBARRAY_INDEX];
                if (returnindexedarray)
                {
                    const indices = [];
                    arr = arr.slice(0);
                    const l = arr.length;
                    for (let i = 0; i < l; i++)
                    {
                        indices.push(i);
                    }
                    for (let i = 0; i < l - 1; i++) {
                        for (let j = 0; j < l - i - 1; j++) {
                            if (compareFunction(arr[j], arr[j + 1]))
                            {
                                const temp = arr[j];
                                arr[j] = arr[j + 1];
                                arr[j + 1] = temp;
                                indices[j] = j + 1;
                                indices[j + 1] = j;
                            }
                        }
                    }
                    return [applytype(arrayclass, [null]), new Map(), indices];
                }
                else
                {
                    arr.sort(compareFunction);
                    return this;
                }
            },
        })],
        [name(as3ns, "splice"), method(
        {
            exec(startIndex, deleteCount = 0xFFFFFFFF, ...items)
            {
                const arr = this[ARRAY_SUBARRAY_INDEX];
                items = items.map(item => coerceorfail(item, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }));
                const r = arr.splice(startIndex, deleteCount, ...items);
                return [this[CONSTRUCTOR_INDEX], new Map(), r];
            },
        })],
        [name(as3ns, "unshift"), method(
        {
            exec(...args)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[ARRAY_SUBARRAY_INDEX];
                args = args.map(arg => coerceorfail(arg, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }));
                return arr.unshift(...args);
            },
        })],
    ]
);

function compareadvanced(a, b, sortOptions)
{
    const caseinsensitive = (sortOptions & Array_CASEINSENSITIVE) != 0;
    const descending = (sortOptions & Array_DESCENDING) != 0;
    const numeric = (sortOptions & Array_NUMERIC) != 0;
    const uniquesort = (sortOptions & Array_UNIQUESORT) != 0;

    if (uniquesort && ["number", "string", "boolean"].indexOf(typeof a) == -1)
    {
        if (descending)
        {
            return a < b ? 1 : identicalfields(a, b, sortOptions) ? 0 : -1;
        }
        else
        {
            return a < b ? -1 : identicalfields(a, b, sortOptions) ? 0 : 1;
        }
    }
    else if (numeric)
    {
        if (descending)
        {
            a = nonnumerictointeger(a);
            b = nonnumerictointeger(b);
            return a < b ? 1 : a == b ? 0 : -1;
        }
        // ascending
        else
        {
            a = nonnumerictointeger(a);
            b = nonnumerictointeger(b);
            return a < b ? -1 : a == b ? 0 : 1;
        }
    }
    else if (descending)
    {
        if (caseinsensitive)
        {
            a = tostring(a).toLowerCase();
            b = tostring(b).toLowerCase();
            return a < b ? 1 : a == b ? 0 : -1;
        }
        else
        {
            a = tostring(a);
            b = tostring(b);
            return a < b ? 1 : a == b ? 0 : -1;
        }
    }
    // ascending
    else
    {
        if (caseinsensitive)
        {
            a = tostring(a).toLowerCase();
            b = tostring(b).toLowerCase();
            return a < b ? -1 : a == b ? 0 : 1;
        }
        else
        {
            a = tostring(a);
            b = tostring(b);
            return a < b ? -1 : a == b ? 0 : 1;
        }
    }
}

/**
 * Compares every iterable name-value pair of two values and then
 * returns -1 for a = lower, 0 for a = equal or 1 for a = higher (ascending order).
 */
function identicalfields(a, b, sortOptions)
{
    const a_names = Array.from(nameiterator(a));
    const a_values = Array.from(valueiterator(a));
    const b_names = Array.from(nameiterator(b));
    const b_values = Array.from(valueiterator(b));
    const l = a_names.length;

    if (l != b_names.length)
    {
        return 0;
    }

    let r = 0;

    for (let i = 0; i < l; i++)
    {
        let name = a_names[i];
        const a_val = a_values[i];
        const b_val_i = b_names.indexOf(name);
        if (b_val_i === -1)
        {
            continue;
        }
        const b_val = b_values[b_val_i];
        r += compareadvanced(a_val, b_val, sortOptions);
    }

    return r;
}

function nonnumerictointeger(v)
{
    if (typeof v != "number")
    {
        if (Number(v) !== v >> 0)
        {
            throw new TypeError("Could not convert non-numeric value to integer.");
        }
        v = v >> 0;
    }
    return v;
}

const Array_CASEINSENSITIVE = 1;
const Array_DESCENDING = 2;
const Array_NUMERIC = 16;
const Array_RETURNINDEXEDARRAY = 8;
const Array_UNIQUESORT = 4;

setproperty(arrayclass, null, "CASEINSENSITIVE", Array_CASEINSENSITIVE);
setproperty(arrayclass, null, "DESCENDING", Array_DESCENDING);
setproperty(arrayclass, null, "NUMERIC", Array_NUMERIC);
setproperty(arrayclass, null, "RETURNINDEXEDARRAY", Array_RETURNINDEXEDARRAY);
setproperty(arrayclass, null, "UNIQUESORT", Array_UNIQUESORT);

const fixedVectorMessage = "Cannot mutate size of fixed vector.";

export const VECTOR_SUBARRAY_INDEX = 2;
export const VECTOR_FIXED_INDEX = 3;
export const vectorclass = defineclass(name($publicns, "Vector"),
    {
        final: true,
        ctor(length = 0, fixed = false)
        {
            this[VECTOR_SUBARRAY_INDEX] = new Array(Math.max(0, length >>> 0));
            this[VECTOR_FIXED_INDEX] = !!fixed;
        },
    },
    [
        [name($publicns, "length"), virtualvar(
        {
            type: uintclass,
            getter: method(
            {
                exec()
                {
                    return this[VECTOR_SUBARRAY_INDEX].length;
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    if (this[VECTOR_FIXED_INDEX])
                    {
                        throw new Error(fixedVectorMessage);
                    }
                    this[VECTOR_SUBARRAY_INDEX].length = val >>> 0;
                },
            }),
        })],
        [name($publicns, "fixed"), virtualvar(
        {
            type: booleanclass,
            getter: method(
            {
                exec()
                {
                    return this[VECTOR_FIXED_INDEX];
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    this[VECTOR_FIXED_INDEX] = !!val;
                },
            }),
        })],
        [name(as3ns, "concat"), method(
        {
            exec(...args)
            {
                const thisarr = this[VECTOR_SUBARRAY_INDEX];
                const r = thisarr.slice(0);
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                for (const arg of args)
                {
                    if (isvector(arg))
                    {
                        for (const arg1 of arg[VECTOR_SUBARRAY_INDEX])
                        {
                            r.push(coerceorfail(arg1, elemType, () => {
                                throw new TypeError("Expected item of type " + nameoftype(elemType));
                            }));
                        }
                    }
                    else
                    {
                        r.push(coerceorfail(arg, elemType, () => {
                            throw new TypeError("Expected item of type " + nameoftype(elemType));
                        }));
                    }
                }
                return [this[CONSTRUCTOR_INDEX], new Map(), r];
            },
        })],
        [name(as3ns, "every"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[VECTOR_SUBARRAY_INDEX];
                for (let i = 0; i < arr.length; i++)
                {
                    if (!callbackFn(arr[i], i, this))
                    {
                        return false;
                    }
                }
                return true;
            },
        })],
        [name(as3ns, "filter"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[VECTOR_SUBARRAY_INDEX];
                const r = [];
                for (let i = 0; i < arr.length; i++)
                {
                    const item = arr[i];
                    if (callbackFn(item, i, this))
                    {
                        r.push(item);
                    }
                }
                return [this[CONSTRUCTOR_INDEX], new Map(), r];
            },
        })],
        [name(as3ns, "forEach"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[VECTOR_SUBARRAY_INDEX];
                for (let i = 0; i < arr.length; i++)
                {
                    callbackFn(arr[i], i, this);
                }
            },
        })],
        [name(as3ns, "includes"), method(
        {
            exec(item)
            {
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return arr.includes(item);
            },
        })],
        [name(as3ns, "indexOf"), method(
        {
            exec(searchElement, fromIndex = 0)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                searchElement = coerceorfail(searchElement, elemType, () => {
                    throw new TypeError("Expected search element of type " + nameoftype(elemType));
                });
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return arr.indexOf(searchElement, fromIndex);
            },
        })],
        [name(as3ns, "insertAt"), method(
        {
            exec(index, element)
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                element = coerceorfail(element, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                });
                const arr = this[VECTOR_SUBARRAY_INDEX];
                arr.splice(index, 0, element);
            },
        })],
        [name(as3ns, "join"), method(
        {
            exec(sep = ",")
            {
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return arr.map(v => tostring(v)).join(sep ?? ",");
            },
        })],
        [name(as3ns, "lastIndexOf"), method(
        {
            exec(searchElement, fromIndex = 0x7FFFFFFF)
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                searchElement = coerceorfail(searchElement, elemType, () => {
                    throw new TypeError("Expected search element of type " + nameoftype(elemType));
                });
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return arr.lastIndexOf(searchElement, fromIndex);
            },
        })],
        [name(as3ns, "map"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[VECTOR_SUBARRAY_INDEX];
                const r = [];
                for (let i = 0; i < arr.length; i++)
                {
                    r.push(callbackFn(arr[i], i, this));
                }
                return [applytype(vectorclass, [null]), new Map(), r];
            },
        })],
        [name(as3ns, "pop"), method(
        {
            exec()
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return arr.pop() ?? null;
            },
        })],
        [name(as3ns, "push"), method(
        {
            exec(...args)
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[VECTOR_SUBARRAY_INDEX];
                args = args.map(arg => coerceorfail(arg, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }));
                arr.push(...args);
                return arr.length;
            },
        })],
        [name(as3ns, "removeAt"), method(
        {
            exec(index)
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return arr.splice(index, 1)[0] ?? null;
            },
        })],
        [name(as3ns, "reverse"), method(
        {
            exec()
            {
                const arr = this[VECTOR_SUBARRAY_INDEX];
                arr.reverse();
                return this;
            },
        })],
        [name(as3ns, "shift"), method(
        {
            exec()
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const arr = this[VECTOR_SUBARRAY_INDEX];
                if (arr.length == 0)
                {
                    return null;
                }
                return arr.shift();
            },
        })],
        [name(as3ns, "slice"), method(
        {
            exec(startIndex = 0, endIndex = 0x7FFFFFFF)
            {
                const arr = this[VECTOR_SUBARRAY_INDEX];
                return [this[CONSTRUCTOR_INDEX], new Map(), arr.slice(startIndex, endIndex), false];
            },
        })],
        [name(as3ns, "some"), method(
        {
            exec(callback, thisObject = null)
            {
                callback = call(functionclass, callback);
                let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
                callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
                const arr = this[VECTOR_SUBARRAY_INDEX];
                for (let i = 0; i < arr.length; i++)
                {
                    if (callbackFn(arr[i], i, this))
                    {
                        return true;
                    }
                }
                return false;
            },
        })],
        // sort(sortOptions)
        // sort(compareFunction)
        // sort(compareFunction, sortOptions)
        [name(as3ns, "sort"), method(
        {
            exec(...args)
            {
                let compareFunction = undefined;
                let sortOptions = 0;
                if (args.length == 1 && typeof args[0] == "number")
                {
                    sortOptions = args[0];
                }
                else
                {
                    compareFunction = args[0];
                    sortOptions = args[1];
                }
                sortOptions = sortOptions >>> 0;
                const returnindexedarray = (sortOptions & Array_RETURNINDEXEDARRAY) != 0;

                if (typeof compareFunction == "undefined" || compareFunction === null)
                {
                    compareFunction = (a, b) => compareadvanced(a, b, sortOptions);
                }
                else
                {
                    compareFunction = call(functionclass, compareFunction)[FUNCTION_FUNCTION_INDEX];
                }
                let arr = this[VECTOR_SUBARRAY_INDEX];
                if (returnindexedarray)
                {
                    const indices = [];
                    arr = arr.slice(0);
                    const l = arr.length;
                    for (let i = 0; i < l; i++)
                    {
                        indices.push(i);
                    }
                    for (let i = 0; i < l - 1; i++)
                    {
                        for (let j = 0; j < l - i - 1; j++)
                        {
                            if (compareFunction(arr[j], arr[j + 1]))
                            {
                                const temp = arr[j];
                                arr[j] = arr[j + 1];
                                arr[j + 1] = temp;
                                indices[j] = j + 1;
                                indices[j + 1] = j;
                            }
                        }
                    }
                    return [applytype(arrayclass, [null]), new Map(), indices];
                }
                else
                {
                    arr.sort(compareFunction);
                    return this;
                }
            },
        })],
        // sortOn(fieldName, sortOptions=)
        [name(as3ns, "sortOn"), method(
        {
            exec(fieldName, sortOptions = null)
            {
                const fieldNames = [];
                const sortOptionsByField = [];

                // fieldName => fieldNames
                if (isarray(fieldName))
                {
                    for (const name1 of fieldName[VECTOR_SUBARRAY_INDEX])
                    {
                        fieldNames.push(tostring(name1));
                    }
                }
                else
                {
                    fieldNames.push(tostring(fieldName));
                }

                const numNames = fieldNames.length;

                // sortOptions => sortOptionsByField
                if (isarray(sortOptions))
                {
                    for (const opt of sortOptions[VECTOR_SUBARRAY_INDEX])
                    {
                        sortOptionsByField.push(opt >>> 0);
                    }
                }
                else
                {
                    sortOptionsByField.push(sortOptions >>> 0);
                    sortOptionsByField.push(sortOptionsByField[0]);
                }

                const sortOptionsExcludingFields = sortOptionsByField.slice(fieldNames.length);

                const returnindexedarray = sortOptionsExcludingFields.some(opt => (opt & Array_RETURNINDEXEDARRAY) != 0);
                const descending = sortOptionsExcludingFields.some(opt => (opt & Array_DESCENDING) != 0);

                let compareFunction = (a, b) =>
                {
                    let r = 0;
                
                    for (let i = 0; i < numNames; i++)
                    {
                        const name = fieldNames[i];
                        if (!(inobject(a, name) && inobject(b, name)))
                        {
                            continue;
                        }
                        const a_val = getproperty(a, null, name);
                        const b_val = getproperty(b, null, name);
                        const opt = sortOptionsByField[i] >>> 0;
                        r += compareadvanced(a_val, b_val, opt);
                    }
                
                    return r;
                };

                let arr = this[VECTOR_SUBARRAY_INDEX];
                if (returnindexedarray)
                {
                    const indices = [];
                    arr = arr.slice(0);
                    const l = arr.length;
                    for (let i = 0; i < l; i++)
                    {
                        indices.push(i);
                    }
                    for (let i = 0; i < l - 1; i++) {
                        for (let j = 0; j < l - i - 1; j++) {
                            if (compareFunction(arr[j], arr[j + 1]))
                            {
                                const temp = arr[j];
                                arr[j] = arr[j + 1];
                                arr[j + 1] = temp;
                                indices[j] = j + 1;
                                indices[j + 1] = j;
                            }
                        }
                    }
                    return [applytype(arrayclass, [null]), new Map(), indices];
                }
                else
                {
                    arr.sort(compareFunction);
                    return this;
                }
            },
        })],
        [name(as3ns, "splice"), method(
        {
            exec(startIndex, deleteCount = 0xFFFFFFFF, ...items)
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[VECTOR_SUBARRAY_INDEX];
                items = items.map(item => coerceorfail(item, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }));
                const r = arr.splice(startIndex, deleteCount, ...items);
                return [this[CONSTRUCTOR_INDEX], new Map(), r, false];
            },
        })],
        [name(as3ns, "unshift"), method(
        {
            exec(...args)
            {
                if (this[VECTOR_FIXED_INDEX])
                {
                    throw new Error(fixedVectorMessage);
                }
                const ctor = this[CONSTRUCTOR_INDEX];
                const [elemType] = ctor.argumentslist;
                const arr = this[VECTOR_SUBARRAY_INDEX];
                args = args.map(arg => coerceorfail(arg, elemType, () => {
                    throw new TypeError("Expected item of type " + nameoftype(elemType));
                }));
                return arr.unshift(...args);
            },
        })],
    ]
);

export const vectordoubleclass = applytype(vectorclass, [numberclass]);

vectordoubleclass.specialisedctor = function(length = 0, fixed = false)
{
    this[VECTOR_SUBARRAY_INDEX] = new FlexNumberVector(Float64Array, Number(length), fixed);
};

vectordoubleclass.specialisedprototypenames = new Names([
    [name($publicns, "length"), virtualvar(
    {
        type: uintclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].length;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                if (this[VECTOR_SUBARRAY_INDEX].fixed)
                {
                    throw new Error(fixedVectorMessage);
                }
                this[VECTOR_SUBARRAY_INDEX].length = val >>> 0;
            },
        }),
    })],
    [name($publicns, "fixed"), virtualvar(
    {
        type: booleanclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].fixed;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                this[VECTOR_SUBARRAY_INDEX].fixed = !!val;
            },
        }),
    })],
    [name(as3ns, "concat"), method(
    {
        exec: Vectornumber_concat,
    })],
    [name(as3ns, "every"), method(
    {
        exec: Vectornumber_every,
    })],
    [name(as3ns, "filter"), method(
    {
        exec: Vectornumber_filter,
    })],
    [name(as3ns, "forEach"), method(
    {
        exec: Vectornumber_forEach,
    })],
    [name(as3ns, "includes"), method(
    {
        exec(item)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.includes(item);
        },
    })],
    [name(as3ns, "indexOf"), method(
    {
        exec(searchElement, fromIndex = 0)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.indexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "insertAt"), method(
    {
        exec(index, element)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.splice(index, 0, element);
        },
    })],
    [name(as3ns, "join"), method(
    {
        exec(sep = ",")
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.join(sep ?? ",");
        },
    })],
    [name(as3ns, "lastIndexOf"), method(
    {
        exec(searchElement, fromIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.lastIndexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "map"), method(
    {
        exec(...args)
        {
            const r = Vectornumber_map.apply(this, args);
            return [applytype(vectorclass, [null]), new Map(), Array.from(r[Symbol.iterator]()), false];
        }
    })],
    [name(as3ns, "pop"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.pop();
        },
    })],
    [name(as3ns, "push"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.push(...args);
        },
    })],
    [name(as3ns, "removeAt"), method(
    {
        exec(index)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(index, 1);
            return r.length == 0 ? 0 : r.get(0);
        },
    })],
    [name(as3ns, "reverse"), method(
    {
        exec()
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.reverse();
            return this;
        },
    })],
    [name(as3ns, "shift"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.shift();
        },
    })],
    [name(as3ns, "slice"), method(
    {
        exec(startIndex = 0, endIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return [this[CONSTRUCTOR_INDEX], new Map(), arr.slice(startIndex, endIndex)];
        },
    })],
    [name(as3ns, "some"), method(
    {
        exec: Vectornumber_some,
    })],
    // sort(sortOptions)
    // sort(compareFunction)
    // sort(compareFunction, sortOptions)
    [name(as3ns, "sort"), method(
    {
        exec: Vectornumber_sort,
    })],
    // sortOn(fieldName, sortOptions=)
    [name(as3ns, "sortOn"), method(
    {
        exec: Vectornumber_sortOn,
    })],
    [name(as3ns, "splice"), method(
    {
        exec(startIndex, deleteCount = 0xFFFFFFFF, ...items)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(startIndex, deleteCount, ...items);
            return [this[CONSTRUCTOR_INDEX], new Map(), r];
        },
    })],
    [name(as3ns, "unshift"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.unshift(...args);
        },
    })],
]);

function Vectornumber_concat(...args)
{
    const thisvec = this[VECTOR_SUBARRAY_INDEX];
    const r = thisvec.slice(0);
    for (const arg of args)
    {
        if (isvector(arg))
        {
            for (const v of arg[VECTOR_SUBARRAY_INDEX])
            {
                r.push(v);
            }
        }
        else
        {
            r.push(Number(arg));
        }
    }
    return [this[CONSTRUCTOR_INDEX], new Map(), r];
}

function Vectornumber_every(callback, thisObject = null)
{
    callback = call(functionclass, callback);
    let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
    callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
    const arr = this[VECTOR_SUBARRAY_INDEX];
    for (let i = 0; i < arr.length; i++)
    {
        if (!callbackFn(arr.get(i), i, this))
        {
            return false;
        }
    }
    return true;
}

function Vectornumber_filter(callback, thisObject = null)
{
    callback = call(functionclass, callback);
    let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
    callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
    const arr = this[VECTOR_SUBARRAY_INDEX];
    const r = new FlexNumberVector(arr.typedArrayConstructor);
    for (let i = 0; i < arr.length; i++)
    {
        const item = arr.get(i);
        if (callbackFn(item, i, this))
        {
            r.push(item);
        }
    }
    return r;
}

function Vectornumber_forEach(callback, thisObject = null)
{
    callback = call(functionclass, callback);
    let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
    callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
    const arr = this[VECTOR_SUBARRAY_INDEX];
    for (let i = 0; i < arr.length; i++)
    {
        callbackFn(arr.get(i), i, this);
    }
}

function Vectornumber_map(callback, thisObject = null)
{
    callback = call(functionclass, callback);
    let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
    callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
    const arr = this[VECTOR_SUBARRAY_INDEX];
    const r = new FlexNumberVector(arr.typedArrayConstructor);
    for (let i = 0; i < arr.length; i++)
    {
        r.push(callbackFn(arr.get(i), i, this));
    }
    return r;
}

function Vectornumber_some(callback, thisObject = null)
{
    callback = call(functionclass, callback);
    let callbackFn = callback[FUNCTION_FUNCTION_INDEX];
    callbackFn = thisObject === null || typeof thisObject == "undefined" ? callbackFn : callbackFn.bind(thisObject);
    const arr = this[VECTOR_SUBARRAY_INDEX];
    for (let i = 0; i < arr.length; i++)
    {
        if (callbackFn(arr.get(i), i, this))
        {
            return true;
        }
    }
    return false;
}

function Vectornumber_sort(...args)
{
    let compareFunction = undefined;
    let sortOptions = 0;
    if (args.length == 1 && typeof args[0] == "number")
    {
        sortOptions = args[0];
    }
    else
    {
        compareFunction = args[0];
        sortOptions = args[1];
    }
    sortOptions = sortOptions >>> 0;
    const returnindexedarray = (sortOptions & Array_RETURNINDEXEDARRAY) != 0;

    if (typeof compareFunction == "undefined" || compareFunction === null)
    {
        compareFunction = (a, b) => compareadvanced(a, b, sortOptions);
    }
    else
    {
        compareFunction = call(functionclass, compareFunction)[FUNCTION_FUNCTION_INDEX];
    }
    let arr = this[VECTOR_SUBARRAY_INDEX];
    if (returnindexedarray)
    {
        const indices = [];
        arr = arr.slice(0);
        const l = arr.length;
        for (let i = 0; i < l; i++)
        {
            indices.push(i);
        }
        for (let i = 0; i < l - 1; i++)
        {
            for (let j = 0; j < l - i - 1; j++)
            {
                if (compareFunction(arr.get(j), arr.get(j + 1)))
                {
                    const temp = arr.get(j);
                    arr.set(j, arr.get(j + 1));
                    arr.set(j + 1, temp);
                    indices[j] = j + 1;
                    indices[j + 1] = j;
                }
            }
        }
        return [applytype(arrayclass, [null]), new Map(), indices];
    }
    else
    {
        arr.sort(compareFunction);
        return this;
    }
}

function Vectornumber_sortOn(fieldName, sortOptions = null)
{
    const fieldNames = [];
    const sortOptionsByField = [];

    // fieldName => fieldNames
    if (isarray(fieldName))
    {
        for (const name1 of fieldName[VECTOR_SUBARRAY_INDEX])
        {
            fieldNames.push(tostring(name1));
        }
    }
    else
    {
        fieldNames.push(tostring(fieldName));
    }

    const numNames = fieldNames.length;

    // sortOptions => sortOptionsByField
    if (isarray(sortOptions))
    {
        for (const opt of sortOptions[VECTOR_SUBARRAY_INDEX])
        {
            sortOptionsByField.push(opt >>> 0);
        }
    }
    else
    {
        sortOptionsByField.push(sortOptions >>> 0);
        sortOptionsByField.push(sortOptionsByField[0]);
    }

    const sortOptionsExcludingFields = sortOptionsByField.slice(fieldNames.length);

    const returnindexedarray = sortOptionsExcludingFields.some(opt => (opt & Array_RETURNINDEXEDARRAY) != 0);
    const descending = sortOptionsExcludingFields.some(opt => (opt & Array_DESCENDING) != 0);

    let compareFunction = (a, b) =>
    {
        let r = 0;
    
        for (let i = 0; i < numNames; i++)
        {
            const name = fieldNames[i];
            if (!(inobject(a, name) && inobject(b, name)))
            {
                continue;
            }
            const a_val = getproperty(a, null, name);
            const b_val = getproperty(b, null, name);
            const opt = sortOptionsByField[i] >>> 0;
            r += compareadvanced(a_val, b_val, opt);
        }
    
        return r;
    };

    let arr = this[VECTOR_SUBARRAY_INDEX];
    if (returnindexedarray)
    {
        const indices = [];
        arr = arr.slice(0);
        const l = arr.length;
        for (let i = 0; i < l; i++)
        {
            indices.push(i);
        }
        for (let i = 0; i < l - 1; i++) {
            for (let j = 0; j < l - i - 1; j++) {
                if (compareFunction(arr.get(j), arr.get(j + 1)))
                {
                    const temp = arr.get(j);
                    arr.set(j, arr.get(j + 1));
                    arr.set(j + 1, temp);
                    indices[j] = j + 1;
                    indices[j + 1] = j;
                }
            }
        }
        return [applytype(arrayclass, [null]), new Map(), indices];
    }
    else
    {
        arr.sort(compareFunction);
        return this;
    }
}

export const vectorfloatclass = applytype(vectorclass, [floatclass]);

vectorfloatclass.specialisedctor = function(length = 0, fixed = false)
{
    this[VECTOR_SUBARRAY_INDEX] = new FlexNumberVector(Float32Array, Number(length), fixed);
};

vectorfloatclass.specialisedprototypenames = new Names([
    [name($publicns, "length"), virtualvar(
    {
        type: uintclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].length;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                if (this[VECTOR_SUBARRAY_INDEX].fixed)
                {
                    throw new Error(fixedVectorMessage);
                }
                this[VECTOR_SUBARRAY_INDEX].length = val >>> 0;
            },
        }),
    })],
    [name($publicns, "fixed"), virtualvar(
    {
        type: booleanclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].fixed;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                this[VECTOR_SUBARRAY_INDEX].fixed = !!val;
            },
        }),
    })],
    [name(as3ns, "concat"), method(
    {
        exec: Vectornumber_concat,
    })],
    [name(as3ns, "every"), method(
    {
        exec: Vectornumber_every,
    })],
    [name(as3ns, "filter"), method(
    {
        exec: Vectornumber_filter,
    })],
    [name(as3ns, "forEach"), method(
    {
        exec: Vectornumber_forEach,
    })],
    [name(as3ns, "includes"), method(
    {
        exec(item)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.includes(item);
        },
    })],
    [name(as3ns, "indexOf"), method(
    {
        exec(searchElement, fromIndex = 0)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.indexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "insertAt"), method(
    {
        exec(index, element)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.splice(index, 0, element);
        },
    })],
    [name(as3ns, "join"), method(
    {
        exec(sep = ",")
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.join(sep ?? ",");
        },
    })],
    [name(as3ns, "lastIndexOf"), method(
    {
        exec(searchElement, fromIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.lastIndexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "map"), method(
    {
        exec(...args)
        {
            const r = Vectornumber_map.apply(this, args);
            return [applytype(vectorclass, [null]), new Map(), Array.from(r[Symbol.iterator]()), false];
        }
    })],
    [name(as3ns, "pop"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.pop();
        },
    })],
    [name(as3ns, "push"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.push(...args);
        },
    })],
    [name(as3ns, "removeAt"), method(
    {
        exec(index)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(index, 1);
            return r.length == 0 ? 0 : r.get(0);
        },
    })],
    [name(as3ns, "reverse"), method(
    {
        exec()
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.reverse();
            return this;
        },
    })],
    [name(as3ns, "shift"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.shift();
        },
    })],
    [name(as3ns, "slice"), method(
    {
        exec(startIndex = 0, endIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return [this[CONSTRUCTOR_INDEX], new Map(), arr.slice(startIndex, endIndex)];
        },
    })],
    [name(as3ns, "some"), method(
    {
        exec: Vectornumber_some,
    })],
    // sort(sortOptions)
    // sort(compareFunction)
    // sort(compareFunction, sortOptions)
    [name(as3ns, "sort"), method(
    {
        exec: Vectornumber_sort,
    })],
    // sortOn(fieldName, sortOptions=)
    [name(as3ns, "sortOn"), method(
    {
        exec: Vectornumber_sortOn,
    })],
    [name(as3ns, "splice"), method(
    {
        exec(startIndex, deleteCount = 0xFFFFFFFF, ...items)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(startIndex, deleteCount, ...items);
            return [this[CONSTRUCTOR_INDEX], new Map(), r];
        },
    })],
    [name(as3ns, "unshift"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.unshift(...args);
        },
    })],
]);

export const vectorintclass = applytype(vectorclass, [intclass]);

vectorintclass.specialisedctor = function(length = 0, fixed = false)
{
    this[VECTOR_SUBARRAY_INDEX] = new FlexNumberVector(Int32Array, Number(length), fixed);
};

vectorintclass.specialisedprototypenames = new Names([
    [name($publicns, "length"), virtualvar(
    {
        type: uintclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].length;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                if (this[VECTOR_SUBARRAY_INDEX].fixed)
                {
                    throw new Error(fixedVectorMessage);
                }
                this[VECTOR_SUBARRAY_INDEX].length = val >>> 0;
            },
        }),
    })],
    [name($publicns, "fixed"), virtualvar(
    {
        type: booleanclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].fixed;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                this[VECTOR_SUBARRAY_INDEX].fixed = !!val;
            },
        }),
    })],
    [name(as3ns, "concat"), method(
    {
        exec: Vectornumber_concat,
    })],
    [name(as3ns, "every"), method(
    {
        exec: Vectornumber_every,
    })],
    [name(as3ns, "filter"), method(
    {
        exec: Vectornumber_filter,
    })],
    [name(as3ns, "forEach"), method(
    {
        exec: Vectornumber_forEach,
    })],
    [name(as3ns, "includes"), method(
    {
        exec(item)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.includes(item);
        },
    })],
    [name(as3ns, "indexOf"), method(
    {
        exec(searchElement, fromIndex = 0)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.indexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "insertAt"), method(
    {
        exec(index, element)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.splice(index, 0, element);
        },
    })],
    [name(as3ns, "join"), method(
    {
        exec(sep = ",")
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.join(sep ?? ",");
        },
    })],
    [name(as3ns, "lastIndexOf"), method(
    {
        exec(searchElement, fromIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.lastIndexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "map"), method(
    {
        exec(...args)
        {
            const r = Vectornumber_map.apply(this, args);
            return [applytype(vectorclass, [null]), new Map(), Array.from(r[Symbol.iterator]()), false];
        }
    })],
    [name(as3ns, "pop"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.pop();
        },
    })],
    [name(as3ns, "push"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.push(...args);
        },
    })],
    [name(as3ns, "removeAt"), method(
    {
        exec(index)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(index, 1);
            return r.length == 0 ? 0 : r.get(0);
        },
    })],
    [name(as3ns, "reverse"), method(
    {
        exec()
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.reverse();
            return this;
        },
    })],
    [name(as3ns, "shift"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.shift();
        },
    })],
    [name(as3ns, "slice"), method(
    {
        exec(startIndex = 0, endIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return [this[CONSTRUCTOR_INDEX], new Map(), arr.slice(startIndex, endIndex)];
        },
    })],
    [name(as3ns, "some"), method(
    {
        exec: Vectornumber_some,
    })],
    // sort(sortOptions)
    // sort(compareFunction)
    // sort(compareFunction, sortOptions)
    [name(as3ns, "sort"), method(
    {
        exec: Vectornumber_sort,
    })],
    // sortOn(fieldName, sortOptions=)
    [name(as3ns, "sortOn"), method(
    {
        exec: Vectornumber_sortOn,
    })],
    [name(as3ns, "splice"), method(
    {
        exec(startIndex, deleteCount = 0xFFFFFFFF, ...items)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(startIndex, deleteCount, ...items);
            return [this[CONSTRUCTOR_INDEX], new Map(), r];
        },
    })],
    [name(as3ns, "unshift"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.unshift(...args);
        },
    })],
]);

export const vectoruintclass = applytype(vectorclass, [uintclass]);

vectoruintclass.specialisedctor = function(length = 0, fixed = false)
{
    this[VECTOR_SUBARRAY_INDEX] = new FlexNumberVector(Uint32Array, Number(length), fixed);
};

vectoruintclass.specialisedprototypenames = new Names([
    [name($publicns, "length"), virtualvar(
    {
        type: uintclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].length;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                if (this[VECTOR_SUBARRAY_INDEX].fixed)
                {
                    throw new Error(fixedVectorMessage);
                }
                this[VECTOR_SUBARRAY_INDEX].length = val >>> 0;
            },
        }),
    })],
    [name($publicns, "fixed"), virtualvar(
    {
        type: booleanclass,
        getter: method(
        {
            exec()
            {
                return this[VECTOR_SUBARRAY_INDEX].fixed;
            },
        }),
        setter: method(
        {
            exec(val)
            {
                this[VECTOR_SUBARRAY_INDEX].fixed = !!val;
            },
        }),
    })],
    [name(as3ns, "concat"), method(
    {
        exec: Vectornumber_concat,
    })],
    [name(as3ns, "every"), method(
    {
        exec: Vectornumber_every,
    })],
    [name(as3ns, "filter"), method(
    {
        exec: Vectornumber_filter,
    })],
    [name(as3ns, "forEach"), method(
    {
        exec: Vectornumber_forEach,
    })],
    [name(as3ns, "includes"), method(
    {
        exec(item)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.includes(item);
        },
    })],
    [name(as3ns, "indexOf"), method(
    {
        exec(searchElement, fromIndex = 0)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.indexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "insertAt"), method(
    {
        exec(index, element)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.splice(index, 0, element);
        },
    })],
    [name(as3ns, "join"), method(
    {
        exec(sep = ",")
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.join(sep ?? ",");
        },
    })],
    [name(as3ns, "lastIndexOf"), method(
    {
        exec(searchElement, fromIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.lastIndexOf(searchElement, fromIndex);
        },
    })],
    [name(as3ns, "map"), method(
    {
        exec(...args)
        {
            const r = Vectornumber_map.apply(this, args);
            return [applytype(vectorclass, [null]), new Map(), Array.from(r[Symbol.iterator]()), false];
        }
    })],
    [name(as3ns, "pop"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.pop();
        },
    })],
    [name(as3ns, "push"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.push(...args);
        },
    })],
    [name(as3ns, "removeAt"), method(
    {
        exec(index)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(index, 1);
            return r.length == 0 ? 0 : r.get(0);
        },
    })],
    [name(as3ns, "reverse"), method(
    {
        exec()
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            arr.reverse();
            return this;
        },
    })],
    [name(as3ns, "shift"), method(
    {
        exec()
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.shift();
        },
    })],
    [name(as3ns, "slice"), method(
    {
        exec(startIndex = 0, endIndex = 0x7FFFFFFF)
        {
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return [this[CONSTRUCTOR_INDEX], new Map(), arr.slice(startIndex, endIndex)];
        },
    })],
    [name(as3ns, "some"), method(
    {
        exec: Vectornumber_some,
    })],
    // sort(sortOptions)
    // sort(compareFunction)
    // sort(compareFunction, sortOptions)
    [name(as3ns, "sort"), method(
    {
        exec: Vectornumber_sort,
    })],
    // sortOn(fieldName, sortOptions=)
    [name(as3ns, "sortOn"), method(
    {
        exec: Vectornumber_sortOn,
    })],
    [name(as3ns, "splice"), method(
    {
        exec(startIndex, deleteCount = 0xFFFFFFFF, ...items)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            const r = arr.splice(startIndex, deleteCount, ...items);
            return [this[CONSTRUCTOR_INDEX], new Map(), r];
        },
    })],
    [name(as3ns, "unshift"), method(
    {
        exec(...args)
        {
            if (this[VECTOR_SUBARRAY_INDEX].fixed)
            {
                throw new Error(fixedVectorMessage);
            }
            const arr = this[VECTOR_SUBARRAY_INDEX];
            return arr.unshift(...args);
        },
    })],
]);

$publicns = packagens("");

const PROMISE_PROMISE_INDEX = 2;
export const promiseclass = defineclass(name($publicns, "Promise"),
    {
        final: true,

        ctor(executor)
        {
            executor = call(functionclass, executor)[FUNCTION_FUNCTION_INDEX];
            this[PROMISE_PROMISE_INDEX] = new Promise(executor);;
        },
    },
    [
        // public static function all(promiseList:Array):Promise;
        [name($publicns, "all"), method(
        {
            static: true,
            exec(list)
            {
                if (!isarray(list))
                {
                    throw new ArgumentError("Argument must be an Array.");
                }
                list = (list[ARRAY_SUBARRAY_INDEX]).map(p => call(promiseclass, p)[PROMISE_PROMISE_INDEX]);
                return [promiseclass, new Map(), Promise.all(list).then(vals =>
                {
                    return [applytype(arrayclass, [null]), new Map(), vals];
                })];
            },
        })],
        // public static function allSettled(promiseList:Array):Promise;
        [name($publicns, "allSettled"), method(
        {
            static: true,
            exec(list)
            {
                if (!isarray(list))
                {
                    throw new ArgumentError("Argument must be an Array.");
                }
                list = (list[ARRAY_SUBARRAY_INDEX]).map(p => call(promiseclass, p)[PROMISE_PROMISE_INDEX]);
                return [promiseclass, new Map(), Promise.allSettled(list).then(vals =>
                {
                    const r_arr = [];
                    const r = [applytype(arrayclass, [objectclass]), new Map(), r_arr];
                    for (const obj of vals)
                    {
                        if (obj.status == "fulfilled")
                        {
                            r_arr.push([objectclass, new Map([
                                ["status", obj.status],
                                ["value", obj.value],
                            ])]);
                        }
                        else if (obj.status == "rejected")
                        {
                            r_arr.push([objectclass, new Map([
                                ["status", obj.status],
                                ["reason", obj.reason],
                            ])]);
                        }
                    }
                    return r;
                })];
            },
        })],
        // public static function any(promiseList:Array):Promise;
        [name($publicns, "any"), method(
        {
            static: true,
            exec(list)
            {
                if (!isarray(list))
                {
                    throw new ArgumentError("Argument must be an Array.");
                }
                list = (list[ARRAY_SUBARRAY_INDEX]).map(p => call(promiseclass, p)[PROMISE_PROMISE_INDEX]);
                return [promiseclass, new Map(), Promise.any(list).catch(reason => {
                    if (reason instanceof AggregateError)
                    {
                        reason = construct(aggregateerrorclass, [applytype(arrayclass, [null]), new Map(), reason.errors.slice(0)]);
                    }
                    return reason;
                })];
            },
        })],
        // public static function race(promiseList:Array):Promise;
        [name($publicns, "race"), method(
        {
            static: true,
            exec(list)
            {
                if (!isarray(list))
                {
                    throw new ArgumentError("Argument must be an Array.");
                }
                list = (list[ARRAY_SUBARRAY_INDEX]).map(p => call(promiseclass, p)[PROMISE_PROMISE_INDEX]);
                return [promiseclass, new Map(), Promise.race(list)];
            },
        })],
        // public static function reject(reason:*):Promise<T>;
        [name($publicns, "reject"), method(
        {
            static: true,
            exec(val)
            {
                return [promiseclass, new Map(), Promise.reject(val)];
            },
        })],
        // public static function resolve(value:T):Promise<T>;
        [name($publicns, "resolve"), method(
        {
            static: true,
            exec(val)
            {
                return [promiseclass, new Map(), Promise.resolve(val)];
            },
        })],
        // public function then(onFulfilled:Function, onRejected:Function=):Promise<T>;
        [name($publicns, "then"), method(
        {
            exec(onFulfilled, onRejected)
            {
                onFulfilled = call(functionclass, onFulfilled)[FUNCTION_FUNCTION_INDEX];
                onRejected = onRejected === null || typeof onRejected == "undefined" ? undefined : call(functionclass, onRejected)[FUNCTION_FUNCTION_INDEX];
                return [promiseclass, new Map(), (this[PROMISE_PROMISE_INDEX]).then(onFulfilled, onRejected)];
            },
        })],
        // public function catch(onRejected:Function):Promise<T>;
        [name($publicns, "catch"), method(
        {
            exec(onRejected)
            {
                onRejected = call(functionclass, onRejected)[FUNCTION_FUNCTION_INDEX];
                return [promiseclass, new Map(), (this[PROMISE_PROMISE_INDEX]).catch(onRejected)];
            },
        })],
        // public function finally(onFinally:Function):Promise<T>;
        [name($publicns, "finally"), method(
        {
            exec(onFinally)
            {
                onFinally = call(functionclass, onFinally)[FUNCTION_FUNCTION_INDEX];
                return [promiseclass, new Map(), (this[PROMISE_PROMISE_INDEX]).finally(onFinally)];
            },
        })],
    ]
);

export const REGEXP_REGEXP_INDEX = 2;
export const regexpclass = defineclass(name($publicns, "RegExp"),
    {
        dynamic: true,

        ctor(re, flags)
        {
            this[REGEXP_REGEXP_INDEX] = new RegExp(tostring(re), tostring(flags));
        },
    },
    [
        [name($publicns, "dotall"), virtualvar(
        {
            type: booleanclass,
            getter: method({
                exec()
                {
                    return (this[REGEXP_REGEXP_INDEX]).dotAll;
                },
            }),
            setter: null,
        })],
        [name($publicns, "global"), virtualvar(
        {
            type: booleanclass,
            getter: method({
                exec()
                {
                    return (this[REGEXP_REGEXP_INDEX]).global;
                },
            }),
            setter: null,
        })],
        [name($publicns, "ignoreCase"), virtualvar(
        {
            type: booleanclass,
            getter: method({
                exec()
                {
                    return (this[REGEXP_REGEXP_INDEX]).ignoreCase;
                },
            }),
            setter: null,
        })],
        [name($publicns, "lastIndex"), virtualvar(
        {
            type: numberclass,
            getter: method({
                exec()
                {
                    return (this[REGEXP_REGEXP_INDEX]).lastIndex;
                },
            }),
            setter: method({
                exec(val)
                {
                    (this[REGEXP_REGEXP_INDEX]).lastIndex = Number(val);
                }
            }),
        })],
        [name($publicns, "multiline"), virtualvar(
        {
            type: booleanclass,
            getter: method({
                exec()
                {
                    return (this[REGEXP_REGEXP_INDEX]).multiline;
                },
            }),
            setter: null,
        })],
        [name($publicns, "source"), virtualvar(
        {
            type: stringclass,
            getter: method({
                exec()
                {
                    return (this[REGEXP_REGEXP_INDEX]).source;
                },
            }),
            setter: null,
        })],
        [name($publicns, "exec"), method(
        {
            exec(str)
            {
                const r1 = (this[REGEXP_REGEXP_INDEX]).exec(tostring(str));
                if (r1 === null)
                {
                    return null;
                }
                const r = [applytype(arrayclass, [null]), new Map(), r1];
                setdynamicproperty(r, "index", r1.index);
                setdynamicproperty(r, "input", r1.input);
                return r;
            }
        })],
        [name($publicns, "test"), method(
        {
            exec(str)
            {
                return (this[REGEXP_REGEXP_INDEX]).test(tostring(str));
            }
        })],
    ]
);

export const ERROR_ERROR_INDEX = 2; // ECMAScript "Error"
export const errorclass = defineclass(name($publicns, "Error"),
    {
        dynamic: true,

        ctor(message = "")
        {
            const error = new Error(tostring(message));
            error.name = (this[CONSTRUCTOR_INDEX]).name;
            this[ERROR_ERROR_INDEX] = error;
        },
    },
    [
        [name($publicns, "message"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return (this[ERROR_ERROR_INDEX]).message;
                }
            }),
            setter: method(
            {
                exec(val)
                {
                    (this[ERROR_ERROR_INDEX]).message = tostring(val);
                }
            }),
        })],
        [name($publicns, "name"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return (this[ERROR_ERROR_INDEX]).name;
                }
            }),
            setter: method(
            {
                exec(val)
                {
                    (this[ERROR_ERROR_INDEX]).name = tostring(val);
                }
            }),
        })],
        [name($publicns, "getStackTrace"), method(
        {
            exec()
            {
                return (this[ERROR_ERROR_INDEX]).stack ?? null;
            },
        })],
    ]
);

// after ERROR_ERROR_INDEX
const AGGREGATEERROR_ERRORS_INDEX = 3; // Array of Error
export const aggregateerrorclass = defineclass(name($publicns, "AggregateError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(errors, message = "")
        {
            errorclass.ctor.apply(this, [message]);
            if (!isarray(errors))
            {
                throw new ArgumentError("Argument must be an Array.");
            }
            this[AGGREGATEERROR_ERRORS_INDEX] = errors;
        },
    },
    [
        [name($publicns, "errors"), virtualvar(
        {
            type: arrayclass,
            getter: method(
            {
                exec()
                {
                    return this[AGGREGATEERROR_ERRORS_INDEX];
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    if (!isarray(val))
                    {
                        throw new TypeError("Value must be an Array.");
                    }
                    this[AGGREGATEERROR_ERRORS_INDEX] = val;
                },
            }),
        })],
    ]
);

export const argumenterrorclass = defineclass(name($publicns, "ArgumentError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const definitionerrorclass = defineclass(name($publicns, "DefinitionError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const evalerrorclass = defineclass(name($publicns, "EvalError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const rangeerrorclass = defineclass(name($publicns, "RangeError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const referenceerrorclass = defineclass(name($publicns, "ReferenceError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const securityerrorclass = defineclass(name($publicns, "SecurityError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const syntaxerrorclass = defineclass(name($publicns, "SyntaxError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const typeerrorclass = defineclass(name($publicns, "TypeError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const urierrorclass = defineclass(name($publicns, "URIError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const verifyerrorclass = defineclass(name($publicns, "VerifyError"),
    {
        dynamic: true,
        extendslist: errorclass,

        ctor(message = "")
        {
            errorclass.ctor.apply(this, [message]);
        },
    },
    [
    ]
);

export const MAP_PROPERTIES_INDEX = 2;
export const mapclass = defineclass(name($publicns, "Map"),
    {
        final: true,

        ctor(weakKeys = false)
        {
            this[MAP_PROPERTIES_INDEX] = weakKeys ? new WeakMap() : new Map();
        },
    },
    [
        [name($publicns, "length"), method(
        {
            exec()
            {
                const m =this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap)
                {
                    throw new TypeError("Cannot retrieve the length of a weak Map.");
                }
                return (m).size;
            },
        })],
        [name($publicns, "apply"), method(
        {
            exec(key, args)
            {
                return callproperty(this, null, "call", key, ...args);
            },
        })],
        [name($publicns, "call"), method(
        {
            exec(key, ...args)
            {
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap && !(key instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                const v = m.get(key);
                if (!istype(v, functionclass))
                {
                    throw new TypeError("Value is not a function.");
                }
                return v[FUNCTION_FUNCTION_INDEX](...args);
            },
        })],
        [name($publicns, "has"), method(
        {
            exec(key)
            {
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap && !(key instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                return m.has(key);
            },
        })],
        [name($publicns, "hasOwnProperty"), method(
        {
            exec(key)
            {
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap && !(key instanceof Array))
                {
                    throw new ReferenceError("Weak key must be a managed Object.");
                }
                return m.has(key);
            },
        })],
        [name($publicns, "entries"), method(
        {
            exec()
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [keyType, valueType] = ctor.argumentslist;
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap)
                {
                    throw new ReferenceError("Cannot enumerate entries of a weak Map.");
                }
                const list = Array.from(m.entries()).map(entry => [tupletype([keyType, valueType]), untoucheddynamic, entry]);
                return [applytype(arrayclass, [tupletype([keyType, valueType])]), new Map(), list];
            },
        })],
        [name($publicns, "keys"), method(
        {
            exec()
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [keyType,] = ctor.argumentslist;
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap)
                {
                    throw new ReferenceError("Cannot enumerate keys of a weak Map.");
                }
                return [applytype(arrayclass, [keyType]), new Map(), Array.from(m.keys())];
            },
        })],
        [name($publicns, "values"), method(
        {
            exec()
            {
                const ctor = this[CONSTRUCTOR_INDEX];
                const [, valueType] = ctor.argumentslist;
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap)
                {
                    throw new ReferenceError("Cannot enumerate values of a weak Map.");
                }
                return [applytype(arrayclass, [valueType]), new Map(), Array.from(m.values())];
            },
        })],
        [name($publicns, "clear"), method(
        {
            exec()
            {
                const m = this[MAP_PROPERTIES_INDEX];
                if (m instanceof WeakMap)
                {
                    throw new ReferenceError("Cannot clear a weak Map.");
                }
                m.clear();
            },
        })],
    ]
);

skipParameterizedMap = false;

$publicns = packagens("whack.utils");

// public function describeType(val:*):XML;
definemethod($publicns, "describeType", {
    exec(val)
    {
        if (istype(val, classclass))
            {
            const classobj = val[CLASS_CLASS_INDEX];
            if (classobj instanceof Interface)
            {
                const metadata = describe_metadata(classobj.metadata);

                return construct(xmlclass, "<interface>" + metadata + "</interface>");
            }

            if (classobj instanceof Class)
            {
                const metadata = describe_metadata(classobj.metadata);
                const static_props = [];
                const instance_props = [];
                return construct(xmlclass, "<class>" + metadata + "<static>" + describe_props(classobj.staticnames) + "</static><instance>" + describe_props(classobj.prototypenames) + "</instance></class>");
            }

            return null;
        }
        else
        {
            return null;
        }
    }
});

function describe_props(names)
{
    const r = [];
    for (const [name, trait] of names.dictionary())
    {
        if ((name.ns instanceof Systemns && name.ns.kind != Systemns.PUBLIC) || name.ns instanceof Userns)
        {
            continue;
        }

        const ns = name.ns instanceof Systemns ? "" : name.ns.uri.replace(/&/g, "&#38;").replace(/"/g, "&#34;");
        const localname = name.name.replace(/&/g, "&#38;").replace(/"/g, "&#34;");

        if (trait instanceof Variable)
        {
            const metadata = describe_metadata(trait.metadata);
            r.push(`<variable namespace="${ns}" localName="${localname}">${metadata}</variable>`);
        }
        else if (trait instanceof VirtualVariable)
        {
            const metadata = describe_metadata(trait.metadata);
            r.push(`<variable namespace="${ns}" localName="${localname}">${metadata}</variable>`);
        }
        else if (trait instanceof Method)
        {
            const metadata = describe_metadata(trait.metadata);
            r.push(`<method namespace="${ns}" localName="${localname}">${metadata}</method>`);
        }
    }
    return r.join("");
}

function describe_metadata(metadata)
{
    const r = [];
    for (const metadata1 of metadata)
    {
        if (!/[\w+]/.test(metadata1.name))
        {
            continue;
        }
        const entries = [];
        for (const entry of metadata1.entries)
        {
            const k = entry[0] ? entry[0].replace(/&/g, "&#38;").replace(/"/g, "&#34;") : "";
            const v = entry[1].replace(/&/g, "&#38;").replace(/"/g, "&#34;");
            entries.push(`<entry key="${k}" value="${v}"/>`);
        }
        r.push(`<${metadata1.name}>${entries.join("")}</${metadata1.name}>`);
    }
    return r.join("");
}

// public interface IDataInput { ... }
export const idatainputitrfc = defineinterface(name($publicns, "IDataInput"), {}, []);

// public interface IDataOutput { ... }
export const idataoutputitrfc = defineinterface(name($publicns, "IDataOutput"), {}, []);

const availableEndianConstants = ["bigEndian", "littleEndian"];

export const BYTEARRAY_BA_INDEX = 2;
export const bytearrayclass = defineclass(name($publicns, "ByteArray"),
    {
        implementslist: [idatainputitrfc, idataoutputitrfc],

        ctor()
        {
            this[BYTEARRAY_BA_INDEX] = new ByteArray();
        },
    },
    [
        [name($publicns, "zeroes"), method(
        {
            static: true,
            exec(length)
            {
                return [bytearrayclass, new Map(), ByteArray.zeroes(length)];
            },
        })],
        [name(jsbridgefromns, "arrayBuffer"), method(
        {
            static: true,
            exec(arg)
            {
                return [bytearrayclass, new Map(), ByteArray.from(arg)];
            },
        })],
        [name(jsbridgefromns, "byteArray"), method(
        {
            static: true,
            exec(arg)
            {
                return [bytearrayclass, new Map(), ByteArray.from(arg)];
            },
        })],
        [name(jsbridgetons, "arrayBuffer"), method(
        {
            exec()
            {
                return this[BYTEARRAY_BA_INDEX].toArrayBuffer();
            },
        })],
        [name(jsbridgetons, "buffer"), method(
        {
            exec()
            {
                return this[BYTEARRAY_BA_INDEX].toBuffer();
            },
        })],
        [name($publicns, "clone"), method(
        {
            exec()
            {
                return [bytearrayclass, new Map(), (this[BYTEARRAY_BA_INDEX]).clone()];
            },
        })],
        [name($publicns, "equals"), method(
        {
            exec(arg)
            {
                if (!istype(arg, bytearrayclass))
                {
                    throw new ArgumentError("Argument must be a ByteArray.");
                }
                return (this[BYTEARRAY_BA_INDEX]).equals(arg[BYTEARRAY_BA_INDEX]);
            },
        })],
        [name($publicns, "endian"), virtualvar(
        {
            type: stringclass,
            getter: method(
            {
                exec()
                {
                    return (this[BYTEARRAY_BA_INDEX]).endian;
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    if (availableEndianConstants.indexOf(val) == -1)
                    {
                        throw new Error("Invalid Endian constant.");
                    }
                    (this[BYTEARRAY_BA_INDEX]).endian = val;
                },
            }),
        })],
        [name($publicns, "length"), virtualvar(
        {
            type: uintclass,
            getter: method(
            {
                exec()
                {
                    return (this[BYTEARRAY_BA_INDEX]).length;
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    (this[BYTEARRAY_BA_INDEX]).length = val;
                },
            }),
        })],
        [name($publicns, "position"), virtualvar(
        {
            type: uintclass,
            getter: method(
            {
                exec()
                {
                    return (this[BYTEARRAY_BA_INDEX]).position;
                },
            }),
            setter: method(
            {
                exec(val)
                {
                    (this[BYTEARRAY_BA_INDEX]).position = val;
                },
            }),
        })],
        [name($publicns, "bytesAvailable"), virtualvar(
        {
            type: uintclass,
            getter: method(
            {
                exec()
                {
                    return (this[BYTEARRAY_BA_INDEX]).bytesAvailable;
                },
            }),
            setter: null,
        })],
        [name($publicns, "readUnsignedByte"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position >= ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readUnsignedByte();
            },
        })],
        [name($publicns, "writeUnsignedByte"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeUnsignedByte(value);
            },
        })],
        [name($publicns, "readByte"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position >= ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readByte();
            },
        })],
        [name($publicns, "writeByte"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeByte(value);
            },
        })],
        [name($publicns, "readShort"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + 2 > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readShort();
            },
        })],
        [name($publicns, "writeShort"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeShort(value);
            },
        })],
        [name($publicns, "readUnsignedShort"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + 2 > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readUnsignedShort();
            },
        })],
        [name($publicns, "writeUnsignedShort"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeUnsignedShort(value);
            },
        })],
        [name($publicns, "readInt"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + 4 > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readInt();
            },
        })],
        [name($publicns, "writeInt"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeInt(value);
            },
        })],
        [name($publicns, "readUnsignedInt"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + 4 > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readUnsignedInt();
            },
        })],
        [name($publicns, "writeUnsignedInt"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeUnsignedInt(value);
            },
        })],
        [name($publicns, "readFloat"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + 4 > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readFloat();
            },
        })],
        [name($publicns, "writeFloat"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeFloat(value);
            },
        })],
        [name($publicns, "readDouble"), method(
        {
            exec()
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + 8 > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readDouble();
            },
        })],
        [name($publicns, "writeDouble"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeDouble(value);
            },
        })],
        [name($publicns, "readUTF"), method(
        {
            exec(length)
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + length > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return ba.readUTF(length);
            },
        })],
        [name($publicns, "writeUTF"), method(
        {
            exec(value)
            {
                (this[BYTEARRAY_BA_INDEX]).writeUTF(value);
            },
        })],
        [name($publicns, "readBytes"), method(
        {
            exec(length)
            {
                const ba = this[BYTEARRAY_BA_INDEX];
                if (ba.position + length > ba.length)
                {
                    throw new RangeError("Insufficient data available to read.");
                }
                return [bytearrayclass, new Map(), ba.readBytes(length)];
            },
        })],
        [name($publicns, "writeBytes"), method(
        {
            exec(value)
            {
                if (!istype(value, bytearrayclass))
                {
                    throw new ArgumentError("Argument must be a ByteArray.");
                }
                (this[BYTEARRAY_BA_INDEX]).writeByte(value[BYTEARRAY_BA_INDEX]);
            },
        })],
        [name($publicns, "clear"), method(
        {
            exec()
            {
                (this[BYTEARRAY_BA_INDEX]).clear();
            },
        })],
    ]
);

export const proxyclass = defineclass(name($publicns, "Proxy"),
    {
        ctor()
        {
        },
    },
    [
        [name(whackproxyns, "callProperty"), method(
        {
            exec(name, ...rest)
            {
            },
        })],
        [name(whackproxyns, "deleteProperty"), method(
        {
            exec(name)
            {
                return false;
            },
        })],
        [name(whackproxyns, "getDescendants"), method(
        {
            exec(name)
            {
                return undefined;
            },
        })],
        [name(whackproxyns, "getProperty"), method(
        {
            exec(name)
            {
                return undefined;
            },
        })],
        [name(whackproxyns, "hasProperty"), method(
        {
            exec(name)
            {
                return false;
            },
        })],
        [name(whackproxyns, "nextName"), method(
        {
            exec(index)
            {
                return "";
            },
        })],
        [name(whackproxyns, "nextNameIndex"), method(
        {
            exec(index)
            {
                return 0;
            },
        })],
        [name(whackproxyns, "nextValue"), method(
        {
            exec(index)
            {
                return undefined;
            },
        })],
        [name(whackproxyns, "setProperty"), method(
        {
            exec(name, value)
            {
            },
        })],
    ]
);

// Initialize prototypes

const $builtinclasses = [
    objectclass,
    numberclass,
    intclass,
    uintclass,
    floatclass,
    booleanclass,
    stringclass,
    namespaceclass,
    qnameclass,
    xmlclass,
    xmllistclass,
    classclass,
    dateclass,
    functionclass,
    arrayclass,
    vectorclass,
    promiseclass,
    regexpclass,
    errorclass,
    aggregateerrorclass,
    argumenterrorclass,
    definitionerrorclass,
    evalerrorclass,
    rangeerrorclass,
    referenceerrorclass,
    securityerrorclass,
    syntaxerrorclass,
    typeerrorclass,
    urierrorclass,
    verifyerrorclass,
    mapclass,
    bytearrayclass,
    proxyclass,
];

for (const classobj of $builtinclasses)
{
    classobj.ecmaprototype = construct(objectclass);
}

$setPrototypeNow = true;

// Globals: set values

$publicns = packagens("");

setglobal($publicns, "undefined", undefined);

setglobal($publicns, "NaN", NaN);

setglobal($publicns, "Infinity", Infinity);

// Prototype: set properties

setdynamicproperty(objectclass.ecmaprototype, "hasOwnProperty", [functionclass, new Map(), function(name)
    {
        return hasownproperty(this, tostring(name));
    }]);

setdynamicproperty(objectclass.ecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    return tostring(this);
}]);

setdynamicproperty(objectclass.ecmaprototype, "toString", [functionclass, new Map(), function()
{
    return tostring_objimpl(this);
}]);

setdynamicproperty(objectclass.ecmaprototype, "valueOf", [functionclass, new Map(), function()
{
    return this;
}]);

setdynamicproperty(arrayclass.ecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    const arr = this[ARRAY_SUBARRAY_INDEX];
    return arr.map(v => tostring(v)).join(",");
}]);

setdynamicproperty(arrayclass.ecmaprototype, "toString", [functionclass, new Map(), function()
{
    const arr = this[ARRAY_SUBARRAY_INDEX];
    return arr.map(v => tostring(v)).join(",");
}]);

setdynamicproperty(vectorclass.ecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.map(v => tostring(v)).join(",");
}]);

setdynamicproperty(vectorclass.ecmaprototype, "toString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.map(v => tostring(v)).join(",");
}]);

vectordoubleclass.specialisedecmaprototype = construct(objectclass);

setdynamicproperty(vectordoubleclass.specialisedecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

setdynamicproperty(vectordoubleclass.specialisedecmaprototype, "toString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

vectorfloatclass.specialisedecmaprototype = construct(objectclass);

setdynamicproperty(vectorfloatclass.specialisedecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

setdynamicproperty(vectorfloatclass.specialisedecmaprototype, "toString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

vectorintclass.specialisedecmaprototype = construct(objectclass);

setdynamicproperty(vectorintclass.specialisedecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

setdynamicproperty(vectorintclass.specialisedecmaprototype, "toString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

vectoruintclass.specialisedecmaprototype = construct(objectclass);

setdynamicproperty(vectoruintclass.specialisedecmaprototype, "toLocaleString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

setdynamicproperty(vectoruintclass.specialisedecmaprototype, "toString", [functionclass, new Map(), function()
{
    const arr = this[VECTOR_SUBARRAY_INDEX];
    return arr.join(",");
}]);

setdynamicproperty(errorclass.ecmaprototype, "toString", [functionclass, new Map(), function()
{
    return (this[ERROR_ERROR_INDEX]).toString();
}]);
