export function assert(value, message = "")
{
    if (!value)
    {
        throw new Error(message);
    }
}

const INITIAL_CAPACITY = 3;

function assertNotFixedVectorError(value)
{
    if (value)
    {
        throw new RangeError("The fixed property is set to true.");
    }
}

export class FlexNumberVector
{
    typedArrayConstructor;
    m_array;
    m_length = 0;
    m_fixed;

    constructor(typedArrayConstructor, argument = 0, fixed = false)
    {
        this.typedArrayConstructor = typedArrayConstructor;
        if (typeof argument == "number")
        {
            argument = Math.max(0, argument >>> 0);
            this.m_array = new typedArrayConstructor(Math.max(INITIAL_CAPACITY, argument));
            this.m_length = argument;
        }
        else
        {
            if (argument.length == 0)
            {
                this.m_array = new typedArrayConstructor(INITIAL_CAPACITY);
                this.m_length = 0;
            } else {
                this.m_array = new typedArrayConstructor(argument);
                this.m_length = argument.length;
            }
        }
        this.m_fixed = fixed;
    }

    entries()
    {
        return this.m_array.subarray(0, this.m_length).entries();
    }

    keys()
    {
        return this.m_array.subarray(0, this.m_length).keys();
    }

    values()
    {
        return this.m_array.subarray(0, this.m_length).values();
    }

    get length()
    {
        return this.m_length;
    }

    set length(value)
    {
        value = Number(value);
        if (value == this.m_length)
        {
            return;
        }
        assertNotFixedVectorError(this.m_fixed);
        value = Math.max(0, value >>> 0);
        if (value > this.m_array.length)
        {
            const k = this.m_array;
            this.m_array = new this.typedArrayConstructor(k.length + (value - k.length));
            this.m_array.set(k.subarray(0, k.length));
            this.m_length = value;
        }
        else if (value == 0)
        {
            this.m_array = new this.typedArrayConstructor(INITIAL_CAPACITY);
            this.m_length = 0;
        }
        else
        {
            this.m_array = this.m_array.slice(0, value);
            this.m_length = value;
        }
    }

    get fixed()
    {
        return this.m_fixed;
    }

    set fixed(value)
    {
        this.m_fixed = !!value;
    }

    *[Symbol.iterator]()
    {
        for (let i = 0; i < this.m_length; i++)
        {
            yield this.m_array[i];
        }
    }

    hasIndex(index)
    {
        index = index >>0;
        return index >= 0 && index < this.m_length;
    }

    get(index)
    {
        index = index >> 0;
        return index >= 0 && index < this.m_length ? this.m_array[index] : 0;
    }

    /**
     * @throws {Error} If index is out of range.
     */
    set(index, value)
    {
        index = index >> 0;
        value = Number(value);
        if (index == this.m_length)
        {
            assertNotFixedVectorError(this.m_fixed);
            this.push(value);
        }
        if (index < 0 || index >= this.m_length)
        {
            throw new RangeError("Index is out of bounds (index=" + index + ", length=" + this.m_length + ")");
        }
        this.m_array[index] = value;
    }

    includes(item)
    {
        return this.indexOf(item) != -1;
    }

    concat(...args)
    {
        const result = this.slice(0);
        for (const arg of args)
        {
            if (arg instanceof FlexNumberVector)
            {
                const appendice = arg.m_array;
                const k = result.m_array;
                const kmlen = result.m_length;
                result.m_length += appendice.length;
                let newCapacity = kmlen;
                newCapacity = newCapacity < result.m_length ? result.m_length : newCapacity;
                result.m_array = new this.typedArrayConstructor(newCapacity);
                result.m_array.set(k.subarray(0, kmlen));
                result.m_array.set(appendice, kmlen);
            }
            else
            {
                result.push(Number(arg));
            }
        }
        return result;
    }

    push(...args)
    {
        assertNotFixedVectorError(this.m_fixed);
        args = args instanceof Array ? args : [];
        args = args.map(v => Number(v));
        if (args.length == 1)
        {
            this._push1(args[0]);
        }
        else
        {
            const appendice = new this.typedArrayConstructor(args);
            const k = this.m_array;
            const kmlen = this.m_length;
            this.m_length += appendice.length;
            let newCapacity = kmlen;
            newCapacity = newCapacity < this.m_length ? this.m_length : newCapacity;
            this.m_array = new this.typedArrayConstructor(newCapacity);
            this.m_array.set(k.subarray(0, kmlen));
            this.m_array.set(appendice, kmlen);
        }
        return this.m_length;
    }

    _push1(value)
    {
        const i = this.m_length++;
        if (i >= this.m_array.length)
        {
            const k = this.m_array;
            this.m_array = new this.typedArrayConstructor(k.length * 2);
            this.m_array.set(k.subarray(0, i));
        }
        this.m_array[i] = Number(value);
    }

    shift()
    {
        assertNotFixedVectorError(this.m_fixed);
        if (this.m_length == 0)
        {
            return 0;
        }
        const k = this.m_array;
        this.m_length--;
        this.m_array = new this.typedArrayConstructor(k.length);
        this.m_array.set(k.subarray(1, this.m_length + 1));
        return k[0];
    }

    pop()
    {
        assertNotFixedVectorError(this.m_fixed);
        return this.m_length == 0 ? 0 : this.m_array[--this.m_length];
    }

    join(sep = ",")
    {
        return this.m_array.join(sep);
    }

    unshift(...args)
    {
        assertNotFixedVectorError(this.m_fixed);
        args = args instanceof Array ? args : [];
        args = args.map(v => Number(v));
        if (args.length == 0)
        {
            return this.m_length;
        }
        const k = this.m_array;
        const kmlen = this.m_length;
        this.m_length += args.length;
        let newCapacity = k.length;
        newCapacity = newCapacity < this.m_length ? newCapacity * 2 : newCapacity;
        this.m_array = new this.typedArrayConstructor(newCapacity);
        this.m_array.set(new this.typedArrayConstructor(args), 0);
        this.m_array.set(k.subarray(0, kmlen), args.length);
        return this.m_length;
    }

    insertAt(index, element)
    {
        assertNotFixedVectorError(this.m_fixed);
        index = Math.max(0, index >>> 0);
        element = Number(element);
        if (index >= this.m_length)
        {
            throw new RangeError("Index is out of bounds (index=" + index + ", length=" + this.m_length + ")");
        }
        const k = this.m_array;
        this.m_length++;
        let newCapacity = k.length;
        newCapacity = newCapacity < this.m_length ? newCapacity * 2 : newCapacity;
        this.m_array = new this.typedArrayConstructor(k.length);
        this.m_array.set(k.subarray(0, index));
        this.m_array[index] = element;
        this.m_array.set(k.subarray(index, this.m_length), index + 1);
    }

    removeAt(index)
    {
        assertNotFixedVectorError(this.m_fixed);
        index = Math.max(0, index >>> 0);
        if (index >= this.m_length)
        {
            throw new RangeError("Index is out of bounds (index=" + index + ", length=" + this.m_length + ")");
        }
        const r = this.m_array[index];
        const k = this.m_array;
        this.m_length--;
        this.m_array = new this.typedArrayConstructor(k.length);
        this.m_array.set(k.subarray(0, index));
        this.m_array.set(k.subarray(index + 1, this.m_length + 1), index);
        return r;
    }
    
    splice(startIndex, deleteCount = 0xFFFFFFFF, ...items)
    {
        assertNotFixedVectorError(this.m_fixed);

        startIndex = Math.max(0, startIndex >>> 0);
        deleteCount = Math.max(0, deleteCount >>> 0);
        items = items instanceof Array ? items : [];
        items = items.map(v => Number(v));

        if (startIndex >= this.m_length)
        {
            throw new RangeError("Index is out of bounds (index=" + startIndex + ", length=" + this.m_length + ")");
        }
        if (startIndex + deleteCount > this.m_length)
        {
            deleteCount = this.m_length - startIndex;
        }

        const k = this.m_array;
        const kmlen = this.m_length;
        this.m_length = kmlen - deleteCount + items.length;
        let newCapacity = k.length;
        newCapacity = newCapacity < this.m_length ? this.m_length : newCapacity;
        this.m_array = new this.typedArrayConstructor(newCapacity);
        this.m_array.set(k.subarray(0, startIndex));
        this.m_array.set(new this.typedArrayConstructor(items), startIndex);
        this.m_array.set(k.subarray(startIndex + deleteCount, kmlen), startIndex + items.length);
        const r = k.slice(startIndex, startIndex + deleteCount);
        return new FlexNumberVector(this.typedArrayConstructor, r);
    }

    slice(startIndex = 0, endIndex = 0x7FFFFFFF)
    {
        startIndex = Math.max(0, startIndex >>> 0);
        endIndex = Math.max(0, endIndex >>> 0);
        startIndex = this.hasIndex(startIndex) ? startIndex : this.m_length;
        endIndex = endIndex < startIndex ? startIndex : endIndex;
        return new FlexNumberVector(this.typedArrayConstructor, this.m_array.slice(startIndex, endIndex));
    }
    
    sort(sortBehavior)
    {
        this.m_array.sort(sortBehavior);
        return this;
    }

    reverse() {
        this.m_array.reverse();
        return this;
    }

    indexOf(searchElement, fromIndex = 0)
    {
        searchElement = Number(searchElement);
        fromIndex = Math.max(0, fromIndex >>> 0);
        fromIndex = this.hasIndex(fromIndex) ? fromIndex : this.m_length;
        return this.m_array.indexOf(searchElement, fromIndex);
    }

    lastIndexOf(searchElement, fromIndex = 0x7FFFFFFF)
    {
        searchElement = Number(searchElement);
        fromIndex = Math.max(0, (fromIndex ?? 0x7FFFFFFF) >>> 0);
        fromIndex = this.hasIndex(fromIndex) ? fromIndex : this.m_length;
        return this.m_array.lastIndexOf(searchElement, fromIndex);
    }

    toString()
    {
        return this.m_array.toString();
    }

    toLocaleString()
    {
        return this.m_array.toLocaleString();
    }
}

export function isXMLName(argument)
{
    argument = String(argument);
    return /[a-z_][a-z_0-9.\-]*/i.test(argument);
}

const validEndianSet = ["bigEndian", "littleEndian"];

export class ByteArray
{
    static INITIAL_CAPACITY = 8;
    m_dataview;
    m_u8array;
    m_position = 0;
    m_length = 0;
    m_endian = "bigEndian";

    constructor(initialCapacityArg)
    {
        let initialCapacity = initialCapacityArg === undefined ? ByteArray.INITIAL_CAPACITY : initialCapacityArg;
        assert(initialCapacity >= 2, 'ByteArray initial capacity must be >= 2.');
        this.m_dataview = new DataView(new ArrayBuffer(initialCapacity));
        this.m_u8array = new Uint8Array(this.m_dataview.buffer);
    }

    static withCapacity(bytes)
    {
        return new ByteArray(bytes);
    }

    static zeroes(length)
    {
        const r = new ByteArray();
        r.m_dataview = new DataView(new ArrayBuffer(Math.max(2, length >> 0)));
        r.m_u8array = new Uint8Array(r.m_dataview.buffer);
        r.m_length = length;
        return r;
    }

    static from(arg)
    {
        const r = new ByteArray();
        if (arg instanceof ByteArray)
        {
            r.m_dataview = new DataView(arg.m_dataview.buffer.slice(0));
            r.m_u8array = new Uint8Array(r.m_dataview.buffer);
            r.m_length = arg.m_length;
            return r;
        }
        r.m_dataview = new DataView(arg instanceof Uint8Array ? arg.buffer : arg);
        r.m_u8array = new Uint8Array(r.m_dataview.buffer);
        r.m_length = r.m_dataview.byteLength;
        return r;
    }

    clone()
    {
        return ByteArray.from(this);
    }

    toArrayBuffer()
    {
        return this.m_dataview.buffer;
    }

    toBuffer()
    {
        return Buffer.from(this.m_dataview.buffer.slice(0));
    }

    equals(other)
    {
        const l = this.m_length;
        if (l != other.m_length)
        {
            return false;
        }
        for (let i = 0; i < l; i++)
        {
            if (this.m_u8array[i] != other.m_u8array[i])
            {
                return false;
            }
        }
        return true;
    }
    
    get endian()
    {
        return this.m_endian;
    }

    set endian(val)
    {
        assert(validEndianSet.indexOf(val) != -1);
        this.m_endian = val;
    }

    get length()
    {
        return this.m_length >>> 0;
    }

    set length(val)
    {
        this.m_length = Math.min(Math.max(0, val >>> 0), this.m_length);
    }

    get position()
    {
        return this.m_position >>> 0;
    }

    set position(val)
    {
        this.m_position = Math.min(Math.max(val >>> 0, 0), this.m_length);
    }

    get bytesAvailable()
    {
        return this.length - this.position;
    }

    get(position)
    {
        return position < this.m_length ? this.m_u8array[position] : 0;
    }

    set(position, val)
    {
        if (position >= this.m_length)
        {
            throw new RangeError("Index is out of bounds (index=" + position + ", length=" + this.m_length + ")");
        }
        this.m_u8array[position] = val >>> 0;
    }

    paygrow(length)
    {
        const ipl = this.m_position + length;
        // double buffer capacity as needed
        while (ipl > this.m_dataview.byteLength)
        {
            const arraybuf = new ArrayBuffer(this.m_dataview.byteLength * 2);
            this.m_dataview = new DataView(arraybuf);
            const k = this.m_u8array;
            this.m_u8array = new Uint8Array(arraybuf);
            this.m_u8array.set(k.subarray(0, this.m_length));
        }
        const newBytes = -(this.m_length - ipl);
        this.m_length += Math.max(0, newBytes);
    }

    *[Symbol.iterator]()
    {
        for (let i = 0; i < this.m_length; i++)
        {
            yield this.m_u8array[i];
        }
    }

    *keys()
    {
        for (let i = 0; i < this.m_length; i++)
        {
            yield i;
        }
    }

    *values()
    {
        for (let i = 0; i < this.m_length; i++)
        {
            yield this.m_u8array[i];
        }
    }

    readUnsignedByte() {
        assert(this.m_position < this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getUint8(this.m_position);
        this.m_position += 1;
        return k;
    }

    writeUnsignedByte(value) {
        this.paygrow(1);
        this.m_dataview.setUint8(this.m_position, value);
        this.m_position += 1;
    }

    readByte() {
        assert(this.m_position < this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getInt8(this.m_position);
        this.m_position += 1;
        return k;
    }

    writeByte(value) {
        this.paygrow(1);
        this.m_dataview.setInt8(this.m_position, value);
        this.m_position += 1;
    }

    readShort() {
        assert(this.m_position + 2 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getInt16(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 2;
        return k;
    }

    writeShort(value) {
        this.paygrow(2);
        this.m_dataview.setInt16(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 2;
    }

    readUnsignedShort() {
        assert(this.m_position + 2 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getUint16(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 2;
        return k;
    }

    writeUnsignedShort(value) {
        this.paygrow(2);
        this.m_dataview.setUint16(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 2;
    }

    readInt() {
        assert(this.m_position + 4 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getInt32(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 4;
        return k;
    }

    writeInt(value) {
        this.paygrow(4);
        this.m_dataview.setInt32(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 4;
    }

    readUnsignedInt() {
        assert(this.m_position + 4 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getUint32(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 4;
        return k;
    }

    writeUnsignedInt(value) {
        this.paygrow(4);
        this.m_dataview.setUint32(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 4;
    }

    readLong() {
        assert(this.m_position + 8 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getBigInt64(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 8;
        return k;
    }

    writeLong(value) {
        this.paygrow(8);
        this.m_dataview.setBigInt64(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 8;
    }

    readUnsignedLong() {
        assert(this.m_position + 8 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getBigUint64(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 8;
        return k;
    }

    writeUnsignedLong(value) {
        this.paygrow(8);
        this.m_dataview.setBigUint64(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 8;
    }

    readFloat() {
        assert(this.m_position + 4 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getFloat32(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 4;
        return k;
    }

    writeFloat(value) {
        this.paygrow(4);
        this.m_dataview.setFloat32(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 4;
    }

    readDouble() {
        assert(this.m_position + 8 <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_dataview.getFloat64(this.m_position, this.m_endian == "littleEndian");
        this.m_position += 8;
        return k;
    }

    writeDouble(value) {
        this.paygrow(8);
        this.m_dataview.setFloat64(this.m_position, value, this.m_endian == "littleEndian");
        this.m_position += 8;
    }

    readUTF(length) {
        assert(this.m_position + length <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_u8array.subarray(this.m_position, this.m_position + length);
        this.m_position += length;
        return new TextDecoder().decode(k);
    }

    writeUTF(value) {
        var u8arr = new TextEncoder().encode(value);
        this.paygrow(u8arr.length);
        this.m_u8array.set(u8arr, this.m_position);
        this.m_position += u8arr.length;
    }

    readBytes(length) {
        assert(this.m_position + length <= this.m_length, 'Insufficient data available to read.');
        let k = this.m_u8array.subarray(this.m_position, this.m_position + length);
        this.m_position += length;
        return ByteArray.from(k);
    }

    writeBytes(value) {
        const u8arr = value.m_u8array;
        this.paygrow(u8arr.length);
        this.m_u8array.set(u8arr, this.m_position);;
        this.m_position += u8arr.length;
    }

    clear() {
        this.m_position = 0;
        this.m_length = 0;
        const arraybuf = new ArrayBuffer(ByteArray.INITIAL_CAPACITY);
        this.m_dataview = new DataView(arraybuf);
        this.m_u8array = new Uint8Array(arraybuf);
    }
}