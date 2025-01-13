# Instance objects

ActionScript instance objects are represented as a JavaScript `Array` in the format `[constructor, dynamicProperties, fixture1, ...fixtureN]`.

## Tuples

Tuples are in the same compatible format, `[tupleType, unusedDynamicProperties, element1, ...elementN]`.

## Array.\<T>

Arrays have a constructor that is represented by a `SpecialTypeAfterSub` JS object.

## Vector.\<T>

Like arrays, vectors have a constructor that is represented by a `SpecialTypeAfterSub` JS object.

## Map.\<K, V>

Like arrays, maps have a constructor that is represented by a `SpecialTypeAfterSub` JS object.

## Other parameterized types

Parameterized classes other than Array, Vector and Map are simply erased and are
treated as normal classes. Type parameters of interfaces are always erased as well.